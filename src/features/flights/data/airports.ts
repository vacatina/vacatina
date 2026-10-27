/* ============================================================================
 * Vacatina Canonical Airport & City Master Registry
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§8)
 * ============================================================================ */

import type { FlightLocation } from '../domain/flight-models.ts';

export const CANONICAL_AIRPORTS: FlightLocation[] = [
  {
    airportCode: 'CMB',
    cityCode: 'CMB',
    airportName: 'Bandaranaike International Airport',
    city: 'Colombo',
    country: 'Sri Lanka',
    countryCode: 'LK',
    timezone: 'Asia/Colombo',
    terminal: 'T1'
  },
  {
    airportCode: 'DXB',
    cityCode: 'DXB',
    airportName: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    timezone: 'Asia/Dubai',
    terminal: 'T3'
  },
  {
    airportCode: 'LHR',
    cityCode: 'LON',
    airportName: 'Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    timezone: 'Europe/London',
    terminal: 'T4'
  },
  {
    airportCode: 'LGW',
    cityCode: 'LON',
    airportName: 'Gatwick Airport',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    timezone: 'Europe/London',
    terminal: 'South'
  },
  {
    airportCode: 'SIN',
    cityCode: 'SIN',
    airportName: 'Changi Airport',
    city: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    timezone: 'Asia/Singapore',
    terminal: 'T3'
  },
  {
    airportCode: 'MLE',
    cityCode: 'MLE',
    airportName: 'Velana International Airport',
    city: 'Malé',
    country: 'Maldives',
    countryCode: 'MV',
    timezone: 'Indian/Maldives',
    terminal: 'International'
  },
  {
    airportCode: 'BKK',
    cityCode: 'BKK',
    airportName: 'Suvarnabhumi Airport',
    city: 'Bangkok',
    country: 'Thailand',
    countryCode: 'TH',
    timezone: 'Asia/Bangkok',
    terminal: 'Main'
  },
  {
    airportCode: 'DMK',
    cityCode: 'BKK',
    airportName: 'Don Mueang International Airport',
    city: 'Bangkok',
    country: 'Thailand',
    countryCode: 'TH',
    timezone: 'Asia/Bangkok',
    terminal: 'T1'
  },
  {
    airportCode: 'DPS',
    cityCode: 'DPS',
    airportName: 'Ngurah Rai International Airport',
    city: 'Denpasar / Bali',
    country: 'Indonesia',
    countryCode: 'ID',
    timezone: 'Asia/Makassar',
    terminal: 'International'
  },
  {
    airportCode: 'KUL',
    cityCode: 'KUL',
    airportName: 'Kuala Lumpur International Airport',
    city: 'Kuala Lumpur',
    country: 'Malaysia',
    countryCode: 'MY',
    timezone: 'Asia/Kuala_Lumpur',
    terminal: 'KLIA1'
  },
  {
    airportCode: 'DOH',
    cityCode: 'DOH',
    airportName: 'Hamad International Airport',
    city: 'Doha',
    country: 'Qatar',
    countryCode: 'QA',
    timezone: 'Asia/Qatar',
    terminal: 'Main'
  },
  {
    airportCode: 'AUH',
    cityCode: 'AUH',
    airportName: 'Zayed International Airport',
    city: 'Abu Dhabi',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    timezone: 'Asia/Dubai',
    terminal: 'Terminal A'
  },
  {
    airportCode: 'CDG',
    cityCode: 'PAR',
    airportName: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    timezone: 'Europe/Paris',
    terminal: '2E'
  },
  {
    airportCode: 'FRA',
    cityCode: 'FRA',
    airportName: 'Frankfurt am Main Airport',
    city: 'Frankfurt',
    country: 'Germany',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    terminal: 'T1'
  },
  {
    airportCode: 'ZRH',
    cityCode: 'ZRH',
    airportName: 'Zurich Airport',
    city: 'Zurich',
    country: 'Switzerland',
    countryCode: 'CH',
    timezone: 'Europe/Zurich',
    terminal: 'Airside Center'
  },
  {
    airportCode: 'HND',
    cityCode: 'TYO',
    airportName: 'Tokyo Haneda Airport',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    timezone: 'Asia/Tokyo',
    terminal: 'T3'
  },
  {
    airportCode: 'NRT',
    cityCode: 'TYO',
    airportName: 'Narita International Airport',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    timezone: 'Asia/Tokyo',
    terminal: 'T1'
  },
  {
    airportCode: 'JFK',
    cityCode: 'NYC',
    airportName: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/New_York',
    terminal: 'T4'
  },
  {
    airportCode: 'SYD',
    cityCode: 'SYD',
    airportName: 'Sydney Kingsford Smith Airport',
    city: 'Sydney',
    country: 'Australia',
    countryCode: 'AU',
    timezone: 'Australia/Sydney',
    terminal: 'T1'
  },
  {
    airportCode: 'MEL',
    cityCode: 'MEL',
    airportName: 'Melbourne Tullamarine Airport',
    city: 'Melbourne',
    country: 'Australia',
    countryCode: 'AU',
    timezone: 'Australia/Melbourne',
    terminal: 'T2'
  },
  {
    airportCode: 'DEL',
    cityCode: 'DEL',
    airportName: 'Indira Gandhi International Airport',
    city: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    terminal: 'T3'
  },
  {
    airportCode: 'BOM',
    cityCode: 'BOM',
    airportName: 'Chhatrapati Shivaji Maharaj International',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    terminal: 'T2'
  },
  {
    airportCode: 'MAA',
    cityCode: 'MAA',
    airportName: 'Chennai International Airport',
    city: 'Chennai',
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    terminal: 'T2'
  }
];

export function findAirportByCode(code: string): FlightLocation | undefined {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase();
  return CANONICAL_AIRPORTS.find(a => a.airportCode === clean);
}

export function getAirport(code: string): FlightLocation {
  return findAirportByCode(code) || CANONICAL_AIRPORTS[0];
}

export function searchAirports(query: string, maxResults = 8): FlightLocation[] {
  if (!query || !query.trim()) return CANONICAL_AIRPORTS.slice(0, maxResults);
  const q = query.trim().toLowerCase();

  return CANONICAL_AIRPORTS.filter(a => {
    return (
      a.airportCode.toLowerCase().includes(q) ||
      a.cityCode.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.airportName.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.countryCode.toLowerCase().includes(q)
    );
  }).slice(0, maxResults);
}

export function formatAirportDisplay(loc: FlightLocation): string {
  return `${loc.city} (${loc.airportCode}) — ${loc.airportName}`;
}

export function formatAirportShort(loc: FlightLocation): string {
  return `${loc.city} (${loc.airportCode})`;
}

export function parseAirportFromInput(input: string): FlightLocation | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();

  // 1. Direct code lookup (3 letters)
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return findAirportByCode(trimmed);
  }

  // 2. Pattern with (CODE) e.g. "Colombo (CMB) — Bandaranaike"
  const codeMatch = trimmed.match(/\(([A-Za-z]{3})\)/);
  if (codeMatch && codeMatch[1]) {
    const found = findAirportByCode(codeMatch[1]);
    if (found) return found;
  }

  // 3. Fallback search by city or name
  const matches = searchAirports(trimmed, 1);
  return matches.length > 0 ? matches[0] : undefined;
}

export function validateAirportSelection(
  fromRaw: string | FlightLocation,
  toRaw: string | FlightLocation
): { isValid: boolean; error?: string; origin?: FlightLocation; destination?: FlightLocation } {
  const origin = typeof fromRaw === 'string' ? parseAirportFromInput(fromRaw) : fromRaw;
  const destination = typeof toRaw === 'string' ? parseAirportFromInput(toRaw) : toRaw;

  if (!origin) {
    return {
      isValid: false,
      error: 'Please select a valid origin airport from the suggestions.'
    };
  }

  if (!destination) {
    return {
      isValid: false,
      error: 'Please select a valid destination airport from the suggestions.'
    };
  }

  if (origin.airportCode === destination.airportCode) {
    return {
      isValid: false,
      error: 'Origin and destination airports cannot be identical.',
      origin,
      destination
    };
  }

  return { isValid: true, origin, destination };
}
