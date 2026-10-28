/* ============================================================================
 * Vacatina Duffel TEST MODE Browser Adapter
 * Authority: Phase 16 plan; reuses the canonical flight domain/UI.
 *
 * This adapter never talks to Duffel. It calls Vacatina's same-origin sandbox
 * API, which owns the test-mode credential. Every offer it returns is marked
 * `sandbox_test` / non-production and can only create a sandbox test order.
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightFareFamilyOption,
  FlightLocation,
  FlightOptionalService,
  FlightSandboxProvenance,
  FlightSegment,
  FlightSlice
} from '../domain/flight-models.ts';
import type {
  FlightRevalidationResult,
  FlightSearchRequest
} from '../domain/search-models.ts';
import type {
  FlightAdapterCapabilities,
  FlightAdapterSearchResult,
  IFlightAdapter
} from './flight-adapter.interface.ts';
import { apiRequest } from '../../../lib/services/api-client.service.ts';
import { findAirportByCode } from '../data/airports.ts';

const PROVIDER_NAME = 'Duffel TEST MODE (sandbox, non-production)';

export interface SandboxStatus {
  provider: 'DUFFEL_NDC';
  enabled: boolean;
  environment: 'SANDBOX';
  liveModeAllowed: false;
  tokenKind: 'TEST' | 'NONE' | 'LIVE_BLOCKED';
  reason: string;
  orderEndpoint: string;
  seatMaps: boolean;
  orders: boolean;
}

export interface SandboxSeatService {
  id: string;
  passengerId: string;
  amountMinor: number;
  currency: string;
}

export interface SandboxSeatElement {
  type: string;
  designator?: string;
  name?: string;
  disclosures: string[];
  services: SandboxSeatService[];
}

export interface SandboxSeatMap {
  id: string;
  segmentId: string;
  sliceId: string;
  cabins: Array<{
    deck?: number;
    aisles?: number;
    rows: Array<{ sections: Array<{ elements: SandboxSeatElement[] }> }>;
  }>;
}

export interface SandboxOrderRequest {
  offerId: string;
  supplierOfferId?: string;
  passengers: Array<{
    offerPassengerId: string;
    title: string;
    givenName: string;
    familyName: string;
    bornOn: string;
    email: string;
    phoneNumber: string;
    gender: 'M' | 'F';
  }>;
  services: Array<{ id: string; quantity: number }>;
  acceptedPriceMinor: number;
}

export interface SandboxOrderConfirmation {
  sandbox: true;
  nonProduction: true;
  liveMode: false;
  orderId: string;
  bookingReference?: string;
  ownerName?: string;
  totalAmountMinor: number;
  currency: string;
  createdAt: string;
  passengerCount: number;
  services: Array<{ id: string; quantity: number }>;
  replayed: boolean;
  message: string;
}

export interface SandboxQuote {
  sandbox: true;
  nonProduction: true;
  liveMode: false;
  offerId: string;
  totalAmountMinor: number;
  currency: string;
  expiresAt?: string;
  services: Array<{ id: string; quantity: number }>;
  checkedAt: string;
  message: string;
}

function locationFrom(code: string, fallbackCity?: string): FlightLocation {
  const airport = findAirportByCode(code);
  return {
    airportCode: code,
    cityCode: airport?.cityCode || code,
    airportName: airport?.airportName || `${code} Airport`,
    city: airport?.city || fallbackCity || code,
    country: airport?.country || 'International',
    countryCode: airport?.countryCode || code.slice(0, 2),
    timezone: airport?.timezone,
    terminal: undefined
  };
}

function isoDurationMinutes(value?: string): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
  if (!match) return 0;
  return Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function mapSegment(raw: any, baggage: CanonicalFlightOffer['baggage'], index: number): FlightSegment {
  const origin = locationFrom(raw.originIata || 'CMB', raw.originCity);
  const destination = locationFrom(raw.destinationIata || 'DXB', raw.destinationCity);
  const carrier = { code: raw.carrierCode || 'ZZ', name: raw.carrierName || 'Duffel Airways' };
  return {
    segmentId: raw.segmentId || `sandbox-segment-${index}`,
    marketingCarrier: carrier,
    operatingCarrier: {
      code: raw.operatingCarrierCode || carrier.code,
      name: raw.operatingCarrierName || carrier.name
    },
    flightNumber: raw.flightNumber || `${carrier.code}-000`,
    aircraft: raw.aircraftModel,
    origin,
    destination,
    departureAt: raw.departureTimeIso,
    arrivalAt: raw.arrivalTimeIso,
    durationMinutes: Number(raw.durationMinutes) || isoDurationMinutes(raw.duration),
    cabinClass: String(raw.cabinClass || 'ECONOMY').toLowerCase() as FlightSegment['cabinClass'],
    bookingClass: raw.bookingClass,
    baggage
  };
}

function mapSlice(raw: any, index: number, baggage: CanonicalFlightOffer['baggage']): FlightSlice {
  const segments = Array.isArray(raw.segments)
    ? raw.segments.map((segment: any, segmentIndex: number) => mapSegment(segment, baggage, segmentIndex))
    : [];
  const origin = locationFrom(raw.originIata || segments[0]?.origin.airportCode || 'CMB', raw.originCity);
  const destination = locationFrom(
    raw.destinationIata || segments[segments.length - 1]?.destination.airportCode || 'DXB',
    raw.destinationCity
  );
  return {
    sliceIndex: Number(raw.sliceIndex ?? index),
    sliceType: index === 0 ? 'outbound' : index === 1 ? 'return' : 'leg',
    origin,
    destination,
    departureAt: raw.departureTimeIso || segments[0]?.departureAt || new Date().toISOString(),
    arrivalAt: raw.arrivalTimeIso || segments[segments.length - 1]?.arrivalAt || new Date().toISOString(),
    durationMinutes: Number(raw.durationMinutes) || segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
    stopCount: Math.max(0, segments.length - 1),
    segments
  };
}

function mapSandbox(raw: any, offer: any): FlightSandboxProvenance {
  const testMode = raw.testMode || offer.testMode || {};
  const services = Array.isArray(raw.services) ? raw.services : [];
  return {
    enabled: true,
    environment: 'SANDBOX',
    liveMode: false,
    nonProduction: true,
    supplier: 'Duffel',
    orderEndpoint: raw.sandbox?.orderEndpoint || testMode.orderEndpoint || '/api/v1/flights/sandbox/orders',
    offerRequestId: raw.offerRequestId || testMode.offerRequestId,
    services: services.map((service: any) => ({
      id: service.serviceId || service.id,
      type: service.type || 'ancillary',
      name: service.name || service.type || 'Optional service',
      description: service.description || '',
      priceMinor: Number(service.priceMinor) || 0,
      currency: service.currency || raw.currency || 'USD',
      maximumQuantity: service.maximumQuantity,
      passengerIds: service.passengerIds,
      segmentIds: service.segmentIds
    })),
    passengers: Array.isArray(raw.passengers)
      ? raw.passengers.map((passenger: any) => ({
          id: passenger.passengerId || passenger.id,
          type: passenger.type || 'adult'
        }))
      : [],
    conditions: raw.conditions,
    seatMapsAvailable: true
  };
}

/**
 * Maps the server's customer-safe sandbox projection into the existing
 * canonical flight offer consumed by all Flights UI.
 */
export function mapSandboxOffer(raw: any): CanonicalFlightOffer {
  const offer = raw.offer || raw;
  const extension = offer.productExtension || {};
  const baggageAllowance = extension.baggageAllowance || {};
  const checkPieces = Number(baggageAllowance.pieceCount || 0);
  const baggage = {
    cabin: {
      pieces: 1,
      maxWeightKg: Number(baggageAllowance.cabinBaggageKg || 0) || undefined,
      description: Number(baggageAllowance.cabinBaggageKg || 0) > 0
        ? `${baggageAllowance.cabinBaggageKg} kg cabin baggage`
        : 'Cabin baggage allowance not supplied'
    },
    checked: {
      pieces: checkPieces,
      maxWeightKg: Number(baggageAllowance.checkedBaggageKg || 0) || undefined,
      description: checkPieces > 0
        ? `${checkPieces} checked piece${checkPieces === 1 ? '' : 's'} · ${baggageAllowance.checkedBaggageKg} kg`
        : 'No checked baggage included'
    },
    isSupplied: true,
    notes: 'Duffel TEST MODE baggage data. Sandbox only.'
  };

  const services = Array.isArray(offer.services) ? offer.services : [];
  const sandbox = mapSandbox(offer, offer);
  const rawSlices = Array.isArray(offer.slices) ? offer.slices : [];
  const slices = rawSlices.map((slice: any, index: number) => mapSlice(slice, index, baggage));
  const segments = slices.flatMap(slice => slice.segments);
  const firstSlice = slices[0];
  const firstSegment = segments[0];
  const totalMinor = Number(offer.pricing?.finalSellingPriceMinor ?? (offer.sellingPrice ? offer.sellingPrice * 100 : 0));
  const currency = offer.currency || offer.pricing?.currency || 'USD';
  const carrier = firstSegment?.marketingCarrier || { code: 'ZZ', name: 'Duffel Airways' };
  const departureAt = firstSlice?.departureAt || new Date().toISOString();
  const arrivalAt = firstSlice?.arrivalAt || departureAt;
  const durationMinutes = firstSlice?.durationMinutes || 0;
  const cabinClass = (firstSegment?.cabinClass || 'economy') as CanonicalFlightOffer['cabinClass'];
  const passengerCounts = sandbox.passengers.reduce(
    (counts, passenger) => {
      if (passenger.type === 'adult') counts.adults++;
      else if (passenger.type === 'child') counts.children++;
      else counts.infants++;
      return counts;
    },
    { adults: 0, children: 0, infants: 0 }
  );
  if (passengerCounts.adults + passengerCounts.children + passengerCounts.infants === 0) passengerCounts.adults = 1;
  const perAdultMinor = Math.round(totalMinor / Math.max(1, passengerCounts.adults));

  const family: FlightFareFamilyOption = {
    familyCode: 'duffel_sandbox',
    familyName: extension.fareFamily || 'Duffel sandbox fare',
    priceDeltaMinor: 0,
    cabinBaggage: baggage.cabin.description,
    checkedBaggage: baggage.checked.description,
    seatSelection: 'paid',
    changeFeeDescription: extension.isChangeable ? 'Changes permitted under sandbox fare rules' : 'Changes not permitted under sandbox fare rules',
    refundDescription: extension.isRefundable ? 'Refundable under sandbox fare rules' : 'Non-refundable sandbox fare',
    mealIncluded: false,
    milesEligibility: 'Sandbox test order only',
    isRecommended: true
  };

  const optionalServices: FlightOptionalService[] = services.map((service: any) => ({
    id: service.serviceId || service.id,
    name: service.name || service.type || 'Optional service',
    description: service.description || 'Duffel TEST MODE optional service',
    priceMinor: Number(service.priceMinor) || 0,
    currency: service.currency || currency,
    status: 'supplier_confirmation_required'
  }));

  const conditions = extension.conditions || sandbox.conditions || {};
  return {
    offerId: offer.canonicalOfferId || offer.offerId,
    sourceType: 'supplier_api',
    sourceProvider: PROVIDER_NAME,
    supplierId: offer.supplierId || 'DUFFEL_NDC',
    sourceOfferId: offer.sourceOfferId || offer.supplierOfferId || offer.canonicalOfferId,
    inventoryMode: 'sandbox_test',
    status: 'active',
    bookability: 'request_to_book',

    origin: firstSlice?.origin || locationFrom('CMB'),
    destination: firstSlice?.destination || locationFrom('DXB'),
    tripType: slices.length > 2 ? 'multi_city' : slices.length === 2 ? 'round_trip' : 'one_way',
    slices,
    segments,
    departureAt,
    arrivalAt,
    durationMinutes,
    // Search cards summarize the outbound slice, not every segment in a return trip.
    stopCount: firstSlice?.stopCount || 0,
    stopAirports: (firstSlice?.segments || []).slice(1).map(segment => segment.origin.airportCode),

    airlines: Array.from(
      new Map<string, CanonicalFlightOffer['airlines'][number]>(
        segments.map(segment => [segment.marketingCarrier.code, segment.marketingCarrier])
      ).values()
    ),
    marketingCarrier: carrier,
    operatingCarrier: firstSegment?.operatingCarrier || carrier,
    flightNumber: firstSegment?.flightNumber || `${carrier.code}-000`,
    aircraft: firstSegment?.aircraft,

    cabinClass,
    fareFamily: extension.fareFamily || family.familyName,
    fareBasis: firstSegment?.bookingClass,
    bookingClass: firstSegment?.bookingClass,
    fareFamiliesAvailable: [family],

    baggage,
    changeRules: {
      allowed: Boolean(conditions.changeable ?? extension.isChangeable),
      feeMinor: conditions.changePenaltyMinor,
      currency: conditions.changePenaltyCurrency || currency,
      description: conditions.description || 'Duffel TEST MODE fare conditions'
    },
    refundRules: {
      refundable: Boolean(conditions.refundable ?? extension.isRefundable),
      feeMinor: conditions.refundPenaltyMinor,
      currency: conditions.refundPenaltyCurrency || currency,
      description: conditions.description || 'Duffel TEST MODE fare conditions'
    },
    seatAvailability: undefined,
    mealInformation: undefined,

    price: {
      totalMinor,
      baseFareMinor: totalMinor,
      taxesMinor: 0,
      feesMinor: 0,
      currency,
      displayCurrency: currency,
      perAdultMinor,
      perChildMinor: passengerCounts.children ? perAdultMinor : undefined,
      perInfantMinor: passengerCounts.infants ? Math.round(perAdultMinor * 0.1) : undefined,
      settlementCurrency: currency
    },
    baseFare: totalMinor / 100,
    taxes: 0,
    fees: 0,
    currency,
    displayCurrency: currency,
    travellerPricing: [
      ...(passengerCounts.adults ? [{ type: 'adult' as const, count: passengerCounts.adults, perPersonMinor: perAdultMinor, totalMinor: perAdultMinor * passengerCounts.adults }] : []),
      ...(passengerCounts.children ? [{ type: 'child' as const, count: passengerCounts.children, perPersonMinor: perAdultMinor, totalMinor: perAdultMinor * passengerCounts.children }] : []),
      ...(passengerCounts.infants ? [{ type: 'infant' as const, count: passengerCounts.infants, perPersonMinor: 0, totalMinor: 0 }] : [])
    ],

    availabilityStatus: offer.availabilityStatus === 'EXPIRED' ? 'EXPIRED' : 'AVAILABLE',
    lastCheckedAt: offer.lastCheckedAt || new Date().toISOString(),
    expiresAt: offer.offerExpiresAt,

    includedServices: Array.isArray(offer.inclusions) ? offer.inclusions : [],
    optionalServices,
    sandbox,
    deepLinkMetadata: { inventory: 'sandbox_test', environment: 'SANDBOX', liveMode: 'false' }
  };
}

export class DuffelSandboxFlightAdapter implements IFlightAdapter {
  public readonly adapterId = 'adapter-duffel-sandbox-flights';
  public readonly sourceType = 'supplier_api' as const;
  public readonly providerName = PROVIDER_NAME;
  public readonly capabilities: FlightAdapterCapabilities = {
    supportsRealtimeFareRules: true,
    supportsAncillaries: true,
    supportsSeatSelection: true,
    supportsInstantRevalidation: true,
    supportsMultiCity: false
  };

  private knownOffers = new Map<string, CanonicalFlightOffer>();

  public async getStatus(): Promise<SandboxStatus> {
    return apiRequest<SandboxStatus>('/api/v1/flights/sandbox/status');
  }

  private supplierRef(offerId: string): string | undefined {
    const known = this.knownOffers.get(offerId)?.sourceOfferId;
    if (known?.startsWith('off_')) return known;
    const match = /^vct-fl-duffel-[a-z0-9]{3}-[a-z0-9]{3}-(off_[A-Za-z0-9_]+)$/.exec(offerId);
    return match?.[1];
  }

  private offerPath(offerId: string, suffix: string): string {
    const query = new URLSearchParams();
    const supplierRef = this.supplierRef(offerId);
    if (supplierRef) query.set('supplierOfferId', supplierRef);
    const queryText = query.toString();
    return `/api/v1/flights/sandbox/offers/${encodeURIComponent(offerId)}${suffix}${queryText ? `?${queryText}` : ''}`;
  }

  public async search(request: FlightSearchRequest): Promise<FlightAdapterSearchResult> {
    const response = await apiRequest<any>('/api/v1/flights/sandbox/search', {
      method: 'POST',
      body: JSON.stringify({
        origin: request.origin.airportCode,
        destination: request.destination.airportCode,
        departureDate: request.departureDate,
        returnDate: request.returnDate,
        tripType: request.tripType,
        adults: request.travellers.adults,
        children: request.travellers.children,
        infants: request.travellers.infants,
        cabinClass: request.cabinClass,
        currency: request.displayCurrency
      })
    });
    const offers: CanonicalFlightOffer[] = (Array.isArray(response.offers) ? response.offers : []).map(mapSandboxOffer);
    for (const offer of offers) {
      this.knownOffers.set(offer.offerId, offer);
      if (offer.sourceOfferId) this.knownOffers.set(offer.sourceOfferId, offer);
    }
    return {
      adapterId: this.adapterId,
      sourceType: this.sourceType,
      providerName: this.providerName,
      offers,
      status: 'ok'
    };
  }

  public async getOfferById(offerId: string): Promise<CanonicalFlightOffer | null> {
    const known = this.knownOffers.get(offerId);
    if (known) return known;
    try {
      const response = await apiRequest<any>(this.offerPath(offerId, ''));
      const offer = mapSandboxOffer(response.offer || response);
      this.knownOffers.set(offer.offerId, offer);
      if (offer.sourceOfferId) this.knownOffers.set(offer.sourceOfferId, offer);
      return offer;
    } catch {
      return null;
    }
  }

  public async revalidateOffer(offerId: string): Promise<FlightRevalidationResult> {
    // POST routes require an explicit JSON body so the server's JSON parser
    // accepts the request; revalidation itself carries no client parameters.
    const response = await apiRequest<any>(this.offerPath(offerId, '/revalidate'), {
      method: 'POST',
      body: JSON.stringify({})
    });
    const offer = response.offer ? mapSandboxOffer(response.offer) : this.knownOffers.get(offerId) || null;
    if (offer) {
      this.knownOffers.set(offer.offerId, offer);
      if (offer.sourceOfferId) this.knownOffers.set(offer.sourceOfferId, offer);
    }
    const status: FlightRevalidationResult['status'] =
      response.status === 'UNCHANGED' ? 'UNCHANGED'
        : response.status === 'PRICE_CHANGED' ? 'PRICE_CHANGED'
          : response.status === 'EXPIRED' ? 'OFFER_EXPIRED'
            : response.status === 'UNAVAILABLE' ? 'UNAVAILABLE'
              : 'RECHECK_REQUIRED';
    const previousPriceMinor = Number(response.previousPrice) || offer?.price.totalMinor || 0;
    const newPriceMinor = Number(response.currentPrice) || offer?.price.totalMinor || previousPriceMinor;
    return {
      offerId,
      status,
      originalPriceMinor: previousPriceMinor,
      newPriceMinor,
      priceDeltaMinor: newPriceMinor - previousPriceMinor,
      currency: offer?.price.currency || 'USD',
      message: response.message || 'Duffel TEST MODE revalidation completed.',
      updatedOffer: offer || undefined,
      revalidatedAt: response.checkedAt || new Date().toISOString(),
      requiresUserAction: status !== 'UNCHANGED'
    };
  }

  public async getAncillaries(offerId: string): Promise<FlightOptionalService[]> {
    const offer = await this.getOfferById(offerId);
    return offer?.optionalServices || [];
  }

  public async getSeatMaps(offerId: string): Promise<SandboxSeatMap[]> {
    const response = await apiRequest<{ seatMaps: SandboxSeatMap[] }>(this.offerPath(offerId, '/seat-maps'));
    return Array.isArray(response.seatMaps) ? response.seatMaps : [];
  }

  public async quoteOrder(offerId: string, services: Array<{ id: string; quantity: number }>): Promise<SandboxQuote> {
    return apiRequest<SandboxQuote>(this.offerPath(offerId, '/quote'), {
      method: 'POST',
      body: JSON.stringify({ services })
    });
  }

  public async createOrder(input: SandboxOrderRequest, idempotencyKey: string): Promise<SandboxOrderConfirmation> {
    return apiRequest<SandboxOrderConfirmation>('/api/v1/flights/sandbox/orders', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input)
    });
  }
}

export const duffelSandboxFlightAdapter = new DuffelSandboxFlightAdapter();
