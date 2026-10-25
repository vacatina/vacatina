/* ============================================================================
 * Vacatina Canonical Search Aggregator Service
 * Authority: Vacatina Hybrid Inventory Strategy v1.0 — Search Aggregation Flow
 *
 * Architecture:
 * User Search -> API Hub Adapters + Manual Inventory Query
 *             -> Normalize (InventoryNormalizerService)
 *             -> Validate Freshness & Quota
 *             -> Deduplicate (Direct Contract vs. GDS Broker)
 *             -> Rank / Filter
 *             -> Canonical Vacatina Results
 *
 * Rule:
 * The frontend NEVER cares whether a record came from Amadeus, Sabre,
 * LiteAPI, or Payload CMS. The UI consumes the normalized Vacatina Offer contract.
 * ============================================================================ */

import type { TravelProductSlug } from '../domain/types.ts';
import type {
  ConfirmationMode,
  InventorySourceType,
  VacatinaNormalizedOffer
} from '../domain/inventory-models.ts';
import { CANONICAL_HYBRID_CATALOG } from '../mock-data/hybrid-catalog.ts';

export interface SearchAggregationCriteria {
  productType?: TravelProductSlug;
  destinationQuery?: string;
  originQuery?: string;
  sourceTypeFilter?: InventorySourceType;
  confirmationModeFilter?: ConfirmationMode;
  maxPriceLkr?: number;
  minPriceLkr?: number;
  instantConfirmOnly?: boolean;
  includeSeedContent?: boolean; // Defaults false for commercial results
  sortBy?: 'recommended' | 'price_low_high' | 'price_high_low' | 'freshness';
}

export class SearchAggregatorService {
  private catalog: VacatinaNormalizedOffer[];

  constructor(initialCatalog: VacatinaNormalizedOffer[] = CANONICAL_HYBRID_CATALOG) {
    this.catalog = [...initialCatalog];
  }

  /**
   * Aggregates API Hub results with Manual Payload CMS listings, deduplicates,
   * ranks, and returns normalized canonical offers.
   */
  public search(criteria: SearchAggregationCriteria = {}): VacatinaNormalizedOffer[] {
    let results = [...this.catalog];

    // 1. Filter by Product Type
    if (criteria.productType) {
      results = results.filter(offer => offer.productType === criteria.productType);
    }

    // 2. Filter by Destination / Location
    if (criteria.destinationQuery) {
      const q = criteria.destinationQuery.toLowerCase().trim();
      results = results.filter(offer => {
        const cityMatch = offer.location.city.toLowerCase().includes(q);
        const countryMatch = offer.location.country.toLowerCase().includes(q);
        const codeMatch = Boolean(offer.location.iataCode && offer.location.iataCode.toLowerCase().includes(q));
        const titleMatch = offer.title.toLowerCase().includes(q);
        return cityMatch || countryMatch || codeMatch || titleMatch;
      });
    }

    // 3. Filter by Origin (for flights and rails)
    if (criteria.originQuery) {
      const o = criteria.originQuery.toLowerCase().trim();
      results = results.filter(offer => {
        return offer.title.toLowerCase().includes(o) || (offer.sourceMetadata?.originIata as string)?.toLowerCase().includes(o);
      });
    }

    // 4. Filter by Source Type (API, MANUAL, HYBRID)
    if (criteria.sourceTypeFilter) {
      results = results.filter(offer => offer.sourceType === criteria.sourceTypeFilter);
    }

    // 5. Filter by Confirmation Mode
    if (criteria.confirmationModeFilter) {
      results = results.filter(offer => offer.confirmationMode === criteria.confirmationModeFilter);
    }

    if (criteria.instantConfirmOnly) {
      results = results.filter(offer => offer.confirmationMode === 'INSTANT_CONFIRM');
    }

    // 6. Filter by Price Window
    if (typeof criteria.minPriceLkr === 'number') {
      results = results.filter(offer => offer.pricing.customerSellingPriceLkr >= criteria.minPriceLkr!);
    }
    if (typeof criteria.maxPriceLkr === 'number') {
      results = results.filter(offer => offer.pricing.customerSellingPriceLkr <= criteria.maxPriceLkr!);
    }

    // 7. Seed Content Separation (Locked Part 5): Exclude prototype seed content from commercial results
    if (!criteria.includeSeedContent) {
      results = results.filter(offer => offer.sourceType !== 'SEED' && !offer.isSeedContent);
    }

    // 8. Deduplicate identical offerings (e.g. direct contract vs aggregator)
    results = this.deduplicateOffers(results);

    // 9. Rank and Sort (Locked Part 12: Admin Pin Above API Results)
    results = this.rankOffers(results, criteria.sortBy || 'recommended');

    return results;
  }

  /**
   * Deduplicates duplicate records across API and Manual channels.
   * Strategy: If a hotel property or flight route is represented both by an API broker
   * and a direct manual contract, prefer the Direct Manual Contract because Vacatina
   * has direct supplier accountability and higher margin protection.
   */
  private deduplicateOffers(offers: VacatinaNormalizedOffer[]): VacatinaNormalizedOffer[] {
    const dedupeMap = new Map<string, VacatinaNormalizedOffer>();

    for (const offer of offers) {
      // Create a semantic dedup key: e.g. 'hotels:maldives:adaaran' or 'flights:cmb:dxb'
      const key = `${offer.productType}:${offer.location.countryCode.toLowerCase()}:${offer.title.toLowerCase().slice(0, 16)}`;

      if (!dedupeMap.has(key)) {
        dedupeMap.set(key, offer);
      } else {
        const existing = dedupeMap.get(key)!;
        // Priority rule: MANUAL direct contract > API broker
        if (offer.sourceType === 'MANUAL' && existing.sourceType === 'API') {
          dedupeMap.set(key, offer);
        } else if (offer.pricing.customerSellingPriceLkr < existing.pricing.customerSellingPriceLkr) {
          // If both same type, prefer lower price
          dedupeMap.set(key, offer);
        }
      }
    }

    return Array.from(dedupeMap.values());
  }

  /**
   * Ranks offers:
   * Recommended order:
   * 1. Direct verified contracts / Instant Confirmation
   * 2. Lowest customer selling price
   */
  private rankOffers(
    offers: VacatinaNormalizedOffer[],
    sortBy: 'recommended' | 'price_low_high' | 'price_high_low' | 'freshness'
  ): VacatinaNormalizedOffer[] {
    if (sortBy === 'price_low_high') {
      return [...offers].sort((a, b) => a.pricing.customerSellingPriceLkr - b.pricing.customerSellingPriceLkr);
    }
    if (sortBy === 'price_high_low') {
      return [...offers].sort((a, b) => b.pricing.customerSellingPriceLkr - a.pricing.customerSellingPriceLkr);
    }
    if (sortBy === 'freshness') {
      return [...offers].sort((a, b) => new Date(b.freshness.lastCheckedAtIso).getTime() - new Date(a.freshness.lastCheckedAtIso).getTime());
    }

    // Default 'recommended': Pinned manual offers (Part 12), Instant confirm & direct manual contracts scored higher
    return [...offers].sort((a, b) => {
      const pinScoreA = (a.pinPriority || 0) * 100;
      const pinScoreB = (b.pinPriority || 0) * 100;
      const scoreA = pinScoreA + (a.confirmationMode === 'INSTANT_CONFIRM' ? 20 : 0) + (a.sourceType === 'MANUAL' ? 10 : 0);
      const scoreB = pinScoreB + (b.confirmationMode === 'INSTANT_CONFIRM' ? 20 : 0) + (b.sourceType === 'MANUAL' ? 10 : 0);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.pricing.customerSellingPriceLkr - b.pricing.customerSellingPriceLkr;
    });
  }

  /**
   * Lookup single offer by canonical offerId.
   */
  public getOfferById(offerId: string): VacatinaNormalizedOffer | null {
    return this.catalog.find(o => o.offerId === offerId) || null;
  }
}

export const searchAggregatorService = new SearchAggregatorService();
