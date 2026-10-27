import test from 'node:test';
import assert from 'node:assert/strict';
import { visaContextFromQuery, validateVisaContext, visaContextQuery } from '../src/features/visa/domain/visa-journey.ts';
import { visaSearchService } from '../src/features/visa/services/visa-search.service.ts';
import { visaTripBucketService } from '../src/features/visa/services/visa-trip-bucket.service.ts';
import { tripBucketService } from '../src/lib/services/trip-bucket.service.ts';
import { evaluateTripReviewHandoff } from '../src/features/trip-review/trip-review-workspace.ts';

const context = () => visaContextFromQuery(new URLSearchParams('destination=United+Arab+Emirates&citizenship=LK&residenceCountry=LK&departureDate=2027-02-01&purpose=tourism&applicants=2'));
test('Visa Phase 7: eligibility context validation and canonical round-trip', () => {
  assert.deepEqual(validateVisaContext(context()), []);
  assert.equal(visaContextFromQuery(new URLSearchParams(visaContextQuery(context()))).adults, 2);
  for (const key of ['destination', 'citizenshipCountry', 'residenceCountry', 'departureDate', 'purpose'] as const) assert.ok(validateVisaContext({ ...context(), [key]: '' }).length);
  assert.ok(validateVisaContext({ ...context(), adults: 0 }).length);
});
test('Visa Phase 7: canonical option, no-option and strict invalid identity', async () => {
  assert.ok(await visaSearchService.getOfferById('vct-vs-consular-ae-30d'));
  assert.equal(await visaSearchService.getOfferById('vct'), null);
  const empty = await visaSearchService.search({ destinationCountry: 'No-Such-Country', citizenshipCountry: 'Sri Lanka', citizenshipCountryCode: 'LK', purpose: 'tourist' });
  assert.equal(empty.offers.length, 0);
});
test('Visa Phase 7: local applicant request preserves context but never claims upload, approval or readiness', async () => {
  tripBucketService.replaceCandidates([]);
  const raw = await visaSearchService.getOfferById('vct-vs-consular-ae-30d'); assert.ok(raw);
  const offer = { ...raw, inventoryMode: 'demo_fixture' as const };
  const config = { visaId: offer.visaId, canonicalOfferId: offer.canonicalOfferId, countryName: offer.countryName, countryCode: offer.countryCode, visaType: offer.title, category: offer.category, entryType: offer.entryType, durationDays: offer.durationDays, processingSlaDays: offer.processingSlaBusinessDays, travelDate: context().departureDate, journeyContext: context(), pricing: offer.pricing, sourceType: offer.sourceType, supplierName: offer.supplierName, applicant: { fullName: '', passportNumber: '', passportExpiryDate: '', nationality: 'LK', email: '', phone: '', travelDate: context().departureDate, uploadedDocumentCount: 99 } };
  const { candidate } = await visaTripBucketService.stageVisaApplication(offer, config);
  assert.equal(candidate.state, 'needs_action');
  assert.equal(candidate.priceLkr, offer.pricing.totalPriceMinor * 2 / 100);
  assert.equal(candidate.configuration?.citizenshipCountry, 'LK');
  assert.equal(candidate.configuration?.applicationState, 'LOCAL_REQUEST_NOT_SUBMITTED');
  assert.equal(candidate.configuration?.documentUploadState, 'NOT_UPLOADED');
  assert.equal(tripBucketService.getItems()[0].offerId, offer.canonicalOfferId);
  assert.equal(tripBucketService.resolveItemAction(candidate.id)?.state, 'needs_action');
  assert.equal(evaluateTripReviewHandoff([candidate]).canCheckout, false);
});
