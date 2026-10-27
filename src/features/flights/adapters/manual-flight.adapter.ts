/* ============================================================================
 * Vacatina Manual Inventory Flight Adapter
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§4, §5, §18)
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightAirline,
  FlightLocation,
  FlightOfferStatus,
  FlightOptionalService,
  FlightPriceBreakdown,
  FlightSegment,
  FlightSlice,
  StructuredBaggage
} from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightRevalidationResult,
  FlightSearchRequest
} from '../domain/search-models.ts';
import type {
  FlightAdapterCapabilities,
  FlightAdapterSearchResult,
  IFlightAdapter
} from './flight-adapter.interface.ts';
import {
  MANUAL_FLIGHT_OFFERS,
  getActiveManualOffers
} from '../data/manual-offers.ts';
import { findAirportByCode, getAirport } from '../data/airports.ts';
import type {
  IManualListingRepository,
  ProductionManualListingEntity
} from '../../../server/inventory/repository/manual-listing.repository.ts';

function resolveDestinationLocation(listing: ProductionManualListingEntity): FlightLocation {
  const destinationCode = listing.destination.trim().toUpperCase();
  const knownAirport = findAirportByCode(destinationCode);
  if (knownAirport) return knownAirport;

  const fallbackCode =
    destinationCode.length === 3
      ? destinationCode
      : listing.location.city.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();

  return {
    airportCode: fallbackCode,
    cityCode: fallbackCode,
    airportName: `${listing.location.city} Airport`,
    city: listing.location.city,
    country: listing.location.country,
    countryCode: 'LK'
  };
}

function mapListingToCanonicalFlightOffer(listing: ProductionManualListingEntity): CanonicalFlightOffer {
  const nowIso = new Date().toISOString();
  const isExpired = Date.parse(listing.expiresAtIso) < Date.now();
  const isSellable =
    !isExpired &&
    listing.workflowStatus === 'PUBLISHED' &&
    !listing.isStopSaleActive &&
    listing.availableQuota > 0;

  const status: FlightOfferStatus = isExpired
    ? 'expired'
    : listing.workflowStatus === 'PUBLISHED'
      ? (isSellable ? 'active' : 'paused')
      : listing.workflowStatus === 'PAUSED'
        ? 'paused'
        : listing.workflowStatus === 'ARCHIVED'
          ? 'expired'
          : 'draft';

  // The manual listing contract has no carrier, flight-number, timing or
  // baggage fields. Do not fabricate airline truth: mark them pending and keep
  // the offer request-to-book until the desk confirms the schedule.
  const carrier: FlightAirline = {
    code: 'MANUAL',
    name: listing.operatorName || listing.partnerName || 'Vacatina Manual Flight Desk'
  };
  const origin = listing.origin ? findAirportByCode(listing.origin) || getAirport('CMB') : getAirport('CMB');
  const destination = resolveDestinationLocation(listing);

  const baggage: StructuredBaggage = {
    cabin: { pieces: 0, description: 'Cabin allowance not supplied - confirm with the Vacatina flight desk' },
    checked: { pieces: 0, description: 'Checked allowance not supplied - confirm with the Vacatina flight desk' },
    isSupplied: false
  };

  const durationMinutes = 0;
  const segment: FlightSegment = {
    segmentId: `seg-${listing.listingId}-out`,
    marketingCarrier: carrier,
    operatingCarrier: carrier,
    flightNumber: 'PENDING',
    origin,
    destination,
    // Placeholder until the desk supplies a real schedule. Do not present the
    // listing validity window as flight departure/arrival times.
    departureAt: listing.validFromIso,
    arrivalAt: listing.validFromIso,
    durationMinutes,
    cabinClass: 'economy',
    baggage
  };
  const slice: FlightSlice = {
    sliceIndex: 0,
    sliceType: 'outbound',
    origin,
    destination,
    departureAt: listing.validFromIso,
    arrivalAt: listing.validFromIso,
    durationMinutes,
    stopCount: 0,
    segments: [segment]
  };

  const taxesMinor = 0;
  const feesMinor = Math.max(
    0,
    listing.sellingPriceMinor - listing.contractedBaseCostMinor - taxesMinor
  );
  const price: FlightPriceBreakdown = {
    totalMinor: listing.sellingPriceMinor,
    baseFareMinor: listing.contractedBaseCostMinor,
    taxesMinor,
    feesMinor,
    currency: listing.currency,
    displayCurrency: listing.currency,
    perAdultMinor: listing.sellingPriceMinor
  };

  return {
    offerId: listing.canonicalEntityId,
    sourceType: 'manual',
    inventoryMode: 'manual_request',
    sourceProvider: listing.operatorName || listing.partnerName,
    supplierId: listing.partnerSupplierId,
    sourceOfferId: listing.listingId,
    status,
    bookability: isSellable ? 'request_to_book' : 'informational',
    origin,
    destination,
    tripType: 'one_way',
    slices: [slice],
    segments: [segment],
    departureAt: listing.validFromIso,
    arrivalAt: listing.validFromIso,
    durationMinutes,
    stopCount: 0,
    stopAirports: [],
    airlines: [carrier],
    marketingCarrier: carrier,
    operatingCarrier: carrier,
    flightNumber: 'PENDING',
    cabinClass: 'economy',
    fareFamily: 'Vacatina Direct',
    fareFamiliesAvailable: [],
    baggage,
    changeRules: {
      allowed: true,
      feeMinor: 0,
      currency: listing.currency,
      description: listing.cancellationPolicy
    },
    refundRules: {
      refundable: listing.refundability === 'REFUNDABLE',
      description: listing.cancellationPolicy
    },
    seatAvailability: listing.availableQuota,
    price,
    baseFare: listing.contractedBaseCostMinor / 100,
    taxes: taxesMinor / 100,
    fees: feesMinor / 100,
    currency: listing.currency,
    displayCurrency: listing.currency,
    travellerPricing: [
      {
        type: 'adult',
        count: 1,
        perPersonMinor: listing.sellingPriceMinor,
        totalMinor: listing.sellingPriceMinor
      }
    ],
    availabilityStatus: isSellable ? 'ON_REQUEST' : status === 'expired' ? 'EXPIRED' : 'UNAVAILABLE',
    lastCheckedAt: nowIso,
    expiresAt: listing.expiresAtIso,
    includedServices: listing.inclusions,
    optionalServices: [],
    manualInventoryMetadata: {
      commercialState: isSellable ? 'request_to_book' : 'informational',
      scheduleStatus: 'PENDING_OPERATOR_CONFIRMATION',
      quotaRemaining: listing.availableQuota,
      contactDeskNote: [
        listing.stopSaleReason,
        'Schedule, carrier and baggage must be confirmed by the Vacatina flight desk before ticketing.'
      ].filter(Boolean).join(' '),
      manualEvidenceRef: listing.commercialEvidence.referenceId
    }
  };
}

/**
 * Static catalog fixtures predate the manual listing contract and contain
 * illustrative carrier/schedule/fare detail. Strip that fabricated truth at the
 * adapter boundary so customers only see request-to-book placeholders.
 */
function toHonestStaticManualOffer(offer: CanonicalFlightOffer): CanonicalFlightOffer {
  const carrier: FlightAirline = {
    code: 'MANUAL',
    name: offer.sourceProvider || 'Vacatina Manual Flight Desk'
  };
  const baggage: StructuredBaggage = {
    cabin: { pieces: 0, description: 'Cabin allowance not supplied - confirm with the Vacatina flight desk' },
    checked: { pieces: 0, description: 'Checked allowance not supplied - confirm with the Vacatina flight desk' },
    isSupplied: false
  };
  const honestSegment = (segment: FlightSegment): FlightSegment => ({
    ...segment,
    marketingCarrier: carrier,
    operatingCarrier: carrier,
    flightNumber: 'PENDING',
    durationMinutes: 0,
    baggage
  });
  const segments = offer.segments.map(honestSegment);
  const segmentsById = new Map(segments.map(segment => [segment.segmentId, segment]));
  const slices = offer.slices.map(slice => ({
    ...slice,
    durationMinutes: 0,
    stopCount: 0,
    segments: slice.segments.map(segment => segmentsById.get(segment.segmentId) || honestSegment(segment))
  }));

  return {
    ...offer,
    inventoryMode: 'manual_request',
    marketingCarrier: carrier,
    operatingCarrier: carrier,
    airlines: [carrier],
    flightNumber: 'PENDING',
    aircraft: undefined,
    durationMinutes: 0,
    stopCount: 0,
    stopAirports: [],
    segments,
    slices,
    baggage,
    fareBasis: undefined,
    bookingClass: undefined,
    fareFamily: 'Request to book',
    fareFamiliesAvailable: [],
    mealInformation: undefined,
    seatAvailability: undefined,
    availabilityStatus: 'ON_REQUEST',
    changeRules: {
      allowed: false,
      description: 'Change conditions pending confirmation by the Vacatina flight desk.'
    },
    refundRules: {
      refundable: false,
      description: 'Refund conditions pending confirmation by the Vacatina flight desk.'
    },
    includedServices: [],
    manualInventoryMetadata: {
      commercialState: offer.bookability === 'informational' ? 'informational' : 'request_to_book',
      scheduleStatus: 'PENDING_OPERATOR_CONFIRMATION',
      quotaRemaining: offer.seatAvailability,
      contactDeskNote:
        'Carrier, flight number, schedule, baggage and fare rules must be confirmed by the Vacatina flight desk before ticketing.'
    }
  };
}

export class ManualFlightAdapter implements IFlightAdapter {
  public readonly adapterId = 'adapter-vacatina-manual-flights';
  public readonly sourceType = 'manual' as const;
  public readonly providerName = 'Vacatina Manual Inventory Desk';
  public readonly capabilities: FlightAdapterCapabilities = {
    supportsRealtimeFareRules: false,
    supportsAncillaries: true,
    supportsSeatSelection: false,
    supportsInstantRevalidation: true,
    supportsMultiCity: false
  };

  private repo?: IManualListingRepository;

  constructor(repo?: IManualListingRepository) {
    this.repo = repo;
  }

  public async search(request: FlightSearchRequest): Promise<FlightAdapterSearchResult> {
    try {
      let dbOffers: CanonicalFlightOffer[] = [];
      if (this.repo) {
        try {
          const dbListings = await this.repo.search({
            productType: 'flights',
            onlySellable: true
          });
          dbOffers = dbListings.map(mapListingToCanonicalFlightOffer);
        } catch {
          dbOffers = [];
        }
      }

      const staticOffers = getActiveManualOffers();
      const seenIds = new Set([
        ...dbOffers.map(o => o.offerId),
        ...dbOffers.map(o => o.sourceOfferId)
      ]);
      const activeOffers = [
        ...dbOffers,
        ...staticOffers
          .filter(o => !seenIds.has(o.offerId) && !seenIds.has(o.sourceOfferId))
          .map(toHonestStaticManualOffer)
      ];

      const originCode = request.origin.airportCode.toUpperCase();
      const destCode = request.destination.airportCode.toUpperCase();

      const matched = activeOffers.filter(offer => {
        // Match origin and destination
        const originMatches =
          offer.origin.airportCode.toUpperCase() === originCode ||
          offer.origin.cityCode.toUpperCase() === request.origin.cityCode.toUpperCase();
        const destMatches =
          offer.destination.airportCode.toUpperCase() === destCode ||
          offer.destination.cityCode.toUpperCase() === request.destination.cityCode.toUpperCase();

        if (!originMatches || !destMatches) return false;

        // Trip type filter
        if (request.tripType === 'one_way' && offer.tripType !== 'one_way') return false;

        // Cabin class filter
        if (request.cabinClass && offer.cabinClass !== request.cabinClass) return false;

        return true;
      });

      return {
        adapterId: this.adapterId,
        sourceType: this.sourceType,
        providerName: this.providerName,
        offers: matched,
        status: 'ok'
      };
    } catch (err) {
      return {
        adapterId: this.adapterId,
        sourceType: this.sourceType,
        providerName: this.providerName,
        offers: [],
        status: 'error',
        errorMessage: (err as Error).message
      };
    }
  }

  public async getOfferById(offerId: string): Promise<CanonicalFlightOffer | null> {
    try {
      const fromRepo = this.repo ? ((await this.repo.findById(offerId)) || (await this.repo.findByCanonicalEntityId(offerId))) : null;
      if (fromRepo && fromRepo.workflowStatus === 'PUBLISHED' && !fromRepo.isStopSaleActive) {
        return mapListingToCanonicalFlightOffer(fromRepo);
      }
    } catch {
      // Fallback
    }

    const found = MANUAL_FLIGHT_OFFERS.find(o => o.offerId === offerId || o.sourceOfferId === offerId);
    return found ? toHonestStaticManualOffer(found) : null;
  }

  public async revalidateOffer(
    offerId: string,
    configuration?: FlightConfigurationSelection
  ): Promise<FlightRevalidationResult> {
    const offer = await this.getOfferById(offerId);
    const now = new Date().toISOString();

    if (!offer) {
      return {
        offerId,
        status: 'UNAVAILABLE',
        originalPriceMinor: 0,
        newPriceMinor: 0,
        priceDeltaMinor: 0,
        currency: 'LKR',
        message: 'Manual flight listing no longer exists in Vacatina catalog.',
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    if (offer.status !== 'active') {
      return {
        offerId,
        status: offer.status === 'expired' ? 'OFFER_EXPIRED' : 'UNAVAILABLE',
        originalPriceMinor: offer.price.totalMinor,
        newPriceMinor: offer.price.totalMinor,
        priceDeltaMinor: 0,
        currency: offer.price.currency,
        message: `This manual flight offer is currently ${offer.status}.`,
        updatedOffer: offer,
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // Check fare family selection delta if configured
    let totalMinor = offer.price.totalMinor;
    if (configuration?.selectedFareFamilyCode && offer.fareFamiliesAvailable) {
      const selectedFamily = offer.fareFamiliesAvailable.find(
        f => f.familyCode === configuration.selectedFareFamilyCode
      );
      if (selectedFamily) {
        totalMinor += selectedFamily.priceDeltaMinor;
      }
    }

    return {
      offerId,
      status: 'UNCHANGED',
      originalPriceMinor: offer.price.totalMinor,
      newPriceMinor: totalMinor,
      priceDeltaMinor: totalMinor - offer.price.totalMinor,
      currency: offer.price.currency,
      message: 'Manual flight listing is still request-to-book; the desk must confirm schedule, carrier and baggage before ticketing.',
      updatedOffer: {
        ...offer,
        price: {
          ...offer.price,
          totalMinor
        },
        lastCheckedAt: now
      },
      revalidatedAt: now,
      requiresUserAction: true
    };
  }

  public async getAncillaries(offerId: string): Promise<FlightOptionalService[]> {
    const offer = await this.getOfferById(offerId);
    return offer?.optionalServices || [];
  }
}
