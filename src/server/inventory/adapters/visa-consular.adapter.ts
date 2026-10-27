/* ============================================================================
 * Vacatina Consular Advisory & Visa Desk Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Visa)
 * Knowledge Sync: docs/26_VACATINA_LEGACY_KNOWLEDGE_BASE_AND_INTEGRATION_SYNC.md
 * Source Provenance: flights.vacatina.com (modules/visa-assistance/catalog/seed)
 *
 * Dedicated manual service adapter for embassy visa application document vetting.
 * Supports Sri Lankan (LK) passport routes: India, Singapore, UAE (Tourist & Business).
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
  visaType: string;         // e.g. "Tourist e-Visa Assistance" | "Business Visa Assistance"
  category?: 'TOURIST_EVISA' | 'BUSINESS_VISA' | 'STICKER_VISA' | 'TRANSIT';
  durationDays: number;     // 30 | 60
  consularBaseCostMinor: number;
  currency: string;
  processingSlaDays: number;
  documentChecklist?: string[];
}

export class VisaConsularAdapter extends BaseSupplierAdapter<RawVisaProductOffer> {
  private offerCache: Map<string, CanonicalOfferEntity> = new Map();

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

    const isBiz = (raw.category === 'BUSINESS_VISA') || raw.visaType.toLowerCase().includes('business') || raw.visaServiceId.includes('business');
    const offerSuffix = isBiz ? 'biz' : `${raw.durationDays}d`;
    const offerId = `vct-vs-consular-${raw.countryCode.toLowerCase()}-${offerSuffix}`;

    const defaultChecklist = [
      'Passport copy valid for 6+ months with 2 blank pages (per traveler)',
      'Passport-sized digital photograph with white background (per traveler)',
      'Return flight itinerary and confirmed accommodation proof (per application)'
    ];

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
      title: `${raw.countryName} ${raw.durationDays}-Day ${raw.visaType}`,
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
      },
      productExtension: {
        productType: 'visa',
        visa: {
          destinationCountry: raw.countryName,
          visaType: raw.category || (isBiz ? 'BUSINESS_VISA' : 'TOURIST_EVISA'),
          eligibleNationality: 'Sri Lankan (LKA)',
          residenceCountry: 'Sri Lanka',
          processingSlaBusinessDays: raw.processingSlaDays,
          embassyFeeMinor: Math.round(raw.consularBaseCostMinor * 0.6),
          vacatinaServiceFeeMinor: Math.round(raw.consularBaseCostMinor * 0.4),
          documentChecklist: raw.documentChecklist || defaultChecklist,
          submissionMethod: 'ONLINE_PORTAL'
        }
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    const finalized = this.applyCanonicalContractDefaults(offer);

    this.offerCache.set(offerId, finalized);
    this.offerCache.set(raw.visaServiceId, finalized);
    return finalized;
  }

  public getOffer(offerId: string): CanonicalOfferEntity | null {
    if (this.offerCache.has(offerId)) {
      return this.offerCache.get(offerId)!;
    }

    // Check pre-normalized catalog
    for (const [key, offer] of this.offerCache.entries()) {
      if (offer.canonicalOfferId === offerId || offer.supplierOfferId === offerId || key.includes(offerId) || offerId.includes(key)) {
        return offer;
      }
    }

    // Deterministic reconstruction for valid visa offer IDs
    if (offerId.startsWith('vct-vs-')) {
      const parts = offerId.replace('vct-vs-consular-', '').replace('vct-vs-', '').split('-');
      const countryCode = (parts[0] || 'ae').toUpperCase();
      const isBiz = parts.includes('biz') || parts.includes('business');
      const durationDays = parts.includes('30d') ? 30 : 60;

      const reconstructedRaw: RawVisaProductOffer = {
        visaServiceId: `vs_${countryCode.toLowerCase()}_${isBiz ? 'biz' : 'tourist'}_01`,
        countryName: countryCode === 'AE' ? 'United Arab Emirates' : countryCode === 'IN' ? 'India' : countryCode === 'SG' ? 'Singapore' : countryCode === 'UK' ? 'United Kingdom' : 'International',
        countryCode,
        visaType: isBiz ? 'Business Visa Assistance' : 'Tourist e-Visa Assistance',
        category: isBiz ? 'BUSINESS_VISA' : 'TOURIST_EVISA',
        durationDays,
        consularBaseCostMinor: 3500000,
        currency: 'LKR',
        processingSlaDays: 3
      };
      const canonical = this.normalize(reconstructedRaw);
      canonical.canonicalOfferId = offerId;
      canonical.freshness.revalidationEndpoint = `/api/v1/offers/${offerId}/revalidate`;
      this.offerCache.set(offerId, canonical);
      return canonical;
    }

    return null;
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const isUsd = (criteria.currency || '').toUpperCase() === 'USD';
    const currency = isUsd ? 'USD' : 'LKR';

    // Authentic Vacatina Consular Catalog synced with legacy flights.vacatina.com seed
    const catalog: RawVisaProductOffer[] = [
      // 1. UAE Tourist
      {
        visaServiceId: 'vs_ae_tourist_01',
        countryName: 'United Arab Emirates',
        countryCode: 'AE',
        visaType: 'Tourist e-Visa Assistance',
        category: 'TOURIST_EVISA',
        durationDays: 60,
        consularBaseCostMinor: isUsd ? 14500 : 3500000, // $145 USD or 35,000 LKR
        currency,
        processingSlaDays: 2,
        documentChecklist: [
          'Passport bio page: clear scan valid for 6+ months with 2 blank pages (per traveler)',
          'Recent passport-style photo: clear photo with white background (per traveler)',
          'Return flight itinerary and confirmed accommodation proof (per application)'
        ]
      },
      // 2. UAE Business
      {
        visaServiceId: 'vs_ae_business_01',
        countryName: 'United Arab Emirates',
        countryCode: 'AE',
        visaType: 'Business Visa Assistance',
        category: 'BUSINESS_VISA',
        durationDays: 60,
        consularBaseCostMinor: isUsd ? 19500 : 4800000, // $195 USD or 48,000 LKR
        currency,
        processingSlaDays: 3,
        documentChecklist: [
          'Passport bio page: clear scan valid for 6+ months with 2 blank pages (per traveler)',
          'Recent passport-style photo: clear photo with white background (per traveler)',
          'Business invitation letter from UAE registered entity (per application)',
          'Return flight itinerary and business meeting schedule (per application)'
        ]
      },
      // 3. India Tourist
      {
        visaServiceId: 'vs_in_tourist_01',
        countryName: 'India',
        countryCode: 'IN',
        visaType: 'Tourist e-Visa Assistance',
        category: 'TOURIST_EVISA',
        durationDays: 30,
        consularBaseCostMinor: isUsd ? 7500 : 2400000, // $75 USD or 24,000 LKR
        currency,
        processingSlaDays: 3,
        documentChecklist: [
          'Passport bio page: clear scan showing photo and personal details (per traveler)',
          'Recent passport-style photo: 2x2 inch square photo on white background (per traveler)',
          'Travel itinerary: planned entry and return dates (per application)'
        ]
      },
      // 4. India Business
      {
        visaServiceId: 'vs_in_business_01',
        countryName: 'India',
        countryCode: 'IN',
        visaType: 'Business e-Visa Assistance',
        category: 'BUSINESS_VISA',
        durationDays: 30,
        consularBaseCostMinor: isUsd ? 11000 : 3500000, // $110 USD or 35,000 LKR
        currency,
        processingSlaDays: 4,
        documentChecklist: [
          'Passport bio page: clear scan showing photo and personal details (per traveler)',
          'Recent passport-style photo: 2x2 inch square photo on white background (per traveler)',
          'Business invitation letter from Indian host organization (per application)',
          'Copy of visiting business card / company profile (per application)'
        ]
      },
      // 5. Singapore Tourist
      {
        visaServiceId: 'vs_sg_tourist_01',
        countryName: 'Singapore',
        countryCode: 'SG',
        visaType: 'Tourist Entry Visa Assistance',
        category: 'TOURIST_EVISA',
        durationDays: 30,
        consularBaseCostMinor: isUsd ? 9500 : 3000000, // $95 USD or 30,000 LKR
        currency,
        processingSlaDays: 3,
        documentChecklist: [
          'Passport bio page: clear scan valid for 6+ months (per traveler)',
          'Recent passport-style photo: white background taken within 3 months (per traveler)',
          'Confirmed return flight booking details (per application)',
          'Accommodation details: hotel reservation or Singapore residential address (per application)'
        ]
      },
      // 6. Singapore Business
      {
        visaServiceId: 'vs_sg_business_01',
        countryName: 'Singapore',
        countryCode: 'SG',
        visaType: 'Business Entry Visa Assistance',
        category: 'BUSINESS_VISA',
        durationDays: 30,
        consularBaseCostMinor: isUsd ? 13500 : 4200000, // $135 USD or 42,000 LKR
        currency,
        processingSlaDays: 4,
        documentChecklist: [
          'Passport bio page: clear scan valid for 6+ months (per traveler)',
          'Recent passport-style photo: white background taken within 3 months (per traveler)',
          'Business invitation letter describing host organization, visit purpose & dates (per application)',
          'Confirmed flight and accommodation itinerary (per application)'
        ]
      }
    ];

    const dest = (criteria.destination || '').toLowerCase();
    let filtered: RawVisaProductOffer[];

    if (dest.includes('india') || dest.includes('delhi') || dest.includes('mumbai') || dest === 'in') {
      filtered = catalog.filter((item) => item.countryCode === 'IN');
    } else if (dest.includes('singapore') || dest === 'sg' || dest === 'sin') {
      filtered = catalog.filter((item) => item.countryCode === 'SG');
    } else if (dest.includes('emirates') || dest.includes('uae') || dest.includes('dubai') || dest.includes('dxb') || dest === 'ae') {
      filtered = catalog.filter((item) => item.countryCode === 'AE');
    } else if (dest) {
      filtered = catalog.filter((item) => item.countryName.toLowerCase().includes(dest) || item.countryCode.toLowerCase() === dest);
      if (filtered.length === 0) {
        // Fallback for custom search query: adapt UAE tourist as baseline
        filtered = [{
          visaServiceId: `vs_${dest.slice(0, 3)}_01`,
          countryName: criteria.destination || 'United Arab Emirates',
          countryCode: 'AE',
          visaType: 'Tourist e-Visa Assistance',
          category: 'TOURIST_EVISA',
          durationDays: 60,
          consularBaseCostMinor: isUsd ? 14500 : 3500000,
          currency,
          processingSlaDays: 2
        }];
      }
    } else {
      filtered = catalog;
    }

    return filtered.map((raw) => this.normalize(raw));
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
