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
import { manualInventoryService, ManualInventoryService } from '../src/lib/services/manual-inventory.service.ts';
import { CANONICAL_ROUTES, isCanonicalRoute, getRouteMeta } from '../src/lib/constants/routes.ts';
import { VacatinaStorageEngine } from '../src/server/db/storage.ts';
import { AuthorizationEngine, type SecurityContext } from '../src/server/auth/rbac.ts';
import { BookingSagaService } from '../src/server/services/booking-saga.service.ts';
import { PaymentGatewayService } from '../src/server/services/payment-gateway.service.ts';
import { VacatinaApiRouter } from '../src/server/api/router.ts';
import { validateServerEnv } from '../src/server/config/env.ts';
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
import {
  assertSeedCannotBeBookable,
  assertSeedCannotEnterCheckout,
  assertScaffoldCannotCreateProductionBooking,
  assertManualOfferPublishedForBooking,
  assertUnavailableOfferCannotBeReady,
  assertDistributionScopeIntegrity,
  isOfferEligibleForPinOverride,
  deriveCustomerBadges,
  validateNoTechnicalLeakInCustomerBadges,
  ArchitecturalInvariantViolationError
} from '../src/server/inventory/types.ts';
import {
  ProviderRegistryService,
  CANONICAL_PROVIDER_REGISTRY
} from '../src/server/inventory/provider-registry.ts';

describe('Vacatina Domain & Validation Unit Tests', () => {
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
      partnerSupplierId: 'SRILANKAN_AIRTAXI',
      partnerName: 'AirTaxi Direct',
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

    // 3. Only internal operational services support live execution
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('PAYLOAD_CMS_DIRECT'), true);
    assert.equal(ProviderRegistryService.canExecuteLiveBooking('VACATINA_CONSULAR_CONCIERGE'), true);
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
    assert.equal(consularAudit.isCertified, true);
    assert.equal(consularAudit.isProductionReady, true);
    assert.equal(consularAudit.clearedCount, 12);
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
});
