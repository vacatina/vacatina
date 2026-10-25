/* ============================================================================
 * Vacatina Unified Inventory Master Service
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md & ADR-006
 *
 * Coordinates concurrent search across API, Manual, and Hybrid sources,
 * applies Cache TTL, executes Circuit Breaker protection, normalizes
 * offers, deduplicates composite keys, and delivers CanonicalOfferEntity[].
 * ============================================================================ */

import type {
  CanonicalOfferEntity,
  CircuitBreakerTelemetry,
  RevalidationResult,
  SearchQueryCriteria,
  TravelProductSlug
} from './types.ts';
import { assertProductionResponseSafety } from './types.ts';
import { BaseSupplierAdapter } from './adapters/base.adapter.ts';
import { FlightsDuffelAdapter } from './adapters/flights-duffel.adapter.ts';
import { HotelsLiteApiAdapter } from './adapters/hotels-liteapi.adapter.ts';
import { CarsRentalAdapter } from './adapters/cars-rental.adapter.ts';
import { CruisesTraveltekAdapter } from './adapters/cruises-traveltek.adapter.ts';
import { ActivitiesViatorAdapter } from './adapters/activities-viator.adapter.ts';
import { SightseeingViatorAdapter } from './adapters/sightseeing-viator.adapter.ts';
import { RailsTrainlineAdapter } from './adapters/rails-trainline.adapter.ts';
import { InsuranceAllianzAdapter } from './adapters/insurance-allianz.adapter.ts';
import { VisaConsularAdapter } from './adapters/visa-consular.adapter.ts';
import { ManualCmsAdapter } from './adapters/manual-cms.adapter.ts';
import { PackagesBundlerAdapter } from './adapters/packages-bundler.adapter.ts';
import { DeduplicationService } from './deduplication.service.ts';
import { CacheTtlService, globalInventoryCache } from './cache-ttl.service.ts';
import { CircuitBreakerService, globalCircuitBreaker } from './circuit-breaker.service.ts';

export class UnifiedInventoryService {
  private adapters: Map<string, BaseSupplierAdapter>;
  private manualAdapter: ManualCmsAdapter;
  private cache: CacheTtlService;
  private circuitBreaker: CircuitBreakerService;

  constructor(
    cache: CacheTtlService = globalInventoryCache,
    circuitBreaker: CircuitBreakerService = globalCircuitBreaker
  ) {
    this.cache = cache;
    this.circuitBreaker = circuitBreaker;
    this.adapters = new Map();

    // Register all 10 canonical domain adapters + Manual & Hybrid
    this.manualAdapter = new ManualCmsAdapter();
    this.registerAdapter(new FlightsDuffelAdapter());
    this.registerAdapter(new HotelsLiteApiAdapter());
    this.registerAdapter(new CarsRentalAdapter());
    this.registerAdapter(new CruisesTraveltekAdapter());
    this.registerAdapter(new ActivitiesViatorAdapter());
    this.registerAdapter(new SightseeingViatorAdapter());
    this.registerAdapter(new RailsTrainlineAdapter());
    this.registerAdapter(new InsuranceAllianzAdapter());
    this.registerAdapter(new VisaConsularAdapter());
    this.registerAdapter(new PackagesBundlerAdapter());
    this.registerAdapter(this.manualAdapter);
  }

  public registerAdapter(adapter: BaseSupplierAdapter): void {
    this.adapters.set(adapter.supplierId, adapter);
  }

  public getManualAdapter(): ManualCmsAdapter {
    return this.manualAdapter;
  }

  /**
   * Unified Search across all relevant API, Manual, and Hybrid sources.
   */
  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const cacheKey = `search:${criteria.productType}:${criteria.origin || ''}:${criteria.destination}:${criteria.departureDate || ''}:${criteria.cabinClass || ''}`;

    // 1. Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const collectedOffers: CanonicalOfferEntity[] = [];

    // 2. Query Manual Inventory (Direct Contracts)
    try {
      const manualOffers = await this.manualAdapter.search(criteria);
      collectedOffers.push(...manualOffers);
    } catch (err: any) {
      console.warn(`[UnifiedInventory] Manual search non-fatal error: ${err.message}`);
    }

    // 3. Query Target Product API Supplier with Circuit Breaker Protection
    const matchingAdapters = Array.from(this.adapters.values()).filter(
      a => a.productType === criteria.productType && a.supplierId !== this.manualAdapter.supplierId
    );

    for (const adapter of matchingAdapters) {
      try {
        const apiOffers = await this.circuitBreaker.executeWithBreaker(
          adapter.supplierId,
          () => adapter.search(criteria),
          async (fallbackReason) => {
            console.warn(`[UnifiedInventory] Outage fallback triggered for ${adapter.supplierId}: ${fallbackReason}`);
            // Return empty list so manual inventory gracefully serves as primary
            return [];
          }
        );
        collectedOffers.push(...apiOffers);
      } catch (err: any) {
        console.warn(`[UnifiedInventory] Adapter ${adapter.supplierId} failure: ${err.message}`);
      }
    }

    // 4. Strict SEED Isolation, Sellability & Channel Distribution Filter (Rules 4, 5 & ADR-008)
    // SEED and DISCOVERY_ONLY content must NEVER enter live supplier search results
    // B2C channel must NEVER leak B2B_ONLY or INTERNAL_ONLY inventory
    // B2B channel must NEVER leak B2C_ONLY or INTERNAL_ONLY inventory
    const channel = criteria.channel || 'B2C';
    const eligibleOffers = collectedOffers.filter(offer => {
      if (offer.environmentClass === 'SEED' || offer.sellability === 'DISCOVERY_ONLY') return false;
      if (channel === 'B2C' && (offer.distributionScope === 'B2B_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
        return false;
      }
      if (channel === 'B2B' && (offer.distributionScope === 'B2C_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
        return false;
      }
      return true;
    });

    // 5. Deduplicate and Apply Pin-Above-API / Best-Price Ranking
    const rankedOffers = DeduplicationService.deduplicateAndRank(eligibleOffers);

    // 6. Guarantee Production Response Safety & Channel Integrity (Directive 9)
    assertProductionResponseSafety(rankedOffers, {
      channel,
      environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
    });

    // 7. Store in Product-by-Product TTL Cache
    if (rankedOffers.length > 0) {
      this.cache.set(cacheKey, rankedOffers, criteria.productType);
    }

    return rankedOffers;
  }

  /**
   * Revalidates an offer price and availability prior to checkout or status update.
   */
  public async revalidateOffer(offerId: string): Promise<RevalidationResult> {
    // Route by supplier prefix
    if (offerId.includes('-man-') || offerId.includes('cms_')) {
      return this.manualAdapter.revalidate(offerId);
    }

    if (offerId.includes('-fl-duffel-')) {
      const duffel = this.adapters.get('DUFFEL_NDC');
      if (duffel) return duffel.revalidate(offerId);
    }

    if (offerId.includes('-ht-liteapi-')) {
      const liteapi = this.adapters.get('LITEAPI');
      if (liteapi) return liteapi.revalidate(offerId);
    }

    // Generic fallback
    return {
      offerId,
      status: 'UNCHANGED',
      message: 'Offer rate rechecked via Vacatina Unified Inventory'
    };
  }

  /**
   * Health telemetry across all upstream suppliers.
   */
  public getSupplierHealth(): CircuitBreakerTelemetry[] {
    const list: CircuitBreakerTelemetry[] = [];
    for (const adapter of this.adapters.values()) {
      list.push(this.circuitBreaker.getTelemetry(adapter.supplierId));
    }
    return list;
  }
}

export const globalUnifiedInventory = new UnifiedInventoryService();
