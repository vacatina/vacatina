import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_DEMO_OFFERS } from '../src/features/journeys/data/demo-offers.ts';
import { JourneyService } from '../src/features/journeys/services/journey-service.ts';
import { journeyConfigurationFromQuery, journeyProductDetails, journeyOfferId, validateJourneyConfiguration, findJourneyProduct } from '../src/features/journeys/domain/journey-models.ts';
import { tripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { evaluateTripReviewHandoff } from '../src/features/trip-review/trip-review-workspace.ts';

test('Cars Phase 9: car hire and return transfers retain distinct mandatory logistics', () => {
  const config = journeyConfigurationFromQuery(new URLSearchParams('destination=Dubai&departureDate=2027-02-01&returnDate=2027-02-05&pickup=DXB&dropoff=Marina&pickupTime=14:30&returnTime=16:00&adults=2'));
  assert.deepEqual(validateJourneyConfiguration('cars', config, true), {});
  assert.ok(validateJourneyConfiguration('cars', { ...config, returnTime: '' }, true).returnTime);
  assert.ok(validateJourneyConfiguration('cars', { ...config, pickup: '' }, true).pickup);
  assert.ok(validateJourneyConfiguration('cars', { ...config, dropoff: '' }, true).dropoff);
  assert.ok(validateJourneyConfiguration('cars', { ...config, serviceType: 'car-hire', driverAge: 17 }, true).driverAge);
  assert.deepEqual(validateJourneyConfiguration('cars', { ...config, serviceType: 'car-hire', driverAge: 30 }, true), {});
  assert.deepEqual(validateJourneyConfiguration('cars', { ...config, tripType: 'one_way', returnDate: '', returnTime: '' }, true), {});
});

for (const offer of JOURNEY_DEMO_OFFERS) {
  test(`${offer.productType} B2C phase: validation, search, canonical configuration, provenance, revalidation and review`, async () => {
    let calls = 0;
    const service = new JourneyService(async () => { calls++; throw new Error('Demo journeys must not call a supplier or server booking API'); });
    const config = journeyConfigurationFromQuery(new URLSearchParams({ destination: offer.location?.city || '', origin: 'Colombo', departureDate: '2027-02-01', returnDate: '2027-02-05', returnTime: '15:30', adults: '2', rooms: '1', pickup: 'Airport pickup request', dropoff: 'Hotel drop-off request', pickupTime: '14:30', travellerAges: '32,30', residenceCountry: 'LK', cabinClass: 'standard', durationDays: '5' }));
    assert.deepEqual(validateJourneyConfiguration(offer.productType, config), {});
    await assert.rejects(service.search(offer.productType, { ...config, departureDate: 'invalid' }, 'demo_fixture'));
    const response = await service.search(offer.productType, config, 'demo_fixture');
    assert.equal(response.offers.length, 1);
    assert.equal(findJourneyProduct(offer.productType)?.productType, offer.productType);
    assert.equal((await service.search(offer.productType, { ...config, destination: 'No-Such-Destination' }, 'demo_fixture')).offers.length, 0);
    const canonical = (await service.getOffer(journeyOfferId(offer))).offer;
    assert.equal(canonical.inventoryMode, 'demo_fixture'); assert.equal(canonical.sellable, false);
    assert.equal(canonical.priceStatus, 'quote_required');
    await assert.rejects(service.getOffer(`DEMO-${offer.productType}-missing`));
    const details = journeyProductDetails(canonical);
    const fields = [['packageStyles', 'packageStyle'], ['accommodationTiers', 'accommodationTier'], ['vehicleCategories', 'vehicleCategory'], ['ticketTypes', 'ticketType'], ['timeSlots', 'timeSlot'], ['languages', 'language'], ['cabinCategories', 'cabinType'], ['coverageOptions', 'coverageOption']] as const;
    for (const [source, key] of fields) {
      const options = details[source] as Array<string | { id: string }> | undefined;
      if (options?.length) (config as any)[key] = typeof options[0] === 'string' ? options[0] : options[0].id;
    }
    tripBucketService.replaceCandidates([]);
    const { item } = await service.stage(canonical, config);
    assert.equal(item.canonicalOfferId, journeyOfferId(offer));
    const saved = tripBucketService.getItems()[0];
    assert.deepEqual(saved.configuration, config);
    assert.equal(saved.sourceId, 'VACATINA_LOCAL_DEMO');
    assert.equal(saved.inventoryMode, 'demo_fixture'); assert.equal(saved.state, 'needs_action');
    assert.equal(saved.confirmationMode, 'REQUEST_TO_CONFIRM'); assert.equal(saved.priceLkr, 0);
    assert.ok(saved.revalidatedAt); assert.ok(saved.validUntil);
    assert.equal((await service.revalidate(item.canonicalOfferId)).status, 'UNCHANGED');
    assert.equal(tripBucketService.resolveNeedsAction(saved.id)?.state, 'needs_action');
    assert.equal(tripBucketService.resolveItemAction(saved.id)?.state, 'needs_action');
    assert.equal(evaluateTripReviewHandoff([saved]).canCheckout, false);
    await assert.rejects(service.stage(canonical, { ...config, destination: 'Unrelated' }));
    for (const [source, key] of fields) {
      if (Array.isArray(details[source])) await assert.rejects(service.stage(canonical, { ...config, [key]: 'invented-option' }));
    }
    assert.equal(calls, 0);
  });
}
