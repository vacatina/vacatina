import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchCommandService, LOCKED_11_TAB_ORDER } from '../src/lib/services/search.service.ts';
import { buildCommandCenterHandoff, SCC_FIELD_KEYS } from '../src/components/search-command-center/journey-handoff.ts';
import { JOURNEY_DEMO_OFFERS } from '../src/features/journeys/data/demo-offers.ts';
import { journeyConfigurationFromQuery, journeyProductDetails } from '../src/features/journeys/domain/journey-models.ts';
import { journeyService, syncServerTripBucketSnapshot } from '../src/features/journeys/services/journey-service.ts';
import { tripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { flightSearchService } from '../src/features/flights/services/flight-search.service.ts';
import { flightTripBucketService } from '../src/features/flights/services/flight-trip-bucket.service.ts';
import { hotelSearchService } from '../src/features/hotels/services/hotel-search.service.ts';
import { hotelTripBucketService } from '../src/features/hotels/services/hotel-trip-bucket.service.ts';
import { visaSearchService } from '../src/features/visa/services/visa-search.service.ts';
import { visaTripBucketService } from '../src/features/visa/services/visa-trip-bucket.service.ts';
import { visaContextFromQuery } from '../src/features/visa/domain/visa-journey.ts';
import { revalidateStagedTrip } from '../src/features/trip-review/trip-revalidation.service.ts';
import { evaluateTripReviewHandoff, reviewDetailHref } from '../src/features/trip-review/trip-review-workspace.ts';
import { bundleItemsFromSnapshots, bundleItemPrice } from '../src/features/bundle/bundle-workspace.ts';
import type { JourneyBucketItem } from '../src/features/journeys/services/journey-service.ts';
import type { TripBucketCandidate } from '../src/lib/domain/types.ts';

test('Phase 17 bundle merges local requests without replacing server authority or inventing free prices', () => {
  const server: JourneyBucketItem = { id: 'shared-item', canonicalOfferId: 'server-offer', title: 'Server selection', productType: 'hotels', state: 'NEEDS_ACTION', configuration: {}, unitSellingPriceMinor: 12345, currency: 'LKR' };
  const local: TripBucketCandidate = { id: 'local-request', offerId: 'DEMO-activities-planning-v1', title: 'Local activity request', productType: 'activities', productLabel: 'Activities', subtitle: 'Local planning request', dateSummary: '2027-02-01', travellerSummary: '2 adults', supplierName: 'Canonical demo catalog', integrationMode: 'MOCK', state: 'ready', inventoryMode: 'demo_fixture', priceStatus: 'quote_required', priceLkr: 0, currency: 'LKR', configuration: { departureDate: '2027-02-01' }, travellerCounts: { adults: 2, children: 0, infants: 0 } };
  const duplicate = { ...local, id: server.id, title: 'Stale local copy' };
  const items = bundleItemsFromSnapshots([server], [duplicate, local]);
  assert.equal(items.length, 2);
  assert.equal(items[0], server, 'The authoritative server item must win by identity.');
  assert.equal(items[1].state, 'NEEDS_ACTION', 'Local demo inventory can never make a bundle Ready.');
  assert.equal(items[1].configuration.adults, 2);
  assert.equal(items[1].configuration.departureDate, '2027-02-01');
  assert.equal(bundleItemPrice(items[1]), 'Quote required');
  assert.deepEqual(bundleItemsFromSnapshots([], [local]), [items[1]], 'The local request survives an empty server bucket.');
});

test('Phase 17 bundle displays native-currency minor units rather than an LKR shadow', () => {
  const sandbox = { id: 'sandbox-quote', title: 'Duffel TEST MODE quote', productType: 'flights', state: 'needs_action', inventoryMode: 'sandbox_test', priceLkr: 0, amountMinor: 24929, currency: 'USD', priceStatus: 'quoted' } as TripBucketCandidate;
  const [item] = bundleItemsFromSnapshots([], [sandbox]);
  assert.equal(item.unitSellingPriceMinor, 24929);
  assert.equal(item.state, 'NEEDS_ACTION');
  assert.match(bundleItemPrice(item), /249[.,]29/);
  assert.equal(sandbox.priceLkr, 0, 'Rendering must not alter the local candidate.');
});

test('All 11 SCC tabs validate, preserve product intent and use canonical destinations', () => {
  const service = new SearchCommandService();
  const routeMap: Record<string, string> = { bundle: '/trip-builder', flights: '/flights', hotels: '/hotels', visa: '/visa-assistance', packages: '/holiday-packages', cars: '/cars-transfers', rails: '/rails', cruises: '/cruises', activities: '/activities', sightseeing: '/sightseeing-tours', insurance: '/travel-insurance' };
  for (const tab of LOCKED_11_TAB_ORDER) {
    const handoff = buildCommandCenterHandoff(tab.id, service.getState());
    assert.deepEqual(handoff.errors, [], `${tab.id}: ${handoff.errors.join(' ')}`);
    assert.ok(handoff.url.startsWith(routeMap[tab.id]));
    const query = new URL(handoff.url, 'https://vacatina.example').searchParams;
    assert.equal(query.get('adults'), '1');
    const field = Object.values(SCC_FIELD_KEYS[tab.id])[0];
    const value = (service.getState()[tab.id] as any)[field];
    service.updateField(tab.id, field, '');
    assert.ok(buildCommandCenterHandoff(tab.id, service.getState()).errors.length, `${tab.id} must reject cleared required fields`);
    service.updateField(tab.id, field, value);
  }
  const hotel = new URL(buildCommandCenterHandoff('hotels', service.getState()).url, 'https://vacatina.example');
  assert.equal(hotel.searchParams.get('checkIn'), '2026-11-13');
  const car = new URL(buildCommandCenterHandoff('cars', service.getState()).url, 'https://vacatina.example');
  assert.equal(car.searchParams.get('pickupTime'), '14:30');
  assert.equal(car.searchParams.get('dropoff'), service.getState().cars.dropoff);
  for (const tab of ['packages', 'cruises'] as const) {
    const query = new URL(buildCommandCenterHandoff(tab, service.getState()).url, 'https://vacatina.example').searchParams;
    assert.ok(query.get('travelWindow')); assert.equal(query.has('departureDate'), false, 'Never invent a precise date from a month/season');
  }
});

test('Mixed 10-product Trip Bucket retains configuration, source, freshness, local revalidation and blocked checkout', async () => {
  tripBucketService.replaceCandidates([]);
  for (const offer of JOURNEY_DEMO_OFFERS) {
    const config = journeyConfigurationFromQuery(new URLSearchParams({ destination: offer.location!.city!, origin: 'Colombo', departureDate: '2027-02-01', returnDate: '2027-02-03', returnTime: '16:00', pickup: 'Airport', dropoff: 'Hotel request', pickupTime: '14:30', adults: '2', travellerAges: '32,30', residenceCountry: 'LK', cabinClass: 'standard', departurePort: 'Port request' }));
    config.policyReviewAcknowledged = true;
    const details = journeyProductDetails(offer);
    for (const [source, key] of [['packageStyles', 'packageStyle'], ['accommodationTiers', 'accommodationTier'], ['vehicleCategories', 'vehicleCategory'], ['ticketTypes', 'ticketType'], ['timeSlots', 'timeSlot'], ['languages', 'language'], ['cabinCategories', 'cabinType'], ['coverageOptions', 'coverageOption']] as const) {
      const option = (details[source] as any[])?.[0]; if (option) (config as any)[key] = typeof option === 'string' ? option : option.id;
    }
    await journeyService.stage(offer, config);
  }
  const flight = await flightSearchService.getOfferById('sup-flt-cmb-dxb-fz548'); assert.ok(flight);
  flightTripBucketService.addFlightToTripBucket(flight);
  const hotel = await hotelSearchService.getOfferById('vct-dir-bentota-ocean-villa'); assert.ok(hotel);
  const room = hotel.roomCategories[0], plan = room.ratePlans[0];
  await hotelTripBucketService.stageHotelRoom(hotel, { hotelId: hotel.hotelId, canonicalOfferId: hotel.canonicalOfferId, roomId: room.roomId, roomName: room.name, planId: plan.planId, rateName: plan.rateName, boardBasis: plan.boardBasis, boardBasisLabel: plan.boardBasisLabel, checkInDate: '2027-02-01', checkOutDate: '2027-02-03', nights: 2, roomsCount: 1, adultsCount: 2, childrenCount: 0, nightlyRateMinor: plan.nightlyRateMinor, taxesMinor: plan.totalTaxesMinor, totalPriceMinor: plan.totalPriceMinor * 2, currency: plan.currency, cancellationPolicyDescription: plan.cancellationPolicyDescription, sourceType: hotel.sourceType, supplierName: hotel.supplierName });
  const visa = await visaSearchService.getOfferById('vct-vs-consular-ae-30d'); assert.ok(visa);
  await visaTripBucketService.stageVisaApplication({ ...visa, inventoryMode: 'demo_fixture' }, { visaId: visa.visaId, canonicalOfferId: visa.canonicalOfferId, countryName: visa.countryName, countryCode: visa.countryCode, visaType: visa.title, category: visa.category, entryType: visa.entryType, durationDays: visa.durationDays, processingSlaDays: visa.processingSlaBusinessDays, travelDate: '2027-02-01', pricing: visa.pricing, sourceType: visa.sourceType, supplierName: visa.supplierName, journeyContext: visaContextFromQuery(new URLSearchParams('destination=United+Arab+Emirates&citizenship=LK&residenceCountry=LK&purpose=tourism&departureDate=2027-02-01&applicants=2')), applicant: { fullName: '2 applicants', passportNumber: '', passportExpiryDate: '', nationality: 'LK', email: '', phone: '', travelDate: '2027-02-01', uploadedDocumentCount: 0 } });
  const before = tripBucketService.getItems();
  assert.equal(new Set(before.map(i => i.productType)).size, 10);
  assert.ok(before.every(item => item.offerId && item.inventoryMode && item.state === 'needs_action'));
  const hotelHref = new URL(reviewDetailHref(before.find(i => i.productType === 'hotels')!)!, 'https://vacatina.example');
  assert.equal(hotelHref.searchParams.get('checkIn'), '2027-02-01');
  assert.equal(hotelHref.searchParams.get('rooms'), '1');
  syncServerTripBucketSnapshot({ bucketId: 'empty-server', currency: 'LKR', items: [] });
  assert.equal(tripBucketService.getItems().length, before.length, 'Server snapshots must not erase local planning requests');
  await revalidateStagedTrip();
  const after = tripBucketService.getItems();
  assert.equal(after.length, before.length);
  for (const saved of after) {
    assert.deepEqual(saved.configuration, before.find(item => item.id === saved.id)?.configuration);
    assert.equal(saved.state, 'needs_action'); assert.ok(saved.revalidatedAt);
    assert.equal(tripBucketService.confirmOnRequestAllocation(saved.id, 'UNVERIFIED-REFERENCE')?.state, 'needs_action');
  }
  assert.equal(evaluateTripReviewHandoff(after).canCheckout, false);
  const snapshot = tripBucketService.getItems(); snapshot.find(i => i.productType === 'cars')!.configuration!.pickup = 'tampered';
  assert.notEqual(tripBucketService.getItems().find(i => i.productType === 'cars')!.configuration!.pickup, 'tampered');
  tripBucketService.replaceCandidates(after.map(item => ({ ...item, state: 'ready' })));
  assert.ok(tripBucketService.getItems().every(item => item.state === 'needs_action'));
});
