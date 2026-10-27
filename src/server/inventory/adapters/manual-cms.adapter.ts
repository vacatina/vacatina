/* ============================================================================
 * Vacatina Payload CMS & Direct Contract Manual Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q9/Q11/Q12)
 *
 * Powers Vacatina's manual inventory: boutique hotels, private charters,
 * local chauffeur fleet, licensed tours, and exclusive direct contracts.
 * ============================================================================ */

import { BaseSupplierAdapter } from './base.adapter.ts';
import type {
  BookingCancelResult,
  BookingConfirmResult,
  BookingHoldResult
} from './base.adapter.ts';
import type {
  BookingCapability,
  CanonicalOfferEntity,
  CompositionType,
  ConfirmationMode,
  DistributionScope,
  FulfillmentMode,
  InventorySource,
  InventorySourceType,
  ListingKind,
  PublicationStatus,
  RevalidationResult,
  SearchQueryCriteria,
  Sellability,
  StructuredLocation,
  TravelProductSlug
} from '../types.ts';
import { assertManualOfferPublishedForBooking } from '../types.ts';
import { PricingPrecedenceService } from '../pricing-precedence.service.ts';
import { DeduplicationService } from '../deduplication.service.ts';
import { isSeedFixtureLoadingAllowed } from '../commercial-truth.ts';

export interface RawPayloadCmsListing {
  id: string; // "cms_dir_001"
  productType: TravelProductSlug;
  partnerSupplierId: string;
  partnerName: string;
  title: string;
  subtitle: string;
  location: StructuredLocation;
  confirmationMode: ConfirmationMode;
  availableQuota: number;
  contractedBaseCostMinor: number;
  costCurrency: string;
  manualOverridePriceMinor?: number;
  overrideReason?: string;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  pinAboveApi: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED';
  isStopSaleActive?: boolean;
  /**
   * Provenance of the record.
   * SEED_FIXTURE  = development / demo data. Never sellable, never loaded in production.
   * ADMIN_ENTERED = created through the Admin CMS lifecycle.
   */
  dataOrigin?: 'SEED_FIXTURE' | 'ADMIN_ENTERED';
  /** ISO timestamp after which the listing must not be sold or revalidated as unchanged. */
  validUntil?: string;
  /** Real approver recorded by the CMS lifecycle. Never fabricated. */
  approvedBy?: string;
}

export class ManualCmsAdapter extends BaseSupplierAdapter<RawPayloadCmsListing> {
  private manualCatalog: Map<string, RawPayloadCmsListing>;

  constructor() {
    super({
      supplierId: 'PAYLOAD_CMS_DIRECT',
      supplierName: 'Vacatina Direct Contract Desk',
      productType: 'hotels', // Default; serves multi-product
      environment: 'production',
      sandboxBaseUrl: 'http://localhost:3000/api',
      productionBaseUrl: 'https://vacatina-nu.vercel.app/api',
      timeoutMs: 2000
    });

    this.manualCatalog = new Map();
    // SEED fixtures are development scaffolding only: never loaded in a production runtime.
    if (isSeedFixtureLoadingAllowed()) {
      this.seedDefaultDirectContracts();
    }
  }

  public registerListing(listing: RawPayloadCmsListing): void {
    this.manualCatalog.set(listing.id, listing);
  }

  public syncFromManualRecord(record: any): void {
    const raw: RawPayloadCmsListing = {
      id: record.id,
      productType: record.productType,
      partnerSupplierId: record.partnerSupplierId,
      partnerName: record.partnerName,
      title: record.title,
      subtitle: record.subtitle,
      location: record.location,
      confirmationMode: record.confirmationMode,
      availableQuota: record.availableQuota,
      contractedBaseCostMinor: Math.round((record.contractedBaseCost || 0) * 100),
      costCurrency: record.costCurrency || 'LKR',
      manualOverridePriceMinor: record.standardSellingPriceLkr ? Math.round(record.standardSellingPriceLkr * 100) : undefined,
      overrideReason: record.exclusiveOffer ? 'Exclusive Contract Rate' : undefined,
      inclusions: record.inclusions || [],
      exclusions: record.exclusions || [],
      cancellationPolicy: record.cancellationPolicy || 'Standard cancellation policy applies.',
      pinAboveApi: Boolean(record.pinPriority && record.pinPriority > 0),
      status: (record.status === 'PUBLISHED' || record.status === 'ACTIVE') ? 'PUBLISHED' : (record.status === 'PAUSED' ? 'PAUSED' : 'DRAFT'),
      isStopSaleActive: Boolean(record.isStopSaleActive),
      dataOrigin: record.inventoryClass === 'SAMPLE_INVENTORY' ? 'SEED_FIXTURE' : 'ADMIN_ENTERED',
      validUntil: record.salesValidUntilIso || record.validUntilIso || undefined,
      approvedBy: record.publishApprovedBy || record.approvedBy || undefined
    };
    this.manualCatalog.set(raw.id, raw);
  }

  /**
   * SEED FIXTURES — development / demo scaffolding ONLY.
   * These are NOT real contracts, suppliers or allotments. They carry dataOrigin = 'SEED_FIXTURE',
   * resolve to commercial truth SEED_ONLY, are blocked from checkout, and are never loaded when
   * the runtime is production (see isSeedFixtureLoadingAllowed).
   */
  private seedDefaultDirectContracts(): void {
    const defaultListings: RawPayloadCmsListing[] = [
      {
        id: 'cms_dir_ht_001',
        productType: 'hotels',
        partnerSupplierId: 'SEED_SAMPLE_HOTEL_PARTNER',
        partnerName: 'Sample Hotel Partner (seed fixture)',
        title: 'Galle Fort Heritage Bungalow',
        subtitle: 'Sample listing for UI testing · Breakfast Included',
        location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
        confirmationMode: 'INSTANT_CONFIRM',
        availableQuota: 4,
        contractedBaseCostMinor: 4500000, // LKR 45,000.00 (sample figure)
        costCurrency: 'LKR',
        manualOverridePriceMinor: 4800000, // sample promotional override
        overrideReason: 'Sample override for UI testing',
        inclusions: [
          'Full English / Sri Lankan breakfast',
          'Private butler service & afternoon Ceylon tea',
          'Free airport transfer on 3+ night bookings'
        ],
        exclusions: ['Alcoholic beverages & minibar', 'Laundry services'],
        cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.',
        pinAboveApi: true,
        status: 'PUBLISHED',
        dataOrigin: 'SEED_FIXTURE'
      },
      {
        id: 'cms_dir_fl_002',
        productType: 'flights',
        partnerSupplierId: 'SEED_SAMPLE_CHARTER_OPERATOR',
        partnerName: 'Sample Scenic Charter Operator (seed fixture)',
        title: 'Colombo to Kandy Scenic Amphibian Flight',
        subtitle: 'Sample listing for UI testing · Water Aerodrome Departure',
        location: { city: 'Kandy', country: 'Sri Lanka', countryCode: 'LK', iataCode: 'KDZ' },
        confirmationMode: 'REQUEST_TO_CONFIRM',
        availableQuota: 8,
        contractedBaseCostMinor: 6500000, // LKR 65,000.00 (sample figure)
        costCurrency: 'LKR',
        inclusions: ['Scenic aerial route over central highlands', '20kg baggage allowance per seat'],
        exclusions: ['Ground transfers between water aerodrome and hotel'],
        cancellationPolicy: 'Non-refundable within 72 hours of flight departure.',
        pinAboveApi: true,
        status: 'PUBLISHED',
        dataOrigin: 'SEED_FIXTURE'
      },
      {
        id: 'cms_dir_vs_003',
        productType: 'visa',
        partnerSupplierId: 'VACATINA_CONSULAR_DESK',
        partnerName: 'Vacatina Consular Advisory (seed fixture)',
        title: 'UAE 60-Day Visit Visa Assistance',
        subtitle: 'Sample listing for UI testing · Document audit and filing assistance',
        location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
        confirmationMode: 'ASSISTED_SERVICE',
        availableQuota: 100,
        contractedBaseCostMinor: 4500000, // LKR 45,000.00 (sample figure)
        costCurrency: 'LKR',
        inclusions: [
          'Comprehensive visa application document audit and checklist review',
          'Dedicated consular case manager liaison and submission tracking',
          'Assistance with embassy portal filing requirements'
        ],
        exclusions: ['Courier delivery of physical documents if required by embassy'],
        cancellationPolicy: 'Advisory fee non-refundable once consular document audit has commenced.',
        pinAboveApi: true,
        status: 'PUBLISHED',
        dataOrigin: 'SEED_FIXTURE'
      }
    ];

    for (const listing of defaultListings) {
      this.manualCatalog.set(listing.id, listing);
    }
  }

  public normalize(raw: RawPayloadCmsListing): CanonicalOfferEntity {
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: raw.productType,
      rawSupplierCostMinor: raw.contractedBaseCostMinor,
      rawCurrency: raw.costCurrency,
      manualOverrideMinor: raw.manualOverridePriceMinor,
      overrideReason: raw.overrideReason
    });

    const offerId = this.computeOfferId(raw);

    // Resolve canonical source type according to product nature
    let canonicalSourceType: InventorySourceType = 'DIRECT_CONTRACT';
    let inventorySource: InventorySource = 'DIRECT_CONTRACT';
    let listingKind: ListingKind = 'SELLABLE_INVENTORY';
    let compositionType: CompositionType = 'SINGLE';

    // Item 2: Do not assume DIRECT_CONTRACT is INSTANT!
    // INSTANT is permitted ONLY when Vacatina has confirmed atomic allotment and instant reservation capability
    const hasAllotmentQuota = raw.availableQuota > 0;
    const canAtomicReserve = (raw as any).canAtomicallyReserve === true || (raw.confirmationMode === 'INSTANT_CONFIRM' && hasAllotmentQuota);

    let fulfillmentMode: FulfillmentMode = 'ON_REQUEST';
    let bookingCapability: BookingCapability = 'REQUEST_TO_BOOK';

    if (raw.productType === 'visa') {
      canonicalSourceType = 'MANUAL_SERVICE';
      inventorySource = 'MANUAL_INTERNAL';
      listingKind = 'SERVICE';
      fulfillmentMode = 'MANUAL_CONFIRMATION';
      bookingCapability = 'REQUEST_TO_BOOK';
    } else if (raw.productType === 'packages') {
      canonicalSourceType = 'CURATED_PACKAGE';
      inventorySource = 'DIRECT_CONTRACT';
      listingKind = 'PACKAGE';
      compositionType = 'CURATED_PACKAGE';
      fulfillmentMode = canAtomicReserve ? 'INSTANT' : 'ON_REQUEST';
      bookingCapability = canAtomicReserve ? 'INSTANT_RESERVATION' : 'REQUEST_TO_BOOK';
    } else if (canAtomicReserve) {
      fulfillmentMode = 'INSTANT';
      bookingCapability = 'INSTANT_RESERVATION';
    } else {
      fulfillmentMode = 'ON_REQUEST';
      bookingCapability = 'REQUEST_TO_BOOK';
    }

    const isPublished = raw.status === 'PUBLISHED';
    const sellability: Sellability = isPublished ? 'BOOKABLE' : 'DISCOVERY_ONLY';

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      offerId,
      productType: raw.productType,
      providerId: raw.partnerSupplierId,
      providerOfferId: raw.id,
      sourceOfferId: raw.id,
      inventorySource,
      listingKind,
      compositionType,
      fulfillmentMode,
      environmentClass: 'PRODUCTION',
      sellability,
      publicationStatus: isPublished ? 'PUBLISHED' : (raw.status as any || 'DRAFT'),
      distributionScope: (raw as any).distributionScope || 'BOTH',
      bookingCapability,
      providerLifecycle: 'PRODUCTION_LIVE',
      sourceType: canonicalSourceType,
      supplierId: raw.partnerSupplierId,
      supplierName: raw.partnerName,
      manualListingId: raw.id,
      title: raw.title,
      subtitle: raw.subtitle,
      location: raw.location,
      availabilityStatus: raw.availableQuota > 0 ? 'MANUAL_AVAILABLE' : 'SOLD_OUT',
      confirmationMode: raw.confirmationMode,
      bookingMode: raw.confirmationMode === 'INSTANT_CONFIRM' ? 'INSTANT_BOOK' : 'REQUEST_TO_BOOK',
      pricing,
      taxesAndFees: {
        totalTaxMinor: 0,
        isTaxInclusive: true,
        serviceChargeMinor: 0
      },
      b2bPricing: {
        distributionScope: (raw as any).distributionScope || 'BOTH',
        b2bNetPriceMinor: raw.contractedBaseCostMinor,
        agencyMarkupPercent: 8.0,
        agencyCommissionPercent: 5.0,
        clientFacingPriceMinor: pricing.finalSellingPriceMinor
      },
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 86400, // Manual listings valid until updated
        expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      validFrom: (raw as any).validFrom || new Date().toISOString(),
      validUntil: (raw as any).validUntil || new Date(Date.now() + 86400000 * 180).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lastCheckedAt: new Date().toISOString(),
      requiresRevalidation: false,
      inclusions: raw.inclusions,
      exclusions: raw.exclusions,
      cancellationPolicy: raw.cancellationPolicy,
      pinAboveApi: raw.pinAboveApi,
      isExclusiveDeal: Boolean(raw.pinAboveApi || raw.manualOverridePriceMinor),
      pinAudit: {
        isPinned: Boolean(raw.pinAboveApi),
        pinReason: raw.overrideReason || (raw.pinAboveApi ? 'Direct contractual rate priority' : undefined),
        pinValidFrom: new Date().toISOString(),
        pinValidUntil: new Date(Date.now() + 86400000 * 90).toISOString(),
        approverUserId: raw.approvedBy ?? 'UNRECORDED'
      },
      deduplicationKey: '',
      isSandboxSimulated: false,
      integrationLifecycle: 'SANDBOX_ACTIVE',
      sourceMetadata: {
        cmsListingId: raw.id,
        availableQuota: raw.availableQuota,
        status: raw.status,
        dataOrigin: raw.dataOrigin ?? 'ADMIN_ENTERED',
        isDirectContract: raw.dataOrigin !== 'SEED_FIXTURE'
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: false,
        lastRevalidationResult: 'UNCHANGED'
      },
      productExtension: (raw as any).productExtension || this.buildFallbackProductExtension(raw)
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);

    // SEED fixtures are demonstration data: they must be classified so the checkout guards reject them.
    if (raw.dataOrigin === 'SEED_FIXTURE') {
      offer.commercialStatus = 'SAMPLE_DEMO';
      offer.sellable = false;
      offer.isSandboxSimulated = true;
    }
    return this.applyCanonicalContractDefaults(offer);
  }

  private computeOfferId(raw: RawPayloadCmsListing): string {
    return `vct-man-${raw.productType.slice(0, 2)}-${raw.id.slice(-6)}`;
  }

  private buildFallbackProductExtension(raw: RawPayloadCmsListing): any {
    switch (raw.productType) {
      case 'hotels':
        return {
          productType: 'hotels',
          hotel: {
            starRating: 5,
            roomType: raw.subtitle || 'Direct Contract Deluxe Suite',
            bedConfiguration: '1 King Bed',
            boardBasis: 'BB',
            maxOccupancy: { maxAdults: 2, maxChildren: 1, maxGuests: 3 },
            ratePlanCode: `RATE_MAN_${raw.id}`,
            checkInTime: '14:00',
            checkOutTime: '12:00',
            amenities: ['Wi-Fi', 'Pool', 'Breakfast Included']
          }
        };
      case 'flights':
        return {
          productType: 'flights',
          flight: {
            fareFamily: 'Direct Chartered Contract',
            cabinClass: 'ECONOMY',
            ticketingDeadlineIso: new Date(Date.now() + 86400000 * 7).toISOString(),
            isRefundable: false,
            isChangeable: true,
            baggageAllowance: { cabinBaggageKg: 7, checkedBaggageKg: 20, pieceCount: 1 },
            segments: [{
              segmentId: `seg_${raw.id}_0`,
              carrierCode: 'SMP',
              carrierName: raw.partnerName || 'Sample Charter Operator',
              flightNumber: 'SMP-801',
              originIata: 'CMB',
              destinationIata: 'KDW',
              departureTimeIso: new Date().toISOString(),
              arrivalTimeIso: new Date(Date.now() + 3600000).toISOString(),
              durationMinutes: 60
            }]
          }
        };
      case 'visa':
        return {
          productType: 'visa',
          visa: {
            destinationCountry: raw.location?.country || 'United Arab Emirates',
            visaType: 'TOURIST_EVISA',
            eligibleNationality: 'Sri Lankan (LKA)',
            residenceCountry: 'Sri Lanka',
            processingSlaBusinessDays: 2,
            embassyFeeMinor: Math.round(raw.contractedBaseCostMinor * 0.7),
            vacatinaServiceFeeMinor: Math.round(raw.contractedBaseCostMinor * 0.3),
            documentChecklist: ['Passport bio page copy', 'Passport digital photo'],
            submissionMethod: 'ONLINE_PORTAL'
          }
        };
      default:
        return undefined;
    }
  }

  /** Customer-sellable only if published, not stop-sold, in stock and inside its validity window. */
  private getSellabilityBlocker(listing: RawPayloadCmsListing): 'UNAVAILABLE' | 'EXPIRED' | null {
    if (listing.status !== 'PUBLISHED') return 'UNAVAILABLE';
    if (listing.isStopSaleActive) return 'UNAVAILABLE';
    if (listing.availableQuota <= 0) return 'UNAVAILABLE';
    if (listing.validUntil && Date.parse(listing.validUntil) < Date.now()) return 'EXPIRED';
    return null;
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const matching: CanonicalOfferEntity[] = [];

    for (const listing of this.manualCatalog.values()) {
      if (this.getSellabilityBlocker(listing)) continue;
      if (criteria.productType && listing.productType !== criteria.productType) continue;

      if (criteria.destination) {
        const destNorm = criteria.destination.toLowerCase();
        const cityMatch = listing.location.city.toLowerCase().includes(destNorm);
        const countryMatch = listing.location.country.toLowerCase().includes(destNorm);
        if (!cityMatch && !countryMatch) continue;
      }

      matching.push(this.normalize(listing));
    }

    return matching;
  }

  /**
   * Revalidates against the Vacatina manual ledger itself (the authoritative source for MANUAL offers).
   * Never answers UNCHANGED for a listing that is missing, stop-sold, sold out or expired.
   */
  public async revalidate(offerId: string): Promise<RevalidationResult> {
    const listing = Array.from(this.manualCatalog.values()).find(l => this.computeOfferId(l) === offerId || l.id === offerId);
    if (!listing) {
      return { offerId, status: 'UNAVAILABLE', message: 'Manual listing not found in the Vacatina ledger' };
    }

    const blocker = this.getSellabilityBlocker(listing);
    if (blocker === 'EXPIRED') {
      return { offerId, status: 'EXPIRED', message: 'Manual listing validity window has passed' };
    }
    if (blocker === 'UNAVAILABLE') {
      return {
        offerId,
        status: 'UNAVAILABLE',
        message: listing.isStopSaleActive
          ? 'Listing is under stop-sell'
          : listing.availableQuota <= 0
            ? 'Listing is sold out'
            : 'Listing is not published'
      };
    }

    return { offerId, status: 'UNCHANGED', message: 'Manual listing is published, in stock and within its validity window' };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `MAN-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 86400000).toISOString(),
      guaranteedPriceMinor: 4800000,
      currency: 'LKR'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `DIR-ALC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: `VCT-DIR-${Math.floor(100000 + Math.random() * 900000)}`,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'CONFIRMED'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `DIR-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 4800000
    };
  }

  public upsertListing(listing: RawPayloadCmsListing): void {
    this.manualCatalog.set(listing.id, listing);
  }
}
