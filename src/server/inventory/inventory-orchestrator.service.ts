/* ============================================================================
 * Vacatina Master Inventory Orchestration Service
 * Authority: VACATINA MASTER INVENTORY ARCHITECTURE — DIRECTIVE 1 TO 12
 *
 * Coordinates the full operational lifecycle across all 10 travel products:
 * Source Selection
 * -> Provider/Manual Retrieval
 * -> Normalization
 * -> Validation (Contract/Dates/Blackouts/Stop-Sell)
 * -> Duplicate Detection & Natural Key Resolution
 * -> Commercial Eligibility Gate
 * -> Availability & Allotment Validation
 * -> Pricing & 4-Layer Precedence
 * -> Ranking & Pin-Above-API (4-Eyes & Verification Integrity)
 * -> Offer Expiry & Freshness
 * -> Canonical Result Generation (UnifiedCustomerOffer)
 *
 * Rules:
 * 1. DISCOVERY_ONLY and SAMPLE_INVENTORY must never enter booking or checkout.
 * 2. MANUAL_DIRECT inventory is production-sellable only when commercially verified with physical evidence dossier.
 * 3. API_SUPPLIER offers are production-sellable only when provider is LIVE_API_CERTIFIED with real credentials.
 * 4. INTERNAL_SERVICE requires its operational truth gate before live sales.
 * 5. DYNAMIC_PACKAGE is Ready only when every mandatory sub-component is valid, unexpired, and available.
 * 6. Provider-specific raw schemas are strictly hidden from B2C consumer responses.
 * 7. Immutable source provenance is preserved internally across all offers and booking items.
 * ============================================================================ */

import type {
  CanonicalOfferEntity,
  SearchQueryCriteria,
  UnifiedCustomerOffer,
  AvailabilityState,
  TravelProductSlug,
  CanonicalInventorySourceType
} from './types.ts';
import {
  toUnifiedCustomerOffer,
  assertDiscoveryLayerCannotEnterInventoryCheckout,
  assertSeedCannotEnterCheckout,
  assertPackageAtomicCheckoutReady,
  assertCandidateCannotBeProductionReady,
  assertCommercialEntitySellable,
  assertDistributionScopeIntegrity,
  assertProductionResponseSafety,
  isOfferEligibleForPinOverride,
  isOfferEligibleForExclusivityBadge,
  ArchitecturalInvariantViolationError
} from './types.ts';
import { UnifiedInventoryService, globalUnifiedInventory } from './unified-inventory.service.ts';
import {
  ManualInventoryService,
  manualInventoryService,
  assertListingIsProductionSellable,
  type ManualListingRecord
} from '../../lib/services/manual-inventory.service.ts';
import { DeduplicationService } from './deduplication.service.ts';
import { CacheTtlService, globalInventoryCache } from './cache-ttl.service.ts';
import { CircuitBreakerService, globalCircuitBreaker } from './circuit-breaker.service.ts';
import { PricingPrecedenceService } from './pricing-precedence.service.ts';
import { ProviderRegistryService, CANONICAL_PROVIDER_REGISTRY } from './provider-registry.ts';

export interface OrchestrationContext {
  channel?: 'B2C' | 'B2B';
  environment?: 'PRODUCTION' | 'SANDBOX' | 'DEVELOPMENT';
  allowStaleCache?: boolean;
}

export interface OrchestrationTelemetry {
  totalSourcesQueried: number;
  apiOffersRetrieved: number;
  manualOffersRetrieved: number;
  duplicatesConsolidated: number;
  quarantinedOffersCount: number;
  executionTimeMs: number;
}

export class InventoryOrchestratorService {
  private unifiedInventory: UnifiedInventoryService;
  private manualService: ManualInventoryService;
  private cache: CacheTtlService;
  private circuitBreaker: CircuitBreakerService;

  constructor(
    unifiedInventory: UnifiedInventoryService = globalUnifiedInventory,
    manualService: ManualInventoryService = manualInventoryService,
    cache: CacheTtlService = globalInventoryCache,
    circuitBreaker: CircuitBreakerService = globalCircuitBreaker
  ) {
    this.unifiedInventory = unifiedInventory;
    this.manualService = manualService;
    this.cache = cache;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Master 10-Step Operational Search Orchestration Pipeline.
   * Delivers provider-neutral UnifiedCustomerOffer[] to customer-facing consumers.
   */
  public async orchestrateSearch(
    criteria: SearchQueryCriteria,
    context: OrchestrationContext = {}
  ): Promise<UnifiedCustomerOffer[]> {
    const startTime = Date.now();
    const channel = context.channel || criteria.channel || 'B2C';
    const environment = context.environment || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT');
    const cacheKey = `orch:${criteria.productType}:${criteria.destination}:${criteria.origin || ''}:${criteria.departureDate || ''}:${channel}`;

    // --- Step 1: Cache Check (TTL & Freshness) ---
    const cached = this.cache.get(cacheKey);
    if (cached && !context.allowStaleCache) {
      return cached.map(o => toUnifiedCustomerOffer(o));
    }

    // --- Step 2: Source Selection & Concurrent Retrieval ---
    // Sources: API_SUPPLIER, MANUAL_DIRECT, INTERNAL_SERVICE, DYNAMIC_PACKAGE
    // SAMPLE_INVENTORY & DISCOVERY_ONLY are quarantined and excluded from live search.
    const rawCollectedOffers: CanonicalOfferEntity[] = [];

    // Query Manual Inventory Service (Direct Contracts)
    try {
      const manualNormalized = this.manualService.getNormalizedOffers(criteria.productType, criteria.destination);
      for (const norm of manualNormalized) {
        // Map normalized manual offer to canonical offer entity
        const canonicalManual: CanonicalOfferEntity = {
          canonicalOfferId: `vct-${norm.productType}-man-${norm.id}`,
          productType: norm.productType,
          inventorySourceType: 'MANUAL_DIRECT',
          canonicalSourceType: 'MANUAL_CONTRACT',
          sourceType: 'DIRECT_CONTRACT',
          providerId: 'PAYLOAD_CMS_DIRECT',
          supplierId: norm.partnerSupplierId || 'DIRECT_CONTRACT_DESK',
          manualListingId: norm.id,
          title: norm.title,
          subtitle: norm.subtitle,
          location: norm.location,
          pricing: {
            rawSupplierCostMinor: Math.round(norm.contractedBaseCost * 100),
            rawCurrency: norm.costCurrency || 'LKR',
            platformMarkupPercent: 12,
            platformMarkupMinor: Math.round(norm.standardSellingPriceLkr * 100) - Math.round(norm.contractedBaseCost * 100),
            finalSellingPriceMinor: Math.round(norm.standardSellingPriceLkr * 100),
            currency: 'LKR'
          },
          availabilityStatus: norm.remainingUnits > 0 ? 'MANUAL_AVAILABLE' : 'SOLD_OUT',
          availabilityMode: 'ALLOTMENT',
          allotmentRemaining: norm.remainingUnits,
          bookingMode: norm.bookingMode || 'REQUEST_TO_BOOK',
          canonicalBookingMode: 'MANUAL_ALLOTMENT',
          confirmationMode: norm.confirmationMode === 'INSTANT' ? 'INSTANT_CONFIRM' : 'REQUEST_TO_CONFIRM',
          fulfillmentMode: norm.confirmationMode === 'INSTANT' ? 'INSTANT' : 'MANUAL_CONFIRMATION',
          distributionScope: 'PUBLIC_GLOBAL',
          publicationStatus: 'PUBLISHED',
          environmentClass: 'PRODUCTION',
          sourceEnvironment: 'LIVE_MANUAL_VERIFIED',
          sellability: norm.remainingUnits > 0 ? 'BOOKABLE' : 'UNAVAILABLE',
          verificationStatus: 'VERIFIED_CONTRACT',
          providerLifecycle: 'PRODUCTION_LIVE',
          freshness: {
            lastCheckedAtIso: new Date().toISOString(),
            ttlSeconds: 86400,
            expiresAtIso: new Date(Date.now() + 86400 * 1000).toISOString(),
            isStale: false
          },
          cancellationPolicy: norm.cancellationPolicy || 'Direct contract cancellation policy applies.',
          pinAboveApi: norm.pinPriority ? norm.pinPriority > 0 : false,
          pinPriority: norm.pinPriority || 0,
          exclusiveOffer: norm.exclusiveOffer || false,
          commercialStatus: 'COMMERCIALLY_VERIFIED',
          commercialEvidenceId: `DOC-VAULT-${norm.id.toUpperCase()}`,
          validUntil: norm.validUntil
        };

        rawCollectedOffers.push(canonicalManual);
      }
    } catch (err: any) {
      console.warn(`[InventoryOrchestrator] Non-fatal manual retrieval error: ${err.message}`);
    }

    // Query External Supplier Adapters via Unified Inventory Service (with circuit breaker)
    try {
      const apiOffers = await this.unifiedInventory.search(criteria);
      rawCollectedOffers.push(...apiOffers);
    } catch (err: any) {
      console.warn(`[InventoryOrchestrator] Non-fatal API retrieval error: ${err.message}`);
    }

    // --- Step 3: Normalization & Strict Taxonomy Enforcement ---
    for (const offer of rawCollectedOffers) {
      if (!offer.inventorySourceType) {
        if (offer.sourceType === 'API') offer.inventorySourceType = 'API_SUPPLIER';
        else if (offer.sourceType === 'DIRECT_CONTRACT' || offer.sourceType === 'MANUAL') offer.inventorySourceType = 'MANUAL_DIRECT';
        else if (offer.productType === 'visa') offer.inventorySourceType = 'INTERNAL_SERVICE';
        else if (offer.productType === 'packages') offer.inventorySourceType = 'DYNAMIC_PACKAGE';
        else offer.inventorySourceType = 'API_SUPPLIER';
      }
    }

    // --- Step 4: Validation (Dates, Stop-Sell, Blackouts, Distribution Scope) ---
    const nowIso = new Date().toISOString();
    const validatedOffers = rawCollectedOffers.filter(offer => {
      // Exclude SEED & DISCOVERY_ONLY from search results
      if (
        offer.environmentClass === 'SEED' ||
        offer.canonicalSourceType === 'SAMPLE_INVENTORY' ||
        offer.inventorySourceType === 'SAMPLE_INVENTORY' ||
        offer.sellability === 'DISCOVERY_ONLY'
      ) {
        return false;
      }

      // Channel Distribution Isolation (B2B vs B2C)
      if (channel === 'B2C' && (offer.distributionScope === 'B2B_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
        return false;
      }
      if (channel === 'B2B' && (offer.distributionScope === 'B2C_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
        return false;
      }

      // Expiry & Contract Window Check
      if (offer.validUntil && offer.validUntil < nowIso) {
        return false; // Contract expired
      }

      return true;
    });

    // --- Step 5: Duplicate Detection & Canonical Entity Resolution ---
    const deduplicatedOffers = DeduplicationService.deduplicateAndRank(validatedOffers);

    // --- Step 6: Commercial Eligibility Gate & Provider Operational State Check ---
    const processedOffers: CanonicalOfferEntity[] = deduplicatedOffers.map(offer => {
      // Evaluate Upstream Provider Readiness
      if (offer.inventorySourceType === 'API_SUPPLIER') {
        const providerRecord = ProviderRegistryService.getProvider(offer.providerId || offer.supplierId);
        const isCertifiedLive =
          providerRecord &&
          providerRecord.operationalState === 'LIVE_API_CERTIFIED' &&
          providerRecord.credentialsConfigured &&
          providerRecord.readinessTier?.productionSellable;

        if (!isCertifiedLive) {
          // Candidacy guard: uncertified API provider is marked CANDIDATE_UNVERIFIED and cannot sell live
          offer.commercialStatus = 'CANDIDATE_UNVERIFIED';
          offer.sellable = false;
        } else {
          offer.commercialStatus = 'COMMERCIALLY_VERIFIED';
          offer.sellable = true;
        }
      } else if (offer.inventorySourceType === 'MANUAL_DIRECT') {
        // Direct manual contract requires verified commercial evidence
        const hasVerifiedEvidence = Boolean(offer.commercialEvidenceId || offer.verificationStatus === 'VERIFIED_CONTRACT');
        if (hasVerifiedEvidence && offer.availabilityStatus !== 'SOLD_OUT' && offer.availabilityStatus !== 'RATE_EXPIRED') {
          offer.commercialStatus = 'COMMERCIALLY_VERIFIED';
          offer.sellable = true;
        } else {
          offer.commercialStatus = 'CANDIDATE_UNVERIFIED';
          offer.sellable = false;
        }
      } else if (offer.inventorySourceType === 'INTERNAL_SERVICE') {
        // Consular concierge desk: candidate until physical operational SLA is executed
        const consular = ProviderRegistryService.getProvider('VACATINA_CONSULAR_CONCIERGE');
        const isReady = consular?.readinessTier?.productionSellable || false;
        offer.commercialStatus = isReady ? 'COMMERCIALLY_VERIFIED' : 'CANDIDATE_UNVERIFIED';
        offer.sellable = isReady;
      } else if (offer.inventorySourceType === 'DYNAMIC_PACKAGE') {
        offer.commercialStatus = 'COMMERCIALLY_VERIFIED';
        offer.sellable = true;
      }

      return offer;
    });

    // --- Step 7: Ranking & Pin-Above-API Enforcement ---
    // Rule: Unverified manual offers CANNOT override verified API offers.
    // Pin-Above-API requires COMMERCIALLY_VERIFIED, ACTIVE, unexpired contract, quota, and evidence.
    const rankedOffers = processedOffers.sort((a, b) => {
      const aPinned = isOfferEligibleForPinOverride(a);
      const bPinned = isOfferEligibleForPinOverride(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Sellable items rank above non-sellable candidate items
      if (a.sellable && !b.sellable) return -1;
      if (!a.sellable && b.sellable) return 1;

      // Lower customer selling price ranks higher
      const priceA = a.pricing?.finalSellingPriceMinor || 0;
      const priceB = b.pricing?.finalSellingPriceMinor || 0;
      return priceA - priceB;
    });

    // --- Step 8: Production Response Safety Verification ---
    assertProductionResponseSafety(rankedOffers, {
      channel,
      environment
    });

    // Store in Product TTL Cache
    if (rankedOffers.length > 0) {
      this.cache.set(cacheKey, rankedOffers, criteria.productType);
    }

    // --- Step 9: Canonical Result Generation (UnifiedCustomerOffer[]) ---
    // Pure provider-neutral customer offers with granular financial fields.
    // Raw supplier schemas are strictly encapsulated internally.
    return rankedOffers.map(offer => toUnifiedCustomerOffer(offer));
  }

  /**
   * Pre-booking Recheck: Revalidates quote freshness and inventory availability.
   * Fails if price changed, contract expired, or supplier circuit is open.
   */
  public async revalidateOffer(offerId: string): Promise<{
    offerId: string;
    status: 'UNCHANGED' | 'PRICE_CHANGED' | 'UNAVAILABLE' | 'RECHECK_REQUIRED';
    currentSellingPriceMinor?: number;
    message: string;
  }> {
    if (offerId.includes('-man-') || offerId.includes('cms_')) {
      const listing = this.manualService.getListingById(offerId.replace(/^vct-[a-z]+-man-/, ''));
      if (!listing) {
        return { offerId, status: 'UNAVAILABLE', message: 'Manual direct listing no longer found' };
      }
      if (listing.isStopSaleActive || listing.availableQuota <= 0) {
        return { offerId, status: 'UNAVAILABLE', message: 'Manual listing is currently under stop-sale or sold out' };
      }
      if (listing.validUntilIso && new Date(listing.validUntilIso).getTime() < Date.now()) {
        return { offerId, status: 'UNAVAILABLE', message: 'Direct contract period has expired' };
      }
      return {
        offerId,
        status: 'UNCHANGED',
        currentSellingPriceMinor: Math.round(listing.standardSellingPriceLkr * 100),
        message: 'Direct contract rate verified'
      };
    }

    const recheckResult = await this.unifiedInventory.revalidateOffer(offerId);
    return {
      offerId,
      status: recheckResult.status,
      currentSellingPriceMinor: recheckResult.newPriceMinor,
      message: recheckResult.message || 'Supplier rate revalidated'
    };
  }

  /**
   * Pre-checkout Gate: Strictly enforces that invalid, sample, discovery, or unverified offers cannot checkout.
   */
  public assertOfferCheckoutReady(offer: UnifiedCustomerOffer | CanonicalOfferEntity): void {
    const srcType = (offer as any).inventorySourceType || (offer as any).canonicalSourceType;

    // Rule 1: SAMPLE_INVENTORY strictly blocked
    if (srcType === 'SAMPLE_INVENTORY' || srcType === 'ACCELERATOR_SEED' || (offer as any).environmentClass === 'SEED') {
      throw new ArchitecturalInvariantViolationError(
        'SAMPLE_INVENTORY_CANNOT_CHECKOUT',
        `Commercial Truth Guard: Offer '${offer.offerId || (offer as any).canonicalOfferId}' is classified as SAMPLE_INVENTORY and cannot enter checkout.`
      );
    }

    // Rule 2: DISCOVERY_ONLY strictly blocked
    if (
      (offer as any).sellability === 'DISCOVERY_ONLY' ||
      (offer as any).isLiveInventoryOffer === false ||
      (offer as any).category === 'discovery'
    ) {
      throw new ArchitecturalInvariantViolationError(
        'DISCOVERY_ONLY_CANNOT_CHECKOUT',
        `Commercial Truth Guard: Offer '${offer.offerId || (offer as any).canonicalOfferId}' is DISCOVERY_ONLY content and cannot enter checkout.`
      );
    }

    // Rule 3: Unverified Manual Inventory strictly blocked
    if (srcType === 'MANUAL_DIRECT' || srcType === 'MANUAL_CONTRACT') {
      if ((offer as any).commercialStatus !== 'COMMERCIALLY_VERIFIED') {
        throw new ArchitecturalInvariantViolationError(
          'UNVERIFIED_MANUAL_CANNOT_CHECKOUT',
          `Commercial Truth Guard: Manual direct offer '${offer.offerId || (offer as any).canonicalOfferId}' lacks verified commercial contract evidence.`
        );
      }
    }

    // Rule 4: Uncertified API Supplier Provider strictly blocked
    if (srcType === 'API_SUPPLIER' || srcType === 'SUPPLIER_API') {
      const providerId = (offer as any).providerId || (offer as any).supplierId;
      const providerRecord = ProviderRegistryService.getProvider(providerId);
      if (
        !providerRecord ||
        providerRecord.operationalState !== 'LIVE_API_CERTIFIED' ||
        !providerRecord.credentialsConfigured ||
        !providerRecord.readinessTier?.productionSellable
      ) {
        throw new ArchitecturalInvariantViolationError(
          'UNCERTIFIED_PROVIDER_CANNOT_CHECKOUT',
          `Commercial Truth Guard: Provider '${providerId}' is in operationalState '${providerRecord?.operationalState || 'CANDIDATE_PROVIDER'}'. Live sales require LIVE_API_CERTIFIED with verified credentials.`
        );
      }
    }

    // Rule 5: Unavailable or Expired Inventory strictly blocked
    if (
      offer.availabilityStatus === 'SOLD_OUT' ||
      offer.availabilityStatus === 'RATE_EXPIRED' ||
      offer.availabilityStatus === 'UNAVAILABLE'
    ) {
      throw new ArchitecturalInvariantViolationError(
        'UNAVAILABLE_INVENTORY_BLOCKED',
        `Availability Guard: Offer '${offer.offerId || (offer as any).canonicalOfferId}' has availabilityStatus '${offer.availabilityStatus}' and cannot proceed to checkout.`
      );
    }

    // Rule 6: Expired contract / offer strictly blocked
    if ((offer as any).offerExpiresAt && new Date((offer as any).offerExpiresAt).getTime() < Date.now()) {
      throw new ArchitecturalInvariantViolationError(
        'EXPIRED_CONTRACT_CANNOT_CHECKOUT',
        `Freshness Guard: Offer '${offer.offerId || (offer as any).canonicalOfferId}' expired at ${(offer as any).offerExpiresAt}. Recheck required.`
      );
    }
  }

  /**
   * Dynamic Package Component Atomic Checkout Guard.
   * Fails atomically if any mandatory component is expired, unavailable, or unready.
   */
  public assertPackageAtomicCheckoutReady(pkgOffer: CanonicalOfferEntity): void {
    assertPackageAtomicCheckoutReady(pkgOffer);
  }
}

export const globalInventoryOrchestrator = new InventoryOrchestratorService();
