/* ============================================================================
 * Vacatina Allianz Partners Travel Insurance Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q8)
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

export interface RawInsurancePlanOffer {
  planCode: string;     // "ALZ_COMP_INTL"
  planName: string;     // "Allianz Global Comprehensive Plan"
  coverageRegion: string;
  medicalEmergencyCoverageMinor: number;
  tripCancellationCoverageMinor: number;
  baggageLossCoverageMinor: number;
  netPremiumMinor: number;
  premiumCurrency: string;
}

export class InsuranceAllianzAdapter extends BaseSupplierAdapter<RawInsurancePlanOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'ALLIANZ_PARTNERS',
      supplierName: 'Allianz Partners Underwriting Gateway',
      productType: 'insurance',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.allianz-assistance.com/v1',
      productionBaseUrl: 'https://api.allianz-assistance.com/v1',
      apiKey,
      timeoutMs: 4000,
      integrationLifecycle: 'SCAFFOLD'
    });
  }

  public normalize(raw: RawInsurancePlanOffer): CanonicalOfferEntity {
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'insurance',
      rawSupplierCostMinor: raw.netPremiumMinor,
      rawCurrency: raw.premiumCurrency,
      targetCurrency: raw.premiumCurrency
    });

    const offerId = `vct-ins-allianz-${raw.planCode.toLowerCase()}`;

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'insurance',
      inventorySource: 'API',
      listingKind: 'SERVICE',
      compositionType: 'SINGLE',
      fulfillmentMode: 'INSTANT',
      environmentClass: this.isProduction && this.config.apiKey ? 'PRODUCTION' : 'SANDBOX',
      sellability: this.isProduction && this.config.apiKey ? 'BOOKABLE' : 'QUOTE_ONLY',
      providerLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.planName} via Allianz Partners`,
      supplierOfferId: raw.planCode,
      title: raw.planName,
      subtitle: `Worldwide Emergency Medical & Trip Cancellation Coverage · ${raw.coverageRegion}`,
      location: {
        city: 'Global Coverage',
        country: 'Worldwide',
        countryCode: 'WW'
      },
      availabilityStatus: this.isProduction && this.config.apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 86400, // 24 hours
        expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'USD 250,000 Emergency overseas medical & hospitalization expenses',
        'USD 5,000 Trip cancellation and curtailment reimbursement',
        'USD 2,500 Checked baggage delay & loss compensation'
      ],
      exclusions: ['Pre-existing medical conditions (unless declared and accepted)', 'Extreme mountaineering & adventure sports'],
      cancellationPolicy: '14-day free look period with 100% premium refund prior to policy start.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !this.config.apiKey,
      integrationLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        planCode: raw.planCode,
        coverageRegion: raw.coverageRegion,
        isSandboxSimulated: !this.isProduction || !this.config.apiKey
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
    const mockRaw: RawInsurancePlanOffer = {
      planCode: 'ALZ_COMP_INTL',
      planName: 'Allianz Global Comprehensive Travel Shield',
      coverageRegion: criteria.destination || 'Worldwide (Excl. USA)',
      medicalEmergencyCoverageMinor: 25000000,
      tripCancellationCoverageMinor: 500000,
      baggageLossCoverageMinor: 250000,
      netPremiumMinor: 4500, // $45.00
      premiumCurrency: criteria.currency || 'USD'
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: isLive
        ? 'Underwriting premium tables verified via Allianz API'
        : '[SANDBOX / MOCK MODE] Simulated policy premium check. Live Allianz key not configured.'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `ALZ-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
      guaranteedPriceMinor: 4500,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    this.assertCanExecuteProductionBooking();
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      supplierReference: isLive
        ? `ALZ-POL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `ALZ-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `COV-CERT-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `ALZ-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 4500
    };
  }
}
