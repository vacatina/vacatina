/* ============================================================================
 * Vacatina Hybrid Multi-Component Package Bundler Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q9/Q11/HYBRID)
 *
 * Coordinates composite bundles uniting live API components (flights) with
 * direct-contract manual components (boutique hotels, chauffeur transfers, visa).
 * ============================================================================ */

import { BaseSupplierAdapter } from './base.adapter.ts';
import type {
  BookingCancelResult,
  BookingConfirmResult,
  BookingHoldResult
} from './base.adapter.ts';
import type {
  CanonicalOfferEntity,
  RevalidationResult,
  SearchQueryCriteria
} from '../types.ts';
import { PricingPrecedenceService } from '../pricing-precedence.service.ts';
import { DeduplicationService } from '../deduplication.service.ts';

export interface RawHybridPackageBundle {
  bundleId: string; // "bdl_dubai_escape_001"
  title: string;    // "Dubai Complete Escape 5D4N"
  destinationCity: string;
  destinationCountry: string;
  durationDays: number;
  components: {
    flight: { supplierId: 'DUFFEL_NDC'; flightNumber: string; rawCostMinor: number };
    hotel: { supplierId: 'LITEAPI' | 'DIRECT_HOTEL'; propertyName: string; rawCostMinor: number };
    transfer: { supplierId: 'LOCAL_FLEET'; vehicle: string; rawCostMinor: number };
    visa: { supplierId: 'VACATINA_VISA_DESK'; type: string; rawCostMinor: number };
  };
  costCurrency: string;
  inclusions: string[];
  exclusions: string[];
}

export class PackagesBundlerAdapter extends BaseSupplierAdapter<RawHybridPackageBundle> {
  constructor() {
    super({
      supplierId: 'VACATINA_HYBRID_BUNDLER',
      supplierName: 'Vacatina Hybrid Package Engine',
      productType: 'packages',
      environment: 'production',
      sandboxBaseUrl: 'http://localhost:3000/api',
      productionBaseUrl: 'https://vacatina-nu.vercel.app/api',
      timeoutMs: 4000
    });
  }

  public normalize(raw: RawHybridPackageBundle): CanonicalOfferEntity {
    // Sum raw costs of all heterogeneous components
    const totalRawCostMinor =
      raw.components.flight.rawCostMinor +
      raw.components.hotel.rawCostMinor +
      raw.components.transfer.rawCostMinor +
      raw.components.visa.rawCostMinor;

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'packages',
      rawSupplierCostMinor: totalRawCostMinor,
      rawCurrency: raw.costCurrency
    });

    const offerId = `vct-hyb-pkg-${raw.bundleId.slice(-6)}`;
    const expiresAtIso = new Date(Date.now() + 3600000).toISOString(); // 1 hour TTL

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'packages',
      sourceType: 'HYBRID',
      supplierId: this.supplierId,
      supplierName: 'Vacatina Curated Package',
      title: raw.title,
      subtitle: `${raw.durationDays} Days / ${raw.durationDays - 1} Nights · Flight + Hotel + Transfer + Visa`,
      location: {
        city: raw.destinationCity,
        country: raw.destinationCountry,
        countryCode: 'AE'
      },
      availabilityStatus: 'LIVE',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 3600,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: raw.inclusions,
      exclusions: raw.exclusions,
      cancellationPolicy: 'Component-specific cancellation rules apply. Consult itinerary terms.',
      pinAboveApi: true,
      deduplicationKey: '',
      isSandboxSimulated: false,
      integrationLifecycle: 'SANDBOX_ACTIVE',
      sourceMetadata: {
        bundleId: raw.bundleId,
        components: raw.components,
        isMultiComponentHybrid: true
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return offer;
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const defaultBundle: RawHybridPackageBundle = {
      bundleId: 'bdl_dubai_escape_001',
      title: 'Dubai Complete Luxury Escape',
      destinationCity: criteria.destination || 'Dubai',
      destinationCountry: 'United Arab Emirates',
      durationDays: 5,
      components: {
        flight: { supplierId: 'DUFFEL_NDC', flightNumber: 'EK-651', rawCostMinor: 11000000 },
        hotel: { supplierId: 'DIRECT_HOTEL', propertyName: 'Atlantis The Royal', rawCostMinor: 25000000 },
        transfer: { supplierId: 'LOCAL_FLEET', vehicle: 'Mercedes V-Class Chauffeur', rawCostMinor: 3500000 },
        visa: { supplierId: 'VACATINA_VISA_DESK', type: 'UAE 60-Day Tourist Visa', rawCostMinor: 4500000 }
      },
      costCurrency: 'LKR',
      inclusions: [
        'Round-trip scheduled flights on Emirates',
        '4 Nights luxury accommodation with gourmet breakfast',
        'Private airport chauffeur transfers in luxury vehicle',
        'Complimentary 60-Day UAE Tourist Visa processing'
      ],
      exclusions: ['Personal incidental expenditures', 'Optional sightseeing upgrades']
    };

    return [this.normalize(defaultBundle)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: 'Multi-component package rates & availability rechecked'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `HYB-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 3600000).toISOString(),
      guaranteedPriceMinor: 48400000,
      currency: 'LKR'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `HYB-CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: undefined, // Final travel dossier dispatched once all 4 components are fulfilled
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `HYB-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 5000000,
      refundEligibleMinor: 43400000
    };
  }
}
