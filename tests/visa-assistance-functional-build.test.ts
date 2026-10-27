/* ============================================================================
 * Vacatina Consular Visa Full Functional Build Automated Unit & Domain Test Suite
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POPULAR_VISA_DESTINATIONS,
  resolveVisaRequirement
} from '../src/features/visa/data/destinations.ts';

import { MANUAL_VISA_SERVICES } from '../src/features/visa/data/manual-visas.ts';
import { ManualVisaAdapter } from '../src/features/visa/adapters/manual-visa.adapter.ts';
import { visaSearchService } from '../src/features/visa/services/visa-search.service.ts';
import { visaTripBucketService } from '../src/features/visa/services/visa-trip-bucket.service.ts';
import { visaFavoritesService } from '../src/features/visa/services/visa-favorites.service.ts';
import type { VisaSearchCriteria } from '../src/features/visa/domain/visa-search-models.ts';
import type { VisaSelectedConfiguration } from '../src/features/visa/domain/visa-models.ts';

test('Vacatina Consular Visa Full Functional Build Suite (Phase 3.3)', async (t) => {
  // 1. Destination Registry & Consular Rules
  await t.test('Visa Gate 1: Destination Registry & Entry Rule Resolution', () => {
    assert.ok(POPULAR_VISA_DESTINATIONS.length >= 8, 'Must have at least 8 popular visa destinations');

    // Sri Lankan to UAE: e-Visa Available
    const uaeRule = resolveVisaRequirement('LK', 'AE');
    assert.equal(uaeRule.destinationCountryCode, 'AE');
    assert.equal(uaeRule.citizenshipCountryCode, 'LK');
    assert.equal(uaeRule.status, 'EVISA_AVAILABLE');
    assert.ok(uaeRule.slaDaysMin >= 2 && uaeRule.slaDaysMax <= 4);
    assert.equal(uaeRule.isSupportedByDesk, true);

    // Sri Lankan to UK: Biometric Visa Required
    const ukRule = resolveVisaRequirement('LK', 'GB');
    assert.equal(ukRule.destinationCountryCode, 'GB');
    assert.equal(ukRule.status, 'VISA_REQUIRED');
    assert.ok(ukRule.description.includes('VFS'));

    // Sri Lankan to Singapore: e-Visa Required via authorized desk
    const sgRule = resolveVisaRequirement('LK', 'SG');
    assert.equal(sgRule.destinationCountryCode, 'SG');
    assert.equal(sgRule.status, 'EVISA_AVAILABLE');
  });

  await t.test('Visa Gate 2: Sovereign Citizen Exemption (Same-Country Check)', () => {
    const lkInLk = resolveVisaRequirement('LK', 'LK');
    assert.equal(lkInLk.status, 'VISA_FREE');
    assert.ok(lkInLk.statusLabel.includes('Citizen'));
    assert.equal(lkInLk.isSupportedByDesk, false);
  });

  // 2. Direct Manual Consular Services Integrity
  await t.test('Visa Gate 3: Direct Manual Consular Catalog Integrity & Commercial Truth', () => {
    assert.ok(MANUAL_VISA_SERVICES.length >= 6, 'Must have at least 6 active consular services');

    for (const service of MANUAL_VISA_SERVICES) {
      assert.equal(service.sourceType, 'MANUAL');
      assert.equal(service.providerId, 'VACATINA_CONSULAR_DESK');
      assert.equal(service.isPinnedAboveApi, true, 'Direct consular desk must be pinned above API');
      assert.equal(service.isSeed, false, 'Bookable consular services must NOT be seed content');
      assert.ok(service.canonicalOfferId.startsWith('vct-vs-consular-'), 'Must have canonical stable offer ID');
      assert.ok(service.processingSlaBusinessDays > 0, 'SLA must be positive number of days');
      assert.ok(service.documentChecklist.length >= 2, 'Must have at least 2 required documents');

      // Transparent pricing breakdown
      const { embassyFeeMinor, vacatinaConciergeFeeMinor, totalPriceMinor } = service.pricing;
      assert.ok(embassyFeeMinor > 0, 'Must have sovereign consular fee');
      assert.ok(vacatinaConciergeFeeMinor > 0, 'Must have Vacatina concierge vetting fee');
      assert.equal(totalPriceMinor, embassyFeeMinor + vacatinaConciergeFeeMinor, 'Total must equal sum of fees');
    }
  });

  // 3. Document Checklist & Compliance
  await t.test('Visa Gate 4: Mandatory Document Checklist & Specifications', () => {
    const uae30d = MANUAL_VISA_SERVICES.find(s => s.visaId === 'vs-ae-tourist-30d');
    assert.ok(uae30d);
    
    const passportDoc = uae30d!.documentChecklist.find(d => d.id === 'doc-passport-bio');
    assert.ok(passportDoc);
    assert.equal(passportDoc!.isRequired, true);
    assert.ok(passportDoc!.acceptedFormats.includes('PDF'));

    const photoDoc = uae30d!.documentChecklist.find(d => d.id === 'doc-photo');
    assert.ok(photoDoc);
    assert.equal(photoDoc!.isRequired, true);
  });

  // 4. Manual Visa Adapter
  await t.test('Visa Gate 5: Manual Visa Adapter Search & Offer Retrieval', async () => {
    const adapter = new ManualVisaAdapter();
    assert.equal(adapter.isOperationallyLive, true);

    // Search by country
    const uaeOffers = await adapter.search({
      destinationCountry: 'United Arab Emirates',
      destinationCountryCode: 'AE',
      citizenshipCountry: 'Sri Lanka',
      purpose: 'tourist'
    });
    assert.ok(uaeOffers.length >= 2, 'Must return at least UAE 30d and 60d offers');
    assert.ok(uaeOffers.every(o => o.countryCode === 'AE'));

    // Get offer by canonical ID
    const offer = await adapter.getOffer('vct-vs-consular-ae-30d');
    assert.ok(offer);
    assert.equal(offer!.countryCode, 'AE');

    // Revalidation
    const reval = await adapter.revalidate('vct-vs-consular-ae-30d');
    assert.equal(reval.isValid, true);
    assert.equal(reval.isPriceChanged, false);
    assert.equal(reval.newPriceMinor, 3850000);
  });

  // 5. Universal Search Orchestrator
  await t.test('Visa Gate 6: Visa Search Orchestrator Facets & Pin-Above-API Ranking', async () => {
    const criteria: VisaSearchCriteria = {
      destinationCountry: 'United Arab Emirates',
      citizenshipCountry: 'Sri Lanka',
      purpose: 'all'
    };

    const response = await visaSearchService.search(criteria);
    assert.ok(response.searchId.startsWith('visa-srch-'));
    assert.ok(response.offers.length >= 2);
    assert.equal(response.requirementRule.status, 'EVISA_AVAILABLE');
    assert.ok(response.facets.categoryCounts['TOURIST_EVISA'] >= 1);
    assert.ok(response.facets.minPriceMinor > 0);

    // Pin-above-API ranking invariant
    assert.equal(response.offers[0].isPinnedAboveApi, true);
  });

  // 6. Filtering Support
  await t.test('Visa Gate 7: Faceted Filtering by Category and Turnaround SLA', async () => {
    const response = await visaSearchService.search({
      destinationCountry: '',
      citizenshipCountry: 'Sri Lanka',
      purpose: 'all'
    });

    // Filter by e-Visa only
    const evisaOnly = visaSearchService.filterOffers(response.offers, {
      categories: ['TOURIST_EVISA']
    });
    assert.ok(evisaOnly.length >= 3);
    assert.ok(evisaOnly.every(o => o.category === 'TOURIST_EVISA'));

    // Filter by Express (<= 2 days)
    const expressOnly = visaSearchService.filterOffers(response.offers, {
      maxSlaDays: 2
    });
    assert.ok(expressOnly.length >= 1);
    assert.ok(expressOnly.every(o => o.processingSlaBusinessDays <= 2));
  });

  // 7. Trip Bucket Staging & Candidate Mapping
  await t.test('Visa Gate 8: Trip Bucket Staging with 8-State Governance', async () => {
    const offer = await visaSearchService.getOfferById('vct-vs-consular-ae-30d');
    assert.ok(offer);

    // Case A: Missing documents -> needs_action
    const configNeedsAction: VisaSelectedConfiguration = {
      visaId: offer!.visaId,
      canonicalOfferId: offer!.canonicalOfferId,
      countryName: offer!.countryName,
      countryCode: offer!.countryCode,
      visaType: offer!.title,
      category: offer!.category,
      entryType: offer!.entryType,
      durationDays: offer!.durationDays,
      processingSlaDays: offer!.processingSlaBusinessDays,
      travelDate: '2026-12-01',
      applicant: {
        fullName: 'Test Traveler',
        passportNumber: 'N1234567',
        passportExpiryDate: '2030-01-01',
        nationality: 'Sri Lankan (LKA)',
        email: 'traveler@test.com',
        phone: '+94 77 123 4567',
        travelDate: '2026-12-01',
        uploadedDocumentCount: 0 // No documents attached yet
      },
      pricing: offer!.pricing,
      sourceType: offer!.sourceType,
      supplierName: offer!.supplierName
    };

    const candidate1 = visaTripBucketService.mapVisaOfferToTripCandidate(offer!, configNeedsAction);
    assert.equal(candidate1.state, 'needs_action');
    assert.equal(candidate1.productType, 'visa');
    assert.equal(candidate1.primaryActionLabel, 'Submit Documents');
    assert.ok(candidate1.actionRequiredText!.includes('passport scan'));

    // Case B: Documents uploaded -> ready
    const configReady: VisaSelectedConfiguration = {
      ...configNeedsAction,
      applicant: {
        ...configNeedsAction.applicant,
        uploadedDocumentCount: 2 // Passport and Photo uploaded
      }
    };

    const candidate2 = visaTripBucketService.mapVisaOfferToTripCandidate(offer!, configReady);
    assert.equal(candidate2.state, 'ready');
  });

  // 8. Pre-Staging Revalidation Guard
  await t.test('Visa Gate 9: Pre-Staging Revalidation Guard', async () => {
    const offer = await visaSearchService.getOfferById('vct-vs-consular-ae-30d');
    assert.ok(offer);

    const config: VisaSelectedConfiguration = {
      visaId: offer!.visaId,
      canonicalOfferId: offer!.canonicalOfferId,
      countryName: offer!.countryName,
      countryCode: offer!.countryCode,
      visaType: offer!.title,
      category: offer!.category,
      entryType: offer!.entryType,
      durationDays: offer!.durationDays,
      processingSlaDays: offer!.processingSlaBusinessDays,
      travelDate: '2026-12-01',
      applicant: {
        fullName: 'Test Traveler',
        passportNumber: 'N9999999',
        passportExpiryDate: '2030-01-01',
        nationality: 'Sri Lankan (LKA)',
        email: 'test@example.com',
        phone: '+94 77 000 0000',
        travelDate: '2026-12-01',
        uploadedDocumentCount: 2
      },
      pricing: offer!.pricing,
      sourceType: offer!.sourceType,
      supplierName: offer!.supplierName
    };

    const stageResult = await visaTripBucketService.stageVisaApplication(offer!, config);
    assert.equal(stageResult.success, true);
    assert.equal(stageResult.candidate.state, 'ready');
    assert.equal(stageResult.candidate.priceLkr, 38500);
  });

  // 9. Negative Test: Strict SEED Quarantine
  await t.test('Visa Gate 10 (Negative Test): Strict SEED Quarantine', async () => {
    const results = await visaSearchService.search({
      destinationCountry: 'United Arab Emirates',
      citizenshipCountry: 'Sri Lanka',
      purpose: 'all'
    });

    for (const offer of results.offers) {
      assert.notEqual((offer as any).isSeed, true, 'SEED content must be quarantined from customer search');
      assert.equal(offer.isSeed, false);
    }
  });

  // 10. Saved Favorites Service
  await t.test('Visa Gate 11: Favorites Service Integration (Decoupled from Staged)', () => {
    const offer = MANUAL_VISA_SERVICES[0];
    const isSaved = visaFavoritesService.toggleVisaFavorite(offer);
    assert.equal(typeof isSaved, 'boolean');
    assert.equal(visaFavoritesService.isVisaSaved(offer.visaId), isSaved);
  });
});
