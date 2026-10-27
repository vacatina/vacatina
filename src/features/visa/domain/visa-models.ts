/* ============================================================================
 * Vacatina Canonical Visa Domain Models
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Requirements:
 * 1. Provider-neutral canonical visa and consular service model.
 * 2. Multi-tier inventory support: MANUAL (Vacatina Consular Desk), API (Future Consular Feeds), HYBRID.
 * 3. Transparent consular fee vs service fee breakdown (Embassy fee + Concierge fee).
 * 4. Structured document checklists and application vetting workflow.
 * 5. Statutory legal disclaimer compliance (Not an immigration authority).
 * 6. SEED quarantine: isSeed is strictly false for bookable consular services.
 * ============================================================================ */

import type { CanonicalOfferSourceType, CanonicalOfferLifecycleStatus } from '../../../server/inventory/domain/canonical-offer.ts';
import type { JourneyConfiguration } from '../../journeys/domain/journey-models.ts';

export type VisaCategory = 'TOURIST_EVISA' | 'BUSINESS_VISA' | 'STICKER_VISA' | 'TRANSIT_VISA' | 'ETA';
export type VisaEntryType = 'SINGLE_ENTRY' | 'DOUBLE_ENTRY' | 'MULTIPLE_ENTRY';

export interface DocumentChecklistItem {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  acceptedFormats: string; // e.g. "PDF, JPG, PNG (Max 5MB)"
  category: 'IDENTITY' | 'TRAVEL' | 'FINANCIAL' | 'OCCUPATIONAL' | 'INVITATION';
}

export interface VisaPricingBreakdown {
  embassyFeeMinor: number;          // Sovereign consular/government fee
  vacatinaConciergeFeeMinor: number;// Document vetting, form filling & submission support
  taxMinor: number;
  totalPriceMinor: number;
  currency: string;
}

export interface CanonicalVisaOffer {
  inventoryMode?: 'demo_fixture' | 'manual_request';
  visaId: string;                   // Internal service ID (e.g. vs_ae_tourist_30d)
  canonicalOfferId: string;         // Universal stable offer ID (e.g. vct-vs-consular-ae-30d)
  sourceType: CanonicalOfferSourceType; // 'MANUAL' | 'API' | 'HYBRID'
  providerId: string;               // 'VACATINA_CONSULAR_DESK'
  supplierName: string;             // 'Vacatina Consular Advisory Service'
  countryName: string;              // "United Arab Emirates"
  countryCode: string;              // "AE"
  region: 'Middle East' | 'Europe' | 'Asia-Pacific' | 'North America' | 'South Asia' | 'Africa' | 'Americas';
  title: string;                    // "UAE 30-Day Tourist e-Visa Assistance"
  subtitle: string;
  description: string;
  category: VisaCategory;
  entryType: VisaEntryType;
  durationDays: number;             // 30, 60, 90, 180
  validityDescription: string;      // e.g. "Valid 60 days from issuance"
  maxStayDescription: string;       // e.g. "Up to 30 days per entry"
  processingSlaBusinessDays: number;// e.g. 3
  expressAvailable: boolean;
  heroImage: string;
  flagEmoji: string;
  pricing: VisaPricingBreakdown;
  documentChecklist: DocumentChecklistItem[];
  consularSteps: string[];
  importantNotes: string[];
  isPinnedAboveApi: boolean;
  isSeed: false;                    // Strict quarantine
  availabilityStatus: CanonicalOfferLifecycleStatus;
  lastCheckedAt: string;            // ISO 8601 UTC
  validUntil: string;               // ISO 8601 UTC
}

export interface VisaApplicantBioData {
  fullName: string;
  passportNumber: string;
  passportExpiryDate: string;
  nationality: string;
  dateOfBirth?: string;
  email: string;
  phone: string;
  travelDate: string;
  uploadedDocumentCount?: number;
}

export interface VisaSelectedConfiguration {
  journeyContext?: JourneyConfiguration;
  visaId: string;
  canonicalOfferId: string;
  countryName: string;
  countryCode: string;
  visaType: string;
  category: VisaCategory;
  entryType: VisaEntryType;
  durationDays: number;
  processingSlaDays: number;
  travelDate: string;
  applicant: VisaApplicantBioData;
  pricing: VisaPricingBreakdown;
  sourceType: CanonicalOfferSourceType;
  supplierName: string;
}
