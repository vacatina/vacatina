/* ============================================================================
 * Vacatina Hotels Full Flow, Consular Visa & End-to-End Booking Saga Test Suite
 * Authorities:
 * - 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
 * - 12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md
 * - 02_API_RESPONSIBILITY_MAP.md & 03_FUNCTIONAL_FLOWS.md
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { globalUnifiedInventory } from '../src/server/inventory/unified-inventory.service.ts';
import { HotelsLiteApiAdapter } from '../src/server/inventory/adapters/hotels-liteapi.adapter.ts';
import { VisaConsularAdapter } from '../src/server/inventory/adapters/visa-consular.adapter.ts';
import { FlightsDuffelAdapter } from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import { globalStorageEngine } from '../src/server/db/storage.ts';
import { BookingSagaService } from '../src/server/services/booking-saga.service.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { TripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import type { TripBucketCandidate } from '../src/lib/domain/types.ts';
import type { SecurityContext } from '../src/server/auth/rbac.ts';
import {
  customerContext,
  flightFixture,
  hotelFixture,
  sessionHeaders,
  visaFixture
} from './support/canonical-fixtures.ts';

describe('Vacatina Hotels, Consular Visa & End-to-End Booking Saga Suite', () => {
  const adminContext: SecurityContext = {
    userId: 'usr_hotels_admin_001',
    email: 'operations@vacatina.com',
    role: 'PLATFORM_ADMIN'
  };
  // Current, customer-visible direct-contract products created through the real publishing lifecycle.
  const dubaiHotel = hotelFixture('hotels-flow-ht-dubai-000201', 'Dubai', {
    country: 'United Arab Emirates',
    countryCode: 'AE'
  });
  const londonHotel = hotelFixture('hotels-flow-ht-london-000202', 'London', {
    country: 'United Kingdom',
    countryCode: 'GB'
  });
  const sagaHotel = hotelFixture('hotels-flow-ht-saga-000203', 'Dubai', {
    country: 'United Arab Emirates',
    countryCode: 'AE'
  });
  const sagaFlight = flightFixture('hotels-flow-fl-saga-000204', 'Dubai', 'DXB');
  const sagaVisa = visaFixture('hotels-flow-vs-saga-000205');

  // --------------------------------------------------------------------------
  // Gate 1: LiteAPI Hotels Multi-Destination Search
  // --------------------------------------------------------------------------
  it('Hotel Flow Gate 1: LiteAPI Hotels Search Returns Multi-Property Inventory for Dubai, Colombo, Maldives, and London', async () => {
    const liteapi = new HotelsLiteApiAdapter('sandbox');

    // Dubai Hub
    const dxbHotels = await liteapi.search({
      productType: 'hotels',
      destination: 'Dubai',
      currency: 'USD'
    });
    assert.ok(dxbHotels.length >= 3, 'Dubai search must return at least 3 distinct hotel properties');
    const atlantis = dxbHotels.find(h => h.title.includes('Atlantis') || h.canonicalOfferId.includes('atlantis'));
    assert.ok(atlantis, 'Atlantis The Palm must be present in Dubai results');
    assert.equal(atlantis?.productType, 'hotels');
    assert.equal(atlantis?.sourceType, 'API');
    assert.equal(atlantis?.confirmationMode, 'INSTANT_CONFIRM');
    assert.ok(atlantis?.pricing.rawSupplierCostMinor > 0);
    assert.ok(atlantis?.pricing.finalSellingPriceMinor > atlantis?.pricing.rawSupplierCostMinor);

    // Colombo Hub
    const cmbHotels = await liteapi.search({
      productType: 'hotels',
      destination: 'Colombo',
      currency: 'LKR'
    });
    assert.ok(cmbHotels.length >= 2, 'Colombo search must return multiple properties');
    const shangrila = cmbHotels.find(h => h.title.includes('Shangri-La') || h.title.includes('Cinnamon'));
    assert.ok(shangrila, 'Shangri-La or Cinnamon Grand must be present in Colombo');

    // Maldives Hub
    const mleHotels = await liteapi.search({
      productType: 'hotels',
      destination: 'Maldives',
      currency: 'USD'
    });
    assert.ok(mleHotels.length >= 2, 'Maldives search must return luxury resort properties');

    // London Hub
    const lonHotels = await liteapi.search({
      productType: 'hotels',
      destination: 'London',
      currency: 'USD'
    });
    assert.ok(lonHotels.length >= 2, 'London search must return heritage luxury hotels');
  });

  // --------------------------------------------------------------------------
  // Gate 2: CAP-02 Offer Details Dossier for Hotels (GET /api/v1/offers/:id)
  // --------------------------------------------------------------------------
  it('Hotel Flow Gate 2: CAP-02 Offer Details Dossier API Resolves Hotel Offers via Unified Inventory', async () => {
    const req = new Request(`https://vacatina.com/api/v1/offers/${dubaiHotel.offerId}`, {
      method: 'GET'
    });
    const res = await globalApiRouter.handleRequest(req);
    assert.equal(res.status, 200, 'Offer details endpoint must return HTTP 200 OK');

    const json = await res.json() as any;
    assert.equal(json.offerId, dubaiHotel.offerId);
    assert.equal(json.offer.productType, 'hotels');
    assert.equal(json.offer.location.city, 'Dubai');
    assert.ok(json.offer.pricing.finalSellingPriceMinor > 0);
    assert.equal(json.offer.pricing.currency, 'LKR');
    assert.equal(json.offer.bookingMode, 'INSTANT_BOOK');
    assert.equal(json.offer.productExtension?.starRating, 5);
    assert.ok(json.offer.inclusions.length >= 2);
    // Customer projections never expose internal sourcing taxonomies
    assert.equal('sourceType' in json.offer, false);
    assert.equal('environmentClass' in json.offer, false);
  });

  // --------------------------------------------------------------------------
  // Gate 3: CAP-03 Pre-Booking Revalidation API for Hotels
  // --------------------------------------------------------------------------
  it('Hotel Flow Gate 3: CAP-03 Pre-Booking Revalidation API Handles UNCHANGED and UNAVAILABLE', async () => {
    // 3a. UNCHANGED standard check against the published manual ledger
    const req1 = new Request(`https://vacatina.com/api/v1/offers/${dubaiHotel.offerId}/revalidate`, {
      method: 'POST'
    });
    const res1 = await globalApiRouter.handleRequest(req1);
    assert.equal(res1.status, 200);
    const json1 = await res1.json() as any;
    assert.equal(json1.status, 'UNCHANGED');
    assert.equal(json1.priceChanged, false);

    // 3b. Stop-sell makes the offer disappear from sellable inventory and revalidate as UNAVAILABLE
    const stopReq = new Request(`https://vacatina.com/api/v1/admin/listings/${dubaiHotel.listing.id}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Property maintenance closure during revalidation test' })
    });
    const stopRes = await globalApiRouter.handleRequest(stopReq, adminContext);
    assert.equal(stopRes.status, 200);

    const req2 = new Request(`https://vacatina.com/api/v1/offers/${dubaiHotel.offerId}/revalidate`, {
      method: 'POST'
    });
    const res2 = await globalApiRouter.handleRequest(req2);
    assert.equal(res2.status, 404);
    const json2 = await res2.json() as any;
    assert.equal(json2.code, 'OFFER_NOT_FOUND');

    const ledgerRecheck = await globalUnifiedInventory.revalidateOffer(dubaiHotel.offerId);
    assert.equal(ledgerRecheck.status, 'UNAVAILABLE');

    // Restore sale for later gates
    const resumeReq = new Request(`https://vacatina.com/api/v1/admin/listings/${dubaiHotel.listing.id}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Maintenance complete' })
    });
    const resumeRes = await globalApiRouter.handleRequest(resumeReq, adminContext);
    assert.equal(resumeRes.status, 200);

    // Synthetic PRICE_CHANGED sandbox ids are retired with the sandbox-only flow;
    // PRICE_CHANGED is covered against a real canonical offer in secure-booking-payments.test.ts.
  });

  // --------------------------------------------------------------------------
  // Gate 4: Stage Configured Hotel Offer into Trip Bucket
  // --------------------------------------------------------------------------
  it('Hotel Flow Gate 4: Stage Configured Hotel Room into Trip Bucket Drawer as READY', () => {
    const bucket = new TripBucketService();
    const candidate: TripBucketCandidate = {
      id: `ht-staged-atlantis-${Date.now()}`,
      productType: 'hotels',
      productLabel: 'Hotel',
      title: 'Atlantis, The Palm',
      subtitle: 'Ocean King Suite · Breakfast Included · Dubai',
      dateSummary: '15 Nov – 20 Nov 2026',
      travellerSummary: '2 Adults · 1 Room',
      state: 'ready',
      priceLkr: 295000,
      offerId: 'vct-ht-liteapi-dubai-atlantis',
      sourceType: 'API',
      confirmationMode: 'INSTANT_CONFIRM',
      rawSupplierPrice: 240000,
      supplierBaseCurrency: 'USD',
      markupAmountLkr: 55000,
      holdStatusText: 'Instant confirmation eligible · Indicative rate staged',
      supplierName: 'LITEAPI',
      integrationMode: 'ADAPTER-READY'
    };

    bucket.stageCandidate(candidate);
    const summary = bucket.getSummary();
    assert.equal(summary.readyCount, 3, 'Trip bucket must now contain 3 ready items');
    assert.equal(summary.readySubtotalLkr, 505000 + 295000, 'Subtotal accurately incorporates staged hotel room');

    const stagedItem = bucket.getItems().find(i => i.id === candidate.id);
    assert.ok(stagedItem, 'Staged item must be present in bucket items list');
    assert.equal(stagedItem?.state, 'ready');
  });

  // --------------------------------------------------------------------------
  // Gate 5: Consular Visa Desk Intake Submission (CAP-14)
  // --------------------------------------------------------------------------
  it('Visa Flow Gate 5: CAP-14 Consular Visa Desk Application Submission & Retrieval', async () => {
    const payload = {
      applicantName: 'Nipuna Senaratne',
      passportNumber: 'N7482910',
      country: 'United Arab Emirates',
      visaCategory: 'TOURIST_EVISA',
      notes: 'Family holiday travel in November'
    };

    const postReq = new Request('https://vacatina.com/api/v1/visa/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const postRes = await globalApiRouter.handleRequest(postReq);
    assert.equal(postRes.status, 201, 'Visa application submission must return HTTP 201 Created');

    const postJson = await postRes.json() as any;
    assert.equal(postJson.success, true);
    assert.ok(postJson.applicationId);
    assert.equal(postJson.application.travelerName, 'Nipuna Senaratne');
    assert.equal(postJson.application.status, 'SUBMITTED');

    // Retrieve by ID
    const getReq = new Request(`https://vacatina.com/api/v1/visa/applications/${postJson.applicationId}`, {
      method: 'GET'
    });
    const getRes = await globalApiRouter.handleRequest(getReq);
    assert.equal(getRes.status, 200);

    const getJson = await getRes.json() as any;
    assert.equal(getJson.application.id, postJson.applicationId);
    assert.equal(getJson.application.passportNumber, 'N7482910');
  });

  // --------------------------------------------------------------------------
  // Gate 6: Resolve Needs Action Visa Item to Ready
  // --------------------------------------------------------------------------
  it('Visa Flow Gate 6: Resolving Visa Item in Trip Bucket Transitions State from Needs Action to Ready', () => {
    const bucket = new TripBucketService();

    // Baseline item has state: 'needs_action'
    const pendingItem = bucket.getItems().find(i => i.state === 'needs_action');
    assert.ok(pendingItem, 'Must have a baseline pending item');

    const initialReadySubtotal = bucket.getSummary().readySubtotalLkr;
    const resolved = bucket.resolveItemAction(pendingItem.id);

    assert.ok(resolved);
    assert.equal(resolved?.state, 'ready');

    const newSummary = bucket.getSummary();
    assert.equal(newSummary.readyCount, 3, 'All 3 items are now in Ready state');
    assert.equal(newSummary.readySubtotalLkr, initialReadySubtotal + pendingItem.priceLkr, 'Resolved item amount is now included in ready subtotal');
  });

  // --------------------------------------------------------------------------
  // Gate 7: End-to-End Multi-Product Booking Saga Checkout (CAP-12)
  // --------------------------------------------------------------------------
  it('Booking Saga Gate 7: Multi-Product Booking Saga (Flight + Hotel + Visa) Prepares an Atomic Unpaid Booking', async () => {
    const customer = customerContext('hotels_flow_saga_customer');
    const sessionId = 'hotels_flow_saga_session';

    // 1. Flight Item
    const flightStageRes = await globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: sagaFlight.offerId,
        configuration: { adults: 1, departureDate: '2026-11-20' }
      })
    }), customer);
    assert.equal(flightStageRes.status, 201);
    const flightStage = await flightStageRes.json() as any;
    assert.equal(flightStage.item.state, 'READY');
    const bucketId = flightStage.item.tripBucketId;

    // 2. Hotel Item
    const hotelStageRes = await globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: sagaHotel.offerId,
        configuration: { adults: 1, departureDate: '2026-11-20', returnDate: '2026-11-24', roomType: 'suite' }
      })
    }), customer);
    assert.equal(hotelStageRes.status, 201);
    const hotelStage = await hotelStageRes.json() as any;
    assert.equal(hotelStage.item.state, 'READY');

    // 3. Visa Item (assisted service stages as NEEDS_ACTION, then revalidates to READY)
    const visaStageRes = await globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: sagaVisa.offerId,
        configuration: { adults: 1, departureDate: '2026-11-20' }
      })
    }), customer);
    assert.equal(visaStageRes.status, 201);
    const visaStage = await visaStageRes.json() as any;
    assert.equal(visaStage.item.state, 'NEEDS_ACTION');

    const visaResolveRes = await globalApiRouter.handleRequest(new Request(
      `https://vacatina.com/api/v1/trip-buckets/items/${visaStage.item.id}/revalidate`,
      { method: 'POST', headers: sessionHeaders(sessionId) }
    ), customer);
    assert.equal(visaResolveRes.status, 200);
    const resolvedBucket = await visaResolveRes.json() as any;
    const resolvedVisa = resolvedBucket.items.find((item: any) => item.canonicalOfferId === sagaVisa.offerId);
    assert.equal(resolvedVisa.state, 'READY');
    assert.equal(resolvedBucket.readyCount, 3);

    // Execute Booking Saga Checkout via HTTP API (CAP-12)
    const idempotencyKey = 'idem_e2e_multi_product_001';
    const checkoutReq = new Request('https://vacatina.com/api/v1/booking/checkout', {
      method: 'POST',
      headers: sessionHeaders(sessionId, { 'x-idempotency-key': idempotencyKey }),
      body: JSON.stringify({
        tripBucketId: bucketId,
        customerEmail: 'sunil@example.com',
        customerName: 'Sunil Wickramasinghe'
      })
    });

    const checkoutRes = await globalApiRouter.handleRequest(checkoutReq, customer);
    assert.equal(checkoutRes.status, 200, 'Booking saga checkout must return HTTP 200 OK');

    const sagaResult = await checkoutRes.json() as any;
    assert.match(sagaResult.bookingReference, /^VCT-\d{4}-[0-9A-F]{10}$/, 'Must have canonical booking reference format');
    assert.equal(sagaResult.overallStatus, 'PENDING_REVALIDATION');
    assert.equal(sagaResult.paymentStatus, 'UNPAID');
    assert.equal(sagaResult.totalSellingPriceMinor, 15000000 + 9600000 + 3800000);
    assert.equal(sagaResult.items.length, 3, 'All 3 items must be captured in the booking group');
    assert.deepEqual(
      sagaResult.items.map((item: any) => item.canonicalOfferId).sort(),
      [sagaFlight.offerId, sagaHotel.offerId, sagaVisa.offerId].sort()
    );
    assert.equal(
      globalStorageEngine.getPaymentOrdersForBooking(sagaResult.bookingGroupId).length,
      0,
      'Booking preparation must not create or settle a payment order'
    );

    // ------------------------------------------------------------------------
    // Gate 8: Manage Booking Dossier Retrieval (CAP-13)
    // ------------------------------------------------------------------------
    const lookupReq = new Request(`https://vacatina.com/api/v1/bookings/${sagaResult.bookingReference}`, {
      method: 'GET',
      headers: sessionHeaders(sessionId)
    });
    const lookupRes = await globalApiRouter.handleRequest(lookupReq, customer);
    assert.equal(lookupRes.status, 200, 'Manage Booking Dossier lookup must return HTTP 200 OK');

    const lookupJson = await lookupRes.json() as any;
    assert.equal(lookupJson.bookingGroup.bookingReference, sagaResult.bookingReference);
    assert.equal(lookupJson.bookingGroup.paymentStatus, 'UNPAID');
    assert.equal(lookupJson.bookingGroup.overallFulfillmentStatus, 'PENDING_REVALIDATION');
    assert.equal(lookupJson.items.length, 3);
  });

  // --------------------------------------------------------------------------
  // Gate 9: Negative Test: Seed Isolation Guard Blocks Booking
  // --------------------------------------------------------------------------
  it('Booking Saga Gate 9 (Negative Test): SEED Content Strictly Blocked from Checkout', async () => {
    const storage = globalStorageEngine;
    const bucket = storage.getOrCreateTripBucket('test_seed_blocked_session');

    storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: 'vct-pkg-seed-dubai-001',
      productType: 'packages',
      title: 'Demo Dubai Package',
      sourceType: 'SEED',
      bookingMode: 'REQUEST_TO_BOOK',
      state: 'READY',
      configuration: {},
      travellerManifest: {},
      unitSellingPriceMinor: 25000000,
      currency: 'LKR'
    });

    const saga = new BookingSagaService(storage);
    await assert.rejects(
      async () => {
        await saga.executeBookingSaga({
          tripBucketId: bucket.id,
          checkoutSessionId: 'cs_seed_test',
          customerEmail: 'test@example.com',
          customerName: 'Test Traveler',
          idempotencyKey: `idem_seed_${Date.now()}`
        });
      },
      /Demonstration and discovery content cannot enter checkout/,
      'Must strictly reject SEED content from entering booking saga checkout'
    );
  });

  // --------------------------------------------------------------------------
  // Gate 10: Negative Test: Unready Cart Blocks Booking
  // --------------------------------------------------------------------------
  it('Booking Saga Gate 10 (Negative Test): Unready Cart Items Strictly Block Booking Checkout', async () => {
    const storage = globalStorageEngine;
    const bucket = storage.getOrCreateTripBucket('test_unready_blocked_session');

    storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: 'vct-vs-pending-001',
      productType: 'visa',
      title: 'Unconfigured Visa Item',
      sourceType: 'MANUAL',
      bookingMode: 'REQUEST_TO_BOOK',
      state: 'NEEDS_ACTION',
      configuration: {},
      travellerManifest: {},
      unitSellingPriceMinor: 3800000,
      currency: 'LKR'
    });

    const saga = new BookingSagaService(storage);
    await assert.rejects(
      async () => {
        await saga.executeBookingSaga({
          tripBucketId: bucket.id,
          checkoutSessionId: 'cs_unready_test',
          customerEmail: 'test@example.com',
          customerName: 'Test Traveler',
          idempotencyKey: `idem_unready_${Date.now()}`
        });
      },
      /Complete the required details and refresh each travel option before checkout/,
      'Must strictly block checkout when cart has items in NEEDS_ACTION state'
    );
  });

  // --------------------------------------------------------------------------
  // Gate 11: Idempotency Re-execution Returns Cached Result
  // --------------------------------------------------------------------------
  it('Booking Saga Gate 11: Idempotent Re-execution with Duplicate Key Returns Identical Cached Dossier', async () => {
    const customer = customerContext('hotels_flow_idempotency_customer');
    const sessionId = 'test_idempotent_session';

    const stageRes = await globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: londonHotel.offerId,
        configuration: { adults: 1, departureDate: '2026-11-20', returnDate: '2026-11-24', roomType: 'superior-queen' }
      })
    }), customer);
    assert.equal(stageRes.status, 201);
    const staged = await stageRes.json() as any;
    assert.equal(staged.item.state, 'READY');

    const key = 'idem_replay_canonical_001';
    const checkout = (idempotencyKey: string) => globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/booking/checkout', {
      method: 'POST',
      headers: sessionHeaders(sessionId, { 'x-idempotency-key': idempotencyKey }),
      body: JSON.stringify({
        tripBucketId: staged.bucketId,
        customerEmail: 'guest@example.com',
        customerName: 'James Bond'
      })
    }), customer);

    const res1 = await checkout(key);
    assert.equal(res1.status, 200);
    const json1 = await res1.json() as any;
    assert.ok(json1.bookingReference, 'First checkout must return a booking reference');
    assert.ok(json1.bookingGroupId, 'First checkout must return a booking group id');

    // Second execution with same idempotency key
    const res2 = await checkout(key);
    assert.equal(res2.status, 200);
    const json2 = await res2.json() as any;

    assert.equal(json1.bookingReference, json2.bookingReference, 'Idempotent call must return identical booking reference');
    assert.equal(json1.bookingGroupId, json2.bookingGroupId, 'Idempotent call must return identical booking group ID');
  });

  // --------------------------------------------------------------------------
  // Gate 12: Zero Leakage of Internal Technical Jargon to Client UI
  // --------------------------------------------------------------------------
  it('Safety Gate 12: Customer UI Strings and Confirmations Have Zero Technical Jargon Leakage', async () => {
    const liteapi = new HotelsLiteApiAdapter('sandbox');
    const hotelOffers = await liteapi.search({ productType: 'hotels', destination: 'Dubai' });

    for (const offer of hotelOffers) {
      assert.doesNotMatch(offer.title, /\b(API|MANUAL|HYBRID|SEED)\b/, 'Title must never contain technical badges');
      assert.doesNotMatch(offer.subtitle, /\b(API|MANUAL|HYBRID|SEED)\b/, 'Subtitle must never contain technical badges');
      assert.doesNotMatch(offer.confirmationMode, /\b(API|MANUAL|HYBRID|SEED)\b/);
    }
  });
});
