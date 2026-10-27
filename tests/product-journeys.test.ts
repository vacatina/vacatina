import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateBundleReadiness, findJourneyProduct, isJourneyDate, journeyConfigurationFromQuery,
  journeyEscape, journeyOfferAmount, validateJourneyConfiguration
} from '../src/features/journeys/domain/journey-models.ts';
import type { JourneyOffer } from '../src/features/journeys/domain/journey-models.ts';
import { JourneyService } from '../src/features/journeys/services/journey-service.ts';

const validJourney = () => journeyConfigurationFromQuery(new URLSearchParams({
  destination: 'Dubai', departureDate: '2027-02-01', returnDate: '2027-02-07', adults: '2', children: '1', infants: '0', rooms: '1',
  origin: 'CMB', pickup: 'DXB Terminal 1', dropoff: 'Dubai Marina', pickupTime: '14:30', luggage: '2'
}));

test('Product configuration rejects impossible dates, passenger counts, and missing transfer logistics', () => {
  assert.equal(isJourneyDate('2027-02-29'), false);
  assert.equal(isJourneyDate('2028-02-29'), true);
  assert.deepEqual(validateJourneyConfiguration('packages', validJourney()), {});
  assert.ok(validateJourneyConfiguration('packages', { ...validJourney(), returnDate: '2027-01-31' }).returnDate);
  assert.ok(validateJourneyConfiguration('packages', { ...validJourney(), adults: 0 }).adults);
  assert.ok(validateJourneyConfiguration('packages', { ...validJourney(), infants: 3 }).adults);
  assert.ok(validateJourneyConfiguration('packages', { ...validJourney(), adults: 9, children: 1 }).adults);
  assert.ok(validateJourneyConfiguration('cars', { ...validJourney(), pickup: '', pickupTime: '25:01' }).pickup);
  assert.ok(validateJourneyConfiguration('cars', { ...validJourney(), pickupTime: '25:01' }).pickupTime);
  assert.deepEqual(validateJourneyConfiguration('cars', validJourney()), {});
});

test('Separate products retain distinct published option and policy requirements', () => {
  assert.equal(findJourneyProduct('/sightseeing-tours/search')?.productType, 'sightseeing');
  assert.equal(findJourneyProduct('/activities/search')?.productType, 'activities');
  assert.equal(findJourneyProduct('/travel-insurance/compare')?.productType, 'insurance');
  assert.equal(findJourneyProduct('/activities-fake'), undefined);
  assert.ok(validateJourneyConfiguration('activities', validJourney(), true).timeSlot);
  assert.ok(validateJourneyConfiguration('cruises', validJourney(), true).cabinType);
  assert.ok(validateJourneyConfiguration('insurance', { ...validJourney(), travellerAges: '35, 33', residenceCountry: 'LK' }).travellerAges);
  assert.deepEqual(validateJourneyConfiguration('insurance', { ...validJourney(), travellerAges: '35, 33, 7', residenceCountry: 'LK' }), {});
});

test('A bundle is never Ready from mere product presence or mismatched dates/party', () => {
  const journey = validJourney();
  const flights = { id: 'flight-1', productType: 'flights', state: 'READY', configuration: { ...journey } };
  const hotels = { id: 'hotel-1', productType: 'hotels', state: 'READY', configuration: { ...journey } };
  const cars = { id: 'car-1', productType: 'cars', state: 'READY', configuration: { ...journey, departureDate: '2027-02-02' } };
  assert.equal(evaluateBundleReadiness(['flights', 'hotels', 'cars'], [flights, hotels, cars], journey).ready, true);
  assert.equal(evaluateBundleReadiness(['flights', 'hotels', 'cars'], [flights, hotels], journey).ready, false);
  assert.deepEqual(evaluateBundleReadiness(['flights', 'hotels'], [flights, { ...hotels, configuration: {} }], journey).conflicts, ['hotels']);
  assert.equal(evaluateBundleReadiness(['flights', 'hotels'], [flights, { ...hotels, state: 'NEEDS_ACTION' }], journey).ready, false);
  assert.equal(evaluateBundleReadiness(['flights', 'hotels'], [flights, { ...hotels, configuration: { ...journey, adults: 3 } }], journey).ready, false);
  assert.equal(evaluateBundleReadiness(['flights'], [flights], journey).ready, false);
});

test('Customer display keeps integer-minor precision and escapes untrusted supplier text', () => {
  const offer = { pricing: { finalSellingPriceMinor: 12345, currency: 'LKR' } } as JourneyOffer;
  assert.equal(journeyOfferAmount(offer), 123.45);
  assert.equal(journeyEscape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('Product staging sends identity and user configuration only; no client asserted price, provenance, or readiness', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const service = new JourneyService(async <T>(path: string, options?: RequestInit): Promise<T> => {
    const body = JSON.parse(String(options?.body || '{}'));
    calls.push({ path, body });
    return { item: { id: 'server-item', canonicalOfferId: body.canonicalOfferId, state: 'READY' } } as T;
  });
  const offer: JourneyOffer = { offerId: 'vct-package-1', productType: 'packages', title: 'A verified package', availabilityStatus: 'AVAILABLE', price: 1 };
  await service.stage(offer, validJourney());
  assert.equal(calls[0].path, '/api/v1/trip-buckets/items');
  assert.equal(calls[0].body.canonicalOfferId, 'vct-package-1');
  for (const key of ['state', 'price', 'sellingPrice', 'unitSellingPriceMinor', 'sourceType', 'productType']) assert.equal(key in calls[0].body, false);
  await assert.rejects(service.stage(offer, { ...validJourney(), adults: 0 }));
  assert.equal(calls.length, 1, 'Invalid input must not reach the server.');
});
