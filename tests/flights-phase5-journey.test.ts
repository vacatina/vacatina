/* ============================================================================
 * Vacatina Flights — Phase 5 Customer Journey Tests
 * Covers canonical search, routing, demo/manual inventory truth, configuration,
 * Trip Bucket staging, revalidation guards, and the local review handoff.
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlightSearchQuery,
  normalizeFlightDate,
  parseFlightSearchQuery
} from '../src/features/flights/domain/flight-search-query.ts';
import {
  flightOfferIdFromPath,
  isDedicatedFlightsPath,
  isFlightOfferPath
} from '../src/features/flights/domain/flight-routes.ts';
import { resolveFlightInventoryTruth } from '../src/features/flights/domain/flight-inventory-truth.ts';
import {
  getLastFlightSearchQuery,
  rememberFlightSearchQuery
} from '../src/features/flights/domain/flight-search-context.ts';
import { flightSearchService } from '../src/features/flights/services/flight-search.service.ts';
import { flightTripBucketService } from '../src/features/flights/services/flight-trip-bucket.service.ts';
import { tripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { evaluateTripReviewHandoff } from '../src/features/trip-review/trip-review-workspace.ts';
import type { TripBucketCandidate } from '../src/lib/domain/types.ts';
import type { FlightConfigurationSelection } from '../src/features/flights/domain/search-models.ts';

const VALID_QUERY =
  'tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-20&returnDate=2026-11-27&adults=2&children=1&cabinClass=economy';

function searchRequest(query = VALID_QUERY) {
  return parseFlightSearchQuery(new URLSearchParams(query)).request;
}

function reviewCandidate(overrides: Partial<TripBucketCandidate>): TripBucketCandidate {
  return {
    id: 'tb-review-test',
    productType: 'flights',
    productLabel: 'Flight',
    title: 'Test flight',
    subtitle: 'Test subtitle',
    dateSummary: '20 Nov 2026',
    travellerSummary: '1 Adult · Economy',
    state: 'ready',
    priceLkr: 100000,
    supplierName: 'Test supplier',
    integrationMode: 'MOCK',
    ...overrides
  };
}

test('Vacatina Flights Phase 5 Journey Suite', async (t) => {
  await t.test('Phase 5 Gate 1: Canonical search parsing, aliases and validation', () => {
    const canonical = parseFlightSearchQuery(new URLSearchParams(VALID_QUERY));
    assert.deepEqual(canonical.errors, {});
    assert.equal(canonical.request.origin.airportCode, 'CMB');
    assert.equal(canonical.request.destination.airportCode, 'DXB');
    assert.equal(canonical.request.departureDate, '2026-11-20');
    assert.equal(canonical.request.returnDate, '2026-11-27');
    assert.equal(canonical.request.travellers.adults, 2);
    assert.equal(canonical.request.travellers.children, 1);
    assert.equal(canonical.request.cabinClass, 'economy');

    const legacy = parseFlightSearchQuery(
      new URLSearchParams(
        'tripType=one-way&from=Colombo%20(CMB)&to=Dubai%20(DXB)&dep=20%20Nov%202026&adults=1&cabin=Business'
      )
    );
    assert.deepEqual(legacy.errors, {});
    assert.equal(legacy.request.tripType, 'one_way');
    assert.equal(legacy.request.origin.airportCode, 'CMB');
    assert.equal(legacy.request.destination.airportCode, 'DXB');
    assert.equal(legacy.request.departureDate, '2026-11-20');
    assert.equal(legacy.request.cabinClass, 'business');
    assert.equal(normalizeFlightDate('20 Nov 2026'), '2026-11-20');
    assert.equal(normalizeFlightDate('2026-02-30'), null);

    const sameAirport = parseFlightSearchQuery(
      new URLSearchParams('tripType=round_trip&origin=CMB&destination=CMB&departureDate=2026-11-20&returnDate=2026-11-27')
    );
    assert.ok(sameAirport.errors.destination?.includes('identical'));

    const past = parseFlightSearchQuery(
      new URLSearchParams('tripType=round_trip&origin=CMB&destination=DXB&departureDate=2020-01-01&returnDate=2020-01-08')
    );
    assert.ok(past.errors.departureDate?.includes('past'));

    const badReturn = parseFlightSearchQuery(
      new URLSearchParams('tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-25&returnDate=2026-11-20')
    );
    assert.ok(badReturn.errors.returnDate?.includes('precede'));

    const badCabin = parseFlightSearchQuery(
      new URLSearchParams(
        'tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-20&returnDate=2026-11-27&adults=2&cabinClass=space'
      )
    );
    assert.ok(badCabin.errors.cabinClass?.includes('Cabin class'));

    const defaults = parseFlightSearchQuery(
      new URLSearchParams(''),
      new Date('2026-10-27T00:00:00.000Z')
    );
    assert.equal(defaults.request.origin.airportCode, 'CMB');
    assert.equal(defaults.request.destination.airportCode, 'DXB');
    assert.ok(defaults.usedDefaults.includes('origin'));
    assert.ok(defaults.usedDefaults.includes('destination'));
    assert.ok(defaults.usedDefaults.includes('departureDate'));
    assert.ok(defaults.usedDefaults.includes('returnDate'));

    const infantHeavy = parseFlightSearchQuery(
      new URLSearchParams('tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-20&returnDate=2026-11-27&adults=1&infants=2')
    ).request;
    const infantValidation = flightSearchService.validateSearchRequest(infantHeavy);
    assert.equal(infantValidation.isValid, false);
    assert.ok(infantValidation.errors.infants?.includes('exceed'));
  });

  await t.test('Phase 5 Gate 2: Canonical search serialization and multi-city legs', () => {
    const request = searchRequest();
    const built = buildFlightSearchQuery(request);
    assert.ok(built.startsWith('/flights/search?'));
    assert.ok(built.includes('origin=CMB'));
    assert.ok(built.includes('destination=DXB'));
    assert.ok(built.includes('departureDate=2026-11-20'));
    assert.ok(built.includes('returnDate=2026-11-27'));
    assert.ok(built.includes('adults=2'));
    assert.ok(built.includes('cabinClass=economy'));

    const remade = parseFlightSearchQuery(new URLSearchParams(built.split('?')[1]));
    assert.equal(remade.request.origin.airportCode, 'CMB');
    assert.equal(remade.request.destination.airportCode, 'DXB');

    const multiQuery = new URLSearchParams(
      'tripType=multi_city&origin=CMB&destination=LHR&departureDate=2026-11-20' +
        '&leg=CMB-DXB-2026-11-20&leg=DXB-LHR-2026-11-24&adults=1&cabinClass=economy'
    );
    const multi = parseFlightSearchQuery(multiQuery);
    assert.deepEqual(multi.errors, {});
    assert.equal(multi.request.tripType, 'multi_city');
    assert.equal(multi.request.legs?.length, 2);
    assert.equal(multi.request.legs?.[0].origin.airportCode, 'CMB');
    assert.equal(multi.request.legs?.[1].destination.airportCode, 'LHR');
    assert.equal(multi.request.origin.airportCode, 'CMB');
    assert.equal(multi.request.destination.airportCode, 'LHR');
    assert.equal(multi.request.returnDate, undefined);

    const multiBuilt = buildFlightSearchQuery(multi.request);
    assert.ok(multiBuilt.includes('leg=CMB-DXB-2026-11-20'));
    assert.ok(multiBuilt.includes('leg=DXB-LHR-2026-11-24'));
    const multiRemade = parseFlightSearchQuery(new URLSearchParams(multiBuilt.split('?')[1]));
    assert.equal(multiRemade.request.legs?.length, 2);
    assert.equal(multiRemade.request.legs?.[1].departureDate, '2026-11-24');

    const oneLeg = parseFlightSearchQuery(
      new URLSearchParams('tripType=multi_city&origin=CMB&destination=DXB&departureDate=2026-11-20&leg=CMB-DXB-2026-11-20&adults=1')
    );
    assert.ok(oneLeg.errors.legs?.includes('at least 2'));

    const badChronology = parseFlightSearchQuery(
      new URLSearchParams('tripType=multi_city&leg=CMB-DXB-2026-11-25&leg=DXB-LHR-2026-11-20&adults=1')
    );
    assert.ok(badChronology.errors.legs?.includes('chronological'));
  });

  await t.test('Phase 5 Gate 3: Canonical search returns labelled inventory and a no-results state', async () => {
    const results = await flightSearchService.search(searchRequest());
    assert.ok(results.offers.length >= 2, 'CMB→DXB must return fixture inventory');
    assert.equal(results.filteredCount, results.offers.length);
    const modes = results.offers.map(offer => resolveFlightInventoryTruth(offer).mode);
    assert.ok(modes.includes('demo_fixture'), 'Supplier fixtures must be labelled demo');
    assert.ok(modes.includes('manual_request'), 'Manual inventory must be labelled request-to-book');
    assert.ok(!modes.includes('live_supplier'), 'No live supplier inventory exists in Phase 5');

    const noResults = await flightSearchService.search(
      searchRequest(
        'tripType=round_trip&origin=CMB&destination=NRT&departureDate=2026-11-20&returnDate=2026-11-27&adults=1&cabinClass=economy'
      )
    );
    assert.equal(noResults.offers.length, 0);
    assert.equal(noResults.filteredCount, 0);
  });

  await t.test('Phase 5 Gate 4: Dedicated offer route identity and invalid offers', async () => {
    assert.equal(isDedicatedFlightsPath('/flights'), true);
    assert.equal(isDedicatedFlightsPath('/flights/search'), true);
    assert.equal(isDedicatedFlightsPath('/flights/offer/sup-flt-cmb-dxb-fz548'), true);
    assert.equal(isDedicatedFlightsPath('/flights-and-more'), false);
    assert.equal(isDedicatedFlightsPath('/hotels'), false);

    assert.equal(isFlightOfferPath('/flights/offer/sup-flt-cmb-dxb-fz548'), true);
    assert.equal(isFlightOfferPath('/flights/search'), false);
    assert.equal(
      flightOfferIdFromPath('/flights/offer/sup-flt-cmb-dxb-fz548'),
      'sup-flt-cmb-dxb-fz548'
    );
    assert.equal(
      flightOfferIdFromPath('/flights/offer/sup-flt-cmb-dxb-fz548/extra'),
      'sup-flt-cmb-dxb-fz548'
    );
    assert.equal(flightOfferIdFromPath('/flights/offer/'), null);
    assert.equal(flightOfferIdFromPath('/flights/search'), null);

    const valid = await flightSearchService.getOfferById('sup-flt-cmb-dxb-fz548');
    assert.ok(valid);
    assert.equal(valid?.offerId, 'sup-flt-cmb-dxb-fz548');

    const invalid = await flightSearchService.getOfferById('missing-offer-phase5');
    assert.equal(invalid, null);

    const canonicalSearch = buildFlightSearchQuery(searchRequest());
    rememberFlightSearchQuery(canonicalSearch);
    assert.equal(getLastFlightSearchQuery(), canonicalSearch);
  });

  await t.test('Phase 5 Gate 5: Demo fixtures and manual request-to-book truth', async () => {
    const demo = await flightSearchService.getOfferById('sup-flt-cmb-dxb-fz548');
    assert.ok(demo);
    assert.equal(demo.inventoryMode, 'demo_fixture');
    assert.ok(demo.sourceProvider.includes('demo'));
    const demoTruth = resolveFlightInventoryTruth(demo);
    assert.equal(demoTruth.mode, 'demo_fixture');
    assert.equal(demoTruth.isLive, false);
    assert.equal(demoTruth.requiresDeskConfirmation, true);
    assert.ok(demoTruth.disclosure.includes('Demonstration fixture'));
    assert.ok(demoTruth.priceLabel.toLowerCase().includes('illustrative'));

    const manual = await flightSearchService.getOfferById('man-flt-cmb-dxb-ek651');
    assert.ok(manual);
    assert.equal(manual.inventoryMode, 'manual_request');
    assert.equal(manual.flightNumber, 'PENDING');
    assert.equal(manual.baggage.isSupplied, false);
    assert.equal(manual.fareFamiliesAvailable.length, 0);
    assert.equal(manual.availabilityStatus, 'ON_REQUEST');
    assert.equal(manual.manualInventoryMetadata?.scheduleStatus, 'PENDING_OPERATOR_CONFIRMATION');
    const manualTruth = resolveFlightInventoryTruth(manual);
    assert.equal(manualTruth.mode, 'manual_request');
    assert.equal(manualTruth.isManual, true);
    assert.equal(manualTruth.isLive, false);
    assert.ok(manualTruth.confirmationLabel.toLowerCase().includes('desk confirmation'));

    const manualRevalidation = await flightSearchService.revalidateOffer(manual.offerId);
    assert.equal(manualRevalidation.status, 'UNCHANGED');
    assert.equal(manualRevalidation.requiresUserAction, true);
    assert.ok(manualRevalidation.message.toLowerCase().includes('desk'));

    const manualCandidate = flightTripBucketService.mapFlightOfferToTripCandidate(
      manual,
      undefined,
      searchRequest()
    );
    assert.equal(manualCandidate.state, 'needs_action');
    assert.equal(manualCandidate.inventoryMode, 'manual_request');
    assert.equal(manualCandidate.confirmationMode, 'REQUEST_TO_CONFIRM');
    assert.ok(manualCandidate.primaryActionLabel?.toLowerCase().includes('desk'));
    assert.ok(manualCandidate.actionRequiredText?.toLowerCase().includes('desk'));
  });

  await t.test('Phase 5 Gate 6: Fare configuration and local Trip Bucket staging', async () => {
    tripBucketService.replaceCandidates([]);

    const demo = await flightSearchService.getOfferById('sup-flt-cmb-dxb-fz548');
    assert.ok(demo);
    const family = demo.fareFamiliesAvailable.find(option => option.familyCode === 'flex');
    assert.ok(family, 'Demo fixture must expose its fare-family options');

    const config: FlightConfigurationSelection = {
      offerId: demo.offerId,
      selectedFareFamilyCode: 'flex',
      selectedCabinClass: demo.cabinClass,
      selectedOptionalServiceIds: []
    };

    const candidate = flightTripBucketService.addFlightToTripBucket(
      demo,
      config,
      searchRequest()
    );

    assert.equal(tripBucketService.getItems().length, 1);
    const staged = tripBucketService.getItems()[0];
    assert.equal(staged.offerId, demo.offerId);
    assert.equal(staged.inventoryMode, 'demo_fixture');
    assert.equal(staged.confirmationMode, 'REQUEST_TO_CONFIRM');
    assert.equal(staged.state, 'needs_action');
    assert.equal(staged.fareFamilyCode, 'flex');
    assert.equal(staged.fareFamilyName, family.familyName);
    assert.equal(
      staged.priceLkr,
      Math.round((demo.price.totalMinor + family.priceDeltaMinor) / 100)
    );
    assert.equal(staged.searchContext?.origin, 'CMB');
    assert.equal(staged.searchContext?.destination, 'DXB');
    assert.equal(staged.searchContext?.departureDate, '2026-11-20');
    assert.deepEqual(staged.travellerCounts, { adults: 2, children: 1, infants: 0 });
    assert.ok(staged.providerName?.includes('demo'));
    assert.ok(staged.truthDisclosure?.includes('Demonstration fixture'));
    assert.equal(staged.scheduleStatus, 'DEMO_ILLUSTRATIVE');

    const unconfigured = flightTripBucketService.mapFlightOfferToTripCandidate(
      demo,
      undefined,
      searchRequest()
    );
    assert.equal(unconfigured.state, 'needs_action');
    assert.equal(unconfigured.fareFamilyName, demo.fareFamily);

    const manual = await flightSearchService.getOfferById('man-flt-cmb-mle-q2701');
    assert.ok(manual);
    const manualCandidate = flightTripBucketService.addFlightToTripBucket(
      manual,
      undefined,
      searchRequest(
        'tripType=one_way&origin=CMB&destination=MLE&departureDate=2026-11-20&adults=1&cabinClass=economy'
      )
    );
    assert.equal(tripBucketService.getItems().length, 2);
    assert.equal(manualCandidate.state, 'needs_action');
    assert.equal(manualCandidate.inventoryMode, 'manual_request');
    assert.ok(manualCandidate.dateSummary?.includes('schedule pending desk confirmation'));
  });

  await t.test('Phase 5 Gate 7: Revalidation never promotes demo or manual inventory', async () => {
    tripBucketService.replaceCandidates([]);

    const demo = await flightSearchService.getOfferById('sup-flt-cmb-dxb-fz548');
    assert.ok(demo);
    const demoConfig: FlightConfigurationSelection = {
      offerId: demo.offerId,
      selectedFareFamilyCode: 'value',
      selectedCabinClass: demo.cabinClass,
      selectedOptionalServiceIds: []
    };
    const demoCandidate = flightTripBucketService.addFlightToTripBucket(
      demo,
      demoConfig,
      searchRequest()
    );

    const demoRevalidation = await flightTripBucketService.revalidateFlightInTripBucket(
      demoCandidate.id,
      demo.offerId
    );
    assert.equal(demoRevalidation.status, 'UNCHANGED');
    const demoAfter = tripBucketService.getItems().find(item => item.id === demoCandidate.id)!;
    assert.equal(demoAfter.state, 'needs_action');
    assert.equal(demoAfter.confirmationMode, 'REQUEST_TO_CONFIRM');
    assert.equal(demoAfter.revalidationStatus, 'UNCHANGED');
    assert.ok(demoAfter.revalidatedAt);
    assert.ok(demoAfter.holdStatusText?.toLowerCase().includes('demo fixture checked locally'));
    assert.ok(demoAfter.actionRequiredText?.toLowerCase().includes('no live airline'));

    const demoResolved = tripBucketService.resolveItemAction(demoAfter.id);
    assert.equal(demoResolved?.state, 'needs_action');
    const demoNeedsAction = tripBucketService.resolveNeedsAction(demoAfter.id);
    assert.equal(demoNeedsAction?.state, 'needs_action');

    const manual = await flightSearchService.getOfferById('man-flt-cmb-dxb-ek651');
    assert.ok(manual);
    const manualCandidate = flightTripBucketService.addFlightToTripBucket(
      manual,
      undefined,
      searchRequest()
    );
    const manualRevalidation = await flightTripBucketService.revalidateFlightInTripBucket(
      manualCandidate.id,
      manual.offerId
    );
    assert.equal(manualRevalidation.status, 'UNCHANGED');
    const manualAfter = tripBucketService.getItems().find(item => item.id === manualCandidate.id)!;
    assert.equal(manualAfter.state, 'needs_action');
    assert.equal(manualAfter.inventoryMode, 'manual_request');
    assert.equal(manualAfter.revalidationStatus, 'UNCHANGED');
    assert.ok(manualAfter.actionRequiredText?.toLowerCase().includes('desk must confirm'));
    assert.equal(tripBucketService.resolveItemAction(manualAfter.id)?.state, 'needs_action');
    assert.equal(tripBucketService.resolveNeedsAction(manualAfter.id)?.state, 'needs_action');

    const priceChanged = await flightSearchService.getOfferById('sup-flt-price-changed-sim');
    assert.ok(priceChanged);
    const priceCandidate = flightTripBucketService.addFlightToTripBucket(
      priceChanged,
      {
        offerId: priceChanged.offerId,
        selectedFareFamilyCode: priceChanged.fareFamiliesAvailable[0]?.familyCode || 'standard',
        selectedCabinClass: priceChanged.cabinClass,
        selectedOptionalServiceIds: []
      },
      searchRequest()
    );
    assert.equal(priceCandidate.state, 'price_changed');
    const priceRevalidation = await flightTripBucketService.revalidateFlightInTripBucket(
      priceCandidate.id,
      priceChanged.offerId
    );
    assert.equal(priceRevalidation.status, 'PRICE_CHANGED');
    const priceAfter = tripBucketService.getItems().find(item => item.id === priceCandidate.id)!;
    assert.equal(priceAfter.state, 'price_changed');
    assert.equal(
      priceAfter.priceLkr,
      Math.round(priceRevalidation.newPriceMinor / 100)
    );
    assert.ok(priceAfter.previousPriceLkr && priceAfter.previousPriceLkr > 0);
    assert.equal(priceAfter.primaryActionLabel, 'Accept Price & Proceed');
  });

  await t.test('Phase 5 Gate 8: Local review handoff and non-live checkout gating', () => {
    const demo = reviewCandidate({
      id: 'tb-demo-review',
      state: 'needs_action',
      inventoryMode: 'demo_fixture',
      confirmationMode: 'REQUEST_TO_CONFIRM'
    });
    const manual = reviewCandidate({
      id: 'tb-manual-review',
      state: 'needs_action',
      inventoryMode: 'manual_request',
      confirmationMode: 'REQUEST_TO_CONFIRM'
    });
    const liveReady = reviewCandidate({
      id: 'tb-live-ready',
      state: 'ready',
      inventoryMode: 'live_supplier',
      confirmationMode: 'INSTANT_CONFIRM'
    });
    const demoReady = reviewCandidate({
      id: 'tb-demo-ready',
      state: 'ready',
      inventoryMode: 'demo_fixture',
      confirmationMode: 'INSTANT_CONFIRM'
    });
    const livePending = reviewCandidate({
      id: 'tb-live-pending',
      state: 'ready',
      inventoryMode: 'live_supplier',
      confirmationMode: 'REQUEST_TO_CONFIRM'
    });

    const mixed = evaluateTripReviewHandoff([demo, manual]);
    assert.equal(mixed.canCheckout, false);
    assert.equal(mixed.nonLiveCount, 2);
    assert.equal(mixed.blockedItems.length, 2);
    assert.ok(mixed.blockers.find(entry => entry.id === demo.id)?.blockers.some(reason => reason.includes('Demo fixture')));
    assert.ok(mixed.blockers.find(entry => entry.id === manual.id)?.blockers.some(reason => reason.includes('Manual request-to-book')));

    const live = evaluateTripReviewHandoff([liveReady]);
    assert.equal(live.canCheckout, true);
    assert.equal(live.nonLiveCount, 0);
    assert.equal(live.blockedItems.length, 0);

    const readyButDemo = evaluateTripReviewHandoff([demoReady]);
    assert.equal(readyButDemo.canCheckout, false);
    assert.ok(readyButDemo.blockers[0].blockers.some(reason => reason.includes('Demo fixture')));

    const confirmationPending = evaluateTripReviewHandoff([livePending]);
    assert.equal(confirmationPending.canCheckout, false);
    assert.ok(confirmationPending.blockers[0].blockers.some(reason => reason.includes('Supplier confirmation required')));

    const empty = evaluateTripReviewHandoff([]);
    assert.equal(empty.canCheckout, false);
    assert.equal(empty.blockedItems.length, 0);

    const reviewSearch = buildFlightSearchQuery(searchRequest());
    rememberFlightSearchQuery(reviewSearch);
    assert.equal(getLastFlightSearchQuery(), reviewSearch);

    tripBucketService.replaceCandidates([]);
  });
});
