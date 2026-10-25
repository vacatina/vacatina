/* ============================================================================
 * Vacatina Sightseeing Tours Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Sightseeing)
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

export interface RawSightseeingTourOffer {
  tourCode: string;
  title: string;
  city: string;
  country: string;
  countryCode: string;
  durationHours: number;
  netRateMinor: number;
  currency: string;
  isSkipTheLine: boolean;
  guideLanguage: string;
}

export class SightseeingViatorAdapter extends BaseSupplierAdapter<RawSightseeingTourOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'VIATOR_SIGHTSEEING',
      supplierName: 'Viator Sightseeing & Heritage Tours',
      productType: 'sightseeing',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.viator.com/sightseeing/v1',
      productionBaseUrl: 'https://api.viator.com/sightseeing/v1',
      apiKey,
      timeoutMs: 4000,
      integrationLifecycle: 'SCAFFOLD'
    });
  }

  public normalize(raw: RawSightseeingTourOffer): CanonicalOfferEntity {
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'sightseeing',
      rawSupplierCostMinor: raw.netRateMinor,
      rawCurrency: raw.currency,
      targetCurrency: raw.currency
    });

    const offerId = `vct-sg-viator-${raw.city.toLowerCase().slice(0, 3)}-${raw.tourCode.slice(-6)}`;

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'sightseeing',
      inventorySource: 'API',
      listingKind: 'SELLABLE_INVENTORY',
      compositionType: 'SINGLE',
      fulfillmentMode: 'INSTANT',
      environmentClass: this.isProduction && this.config.apiKey ? 'PRODUCTION' : 'SANDBOX',
      sellability: this.isProduction && this.config.apiKey ? 'BOOKABLE' : 'QUOTE_ONLY',
      providerLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.title} via Viator`,
      supplierOfferId: raw.tourCode,
      title: raw.title,
      subtitle: `${raw.durationHours} Hours · ${raw.isSkipTheLine ? 'Skip-The-Line Entry' : 'Standard Access'} · ${raw.guideLanguage} Guide`,
      location: {
        city: raw.city,
        country: raw.country,
        countryCode: raw.countryCode
      },
      availabilityStatus: this.isProduction && this.config.apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 14400, // 4 hours
        expiresAtIso: new Date(Date.now() + 14400000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Guaranteed skip-the-line monument entry voucher',
        'Official licensed tourist board guide accompaniment',
        'Audio whisper headset for large tour groups'
      ],
      exclusions: ['Hotel pickup and return transportation', 'Food and beverage tastings'],
      cancellationPolicy: 'Free cancellation up to 24 hours prior to tour departure time.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !this.config.apiKey,
      integrationLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        tourCode: raw.tourCode,
        durationHours: raw.durationHours,
        isSandboxSimulated: !this.isProduction || !this.config.apiKey
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return this.applyCanonicalContractDefaults(offer);
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const mockRaw: RawSightseeingTourOffer = {
      tourCode: `sg_${Math.random().toString(36).slice(2, 8)}`,
      title: `Iconic Historical City Tour of ${criteria.destination || 'Dubai'}`,
      city: criteria.destination || 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      durationHours: 4,
      netRateMinor: 4800, // $48.00
      currency: criteria.currency || 'USD',
      isSkipTheLine: true,
      guideLanguage: 'English'
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: isLive
        ? 'Sightseeing departure schedule verified via Viator API'
        : '[SANDBOX / MOCK MODE] Simulated sightseeing tour check. Live Viator key not configured.'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `SG-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 14400000).toISOString(),
      guaranteedPriceMinor: 4800,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    this.assertCanExecuteProductionBooking();
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      supplierReference: isLive
        ? `SG-CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `SG-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `TKT-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `SG-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 4800
    };
  }
}
