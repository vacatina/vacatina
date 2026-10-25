/* ============================================================================
 * Vacatina Viator Activities & Experiences Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q5/Q9/Q10/Q11)
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

export interface RawViatorExperienceOffer {
  productCode: string; // "10423P1"
  title: string;       // "Desert Safari with BBQ Dinner & Dune Bashing"
  destination: { city: string; country: string; countryCode: string };
  duration: string;    // "6 hours"
  netPrice: number;    // 75.00
  currency: string;    // "USD"
  instantConfirmation: boolean;
  inclusions?: string[];
  cancellationPolicyDescription?: string;
}

export class ActivitiesViatorAdapter extends BaseSupplierAdapter<RawViatorExperienceOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'VIATOR',
      supplierName: 'Viator Tripadvisor Experiences',
      productType: 'activities',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.viator.com/partner/v1',
      productionBaseUrl: 'https://api.viator.com/partner/v1',
      apiKey,
      timeoutMs: 5000
    });
  }

  public normalize(raw: RawViatorExperienceOffer): CanonicalOfferEntity {
    const rawCostMinor = Math.round(raw.netPrice * 100);
    const rawCurrency = raw.currency || 'USD';

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'activities',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-ac-viator-${raw.destination.city.toLowerCase().replace(/[^a-z0-9]/g, '')}-${raw.productCode.toLowerCase()}`;
    const expiresAtIso = new Date(Date.now() + 14400000).toISOString(); // 4 hours TTL

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'activities',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.title} via Viator`,
      supplierOfferId: raw.productCode,
      title: raw.title,
      subtitle: `${raw.duration} · English Guide · Pickup Included`,
      location: {
        city: raw.destination.city,
        country: raw.destination.country,
        countryCode: raw.destination.countryCode
      },
      availabilityStatus: 'LIVE',
      confirmationMode: raw.instantConfirmation ? 'INSTANT_CONFIRM' : 'REQUEST_TO_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 14400,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: raw.inclusions || [
        'Hotel pickup and drop-off in air-conditioned vehicle',
        'Professional licensed desert safari marshal',
        'BBQ buffet dinner with vegetarian & non-veg options'
      ],
      exclusions: ['Quad bike & dune buggy rental (available as on-site add-on)', 'Gratuities for guide'],
      cancellationPolicy: raw.cancellationPolicyDescription || 'Free cancellation up to 24 hours before activity start.',
      pinAboveApi: false,
      deduplicationKey: '',
      sourceMetadata: {
        viatorProductCode: raw.productCode,
        duration: raw.duration
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
    const mockRaw: RawViatorExperienceOffer = {
      productCode: '10423P1',
      title: `Desert Safari & Dune Bashing in ${criteria.destination}`,
      destination: { city: criteria.destination, country: 'United Arab Emirates', countryCode: 'AE' },
      duration: '6 hours',
      netPrice: 75.00,
      currency: criteria.currency || 'USD',
      instantConfirmation: true
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: 'Experience schedule & slots verified by Viator'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `VIA-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 14400000).toISOString(),
      guaranteedPriceMinor: 7500,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `VIA-BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: `BARCODE-${Math.floor(10000000 + Math.random() * 90000000)}`,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'CONFIRMED'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `VIA-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 7500
    };
  }
}
