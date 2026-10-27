/* ============================================================================
 * Vacatina Commercial Truth & Operational Reality Test Suite
 *
 * Authority: docs/architecture/35_vacatina_route_to_inventory_integration_matrix_and_truth_gap_report.md
 * Validates:
 *   Gate T1: SEED quarantine (cannot search, cannot stage READY, cannot checkout)
 *   Gate T2: Uncredentialed external providers resolve to honest statuses (never VERIFIED_EXISTING without evidence)
 *   Gate T3: Unverified manual workflows resolve to MANUAL_OPERATION_PROPOSED
 *   Gate T4: Pre-booking revalidation truth (unmapped -> RECHECK_REQUIRED, expired/stopped -> UNAVAILABLE/EXPIRED)
 *   Gate T5: Trip Bucket anti-spoofing (client cannot bypass revalidation to mark item READY)
 *   Gate T6: Honest customer-facing confirmation labels with zero technical source leakage
 *   Gate T7: Automated documentation scanner enforces zero unsupported commercial claims
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ALL_COMMERCIAL_TRUTH_STATUSES,
  COMMERCIAL_EVIDENCE_LEDGER,
  resolveProviderTruth,
  resolveOfferTruth,
  isSeedOffer,
  isSeedFixtureLoadingAllowed,
  getGlobalProductionBlockers,
  deriveCustomerBookingMode,
  getCustomerConfirmationLabel,
  leaksInternalSourceLabel,
  findUnsupportedCommercialClaims,
  evaluateProviderActivation,
  assertOfferBookableInCurrentEnvironment
} from '../src/server/inventory/commercial-truth.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { globalUnifiedInventory } from '../src/server/inventory/unified-inventory.service.ts';
import { manualInventoryService } from '../src/lib/services/manual-inventory.service.ts';
import { InventoryOrchestratorService } from '../src/server/inventory/inventory-orchestrator.service.ts';
import { DeduplicationService } from '../src/server/inventory/deduplication.service.ts';
import { composeHybridOffer } from '../src/server/inventory/hybrid-authority.ts';
import {
  InMemoryManualListingRepository,
  POSTGRES_MANUAL_LISTING_SCHEMA_DDL,
  type AdminActor,
  type ProductionManualListingEntity
} from '../src/server/inventory/repository/manual-listing.repository.ts';
import type { CanonicalOfferEntity } from '../src/server/inventory/types.ts';
import { customerContext, sessionHeaders } from './support/canonical-fixtures.ts';

describe('Vacatina Commercial Truth & Operational Reality Suite', () => {

  it('Gate T1: SEED Quarantine — Prototype / sample items are detected, filtered from search, and blocked from checkout', async () => {
    // 1. isSeedOffer detects SEED environmentClass or SAMPLE_DEMO
    const seedOffer: Partial<CanonicalOfferEntity> = {
      offerId: 'vct-flt-seed-01',
      environmentClass: 'SEED',
      supplierId: 'DUFFEL_NDC',
      sourceType: 'API'
    };
    assert.equal(isSeedOffer(seedOffer as any), true);
    assert.equal(resolveOfferTruth(seedOffer as any), 'SEED_ONLY');

    const sampleDemoOffer: Partial<CanonicalOfferEntity> = {
      offerId: 'vct-htl-sample-02',
      environmentClass: 'PRODUCTION',
      supplierId: 'SEED_SAMPLE_HOTEL_PARTNER',
      commercialStatus: 'SAMPLE_DEMO',
      sourceType: 'MANUAL'
    };
    assert.equal(isSeedOffer(sampleDemoOffer as any), true);
    assert.equal(resolveOfferTruth(sampleDemoOffer as any), 'SEED_ONLY');

    // 2. Production runtime prohibits seed fixture loading
    assert.equal(isSeedFixtureLoadingAllowed({ NODE_ENV: 'production' }), false);
    assert.equal(isSeedFixtureLoadingAllowed({ VACATINA_ENV: 'production' }), false);
    assert.equal(isSeedFixtureLoadingAllowed({ VACATINA_DISABLE_SEED_FIXTURES: '1' }), false);

    // 3. InventoryOrchestrator pre-checkout assertion throws for SEED items
    const orchestrator = new InventoryOrchestratorService();
    assert.throws(
      () => orchestrator.assertOfferCheckoutReady(seedOffer as any),
      (err: any) => err.code === 'SAMPLE_INVENTORY_CANNOT_CHECKOUT' || err.message.includes('SAMPLE_INVENTORY')
    );
  });

  it('Gate T2: Honest Provider Truth — External providers resolve to SANDBOX_ONLY or CREDENTIALS_REQUIRED, never VERIFIED_EXISTING without evidence', () => {
    assert.equal(COMMERCIAL_EVIDENCE_LEDGER.length, 0, 'Evidence ledger must ship empty');

    const externalProviders = [
      'DUFFEL_NDC',
      'LITEAPI',
      'VIATOR',
      'RENTALCARS',
      'TRAVELTEK',
      'TRAINLINE',
      'ALLIANZ'
    ];

    for (const provider of externalProviders) {
      const resolution = resolveProviderTruth(provider);
      assert.notEqual(
        resolution.primary,
        'VERIFIED_EXISTING',
        `Provider ${provider} must NOT resolve to VERIFIED_EXISTING without evidence in ledger`
      );
      assert.ok(
        resolution.statuses.includes('CREDENTIALS_REQUIRED') || resolution.statuses.includes('COMMERCIAL_AGREEMENT_REQUIRED'),
        `Provider ${provider} must declare credentials or agreement required`
      );
    }

    // Global production blockers must flag that evidence ledger is empty
    const blockers = getGlobalProductionBlockers({}, COMMERCIAL_EVIDENCE_LEDGER);
    assert.ok(
      blockers.some(b => b.code === 'NO_VERIFIED_COMMERCIAL_EVIDENCE'),
      'Global blockers must declare NO_VERIFIED_COMMERCIAL_EVIDENCE when ledger is empty'
    );
  });

  it('Gate T3: Unverified Manual Workflows — Internal manual desks resolve to MANUAL_OPERATION_PROPOSED', () => {
    const internalDesks = [
      'PAYLOAD_CMS_DIRECT',
      'VACATINA_CONSULAR_CONCIERGE',
      'VACATINA_CONSULAR_DESK',
      'VACATINA_HYBRID_BUNDLER'
    ];

    for (const desk of internalDesks) {
      const resolution = resolveProviderTruth(desk);
      assert.equal(
        resolution.primary,
        'MANUAL_OPERATION_PROPOSED',
        `Desk ${desk} must resolve to MANUAL_OPERATION_PROPOSED without owner confirmation evidence`
      );
    }
  });

  it('Gate T4: Pre-Booking Revalidation Truth — Stopped or expired listings return UNAVAILABLE / EXPIRED, unmapped returns RECHECK_REQUIRED', async () => {
    // 1. Unmapped offer cannot blindly claim UNCHANGED
    const unmappedReval = await globalUnifiedInventory.revalidateOffer('vct-flt-unmapped-xyz-999');
    assert.equal(unmappedReval.status, 'RECHECK_REQUIRED');
    assert.ok(unmappedReval.message?.toLowerCase().includes('recheck') || unmappedReval.message?.toLowerCase().includes('revalidation'));

    // 2. Stopped manual listing returns UNAVAILABLE
    const stoppedListingId = 'cms_test_stop_' + Date.now();
    globalUnifiedInventory.getManualAdapter().registerListing({
      id: stoppedListingId,
      productType: 'hotels',
      partnerSupplierId: 'PARTNER_TEST',
      partnerName: 'Test Partner',
      title: 'Stop Sell Test Hotel',
      subtitle: 'Luxury test villa',
      location: { city: 'Colombo', country: 'Sri Lanka' },
      confirmationMode: 'REQUEST_TO_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 2000000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: ['Mini Bar'],
      cancellationPolicy: 'Non-refundable',
      pinAboveApi: false,
      status: 'PUBLISHED',
      isStopSaleActive: true
    });

    const stoppedReval = await globalUnifiedInventory.revalidateOffer(stoppedListingId);
    assert.equal(stoppedReval.status, 'UNAVAILABLE');
    assert.ok(stoppedReval.message?.includes('stop-sell') || stoppedReval.message?.includes('Listing is under stop-sell'));

    // 3. Expired manual listing returns EXPIRED
    const expiredListingId = 'cms_test_exp_' + Date.now();
    globalUnifiedInventory.getManualAdapter().registerListing({
      id: expiredListingId,
      productType: 'hotels',
      partnerSupplierId: 'PARTNER_TEST',
      partnerName: 'Test Partner',
      title: 'Expired Test Hotel',
      subtitle: 'Expired villa',
      location: { city: 'Colombo', country: 'Sri Lanka' },
      confirmationMode: 'REQUEST_TO_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 2000000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: ['Mini Bar'],
      cancellationPolicy: 'Non-refundable',
      pinAboveApi: false,
      status: 'PUBLISHED',
      isStopSaleActive: false,
      validUntil: new Date(Date.now() - 3600000).toISOString()
    });

    const expiredReval = await globalUnifiedInventory.revalidateOffer(expiredListingId);
    assert.equal(expiredReval.status, 'EXPIRED');
    assert.ok(expiredReval.message?.includes('validity window has passed'));
  });

  it('Gate T5: Trip Bucket Anti-Spoofing — Client cannot stage unverified items as READY without passing revalidation', async () => {
    const customer = customerContext('truth_t5_customer');
    const sessionId = 'session_truth_t5';

    // Attempt to inject an unmapped offer with state: 'READY'
    const spoofReq = new Request('https://vacatina.com/api/v1/trip-buckets/items', {
      method: 'POST',
      headers: sessionHeaders(sessionId),
      body: JSON.stringify({
        offerId: 'vct-flt-spoofed-offer-01',
        title: 'Spoofed Flight Offer',
        productType: 'flights',
        supplierId: 'DUFFEL_NDC',
        sourceType: 'API',
        sellingPriceMinor: 9500000,
        state: 'READY' // Attempt to bypass server revalidation
      })
    });

    const res = await globalApiRouter.handleRequest(spoofReq, customer);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'OFFER_NOT_SELLABLE');

    // The rejected offer must not mutate the trip bucket
    const bucketRes = await globalApiRouter.handleRequest(new Request('https://vacatina.com/api/v1/trip-buckets', {
      method: 'GET',
      headers: sessionHeaders(sessionId)
    }), customer);
    assert.equal(bucketRes.status, 200);
    const bucketBody = await bucketRes.json();
    assert.equal(bucketBody.totalItems, 0);
    assert.equal(bucketBody.readyCount, 0);
    assert.equal(bucketBody.readySubtotalMinor, 0);
  });

  it('Gate T6: Honest Customer-Facing Confirmation Language — Zero technical source leakage', () => {
    // 1. Label derivation respects honest customer copy
    const instantOffer = {
      productType: 'flights' as const,
      fulfillmentMode: 'INSTANT' as const,
      bookingMode: 'INSTANT_BOOK' as const,
      confirmationMode: 'INSTANT' as const,
      listingKind: 'SELLABLE_INVENTORY' as const
    };
    assert.equal(getCustomerConfirmationLabel(instantOffer), 'Instant confirmation');

    const requestOffer = {
      productType: 'hotels' as const,
      fulfillmentMode: 'MANUAL_CONFIRMATION' as const,
      bookingMode: 'REQUEST_TO_BOOK' as const,
      confirmationMode: 'REQUEST_TO_CONFIRM' as const,
      listingKind: 'SELLABLE_INVENTORY' as const
    };
    assert.equal(getCustomerConfirmationLabel(requestOffer), 'Confirmation required');

    const assistedOffer = {
      productType: 'visa' as const,
      fulfillmentMode: 'MANUAL_CONFIRMATION' as const,
      bookingMode: 'REQUEST_TO_BOOK' as const,
      confirmationMode: 'ASSISTED_SERVICE' as const,
      listingKind: 'SERVICE' as const
    };
    assert.equal(getCustomerConfirmationLabel(assistedOffer), 'Vacatina assistance');

    // 2. leaksInternalSourceLabel accurately flags internal technical terms
    assert.equal(leaksInternalSourceLabel('Instant confirmation'), false);
    assert.equal(leaksInternalSourceLabel('Vacatina assistance'), false);
    assert.equal(leaksInternalSourceLabel('Confirmation required'), false);

    assert.equal(leaksInternalSourceLabel('This is an API listing'), true);
    assert.equal(leaksInternalSourceLabel('Filter by manual listing'), true);
    assert.equal(leaksInternalSourceLabel('Requires DUFFEL_NDC connection'), true);
    assert.equal(leaksInternalSourceLabel('Seed fixture data'), true);
  });

  it('Gate T7: Documentation Truth Audit — Verifies zero unsupported commercial claims in Matrix & Gap Report', () => {
    const docPath = path.resolve(process.cwd(), 'docs/architecture/35_vacatina_route_to_inventory_integration_matrix_and_truth_gap_report.md');
    assert.ok(fs.existsSync(docPath), 'Matrix & Gap report must exist at docs/architecture/35_...');

    const docContent = fs.readFileSync(docPath, 'utf-8');
    const unsupportedClaims = findUnsupportedCommercialClaims(docContent);

    assert.deepEqual(
      unsupportedClaims,
      [],
      `Found unsupported commercial claims in docs/architecture/35_...: ${unsupportedClaims.join(', ')}`
    );
  });

  it('Gate T8: Provider Activation State Machine — 6-Stage Governance enforces BOTH credentials & contract for LIVE', () => {
    // 1. Initial empty state -> SANDBOX (for in-repo adapter) or PLANNED
    const evalEmpty = evaluateProviderActivation('DUFFEL_NDC', {}, []);
    assert.equal(evalEmpty.stage, 'SANDBOX');
    assert.equal(evalEmpty.canProduceProductionBookableInventory, false);
    assert.ok(evalEmpty.blockers.includes('PRODUCTION_CREDENTIALS_MISSING'));
    assert.ok(evalEmpty.blockers.includes('COMMERCIAL_EVIDENCE_MISSING'));

    // 2. Only credentials -> CREDENTIALS_CONFIGURED (never LIVE)
    const evalCredsOnly = evaluateProviderActivation(
      'DUFFEL_NDC',
      { DUFFEL_ACCESS_TOKEN: 'live_token_secret', DUFFEL_ENVIRONMENT: 'production' },
      []
    );
    assert.equal(evalCredsOnly.stage, 'CREDENTIALS_CONFIGURED');
    assert.equal(evalCredsOnly.canProduceProductionBookableInventory, false);
    assert.ok(evalCredsOnly.blockers.includes('COMMERCIAL_EVIDENCE_UNVERIFIED'));

    // 3. Only commercial contract -> COMMERCIAL_VERIFIED (never LIVE)
    const mockLedgerContract = [{
      entityId: 'DUFFEL_NDC',
      kind: 'SIGNED_CONTRACT' as const,
      reference: 'AGR-DUFFEL-2026-001',
      verifiedBy: 'Commercial Lead',
      verifiedAtIso: new Date().toISOString()
    }];
    const evalContractOnly = evaluateProviderActivation('DUFFEL_NDC', {}, mockLedgerContract);
    assert.equal(evalContractOnly.stage, 'COMMERCIAL_VERIFIED');
    assert.equal(evalContractOnly.canProduceProductionBookableInventory, false);
    assert.ok(evalContractOnly.blockers.includes('PRODUCTION_CREDENTIALS_MISSING'));

    // 4. BOTH credentials AND contract -> LIVE (Production Bookable)
    const evalLive = evaluateProviderActivation(
      'DUFFEL_NDC',
      { DUFFEL_ACCESS_TOKEN: 'live_token_secret', DUFFEL_ENVIRONMENT: 'production' },
      mockLedgerContract
    );
    assert.equal(evalLive.stage, 'LIVE');
    assert.equal(evalLive.canProduceProductionBookableInventory, true);
    assert.equal(evalLive.blockers.length, 0);

    // 5. Suspension flag -> SUSPENDED
    const evalSuspended = evaluateProviderActivation(
      'DUFFEL_NDC',
      { SUSPEND_PROVIDER_DUFFEL_NDC: '1' },
      mockLedgerContract
    );
    assert.equal(evalSuspended.stage, 'SUSPENDED');
    assert.equal(evalSuspended.canProduceProductionBookableInventory, false);
  });

  it('Gate T9: Production Checkout Environment Guard — Rejects un-LIVE providers & unverified manual listings', () => {
    // 1. Un-LIVE API provider blocked in production runtime
    const sandboxApiOffer: Partial<CanonicalOfferEntity> = {
      offerId: 'vct-flt-api-dxb-01',
      sourceType: 'API',
      supplierId: 'DUFFEL_NDC',
      providerId: 'DUFFEL_NDC',
      environmentClass: 'PRODUCTION'
    };

    assert.throws(
      () => assertOfferBookableInCurrentEnvironment(sandboxApiOffer as any, { NODE_ENV: 'production' }, []),
      (err: any) => err.code === 'PROVIDER_NOT_LIVE_FOR_PRODUCTION'
    );

    // 2. Unverified manual listing blocked in production runtime
    const unverifiedManualOffer: Partial<CanonicalOfferEntity> = {
      offerId: 'vct-htl-man-unverified-01',
      sourceType: 'MANUAL',
      supplierId: 'UNVERIFIED_HOTEL',
      commercialStatus: 'CANDIDATE_UNVERIFIED',
      environmentClass: 'PRODUCTION'
    };

    assert.throws(
      () => assertOfferBookableInCurrentEnvironment(unverifiedManualOffer as any, { NODE_ENV: 'production' }, []),
      (err: any) => err.code === 'UNVERIFIED_MANUAL_LISTING_CANNOT_CHECKOUT'
    );
  });

  it('Gate T10: Hybrid Field Authority Matrix — Enforces field ownership & prevents silent overwriting', () => {
    const baseSupplierOffer: Partial<CanonicalOfferEntity> = {
      canonicalOfferId: 'vct-htl-api-liteapi-atlantis-01',
      offerId: 'vct-htl-api-liteapi-atlantis-01',
      productType: 'hotels',
      sourceType: 'API',
      supplierId: 'LITEAPI',
      providerId: 'LITEAPI',
      pricing: {
        rawSupplierCostMinor: 4500000,
        rawCurrency: 'LKR',
        platformMarkupMinor: 0,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 4500000,
        currency: 'LKR'
      },
      availabilityStatus: 'LIVE',
      inclusions: ['Room Only'],
      exclusions: ['Breakfast', 'Transfers'],
      environmentClass: 'PRODUCTION'
    };

    const overlay = {
      markupMinor: 800000,
      inclusions: ['Daily International Buffet Breakfast', 'VIP Fast-track'],
      exclusions: [],
      conciergeNotes: 'Exclusive Vacatina Direct Perk',
      commercialEvidenceReference: 'EVID-HOTEL-ATLANTIS-001'
    };

    const composed = composeHybridOffer(baseSupplierOffer as any, overlay);

    assert.equal(composed.sourceType, 'HYBRID');
    assert.equal(composed.compositionType, 'DYNAMIC_BUNDLE');
    assert.equal(composed.pricing.rawSupplierCostMinor, 4500000);
    assert.equal(composed.pricing.platformMarkupMinor, 800000);
    assert.equal(composed.pricing.finalSellingPriceMinor, 5300000); // 45,000 + 8,000 = 53,000 LKR
    assert.equal(composed.availabilityStatus, 'LIVE'); // Preserves supplier authoritative availability
    assert.ok(composed.inclusions.includes('Daily International Buffet Breakfast'));
    assert.equal(composed.commercialEvidenceId, 'EVID-HOTEL-ATLANTIS-001');
  });

  it('Gate T11: Persistence-Ready Repository Boundary — 4-Eyes lifecycle & mandatory evidence to publish', async () => {
    const repo = new InMemoryManualListingRepository();
    const adminActor: AdminActor = { id: 'usr_clerk_01', name: 'Contract Clerk', role: 'CONTENT_MARKETING' };
    const directorActor: AdminActor = { id: 'usr_dir_02', name: 'Commercial Director', role: 'PLATFORM_ADMIN' };

    const sampleListing: ProductionManualListingEntity = {
      listingId: 'lst_man_sigiriya_01',
      canonicalEntityId: 'ent_htl_sigiriya_boutique',
      productType: 'hotels',
      partnerSupplierId: 'SIGIRIYA_BOUTIQUE_RESORT',
      operatorName: 'Sigiriya Luxury Retreats Ltd',
      partnerName: 'Sigiriya Boutique',
      sourceType: 'MANUAL',
      fulfillmentMode: 'MANUAL_CONFIRMATION',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      title: 'Sigiriya Boutique Villa',
      description: 'Exclusive forest retreat adjacent to Sigiriya Rock Fortress.',
      destination: 'Sigiriya',
      location: { city: 'Sigiriya', country: 'Sri Lanka' },
      validFromIso: new Date().toISOString(),
      validUntilIso: new Date(Date.now() + 86400000 * 90).toISOString(),
      salesValidFromIso: new Date().toISOString(),
      salesValidUntilIso: new Date(Date.now() + 86400000 * 90).toISOString(),
      totalAllottedQuota: 10,
      availableQuota: 10,
      isStopSaleActive: false,
      contractedBaseCostMinor: 3500000,
      markupMinor: 700000,
      sellingPriceMinor: 4200000,
      currency: 'LKR',
      taxesAndFees: { isTaxInclusive: true },
      cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in',
      refundability: 'REFUNDABLE',
      inclusions: ['Breakfast', 'Welcome Drink'],
      exclusions: ['Mini Bar'],
      constraints: { maxOccupancy: 2 },
      media: { heroImageUrl: '/images/sigiriya.webp', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: 'Present passport upon arrival' },
      commercialEvidence: {
        referenceId: '', // Empty: unverified
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '',
        verifiedBy: '',
        verifiedAtIso: ''
      },
      workflowStatus: 'DRAFT',
      createdBy: adminActor,
      auditTrail: [],
      expiresAtIso: new Date(Date.now() + 86400000 * 90).toISOString()
    };

    // 1. Create in DRAFT
    const created = await repo.create(sampleListing, adminActor);
    assert.equal(created.workflowStatus, 'DRAFT');

    // 2. Transition to PUBLISHED fails without commercial evidence
    await assert.rejects(
      async () => repo.transitionLifecycle(created.listingId, 'PUBLISHED', directorActor),
      (err: any) => err.code === 'COMMERCIAL_EVIDENCE_REQUIRED_TO_PUBLISH'
    );

    // 3. Attach commercial evidence and transition to PUBLISHED
    await repo.update(created.listingId, {
      commercialEvidence: {
        referenceId: 'REF-SIGIRIYA-AGR-2026',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/vault/contracts/sigiriya-2026.pdf',
        verifiedBy: 'Legal Counsel',
        verifiedAtIso: new Date().toISOString()
      }
    }, adminActor);

    const published = await repo.transitionLifecycle(created.listingId, 'PUBLISHED', directorActor);
    assert.equal(published.workflowStatus, 'PUBLISHED');

    // 4. Stop-sale toggling updates audit trail
    const stopped = await repo.toggleStopSale(created.listingId, true, directorActor, 'Renovation maintenance');
    assert.equal(stopped.isStopSaleActive, true);
    assert.ok(stopped.auditTrail.some(a => a.action === 'STOP_SALE_ENABLED'));

    // 5. SQL DDL exportable
    assert.ok(POSTGRES_MANUAL_LISTING_SCHEMA_DDL.includes('CREATE TABLE IF NOT EXISTS vacatina_manual_listings'));
  });

  it('Gate T12: Deterministic Mixed Duplicate Offer Resolution — Verified pinned manual wins over API', () => {
    const apiOffer: Partial<CanonicalOfferEntity> = {
      canonicalOfferId: 'vct-htl-api-kandalama-01',
      offerId: 'vct-htl-api-kandalama-01',
      title: 'Heritance Kandalama',
      subtitle: 'Luxury hotel by Geoffrey Bawa',
      canonicalEntityId: 'ent_htl_heritance_kandalama',
      sourceType: 'API',
      supplierId: 'LITEAPI',
      pricing: {
        rawSupplierCostMinor: 5800000,
        rawCurrency: 'LKR',
        platformMarkupMinor: 0,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 5800000,
        currency: 'LKR'
      },
      pinAboveApi: false,
      commercialStatus: 'CANDIDATE_UNVERIFIED',
      environmentClass: 'PRODUCTION',
      availabilityStatus: 'LIVE',
      inclusions: ['Room Only'],
      exclusions: []
    };

    const manualOffer: Partial<CanonicalOfferEntity> = {
      canonicalOfferId: 'vct-htl-man-kandalama-direct-01',
      offerId: 'vct-htl-man-kandalama-direct-01',
      title: 'Heritance Kandalama',
      subtitle: 'Direct Contract Partner Rate',
      canonicalEntityId: 'ent_htl_heritance_kandalama',
      sourceType: 'MANUAL',
      supplierId: 'PAYLOAD_CMS_DIRECT',
      pricing: {
        rawSupplierCostMinor: 4800000,
        rawCurrency: 'LKR',
        platformMarkupMinor: 700000,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 5500000,
        currency: 'LKR'
      },
      pinAboveApi: true,
      commercialStatus: 'COMMERCIALLY_VERIFIED',
      commercialEvidenceId: 'EVID-AITKEN-2026-001',
      environmentClass: 'PRODUCTION',
      availabilityStatus: 'LIVE',
      inclusions: ['Breakfast included'],
      exclusions: []
    };

    const compositeKey = 'htl_heritance_kandalama_dambulla';
    (apiOffer as any).deduplicationKey = compositeKey;
    (manualOffer as any).deduplicationKey = compositeKey;

    const ranked = DeduplicationService.deduplicateAndRank([apiOffer as any, manualOffer as any]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].canonicalOfferId, manualOffer.canonicalOfferId, 'Verified pinned manual offer must win over API duplicate');
    assert.equal(ranked[0].sourceType, 'MANUAL');
  });
});
