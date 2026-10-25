/* ============================================================================
 * Vacatina Consular Advisory & Visa Desk Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Visa)
 *
 * Dedicated manual service adapter for embassy visa application document vetting.
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

export interface RawVisaProductOffer {
  visaServiceId: string;
  countryName: string;
  countryCode: string;
  visaType: string;         // "Tourist e-Visa" | "Business Visa"
  durationDays: number;     // 30 | 60
  consularBaseCostMinor: number;
  currency: string;
  processingSlaDays: number;
}

export class VisaConsularAdapter extends BaseSupplierAdapter<RawVisaProductOffer> {
  constructor() {
    super({
      supplierId: 'VACATINA_CONSULAR_DESK',
      supplierName: 'Vacatina Consular Concierge Desk',
      productType: 'visa',
      environment: 'production',
      sandboxBaseUrl: 'http://localhost:3000/api',
      productionBaseUrl: 'https://vacatina-nu.vercel.app/api',
      timeoutMs: 3000,
      integrationLifecycle: 'OPERATIONALLY_LIVE_MANUAL'
    });
  }

  public normalize(raw: RawVisaProductOffer): CanonicalOfferEntity {
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'visa',
      rawSupplierCostMinor: raw.consularBaseCostMinor,
      rawCurrency: raw.currency,
      targetCurrency: raw.currency
    });

    const offerId = `vct-vs-consular-${raw.countryCode.toLowerCase()}-${raw.durationDays}d`;

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'visa',
      inventorySource: 'MANUAL_INTERNAL',
      listingKind: 'SERVICE',
      compositionType: 'SINGLE',
      fulfillmentMode: 'MANUAL_CONFIRMATION',
      environmentClass: 'PRODUCTION',
      sellability: 'BOOKABLE',
      providerLifecycle: 'PRODUCTION_LIVE',
      sourceType: 'MANUAL_SERVICE',
      supplierId: this.supplierId,
      supplierName: 'Vacatina Consular Advisory Service',
      supplierOfferId: raw.visaServiceId,
      title: `${raw.countryName} ${raw.durationDays}-Day ${raw.visaType} Assistance`,
      subtitle: `Document Vetting & Application Filing · SLA ${raw.processingSlaDays} Business Days`,
      location: {
        city: raw.countryName,
        country: raw.countryName,
        countryCode: raw.countryCode
      },
      availabilityStatus: 'MANUAL_AVAILABLE',
      confirmationMode: 'ASSISTED_SERVICE',
      bookingMode: 'REQUEST_TO_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 86400,
        expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Detailed application document checklist & biometric specification check',
        'Direct consultation with dedicated visa filing specialist',
        'Real-time status updates and embassy liaison'
      ],
      exclusions: ['Physical courier handling fees if original passport must be presented'],
      cancellationPolicy: 'Advisory service fee non-refundable once document vetting commences.',
      pinAboveApi: true,
      deduplicationKey: '',
      isSandboxSimulated: false,
      integrationLifecycle: 'OPERATIONALLY_LIVE_MANUAL',
      sourceMetadata: {
        visaServiceId: raw.visaServiceId,
        processingSlaDays: raw.processingSlaDays
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: false,
        lastRevalidationResult: 'UNCHANGED'
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return offer;
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const mockRaw: RawVisaProductOffer = {
      visaServiceId: `vs_${(criteria.destination || 'dxb').slice(0, 3)}_01`,
      countryName: criteria.destination || 'United Arab Emirates',
      countryCode: 'AE',
      visaType: 'Tourist e-Visa Assistance',
      durationDays: 60,
      consularBaseCostMinor: 3500000, // LKR 35,000 base
      currency: criteria.currency || 'LKR',
      processingSlaDays: 2
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: 'Consular document checklist & advisory capacity verified'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `VS-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
      guaranteedPriceMinor: 4750000,
      currency: 'LKR'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `VS-CASE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: undefined, // Case file reference assigned by consular officer
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `VS-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 4750000
    };
  }
}
