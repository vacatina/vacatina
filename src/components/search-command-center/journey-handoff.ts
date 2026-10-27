import type { CommandCenterTabId } from '../../lib/domain/types.ts';
import type { SearchStateSnapshot } from '../../lib/services/search.service.ts';
import { normalizeFlightDate, parseFlightSearchQuery } from '../../features/flights/domain/flight-search-query.ts';
import { parseHotelQuery, validateHotelSearch } from '../../features/hotels/domain/hotel-journey.ts';

export const SCC_FIELD_KEYS: Record<CommandCenterTabId, Record<string, string>> = {
  bundle: { 'Starting City / Origin': 'origin', 'Primary Destination': 'destination', 'Travel Dates': 'dateWindow' },
  flights: { From: 'from', To: 'to', Departure: 'departureDate', Return: 'returnDate' },
  hotels: { 'Destination / Property': 'destination', 'Check-in Date': 'checkIn', 'Check-out Date': 'checkOut' },
  visa: { 'Destination Country': 'country', 'Passport / Citizenship': 'citizenship', 'Country of Residence': 'residence', 'Planned Travel Date': 'travelDate', 'Travel Purpose': 'purpose' },
  packages: { Destination: 'destination', 'Departure City': 'departureCity', 'Travel Window': 'travelWindow', 'Package Type': 'packageType' },
  cars: { 'Service Type': 'serviceType', 'Pickup Location': 'pickup', 'Drop-off Location': 'dropoff', 'Pickup Date & Time': 'pickupDateTime' },
  rails: { 'From Station': 'fromStation', 'To Station': 'toStation', 'Departure Date': 'departureDate', Class: 'railClass' },
  cruises: { 'Cruise Destination / Region': 'region', 'Departure Port': 'departurePort', 'Travel Window': 'travelWindow', 'Cabin Preference': 'cabinPreference', Duration: 'duration' },
  activities: { Destination: 'destination', Date: 'date', Category: 'category' },
  sightseeing: { Destination: 'destination', 'Tour Date': 'date', 'Tour Type': 'tourType' },
  insurance: { 'Destination / Region': 'region', 'Country of Residence': 'residence', 'Trip Start': 'tripStart', 'Trip End': 'tripEnd', 'Coverage Type': 'coverageType' }
};

function countryCode(value: string): string {
  const countries: Array<[RegExp, string]> = [[/sri lanka|\bLKA\b/i, 'LK'], [/united kingdom|british|\bGBR\b/i, 'GB'], [/united states|\bUSA\b/i, 'US'], [/india|\bIND\b/i, 'IN'], [/australia|\bAUS\b/i, 'AU']];
  return countries.find(([pattern]) => pattern.test(value))?.[1] || value.trim();
}
function exactDate(value: string): string {
  // A month or seasonal window is not an exact travel date.
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value.trim()) && !/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(value.trim())) return '';
  return normalizeFlightDate(value) || '';
}

/** The SCC hands off intent, not a booking. Missing product-specific inputs are completed on the canonical hub. */
export function buildCommandCenterHandoff(tab: CommandCenterTabId, state: SearchStateSnapshot): { url: string; errors: string[] } {
  const errors: string[] = [];
  const requireText = (value: string, name: string) => { if (!value.trim()) errors.push(`Enter ${name}.`); };
  const requireDate = (value: string, name: string) => {
    const date = exactDate(value);
    if (!date || date < new Date().toISOString().slice(0, 10)) errors.push(`Choose a valid future ${name}.`);
    return date;
  };
  const p = new URLSearchParams({ adults: String(state.travellers.adults), children: String(state.travellers.children), infants: String(state.travellers.infants), rooms: String(state.travellers.rooms) });
  if (state.travellers.adults < 1 || state.travellers.children < 0 || state.travellers.infants < 0 || state.travellers.adults + state.travellers.children + state.travellers.infants > 9 || state.travellers.infants > state.travellers.adults) errors.push('Choose a valid travel party of 1–9 travellers.');
  let route = '';
  switch (tab) {
    case 'flights': {
      const f = state.flights;
      requireText(f.from, 'departure airport'); requireText(f.to, 'arrival airport');
      const type = f.tripType.replace(/-/g, '_');
      p.set('tripType', type); p.set('origin', f.from); p.set('destination', f.to);
      p.set('departureDate', requireDate(f.departureDate, 'departure date'));
      if (type === 'round_trip') p.set('returnDate', requireDate(f.returnDate, 'return date'));
      p.set('cabinClass', state.travellers.cabin.toLowerCase().replace(/ /g, '_'));
      if (f.directOnly) p.set('directOnly', 'true');
      if (type !== 'multi_city') errors.push(...Object.values(parseFlightSearchQuery(p).errors));
      route = type === 'multi_city' ? '/flights' : '/flights/search'; break;
    }
    case 'hotels': {
      p.set('destination', state.hotels.destination); p.set('checkIn', requireDate(state.hotels.checkIn, 'check-in date')); p.set('checkOut', requireDate(state.hotels.checkOut, 'check-out date'));
      errors.push(...validateHotelSearch(parseHotelQuery(p))); route = '/hotels/search'; break;
    }
    case 'visa': {
      const v = state.visa;
      requireText(v.country, 'destination country'); requireText(v.citizenship, 'passport nationality'); requireText(v.residence, 'country of residence'); requireText(v.purpose, 'travel purpose');
      p.set('destination', v.country); p.set('citizenship', countryCode(v.citizenship)); p.set('residenceCountry', countryCode(v.residence)); p.set('departureDate', requireDate(v.travelDate, 'travel date'));
      p.set('purpose', /business/i.test(v.purpose) ? 'business' : /transit/i.test(v.purpose) ? 'transit' : /family/i.test(v.purpose) ? 'family' : 'tourism');
      p.set('applicants', String(state.travellers.adults + state.travellers.children + state.travellers.infants)); p.set('children', '0'); p.set('infants', '0');
      route = '/visa-assistance'; break;
    }
    case 'packages': {
      const v = state.packages; requireText(v.destination, 'package destination'); requireText(v.travelWindow, 'preferred travel window');
      p.set('destination', v.destination); p.set('origin', v.departureCity); p.set('travelWindow', v.travelWindow); p.set('packageStylePreference', v.packageType);
      route = '/holiday-packages'; break;
    }
    case 'cars': {
      const v = state.cars; requireText(v.pickup, 'pickup location'); requireText(v.dropoff, 'drop-off location');
      if (!/transfer|hire/i.test(v.serviceType)) errors.push('Choose transfer or car hire.');
      const parts = v.pickupDateTime.split(/\s*·\s*|T/);
      const time = (parts[1] || '').slice(0, 5);
      p.set('departureDate', requireDate(parts[0], 'pickup date')); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push('Choose a valid pickup time.');
      p.set('pickupTime', time); p.set('pickup', v.pickup); p.set('dropoff', v.dropoff); p.set('destination', v.dropoff);
      p.set('serviceType', /hire|self/i.test(v.serviceType) ? 'car-hire' : 'transfer'); p.set('tripType', 'one_way'); route = '/cars-transfers'; break;
    }
    case 'rails': {
      const v = state.rails; requireText(v.fromStation, 'departure station'); requireText(v.toStation, 'arrival station');
      if (v.fromStation.trim().toLowerCase() === v.toStation.trim().toLowerCase()) errors.push('Choose different rail stations.');
      p.set('origin', v.fromStation); p.set('destination', v.toStation); p.set('departureDate', requireDate(v.departureDate, 'rail date')); p.set('cabinClass', /first/i.test(v.railClass) ? 'first' : 'standard'); route = '/rails/search'; break;
    }
    case 'cruises': {
      const v = state.cruises; requireText(v.region, 'cruise region'); requireText(v.departurePort, 'preferred departure port'); requireText(v.travelWindow, 'sailing window');
      p.set('destination', v.region); p.set('departurePort', v.departurePort); p.set('travelWindow', v.travelWindow); p.set('cabinPreference', v.cabinPreference); p.set('durationPreference', v.duration); route = '/cruises'; break;
    }
    case 'activities': case 'sightseeing': {
      const v = state[tab]; requireText(v.destination, 'destination'); p.set('destination', v.destination); p.set('departureDate', requireDate(v.date, 'experience date'));
      p.set('requestedCategory', tab === 'activities' ? state.activities.category : state.sightseeing.tourType); route = tab === 'activities' ? '/activities/search' : '/sightseeing-tours/search'; break;
    }
    case 'insurance': {
      const v = state.insurance; requireText(v.region, 'travel region'); requireText(v.residence, 'country of residence');
      p.set('destination', v.region); p.set('residenceCountry', countryCode(v.residence)); p.set('departureDate', requireDate(v.tripStart, 'trip start')); p.set('returnDate', requireDate(v.tripEnd, 'trip end'));
      if (p.get('returnDate')! <= p.get('departureDate')!) errors.push('Trip end must be after trip start.');
      p.set('coveragePreference', v.coverageType); route = '/travel-insurance'; break;
    }
    case 'bundle': {
      const v = state.bundle; requireText(v.origin, 'departure city'); requireText(v.destination, 'destination'); requireText(v.dateWindow, 'travel window');
      if (v.components.length < 2) errors.push('Choose at least two product types for your bundle.');
      p.set('origin', v.origin); p.set('destination', v.destination); p.set('travelWindow', v.dateWindow);
      const dates = v.dateWindow.split(/\s+[–—]\s+/);
      if (dates.length === 2 && exactDate(dates[0]) && exactDate(dates[1])) { p.set('departureDate', exactDate(dates[0])); p.set('returnDate', exactDate(dates[1])); }
      const products: Record<string, string> = { Flights: 'flights', Hotels: 'hotels', 'Visa Assistance': 'visa', 'Cars & Transfers': 'cars', Activities: 'activities', 'Sightseeing Tours': 'sightseeing', Rails: 'rails', Cruises: 'cruises', 'Travel Insurance': 'insurance', 'Holiday Packages': 'packages' };
      v.components.forEach(label => { if (products[label]) p.append('product', products[label]); }); route = '/trip-builder'; break;
    }
  }
  return { url: `${route}?${p}`, errors: [...new Set(errors)] };
}
