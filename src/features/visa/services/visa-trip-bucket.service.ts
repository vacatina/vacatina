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
      confirmationMode: 'ASSISTED_SERVICE',
      rawSupplierPrice: config.pricing.embassyFeeMinor / 100,
      supplierBaseCurrency: config.pricing.currency
    };
  }

  public async stageVisaApplication(
    visa: CanonicalVisaOffer,
    config: VisaSelectedConfiguration
  ): Promise<{ candidate: TripBucketCandidate; success: boolean }> {
    // 1. Mandatory Pre-Staging Revalidation Guard
    const liveOffer = await visaSearchService.getOfferById(visa.canonicalOfferId);
    let state: TripBucketItemState = (config.applicant.uploadedDocumentCount || 0) >= 2 ? 'ready' : 'needs_action';

    if (!liveOffer) {
      state = 'unavailable';
    } else if (liveOffer.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
    } else if (liveOffer.pricing.totalPriceMinor !== config.pricing.totalPriceMinor) {
      state = 'price_changed';
      config.pricing = liveOffer.pricing;
    }

    const candidate = this.mapVisaOfferToTripCandidate(visa, config, state);
    tripBucketService.addItem(candidate);

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
