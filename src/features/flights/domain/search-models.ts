/* ============================================================================
 * Vacatina Canonical Flight Search Request & Response Models
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§7, §11, §12, §14-§16)
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightCabinClass,
  FlightLocation
} from './flight-models.ts';

export type FlightTripType = 'round_trip' | 'one_way' | 'multi_city';

export interface FlightLegRequest {
  legIndex: number;
  origin: FlightLocation;
  destination: FlightLocation;
  departureDate: string; // YYYY-MM-DD
}

export interface FlightTravellerCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface FlightSearchRequest {
  searchId: string;
  tripType: FlightTripType;
  origin: FlightLocation;
  destination: FlightLocation;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;   // YYYY-MM-DD (mandatory if round_trip)
  legs?: FlightLegRequest[]; // (mandatory if multi_city, >= 2 legs)
  travellers: FlightTravellerCounts;
  cabinClass: FlightCabinClass;
  directFlightsOnly: boolean;
  nearbyAirports: boolean;
  farePreference?: 'lowest_price' | 'refundable' | 'flexible';
  corporateCode?: string;
  promoCode?: string;
  displayCurrency: string;
  locale: string;
  /** Selects the inventory lane. Sandbox test inventory is never mixed with demo fixtures. */
  inventorySource?: 'demo_fixture' | 'sandbox_test';
  createdAt: string;
}

export interface FlightSearchValidation {
  isValid: boolean;
  errors: Record<string, string>;
  firstErrorField?: string;
}

export type FlightSortOption =
  | 'recommended'
  | 'price_asc'
  | 'duration_asc'
  | 'departure_asc'
  | 'arrival_asc';

export interface FlightFilterCriteria {
  stops?: number[]; // e.g. [0, 1]
  airlineCodes?: string[];
  maxPriceMinor?: number;
  minPriceMinor?: number;
  departureTimeWindow?: 'all' | 'morning' | 'afternoon' | 'evening'; // 00-12, 12-18, 18-24
  arrivalTimeWindow?: 'all' | 'morning' | 'afternoon' | 'evening';
  maxDurationMinutes?: number;
  cabinClass?: FlightCabinClass;
  baggageIncludedOnly?: boolean;
  refundableOnly?: boolean;
}

export interface FlightSearchResponse {
  searchId: string;
  request: FlightSearchRequest;
  offers: CanonicalFlightOffer[];
  totalCount: number;
  filteredCount: number;
  searchTimestamp: string;
  sourcesQueried: Array<{
    source: 'manual' | 'supplier_api';
    provider: string;
    count: number;
    status: 'ok' | 'degraded' | 'error';
  }>;
  availableAirlines: Array<{
    code: string;
    name: string;
    minPriceMinor: number;
    count: number;
  }>;
  availableStops: number[];
  priceRange: {
    minMinor: number;
    maxMinor: number;
  };
  durationRange: {
    minMinutes: number;
    maxMinutes: number;
  };
}

export interface FlightConfigurationSelection {
  offerId: string;
  selectedFareFamilyCode: string;
  selectedCabinClass: FlightCabinClass;
  selectedOptionalServiceIds: string[];
  travellerDetails?: Array<{
    type: 'adult' | 'child' | 'infant';
    title?: string;
    firstName?: string;
    lastName?: string;
  }>;
}

export interface FlightRevalidationResult {
  offerId: string;
  status: 'UNCHANGED' | 'PRICE_CHANGED' | 'OFFER_EXPIRED' | 'UNAVAILABLE' | 'RECHECK_REQUIRED';
  originalPriceMinor: number;
  newPriceMinor: number;
  priceDeltaMinor: number;
  currency: string;
  message: string;
  updatedOffer?: CanonicalFlightOffer;
  revalidatedAt: string;
  requiresUserAction: boolean;
}
