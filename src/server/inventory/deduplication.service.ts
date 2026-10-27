/* ============================================================================
 * Vacatina Deduplication & Ranking Engine
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q12) & ADR-006
 *
 * Rules:
 * 1. Generates composite natural keys for cross-supplier duplicate detection.
 * 2. Pin-Above-API Rule: Pinned manual listings rank at the top.
 * 3. Best Price Wins: Direct contract with lower rate wins with "Exclusive Direct Deal".
 * 4. Suppresses redundant duplicates while maintaining supplier auditability.
 * ============================================================================ */

import type { BookingMode, CanonicalOfferEntity } from './types.ts';
import { isOfferEligibleForPinOverride, selectBestSourceOffer } from './types.ts';
import type { CanonicalOfferSourceType, CanonicalRateOption } from './domain/canonical-offer.ts';

const DIRECT_INVENTORY_SOURCES = new Set<string>([
  'DIRECT_CONTRACT',
  'MANUAL_SERVICE',
  'CURATED_PACKAGE',
  'MANUAL'
]);

function isDirectInventory(sourceType: CanonicalOfferEntity['sourceType']): boolean {
  return DIRECT_INVENTORY_SOURCES.has(sourceType);
}

function getPriceMinor(offer: CanonicalOfferEntity): number {
  const finalSellingPriceMinor = offer.pricing?.finalSellingPriceMinor;
  if (typeof finalSellingPriceMinor === 'number') return finalSellingPriceMinor;

  // Legacy records may only expose a major-unit price alias.
  return typeof offer.price === 'number' ? Math.round(offer.price * 100) : 0;
}

function toOfferSourceType(sourceType: CanonicalOfferEntity['sourceType']): CanonicalOfferSourceType {
  switch (sourceType) {
    case 'DIRECT_CONTRACT':
      return 'DIRECT_CONTRACT';
    case 'MANUAL':
    case 'MANUAL_SERVICE':
    case 'CURATED_PACKAGE':
      return 'MANUAL';
    case 'HYBRID':
      return 'HYBRID';
    case 'SEED':
      return 'SEED';
    default:
      return 'API';
  }
}

function toRateOptionBookingMode(mode: BookingMode): CanonicalRateOption['bookingMode'] {
  switch (mode) {
    case 'INSTANT_BOOK':
      return 'INSTANT_BOOK';
    case 'REQUEST_TO_BOOK':
    case 'REQUEST_AVAILABILITY':
    case 'INQUIRY_ONLY':
      // These modes require the Vacatina desk to confirm before ticketing.
      // CanonicalRateOption has no separate inquiry state, so never claim
      // instant confirmation for them.
      return 'ON_REQUEST_CONCIERGE';
  }
}

export class DeduplicationService {
  /**
   * Generates a deterministic composite natural deduplication key.
   */
  public static generateDeduplicationKey(offer: CanonicalOfferEntity): string {
    const pType = offer.productType;
    const meta = offer.sourceMetadata || {};

    switch (pType) {
      case 'flights': {
        const carrier = (meta.airlineCode || meta.carrierCode || offer.supplierId || '').toString().toUpperCase();
        const fNum = (meta.flightNumber || '').toString().toUpperCase();
        const depDate = (meta.departureDate || meta.departureTime || '').toString().slice(0, 10);
        const cabin = (meta.cabinClass || 'ECONOMY').toString().toUpperCase();
        const origin = (offer.location.iataCode || meta.originIata || '').toString().toUpperCase();
        return `fl_${carrier}_${fNum}_${depDate}_${origin}_${cabin}`.replace(/[^a-zA-Z0-9_]/g, '');
      }

      case 'hotels': {
        const normCity = offer.location.city.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normName = offer.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        return `ht_${normCity}_${normName}`;
      }

      case 'cars': {
        const pickup = String(meta.pickupLocation || offer.location.city).toLowerCase().replace(/[^a-z0-9]/g, '');
        const vCat = String(meta.vehicleCategory || 'SEDAN').toLowerCase();
        return `cr_${pickup}_${vCat}`;
      }

      case 'rails': {
        const origin = String(meta.originStation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const dest = String(meta.destinationStation || offer.location.city).toLowerCase().replace(/[^a-z0-9]/g, '');
        const time = (meta.departureTime || '').toString().slice(0, 10);
        return `rl_${origin}_${dest}_${time}`;
      }

      default: {
        const slug = offer.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
        const city = offer.location.city.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `${pType.slice(0, 2)}_${city}_${slug}`;
      }
    }
  }

  /**
   * Deduplicates mixed API and Manual offers, applying tie-breaking & ranking rules.
   */
  public static deduplicateAndRank(offers: CanonicalOfferEntity[]): CanonicalOfferEntity[] {
    // Strict Invariant (Rule 6): SEED data NEVER appears in live ranking
    const cleanOffers = offers.filter(o => o.environmentClass !== 'SEED' && o.sourceType !== 'SEED');

    const grouped = new Map<string, CanonicalOfferEntity[]>();

    // 1. Group by natural composite deduplication key
    for (const offer of cleanOffers) {
      const key = offer.deduplicationKey || this.generateDeduplicationKey(offer);
      const existing = grouped.get(key) || [];
      existing.push(offer);
      grouped.set(key, existing);
    }

    const consolidated: CanonicalOfferEntity[] = [];

    // 2. Resolve duplicates per key (Canonical Entity Resolution)
    for (const [key, group] of grouped.entries()) {
      const entityId = `ent_${key}`;

      if (group.length === 1) {
        group[0].canonicalEntityId = group[0].canonicalEntityId || entityId;
        group[0].alternateSourceOfferIds = group[0].alternateSourceOfferIds || [];
        consolidated.push(group[0]);
        continue;
      }

      // Multi-criteria selection: evaluate score across price, certification, allotment, margin, cancellation
      const winningOffer = selectBestSourceOffer(group) || group[0];
      winningOffer.canonicalEntityId = entityId;
      winningOffer.alternateSourceOfferIds = group
        .filter(o => o.canonicalOfferId !== winningOffer.canonicalOfferId)
        .map(o => o.canonicalOfferId);

      const minPrice = Math.min(...group.map(getPriceMinor));
      winningOffer.rateOptions = group.map((opt): CanonicalRateOption => ({
        rateId: opt.canonicalOfferId || opt.offerId || opt.sourceOfferId || entityId,
        sourceType: toOfferSourceType(opt.sourceType),
        supplierId: opt.supplierId,
        supplierName: isDirectInventory(opt.sourceType) ? 'Vacatina Direct Contract' : `${opt.supplierId} Gateway`,
        priceMinor: getPriceMinor(opt),
        currency: opt.pricing?.currency || opt.currency || 'LKR',
        isBestPrice: getPriceMinor(opt) === minPrice,
        isDirectContract: isDirectInventory(opt.sourceType),
        cancellationPolicy: opt.cancellationPolicy || 'Standard cancellation terms apply',
        inclusions: opt.inclusions || [],
        bookingMode: toRateOptionBookingMode(opt.bookingMode),
        revalidationRequired: true,
        travelCreditEligible: true
      }));

      // If best selected offer is a Direct Contract competing against API, enrich badge
      if (isDirectInventory(winningOffer.sourceType) && group.some(o => o.sourceType === 'API')) {
        if (!winningOffer.subtitle.includes('Exclusive Direct Deal')) {
          winningOffer.subtitle = `${winningOffer.subtitle} · Exclusive Direct Deal`;
        }
      }

      consolidated.push(winningOffer);
    }

    // 3. Final Ordering:
    // 1st: Verified Pinned items (Rule 6)
    // 2nd: Availability (Available beats Sold Out / Expired)
    // 3rd: Best selling price
    return consolidated.sort((a, b) => {
      const aPinned = isOfferEligibleForPinOverride(a);
      const bPinned = isOfferEligibleForPinOverride(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Available items rank strictly above sold out / expired items
      const aAvailable = a.availabilityStatus !== 'SOLD_OUT' && a.availabilityStatus !== 'RATE_EXPIRED';
      const bAvailable = b.availabilityStatus !== 'SOLD_OUT' && b.availabilityStatus !== 'RATE_EXPIRED';
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;

      return a.pricing.finalSellingPriceMinor - b.pricing.finalSellingPriceMinor;
    });
  }
}
