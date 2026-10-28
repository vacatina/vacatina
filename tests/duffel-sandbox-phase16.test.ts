/* ============================================================================
 * Vacatina Phase 16 — Duffel TEST MODE Sandbox Journey Suite
 *
 * All Duffel HTTP is injected and deterministic. These tests never contact the
 * real Duffel API, never use a real credential, and assert that sandbox data can
 * never be represented as live/production inventory.
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FlightsDuffelAdapter,
  detectDuffelEnvironment,
  resolveCanonicalDuffelToken,
  type RawDuffelFlightOffer
} from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import {
  DuffelApiError,
  DuffelClient,
  type DuffelOrder
} from '../src/server/inventory/suppliers/duffel/duffel-client.ts';
import {
  DuffelSandboxError,
  DuffelSandboxService,
  setDuffelSandboxServiceForTests
} from '../src/server/inventory/suppliers/duffel/duffel-sandbox.service.ts';
import {
  configureDuffelSandboxRuntimeForTests,
  getDuffelTestModeStatus,
  resetDuffelSandboxRuntimeForTests,
  resolveDuffelTestModeConfig
} from '../src/server/inventory/suppliers/duffel/duffel-runtime.ts';
import { validateServerEnv } from '../src/server/config/env.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { customerContext } from './support/canonical-fixtures.ts';
import { customerSandboxOffer } from '../src/server/api/customer-offer.ts';
import {
  buildFlightSearchQuery,
  parseFlightSearchQuery
} from '../src/features/flights/domain/flight-search-query.ts';
import { resolveFlightInventoryTruth } from '../src/features/flights/domain/flight-inventory-truth.ts';
import { flightSearchService } from '../src/features/flights/services/flight-search.service.ts';
import { flightTripBucketService } from '../src/features/flights/services/flight-trip-bucket.service.ts';
import { mapSandboxOffer } from '../src/features/flights/adapters/duffel-sandbox-flight.adapter.ts';
import { evaluateTripReviewHandoff } from '../src/features/trip-review/trip-review-workspace.ts';
import { computeTripBucketSummary, tripBucketService } from '../src/lib/services/trip-bucket.service.ts';

const NOW = Date.now();
const DEPARTURE = new Date(NOW + 7 * 86400000).toISOString().slice(0, 10);
const FUTURE = new Date(NOW + 3600000).toISOString();
const PAST = new Date(NOW - 60000).toISOString();
const OFFER_ID = 'off_sbox_phase16_0001';
const OFFER_REQUEST_ID = 'orq_phase16_0001';
const FAKE_TOKEN = 'duffel_test_phase16_fixture_only';

interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

function fakeFetch(handler: (call: FakeCall) => Response | Promise<Response>): {
  impl: typeof fetch;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    let body: any;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }
    const call: FakeCall = { url, method, headers, body };
    calls.push(call);
    return handler(call);
  };
  return { impl: impl as typeof fetch, calls };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function providerError(status: number, type: string, code: string, rawMessage: string): Response {
  return new Response(JSON.stringify({ errors: [{ type, code, message: rawMessage }] }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function rawOffer(options: {
  total?: string;
  liveMode?: boolean;
  expiresAt?: string;
  offerId?: string;
} = {}): RawDuffelFlightOffer {
  return {
    id: options.offerId || OFFER_ID,
    total_amount: options.total || '420.50',
    total_currency: 'USD',
    live_mode: options.liveMode ?? false,
    expires_at: options.expiresAt || FUTURE,
    owner: { iata_code: 'ZZ', name: 'Duffel Airways' },
    slices: [{
      id: 'sli_phase16',
      fare_brand_name: 'Economy Standard',
      origin: { iata_code: 'CMB', city_name: 'Colombo', country_name: 'Sri Lanka' },
      destination: { iata_code: 'DXB', city_name: 'Dubai', country_name: 'United Arab Emirates' },
      departing_at: `${DEPARTURE}T08:00:00`,
      arriving_at: `${DEPARTURE}T11:30:00`,
      duration: 'PT3H30M',
      segments: [{
        id: 'seg_phase16',
        marketing_carrier: { iata_code: 'ZZ', name: 'Duffel Airways' },
        marketing_carrier_flight_number: '100',
        operating_carrier: { iata_code: 'ZZ', name: 'Duffel Airways' },
        origin: { iata_code: 'CMB', city_name: 'Colombo', name: 'Bandaranaike International' },
        destination: { iata_code: 'DXB', city_name: 'Dubai', name: 'Dubai International' },
        departing_at: `${DEPARTURE}T08:00:00`,
        arriving_at: `${DEPARTURE}T11:30:00`,
        duration: 'PT3H30M',
        aircraft: { name: 'Airbus A320' },
        passengers: [{
          passenger_id: 'pas_1',
          cabin_class: 'economy',
          fare_basis_code: 'Y',
          baggages: [{ type: 'checked', quantity: 1 }, { type: 'carry_on', quantity: 1 }]
        }]
      }]
    }],
    passengers: [{ id: 'pas_1', type: 'adult' }],
    available_services: [{
      id: 'svc_bag_1',
      type: 'baggage',
      total_amount: '30.00',
      total_currency: 'USD',
      maximum_quantity: 2,
      passenger_ids: ['pas_1'],
      metadata: { type: 'checked', maximum_weight_kg: 23 }
    }],
    conditions: {
      refund_before_departure: { allowed: true, penalty_amount: '50.00', penalty_currency: 'USD' },
      change_before_departure: { allowed: true, penalty_amount: '25.00', penalty_currency: 'USD' }
    }
  };
}

function offerRequestResponse(offer: RawDuffelFlightOffer = rawOffer()): Response {
  return jsonResponse({
    id: OFFER_REQUEST_ID,
    live_mode: false,
    created_at: new Date(NOW).toISOString(),
    offers: [offer]
  });
}

test('Phase 17 sandbox round-trip cards use segment schedules and do not count the return as a stop', () => {
  const raw = rawOffer();
  delete raw.slices[0].departing_at;
  delete raw.slices[0].arriving_at;
  const inbound = structuredClone(raw.slices[0]);
  inbound.id = 'sli_phase17_return';
  [inbound.origin, inbound.destination] = [inbound.destination, inbound.origin];
  const inboundSegment = inbound.segments[0];
  [inboundSegment.origin, inboundSegment.destination] = [inboundSegment.destination, inboundSegment.origin];
  inboundSegment.departing_at = `${DEPARTURE}T16:15:00`;
  inboundSegment.arriving_at = `${DEPARTURE}T22:43:00`;
  raw.slices.push(inbound);
  const adapter = new FlightsDuffelAdapter({ enableTestMode: true, apiToken: FAKE_TOKEN, environment: 'sandbox' });
  const normalized = adapter.normalize(raw);
  const mapped = mapSandboxOffer(customerSandboxOffer(normalized));
  assert.equal(mapped.departureAt, raw.slices[0].segments[0].departing_at);
  assert.equal(mapped.arrivalAt, raw.slices[0].segments[0].arriving_at);
  assert.equal(mapped.slices[1].departureAt, inboundSegment.departing_at);
  assert.equal(mapped.slices[1].arrivalAt, inboundSegment.arriving_at);
  assert.equal(mapped.stopCount, 0);
  assert.deepEqual(mapped.stopAirports, []);
  assert.equal(mapped.segments.length, 2, 'Both itinerary legs remain available in the detail view.');
  assert.equal(mapped.inventoryMode, 'sandbox_test');
});

test('Phase 17 sandbox connection summaries include only outbound connection airports', () => {
  const raw = rawOffer();
  const first = raw.slices[0].segments[0];
  const second = structuredClone(first);
  first.destination = { iata_code: 'DOH', city_name: 'Doha' };
  second.origin = { iata_code: 'DOH', city_name: 'Doha' };
  raw.slices[0].segments.push(second);
  const inbound = structuredClone(rawOffer().slices[0]);
  [inbound.origin, inbound.destination] = [inbound.destination, inbound.origin];
  [inbound.segments[0].origin, inbound.segments[0].destination] = [inbound.segments[0].destination, inbound.segments[0].origin];
  raw.slices.push(inbound);
  const adapter = new FlightsDuffelAdapter({ enableTestMode: true, apiToken: FAKE_TOKEN, environment: 'sandbox' });
  const mapped = mapSandboxOffer(customerSandboxOffer(adapter.normalize(raw)));
  assert.equal(mapped.stopCount, 1);
  assert.deepEqual(mapped.stopAirports, ['DOH']);
  assert.equal(mapped.slices[1].stopCount, 0);
});

test('Phase 17 sandbox price changes preserve previous and current native-currency cents', async () => {
  const adapter = new FlightsDuffelAdapter({ enableTestMode: true, apiToken: FAKE_TOKEN, environment: 'sandbox' });
  const offer = mapSandboxOffer(customerSandboxOffer(adapter.normalize(rawOffer())));
  const saved = tripBucketService.getItems();
  const original = flightSearchService.revalidateOffer;
  try {
    tripBucketService.replaceCandidates([]);
    const candidate = flightTripBucketService.addFlightToTripBucket(offer);
    flightSearchService.revalidateOffer = async () => ({ offerId: offer.offerId, status: 'PRICE_CHANGED', originalPriceMinor: 42050, newPriceMinor: 44075, priceDeltaMinor: 2025, currency: 'USD', message: 'Deterministic sandbox test quote change.', revalidatedAt: new Date().toISOString(), requiresUserAction: true });
    await flightTripBucketService.revalidateFlightInTripBucket(candidate.id, offer.offerId);
    const changed = tripBucketService.getItems().find(item => item.id === candidate.id)!;
    assert.equal(changed.previousAmountMinor, 42050);
    assert.equal(changed.amountMinor, 44075);
    assert.equal(changed.currency, 'USD');
    assert.equal(changed.state, 'price_changed');
    assert.equal(evaluateTripReviewHandoff([changed]).canCheckout, false);
  } finally {
    flightSearchService.revalidateOffer = original;
    tripBucketService.replaceCandidates(saved);
  }
});

function orderResponse(overrides: Partial<DuffelOrder> = {}): DuffelOrder {
  return {
    id: 'ord_sbox_phase16_0001',
    live_mode: false,
    total_amount: '450.50',
    total_currency: 'USD',
    created_at: new Date(NOW).toISOString(),
    booking_reference: 'SBX16ABC',
    owner: { iata_code: 'ZZ', name: 'Duffel Airways' },
    passengers: [{ id: 'pas_1' }],
    ...overrides
  };
}

function seatMapResponse(): Response {
  return jsonResponse([{
    id: 'sem_phase16',
    segment_id: 'seg_phase16',
    slice_id: 'sli_phase16',
    cabins: [{
      deck: 0,
      aisles: 1,
      rows: [{
        sections: [{
          elements: [
            {
              type: 'seat',
              designator: '12A',
              name: '12A',
              disclosures: ['Window'],
              available_services: [{
                id: 'svc_seat_12a',
                passenger_id: 'pas_1',
                total_amount: '15.00',
                total_currency: 'USD'
              }]
            },
            { type: 'exit_row', designator: '12', disclosures: [] }
          ]
        }]
      }]
    }]
  }]);
}

const SEARCH_INPUT = {
  origin: 'CMB',
  destination: 'DXB',
  departureDate: DEPARTURE,
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: 'economy',
  currency: 'USD'
};

const PASSENGER = {
  offerPassengerId: 'pas_1',
  title: 'mr',
  givenName: 'Phase',
  familyName: 'Tester',
  bornOn: '1990-01-01',
  email: 'phase16@example.com',
  phoneNumber: '+94771234567',
  gender: 'M' as const
};

function harness(handler: (call: FakeCall) => Response | Promise<Response>) {
  const fake = fakeFetch(handler);
  const client = new DuffelClient({
    accessToken: FAKE_TOKEN,
    fetchImpl: fake.impl,
    timeoutMs: 5000,
    orderTimeoutMs: 5000
  });
  const adapter = new FlightsDuffelAdapter({ enableTestMode: true, client });
  const service = new DuffelSandboxService({
    adapterFactory: () => adapter,
    now: () => NOW
  });
  configureDuffelSandboxRuntimeForTests({ enabled: true });
  setDuffelSandboxServiceForTests(service);
  return { service, adapter, client, calls: fake.calls };
}

function sandboxFailure(code: string) {
  return (error: unknown): boolean => error instanceof DuffelSandboxError && error.code === code;
}

test('Vacatina Phase 16 — Duffel TEST MODE sandbox suite', async t => {
  t.after(() => {
    resetDuffelSandboxRuntimeForTests();
    setDuffelSandboxServiceForTests(undefined);
  });

  await t.test('runtime boundary rejects production, live mode and missing test credentials', () => {
    const enabledEnv = {
      DUFFEL_ACCESS_TOKEN: FAKE_TOKEN,
      DUFFEL_TEST_MODE_ENABLED: 'true'
    };
    const enabled = resolveDuffelTestModeConfig(enabledEnv);
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.reason, 'ENABLED');
    assert.equal(enabled.tokenKind, 'TEST');
    assert.equal(enabled.environment, 'SANDBOX');
    assert.equal(enabled.liveModeAllowed, false);

    const safe = getDuffelTestModeStatus(enabledEnv);
    assert.equal('token' in safe, false);

    assert.equal(
      resolveDuffelTestModeConfig({ ...enabledEnv, NODE_ENV: 'production' }).reason,
      'PRODUCTION_RUNTIME_BLOCKED'
    );
    assert.equal(
      resolveDuffelTestModeConfig({ ...enabledEnv, DUFFEL_ENV: 'live' }).reason,
      'LIVE_ENV_BLOCKED'
    );
    assert.equal(
      resolveDuffelTestModeConfig({ ...enabledEnv, DUFFEL_ACCESS_TOKEN: 'duffel_live_phase16' }).reason,
      'LIVE_TOKEN_BLOCKED'
    );
    assert.equal(
      resolveDuffelTestModeConfig({ DUFFEL_ACCESS_TOKEN: FAKE_TOKEN }).reason,
      'TEST_MODE_FLAG_DISABLED'
    );
    assert.equal(
      resolveDuffelTestModeConfig({ DUFFEL_TEST_MODE_ENABLED: 'true' }).reason,
      'TEST_TOKEN_REQUIRED'
    );

    assert.equal(resolveCanonicalDuffelToken(` ${FAKE_TOKEN} `), FAKE_TOKEN);
    assert.equal(detectDuffelEnvironment('sandbox', FAKE_TOKEN).isSandboxToken, true);
    assert.equal(detectDuffelEnvironment('sandbox', FAKE_TOKEN).isLiveToken, false);

    assert.throws(
      () => new DuffelClient({ accessToken: 'duffel_live_phase16' }),
      (error: unknown) => error instanceof DuffelApiError && error.category === 'AUTHENTICATION'
    );
    assert.throws(
      () => new DuffelClient({ accessToken: 'not-a-duffel-token' }),
      (error: unknown) => error instanceof DuffelApiError && error.category === 'AUTHENTICATION'
    );

    const productionEnv = {
      NODE_ENV: 'production',
      VACATINA_CLERK_ROTATION_CONFIRMED: 'true',
      BASE_URL: 'https://vacatina.example.com'
    };
    assert.throws(
      () => validateServerEnv({ ...productionEnv, DUFFEL_TEST_MODE_ENABLED: 'true' }),
      /sandbox-only/
    );
    assert.throws(
      () => validateServerEnv({ ...productionEnv, DUFFEL_ACCESS_TOKEN: FAKE_TOKEN }),
      /sandbox token/
    );
  });

  await t.test('search uses real sandbox semantics with no markup and explicit provenance', async () => {
    const { service, calls } = harness(call => {
      if (call.url.includes('/air/offer_requests') && call.method === 'POST') {
        return offerRequestResponse();
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const result = await service.search(SEARCH_INPUT);
    assert.equal(result.offers.length, 1);
    assert.equal(result.offerRequestId, OFFER_REQUEST_ID);

    const offer = result.offers[0];
    assert.equal(offer.canonicalOfferId, `vct-fl-duffel-cmb-dxb-${OFFER_ID}`);
    assert.equal(offer.supplierOfferId, OFFER_ID);
    assert.equal(offer.inventorySource, 'API');
    assert.equal(offer.environmentClass, 'SANDBOX');
    assert.equal(offer.sellability, 'QUOTE_ONLY');
    assert.equal(offer.isSandboxSimulated, true);
    assert.equal(offer.providerLifecycle, 'SANDBOX_CONNECTED');
    assert.equal(offer.integrationLifecycle, 'SANDBOX_ACTIVE');
    assert.equal(offer.confirmationMode, 'REQUEST_TO_CONFIRM');
    assert.equal(offer.bookingMode, 'REQUEST_TO_BOOK');
    assert.equal(offer.availabilityStatus, 'CACHED');
    assert.equal(offer.pricing.currency, 'USD');
    assert.equal(offer.pricing.finalSellingPriceMinor, 42050);
    assert.equal(offer.pricing.manualOverrideMinor, 42050);
    assert.match(String(offer.pricing.overrideReason), /no commercial markup/);

    const flight = (offer.productExtension as any).flight;
    assert.equal(flight.testMode.enabled, true);
    assert.equal(flight.testMode.environment, 'SANDBOX');
    assert.equal(flight.testMode.liveMode, false);
    assert.equal(flight.testMode.nonProduction, true);
    assert.equal(flight.testMode.offerRequestId, OFFER_REQUEST_ID);
    assert.equal(flight.offerRequestId, OFFER_REQUEST_ID);
    assert.equal(flight.passengers.length, 1);
    assert.equal(flight.passengers[0].passengerId, 'pas_1');
    assert.equal(flight.services.length, 1);
    assert.equal(flight.services[0].serviceId, 'svc_bag_1');
    assert.equal(flight.services[0].priceMinor, 3000);
    assert.equal(flight.conditions.refundable, true);
    assert.equal(flight.conditions.changeable, true);

    const searchCall = calls.find(call => call.url.includes('/air/offer_requests'));
    assert.ok(searchCall);
    assert.equal(searchCall!.headers.authorization, `Bearer ${FAKE_TOKEN}`);
    assert.equal(searchCall!.headers['duffel-version'], 'v2');
    assert.equal(searchCall!.headers.accept, 'application/json');
    assert.deepEqual(searchCall!.body.data.slices, [{
      origin: 'CMB',
      destination: 'DXB',
      departure_date: DEPARTURE
    }]);
    assert.deepEqual(searchCall!.body.data.passengers, [{ type: 'adult' }]);
    assert.equal(searchCall!.body.data.cabin_class, 'economy');

    const projection = customerSandboxOffer(offer);
    assert.equal(projection.inventoryMode, 'sandbox_test');
    assert.equal(projection.sellable, false);
    assert.equal(projection.environmentClass, 'SANDBOX');
    assert.equal(projection.sellability, 'QUOTE_ONLY');
    assert.equal(projection.pricing.finalSellingPriceMinor, 42050);
    assert.equal(projection.testMode.liveMode, false);
    assert.equal(projection.services[0].serviceId, 'svc_bag_1');
    assert.equal(projection.sandbox.liveMode, false);
    assert.equal(projection.sandbox.nonProduction, true);
    const projectionJson = JSON.stringify(projection);
    assert.equal(projectionJson.includes(FAKE_TOKEN), false);
    assert.equal(projectionJson.toLowerCase().includes('authorization'), false);
    assert.equal(projectionJson.includes('duffel_test_'), false);

    const mapped = mapSandboxOffer(projection);
    assert.equal(mapped.offerId, offer.canonicalOfferId);
    assert.equal(mapped.inventoryMode, 'sandbox_test');
    assert.equal(mapped.sourceType, 'supplier_api');
    assert.equal(mapped.bookability, 'request_to_book');
    assert.equal(mapped.sourceOfferId, OFFER_ID);
    assert.equal(mapped.price.totalMinor, 42050);
    assert.equal(mapped.price.currency, 'USD');
    assert.equal(mapped.optionalServices.length, 1);
    assert.equal(mapped.optionalServices[0].id, 'svc_bag_1');
    assert.equal(mapped.sandbox?.enabled, true);
    assert.equal(mapped.sandbox?.liveMode, false);
    assert.equal(mapped.sandbox?.nonProduction, true);
    assert.equal(mapped.sandbox?.passengers[0].id, 'pas_1');
    assert.equal(mapped.airlines[0].code, 'ZZ');
    assert.equal(mapped.stopCount, 0);

    const truth = resolveFlightInventoryTruth(mapped);
    assert.equal(truth.mode, 'sandbox_test');
    assert.equal(truth.isSandbox, true);
    assert.equal(truth.isLive, false);
    assert.equal(truth.isDemo, false);
    assert.match(truth.disclosure, /not live airline inventory/);

    const candidate = flightTripBucketService.mapFlightOfferToTripCandidate(
      mapped,
      {
        offerId: mapped.offerId,
        selectedFareFamilyCode: 'duffel_sandbox',
        selectedCabinClass: mapped.cabinClass,
        selectedOptionalServiceIds: ['svc_bag_1']
      },
      {
        tripType: 'one_way',
        departureDate: DEPARTURE,
        travellers: { adults: 1, children: 0, infants: 0 }
      }
    );
    assert.equal(candidate.inventoryMode, 'sandbox_test');
    assert.equal(candidate.state, 'needs_action');
    assert.equal(candidate.sandboxOrderable, true);
    assert.equal(candidate.confirmationMode, 'REQUEST_TO_CONFIRM');
    assert.equal(candidate.currency, 'USD');
    assert.equal(candidate.amountMinor, 42050);
    assert.equal(candidate.priceStatus, 'quoted');
    assert.deepEqual(candidate.selectedServiceIds, ['svc_bag_1']);
    assert.match(String(candidate.actionRequiredText), /sandbox test order/i);
    assert.match(String(candidate.holdStatusText), /no live seat hold/i);
    assert.match(String(candidate.dateSummary), /Duffel sandbox/);

    const summary = computeTripBucketSummary([candidate]);
    assert.equal(summary.readySubtotalLkr, 0);
    assert.equal(summary.excludedSubtotalLkr, 0);
    assert.equal(summary.needsActionCount, 1);

    const handoff = evaluateTripReviewHandoff([candidate]);
    assert.equal(handoff.canCheckout, false);
    assert.equal(handoff.nonLiveCount, 1);
    const blockers = handoff.blockers[0].blockers.join(' | ');
    assert.match(blockers, /Duffel TEST MODE sandbox quote/);
    assert.match(blockers, /Supplier confirmation required/);
  });

  await t.test('offer retrieval survives restart and revalidation reports price changes and expiry', async () => {
    let total = '420.50';
    let expiresAt = FUTURE;
    const handler = (call: FakeCall): Response => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse(rawOffer({ total, expiresAt }));
      if (call.url.includes(`/air/offers/${OFFER_ID}`)) return jsonResponse(rawOffer({ total, expiresAt }));
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    };

    const first = harness(handler);
    const search = await first.service.search(SEARCH_INPUT);
    const offer = search.offers[0];

    total = '455.00';
    const changed = await first.service.revalidate(offer.canonicalOfferId);
    assert.equal(changed.status, 'PRICE_CHANGED');
    assert.equal(changed.previousPriceMinor, 42050);
    assert.equal(changed.newPriceMinor, 45500);
    assert.match(String(changed.message), /sandbox/i);
    assert.equal(changed.updatedOffer?.pricing.finalSellingPriceMinor, 45500);

    expiresAt = PAST;
    const expired = await first.service.revalidate(offer.canonicalOfferId);
    assert.equal(expired.status, 'EXPIRED');

    const restarted = harness(handler);
    const reloaded = await restarted.service.getOffer(offer.canonicalOfferId);
    assert.equal(reloaded.canonicalOfferId, offer.canonicalOfferId);
    assert.equal(reloaded.supplierOfferId, OFFER_ID);
    assert.equal(reloaded.environmentClass, 'SANDBOX');
    const reloadCall = restarted.calls.find(call => call.url.includes(`/air/offers/${OFFER_ID}`));
    assert.ok(reloadCall);
    assert.match(reloadCall!.url, /return_available_services=true/);
    assert.equal(restarted.calls.some(call => call.url.includes('/air/offer_requests')), false);
  });

  await t.test('seat maps and quote use the official endpoints and preserve service quantities', async () => {
    const { service, calls } = harness(call => {
      if (call.url.includes('/air/seat_maps')) return seatMapResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '435.50' }));
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const search = await service.search(SEARCH_INPUT);
    const offer = search.offers[0];

    const maps = await service.seatMaps(offer.canonicalOfferId);
    assert.equal(maps.length, 1);
    const map = maps[0] as any;
    assert.equal(map.id, 'sem_phase16');
    assert.equal(map.segmentId, 'seg_phase16');
    assert.equal(map.cabins[0].rows[0].sections[0].elements[0].designator, '12A');
    assert.equal(map.cabins[0].rows[0].sections[0].elements[0].services[0].id, 'svc_seat_12a');
    assert.equal(map.cabins[0].rows[0].sections[0].elements[0].services[0].amountMinor, 1500);
    assert.equal(map.cabins[0].rows[0].sections[0].elements[0].services[0].currency, 'USD');

    const quote = await service.quote({
      offerId: offer.canonicalOfferId,
      services: [{ id: 'svc_bag_1', quantity: 2 }]
    });
    assert.equal(quote.sandbox, true);
    assert.equal(quote.nonProduction, true);
    assert.equal(quote.liveMode, false);
    assert.equal(quote.offerId, offer.canonicalOfferId);
    assert.equal(quote.totalAmountMinor, 43550);
    assert.equal(quote.currency, 'USD');
    assert.deepEqual(quote.services, [{ id: 'svc_bag_1', quantity: 2 }]);
    assert.match(quote.message, /No seat hold/);

    const priceCall = calls.find(call => call.url.includes('/actions/price'));
    assert.ok(priceCall);
    assert.deepEqual(priceCall!.body.data.intended_payment_methods, [{ type: 'balance', currency: 'USD' }]);
    assert.deepEqual(priceCall!.body.data.intended_services, [{ id: 'svc_bag_1', quantity: 2 }]);

    await assert.rejects(
      service.quote({ offerId: offer.canonicalOfferId, services: [{ id: 'bad', quantity: 1 }] }),
      sandboxFailure('SANDBOX_VALIDATION_FAILED')
    );
  });

  await t.test('explicit order creation is idempotent and never duplicates on retries', async () => {
    let orderCalls = 0;
    const { service, calls } = harness(call => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '450.50' }));
      if (call.url.endsWith('/air/orders')) {
        orderCalls += 1;
        return jsonResponse(orderResponse({ id: `ord_sbox_phase16_000${orderCalls}` }));
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const search = await service.search(SEARCH_INPUT);
    const offer = search.offers[0];
    const input = {
      offerId: offer.canonicalOfferId,
      supplierOfferId: offer.supplierOfferId,
      passengers: [PASSENGER],
      services: [{ id: 'svc_bag_1', quantity: 1 }],
      acceptedPriceMinor: 45050
    };

    const first = await service.createOrder(input, 'user:phase16', 'idem-phase16-0001');
    assert.equal(first.sandbox, true);
    assert.equal(first.nonProduction, true);
    assert.equal(first.liveMode, false);
    assert.equal(first.orderId, 'ord_sbox_phase16_0001');
    assert.equal(first.bookingReference, 'SBX16ABC');
    assert.equal(first.totalAmountMinor, 45050);
    assert.equal(first.currency, 'USD');
    assert.equal(first.passengerCount, 1);
    assert.equal(first.replayed, false);
    assert.match(first.message, /No live ticket/);

    const replay = await service.createOrder(input, 'user:phase16', 'idem-phase16-0001');
    assert.equal(replay.replayed, true);
    assert.equal(replay.orderId, first.orderId);
    assert.equal(orderCalls, 1);

    await assert.rejects(
      service.createOrder(
        { ...input, passengers: [{ ...PASSENGER, givenName: 'Different' }] },
        'user:phase16',
        'idem-phase16-0001'
      ),
      sandboxFailure('IDEMPOTENCY_KEY_REUSED')
    );
    assert.equal(orderCalls, 1);

    const secondKey = await service.createOrder(input, 'user:phase16', 'idem-phase16-0002');
    assert.equal(secondKey.replayed, false);
    assert.notEqual(secondKey.orderId, first.orderId);
    assert.equal(orderCalls, 2);

    const orderCall = calls.find(call => call.url.endsWith('/air/orders'));
    assert.ok(orderCall);
    assert.equal(orderCall!.body.data.type, 'instant');
    assert.deepEqual(orderCall!.body.data.selected_offers, [OFFER_ID]);
    assert.equal(orderCall!.body.data.passengers[0].id, 'pas_1');
    assert.equal(orderCall!.body.data.passengers[0].given_name, 'Phase');
    assert.equal(orderCall!.body.data.passengers[0].gender, 'M');
    assert.equal(orderCall!.body.data.payments[0].type, 'balance');
    assert.equal(orderCall!.body.data.payments[0].amount, '450.50');
    assert.equal(orderCall!.body.data.payments[0].currency, 'USD');
    assert.deepEqual(orderCall!.body.data.services, [{ id: 'svc_bag_1', quantity: 1 }]);
    assert.equal(orderCall!.body.data.metadata.vacatina_environment, 'sandbox');
  });

  await t.test('ambiguous and deterministic order failures are safe, stored, and not retried', async () => {
    let orderCalls = 0;
    const ambiguous = harness(call => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '450.50' }));
      if (call.url.endsWith('/air/orders')) {
        orderCalls += 1;
        throw new TypeError('raw network detail must never reach the browser');
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const search = await ambiguous.service.search(SEARCH_INPUT);
    const offer = search.offers[0];
    const input = {
      offerId: offer.canonicalOfferId,
      supplierOfferId: offer.supplierOfferId,
      passengers: [PASSENGER],
      services: [{ id: 'svc_bag_1', quantity: 1 }],
      acceptedPriceMinor: 45050
    };

    await assert.rejects(
      ambiguous.service.createOrder(input, 'user:phase16', 'idem-phase16-unknown'),
      (error: unknown) => error instanceof DuffelSandboxError &&
        error.code === 'SANDBOX_OUTCOME_UNKNOWN' &&
        error.status === 502 &&
        !error.message.includes('raw network detail')
    );
    assert.equal(orderCalls, 1);

    await assert.rejects(
      ambiguous.service.createOrder(input, 'user:phase16', 'idem-phase16-unknown'),
      sandboxFailure('SANDBOX_OUTCOME_UNKNOWN')
    );
    assert.equal(orderCalls, 1);

    let validationCalls = 0;
    const deterministic = harness(call => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '450.50' }));
      if (call.url.endsWith('/air/orders')) {
        validationCalls += 1;
        return providerError(422, 'validation_error', 'invalid_passenger', 'raw provider secret body');
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const secondSearch = await deterministic.service.search(SEARCH_INPUT);
    const secondOffer = secondSearch.offers[0];
    const secondInput = {
      ...input,
      offerId: secondOffer.canonicalOfferId,
      supplierOfferId: secondOffer.supplierOfferId
    };
    await assert.rejects(
      deterministic.service.createOrder(secondInput, 'user:phase16', 'idem-phase16-validation'),
      (error: unknown) => error instanceof DuffelSandboxError &&
        error.code === 'SANDBOX_VALIDATION_FAILED' &&
        !error.message.includes('raw provider secret body')
    );
    assert.equal(validationCalls, 1);

    await assert.rejects(
      deterministic.service.createOrder(secondInput, 'user:phase16', 'idem-phase16-validation'),
      sandboxFailure('SANDBOX_VALIDATION_FAILED')
    );
    assert.equal(validationCalls, 1);
  });

  await t.test('an in-flight order claim blocks a concurrent duplicate', async () => {
    let orderCalls = 0;
    let releaseOrder!: (response: Response) => void;
    let markOrderStarted!: () => void;
    const orderStarted = new Promise<void>(resolve => { markOrderStarted = resolve; });
    const orderGate = new Promise<Response>(resolve => { releaseOrder = resolve; });

    const { service } = harness(call => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '450.50' }));
      if (call.url.endsWith('/air/orders')) {
        orderCalls += 1;
        markOrderStarted();
        return orderGate;
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });

    const search = await service.search(SEARCH_INPUT);
    const offer = search.offers[0];
    const input = {
      offerId: offer.canonicalOfferId,
      supplierOfferId: offer.supplierOfferId,
      passengers: [PASSENGER],
      services: [{ id: 'svc_bag_1', quantity: 1 }],
      acceptedPriceMinor: 45050
    };

    const first = service.createOrder(input, 'user:phase16', 'idem-phase16-inflight');
    await orderStarted;
    await assert.rejects(
      service.createOrder(input, 'user:phase16', 'idem-phase16-inflight'),
      sandboxFailure('ORDER_IN_PROGRESS')
    );
    releaseOrder(jsonResponse(orderResponse()));
    const result = await first;
    assert.equal(result.orderId, 'ord_sbox_phase16_0001');
    assert.equal(orderCalls, 1);
  });

  await t.test('sandbox HTTP routes expose only safe non-production projections', async () => {
    let orderCalls = 0;
    const { service } = harness(call => {
      if (call.url.includes('/air/offer_requests')) return offerRequestResponse();
      if (call.url.includes('/air/seat_maps')) return seatMapResponse();
      if (call.url.includes('/actions/price')) return jsonResponse(rawOffer({ total: '450.50' }));
      if (call.url.includes(`/air/offers/${OFFER_ID}`)) return jsonResponse(rawOffer());
      if (call.url.endsWith('/air/orders')) {
        orderCalls += 1;
        return jsonResponse(orderResponse());
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });
    assert.equal(service.status().enabled, true);

    const customer = customerContext('phase16_route_user');

    const statusResponse = await globalApiRouter.handleRequest(
      new Request('http://localhost/api/v1/flights/sandbox/status'),
      customer
    );
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.enabled, true);
    assert.equal(status.environment, 'SANDBOX');
    assert.equal(status.liveModeAllowed, false);
    assert.equal(status.orders, true);
    assert.equal('token' in status, false);

    const searchResponse = await globalApiRouter.handleRequest(
      new Request('http://localhost/api/v1/flights/sandbox/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(SEARCH_INPUT)
      }),
      customer
    );
    assert.equal(searchResponse.status, 200);
    const searchJson = await searchResponse.json();
    assert.equal(searchJson.sandbox, true);
    assert.equal(searchJson.environment, 'SANDBOX');
    assert.equal(searchJson.liveMode, false);
    assert.equal(searchJson.nonProduction, true);
    assert.equal(searchJson.totalResults, 1);
    assert.equal(searchJson.offers[0].inventoryMode, 'sandbox_test');
    assert.equal(searchJson.offers[0].sellable, false);
    assert.equal(searchJson.offers[0].pricing.finalSellingPriceMinor, 42050);
    assert.equal(searchJson.offers[0].testMode.liveMode, false);
    assert.equal(searchJson.offers[0].sandbox.liveMode, false);
    const searchJsonText = JSON.stringify(searchJson);
    assert.equal(searchJsonText.includes(FAKE_TOKEN), false);
    assert.equal(searchJsonText.toLowerCase().includes('authorization'), false);
    assert.equal(searchJsonText.includes('duffel_test_'), false);

    const offerId = searchJson.offers[0].canonicalOfferId;
    const offerResponse = await globalApiRouter.handleRequest(
      new Request(
        `http://localhost/api/v1/flights/sandbox/offers/${encodeURIComponent(offerId)}?supplierOfferId=${OFFER_ID}`
      ),
      customer
    );
    assert.equal(offerResponse.status, 200);
    const offerJson = await offerResponse.json();
    assert.equal(offerJson.sandbox, true);
    assert.equal(offerJson.liveMode, false);
    assert.equal(offerJson.offer.inventoryMode, 'sandbox_test');

    const revalidateResponse = await globalApiRouter.handleRequest(
      new Request(
        `http://localhost/api/v1/flights/sandbox/offers/${encodeURIComponent(offerId)}/revalidate?supplierOfferId=${OFFER_ID}`,
        { method: 'POST' }
      ),
      customer
    );
    assert.equal(revalidateResponse.status, 200);
    const revalidateJson = await revalidateResponse.json();
    assert.equal(revalidateJson.status, 'UNCHANGED');

    const seatResponse = await globalApiRouter.handleRequest(
      new Request(
        `http://localhost/api/v1/flights/sandbox/offers/${encodeURIComponent(offerId)}/seat-maps?supplierOfferId=${OFFER_ID}`
      ),
      customer
    );
    assert.equal(seatResponse.status, 200);
    const seatJson = await seatResponse.json();
    assert.equal(seatJson.liveMode, false);
    assert.equal(seatJson.seatMaps[0].segmentId, 'seg_phase16');

    const quoteResponse = await globalApiRouter.handleRequest(
      new Request(
        `http://localhost/api/v1/flights/sandbox/offers/${encodeURIComponent(offerId)}/quote?supplierOfferId=${OFFER_ID}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ services: [{ id: 'svc_bag_1', quantity: 1 }] })
        }
      ),
      customer
    );
    assert.equal(quoteResponse.status, 200);
    const quoteJson = await quoteResponse.json();
    assert.equal(quoteJson.sandbox, true);
    assert.equal(quoteJson.liveMode, false);
    assert.equal(quoteJson.totalAmountMinor, 45050);

    const orderBody = {
      offerId,
      supplierOfferId: OFFER_ID,
      passengers: [PASSENGER],
      services: [{ id: 'svc_bag_1', quantity: 1 }],
      acceptedPriceMinor: 45050
    };
    const orderResponseHttp = await globalApiRouter.handleRequest(
      new Request('http://localhost/api/v1/flights/sandbox/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': 'idem-phase16-route' },
        body: JSON.stringify(orderBody)
      }),
      customer
    );
    assert.equal(orderResponseHttp.status, 201);
    const orderJson = await orderResponseHttp.json();
    assert.equal(orderJson.sandbox, true);
    assert.equal(orderJson.nonProduction, true);
    assert.equal(orderJson.liveMode, false);
    assert.equal(orderJson.replayed, false);

    const replayResponse = await globalApiRouter.handleRequest(
      new Request('http://localhost/api/v1/flights/sandbox/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': 'idem-phase16-route' },
        body: JSON.stringify(orderBody)
      }),
      customer
    );
    assert.equal(replayResponse.status, 201);
    const replayJson = await replayResponse.json();
    assert.equal(replayJson.replayed, true);
    assert.equal(orderCalls, 1);
  });

  await t.test('route failures are sanitized and browser source selection stays explicit', async () => {
    const failing = harness(call => {
      if (call.url.includes('/air/offer_requests')) {
        return providerError(401, 'authentication_error', 'unauthorized', 'raw provider auth body');
      }
      throw new Error(`Unexpected Duffel call: ${call.method} ${call.url}`);
    });
    assert.equal(failing.service.status().enabled, true);

    const errorResponse = await globalApiRouter.handleRequest(
      new Request('http://localhost/api/v1/flights/sandbox/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(SEARCH_INPUT)
      }),
      customerContext('phase16_route_error')
    );
    assert.equal(errorResponse.status, 502);
    const errorJson = await errorResponse.json();
    assert.equal(errorJson.code, 'SANDBOX_AUTH_FAILED');
    assert.equal(JSON.stringify(errorJson).includes('raw provider auth body'), false);
    assert.equal(JSON.stringify(errorJson).includes(FAKE_TOKEN), false);

    const sandboxQuery = `tripType=one_way&origin=CMB&destination=DXB&departureDate=${DEPARTURE}&adults=1&cabinClass=economy&source=sandbox_test`;
    const parsed = parseFlightSearchQuery(new URLSearchParams(sandboxQuery));
    assert.deepEqual(parsed.errors, {});
    assert.equal(parsed.request.inventorySource, 'sandbox_test');
    assert.match(buildFlightSearchQuery(parsed.request), /source=sandbox_test/);

    const demoParsed = parseFlightSearchQuery(
      new URLSearchParams(`tripType=one_way&origin=CMB&destination=DXB&departureDate=${DEPARTURE}`)
    );
    assert.equal(demoParsed.request.inventorySource, 'demo_fixture');

    const multiCity = flightSearchService.validateSearchRequest({
      ...parsed.request,
      tripType: 'multi_city',
      legs: [
        { legIndex: 0, origin: parsed.request.origin, destination: parsed.request.destination, departureDate: DEPARTURE },
        { legIndex: 1, origin: parsed.request.destination, destination: parsed.request.origin, departureDate: DEPARTURE }
      ]
    });
    assert.match(String(multiCity.errors.tripType), /one-way and return/);
  });
});
