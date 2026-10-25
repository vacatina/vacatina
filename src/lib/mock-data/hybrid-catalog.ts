/* ============================================================================
 * Vacatina Canonical Hybrid Inventory Catalog
 * Authority: Vacatina Hybrid Inventory Strategy v1.0
 *
 * Demonstrates:
 * - 3 Inventory Source Types: API, MANUAL, HYBRID across all 10 products.
 * - 3 Confirmation Modes: INSTANT_CONFIRM, REQUEST_TO_CONFIRM, ASSISTED_SERVICE.
 * - 4-Layer Pricing Preservation: Raw Supplier Cost -> Markup -> Audit Override -> Customer Price.
 * - Canonical IDs: 'vct-fl-api-amadeus-cmb-dxb', 'vct-vs-manual-uae-30d', etc.
 * ============================================================================ */

import type { VacatinaNormalizedOffer } from '../domain/inventory-models.ts';
import { InventoryNormalizerService } from '../services/inventory-normalizer.service.ts';
import { PricingEngineService } from '../services/pricing-engine.service.ts';

export const CANONICAL_HYBRID_CATALOG: VacatinaNormalizedOffer[] = [
  // --------------------------------------------------------------------------
  // 1. FLIGHTS: API Scheduled GDS vs. Manual Charter
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeApiFlight({
    gdsProvider: 'AMADEUS',
    gdsOfferId: 'amd-fl-cmb-dxb-925',
    airlineCode: 'EK',
    airlineName: 'Emirates',
    flightNumber: 'EK 651',
    originIata: 'CMB',
    originCity: 'Colombo',
    destinationIata: 'DXB',
    destinationCity: 'Dubai',
    destinationCountry: 'United Arab Emirates',
    departureDateTimeIso: '2026-11-15T09:55:00Z',
    arrivalDateTimeIso: '2026-11-15T13:00:00Z',
    cabinClass: 'Economy',
    durationMinutes: 275,
    rawFareAmount: 86850,
    fareCurrency: 'LKR',
    instantTicketingEligible: true,
    baggageAllowance: '30kg checked baggage included'
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'manual-charter-flights',
    cmsListingId: 'charter-cmb-mle-airtaxi',
    productType: 'flights',
    partnerSupplierId: 'SRILANKAN_AIRTAXI',
    partnerName: 'SriLankan AirTaxi Charter Operations',
    title: 'Colombo to Maldives Seaplane Charter',
    subtitle: 'Twin Otter Floatplane · Private Lagoon Transfer · On-Demand Departure',
    location: {
      city: 'Male',
      country: 'Maldives',
      countryCode: 'MV',
      iataCode: 'MLE'
    },
    confirmationMode: 'REQUEST_TO_CONFIRM',
    availableQuota: 6,
    contractedBaseCost: 195000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 225000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: ['Direct lagoon water landing', 'Luggage handling up to 25kg per guest', 'VIP lounge access in Colombo'],
    exclusions: ['Overweight baggage beyond 25kg', 'Night flight operations (daylight only)'],
    cancellationPolicy: 'Full refund up to 72 hours prior to scheduled departure time.'
  }),

  // --------------------------------------------------------------------------
  // 2. HOTELS: API GDS/Aggregator vs. Manual Contracted Boutique Resort
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeApiHotel({
    provider: 'LITEAPI',
    providerPropertyId: 'prop-mle-adaaran-vadoo',
    providerRateId: 'rate-deluxe-water-villa-441',
    propertyName: 'Adaaran Prestige Vadoo Maldives',
    city: 'South Male Atoll',
    country: 'Maldives',
    countryCode: 'MV',
    roomType: 'Sunrise Water Villa with Private Jacuzzi',
    boardBasis: 'All Inclusive Dine Around',
    netRateAmount: 229000,
    rateCurrency: 'LKR',
    instantConfirmation: true,
    cancellationDeadlineIso: '2026-11-10T12:00:00Z',
    amenities: ['Overwater villa', 'Private plunge pool', 'Complimentary speedboat transfer', 'All-inclusive meals']
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'contracted-boutique-hotels',
    cmsListingId: 'heritance-kandalama-signature',
    productType: 'hotels',
    partnerSupplierId: 'AITKEN_SPENCE_DIRECT',
    partnerName: 'Heritance Kandalama Direct Contract',
    title: 'Heritance Kandalama Eco-Luxury Resort',
    subtitle: 'Deluxe Lake View Wing · Geoffrey Bawa Architectural Masterpiece',
    location: {
      city: 'Dambulla',
      country: 'Sri Lanka',
      countryCode: 'LK',
      regionHint: 'Cultural Triangle'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 14,
    contractedBaseCost: 65000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 74500,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-03-31T23:59:59Z',
    inclusions: ['Signature buffet breakfast included', 'Infinity pool access overlooking Kandalama reservoir', 'Guided forest nature trail with resident naturalist'],
    exclusions: ['Spa treatments at Six Senses Spa', 'Chauffeur accommodation (available on request)'],
    cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.'
  }),

  // --------------------------------------------------------------------------
  // 3. VISA ASSISTANCE: Manual Consular Service Case (Never Fake Live API)
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'visa-assistance-services',
    cmsListingId: 'uae-30d-tourist-visa',
    productType: 'visa',
    partnerSupplierId: 'VACATINA_CONSULAR_DESK',
    partnerName: 'Vacatina Licensed Consular Desk & Immigration Assistance',
    title: 'United Arab Emirates 30-Day Single Entry Tourist Visa',
    subtitle: 'Complete document audit, official fee settlement & tracking liaison',
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE'
    },
    confirmationMode: 'ASSISTED_SERVICE',
    availableQuota: 999,
    contractedBaseCost: 28500,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 36500,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: [
      'Official GDRFA/ICP consular submission fee included',
      'Pre-submission document verification & translation audit',
      'Digital eVisa delivery with QR-code verification',
      'Mandatory COVID-19 & basic emergency travel medical cover'
    ],
    exclusions: ['Immigration security interview fees (if requested by authority)', 'Overstay fines or express 4-hour rush processing'],
    cancellationPolicy: 'Consular processing fees non-refundable once submitted to official immigration portal.',
    requiresSpecialistReview: true
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'visa-assistance-services',
    cmsListingId: 'uk-standard-visitor-visa',
    productType: 'visa',
    partnerSupplierId: 'VACATINA_CONSULAR_DESK',
    partnerName: 'Vacatina Licensed Consular Desk & UKVI Liaison',
    title: 'United Kingdom Standard 6-Month Visitor Visa Guidance',
    subtitle: 'Comprehensive evidence dossier preparation & VFS biometric appointment scheduling',
    location: {
      city: 'London',
      country: 'United Kingdom',
      countryCode: 'GB'
    },
    confirmationMode: 'ASSISTED_SERVICE',
    availableQuota: 999,
    contractedBaseCost: 38000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 45000,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: [
      'Dossier review by senior immigration documentation specialist',
      'VFS Global Colombo biometrics appointment priority slot allocation',
      'Financial eligibility ratio check and sponsorship validation'
    ],
    exclusions: ['UK Visas and Immigration (UKVI) official visa fee payable directly to Home Office', 'VFS biometric lounge upgrade charges'],
    cancellationPolicy: 'Service fee non-refundable once document audit review has commenced.',
    requiresSpecialistReview: true
  }),

  // --------------------------------------------------------------------------
  // 4. HOLIDAY PACKAGES: Curated Manual Package & Dynamic Hybrid Bundle
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'curated-holiday-packages',
    cmsListingId: 'maldives-luxury-water-villa',
    productType: 'packages',
    partnerSupplierId: 'VACATINA_EXPEDITIONS',
    partnerName: 'Vacatina Luxury Journeys Desk',
    title: 'Maldives Luxury Water Villa Escape',
    subtitle: '4 Nights · Overwater Villa · Return Speedboat · All-Inclusive Dining',
    location: {
      city: 'Male',
      country: 'Maldives',
      countryCode: 'MV'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 8,
    contractedBaseCost: 440000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 495000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-04-30T23:59:59Z',
    inclusions: [
      '4 Nights in Ocean Water Villa with private direct sea access',
      'All-inclusive breakfast, lunch, dinner & premium beverages',
      'Round-trip airport speedboat transfer from Male Velana International',
      'Complimentary sunset dolphin watching excursion'
    ],
    exclusions: ['International flight tickets (add via Flights tab)', 'Scuba diving certification dives'],
    cancellationPolicy: 'Free cancellation up to 14 days before arrival date.'
  }),

  InventoryNormalizerService.normalizeHybridBundle({
    bundleId: 'dubai-skyline-desert-escape-5d',
    title: 'Dubai Skyline & Desert Safari Hybrid Bundle',
    destination: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      iataCode: 'DXB'
    },
    durationDays: 5,
    apiFlightComponent: {
      gdsProvider: 'AMADEUS',
      gdsOfferId: 'amd-fl-cmb-dxb-881',
      airlineCode: 'EK',
      airlineName: 'Emirates',
      flightNumber: 'EK 651',
      originIata: 'CMB',
      originCity: 'Colombo',
      destinationIata: 'DXB',
      destinationCity: 'Dubai',
      destinationCountry: 'United Arab Emirates',
      departureDateTimeIso: '2026-11-20T09:55:00Z',
      arrivalDateTimeIso: '2026-11-20T13:00:00Z',
      cabinClass: 'Economy',
      durationMinutes: 275,
      rawFareAmount: 88500,
      fareCurrency: 'LKR',
      instantTicketingEligible: true
    },
    manualHotelComponent: {
      cmsCollection: 'contracted-boutique-hotels',
      cmsListingId: 'dubai-marina-boutique-hotel',
      productType: 'hotels',
      partnerSupplierId: 'EMAAR_HOSPITALITY',
      partnerName: 'Vida Downtown Dubai Direct Contract',
      title: 'Vida Downtown Dubai Boutique Stay',
      subtitle: '4 Nights · Downtown Dubai · Burj Khalifa View',
      location: {
        city: 'Dubai',
        country: 'United Arab Emirates',
        countryCode: 'AE'
      },
      confirmationMode: 'INSTANT_CONFIRM',
      availableQuota: 10,
      contractedBaseCost: 145000,
      costCurrency: 'LKR',
      validFromIso: '2026-10-01T00:00:00Z',
      validUntilIso: '2027-04-30T23:59:59Z',
      inclusions: ['4 Nights in Deluxe Downtown Room', 'Breakfast buffet included', 'Rooftop pool access overlooking Burj Khalifa'],
      exclusions: ['Tourism dirham fee (20 AED per room/night payable at desk)'],
      cancellationPolicy: 'Free cancellation up to 7 days before check-in.'
    },
    inclusions: [
      'Return Emirates flights Colombo - Dubai with 30kg luggage',
      '4 Nights boutique accommodation in Downtown Dubai with breakfast',
      'Premium sunset desert safari with dune bashing & BBQ dinner'
    ],
    exclusions: ['UAE tourist visa (available in Visa Assistance tab)'],
    validUntilIso: '2027-04-30T23:59:59Z'
  }),

  // --------------------------------------------------------------------------
  // 5. CARS & TRANSFERS: API Airport Transfer vs. Manual Private Chauffeur
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'local-cars-transfers',
    cmsListingId: 'dubai-airport-mercedes-transfer',
    productType: 'cars',
    partnerSupplierId: 'CAREEM_FLEET_DXB',
    partnerName: 'Dubai Premium Ground Transport',
    title: 'Dubai Airport (DXB) to Downtown Luxury Chauffeur',
    subtitle: 'Mercedes-Benz E-Class · Flight Tracked Meet & Greet · Highway Tolls Included',
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 25,
    contractedBaseCost: 18500,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 22000,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: ['Flight arrival tracking with 60 minutes free waiting time', 'All Salik highway toll charges', 'Bottled mineral water & phone charging cables in vehicle'],
    exclusions: ['Additional unscheduled intermediate stops', 'Gratuities for chauffeur'],
    cancellationPolicy: 'Free cancellation up to 4 hours prior to scheduled pickup.'
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'local-cars-transfers',
    cmsListingId: 'sri-lanka-chauffeur-tour-7d',
    productType: 'cars',
    partnerSupplierId: 'VACATINA_FLEET_LK',
    partnerName: 'Vacatina Dedicated Chauffeur Fleet',
    title: 'Sri Lanka Private Chauffeur-Guide (Dedicated 7 Days)',
    subtitle: 'Toyota KDH Luxury Mini-Coach · Licensed Tourist Driver · Fuel & Insurance',
    location: {
      city: 'Colombo',
      country: 'Sri Lanka',
      countryCode: 'LK'
    },
    confirmationMode: 'REQUEST_TO_CONFIRM',
    availableQuota: 5,
    contractedBaseCost: 115000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 135000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-06-30T23:59:59Z',
    inclusions: ['Dedicated licensed English-speaking chauffeur-guide for 7 days', 'Unlimited mileage across national expressways and scenic routes', 'Comprehensive commercial vehicle insurance and fuel'],
    exclusions: ['Chauffeur overnight accommodation if hotel does not provide driver quarters', 'Monuments and national park entry tickets'],
    cancellationPolicy: 'Free cancellation up to 7 days before tour start date.'
  }),

  // --------------------------------------------------------------------------
  // 6. RAILS: API High-Speed vs. Manual Scenic Journey
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'scenic-rail-journeys',
    cmsListingId: 'eurostar-london-paris-standard-premier',
    productType: 'rails',
    partnerSupplierId: 'EUROSTAR_API_DIRECT',
    partnerName: 'Eurostar International High-Speed Rail',
    title: 'London St. Pancras to Paris Gare du Nord',
    subtitle: 'Standard Premier Class · City Centre to City Centre · Light Meal Served',
    location: {
      city: 'Paris',
      country: 'France',
      countryCode: 'FR'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 18,
    contractedBaseCost: 46000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 52000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-03-31T23:59:59Z',
    inclusions: ['Standard Premier extra-wide seating', 'Complimentary cold light meal with beverages served at seat', 'Generous baggage allowance of 2 bags + 1 hand luggage'],
    exclusions: ['Access to Eurostar Business Premier lounge', 'Taxi transfers to/from stations'],
    cancellationPolicy: 'Exchangeable up to 7 days before departure with carrier fare difference.'
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'scenic-rail-journeys',
    cmsListingId: 'swiss-alps-glacier-express',
    productType: 'rails',
    partnerSupplierId: 'RHATISCHE_BAHN_DIRECT',
    partnerName: 'Glacier Express Scenic Passenger Route',
    title: 'Swiss Alps Glacier Express Panoramic Journey',
    subtitle: 'Zermatt to St. Moritz · Excellence Class · Landwasser Viaduct Route',
    location: {
      city: 'Zermatt',
      country: 'Switzerland',
      countryCode: 'CH'
    },
    confirmationMode: 'REQUEST_TO_CONFIRM',
    availableQuota: 4,
    contractedBaseCost: 145000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 168000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-10-31T23:59:59Z',
    inclusions: ['Guaranteed panoramic window seat reservation', 'Multi-course gourmet regional lunch prepared fresh onboard', 'Afternoon tea and personal concierge attention'],
    exclusions: ['Transfer from Swiss international airports to Zermatt station', 'Alcoholic beverages outside lunch package'],
    cancellationPolicy: 'Non-refundable Excellence Class allocation; date changes allowed with 21 days notice.'
  }),

  // --------------------------------------------------------------------------
  // 7. CRUISES: Luxury Expedition vs. Regional Arabian Gulf
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'niche-cruises',
    cmsListingId: 'dubai-arabian-gulf-cruise-5n',
    productType: 'cruises',
    partnerSupplierId: 'AIDA_CRUISES_DIRECT',
    partnerName: 'AIDA Cruises Arabian Gulf Operations',
    title: 'Dubai & Arabian Gulf 5-Night Coastal Cruise',
    subtitle: 'Balcony Stateroom · Round-trip Port Rashid · Muscat & Abu Dhabi',
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 6,
    contractedBaseCost: 335000,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 385000,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2027-03-31T23:59:59Z',
    inclusions: ['Private balcony stateroom with ocean view', 'Full-board gourmet dining across main and buffet restaurants', 'Onboard theatre productions, fitness wellness centre access'],
    exclusions: ['Optional shore excursions in Muscat and Abu Dhabi ports', 'Service gratuities and specialty alcoholic packages'],
    cancellationPolicy: 'Free cancellation up to 30 days prior to embarkation date.'
  }),

  // --------------------------------------------------------------------------
  // 8. ACTIVITIES & SIGHTSEEING: Manual Contracted Tours
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'contracted-activities',
    cmsListingId: 'dubai-desert-sunset-safari',
    productType: 'activities',
    partnerSupplierId: 'DESERT_SAFARI_DUBAI',
    partnerName: 'Arabian Adventures & Desert Safaris',
    title: 'Dubai Premium Sunset Desert Safari & BBQ Feast',
    subtitle: '4x4 Dune Bashing · Bedouin Camp · Falconry & Barbecue Dinner',
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 30,
    contractedBaseCost: 24500,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 29500,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: [
      'Hotel pickup & drop-off in air-conditioned 4x4 land cruiser',
      '45-minute thrilling dune bashing across Lahbab red sand dunes',
      'Live cultural performances (Tanoura, fire show, belly dance)',
      'Authentic Arabic barbecue buffet with unlimited soft drinks'
    ],
    exclusions: ['Quad bike & dune buggy rental inside desert camp', 'Souvenir photos with falcon'],
    cancellationPolicy: 'Free cancellation up to 24 hours before activity start time.'
  }),

  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'heritage-sightseeing-tours',
    cmsListingId: 'sigiriya-ancient-rock-guided',
    productType: 'sightseeing',
    partnerSupplierId: 'CENTRAL_CULTURAL_FUND_LK',
    partnerName: 'Cultural Triangle Heritage Guides',
    title: 'Sigiriya Ancient Fortress & Mirror Wall Guided Tour',
    subtitle: 'UNESCO World Heritage Site · Certified Archaeologist Guide · Skip-the-Line',
    location: {
      city: 'Sigiriya',
      country: 'Sri Lanka',
      countryCode: 'LK'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 20,
    contractedBaseCost: 19500,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 24500,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: ['Official UNESCO Sigiriya entrance permit included', 'Dedicated licensed heritage archaeologist guide for 3 hours', 'Bottled chilled mineral water & fresh king coconut at exit'],
    exclusions: ['Transportation to Sigiriya sanctuary gates', 'Video camera filming permits for commercial shoots'],
    cancellationPolicy: 'Free cancellation up to 24 hours before tour start.'
  }),

  // --------------------------------------------------------------------------
  // 9. TRAVEL INSURANCE: Real Provider-Backed Policy (Never Fabricate Fakes)
  // --------------------------------------------------------------------------
  InventoryNormalizerService.normalizeManualCmsListing({
    cmsCollection: 'insurance-policies',
    cmsListingId: 'single-trip-essential-cover',
    productType: 'insurance',
    partnerSupplierId: 'ALLIANZ_WORLDWIDE',
    partnerName: 'Allianz Global Assistance Underwritten Policy',
    title: 'Single Trip Essential Worldwide Travel Shield',
    subtitle: 'USD 100,000 Emergency Medical · Trip Delay & Lost Baggage Protection',
    location: {
      city: 'Worldwide',
      country: 'Global Coverage',
      countryCode: 'XX'
    },
    confirmationMode: 'INSTANT_CONFIRM',
    availableQuota: 9999,
    contractedBaseCost: 12500,
    costCurrency: 'LKR',
    standardSellingPriceLkr: 15500,
    validFromIso: '2026-01-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    inclusions: [
      'USD 100,000 emergency overseas medical treatment & hospitalization',
      'USD 2,500 baggage loss & luggage delay compensation',
      '24/7 multilingual emergency medical assistance hotline'
    ],
    exclusions: ['Pre-existing medical conditions not disclosed during declaration', 'Extreme uncertified adventure sports (e.g. wingsuit flying)'],
    cancellationPolicy: '14-day cooling-off period full refund provided no travel has commenced.'
  })
];
