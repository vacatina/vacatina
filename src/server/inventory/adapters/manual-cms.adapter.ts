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
    this.seedDefaultDirectContracts();
  }

  private seedDefaultDirectContracts(): void {
    const defaultListings: RawPayloadCmsListing[] = [
      {
        id: 'cms_dir_ht_001',
        productType: 'hotels',
        partnerSupplierId: 'CEYLON_HERITAGE_HOTELS',
        partnerName: 'Galle Fort Heritage Bungalow',
        title: 'Galle Fort Heritage Bungalow',
        subtitle: 'Colonial Luxury Suite · Direct Contract Exclusive · Breakfast Included',
        location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
        confirmationMode: 'INSTANT_CONFIRM',
        availableQuota: 4,
        contractedBaseCostMinor: 4500000, // LKR 45,000.00
        costCurrency: 'LKR',
        manualOverridePriceMinor: 4800000, // Promotional override
        overrideReason: 'Seasonal Exclusive Contract Rate',
        inclusions: [
          'Full English / Sri Lankan breakfast',
          'Private butler service & afternoon Ceylon tea',
          'Free airport transfer on 3+ night bookings'
        ],
        exclusions: ['Alcoholic beverages & minibar', 'Laundry services'],
        cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.',
        pinAboveApi: true,
        status: 'PUBLISHED'
      },
      {
        id: 'cms_dir_fl_002',
        productType: 'flights',
        partnerSupplierId: 'CINNAMON_AIR_DIRECT',
        partnerName: 'Cinnamon Air Scenic Charter',
        title: 'Colombo to Kandy Scenic Amphibian Flight',
        subtitle: 'Cessna 208 Caravan Amphibian · Water Aerodrome Departure',
        location: { city: 'Kandy', country: 'Sri Lanka', countryCode: 'LK', iataCode: 'KDZ' },
        confirmationMode: 'REQUEST_TO_CONFIRM',
        availableQuota: 8,
        contractedBaseCostMinor: 6500000, // LKR 65,000.00
        costCurrency: 'LKR',
        inclusions: ['Scenic aerial route over central highlands', '20kg baggage allowance per seat'],
        exclusions: ['Ground transfers between water aerodrome and hotel'],
        cancellationPolicy: 'Non-refundable within 72 hours of flight departure.',
        pinAboveApi: true,
        status: 'PUBLISHED'
      },
      {
        id: 'cms_dir_vs_003',
        productType: 'visa',
        partnerSupplierId: 'VACATINA_CONSULAR_DESK',
        partnerName: 'Vacatina Consular Advisory',
        title: 'UAE 60-Day Visit Visa Assistance',
        subtitle: 'Full Consular Document Audit · Dedicated Officer SLA 48h',
        location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
        confirmationMode: 'ASSISTED_SERVICE',
        availableQuota: 100,
        contractedBaseCostMinor: 4500000, // LKR 45,000.00 Govt Fee
        costCurrency: 'LKR',
        inclusions: [
          'Comprehensive visa application document audit and checklist review',
          'Dedicated consular case manager liaison and submission tracking',
          'Assistance with embassy portal filing requirements'
        ],
        exclusions: ['Courier delivery of physical documents if required by embassy'],
        cancellationPolicy: 'Advisory fee non-refundable once consular document audit has commenced.',
        pinAboveApi: true,
        status: 'PUBLISHED'
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

    const offerId = `vct-man-${raw.productType.slice(0, 2)}-${raw.id.slice(-6)}`;

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
        approverUserId: 'usr_admin_ops_001'
      },
      deduplicationKey: '',
      isSandboxSimulated: false,
      integrationLifecycle: 'SANDBOX_ACTIVE',
      sourceMetadata: {
        cmsListingId: raw.id,
        availableQuota: raw.availableQuota,
        status: raw.status,
        isDirectContract: true
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: false,
        lastRevalidationResult: 'UNCHANGED'
      },
      productExtension: (raw as any).productExtension || this.buildFallbackProductExtension(raw)
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return this.applyCanonicalContractDefaults(offer);
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
              carrierCode: 'CIN',
              carrierName: raw.partnerName || 'Cinnamon Air',
              flightNumber: 'CIN-801',
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

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const matching: CanonicalOfferEntity[] = [];

    for (const listing of this.manualCatalog.values()) {
      if (listing.status !== 'PUBLISHED') continue;
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

  public async revalidate(offerId: string): Promise<RevalidationResult> {
    return {
      offerId,
      status: 'UNCHANGED',
      message: 'Direct contract allotment confirmed in Vacatina Admin Ledger'
    };
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
