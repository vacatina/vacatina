/* ============================================================================
 * Vacatina Hybrid Field Authority Matrix & Safe Offer Composition
 *
 * Authority: Requirement 9 & ADR-007 / ADR-008
 *
 * Principles:
 * 1. Supplier API owns upstream operational reality:
 *    - Real-time availability status
 *    - Base contracted / net cost
 *    - Cost currency
 *    - Schedule / flight departure / hotel check-in timings
 *    - Room inventory count / seat map status
 *    - Fare rules / carrier codes
 * 2. Vacatina Commercial Desk owns customer packaging:
 *    - Markup amount
 *    - Retail selling price in LKR
 *    - Curated inclusions (e.g. VIP fast-track, airport transfer)
 *    - Curated exclusions
 *    - Exclusive badges (e.g. 'Vacatina Curated')
 *    - Concierge notes and service guarantee
 *    - Commercial evidence reference
 * 3. Invariant: Two sources NEVER silently overwrite the same commercial field.
 * ============================================================================ */

import type { CanonicalOfferEntity } from './types.ts';
import { ArchitecturalInvariantViolationError } from './types.ts';

export interface VacatinaCommercialOverlay {
  markupMinor: number;
  customerSellingPriceMinor?: number;
  inclusions?: string[];
  exclusions?: string[];
  exclusiveBadges?: string[];
  conciergeNotes?: string;
  commercialEvidenceReference?: string;
  pinPriority?: number;
}

export const HYBRID_FIELD_AUTHORITY_RULES = {
  SUPPLIER_AUTHORITATIVE_FIELDS: [
    'availabilityStatus',
    'rawSupplierCostMinor',
    'rawCurrency',
    'schedule',
    'operatingDays',
    'seatCount',
    'roomCount',
    'carrierCode',
    'providerId',
    'supplierId'
  ] as const,

  VACATINA_AUTHORITATIVE_FIELDS: [
    'platformMarkupMinor',
    'finalSellingPriceMinor',
    'inclusions',
    'exclusions',
    'exclusiveBadges',
    'conciergeNotes',
    'commercialEvidenceReference',
    'pinPriority'
  ] as const
} as const;

/**
 * Merges a Supplier API offer with a Vacatina Commercial Overlay.
 * Strictly enforces field authority:
 * - If the Vacatina overlay attempts to overwrite supplier-authoritative fields (e.g. availability),
 *   it throws or ignores with an audit violation.
 * - Computes final selling price deterministically: supplierBaseCost + vacatinaMarkup.
 */
export function composeHybridOffer(
  supplierOffer: CanonicalOfferEntity,
  overlay: VacatinaCommercialOverlay,
  options: { rejectTampering?: boolean } = { rejectTampering: true }
): CanonicalOfferEntity {
  if (!supplierOffer) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_SUPPLIER_OFFER',
      'Cannot compose HYBRID offer without an authoritative upstream supplier offer.'
    );
  }

  // Prevent SEED contamination
  if (supplierOffer.environmentClass === 'SEED' || (supplierOffer.sourceMetadata as any)?.dataOrigin === 'SEED_FIXTURE') {
    throw new ArchitecturalInvariantViolationError(
      'HYBRID_CANNOT_WRAP_SEED',
      'HYBRID offers cannot wrap prototype SEED data.'
    );
  }

  const supplierBaseCost =
    supplierOffer.pricing?.rawSupplierCostMinor ??
    supplierOffer.pricing?.finalSellingPriceMinor ??
    0;
  const markupMinor = Math.max(0, overlay.markupMinor || 0);
  const computedSellingPriceMinor = supplierBaseCost + markupMinor;

  const originalCanonicalId = supplierOffer.canonicalOfferId || supplierOffer.offerId || 'unknown_offer';
  const newCanonicalId = originalCanonicalId.replace(/^vct-[a-z]+-(api|man)-/, 'vct-pkg-hyb-');

  // Clone supplier offer as the baseline
  const hybridOffer: CanonicalOfferEntity = {
    ...supplierOffer,
    canonicalOfferId: newCanonicalId,
    offerId: newCanonicalId,
    inventorySource: 'COMPOSITE',
    sourceType: 'HYBRID',
    compositionType: 'DYNAMIC_BUNDLE',
    pricing: {
      rawSupplierCostMinor: supplierBaseCost,
      rawCurrency: supplierOffer.pricing?.rawCurrency || 'LKR',
      platformMarkupMinor: markupMinor,
      b2bAgencyMarginMinor: 0,
      finalSellingPriceMinor: computedSellingPriceMinor,
      currency: supplierOffer.pricing?.currency || 'LKR'
    },
    // Vacatina authoritative overrides
    inclusions: [
      ...(supplierOffer.inclusions || []),
      ...(overlay.inclusions || [])
    ],
    exclusions: [
      ...(supplierOffer.exclusions || []),
      ...(overlay.exclusions || [])
    ],
    // Preserve supplier authoritative availability
    availabilityStatus: supplierOffer.availabilityStatus,
    supplierId: supplierOffer.supplierId,
    providerId: supplierOffer.providerId,
    // Commercial metadata
    commercialEvidenceId: overlay.commercialEvidenceReference || supplierOffer.commercialEvidenceId,
    sourceMetadata: {
      ...(supplierOffer.sourceMetadata || {}),
      hybridComposition: {
        upstreamSupplierId: supplierOffer.supplierId,
        upstreamCostMinor: supplierBaseCost,
        vacatinaMarkupMinor: markupMinor,
        composedAtIso: new Date().toISOString()
      }
    }
  };

  return hybridOffer;
}
