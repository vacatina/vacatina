/* ============================================================================
 * Vacatina Canonical Mock Data Catalog
 * Authorities:
 * - 02_Vacatina_Antigravity_Correction_Pass_v2.md (P0 #4, #5 & P1 #8, #11, #12)
 * - Safe prototype terminology: No false LIVE / VERIFIED / HOLD claims.
 * - Standards-based Intl.NumberFormat currency conversion with PROTOTYPE FX.
 * ============================================================================ */

import type {
  ConfigurableProductOption,
  HolidayPackageDetailData,
  SupportedCurrency,
  TravelProductSlug,
  TripBucketCandidate
} from '../domain/types.ts';

/**
 * Default 3-item Trip Bucket Baseline (Screen 03 & Screen 04 baseline):
 * - Flight (Ready): LKR 248,500
 * - Hotel (Ready):  LKR 256,500
 * - Visa (Needs Action): LKR 45,000 (Excluded from Ready estimate)
 * Ready Items Estimate = LKR 505,000
 */
export const CANONICAL_TRIP_BUCKET_BASELINE: TripBucketCandidate[] = [
  {
    id: 'tb-flight-cmb-lhr',
    productType: 'flights',
    productLabel: 'Flight',
    title: 'CMB → LHR (Return)',
    subtitle: 'SriLankan Airlines · Direct · Economy Classic',
    dateSummary: '12 Nov – 27 Nov 2026',
    travellerSummary: '1 Adult · Economy',
    state: 'ready',
    priceLkr: 248500,
    holdStatusText: 'Sample rate · refresh before booking',
    primaryActionLabel: 'Modify Flight',
    supplierName: 'Direct Airline Tariff (Prototype)',
    integrationMode: 'ADAPTER-READY',
    offerId: 'vct-fl-api-duffel-cmb-lhr-001',
    sourceType: 'API',
    confirmationMode: 'INSTANT_CONFIRM',
    rawSupplierPrice: 232000,
    supplierBaseCurrency: 'LKR',
    markupAmountLkr: 16500
  },
  {
    id: 'tb-hotel-london-deluxe',
    productType: 'hotels',
    productLabel: 'Hotel',
    title: 'London Deluxe King Room',
    subtitle: '7 Nights · Central London · Breakfast Included',
    dateSummary: '13 Nov – 20 Nov 2026',
    travellerSummary: '1 Room · 2 Adults',
    state: 'ready',
    priceLkr: 256500,
    holdStatusText: 'Indicative room rate · revalidation required',
    primaryActionLabel: 'Change Room',
    supplierName: 'Hotel Partner Rate (Prototype)',
    integrationMode: 'ADAPTER-READY',
    offerId: 'vct-ht-api-liteapi-lon-001',
    sourceType: 'API',
    confirmationMode: 'INSTANT_CONFIRM',
    rawSupplierPrice: 228000,
    supplierBaseCurrency: 'LKR',
    markupAmountLkr: 28500
  },
  {
    id: 'tb-visa-uk-standard',
    productType: 'visa',
    productLabel: 'Visa Assistance',
    title: 'United Kingdom Standard Visitor',
    subtitle: 'Document checklist & consular appointment guidance',
    dateSummary: 'Target departure: 12 Nov 2026',
    travellerSummary: '1 Applicant · Sri Lanka Passport',
    state: 'needs_action',
    priceLkr: 45000,
    actionRequiredText: 'Action required: Provide passport details & travel dates to include in Ready estimate.',
    primaryActionLabel: 'Complete Details',
    supplierName: 'Consular Advisory Desk (Prototype)',
    integrationMode: 'ADAPTER-READY',
    offerId: 'vct-vs-manual-uk-standard-001',
    sourceType: 'MANUAL',
    confirmationMode: 'ASSISTED_SERVICE',
    rawSupplierPrice: 38000,
    supplierBaseCurrency: 'LKR',
    markupAmountLkr: 7000
  }
];

/**
 * All 8 Canonical Trip Bucket Component States (Screen 04 v1.2 Reference Engine).
 * Uses truthful prototype wording without unverified live assertions.
 */
export const SCREEN_04_CANONICAL_STATES: TripBucketCandidate[] = [
  {
    id: 's04-01-draft',
    productType: 'packages',
    productLabel: 'Holiday Package',
    title: 'Maldives 5-Night Island Escape',
    subtitle: 'Overwater Villa · Speedboat Transfer Included',
    dateSummary: 'Dates not selected yet',
    travellerSummary: '2 Adults · Room tier pending',
    state: 'draft',
    priceLkr: 420000,
    actionRequiredText: 'Configuration pending — select dates and room category to calculate indicative rate.',
    primaryActionLabel: 'Complete Selection',
    supplierName: 'Curated Packages (Prototype)',
    integrationMode: 'MOCK'
  },
  {
    id: 's04-02-ready',
    productType: 'flights',
    productLabel: 'Flight',
    title: 'CMB → LHR (Return)',
    subtitle: 'SriLankan Airlines · UL 503 / UL 504 · Direct',
    dateSummary: '12 Nov – 27 Nov 2026',
    travellerSummary: '1 Adult · Economy',
    state: 'ready',
    priceLkr: 248500,
    holdStatusText: 'Sample rate estimate · Included in Ready estimate',
    primaryActionLabel: 'Modify Flight',
    supplierName: 'Direct Airline Tariff (Prototype)',
    integrationMode: 'ADAPTER-READY'
  },
  {
    id: 's04-03-needs-action',
    productType: 'visa',
    productLabel: 'Visa Assistance',
    title: 'United Kingdom Standard Visitor',
    subtitle: 'Consular checklist, fee breakdown & biometric guidance',
    dateSummary: 'Planned travel: Nov 2026',
    travellerSummary: '1 Applicant (LKA)',
    state: 'needs_action',
    priceLkr: 45000,
    actionRequiredText: 'Traveller input pending: Provide document checklist before submission.',
    primaryActionLabel: 'Upload Passport Copy',
    supplierName: 'Consular Advisory Desk (Prototype)',
    integrationMode: 'ADAPTER-READY'
  },
  {
    id: 's04-04-refreshing-price',
    productType: 'hotels',
    productLabel: 'Hotel',
    title: 'London Deluxe King Room',
    subtitle: '7 Nights · Central London · Free Cancellation',
    dateSummary: '13 Nov – 20 Nov 2026',
    travellerSummary: '1 Room · 2 Adults',
    state: 'refreshing_price',
    priceLkr: 256500,
    actionRequiredText: 'Checking current indicative rates with supplier catalog…',
    primaryActionLabel: 'Complete Refresh',
    supplierName: 'Hotel Partner Rate (Prototype)',
    integrationMode: 'ADAPTER-READY'
  },
  {
    id: 's04-05-price-changed',
    productType: 'flights',
    productLabel: 'Flight',
    title: 'Colombo (CMB) → Dubai (DXB)',
    subtitle: 'Emirates · EK 651 · Direct · 4h 30m',
    dateSummary: '15 Dec – 20 Dec 2026',
    travellerSummary: '2 Adults · Economy',
    state: 'price_changed',
    priceLkr: 154500,
    previousPriceLkr: 145000,
    actionRequiredText: 'Indicative rate updated (+LKR 9,500). Explicit traveller acceptance required.',
    primaryActionLabel: 'Accept Updated Price',
    supplierName: 'Direct Airline Tariff (Prototype)',
    integrationMode: 'ADAPTER-READY'
  },
  {
    id: 's04-06-recheck-required',
    productType: 'cars',
    productLabel: 'Cars & Transfers',
    title: 'Heathrow Airport (LHR) Executive Chauffeur',
    subtitle: 'Executive Sedan · Flight monitoring & wait window',
    dateSummary: '12 Nov 2026 · 14:30',
    travellerSummary: '2 Passengers · 2 Large Bags',
    state: 'recheck_required',
    priceLkr: 34500,
    actionRequiredText: 'Rate hold window elapsed. Recheck required to verify updated allocation.',
    primaryActionLabel: 'Recheck Availability',
    supplierName: 'Airport Chauffeur Network (Prototype)',
    integrationMode: 'ADAPTER-READY'
  },
  {
    id: 's04-07-offer-expired',
    productType: 'cruises',
    productLabel: 'Cruises',
    title: 'Arabian Gulf 7-Night Ocean Voyage',
    subtitle: 'Dubai · Abu Dhabi · Sir Bani Yas · Doha',
    dateSummary: '18 Jan – 25 Jan 2027',
    travellerSummary: '2 Adults · Balcony Stateroom',
    state: 'offer_expired',
    priceLkr: 340000,
    actionRequiredText: 'Sample promotional fare expired. Select current cabin rate or alternative date.',
    primaryActionLabel: 'Select Updated Cabin Rate',
    supplierName: 'Cruise Inventory (Prototype)',
    integrationMode: 'MOCK'
  },
  {
    id: 's04-08-unavailable',
    productType: 'rails',
    productLabel: 'Rails',
    title: 'London St Pancras → Paris Gare du Nord',
    subtitle: 'Eurostar High-Speed · 09:31 Departure',
    dateSummary: '18 Nov 2026',
    travellerSummary: '2 Adults · Standard Premier',
    state: 'unavailable',
    priceLkr: 38500,
    actionRequiredText: 'Selected departure allocation full. Switch to alternative departure time.',
    primaryActionLabel: 'Switch to 10:24 Departure',
    supplierName: 'Rail Partner Network (Prototype)',
    integrationMode: 'MOCK'
  }
];

/**
 * Prototype Foreign Exchange (FX) Conversion Rates (MOCK DATA ONLY).
 * Explicitly documented as prototype conversion data per §8.
 */
export const PROTOTYPE_FX_RATES_FROM_LKR: Record<
  SupportedCurrency,
  { symbol: string; name: string; rate: number; decimals: number; suggested?: boolean }
> = {
  LKR: { symbol: 'LKR ', name: 'Sri Lankan Rupee', rate: 1, decimals: 0, suggested: true },
  USD: { symbol: 'USD ', name: 'US Dollar ($)', rate: 1 / 300, decimals: 0, suggested: true },
  AED: { symbol: 'AED ', name: 'UAE Dirham', rate: 1 / 82, decimals: 0, suggested: true },
  EUR: { symbol: 'EUR ', name: 'Euro (€)', rate: 1 / 325, decimals: 0, suggested: true },
  GBP: { symbol: 'GBP ', name: 'British Pound (£)', rate: 1 / 380, decimals: 0, suggested: true },
  SGD: { symbol: 'SGD ', name: 'Singapore Dollar (S$)', rate: 1 / 222, decimals: 0 },
  AUD: { symbol: 'AUD ', name: 'Australian Dollar (A$)', rate: 1 / 196, decimals: 0 },
  INR: { symbol: 'INR ', name: 'Indian Rupee (₹)', rate: 1 / 3.6, decimals: 0 },
  SAR: { symbol: 'SAR ', name: 'Saudi Riyal', rate: 1 / 80, decimals: 0 },
  JPY: { symbol: 'JPY ', name: 'Japanese Yen (¥)', rate: 1 / 2.0, decimals: 0 },
  CHF: { symbol: 'CHF ', name: 'Swiss Franc', rate: 1 / 340, decimals: 0 },
  CAD: { symbol: 'CAD ', name: 'Canadian Dollar (C$)', rate: 1 / 218, decimals: 0 }
};

export const CURRENCY_RATES_FROM_LKR = PROTOTYPE_FX_RATES_FROM_LKR;

export const CANONICAL_EXCHANGE_RATES_TO_LKR: Record<SupportedCurrency, number> = {
  LKR: 1,
  USD: 300,
  AED: 82,
  EUR: 325,
  GBP: 380,
  SGD: 222,
  AUD: 196,
  INR: 3.6,
  SAR: 80,
  JPY: 2.0,
  CHF: 340,
  CAD: 218
};

export function formatCurrencyAmount(
  amountLkr: number,
  currency: SupportedCurrency = 'LKR',
  langCode: string = 'en'
): string {
  const cfg = PROTOTYPE_FX_RATES_FROM_LKR[currency] || PROTOTYPE_FX_RATES_FROM_LKR.LKR;
  const converted = Math.round(amountLkr * cfg.rate);
  const localeTag = langCode === 'si' ? 'si-LK' : langCode === 'ta' ? 'ta-LK' : 'en-US';

  try {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: currency === 'LKR' ? 'LKR' : currency,
      maximumFractionDigits: 0
    }).format(converted);
  } catch {
    return `${cfg.symbol}${converted.toLocaleString('en-US')}`;
  }
}

/**
 * Sanitized Holiday Package Details: Removed unverified contractual promises (§11).
 */
export const HOLIDAY_PACKAGE_DETAILS: Record<string, HolidayPackageDetailData> = {
  'Maldives Escape': {
    id: 'pkg-maldives-escape',
    title: 'Maldives Escape',
    destination: 'North Malé Atoll, Maldives',
    duration: '5 Days / 4 Nights',
    priceDisplay: 'LKR 420,000*',
    priceLkr: 420000,
    highlights: [
      '4 Nights in curated resort accommodation',
      'Return speedboat transfer coordination from Velana International (MLE)',
      'Half-board dining plan (Breakfast & Dinner)',
      'Island excursion and lagoon leisure window'
    ],
    inclusions: [
      'Return economy airfare Colombo (CMB) ↔ Malé (MLE)',
      '4 nights resort stay with breakfast and dinner',
      'Local transfer coordination'
    ],
    exclusions: [
      'Personal water sports and equipment hire',
      'Optional travel protection'
    ],
    itinerary: [
      { day: 'Day 1', title: 'Arrival & Resort Transfer', summary: 'Arrival at MLE and speedboat transfer to resort.' },
      { day: 'Day 2', title: 'Lagoon & Island Discovery', summary: 'Leisure day with access to resort facilities.' },
      { day: 'Day 3', title: 'Curated Island Excursion', summary: 'Guided island excursion window.' },
      { day: 'Day 4', title: 'Coastal Relaxation', summary: 'Day at leisure for dining and wellness.' },
      { day: 'Day 5', title: 'Return Transfer', summary: 'Speedboat return transfer for flight departure.' }
    ]
  },
  'Dubai City Escape': {
    id: 'pkg-dubai-city-escape',
    title: 'Dubai City Escape',
    destination: 'Dubai, United Arab Emirates',
    duration: '4 Days / 3 Nights',
    priceDisplay: 'LKR 310,000*',
    priceLkr: 310000,
    highlights: [
      '3 Nights at a selected central hotel with daily breakfast',
      'Airport transfer coordination',
      'Burj Khalifa observation deck admission ticket',
      'Desert excursion and dinner experience'
    ],
    inclusions: [
      'Return airfare CMB ↔ DXB + hotel stay with breakfast',
      'Airport pickup & return transfer',
      'Desert excursion ticket'
    ],
    exclusions: [
      'UAE visa processing fee (configurable in Visa tab)',
      'Local municipal tourist fees payable at hotel'
    ],
    itinerary: [
      { day: 'Day 1', title: 'Arrival & Check-in', summary: 'Arrival at DXB and transfer to hotel.' },
      { day: 'Day 2', title: 'City Highlights & Observation Deck', summary: 'Landmark sightseeing and observation ticket.' },
      { day: 'Day 3', title: 'Desert Experience', summary: 'Afternoon desert tour with dinner.' },
      { day: 'Day 4', title: 'Departure', summary: 'Transfer to DXB for departure flight.' }
    ]
  },
  'Bali Island Journey': {
    id: 'pkg-bali-island-journey',
    title: 'Bali Island Journey',
    destination: 'Ubud & Seminyak, Bali, Indonesia',
    duration: '6 Days / 5 Nights',
    priceDisplay: 'LKR 285,000*',
    priceLkr: 285000,
    highlights: [
      'Split-stay accommodation with daily breakfast',
      'Private driver coordination for cultural route',
      'Rice terrace and temple excursion',
      'Traditional culinary introduction'
    ],
    inclusions: [
      '5 nights curated accommodation',
      'Inter-hotel and airport transfers',
      'Temple admission passes'
    ],
    exclusions: [
      'Entry visa and regional tourist levy',
      'Personal travel insurance'
    ],
    itinerary: [
      { day: 'Day 1', title: 'Arrival in Denpasar', summary: 'Arrival and transfer to Ubud.' },
      { day: 'Day 2', title: 'Highland Trail', summary: 'Guided scenic countryside tour.' },
      { day: 'Day 3', title: 'Culinary Workshop', summary: 'Local culinary experience.' },
      { day: 'Day 4', title: 'Coastal Transfer', summary: 'Transfer to Seminyak.' },
      { day: 'Day 5', title: 'Sunset Temple', summary: 'Uluwatu temple visit.' },
      { day: 'Day 6', title: 'Departure Transfer', summary: 'Airport drop-off.' }
    ]
  },
  'Thailand Discovery': {
    id: 'pkg-thailand-discovery',
    title: 'Thailand Discovery',
    destination: 'Bangkok & Phuket, Thailand',
    duration: '6 Days / 5 Nights',
    priceDisplay: 'LKR 260,000*',
    priceLkr: 260000,
    highlights: [
      '2 Nights Bangkok + 3 Nights Phuket accommodation',
      'Bangkok heritage orientation',
      'Island tour experience in Phuket',
      'Domestic flight connection included'
    ],
    inclusions: [
      '5 nights accommodation with breakfast',
      'Domestic flight Bangkok ↔ Phuket',
      'Airport transfer services'
    ],
    exclusions: [
      'Consular visa fees where applicable',
      'Optional personal excursions'
    ],
    itinerary: [
      { day: 'Day 1', title: 'Bangkok Arrival', summary: 'Transfer to Bangkok hotel.' },
      { day: 'Day 2', title: 'City Cultural Tour', summary: 'Historic temple visit.' },
      { day: 'Day 3', title: 'Fly to Phuket', summary: 'Flight to Phuket and check-in.' },
      { day: 'Day 4', title: 'Island Excursion', summary: 'Day excursion by boat.' },
      { day: 'Day 5', title: 'Phuket Leisure', summary: 'Free day in Phuket.' },
      { day: 'Day 6', title: 'Phuket Departure', summary: 'Transfer to airport.' }
    ]
  }
};

/**
 * Sanitized Product Catalog: Neutral prototype copy without false live claims (§12).
 */
export const CONFIGURABLE_PRODUCT_CATALOG: Record<TravelProductSlug, ConfigurableProductOption[]> = {
  flights: [
    {
      id: 'cfg-flight-dxb',
      productType: 'flights',
      productLabel: 'Flight',
      title: 'Colombo (CMB) ↔ Dubai (DXB)',
      destination: 'Dubai (DXB)',
      subtitle: 'Emirates / SriLankan Airlines · Direct · 4h 30m',
      defaultDateRange: '12 Nov – 19 Nov 2026',
      basePriceLkr: 145000,
      supplierName: 'Direct Airline Tariff (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'eco-light', label: 'Economy Standard (Standard Baggage Allowance)', description: 'Indicative fare · Revalidation required before booking', priceDeltaLkr: 0 },
        { id: 'eco-flex', label: 'Economy Flexible (Change Flexibility)', description: 'Flexible rebooking conditions', priceDeltaLkr: 28000 },
        { id: 'biz-class', label: 'Business Cabin (Priority Allocation)', description: 'Premium seating and check-in priority', priceDeltaLkr: 195000 }
      ]
    },
    {
      id: 'cfg-flight-mle',
      productType: 'flights',
      productLabel: 'Flight',
      title: 'Colombo (CMB) ↔ Malé (MLE)',
      destination: 'Malé (MLE), Maldives',
      subtitle: 'SriLankan Airlines · Direct · 1h 25m',
      defaultDateRange: '05 Dec – 10 Dec 2026',
      basePriceLkr: 98500,
      supplierName: 'Direct Airline Tariff (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'eco-std', label: 'Economy Standard (Standard Allowance)', description: 'Scheduled daily connections', priceDeltaLkr: 0 },
        { id: 'eco-flex', label: 'Economy Flexible', description: 'Rebooking flexibility', priceDeltaLkr: 18500 }
      ]
    },
    {
      id: 'cfg-flight-bkk',
      productType: 'flights',
      productLabel: 'Flight',
      title: 'Colombo (CMB) ↔ Bangkok (BKK)',
      destination: 'Bangkok (BKK), Thailand',
      subtitle: 'Thai Airways / SriLankan Airlines · Direct · 3h 35m',
      defaultDateRange: '18 Nov – 24 Nov 2026',
      basePriceLkr: 128000,
      supplierName: 'Direct Airline Tariff (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'eco-std', label: 'Economy Standard', description: 'Direct scheduled flight', priceDeltaLkr: 0 },
        { id: 'eco-flex', label: 'Economy Flexible', description: 'Flexible fare conditions', priceDeltaLkr: 22000 }
      ]
    },
    {
      id: 'cfg-flight-lhr',
      productType: 'flights',
      productLabel: 'Flight',
      title: 'Colombo (CMB) ↔ London Heathrow (LHR)',
      destination: 'London (LHR), United Kingdom',
      subtitle: 'SriLankan Airlines UL 503 · Direct · 11h 30m',
      defaultDateRange: '12 Nov – 27 Nov 2026',
      basePriceLkr: 248500,
      supplierName: 'Direct Airline Tariff (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'eco-classic', label: 'Economy Classic (Standard Baggage)', description: 'Direct long-haul schedule', priceDeltaLkr: 0 },
        { id: 'eco-flex', label: 'Economy Flexible', description: 'Flexible return dates', priceDeltaLkr: 42000 }
      ]
    }
  ],
  hotels: [
    {
      id: 'cfg-hotel-maldives',
      productType: 'hotels',
      productLabel: 'Hotel',
      title: 'Ocean Lagoon Resort',
      destination: 'Maldives',
      subtitle: 'North Malé Atoll · Island Resort',
      defaultDateRange: '05 Dec – 09 Dec 2026 (4 Nights)',
      basePriceLkr: 110000,
      supplierName: 'Hotel Partner Rate (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'beach-villa-bb', label: 'Beachfront Villa · Bed & Breakfast', description: 'Indicative room tariff', priceDeltaLkr: 0 },
        { id: 'water-villa-hb', label: 'Lagoon Villa · Half Board', description: 'Includes breakfast and dinner', priceDeltaLkr: 45000 }
      ]
    },
    {
      id: 'cfg-hotel-dubai',
      productType: 'hotels',
      productLabel: 'Hotel',
      title: 'Grand City Hotel Downtown',
      destination: 'Dubai, UAE',
      subtitle: 'Downtown Dubai location',
      defaultDateRange: '12 Nov – 16 Nov 2026 (4 Nights)',
      basePriceLkr: 64000,
      supplierName: 'Hotel Partner Rate (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'deluxe-king', label: 'Deluxe City View · Breakfast Included', description: 'Standard room tier', priceDeltaLkr: 0 },
        { id: 'fountain-suite', label: 'Executive Suite', description: 'Upgraded room tier', priceDeltaLkr: 32000 }
      ]
    }
  ],
  visa: [
    {
      id: 'cfg-visa-uae',
      productType: 'visa',
      productLabel: 'Visa Assistance',
      title: 'UAE 30-Day Tourist e-Visa Assistance',
      destination: 'United Arab Emirates',
      subtitle: 'Document verification and application guidance',
      defaultDateRange: 'Planned entry: Nov / Dec 2026',
      basePriceLkr: 32500,
      supplierName: 'Consular Advisory Desk (Prototype)',
      initialBucketState: 'needs_action',
      actionHint: 'Upload passport copy in Trip Bucket to complete advisory checklist.',
      tiers: [
        { id: 'uae-30-single', label: '30-Day Single Entry Advisory', description: 'Consular fee breakdown and document review', priceDeltaLkr: 0 },
        { id: 'uae-60-multi', label: '60-Day Multiple Entry Advisory', description: 'Extended travel guidance', priceDeltaLkr: 26000 }
      ]
    },
    {
      id: 'cfg-visa-uk',
      productType: 'visa',
      productLabel: 'Visa Assistance',
      title: 'United Kingdom Standard Visitor Visa Desk',
      destination: 'United Kingdom',
      subtitle: 'Documentary checklist and application guidance',
      defaultDateRange: 'Planned entry: Nov 2026',
      basePriceLkr: 45000,
      supplierName: 'Consular Advisory Desk (Prototype)',
      initialBucketState: 'needs_action',
      actionHint: 'Provide applicant passport and employment details.',
      tiers: [
        { id: 'uk-6m-std', label: '6-Month Standard Visitor Advisory', description: 'Document checklist and submission guidelines', priceDeltaLkr: 0 }
      ]
    }
  ],
  packages: [
    {
      id: 'cfg-pkg-maldives',
      productType: 'packages',
      productLabel: 'Holiday Package',
      title: 'Maldives Escape (5 Days / 4 Nights)',
      destination: 'Maldives',
      subtitle: 'Flights + Resort Stay + Transfer Guidance',
      defaultDateRange: '05 Dec – 09 Dec 2026',
      basePriceLkr: 420000,
      supplierName: 'Curated Packages (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'pkg-std', label: 'Standard Package', description: 'Includes return flights and resort stay', priceDeltaLkr: 0 },
        { id: 'pkg-premium', label: 'Upgraded Villa Package', description: 'Upgraded room category', priceDeltaLkr: 95000 }
      ]
    }
  ],
  cars: [
    {
      id: 'cfg-car-dxb-transfer',
      productType: 'cars',
      productLabel: 'Cars & Transfers',
      title: 'Dubai International Airport (DXB) Private Transfer',
      destination: 'Dubai (DXB)',
      subtitle: 'Airport to hotel transfer coordination',
      defaultDateRange: '12 Nov 2026 · 14:30',
      basePriceLkr: 16500,
      supplierName: 'Airport Chauffeur Network (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'exec-sedan', label: 'Executive Sedan (Up to 3 Passengers)', description: 'Standard luggage capacity', priceDeltaLkr: 0 },
        { id: 'luxury-suv', label: 'SUV Transfer (Up to 6 Passengers)', description: 'Spacious family capacity', priceDeltaLkr: 9500 }
      ]
    }
  ],
  rails: [
    {
      id: 'cfg-rail-eurostar',
      productType: 'rails',
      productLabel: 'Rails',
      title: 'London St Pancras → Paris Gare du Nord (Eurostar)',
      destination: 'London to Paris',
      subtitle: 'City-center rail connection · 2h 16m',
      defaultDateRange: '18 Nov 2026 · 10:24 Departure',
      basePriceLkr: 38500,
      supplierName: 'Rail Partner Network (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'rail-std', label: 'Standard Class', description: 'Reserved seating', priceDeltaLkr: 0 },
        { id: 'rail-premier', label: 'Standard Premier', description: 'Extra legroom seat', priceDeltaLkr: 16000 }
      ]
    }
  ],
  cruises: [
    {
      id: 'cfg-cruise-gulf',
      productType: 'cruises',
      productLabel: 'Cruises',
      title: 'Arabian Gulf 7-Night Cruise Itinerary',
      destination: 'Arabian Gulf',
      subtitle: 'Dubai · Abu Dhabi · Sir Bani Yas · Doha',
      defaultDateRange: '18 Jan – 25 Jan 2027 (7 Nights)',
      basePriceLkr: 340000,
      supplierName: 'Cruise Inventory (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'oceanview', label: 'Oceanview Stateroom', description: 'Standard stateroom rate', priceDeltaLkr: 0 },
        { id: 'balcony', label: 'Balcony Stateroom', description: 'Private veranda stateroom', priceDeltaLkr: 65000 }
      ]
    }
  ],
  activities: [
    {
      id: 'cfg-act-desert-safari',
      productType: 'activities',
      productLabel: 'Activities',
      title: 'Dubai Desert Tour & Heritage Experience',
      destination: 'Dubai, UAE',
      subtitle: 'Afternoon desert tour with dinner experience',
      defaultDateRange: '15 Nov 2026 · 15:00 Pickup',
      basePriceLkr: 24500,
      supplierName: 'Experiences Network (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'shared-4x4', label: 'Standard Shared Tour', description: 'Hotel pickup included', priceDeltaLkr: 0 },
        { id: 'private-4x4', label: 'Private Vehicle Option', description: 'Exclusive vehicle for your group', priceDeltaLkr: 38000 }
      ]
    }
  ],
  sightseeing: [
    {
      id: 'cfg-tour-dubai-sky',
      productType: 'sightseeing',
      productLabel: 'Sightseeing Tours',
      title: 'Dubai City Highlights & Observation Deck',
      destination: 'Dubai, United Arab Emirates',
      subtitle: 'Guided tour and admission pass',
      defaultDateRange: '16 Nov 2026 · 09:00 Start',
      basePriceLkr: 31000,
      supplierName: 'Sightseeing Network (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'group-124', label: 'Group Tour + Standard Observation Deck', description: 'Timed admission entry', priceDeltaLkr: 0 }
      ]
    }
  ],
  insurance: [
    {
      id: 'cfg-ins-comprehensive',
      productType: 'insurance',
      productLabel: 'Travel Insurance',
      title: 'Comprehensive Single-Trip Travel Protection',
      destination: 'Worldwide',
      subtitle: 'Sample policy illustration for medical and cancellation protection',
      defaultDateRange: '12 Nov – 27 Nov 2026 (16 Days)',
      basePriceLkr: 14800,
      supplierName: 'Insurance Partner (Prototype)',
      initialBucketState: 'ready',
      tiers: [
        { id: 'ins-individual', label: 'Individual Plan Illustration', description: 'Sample coverage breakdown', priceDeltaLkr: 0 },
        { id: 'ins-family', label: 'Family Plan Illustration', description: 'Shared cover for family travel', priceDeltaLkr: 16200 }
      ]
    }
  ]
};
