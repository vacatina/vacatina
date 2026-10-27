import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHotelQuery, hotelQuery, validateHotelSearch } from '../src/features/hotels/domain/hotel-journey.ts';
import { hotelSearchService } from '../src/features/hotels/services/hotel-search.service.ts';
import { hotelTripBucketService } from '../src/features/hotels/services/hotel-trip-bucket.service.ts';
import { tripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { evaluateTripReviewHandoff } from '../src/features/trip-review/trip-review-workspace.ts';

test('Hotels Phase 6: canonical query, occupancy and date validation', () => {
  const request = parseHotelQuery(new URLSearchParams('destination=Bentota&checkIn=2027-02-01&checkOut=2027-02-04&rooms=2&adults=4&children=1'));
  assert.deepEqual(validateHotelSearch(request), []);
  assert.deepEqual(parseHotelQuery(new URLSearchParams(hotelQuery(request))).occupancy, request.occupancy);
  for (const query of ['checkIn=2027-02-30', 'checkOut=2020-01-01', 'rooms=0', 'adults=-1', 'children=NaN', 'destination=']) {
    const params = new URLSearchParams('destination=Bentota&checkIn=2027-02-01&checkOut=2027-02-04');
    const [key, value] = query.split('='); params.set(key, value);
    assert.ok(validateHotelSearch(parseHotelQuery(params)).length);
  }
});

test('Hotels Phase 6: labelled search, empty state and invalid identity', async () => {
  const request = parseHotelQuery(new URLSearchParams('destination=Dubai'));
  const response = await hotelSearchService.search(request);
  assert.ok(response.offers.length >= 2);
  assert.ok(response.offers.every(o => o.inventoryMode === 'demo_fixture' && !o.canonicalOfferId.startsWith('SEED-')));
  assert.equal((await hotelSearchService.search({ ...request, destination: 'No-Such-Destination' })).offers.length, 0);
  assert.equal(await hotelSearchService.getOfferById('missing-phase6'), null);
});

test('Hotels Phase 6: configured multi-room totals, provenance, revalidation and checkout gate', async () => {
  tripBucketService.replaceCandidates([]);
  const hotel = await hotelSearchService.getOfferById('vct-dir-bentota-ocean-villa');
  assert.ok(hotel);
  const room = hotel.roomCategories[0]; const plan = room.ratePlans[0];
  const config = { hotelId: hotel.hotelId, canonicalOfferId: hotel.canonicalOfferId, roomId: room.roomId, roomName: room.name, planId: plan.planId, rateName: plan.rateName, boardBasis: plan.boardBasis, boardBasisLabel: plan.boardBasisLabel, checkInDate: '2027-02-01', checkOutDate: '2027-02-04', nights: 3, roomsCount: 2, adultsCount: 2, childrenCount: 0, nightlyRateMinor: plan.nightlyRateMinor, taxesMinor: plan.totalTaxesMinor, totalPriceMinor: plan.totalPriceMinor * 6, currency: plan.currency, cancellationPolicyDescription: plan.cancellationPolicyDescription, sourceType: hotel.sourceType, supplierName: hotel.supplierName };
  const result = await hotelTripBucketService.stageHotelRoom(hotel, config);
  const saved = tripBucketService.getItems()[0];
  assert.equal(saved.id, result.candidate.id);
  assert.equal(saved.offerId, hotel.canonicalOfferId);
  assert.equal(saved.propertyId, hotel.hotelId);
  assert.equal(saved.priceLkr, config.totalPriceMinor / 100);
  assert.deepEqual(saved.configuration, config);
  assert.equal(saved.state, 'needs_action');
  assert.equal(saved.inventoryMode, 'demo_fixture');
  assert.equal(saved.revalidationStatus, 'LOCAL_FIXTURE_AVAILABLE');
  assert.equal(tripBucketService.resolveItemAction(saved.id)?.state, 'needs_action');
  assert.equal(evaluateTripReviewHandoff([saved]).canCheckout, false);
  await assert.rejects(hotelTripBucketService.stageHotelRoom(hotel, { ...config, roomId: 'missing' }));
});
