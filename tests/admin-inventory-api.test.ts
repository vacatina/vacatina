/* ============================================================================
 * Vacatina Admin Manual Inventory CMS & Search Aggregator Integration Tests
 * Authority: docs/architecture/inventory-source-architecture-master-handoff.md (v2.4)
 * Validates RESTful endpoints, 18-attribute contract schema, 4-Eyes governance,
 * anti-tamper demotion rules, and multi-source search aggregation.
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { globalApiRouter } from '../src/server/api/router.ts';
import type { SecurityContext } from '../src/server/auth/rbac.ts';
import { manualInventoryService } from '../src/lib/services/manual-inventory.service.ts';
import { flightFixture, hotelFixture, sessionHeaders } from './support/canonical-fixtures.ts';

describe('Admin Manual Inventory CMS & Search Aggregator API Suite', () => {
  // Published canonical fixtures (real DRAFT -> VERIFIED -> PRICED -> PUBLISHED lifecycle).
  // Seed/sample listings are intentionally excluded from customer search and cannot be used here.
  const galleHotel = hotelFixture('admin-ht-galle-000101', 'Galle');
  const maleFlight = flightFixture('admin-fl-male-000201', 'Male', 'MLE');

  // Test Security Contexts
  const unauthenticatedContext = undefined;
  const customerContext: SecurityContext = {
    userId: 'usr_cust_001',
    email: 'traveler@example.com',
    role: 'CUSTOMER'
  };
  const dataClerkContext: SecurityContext = {
    userId: 'usr_clerk_001',
    email: 'clerk@vacatina.com',
    role: 'CONTENT_MARKETING'
  };
  const commercialOfficerContext: SecurityContext = {
    userId: 'usr_comm_002',
    email: 'contracts@vacatina.com',
    role: 'PLATFORM_ADMIN'
  };
  const financeLeadContext: SecurityContext = {
    userId: 'usr_fin_003',
    email: 'finance@vacatina.com',
    role: 'FINANCE_OPS'
  };
  const publishingDirectorContext: SecurityContext = {
    userId: 'usr_pub_004',
    email: 'director@vacatina.com',
    role: 'PLATFORM_ADMIN'
  };

  it('Gate 1: Rejects unauthenticated and unauthorized requests to admin endpoints', async () => {
    // 1. Unauthenticated request
    const req1 = new Request('https://vacatina.com/api/v1/admin/listings', { method: 'GET' });
    const res1 = await globalApiRouter.handleRequest(req1, unauthenticatedContext);
    assert.equal(res1.status, 403);
    const body1 = await res1.json();
    assert.equal(body1.code, 'ADMIN_ACCESS_REQUIRED');

    // 2. Customer role request
    const req2 = new Request('https://vacatina.com/api/v1/admin/listings', { method: 'GET' });
    const res2 = await globalApiRouter.handleRequest(req2, customerContext);
    assert.equal(res2.status, 403);
    const body2 = await res2.json();
    assert.equal(body2.code, 'ADMIN_ACCESS_REQUIRED');
  });

  it('Gate 2: Lists manual listings with productType, status and destination filtering', async () => {
    const req = new Request('https://vacatina.com/api/v1/admin/listings?productType=flights', { method: 'GET' });
    const res = await globalApiRouter.handleRequest(req, dataClerkContext);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.totalListings >= 1);
    assert.ok(body.listings.every((l: any) => l.productType === 'flights'));
  });

  it('Gate 3: Creates manual listing in DRAFT status with 18 mandatory attributes', async () => {
    const payload = {
      id: 'test-man-ht-mirissa-resort',
      title: 'Mirissa Oceanfront Private Villa',
      subtitle: 'Exclusive 3-Bedroom Villa · Direct Contract · Butler Included',
      productType: 'hotels',
      collection: 'contracted-boutique-hotels',
      partnerSupplierId: 'MIRISSA_VILLAS_PVT_LTD',
      partnerName: 'Mirissa Luxury Retreats Group',
      supplierLegalName: 'Mirissa Oceanfront Hospitality Private Limited',
      supplierTaxId: 'TIN-LK-99887766',
      supplierContactEmail: 'contracts@mirissavillas.lk',
      contractReference: 'CNT-MIRISSA-2026-V1',
      effectiveFromIso: '2026-11-01T00:00:00Z',
      effectiveToIso: '2027-04-30T23:59:59Z',
      location: { city: 'Mirissa', country: 'Sri Lanka', countryCode: 'LK' },
      contractedBaseCost: 75000,
      standardSellingPriceLkr: 95000,
      costCurrency: 'LKR',
      sellingCurrency: 'LKR',
      markupPercent: 26.6,
      commissionPercent: 5.0,
      isTaxInclusive: true,
      availableQuota: 5,
      allotmentTotal: 10,
      minLeadDays: 2,
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2027-04-30T23:59:59Z',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      partnerSlaHours: 4,
      freeCancellationDeadlineHours: 48,
      maxOccupancy: 6,
      inclusions: ['Daily Sri Lankan and continental breakfast', 'Dedicated chef and butler'],
      exclusions: ['Airport transfers', 'Alcoholic beverages'],
      cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.',
      exclusiveOffer: true,
      pinPriority: 8
    };

    const req = new Request('https://vacatina.com/api/v1/admin/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await globalApiRouter.handleRequest(req, dataClerkContext);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.listing.id, 'test-man-ht-mirissa-resort');
    assert.equal(body.listing.status, 'DRAFT');
    assert.equal(body.listing.readinessTier.productionSellable, false);
    assert.ok(body.listing.auditTrail.length >= 1);
  });

  it('Gate 4: Enforces 4-Eyes separation of duties across multi-stage lifecycle (DRAFT -> VERIFIED -> PRICED -> PUBLISHED)', async () => {
    const listingId = 'test-man-ht-mirissa-resort';

    // Step 1: Data clerk submits listing for verification
    const submitReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/submit`, {
      method: 'POST'
    });
    const submitRes = await globalApiRouter.handleRequest(submitReq, dataClerkContext);
    assert.equal(submitRes.status, 200);
    const submitBody = await submitRes.json();
    assert.equal(submitBody.listing.status, 'VERIFICATION_PENDING');

    // Step 2: Separation of Duties Guard — Creator tries to verify their own listing
    const selfVerifyReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/verify-commercial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidence: {
          contractReference: 'CNT-MIRISSA-2026-V1',
          supplierLegalName: 'Mirissa Oceanfront Hospitality Private Limited',
          settlementTerms: 'Net 30 days bank transfer',
          isEvidenceVerified: true,
          verifiedAtIso: new Date().toISOString()
        }
      })
    });
    const selfVerifyRes = await globalApiRouter.handleRequest(selfVerifyReq, dataClerkContext);
    assert.equal(selfVerifyRes.status, 403);
    const selfVerifyBody = await selfVerifyRes.json();
    assert.equal(selfVerifyBody.code, 'SEPARATION_OF_DUTIES_VIOLATION');

    // Step 3: Independent commercial risk officer verifies evidence dossier
    const legitVerifyReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/verify-commercial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evidence: {
          contractReference: 'CNT-MIRISSA-2026-V1',
          supplierLegalName: 'Mirissa Oceanfront Hospitality Private Limited',
          settlementTerms: 'Net 30 days bank transfer',
          isEvidenceVerified: true,
          verifiedAtIso: new Date().toISOString()
        }
      })
    });
    const legitVerifyRes = await globalApiRouter.handleRequest(legitVerifyReq, commercialOfficerContext);
    assert.equal(legitVerifyRes.status, 200);
    const legitVerifyBody = await legitVerifyRes.json();
    assert.equal(legitVerifyBody.listing.status, 'COMMERCIALLY_VERIFIED');

    // Step 4: Finance lead approves pricing structure
    const pricingReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/approve-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markupPercent: 28.0,
        standardSellingPriceLkr: 96000,
        note: 'Finance review complete; approved seasonal margin'
      })
    });
    const pricingRes = await globalApiRouter.handleRequest(pricingReq, financeLeadContext);
    assert.equal(pricingRes.status, 200);
    const pricingBody = await pricingRes.json();
    assert.equal(pricingBody.listing.standardSellingPriceLkr, 96000);
    assert.equal(pricingBody.listing.isPricingApproved, true);

    // Step 5: Publishing Director publishes listing to live sales channel
    const publishReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/publish`, {
      method: 'POST'
    });
    const publishRes = await globalApiRouter.handleRequest(publishReq, publishingDirectorContext);
    assert.equal(publishRes.status, 200);
    const publishBody = await publishRes.json();
    assert.equal(publishBody.listing.status, 'ACTIVE');
    assert.equal(publishBody.listing.readinessTier.productionSellable, true);
  });

  it('Gate 5: Anti-Tamper Governance demotes live listing to DRAFT upon commercial/rate tampering', async () => {
    const listingId = 'test-man-ht-mirissa-resort';

    // Verify current status is ACTIVE/PUBLISHED
    const getReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}`, { method: 'GET' });
    const getRes = await globalApiRouter.handleRequest(getReq, dataClerkContext);
    const getBody = await getRes.json();
    assert.equal(getBody.listing.status, 'ACTIVE');

    // Attempt to tamper with selling price without governance approvals
    const tamperReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        standardSellingPriceLkr: 45000, // Unauthorized price cut
        reason: 'Operator attempted unapproved price discount'
      })
    });
    const tamperRes = await globalApiRouter.handleRequest(tamperReq, dataClerkContext);
    assert.equal(tamperRes.status, 200);
    const tamperBody = await tamperRes.json();

    // Anti-Tamper Demotion Rule must kick in
    assert.equal(tamperBody.listing.status, 'DRAFT', 'Live listing must demote to DRAFT upon commercial rate alteration');
    assert.equal(tamperBody.listing.readinessTier.productionSellable, false, 'Production sellability revoked');
    const lastAudit = tamperBody.listing.auditTrail[tamperBody.listing.auditTrail.length - 1];
    assert.equal(lastAudit.action, 'ANTI_TAMPER_DEMOTION_TO_DRAFT');
  });

  it('Gate 6: Operational Stop-Sell toggle and allotment adjustments with audit tracking', async () => {
    const listingId = maleFlight.listing.id;

    // 1. Activate Stop-Sell
    const stopReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Monsoon weather safety grounding' })
    });
    const stopRes = await globalApiRouter.handleRequest(stopReq, commercialOfficerContext);
    assert.equal(stopRes.status, 200);
    const stopBody = await stopRes.json();
    assert.equal(stopBody.isStopSaleActive, true);

    // 2. Adjust Allotment
    const allotReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/allotment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota: 12, reason: 'Carrier added extra seaplane rotation' })
    });
    const allotRes = await globalApiRouter.handleRequest(allotReq, commercialOfficerContext);
    assert.equal(allotRes.status, 200);
    const allotBody = await allotRes.json();
    assert.equal(allotBody.availableQuota, 12);

    // 3. Resume Sale
    const resumeReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Weather cleared, resume normal operations' })
    });
    const resumeRes = await globalApiRouter.handleRequest(resumeReq, commercialOfficerContext);
    assert.equal(resumeRes.status, 200);
    const resumeBody = await resumeRes.json();
    assert.equal(resumeBody.isStopSaleActive, false);

    // 4. Inspect Chronological Audit Trail
    const auditsReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/audits`, { method: 'GET' });
    const auditsRes = await globalApiRouter.handleRequest(auditsReq, commercialOfficerContext);
    assert.equal(auditsRes.status, 200);
    const auditsBody = await auditsRes.json();
    assert.ok(auditsBody.totalAudits >= 2);
  });

  it('Gate 7: Multi-Source Search Aggregator aggregates manual listings while isolating SEED content', async () => {
    // 1. Search Hotels in Galle — returns the published direct-contract fixture
    const searchReq = new Request('https://vacatina.com/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productType: 'hotels',
        destination: 'Galle'
      })
    });

    const searchRes = await globalApiRouter.handleRequest(searchReq, customerContext);
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.ok(searchBody.offers.length >= 1, 'Returns at least one matching offer');

    const fixtureOffer = searchBody.offers.find((offer: any) => offer.canonicalOfferId === galleHotel.offerId);
    assert.ok(fixtureOffer, 'Published direct-contract fixture must be customer-visible');

    // 2. Strict SEED Isolation Invariant: seed/scaffold content must never leak into search
    assert.equal(
      searchBody.offers.some((offer: any) => offer.canonicalOfferId === 'vct-man-ho-ht_001'),
      false,
      'SEED hotel fixture must not leak into customer search'
    );
    assert.equal(
      searchBody.offers.some((offer: any) => String(offer.canonicalOfferId).includes('cms_dir_')),
      false,
      'CMS seed listing ids must not leak into customer search'
    );
  });

  it('Gate 8 (Negative Test): Strict SEED Quarantine — SEED item cannot stage as READY in Trip Bucket', async () => {
    const sessionId = 'session_seed_quarantine_test';

    // Attempt to stage a SEED sample card with forced state = 'READY'
    const stageReq = new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        canonicalOfferId: 'vct-man-ho-ht_001',
        productType: 'hotels',
        sourceType: 'SEED',
        title: 'Heritance Kandalama Demo Accelerator Card',
        unitSellingPriceMinor: 8900000,
        currency: 'LKR',
        state: 'READY' // Attempt to bypass readiness guard
      })
    });

    const stageRes = await globalApiRouter.handleRequest(stageReq, customerContext);
    assert.equal(stageRes.status, 409);
    const stageBody = await stageRes.json();
    assert.equal(stageBody.code, 'OFFER_NOT_SELLABLE');

    // The rejected item must not mutate the bucket at all
    const bucketReq = new Request('https://vacatina.com/api/v1/trip-buckets', {
      method: 'GET',
      headers: sessionHeaders(sessionId)
    });
    const bucketRes = await globalApiRouter.handleRequest(bucketReq, customerContext);
    assert.equal(bucketRes.status, 200);
    const bucketBody = await bucketRes.json();
    assert.equal(bucketBody.totalItems, 0, 'Rejected SEED item must not be stored');
    assert.equal(bucketBody.readyCount, 0, 'Ready count must be 0');
    assert.equal(bucketBody.readySubtotalMinor, 0, 'Ready subtotal must exclude quarantined SEED item');
    assert.equal(bucketBody.needsActionCount, 0, 'Rejected SEED item must not be counted as needs-action');
  });

  it('Gate 9 (Negative Test): Stopped or Suspended Manual Inventory Disappears from Customer Search Results', async () => {
    const listingId = maleFlight.listing.id;

    // 1. Ensure listing is stopped
    const stopReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Pre-flight weather suspension' })
    });
    const stopRes = await globalApiRouter.handleRequest(stopReq, commercialOfficerContext);
    assert.equal(stopRes.status, 200);

    // 2. Customer searches for flights to Male
    const searchReq = new Request('https://vacatina.com/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productType: 'flights',
        destination: 'Male'
      })
    });
    const searchRes = await globalApiRouter.handleRequest(searchReq, customerContext);
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();

    // Stopped manual listing must NOT appear in search results
    const foundStopped = searchBody.offers?.find((offer: any) => offer.canonicalOfferId === maleFlight.offerId);
    assert.equal(foundStopped, undefined, 'Stopped manual listing must disappear from sellable search results');

    // 3. Resume sale and verify it reappears
    const resumeReq = new Request(`https://vacatina.com/api/v1/admin/listings/${listingId}/stop-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Weather cleared, resume' })
    });
    const resumeRes = await globalApiRouter.handleRequest(resumeReq, commercialOfficerContext);
    assert.equal(resumeRes.status, 200);

    const searchResumeReq = new Request('https://vacatina.com/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productType: 'flights',
        destination: 'Male'
      })
    });
    const searchAfterResumeRes = await globalApiRouter.handleRequest(searchResumeReq, customerContext);
    const searchAfterResumeBody = await searchAfterResumeRes.json();
    const foundResumed = searchAfterResumeBody.offers?.find((offer: any) => offer.canonicalOfferId === maleFlight.offerId);
    assert.ok(foundResumed, 'Resumed manual listing must reappear in customer search results');
  });

  it('Gate 10 (Negative Test): Exhausted Allotment Guard — Over-selling Quota Throws Error', () => {
    const listingId = maleFlight.listing.id;
    const listing = manualInventoryService.getListing(listingId)!;
    const initialQuota = listing.availableQuota;

    // Attempting to hold more units than available quota must throw an Error
    assert.throws(
      () => {
        manualInventoryService.holdAllotment(listingId, initialQuota + 50);
      },
      (err: Error) => {
        return err.message.includes('Allotment Exceeded');
      },
      'Attempting to hold beyond available quota must fail closed'
    );
  });
});
