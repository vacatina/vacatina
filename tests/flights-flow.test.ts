/* ============================================================================
 * Vacatina Flights Full-Flow & Duffel NDC Integration Verification Suite
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md & ADR-006/ADR-008
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightsDuffelAdapter } from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import { globalUnifiedInventory } from '../src/server/inventory/unified-inventory.service.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { TripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { MANDATORY_BACKEND_CAPABILITIES } from '../src/server/inventory/provider-registry.ts';
import { globalStorageEngine } from '../src/server/db/storage.ts';
import type { SecurityContext } from '../src/server/auth/rbac.ts';
import { customerContext, flightFixture, sessionHeaders } from './support/canonical-fixtures.ts';

test('Vacatina Flights Full Flow & Duffel NDC Suite', async (t) => {
  const duffel = new FlightsDuffelAdapter('sandbox');
  const customer = customerContext('flights_flow_customer');
  const adminContext: SecurityContext = {
    userId: 'usr_flights_admin_001',
    email: 'operations@vacatina.com',
    role: 'PLATFORM_ADMIN'
  };
  // Current, customer-visible direct-contract flights created through the real publishing lifecycle.
  const dubaiFlight = flightFixture('flights-flow-fl-dubai-000401', 'Dubai', 'DXB');
  const maleFlight = flightFixture('flights-flow-fl-male-000402', 'Male', 'MLE');
  const checkoutFlight = flightFixture('flights-flow-fl-checkout-000403', 'Dubai', 'DXB');

  await t.test('Flight Flow Gate 1: Duffel Search Generates Multi-Carrier Route Options for Popular Hubs', async () => {
    // 1. Colombo to Dubai
    const dxbOffers = await duffel.search({
      productType: 'flights',
      origin: 'CMB',
      destination: 'DXB',
      departureDate: '2026-11-20',
      cabinClass: 'economy'
    });
    assert.ok(dxbOffers.length >= 3, 'Must return at least 3 distinct airline options for Colombo -> Dubai');
    
    const carriers = dxbOffers.map(o => o.sourceMetadata?.airlineCode);
    assert.ok(carriers.includes('EK'), 'Must include Emirates (EK)');
    assert.ok(carriers.includes('FZ'), 'Must include flydubai (FZ)');
    assert.ok(carriers.includes('UL'), 'Must include SriLankan Airlines (UL)');

    // 2. Verify Canonical Attributes
    for (const offer of dxbOffers) {
      assert.equal(offer.productType, 'flights');
      assert.equal(offer.inventorySource, 'API');
      assert.ok(offer.canonicalOfferId.startsWith('vct-fl-duffel-cmb-dxb-'));
      assert.equal(offer.location.city, 'Dubai');
      assert.equal(offer.location.iataCode, 'DXB');
      assert.ok(offer.pricing.finalSellingPriceMinor > 0);
      assert.equal(offer.pricing.currency, 'USD');
      assert.ok(offer.productExtension?.productType === 'flights' && offer.productExtension.flight);
      if (offer.productExtension?.productType === 'flights') {
        assert.equal(offer.productExtension.flight.cabinClass, 'ECONOMY');
        assert.equal(offer.productExtension.flight.baggageAllowance.checkedBaggageKg, 23);
        assert.equal(offer.productExtension.flight.baggageAllowance.cabinBaggageKg, 7);
      }
    }
  });

  await t.test('Flight Flow Gate 2: Multi-Route Dispatch (London LHR and Singapore SIN)', async () => {
    // Colombo to London Heathrow
    const lhrOffers = await duffel.search({
      productType: 'flights',
      origin: 'Colombo (CMB)',
      destination: 'London (LHR)',
      departureDate: '2026-12-05',
      cabinClass: 'economy'
    });
    assert.ok(lhrOffers.length >= 2, 'London route returns multiple flight options');
    assert.ok(lhrOffers[0].canonicalOfferId.startsWith('vct-fl-duffel-cmb-lhr-'));
    assert.equal(lhrOffers[0].location.city, 'London');

    // Colombo to Singapore
    const sinOffers = await duffel.search({
      productType: 'flights',
      origin: 'CMB',
      destination: 'Singapore (SIN)',
      departureDate: '2026-12-10'
    });
    assert.ok(sinOffers.length >= 2, 'Singapore route returns multiple options');
    const sqOffer = sinOffers.find(o => o.sourceMetadata?.airlineCode === 'SQ');
    assert.ok(sqOffer, 'Must include Singapore Airlines (SQ)');
  });

  await t.test('Flight Flow Gate 3: Cabin Class Multiplier and Fare Family Specifications', async () => {
    const ecoOffers = await duffel.search({
      productType: 'flights',
      origin: 'CMB',
      destination: 'DXB',
      cabinClass: 'economy'
    });
    const bizOffers = await duffel.search({
      productType: 'flights',
      origin: 'CMB',
      destination: 'DXB',
      cabinClass: 'business'
    });

    const ecoPrice = ecoOffers[0].pricing.finalSellingPriceMinor;
    const bizPrice = bizOffers[0].pricing.finalSellingPriceMinor;
    assert.ok(bizPrice > ecoPrice * 3, 'Business class pricing must be proportionally higher than economy');
    const bizExt = bizOffers[0].productExtension;
    assert.ok(bizExt?.productType === 'flights');
    if (bizExt?.productType === 'flights') {
      assert.equal(bizExt.flight.cabinClass, 'BUSINESS');
      assert.equal(bizExt.flight.fareFamily, 'Standard Business');
      assert.equal(bizExt.flight.baggageAllowance.checkedBaggageKg, 64);
    }
  });

  await t.test('Flight Flow Gate 4: CAP-02 Offer Details Dossier API (GET /api/v1/offers/:id)', async () => {
    // Use a published direct-contract flight so the offer is resolvable by the customer API.
    const offerId = dubaiFlight.offerId;

    // Call REST endpoint
    const req = new Request(`http://localhost/api/v1/offers/${offerId}`, { method: 'GET' });
    const res = await globalApiRouter.handleRequest(req);
    assert.equal(res.status, 200, 'GET /api/v1/offers/:id must return HTTP 200 for known offer');

    const json = await res.json();
    assert.equal(json.offerId, offerId);
    assert.ok(json.offer);
    assert.equal(json.offer.productType, 'flights');
    assert.equal(json.offer.location.city, 'Dubai');
    assert.equal(json.offer.location.iataCode, 'DXB');
    assert.ok(json.offer.pricing.finalSellingPriceMinor > 0);
  });

  await t.test('Flight Flow Gate 5: CAP-02 Negative Test (404 Problem Details on Invalid Offer ID)', async () => {
    const req = new Request('http://localhost/api/v1/offers/vct-fl-invalid-nonexistent-999', { method: 'GET' });
    const res = await globalApiRouter.handleRequest(req);
    assert.equal(res.status, 404, 'Unknown offer must return HTTP 404');

    const problem = await res.json();
    assert.equal(problem.status, 404);
    assert.equal(problem.code, 'OFFER_NOT_FOUND');
    assert.equal(problem.detail, 'This option is no longer available. Search again.');
  });

  await t.test('Flight Flow Gate 6: CAP-03 Pre-Booking Revalidation API (POST /api/v1/offers/:id/revalidate)', async () => {
    const offerId = maleFlight.offerId;

    // 1. Standard UNCHANGED recheck against the published manual ledger
    const req = new Request(`http://localhost/api/v1/offers/${offerId}/revalidate`, { method: 'POST' });
    const res = await globalApiRouter.handleRequest(req);
    assert.equal(res.status, 200);

    const reval = await res.json();
    assert.equal(reval.offerId, offerId);
    assert.equal(reval.status, 'UNCHANGED');
    assert.equal(reval.priceChanged, false);
    assert.ok(reval.checkedAt);

    // 2. Stop-sell makes the same offer truthfully UNAVAILABLE
    const stopReq = new Request(`https://vacatina.com/api/v1/admin/listings/${maleFlight.listing.id}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Weather suspension during revalidation test' })
    });
    const stopRes = await globalApiRouter.handleRequest(stopReq, adminContext);
    assert.equal(stopRes.status, 200);

    const unavailRes = await globalApiRouter.handleRequest(
      new Request(`http://localhost/api/v1/offers/${offerId}/revalidate`, { method: 'POST' })
    );
    assert.equal(unavailRes.status, 404, 'Stopped inventory must no longer resolve as a purchasable offer');
    const unavailable = await unavailRes.json();
    assert.equal(unavailable.code, 'OFFER_NOT_FOUND');

    // The authoritative ledger still reports the stop-sell as UNAVAILABLE to the booking boundary.
    const ledgerRecheck = await globalUnifiedInventory.revalidateOffer(offerId);
    assert.equal(ledgerRecheck.status, 'UNAVAILABLE');

    // Restore sale for later gates
    const resumeReq = new Request(`https://vacatina.com/api/v1/admin/listings/${maleFlight.listing.id}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Weather cleared' })
    });
    const resumeRes = await globalApiRouter.handleRequest(resumeReq, adminContext);
    assert.equal(resumeRes.status, 200);

    // Synthetic PRICE_CHANGED / expired sandbox ids are retired with the sandbox-only flow;
    // PRICE_CHANGED is covered against a real canonical offer in secure-booking-payments.test.ts.
  });

  await t.test('Flight Flow Gate 7: Stage Configured Flight Offer into Trip Bucket Drawer as READY', async () => {
    const searchRes = await duffel.search({ origin: 'CMB', destination: 'DXB' });
    const offer = searchRes[0];

    const tripBucket = new TripBucketService();
    const candidateId = `fl-test-${Date.now()}`;

    tripBucket.stageCandidate({
      id: candidateId,
      productType: 'flights',
      productLabel: 'Flight',
      title: offer.title,
      subtitle: `${offer.subtitle} · Standard Economy`,
      dateSummary: '20 Nov – 27 Nov 2026',
      travellerSummary: '1 Adult · Economy',
      state: 'ready',
      priceLkr: Math.round(offer.pricing.finalSellingPriceMinor * 3.1),
      offerId: offer.canonicalOfferId,
      sourceType: 'API',
      confirmationMode: 'INSTANT_CONFIRM',
      supplierName: 'DUFFEL_NDC',
      integrationMode: 'ADAPTER-READY'
    });

    const summary = tripBucket.getSummary();
    const stagedItem = tripBucket.getItems().find(i => i.id === candidateId);
    assert.ok(stagedItem, 'Staged item must be present in Trip Bucket');
    assert.equal(stagedItem.state, 'ready', 'Configured instant flight must stage as ready');
    assert.equal(stagedItem.productType, 'flights');
    assert.ok(stagedItem.priceLkr > 0);
  });

  await t.test('Flight Flow Gate 8: Recheck Rate in Trip Bucket Maintains Ready State', async () => {
    const tripBucket = new TripBucketService();
    let revalidated = false;

    await new Promise<void>((resolve) => {
      tripBucket.revalidateAllReadyItems(() => {
        revalidated = true;
        resolve();
      });
    });

    assert.ok(revalidated, 'Revalidation callback must fire');
    const readyItems = tripBucket.getItems().filter(i => i.state === 'ready');
    assert.ok(readyItems.length >= 2, 'Ready items must remain intact after revalidation cycle');
    for (const item of readyItems) {
      assert.equal(item.state, 'ready');
      assert.ok(item.holdStatusText?.includes('Rate rechecked') || item.holdStatusText?.includes('active'));
    }
  });

  await t.test('Flight Flow Gate 9: Full 15-Capability Matrix Status Verification', () => {
    assert.equal(MANDATORY_BACKEND_CAPABILITIES.length, 15, 'Must contain all 15 mandatory capabilities');
    for (const cap of MANDATORY_BACKEND_CAPABILITIES) {
      assert.equal(
        cap.implementationStatus,
        'IMPLEMENTED_LOCAL',
        `Capability ${cap.capabilityId} (${cap.name}) must have status IMPLEMENTED_LOCAL`
      );
      assert.equal(
        cap.serviceImplementationStatus,
        'IMPLEMENTED',
        `Capability ${cap.capabilityId} (${cap.name}) must have service status IMPLEMENTED`
      );
    }
  });

  await t.test('Flight Flow Gate 10: Zero Leakage of Internal Taxonomies to Customer UI Fields', async () => {
    const dxbOffers = await duffel.search({ origin: 'CMB', destination: 'DXB' });
    for (const offer of dxbOffers) {
      // Titles, subtitles, and cancellation terms must not contain internal code labels
      assert.ok(!offer.title.includes('API_LIVE'), 'Title must not leak API_LIVE');
      assert.ok(!offer.title.includes('SUPPLIER_API'), 'Title must not leak SUPPLIER_API');
      assert.ok(!offer.title.includes('SEED_MOCK'), 'Title must not leak SEED_MOCK');
      assert.ok(!offer.subtitle.includes('ACCELERATOR'), 'Subtitle must not leak ACCELERATOR');
      assert.ok(!offer.cancellationPolicy.includes('SEED_QUARANTINE'), 'Cancellation policy must not leak internal taxonomy');
    }
  });

  await t.test('Flight Flow Gate 11: CAP-12 Booking Saga Checkout & CAP-13 Booking Dossier Retrieval', async () => {
    const sessionId = 'flight_checkout_session';

    // 1. Stage a current, published flight offer on the server boundary
    const stageReq = new Request('http://localhost/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: checkoutFlight.offerId,
        configuration: { adults: 1, children: 0, infants: 0, departureDate: '2026-11-20' }
      })
    });
    const stageRes = await globalApiRouter.handleRequest(stageReq, customer);
    assert.equal(stageRes.status, 201);
    const stageJson = await stageRes.json();
    assert.equal(stageJson.item.state, 'READY');
    assert.equal(stageJson.item.unitSellingPriceMinor, 15000000);
    const bucketId = stageJson.item.tripBucketId;

    // 2. Prepare the booking (CAP-12): an unpaid draft awaiting payment, never a settled sale
    const idempotencyKey = 'idemp_flight_checkout_canonical_001';
    const checkoutReq = new Request('http://localhost/api/v1/booking/checkout', {
      method: 'POST',
      headers: sessionHeaders(sessionId, { 'x-idempotency-key': idempotencyKey }),
      body: JSON.stringify({
        tripBucketId: bucketId,
        customerEmail: 'passenger@vacatina.com',
        customerName: 'Traveler Perera'
      })
    });
    const checkoutRes = await globalApiRouter.handleRequest(checkoutReq, customer);
    assert.equal(checkoutRes.status, 200, 'POST /api/v1/booking/checkout must return 200');

    const sagaRes = await checkoutRes.json();
    assert.match(sagaRes.bookingReference, /^VCT-\d{4}-[0-9A-F]{10}$/);
    assert.equal(sagaRes.paymentStatus, 'UNPAID');
    assert.equal(sagaRes.overallStatus, 'PENDING_REVALIDATION');
    assert.equal(sagaRes.totalSellingPriceMinor, 15000000);
    assert.equal(sagaRes.items.length, 1);
    assert.equal(sagaRes.items[0].canonicalOfferId, checkoutFlight.offerId);
    assert.equal(
      globalStorageEngine.getPaymentOrdersForBooking(sagaRes.bookingGroupId).length,
      0,
      'Booking preparation must not create or settle a payment order'
    );

    // 3. Retrieve Booking by Reference (CAP-13) under the same customer identity
    const getBookingReq = new Request(`http://localhost/api/v1/bookings/${sagaRes.bookingReference}`, {
      method: 'GET',
      headers: sessionHeaders(sessionId)
    });
    const getBookingRes = await globalApiRouter.handleRequest(getBookingReq, customer);
    assert.equal(getBookingRes.status, 200);

    const bookingDossier = await getBookingRes.json();
    assert.equal(bookingDossier.bookingGroup.bookingReference, sagaRes.bookingReference);
    assert.equal(bookingDossier.bookingGroup.paymentStatus, 'UNPAID');
    assert.equal(bookingDossier.items.length, 1);
    assert.equal(bookingDossier.items[0].productType, 'flights');
    assert.equal(bookingDossier.items[0].canonicalOfferId, checkoutFlight.offerId);
  });

  await t.test('Flight Flow Gate 12: CAP-14 Consular Visa Desk Application Queue Endpoints', async () => {
    // 1. Submit Visa Application
    const submitReq = new Request('http://localhost/api/v1/visa/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: 'Nimal Jayawardena',
        passportNumber: 'N1234567',
        nationality: 'LK',
        country: 'United Arab Emirates',
        visaCategory: 'TOURIST_30_DAY',
        documentManifest: ['passport_bio_page.pdf', 'hotel_voucher.pdf']
      })
    });
    const submitRes = await globalApiRouter.handleRequest(submitReq);
    assert.equal(submitRes.status, 201);

    const submitJson = await submitRes.json();
    assert.ok(submitJson.applicationId);
    assert.equal(submitJson.application.status, 'SUBMITTED');
    assert.equal(submitJson.application.travelerName, 'Nimal Jayawardena');

    // 2. Retrieve Application by ID
    const getAppReq = new Request(`http://localhost/api/v1/visa/applications/${submitJson.applicationId}`, {
      method: 'GET'
    });
    const getAppRes = await globalApiRouter.handleRequest(getAppReq);
    assert.equal(getAppRes.status, 200);

    const getAppJson = await getAppRes.json();
    assert.equal(getAppJson.application.id, submitJson.applicationId);
    assert.equal(getAppJson.application.passportNumber, 'N1234567');
  });
});
