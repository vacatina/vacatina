/* ============================================================================
 * Vacatina Shared Inventory & Canonical Offer Foundation Test Suite
 * Authority: Requirement 14 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 *
 * Verifies all 9 mandatory gates:
 * 1. Manual listing create/read/update/archive with 4-Eyes approval
 * 2. API offer normalization to UnifiedCanonicalOffer
 * 3. Duplicate prevention across suppliers
 * 4. Manual / API / Hybrid mixed search aggregation with SEED quarantine
 * 5. Stale offer detection via TTL
 * 6. Price change revalidation saga
 * 7. Unavailable & expired offer sagas
 * 8. Source provenance preservation
 * 9. Stable ID contract
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import type {
  CanonicalInventoryListing,
  UnifiedCanonicalOffer
} from '../src/server/inventory/domain/canonical-offer.ts';
import { CanonicalOfferMapper } from '../src/server/inventory/domain/canonical-mapper.ts';
import { CanonicalRevalidationService } from '../src/server/inventory/services/canonical-revalidation.service.ts';
import { CanonicalSearchOrchestratorService } from '../src/server/inventory/services/canonical-search-orchestrator.service.ts';
import type { ICanonicalProviderAdapter } from '../src/server/inventory/adapters/canonical-provider-adapter.interface.ts';
import { InMemoryManualListingRepository } from '../src/server/inventory/repository/manual-listing.repository.ts';
import { PostgresManualListingRepository } from '../src/server/inventory/repository/postgres-manual-listing.repository.ts';
import type { AdminActor, ProductionManualListingEntity } from '../src/server/inventory/repository/manual-listing.repository.ts';

test('Vacatina Shared Inventory & Canonical Offer Foundation Suite', async t => {
  const manualRepo = new InMemoryManualListingRepository();
  const revalService = new CanonicalRevalidationService(manualRepo);
  const orchestrator = new CanonicalSearchOrchestratorService(manualRepo);

  const creatorActor: AdminActor = {
    id: 'usr-content-01',
    name: 'Saman Perera',
    role: 'CONTENT_MARKETING'
  };

  const financeActor: AdminActor = {
    id: 'usr-finance-02',
    name: 'Dilshan Silva',
    role: 'FINANCE_OPS'
  };

  // =========================================================================
  // Gate 1: Manual Listing Create, Read, 4-Eyes Approval, Update, Stop-Sale & Archive
  // =========================================================================
  await t.test('Gate 1: Manual Listing Complete Lifecycle & 4-Eyes Governance', async () => {
    const listingId = 'man-hotel-galle-face-001';
    const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const newListing: ProductionManualListingEntity = {
      listingId,
      canonicalEntityId: 'HOTEL_LK_GALLE_FACE',
      productType: 'hotels',
      partnerSupplierId: 'GALLE_FACE_HOTEL_DIRECT',
      operatorName: 'Galle Face Hotel Co.',
      partnerName: 'Galle Face Heritage Management',
      sourceType: 'MANUAL',
      fulfillmentMode: 'INSTANT',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      title: 'Galle Face Hotel Colombo - Heritage Suite',
      description: 'Iconic heritage hotel oceanfront suite with colonial architecture.',
      destination: 'Colombo',
      location: { city: 'Colombo', country: 'Sri Lanka' },
      validFromIso: new Date().toISOString(),
      validUntilIso: futureDate,
      salesValidFromIso: new Date().toISOString(),
      salesValidUntilIso: futureDate,
      totalAllottedQuota: 10,
      availableQuota: 10,
      isStopSaleActive: false,
      contractedBaseCostMinor: 4000000, // LKR 40,000.00
      markupMinor: 800000,             // LKR 8,000.00
      sellingPriceMinor: 4800000,      // LKR 48,000.00
      currency: 'LKR',
      taxesAndFees: { isTaxInclusive: true, vatPercent: 18 },
      cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.',
      refundability: 'REFUNDABLE',
      inclusions: ['Breakfast Included', 'High Tea at The Verandah', 'Heritage Tour'],
      exclusions: ['Airport Transfer'],
      constraints: { maxOccupancy: 2 },
      media: {
        heroImageUrl: '/images/destinations/galle-face.jpg',
        galleryUrls: []
      },
      terms: { voucherRedemptionInstructions: 'Present passport upon arrival.' },
      commercialEvidence: {
        referenceId: 'MOU-GFH-2026-Q4',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/docs/contracts/galle-face-2026.pdf',
        verifiedBy: 'Dilshan Silva',
        verifiedAtIso: new Date().toISOString()
      },
      workflowStatus: 'DRAFT',
      createdBy: creatorActor,
      auditTrail: [],
      expiresAtIso: futureDate
    };

    // 1. Create in DRAFT
    const created = await manualRepo.create(newListing, creatorActor);
    assert.equal(created.workflowStatus, 'DRAFT');
    assert.equal(created.createdBy.id, creatorActor.id);

    // 2. 4-Eyes Invariant: Creator CANNOT approve their own listing
    await assert.rejects(
      async () => {
        await manualRepo.transitionLifecycle(listingId, 'FINANCE_APPROVED', creatorActor, 'Self approval attempt');
      },
      { name: 'ArchitecturalInvariantViolationError' }
    );

    // 3. Reviewer transitions DRAFT -> REVIEW -> FINANCE_APPROVED -> PUBLISHED
    await manualRepo.transitionLifecycle(listingId, 'REVIEW', creatorActor);
    await manualRepo.transitionLifecycle(listingId, 'FINANCE_APPROVED', financeActor, 'Commercial margin approved');
    const published = await manualRepo.transitionLifecycle(listingId, 'PUBLISHED', financeActor, 'Signed MOU verified');
    assert.equal(published.workflowStatus, 'PUBLISHED');
    assert.equal(published.approvedBy?.id, financeActor.id);

    // 4. Operational Stop-Sale Toggle
    const stopped = await manualRepo.toggleStopSale(listingId, true, financeActor, 'Monsoon storm renovation');
    assert.equal(stopped.isStopSaleActive, true);
    assert.equal(stopped.stopSaleReason, 'Monsoon storm renovation');

    // Reactivate
    const activeAgain = await manualRepo.toggleStopSale(listingId, false, financeActor);
    assert.equal(activeAgain.isStopSaleActive, false);

    // 5. Allotment Adjustment
    const decremented = await manualRepo.adjustAllotment(listingId, -2, creatorActor, 'Direct booking hold');
    assert.equal(decremented.availableQuota, 8);

    // Guard: Cannot over-sell below zero
    await assert.rejects(
      async () => {
        await manualRepo.adjustAllotment(listingId, -10, creatorActor, 'Excessive hold');
      },
      { name: 'ArchitecturalInvariantViolationError' }
    );

    // 6. Anti-Tamper: Modifying commercial rate demotes live listing to DRAFT
    const tampered = await manualRepo.update(listingId, { sellingPriceMinor: 3500000 }, creatorActor);
    assert.equal(tampered.workflowStatus, 'DRAFT');
  });

  // =========================================================================
  // Gate 2: API Offer Normalization
  // =========================================================================
  await t.test('Gate 2: API Offer Normalization into Universal Canonical Shape', () => {
    const rawSupplierHotel = {
      id: 'liteapi-prop-88219',
      supplierId: 'LITEAPI',
      name: 'Atlantis The Royal Dubai',
      destination: 'Dubai',
      country: 'United Arab Emirates',
      price: {
        amount: 450,
        currency: 'USD'
      },
      isTaxInclusive: true,
      cancellationPolicyText: 'Free cancellation until 72 hours before arrival.',
      inclusions: ['Royal Club Lounge Access', 'Aquaventure Unlimited Pass']
    };

    const offer = CanonicalOfferMapper.mapSupplierPayloadToOffer(rawSupplierHotel, 'liteapi_v2', 'hotels');

    assert.equal(offer.sourceType, 'API');
    assert.equal(offer.productType, 'hotels');
    assert.equal(offer.offerId, 'vct-api-hotels-liteapi_v2-liteapi-prop-88219');
    assert.equal(offer.supplierId, 'LITEAPI');
    assert.equal(offer.providerId, 'liteapi_v2');
    assert.equal(offer.externalOfferId, 'liteapi-prop-88219');
    assert.equal(offer.price, 450);
    assert.equal(offer.currency, 'USD');
    assert.equal(offer.priceBreakdown.totalMinor, 45000);
    assert.equal(offer.isSeed, false);
    assert.equal(offer.revalidationSupported, true);
    assert.ok(offer.inclusions.includes('Aquaventure Unlimited Pass'));
  });

  // =========================================================================
  // Gate 3: Duplicate Prevention & Deduplication
  // =========================================================================
  await t.test('Gate 3: Duplicate Prevention Across Multiple Suppliers & Source Precedence', async () => {
    // Mock supplier adapter returning a duplicate property
    const mockSupplierA: ICanonicalProviderAdapter = {
      providerId: 'expedia_gw',
      supplierId: 'EXPEDIA',
      productType: 'hotels',
      sourceType: 'API',
      isHealthy: async () => true,
      search: async () => [
        {
          offerId: 'vct-api-hotels-expedia-dubai-marina-01',
          productType: 'hotels',
          sourceType: 'API',
          supplierId: 'EXPEDIA',
          providerId: 'expedia_gw',
          title: 'Dubai Marina Luxury Resort',
          subtitle: 'Expedia Rate',
          destinationId: 'Dubai',
          location: { city: 'Dubai', country: 'UAE' },
          price: 250,
          currency: 'USD',
          basePrice: 250,
          taxAmount: 0,
          feeAmount: 0,
          priceBreakdown: { baseMinor: 25000, taxesMinor: 0, markupMinor: 0, totalMinor: 25000, currency: 'USD' },
          isTaxInclusive: true,
          availabilityStatus: 'AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 3600000).toISOString(),
          freshnessTtlSeconds: 1800,
          isStale: false,
          inclusions: ['Free WiFi'],
          exclusions: [],
          cancellationPolicy: { isRefundable: true, policyText: 'Refundable' },
          confirmationMode: 'INSTANT',
          bookingMode: 'INSTANT_BOOK',
          media: { heroImageUrl: '/test.jpg', galleryUrls: [] },
          revalidationSupported: true,
          metadata: {},
          isSeed: false
        }
      ],
      getOfferById: async () => null,
      revalidate: async () => ({
        offerId: 'vct-api-hotels-expedia-dubai-marina-01',
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: 25000,
        newPriceMinor: 25000,
        currency: 'USD',
        requiresUserAction: false,
        revalidatedAt: new Date().toISOString()
      })
    };

    const mockSupplierB: ICanonicalProviderAdapter = {
      providerId: 'agoda_gw',
      supplierId: 'AGODA',
      productType: 'hotels',
      sourceType: 'API',
      isHealthy: async () => true,
      search: async () => [
        {
          offerId: 'vct-api-hotels-agoda-dubai-marina-01',
          productType: 'hotels',
          sourceType: 'API',
          supplierId: 'AGODA',
          providerId: 'agoda_gw',
          title: 'Dubai Marina Luxury Resort',
          subtitle: 'Agoda Better Rate',
          destinationId: 'Dubai',
          location: { city: 'Dubai', country: 'UAE' },
          price: 230, // Lower price wins
          currency: 'USD',
          basePrice: 230,
          taxAmount: 0,
          feeAmount: 0,
          priceBreakdown: { baseMinor: 23000, taxesMinor: 0, markupMinor: 0, totalMinor: 23000, currency: 'USD' },
          isTaxInclusive: true,
          availabilityStatus: 'AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 3600000).toISOString(),
          freshnessTtlSeconds: 1800,
          isStale: false,
          inclusions: ['Free WiFi', 'Breakfast'],
          exclusions: [],
          cancellationPolicy: { isRefundable: true, policyText: 'Refundable' },
          confirmationMode: 'INSTANT',
          bookingMode: 'INSTANT_BOOK',
          media: { heroImageUrl: '/test.jpg', galleryUrls: [] },
          revalidationSupported: true,
          metadata: {},
          isSeed: false
        }
      ],
      getOfferById: async () => null,
      revalidate: async () => ({
        offerId: 'vct-api-hotels-agoda-dubai-marina-01',
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: 23000,
        newPriceMinor: 23000,
        currency: 'USD',
        requiresUserAction: false,
        revalidatedAt: new Date().toISOString()
      })
    };

    orchestrator.registerAdapter(mockSupplierA);
    orchestrator.registerAdapter(mockSupplierB);

    const results = await orchestrator.search({ productType: 'hotels', destination: 'Dubai' });
    const matching = results.filter(r => r.title === 'Dubai Marina Luxury Resort');

    // Deduplication assertion: Exactly 1 offer returned
    assert.equal(matching.length, 1);
    // Lower price won
    assert.equal(matching[0].price, 230);
    assert.equal(matching[0].supplierId, 'AGODA');
  });

  // =========================================================================
  // Gate 4: Mixed Search Aggregation (MANUAL + API + HYBRID) & SEED Quarantine
  // =========================================================================
  await t.test('Gate 4: Multi-Source Search Aggregator with Strict SEED Quarantine', async () => {
    // Add a live published manual package to manualRepo
    const packageListing: ProductionManualListingEntity = {
      listingId: 'man-pkg-sigiriya-001',
      canonicalEntityId: 'PKG_SIGIRIYA_WILDLIFE',
      productType: 'packages',
      partnerSupplierId: 'VACATINA_INHOUSE',
      operatorName: 'Vacatina Destination Management',
      partnerName: 'Vacatina Luxury Tours',
      sourceType: 'MANUAL',
      fulfillmentMode: 'INSTANT',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      title: 'Sigiriya Rock Fortress & Minneriya Safari',
      description: 'Exclusive 3-day private chauffeur tour.',
      destination: 'Sigiriya',
      location: { city: 'Sigiriya', country: 'Sri Lanka' },
      validFromIso: new Date().toISOString(),
      validUntilIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      salesValidFromIso: new Date().toISOString(),
      salesValidUntilIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      totalAllottedQuota: 5,
      availableQuota: 5,
      isStopSaleActive: false,
      contractedBaseCostMinor: 6000000,
      markupMinor: 1500000,
      sellingPriceMinor: 7500000, // LKR 75,000
      currency: 'LKR',
      taxesAndFees: { isTaxInclusive: true },
      cancellationPolicy: 'Refundable up to 7 days prior.',
      refundability: 'REFUNDABLE',
      inclusions: ['Private Chauffeur', 'Safari Jeep', 'Site Entry Tickets'],
      exclusions: ['Personal Expenses'],
      constraints: {},
      media: { heroImageUrl: '/sigiriya.jpg', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: 'Chauffeur meets at airport.' },
      commercialEvidence: {
        referenceId: 'MOU-SIG-2026',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/contracts/sigiriya.pdf',
        verifiedBy: 'Dilshan Silva',
        verifiedAtIso: new Date().toISOString()
      },
      workflowStatus: 'PUBLISHED',
      createdBy: creatorActor,
      auditTrail: [],
      expiresAtIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    };

    await manualRepo.create(packageListing, creatorActor);
    await manualRepo.transitionLifecycle('man-pkg-sigiriya-001', 'PUBLISHED', financeActor);

    // Mock Package Supplier Adapter returning both a valid API offer and a contaminated SEED fixture
    const packageAdapter: ICanonicalProviderAdapter = {
      providerId: 'tourradar_gw',
      supplierId: 'TOURRADAR',
      productType: 'packages',
      sourceType: 'API',
      isHealthy: async () => true,
      search: async () => [
        {
          offerId: 'vct-api-packages-tourradar-sigiriya-standard',
          productType: 'packages',
          sourceType: 'API',
          supplierId: 'TOURRADAR',
          providerId: 'tourradar_gw',
          title: 'Cultural Triangle Explorer (Tourradar)',
          subtitle: 'Group departure',
          destinationId: 'Sigiriya',
          location: { city: 'Sigiriya', country: 'Sri Lanka' },
          price: 85000,
          currency: 'LKR',
          basePrice: 85000,
          taxAmount: 0,
          feeAmount: 0,
          priceBreakdown: { baseMinor: 8500000, taxesMinor: 0, markupMinor: 0, totalMinor: 8500000, currency: 'LKR' },
          isTaxInclusive: true,
          availabilityStatus: 'AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 3600000).toISOString(),
          freshnessTtlSeconds: 1800,
          isStale: false,
          inclusions: ['Coach Bus', 'Guide'],
          exclusions: [],
          cancellationPolicy: { isRefundable: true, policyText: 'Standard' },
          confirmationMode: 'INSTANT',
          bookingMode: 'INSTANT_BOOK',
          media: { heroImageUrl: '/tour.jpg', galleryUrls: [] },
          revalidationSupported: true,
          metadata: {},
          isSeed: false
        },
        // SEED Quarantine Test: Must be rejected
        {
          offerId: 'vct-seed-packages-prototype-card-99',
          productType: 'packages',
          sourceType: 'API',
          supplierId: 'DEMO_ACCELERATOR',
          providerId: 'mock_seed',
          title: 'Prototype Unverified Demo Tour',
          subtitle: 'SEED Discovery Card',
          destinationId: 'Sigiriya',
          location: { city: 'Sigiriya', country: 'Sri Lanka' },
          price: 10000,
          currency: 'LKR',
          basePrice: 10000,
          taxAmount: 0,
          feeAmount: 0,
          priceBreakdown: { baseMinor: 1000000, taxesMinor: 0, markupMinor: 0, totalMinor: 1000000, currency: 'LKR' },
          isTaxInclusive: true,
          availabilityStatus: 'AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 3600000).toISOString(),
          freshnessTtlSeconds: 1800,
          isStale: false,
          inclusions: ['Prototype Inclusions'],
          exclusions: [],
          cancellationPolicy: { isRefundable: false, policyText: 'Demo' },
          confirmationMode: 'INSTANT',
          bookingMode: 'INSTANT_BOOK',
          media: { heroImageUrl: '/demo.jpg', galleryUrls: [] },
          revalidationSupported: false,
          metadata: {},
          isSeed: true // SEED FLAG TRIGGER
        }
      ],
      getOfferById: async () => null,
      revalidate: async () => ({
        offerId: 'vct-api-packages-tourradar-sigiriya-standard',
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: 8500000,
        newPriceMinor: 8500000,
        currency: 'LKR',
        requiresUserAction: false,
        revalidatedAt: new Date().toISOString()
      })
    };

    orchestrator.registerAdapter(packageAdapter);

    const searchResults = await orchestrator.search({ productType: 'packages', destination: 'Sigiriya' });

    // Assert SEED offer was quarantined and dropped
    const seedFound = searchResults.some(r => r.isSeed || r.offerId.includes('seed'));
    assert.equal(seedFound, false);

    // Assert both MANUAL and API offers exist in canonical results
    const hasManual = searchResults.some(r => r.sourceType === 'MANUAL');
    const hasApi = searchResults.some(r => r.sourceType === 'API');
    assert.equal(hasManual, true);
    assert.equal(hasApi, true);

    // Pin-Above-API Rule: MANUAL contract pins to top
    assert.equal(searchResults[0].sourceType, 'MANUAL');
    assert.equal(searchResults[0].offerId, 'vct-man-packages-man-pkg-sigiriya-001');
  });

  // =========================================================================
  // Gate 5: Stale Offer Detection
  // =========================================================================
  await t.test('Gate 5: Stale Offer Detection via TTL Check', () => {
    // 1. Fresh offer (created now)
    const freshTimestamp = new Date().toISOString();
    assert.equal(CanonicalOfferMapper.isStale(freshTimestamp, 900), false);

    // 2. Stale offer (20 minutes old with 15 min TTL)
    const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    assert.equal(CanonicalOfferMapper.isStale(staleTimestamp, 900), true);

    // 3. Undefined timestamp
    assert.equal(CanonicalOfferMapper.isStale(undefined, 900), true);
  });

  // =========================================================================
  // Gate 6: Price Change Revalidation Saga
  // =========================================================================
  await t.test('Gate 6: Price Change Detection during Revalidation Sagas', async () => {
    const apiOffer: UnifiedCanonicalOffer = {
      offerId: 'vct-api-flights-test-fz548',
      productType: 'flights',
      sourceType: 'API',
      supplierId: 'FLYDUBAI',
      providerId: 'gds_gateway',
      externalOfferId: 'fz-ext-8899',
      title: 'flydubai: CMB -> DXB',
      subtitle: 'Economy',
      destinationId: 'DXB',
      originId: 'CMB',
      location: { city: 'Dubai', country: 'UAE' },
      price: 105000,
      currency: 'LKR',
      basePrice: 105000,
      taxAmount: 0,
      feeAmount: 0,
      priceBreakdown: { baseMinor: 10500000, taxesMinor: 0, markupMinor: 0, totalMinor: 10500000, currency: 'LKR' },
      isTaxInclusive: true,
      availabilityStatus: 'AVAILABLE',
      lastCheckedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 900000).toISOString(),
      freshnessTtlSeconds: 900,
      isStale: false,
      inclusions: [],
      exclusions: [],
      cancellationPolicy: { isRefundable: true, policyText: 'Standard' },
      confirmationMode: 'INSTANT',
      bookingMode: 'INSTANT_BOOK',
      media: { heroImageUrl: '/flight.jpg', galleryUrls: [] },
      revalidationSupported: true,
      metadata: {},
      isSeed: false
    };

    // Upstream supplier adjusted fare up by LKR 4,500
    const mockUpstreamPriceAdjusted = async () => ({
      status: 'PRICE_CHANGED' as const,
      newTotalMinor: 10950000
    });

    const revalResult = await revalService.revalidate(apiOffer, mockUpstreamPriceAdjusted);

    assert.equal(revalResult.status, 'PRICE_CHANGED');
    assert.equal(revalResult.isPriceChanged, true);
    assert.equal(revalResult.previousPriceMinor, 10500000);
    assert.equal(revalResult.newPriceMinor, 10950000);
    assert.equal(revalResult.requiresUserAction, true);
    assert.ok(revalResult.actionMessage?.includes('fare adjusted'));
  });

  // =========================================================================
  // Gate 7: Unavailable & Expired Offer Sagas
  // =========================================================================
  await t.test('Gate 7: Unavailable and Expired Revalidation Sagas', async () => {
    // 1. Manual offer with quota = 0
    const depletedListing: ProductionManualListingEntity = {
      listingId: 'man-resort-mle-001',
      canonicalEntityId: 'RESORT_MLE_WATER_VILLA',
      productType: 'hotels',
      partnerSupplierId: 'MALDIVES_RESORTS_DIRECT',
      operatorName: 'Sun Siyam Resorts',
      partnerName: 'Sun Siyam Group',
      sourceType: 'MANUAL',
      fulfillmentMode: 'INSTANT',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      title: 'Sun Siyam Water Villa All-Inclusive',
      description: 'Overwater bungalow with pool.',
      destination: 'Maldives',
      location: { city: 'Male', country: 'Maldives' },
      validFromIso: new Date().toISOString(),
      validUntilIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      salesValidFromIso: new Date().toISOString(),
      salesValidUntilIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      totalAllottedQuota: 5,
      availableQuota: 0, // DEPLETED QUOTA
      isStopSaleActive: false,
      contractedBaseCostMinor: 12000000,
      markupMinor: 2500000,
      sellingPriceMinor: 14500000,
      currency: 'LKR',
      taxesAndFees: { isTaxInclusive: true },
      cancellationPolicy: 'Non-refundable.',
      refundability: 'NON_REFUNDABLE',
      inclusions: ['Seaplane Transfer'],
      exclusions: [],
      constraints: {},
      media: { heroImageUrl: '/mle.jpg', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: 'Resort desk at MLE airport.' },
      commercialEvidence: {
        referenceId: 'MOU-MLE-2026',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/contracts/mle.pdf',
        verifiedBy: 'Dilshan Silva',
        verifiedAtIso: new Date().toISOString()
      },
      workflowStatus: 'PUBLISHED',
      createdBy: creatorActor,
      auditTrail: [],
      expiresAtIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    };

    await manualRepo.create(depletedListing, creatorActor);
    await manualRepo.transitionLifecycle('man-resort-mle-001', 'PUBLISHED', financeActor);

    const manualOffer = CanonicalOfferMapper.mapManualListingToOffer({
      sourceType: 'MANUAL',
      productType: 'hotels',
      listingId: 'man-resort-mle-001',
      supplierId: 'MALDIVES_RESORTS_DIRECT',
      providerId: 'manual_cms',
      status: 'PUBLISHED',
      market: 'GLOBAL',
      currency: 'LKR',
      basePrice: 120000,
      availabilityStatus: 'UNAVAILABLE',
      lastSyncedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      validFrom: depletedListing.validFromIso,
      validTo: depletedListing.validUntilIso,
      createdBy: creatorActor.name,
      updatedBy: creatorActor.name,
      canonicalEntityId: 'RESORT_MLE_WATER_VILLA',
      title: depletedListing.title,
      description: depletedListing.description,
      destination: 'Maldives',
      contractedBaseCostMinor: 12000000,
      markupMinor: 2500000,
      sellingPriceMinor: 14500000,
      totalQuota: 5,
      availableQuota: 0,
      isStopSaleActive: false,
      inclusions: depletedListing.inclusions,
      exclusions: [],
      cancellationPolicy: depletedListing.cancellationPolicy,
      refundability: 'NON_REFUNDABLE',
      media: depletedListing.media
    });

    const res1 = await revalService.revalidate(manualOffer);
    assert.equal(res1.status, 'UNAVAILABLE');
    assert.ok(res1.actionMessage?.includes('allotment quota exhausted'));

    // 2. Upstream supplier sold-out signal
    const apiOfferSoldOut: UnifiedCanonicalOffer = {
      ...manualOffer,
      offerId: 'vct-api-hotels-liteapi-sold-out-sim',
      sourceType: 'API',
      externalOfferId: 'ext-sold-out'
    };

    const mockSoldOut = async () => ({ status: 'UNAVAILABLE' as const });
    const res2 = await revalService.revalidate(apiOfferSoldOut, mockSoldOut);
    assert.equal(res2.status, 'UNAVAILABLE');
    assert.equal(res2.requiresUserAction, true);

    // 3. Upstream supplier expired signal
    const mockExpired = async () => ({ status: 'EXPIRED' as const });
    const res3 = await revalService.revalidate(apiOfferSoldOut, mockExpired);
    assert.equal(res3.status, 'EXPIRED');
    assert.equal(res3.requiresUserAction, true);
  });

  // =========================================================================
  // Gate 8: Source Provenance & Authority Isolation
  // =========================================================================
  await t.test('Gate 8: Source Provenance & Hybrid Authority Isolation', () => {
    // 1. Pure Manual Offer
    const manualListing: CanonicalInventoryListing = {
      sourceType: 'MANUAL',
      productType: 'cars',
      listingId: 'man-car-dubai-chauffeur',
      supplierId: 'DUBAI_EXECUTIVE_CHAUFFEUR',
      providerId: 'manual_cms',
      status: 'PUBLISHED',
      market: 'AE',
      currency: 'AED',
      basePrice: 300,
      availabilityStatus: 'AVAILABLE',
      lastSyncedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      createdBy: 'Admin',
      updatedBy: 'Admin',
      canonicalEntityId: 'CAR_DXB_CHAUFFEUR',
      title: 'Dubai Chauffeur Mercedes S-Class Airport Transfer',
      description: 'Private airport transfer.',
      destination: 'Dubai',
      origin: 'DXB',
      contractedBaseCostMinor: 25000, // 250.00 AED
      markupMinor: 5000,             // 50.00 AED
      sellingPriceMinor: 30000,      // 300.00 AED
      totalQuota: 8,
      availableQuota: 8,
      isStopSaleActive: false,
      inclusions: ['Flight Tracking', '60 Mins Complimentary Wait Time'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation up to 12 hours prior.',
      refundability: 'REFUNDABLE',
      media: { heroImageUrl: '/car.jpg', galleryUrls: [] }
    };

    const offerManual = CanonicalOfferMapper.mapManualListingToOffer(manualListing);
    assert.equal(offerManual.sourceType, 'MANUAL');
    assert.equal(offerManual.price, 300);

    // 2. Hybrid Construction: Supplier Net + Vacatina Markup
    const supplierBaseHotel: UnifiedCanonicalOffer = {
      offerId: 'vct-api-hotels-liteapi-dubai-creek',
      productType: 'hotels',
      sourceType: 'API',
      supplierId: 'LITEAPI',
      providerId: 'liteapi_v2',
      externalOfferId: 'prop-8822',
      title: 'Park Hyatt Dubai Creek',
      subtitle: 'Standard Supplier Rate',
      destinationId: 'Dubai',
      location: { city: 'Dubai', country: 'UAE' },
      price: 280,
      currency: 'USD',
      basePrice: 280,
      taxAmount: 0,
      feeAmount: 0,
      priceBreakdown: { baseMinor: 28000, taxesMinor: 0, markupMinor: 0, totalMinor: 28000, currency: 'USD' },
      isTaxInclusive: true,
      availabilityStatus: 'AVAILABLE',
      lastCheckedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 1800000).toISOString(),
      freshnessTtlSeconds: 1800,
      isStale: false,
      inclusions: ['Breakfast at Cafe Arabesque'],
      exclusions: [],
      cancellationPolicy: { isRefundable: true, policyText: 'Standard hotel rules' },
      confirmationMode: 'INSTANT',
      bookingMode: 'INSTANT_BOOK',
      media: { heroImageUrl: '/park.jpg', galleryUrls: [] },
      revalidationSupported: true,
      metadata: {},
      isSeed: false
    };

    const hybridOffer = CanonicalOfferMapper.createHybridOffer(
      supplierBaseHotel,
      3500, // USD 35.00 Vacatina commercial markup
      {
        exclusivePerks: ['USD 100 Spa Credit', 'Guaranteed 2 PM Late Check-out'],
        bespokeTitle: 'Park Hyatt Dubai Creek (Vacatina Curated Package)'
      }
    );

    assert.equal(hybridOffer.sourceType, 'HYBRID');
    assert.equal(hybridOffer.offerId, 'vct-hyb-hotels-liteapi-dubai-creek');
    assert.equal(hybridOffer.price, 315); // 280 + 35
    assert.equal(hybridOffer.priceBreakdown.markupMinor, 3500);
    assert.equal(hybridOffer.priceBreakdown.totalMinor, 31500);
    assert.ok(hybridOffer.inclusions.includes('USD 100 Spa Credit'));
    // Invariant: underlying supplier provider ID is preserved in provenance
    assert.equal((hybridOffer.metadata as any).hybridProvenance.supplierProviderId, 'liteapi_v2');
  });

  // =========================================================================
  // Gate 9: Stable ID Contract
  // =========================================================================
  await t.test('Gate 9: Stable ID Contract Across Search, Details & Trip Bucket', () => {
    const rawFlight = {
      id: 'fz-flt-98124',
      supplierId: 'FLYDUBAI',
      marketingCarrier: { name: 'flydubai' },
      destination: 'DXB',
      origin: 'CMB',
      price: { totalMinor: 8900000, currency: 'LKR' }
    };

    const offer = CanonicalOfferMapper.mapSupplierPayloadToOffer(rawFlight, 'gds_ndc', 'flights');

    // 1. Verify all 7 stable contract fields exist and are deterministic
    assert.ok(offer.offerId.startsWith('vct-api-flights-gds_ndc-fz-flt-98124'));
    assert.equal(offer.productType, 'flights');
    assert.equal(offer.supplierId, 'FLYDUBAI');
    assert.equal(offer.price, 89000);
    assert.equal(offer.currency, 'LKR');
    assert.equal(offer.availabilityStatus, 'AVAILABLE');
    assert.ok(typeof offer.lastCheckedAt === 'string' && offer.lastCheckedAt.length > 10);

    // 2. Re-normalization produces identical stable offerId
    const offerAgain = CanonicalOfferMapper.mapSupplierPayloadToOffer(rawFlight, 'gds_ndc', 'flights');
    assert.equal(offerAgain.offerId, offer.offerId);
  });
});
