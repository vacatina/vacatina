/* ============================================================================
 * Vacatina Duffel NDC Canonical Activation & Sandbox Verification Suite
 * Authority: Reference implementation from flights.vacatina.com
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FlightsDuffelAdapter,
  detectDuffelEnvironment,
  resolveCanonicalDuffelToken
} from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import { validateServerEnv } from '../src/server/config/env.ts';
import {
  hasEnvCredentialForProvider,
  resolveProviderTruth
} from '../src/server/inventory/commercial-truth.ts';
import { TripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { globalUnifiedInventory } from '../src/server/inventory/unified-inventory.service.ts';
import { globalStorageEngine } from '../src/server/db/storage.ts';
import { customerContext, flightFixture, sessionHeaders } from './support/canonical-fixtures.ts';

test('Duffel NDC Canonical Activation & Production Readiness Suite', async (t) => {

  await t.test('1. Canonical Environment Variable Resolution & Fallback Hierarchy', () => {
    // Priority 1: DUFFEL_ACCESS_TOKEN takes precedence
    const envAll = {
      DUFFEL_ACCESS_TOKEN: 'duffel_test_canonical_token_123',
      DUFFEL_API_TOKEN: 'duffel_test_api_token_456',
      DUFFEL_TOKEN: 'duffel_test_legacy_token_789'
    };
    assert.equal(
      resolveCanonicalDuffelToken(undefined),
      undefined,
      'Undefined when no process.env and no explicit token'
    );

    // Test with mock env
    const origEnv = process.env;
    try {
      process.env = { ...origEnv, ...envAll };
      assert.equal(resolveCanonicalDuffelToken(), 'duffel_test_canonical_token_123');

      // Priority 2: DUFFEL_API_TOKEN fallback when DUFFEL_ACCESS_TOKEN is absent
      process.env = {
        ...origEnv,
        DUFFEL_API_TOKEN: 'duffel_test_api_token_456',
        DUFFEL_TOKEN: 'duffel_test_legacy_token_789'
      };
      delete process.env.DUFFEL_ACCESS_TOKEN;
      assert.equal(resolveCanonicalDuffelToken(), 'duffel_test_api_token_456');

      // Priority 3: DUFFEL_TOKEN legacy fallback
      process.env = {
        ...origEnv,
        DUFFEL_TOKEN: 'duffel_test_legacy_token_789'
      };
      delete process.env.DUFFEL_ACCESS_TOKEN;
      delete process.env.DUFFEL_API_TOKEN;
      assert.equal(resolveCanonicalDuffelToken(), 'duffel_test_legacy_token_789');

      // Explicit argument overrides all environment variables
      assert.equal(
        resolveCanonicalDuffelToken('duffel_test_explicit_token'),
        'duffel_test_explicit_token'
      );
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('2. Server Startup Environment Configuration Validation', () => {
    const parsed = validateServerEnv({
      DUFFEL_ACCESS_TOKEN: 'duffel_test_startup_token',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SIGNING_SECRET: '32_character_jwt_secret_for_tests_123',
      CLERK_SECRET_KEY: 'sk_test_key'
    });

    assert.equal(parsed.DUFFEL_ACCESS_TOKEN, 'duffel_test_startup_token');
    assert.equal(parsed.DUFFEL_API_TOKEN, 'duffel_test_startup_token');
    assert.equal(parsed.DUFFEL_TOKEN, 'duffel_test_startup_token');
    assert.equal(parsed.DUFFEL_ENV, 'test');

    // Live token detection
    const parsedLive = validateServerEnv({
      DUFFEL_ACCESS_TOKEN: 'duffel_live_production_token_abc',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SIGNING_SECRET: '32_character_jwt_secret_for_tests_123',
      CLERK_SECRET_KEY: 'sk_test_key'
    });
    assert.equal(parsedLive.DUFFEL_ENV, 'live');
  });

  await t.test('3. Environment & Credential Classification (Sandbox vs Live)', () => {
    const sandboxDetection = detectDuffelEnvironment('sandbox', 'duffel_test_token_xyz');
    assert.equal(sandboxDetection.environment, 'sandbox');
    assert.equal(sandboxDetection.isSandboxToken, true);
    assert.equal(sandboxDetection.isLiveToken, false);

    const liveDetection = detectDuffelEnvironment(undefined, 'duffel_live_token_xyz');
    assert.equal(liveDetection.environment, 'production');
    assert.equal(liveDetection.isLiveToken, true);
    assert.equal(liveDetection.isSandboxToken, false);
  });

  await t.test('4. Commercial Truth Gate for DUFFEL_NDC Provider', () => {
    // Missing / placeholder credential
    assert.equal(
      hasEnvCredentialForProvider('DUFFEL_NDC', { DUFFEL_ACCESS_TOKEN: 'duffel_test_placeholder' }),
      false,
      'Placeholder credential must never qualify as production credential'
    );

    // Sandbox credential
    assert.equal(
      hasEnvCredentialForProvider('DUFFEL_NDC', {
        DUFFEL_ACCESS_TOKEN: 'duffel_test_valid_token',
        DUFFEL_ENV: 'test'
      }),
      false,
      'Sandbox/test credential must not qualify as live production credential'
    );

    // Valid production credential via canonical DUFFEL_ACCESS_TOKEN
    assert.equal(
      hasEnvCredentialForProvider('DUFFEL_NDC', {
        DUFFEL_ACCESS_TOKEN: 'duffel_live_actual_secret',
        DUFFEL_ENVIRONMENT: 'production'
      }),
      true
    );

    // Valid production credential via migration fallback DUFFEL_API_TOKEN
    assert.equal(
      hasEnvCredentialForProvider('DUFFEL_NDC', {
        DUFFEL_API_TOKEN: 'duffel_live_actual_secret',
        DUFFEL_ENV: 'live'
      }),
      true
    );
  });

  await t.test('5. Multi-City Flight Search Support', async () => {
    const duffel = new FlightsDuffelAdapter('sandbox');

    // Multi-city 2-slice search
    const multiCityOffers = await duffel.search({
      productType: 'flights',
      tripType: 'multi_city',
      destination: 'DXB',
      slices: [
        { origin: 'CMB', destination: 'DXB', departureDate: '2026-11-20' },
        { origin: 'DXB', destination: 'LHR', departureDate: '2026-11-25' }
      ]
    });

    assert.ok(multiCityOffers.length > 0, 'Multi-city search must return flight offers');
    const firstOffer = multiCityOffers[0];
    assert.equal(firstOffer.productType, 'flights');
    assert.equal(firstOffer.inventorySource, 'API');
    assert.ok(firstOffer.pricing.finalSellingPriceMinor > 0);
  });

  await t.test('6. Idempotent Booking Hold, Order Confirmation & Cancellation Quote', async () => {
    const duffel = new FlightsDuffelAdapter('sandbox');

    // 1. Hold
    const holdRes = await duffel.hold('off_sbox_cmb_dxb_ul_225');
    assert.ok(holdRes.holdReference.startsWith('DUF-HLD-'));
    assert.ok(holdRes.expiresAtIso);
    assert.equal(holdRes.currency, 'USD');

    // 2. Confirm (sandbox simulation)
    const confirmRes = await duffel.confirm(holdRes.holdReference);
    assert.ok(confirmRes.supplierReference.startsWith('DUF-SBOX-'));
    assert.ok(confirmRes.confirmedAtIso);
    assert.equal(confirmRes.fulfillmentStatus, 'PENDING');

    // 3. Cancel
    const cancelRes = await duffel.cancel(confirmRes.supplierReference, 'Customer requested voluntary cancellation');
    assert.ok(cancelRes.cancellationReference.startsWith('DUF-CXL-'));
    assert.ok(cancelRes.cancelledAtIso);
    assert.ok(cancelRes.cancellationFeeMinor > 0);
    assert.ok(cancelRes.refundEligibleMinor > 0);
  });

  await t.test('7. End-to-End Search to Trip Bucket Staging & Checkout Handoff', async () => {
    // Sandbox Duffel offers are intentionally unavailable to live customer booking.
    // Exercise the handoff with a current direct-contract flight published through the CMS lifecycle.
    const flight = flightFixture('duffel-canonical-fl-000701', 'Dubai', 'DXB');
    const customer = customerContext('duffel_activation_customer');
    const sessionId = 'test_duffel_canonical_session';

    // Revalidate through the authoritative ledger
    const reval = await globalUnifiedInventory.revalidateOffer(flight.offerId);
    assert.equal(reval.status, 'UNCHANGED');

    // Stage in Trip Bucket via REST API
    const stageReq = new Request('http://localhost/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: flight.offerId,
        configuration: { adults: 1, departureDate: '2026-11-20' }
      })
    });
    const stageRes = await globalApiRouter.handleRequest(stageReq, customer);
    assert.equal(stageRes.status, 201, 'Item should be staged in trip bucket with 201');
    const stageJson = await stageRes.json();
    assert.equal(stageJson.item.state, 'READY');
    const tripBucketId = stageJson.item.tripBucketId;

    // Checkout dossier handoff via Booking Saga: prepares an unpaid booking, no settlement
    const checkoutReq = new Request('http://localhost/api/v1/booking/checkout', {
      method: 'POST',
      headers: sessionHeaders(sessionId, { 'x-idempotency-key': 'idemp_duffel_canonical_001' }),
      body: JSON.stringify({
        tripBucketId,
        customerEmail: 'passenger@vacatina.com',
        customerName: 'Traveler Perera'
      })
    });
    const res = await globalApiRouter.handleRequest(checkoutReq, customer);
    assert.equal(res.status, 200, 'Checkout saga must accept ready flight candidates');
    const checkoutJson = await res.json();
    assert.match(checkoutJson.bookingReference, /^VCT-\d{4}-[0-9A-F]{10}$/);
    assert.equal(checkoutJson.overallStatus, 'PENDING_REVALIDATION');
    assert.equal(checkoutJson.paymentStatus, 'UNPAID');
    assert.equal(checkoutJson.totalSellingPriceMinor, 15000000);
    assert.equal(checkoutJson.items.length, 1);
    assert.equal(checkoutJson.items[0].canonicalOfferId, flight.offerId);
    assert.equal(globalStorageEngine.getPaymentOrdersForBooking(checkoutJson.bookingGroupId).length, 0);
  });

});
