/* ============================================================================
 * Vacatina Unified Inventory Source & Admin Contract Automated Test Suite (v1.0)
 * Authority: User Architectural Directive & ADR-006 through ADR-009
 *
 * Requirements:
 * 1. Pillar 1: Manual inventory database migration & CMS repository dynamic query.
 * 2. Pillar 2: Supplier API adapter contract (provider-neutral normalization & circuit breaking).
 * 3. Pillar 3: HYBRID field authority matrix & tamper prevention.
 * 4. Pillar 4: Strict SEED quarantine (zero prototype cards in search or checkout).
 * 5. Correction 1: Relevance-guarded Pin-Above-API ranking (no blind manual pinning).
 * 6. Correction 2: Operational truth & commercial evidence verification guard.
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CanonicalSearchOrchestratorService
} from '../src/server/inventory/services/canonical-search-orchestrator.service.ts';

import {
  InMemoryManualListingRepository
} from '../src/server/inventory/repository/manual-listing.repository.ts';

import type {
  AdminActor,
  ProductionManualListingEntity
} from '../src/server/inventory/repository/manual-listing.repository.ts';

import {
  composeHybridOffer,
  HYBRID_FIELD_AUTHORITY_RULES
} from '../src/server/inventory/hybrid-authority.ts';

import {
  UnifiedInventoryService
} from '../src/server/inventory/unified-inventory.service.ts';

import type {
  CanonicalOfferEntity,
  TravelProductSlug
} from '../src/server/inventory/types.ts';

import type {
  UnifiedCanonicalOffer,
  CanonicalSearchCriteria
} from '../src/server/inventory/domain/canonical-offer.ts';

import type { ICanonicalProviderAdapter } from '../src/server/inventory/adapters/canonical-provider-adapter.interface.ts';
import { ManualHotelAdapter } from '../src/features/hotels/adapters/manual-hotel.adapter.ts';
import { ManualFlightAdapter } from '../src/features/flights/adapters/manual-flight.adapter.ts';
import { ManualVisaAdapter } from '../src/features/visa/adapters/manual-visa.adapter.ts';

test('Unified Inventory Source & Admin Contract Suite (v1.0 LOCKED)', async (t) => {
  // Setup isolated in-memory repository and orchestrator
  const repo = new InMemoryManualListingRepository();
  const orchestrator = new CanonicalSearchOrchestratorService(repo);

  // --------------------------------------------------------------------------
  // Pillar 1: Manual Inventory Database Migration & CMS Repository Query
  // --------------------------------------------------------------------------
  await t.test('Pillar 1: Manual Inventory Dynamic CMS & Database Repository Precedence', async () => {
    // 1. Create a dynamic manual listing via Admin CMS
    const adminActor: AdminActor = { id: 'admin_1', name: 'Operations Staff', role: 'PLATFORM_ADMIN' };
    const listingPayload: Partial<ProductionManualListingEntity> = {
      productType: 'hotels',
      partnerSupplierId: 'SUP_DIR_001',
      operatorName: 'Ceylon Heritage Luxury Group',
      partnerName: 'Bentota Ocean Villa Direct',
      title: 'Bentota Beachfront Pavilion Villa',
      description: 'Direct contracted luxury beach pavilion with private plunge pool.',
      destination: 'Bentota',
      location: { city: 'Bentota', country: 'Sri Lanka' },
      contractedBaseCostMinor: 25000000, // 250,000 LKR
      markupMinor: 3000000,             // 30,000 LKR
      sellingPriceMinor: 28000000,      // 280,000 LKR
      currency: 'LKR',
      totalAllottedQuota: 5,
      availableQuota: 5,
      isStopSaleActive: false,
      cancellationPolicy: 'Free cancellation up to 48h before check-in',
      refundability: 'REFUNDABLE',
      inclusions: ['Breakfast Buffet', 'Airport Transfer'],
      exclusions: ['Minibar alcoholic drinks'],
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      taxesAndFees: { isTaxInclusive: true },
      constraints: { maxOccupancy: 3 },
      media: {
        heroImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef',
        galleryUrls: []
      },
      terms: { voucherRedemptionInstructions: 'Present confirmation email at front desk.' },
      commercialEvidence: {
        referenceId: 'CONTRACT_DOC_2026_BENTOTA_01',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/legal/contracts/bentota_ocean_2026.pdf',
        verifiedBy: 'Legal Officer Perera',
        verifiedAtIso: '2026-10-20T10:00:00Z'
      }
    };

    const created = await repo.create(listingPayload as any, adminActor);
    assert.equal(created.workflowStatus, 'DRAFT');

    // Approve & Publish via 4-Eyes
    const approver: AdminActor = { id: 'admin_2', name: 'Finance Controller Silva', role: 'FINANCE_OPS' };
    await repo.transitionLifecycle(created.listingId, 'FINANCE_APPROVED', approver);
    const published = await repo.transitionLifecycle(created.listingId, 'PUBLISHED', approver);
    assert.equal(published.workflowStatus, 'PUBLISHED');

    // 2. Query search orchestrator for Bentota
    const searchResults = await orchestrator.search({
      productType: 'hotels',
      destination: 'Bentota'
    });

    assert.ok(searchResults.length >= 1, 'Search must dynamically retrieve published database listing');
    const found = searchResults.find(o => o.sourceListingId === created.listingId || o.title.includes('Bentota Beachfront'));
    assert.ok(found, 'Listing must be present in search results');
    assert.equal(found!.sourceType, 'MANUAL');
    assert.equal(found!.price, 280000); // sellingPrice in standard units

    // 3. Operational Stop-Sale Test: toggle stop-sale in database and verify dynamic disappearance
    await repo.toggleStopSale(created.listingId, true, adminActor, 'Property renovation emergency');
    const stoppedResults = await orchestrator.search({
      productType: 'hotels',
      destination: 'Bentota'
    });
    const stoppedFound = stoppedResults.find(o => o.sourceListingId === created.listingId);
    assert.equal(stoppedFound, undefined, 'Stopped manual listing must disappear dynamically from search');

    // Re-enable for subsequent tests
    await repo.toggleStopSale(created.listingId, false, adminActor, 'Renovation complete');
  });

  // --------------------------------------------------------------------------
  // Pillar 2: Supplier API Adapter Contract
  // --------------------------------------------------------------------------
  await t.test('Pillar 2: Supplier API Adapter Normalization & Stable ID Invariant', async () => {
    // Create a mock LiteAPI bedbank adapter implementing ICanonicalProviderAdapter
    const mockBedbankAdapter: ICanonicalProviderAdapter = {
      productType: 'hotels',
      providerId: 'liteapi_bedbank',
      supplierId: 'LITEAPI',
      sourceType: 'API',
      isHealthy: async () => true,
      search: async (criteria: CanonicalSearchCriteria): Promise<UnifiedCanonicalOffer[]> => {
        if (criteria.destination.toLowerCase() !== 'dubai') return [];
        return [
          {
            offerId: 'vct-api-hotels-liteapi-dubai-marina-01',
            productType: 'hotels',
            sourceType: 'API',
            supplierId: 'LITEAPI',
            providerId: 'liteapi_bedbank',
            title: 'Dubai Marina Luxury Tower & Suites',
            subtitle: 'City View Deluxe Suite (Breakfast Included)',
            destinationId: 'dubai',
            location: { city: 'Dubai', country: 'United Arab Emirates' },
            price: 185000,
            currency: 'LKR',
            basePrice: 160000,
            taxAmount: 25000,
            feeAmount: 0,
            priceBreakdown: {
              baseMinor: 16000000,
              taxesMinor: 2500000,
              markupMinor: 0,
              totalMinor: 18500000,
              currency: 'LKR'
            },
            isTaxInclusive: true,
            availabilityStatus: 'AVAILABLE',
            lastCheckedAt: new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
            validUntil: new Date(Date.now() + 3600000).toISOString(),
            freshnessTtlSeconds: 3600,
            isStale: false,
            inclusions: ['Free Wi-Fi', 'Breakfast'],
            exclusions: ['Tourism Dirham Fee'],
            cancellationPolicy: { isRefundable: true, policyText: 'Free cancellation up to 72h' },
            confirmationMode: 'INSTANT',
            bookingMode: 'DIRECT_BOOKING',
            media: { heroImageUrl: 'https://example.com/dubai.jpg', galleryUrls: [] },
            revalidationSupported: true,
            metadata: { isPinnedAboveApi: false },
            isSeed: false
          }
        ];
      },
      getOfferById: async (offerId: string) => null,
      revalidate: async (offerId: string) => ({
        offerId,
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: 18500000,
        newPriceMinor: 18500000,
        currency: 'LKR',
        requiresUserAction: false,
        revalidatedAt: new Date().toISOString()
      })
    };

    orchestrator.registerAdapter(mockBedbankAdapter);

    const dubaiResults = await orchestrator.search({
      productType: 'hotels',
      destination: 'Dubai'
    });

    assert.ok(dubaiResults.length >= 1);
    const dubaiHotel = dubaiResults[0];
    assert.equal(dubaiHotel.sourceType, 'API');
    assert.equal(dubaiHotel.providerId, 'liteapi_bedbank');
    assert.ok(dubaiHotel.offerId.startsWith('vct-api-hotels-'));
    assert.equal(dubaiHotel.isSeed, false);
  });

  // --------------------------------------------------------------------------
  // Pillar 3: HYBRID Precedence & Field Authority Rules
  // --------------------------------------------------------------------------
  await t.test('Pillar 3: HYBRID Field Authority & Tamper Prevention', () => {
    // Upstream Supplier Offer
    const rawSupplierOffer: CanonicalOfferEntity = {
      offerId: 'off_duffel_cmb_dxb_001',
      canonicalOfferId: 'vct-fl-api-duffel-cmb-dxb',
      productType: 'flights',
      inventorySource: 'API',
      sourceType: 'API',
      listingKind: 'SELLABLE_INVENTORY',
      compositionType: 'SINGLE',
      fulfillmentMode: 'INSTANT',
      environmentClass: 'PRODUCTION',
      sellability: 'BOOKABLE',
      providerLifecycle: 'PRODUCTION_LIVE',
      supplierId: 'DUFFEL_NDC',
      supplierName: 'Duffel NDC Global',
      title: 'Emirates CMB -> DXB Economy Standard',
      subtitle: 'Round-trip economy fare',
      availabilityStatus: 'LIVE',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      location: { city: 'Dubai', country: 'United Arab Emirates' },
      pricing: {
        rawSupplierCostMinor: 9000000, // 90,000 LKR
        rawCurrency: 'LKR',
        platformMarkupMinor: 0,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 9000000,
        currency: 'LKR'
      },
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 900,
        expiresAtIso: new Date(Date.now() + 900000).toISOString(),
        isStale: false,
        revalidationEndpoint: '/api/v1/inventory/flights/revalidate'
      },
      inclusions: ['23kg Checked Baggage', 'In-flight Meal'],
      exclusions: ['Seat Selection'],
      cancellationPolicy: 'Non-refundable fare class.',
      pinAboveApi: false,
      deduplicationKey: 'flights:cmb:dxb:ek651',
      isSandboxSimulated: false,
      integrationLifecycle: 'PRODUCTION_LIVE'
    };

    // Vacatina Commercial Desk applies overlay: 10,000 LKR markup + Fast-track VIP lounge
    const overlay = {
      markupMinor: 1000000, // 10,000 LKR
      inclusions: ['Fast-Track Changi/Dubai Lounge Access', 'Vacatina 24/7 Flight Monitoring'],
      exclusiveBadges: ['Vacatina Curated Package'],
      conciergeNotes: 'Dedicated WhatsApp flight agent assigned.',
      commercialEvidenceReference: 'CORP_EMIRATES_AGENT_AGREEMENT_2026'
    };

    const hybrid = composeHybridOffer(rawSupplierOffer, overlay);
    assert.equal(hybrid.inventorySource, 'COMPOSITE');
    assert.ok(hybrid.canonicalOfferId.startsWith('vct-pkg-hyb-'));
    assert.equal(hybrid.pricing.finalSellingPriceMinor, 10000000); // 90k + 10k = 100k
    assert.ok(hybrid.inclusions.includes('Fast-Track Changi/Dubai Lounge Access'));

    // Field Authority Violation Check: Attempting to wrap prototype SEED data in HYBRID must throw
    const seedOffer: CanonicalOfferEntity = {
      ...rawSupplierOffer,
      environmentClass: 'SEED',
      sourceMetadata: { dataOrigin: 'SEED_FIXTURE' } as any
    };

    assert.throws(
      () => composeHybridOffer(seedOffer, overlay),
      /HYBRID_CANNOT_WRAP_SEED/,
      'Composing HYBRID offer over prototype SEED data must throw architectural error'
    );
  });

  // --------------------------------------------------------------------------
  // Pillar 4: Strict SEED Quarantine Enforcement
  // --------------------------------------------------------------------------
  await t.test('Pillar 4: Strict SEED Quarantine — Zero Prototype Cards Reach Search or Checkout', async () => {
    // Create an adapter that erroneously returns a SEED card
    const seedLeakingAdapter: ICanonicalProviderAdapter = {
      productType: 'cruises',
      providerId: 'demo_cruise_feed',
      supplierId: 'PROTOTYPE_DEMO',
      sourceType: 'API',
      isHealthy: async () => true,
      search: async () => [
        {
          offerId: 'vct-seed-cruise-demo-card-01',
          productType: 'cruises',
          sourceType: 'API',
          supplierId: 'PROTOTYPE_DEMO',
          providerId: 'demo_cruise_feed',
          title: 'Mediterranean Luxury 7-Night Cruise Example',
          subtitle: 'Demo inspiration card',
          destinationId: 'mediterranean',
          location: { city: 'Barcelona', country: 'Spain' },
          price: 450000,
          currency: 'LKR',
          basePrice: 450000,
          taxAmount: 0,
          feeAmount: 0,
          priceBreakdown: { baseMinor: 45000000, taxesMinor: 0, markupMinor: 0, totalMinor: 45000000, currency: 'LKR' },
          isTaxInclusive: true,
          availabilityStatus: 'AVAILABLE',
          lastCheckedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 3600000).toISOString(),
          freshnessTtlSeconds: 3600,
          isStale: false,
          inclusions: [],
          exclusions: [],
          cancellationPolicy: { isRefundable: false, policyText: 'Mock' },
          confirmationMode: 'INSTANT',
          bookingMode: 'DIRECT_BOOKING',
          media: { heroImageUrl: '', galleryUrls: [] },
          revalidationSupported: false,
          metadata: {},
          isSeed: true // Strictly SEED
        }
      ],
      getOfferById: async () => null,
      revalidate: async (id) => ({
        offerId: id,
        status: 'UNAVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: 0,
        newPriceMinor: 0,
        currency: 'LKR',
        requiresUserAction: true,
        revalidatedAt: new Date().toISOString()
      })
    };

    orchestrator.registerAdapter(seedLeakingAdapter);

    const results = await orchestrator.search({
      productType: 'cruises',
      destination: 'Barcelona'
    });

    // Invariant check: search orchestrator must quarantine and filter the SEED item
    assert.equal(results.length, 0, 'SEED item must be filtered out by canonical search orchestrator');
  });

  // --------------------------------------------------------------------------
  // Correction 1: Relevance-Guarded Pin-Above-API Ranking
  // --------------------------------------------------------------------------
  await t.test('Correction 1: Relevance-Guarded Pin-Above-API Ranking (No Blind Manual Pinning)', async () => {
    // Scenario:
    // Customer searches for "Dubai".
    // 1. Manual listing in Bentota, Sri Lanka has isPinnedAboveApi: true.
    // 2. API listing in Dubai has isPinnedAboveApi: false.
    // In the old broken model, the Bentota manual listing sat at #1 because it was MANUAL.
    // In our corrected model, Bentota receives 0 relevance for "Dubai", so it is deprioritized!
    
    // Register Dubai Manual Hotel with Pin-Above-API
    const adminActor: AdminActor = { id: 'admin_1', name: 'Ops Staff', role: 'PLATFORM_ADMIN' };
    const dubaiManualListing: Partial<ProductionManualListingEntity> = {
      productType: 'hotels',
      partnerSupplierId: 'SUP_DUBAI_DIR_01',
      operatorName: 'Dubai Palm Direct',
      partnerName: 'Palm Jumeirah Sky Villa',
      title: 'Palm Jumeirah Sky Penthouse',
      destination: 'Dubai',
      location: { city: 'Dubai', country: 'United Arab Emirates' },
      contractedBaseCostMinor: 40000000,
      markupMinor: 5000000,
      sellingPriceMinor: 45000000,
      currency: 'LKR',
      totalAllottedQuota: 2,
      availableQuota: 2,
      isStopSaleActive: false,
      cancellationPolicy: 'Strict',
      refundability: 'NON_REFUNDABLE',
      inclusions: ['Butler Service'],
      exclusions: [],
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      taxesAndFees: { isTaxInclusive: true },
      constraints: {},
      media: { heroImageUrl: '', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: '' },
      commercialEvidence: {
        referenceId: 'PALM_CONTRACT_2026',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/legal/contracts/palm.pdf',
        verifiedBy: 'Manager',
        verifiedAtIso: '2026-10-21T00:00:00Z'
      }
    };
    const createdDubai = await repo.create(dubaiManualListing as any, adminActor);
    const approverDubai: AdminActor = { id: 'admin_approver_dubai', name: 'Finance Ops', role: 'FINANCE_OPS' };
    await repo.transitionLifecycle(createdDubai.listingId, 'FINANCE_APPROVED', approverDubai);
    await repo.transitionLifecycle(createdDubai.listingId, 'PUBLISHED', approverDubai);

    // Search for Dubai
    const dubaiResults = await orchestrator.search({
      productType: 'hotels',
      destination: 'Dubai'
    });

    assert.ok(dubaiResults.length >= 1, 'Must find Dubai results');
    // All results must be relevant to Dubai
    for (const res of dubaiResults) {
      const matchCity = res.location.city.toLowerCase().includes('dubai');
      const matchDest = res.destinationId.toLowerCase().includes('dubai');
      assert.ok(matchCity || matchDest, `Result ${res.title} in ${res.location.city} must match destination Dubai`);
    }

    // Verify Bentota hotel does NOT sit at top of Dubai results
    const topResult = dubaiResults[0];
    assert.equal(topResult.location.city, 'Dubai');
    assert.notEqual(topResult.location.city, 'Bentota');
  });

  // --------------------------------------------------------------------------
  // Correction 2: Operational Truth & Evidence Verification
  // --------------------------------------------------------------------------
  await t.test('Correction 2: Operational Truth & Commercial Evidence Guard', async () => {
    const adminActor: AdminActor = { id: 'admin_1', name: 'Ops Staff', role: 'PLATFORM_ADMIN' };
    
    // Attempting to publish a manual listing WITHOUT commercial evidence must fail
    const unverifiedListing: Partial<ProductionManualListingEntity> = {
      productType: 'activities',
      partnerSupplierId: 'SUP_UNVERIFIED_01',
      operatorName: 'Unverified Operator',
      partnerName: 'Unverified Tour',
      title: 'Unverified Hot Air Balloon Safari',
      destination: 'Dambulla',
      location: { city: 'Dambulla', country: 'Sri Lanka' },
      contractedBaseCostMinor: 15000000,
      markupMinor: 2000000,
      sellingPriceMinor: 17000000,
      currency: 'LKR',
      totalAllottedQuota: 10,
      availableQuota: 10,
      isStopSaleActive: false,
      cancellationPolicy: 'Non-refundable',
      refundability: 'NON_REFUNDABLE',
      inclusions: [],
      exclusions: [],
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      taxesAndFees: { isTaxInclusive: true },
      constraints: {},
      media: { heroImageUrl: '', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: '' },
      commercialEvidence: {
        referenceId: '', // EMPTY evidence!
        kind: 'SOURCE_DOCUMENT',
        documentPathOrTicket: '',
        verifiedBy: '',
        verifiedAtIso: ''
      }
    };

    const created = await repo.create(unverifiedListing as any, adminActor);
    const approverActor: AdminActor = { id: 'admin_approver_unverified', name: 'Finance Controller', role: 'FINANCE_OPS' };

    // Publishing without valid commercial evidence must throw
    await assert.rejects(
      async () => {
        await repo.transitionLifecycle(created.listingId, 'PUBLISHED', approverActor);
      },
      /COMMERCIAL_EVIDENCE_REQUIRED_TO_PUBLISH|Cannot publish listing without documented commercial evidence/,
      'Publishing a manual listing without verified commercial evidence must be blocked'
    );
  });

  // --------------------------------------------------------------------------
  // Feature Adapters Dynamic Repository Query & Stop-Sale Reactivity
  // --------------------------------------------------------------------------
  await t.test('Feature Adapters (Hotels, Flights, Visa) Dynamic Repository Connectivity', async () => {
    const hotelAdapter = new ManualHotelAdapter(repo);
    const flightAdapter = new ManualFlightAdapter(repo);
    const visaAdapter = new ManualVisaAdapter(repo);

    // 1. Hotel Adapter dynamic search (finds the published Bentota hotel from Pillar 1)
    const hotelResults = await hotelAdapter.search({
      searchId: 'search-hotel-bentota',
      destination: 'Bentota',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-12',
      occupancy: { rooms: 1, adults: 2, children: 0 }
    });
    assert.ok(hotelResults.offers.length >= 1, 'Hotel adapter must retrieve published database hotel');
    const bentotaHotel = hotelResults.offers.find(h => h.name.includes('Bentota Beachfront'));
    assert.ok(bentotaHotel, 'Bentota hotel must be returned by HotelAdapter');
    assert.equal(bentotaHotel!.sourceType, 'MANUAL');
    assert.equal(bentotaHotel!.startingFromPriceMinor, 28000000);

    // 2. Flight Adapter dynamic search
    const flightAdmin: AdminActor = { id: 'flight_admin_01', name: 'Flight Desk', role: 'PLATFORM_ADMIN' };
    const flightApprover: AdminActor = { id: 'flight_finance_01', name: 'Flight Finance', role: 'FINANCE_OPS' };
    const dynamicFlight = await repo.create({
      productType: 'flights',
      partnerSupplierId: 'SUP_AIR_DIR_01',
      operatorName: 'Aero Lanka Charters',
      partnerName: 'Aero Lanka CMB-SIN',
      title: 'Colombo to Singapore Direct Charter',
      description: 'Exclusive direct charter flight with full luggage.',
      origin: 'CMB',
      destination: 'SIN',
      location: { city: 'Singapore', country: 'Singapore' },
      contractedBaseCostMinor: 11000000,
      markupMinor: 2000000,
      sellingPriceMinor: 13000000,
      currency: 'LKR',
      totalAllottedQuota: 10,
      availableQuota: 10,
      isStopSaleActive: false,
      cancellationPolicy: 'Refundable with fee',
      refundability: 'REFUNDABLE',
      inclusions: ['2x 23kg Baggage', 'Hot Meal'],
      exclusions: [],
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      taxesAndFees: { isTaxInclusive: true },
      constraints: {},
      media: { heroImageUrl: '', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: '' },
      commercialEvidence: {
        referenceId: 'CHARTER_AGREEMENT_2026_SIN',
        kind: 'SIGNED_CONTRACT',
        documentPathOrTicket: '/legal/contracts/sin_charter.pdf',
        verifiedBy: 'Legal Officer',
        verifiedAtIso: '2026-10-22T00:00:00Z'
      }
    } as any, flightAdmin);
    await repo.transitionLifecycle(dynamicFlight.listingId, 'FINANCE_APPROVED', flightApprover);
    await repo.transitionLifecycle(dynamicFlight.listingId, 'PUBLISHED', flightApprover);

    const flightResults = await flightAdapter.search({
      searchId: 'search-flight-cmb-sin',
      origin: { airportCode: 'CMB', cityCode: 'CMB', airportName: 'Bandaranaike', city: 'Colombo', country: 'Sri Lanka', countryCode: 'LK' },
      destination: { airportCode: 'SIN', cityCode: 'SIN', airportName: 'Changi', city: 'Singapore', country: 'Singapore', countryCode: 'SG' },
      departureDate: '2026-11-10',
      travellers: { adults: 1, children: 0, infants: 0 },
      cabinClass: 'economy',
      directFlightsOnly: false,
      nearbyAirports: false,
      displayCurrency: 'LKR',
      locale: 'en-LK',
      createdAt: new Date().toISOString(),
      tripType: 'one_way'
    });
    assert.equal(flightResults.status, 'ok');
    const foundFlight = flightResults.offers.find(f => f.offerId === dynamicFlight.canonicalEntityId || f.sourceOfferId === dynamicFlight.listingId);
    assert.ok(foundFlight, 'Flight adapter must retrieve published database charter flight');
    assert.equal(foundFlight!.price.totalMinor, 13000000);

    // 3. Visa Adapter dynamic search
    const visaAdmin: AdminActor = { id: 'visa_admin_01', name: 'Visa Desk', role: 'PLATFORM_ADMIN' };
    const visaApprover: AdminActor = { id: 'visa_finance_01', name: 'Visa Finance', role: 'FINANCE_OPS' };
    const dynamicVisa = await repo.create({
      productType: 'visa',
      partnerSupplierId: 'VACATINA_CONSULAR_DESK',
      operatorName: 'UK Consular Advisory Desk',
      partnerName: 'UK Standard Visitor Visa Assistance',
      title: 'United Kingdom Standard Visitor Visa Assistance',
      description: 'Document audit, biometrics guidance, and expedited submission support for UK travel.',
      destination: 'GB',
      location: { city: 'London', country: 'United Kingdom' },
      contractedBaseCostMinor: 4800000,
      markupMinor: 2200000,
      sellingPriceMinor: 7000000,
      currency: 'LKR',
      totalAllottedQuota: 50,
      availableQuota: 50,
      isStopSaleActive: false,
      cancellationPolicy: 'Advisory fee non-refundable once audit starts.',
      refundability: 'NON_REFUNDABLE',
      inclusions: ['Document Checklist Audit', 'VFS Appointment Support'],
      exclusions: [],
      validFromIso: '2026-11-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      taxesAndFees: { isTaxInclusive: true },
      constraints: {},
      media: { heroImageUrl: '', galleryUrls: [] },
      terms: { voucherRedemptionInstructions: '' },
      commercialEvidence: {
        referenceId: 'CONSULAR_VERIFIED_UK_2026',
        kind: 'LICENCE_OR_ACCREDITATION',
        documentPathOrTicket: '/legal/consular/uk_liaison_2026.pdf',
        verifiedBy: 'Consular Head',
        verifiedAtIso: '2026-10-22T00:00:00Z'
      }
    } as any, visaAdmin);
    await repo.transitionLifecycle(dynamicVisa.listingId, 'FINANCE_APPROVED', visaApprover);
    await repo.transitionLifecycle(dynamicVisa.listingId, 'PUBLISHED', visaApprover);

    const visaResults = await visaAdapter.search({ destinationCountry: 'United Kingdom', citizenshipCountry: 'Sri Lanka', purpose: 'all' });
    const foundVisa = visaResults.find(v => v.visaId === dynamicVisa.listingId || v.canonicalOfferId === dynamicVisa.canonicalEntityId);
    assert.ok(foundVisa, 'Visa adapter must retrieve published database visa assistance service');
    assert.equal(foundVisa!.pricing.totalPriceMinor, 7000000);

    // Stop-sale reactivity test on Visa
    await repo.toggleStopSale(dynamicVisa.listingId, true, visaAdmin, 'Consular office closed for UK bank holiday');
    const stoppedVisaResults = await visaAdapter.search({ destinationCountry: 'United Kingdom', citizenshipCountry: 'Sri Lanka', purpose: 'all' });
    const stoppedVisaFound = stoppedVisaResults.find(v => v.visaId === dynamicVisa.listingId);
    assert.equal(stoppedVisaFound, undefined, 'Stopped visa service must not appear in search results');
  });
});
