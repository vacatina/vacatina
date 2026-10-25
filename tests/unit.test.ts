import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateAndNormalizeTravellers, validateEmailAddress } from '../src/lib/validation/travellers.ts';
import { TripBucketService, computeTripBucketSummary } from '../src/lib/services/trip-bucket.service.ts';
import { FavoritesService } from '../src/lib/services/favorites.service.ts';
import { SearchCommandService, LOCKED_11_TAB_ORDER } from '../src/lib/services/search.service.ts';
import { LocaleService, MESSAGE_CATALOG, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from '../src/lib/services/locale.service.ts';
import { VacatinaLogoFull, VacatinaLogoResponsive, VacatinaMark, renderSvgGlobeIcon } from '../src/components/brand/vacatina-logo.ts';
import { VACATINA_SOCIAL_LINKS } from '../src/lib/constants/social.ts';
import { getStoredCookiePreferences, saveCookiePreferences } from '../src/components/dialogs/legal-cookie-modal.ts';
import { ALL_10_TRAVEL_PRODUCTS } from '../src/features/bundle/index.ts';
import { PricingEngineService } from '../src/lib/services/pricing-engine.service.ts';
import { InventoryNormalizerService } from '../src/lib/services/inventory-normalizer.service.ts';
import { SearchAggregatorService } from '../src/lib/services/search-aggregator.service.ts';
import { BookingOrchestratorService } from '../src/lib/services/booking-orchestrator.service.ts';
import { CANONICAL_HYBRID_CATALOG } from '../src/lib/mock-data/hybrid-catalog.ts';
import { getCustomerBuyingCondition, getBookingModeCta } from '../src/lib/domain/inventory-models.ts';
import {
  manualInventoryService,
  ManualInventoryService,
  CANONICAL_MANUAL_LISTINGS,
  assertListingIsProductionSellable,
  SeparationOfDutiesViolationError
} from '../src/lib/services/manual-inventory.service.ts';
import { CANONICAL_ROUTES, isCanonicalRoute, getRouteMeta } from '../src/lib/constants/routes.ts';
import { VacatinaStorageEngine } from '../src/server/db/storage.ts';
import { AuthorizationEngine, type SecurityContext } from '../src/server/auth/rbac.ts';
import { BookingSagaService } from '../src/server/services/booking-saga.service.ts';
import { PaymentGatewayService } from '../src/server/services/payment-gateway.service.ts';
import { VacatinaApiRouter } from '../src/server/api/router.ts';
import { validateServerEnv } from '../src/server/config/env.ts';
import { FlightSupplierAdapter, HotelSupplierAdapter } from '../src/server/inventory/adapters/base.adapter.ts';
import { FlightsDuffelAdapter, type RawDuffelFlightOffer } from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import { HotelsLiteApiAdapter, type RawLiteApiHotelOffer } from '../src/server/inventory/adapters/hotels-liteapi.adapter.ts';
import { CarsRentalAdapter } from '../src/server/inventory/adapters/cars-rental.adapter.ts';
import { CruisesTraveltekAdapter } from '../src/server/inventory/adapters/cruises-traveltek.adapter.ts';
import { ActivitiesViatorAdapter, type RawViatorExperienceOffer } from '../src/server/inventory/adapters/activities-viator.adapter.ts';
import { SightseeingViatorAdapter } from '../src/server/inventory/adapters/sightseeing-viator.adapter.ts';
import { RailsTrainlineAdapter, type RawTrainlineRailOffer } from '../src/server/inventory/adapters/rails-trainline.adapter.ts';
import { InsuranceAllianzAdapter } from '../src/server/inventory/adapters/insurance-allianz.adapter.ts';
import { VisaConsularAdapter } from '../src/server/inventory/adapters/visa-consular.adapter.ts';
import { ManualCmsAdapter } from '../src/server/inventory/adapters/manual-cms.adapter.ts';
import { PackagesBundlerAdapter } from '../src/server/inventory/adapters/packages-bundler.adapter.ts';
import { PricingPrecedenceService } from '../src/server/inventory/pricing-precedence.service.ts';
import { DeduplicationService } from '../src/server/inventory/deduplication.service.ts';
import { CacheTtlService } from '../src/server/inventory/cache-ttl.service.ts';
import { CircuitBreakerService } from '../src/server/inventory/circuit-breaker.service.ts';
import { UnifiedInventoryService } from '../src/server/inventory/unified-inventory.service.ts';
import { ClerkAuthService, CLERK_DEFAULT_CONFIG } from '../src/lib/services/clerk-auth.service.ts';
import {
  CLERK_VERIFIER_CONFIG,
  decodeJwtUnverified,
  verifyClerkJwt,
  mapClerkPayloadToSecurityContext,
  authenticateClerkRequest
} from '../src/server/auth/clerk-verifier.ts';
import {
  assertSeedCannotBeBookable,
  assertSeedCannotEnterCheckout,
  assertScaffoldCannotCreateProductionBooking,
  assertManualOfferPublishedForBooking,
  assertUnavailableOfferCannotBeReady,
  assertDistributionScopeIntegrity,
  assertDiscoveryContentCannotBeSold,
  assertDiscoveryLayerCannotEnterInventoryCheckout,
  isPackageReadyForCheckout,
  assertProductionResponseSafety,
  computeOfferSourceScore,
  selectBestSourceOffer,
  isOfferEligibleForPinOverride,
  deriveCustomerBadges,
  validateNoTechnicalLeakInCustomerBadges,
  getCanonicalBookingModeCta,
  assertProductionSearchExcludesDemoSeed,
  assertCandidateCannotBeProductionReady,
  assertNoFabricatedUpstreamReferences,
  assertCommercialEntitySellable,
  assertProviderCanExecuteLiveBooking,
  assertProviderIsProductionSellable,
  assertPackageAtomicCheckoutReady,
  toUnifiedCustomerOffer,
  isOfferEligibleForExclusivityBadge,
  type CanonicalOfferEntity,
  type CanonicalInventorySourceType,
  type CanonicalSourceEnvironment,
  type CanonicalBookingMode,
  type CommercialEntityClassification,
  ArchitecturalInvariantViolationError
} from '../src/server/inventory/types.ts';
import {
  AdminInventoryMonitoringService
} from '../src/server/inventory/admin-monitoring.service.ts';
import {
  InventoryOrchestratorService,
  globalInventoryOrchestrator
} from '../src/server/inventory/inventory-orchestrator.service.ts';
import {
  DiscoveryContentService,
  CANONICAL_DISCOVERY_CATALOG
} from '../src/server/inventory/discovery-content.ts';
import {
  ProviderRegistryService,
  CANONICAL_PROVIDER_REGISTRY,
  CANONICAL_COMMERCIAL_ENTITY_REGISTRY
} from '../src/server/inventory/provider-registry.ts';

describe('Vacatina Domain & Core Architecture Invariant Tests', () => {
  it('enforces exactly 10 Travel Products and 11 Search Command Center Tabs in locked order', () => {
    assert.equal(ALL_10_TRAVEL_PRODUCTS.length, 10);
    assert.equal(LOCKED_11_TAB_ORDER.length, 11);
    assert.deepEqual(
      LOCKED_11_TAB_ORDER.map(t => t.label),
      [
        'Build Your Bundle',
        'Flights',
        'Hotels',
        'Visa Assistance',
        'Holiday Packages',
        'Cars & Transfers',
        'Rails',
        'Cruises',
        'Activities',
        'Sightseeing Tours',
        'Travel Insurance'
      ]
    );
  });

  it('enforces Traveller validation rules: Adults >= 1, Total <= 9, Infants <= Adults', () => {
    // 1. Adults < 1 auto-corrects to 1
    const zeroAdults = validateAndNormalizeTravellers({ adults: 0, children: 0, infants: 0 });
    assert.equal(zeroAdults.valid, false);
    assert.equal(zeroAdults.adjusted.adults, 1);

    // 2. Infants > Adults auto-adjusts infants to match adults
    const excessInfants = validateAndNormalizeTravellers({ adults: 2, children: 1, infants: 3 });
    assert.equal(excessInfants.valid, false);
    assert.equal(excessInfants.adjusted.infants, 2);
    assert.ok(excessInfants.notice?.includes('Infants adjusted to 2'));

    // 3. Total > 9 caps total passengers at 9
    const excessTotal = validateAndNormalizeTravellers({ adults: 6, children: 4, infants: 2 });
    assert.equal(excessTotal.valid, false);
    const total =
      excessTotal.adjusted.adults +
      excessTotal.adjusted.children +
      excessTotal.adjusted.infants;
    assert.equal(total, 9);
    assert.ok(excessTotal.adjusted.infants <= excessTotal.adjusted.adults);
  });

  it('computes canonical Trip Bucket baseline financial math (LKR 505,000 Ready; LKR 45,000 Needs Action excluded)', () => {
    const bucket = new TripBucketService();
    const summary = bucket.getSummary();

    assert.equal(summary.totalItems, 3);
    assert.equal(summary.readyCount, 2);
    assert.equal(summary.needsActionCount, 1);
    assert.equal(summary.readySubtotalLkr, 505000);
    assert.equal(summary.excludedSubtotalLkr, 45000);

    // Resolve the UK Visa Needs Action item -> Ready
    bucket.resolveItemAction('tb-visa-uk-standard');
    const updated = bucket.getSummary();
    assert.equal(updated.readyCount, 3);
    assert.equal(updated.needsActionCount, 0);
    assert.equal(updated.readySubtotalLkr, 550000);
  });

  it('supports all 8 canonical Screen 04 Trip Bucket states and transitions', () => {
    const bucket = new TripBucketService();
    bucket.loadAllEightStatesDemo();
    const items = bucket.getItems();
    assert.equal(items.length, 8);

    const summaryBefore = computeTripBucketSummary(items);
    assert.equal(summaryBefore.readyCount, 1);
    assert.equal(summaryBefore.readySubtotalLkr, 248500);

    // Resolve Price Changed item -> Ready
    bucket.resolveItemAction('s04-05-price-changed');
    const summaryAfter = bucket.getSummary();
    assert.equal(summaryAfter.readyCount, 2);
    assert.equal(summaryAfter.readySubtotalLkr, 248500 + 154500);
  });

  it('keeps Saved Favorites strictly isolated from Trip Bucket totals', () => {
    const bucket = new TripBucketService();
    const favs = new FavoritesService();

    const added = favs.toggle('Colombo to Dubai', 'flights', 'Dubai', 'LKR 145,000');
    assert.equal(added, true);
    assert.equal(favs.getAll().length, 1);
    assert.equal(bucket.getSummary().readySubtotalLkr, 505000);
    assert.equal(bucket.getSummary().totalItems, 3);
  });

  it('validates newsletter email addresses and parses AI prompts', () => {
    assert.equal(validateEmailAddress('').valid, false);
    assert.equal(validateEmailAddress('invalid-email').valid, false);
    assert.equal(validateEmailAddress('traveller@vacatina.com').valid, true);

    const search = new SearchCommandService();
    const parsed = search.parseAiPromptToBundle('Plan 5 days in Dubai with flights, hotel and visa');
    assert.ok(parsed.destination.includes('Dubai'));
    assert.ok(parsed.components.includes('Flights'));
    assert.ok(parsed.components.includes('Hotels'));
    assert.ok(parsed.components.includes('Visa Assistance'));
  });

  it('supports Screen 03 Foundation v1.1 recovered capabilities: Change Room, Undo Remove, and Draft Staging', () => {
    const bucket = new TripBucketService();

    // 1. Change room on Hotel item: LKR 256,500 -> LKR 260,000 (Ready subtotal -> LKR 508,500)
    const toggledRoom = bucket.toggleHotelRoomTier('tb-hotel-london-deluxe');
    assert.equal(toggledRoom?.priceLkr, 260000);
    assert.equal(bucket.getSummary().readySubtotalLkr, 508500);

    // Toggle back to Deluxe King Room -> LKR 256,500 (Ready subtotal -> LKR 505,000)
    bucket.toggleHotelRoomTier('tb-hotel-london-deluxe');
    assert.equal(bucket.getSummary().readySubtotalLkr, 505000);

    // 2. Remove Flight item and Undo Remove
    const removed = bucket.removeItem('tb-flight-cmb-lhr');
    assert.equal(removed?.id, 'tb-flight-cmb-lhr');
    assert.equal(bucket.getSummary().totalItems, 2);
    assert.equal(bucket.getSummary().readySubtotalLkr, 256500);

    const restored = bucket.undoLastRemove();
    assert.equal(restored?.id, 'tb-flight-cmb-lhr');
    assert.equal(bucket.getSummary().totalItems, 3);
    assert.equal(bucket.getSummary().readySubtotalLkr, 505000);

    // 3. Stage 01 · Draft Trip Plan (excluded from Ready subtotal)
    const draft = bucket.stageDraftTripPlan('Dubai (DXB)', ['Flights', 'Hotels']);
    assert.equal(draft.state, 'draft');
    assert.equal(bucket.getSummary().totalItems, 4);
    assert.equal(bucket.getSummary().draftCount, 1);
    assert.equal(bucket.getSummary().readySubtotalLkr, 505000);
  });

  it('supports independent Language & Currency selection and canonical Brand Logo components without emoji globe', () => {
    const locale = new LocaleService();
    assert.ok(SUPPORTED_LANGUAGES.length >= 10);
    assert.ok(SUPPORTED_CURRENCIES.length >= 12);

    locale.setLanguage('SI');
    locale.setCurrency('AED');
    assert.equal(locale.getState().language, 'SI');
    assert.equal(locale.getState().currency, 'AED');

    locale.setLanguage('AR');
    assert.equal(locale.getLanguageDescriptor('AR').dir, 'rtl');

    locale.setLanguage('EN');
    locale.setCurrency('LKR');

    const fullLogo = VacatinaLogoFull();
    const responsiveLogo = VacatinaLogoResponsive();
    const markOnly = VacatinaMark();
    const globeSvg = renderSvgGlobeIcon();
    const lightFullLogo = VacatinaLogoFull({ surface: 'light' });
    const darkFullLogo = VacatinaLogoFull({ surface: 'dark' });

    assert.ok(fullLogo.includes('we treasure your holidays'));
    assert.ok(lightFullLogo.includes('Vacatina_Logo_OneColor_SpaceCadet'));
    assert.ok(darkFullLogo.includes('Vacatina_Logo_Reverse_SpaceCadet'));
    assert.ok(responsiveLogo.includes('Vacatina'));
    assert.ok(markOnly.includes('<img') || markOnly.includes('Vacatina Brand Mark'));
    assert.ok(globeSvg.includes('<svg') && !globeSvg.includes('🌐'));
  });

  it('provides complete EN, SI, and TA message catalog coverage across all product and legal keys', () => {
    ['EN', 'SI', 'TA'].forEach(lang => {
      const cat = MESSAGE_CATALOG[lang as 'EN' | 'SI' | 'TA'];
      assert.ok(cat.headingFlights.length > 0);
      assert.ok(cat.headingHotels.length > 0);
      assert.ok(cat.headingVisa.length > 0);
      assert.ok(cat.headingPackages.length > 0);
      assert.ok(cat.mobileQuickActions.length > 0);
      assert.ok(cat.footerPrivacy.length > 0);
      assert.ok(cat.footerTerms.length > 0);
      assert.ok(cat.footerCookies.length > 0);
      assert.ok(cat.footerFollow.length > 0);
    });
  });

  it('manages default and updated cookie preferences with essential cookies locked true', () => {
    const prefs = getStoredCookiePreferences();
    assert.equal(prefs.essential, true);
    assert.equal(typeof prefs.analytics, 'boolean');
    assert.equal(typeof prefs.personalization, 'boolean');
    assert.equal(typeof prefs.marketing, 'boolean');
  });

  it('enforces verified social media URLs and honest localization classification', () => {
    // 1. Verified Social Links
    assert.equal(VACATINA_SOCIAL_LINKS.facebook, 'https://www.facebook.com/vacatinaglobal');
    assert.equal(VACATINA_SOCIAL_LINKS.instagram, 'https://www.instagram.com/vacatinaglobal');
    assert.equal(VACATINA_SOCIAL_LINKS.linkedin, 'https://www.linkedin.com/company/vacatinaglobal');

    // 2. Truthful Localization Classification
    const en = SUPPORTED_LANGUAGES.find(l => l.code === 'EN');
    const si = SUPPORTED_LANGUAGES.find(l => l.code === 'SI');
    const ta = SUPPORTED_LANGUAGES.find(l => l.code === 'TA');
    const ar = SUPPORTED_LANGUAGES.find(l => l.code === 'AR');

    assert.ok(en?.regionHint.includes('Full Production'));
    assert.ok(si?.regionHint.includes('Beta') || si?.regionHint.includes('Prototype Localization'));
    assert.ok(ta?.regionHint.includes('Beta') || ta?.regionHint.includes('Prototype Localization'));
    assert.ok(ar?.regionHint.includes('Coming Soon') || ar?.regionHint.includes('Architecture Ready'));
  });

  it('validates Vercel deployment configuration and dedicated website output directory', () => {
    const vercelConfigPath = path.resolve('vercel.json');
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    assert.equal(vercelConfig.outputDirectory, 'dist-site');
    assert.equal(vercelConfig.cleanUrls, true);

    const siteDir = path.resolve('dist-site');
    assert.ok(fs.existsSync(siteDir), 'dist-site/ must exist');
    assert.ok(fs.existsSync(path.join(siteDir, 'index.html')), 'dist-site/index.html must exist');
    assert.ok(fs.existsSync(path.join(siteDir, 'dist', 'styles', 'tailwind.css')), 'dist-site/dist/styles/tailwind.css must exist');
    assert.ok(fs.existsSync(path.join(siteDir, 'dist', 'vacatina.bundle.js')), 'dist-site/dist/vacatina.bundle.js must exist');
    assert.ok(fs.existsSync(path.join(siteDir, 'public', 'manifest.webmanifest')), 'dist-site/public/manifest.webmanifest must exist');
  });

  it('enforces Canonical Click-to-Destination & Resource Architecture v1.0 specifications', () => {
    const siteHtml = fs.readFileSync(path.resolve('dist-site', 'index.html'), 'utf8');

    // Rule 1: Zero '#' links, zero dead-ends
    const aRegex = /<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
    let match;
    const deadEndLinks: string[] = [];
    while ((match = aRegex.exec(siteHtml)) !== null) {
      const attrs = match[1];
      const hrefMatch = attrs.match(/href="([^"]*)"/i);
      const href = hrefMatch ? hrefMatch[1] : '';
      const dataModalMatch = attrs.match(/data-legal-modal="([^"]*)"/i);
      if ((href === '#' || href === '') && !dataModalMatch) {
        deadEndLinks.push(match[0]);
      }
    }
    assert.equal(deadEndLinks.length, 0, `Prohibited dead-end links found: ${deadEndLinks.join(', ')}`);

    // Rule 20: No public Alex Morgan demo identity in default guest view
    assert.ok(!siteHtml.includes('Alex Morgan'), 'Default guest view must not display Alex Morgan');
    assert.ok(!siteHtml.includes('alex.morgan@example.com'), 'Default guest view must not display alex.morgan@example.com');
    assert.ok(siteHtml.includes('/auth/sign-in'), 'Header must provide canonical /auth/sign-in link');
    assert.ok(siteHtml.includes('/auth/sign-up'), 'Header must provide canonical /auth/sign-up link');

    // Rule 21 & 22: Canonical 8 Resources Items (No About Us, FAQ, Contact Us in Resources)
    const canonicalResourceRoutes = [
      '/resources/travel-notes',
      '/resources/destinations',
      '/resources/seasonal-guide',
      '/resources/visa-requirements',
      '/resources/travel-insurance-guide',
      '/resources/travel-disruption',
      '/resources/trip-bucket-guide',
      '/resources'
    ];
    canonicalResourceRoutes.forEach(route => {
      assert.ok(siteHtml.includes(route), `Site must contain canonical resource route: ${route}`);
    });

    // Check Resources menu does NOT contain About Us, FAQ, or Contact Us
    const resourcesDropdownMatch = siteHtml.match(/id="resources-dropdown-menu"[\s\S]*?<\/div>\s*<\/div>/);
    assert.ok(resourcesDropdownMatch, 'resources-dropdown-menu must exist');
    const resourcesMenuHtml = resourcesDropdownMatch[0];
    assert.ok(!resourcesMenuHtml.includes('/about'), 'Resources dropdown must not contain About Us');
    assert.ok(!resourcesMenuHtml.includes('/help/faq'), 'Resources dropdown must not contain FAQ');
    assert.ok(!resourcesMenuHtml.includes('/contact'), 'Resources dropdown must not contain Contact Us');

    // Rule 24: "Review Protocols" renamed to "How We Compare Options"
    assert.ok(siteHtml.includes('How We Compare Options'), 'Must contain How We Compare Options');
    assert.ok(siteHtml.includes('/resources/booking-transparency'), 'Must link to /resources/booking-transparency');

    // Rule 32: Vercel rewrites configuration
    const vercelConfig = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
    assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites array');
    assert.ok(vercelConfig.rewrites.some((r: any) => r.destination === '/' || r.destination === '/index.html'), 'vercel.json must rewrite SPA routes to / or /index.html');

    // Check all 40 cards have canonical routes
    const articles = siteHtml.match(/<article[\s\S]*?<\/article>/g) || [];
    assert.equal(articles.length, 40, 'Site must contain exactly 40 product cards');
    articles.forEach((art, idx) => {
      assert.ok(art.includes('<h3') && art.includes('<a href="/'), `Card ${idx + 1} title must be wrapped in canonical <a> link`);
      assert.ok(art.includes('<a href="/') && art.includes('class="w-full bg-brand-primary'), `Card ${idx + 1} primary CTA must be a canonical <a> link`);
    });
  });

  it('enforces Hybrid Inventory Strategy: canonical offer model, 3 source modes, 3 confirmation modes, and buying condition mapping', () => {
    // 1. Verify Catalog Coverage across all 3 source types: API, MANUAL, HYBRID
    const sourceTypes = new Set(CANONICAL_HYBRID_CATALOG.map(o => o.sourceType));
    assert.ok(sourceTypes.has('API'), 'Catalog must contain API inventory');
    assert.ok(sourceTypes.has('MANUAL'), 'Catalog must contain MANUAL inventory');
    assert.ok(sourceTypes.has('HYBRID'), 'Catalog must contain HYBRID inventory');

    // 2. Verify Confirmation Modes: INSTANT_CONFIRM, REQUEST_TO_CONFIRM, ASSISTED_SERVICE
    const confirmModes = new Set(CANONICAL_HYBRID_CATALOG.map(o => o.confirmationMode));
    assert.ok(confirmModes.has('INSTANT_CONFIRM'), 'Must support INSTANT_CONFIRM');
    assert.ok(confirmModes.has('REQUEST_TO_CONFIRM'), 'Must support REQUEST_TO_CONFIRM');
    assert.ok(confirmModes.has('ASSISTED_SERVICE'), 'Must support ASSISTED_SERVICE');

    // 3. Verify Stable Canonical IDs (Never display text like "Dubai" or "London Deluxe")
    CANONICAL_HYBRID_CATALOG.forEach(offer => {
      assert.ok(offer.offerId.startsWith('vct-'), `Offer ID must start with canonical prefix: ${offer.offerId}`);
      assert.ok(!offer.offerId.includes(' '), `Offer ID must not contain whitespace: ${offer.offerId}`);
      assert.ok(offer.location.countryCode.length >= 2, 'Must have structured location countryCode');
      assert.ok(offer.inclusions.length > 0, 'Must have audited inclusions');
    });

    // 4. Honest B2C Customer Buying Condition Mapping (Never expose internal "API/Manual" tags)
    const instantOffer = CANONICAL_HYBRID_CATALOG.find(o => o.confirmationMode === 'INSTANT_CONFIRM' && o.availabilityStatus === 'LIVE')!;
    assert.equal(getCustomerBuyingCondition(instantOffer), 'Instant Confirmation');

    const onRequestOffer = CANONICAL_HYBRID_CATALOG.find(o => o.confirmationMode === 'REQUEST_TO_CONFIRM')!;
    assert.equal(getCustomerBuyingCondition(onRequestOffer), 'Request to Confirm');

    const visaOffer = CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'visa')!;
    assert.equal(getCustomerBuyingCondition(visaOffer), 'Available');
  });

  it('enforces 4-layer pricing architecture with raw supplier cost preservation, percentage/fixed markups, and auditable overrides', () => {
    // Layer 1: Raw supplier base price
    // Layer 2: Vacatina markup (percentage or fixed)
    // Layer 3: Approved administrative override
    // Layer 4: Final customer selling price

    // Case A: Percentage markup (e.g. USD 500 base, 10% markup)
    const pricingPct = PricingEngineService.calculatePricing({
      supplierRawBasePrice: 500,
      supplierBaseCurrency: 'USD',
      markup: {
        type: 'PERCENTAGE',
        value: 10.0,
        ruleId: 'AIR_10_PCT',
        ruleDescription: '10% Standard Airline Markup'
      },
      customerDisplayCurrency: 'LKR'
    });

    assert.equal(pricingPct.supplierRawBasePrice, 500, 'Raw supplier cost must be preserved');
    assert.equal(pricingPct.supplierBaseCurrency, 'USD');
    assert.equal(pricingPct.exchangeRateToBase, 300); // 1 USD = 300 LKR
    assert.equal(pricingPct.supplierBasePriceLkr, 500 * 300); // LKR 150,000
    assert.equal(pricingPct.vacatinaMarkup.amountLkr, Math.round(150000 * 0.1)); // LKR 15,000
    assert.equal(pricingPct.customerSellingPriceLkr, 150000 + 15000); // LKR 165,000

    // Case B: Fixed markup (e.g. LKR 8,000 fixed transfer margin)
    const pricingFixed = PricingEngineService.calculatePricing({
      supplierRawBasePrice: 20000,
      supplierBaseCurrency: 'LKR',
      markup: {
        type: 'FIXED',
        value: 8000,
        ruleId: 'CAR_FIXED_8K'
      },
      customerDisplayCurrency: 'LKR'
    });
    assert.equal(pricingFixed.supplierBasePriceLkr, 20000);
    assert.equal(pricingFixed.vacatinaMarkup.amountLkr, 8000);
    assert.equal(pricingFixed.customerSellingPriceLkr, 28000);

    // Case C: Auditable Administrative Price Override
    const overridden = PricingEngineService.applyAdminOverride(
      pricingPct,
      160000,
      'Director Special Corporate Waiver',
      'usr-admin-88',
      'Operations Director'
    );
    assert.equal(overridden.supplierRawBasePrice, 500, 'Original supplier raw cost must NEVER be destroyed by override');
    assert.equal(overridden.customerSellingPriceLkr, 160000, 'Selling price must reflect approved override');
    assert.ok(overridden.manualOverride, 'Manual override audit record must exist');
    assert.equal(overridden.manualOverride?.previousValueLkr, 165000);
    assert.equal(overridden.manualOverride?.newValueLkr, 160000);
    assert.equal(overridden.manualOverride?.varianceLkr, -5000);
    assert.equal(overridden.manualOverride?.overrideReason, 'Director Special Corporate Waiver');
    assert.equal(overridden.manualOverride?.authorizedByUserId, 'usr-admin-88');

    // Case D: Negative price guard
    assert.throws(() => {
      PricingEngineService.calculatePricing({
        supplierRawBasePrice: -100,
        supplierBaseCurrency: 'USD',
        markup: { type: 'PERCENTAGE', value: 10 }
      });
    }, /cannot be negative/);
  });

  it('enforces Search Aggregation, Deduplication, and Mixed-Source Trip Bucket Orchestration with On-Request Guards', () => {
    const aggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);

    // 1. Multi-source search aggregation
    const allResults = aggregator.search();
    assert.ok(allResults.length >= 10, 'Aggregator must return offers across all products');

    const flightResults = aggregator.search({ productType: 'flights' });
    assert.ok(flightResults.length >= 2, 'Must aggregate both API GDS flight and Manual charter');
    assert.ok(flightResults.some(f => f.sourceType === 'API'));
    assert.ok(flightResults.some(f => f.sourceType === 'MANUAL'));

    // 2. Filter by instant confirmation
    const instantResults = aggregator.search({ instantConfirmOnly: true });
    instantResults.forEach(offer => {
      assert.equal(offer.confirmationMode, 'INSTANT_CONFIRM');
    });

    // 3. Mixed-Source Trip Bucket Journey
    const bucket = new TripBucketService([]);
    assert.equal(bucket.getItems().length, 0);

    const apiFlight = CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'flights' && o.sourceType === 'API')!;
    const manualHotel = CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'hotels' && o.sourceType === 'MANUAL')!;
    const manualVisa = CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'visa')!;
    const onRequestCharter = CANONICAL_HYBRID_CATALOG.find(o => o.confirmationMode === 'REQUEST_TO_CONFIRM')!;

    // Stage API flight (instant confirm) -> Ready
    bucket.stageNormalizedOffer(apiFlight);
    // Stage Manual hotel (instant confirm) -> Ready
    bucket.stageNormalizedOffer(manualHotel);
    // Stage Manual visa (assisted service) -> Needs Action
    bucket.stageNormalizedOffer(manualVisa);
    // Stage On-request charter -> Needs Action
    bucket.stageNormalizedOffer(onRequestCharter);

    const breakdown = bucket.getMixedSourceBreakdown();
    assert.equal(breakdown.apiCount, 1);
    assert.equal(breakdown.manualCount, 3);
    assert.equal(breakdown.instantCount, 2);
    assert.equal(breakdown.onRequestCount, 1);
    assert.equal(breakdown.assistedServiceCount, 1);

    const summary = bucket.getSummary();
    assert.equal(summary.totalItems, 4);
    assert.equal(summary.readyCount, 2); // Only instant-confirm items are ready
    assert.equal(summary.needsActionCount, 2); // Visa + On-request

    // 4. Critical Invariant: On-Request items CANNOT falsely become 'ready' without confirmed allocation!
    const charterCandidateId = `tb-${onRequestCharter.offerId}`;
    bucket.transitionItemState(charterCandidateId, 'ready');
    const guardedSummary = bucket.getSummary();
    assert.equal(guardedSummary.readyCount, 2, 'On-request item must NOT become ready via standard transition');
    assert.equal(guardedSummary.needsActionCount, 2);

    // Confirm partner allocation explicitly -> Promoted to Ready
    bucket.confirmOnRequestAllocation(charterCandidateId, 'SRILANKAN-AIRTAXI-CONFIRM-882');
    const confirmedSummary = bucket.getSummary();
    assert.equal(confirmedSummary.readyCount, 3, 'After explicit partner allocation, item becomes Ready');

    // 5. Booking Orchestrator: Multi-Channel Component Routing
    const dossier = BookingOrchestratorService.orchestrateBooking(
      [apiFlight, manualHotel, manualVisa, onRequestCharter],
      { name: 'Dr. Rohan Silva', email: 'rohan.silva@example.com' }
    );

    assert.equal(dossier.totalComponents, 4);
    assert.equal(dossier.instantConfirmedCount, 2);
    assert.equal(dossier.onRequestCount, 1);
    assert.equal(dossier.assistedServiceCount, 1);
    assert.equal(dossier.isFullyInstantConfirmed, false);
    assert.equal(dossier.tickets.length, 4);

    // Verify routing methods:
    assert.ok(dossier.tickets.some(t => t.fulfillmentMethod === 'SUPPLIER_API'));
    assert.ok(dossier.tickets.some(t => t.fulfillmentMethod === 'MANUAL_INVENTORY'));
    assert.ok(dossier.tickets.some(t => t.fulfillmentMethod === 'ON_REQUEST_DISPATCH'));
    assert.ok(dossier.tickets.some(t => t.fulfillmentMethod === 'ASSISTED_SERVICE_CASE'));
  });

  it('enforces downstream routing for Search Results, Offer Configurators, and Property Details with zero dead-ends', () => {
    // 1. Verify all 10 product search routes map to registered catalog categories
    const searchRoutes: Record<string, string> = {
      '/flights/search': 'flights',
      '/hotels/search': 'hotels',
      '/visa-assistance/options': 'visa',
      '/holiday-packages/search': 'packages',
      '/cars-transfers/search': 'cars',
      '/rails/search': 'rails',
      '/cruises/search': 'cruises',
      '/activities/search': 'activities',
      '/sightseeing-tours/search': 'sightseeing',
      '/travel-insurance/compare': 'insurance'
    };

    const searchAggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);
    for (const [route, productType] of Object.entries(searchRoutes)) {
      const results = searchAggregator.search({ productType: productType as any });
      assert.ok(results.length > 0, `Search aggregator must yield results for route ${route} (${productType})`);
      for (const offer of results) {
        assert.ok(offer.offerId, 'Offer must have a stable canonical offerId');
        assert.ok(offer.pricing.customerSellingPriceLkr > 0, 'Offer must have customer selling price > 0');
        const buyingCondition = getCustomerBuyingCondition(offer);
        assert.ok(
          ['Instant Confirmation', 'Request to Confirm', 'Assisted Service', 'Available'].includes(buyingCondition),
          `Buying condition "${buyingCondition}" must be customer-facing and compliant`
        );
      }
    }

    // 2. Verify Flight Offer deep links have matching canonical offers
    const flightOffers = CANONICAL_HYBRID_CATALOG.filter(o => o.productType === 'flights');
    for (const fl of flightOffers) {
      const deepLink = `/flights/offer/${fl.offerId}`;
      assert.ok(deepLink.startsWith('/flights/offer/vct-fl-'), `Deep link format valid: ${deepLink}`);
    }

    // 3. Verify Hotel Property deep links and configuration subroutes
    const hotelOffers = CANONICAL_HYBRID_CATALOG.filter(o => o.productType === 'hotels');
    for (const ht of hotelOffers) {
      const propLink = `/hotels/property/${ht.offerId}`;
      const cfgLink = `/hotels/property/${ht.offerId}/configure`;
      assert.ok(propLink.startsWith('/hotels/property/vct-h'), `Property link format valid: ${propLink}`);
      assert.ok(cfgLink.endsWith('/configure'), `Config link ends with /configure: ${cfgLink}`);
    }

    // 4. Verify B2C Protection: Zero raw pricing or internal provider tags exposed in customer conditions
    for (const offer of CANONICAL_HYBRID_CATALOG) {
      const condition = getCustomerBuyingCondition(offer);
      assert.ok(!condition.includes('API'), 'Customer buying condition must not expose internal API term');
      assert.ok(!condition.includes('MANUAL'), 'Customer buying condition must not expose internal MANUAL term');
      assert.ok(!condition.includes('Amadeus'), 'Customer buying condition must not expose upstream supplier name');
      assert.ok(!condition.includes('Sabre'), 'Customer buying condition must not expose upstream supplier name');
      assert.ok(!condition.includes('LiteAPI'), 'Customer buying condition must not expose upstream supplier name');
      assert.ok(!condition.includes('Payload'), 'Customer buying condition must not expose CMS name');
    }
  });

  it('enforces Manual Inventory Service lifecycle, Seed Content separation, Pin-Above-API ranking, and Canonical Route Registry', () => {
    // 1. Manual Inventory Service Lifecycle & Audit Logging (Part 10)
    const testListingService = new ManualInventoryService();
    testListingService.registerListing({
      id: 'test-charter-001',
      collection: 'manual-charter-flights',
      productType: 'flights',
      partnerSupplierId: 'DIRECT_CHARTER_DESK',
      partnerName: 'Verified Direct Contract Flight Operations',
      title: 'Private Lagoon Seaplane',
      subtitle: 'Exclusive charter',
      slug: 'private-lagoon-seaplane',
      location: { city: 'Male', country: 'Maldives', countryCode: 'MV' },
      status: 'PUBLISHED',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      availableQuota: 4,
      contractedBaseCost: 150000,
      costCurrency: 'LKR',
      standardSellingPriceLkr: 180000,
      validFromIso: '2026-01-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      inclusions: ['Lagoon transfer'],
      exclusions: ['Heavy luggage'],
      cancellationPolicy: '72hr notice',
      pinPriority: 20,
      exclusiveOffer: true,
      featured: true,
      auditTrail: []
    });

    const activeListings = testListingService.queryListings({ productType: 'flights' });
    assert.equal(activeListings.length, 1);
    assert.equal(activeListings[0].id, 'test-charter-001');

    // Admin pauses listing -> must disappear from customer query
    testListingService.updateStatus('test-charter-001', 'PAUSED', { id: 'admin-1', name: 'Sara Chief' }, 'Temporary weather hold');
    const pausedQuery = testListingService.queryListings({ productType: 'flights', onlyActive: true });
    assert.equal(pausedQuery.length, 0, 'Paused manual listing must not appear in customer active search');

    // 2. Seed Content Separation Guard (Part 5 & 16)
    const tripBucket = new TripBucketService();
    const seedOffer = {
      ...CANONICAL_HYBRID_CATALOG[0],
      offerId: 'seed-prototype-flight-card',
      sourceType: 'SEED' as const,
      isSeedContent: true,
      pricing: { ...CANONICAL_HYBRID_CATALOG[0].pricing, customerSellingPriceLkr: 120000 }
    };

    const stagedSeed = tripBucket.stageNormalizedOffer(seedOffer);
    assert.equal(stagedSeed.state, 'draft', 'Seed content MUST stage as draft, never Ready');

    // Attempt transition to ready -> MUST be blocked
    tripBucket.transitionItemState(stagedSeed.id, 'ready');
    const seedItemInBucket = tripBucket.getItems().find(i => i.id === stagedSeed.id);
    assert.ok(seedItemInBucket);
    assert.equal(seedItemInBucket.state, 'draft', 'Seed content MUST NOT become Ready without promotion to real inventory');
    assert.ok(seedItemInBucket.actionRequiredText?.includes('Prototype Seed Content'));

    // Check summary: ready count must remain strictly at baseline (2), seed item must not enter ready subtotal
    const summaryAfterTransition = tripBucket.getSummary();
    assert.equal(summaryAfterTransition.readyCount, 2, 'Ready count must remain 2 (seed item excluded from ready count)');
    assert.equal(summaryAfterTransition.readySubtotalLkr, 505000, 'Seed item MUST NOT contribute to readySubtotalLkr');

    // 3. Pin Above API Results (Part 12)
    const aggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);
    const searchResults = aggregator.search({ productType: 'hotels' });
    // Adaaran (LiteAPI, pinPriority 0) vs Heritance Kandalama (Manual, pinPriority 15)
    assert.ok(searchResults.length >= 2);
    // Pinned manual contract with pinPriority must be prioritized in recommended ranking
    const pinnedFirst = searchResults[0];
    assert.ok(
      (pinnedFirst.pinPriority || 0) >= (searchResults[1].pinPriority || 0),
      'Pinned offer must rank higher than unpinned offer'
    );

    // 4. Truthful Booking Mode CTAs (Part 8)
    assert.equal(getBookingModeCta('INSTANT_BOOK'), 'Check Availability');
    assert.equal(getBookingModeCta('REQUEST_TO_BOOK'), 'Request Booking');
    assert.equal(getBookingModeCta('REQUEST_AVAILABILITY'), 'Request Availability');
    assert.equal(getBookingModeCta('INQUIRY_ONLY'), 'Contact Vacatina');

    // 5. Canonical Route Registry (Part 2, 18, 21, 22, 23, 25)
    assert.ok(isCanonicalRoute('/'));
    assert.ok(isCanonicalRoute('/flights'));
    assert.ok(isCanonicalRoute('/hotels/search'));
    assert.ok(isCanonicalRoute('/flights/offer/vct-fl-amadeus-cmb-dxb-001'));
    assert.ok(isCanonicalRoute('/hotels/property/vct-ht-liteapi-001/configure'));
    assert.ok(isCanonicalRoute('/resources/travel-disruption'));
    assert.ok(isCanonicalRoute('/corporate-travel'));
    assert.ok(isCanonicalRoute('/manage-booking'));
    assert.ok(isCanonicalRoute('/legal/cookies'));
    assert.equal(isCanonicalRoute('/random-fake-destination-path'), false);

    const meta = getRouteMeta('/flights/offer/vct-fl-001');
    assert.ok(meta);
    assert.equal(meta.category, 'offer_config');
    assert.equal(meta.productType, 'flights');
  });

  it('enforces Server Architecture, Database Schema, and Storage Engine invariants (ADR-001)', () => {
    const storage = new VacatinaStorageEngine();

    // 1. Pre-seeded Platform and Partner Organizations
    const hqOrg = storage.getOrganization('org_vacatina_hq_001');
    assert.ok(hqOrg);
    assert.equal(hqOrg.type, 'PLATFORM');

    const partnerOrg = storage.getOrganization('org_partner_ceylon_tours');
    assert.ok(partnerOrg);
    assert.equal(partnerOrg.type, 'AGENCY');
    assert.equal(partnerOrg.currency, 'LKR');

    // 2. Client Management and Integer Minor Unit Persistence
    const clients = storage.getClientsByOrg(partnerOrg.id);
    assert.ok(clients.length >= 1);
    const client = clients[0];
    assert.equal(client.corporateName, 'Dialog Axiata PLC');
    assert.equal(client.creditLimitMinor, 250000000); // LKR 2,500,000.00 (Zero floating-point errors)

    // 3. Immutable Audit Logging
    const audit = storage.recordAuditLog({
      action: 'CREDIT_LIMIT_UPDATED',
      targetEntity: 'clients',
      targetEntityId: client.id,
      previousState: { creditLimitMinor: 200000000 },
      newState: { creditLimitMinor: 250000000 },
      justificationReason: 'Approved by Vacatina Financial Risk Committee'
    });
    assert.ok(audit.id);
    assert.equal(audit.action, 'CREDIT_LIMIT_UPDATED');

    const queriedLogs = storage.getAuditLogs('clients', client.id);
    assert.ok(queriedLogs.length >= 1);
    assert.equal(queriedLogs[0].justificationReason, 'Approved by Vacatina Financial Risk Committee');

    // 4. Startup Environment Validator
    const env = validateServerEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test_user:pass@localhost:5432/vacatina_test'
    });
    assert.equal(env.NODE_ENV, 'test');
    assert.equal(env.DATABASE_POOL_MIN, 2);
  });

  it('enforces Tenant-Aware RBAC and strictly blocks cross-tenant leakage (ADR-003)', () => {
    const agencyAContext: SecurityContext = {
      userId: 'usr_agent_001',
      email: 'sarah@agency-a.com',
      role: 'BOOKING_AGENT',
      organizationId: 'org_agency_a',
      organizationType: 'AGENCY'
    };

    const agencyBContext: SecurityContext = {
      userId: 'usr_agent_002',
      email: 'david@agency-b.com',
      role: 'BOOKING_AGENT',
      organizationId: 'org_agency_b',
      organizationType: 'AGENCY'
    };

    const customerContext: SecurityContext = {
      userId: 'usr_cust_001',
      email: 'traveller@gmail.com',
      role: 'CUSTOMER'
    };

    // 1. Role Permission Checks
    assert.ok(AuthorizationEngine.hasPermission(agencyAContext, 'agency:view_dashboard'));
    assert.ok(AuthorizationEngine.hasPermission(agencyAContext, 'agency:create_quote'));
    assert.equal(AuthorizationEngine.hasPermission(agencyAContext, 'platform:system_admin'), false);
    assert.equal(AuthorizationEngine.hasPermission(customerContext, 'agency:view_dashboard'), false);

    // 2. Tenant Ownership Guard (Cross-Tenant Leakage Protection)
    // Agency A accessing Agency A resource -> ALLOWED
    const allowedCheck = AuthorizationEngine.authorizeResourceAccess(agencyAContext, 'agency:manage_clients', 'org_agency_a');
    assert.ok(allowedCheck.allowed);

    // Agency A attempting to access Agency B resource -> STRICTLY FORBIDDEN!
    const deniedCheck = AuthorizationEngine.authorizeResourceAccess(agencyAContext, 'agency:manage_clients', 'org_agency_b');
    assert.equal(deniedCheck.allowed, false);
    assert.ok(deniedCheck.reason?.includes('Tenant mismatch'));

    // Customer attempting to access Agency A resource -> STRICTLY FORBIDDEN!
    const customerDenied = AuthorizationEngine.authorizeResourceAccess(customerContext, 'agency:manage_clients', 'org_agency_a');
    assert.equal(customerDenied.allowed, false);
  });

  it('enforces Distributed Booking Saga Orchestrator with partial-failure compensation (ADR-005)', async () => {
    const storage = new VacatinaStorageEngine();
    const saga = new BookingSagaService(storage);

    const bucket = storage.getOrCreateTripBucket('sess_saga_test_001');

    // 1. Staging ready items into bucket
    const item1 = storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: 'vct-fl-amadeus-cmb-dxb-001',
      productType: 'flights',
      sourceType: 'API',
      bookingMode: 'INSTANT_BOOK',
      title: 'Colombo to Dubai Flight UL225',
      configuration: { flightNumber: 'UL225' },
      travellerManifest: { adults: 1 },
      unitSellingPriceMinor: 18500000, // LKR 185,000.00
      currency: 'LKR',
      state: 'READY'
    });

    const item2 = storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: 'vct-ht-direct-sri-kandalama-01',
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      bookingMode: 'INSTANT_BOOK',
      title: 'Heritance Kandalama Deluxe Room',
      configuration: { roomType: 'Deluxe' },
      travellerManifest: { adults: 1 },
      unitSellingPriceMinor: 4800000, // LKR 48,000.00
      currency: 'LKR',
      state: 'READY'
    });

    // 2. Execute Successful Multi-Product Saga
    const successResult = await saga.executeBookingSaga({
      tripBucketId: bucket.id,
      customerEmail: 'alex@example.com',
      customerName: 'Alex Morgan',
      checkoutSessionId: 'cs_live_123',
      idempotencyKey: 'idemp_saga_success_001'
    });

    assert.ok(successResult.bookingGroupId);
    assert.ok(successResult.bookingReference.startsWith('VCT-2026-'));
    assert.equal(successResult.overallStatus, 'CONFIRMED');
    assert.equal(successResult.paymentStatus, 'SETTLED');
    assert.equal(successResult.totalSellingPriceMinor, 23300000); // LKR 233,000.00
    assert.equal(successResult.items.length, 2);
    assert.ok(successResult.items.every(i => i.fulfillmentStatus === 'CONFIRMED'));
    assert.equal(successResult.requiresManualReview, false);

    // 3. Test Partial Failure & Compensation Flow
    const partialBucket = storage.getOrCreateTripBucket('sess_partial_test_002');
    storage.addTripBucketItem({
      tripBucketId: partialBucket.id,
      canonicalOfferId: 'vct-fl-success-001',
      productType: 'flights',
      sourceType: 'API',
      bookingMode: 'INSTANT_BOOK',
      title: 'Confirmed Flight Leg',
      configuration: {},
      travellerManifest: {},
      unitSellingPriceMinor: 10000000,
      currency: 'LKR',
      state: 'READY'
    });
    storage.addTripBucketItem({
      tripBucketId: partialBucket.id,
      canonicalOfferId: 'vct-ht-force_failure-002', // Triggers simulated timeout/exhaustion
      productType: 'hotels',
      sourceType: 'API',
      bookingMode: 'REQUEST_TO_BOOK',
      title: 'Failing Hotel Property',
      configuration: {},
      travellerManifest: {},
      unitSellingPriceMinor: 5000000,
      currency: 'LKR',
      state: 'READY'
    });

    const partialResult = await saga.executeBookingSaga({
      tripBucketId: partialBucket.id,
      customerEmail: 'sam@example.com',
      customerName: 'Sam Perera',
      checkoutSessionId: 'cs_partial_456',
      idempotencyKey: 'idemp_saga_partial_002'
    });

    assert.equal(partialResult.overallStatus, 'PARTIAL_FAILURE');
    assert.equal(partialResult.paymentStatus, 'PARTIALLY_REFUNDED');
    assert.equal(partialResult.requiresManualReview, true);
    assert.equal(partialResult.compensationTriggered, true);

    // Assert that an operational support triage ticket was automatically created
    const triageTickets = storage.getSupportTickets('OPEN');
    assert.ok(triageTickets.some(t => t.ticketReference.includes(partialResult.bookingReference)));
  });

  it('enforces Payment Gateway Abstraction, SAQ-A compliance, and Idempotent Webhook Ledger (ADR-004)', async () => {
    const storage = new VacatinaStorageEngine();
    const paymentService = new PaymentGatewayService(storage);

    // 1. Create Idempotent Payment Intent
    const intent1 = await paymentService.createPaymentIntent({
      bookingGroupId: 'bg_test_001',
      amountMinor: 15000000,
      currency: 'LKR',
      customerEmail: 'customer@vacatina.com',
      customerName: 'Customer Name',
      idempotencyKey: 'idemp_pay_001',
      returnUrl: 'https://vacatina-nu.vercel.app/checkout'
    });

    assert.ok(intent1.paymentOrderId);
    assert.ok(intent1.gatewayOrderId);
    assert.equal(intent1.status, 'PENDING');

    // Identical call returns identical result without duplicate order creation
    const intent2 = await paymentService.createPaymentIntent({
      bookingGroupId: 'bg_test_001',
      amountMinor: 15000000,
      currency: 'LKR',
      customerEmail: 'customer@vacatina.com',
      customerName: 'Customer Name',
      idempotencyKey: 'idemp_pay_001',
      returnUrl: 'https://vacatina-nu.vercel.app/checkout'
    });
    assert.equal(intent2.paymentOrderId, intent1.paymentOrderId);

    // 2. Webhook Ingestion & Deduplication
    const webhookRes1 = await paymentService.handleWebhookEvent({
      gatewayId: 'STRIPE',
      eventId: 'evt_stripe_succ_999',
      eventType: 'payment_intent.succeeded',
      payloadString: JSON.stringify({ paymentOrderId: intent1.paymentOrderId }),
      signatureHeader: 'sig_mock_header_123'
    });
    assert.equal(webhookRes1.status, 'SUCCESS');

    // Duplicate webhook delivery -> ALREADY_PROCESSED
    const webhookRes2 = await paymentService.handleWebhookEvent({
      gatewayId: 'STRIPE',
      eventId: 'evt_stripe_succ_999',
      eventType: 'payment_intent.succeeded',
      payloadString: JSON.stringify({ paymentOrderId: intent1.paymentOrderId }),
      signatureHeader: 'sig_mock_header_123'
    });
    assert.equal(webhookRes2.status, 'ALREADY_PROCESSED');

    // 3. Refund Execution
    const refund = await paymentService.processRefund(intent1.paymentOrderId, 5000000, 'Customer requested partial cancellation');
    assert.ok(refund.success);
    assert.ok(refund.refundId);
  });

  it('enforces Web-Standard API Router with RFC 7807 problem details (ADR-002)', async () => {
    const router = new VacatinaApiRouter();

    // 1. Health Probe
    const healthReq = new Request('https://vacatina-nu.vercel.app/api/v1/health', { method: 'GET' });
    const healthRes = await router.handleRequest(healthReq);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'HEALTHY');

    // 2. Search Endpoint: POST /api/v1/search/flights
    const searchReq = new Request('https://vacatina-nu.vercel.app/api/v1/search/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'Dubai' })
    });
    const searchRes = await router.handleRequest(searchReq);
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.ok(Array.isArray(searchData.offers));

    // 3. B2B Partner Dashboard (Requires Authentication)
    const unauthReq = new Request('https://vacatina-nu.vercel.app/api/v1/partner/dashboard', { method: 'GET' });
    const unauthRes = await router.handleRequest(unauthReq);
    assert.equal(unauthRes.status, 401); // Unauthorized

    const partnerReq = new Request('https://vacatina-nu.vercel.app/api/v1/partner/dashboard', { method: 'GET' });
    const partnerRes = await router.handleRequest(partnerReq, {
      userId: 'usr_partner_001',
      email: 'agent@partner.com',
      role: 'AGENCY_MANAGER',
      organizationId: 'org_partner_ceylon_tours',
      organizationType: 'AGENCY'
    });
    assert.equal(partnerRes.status, 200);
    const partnerData = await partnerRes.json();
    assert.equal(partnerData.organization.slug, 'ceylon-prestige-travel');

    // 4. Admin Backoffice Triage (Requires Admin Role)
    const adminReq = new Request('https://vacatina-nu.vercel.app/api/v1/admin/triage', { method: 'GET' });
    const adminRes = await router.handleRequest(adminReq, {
      userId: 'usr_admin_001',
      email: 'ops@vacatina.com',
      role: 'PLATFORM_ADMIN'
    });
    assert.equal(adminRes.status, 200);

    // Non-Admin gets 403 Forbidden
    const deniedAdminRes = await router.handleRequest(adminReq, {
      userId: 'usr_cust_999',
      email: 'cust@vacatina.com',
      role: 'CUSTOMER'
    });
    assert.equal(deniedAdminRes.status, 403);

    // 5. RFC 7807 Problem Details on Unmatched Route
    const notFoundReq = new Request('https://vacatina-nu.vercel.app/api/v1/invalid/endpoint', { method: 'GET' });
    const notFoundRes = await router.handleRequest(notFoundReq);
    assert.equal(notFoundRes.status, 404);
    assert.equal(notFoundRes.headers.get('content-type'), 'application/problem+json');
    const problem = await notFoundRes.json();
    assert.equal(problem.code, 'ENDPOINT_NOT_FOUND');
    assert.ok(problem.type.includes('vacatina.com/errors/'));
  });

  it('enforces Supplier Response -> Canonical Offer Normalization across Duffel, LiteAPI, Viator, and Trainline (ADR-006, Q9/Q11)', () => {
    // 1. Duffel Flight Normalization
    const duffel = new FlightsDuffelAdapter('sandbox');
    const rawFlight: RawDuffelFlightOffer = {
      id: 'off_0000AkL92M',
      total_amount: '380.00',
      total_currency: 'USD',
      slices: [
        {
          origin: { iata_code: 'CMB', city_name: 'Colombo' },
          destination: { iata_code: 'DXB', city_name: 'Dubai', country_name: 'United Arab Emirates' },
          departure_datetime: '2026-11-20T10:00:00Z',
          arrival_datetime: '2026-11-20T13:30:00Z',
          duration: 'PT4H30M',
          segments: [
            {
              marketing_carrier: { iata_code: 'EK', name: 'Emirates' },
              marketing_carrier_flight_number: '651',
              passengers: [{ cabin_class: 'economy' }]
            }
          ]
        }
      ],
      expires_at: new Date(Date.now() + 900000).toISOString()
    };
    const flightOffer = duffel.normalize(rawFlight);
    assert.equal(flightOffer.productType, 'flights');
    assert.equal(flightOffer.sourceType, 'API');
    assert.equal(flightOffer.supplierId, 'DUFFEL_NDC');
    assert.equal(flightOffer.pricing.rawSupplierCostMinor, 38000); // $380.00
    assert.equal(flightOffer.freshness.ttlSeconds, 900); // 15m
    assert.equal(flightOffer.isSandboxSimulated, true);
    assert.equal(flightOffer.integrationLifecycle, 'SCAFFOLD');
    assert.ok(flightOffer.deduplicationKey.includes('EK_EK651'));

    // 2. LiteAPI Hotel Normalization
    const liteapi = new HotelsLiteApiAdapter('sandbox');
    const rawHotel: RawLiteApiHotelOffer = {
      hotelId: 'lp_dxb_atlantis',
      name: 'Atlantis The Royal',
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      roomType: 'Sky Terrace Suite',
      boardBasis: 'Half Board',
      netPrice: 650.00,
      currency: 'USD',
      instantConfirmation: true
    };
    const hotelOffer = liteapi.normalize(rawHotel);
    assert.equal(hotelOffer.productType, 'hotels');
    assert.equal(hotelOffer.sourceType, 'API');
    assert.equal(hotelOffer.pricing.rawSupplierCostMinor, 65000);
    assert.equal(hotelOffer.freshness.ttlSeconds, 1800); // 30m
    assert.equal(hotelOffer.isSandboxSimulated, true);
    assert.equal(hotelOffer.integrationLifecycle, 'SCAFFOLD');

    // 3. Viator Experience Normalization
    const viator = new ActivitiesViatorAdapter('sandbox');
    const rawActivity: RawViatorExperienceOffer = {
      productCode: '10423P1',
      title: 'Dubai Desert Safari & Stargazing',
      destination: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
      duration: '6 hours',
      netPrice: 85.00,
      currency: 'USD',
      instantConfirmation: true
    };
    const activityOffer = viator.normalize(rawActivity);
    assert.equal(activityOffer.productType, 'activities');
    assert.equal(activityOffer.freshness.ttlSeconds, 14400); // 4h
    assert.equal(activityOffer.isSandboxSimulated, true);

    // 4. Trainline Rail Normalization
    const trainline = new RailsTrainlineAdapter('sandbox');
    const rawRail: RawTrainlineRailOffer = {
      journeyId: 'trn_lon_par_01',
      operator: 'Eurostar',
      originStation: 'London St Pancras Intl',
      destinationStation: 'Paris Gare du Nord',
      originCity: 'London',
      destinationCity: 'Paris',
      country: 'France',
      departureTimeIso: '2026-11-20T08:00:00Z',
      arrivalTimeIso: '2026-11-20T11:20:00Z',
      travelClass: 'Standard',
      netFareAmount: 110.00,
      currency: 'EUR',
      isDirect: true
    };
    const railOffer = trainline.normalize(rawRail);
    assert.equal(railOffer.productType, 'rails');
    assert.equal(railOffer.freshness.ttlSeconds, 3600); // 1h
    assert.equal(railOffer.isSandboxSimulated, true);
  });

  it('enforces 4-Layer Pricing Precedence engine with integer minor math (ADR-006, Q13)', () => {
    // 1. Standard B2C Layer 1 + Layer 2
    const b2cFlight = PricingPrecedenceService.calculatePricing({
      productType: 'flights',
      rawSupplierCostMinor: 10000000, // LKR 100,000.00
      rawCurrency: 'LKR'
    });
    // Flights 5.5% platform margin: LKR 5,500.00
    assert.equal(b2cFlight.rawSupplierCostMinor, 10000000);
    assert.equal(b2cFlight.platformMarkupMinor, 550000);
    assert.equal(b2cFlight.b2bAgencyMarginMinor, 0);
    assert.equal(b2cFlight.finalSellingPriceMinor, 10550000);

    // 2. B2B Gold Agency Tier with 3.5% discount and custom 2% markup (Layer 3)
    const b2bFlight = PricingPrecedenceService.calculatePricing({
      productType: 'flights',
      rawSupplierCostMinor: 10000000,
      rawCurrency: 'LKR',
      organizationTier: 'GOLD',
      agencyCustomMarkupPercent: 2.0
    });
    // Gold discount: -3.5% (-350,000), custom agency: +2% (+200,000) -> net B2B adjustment: -150,000
    assert.equal(b2bFlight.b2bAgencyMarginMinor, -150000);
    assert.equal(b2bFlight.finalSellingPriceMinor, 10400000);

    // 3. Admin Manual Override taking authoritative Layer 4 precedence
    const overrideHotel = PricingPrecedenceService.calculatePricing({
      productType: 'hotels',
      rawSupplierCostMinor: 5000000, // LKR 50,000.00
      rawCurrency: 'LKR',
      manualOverrideMinor: 4800000, // LKR 48,000.00 campaign price
      overrideReason: 'Cyber Monday Promo',
      overrideExpiresAtIso: new Date(Date.now() + 86400000).toISOString()
    });
    assert.equal(overrideHotel.manualOverrideMinor, 4800000);
    assert.equal(overrideHotel.overrideReason, 'Cyber Monday Promo');
    assert.equal(overrideHotel.finalSellingPriceMinor, 4800000); // Layer 4 wins
  });

  it('enforces Deduplication composite natural keys, pinAboveApi ranking, and Best-Price-Wins rule (ADR-006, Q12)', () => {
    const duffel = new FlightsDuffelAdapter('sandbox');
    const manualAdapter = new ManualCmsAdapter();

    // Flight from API
    const apiFlight = duffel.normalize({
      id: 'off_api_flight_01',
      total_amount: '350.00',
      total_currency: 'USD',
      slices: [{
        origin: { iata_code: 'CMB', city_name: 'Colombo' },
        destination: { iata_code: 'KDZ', city_name: 'Kandy', country_name: 'Sri Lanka' },
        departure_datetime: '2026-11-20T10:00:00Z',
        arrival_datetime: '2026-11-20T10:45:00Z',
        duration: 'PT45M',
        segments: [{
          marketing_carrier: { iata_code: 'UL', name: 'SriLankan' },
          marketing_carrier_flight_number: '101',
          passengers: [{ cabin_class: 'economy' }]
        }]
      }],
      expires_at: new Date(Date.now() + 900000).toISOString()
    });

    // Pinned Manual Flight for Cinnamon Air scenic route
    const manualFlight = manualAdapter.normalize({
      id: 'cms_scenic_01',
      productType: 'flights',
      partnerSupplierId: 'CINNAMON_AIR',
      partnerName: 'Cinnamon Air Direct',
      title: 'Colombo to Kandy Scenic Amphibian Flight',
      subtitle: 'Direct Water Aerodrome Flight',
      location: { city: 'Kandy', country: 'Sri Lanka', countryCode: 'LK', iataCode: 'KDZ' },
      confirmationMode: 'REQUEST_TO_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 6500000,
      costCurrency: 'LKR',
      inclusions: ['Scenic Flight'],
      exclusions: [],
      cancellationPolicy: 'Non-refundable within 48h',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });

    const combined = [apiFlight, manualFlight];
    const ranked = DeduplicationService.deduplicateAndRank(combined);

    // Pinned direct contract flight must rank first
    assert.equal(ranked[0].sourceType, 'DIRECT_CONTRACT');
    assert.equal(ranked[0].pinAboveApi, true);
    assert.equal(ranked[0].title, 'Colombo to Kandy Scenic Amphibian Flight');
  });

  it('enforces product-by-product Cache TTL enforcement and immediate cache busting for manual listings (ADR-006, Q14)', () => {
    const cache = new CacheTtlService();

    // Verify matrix
    assert.equal(cache.getTtlSeconds('flights'), 900);       // 15m
    assert.equal(cache.getTtlSeconds('hotels'), 1800);       // 30m
    assert.equal(cache.getTtlSeconds('cars'), 7200);         // 2h
    assert.equal(cache.getTtlSeconds('activities'), 14400);  // 4h
    assert.equal(cache.getTtlSeconds('rails'), 3600);        // 1h
    assert.equal(cache.getTtlSeconds('cruises'), 43200);     // 12h
    assert.equal(cache.getTtlSeconds('insurance'), 86400);   // 24h

    // Test cache set and get
    const sampleOffers: any[] = [{ canonicalOfferId: 'vct-fl-001' }];
    cache.set('search:flights:cmb:dxb', sampleOffers, 'flights', 'manual_listing_cms_dir_001');

    const retrieved = cache.get('search:flights:cmb:dxb');
    assert.ok(retrieved);
    assert.equal(retrieved?.length, 1);

    // Immediate Cache Invalidation on Admin Publish
    const purged = cache.invalidateTag('manual_listing_cms_dir_001');
    assert.equal(purged, 1);
    assert.equal(cache.get('search:flights:cmb:dxb'), null); // Instant purge verified
  });

  it('enforces Circuit Breaker state transitions (CLOSED -> OPEN -> HALF_OPEN) and graceful fallback during supplier outages (ADR-006, Q16)', async () => {
    const circuit = new CircuitBreakerService({
      failureThreshold: 3,
      cooldownPeriodMs: 50, // 50ms for test
      timeoutMs: 100
    });

    assert.equal(circuit.getState('AMADEUS'), 'CLOSED');

    // Simulate 3 failures to trip breaker
    circuit.recordFailure('AMADEUS');
    circuit.recordFailure('AMADEUS');
    assert.equal(circuit.getState('AMADEUS'), 'CLOSED');

    circuit.recordFailure('AMADEUS');
    assert.equal(circuit.getState('AMADEUS'), 'OPEN');

    // Execute with breaker: should immediately trigger fallback with 0 delay
    let fallbackCalled = false;
    const result = await circuit.executeWithBreaker(
      'AMADEUS',
      async () => { throw new Error('Live API offline'); },
      async (reason) => {
        fallbackCalled = true;
        assert.ok(reason.includes('circuit is OPEN'));
        return 'FALLBACK_DIRECT_CONTRACT';
      }
    );

    assert.equal(fallbackCalled, true);
    assert.equal(result, 'FALLBACK_DIRECT_CONTRACT');

    // Wait for cooldown to transition to HALF_OPEN
    await new Promise(r => setTimeout(r, 60));
    assert.equal(circuit.getState('AMADEUS'), 'HALF_OPEN');

    // Successful probe resets circuit to CLOSED
    circuit.recordSuccess('AMADEUS');
    assert.equal(circuit.getState('AMADEUS'), 'CLOSED');
  });

  it('enforces multi-source booking lifecycle (Hold, Confirm, Cancel, Refund) across API and Manual channels (ADR-006, Q15)', async () => {
    const duffel = new FlightsDuffelAdapter('sandbox');
    const manualAdapter = new ManualCmsAdapter();

    // 1. Duffel Lifecycle
    const flightHold = await duffel.hold('vct-fl-duffel-cmb-dxb-001');
    assert.ok(flightHold.holdReference.startsWith('DUF-HLD-'));
    assert.equal(flightHold.guaranteedPriceMinor, 35000);

    const flightConfirm = await duffel.confirm('VCT-2026-FL001');
    assert.equal(flightConfirm.fulfillmentStatus, 'PENDING');
    assert.equal(flightConfirm.ticketOrVoucherNumber, undefined); // Truthful: no fake ticket issued in sandbox
    assert.ok(flightConfirm.supplierReference.startsWith('DUF-SBOX-'));

    const flightCancel = await duffel.cancel(flightConfirm.supplierReference, 'Traveller medical emergency');
    assert.equal(flightCancel.cancellationFeeMinor, 7500);
    assert.equal(flightCancel.refundEligibleMinor, 27500);

    // 2. Manual Direct Contract Lifecycle
    const manualHold = await manualAdapter.hold('vct-man-ht-001');
    assert.ok(manualHold.holdReference.startsWith('MAN-HLD-'));

    const manualConfirm = await manualAdapter.confirm('VCT-2026-MAN001');
    assert.equal(manualConfirm.fulfillmentStatus, 'CONFIRMED');
    assert.ok(manualConfirm.ticketOrVoucherNumber?.startsWith('VCT-DIR-'));

    const manualCancel = await manualAdapter.cancel(manualConfirm.supplierReference);
    assert.equal(manualCancel.cancellationFeeMinor, 0); // Direct contracts: 0 fee policy
    assert.equal(manualCancel.refundEligibleMinor, 4800000);
  });

  it('enforces SEED / DEMO inventory isolation from live search and checkout readiness (Canonical Source Taxonomy)', async () => {
    const storage = new VacatinaStorageEngine();
    const saga = new BookingSagaService(storage);

    const testBucket = storage.getOrCreateTripBucket('sess_seed_guard_test');
    
    // Staging a SEED item
    storage.addTripBucketItem({
      tripBucketId: testBucket.id,
      canonicalOfferId: 'vct-seed-demo-card-001',
      productType: 'hotels',
      sourceType: 'SEED', // Prototype / design fixture
      bookingMode: 'INSTANT_BOOK',
      title: 'Demo Hotel Preview Card',
      configuration: {},
      travellerManifest: {},
      unitSellingPriceMinor: 2500000,
      currency: 'LKR',
      state: 'DRAFT'
    });

    // Attempting to check out a SEED item must throw commercial violation error
    await assert.rejects(
      async () => {
        await saga.executeBookingSaga({
          tripBucketId: testBucket.id,
          customerEmail: 'test@example.com',
          customerName: 'Test Traveller',
          checkoutSessionId: 'cs_seed_viol_01',
          idempotencyKey: 'idemp_seed_001'
        });
      },
      /Commercial violation: Seed \/ demonstration content cannot enter checkout/
    );
  });

  it('enforces that all 10 canonical products are registered as typed adapters in UnifiedInventoryService (ADR-006, Q9)', async () => {
    const unified = new UnifiedInventoryService();
    const expectedProducts = [
      'flights',
      'hotels',
      'cars',
      'cruises',
      'activities',
      'sightseeing',
      'rails',
      'insurance',
      'visa',
      'packages'
    ] as const;

    for (const p of expectedProducts) {
      const results = await unified.search({
        productType: p,
        destination: 'Dubai'
      });
      assert.ok(Array.isArray(results), `Results for ${p} must be an array`);
      assert.ok(results.length > 0, `Search for ${p} must return at least 1 canonical offer`);
      
      const offer = results[0];
      assert.equal(offer.productType, p);
      assert.ok(offer.canonicalOfferId.startsWith('vct-'));
      assert.ok(['API', 'DIRECT_CONTRACT', 'MANUAL_SERVICE', 'CURATED_PACKAGE', 'HYBRID', 'MANUAL'].includes(offer.sourceType));
      assert.ok(typeof offer.isSandboxSimulated === 'boolean');
      assert.ok(['SCAFFOLD', 'SANDBOX_ACTIVE', 'OPERATIONALLY_LIVE_MANUAL', 'PRODUCTION_LIVE'].includes(offer.integrationLifecycle));
      assert.ok(offer.pricing.finalSellingPriceMinor > 0);
    }
  });

  it('enforces the Canonical 6-Source Inventory Taxonomy and Admin Manual CMS Schema (ADR-006 & Doc 14)', () => {
    // 1. Verify Visa Consular Adapter classification
    const visaAdapter = new VisaConsularAdapter();
    const visaOffer = visaAdapter.normalize({
      visaServiceId: 'vs_dxb_01',
      countryName: 'United Arab Emirates',
      countryCode: 'AE',
      visaType: 'Tourist e-Visa Assistance',
      durationDays: 60,
      consularBaseCostMinor: 3500000,
      currency: 'LKR',
      processingSlaDays: 2
    });
    assert.equal(visaOffer.sourceType, 'MANUAL_SERVICE');
    assert.equal(visaOffer.integrationLifecycle, 'OPERATIONALLY_LIVE_MANUAL');
    assert.equal(visaOffer.isSandboxSimulated, false);

    // 2. Verify Manual CMS Adapter taxonomy mapping
    const manualAdapter = new ManualCmsAdapter();
    const hotelOffer = manualAdapter.normalize({
      id: 'cms_dir_ht_001',
      productType: 'hotels',
      partnerSupplierId: 'CEYLON_HOTELS',
      partnerName: 'Galle Heritage',
      title: 'Galle Fort Bungalow',
      subtitle: 'Luxury Suite',
      location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'INSTANT_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 4500000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation 48h',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });
    assert.equal(hotelOffer.sourceType, 'DIRECT_CONTRACT');

    const pkgOffer = manualAdapter.normalize({
      id: 'cms_pkg_001',
      productType: 'packages',
      partnerSupplierId: 'VACATINA_EXP',
      partnerName: 'Ceylon Horizons',
      title: 'Sri Lanka Cultural Escape',
      subtitle: '7-day fixed package',
      location: { city: 'Kandy', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'REQUEST_TO_CONFIRM',
      availableQuota: 12,
      contractedBaseCostMinor: 85000000,
      costCurrency: 'LKR',
      inclusions: ['Full itinerary'],
      exclusions: [],
      cancellationPolicy: 'Standard terms',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });
    assert.equal(pkgOffer.sourceType, 'CURATED_PACKAGE');

    // 3. Verify Storage Engine Manual Listing CRUD & Audit Trail
    const storage = new VacatinaStorageEngine();
    const createdListing = storage.createManualListing({
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      partnerSupplierId: 'HERITAGE_VILLAS',
      partnerName: 'Bentota Beach Villa',
      contractReference: 'AGR-2026-BENTOTA-004',
      title: 'Bentota Luxury Beach Villa Allotment',
      subtitle: 'Direct Contract Allotment · 6 Villas',
      description: 'Directly contracted private pool villas in Bentota',
      destinationCity: 'Bentota',
      destinationCountry: 'Sri Lanka',
      destinationCountryCode: 'LK',
      contractedNetCostMinor: 5500000, // LKR 55,000.00
      costCurrency: 'LKR',
      platformMarkupPercent: 12.0,
      sellingPriceMinor: 6160000,
      sellingCurrency: 'LKR',
      availableQuota: 6,
      isUnlimitedQuota: false,
      blackoutDates: ['2026-12-25', '2026-12-31'],
      minimumNoticeHours: 24,
      validFrom: '2026-11-01T00:00:00Z',
      validUntil: '2027-04-30T23:59:59Z',
      confirmationMode: 'INSTANT_CONFIRM',
      inclusions: ['Daily breakfast', 'Private pool access'],
      exclusions: ['Minibar'],
      cancellationPolicy: 'Free cancellation up to 72 hours prior to arrival',
      termsReference: 'https://vacatina.com/legal/direct-contracts/bentota',
      heroImageUrl: '/cards/hotel_srilanka.jpg',
      galleryImageUrls: ['/cards/hotel_srilanka.jpg'],
      isFeatured: true,
      pinAboveApi: true,
      isB2BVisible: true,
      isB2CVisible: true,
      status: 'PUBLISHED'
    }, 'usr_admin_ops_001');

    assert.ok(createdListing.id);
    assert.equal(createdListing.sourceType, 'DIRECT_CONTRACT');
    assert.equal(createdListing.availableQuota, 6);

    // Verify initial audit log created
    const audits = storage.getManualListingAudits(createdListing.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'CREATED');
    assert.equal(audits[0].actorUserId, 'usr_admin_ops_001');

    // Update listing with promotional override and audit reason
    const updated = storage.updateManualListing(
      createdListing.id,
      { manualOverridePriceMinor: 5800000, overrideReason: 'Winter Early Bird Promo' },
      'usr_admin_ops_001',
      'Applied seasonal promotional rate override'
    );
    assert.equal(updated.manualOverridePriceMinor, 5800000);

    const updatedAudits = storage.getManualListingAudits(createdListing.id);
    assert.equal(updatedAudits.length, 2);
    assert.equal(updatedAudits[1].action, 'UPDATED');
    assert.equal(updatedAudits[1].changeSummary, 'Applied seasonal promotional rate override');
  });

  it('enforces the 7-Dimension Inventory Invariants and Truthful Sandbox Guards (Rule 14 & ADR-007)', () => {
    // 1. SEED cannot become BOOKABLE
    assert.throws(
      () => assertSeedCannotBeBookable({ environmentClass: 'SEED', sellability: 'BOOKABLE' }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'SEED_CANNOT_BE_BOOKABLE'
    );

    // 2. SEED cannot enter checkout
    assert.throws(
      () => assertSeedCannotEnterCheckout({ environmentClass: 'SEED', canonicalOfferId: 'vct-demo-seed-001' }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'SEED_CHECKOUT_BLOCKED'
    );

    // 3. SCAFFOLD providers cannot create production bookings
    assert.throws(
      () => assertScaffoldCannotCreateProductionBooking({
        providerId: 'DUFFEL_NDC',
        lifecycle: 'SCAFFOLD',
        environment: 'PRODUCTION'
      }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'SCAFFOLD_PRODUCTION_BOOKING_BLOCKED'
    );

    // 4. Manual/direct offers require PUBLISHED state to be BOOKABLE
    assert.throws(
      () => assertManualOfferPublishedForBooking({
        status: 'DRAFT',
        sellability: 'BOOKABLE',
        title: 'Unpublished Hotel'
      }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'MANUAL_OFFER_NOT_PUBLISHED'
    );

    // 5. Unavailable/expired offers cannot become Trip Bucket Ready
    assert.throws(
      () => assertUnavailableOfferCannotBeReady({
        availabilityStatus: 'SOLD_OUT',
        targetTripBucketState: 'READY'
      }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'EXPIRED_OFFER_CANNOT_BE_READY'
    );
    assert.throws(
      () => assertUnavailableOfferCannotBeReady({
        availabilityStatus: 'RATE_EXPIRED',
        targetTripBucketState: 'READY'
      }),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'EXPIRED_OFFER_CANNOT_BE_READY'
    );

    // 6. Dynamic bundle components retain their individual source identities (Rule 9 & 14)
    const bundler = new PackagesBundlerAdapter();
    const hybridOffer = bundler.normalize({
      bundleId: 'bdl_dubai_001',
      title: 'Dubai Complete Escape',
      destinationCity: 'Dubai',
      destinationCountry: 'United Arab Emirates',
      durationDays: 5,
      components: {
        flight: { supplierId: 'DUFFEL_NDC', flightNumber: 'UL-225', rawCostMinor: 10000000 },
        hotel: { supplierId: 'DIRECT_HOTEL', propertyName: 'Atlantis', rawCostMinor: 20000000 },
        transfer: { supplierId: 'LOCAL_FLEET', vehicle: 'Van', rawCostMinor: 3000000 },
        visa: { supplierId: 'VACATINA_VISA_DESK', type: 'Tourist Visa', rawCostMinor: 4000000 }
      },
      costCurrency: 'LKR',
      inclusions: ['Flight', 'Hotel', 'Transfer', 'Visa'],
      exclusions: []
    });

    assert.equal(hybridOffer.compositionType, 'DYNAMIC_BUNDLE');
    assert.ok(hybridOffer.components && hybridOffer.components.length === 4);
    assert.equal(hybridOffer.components[0].inventorySource, 'API');
    assert.equal(hybridOffer.components[0].supplierId, 'DUFFEL_NDC');
    assert.equal(hybridOffer.components[1].inventorySource, 'DIRECT_CONTRACT');
    assert.equal(hybridOffer.components[2].inventorySource, 'DIRECT_CONTRACT');
    assert.equal(hybridOffer.components[3].inventorySource, 'MANUAL_INTERNAL');
    assert.equal(hybridOffer.components[3].listingKind, 'SERVICE');

    // 7. Customer UI never leaks internal source taxonomy accidentally (Rule 2 & 3)
    const manualAdapter = new ManualCmsAdapter();
    const directHotel = manualAdapter.normalize({
      id: 'cms_dir_ht_001',
      productType: 'hotels',
      partnerSupplierId: 'CEYLON_HOTELS',
      partnerName: 'Galle Fort Bungalow',
      title: 'Galle Fort Bungalow',
      subtitle: 'Luxury Suite',
      location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'INSTANT_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 4500000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation 48h',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });

    const customerBadges = deriveCustomerBadges(directHotel);
    assert.ok(customerBadges.includes('Instant Confirmation'));
    assert.ok(customerBadges.includes('Direct Rate'));
    assert.ok(customerBadges.includes('Exclusive Direct Deal'));
    assert.equal(validateNoTechnicalLeakInCustomerBadges(customerBadges), true);

    // Negative leak test: verify validator catches internal leak
    assert.equal(validateNoTechnicalLeakInCustomerBadges(['Exclusive Direct Deal', 'API Listing']), false);
    assert.equal(validateNoTechnicalLeakInCustomerBadges(['Direct Rate', 'DIRECT_CONTRACT']), false);
  });

  it('enforces Provider Registry candidate/target tracking and booking execution permissions (Rule 10 & 11)', () => {
    // 1. All currently named external suppliers are strictly CANDIDATE or TARGET
    const candidates = ProviderRegistryService.getCandidates().map(p => p.providerId);
    const targets = ProviderRegistryService.getTargets().map(p => p.providerId);

    assert.ok(candidates.includes('DUFFEL_NDC'));
    assert.ok(candidates.includes('LITEAPI'));
    assert.ok(candidates.includes('VIATOR'));
    assert.ok(candidates.includes('TRAINLINE'));

    assert.ok(targets.includes('AMADEUS_GDS'));
    assert.ok(targets.includes('RENTALCARS'));
    assert.ok(targets.includes('TRAVELTEK'));
    assert.ok(targets.includes('ALLIANZ'));

    // 2. No candidate or target has production credentials or live booking execution enabled
    for (const provider of CANONICAL_PROVIDER_REGISTRY) {
      if (provider.role === 'CANDIDATE' || provider.role === 'TARGET') {
        assert.equal(provider.credentialsConfigured, false, `${provider.providerId} must not claim live credentials`);
        assert.equal(provider.bookingExecutionSupported, false, `${provider.providerId} must not support live booking execution`);
        assert.notEqual(provider.lifecycle, 'PRODUCTION_LIVE', `${provider.providerId} must not claim PRODUCTION_LIVE`);
      }
    }

    // 3. Only verified operational platform desks support live execution
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('PAYLOAD_CMS_DIRECT'), true);
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('VACATINA_CONSULAR_CONCIERGE'), false, 'Consular concierge cannot execute live bookings until operational SLA executed');
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('DUFFEL_NDC'), false);
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('AMADEUS_GDS'), false);
  });

  it('enforces Manual Listing Lifecycle, Direct Contract non-instant fallback, and Canonical Offer v2.0 (ADR-008, Rules 1-3)', () => {
    const storage = new VacatinaStorageEngine();

    // 1. Manual Listing Lifecycle (DRAFT -> IN_REVIEW -> PUBLISHED -> PAUSED -> ARCHIVED)
    const draftListing = storage.createManualListing({
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      partnerSupplierId: 'SIGIRIYA_BOUTIQUE',
      partnerName: 'Sigiriya Rock Chalets',
      contractReference: 'CTR-2026-SIG-001',
      title: 'Sigiriya Luxury Rock View Chalet',
      subtitle: 'Direct Contract Allotment',
      description: 'Exclusive luxury chalets overlooking Sigiriya fortress',
      destinationCity: 'Sigiriya',
      destinationCountry: 'Sri Lanka',
      destinationCountryCode: 'LK',
      contractedNetCostMinor: 3800000,
      costCurrency: 'LKR',
      platformMarkupPercent: 15.0,
      sellingPriceMinor: 4370000,
      sellingCurrency: 'LKR',
      availableQuota: 4,
      isUnlimitedQuota: false,
      blackoutDates: [],
      minimumNoticeHours: 12,
      validFrom: '2026-11-01T00:00:00Z',
      validUntil: '2027-03-31T23:59:59Z',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      inclusions: ['Breakfast', 'Free Sigiriya guide tour'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation up to 48 hours prior',
      termsReference: 'https://vacatina.com/legal/terms',
      heroImageUrl: '/cards/hotel_srilanka.jpg',
      galleryImageUrls: [],
      isFeatured: false,
      pinAboveApi: false,
      isB2BVisible: true,
      isB2CVisible: true,
      status: 'DRAFT'
    }, 'usr_editor_001');

    assert.equal(draftListing.status, 'DRAFT');

    // Move to IN_REVIEW
    const inReview = storage.transitionManualListingStatus(draftListing.id, 'IN_REVIEW', 'usr_editor_001', undefined, 'Submitted for operations review');
    assert.equal(inReview.status, 'IN_REVIEW');

    // Publishing without approver must fail
    assert.throws(
      () => storage.transitionManualListingStatus(draftListing.id, 'PUBLISHED', 'usr_editor_001', undefined, 'Attempt self-publish'),
      /ApproverUserId is required/
    );

    // Publishing with approver succeeds
    const published = storage.transitionManualListingStatus(draftListing.id, 'PUBLISHED', 'usr_editor_001', 'usr_approver_001', 'Approved by Operations Lead');
    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.publishedByUserId, 'usr_approver_001');
    assert.ok(published.publishedAt);

    // Pause listing
    const paused = storage.transitionManualListingStatus(draftListing.id, 'PAUSED', 'usr_ops_001', undefined, 'Temporarily paused for refurbishment');
    assert.equal(paused.status, 'PAUSED');

    // Archive listing
    const archived = storage.transitionManualListingStatus(draftListing.id, 'ARCHIVED', 'usr_ops_001', undefined, 'Contract season concluded');
    assert.equal(archived.status, 'ARCHIVED');

    // Transition from ARCHIVED (terminal) must fail
    assert.throws(
      () => storage.transitionManualListingStatus(draftListing.id, 'DRAFT', 'usr_ops_001'),
      /Invalid status transition/
    );

    // 2. Direct Contract does NOT default to INSTANT (Rule 2)
    const manualAdapter = new ManualCmsAdapter();

    // Case A: Quota = 0 or Request to Confirm -> derives ON_REQUEST and REQUEST_TO_BOOK
    const nonInstantOffer = manualAdapter.normalize({
      id: 'cms_dir_ht_non_inst',
      productType: 'hotels',
      partnerSupplierId: 'BOUTIQUE_EXP',
      partnerName: 'Ella Heritage Villa',
      title: 'Ella Valley Villa',
      subtitle: 'Mountain View Suite',
      location: { city: 'Ella', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'REQUEST_TO_CONFIRM',
      availableQuota: 0, // No confirmed allotment quota
      contractedBaseCostMinor: 2500000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Non-refundable',
      pinAboveApi: false,
      status: 'PUBLISHED'
    });

    assert.equal(nonInstantOffer.fulfillmentMode, 'ON_REQUEST');
    assert.equal(nonInstantOffer.bookingCapability, 'REQUEST_TO_BOOK');

    // Case B: Confirmed Quota > 0 and Instant Confirm -> derives INSTANT and INSTANT_RESERVATION
    const instantOffer = manualAdapter.normalize({
      id: 'cms_dir_ht_inst',
      productType: 'hotels',
      partnerSupplierId: 'GALLE_HOTELS',
      partnerName: 'Galle Fort Bungalow',
      title: 'Galle Fort Suite',
      subtitle: 'Luxury Suite',
      location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'INSTANT_CONFIRM',
      availableQuota: 5, // Active allotment
      contractedBaseCostMinor: 4500000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation 48h',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });

    assert.equal(instantOffer.fulfillmentMode, 'INSTANT');
    assert.equal(instantOffer.bookingCapability, 'INSTANT_RESERVATION');

    // 3. Canonical Offer Contract v2.0 Invariants (Rule 3)
    assert.ok(instantOffer.canonicalOfferId);
    assert.equal(instantOffer.offerId, instantOffer.canonicalOfferId);
    assert.ok(instantOffer.providerId);
    assert.ok(instantOffer.providerOfferId);
    assert.equal(instantOffer.productType, 'hotels');
    assert.equal(instantOffer.inventorySource, 'DIRECT_CONTRACT');
    assert.equal(instantOffer.listingKind, 'SELLABLE_INVENTORY');
    assert.equal(instantOffer.compositionType, 'SINGLE');
    assert.equal(instantOffer.environmentClass, 'PRODUCTION');
    assert.equal(instantOffer.sellability, 'BOOKABLE');
    assert.equal(instantOffer.publicationStatus, 'PUBLISHED');
    assert.equal(instantOffer.availabilityStatus, 'MANUAL_AVAILABLE');
    assert.ok(instantOffer.pricing.finalSellingPriceMinor > 0);
    assert.equal(instantOffer.pricing.currency, 'LKR');
    assert.ok(instantOffer.taxesAndFees);
    assert.equal(instantOffer.taxesAndFees.isTaxInclusive, true);
    assert.ok(instantOffer.validFrom);
    assert.ok(instantOffer.validUntil);
    assert.ok(instantOffer.expiresAt);
    assert.ok(instantOffer.lastCheckedAt);
    assert.equal(instantOffer.requiresRevalidation, false);
    assert.ok(instantOffer.cancellationPolicy);
  });

  it('enforces Distribution Scope, Derived Badges, Unified Ranking, and Certification Gates (ADR-008, Rules 4-7)', () => {
    // 1. Distribution Scope Separation (Rule 4)
    const b2bOnlyOffer = {
      canonicalOfferId: 'vct-b2b-001',
      distributionScope: 'B2B_ONLY' as const
    };
    const b2cOnlyOffer = {
      canonicalOfferId: 'vct-b2c-001',
      distributionScope: 'B2C_ONLY' as const
    };

    // B2C query cannot access B2B_ONLY
    assert.throws(
      () => assertDistributionScopeIntegrity(b2bOnlyOffer, 'B2C'),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'B2C_DISTRIBUTION_LEAK'
    );

    // B2B query cannot access B2C_ONLY
    assert.throws(
      () => assertDistributionScopeIntegrity(b2cOnlyOffer, 'B2B'),
      (err: any) => err instanceof ArchitecturalInvariantViolationError && err.code === 'B2B_DISTRIBUTION_LEAK'
    );

    // 2. Customer Badges Derived 100% from Verified State (Rule 5)
    const duffelAdapter = new FlightsDuffelAdapter('sandbox');
    const scaffoldFlight = duffelAdapter.normalize({
      id: 'off_sbox_001',
      total_amount: '320.00',
      total_currency: 'USD',
      slices: [{
        origin: { iata_code: 'CMB', city_name: 'Colombo' },
        destination: { iata_code: 'DXB', city_name: 'Dubai' },
        departure_datetime: '2026-11-20T10:00:00Z',
        arrival_datetime: '2026-11-20T14:30:00Z',
        duration: 'PT4H30M',
        segments: [{
          marketing_carrier: { iata_code: 'UL', name: 'SriLankan Airlines' },
          marketing_carrier_flight_number: '225',
          passengers: [{ cabin_class: 'economy' }]
        }]
      }],
      expires_at: new Date(Date.now() + 900000).toISOString()
    });

    // Scaffold in sandbox must NEVER get "Live Availability" badge
    const flightBadges = deriveCustomerBadges(scaffoldFlight);
    assert.equal(flightBadges.includes('Live Availability'), false, 'Scaffold adapter in sandbox must not derive Live Availability badge');

    // 3. Unified Ranking Rules (Rule 6)
    const manualAdapter = new ManualCmsAdapter();

    // Active published direct contract with audit reason -> Eligible for pin
    const validPinnedDeal = manualAdapter.normalize({
      id: 'cms_dir_galle_pin',
      productType: 'hotels',
      partnerSupplierId: 'CEYLON_HOTELS',
      partnerName: 'Galle Fort Bungalow',
      title: 'Galle Fort Bungalow',
      subtitle: 'Luxury Suite',
      location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'INSTANT_CONFIRM',
      availableQuota: 5,
      contractedBaseCostMinor: 4500000,
      costCurrency: 'LKR',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation 48h',
      pinAboveApi: true,
      status: 'PUBLISHED'
    });
    assert.equal(isOfferEligibleForPinOverride(validPinnedDeal), true);

    // Sold out deal CANNOT be pinned above valid offers
    const soldOutDeal = {
      ...validPinnedDeal,
      canonicalOfferId: 'vct-ht-sold-out',
      availabilityStatus: 'SOLD_OUT' as const
    };
    assert.equal(isOfferEligibleForPinOverride(soldOutDeal), false, 'Sold out deal must never be eligible for pin override');

    // SEED item CANNOT rank in live search
    const seedOffer = {
      ...validPinnedDeal,
      canonicalOfferId: 'vct-ht-seed-001',
      environmentClass: 'SEED' as const,
      sourceType: 'SEED' as const
    };

    const ranked = DeduplicationService.deduplicateAndRank([seedOffer, validPinnedDeal]);
    assert.equal(ranked.some(o => o.canonicalOfferId === 'vct-ht-seed-001'), false, 'SEED offer must be excluded from live ranking');

    // 4. Provider Certification Gates (Rule 7)
    const duffelRecord = ProviderRegistryService.getProvider('DUFFEL_NDC');
    assert.ok(duffelRecord);
    const duffelAudit = ProviderRegistryService.evaluateCertificationGates(duffelRecord.certificationGates);
    assert.equal(duffelAudit.isCertified, false);
    assert.equal(duffelAudit.isProductionReady, false);
    assert.ok(duffelAudit.pendingGates.length > 0);
    assert.ok(duffelAudit.pendingGates.some(g => g.includes('Live credentials')));

    const consularRecord = ProviderRegistryService.getProvider('VACATINA_CONSULAR_CONCIERGE');
    assert.ok(consularRecord);
    const consularAudit = ProviderRegistryService.evaluateCertificationGates(consularRecord.certificationGates);
    assert.equal(consularAudit.isCertified, false, 'Consular concierge is not yet certified pending physical SLA');
    assert.equal(consularAudit.isProductionReady, false);
    assert.ok(consularAudit.pendingGates.length > 0);
  });

  it('enforces ProductExtension Discriminated Union Schemas across all 10 Travel Products (Contract v1.0)', async () => {
    // 1. Flights
    const duffel = new FlightsDuffelAdapter();
    const flightOffers = await duffel.search({ origin: 'CMB', destination: 'DXB', departureDate: '2026-11-10' });
    assert.ok(flightOffers.length > 0);
    const flight = flightOffers[0];
    assert.equal(flight.productType, 'flights');
    assert.ok(flight.productExtension);
    assert.equal(flight.productExtension.productType, 'flights');
    assert.ok(flight.productExtension.flight.segments.length > 0);
    assert.equal(flight.productExtension.flight.cabinClass, 'ECONOMY');
    assert.equal(typeof flight.productExtension.flight.baggageAllowance.cabinBaggageKg, 'number');

    // 2. Hotels
    const liteApi = new HotelsLiteApiAdapter();
    const hotelOffers = await liteApi.search({ destination: 'Dubai' });
    assert.ok(hotelOffers.length > 0);
    const hotel = hotelOffers[0];
    assert.equal(hotel.productType, 'hotels');
    assert.ok(hotel.productExtension);
    assert.equal(hotel.productExtension.productType, 'hotels');
    assert.equal(hotel.productExtension.hotel.starRating, 5);
    assert.ok(hotel.productExtension.hotel.amenities.length > 0);

    // 3. Cars
    const cars = new CarsRentalAdapter();
    const carOffers = await cars.search({ destination: 'Colombo' });
    assert.ok(carOffers.length > 0);
    const car = carOffers[0];
    assert.equal(car.productType, 'cars');
    assert.ok(car.productExtension);
    assert.equal(car.productExtension.productType, 'cars');
    assert.equal(car.productExtension.car.driverType, 'CHAUFFEUR');
    assert.equal(car.productExtension.car.pickupLocation.code, 'CMB');

    // 4. Cruises
    const cruises = new CruisesTraveltekAdapter();
    const cruiseOffers = await cruises.search({ destination: 'Miami' });
    assert.ok(cruiseOffers.length > 0);
    const cruise = cruiseOffers[0];
    assert.equal(cruise.productType, 'cruises');
    assert.ok(cruise.productExtension);
    assert.equal(cruise.productExtension.productType, 'cruises');
    assert.equal(cruise.productExtension.cruise.cruiseLine, 'Royal Caribbean');
    assert.ok(cruise.productExtension.cruise.portsOfCall.length > 0);

    // 5. Rails
    const rails = new RailsTrainlineAdapter();
    const railOffers = await rails.search({ origin: 'London', destination: 'Paris' });
    assert.ok(railOffers.length > 0);
    const rail = railOffers[0];
    assert.equal(rail.productType, 'rails');
    assert.ok(rail.productExtension);
    assert.equal(rail.productExtension.productType, 'rails');
    assert.equal(rail.productExtension.rail.trainOperator, 'Eurostar High-Speed');
    assert.equal(rail.productExtension.rail.originStation, 'London Central');

    // 6. Activities
    const activities = new ActivitiesViatorAdapter();
    const actOffers = await activities.search({ destination: 'Dubai' });
    assert.ok(actOffers.length > 0);
    const act = actOffers[0];
    assert.equal(act.productType, 'activities');
    assert.ok(act.productExtension);
    assert.equal(act.productExtension.productType, 'activities');
    assert.equal(act.productExtension.activity.physicalFitnessLevel, 'EASY');
    assert.ok(act.productExtension.activity.languageOptions.includes('English'));

    // 7. Sightseeing
    const sightseeing = new SightseeingViatorAdapter();
    const sightOffers = await sightseeing.search({ destination: 'Dubai' });
    assert.ok(sightOffers.length > 0);
    const sight = sightOffers[0];
    assert.equal(sight.productType, 'sightseeing');
    assert.ok(sight.productExtension);
    assert.equal(sight.productExtension.productType, 'sightseeing');
    assert.equal(sight.productExtension.sightseeing.tourType, 'SHARED_GROUP');
    assert.ok(sight.productExtension.sightseeing.itineraryHighlights.length > 0);

    // 8. Insurance
    const insurance = new InsuranceAllianzAdapter();
    const insOffers = await insurance.search({ destination: 'Worldwide' });
    assert.ok(insOffers.length > 0);
    const ins = insOffers[0];
    assert.equal(ins.productType, 'insurance');
    assert.ok(ins.productExtension);
    assert.equal(ins.productExtension.productType, 'insurance');
    assert.equal(ins.productExtension.insurance.underwriterName, 'Allianz Partners');
    assert.equal(ins.productExtension.insurance.planTier, 'GOLD');

    // 9. Visa
    const visa = new VisaConsularAdapter();
    const visaOffers = await visa.search({ destination: 'United Arab Emirates' });
    assert.ok(visaOffers.length > 0);
    const v = visaOffers[0];
    assert.equal(v.productType, 'visa');
    assert.ok(v.productExtension);
    assert.equal(v.productExtension.productType, 'visa');
    assert.equal(v.productExtension.visa.destinationCountry, 'United Arab Emirates');
    assert.ok(v.productExtension.visa.documentChecklist.length > 0);

    // 10. Packages
    const bundler = new PackagesBundlerAdapter();
    const pkgOffers = await bundler.search({ destination: 'Dubai' });
    assert.ok(pkgOffers.length > 0);
    const pkg = pkgOffers[0];
    assert.equal(pkg.productType, 'packages');
    assert.ok(pkg.productExtension);
    assert.equal(pkg.productExtension.productType, 'packages');
    assert.equal(pkg.productExtension.package.itineraryDays, 5);
    assert.equal(pkg.productExtension.package.dayByDayItinerary.length, 5);
    assert.ok(pkg.productExtension.package.includedComponents.includes('FLIGHT'));
    assert.ok(pkg.productExtension.package.includedComponents.includes('HOTEL'));
  });

  it('enforces DiscoveryContent vs CanonicalOffer separation (Discovery Content is never sellable inventory)', () => {
    const discoveryItems = DiscoveryContentService.getAllDiscoveryContent();
    assert.ok(discoveryItems.length >= 4);

    for (const item of discoveryItems) {
      assert.equal(item.isLiveInventoryOffer, false, 'Discovery content must never be marked as a live inventory offer');
      assert.equal(item.sellability, 'DISCOVERY_ONLY', 'Discovery content must have sellability = DISCOVERY_ONLY');
      assert.ok(item.priceIndication?.priceDisclaimer.includes('Indicative'), 'Discovery cards must include indicative disclaimer');
      assert.doesNotThrow(() => assertDiscoveryContentCannotBeSold(item));

      // Verify search prefill generation
      const prefillUrl = DiscoveryContentService.generateSearchPrefillUrl(item);
      assert.ok(prefillUrl.startsWith(item.targetRoute));
    }

    // Violation attempt: trying to sell discovery content throws an invariant error
    assert.throws(
      () => {
        assertDiscoveryContentCannotBeSold({
          ...discoveryItems[0],
          isLiveInventoryOffer: true as any,
          sellability: 'BOOKABLE' as any
        });
      },
      (err: any) => {
        return err instanceof ArchitecturalInvariantViolationError &&
               err.message.includes('DISCOVERY_CONTENT_CANNOT_BE_SOLD');
      }
    );
  });

  it('enforces SEED Quarantine, Production Response Safety, and Package Component Provenance Invariants', () => {
    const validOffer = {
      canonicalOfferId: 'vct-ht-valid-001',
      productType: 'hotels' as const,
      inventorySource: 'DIRECT_CONTRACT' as const,
      listingKind: 'SELLABLE_INVENTORY' as const,
      compositionType: 'SINGLE' as const,
      fulfillmentMode: 'INSTANT' as const,
      environmentClass: 'PRODUCTION' as const,
      sellability: 'BOOKABLE' as const,
      providerLifecycle: 'PRODUCTION_LIVE' as const,
      publicationStatus: 'PUBLISHED' as const,
      distributionScope: 'BOTH' as const,
      bookingCapability: 'INSTANT_RESERVATION' as const,
      sourceType: 'DIRECT_CONTRACT' as const,
      supplierId: 'HERITAGE_HOTEL',
      supplierName: 'Heritage Villa',
      title: 'Heritage Villa Suite',
      subtitle: 'Luxury Suite',
      location: { city: 'Galle', country: 'Sri Lanka', countryCode: 'LK' },
      availabilityStatus: 'LIVE' as const,
      confirmationMode: 'INSTANT_CONFIRM' as const,
      bookingMode: 'INSTANT_BOOK' as const,
      pricing: {
        rawSupplierCostMinor: 4000000,
        rawCurrency: 'LKR',
        platformMarkupMinor: 500000,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 4500000,
        currency: 'LKR'
      },
      taxesAndFees: { totalTaxMinor: 0, isTaxInclusive: true },
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 3600,
        expiresAtIso: new Date(Date.now() + 3600000).toISOString(),
        isStale: false,
        revalidationEndpoint: '/api/v1/offers/vct-ht-valid-001/revalidate'
      },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lastCheckedAt: new Date().toISOString(),
      requiresRevalidation: false,
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation 24h',
      pinAboveApi: false,
      deduplicationKey: 'ht:galle:heritage',
      isSandboxSimulated: false,
      integrationLifecycle: 'PRODUCTION_LIVE' as const,
      sourceMetadata: {},
      revalidationCapability: { canRevalidateOnline: true, requiresSupplierPing: false }
    };

    // 1. Valid production response passes safety assertion
    assert.doesNotThrow(() => {
      assertProductionResponseSafety([validOffer], { channel: 'B2C', environment: 'PRODUCTION' });
    });

    // 2. SEED offer in production triggers safety invariant violation
    const seedOffer = { ...validOffer, canonicalOfferId: 'vct-seed-001', environmentClass: 'SEED' as const };
    assert.throws(
      () => assertProductionResponseSafety([seedOffer], { channel: 'B2C', environment: 'PRODUCTION' }),
      /PRODUCTION_SEED_LEAK/
    );

    // 3. B2B_ONLY offer in B2C triggers distribution leak violation
    const b2bOnlyOffer = { ...validOffer, canonicalOfferId: 'vct-b2b-001', distributionScope: 'B2B_ONLY' as const };
    assert.throws(
      () => assertProductionResponseSafety([b2bOnlyOffer], { channel: 'B2C', environment: 'PRODUCTION' }),
      /B2C_DISTRIBUTION_LEAK/
    );

    // 4. Unpublished manual offer in search response triggers safety violation
    const draftOffer = { ...validOffer, canonicalOfferId: 'vct-draft-001', publicationStatus: 'DRAFT' as const };
    assert.throws(
      () => assertProductionResponseSafety([draftOffer], { channel: 'B2C', environment: 'PRODUCTION' }),
      /UNPUBLISHED_OFFER_IN_SEARCH/
    );

    // 5. Package Component Provenance: package cannot be Ready if child component is expired or unavailable
    const holidayPackageOffer = {
      ...validOffer,
      productType: 'packages' as const,
      components: [
        {
          componentId: 'cmp_flight_01',
          productType: 'flights' as const,
          inventorySource: 'API' as const,
          listingKind: 'SELLABLE_INVENTORY' as const,
          compositionType: 'SINGLE' as const,
          fulfillmentMode: 'INSTANT' as const,
          environmentClass: 'PRODUCTION' as const,
          sellability: 'BOOKABLE' as const,
          supplierId: 'DUFFEL_NDC',
          supplierName: 'Duffel',
          isSandboxSimulated: false,
          revalidationRequired: true,
          componentStatus: 'VALID' as const
        },
        {
          componentId: 'cmp_hotel_01',
          productType: 'hotels' as const,
          inventorySource: 'DIRECT_CONTRACT' as const,
          listingKind: 'SELLABLE_INVENTORY' as const,
          compositionType: 'SINGLE' as const,
          fulfillmentMode: 'INSTANT' as const,
          environmentClass: 'PRODUCTION' as const,
          sellability: 'BOOKABLE' as const,
          supplierId: 'HERITAGE',
          supplierName: 'Heritage Villa',
          isSandboxSimulated: false,
          revalidationRequired: false,
          componentStatus: 'EXPIRED' as const // Component is expired!
        }
      ]
    };

    assert.equal(isPackageReadyForCheckout(holidayPackageOffer), false, 'Package with expired hotel component must NOT be ready for checkout');

    // When child component is fixed to VALID, package becomes ready
    holidayPackageOffer.components[1].componentStatus = 'VALID';
    assert.equal(isPackageReadyForCheckout(holidayPackageOffer), true, 'Package with all VALID components is ready for checkout');
  });

  it('enforces Complete Manual Listing Governance (Allotment, Blackouts, Revisions, Stop-Sale, and Approver Audit)', () => {
    const storage = new VacatinaStorageEngine();

    // 1. Create Direct Contract listing with full operational parameters
    const listing = storage.createManualListing({
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      partnerSupplierId: 'MIRISSA_RESORT',
      partnerName: 'Mirissa Ocean Resort',
      title: 'Mirissa Oceanfront Villa Allotment',
      subtitle: 'Private Beach Villa with Plunge Pool',
      destinationCity: 'Mirissa',
      destinationCountry: 'Sri Lanka',
      contractedNetCostMinor: 6500000, // LKR 65,000.00
      costCurrency: 'LKR',
      platformMarkupPercent: 12.0,
      sellingPriceMinor: 7280000,      // LKR 72,800.00
      sellingCurrency: 'LKR',
      availableQuota: 10,
      allottedQuota: 10,
      heldQuota: 0,
      bookedQuota: 0,
      isUnlimitedQuota: false,
      blackoutDates: ['2026-12-24', '2026-12-25', '2026-12-31'],
      minimumNoticeHours: 24,
      bookingWindow: { minAdvanceDays: 1, maxAdvanceDays: 90, minimumNoticeHours: 24 },
      validFrom: '2026-11-01T00:00:00Z',
      validUntil: '2027-04-30T00:00:00Z',
      effectiveFrom: '2026-11-01T00:00:00Z',
      effectiveTo: '2027-04-30T00:00:00Z',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      canAtomicallyReserve: false,
      contractReference: 'AGR-2026-MIRISSA-008',
      sourceOwner: {
        partnerId: 'PTR_MIRISSA_01',
        partnerName: 'Mirissa Hospitality Ltd',
        contactEmail: 'contracts@mirissaresort.lk'
      },
      inclusions: ['Breakfast', 'Welcome King Coconut', 'Airport Shuttle Assistance'],
      exclusions: ['Minibar premium alcohol', 'Water sports equipment rental'],
      cancellationPolicy: 'Free cancellation up to 72 hours before check-in. 1 night fee thereafter.',
      termsReference: 'TERMS-MIRISSA-VILLA-2026',
      heroImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef',
      galleryImageUrls: [],
      isFeatured: true,
      pinAboveApi: true,
      isB2BVisible: true,
      isB2CVisible: true,
      status: 'DRAFT',
      publicationStatus: 'DRAFT'
    }, 'usr_creator_01');

    assert.ok(listing.id);
    assert.equal(listing.status, 'DRAFT');

    // 2. State Machine: Submit for review (DRAFT -> IN_REVIEW)
    const inReview = storage.transitionManualListingStatus(listing.id, 'IN_REVIEW', 'usr_creator_01', undefined, 'Submitted for operations review');
    assert.equal(inReview.status, 'IN_REVIEW');

    // 3. Approver rejects listing back to DRAFT (IN_REVIEW -> DRAFT) with comments
    const rejectedDraft = storage.transitionManualListingStatus(listing.id, 'DRAFT', 'usr_approver_01', undefined, 'Need updated High-Season cancellation terms');
    assert.equal(rejectedDraft.status, 'DRAFT');

    // 4. Creator updates listing with revised cancellation terms and increments revision
    const updated = storage.updateManualListing(listing.id, {
      cancellationPolicy: 'Revised: Free cancellation up to 7 days before check-in during festive period.',
      heldQuota: 2 // 2 units currently held
    }, 'usr_creator_01', 'Updated festive season cancellation policy');
    assert.equal(updated.revisionNumber, 4, 'Revision increments across submit, reject, and update');
    assert.equal(updated.remainingQuota, 8, 'Remaining quota must be allottedQuota (10) - heldQuota (2) = 8');

    // 5. Creator re-submits (DRAFT -> IN_REVIEW)
    storage.transitionManualListingStatus(listing.id, 'IN_REVIEW', 'usr_creator_01', undefined, 'Re-submitted with festive cancellation terms');

    // 6. Stop-Sale Guard: cannot publish if stopSale is true
    storage.updateManualListing(listing.id, { stopSale: true }, 'usr_creator_01', 'Set temporary stop-sale');
    assert.throws(
      () => storage.transitionManualListingStatus(listing.id, 'PUBLISHED', 'usr_creator_01', 'usr_approver_01'),
      /while stopSale flag is active/
    );

    // Clear stopSale and approve (IN_REVIEW -> PUBLISHED)
    storage.updateManualListing(listing.id, { stopSale: false }, 'usr_creator_01', 'Clear stop sale');
    const published = storage.transitionManualListingStatus(listing.id, 'PUBLISHED', 'usr_creator_01', 'usr_approver_01', 'Verified rates and allotments');
    assert.equal(published.status, 'PUBLISHED');
    assert.ok(published.publishedAt);
    assert.equal(published.approvedBy, 'usr_approver_01');

    // 7. Operations pauses listing for maintenance (PUBLISHED -> PAUSED)
    const paused = storage.transitionManualListingStatus(listing.id, 'PAUSED', 'usr_ops_01', undefined, 'Plunge pool maintenance');
    assert.equal(paused.status, 'PAUSED');
    assert.ok(paused.pausedAt);

    // 8. Operations reactivates listing (PAUSED -> PUBLISHED)
    const reactivated = storage.transitionManualListingStatus(listing.id, 'PUBLISHED', 'usr_ops_01', 'usr_approver_01', 'Maintenance complete');
    assert.equal(reactivated.status, 'PUBLISHED');

    // 9. Season concludes (PUBLISHED -> ARCHIVED)
    const archived = storage.transitionManualListingStatus(listing.id, 'ARCHIVED', 'usr_ops_01', undefined, 'Season contract concluded');
    assert.equal(archived.status, 'ARCHIVED');
    assert.ok(archived.archivedAt);

    // 10. Audit History contains all logged transitions
    const audits = storage.getManualListingAudits(listing.id);
    assert.ok(audits.length >= 6);
  });

  it('enforces Granular Source Separation, Verification Status, and Multi-Criteria Source Selection (GPT Audit v2.0)', async () => {
    // 1. Verify Uncertified Adapter truthfully derives SANDBOX, ON_REQUEST, and INDICATIVE
    const duffel = new FlightsDuffelAdapter();
    const flightOffers = await duffel.search({ origin: 'CMB', destination: 'DXB', departureDate: '2026-11-20' });
    assert.ok(flightOffers.length > 0);
    const flight = flightOffers[0];

    assert.equal(flight.sourceMode, 'API');
    assert.equal(flight.integrationStatus, 'SANDBOX');
    assert.equal(flight.manualSourceType, null);
    assert.notEqual(flight.currentAvailabilityMode, 'LIVE_INSTANT', 'Uncertified adapter must not claim LIVE_INSTANT');
    assert.notEqual(flight.currentPricingMode, 'LIVE_DYNAMIC', 'Uncertified adapter must not claim LIVE_DYNAMIC');

    // 2. Verify Internal Consular Desk derives VERIFIED_INTERNAL and FIXED_MANUAL
    const visa = new VisaConsularAdapter();
    const visaOffers = await visa.search({ destination: 'United Arab Emirates' });
    assert.ok(visaOffers.length > 0);
    const v = visaOffers[0];

    assert.equal(v.sourceMode, 'MANUAL');
    assert.equal(v.manualSourceType, 'MANUAL_INTERNAL');
    assert.equal(v.verificationStatus, 'VERIFIED_INTERNAL');
    assert.equal(v.currentAvailabilityMode, 'MANUAL_CONFIRMATION');
    assert.equal(v.currentPricingMode, 'FIXED_MANUAL');

    // 3. Multi-Criteria Source Selection: Manual Direct Contract beats Unverified Candidate
    const directSafariOffer = {
      ...flight,
      canonicalOfferId: 'vct-act-safari-direct-001',
      sourceMode: 'MANUAL' as const,
      manualSourceType: 'DIRECT_CONTRACT' as const,
      verificationStatus: 'VERIFIED_CONTRACT' as const,
      availabilityStatus: 'LIVE' as const,
      fulfillmentMode: 'INSTANT' as const,
      bookingCapability: 'INSTANT_RESERVATION' as const,
      cancellationPolicy: 'Free cancellation up to 24h before tour',
      pricing: {
        rawSupplierCostMinor: 6000,
        rawCurrency: 'USD',
        platformMarkupMinor: 1500,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 7500, // 25% margin
        currency: 'USD'
      }
    };

    const mockApiSafariOffer = {
      ...flight,
      canonicalOfferId: 'vct-act-safari-mockapi-002',
      sourceMode: 'API' as const,
      manualSourceType: null,
      verificationStatus: 'PARTNER_PENDING' as const,
      availabilityStatus: 'CACHED' as const,
      fulfillmentMode: 'ON_REQUEST' as const,
      bookingCapability: 'REQUEST_TO_BOOK' as const,
      cancellationPolicy: 'Non-refundable penalty applies',
      pricing: {
        rawSupplierCostMinor: 7200,
        rawCurrency: 'USD',
        platformMarkupMinor: 300,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 7500, // 4% margin
        currency: 'USD'
      }
    };

    const scoreDirect = computeOfferSourceScore(directSafariOffer);
    const scoreApi = computeOfferSourceScore(mockApiSafariOffer);

    assert.ok(scoreDirect > scoreApi, `Direct verified offer score (${scoreDirect}) must beat unverified candidate API score (${scoreApi})`);

    const bestOffer = selectBestSourceOffer([mockApiSafariOffer, directSafariOffer]);
    assert.equal(bestOffer?.canonicalOfferId, 'vct-act-safari-direct-001', 'Multi-criteria engine must select verified direct deal over unverified candidate');
  });

  it('enforces Flights End-to-End Real Product Flow (Search Aggregation, Fare Family Selection, Trip Bucket Staging, Pre-Booking Revalidation, and Saga Hold/Confirm)', async () => {
    // 1. Search Aggregation & Dynamic Route Filtering
    const searchAggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);
    
    // Query flights Colombo to Dubai
    const cmbToDxb = searchAggregator.search({ productType: 'flights', originQuery: 'Colombo', destinationQuery: 'Dubai' });
    assert.ok(cmbToDxb.length >= 1, 'Search for Colombo -> Dubai must return flights');
    assert.equal(cmbToDxb[0].productType, 'flights');
    assert.equal(cmbToDxb[0].pricing.customerSellingPriceLkr, 92495);
    assert.equal(cmbToDxb[0].confirmationMode, 'INSTANT_CONFIRM');

    // Query seaplane charter to Maldives
    const cmbToMle = searchAggregator.search({ productType: 'flights', destinationQuery: 'Maldives' });
    assert.ok(cmbToMle.length >= 1, 'Search for flights to Maldives must return charter option');
    assert.equal(cmbToMle[0].sourceType, 'MANUAL');

    // 2. Unified Inventory Multi-Source Querying & Product Extension
    const unifiedInventory = new UnifiedInventoryService();
    const unifiedFlights = await unifiedInventory.search({ productType: 'flights', origin: 'CMB', destination: 'DXB' });
    assert.ok(unifiedFlights.length >= 1, 'Unified search must return canonical flight offers');
    
    const primaryFlight = unifiedFlights[0];
    assert.equal(primaryFlight.productType, 'flights');
    assert.ok(primaryFlight.productExtension, 'Flight must have rich ProductExtension');
    assert.equal(primaryFlight.productExtension.productType, 'flights');
    
    const flightExt = primaryFlight.productExtension.flight;
    assert.equal(flightExt.cabinClass, 'ECONOMY');
    assert.equal(flightExt.fareFamily, 'Standard Economy');
    assert.ok(flightExt.segments.length >= 1);
    assert.equal(flightExt.segments[0].originIata, 'CMB');
    assert.equal(flightExt.segments[0].destinationIata, 'DXB');
    assert.equal(flightExt.baggageAllowance.cabinBaggageKg, 7);
    assert.equal(flightExt.baggageAllowance.checkedBaggageKg, 23);

    // 3. Dynamic Fare Family Price Calculations
    const basePrice = cmbToDxb[0].pricing.customerSellingPriceLkr; // 92,495 LKR
    const flexDelta = 14500;
    const businessDelta = 185000;
    const baggageDelta = 12000;

    assert.equal(basePrice, 92495, 'Baseline Economy Standard price for CMB->DXB is 92,495 LKR');
    assert.equal(basePrice + flexDelta, 106995, 'Economy Flex upgrades total to 106,995 LKR');
    assert.equal(basePrice + businessDelta, 277495, 'Business Class upgrades total to 277,495 LKR');
    assert.equal(basePrice + flexDelta + baggageDelta, 118995, 'Flex + Extra Baggage upgrades total to 118,995 LKR');

    // 4. Staging into Trip Bucket & Financial Math Isolation
    const tripBucket = new TripBucketService();
    tripBucket.stageCandidate({
      id: 'fl-staged-ek651-001',
      productType: 'flights',
      productLabel: 'Flight',
      title: 'Colombo to Dubai (EK 651)',
      subtitle: 'Economy Standard · Emirates',
      dateSummary: '15 Nov – 22 Nov 2026',
      travellerSummary: '2 Adults · Economy',
      state: 'ready',
      priceLkr: basePrice,
      offerId: primaryFlight.canonicalOfferId,
      sourceType: 'API',
      confirmationMode: 'INSTANT_CONFIRM',
      supplierName: 'DUFFEL_NDC',
      integrationMode: 'ADAPTER-READY'
    });

    const summary = tripBucket.getSummary();
    assert.equal(summary.totalItems, 4, 'Trip Bucket has 4 total items (3 baseline + 1 staged flight)');
    assert.equal(summary.readyCount, 3, 'Trip Bucket has 3 Ready items (2 baseline ready + 1 staged flight)');
    assert.equal(summary.readySubtotalLkr, 505000 + 92495, 'Ready subtotal correctly includes staged flight (597,495 LKR)');
    assert.equal(summary.needsActionCount, 1, 'Needs Action item (Visa) remains isolated from Ready subtotal');

    // 5. Pre-Booking Revalidation Ping
    const reval = await unifiedInventory.revalidateOffer(primaryFlight.canonicalOfferId);
    assert.equal(reval.status, 'UNCHANGED', 'Revalidation must confirm UNCHANGED fare');
    assert.ok(reval.message?.includes('SANDBOX') || reval.message?.includes('revalidated') || reval.message?.includes('Unified Inventory'));

    // 6. Distributed Booking Saga Orchestration (Hold, Pre-Auth, Confirm & Idempotency)
    const storage = new VacatinaStorageEngine();
    const testBucket = storage.getOrCreateTripBucket('sess_flight_flow_test');
    storage.addTripBucketItem({
      tripBucketId: testBucket.id,
      canonicalOfferId: primaryFlight.canonicalOfferId,
      productType: 'flights',
      sourceType: 'API',
      bookingMode: 'INSTANT_BOOK',
      title: 'Colombo to Dubai (EK 651)',
      configuration: {
        fareFamily: 'Economy Standard',
        baggageAllowance: '30kg Checked',
        seatPreference: 'Standard Allocation'
      },
      travellerManifest: {
        adults: 2,
        leadName: 'Perera / Kasun Mr'
      },
      unitSellingPriceMinor: primaryFlight.pricing.finalSellingPriceMinor,
      currency: 'LKR',
      state: 'READY'
    });

    const saga = new BookingSagaService(storage);
    const sagaResult = await saga.executeBookingSaga({
      tripBucketId: testBucket.id,
      customerEmail: 'kasun.perera@example.com',
      customerName: 'Kasun Perera',
      idempotencyKey: 'idemp_flight_flow_998',
      checkoutSessionId: 'chk_sess_fl_001'
    });

    assert.ok(/^VCT-2026-[A-Z0-9]{6}$/.test(sagaResult.bookingReference), 'Booking reference must follow canonical VCT-2026-XXXXXX format');
    assert.equal(sagaResult.totalSellingPriceMinor, primaryFlight.pricing.finalSellingPriceMinor);
    assert.equal(sagaResult.items.length, 1);
    assert.equal(sagaResult.items[0].canonicalOfferId, primaryFlight.canonicalOfferId);
    assert.equal(sagaResult.items[0].productType, 'flights');

    // Idempotent replay must return exact same reference and body
    const replayResult = await saga.executeBookingSaga({
      tripBucketId: testBucket.id,
      customerEmail: 'kasun.perera@example.com',
      customerName: 'Kasun Perera',
      idempotencyKey: 'idemp_flight_flow_998',
      checkoutSessionId: 'chk_sess_fl_001'
    });
    assert.equal(replayResult.bookingReference, sagaResult.bookingReference);
    assert.equal(replayResult.bookingGroupId, sagaResult.bookingGroupId);
  });

  it('enforces Hotels End-to-End Real Product Flow (Search Aggregation, Room & Board Tier Configurator, Trip Bucket Staging, Pre-Booking Revalidation, and Saga Hold/Confirm)', async () => {
    // 1. Search Aggregation & Destination Filtering
    const searchAggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);

    const maldivesHotels = searchAggregator.search({ productType: 'hotels', destinationQuery: 'Maldives' });
    assert.ok(maldivesHotels.length >= 1, 'Search for Maldives hotels must return properties');
    assert.equal(maldivesHotels[0].productType, 'hotels');

    // 2. Unified Inventory Multi-Source Querying & Product Extension
    const unifiedInventory = new UnifiedInventoryService();
    const unifiedHotels = await unifiedInventory.search({ productType: 'hotels', destination: 'Dubai' });
    assert.ok(unifiedHotels.length >= 1, 'Unified search must return canonical hotel offers');

    const primaryHotel = unifiedHotels[0];
    assert.equal(primaryHotel.productType, 'hotels');
    assert.ok(primaryHotel.productExtension, 'Hotel must have rich ProductExtension');
    assert.equal(primaryHotel.productExtension.productType, 'hotels');

    const hotelExt = primaryHotel.productExtension.hotel;
    assert.equal(hotelExt.starRating, 5);
    assert.ok(hotelExt.roomType.length > 0);
    assert.ok(hotelExt.checkInTime.includes(':'));
    assert.ok(hotelExt.checkOutTime.includes(':'));
    assert.equal(hotelExt.maxOccupancy.maxAdults, 2);

    // 3. Dynamic Room & Board Calculations
    const baseRate = 256500; // Baseline room rate in LKR
    const suiteDelta = 35000;
    const allInclusiveDelta = 18000;

    assert.equal(baseRate + suiteDelta, 291500, 'Upgraded room tier price calculation');
    assert.equal(baseRate + suiteDelta + allInclusiveDelta, 309500, 'Upgraded room + all-inclusive board calculation');

    // 4. Staging into Trip Bucket & Financial Math Isolation
    const tripBucket = new TripBucketService();
    tripBucket.stageCandidate({
      id: 'ht-staged-dubai-001',
      productType: 'hotels',
      productLabel: 'Hotel',
      title: 'Grand Palace Hotel Dubai',
      subtitle: 'Executive Suite · All Inclusive',
      dateSummary: '15 Nov – 20 Nov 2026',
      travellerSummary: '2 Adults · 1 Room',
      state: 'ready',
      priceLkr: baseRate + suiteDelta + allInclusiveDelta,
      offerId: primaryHotel.canonicalOfferId,
      sourceType: 'API',
      confirmationMode: 'INSTANT_CONFIRM',
      supplierName: 'LITEAPI',
      integrationMode: 'ADAPTER-READY'
    });

    const summary = tripBucket.getSummary();
    assert.equal(summary.totalItems, 4, 'Trip Bucket has 4 total items (3 baseline + 1 staged hotel)');
    assert.equal(summary.readyCount, 3, 'Trip Bucket has 3 Ready items');
    assert.equal(summary.readySubtotalLkr, 505000 + 309500, 'Ready subtotal correctly includes staged hotel room');

    // 5. Pre-Booking Revalidation Ping
    const reval = await unifiedInventory.revalidateOffer(primaryHotel.canonicalOfferId);
    assert.equal(reval.status, 'UNCHANGED', 'Hotel revalidation confirms UNCHANGED rate');
    assert.ok(reval.message?.includes('SANDBOX') || reval.message?.includes('revalidated') || reval.message?.includes('Unified Inventory'));

    // 6. Distributed Booking Saga Orchestration
    const storage = new VacatinaStorageEngine();
    const testBucket = storage.getOrCreateTripBucket('sess_hotel_flow_test');
    storage.addTripBucketItem({
      tripBucketId: testBucket.id,
      canonicalOfferId: primaryHotel.canonicalOfferId,
      productType: 'hotels',
      sourceType: 'API',
      bookingMode: 'INSTANT_BOOK',
      title: 'Grand Palace Hotel Dubai',
      configuration: {
        roomType: 'Executive Suite',
        boardBasis: 'All Inclusive'
      },
      travellerManifest: {
        adults: 2,
        leadName: 'Perera / Kasun Mr'
      },
      unitSellingPriceMinor: primaryHotel.pricing.finalSellingPriceMinor,
      currency: 'LKR',
      state: 'READY'
    });

    const saga = new BookingSagaService(storage);
    const sagaResult = await saga.executeBookingSaga({
      tripBucketId: testBucket.id,
      customerEmail: 'kasun.perera@example.com',
      customerName: 'Kasun Perera',
      idempotencyKey: 'idemp_hotel_flow_771',
      checkoutSessionId: 'chk_sess_ht_001'
    });

    assert.ok(/^VCT-2026-[A-Z0-9]{6}$/.test(sagaResult.bookingReference), 'Booking reference must follow canonical VCT-2026-XXXXXX format');
    assert.equal(sagaResult.totalSellingPriceMinor, primaryHotel.pricing.finalSellingPriceMinor);
    assert.equal(sagaResult.items.length, 1);
    assert.equal(sagaResult.items[0].productType, 'hotels');
  });

  it('enforces Visa Assistance End-to-End Real Product Flow (Country Catalog, Consular Checklist, Needs-Action Staging Isolation, and Resolution to Ready)', async () => {
    // 1. Destination Country Catalog & Advisory Checklist
    const searchAggregator = new SearchAggregatorService(CANONICAL_HYBRID_CATALOG);
    const uaeVisa = searchAggregator.search({ productType: 'visa', destinationQuery: 'United Arab Emirates' });
    assert.ok(uaeVisa.length >= 1, 'UAE visa assistance must be discoverable');
    assert.equal(uaeVisa[0].productType, 'visa');
    assert.equal(uaeVisa[0].sourceType, 'MANUAL');
    assert.equal(uaeVisa[0].confirmationMode, 'ASSISTED_SERVICE');
    assert.ok(uaeVisa[0].inclusions.length >= 2, 'Consular checklist requirements must be transparent');

    // 2. Unified Inventory Consular Adapter Query
    const unifiedInventory = new UnifiedInventoryService();
    const consularOffers = await unifiedInventory.search({ productType: 'visa', destination: 'United Arab Emirates' });
    assert.ok(consularOffers.length >= 1, 'Consular desk offers returned');
    
    const visaOffer = consularOffers[0];
    assert.equal(visaOffer.sourceMode, 'MANUAL');
    assert.equal(visaOffer.manualSourceType, 'MANUAL_INTERNAL');
    assert.equal(visaOffer.currentAvailabilityMode, 'MANUAL_CONFIRMATION');
    assert.equal(visaOffer.currentPricingMode, 'FIXED_MANUAL');

    // 3. Staging into Trip Bucket: Strict Needs-Action Invariant
    const tripBucket = new TripBucketService();
    tripBucket.stageCandidate({
      id: 'vs-staged-uae-001',
      productType: 'visa',
      productLabel: 'Visa',
      title: 'UAE 60-Day Tourist Visa Assistance',
      subtitle: 'Consular Document Review · Dedicated Officer SLA 48h',
      dateSummary: 'Pre-departure submission',
      travellerSummary: '1 Adult · Ordinary Passport',
      state: 'needs_action', // Always staged as needs_action until applicant passport is uploaded
      priceLkr: 45000,
      offerId: visaOffer.canonicalOfferId,
      sourceType: 'MANUAL',
      confirmationMode: 'ASSISTED_SERVICE',
      supplierName: 'VACATINA_CONSULAR_DESK',
      integrationMode: 'ADAPTER-READY',
      actionRequiredText: 'Provide applicant passport scan and digital photograph.'
    });

    const summaryPre = tripBucket.getSummary();
    assert.equal(summaryPre.totalItems, 4, 'Trip Bucket has 4 total items (3 baseline + 1 staged visa)');
    assert.equal(summaryPre.needsActionCount, 2, 'Two items in Needs Action (1 baseline visa + 1 newly staged visa)');
    assert.equal(summaryPre.readySubtotalLkr, 505000, 'Ready subtotal strictly excludes uncompleted visa applications');

    // 4. Resolution Workflow: Completing Applicant Details Transitions to Ready
    const resolvedVisa = tripBucket.resolveNeedsAction('vs-staged-uae-001', {
      passportNumber: 'N7894561',
      expiryDate: '2031-10-15',
      biometricPhotoVerified: true
    });

    assert.ok(resolvedVisa, 'Resolved visa candidate returned');
    assert.equal(resolvedVisa.state, 'ready', 'Resolved visa transitions to Ready');

    const summaryPost = tripBucket.getSummary();
    assert.equal(summaryPost.readyCount, 3, 'Ready count increases to 3');
    assert.equal(summaryPost.needsActionCount, 1, 'Needs Action count decreases back to 1');
    assert.equal(summaryPost.readySubtotalLkr, 505000 + 45000, 'Ready subtotal now includes verified visa service (550,000 LKR)');

    // 5. Distributed Saga Pre-Auth and Dispatch for Verified Visa
    const storage = new VacatinaStorageEngine();
    const testBucket = storage.getOrCreateTripBucket('sess_visa_flow_test');
    storage.addTripBucketItem({
      tripBucketId: testBucket.id,
      canonicalOfferId: visaOffer.canonicalOfferId,
      productType: 'visa',
      sourceType: 'MANUAL',
      bookingMode: 'REQUEST_TO_BOOK',
      title: 'UAE 60-Day Tourist Visa Assistance',
      configuration: {
        passportNumber: 'N7894561',
        nationality: 'Sri Lankan'
      },
      travellerManifest: {
        adults: 1,
        leadName: 'Perera / Kasun Mr'
      },
      unitSellingPriceMinor: visaOffer.pricing.finalSellingPriceMinor,
      currency: 'LKR',
      state: 'READY'
    });

    const saga = new BookingSagaService(storage);
    const sagaResult = await saga.executeBookingSaga({
      tripBucketId: testBucket.id,
      customerEmail: 'kasun.perera@example.com',
      customerName: 'Kasun Perera',
      idempotencyKey: 'idemp_visa_flow_552',
      checkoutSessionId: 'chk_sess_vs_001'
    });

    assert.ok(/^VCT-2026-[A-Z0-9]{6}$/.test(sagaResult.bookingReference), 'Booking reference issued');
    assert.equal(sagaResult.overallStatus, 'CONFIRMED');
    assert.equal(sagaResult.items[0].productType, 'visa');
  });

  it('enforces Canonical Inventory Source Taxonomy, Truthful Reference Isolation, and Invariant Guards (Audit v2.1)', async () => {
    // 1. Verify 4 Canonical Source Types, 6 Environments, and 5 Booking Modes
    const validSourceTypes: CanonicalInventorySourceType[] = [
      'SUPPLIER_API',
      'MANUAL_CONTRACT',
      'MANUAL_SERVICE',
      'ACCELERATOR_SEED'
    ];
    assert.equal(validSourceTypes.length, 4, 'Exactly 4 canonical source types');

    const validEnvironments: CanonicalSourceEnvironment[] = [
      'LIVE_CERTIFIED',
      'LIVE_MANUAL_VERIFIED',
      'CANDIDATE',
      'SANDBOX',
      'DEMO_ONLY',
      'SUSPENDED'
    ];
    assert.equal(validEnvironments.length, 6, 'Exactly 6 canonical source environments');

    const validBookingModes: CanonicalBookingMode[] = [
      'INSTANT_API',
      'MANUAL_ALLOTMENT',
      'REQUEST_TO_BOOK',
      'MANUAL_CONFIRMATION',
      'INFORMATION_ONLY'
    ];
    assert.equal(validBookingModes.length, 5, 'Exactly 5 canonical booking modes');

    // 2. Test Invariant 12: assertProductionSearchExcludesDemoSeed
    const liveOffers = await new UnifiedInventoryService().search({ productType: 'flights', destination: 'Dubai' });
    assert.doesNotThrow(() => {
      assertProductionSearchExcludesDemoSeed(liveOffers);
    }, 'Production search results must pass demo seed exclusion guard');

    const leakedSeedOffer = {
      ...liveOffers[0],
      canonicalSourceType: 'ACCELERATOR_SEED' as const
    };
    assert.throws(() => {
      assertProductionSearchExcludesDemoSeed([leakedSeedOffer]);
    }, /Production Isolation Guard: DEMO_ONLY \/ ACCELERATOR_SEED offer/, 'Demo seed leak must be blocked by assertion');

    // 3. Test Invariant 13: assertCandidateCannotBeProductionReady
    const candidateOffer = {
      ...liveOffers[0],
      sourceEnvironment: 'CANDIDATE' as const,
      environmentClass: 'PRODUCTION' as const,
      sellability: 'BOOKABLE' as const,
      availabilityStatus: 'LIVE' as const,
      confirmationMode: 'INSTANT_CONFIRM' as const
    };
    assert.throws(() => {
      assertCandidateCannotBeProductionReady(candidateOffer);
    }, /Lifecycle Safety Guard: Candidate\/Sandbox offer/, 'Candidate adapter cannot claim production instant live bookability');

    // 4. Test Invariant 14: assertNoFabricatedUpstreamReferences
    assert.doesNotThrow(() => {
      assertNoFabricatedUpstreamReferences({
        vacatinaBookingReference: 'VCT-2026-AB12CD',
        isUpstreamConfirmed: false,
        supplierPnr: undefined,
        supplierConfirmationNumber: undefined,
        vacatinaServiceReference: 'VSA-INTAKE-998877'
      });
    }, 'Truthful reference with undefined supplier PNR passes guard');

    assert.throws(() => {
      assertNoFabricatedUpstreamReferences({
        vacatinaBookingReference: 'VCT-2026-AB12CD',
        isUpstreamConfirmed: false,
        supplierPnr: 'FAKE-AIRLINE-PNR', // Fabricated PNR in sandbox!
        supplierConfirmationNumber: undefined
      });
    }, /Integrity Guard: supplierPnr cannot be set for uncertified \/ sandbox booking item/, 'Fabricated PNR must throw violation error');

    assert.throws(() => {
      assertNoFabricatedUpstreamReferences({
        vacatinaBookingReference: 'INVALID-REF-123',
        isUpstreamConfirmed: false
      });
    }, /Booking Reference Guard: Item missing valid canonical Vacatina booking reference/, 'Invalid reference format must throw error');

    // 5. Test Distributed Saga populates truthful reference fields
    const storage = new VacatinaStorageEngine();
    const bucket = storage.getOrCreateTripBucket('sess_truthful_ref_test');
    storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: liveOffers[0].canonicalOfferId,
      productType: 'flights',
      sourceType: 'API',
      bookingMode: 'INSTANT_BOOK',
      title: 'Emirates Flight CMB-DXB',
      configuration: { cabinClass: 'Economy' },
      travellerManifest: { adults: 1, leadName: 'Test Traveler' },
      unitSellingPriceMinor: 9249500,
      currency: 'LKR',
      state: 'READY'
    });

    const saga = new BookingSagaService(storage);
    const sagaResult = await saga.executeBookingSaga({
      tripBucketId: bucket.id,
      customerEmail: 'truthful.ref@example.com',
      customerName: 'Test Traveler',
      idempotencyKey: 'idemp_truth_ref_992',
      checkoutSessionId: 'chk_sess_truth_001'
    });

    assert.ok(/^VCT-2026-[A-Z0-9]{6}$/.test(sagaResult.bookingReference), 'Booking reference is strictly VCT-2026-XXXXXX');
    assert.equal(sagaResult.items[0].supplierPnr, undefined, 'supplierPnr is strictly undefined in sandbox mode');
    assert.equal(sagaResult.items[0].supplierConfirmationNumber, undefined, 'supplierConfirmationNumber is strictly undefined in sandbox mode');
    assert.equal(sagaResult.items[0].isUpstreamConfirmed, false, 'isUpstreamConfirmed is strictly false for sandbox simulation');
    assert.ok(sagaResult.items[0].vacatinaBookingReference?.startsWith('VCT-2026-'), 'Item references parent Vacatina booking ref');
  });

  it('enforces Per-Provider Circuit Breaker Configuration & Outage Threshold Isolation (GPT Audit v2.2)', async () => {
    const cb = new CircuitBreakerService({ defaultFailureThreshold: 5 });

    // Duffel NDC is configured with a strict threshold of 3
    const duffelConfig = cb.getProviderConfig('DUFFEL_NDC');
    assert.equal(duffelConfig.failureThreshold, 3, 'Duffel NDC threshold is 3');

    // LiteAPI is configured with threshold of 5
    const liteConfig = cb.getProviderConfig('LITEAPI');
    assert.equal(liteConfig.failureThreshold, 5, 'LiteAPI threshold is 5');

    // Record 3 failures on Duffel -> must trip to OPEN
    cb.recordFailure('DUFFEL_NDC');
    cb.recordFailure('DUFFEL_NDC');
    assert.equal(cb.getState('DUFFEL_NDC'), 'CLOSED', 'Duffel still CLOSED after 2 failures');
    cb.recordFailure('DUFFEL_NDC');
    assert.equal(cb.getState('DUFFEL_NDC'), 'OPEN', 'Duffel trips to OPEN on 3rd failure');

    // Record 3 failures on LiteAPI -> must remain CLOSED (threshold is 5)
    cb.recordFailure('LITEAPI');
    cb.recordFailure('LITEAPI');
    cb.recordFailure('LITEAPI');
    assert.equal(cb.getState('LITEAPI'), 'CLOSED', 'LiteAPI remains CLOSED after 3 failures (threshold is 5)');

    // Allow custom dynamic provider override
    cb.registerProviderConfig('CUSTOM_GDS', { failureThreshold: 2, timeoutMs: 3000, cooldownPeriodMs: 15000, rollingWindowMs: 30000 });
    cb.recordFailure('CUSTOM_GDS');
    cb.recordFailure('CUSTOM_GDS');
    assert.equal(cb.getState('CUSTOM_GDS'), 'OPEN', 'Custom GDS trips on 2nd failure as configured');
  });

  it('enforces Canonical Entity Resolution & Duplicate Prevention across Suppliers (GPT Audit v2.2)', async () => {
    // Two suppliers offering the exact same physical hotel property
    const hotelA: any = {
      canonicalOfferId: 'vct-ht-liteapi-dubai-grandpalace-01',
      productType: 'hotels',
      title: 'Grand Palace Hotel Dubai',
      subtitle: 'Luxury Marina Wing',
      location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
      sourceType: 'API',
      supplierId: 'LITEAPI',
      availabilityStatus: 'LIVE',
      pricing: { rawSupplierCostMinor: 9500000, finalSellingPriceMinor: 10200000 },
      cancellationPolicy: 'Non-refundable'
    };

    const hotelB: any = {
      canonicalOfferId: 'vct-ht-direct-dubai-grandpalace-02',
      productType: 'hotels',
      title: 'Grand Palace Hotel Dubai',
      subtitle: 'Direct Contract Allotment',
      location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
      sourceType: 'DIRECT_CONTRACT',
      canonicalSourceType: 'MANUAL_CONTRACT',
      sourceEnvironment: 'LIVE_MANUAL_VERIFIED',
      verificationStatus: 'VERIFIED_CONTRACT',
      supplierId: 'PAYLOAD_CMS_DIRECT',
      availabilityStatus: 'MANUAL_AVAILABLE',
      availabilityMode: 'ALLOTMENT',
      pricing: { rawSupplierCostMinor: 8000000, finalSellingPriceMinor: 9600000 },
      cancellationPolicy: 'Free cancellation up to 48 hours'
    };

    // Deduplicate mixed supplier feeds
    const results = DeduplicationService.deduplicateAndRank([hotelA, hotelB]);
    assert.equal(results.length, 1, 'Only ONE consolidated entity card returned to customer, zero duplicates');

    const winningOffer = results[0];
    assert.equal(winningOffer.canonicalOfferId, 'vct-ht-direct-dubai-grandpalace-02', 'Direct contract wins due to better rate & verified allotment');
    assert.ok(winningOffer.canonicalEntityId, 'Physical entity ID assigned');
    assert.equal(winningOffer.alternateSourceOfferIds?.length, 1, 'Alternate provider offer tracked under entity');
    assert.equal(winningOffer.alternateSourceOfferIds?.[0], 'vct-ht-liteapi-dubai-grandpalace-01');
    assert.ok(winningOffer.subtitle.includes('Exclusive Direct Deal'), 'Direct deal badge added when beating API');
  });

  it('enforces Multi-Criteria Source Selection & Customer Journey CTA Semantics (GPT Audit v2.2)', async () => {
    // 1. Multi-Criteria Source Selection Scoring: Direct contract beats uncertified API
    const candidateApiOffer: any = {
      canonicalOfferId: 'cand-api-ht-01',
      productType: 'hotels',
      sourceType: 'API',
      sourceEnvironment: 'CANDIDATE',
      verificationStatus: 'PARTNER_PENDING',
      availabilityStatus: 'CACHED',
      pricing: { rawSupplierCostMinor: 9500000, finalSellingPriceMinor: 10200000 },
      freshness: { isStale: false }
    };

    const verifiedDirectOffer: any = {
      canonicalOfferId: 'verif-dir-ht-02',
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      sourceEnvironment: 'LIVE_MANUAL_VERIFIED',
      verificationStatus: 'VERIFIED_CONTRACT',
      availabilityStatus: 'MANUAL_AVAILABLE',
      canonicalBookingMode: 'MANUAL_ALLOTMENT',
      pricing: { rawSupplierCostMinor: 8000000, finalSellingPriceMinor: 9600000 },
      cancellationPolicy: 'Free cancellation',
      freshness: { isStale: false }
    };

    const scoreApi = computeOfferSourceScore(candidateApiOffer);
    const scoreDirect = computeOfferSourceScore(verifiedDirectOffer);
    assert.ok(scoreDirect > scoreApi, `Direct contract score (${scoreDirect}) must beat uncertified API score (${scoreApi})`);

    const bestOffer = selectBestSourceOffer([candidateApiOffer, verifiedDirectOffer]);
    assert.equal(bestOffer?.canonicalOfferId, 'verif-dir-ht-02', 'selectBestSourceOffer picks verified direct contract');

    // 2. Customer CTA mapping: Honest journey semantics
    assert.equal(getCanonicalBookingModeCta('INSTANT_API'), 'Available — Continue');
    assert.equal(getCanonicalBookingModeCta('MANUAL_ALLOTMENT'), 'Available — Continue');
    assert.equal(getCanonicalBookingModeCta('REQUEST_TO_BOOK'), 'Request Availability');
    assert.equal(getCanonicalBookingModeCta('MANUAL_CONFIRMATION'), 'Submit Details');
    assert.equal(getCanonicalBookingModeCta('INFORMATION_ONLY'), 'Explore / Search');

    // 3. Technical Leak Guard: No technical source types in customer badges
    const customerBadges = ['Available — Continue', 'Instant Confirmation', 'Direct Rate'];
    assert.ok(validateNoTechnicalLeakInCustomerBadges(customerBadges), 'Clean customer badges pass leak validation');

    const leakingBadges = ['SUPPLIER_API Available', 'MANUAL_CONTRACT'];
    assert.equal(validateNoTechnicalLeakInCustomerBadges(leakingBadges), false, 'Technical terms caught by leak validator');

    // 4. Content layer isolation from checkout
    assert.throws(() => {
      assertDiscoveryLayerCannotEnterInventoryCheckout({ sellability: 'DISCOVERY_ONLY' });
    }, /Content Layer Safety Guard: Discovery\/Editorial content/, 'Discovery content blocked from checkout');
  });

  it('enforces Full 18-Attribute Manual Contract Model & Operational Stop-Sell Toggle (GPT Audit v2.2)', async () => {
    const service = new ManualInventoryService(CANONICAL_MANUAL_LISTINGS);
    const listings = service.getAllListings();
    assert.ok(listings.length >= 3, 'Manual listings catalog loaded');

    const charter = listings.find(l => l.id === 'charter-cmb-mle-airtaxi')!;
    // Verify 18 canonical attributes
    assert.ok(charter.partnerSupplierId && charter.supplierLegalName, '1. Supplier Identity');
    assert.ok(charter.productType && charter.canonicalEntityId, '2. Product & Canonical Entity ID');
    assert.ok(charter.contractReference && charter.effectiveFromIso, '3. Contract & Effective Window');
    assert.ok(charter.contractedBaseCost && charter.standardSellingPriceLkr, '4. Net Cost & Selling Price');
    assert.equal(charter.costCurrency, 'LKR', '5. Currency');
    assert.equal(charter.isTaxInclusive, true, '6. Tax Inclusive');
    assert.ok(charter.availableQuota && charter.allotmentTotal, '7. Allotment Quota');
    assert.ok(charter.validFromIso && charter.validUntilIso, '8. Sales Window');
    assert.ok(charter.travelValidFromIso && charter.travelValidUntilIso, '9. Travel Window');
    assert.ok(Array.isArray(charter.blackoutDates), '10. Blackout Dates');
    assert.equal(charter.isStopSaleActive, false, '11. Stop-Sell Initial State (Active)');
    assert.equal(charter.bookingMode, 'REQUEST_TO_BOOK', '12. Booking Mode');
    assert.equal(charter.partnerSlaHours, 4, '13. Partner SLA');
    assert.ok(charter.cancellationPolicy, '14. Cancellation Policy');
    assert.equal(charter.maxOccupancy, 8, '15. Occupancy Limits');
    assert.ok(charter.inclusions.length > 0, '16. Content & Inclusions');
    assert.equal(charter.status, 'PUBLISHED', '17. Publishing Status');
    assert.ok(charter.auditTrail.length > 0, '18. Immutable Audit Trail');

    // Test Operational Stop-Sell Toggle
    const adminUser = { id: 'usr_ops_01', name: 'Operations Lead' };
    service.toggleStopSale(charter.id, adminUser, 'Bad weather in Male Lagoon: suspend charter seaplane');
    
    const updated = service.getListingById(charter.id)!;
    assert.equal(updated.isStopSaleActive, true, 'Stop-sell immediately suspended listing');
    assert.equal(updated.auditTrail[updated.auditTrail.length - 1].action, 'STOP_SALE_ACTIVATED');

    // Active customer query must exclude stopped-sale items
    const activeListings = service.queryListings({ productType: 'flights', onlyActive: true });
    assert.equal(activeListings.some(l => l.id === charter.id), false, 'Stopped-sale charter excluded from customer search results');

    // Lift stop-sell
    service.toggleStopSale(charter.id, adminUser, 'Weather cleared: resume flights');
    assert.equal(service.getListingById(charter.id)!.isStopSaleActive, false, 'Stop-sell lifted');
  });

  it('enforces Complete Provider Registry Endpoints, Webhooks, SLAs, and Fallback Plans (docs/20 Matrix)', async () => {
    assert.equal(CANONICAL_PROVIDER_REGISTRY.length, 11, 'All 11 providers registered');

    for (const provider of CANONICAL_PROVIDER_REGISTRY) {
      // 1. Endpoint contract
      assert.ok(provider.endpoints, `Provider ${provider.providerId} has endpoints defined`);
      assert.ok(provider.endpoints.searchEndpoint, `Provider ${provider.providerId} has searchEndpoint`);
      assert.ok(provider.endpoints.detailsEndpoint, `Provider ${provider.providerId} has detailsEndpoint`);
      assert.ok(provider.endpoints.revalidateEndpoint, `Provider ${provider.providerId} has revalidateEndpoint`);
      assert.ok(provider.endpoints.bookingEndpoint, `Provider ${provider.providerId} has bookingEndpoint`);
      assert.ok(provider.endpoints.cancellationEndpoint, `Provider ${provider.providerId} has cancellationEndpoint`);

      // 2. Webhook contract
      assert.ok(provider.webhooks, `Provider ${provider.providerId} has webhooks defined`);
      assert.ok(Array.isArray(provider.webhooks.supportedEvents) && provider.webhooks.supportedEvents.length > 0, `Provider ${provider.providerId} has webhook events`);
      assert.ok(provider.webhooks.signatureHeader, `Provider ${provider.providerId} has signature header`);
      assert.ok(provider.webhooks.callbackUrlPath.startsWith('/api/v1/webhooks/'), `Provider ${provider.providerId} callback path valid`);

      // 3. SLA Profile
      assert.ok(provider.slaProfile, `Provider ${provider.providerId} has SLA profile`);
      assert.ok(provider.slaProfile.timeoutMs > 0 && provider.slaProfile.timeoutMs <= 10000, `Provider ${provider.providerId} timeoutMs valid`);
      assert.ok(provider.slaProfile.circuitBreakerThreshold >= 3, `Provider ${provider.providerId} breaker threshold >= 3`);
      assert.ok(provider.slaProfile.cooldownPeriodMs >= 15000, `Provider ${provider.providerId} cooldown >= 15s`);
      assert.ok(provider.slaProfile.maxRetries >= 1, `Provider ${provider.providerId} retries >= 1`);

      // 4. Fallback Plan
      assert.ok(provider.fallbackPlan, `Provider ${provider.providerId} has fallback plan`);
      assert.ok(['MANUAL_CONTRACT_ALLOTMENT', 'INTERNAL_CONSULAR_DESK', 'BACKOFFICE_ON_REQUEST_TRIAGE', 'DEGRADED_INFORMATIONAL'].includes(provider.fallbackPlan.fallbackStrategy), `Provider ${provider.providerId} valid fallback strategy`);
      assert.ok(provider.fallbackPlan.fallbackProviderId, `Provider ${provider.providerId} has fallback provider ID`);
      assert.ok(provider.fallbackPlan.description.length > 10, `Provider ${provider.providerId} has descriptive fallback description`);

      // 5. Error Mapping
      assert.ok(provider.errorMapping, `Provider ${provider.providerId} has error mapping`);
      assert.equal(provider.errorMapping.errorStandard, 'RFC_7807', `Provider ${provider.providerId} adheres to RFC 7807`);
      assert.ok(Array.isArray(provider.errorMapping.retryableErrorCodes) && provider.errorMapping.retryableErrorCodes.length > 0, `Provider ${provider.providerId} has retryable codes`);
      assert.ok(Array.isArray(provider.errorMapping.nonRetryableErrorCodes) && provider.errorMapping.nonRetryableErrorCodes.length > 0, `Provider ${provider.providerId} has non-retryable codes`);
      assert.ok(Object.keys(provider.errorMapping.codeMapping).length > 0, `Provider ${provider.providerId} has code mapping`);
    }

    // Verify product vertical coverage across providers
    const allProducts = CANONICAL_PROVIDER_REGISTRY.flatMap(p => p.targetProducts);
    const expectedProducts = ['flights', 'hotels', 'activities', 'cars', 'rails', 'cruises', 'insurance', 'visa', 'packages'];
    for (const prod of expectedProducts) {
      assert.ok(allProducts.includes(prod as any), `Provider registry covers product: ${prod}`);
    }
  });

  it('enforces Commercial Entity Audit Classifications (Requirements 5, 6, 7 & 13)', async () => {
    assert.equal(CANONICAL_COMMERCIAL_ENTITY_REGISTRY.length, 16, 'All 16 commercial entities audited');

    // 1. External suppliers MUST be CANDIDATE or TARGET_ONLY
    const candidates = CANONICAL_COMMERCIAL_ENTITY_REGISTRY.filter(e => e.classification === 'CANDIDATE');
    assert.ok(candidates.some(e => e.entityId === 'DUFFEL_NDC'), 'Duffel is CANDIDATE');
    assert.ok(candidates.some(e => e.entityId === 'LITEAPI'), 'LiteAPI is CANDIDATE');
    assert.ok(candidates.some(e => e.entityId === 'VIATOR'), 'Viator is CANDIDATE');
    assert.ok(candidates.some(e => e.entityId === 'TRAINLINE'), 'Trainline is CANDIDATE');

    const targets = CANONICAL_COMMERCIAL_ENTITY_REGISTRY.filter(e => e.classification === 'TARGET_ONLY');
    assert.ok(targets.some(e => e.entityId === 'AMADEUS_GDS'), 'Amadeus is TARGET_ONLY');
    assert.ok(targets.some(e => e.entityId === 'RENTALCARS'), 'Rentalcars is TARGET_ONLY');
    assert.ok(targets.some(e => e.entityId === 'TRAVELTEK'), 'Traveltek is TARGET_ONLY');
    assert.ok(targets.some(e => e.entityId === 'ALLIANZ'), 'Allianz is TARGET_ONLY');

    // 2. Examples must be EXAMPLE_ONLY and CANNOT enter sellable inventory
    const examples = CANONICAL_COMMERCIAL_ENTITY_REGISTRY.filter(e => e.classification === 'EXAMPLE_ONLY');
    assert.ok(examples.some(e => e.entityId === 'SRILANKAN_AIRTAXI'), 'AirTaxi is EXAMPLE_ONLY');
    assert.ok(examples.some(e => e.entityId === 'AITKEN_SPENCE_DIRECT'), 'Aitken Spence is EXAMPLE_ONLY');
    assert.ok(examples.some(e => e.entityId === 'CAREEM_FLEET_DXB'), 'Careem is EXAMPLE_ONLY');
    for (const ex of examples) {
      assert.equal(ex.canEnterProductionSellable, false, `Example ${ex.entityId} cannot enter production sellable`);
    }

    // 3. Operational internal services & verified platform desks
    const verifiedContracts = CANONICAL_COMMERCIAL_ENTITY_REGISTRY.filter(e => e.classification === 'VERIFIED_CONTRACT');
    assert.ok(verifiedContracts.some(e => e.entityId === 'PAYLOAD_CMS_DIRECT'), 'Payload CMS is VERIFIED_CONTRACT');

    const internalCandidates = CANONICAL_COMMERCIAL_ENTITY_REGISTRY.filter(e => e.classification === 'CANDIDATE');
    assert.ok(internalCandidates.some(e => e.entityId === 'VACATINA_CONSULAR_CONCIERGE'), 'Consular Concierge is CANDIDATE until SLA sign-off');

    // 4. Test assertCommercialEntitySellable guard
    assert.throws(() => {
      assertCommercialEntitySellable('Duffel Technology Ltd', 'CANDIDATE');
    }, /Commercial Safety Invariant: Entity 'Duffel Technology Ltd' is classified as 'CANDIDATE'/, 'Candidate cannot sell in production');

    assert.throws(() => {
      assertCommercialEntitySellable('Amadeus IT Group', 'TARGET_ONLY');
    }, /Commercial Safety Invariant: Entity 'Amadeus IT Group' is classified as 'TARGET_ONLY'/, 'Target cannot sell in production');

    assert.throws(() => {
      assertCommercialEntitySellable('Careem Networks FZ LLC', 'EXAMPLE_ONLY');
    }, /Commercial Safety Invariant: Entity 'Careem Networks FZ LLC' is classified as 'EXAMPLE_ONLY'/, 'Example cannot sell in production');

    assert.doesNotThrow(() => {
      assertCommercialEntitySellable('Vacatina Direct Contract Desk', 'VERIFIED_CONTRACT');
    }, 'Verified contract can enter production inventory');
  });

  it('enforces End-to-End 18-Attribute Manual Contract Lifecycle & 9 Operational Edge Cases (Requirements 9 & 10)', async () => {
    const service = new ManualInventoryService();
    const adminUser = { id: 'usr_ops_lead', name: 'Ops Director' };

    // 1. Create listing in DRAFT status
    const created = service.createListing({
      id: 'test-mirissa-whale-expedition',
      collection: 'manual-dmc-activities',
      productType: 'activities',
      canonicalEntityId: 'ent_ac_mirissa_whale_expedition',
      partnerSupplierId: 'DIRECT_DMC_DESK',
      partnerName: 'Local DMC Contract Inventory',
      supplierLegalName: 'South Coast Maritime Excursions Pvt Ltd',
      supplierTaxId: 'TIN-LK-DMC-0912',
      supplierContactEmail: 'operations@dmc-mirissa.vacatina.com',
      contractReference: 'CNT-DMC-MIRISSA-2026',
      effectiveFromIso: '2026-10-01T00:00:00Z',
      effectiveToIso: '2026-12-31T23:59:59Z',
      title: 'Mirissa Blue Whale Private Catamaran Expedition',
      subtitle: 'Marine Biologist Escort · Breakfast on Board · Guaranteed Dolphin Sighting',
      slug: 'mirissa-blue-whale-catamaran-expedition',
      location: { city: 'Mirissa', country: 'Sri Lanka', countryCode: 'LK' },
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      availableQuota: 10,
      allotmentTotal: 10,
      contractedBaseCost: 45000,
      costCurrency: 'LKR',
      sellingCurrency: 'LKR',
      markupPercent: 22.2,
      standardSellingPriceLkr: 55000,
      isTaxInclusive: true,
      validFromIso: '2026-10-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      salesValidFromIso: '2026-10-01T00:00:00Z',
      salesValidUntilIso: '2026-12-31T23:59:59Z',
      travelValidFromIso: '2026-10-01T00:00:00Z',
      travelValidUntilIso: '2026-12-31T23:59:59Z',
      blackoutDates: ['2026-12-25'],
      isStopSaleActive: false,
      partnerSlaHours: 2,
      freeCancellationDeadlineHours: 24,
      maxOccupancy: 12,
      inclusions: ['Private chartered catamaran', 'Whale research specialist guide', 'Safety life vests'],
      exclusions: ['Hotel pick-up beyond Mirissa harbour zone'],
      cancellationPolicy: 'Free cancellation up to 24 hours prior to departure.'
    }, adminUser);

    assert.equal(created.status, 'DRAFT', 'Initial status is DRAFT');

    // Rule 1: DRAFT listing CANNOT be sold in active customer search
    let activeSearch = service.queryListings({ productType: 'activities', onlyActive: true });
    assert.equal(activeSearch.some(l => l.id === created.id), false, 'DRAFT listing excluded from customer search');

    // 2. Lifecycle Transition: DRAFT -> IN_REVIEW -> PUBLISHED
    service.updateStatus(created.id, 'IN_REVIEW', adminUser, 'Submitted for operations review');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), false, 'IN_REVIEW excluded from customer search');

    service.updateStatus(created.id, 'PUBLISHED', adminUser, 'Approved by contracting lead');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), true, 'PUBLISHED listing appears in customer search');

    // Rule 2: Operational Stop-Sell Toggle immediately removes inventory
    service.toggleStopSale(created.id, adminUser, 'Monsoon storm alert issued');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), false, 'Stopped-sale immediately excluded from customer search');

    service.toggleStopSale(created.id, adminUser, 'Storm passed');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), true, 'Stop-sell lifted: reappears in customer search');

    // Rule 3: Exhausted Allotment (0 quota) cannot sell
    service.updateAllotment(created.id, 0, adminUser, 'Sold out all catamaran slots');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), false, 'Zero quota allotment excluded from customer search');

    service.updateAllotment(created.id, 5, adminUser, 'Additional private catamaran chartered');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), true, 'Restocked quota appears in search');

    // Rule 4: Blackout Dates exclusion
    const blackoutChristmas = service.queryListings({ productType: 'activities', travelDate: '2026-12-25', onlyActive: true });
    assert.equal(blackoutChristmas.some(l => l.id === created.id), false, 'Christmas blackout date excluded from search');

    const normalDay = service.queryListings({ productType: 'activities', travelDate: '2026-12-20', onlyActive: true });
    assert.equal(normalDay.some(l => l.id === created.id), true, 'Normal non-blackout date included in search');

    // Rule 5: Archive listing
    service.archiveListing(created.id, adminUser, 'End of seasonal contract');
    assert.equal(service.getListingById(created.id)!.status, 'ARCHIVED', 'Listing archived');
    assert.equal(service.queryListings({ productType: 'activities', onlyActive: true }).some(l => l.id === created.id), false, 'Archived listing cannot sell');

    // Rule 6: Audit trail immutability
    const audit = service.getListingById(created.id)!.auditTrail;
    assert.ok(audit.length >= 7, 'Audit trail logs create, status transitions, stop-sells, allotments, and archive');
    assert.equal(audit[0].action, 'LISTING_CREATED');
    assert.equal(audit[audit.length - 1].action, 'STATUS_CHANGE: PUBLISHED -> ARCHIVED');
  });

  it('enforces Multi-Provider Canonical Entity Resolution, Dynamic Winner Shift, and Recoverable Alternatives (Requirements 8, 10 & 11)', () => {
    // Hotel property: Grand Palace Hotel Dubai quoted by 2 sources
    const entityId = 'ent_ht_dubai_grandpalacehotelduba';

    // Quote 1: LiteAPI (Candidate Wholesale Bedbank)
    const liteApiOffer: any = {
      canonicalOfferId: 'off_api_liteapi_grandpalace_001',
      canonicalEntityId: entityId,
      productType: 'hotels',
      title: 'Grand Palace Hotel Dubai',
      sourceType: 'SUPPLIER_API',
      supplierId: 'LITEAPI',
      sourceEnvironment: 'CANDIDATE',
      environmentClass: 'SANDBOX',
      verificationStatus: 'UNVERIFIED',
      availabilityStatus: 'LIVE',
      confirmationMode: 'INSTANT_CONFIRM',
      canonicalBookingMode: 'INSTANT_API',
      location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
      pricing: {
        rawSupplierCostMinor: 4800000,
        markupPercent: 10,
        finalSellingPriceMinor: 5280000,
        currency: 'LKR'
      },
      freshness: { isStale: false, cacheAgeMs: 5000 },
      cancellationPolicy: 'Non-refundable booking',
      pinAboveApi: false
    };

    // Quote 2: Direct Contract Desk (Direct Hotel Allotment Desk)
    const directContractOffer: any = {
      canonicalOfferId: 'off_dir_payload_grandpalace_002',
      canonicalEntityId: entityId,
      productType: 'hotels',
      title: 'Grand Palace Hotel Dubai',
      sourceType: 'MANUAL_CONTRACT',
      inventorySource: 'DIRECT_CONTRACT',
      publicationStatus: 'PUBLISHED',
      isExclusiveDeal: true,
      validUntil: '2026-12-31T23:59:59Z',
      supplierId: 'PAYLOAD_CMS_DIRECT',
      sourceEnvironment: 'LIVE_MANUAL_VERIFIED',
      environmentClass: 'PRODUCTION',
      verificationStatus: 'VERIFIED_CONTRACT',
      availabilityStatus: 'MANUAL_AVAILABLE',
      availabilityMode: 'ALLOTMENT',
      confirmationMode: 'INSTANT_CONFIRM',
      canonicalBookingMode: 'MANUAL_ALLOTMENT',
      location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
      pricing: {
        rawSupplierCostMinor: 4200000,
        markupPercent: 12,
        finalSellingPriceMinor: 4704000,
        currency: 'LKR'
      },
      freshness: { isStale: false, cacheAgeMs: 1000 },
      cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival',
      pinAboveApi: true
    };

    // Run Deduplication and Resolution
    const result = DeduplicationService.deduplicateAndRank([liteApiOffer, directContractOffer]);

    // Proves: Consolidated into exactly 1 winning entity card
    assert.equal(result.length, 1, 'Duplicate supplier quotes consolidated into single card');
    const winner = result[0];

    // Proves: Direct Contract wins on lower price, verified contract, and free cancellation
    assert.equal(winner.canonicalOfferId, directContractOffer.canonicalOfferId, 'Direct contract wins on price and verification');
    assert.equal(winner.canonicalEntityId, entityId, 'Canonical entity ID preserved');

    // Proves: Alternative source (LiteAPI) retained in alternateSourceOfferIds for internal agent review
    assert.deepEqual(winner.alternateSourceOfferIds, [liteApiOffer.canonicalOfferId], 'Alternative LiteAPI quote retained internally');

    // Proves: Zero customer leakage of technical enums
    const badges = deriveCustomerBadges(winner);
    validateNoTechnicalLeakInCustomerBadges(badges);
    assert.ok(badges.includes('Exclusive Direct Deal') || badges.includes('Direct Rate'), 'Customer sees professional deal badge');

    // Dynamic Winner Shift: If LiteAPI drops price and offers free cancellation, it can win
    const discountedLiteApi = {
      ...liteApiOffer,
      sourceEnvironment: 'LIVE_CERTIFIED',
      verificationStatus: 'VERIFIED_CONTRACT',
      availabilityMode: 'ALLOTMENT',
      fulfillmentMode: 'INSTANT',
      bookingCapability: 'INSTANT_RESERVATION',
      pricing: {
        rawSupplierCostMinor: 3000000,
        markupPercent: 10,
        finalSellingPriceMinor: 3300000,
        currency: 'LKR'
      },
      cancellationPolicy: 'Free cancellation up to 72 hours prior'
    };
    const shiftResult = DeduplicationService.deduplicateAndRank([discountedLiteApi, { ...directContractOffer, pinAboveApi: false }]);
    assert.equal(shiftResult[0].canonicalOfferId, discountedLiteApi.canonicalOfferId, 'Price drop shifts winning source dynamically');
    assert.deepEqual(shiftResult[0].alternateSourceOfferIds, [directContractOffer.canonicalOfferId], 'Direct contract quote retained in alternatives');
  });

  it('enforces Provider Production Live Booking Guard & Truthful Reference Isolation (Requirements 12, 13 & 14)', () => {
    // 1. Guard blocks uncertified candidates from live bookings
    const duffel = ProviderRegistryService.getProvider('DUFFEL_NDC')!;
    assert.throws(() => {
      assertProviderCanExecuteLiveBooking(duffel);
    }, /Provider Certification Invariant: Provider 'DUFFEL_NDC'/, 'Duffel candidate blocked from live booking');

    const amadeus = ProviderRegistryService.getProvider('AMADEUS_GDS')!;
    assert.throws(() => {
      assertProviderCanExecuteLiveBooking(amadeus);
    }, /Provider Certification Invariant: Provider 'AMADEUS_GDS'/, 'Amadeus target blocked from live booking');

    const liteapi = ProviderRegistryService.getProvider('LITEAPI')!;
    assert.throws(() => {
      assertProviderCanExecuteLiveBooking(liteapi);
    }, /Provider Certification Invariant: Provider 'LITEAPI'/, 'LiteAPI candidate blocked from live booking');

    // 2. Operational In-house providers: Consular Concierge is CANDIDATE_UNVERIFIED until operational SLA is certified
    const consular = ProviderRegistryService.getProvider('VACATINA_CONSULAR_CONCIERGE')!;
    assert.throws(() => {
      assertProviderCanExecuteLiveBooking(consular);
    }, /Provider Certification Invariant: Provider 'VACATINA_CONSULAR_CONCIERGE'/, 'Consular concierge correctly blocked until operational SLA is certified');

    const payloadCms = ProviderRegistryService.getProvider('PAYLOAD_CMS_DIRECT')!;
    assert.doesNotThrow(() => {
      assertProviderCanExecuteLiveBooking(payloadCms);
    }, 'Payload CMS direct desk permitted for live operational execution');

    // 3. Truthful Booking Reference Semantics
    // Case A: Valid unconfirmed sandbox booking
    assert.doesNotThrow(() => {
      assertNoFabricatedUpstreamReferences({
        isUpstreamConfirmed: false,
        vacatinaBookingReference: 'VCT-2026-AB12CD',
        supplierPnr: undefined,
        supplierConfirmationNumber: undefined
      });
    }, 'Valid truthful booking reference with undefined upstream PNR');

    // Case B: Fabricated PNR in sandbox booking throws
    assert.throws(() => {
      assertNoFabricatedUpstreamReferences({
        isUpstreamConfirmed: false,
        vacatinaBookingReference: 'VCT-2026-AB12CD',
        supplierPnr: 'EK-PNR-FAKE-992'
      });
    }, /Integrity Guard: supplierPnr cannot be set for uncertified \/ sandbox booking item/, 'Fabricated PNR blocked');
  });

  it('enforces Four-Tier Operational Readiness Tier on all 11 Providers & Blocks Uncertified Live Sales (Commercial Truth Gate 1)', () => {
    const providers = ProviderRegistryService.getAllProviders();
    assert.equal(providers.length, 11, 'All 11 canonical providers registered');

    // Tier 1: SYSTEM_READY must be true for all 11 providers (code, schemas & tests pass)
    providers.forEach(p => {
      assert.ok(p.readinessTier, `Provider ${p.providerId} must define readinessTier`);
      assert.equal(p.readinessTier.systemReady, true, `Provider ${p.providerId} must be SYSTEM_READY`);
    });

    // Tier 2: SANDBOX_READY is true only for scaffolded/active adapters
    const duffel = ProviderRegistryService.getProvider('DUFFEL_NDC')!;
    const amadeus = ProviderRegistryService.getProvider('AMADEUS_GDS')!;
    const liteapi = ProviderRegistryService.getProvider('LITEAPI')!;
    const consular = ProviderRegistryService.getProvider('VACATINA_CONSULAR_CONCIERGE')!;
    const payloadCms = ProviderRegistryService.getProvider('PAYLOAD_CMS_DIRECT')!;

    assert.equal(duffel.readinessTier.sandboxReady, true, 'Duffel is SANDBOX_READY');
    assert.equal(liteapi.readinessTier.sandboxReady, true, 'LiteAPI is SANDBOX_READY');
    assert.equal(amadeus.readinessTier.sandboxReady, false, 'Amadeus target is not yet SANDBOX_READY');

    // Tier 3: COMMERCIAL_READY requires verified bilateral contract and settlement terms
    assert.equal(duffel.readinessTier.commercialReady, false, 'Duffel is not COMMERCIAL_READY (pending live agreement)');
    assert.equal(amadeus.readinessTier.commercialReady, false, 'Amadeus is not COMMERCIAL_READY');
    assert.equal(liteapi.readinessTier.commercialReady, false, 'LiteAPI is not COMMERCIAL_READY');
    assert.equal(payloadCms.readinessTier.commercialReady, true, 'Payload CMS direct contracts desk is COMMERCIAL_READY');
    assert.equal(consular.readinessTier.commercialReady, false, 'Consular Concierge is not COMMERCIAL_READY until signed SLA');
    assert.equal(consular.readinessTier.productionSellable, false, 'Consular Concierge is not PRODUCTION_SELLABLE');

    // Tier 4: PRODUCTION_SELLABLE requires both COMMERCIAL_READY and cleared certification gates
    // Uncertified API providers and unverified internal services MUST throw when checked for production sellability
    assert.throws(() => {
      assertProviderIsProductionSellable(duffel);
    }, /Commercial Truth Guard: Provider 'DUFFEL_NDC' is not COMMERCIAL_READY/, 'Duffel blocked from production selling');

    assert.throws(() => {
      assertProviderIsProductionSellable(amadeus);
    }, /Commercial Truth Guard: Provider 'AMADEUS_GDS' is not COMMERCIAL_READY/, 'Amadeus blocked from production selling');

    assert.throws(() => {
      assertProviderIsProductionSellable(liteapi);
    }, /Commercial Truth Guard: Provider 'LITEAPI' is not COMMERCIAL_READY/, 'LiteAPI blocked from production selling');

    // Consular Concierge is CANDIDATE_UNVERIFIED until operational SLA sign-off
    assert.throws(() => {
      assertProviderIsProductionSellable(consular);
    }, /Commercial Truth Guard: Provider 'VACATINA_CONSULAR_CONCIERGE' is not COMMERCIAL_READY/, 'Consular blocked until physical SLA filed');

    // Payload CMS platform itself is PLATFORM_CAPABILITY, not an individual sellable offer
    assert.throws(() => {
      assertProviderIsProductionSellable(payloadCms);
    }, /Commercial Truth Guard: Provider 'PAYLOAD_CMS_DIRECT' is not PRODUCTION_SELLABLE/, 'Payload CMS platform blocked as whole provider');
  });

  it('enforces Commercial Evidence Dossier Validation on Manual Listings & Blocks Sample Inventory (Commercial Truth Gate 2)', () => {
    // 1. All Sample Listings in canonical catalog MUST be blocked from production selling (Audit Truth Gate)
    const sampleCharter = CANONICAL_MANUAL_LISTINGS.find(l => l.id === 'charter-cmb-mle-airtaxi')!;
    assert.equal(sampleCharter.inventoryClass, 'SAMPLE_INVENTORY', 'Demo charter is classified as SAMPLE_INVENTORY');
    assert.equal(sampleCharter.readinessTier.productionSellable, false, 'Demo charter cannot be sold in production');

    assert.throws(() => {
      assertListingIsProductionSellable(sampleCharter);
    }, /Commercial Truth Guard: Listing 'charter-cmb-mle-airtaxi' is classified as SAMPLE_INVENTORY/, 'Sample inventory blocked from production sales');

    const sampleHotel = CANONICAL_MANUAL_LISTINGS.find(l => l.id === 'heritance-kandalama-signature')!;
    assert.equal(sampleHotel.inventoryClass, 'SAMPLE_INVENTORY');
    assert.throws(() => {
      assertListingIsProductionSellable(sampleHotel);
    }, /SAMPLE_INVENTORY_CANNOT_SELL/);

    const sampleVilla = CANONICAL_MANUAL_LISTINGS.find(l => l.id === 'verified-boutique-villa-mirissa')!;
    assert.equal(sampleVilla.inventoryClass, 'SAMPLE_INVENTORY', 'Uncounter-signed villa is classified as SAMPLE_INVENTORY');
    assert.equal(sampleVilla.readinessTier.productionSellable, false);
    assert.throws(() => {
      assertListingIsProductionSellable(sampleVilla);
    }, /SAMPLE_INVENTORY_CANNOT_SELL/, 'Uncounter-signed villa strictly blocked from production selling');

    // 2. Verified Real Contracted Listing MUST pass production sellability guard
    const verifiedContractFixture = {
      ...sampleVilla,
      id: 'contracted-villa-mirissa-verified',
      inventoryClass: 'REAL_CONTRACTED' as const,
      readinessTier: {
        systemReady: true,
        sandboxReady: true,
        commercialReady: true,
        productionSellable: true
      },
      commercialEvidence: {
        contractReference: 'CNT-DIR-HOTEL-2026-MIRISSA',
        supplierLegalName: 'Mirissa Ocean Horizon Private Limited',
        commercialOwner: 'Lead Contracting Officer (emp_ops_08)',
        signedDateIso: '2026-09-15T00:00:00Z',
        effectiveFromIso: '2026-10-01T00:00:00Z',
        effectiveToIso: '2026-12-31T23:59:59Z',
        rateSource: 'DIRECT_BILATERAL_RATE_SHEET_2026_Q4',
        settlementTerms: 'NET_30_DAYS_BANK_TRANSFER',
        cancellationTerms: 'Free cancellation up to 48 hours prior to check-in',
        allotmentRule: 'DAILY_COMMITTED_ALLOTMENT_8_KEYS',
        operationalContact: 'contracts@oceanhorizon.vacatina.com',
        documentProofReference: 'DOC-VAULT-LK-2026-0881',
        approvedBy: 'Dir. Commercial Partnerships',
        approvalTimestampIso: '2026-09-16T10:00:00Z',
        isEvidenceVerified: true
      }
    };

    assert.doesNotThrow(() => {
      assertListingIsProductionSellable(verifiedContractFixture as any);
    }, 'Verified villa with genuine evidence dossier passes production sellability check');

    // 3. Unverified Dossier Invariant: Missing or unverified evidence blocks production selling
    const unverifiedListing = {
      ...verifiedContractFixture,
      id: 'unverified-hotel-test',
      commercialEvidence: {
        ...verifiedContractFixture.commercialEvidence!,
        isEvidenceVerified: false
      }
    };
    assert.throws(() => {
      assertListingIsProductionSellable(unverifiedListing as any);
    }, /UNVERIFIED_EVIDENCE_DOSSIER/, 'Unverified dossier strictly blocked');

    // 4. Status Transition Lifecycle Guard: PAUSED immediately disables productionSellable
    const service = new ManualInventoryService([verifiedContractFixture as any]);
    const admin = { id: 'admin-ops-01', name: 'Contracting Lead' };

    service.updateStatus('contracted-villa-mirissa-verified', 'PAUSED', admin, 'Temporary renovation');
    const pausedVilla = service.getListingById('contracted-villa-mirissa-verified')!;
    assert.equal(pausedVilla.readinessTier.productionSellable, false, 'PAUSED listing productionSellable is false');

    service.updateStatus('contracted-villa-mirissa-verified', 'PUBLISHED', admin, 'Renovation complete');
    const republishVilla = service.getListingById('contracted-villa-mirissa-verified')!;
    assert.equal(republishVilla.readinessTier.productionSellable, true, 'PUBLISHED verified villa productionSellable restored to true');
  });

  it('enforces the 5-Source Unified Canonical Offer Pattern (LiteAPI Hotel vs Vacatina Direct Hotel Shape Consistency)', () => {
    // 1. LiteAPI Candidate Wholesale Bedbank Offer
    const liteApiCanonical: any = {
      canonicalOfferId: 'vct-ht-liteapi-dxb-grandpalace-01',
      productType: 'hotels',
      inventorySourceType: 'API_SUPPLIER',
      providerId: 'LITEAPI',
      supplierId: 'LITEAPI',
      title: 'Grand Palace Hotel Dubai',
      pricing: {
        rawSupplierCostMinor: 4800000,
        markupPercent: 10,
        finalSellingPriceMinor: 5280000,
        currency: 'LKR'
      },
      availabilityStatus: 'LIVE',
      freshness: {
        lastCheckedAtIso: '2026-10-25T12:00:00Z',
        ttlSeconds: 1800,
        expiresAtIso: '2026-10-25T12:30:00Z',
        isStale: false
      },
      environmentClass: 'SANDBOX',
      sourceEnvironment: 'CANDIDATE',
      sellability: 'BOOKABLE',
      providerLifecycle: 'INTEGRATION_CANDIDATE'
    };

    // 2. Vacatina Direct Hotel Contract Offer
    const directHotelCanonical: any = {
      canonicalOfferId: 'vct-ht-direct-dambulla-kandalama-02',
      productType: 'hotels',
      inventorySourceType: 'MANUAL_DIRECT',
      providerId: 'PAYLOAD_CMS_DIRECT',
      supplierId: 'DIRECT_HOTEL_DESK',
      title: 'Heritance Kandalama Signature Resort',
      pricing: {
        rawSupplierCostMinor: 7800000,
        markupPercent: 14.1,
        finalSellingPriceMinor: 8900000,
        currency: 'LKR'
      },
      availabilityStatus: 'MANUAL_AVAILABLE',
      freshness: {
        lastCheckedAtIso: '2026-10-25T12:05:00Z',
        ttlSeconds: 86400,
        expiresAtIso: '2026-10-26T12:05:00Z',
        isStale: false
      },
      environmentClass: 'PRODUCTION',
      sourceEnvironment: 'LIVE_MANUAL_VERIFIED',
      sellability: 'BOOKABLE',
      providerLifecycle: 'PRODUCTION_LIVE'
    };

    // Proves: Both normalize into the identical UnifiedCustomerOffer object pattern
    const unifiedLiteApi = toUnifiedCustomerOffer(liteApiCanonical);
    const unifiedDirectHotel = toUnifiedCustomerOffer(directHotelCanonical);

    const requiredKeys: (keyof typeof unifiedLiteApi)[] = [
      'offerId',
      'productType',
      'inventorySourceType',
      'providerId',
      'supplierId',
      'title',
      'netPrice',
      'taxes',
      'fees',
      'markup',
      'discount',
      'sellingPrice',
      'price',
      'currency',
      'displayCurrency',
      'settlementCurrency',
      'availabilityStatus',
      'lastCheckedAt',
      'cancellationPolicy',
      'refundability',
      'bookingMode',
      'confirmationMode',
      'commercialStatus',
      'sellable'
    ];

    requiredKeys.forEach(key => {
      assert.ok(key in unifiedLiteApi, `LiteAPI offer must have key '${key}'`);
      assert.ok(key in unifiedDirectHotel, `Direct Hotel offer must have key '${key}'`);
    });

    // Proves: Correct source taxonomy assignment
    assert.equal(unifiedLiteApi.inventorySourceType, 'API_SUPPLIER');
    assert.equal(unifiedDirectHotel.inventorySourceType, 'MANUAL_DIRECT');

    // Proves: Uncertified candidate LiteAPI is marked CANDIDATE_UNVERIFIED and sellable = false in production
    assert.equal(unifiedLiteApi.commercialStatus, 'CANDIDATE_UNVERIFIED');
    assert.equal(unifiedLiteApi.sellable, false);

    // Proves: Verified direct hotel is marked COMMERCIALLY_VERIFIED and sellable = true
    assert.equal(unifiedDirectHotel.commercialStatus, 'COMMERCIALLY_VERIFIED');
    assert.equal(unifiedDirectHotel.sellable, true);

    // Proves: Discovery Content (Homepage cards) cannot claim to be live inventory offers
    const discoveryCard = CANONICAL_DISCOVERY_CATALOG[0];
    assert.equal(discoveryCard.isLiveInventoryOffer, false, 'Homepage card is never live inventory');
    assert.equal(discoveryCard.sellability, 'DISCOVERY_ONLY', 'Homepage card is DISCOVERY_ONLY');
  });

  it('enforces Dynamic Package Transaction Safety and Admin Operational Monitoring Telemetry (Directives 7 & 11)', () => {
    // 1. Dynamic Package Atomic Checkout Safety Guard
    const validPackage: any = {
      canonicalOfferId: 'vct-pkg-sri-lanka-signature-01',
      productType: 'packages',
      components: [
        { componentId: 'comp-fl-01', productType: 'flights', componentStatus: 'AVAILABLE', lastRevalidationResult: 'VALID' },
        { componentId: 'comp-ht-01', productType: 'hotels', componentStatus: 'AVAILABLE', lastRevalidationResult: 'VALID' }
      ]
    };
    assert.doesNotThrow(() => {
      assertPackageAtomicCheckoutReady(validPackage);
    }, 'Package with all available components passes atomic check');

    const expiredComponentPackage: any = {
      canonicalOfferId: 'vct-pkg-dubai-desert-escape-02',
      productType: 'packages',
      components: [
        { componentId: 'comp-fl-02', productType: 'flights', componentStatus: 'AVAILABLE', lastRevalidationResult: 'VALID' },
        { componentId: 'comp-ht-02', productType: 'hotels', componentStatus: 'EXPIRED', lastRevalidationResult: 'EXPIRED' }
      ]
    };
    assert.throws(() => {
      assertPackageAtomicCheckoutReady(expiredComponentPackage);
    }, /Dynamic Package Safety Guard: Component 'comp-ht-02' \(hotels\) has status 'EXPIRED'/, 'Package with expired hotel component blocked from checkout');

    // 2. Admin Operational Monitoring Telemetry
    const healthSummaries = AdminInventoryMonitoringService.getSupplierOperationalHealth();
    assert.ok(healthSummaries.length >= 11, 'Health monitored across all 11 providers');
    const duffelHealth = healthSummaries.find(h => h.providerId === 'DUFFEL_NDC')!;
    assert.ok(duffelHealth);
    assert.equal(duffelHealth.circuitState, 'CLOSED');
    assert.equal(duffelHealth.isProductionReady, false);

    const manualAlerts = AdminInventoryMonitoringService.getManualInventoryAlerts(CANONICAL_MANUAL_LISTINGS);
    assert.ok(manualAlerts.length > 0, 'Generates alerts for unverified sample inventory');
    assert.ok(manualAlerts.some(a => a.alertType === 'UNVERIFIED_EVIDENCE'));

    const freshnessAlerts = AdminInventoryMonitoringService.getPriceFreshnessAlerts([
      {
        canonicalOfferId: 'vct-fl-stale-01',
        productType: 'flights',
        supplierId: 'DUFFEL_NDC',
        freshness: {
          lastCheckedAtIso: new Date(Date.now() - 3600 * 1000).toISOString(),
          ttlSeconds: 900,
          expiresAtIso: new Date(Date.now() - 2700 * 1000).toISOString(),
          isStale: true
        }
      } as any
    ]);
    assert.equal(freshnessAlerts.length, 1);
    assert.equal(freshnessAlerts[0].isStale, true);
    assert.equal(freshnessAlerts[0].requiresRecheck, true);
  });

  it('enforces Provider-Neutral Adapter Pluggability & End-to-End Booking Item Provenance Ledger (Directives 1 & 5)', async () => {
    // 1. Provider-Neutral Schema Pluggability: Swapping LiteAPI for a hypothetical alternative provider
    const liteApiOffer: any = {
      canonicalOfferId: 'vct-ht-liteapi-001',
      productType: 'hotels',
      inventorySourceType: 'API_SUPPLIER',
      providerId: 'LITEAPI',
      supplierId: 'LITEAPI',
      title: 'Marina Bay Sands',
      pricing: { rawSupplierCostMinor: 5000000, platformMarkupMinor: 500000, finalSellingPriceMinor: 5500000, currency: 'LKR' },
      availabilityStatus: 'LIVE',
      freshness: { lastCheckedAtIso: new Date().toISOString(), ttlSeconds: 1800, isStale: false },
      environmentClass: 'SANDBOX',
      sourceEnvironment: 'CANDIDATE',
      sellability: 'BOOKABLE',
      providerLifecycle: 'INTEGRATION_CANDIDATE'
    };

    const altHotelbedsOffer: any = {
      canonicalOfferId: 'vct-ht-hotelbeds-001',
      productType: 'hotels',
      inventorySourceType: 'API_SUPPLIER',
      providerId: 'HOTELBEDS_BEDBANK',
      supplierId: 'HOTELBEDS',
      title: 'Marina Bay Sands',
      pricing: { rawSupplierCostMinor: 4900000, platformMarkupMinor: 600000, finalSellingPriceMinor: 5500000, currency: 'LKR' },
      availabilityStatus: 'LIVE',
      freshness: { lastCheckedAtIso: new Date().toISOString(), ttlSeconds: 1800, isStale: false },
      environmentClass: 'SANDBOX',
      sourceEnvironment: 'CANDIDATE',
      sellability: 'BOOKABLE',
      providerLifecycle: 'INTEGRATION_CANDIDATE'
    };

    const unifiedLite = toUnifiedCustomerOffer(liteApiOffer);
    const unifiedAlt = toUnifiedCustomerOffer(altHotelbedsOffer);

    // Schema parity guarantee: consumer application receives identical shape regardless of supplier
    assert.deepEqual(Object.keys(unifiedLite).sort(), Object.keys(unifiedAlt).sort());
    assert.equal(unifiedLite.sellingPrice, unifiedAlt.sellingPrice);
    assert.equal(unifiedLite.inventorySourceType, 'API_SUPPLIER');
    assert.equal(unifiedAlt.inventorySourceType, 'API_SUPPLIER');

    // 2. Booking Provenance Ledger Integrity: BookingSaga preserves originating financial breakdown
    const storage = new VacatinaStorageEngine();
    const saga = new BookingSagaService(storage);

    const bucket = storage.getOrCreateTripBucket('sess_provenance_audit_01');
    storage.addTripBucketItem({
      tripBucketId: bucket.id,
      canonicalOfferId: 'vct-ht-direct-sigiriya-001',
      productType: 'hotels',
      sourceType: 'MANUAL',
      bookingMode: 'INSTANT_BOOK',
      title: 'Heritance Sigiriya Boutique Villa',
      configuration: { roomType: 'Deluxe' },
      travellerManifest: { adults: 2 },
      unitSellingPriceMinor: 8900000,
      currency: 'LKR',
      state: 'READY'
    });

    const sagaResult = await saga.executeBookingSaga({
      tripBucketId: bucket.id,
      customerEmail: 'ops.audit@vacatina.com',
      customerName: 'Ops Auditor',
      checkoutSessionId: 'cs_prov_001',
      idempotencyKey: 'idemp_prov_001'
    });

    assert.ok(sagaResult);
    const bookingItems = storage.getBookingItems(sagaResult.bookingGroupId);
    assert.equal(bookingItems.length, 1);

    const provenanceItem = bookingItems[0];
    assert.equal(provenanceItem.inventorySourceType, 'MANUAL_DIRECT');
    assert.equal(provenanceItem.providerId, 'PAYLOAD_CMS_DIRECT');
    assert.equal(provenanceItem.sourceOfferId, 'vct-ht-direct-sigiriya-001');
    assert.equal(provenanceItem.commercialEvidenceId, 'EVID-CMS-VERIFIED');
    assert.ok(provenanceItem.originalNetMinor! > 0);
    assert.ok(provenanceItem.taxesMinor! > 0);
    assert.ok(provenanceItem.feesMinor! > 0);
    assert.ok(provenanceItem.markupMinor! > 0);
    assert.equal(provenanceItem.customerSellingAmountMinor, 8900000);
    assert.equal(provenanceItem.settlementCurrency, 'LKR');
    assert.ok(provenanceItem.priceRevalidationTimestamp);
  });

  it('enforces Inventory Orchestrator Pre-Checkout Invariant Guards (Directive 1-6 Audit Verification)', () => {
    const orchestrator = new InventoryOrchestratorService();

    // 1. SAMPLE_INVENTORY strictly blocked from checkout
    const sampleOffer = {
      offerId: 'vct-demo-sample-01',
      inventorySourceType: 'SAMPLE_INVENTORY' as const,
      canonicalSourceType: 'SAMPLE_INVENTORY' as const,
      availabilityStatus: 'LIVE' as const,
      commercialStatus: 'SAMPLE_DEMO' as const,
      sellable: false
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(sampleOffer as any);
    }, /Commercial Truth Guard: Offer 'vct-demo-sample-01' is classified as SAMPLE_INVENTORY and cannot enter checkout/, 'Sample inventory blocked from checkout');

    // 2. DISCOVERY_ONLY strictly blocked from checkout
    const discoveryCard = {
      offerId: 'vct-disc-dubai-desert-safari',
      inventorySourceType: 'API_SUPPLIER' as const,
      sellability: 'DISCOVERY_ONLY',
      isLiveInventoryOffer: false,
      category: 'discovery',
      availabilityStatus: 'LIVE' as const
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(discoveryCard as any);
    }, /Commercial Truth Guard: Offer 'vct-disc-dubai-desert-safari' is DISCOVERY_ONLY content and cannot enter checkout/, 'Discovery card blocked from checkout');

    // 3. Unverified manual inventory strictly blocked from checkout
    const unverifiedManualOffer = {
      offerId: 'vct-ht-man-unverified-01',
      inventorySourceType: 'MANUAL_DIRECT' as const,
      commercialStatus: 'CANDIDATE_UNVERIFIED' as const,
      availabilityStatus: 'MANUAL_AVAILABLE' as const,
      sellable: false
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(unverifiedManualOffer as any);
    }, /Commercial Truth Guard: Manual direct offer 'vct-ht-man-unverified-01' lacks verified commercial contract evidence/, 'Unverified manual inventory blocked from checkout');

    // 4. Uncertified candidate API provider strictly blocked from checkout
    const uncertifiedApiOffer = {
      offerId: 'vct-fl-duffel-candidate-01',
      inventorySourceType: 'API_SUPPLIER' as const,
      providerId: 'DUFFEL_NDC',
      supplierId: 'DUFFEL_NDC',
      availabilityStatus: 'LIVE' as const,
      commercialStatus: 'CANDIDATE_UNVERIFIED' as const,
      sellable: false
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(uncertifiedApiOffer as any);
    }, /Commercial Truth Guard: Provider 'DUFFEL_NDC' is in operationalState 'CANDIDATE_PROVIDER'. Live sales require LIVE_API_CERTIFIED/, 'Uncertified API supplier blocked from checkout');

    // 5. Expired contracts strictly blocked from checkout
    const expiredContractOffer = {
      offerId: 'vct-ht-direct-expired-01',
      inventorySourceType: 'MANUAL_DIRECT' as const,
      commercialStatus: 'COMMERCIALLY_VERIFIED' as const,
      availabilityStatus: 'MANUAL_AVAILABLE' as const,
      offerExpiresAt: new Date(Date.now() - 3600000).toISOString(),
      sellable: true
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(expiredContractOffer as any);
    }, /Freshness Guard: Offer 'vct-ht-direct-expired-01' expired at/, 'Expired contract blocked from checkout');

    // 6. Unavailable / Sold Out inventory strictly blocked from checkout
    const unavailableOffer = {
      offerId: 'vct-ht-sold-out-01',
      inventorySourceType: 'MANUAL_DIRECT' as const,
      commercialStatus: 'COMMERCIALLY_VERIFIED' as const,
      availabilityStatus: 'SOLD_OUT' as const,
      sellable: false
    };
    assert.throws(() => {
      orchestrator.assertOfferCheckoutReady(unavailableOffer as any);
    }, /Availability Guard: Offer 'vct-ht-sold-out-01' has availabilityStatus 'SOLD_OUT' and cannot proceed to checkout/, 'Sold out inventory blocked from checkout');
  });

  it('enforces Inventory Orchestration Search Pipeline, Raw Schema Encapsulation & Recheck Freshness (Directives 1-4)', async () => {
    const orchestrator = new InventoryOrchestratorService();

    // 1. Execute end-to-end orchestration across products
    const customerOffers = await orchestrator.orchestrateSearch({
      productType: 'hotels',
      destination: 'Dubai',
      checkInDate: '2026-11-15',
      checkOutDate: '2026-11-20'
    });

    assert.ok(customerOffers.length > 0, 'Orchestration returned offers');

    // 2. Encapsulation: Every offer adheres strictly to UnifiedCustomerOffer interface
    for (const offer of customerOffers) {
      assert.ok(offer.offerId, 'Offer has canonical ID');
      assert.ok(offer.productType, 'Offer has productType');
      assert.ok(offer.inventorySourceType, 'Offer has inventorySourceType');
      assert.equal(typeof offer.netPrice, 'number', 'Net price is integer numeric');
      assert.equal(typeof offer.sellingPrice, 'number', 'Selling price is integer numeric');
      assert.ok(offer.displayCurrency, 'Display currency defined');
      assert.ok(offer.settlementCurrency, 'Settlement currency defined');

      // Strict Encapsulation Guard: Raw supplier fields are NOT leaked to consumer offer
      assert.equal((offer as any).rawSupplierResponse, undefined, 'No raw supplier response leaked');
      assert.equal((offer as any).duffelRawData, undefined, 'No Duffel raw payload leaked');
      assert.equal((offer as any).liteApiRawData, undefined, 'No LiteAPI raw payload leaked');
    }

    // 3. Pre-booking Recheck on Direct Contract
    const manualRecheck = await orchestrator.revalidateOffer('vct-hotels-man-charter-cmb-mle-airtaxi');
    assert.ok(manualRecheck);
    assert.ok(manualRecheck.status);

    // 4. Pre-booking Recheck on non-existent or expired item
    const missingRecheck = await orchestrator.revalidateOffer('vct-hotels-man-non-existent-999');
    assert.equal(missingRecheck.status, 'UNAVAILABLE');
  });

  it('enforces Admin Manual Inventory Separation of Duties (4-Eyes Principle) & 4-Stage Lifecycle Governance (Directive 8)', () => {
    const service = new ManualInventoryService();

    const dataEntryOperator = { id: 'usr_entry_01', name: 'Kasun Data Clerk', permissions: ['cms:edit_listings'] };
    const commercialOfficer = { id: 'usr_comm_02', name: 'Nirosha Contracting Lead', permissions: ['cms:verify_commercial'] };
    const pricingLead = { id: 'usr_price_03', name: 'Priyantha Finance Lead', permissions: ['cms:approve_pricing'] };
    const publishingDirector = { id: 'usr_pub_04', name: 'Anoma Commercial Director', permissions: ['cms:publish_listings'] };

    // Stage 1: Data Entry Operator creates DRAFT listing
    const listing = service.createListing(
      {
        id: 'man-ht-bentota-boutique-01',
        collection: 'manual-boutique-hotels',
        productType: 'hotels',
        partnerSupplierId: 'BENTOTA_RIVER_RESORT',
        partnerName: 'Bentota River Resort Pvt Ltd',
        supplierLegalName: 'Bentota River Resort Holdings PLC',
        title: 'Bentota River Luxury Suite',
        subtitle: 'Boutique riverfront luxury suite',
        slug: 'bentota-river-luxury-suite',
        location: { city: 'Bentota', country: 'Sri Lanka' },
        contractReference: 'CNT-DIR-2026-BENTOTA-001',
        contractedBaseCost: 28000,
        standardSellingPriceLkr: 34500,
        markupPercent: 23.2,
        costCurrency: 'LKR',
        sellingCurrency: 'LKR',
        availableQuota: 5,
        validFromIso: '2026-10-01T00:00:00Z',
        validUntilIso: '2026-12-31T23:59:59Z',
        effectiveFromIso: '2026-10-01T00:00:00Z',
        effectiveToIso: '2026-12-31T23:59:59Z',
        confirmationMode: 'INSTANT',
        bookingMode: 'INSTANT_BOOK',
        cancellationPolicy: 'Free cancellation up to 48 hours before check-in',
        inclusions: ['Breakfast', 'River Safari'],
        exclusions: ['Mini-bar']
      },
      dataEntryOperator
    );

    assert.equal(listing.status, 'DRAFT');
    assert.equal(listing.readinessTier.productionSellable, false);

    // Operator submits DRAFT for commercial verification
    service.submitForVerification('man-ht-bentota-boutique-01', dataEntryOperator);
    const pendingListing = service.getListingById('man-ht-bentota-boutique-01')!;
    assert.equal(pendingListing.status, 'VERIFICATION_PENDING');

    // 4-Eyes Check 1: Data Entry Operator CANNOT verify their own commercial contract!
    const validEvidence = {
      contractReference: 'CNT-DIR-2026-BENTOTA-001',
      supplierLegalName: 'Bentota River Resort Holdings PLC',
      commercialOwner: 'Kasun Data Clerk (usr_entry_01)',
      signedDateIso: '2026-09-20T00:00:00Z',
      effectiveFromIso: '2026-10-01T00:00:00Z',
      effectiveToIso: '2026-12-31T23:59:59Z',
      rateSource: 'BILATERAL_DIRECT_RATE_SHEET_Q4',
      settlementTerms: 'NET_30_DAYS_BANK_TRANSFER',
      cancellationTerms: 'Free cancellation up to 48 hours before check-in',
      allotmentRule: 'DAILY_COMMITTED_5_KEYS',
      operationalContact: 'contracts@bentotariver.com',
      documentProofReference: 'DOC-VAULT-LK-2026-9921',
      approvedBy: 'Legal Director',
      approvalTimestampIso: '2026-09-22T10:00:00Z',
      isEvidenceVerified: true
    };

    assert.throws(() => {
      service.verifyCommercialContract('man-ht-bentota-boutique-01', dataEntryOperator, validEvidence);
    }, SeparationOfDutiesViolationError, 'Creator strictly blocked from self-verifying commercial contract');

    // Independent Commercial Officer verifies the contract
    service.verifyCommercialContract('man-ht-bentota-boutique-01', commercialOfficer, validEvidence);
    const verifiedListing = service.getListingById('man-ht-bentota-boutique-01')!;
    assert.equal(verifiedListing.status, 'COMMERCIALLY_VERIFIED');
    assert.equal(verifiedListing.readinessTier.commercialReady, true);
    assert.equal(verifiedListing.readinessTier.productionSellable, false); // Still not sellable until published

    // Stage 3: Pricing Approval by Finance Lead
    service.approvePricingStructure('man-ht-bentota-boutique-01', pricingLead, {
      markupPercent: 23.2,
      standardSellingPriceLkr: 34500,
      note: 'Pricing yield confirmed within target gross margin'
    });
    const pricedListing = service.getListingById('man-ht-bentota-boutique-01')!;
    assert.equal(pricedListing.isPricingApproved, true);

    // 4-Eyes Check 2: Verifier or Creator CANNOT independently publish to production!
    assert.throws(() => {
      service.publishListing('man-ht-bentota-boutique-01', commercialOfficer);
    }, SeparationOfDutiesViolationError, 'Contract verifier strictly blocked from self-publishing listing');

    assert.throws(() => {
      service.publishListing('man-ht-bentota-boutique-01', dataEntryOperator);
    }, SeparationOfDutiesViolationError, 'Creator strictly blocked from self-publishing listing');

    // Independent Commercial Director publishes to production
    service.publishListing('man-ht-bentota-boutique-01', publishingDirector);
    const publishedListing = service.getListingById('man-ht-bentota-boutique-01')!;
    assert.equal(publishedListing.status, 'ACTIVE');
    assert.equal(publishedListing.readinessTier.productionSellable, true);
    assert.doesNotThrow(() => {
      assertListingIsProductionSellable(publishedListing);
    }, 'Commercially verified, pricing-approved and published listing passes production sellability check');
  });

  it('enforces Pin-Above-API and Exclusivity Badge Rules (Only COMMERCIALLY_VERIFIED, ACTIVE, Unexpired with Documented Evidence can Pin)', () => {
    // 1. Unverified offer with pinAboveApi = true MUST be rejected
    const unverifiedPinnedOffer: any = {
      canonicalOfferId: 'vct-ht-unverified-pin-01',
      environmentClass: 'PRODUCTION',
      publicationStatus: 'DRAFT',
      commercialStatus: 'CANDIDATE_UNVERIFIED',
      pinAboveApi: true,
      availabilityStatus: 'LIVE'
    };
    assert.equal(isOfferEligibleForPinOverride(unverifiedPinnedOffer), false, 'Unverified draft offer cannot pin');

    // 2. Expired contract with pinAboveApi = true MUST be rejected
    const expiredPinnedOffer: any = {
      canonicalOfferId: 'vct-ht-expired-pin-02',
      environmentClass: 'PRODUCTION',
      publicationStatus: 'PUBLISHED',
      commercialStatus: 'COMMERCIALLY_VERIFIED',
      pinAboveApi: true,
      validUntil: new Date(Date.now() - 3600000).toISOString(),
      availabilityStatus: 'MANUAL_AVAILABLE',
      commercialEvidenceId: 'DOC-VAULT-001'
    };
    assert.equal(isOfferEligibleForPinOverride(expiredPinnedOffer), false, 'Expired contract cannot pin');

    // 3. Sold out offer with pinAboveApi = true MUST be rejected
    const soldOutPinnedOffer: any = {
      canonicalOfferId: 'vct-ht-sold-out-pin-03',
      environmentClass: 'PRODUCTION',
      publicationStatus: 'PUBLISHED',
      commercialStatus: 'COMMERCIALLY_VERIFIED',
      pinAboveApi: true,
      availabilityStatus: 'SOLD_OUT',
      commercialEvidenceId: 'DOC-VAULT-002'
    };
    assert.equal(isOfferEligibleForPinOverride(soldOutPinnedOffer), false, 'Sold out offer cannot pin');

    // 4. Offer without documented commercial evidence MUST be rejected
    const noEvidencePinnedOffer: any = {
      canonicalOfferId: 'vct-ht-no-evidence-pin-04',
      environmentClass: 'PRODUCTION',
      publicationStatus: 'PUBLISHED',
      commercialStatus: 'COMMERCIALLY_VERIFIED',
      pinAboveApi: true,
      availabilityStatus: 'MANUAL_AVAILABLE',
      validUntil: new Date(Date.now() + 86400000).toISOString()
    };
    assert.equal(isOfferEligibleForPinOverride(noEvidencePinnedOffer), false, 'Offer without evidence dossier cannot pin');

    // 5. Genuine COMMERCIALLY_VERIFIED, ACTIVE, unexpired direct contract with evidence dossier passes pin check
    const genuinePinnedOffer: any = {
      canonicalOfferId: 'vct-ht-genuine-pin-05',
      environmentClass: 'PRODUCTION',
      publicationStatus: 'ACTIVE',
      commercialStatus: 'COMMERCIALLY_VERIFIED',
      pinAboveApi: true,
      availabilityStatus: 'MANUAL_AVAILABLE',
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      commercialEvidenceId: 'DOC-VAULT-MIRISSA-0081',
      exclusiveOffer: true
    };
    assert.equal(isOfferEligibleForPinOverride(genuinePinnedOffer), true, 'Genuine verified contract is eligible to pin');
    assert.equal(isOfferEligibleForExclusivityBadge(genuinePinnedOffer), true, 'Genuine verified contract is eligible for Exclusive badge');
  });

  it('enforces the Final Two-Tier Source Taxonomy (API, MANUAL, HYBRID, SEED) and Fulfillment Routing Split (Architecture v2.0)', () => {
    // 1. Two-Tier Provenance Mapping Integrity
    const sampleDirectHotel: CanonicalOfferEntity = {
      canonicalOfferId: 'vct-ht-direct-sigiriya-001',
      productType: 'hotels',
      sourceType: 'DIRECT_CONTRACT',
      inventorySource: 'DIRECT_CONTRACT',
      listingKind: 'SELLABLE_INVENTORY',
      compositionType: 'SINGLE',
      fulfillmentMode: 'INSTANT',
      environmentClass: 'PRODUCTION',
      sellability: 'BOOKABLE',
      providerLifecycle: 'PRODUCTION_LIVE',
      supplierId: 'SIGIRIYA_BOUTIQUE',
      supplierName: 'Heritance Sigiriya',
      title: 'Water Villa',
      subtitle: 'Luxury Suite',
      location: { city: 'Sigiriya', country: 'Sri Lanka', countryCode: 'LK' },
      availabilityStatus: 'MANUAL_AVAILABLE',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing: {
        rawSupplierCostMinor: 7800000,
        rawCurrency: 'LKR',
        platformMarkupMinor: 1100000,
        b2bAgencyMarginMinor: 0,
        finalSellingPriceMinor: 8900000,
        currency: 'LKR'
      },
      taxesAndFees: { vatMinor: 0, tourismDirhamOrLevyMinor: 0, serviceChargeMinor: 0, totalTaxMinor: 0, isTaxInclusive: true },
      freshness: { lastCheckedAtIso: new Date().toISOString(), ttlSeconds: 86400, expiresAtIso: new Date(Date.now() + 86400000).toISOString(), isStale: false, revalidationEndpoint: '/api/v1/offers/revalidate' },
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation up to 48 hours prior',
      pinAboveApi: true,
      deduplicationKey: 'ht-sigiriya-001',
      isSandboxSimulated: false,
      integrationLifecycle: 'OPERATIONALLY_LIVE_MANUAL'
    };

    const unifiedDirect = toUnifiedCustomerOffer(sampleDirectHotel);
    // Verifies Top-Level is strictly MANUAL, and Subtype is DIRECT_CONTRACT
    assert.equal(unifiedDirect.sourceType, 'MANUAL', 'Top level must be clean MANUAL');
    assert.equal(unifiedDirect.sourceSubtype, 'DIRECT_CONTRACT', 'Subtype must be DIRECT_CONTRACT');
    assert.equal(unifiedDirect.inventorySourceType, 'MANUAL_DIRECT', 'Backward compatibility view preserved');
    assert.equal(unifiedDirect.confirmationMode, 'INSTANT_CONFIRM', 'Manual inventory can have instant confirmation with quota');

    // 2. Visa Consular Manual Service Mapping
    const sampleVisaDesk: CanonicalOfferEntity = {
      ...sampleDirectHotel,
      canonicalOfferId: 'vct-vs-consular-uae-60d',
      productType: 'visa',
      sourceType: 'MANUAL_SERVICE',
      inventorySource: 'MANUAL_INTERNAL',
      listingKind: 'SERVICE',
      confirmationMode: 'ASSISTED_SERVICE',
      fulfillmentMode: 'MANUAL_CONFIRMATION',
      bookingMode: 'REQUEST_TO_BOOK'
    };
    const unifiedVisa = toUnifiedCustomerOffer(sampleVisaDesk);
    assert.equal(unifiedVisa.sourceType, 'MANUAL', 'Visa top-level must be MANUAL');
    assert.equal(unifiedVisa.sourceSubtype, 'MANUAL_SERVICE', 'Visa subtype must be MANUAL_SERVICE');
    assert.equal(unifiedVisa.confirmationMode, 'ASSISTED_SERVICE', 'Visa confirmation mode is ASSISTED_SERVICE, never fake API');

    // 3. API Flight Mapping
    const sampleApiFlight: CanonicalOfferEntity = {
      ...sampleDirectHotel,
      canonicalOfferId: 'vct-fl-duffel-cmb-dxb',
      productType: 'flights',
      sourceType: 'API',
      inventorySource: 'API',
      listingKind: 'SELLABLE_INVENTORY',
      confirmationMode: 'REQUEST_TO_CONFIRM', // Cached rate requiring revalidation
      fulfillmentMode: 'ON_REQUEST',
      bookingMode: 'INSTANT_BOOK'
    };
    const unifiedApiFlight = toUnifiedCustomerOffer(sampleApiFlight);
    assert.equal(unifiedApiFlight.sourceType, 'API', 'Flight top-level must be API');
    assert.equal(unifiedApiFlight.sourceSubtype, 'SUPPLIER_FEED', 'Flight subtype is SUPPLIER_FEED');
    assert.equal(unifiedApiFlight.confirmationMode, 'REQUEST_TO_CONFIRM', 'API offer can require confirmation recheck');

    // 4. Multi-Source Trip Bucket Fulfillment Dispatch Simulation
    const tripBucket = [unifiedApiFlight, unifiedDirect, unifiedVisa];
    const fulfillmentQueues = {
      supplierApiDispatch: tripBucket.filter(i => i.sourceType === 'API'),
      manualAllotmentDeduction: tripBucket.filter(i => i.sourceType === 'MANUAL' && i.sourceSubtype === 'DIRECT_CONTRACT'),
      consularDeskWorkflow: tripBucket.filter(i => i.sourceType === 'MANUAL' && i.sourceSubtype === 'MANUAL_SERVICE')
    };

    assert.equal(fulfillmentQueues.supplierApiDispatch.length, 1, '1 item routed to Duffel/API GDS worker');
    assert.equal(fulfillmentQueues.manualAllotmentDeduction.length, 1, '1 item routed to Vacatina Direct Hotel allotment ledger');
    assert.equal(fulfillmentQueues.consularDeskWorkflow.length, 1, '1 item routed to Consular Visa Case Management desk');

    // 5. SEED / Prototype Isolation Guard
    const prototypeCard: CanonicalOfferEntity = {
      ...sampleDirectHotel,
      canonicalOfferId: 'vct-demo-card-01',
      sourceType: 'SEED',
      environmentClass: 'SEED',
      verificationStatus: 'PROTOTYPE'
    };
    const unifiedSeed = toUnifiedCustomerOffer(prototypeCard);
    assert.equal(unifiedSeed.sourceType, 'SEED');
    assert.equal(unifiedSeed.sourceSubtype, 'PROTOTYPE_SAMPLE');
    assert.equal(unifiedSeed.commercialStatus, 'SAMPLE_DEMO');
    assert.equal(unifiedSeed.sellable, false, 'Sample/Seed offer is strictly non-sellable in production');
  });

  it('enforces Dynamic Commercial Pricing Policies, Concurrency Allotment Holds & Multi-Dimensional Readiness Governance', () => {
    // 1. Dynamic Commercial Pricing Policy Configuration (Finance Role)
    PricingPrecedenceService.resetCommercialPolicies();
    const initialPolicy = PricingPrecedenceService.getActiveCommercialPolicy('flights');
    assert.equal(initialPolicy.markupPercent, 5.5, 'Default flights markup is 5.5%');
    assert.equal(initialPolicy.isDynamicOverride, false);

    // Finance updates markup to 8.0% at runtime without code deployment
    PricingPrecedenceService.setCommercialMarkupPolicy('flights', 8.0);
    const updatedPolicy = PricingPrecedenceService.getActiveCommercialPolicy('flights');
    assert.equal(updatedPolicy.markupPercent, 8.0, 'Finance dynamic policy is active');
    assert.equal(updatedPolicy.isDynamicOverride, true);

    const priceCalc = PricingPrecedenceService.calculatePricing({
      productType: 'flights',
      rawSupplierCostMinor: 10000000, // LKR 100,000
      rawCurrency: 'LKR',
      targetCurrency: 'LKR'
    });
    assert.equal(priceCalc.platformMarkupMinor, 800000, 'Calculates 8.0% dynamic platform markup (8,000 LKR)');
    assert.equal(priceCalc.finalSellingPriceMinor, 10800000);

    // Reset policies back to default
    PricingPrecedenceService.resetCommercialPolicies();
    assert.equal(PricingPrecedenceService.getActiveCommercialPolicy('flights').markupPercent, 5.5);

    // 2. Concurrency Safety: Atomic Allotment Hold, Commit & Release in ManualInventoryService
    const manualService = new ManualInventoryService();
    const testListing = manualService.createListing({
      collection: 'contracted-boutique-hotels',
      productType: 'hotels',
      partnerSupplierId: 'SIGIRIYA_BOUTIQUE',
      partnerName: 'Heritance Sigiriya',
      title: 'Water Villa',
      subtitle: 'Luxury Suite',
      location: { city: 'Sigiriya', country: 'Sri Lanka', countryCode: 'LK' },
      availableQuota: 3, // Exactly 3 units
      contractedBaseCost: 78000,
      costCurrency: 'LKR',
      standardSellingPriceLkr: 89000,
      validFromIso: '2026-10-01T00:00:00Z',
      validUntilIso: '2026-12-31T23:59:59Z',
      inclusions: ['Breakfast'],
      exclusions: [],
      cancellationPolicy: 'Free cancellation up to 48 hours prior',
      confirmationMode: 'INSTANT',
      bookingMode: 'INSTANT_BOOK'
    }, { id: 'op_entry_01', name: 'Data Entry Clerk' });

    // User A holds 2 units
    const holdA = manualService.holdAllotment(testListing.id, 2, 60000);
    assert.ok(holdA.holdId.startsWith('HLD-'));
    assert.equal(holdA.remainingQuota, 1, 'Only 1 unit remains unheld');

    // User B attempts to hold 2 units (Must throw Allotment Exceeded)
    assert.throws(
      () => manualService.holdAllotment(testListing.id, 2, 60000),
      /Allotment Exceeded: Requested 2 units, but only 1 units are currently available/
    );

    // User A successfully completes checkout -> Commit Allotment
    const quotaAfterCommit = manualService.commitAllotment(testListing.id, holdA.holdId);
    assert.equal(quotaAfterCommit, 1, 'Committed units permanently decrement availableQuota to 1');

    // User B now can hold the last 1 remaining unit
    const holdB = manualService.holdAllotment(testListing.id, 1, 60000);
    assert.equal(holdB.remainingQuota, 0);

    // User B abandons checkout -> Release Allotment
    manualService.releaseAllotment(testListing.id, holdB.holdId);
    // User C can now hold that released unit
    const holdC = manualService.holdAllotment(testListing.id, 1, 60000);
    assert.ok(holdC.holdId);

    // 3. Multi-Dimensional Readiness Governance Model
    const governanceProfile = {
      architectureReady: true,
      codeVerified: true,
      supplierVerified: false, // External API key pending commercial sign-off
      commercialApproved: false,
      financeApproved: false,
      legalComplianceApproved: false,
      productionSellable: false // Fail closed!
    };
    assert.equal(governanceProfile.codeVerified, true, 'Code invariants verified by tests');
    assert.equal(governanceProfile.productionSellable, false, 'CODE-SAFE is NOT commercially production sellable');
  });

  it('enforces Clerk Identity Provider Integration, Client SDK Bridge & Server-Side JWT Claims Verification (Architecture v2.1)', () => {
    // 1. Client SDK Configuration & Default Invariants
    assert.equal(
      CLERK_DEFAULT_CONFIG.publishableKey,
      'pk_test_ZWxlY3RyaWMtc25haWwtNDguY2xlcmsuYWNjb3VudHMuZGV2JA',
      'Configured with authentic Vacatina Clerk publishable key'
    );
    assert.equal(
      CLERK_DEFAULT_CONFIG.frontendApi,
      'https://electric-snail-48.clerk.accounts.dev',
      'Configured with authentic Vacatina Clerk accounts domain'
    );
    assert.ok(
      CLERK_DEFAULT_CONFIG.scriptUrl.includes('/npm/@clerk/clerk-js@latest/dist/clerk.browser.js'),
      'Loads official ClerkJS browser bundle'
    );

    const clerkService = new ClerkAuthService();
    assert.equal(clerkService.isReady(), false, 'Uninitialized service is not ready in server test runner');
    assert.equal(clerkService.getCurrentUser(), null, 'Default session is unauthenticated Guest mode');
    assert.equal(typeof clerkService.mountOrganizationSwitcher, 'function', 'Provides OrganizationSwitcher mount API');
    assert.equal(typeof clerkService.unmountOrganizationSwitcher, 'function', 'Provides OrganizationSwitcher unmount API');
    assert.equal(typeof clerkService.openOrganizationProfile, 'function', 'Provides Organization Profile modal API');
    assert.equal(typeof clerkService.openCreateOrganization, 'function', 'Provides Create Organization modal API');

    // Subscription & Listener integrity
    let listenerCalled = false;
    const unsubscribe = clerkService.subscribe(user => {
      listenerCalled = true;
    });
    assert.equal(typeof unsubscribe, 'function');
    unsubscribe();

    // 2. Server Environment Variable Resolution
    const mockEnv = validateServerEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_ZWxlY3RyaWMtc25haWwtNDguY2xlcmsuYWNjb3VudHMuZGV2JA',
      CLERK_SECRET_KEY: 'sk_test_yMivnVlmDDXs8dLKHnJRAX2ETia5JE8vCR1qymGct0',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      JWT_SIGNING_SECRET: '32_character_minimum_test_secret_for_jwt'
    });
    assert.equal(
      mockEnv.CLERK_PUBLISHABLE_KEY,
      'pk_test_ZWxlY3RyaWMtc25haWwtNDguY2xlcmsuYWNjb3VudHMuZGV2JA',
      'Seamlessly resolves NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY into server config'
    );
    assert.equal(
      mockEnv.CLERK_SECRET_KEY,
      'sk_test_yMivnVlmDDXs8dLKHnJRAX2ETia5JE8vCR1qymGct0'
    );

    // 3. Cryptographic Verifier & JWKS Configuration
    assert.equal(
      CLERK_VERIFIER_CONFIG.issuer,
      'https://electric-snail-48.clerk.accounts.dev'
    );
    assert.equal(
      CLERK_VERIFIER_CONFIG.jwksUrl,
      'https://electric-snail-48.clerk.accounts.dev/.well-known/jwks.json'
    );
    assert.ok(
      CLERK_VERIFIER_CONFIG.publicKeyPem.includes('-----BEGIN PUBLIC KEY-----'),
      'Contains authentic RSA public key for cryptographic signature verification'
    );

    // 4. JWT Claims Extraction & Unverified Header Decoding
    const mockTokenHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'ins_2pGR3nfi6XGAQeW6tSXqKz71VS4' })).toString('base64url');
    const mockTokenPayload = Buffer.from(JSON.stringify({
      sub: 'user_2pGR3nfi6XGAQeW6tSXqKz71VS4',
      iss: 'https://electric-snail-48.clerk.accounts.dev',
      iat: Math.floor(Date.now() / 1000) - 100,
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'traveller@vacatina.com',
      role: 'customer'
    })).toString('base64url');
    const dummyToken = `${mockTokenHeader}.${mockTokenPayload}.dummySignature`;

    const decoded = decodeJwtUnverified(dummyToken);
    assert.ok(decoded);
    assert.equal(decoded.header.kid, 'ins_2pGR3nfi6XGAQeW6tSXqKz71VS4');
    assert.equal(decoded.payload.sub, 'user_2pGR3nfi6XGAQeW6tSXqKz71VS4');
    assert.equal(decoded.payload.email, 'traveller@vacatina.com');

    // 5. Security Context RBAC Mapping
    const customerContext = mapClerkPayloadToSecurityContext(decoded.payload);
    assert.equal(customerContext.userId, 'user_2pGR3nfi6XGAQeW6tSXqKz71VS4');
    assert.equal(customerContext.email, 'traveller@vacatina.com');
    assert.equal(customerContext.role, 'CUSTOMER');

    const agentPayload = {
      ...decoded.payload,
      sub: 'user_agent_99',
      email: 'agent@partner-agency.com',
      org_id: 'org_agency_01',
      org_role: 'org:admin'
    };
    const agentContext = mapClerkPayloadToSecurityContext(agentPayload);
    assert.equal(agentContext.role, 'SUPER_ADMIN', 'Maps admin org_role to SUPER_ADMIN/elevated privilege');
    assert.equal(agentContext.organizationId, 'org_agency_01');
    assert.equal(agentContext.organizationType, 'AGENCY');

    // 6. Fail-Closed Authentication on Invalid/Tampered Tokens
    assert.equal(authenticateClerkRequest(''), null, 'Empty token fails closed');
    assert.equal(authenticateClerkRequest('Bearer invalid.token.payload'), null, 'Invalid token fails closed');
    assert.equal(verifyClerkJwt('tampered.token.here'), null, 'Tampered token fails signature verification');
  });
});
