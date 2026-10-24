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
    assert.ok(si?.regionHint.includes('Prototype Localization'));
    assert.ok(ta?.regionHint.includes('Prototype Localization'));
    assert.ok(ar?.regionHint.includes('Architecture Ready'));
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
});
