/* ============================================================================
 * Vacatina Canonical Flight Search Query Parser
 * Accepts both the dedicated Flights aliases (origin/destination/departureDate)
 * and the legacy homepage aliases (from/to/dep/ret/cabin).
 * ============================================================================ */

import type { FlightCabinClass } from './flight-models.ts';
import type {
  FlightLegRequest,
  FlightSearchRequest,
  FlightTripType
} from './search-models.ts';
import {
  findAirportByCode,
  parseAirportFromInput
} from '../data/airports.ts';

export interface FlightSearchQueryParseResult {
  request: FlightSearchRequest;
  errors: Record<string, string>;
  usedDefaults: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function isoDate(year: number, monthIndex: number, day: number): string | null {
  const value = new Date(Date.UTC(year, monthIndex, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== monthIndex ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${(monthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Normalizes ISO dates and the human display dates used by the homepage
 * command centre (for example "12 Nov 2026"). Returns null when invalid.
 */
export function normalizeFlightDate(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    return isoDate(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const displayMatch = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(trimmed);
  if (displayMatch) {
    const month = MONTHS[displayMatch[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      return isoDate(Number(displayMatch[3]), month, Number(displayMatch[1]));
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return isoDate(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return null;
}

export function addDaysIso(base: Date, days: number): string {
  const copy = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().split('T')[0];
}

function normalizeTripType(value: string): FlightTripType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'round_trip' || normalized === 'roundtrip' || normalized === 'return') {
    return 'round_trip';
  }
  if (normalized === 'one_way' || normalized === 'oneway' || normalized === 'single') {
    return 'one_way';
  }
  if (normalized === 'multi_city' || normalized === 'multicity' || normalized === 'multi') {
    return 'multi_city';
  }
  return null;
}

function normalizeCabin(value: string): FlightCabinClass | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'economy' || normalized === 'coach') return 'economy';
  if (normalized === 'premium_economy' || normalized === 'premium' || normalized === 'premiumeco') {
    return 'premium_economy';
  }
  if (normalized === 'business' || normalized === 'biz') return 'business';
  if (normalized === 'first') return 'first';
  return null;
}

function parseCount(
  raw: string | null,
  fallback: number,
  field: string,
  errors: Record<string, string>
): number {
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 9) {
    errors[field] = 'Traveller counts must be whole numbers between 0 and 9.';
    return fallback;
  }
  return value;
}

function firstParam(query: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    if (query.has(key)) return query.get(key);
  }
  return null;
}

/**
 * Builds a canonical, replayable search URL. Used when returning from an offer
 * modal or a local review so the customer keeps their original search context.
 */
export function buildFlightSearchQuery(request: FlightSearchRequest): string {
  const params = new URLSearchParams();
  params.set('tripType', request.tripType);
  params.set('origin', request.origin.airportCode);
  params.set('destination', request.destination.airportCode);
  params.set('departureDate', request.departureDate);
  if (request.returnDate) params.set('returnDate', request.returnDate);
  params.set('adults', String(request.travellers.adults));
  params.set('children', String(request.travellers.children));
  params.set('infants', String(request.travellers.infants));
  params.set('cabinClass', request.cabinClass);
  if (request.directFlightsOnly) params.set('directOnly', 'true');
  if (request.nearbyAirports) params.set('nearbyAirports', 'true');
  if (request.tripType === 'multi_city' && request.legs) {
    request.legs.forEach(leg => {
      params.append(
        'leg',
        `${leg.origin.airportCode}-${leg.destination.airportCode}-${leg.departureDate}`
      );
    });
  }
  return `/flights/search?${params.toString()}`;
}

export function parseFlightSearchQuery(
  query: URLSearchParams,
  now: Date = new Date()
): FlightSearchQueryParseResult {
  const errors: Record<string, string> = {};
  const usedDefaults: string[] = [];
  const todayIso = addDaysIso(now, 0);

  const rawOrigin = firstParam(query, ['origin', 'from', 'originAirport', 'departureAirport']);
  const rawDestination = firstParam(query, ['destination', 'to', 'destinationAirport', 'arrivalAirport']);

  let origin = rawOrigin && rawOrigin.trim() ? parseAirportFromInput(rawOrigin) : undefined;
  if (rawOrigin && rawOrigin.trim() && !origin) {
    errors.origin = `Departure airport "${rawOrigin}" is not recognized. Choose an airport from the suggestions.`;
  }
  if (!origin) {
    origin = findAirportByCode('CMB');
    if (!rawOrigin || !rawOrigin.trim()) usedDefaults.push('origin');
  }

  let destination = rawDestination && rawDestination.trim()
    ? parseAirportFromInput(rawDestination)
    : undefined;
  if (rawDestination && rawDestination.trim() && !destination) {
    errors.destination = `Arrival airport "${rawDestination}" is not recognized. Choose an airport from the suggestions.`;
  }
  if (!destination) {
    destination = findAirportByCode('DXB');
    if (!rawDestination || !rawDestination.trim()) usedDefaults.push('destination');
  }

  const rawTripType = firstParam(query, ['tripType', 'trip']);
  let tripType: FlightTripType = 'round_trip';
  if (rawTripType && rawTripType.trim()) {
    const normalized = normalizeTripType(rawTripType);
    if (!normalized) {
      errors.tripType = 'Trip type must be round trip, one way, or multi-city.';
    } else {
      tripType = normalized;
    }
  }

  const rawDeparture = firstParam(query, ['departureDate', 'dep', 'date', 'departDate']);
  let departureDate = rawDeparture ? normalizeFlightDate(rawDeparture) : null;
  if (rawDeparture && rawDeparture.trim() && !departureDate) {
    errors.departureDate = 'Please enter a valid departure date.';
  }
  if (!departureDate) {
    departureDate = addDaysIso(now, 7);
    usedDefaults.push('departureDate');
  }
  if (departureDate < todayIso) {
    errors.departureDate = 'Departure date cannot be in the past.';
  }

  const rawReturn = firstParam(query, ['returnDate', 'ret', 'return', 'checkOut', 'checkout']);
  let returnDate: string | undefined;
  if (tripType === 'round_trip') {
    if (rawReturn && rawReturn.trim()) {
      const normalized = normalizeFlightDate(rawReturn);
      if (!normalized) {
        errors.returnDate = 'Please enter a valid return date.';
      } else {
        returnDate = normalized;
      }
    }
    if (!returnDate) {
      returnDate = addDaysIso(new Date(`${departureDate}T00:00:00.000Z`), 7);
      if (!rawReturn || !rawReturn.trim()) usedDefaults.push('returnDate');
    }
    if (returnDate < departureDate) {
      errors.returnDate = 'Return date cannot precede departure date.';
    }
  }

  // Multi-city legs are serialized as ORIGIN-DEST-YYYY-MM-DD.
  const rawLegValues = query
    .getAll('leg')
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean);

  let legs: FlightLegRequest[] | undefined;
  if (rawLegValues.length > 0) {
    const parsedLegs: FlightLegRequest[] = [];
    rawLegValues.forEach((raw, index) => {
      const match = /^([A-Za-z]{3})-([A-Za-z]{3})-(\d{4}-\d{1,2}-\d{1,2})$/.exec(raw);
      const legOrigin = match ? findAirportByCode(match[1]) : undefined;
      const legDestination = match ? findAirportByCode(match[2]) : undefined;
      const legDate = match ? normalizeFlightDate(match[3]) : null;
      if (!legOrigin || !legDestination || !legDate) {
        errors.legs = `Flight leg ${index + 1} is not valid. Each leg needs a recognised origin, destination and date.`;
        return;
      }
      parsedLegs.push({
        legIndex: parsedLegs.length,
        origin: legOrigin,
        destination: legDestination,
        departureDate: legDate
      });
    });
    if (parsedLegs.length > 0) legs = parsedLegs;
  }

  if (tripType === 'multi_city') {
    if (!legs || legs.length < 2) {
      if (!errors.legs) {
        errors.legs = 'Multi-city itinerary requires at least 2 flight legs.';
      }
    } else {
      origin = legs[0].origin;
      destination = legs[legs.length - 1].destination;
      departureDate = legs[0].departureDate;
      returnDate = undefined;

      if (departureDate < todayIso) {
        errors.departureDate = 'Departure date cannot be in the past.';
      }
      legs.forEach((leg, index) => {
        if (index > 0 && leg.departureDate < legs![index - 1].departureDate) {
          errors.legs = 'Multi-city leg dates must be in chronological order.';
        }
      });
    }
  } else if (origin && destination && origin.airportCode === destination.airportCode) {
    errors.destination = 'Origin and destination airports cannot be identical.';
  }

  const rawCabin = firstParam(query, ['cabinClass', 'cabin', 'class']);
  let cabinClass: FlightCabinClass = 'economy';
  if (rawCabin && rawCabin.trim()) {
    const normalized = normalizeCabin(rawCabin);
    if (!normalized) {
      errors.cabinClass = 'Cabin class must be economy, premium economy, business, or first.';
    } else {
      cabinClass = normalized;
    }
  }

  const adults = parseCount(query.get('adults'), 1, 'adults', errors);
  const children = parseCount(query.get('children'), 0, 'children', errors);
  const infants = parseCount(query.get('infants'), 0, 'infants', errors);

  const directOnly = ['true', '1', 'yes'].includes((query.get('directOnly') || '').toLowerCase());
  const nearbyAirports = ['true', '1', 'yes'].includes((query.get('nearbyAirports') || '').toLowerCase());

  const request: FlightSearchRequest = {
    searchId: `srch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tripType,
    origin: origin || findAirportByCode('CMB')!,
    destination: destination || findAirportByCode('DXB')!,
    departureDate,
    returnDate,
    legs: tripType === 'multi_city' ? legs : undefined,
    travellers: { adults, children, infants },
    cabinClass,
    directFlightsOnly: directOnly,
    nearbyAirports,
    displayCurrency: 'LKR',
    locale: 'en',
    createdAt: now.toISOString()
  };

  return { request, errors, usedDefaults };
}
