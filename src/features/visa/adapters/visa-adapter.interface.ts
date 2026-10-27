/* ============================================================================
 * Vacatina Visa Adapter Interface
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import type { CanonicalVisaOffer } from '../domain/visa-models.ts';
import type { VisaSearchCriteria, VisaRevalidationResult } from '../domain/visa-search-models.ts';

export interface IVisaAdapter {
  readonly providerId: string;
  readonly supplierName: string;
  readonly isOperationallyLive: boolean;

  search(criteria: VisaSearchCriteria): Promise<CanonicalVisaOffer[]>;
  getOffer(offerId: string): Promise<CanonicalVisaOffer | null>;
  revalidate(offerId: string): Promise<VisaRevalidationResult>;
}
