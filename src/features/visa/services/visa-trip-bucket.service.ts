/* ============================================================================
 * Vacatina Visa Trip Bucket Integration Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Invariants:
 * 1. Transforms CanonicalVisaOffer + VisaSelectedConfiguration into TripBucketCandidate.
 * 2. Enforces the canonical 8-state Trip Bucket candidate engine.
 * 3. Never stages SEED items; only bookable manual/API inventory.
 * 4. Staged as 'review' (requires document upload/vetting) or 'ready'.
 * ============================================================================ */

import type {
  TripBucketCandidate,
  TripBucketItemState
} from '../../../lib/domain/types.ts';
import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';
import type {
  CanonicalVisaOffer,
  VisaSelectedConfiguration
} from '../domain/visa-models.ts';
import { visaSearchService } from './visa-search.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { VISA_DEMO_DISCLOSURE, validateVisaContext } from '../domain/visa-journey.ts';

export class VisaTripBucketService {
  public mapVisaOfferToTripCandidate(
    visa: CanonicalVisaOffer,
    config: VisaSelectedConfiguration,
    overrideState?: TripBucketItemState
  ): TripBucketCandidate {
    const priceLkr = Math.round(config.pricing.totalPriceMinor / 100);
    const title = `${visa.flagEmoji} ${visa.title}`;
    const subtitle = `${config.category.replace('_', ' ')} · ${config.durationDays} Days (${config.entryType.replace('_', ' ')})`;
    const dateSummary = config.travelDate ? `Planned Departure: ${config.travelDate}` : 'Departure: Open / Flexible';
    const applicantName = config.applicant.fullName || 'Primary Applicant';
    const travellerSummary = `Applicant: ${applicantName} (${config.applicant.passportNumber ? `Passport: ${config.applicant.passportNumber}` : 'Passport Pending'})`;

    const hasDocs = (config.applicant.uploadedDocumentCount || 0) >= 2;
    let state: TripBucketItemState = overrideState || (hasDocs ? 'ready' : 'needs_action');
    let holdStatusText = `Consular submission hold: SLA ${visa.processingSlaBusinessDays} Business Days`;
    let actionRequiredText: string | undefined;
    let primaryActionLabel = 'Upload Documents';

    if (overrideState) {
      state = overrideState;
    } else if (state === 'needs_action') {
      actionRequiredText = 'Upload required passport scan & white-background photograph';
      primaryActionLabel = 'Submit Documents';
      holdStatusText = 'Document vetting pending';
    } else if (visa.availabilityStatus === 'PRICE_CHANGED') {
      state = 'price_changed';
      actionRequiredText = 'Consular/embassy fee adjusted by immigration department';
      primaryActionLabel = 'Accept New Fee';
      holdStatusText = 'Fee revision pending applicant confirmation';
    } else if (visa.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
      actionRequiredText = 'Consular filing window has lapsed';
      primaryActionLabel = 'Refresh Visa Service';
      holdStatusText = 'Expired';
    } else if (visa.availabilityStatus === 'UNAVAILABLE') {
      state = 'unavailable';
      actionRequiredText = 'Consular submissions temporarily suspended by embassy';
      primaryActionLabel = 'Select Alternative Service';
      holdStatusText = 'Embassy window closed';
    }

    if (visa.inventoryMode || config.journeyContext) {
      state = state === 'ready' ? 'needs_action' : state;
      holdStatusText = 'Local request only · No application submitted';
      actionRequiredText = 'Eligibility, documents and current fees require manual review. No documents were uploaded or filed.';
      primaryActionLabel = 'Review assistance request';
    }
    return {
      id: `tb-${visa.canonicalOfferId}-${config.applicant.passportNumber || 'pending'}-${Date.now()}`,
      productType: 'visa',
      productLabel: 'Visa Assistance',
      title,
      subtitle,
      dateSummary,
      travellerSummary,
      priceLkr,
      state,
      actionRequiredText,
      primaryActionLabel,
      holdStatusText,
      supplierName: visa.supplierName,
      integrationMode: 'ADAPTER-READY',
      offerId: visa.canonicalOfferId,
      sourceType: visa.sourceType,
      confirmationMode: visa.inventoryMode || config.journeyContext ? 'REQUEST_TO_CONFIRM' : 'ASSISTED_SERVICE',
      inventoryMode: visa.inventoryMode || (config.journeyContext ? 'demo_fixture' : undefined),
      inventoryLabel: visa.inventoryMode || config.journeyContext ? 'Canonical visa demo · Manual review required' : undefined,
      canonicalOfferId: visa.canonicalOfferId,
      sourceId: visa.providerId,
      providerName: `${visa.supplierName} (catalog reference)`,
      truthDisclosure: visa.inventoryMode || config.journeyContext ? VISA_DEMO_DISCLOSURE : undefined,
      configuration: config.journeyContext ? { ...config.journeyContext, eligibilityState: 'MANUAL_REVIEW_REQUIRED', applicationState: 'LOCAL_REQUEST_NOT_SUBMITTED', documentUploadState: 'NOT_UPLOADED' } : undefined,
      currency: config.pricing.currency,
      revalidationStatus: 'LOCAL_CATALOG_CHECK',
      lastCheckedAt: visa.lastCheckedAt,
      validUntil: visa.validUntil,
      rawSupplierPrice: config.pricing.embassyFeeMinor / 100,
      supplierBaseCurrency: config.pricing.currency
    };
  }

  public async stageVisaApplication(
    visa: CanonicalVisaOffer,
    config: VisaSelectedConfiguration
  ): Promise<{ candidate: TripBucketCandidate; success: boolean }> {
    if (config.journeyContext) {
      const errors = validateVisaContext(config.journeyContext);
      if (errors.length) throw new Error(errors.join(' '));
      if (config.canonicalOfferId !== visa.canonicalOfferId) throw new Error('Choose a canonical visa service.');
      const destination = config.journeyContext.destination.trim().toLowerCase();
      const aliases = [visa.countryName.toLowerCase(), visa.countryCode.toLowerCase(), ...(visa.countryCode === 'AE' ? ['uae', 'dubai'] : visa.countryCode === 'GB' ? ['uk'] : [])];
      if (!aliases.includes(destination)) throw new Error('This assistance option does not match the destination. Search again.');
      config = { ...config, pricing: { ...visa.pricing, totalPriceMinor: visa.pricing.totalPriceMinor * (config.journeyContext.adults + config.journeyContext.children + config.journeyContext.infants) } };
    }
    // 1. Mandatory Pre-Staging Revalidation Guard
    const liveOffer = await visaSearchService.getOfferById(visa.canonicalOfferId);
    let state: TripBucketItemState = (config.applicant.uploadedDocumentCount || 0) >= 2 ? 'ready' : 'needs_action';

    if (!liveOffer) {
      state = 'unavailable';
    } else if (liveOffer.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
    } else if (!config.journeyContext && liveOffer.pricing.totalPriceMinor !== config.pricing.totalPriceMinor) {
      state = 'price_changed';
      config.pricing = liveOffer.pricing;
    }

    const candidate = this.mapVisaOfferToTripCandidate(visa, config, state);
    tripBucketService.stageCandidate(candidate);

    telemetry.track('visa_application_staged_in_trip_bucket', {
      visaId: visa.visaId,
      canonicalOfferId: visa.canonicalOfferId,
      countryCode: visa.countryCode,
      priceMinor: config.pricing.totalPriceMinor,
      state
    });

    return { candidate, success: state === 'ready' || state === 'needs_action' };
  }
}

export const visaTripBucketService = new VisaTripBucketService();
