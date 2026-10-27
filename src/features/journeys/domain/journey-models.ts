import type { TravelProductSlug } from '../../../lib/domain/types.ts';

/** Customer DTO only. Supplier payloads and commercial costs never enter this model. */
export interface JourneyOffer {
  inventoryMode?: 'demo_fixture' | 'manual_request' | 'live_supplier';
  sourceType?: string;
  sourceId?: string;
  providerName?: string;
  priceStatus?: 'quote_required' | 'illustrative' | 'quoted';
  canonicalOfferId?: string;
  offerId: string;
  productType: TravelProductSlug;
  title: string;
  subtitle?: string;
  location?: { city?: string; country?: string };
  price?: number;
  sellingPrice?: number;
  currency?: string;
  displayCurrency?: string;
  pricing?: { finalSellingPriceMinor: number; currency: string };
  availabilityStatus: string;
  bookingMode?: string;
  confirmationMode?: string;
  sellable?: boolean;
  offerExpiresAt?: string;
  lastCheckedAt?: string;
  cancellationPolicy?: string;
  inclusions?: string[];
  exclusions?: string[];
  requiredConfiguration?: string[] | Record<string, boolean>;
  productExtension?: Record<string, unknown>;
}

export interface JourneyConfiguration {
  destination: string;
  origin: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  serviceType: string;
  pickup: string;
  dropoff: string;
  pickupTime: string;
  luggage: number;
  driverAge: number;
  cabinClass: string;
  roomType: string;
  boardBasis: string;
  timeSlot: string;
  language: string;
  cabinType: string;
  travellerAges: string;
  residenceCountry: string;
  citizenshipCountry: string;
  purpose: string;
  tripType: string;
  durationDays?: number;
  packageStyle?: string;
  accommodationTier?: string;
  vehicleCategory?: string;
  ticketType?: string;
  departurePort?: string;
  coverageOption?: string;
  returnTime?: string;
  acceptedPriceMinor?: number;
  optionId?: string;
}

export interface JourneyProductDefinition {
  productType: TravelProductSlug;
  route: string;
  label: string;
  eyebrow: string;
  description: string;
  image: string;
}

export const JOURNEY_PRODUCTS: JourneyProductDefinition[] = [
  { productType: 'flights', route: '/flights', label: 'Flights', eyebrow: 'Your journey starts with a choice', description: 'Search your route, compare current flight options, and review the fare conditions before adding a configured flight to your trip.', image: '/public/cards/flight-dubai.webp' },
  { productType: 'hotels', route: '/hotels', label: 'Hotels', eyebrow: 'Find your place to pause', description: 'Compare accommodation for your dates and guests, with published room details, meal plans, and cancellation conditions.', image: '/public/cards/hotel-maldives.webp' },
  { productType: 'visa', route: '/visa-assistance', label: 'Visa Assistance', eyebrow: 'Prepare for the journey ahead', description: 'Find assistance for your destination, nationality, and travel purpose. Review the document checklist and service conditions before proceeding.', image: '/public/cards/visa-uae.webp' },
  { productType: 'packages', route: '/holiday-packages', label: 'Holiday Packages', eyebrow: 'A journey, thoughtfully connected', description: 'Compare itineraries, understand what is included, and shape a holiday around your dates and travel party.', image: '/public/cards/package-maldives.webp' },
  { productType: 'cars', route: '/cars-transfers', label: 'Cars & Transfers', eyebrow: 'The next leg, taken care of', description: 'Plan airport transfers and car hire with clear pickup details, vehicle requirements, and booking conditions.', image: '/public/cards/transfer-dubai.webp' },
  { productType: 'activities', route: '/activities', label: 'Activities', eyebrow: 'Make time for something memorable', description: 'Find experiences for your destination and dates, then choose the right session and participant options.', image: '/public/cards/activity-desert-safari.webp' },
  { productType: 'sightseeing', route: '/sightseeing-tours', label: 'Sightseeing Tours', eyebrow: 'See more of the place you came for', description: 'Explore guided routes, departure points, languages, and inclusions before choosing your tour.', image: '/public/cards/sightseeing-london.webp' },
  { productType: 'rails', route: '/rails', label: 'Rail Journeys', eyebrow: 'Let the journey become the destination', description: 'Search station-to-station journeys and compare the published class, schedule, and fare conditions.', image: '/public/cards/rail-swiss-alps.webp' },
  { productType: 'cruises', route: '/cruises', label: 'Cruises & Sea Voyages', eyebrow: 'A different horizon, every day', description: 'Compare published sailings and cabin options with clear itinerary, inclusion, and confirmation details.', image: '/public/cards/cruise-mediterranean.webp' },
  { productType: 'insurance', route: '/travel-insurance', label: 'Travel Insurance', eyebrow: 'Understand your protection', description: 'Compare available policy information and eligibility requirements. Read the actual terms before requesting cover.', image: '/public/cards/insurance-family.webp' }
];

export function findJourneyProduct(pathOrProduct: string): JourneyProductDefinition | undefined {
  return JOURNEY_PRODUCTS.find(p => p.productType === pathOrProduct || pathOrProduct === p.route || pathOrProduct.startsWith(p.route + '/'));
}

export function journeyConfigurationFromQuery(query: URLSearchParams): JourneyConfiguration {
  const number = (key: string, fallback: number) => {
    const parsed = Number(query.get(key));
    return query.has(key) && Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    destination: query.get('destination') || query.get('to') || query.get('country') || query.get('region') || '',
    origin: query.get('origin') || query.get('from') || '',
    departureDate: query.get('departureDate') || query.get('dep') || query.get('date') || query.get('checkIn') || query.get('checkin') || '',
    returnDate: query.get('returnDate') || query.get('ret') || query.get('checkOut') || query.get('checkout') || '',
    adults: number('adults', 1), children: number('children', 0), infants: number('infants', 0), rooms: number('rooms', 1),
    serviceType: query.get('serviceType') || query.get('service') || 'transfer',
    pickup: query.get('pickup') || query.get('pickupLocation') || '',
    dropoff: query.get('dropoff') || query.get('dropoffLocation') || '',
    pickupTime: query.get('pickupTime') || '', luggage: number('luggage', 1), driverAge: number('driverAge', 25),
    cabinClass: query.get('cabinClass') || query.get('cabin') || 'economy',
    roomType: query.get('roomType') || '', boardBasis: query.get('boardBasis') || '',
    timeSlot: query.get('timeSlot') || '', language: query.get('language') || '', cabinType: query.get('cabinType') || '',
    travellerAges: query.get('travellerAges') || '', residenceCountry: query.get('residenceCountry') || query.get('residence') || '',
    citizenshipCountry: query.get('citizenshipCountry') || query.get('citizenship') || '', purpose: query.get('purpose') || 'tourism',
    tripType: (query.get('tripType') || 'round_trip').replace(/-/g, '_')
    , durationDays: number('durationDays', 0), packageStyle: query.get('packageStyle') || '', accommodationTier: query.get('accommodationTier') || '',
    vehicleCategory: query.get('vehicleCategory') || '', ticketType: query.get('ticketType') || '', departurePort: query.get('departurePort') || '', coverageOption: query.get('coverageOption') || '', optionId: query.get('optionId') || '', returnTime: query.get('returnTime') || ''
  };
}

export function isJourneyDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** All mandatory inputs are checked before any real offer is staged. */
export function validateJourneyConfiguration(product: TravelProductSlug, config: JourneyConfiguration, detail = false): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!config.destination.trim()) errors.destination = 'Enter your destination.';
  if (!isJourneyDate(config.departureDate)) errors.departureDate = 'Choose a valid travel date.';
  else if (config.departureDate < new Date().toISOString().slice(0, 10)) errors.departureDate = 'Choose a future travel date.';
  if (![config.adults, config.children, config.infants].every(Number.isInteger) || config.adults < 1 || config.children < 0 || config.infants < 0 || config.adults + config.children + config.infants > 9 || config.infants > config.adults) {
    errors.adults = 'Choose 1–9 travellers, including at least one adult and no more infants than adults.';
  }
  if (['packages', 'hotels', 'insurance'].includes(product) || (product === 'flights' && config.tripType === 'round_trip') || (product === 'cars' && config.serviceType === 'car-hire')) {
    if (!isJourneyDate(config.returnDate) || config.returnDate <= config.departureDate) errors.returnDate = 'Choose an end date after your travel date.';
  }
  if (['packages', 'hotels'].includes(product) && (!Number.isInteger(config.rooms) || config.rooms < 1 || config.rooms > 9)) errors.rooms = 'Choose 1–9 rooms.';
  if (product === 'cars') {
    if (!['transfer', 'car-hire'].includes(config.serviceType)) errors.serviceType = 'Choose transfer or car hire.';
    if (!config.pickup.trim()) errors.pickup = 'Enter a pickup location.';
    if (!config.dropoff.trim()) errors.dropoff = 'Enter a drop-off or return location.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.pickupTime)) errors.pickupTime = 'Choose your pickup time.';
    if (!Number.isInteger(config.luggage) || config.luggage < 0 || config.luggage > 20) errors.luggage = 'Choose a luggage count from 0 to 20.';
    if (config.serviceType === 'car-hire' && (!Number.isInteger(config.driverAge) || config.driverAge < 18 || config.driverAge > 100)) errors.driverAge = 'Enter the lead driver’s age (18–100). Supplier eligibility still applies.';
    if (detail && config.tripType === 'round_trip' && config.serviceType === 'transfer') {
      if (!isJourneyDate(config.returnDate) || config.returnDate < config.departureDate) errors.returnDate = 'Choose a valid return transfer date.';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.returnTime || '')) errors.returnTime = 'Choose the return pickup time.';
    }
  }
  if (product === 'rails') {
    if (!config.origin.trim()) errors.origin = 'Enter your departure station.';
    if (config.origin.trim().toLowerCase() === config.destination.trim().toLowerCase()) errors.destination = 'Choose different departure and arrival stations.';
    if (!['standard', 'first'].includes(config.cabinClass)) errors.cabinClass = 'Choose a published class preference.';
  }
  if (product === 'flights') {
    if (!config.origin.trim()) errors.origin = 'Enter your departure airport.';
    if (!['one_way', 'round_trip'].includes(config.tripType)) errors.tripType = 'Choose a one-way or return journey. For multiple cities, search each leg separately.';
    if (config.origin.trim().toLowerCase() === config.destination.trim().toLowerCase()) errors.destination = 'Choose different departure and arrival airports.';
  }
  if (product === 'visa') {
    if (!config.citizenshipCountry.trim()) errors.citizenshipCountry = 'Enter your passport nationality.';
    if (!config.residenceCountry.trim()) errors.residenceCountry = 'Enter your country of residence.';
    if (!config.purpose.trim()) errors.purpose = 'Choose your travel purpose.';
  }
  if (detail && ['activities', 'sightseeing'].includes(product) && !config.timeSlot) errors.timeSlot = 'Select an available session.';
  if (detail && product === 'cruises' && !config.cabinType) errors.cabinType = 'Select a published cabin category.';
  if (product === 'cruises' && !config.departurePort?.trim()) errors.departurePort = 'Enter a preferred departure port for operator review.';
  if (product === 'insurance') {
    const ages = config.travellerAges.split(',').map(v => v.trim()).filter(Boolean);
    if (ages.length !== config.adults + config.children + config.infants || ages.some(v => !/^\d{1,3}$/.test(v) || Number(v) > 120)) errors.travellerAges = 'Enter one age for every traveller, separated by commas.';
    if (!/^[A-Za-z]{2}$/.test(config.residenceCountry)) errors.residenceCountry = 'Enter your two-letter country of residence.';
  }
  return errors;
}

export function journeyOfferId(offer: JourneyOffer): string { return offer.canonicalOfferId || offer.offerId; }

export function journeyProductDetails(offer: JourneyOffer): Record<string, unknown> {
  const extension = offer.productExtension || {};
  const keys: Record<string, string> = { flights: 'flight', hotels: 'hotel', visa: 'visa', packages: 'package', cars: 'car', activities: 'activity', sightseeing: 'sightseeing', rails: 'rail', cruises: 'cruise', insurance: 'insurance' };
  const nested = extension[keys[offer.productType]];
  return { ...extension, ...(nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : {}) };
}

export function journeyOfferAmount(offer: JourneyOffer): number {
  const amount = offer.pricing ? offer.pricing.finalSellingPriceMinor / 100 : (offer.sellingPrice ?? offer.price);
  return Number.isFinite(amount) && amount! >= 0 ? amount! : 0;
}

export function journeyMoney(amount: number, currency = 'LKR'): string {
  try { return new Intl.NumberFormat('en-LK', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export function journeyEscape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export interface BundleReadinessItem { id: string; productType: string; state: string; configuration?: Record<string, unknown> }

/** Presence alone is insufficient: every selected vertical needs a configured Ready item. */
export function evaluateBundleReadiness(products: string[], items: BundleReadinessItem[], journey: Pick<JourneyConfiguration, 'departureDate' | 'returnDate' | 'adults' | 'children' | 'infants'>): { ready: boolean; missing: string[]; conflicts: string[] } {
  const missing: string[] = [];
  const conflicts: string[] = [];
  for (const product of [...new Set(products)]) {
    const candidates = items.filter(item => item.productType === product && item.state.toLowerCase() === 'ready');
    if (!candidates.length) { missing.push(product); continue; }
    const matching = candidates.some(item => {
      const c = item.configuration || {};
      const start = String(c.departureDate || c.checkIn || c.checkin || c.pickupDate || '');
      const end = String(c.returnDate || c.checkOut || c.checkout || '');
      const pax = c.travellers as Record<string, unknown> | undefined;
      const adults = Number(c.adults ?? pax?.adults);
      const children = Number(c.children ?? pax?.children ?? 0);
      const infants = Number(c.infants ?? pax?.infants ?? 0);
      if (!isJourneyDate(start) || !Number.isFinite(adults)) return false;
      const inside = start >= journey.departureDate && (!journey.returnDate || start <= journey.returnDate);
      const fullSpan = !['flights', 'hotels', 'packages'].includes(product) || (start === journey.departureDate && end === journey.returnDate);
      return inside && fullSpan && adults === journey.adults && children === journey.children && infants === journey.infants;
    });
    if (!matching) conflicts.push(product);
  }
  return { ready: products.length >= 2 && !missing.length && !conflicts.length, missing, conflicts };
}
