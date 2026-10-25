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
});
