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

import type { CanonicalOfferEntity } from './types.ts';

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
        const pickup = (meta.pickupLocation || offer.location.city).toLowerCase().replace(/[^a-z0-9]/g, '');
        const vCat = (meta.vehicleCategory || 'SEDAN').toLowerCase();
        return `cr_${pickup}_${vCat}`;
      }

      case 'rails': {
        const origin = (meta.originStation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const dest = (meta.destinationStation || offer.location.city).toLowerCase().replace(/[^a-z0-9]/g, '');
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
    const grouped = new Map<string, CanonicalOfferEntity[]>();

    // 1. Group by natural composite deduplication key
    for (const offer of offers) {
      const key = offer.deduplicationKey || this.generateDeduplicationKey(offer);
      const existing = grouped.get(key) || [];
      existing.push(offer);
      grouped.set(key, existing);
    }

    const consolidated: CanonicalOfferEntity[] = [];

    // 2. Resolve duplicates per key
    for (const [_, group] of grouped.entries()) {
      if (group.length === 1) {
        consolidated.push(group[0]);
        continue;
      }

      // Tie-Breaking Strategy:
      // Priority A: Pin-Above-API (manual offers with pinAboveApi === true)
      const pinnedManual = group.find(o => o.sourceType === 'MANUAL' && o.pinAboveApi);
      if (pinnedManual) {
        consolidated.push(pinnedManual);
        continue;
      }

      // Priority B: Best Price Wins (lowest selling price)
      const sortedByPrice = [...group].sort((a, b) => 
        a.pricing.finalSellingPriceMinor - b.pricing.finalSellingPriceMinor
      );
      const bestPriceOffer = sortedByPrice[0];

      // If best price is a Manual Direct Contract, enrich with direct deal badge
      if (bestPriceOffer.sourceType === 'MANUAL' && sortedByPrice.some(o => o.sourceType === 'API')) {
        bestPriceOffer.subtitle = `${bestPriceOffer.subtitle} · Exclusive Direct Deal`;
      }

      consolidated.push(bestPriceOffer);
    }

    // 3. Final Ordering:
    // 1st: Pinned items
    // 2nd: Best selling price
    return consolidated.sort((a, b) => {
      if (a.pinAboveApi && !b.pinAboveApi) return -1;
      if (!a.pinAboveApi && b.pinAboveApi) return 1;
      return a.pricing.finalSellingPriceMinor - b.pricing.finalSellingPriceMinor;
    });
  }
}
