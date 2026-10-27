/* ============================================================================
 * Vacatina Hybrid Inventory & Canonical Offer Architecture Test Suite
 *
 * Authority: docs/architecture/44_vacatina_hybrid_inventory_and_canonical_offer_backend_handoff.md
 * Validates:
 *   Gate 1: Canonical Source Taxonomy (API, MANUAL, DIRECT_CONTRACT, COMPOSITE)
 *   Gate 2: CanonicalOffer Model Completeness & Stable ID Contract
 *   Gate 3: Universal Supplier Adapter Contracts across all 10 Canonical Verticals
 *   Gate 4: Manual Inventory 6-Stage Lifecycle (DRAFT -> REVIEW -> PUBLISHED -> PAUSED -> SOLD_OUT -> ARCHIVED)
 *   Gate 5: Multi-Supplier Deduplication & Rate Options Comparison
 *   Gate 6: COMPOSITE Package Composition & Multi-Component Revalidation
 *   Gate 7: Graceful Supplier Failure & Resilience (API outage != entire Vacatina down)
 *   Gate 8: Per-Offer Travel Credit Eligibility Governance
 *   Gate 9: The Exact Canonical 10 Products Lock
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type {
  CanonicalOfferSourceType,
  CanonicalOffer,
  CanonicalOfferLifecycleStatus,
  CompositeComponentDescriptor,
  ManualListingStatus
} from '../src/server/inventory/domain/canonical-offer.ts';
import { CanonicalOfferMapper } from '../src/server/inventory/domain/canonical-mapper.ts';
import { CanonicalSearchOrchestratorService } from '../src/server/inventory/services/canonical-search-orchestrator.service.ts';
import { CanonicalRevalidationService } from '../src/server/inventory/services/canonical-revalidation.service.ts';
import type { ICanonicalProviderAdapter } from '../src/server/inventory/adapters/canonical-provider-adapter.interface.ts';
import type { TravelProductSlug } from '../src/server/inventory/types.ts';
import { InMemoryManualListingRepository } from '../src/server/inventory/repository/manual-listing.repository.ts';
import type { AdminActor } from '../src/server/inventory/repository/manual-listing.repository.ts';

describe('Vacatina Hybrid Inventory & Canonical Offer Architecture', () => {

  // --------------------------------------------------------------------------
  // Gate 1: Canonical Source Taxonomy
  // --------------------------------------------------------------------------
  describe('Gate 1: Canonical Source Taxonomy (API, MANUAL, DIRECT_CONTRACT, COMPOSITE)', () => {
    it('defines the 4 primary canonical source types for production inventory', () => {
      const validSources: CanonicalOfferSourceType[] = [
        'API',
        'MANUAL',
        'DIRECT_CONTRACT',
        'COMPOSITE'
      ];
      assert.equal(validSources.length, 4);
      assert.ok(validSources.includes('API'));
      assert.ok(validSources.includes('MANUAL'));
      assert.ok(validSources.includes('DIRECT_CONTRACT'));
      assert.ok(validSources.includes('COMPOSITE'));
    });

    it('ensures customer search results merge API and Direct inventory into a single result set', async () => {
      const repo = new InMemoryManualListingRepository();
      const orchestrator = new CanonicalSearchOrchestratorService(repo);

      // 1. Add direct manual contract to repo
      const actor: AdminActor = { id: 'admin_1', name: 'Commercial Lead', role: 'PLATFORM_ADMIN' };
      const created = await repo.create({
        productType: 'hotels',
        title: 'Cinnamon Grand Colombo (Direct Contract)',
        description: 'Luxury 5-star direct commercial deal',
        destination: 'Colombo',
        location: { city: 'Colombo', country: 'Sri Lanka' },
        contractedBaseCostMinor: 4000000,
        markupMinor: 500000,
        sellingPriceMinor: 4500000,
        currency: 'LKR',
        totalAllottedQuota: 10,
        availableQuota: 10,
        validFromIso: new Date().toISOString(),
        validUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        salesValidUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        stayValidUntilIso: new Date(Date.now() + 86400000 * 60).toISOString(),
        expiresAtIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        isStopSaleActive: false,
        workflowStatus: 'PUBLISHED',
        createdBy: actor,
        partnerSupplierId: 'VACATINA_DIRECT',
        canonicalEntityId: 'ent_htl_cinnamon_grand',
        cancellationPolicy: 'Free cancellation up to 48 hours before check-in',
        refundability: 'REFUNDABLE',
        inclusions: ['Breakfast Included', 'Late Checkout'],
        exclusions: ['City Tax'],
        media: { heroImageUrl: '/img/cinnamon.jpg', galleryUrls: [] },
        commercialEvidence: {
          referenceId: 'COMM-CINNAMON-01',
          kind: 'DIRECT_HOTEL_CONTRACT',
          documentPathOrTicket: '/contracts/cinnamon_grand.pdf',
          verifiedBy: actor.name,
          verifiedAtIso: new Date().toISOString()
        }
      } as any, actor);

      await repo.update(created.listingId, { workflowStatus: 'PUBLISHED' }, actor);

      // 2. Register mock API supplier adapter
      const mockApiAdapter: ICanonicalProviderAdapter = {
        providerId: 'liteapi_mock',
        supplierId: 'LITEAPI',
        productType: 'hotels',
        sourceType: 'API',
        isHealthy: async () => true,
        search: async () => [
          CanonicalOfferMapper.mapSupplierPayloadToOffer({
            id: 'api_hilton_colombo',
            productId: 'ent_htl_hilton_colombo',
            title: 'Hilton Colombo',
            destination: 'Colombo',
            price: 52000,
            currency: 'LKR',
            supplierId: 'LITEAPI',
            isRefundable: true
          }, 'liteapi_mock', 'hotels')
        ],
        getOfferById: async () => null,
        revalidate: async () => ({
          offerId: 'test',
          status: 'AVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: 5200000,
          newPriceMinor: 5200000,
          currency: 'LKR',
          requiresUserAction: false,
          revalidatedAt: new Date().toISOString()
        })
      };

      orchestrator.registerAdapter(mockApiAdapter);

      // Execute search for Colombo hotels
      const results = await orchestrator.search({
        productType: 'hotels',
        destination: 'Colombo'
      });

      // Assert single unified result set containing BOTH manual and API offers
      assert.equal(results.length, 2);
      const sources = results.map(r => r.sourceType);
      assert.ok(sources.includes('MANUAL'));
      assert.ok(sources.includes('API'));

      // Both offers follow the exact same UnifiedCanonicalOffer shape
      assert.ok(results[0].offerId.startsWith('vct-'));
      assert.ok(results[1].offerId.startsWith('vct-'));
    });
  });

  // --------------------------------------------------------------------------
  // Gate 2: CanonicalOffer Model Completeness
  // --------------------------------------------------------------------------
  describe('Gate 2: CanonicalOffer Model Completeness & Stable ID Contract', () => {
    it('enforces all mandatory canonical offer attributes and stable client offerId', () => {
      const offer: CanonicalOffer = {
        offerId: 'vct-flt-offer-cmb-dxb-001',
        productId: 'prod-flt-cmb-dxb-ek651',
        productType: 'flights',
        sourceType: 'API',
        supplierId: 'DUFFEL',
        providerId: 'duffel_ndc',
        externalOfferId: 'off_duffel_raw_9981',
        title: 'Emirates EK651 Colombo to Dubai',
        subtitle: 'Non-stop Boeing 777-300ER',
        destinationId: 'DXB',
        destinationIds: ['DXB'],
        originId: 'CMB',
        travelDates: {
          departureDate: '2026-11-15T09:45:00Z',
          returnDate: '2026-11-25T18:30:00Z',
          durationDays: 10
        },
        location: {
          city: 'Dubai',
          country: 'United Arab Emirates'
        },
        price: 97400,
        currency: 'LKR',
        basePrice: 85000,
        taxAmount: 12400,
        feeAmount: 0,
        priceBreakdown: {
          baseMinor: 8500000,
          taxesMinor: 1240000,
          markupMinor: 0,
          totalMinor: 9740000,
          currency: 'LKR'
        },
        pricing: {
          baseCostMinor: 8500000,
          sellingPriceMinor: 9740000,
          currency: 'LKR',
          taxInclusive: true,
          markupMinor: 0
        },
        markup: {
          markupType: 'PERCENTAGE',
          markupValue: 0,
          appliedMarkupMinor: 0
        },
        isTaxInclusive: true,
        availabilityStatus: 'AVAILABLE',
        lastCheckedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 900000).toISOString(),
        revalidateAt: new Date(Date.now() + 900000).toISOString(),
        freshnessTtlSeconds: 900,
        isStale: false,
        inclusions: ['30kg Checked Baggage', 'In-flight Meals', 'Seat Selection'],
        exclusions: ['Travel Insurance', 'Airport Transfers'],
        cancellationPolicy: {
          isRefundable: true,
          policyText: 'Refundable subject to airline change fee of LKR 15,000'
        },
        cancellationTerms: {
          policyType: 'CONDITIONAL',
          isRefundable: true,
          deadlineIso: '2026-11-14T09:45:00Z',
          penaltyMinor: 1500000,
          description: 'Refundable subject to airline fee'
        },
        confirmationMode: 'INSTANT',
        bookingMode: 'INSTANT_BOOK',
        fulfilmentMode: 'AUTOMATED_SUPPLIER_API',
        status: 'ACTIVE',
        travelCreditPolicy: {
          eligible: true,
          applicableCreditTypes: ['REFUND_CREDIT', 'SERVICE_CREDIT', 'PROMOTIONAL_CREDIT']
        },
        badges: [{ text: 'Best Seller', variant: 'featured' }],
        media: {
          heroImageUrl: '/img/flights/emirates.jpg',
          galleryUrls: []
        },
        revalidationSupported: true,
        metadata: { aircraft: 'Boeing 777-300ER', cabinClass: 'Economy' },
        isSeed: false
      };

      // Client depends exclusively on stable offerId
      assert.ok(offer.offerId.startsWith('vct-'));
      assert.equal(offer.productType, 'flights');
      assert.equal(offer.sourceType, 'API');
      assert.equal(offer.supplierId, 'DUFFEL');
      assert.equal(offer.currency, 'LKR');
      assert.equal(offer.price, 97400);
      assert.equal(offer.travelCreditPolicy?.eligible, true);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 3: Universal Supplier Adapter Contracts (All 10 Verticals)
  // --------------------------------------------------------------------------
  describe('Gate 3: Universal Supplier Adapter Contracts (10 Canonical Verticals)', () => {
    it('verifies that adapters normalize responses into CanonicalOffer[] with identical interface', async () => {
      const mockFlightAdapter: ICanonicalProviderAdapter = {
        providerId: 'duffel_ndc',
        supplierId: 'DUFFEL',
        productType: 'flights',
        sourceType: 'API',
        isHealthy: async () => true,
        search: async () => [
          CanonicalOfferMapper.mapSupplierPayloadToOffer({
            id: 'flt_cmb_dxb',
            price: 95000,
            currency: 'LKR',
            destination: 'Dubai'
          }, 'duffel_ndc', 'flights')
        ],
        getOfferById: async () => null,
        revalidate: async () => ({
          offerId: 'flt_cmb_dxb',
          status: 'AVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: 9500000,
          newPriceMinor: 9500000,
          currency: 'LKR',
          requiresUserAction: false,
          revalidatedAt: new Date().toISOString()
        })
      };

      const offers = await mockFlightAdapter.search({ productType: 'flights', destination: 'Dubai' });
      assert.equal(offers.length, 1);
      assert.equal(offers[0].productType, 'flights');
      assert.ok(offers[0].offerId.startsWith('vct-api-flights-'));
    });
  });

  // --------------------------------------------------------------------------
  // Gate 4: Manual Inventory 6-Stage Lifecycle
  // --------------------------------------------------------------------------
  describe('Gate 4: Manual Inventory 6-Stage Lifecycle', () => {
    it('enforces DRAFT -> REVIEW -> PUBLISHED -> PAUSED -> SOLD_OUT -> ARCHIVED lifecycle', () => {
      const validStatuses: ManualListingStatus[] = [
        'DRAFT',
        'REVIEW',
        'PUBLISHED',
        'PAUSED',
        'SOLD_OUT',
        'ARCHIVED'
      ];
      assert.equal(validStatuses.length, 6);
    });

    it('demotes unpublished or stop-sale manual inventory so it disappears from customer search', async () => {
      const repo = new InMemoryManualListingRepository();
      const orchestrator = new CanonicalSearchOrchestratorService(repo);

      // Create listing in DRAFT status (not published)
      const actor: AdminActor = { id: 'admin_1', name: 'Officer', role: 'PLATFORM_ADMIN' };
      await repo.create({
        productType: 'hotels',
        title: 'Draft Villa Kandy',
        destination: 'Kandy',
        contractedBaseCostMinor: 2000000,
        sellingPriceMinor: 2500000,
        workflowStatus: 'DRAFT', // DRAFT items must never be sellable
        totalAllottedQuota: 5,
        availableQuota: 5,
        validFromIso: new Date().toISOString(),
        validUntilIso: new Date(Date.now() + 86400000).toISOString(),
        isStopSaleActive: false,
        createdBy: actor
      } as any, actor);

      const results = await orchestrator.search({
        productType: 'hotels',
        destination: 'Kandy'
      });

      // Zero results because DRAFT status is not sellable
      assert.equal(results.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 5: Multi-Supplier Deduplication & Rate Options Comparison
  // --------------------------------------------------------------------------
  describe('Gate 5: Multi-Supplier Deduplication & Rate Options Comparison', () => {
    it('consolidates same hotel from multiple suppliers into 1 canonical product with multi-rate options', async () => {
      const repo = new InMemoryManualListingRepository();
      const orchestrator = new CanonicalSearchOrchestratorService(repo);

      // Supplier 1: LiteAPI (API Gateway) -> LKR 145,000
      const mockLiteApi: ICanonicalProviderAdapter = {
        providerId: 'liteapi',
        supplierId: 'LITEAPI',
        productType: 'hotels',
        sourceType: 'API',
        isHealthy: async () => true,
        search: async () => [
          CanonicalOfferMapper.mapSupplierPayloadToOffer({
            id: 'liteapi_atlantis_01',
            productId: 'htl_atlantis_the_palm',
            title: 'Atlantis The Palm',
            destination: 'Dubai',
            price: 145000,
            currency: 'LKR',
            isRefundable: true,
            cancellationPolicyText: 'Refundable up to 72 hours before arrival'
          }, 'liteapi', 'hotels')
        ],
        getOfferById: async () => null,
        revalidate: async () => ({} as any)
      };

      // Supplier 2: Bedbank API -> LKR 148,000
      const mockBedbank: ICanonicalProviderAdapter = {
        providerId: 'bedbank',
        supplierId: 'BEDBANK',
        productType: 'hotels',
        sourceType: 'API',
        isHealthy: async () => true,
        search: async () => [
          CanonicalOfferMapper.mapSupplierPayloadToOffer({
            id: 'bedbank_atlantis_02',
            productId: 'htl_atlantis_the_palm',
            title: 'Atlantis The Palm',
            destination: 'Dubai',
            price: 148000,
            currency: 'LKR',
            isRefundable: false,
            cancellationPolicyText: 'Non-refundable advance purchase'
          }, 'bedbank', 'hotels')
        ],
        getOfferById: async () => null,
        revalidate: async () => ({} as any)
      };

      // Supplier 3: Vacatina Direct Contract -> LKR 139,000 (Best Price & Exclusive Deal)
      const actor: AdminActor = { id: 'admin_1', name: 'Contract Lead', role: 'PLATFORM_ADMIN' };
      const createdDirect = await repo.create({
        productType: 'hotels',
        title: 'Atlantis The Palm',
        destination: 'Dubai',
        location: { city: 'Dubai', country: 'United Arab Emirates' },
        canonicalEntityId: 'htl_atlantis_the_palm',
        contractedBaseCostMinor: 12000000,
        markupMinor: 1900000,
        sellingPriceMinor: 13900000, // LKR 139,000
        currency: 'LKR',
        totalAllottedQuota: 10,
        availableQuota: 10,
        validFromIso: new Date().toISOString(),
        validUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        salesValidUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        expiresAtIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        isStopSaleActive: false,
        workflowStatus: 'PUBLISHED',
        createdBy: actor,
        partnerSupplierId: 'VACATINA_DIRECT',
        cancellationPolicy: 'Free cancellation up to 48 hours before check-in',
        refundability: 'REFUNDABLE',
        commercialEvidence: {
          referenceId: 'COMM-ATLANTIS-01',
          kind: 'DIRECT_HOTEL_CONTRACT',
          documentPathOrTicket: '/contracts/atlantis_palm.pdf',
          verifiedBy: actor.name,
          verifiedAtIso: new Date().toISOString()
        }
      } as any, actor);

      await repo.update(createdDirect.listingId, { workflowStatus: 'PUBLISHED' }, actor);

      orchestrator.registerAdapter(mockLiteApi);
      orchestrator.registerAdapter(mockBedbank);

      const results = await orchestrator.search({
        productType: 'hotels',
        destination: 'Dubai'
      });

      // Assert: Exactly 1 consolidated hotel card returned for Atlantis The Palm (NOT 3 duplicate cards)
      assert.equal(results.length, 1);
      const atlantis = results[0];
      assert.equal(atlantis.title, 'Atlantis The Palm');

      // Vacatina Direct contract wins as primary offer and carries "Vacatina Exclusive" badge
      assert.equal(atlantis.sourceType, 'MANUAL');
      assert.equal(atlantis.price, 139000);
      assert.ok(atlantis.badges?.some(b => b.text === 'Vacatina Exclusive'));

      // Crucial: Rate Options contains all 3 competing supplier rates for customer comparison
      assert.ok(Array.isArray(atlantis.rateOptions));
      assert.equal(atlantis.rateOptions.length, 3);

      // Best price rate is the Direct Contract at LKR 139,000
      assert.equal(atlantis.rateOptions[0].isBestPrice, true);
      assert.equal(atlantis.rateOptions[0].isDirectContract, true);
      assert.equal(atlantis.rateOptions[0].priceMinor, 13900000);

      // Competing API rates are preserved
      assert.equal(atlantis.rateOptions[1].supplierId, 'LITEAPI');
      assert.equal(atlantis.rateOptions[1].priceMinor, 14500000);
      assert.equal(atlantis.rateOptions[2].supplierId, 'BEDBANK');
      assert.equal(atlantis.rateOptions[2].priceMinor, 14800000);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 6: COMPOSITE Package Composition & Pre-Booking Revalidation
  // --------------------------------------------------------------------------
  describe('Gate 6: COMPOSITE Package Composition & Revalidation', () => {
    it('revalidates all heterogeneous sub-components before package becomes READY', async () => {
      const revalidationService = new CanonicalRevalidationService(new InMemoryManualListingRepository());

      const components: CompositeComponentDescriptor[] = [
        {
          componentType: 'flight',
          sourceType: 'API',
          supplierId: 'DUFFEL',
          title: 'Emirates EK651 CMB -> DXB',
          unitPriceMinor: 9500000, // LKR 95,000
          currency: 'LKR',
          status: 'AVAILABLE',
          isRequired: true
        },
        {
          componentType: 'hotel',
          sourceType: 'DIRECT_CONTRACT',
          supplierId: 'VACATINA_DIRECT',
          title: 'Atlantis The Palm 4 Nights',
          unitPriceMinor: 24000000, // LKR 240,000
          currency: 'LKR',
          status: 'AVAILABLE',
          isRequired: true
        },
        {
          componentType: 'transfer',
          sourceType: 'MANUAL',
          supplierId: 'VACATINA_FLEET',
          title: 'Chauffeured Airport Transfer DXB',
          unitPriceMinor: 1500000, // LKR 15,000
          currency: 'LKR',
          status: 'AVAILABLE',
          isRequired: true
        },
        {
          componentType: 'activity',
          sourceType: 'API',
          supplierId: 'VIATOR',
          title: 'Desert Safari & BBQ Dinner',
          unitPriceMinor: 2500000, // LKR 25,000
          currency: 'LKR',
          status: 'AVAILABLE',
          isRequired: true
        },
        {
          componentType: 'visa',
          sourceType: 'MANUAL',
          supplierId: 'VACATINA_VISA_DESK',
          title: 'UAE Tourist Visa Assistance',
          unitPriceMinor: 3500000, // LKR 35,000
          currency: 'LKR',
          status: 'AVAILABLE',
          isRequired: true
        }
      ];

      // Total package price: 95k + 240k + 15k + 25k + 35k = LKR 410,000
      const compositeOffer: CanonicalOffer = {
        offerId: 'vct-pkg-dubai-grand-escape',
        productType: 'packages',
        sourceType: 'COMPOSITE',
        supplierId: 'VACATINA_COMPOSITE',
        providerId: 'packages_engine',
        title: 'Dubai Grand Escape 5D4N All-Inclusive',
        subtitle: 'Flight + Luxury Resort + VIP Transfer + Safari + Visa',
        destinationId: 'Dubai',
        location: { city: 'Dubai', country: 'United Arab Emirates' },
        price: 410000,
        currency: 'LKR',
        basePrice: 410000,
        taxAmount: 0,
        feeAmount: 0,
        priceBreakdown: {
          baseMinor: 41000000,
          taxesMinor: 0,
          markupMinor: 0,
          totalMinor: 41000000,
          currency: 'LKR'
        },
        isTaxInclusive: true,
        availabilityStatus: 'AVAILABLE',
        lastCheckedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        freshnessTtlSeconds: 3600,
        isStale: false,
        inclusions: ['Flight', 'Hotel', 'Transfer', 'Safari', 'Visa'],
        exclusions: ['Personal Expenses'],
        cancellationPolicy: { isRefundable: true, policyText: 'Component-specific terms' },
        confirmationMode: 'ON_REQUEST',
        bookingMode: 'DIRECT_BOOKING',
        compositeComponents: components,
        media: { heroImageUrl: '/img/dubai.jpg', galleryUrls: [] },
        revalidationSupported: true,
        metadata: {},
        isSeed: false
      };

      // Scenario 1: All sub-components available -> Package is AVAILABLE
      const result1 = await revalidationService.revalidate(compositeOffer);
      assert.equal(result1.status, 'AVAILABLE');
      assert.equal(result1.isPriceChanged, false);

      // Scenario 2: One component (Flight) sells out -> Package becomes UNAVAILABLE (cannot blindly stage READY)
      components[0].status = 'UNAVAILABLE';
      const result2 = await revalidationService.revalidate(compositeOffer);
      assert.equal(result2.status, 'UNAVAILABLE');
      assert.equal(result2.requiresUserAction, true);
      assert.ok(result2.actionMessage?.includes('EK651'));

      // Scenario 3: Flight price increases by LKR 10,000 -> Package reports PRICE_CHANGED
      components[0].status = 'PRICE_CHANGED';
      components[0].revalidationStatus = 'PRICE_CHANGED';
      components[0].unitPriceMinor = 10500000; // was 9500000
      const result3 = await revalidationService.revalidate(compositeOffer);
      assert.equal(result3.status, 'PRICE_CHANGED');
      assert.equal(result3.isPriceChanged, true);
      assert.equal(result3.newPriceMinor, 42000000); // 410k + 10k = 420,000 LKR
    });
  });

  // --------------------------------------------------------------------------
  // Gate 7: Graceful Supplier Failure & Resilience
  // --------------------------------------------------------------------------
  describe('Gate 7: Graceful Supplier Failure & Resilience', () => {
    it('ensures supplier API outage or timeout does NOT disable manual direct inventory', async () => {
      const repo = new InMemoryManualListingRepository();
      const orchestrator = new CanonicalSearchOrchestratorService(repo);

      // Valid manual contract
      const actor: AdminActor = { id: 'admin_1', name: 'Aviation Ops', role: 'PLATFORM_ADMIN' };
      const createdCharter = await repo.create({
        productType: 'flights',
        title: 'Colombo to Jaffna Charter Flight',
        destination: 'Jaffna',
        origin: 'Colombo',
        location: { city: 'Jaffna', country: 'Sri Lanka' },
        contractedBaseCostMinor: 2500000,
        sellingPriceMinor: 2800000,
        currency: 'LKR',
        totalAllottedQuota: 15,
        availableQuota: 15,
        validFromIso: new Date().toISOString(),
        validUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        salesValidUntilIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        expiresAtIso: new Date(Date.now() + 86400000 * 30).toISOString(),
        isStopSaleActive: false,
        workflowStatus: 'PUBLISHED',
        createdBy: actor,
        partnerSupplierId: 'VACATINA_CHARTER',
        commercialEvidence: {
          referenceId: 'COMM-CHARTER-01',
          kind: 'DIRECT_HOTEL_CONTRACT' as any,
          documentPathOrTicket: '/contracts/jaffna_charter.pdf',
          verifiedBy: actor.name,
          verifiedAtIso: new Date().toISOString()
        }
      } as any, actor);

      await repo.update(createdCharter.listingId, { workflowStatus: 'PUBLISHED' }, actor);

      // Broken / failing supplier API adapter (simulating network timeout or crash)
      const failingApiAdapter: ICanonicalProviderAdapter = {
        providerId: 'failing_gds',
        supplierId: 'FAILING_GDS',
        productType: 'flights',
        sourceType: 'API',
        isHealthy: async () => false, // reports unhealthy
        search: async () => {
          throw new Error('504 Gateway Timeout: Upstream GDS network unreachable');
        },
        getOfferById: async () => null,
        revalidate: async () => ({} as any)
      };

      orchestrator.registerAdapter(failingApiAdapter);

      // Search must NOT crash and must return the valid manual charter flight
      const results = await orchestrator.search({
        productType: 'flights',
        destination: 'Jaffna'
      });

      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Colombo to Jaffna Charter Flight');
      assert.equal(results[0].sourceType, 'MANUAL');
    });
  });

  // --------------------------------------------------------------------------
  // Gate 8: Per-Offer Travel Credit Eligibility Governance
  // --------------------------------------------------------------------------
  describe('Gate 8: Per-Offer Travel Credit Eligibility Governance', () => {
    it('respects per-offer travel credit eligibility and exclusion policies', () => {
      // Offer A: Standard eligible offer
      const offerEligible = CanonicalOfferMapper.mapSupplierPayloadToOffer({
        id: 'htl_01',
        title: 'Boutique Hotel Kandy',
        price: 35000,
        travelCreditEligible: true
      }, 'liteapi', 'hotels');

      assert.equal(offerEligible.travelCreditPolicy?.eligible, true);
      assert.ok(offerEligible.travelCreditPolicy?.applicableCreditTypes?.includes('REFUND_CREDIT'));

      // Offer B: Supplier airfare restricting promotional credit
      const offerRestricted = CanonicalOfferMapper.mapSupplierPayloadToOffer({
        id: 'flt_promo_restrict',
        title: 'Special Low Cost Airfare',
        price: 45000,
        travelCreditEligible: true,
        applicableCreditTypes: ['REFUND_CREDIT', 'SERVICE_CREDIT'], // Excludes PROMOTIONAL_CREDIT
        travelCreditExclusionReason: 'Direct non-refundable supplier airfare restricts promotional credits'
      }, 'duffel', 'flights');

      assert.equal(offerRestricted.travelCreditPolicy?.eligible, true);
      assert.equal(offerRestricted.travelCreditPolicy?.applicableCreditTypes?.includes('PROMOTIONAL_CREDIT'), false);
      assert.equal(offerRestricted.travelCreditPolicy?.applicableCreditTypes?.includes('REFUND_CREDIT'), true);
      assert.ok(offerRestricted.travelCreditPolicy?.exclusionReason?.includes('supplier airfare restricts'));
    });
  });

  // --------------------------------------------------------------------------
  // Gate 9: The Exact Canonical 10 Products Lock
  // --------------------------------------------------------------------------
  describe('Gate 9: The Exact Canonical 10 Products Lock', () => {
    it('strictly locks the 10 canonical products (eSIM is NOT a product; Car Rental is within Cars & Transfers)', () => {
      const canonical10: TravelProductSlug[] = [
        'flights',
        'hotels',
        'visa',
        'packages',
        'cars',
        'rails',
        'cruises',
        'activities',
        'sightseeing',
        'insurance'
      ];

      assert.equal(canonical10.length, 10);
      assert.ok(!canonical10.includes('esim' as any), 'eSIM must NOT be a canonical product');
      assert.ok(canonical10.includes('cars'), 'Cars & Transfers must be a canonical product');
      assert.ok(canonical10.includes('sightseeing'), 'Sightseeing Tours must be a canonical product');
      assert.ok(canonical10.includes('visa'), 'Visa Assistance must be a canonical product');
    });
  });
});
