/* ============================================================================
 * Vacatina Canonical Flight Domain Models
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§4, §6, §17-§26)
 * ============================================================================ */

export type FlightSourceType = 'manual' | 'supplier_api';

/**
 * Runtime inventory truth for the current Phase 5 build.
 * `demo_fixture` and `manual_request` must never be presented as live,
 * instantly confirmable airline inventory.
 */
export type FlightInventoryMode = 'demo_fixture' | 'manual_request' | 'live_supplier' | 'sandbox_test';

export type FlightCommercialState = 'informational' | 'request_to_book' | 'live_bookable';

export type FlightOfferStatus = 'active' | 'paused' | 'expired' | 'draft';

export type FlightCabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export type FlightAvailabilityStatus =
  | 'AVAILABLE'
  | 'FEW_SEATS_LEFT'
  | 'ON_REQUEST'
  | 'PRICE_CHANGED'
  | 'UNAVAILABLE'
  | 'EXPIRED';

export interface FlightLocation {
  airportCode: string;
  cityCode: string;
  airportName: string;
  city: string;
  country: string;
  countryCode: string;
  timezone?: string;
  terminal?: string;
}

export interface FlightAirline {
  code: string;
  name: string;
  logoUrl?: string;
}

export interface StructuredBaggageAllowance {
  pieces: number;
  maxWeightKg?: number;
  description: string;
}

export interface StructuredBaggage {
  cabin: StructuredBaggageAllowance;
  checked: StructuredBaggageAllowance;
  isSupplied: boolean;
  notes?: string;
}

export interface FlightRuleCondition {
  allowed: boolean;
  feeMinor?: number;
  currency?: string;
  description: string;
}

export interface FlightRefundCondition {
  refundable: boolean;
  feeMinor?: number;
  currency?: string;
  description: string;
}

export interface FlightFareFamilyOption {
  familyCode: string; // e.g. 'lite', 'classic', 'flex', 'business_flex'
  familyName: string; // e.g. 'Economy Lite', 'Economy Classic', 'Economy Flex'
  priceDeltaMinor: number; // delta relative to base offer in minor currency
  cabinBaggage: string;
  checkedBaggage: string;
  seatSelection: 'unavailable' | 'paid' | 'standard_included' | 'any_included';
  changeFeeDescription: string;
  refundDescription: string;
  mealIncluded: boolean;
  milesEligibility: string;
  isRecommended?: boolean;
}

export interface FlightSegment {
  segmentId: string;
  marketingCarrier: FlightAirline;
  operatingCarrier: FlightAirline;
  flightNumber: string;
  aircraft?: string;
  origin: FlightLocation;
  destination: FlightLocation;
  departureAt: string; // ISO 8601
  arrivalAt: string;   // ISO 8601
  durationMinutes: number;
  cabinClass: FlightCabinClass;
  bookingClass?: string;
  fareBasis?: string;
  baggage: StructuredBaggage;
  mealInformation?: string;
  seatAvailability?: number;
  layoverDurationMinutes?: number;
  layoverAirportCode?: string;
}

export interface FlightSlice {
  sliceIndex: number;
  sliceType: 'outbound' | 'return' | 'leg';
  origin: FlightLocation;
  destination: FlightLocation;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  stopCount: number;
  segments: FlightSegment[];
}

export interface FlightTravellerPricing {
  type: 'adult' | 'child' | 'infant';
  count: number;
  perPersonMinor: number;
  totalMinor: number;
}

export interface FlightPriceBreakdown {
  totalMinor: number;
  baseFareMinor: number;
  taxesMinor: number;
  feesMinor: number;
  currency: string;
  displayCurrency: string;
  perAdultMinor: number;
  perChildMinor?: number;
  perInfantMinor?: number;
  isEstimatedConversion?: boolean;
  settlementCurrency?: string;
}

export interface FlightOptionalService {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  status:
    | 'included'
    | 'available_later'
    | 'not_supplied'
    | 'unavailable'
    | 'supplier_confirmation_required';
}

export interface FlightManualInventoryMetadata {
  commercialState: FlightCommercialState;
  /**
   * Manual listing rows do not carry live schedule fields. Until an operator
   * confirms carrier, flight number, timings and baggage, the offer must stay
   * request-to-book and must never be presented as live supplier truth.
   */
  scheduleStatus?: 'CONFIRMED' | 'PENDING_OPERATOR_CONFIRMATION';
  campaignCode?: string;
  quotaRemaining?: number;
  contactDeskNote?: string;
  manualEvidenceRef?: string;
}

/** Customer-safe Duffel TEST MODE evidence. Never contains server secrets or raw payloads. */
export interface FlightSandboxService {
  id: string;
  type: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  maximumQuantity?: number;
  passengerIds?: string[];
  segmentIds?: string[];
}

export interface FlightSandboxPassenger {
  id: string;
  type: 'adult' | 'child' | 'infant_without_seat';
}

export interface FlightSandboxConditions {
  refundable: boolean;
  refundPenaltyMinor?: number;
  refundPenaltyCurrency?: string;
  changeable: boolean;
  changePenaltyMinor?: number;
  changePenaltyCurrency?: string;
  description: string;
}

export interface FlightSandboxProvenance {
  enabled: true;
  environment: 'SANDBOX';
  liveMode: false;
  nonProduction: true;
  supplier: 'Duffel';
  orderEndpoint: string;
  offerRequestId?: string;
  services: FlightSandboxService[];
  passengers: FlightSandboxPassenger[];
  conditions?: FlightSandboxConditions;
  seatMapsAvailable: boolean;
}

/**
 * Authoritative Canonical Flight Offer Model
 * Consumed across public UI, Search Results, Offer Detail, and Trip Bucket.
 */
export interface CanonicalFlightOffer {
  // Provenance & Source Identity (§4, §6)
  offerId: string;
  sourceType: FlightSourceType;
  sourceProvider: string;
  supplierId: string;
  sourceOfferId: string;
  /**
   * Explicit runtime inventory mode. Adapters set this so the UI never has to
   * infer live status from a provider name.
   */
  inventoryMode?: FlightInventoryMode;
  status: FlightOfferStatus;
  bookability: FlightCommercialState;

  // Route & Timings
  origin: FlightLocation;
  destination: FlightLocation;
  tripType: 'round_trip' | 'one_way' | 'multi_city';
  slices: FlightSlice[];
  segments: FlightSegment[];
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  stopCount: number;
  stopAirports: string[];

  // Airline & Aircraft
  airlines: FlightAirline[];
  marketingCarrier: FlightAirline;
  operatingCarrier: FlightAirline;
  flightNumber: string;
  aircraft?: string;

  // Cabin & Fare Families
  cabinClass: FlightCabinClass;
  fareFamily: string;
  fareBasis?: string;
  bookingClass?: string;
  fareFamiliesAvailable: FlightFareFamilyOption[];

  // Policies & Rules
  baggage: StructuredBaggage;
  changeRules: FlightRuleCondition;
  refundRules: FlightRefundCondition;
  seatAvailability?: number;
  mealInformation?: string;

  // Commercial Pricing & Breakdown
  price: FlightPriceBreakdown;
  baseFare: number;
  taxes: number;
  fees: number;
  currency: string;
  displayCurrency: string;
  travellerPricing: FlightTravellerPricing[];

  // Freshness & Availability
  availabilityStatus: FlightAvailabilityStatus;
  lastCheckedAt: string;
  expiresAt?: string;

  // Inclusions & Optional Services
  includedServices: string[];
  optionalServices: FlightOptionalService[];

  /** Present only for Duffel TEST MODE offers. Never indicates live inventory. */
  sandbox?: FlightSandboxProvenance;

  // Operational Metadata
  deepLinkMetadata?: Record<string, string>;
  manualInventoryMetadata?: FlightManualInventoryMetadata;
}
