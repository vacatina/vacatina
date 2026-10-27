/* ============================================================================
 * Vacatina Flights Full Functional Build Automated Unit & Domain Test Suite
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§48, §51, §56)
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findAirportByCode,
  searchAirports,
  validateAirportSelection,
  parseAirportFromInput,
  formatAirportDisplay,
  CANONICAL_AIRPORTS
} from '../src/features/flights/data/airports.ts';

import {
  MANUAL_FLIGHT_OFFERS,
  getActiveManualOffers
} from '../src/features/flights/data/manual-offers.ts';

import { SUPPLIER_FLIGHT_FIXTURES } from '../src/features/flights/data/supplier-fixtures.ts';

import { ManualFlightAdapter } from '../src/features/flights/adapters/manual-flight.adapter.ts';
import { SupplierApiFlightAdapter } from '../src/features/flights/adapters/supplier-api-flight.adapter.ts';
import { flightSearchService } from '../src/features/flights/services/flight-search.service.ts';
import { flightTripBucketService } from '../src/features/flights/services/flight-trip-bucket.service.ts';
import { flightFavoritesService } from '../src/features/flights/services/flight-favorites.service.ts';
import { formatTravellerSummaryText } from '../src/features/flights/ui/reusable-traveller-selector.ts';
import type { FlightConfigurationSelection } from '../src/features/flights/domain/search-models.ts';
import type { FlightSearchRequest } from '../src/features/flights/domain/search-models.ts';

test('Vacatina Flights Full Functional Build Suite', async (t) => {
  const CMB = findAirportByCode('CMB')!;
  const DXB = findAirportByCode('DXB')!;
  const LHR = findAirportByCode('LHR')!;
  const SIN = findAirportByCode('SIN')!;
  const MLE = findAirportByCode('MLE')!;

  // 1. Airport Master Registry & Autocomplete Search (§8)
  await t.test('Airport Gate 1: Registry Integrity & Code Resolution', () => {
    assert.ok(CANONICAL_AIRPORTS.length >= 20, 'Must have at least 20 international airports');
    assert.equal(CMB.airportCode, 'CMB');
    assert.equal(CMB.city, 'Colombo');
    assert.equal(CMB.country, 'Sri Lanka');
    assert.equal(DXB.airportCode, 'DXB');
    assert.equal(LHR.airportCode, 'LHR');

    // Case-insensitive lookup
    assert.equal(findAirportByCode('cmb')?.airportCode, 'CMB');
    assert.equal(findAirportByCode('dxb')?.airportCode, 'DXB');
    assert.equal(findAirportByCode('INVALID_XYZ'), undefined);
  });

  await t.test('Airport Gate 2: Autocomplete Search with Fuzzy & Code Matching', () => {
    const resultsCode = searchAirports('CMB');
    assert.ok(resultsCode.length >= 1);
    assert.equal(resultsCode[0].airportCode, 'CMB');

    const resultsCity = searchAirports('Dubai');
    assert.ok(resultsCity.some(a => a.airportCode === 'DXB'));

    const resultsLondon = searchAirports('London');
    assert.ok(resultsLondon.some(a => a.airportCode === 'LHR'));
    assert.ok(resultsLondon.some(a => a.airportCode === 'LGW'));

    const parsed = parseAirportFromInput('Colombo (CMB) — Bandaranaike International Airport');
    assert.ok(parsed);
    assert.equal(parsed?.airportCode, 'CMB');
  });

  await t.test('Airport Gate 3: Selection Validation (Identical Origin/Destination Guard)', () => {
    const valid = validateAirportSelection('CMB', 'DXB');
    assert.equal(valid.isValid, true);
    assert.equal(valid.origin?.airportCode, 'CMB');
    assert.equal(valid.destination?.airportCode, 'DXB');

    const identical = validateAirportSelection('CMB', 'CMB');
    assert.equal(identical.isValid, false);
    assert.ok(identical.error?.includes('identical'));

    const invalid = validateAirportSelection('INVALID_CODE', 'DXB');
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.error?.includes('origin'));
  });

  // 2. Canonical Search Validation (§7, §11, §12)
  await t.test('Search Gate 4: Domain Validation Rules for Dates & Travellers', () => {
    const today = new Date().toISOString().split('T')[0];

    // Valid search request
    const validReq: Partial<FlightSearchRequest> = {
      tripType: 'round_trip',
      origin: CMB,
      destination: DXB,
      departureDate: '2026-11-20',
      returnDate: '2026-11-27',
      travellers: { adults: 2, children: 1, infants: 1 },
      cabinClass: 'economy'
    };
    const v1 = flightSearchService.validateSearchRequest(validReq);
    assert.equal(v1.isValid, true);
    assert.equal(Object.keys(v1.errors).length, 0);

    // Negative: Departure in past
    const pastReq = { ...validReq, departureDate: '2020-01-01' };
    const v2 = flightSearchService.validateSearchRequest(pastReq);
    assert.equal(v2.isValid, false);
    assert.ok(v2.errors.departureDate?.includes('past'));

    // Negative: Return before departure
    const invReturnReq = { ...validReq, departureDate: '2026-11-25', returnDate: '2026-11-20' };
    const v3 = flightSearchService.validateSearchRequest(invReturnReq);
    assert.equal(v3.isValid, false);
    assert.ok(v3.errors.returnDate?.includes('precede'));

    // Negative: 0 Adults
    const zeroAdultsReq = { ...validReq, travellers: { adults: 0, children: 1, infants: 0 } };
    const v4 = flightSearchService.validateSearchRequest(zeroAdultsReq);
    assert.equal(v4.isValid, false);
    assert.ok(v4.errors.adults?.includes('At least 1 adult'));

    // Negative: Infants > Adults
    const infantOverReq = { ...validReq, travellers: { adults: 1, children: 0, infants: 2 } };
    const v5 = flightSearchService.validateSearchRequest(infantOverReq);
    assert.equal(v5.isValid, false);
    assert.ok(v5.errors.infants?.includes('exceed'));

    // Negative: Total > 9
    const maxPaxReq = { ...validReq, travellers: { adults: 8, children: 2, infants: 1 } };
    const v6 = flightSearchService.validateSearchRequest(maxPaxReq);
    assert.equal(v6.isValid, false);
    assert.ok(v6.errors.travellers?.includes('9'));
  });

  await t.test('Search Gate 5: Multi-City Itinerary Chronology & Segment Validation', () => {
    // Valid 2-leg multi-city
    const validMc: Partial<FlightSearchRequest> = {
      tripType: 'multi_city',
      origin: CMB,
      destination: LHR,
      departureDate: '2026-11-15',
      legs: [
        { legIndex: 0, origin: CMB, destination: DXB, departureDate: '2026-11-15' },
        { legIndex: 1, origin: DXB, destination: LHR, departureDate: '2026-11-20' }
      ],
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy'
    };
    const v1 = flightSearchService.validateSearchRequest(validMc);
    assert.equal(v1.isValid, true);

    // Negative: Only 1 leg
    const oneLeg = { ...validMc, legs: [validMc.legs![0]] };
    const v2 = flightSearchService.validateSearchRequest(oneLeg);
    assert.equal(v2.isValid, false);
    assert.ok(v2.errors.legs?.includes('at least 2'));

    // Negative: Leg 2 date precedes Leg 1 date
    const badChronology = {
      ...validMc,
      legs: [
        { legIndex: 0, origin: CMB, destination: DXB, departureDate: '2026-11-20' },
        { legIndex: 1, origin: DXB, destination: LHR, departureDate: '2026-11-15' }
      ]
    };
    const v3 = flightSearchService.validateSearchRequest(badChronology);
    assert.equal(v3.isValid, false);
    assert.ok(v3.errors.leg_1_date?.includes('precede'));
  });

  // 3. Manual Inventory Adapter & Catalog (§4, §5, §18)
  await t.test('Manual Adapter Gate 6: Active vs Paused/Expired Catalog Isolation', async () => {
    const manualAdapter = new ManualFlightAdapter();
    assert.equal(manualAdapter.sourceType, 'manual');

    // Paused offer is present in raw catalog but excluded from active offers
    const pausedOffer = MANUAL_FLIGHT_OFFERS.find(o => o.status === 'paused');
    assert.ok(pausedOffer, 'Must have a paused fixture for lifecycle QA');
    const activeOffers = getActiveManualOffers();
    assert.ok(!activeOffers.some(o => o.status === 'paused'), 'Active manual catalog must exclude paused items');

    // Search via Manual adapter
    const searchRes = await manualAdapter.search({
      searchId: 's-1',
      tripType: 'round_trip',
      origin: CMB,
      destination: DXB,
      departureDate: '2026-11-15',
      returnDate: '2026-11-22',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en',
      createdAt: new Date().toISOString()
    });

    assert.equal(searchRes.status, 'ok');
    assert.ok(searchRes.offers.length >= 1);
    const promoOffer = searchRes.offers[0];
    assert.equal(promoOffer.sourceType, 'manual');
    assert.equal(promoOffer.bookability, 'informational');
    assert.ok(promoOffer.price.totalMinor > 0);
  });

  // 4. Provider-Neutral Supplier API Adapter (§3, §19, §34)
  await t.test('Supplier Adapter Gate 7: Multi-Carrier Search & Normalization', async () => {
    const supplierAdapter = new SupplierApiFlightAdapter();
    assert.equal(supplierAdapter.sourceType, 'supplier_api');

    const searchRes = await supplierAdapter.search({
      searchId: 's-2',
      tripType: 'round_trip',
      origin: CMB,
      destination: DXB,
      departureDate: '2026-11-15',
      returnDate: '2026-11-22',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en',
      createdAt: new Date().toISOString()
    });

    assert.equal(searchRes.status, 'ok');
    assert.ok(searchRes.offers.length >= 1);
    const offer = searchRes.offers[0];
    assert.equal(offer.sourceType, 'supplier_api');
    assert.equal(offer.bookability, 'live_bookable');
    assert.equal(offer.origin.airportCode, 'CMB');
    assert.equal(offer.destination.airportCode, 'DXB');
  });

  // 5. Unified Flight Search Aggregation & Sorting (§14, §15, §16, §35)
  await t.test('Search Aggregator Gate 8: Merged Multi-Source Collection & Deduplication', async () => {
    const response = await flightSearchService.search({
      searchId: 's-3',
      tripType: 'round_trip',
      origin: CMB,
      destination: DXB,
      departureDate: '2026-11-15',
      returnDate: '2026-11-22',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en',
      createdAt: new Date().toISOString()
    });

    assert.ok(response.offers.length >= 2, 'Combined search must return both manual and supplier offers');
    assert.ok(response.sourcesQueried.some(s => s.source === 'manual'));
    assert.ok(response.sourcesQueried.some(s => s.source === 'supplier_api'));

    // Verify deduplication and unique offer IDs
    const ids = response.offers.map(o => o.offerId);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'All aggregated offer IDs must be unique');
  });

  await t.test('Search Aggregator Gate 9: Deterministic Sorting Algorithms', async () => {
    const baseReq: FlightSearchRequest = {
      searchId: 's-sort',
      tripType: 'round_trip',
      origin: CMB,
      destination: LHR,
      departureDate: '2026-11-15',
      returnDate: '2026-11-22',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en',
      createdAt: new Date().toISOString()
    };

    // 1. Lowest Price Sort
    const priceSorted = await flightSearchService.search(baseReq, 'price_asc');
    for (let i = 0; i < priceSorted.offers.length - 1; i++) {
      assert.ok(
        priceSorted.offers[i].price.totalMinor <= priceSorted.offers[i + 1].price.totalMinor,
        'Prices must be sorted ascending'
      );
    }

    // 2. Shortest Duration Sort
    const durationSorted = await flightSearchService.search(baseReq, 'duration_asc');
    for (let i = 0; i < durationSorted.offers.length - 1; i++) {
      assert.ok(
        durationSorted.offers[i].durationMinutes <= durationSorted.offers[i + 1].durationMinutes,
        'Duration must be sorted ascending'
      );
    }

    // 3. Recommended Sort
    const recSorted = await flightSearchService.search(baseReq, 'recommended');
    assert.ok(recSorted.offers.length > 0);
  });

  await t.test('Search Aggregator Gate 10: Faceted Filtering (Stops, Airlines, Baggage)', async () => {
    const baseReq: FlightSearchRequest = {
      searchId: 's-filter',
      tripType: 'round_trip',
      origin: CMB,
      destination: LHR,
      departureDate: '2026-11-15',
      returnDate: '2026-11-22',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en',
      createdAt: new Date().toISOString()
    };

    // Filter by stops: 1 stop only
    const oneStop = await flightSearchService.search(baseReq, 'recommended', { stops: [1] });
    for (const o of oneStop.offers) {
      assert.equal(o.stopCount, 1, 'Only 1-stop flights should be returned');
    }

    // Filter by Airline code
    const qrOnly = await flightSearchService.search(baseReq, 'recommended', { airlineCodes: ['QR'] });
    for (const o of qrOnly.offers) {
      assert.equal(o.marketingCarrier.code, 'QR');
    }

    // Filter by baggage included
    const baggageOnly = await flightSearchService.search(baseReq, 'recommended', { baggageIncludedOnly: true });
    for (const o of baggageOnly.offers) {
      assert.ok(o.baggage.checked.pieces > 0);
    }
  });

  // 6. Price Revalidation & 8-State Trip Bucket Transitions (§25, §26, §27)
  await t.test('Revalidation Gate 11: Real-Time Upstream Price Recheck Sagas', async () => {
    // 1. Unchanged Normal Offer Revalidation
    const unchOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-cmb-dxb-fz548')!;
    const res1 = await flightSearchService.revalidateOffer(unchOffer.offerId);
    assert.equal(res1.status, 'UNCHANGED');
    assert.equal(res1.requiresUserAction, false);

    // 2. Price Changed Test Scenario
    const priceChgOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-price-changed-sim')!;
    const res2 = await flightSearchService.revalidateOffer(priceChgOffer.offerId);
    assert.equal(res2.status, 'PRICE_CHANGED');
    assert.equal(res2.requiresUserAction, true);
    assert.ok(res2.newPriceMinor > res2.originalPriceMinor);
    assert.ok(res2.priceDeltaMinor > 0);

    // 3. Expired Offer Test Scenario
    const expOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-expired-sim')!;
    const res3 = await flightSearchService.revalidateOffer(expOffer.offerId);
    assert.equal(res3.status, 'OFFER_EXPIRED');
    assert.equal(res3.requiresUserAction, true);

    // 4. Sold Out / Unavailable Test Scenario
    const unavailOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-unavailable-sim')!;
    const res4 = await flightSearchService.revalidateOffer(unavailOffer.offerId);
    assert.equal(res4.status, 'UNAVAILABLE');
    assert.equal(res4.requiresUserAction, true);
  });

  await t.test('Trip Bucket Gate 12: Canonical 8-State Flight Candidate Staging', async () => {
    const liveOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-cmb-dxb-fz548')!;

    // 1a. Unconfigured multi-fare offer stages as needs_action (requires selecting fare family)
    const cUnconf = flightTripBucketService.mapFlightOfferToTripCandidate(liveOffer);
    assert.equal(cUnconf.state, 'needs_action');
    assert.ok(cUnconf.actionRequiredText?.includes('Select preferred fare family'));

    // 1b. Configured live bookable offer stages as ready
    const validConfig: FlightConfigurationSelection = {
      offerId: liveOffer.offerId,
      selectedCabinClass: liveOffer.cabinClass,
      selectedFareFamilyCode: 'CLASSIC',
      selectedOptionalServiceIds: []
    };
    const c1 = flightTripBucketService.mapFlightOfferToTripCandidate(liveOffer, validConfig);
    assert.equal(c1.productType, 'flights');
    assert.equal(c1.state, 'ready');
    assert.equal(c1.offerId, liveOffer.offerId);
    assert.equal(c1.priceLkr, Math.round(liveOffer.price.totalMinor / 100));

    // 2. Request-to-book manual offer stages as needs_action
    const reqBookOffer = MANUAL_FLIGHT_OFFERS.find(o => o.offerId === 'man-flt-cmb-mle-q2701')!;
    const c2 = flightTripBucketService.mapFlightOfferToTripCandidate(reqBookOffer);
    assert.equal(c2.state, 'needs_action');
    assert.ok(c2.actionRequiredText?.includes('confirmation required'));

    // 3. Price Changed offer stages as price_changed
    const pcOffer = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === 'sup-flt-price-changed-sim')!;
    const c3 = flightTripBucketService.mapFlightOfferToTripCandidate(pcOffer);
    assert.equal(c3.state, 'price_changed');
    assert.equal(c3.primaryActionLabel, 'Accept New Price');

    // 4. Revalidate in Trip Bucket
    const candidate = flightTripBucketService.addFlightToTripBucket(liveOffer, validConfig);
    assert.equal(candidate.state, 'ready');
    const revalRes = await flightTripBucketService.revalidateFlightInTripBucket(candidate.id, liveOffer.offerId);
    assert.equal(revalRes.status, 'UNCHANGED');
  });

  // 7. Favorites Behavior (§28)
  await t.test('Favorites Gate 13: Independent Flight Route & Offer Bookmarking', () => {
    const offer = SUPPLIER_FLIGHT_FIXTURES[0];
    const isSavedInitial = flightFavoritesService.isOfferFavorite(offer.offerId);

    // Toggle favorite
    const toggled = flightFavoritesService.toggleOfferFavorite(offer);
    assert.equal(toggled, !isSavedInitial);
    assert.equal(flightFavoritesService.isOfferFavorite(offer.offerId), toggled);

    // Toggle route
    const routeToggled = flightFavoritesService.toggleRouteFavorite('CMB', 'DXB', 'Colombo', 'Dubai');
    assert.equal(typeof routeToggled, 'boolean');
  });

  // 8. Traveller Summary Formatter (§10)
  await t.test('Traveller Gate 14: Summary Formatting & Constraints', () => {
    const s1 = formatTravellerSummaryText({ adults: 1, children: 0, infants: 0, cabinClass: 'economy' });
    assert.equal(s1, '1 Adult · Economy');

    const s2 = formatTravellerSummaryText({ adults: 2, children: 1, infants: 1, cabinClass: 'business' });
    assert.equal(s2, '2 Adults, 1 Child, 1 Infant · Business');
  });
});
