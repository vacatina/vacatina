/* ============================================================================
 * Vacatina Canonical Visa Search Models
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import type { CanonicalVisaOffer, VisaCategory } from './visa-models.ts';

export type VisaRequirementStatus = 'VISA_REQUIRED' | 'EVISA_AVAILABLE' | 'VISA_ON_ARRIVAL' | 'VISA_FREE';

export interface VisaRequirementRule {
  destinationCountry: string;
  destinationCountryCode: string;
  citizenshipCountry: string;
  citizenshipCountryCode: string;
  status: VisaRequirementStatus;
  statusLabel: string;              // e.g. "e-Visa Available", "Consular Visa Required"
  headline: string;
  description: string;
  allowedStayDays: number;
  slaDaysMin: number;
  slaDaysMax: number;
  isSupportedByDesk: boolean;
}

export interface VisaSearchCriteria {
  destinationCountry: string;
  destinationCountryCode?: string;
  citizenshipCountry: string;       // Default "Sri Lanka"
  citizenshipCountryCode?: string;  // Default "LK"
  purpose: 'tourist' | 'business' | 'transit' | 'all';
  travelDate?: string;
}

export interface VisaFilterCriteria {
  categories?: VisaCategory[];
  maxSlaDays?: number;
  maxPriceMinor?: number;
  directDeskOnly?: boolean;
}

export interface VisaSearchFacets {
  categoryCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  minPriceMinor: number;
  maxPriceMinor: number;
  minSlaDays: number;
  maxSlaDays: number;
}

export interface VisaSearchResponse {
  searchId: string;
  criteria: VisaSearchCriteria;
  requirementRule: VisaRequirementRule;
  offers: CanonicalVisaOffer[];
  totalCount: number;
  lowestPriceMinor: number;
  currency: string;
  facets: VisaSearchFacets;
  isStale: boolean;
  searchedAt: string;
}

export interface VisaRevalidationResult {
  offerId: string;
  isValid: boolean;
  isPriceChanged: boolean;
  newPriceMinor?: number;
  currency: string;
  revalidatedAt: string;
  recheckReason?: string;
}
