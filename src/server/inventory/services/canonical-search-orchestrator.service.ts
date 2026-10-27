/* ============================================================================
 * Vacatina Canonical Search Orchestrator Service
 * Authority: Requirement 5, 6, 9, 12 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 *
 * Responsibilities:
 * 1. Executes unified multi-source search across MANUAL, API, and HYBRID inventory.
 * 2. Merges manual direct contracts and upstream supplier feeds in parallel.
 * 3. Enforces strict SEED / Discovery quarantine (demo items never reach results).
 * 4. Deduplicates overlapping supplier offers and ranks via Pin-Above-API rules.
 * 5. Returns UnifiedCanonicalOffer[] preserving stable IDs and source provenance.
 * ============================================================================ */

import type {
  CanonicalSearchCriteria,
  UnifiedCanonicalOffer
} from '../domain/canonical-offer.ts';
import { CanonicalOfferMapper } from '../domain/canonical-mapper.ts';
import type { IManualListingRepository } from '../repository/manual-listing.repository.ts';
import type { ICanonicalProviderAdapter } from '../adapters/canonical-provider-adapter.interface.ts';

export class CanonicalSearchOrchestratorService {
  private manualRepo: IManualListingRepository;
  private adapters: Map<string, ICanonicalProviderAdapter> = new Map();

  constructor(manualRepo: IManualListingRepository) {
    this.manualRepo = manualRepo;
  }

  public registerAdapter(adapter: ICanonicalProviderAdapter): void {
    const key = `${adapter.productType}_${adapter.providerId}`;
    this.adapters.set(key, adapter);
  }

  public getAdapter(productType: string, providerId: string): ICanonicalProviderAdapter | undefined {
    return this.adapters.get(`${productType}_${providerId}`);
  }

  /**
   * Universal Search Pipeline across MANUAL, API, and HYBRID sources.
   */
  public async search(criteria: CanonicalSearchCriteria): Promise<UnifiedCanonicalOffer[]> {
    const collectedOffers: UnifiedCanonicalOffer[] = [];

    // 1. Query Manual Inventory (Vacatina Direct Contracts)
    try {
      const manualListings = await this.manualRepo.search({
        productType: criteria.productType,
        destination: criteria.destination,
        onlySellable: true
      });

      for (const listing of manualListings) {
        // Map persistent DB row to UnifiedCanonicalOffer
        const canonicalListing = {
          sourceType: 'MANUAL' as const,
          productType: listing.productType,
          listingId: listing.listingId,
          supplierId: listing.partnerSupplierId,
          providerId: 'manual_cms',
          status: listing.workflowStatus,
          market: listing.destination === 'Colombo' ? 'LK' : 'GLOBAL',
          currency: listing.currency,
          basePrice: Math.round(listing.contractedBaseCostMinor / 100),
          availabilityStatus: (listing.isStopSaleActive || listing.availableQuota <= 0) ? 'UNAVAILABLE' : 'AVAILABLE',
          lastSyncedAt: new Date().toISOString(),
          lastCheckedAt: new Date().toISOString(),
          validFrom: listing.validFromIso,
          validTo: listing.validUntilIso,
          createdBy: listing.createdBy.name,
          updatedBy: listing.modifiedBy?.name || listing.createdBy.name,
          canonicalEntityId: listing.canonicalEntityId,
          title: listing.title,
          description: listing.description,
          destination: listing.destination,
          origin: listing.origin,
          contractedBaseCostMinor: listing.contractedBaseCostMinor,
          markupMinor: listing.markupMinor,
          sellingPriceMinor: listing.sellingPriceMinor,
          totalQuota: listing.totalAllottedQuota,
          availableQuota: listing.availableQuota,
          isStopSaleActive: listing.isStopSaleActive,
          stopSaleReason: listing.stopSaleReason,
          inclusions: listing.inclusions,
          exclusions: listing.exclusions,
          cancellationPolicy: listing.cancellationPolicy,
          refundability: listing.refundability,
          media: listing.media
        };

        const offer = CanonicalOfferMapper.mapManualListingToOffer(canonicalListing as any);
        if (offer.availabilityStatus === 'AVAILABLE') {
          collectedOffers.push(offer);
        }
      }
    } catch (err: any) {
      console.warn(`[CanonicalSearchOrchestrator] Manual search non-fatal error: ${err.message}`);
    }

    // 2. Query Registered Supplier API Adapters in Parallel
    const matchingAdapters = Array.from(this.adapters.values()).filter(
      a => a.productType === criteria.productType && a.sourceType !== 'MANUAL'
    );

    const adapterPromises = matchingAdapters.map(async adapter => {
      try {
        const isHealthy = await adapter.isHealthy();
        if (!isHealthy) {
          console.warn(`[CanonicalSearchOrchestrator] Adapter ${adapter.providerId} reporting unhealthy; skipping.`);
          return [];
        }
        return await adapter.search(criteria);
      } catch (err: any) {
        console.warn(`[CanonicalSearchOrchestrator] Adapter ${adapter.providerId} search failed: ${err.message}`);
        return [];
      }
    });

    const adapterResults = await Promise.all(adapterPromises);
    for (const offers of adapterResults) {
      collectedOffers.push(...offers);
    }

    // 3. Strict SEED Quarantine & Sellability Invariant
    // SEED offers must NEVER masquerade as real search results or enter checkout
    const eligibleOffers = collectedOffers.filter(offer => {
      if (offer.isSeed) return false;
      if (offer.availabilityStatus === 'UNAVAILABLE' || offer.availabilityStatus === 'EXPIRED') return false;
      return true;
    });

    // 4. Deduplication & Intelligent Multi-Factor Relevance + Pin Ranking
    return this.deduplicateAndRank(eligibleOffers, criteria);
  }

  /**
   * Deduplicates matching supplier offers and applies intelligent multi-factor ranking:
   * 1. Query Relevance Guard (Destination & Origin match)
   * 2. Canonical Product & Multi-Supplier Rate Consolidation (combines Supplier A + B + Direct into 1 product with Rate Options)
   * 3. Admin Pin-Above-API Toggle (Only applied if relevance is positive)
   * 4. Commercial Source Priority (DIRECT_CONTRACT / MANUAL > HYBRID > API)
   * 5. Ascending retail price tiebreaker
   */
  private deduplicateAndRank(
    offers: UnifiedCanonicalOffer[],
    criteria?: CanonicalSearchCriteria
  ): UnifiedCanonicalOffer[] {
    const groupedSignatures = new Map<string, UnifiedCanonicalOffer[]>();

    for (const offer of offers) {
      // Signature based on product vertical and normalized destination/title (or productId if present)
      const normTitle = offer.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const signature = offer.productId
        ? `${offer.productType}_${offer.productId}`
        : `${offer.productType}_${offer.destinationId.toLowerCase()}_${normTitle}`;

      const existingGroup = groupedSignatures.get(signature) || [];
      existingGroup.push(offer);
      groupedSignatures.set(signature, existingGroup);
    }

    const uniqueOffers: UnifiedCanonicalOffer[] = [];

    for (const [sig, group] of groupedSignatures.entries()) {
      if (group.length === 1) {
        const single = group[0];
        single.rateOptions = [{
          rateId: single.offerId,
          sourceType: single.sourceType,
          supplierId: single.supplierId,
          supplierName: single.sourceType === 'MANUAL' || single.sourceType === 'DIRECT_CONTRACT'
            ? 'Vacatina Direct Contract'
            : `${single.supplierId} Gateway`,
          roomType: (single.metadata?.roomType as string) || (single.productType === 'hotels' ? 'Standard / Deluxe Room' : undefined),
          fareClass: (single.metadata?.cabinClass as string) || (single.productType === 'flights' ? 'Economy Standard' : undefined),
          priceMinor: single.priceBreakdown.totalMinor,
          currency: single.currency,
          isBestPrice: true,
          isDirectContract: single.sourceType === 'MANUAL' || single.sourceType === 'DIRECT_CONTRACT',
          cancellationPolicy: single.cancellationPolicy.policyText,
          inclusions: single.inclusions,
          bookingMode: single.bookingMode as any,
          revalidationRequired: single.revalidationSupported,
          travelCreditEligible: single.travelCreditPolicy?.eligible ?? true
        }];
        uniqueOffers.push(single);
        continue;
      }

      // Multi-supplier duplicate resolution (Canonical Product with Multiple Rate Options)
      // Preference: MANUAL / DIRECT_CONTRACT wins over API; lower price wins between identical sources
      let winningOffer = group[0];
      let minPriceMinor = group[0].priceBreakdown.totalMinor;

      for (const candidate of group) {
        if (candidate.priceBreakdown.totalMinor < minPriceMinor) {
          minPriceMinor = candidate.priceBreakdown.totalMinor;
        }

        const isCandidateDirect = candidate.sourceType === 'MANUAL' || candidate.sourceType === 'DIRECT_CONTRACT';
        const isWinningDirect = winningOffer.sourceType === 'MANUAL' || winningOffer.sourceType === 'DIRECT_CONTRACT';

        if (isCandidateDirect && !isWinningDirect) {
          winningOffer = candidate;
        } else if (isCandidateDirect === isWinningDirect && candidate.price < winningOffer.price) {
          winningOffer = candidate;
        }
      }

      // Build consolidated rate options list across all suppliers for this single canonical product
      winningOffer.rateOptions = group.map(opt => ({
        rateId: opt.offerId,
        sourceType: opt.sourceType,
        supplierId: opt.supplierId,
        supplierName: opt.sourceType === 'MANUAL' || opt.sourceType === 'DIRECT_CONTRACT'
          ? 'Vacatina Direct Contract'
          : `${opt.supplierId} Gateway`,
        roomType: (opt.metadata?.roomType as string) || (opt.productType === 'hotels' ? 'Standard / Deluxe Room' : undefined),
        fareClass: (opt.metadata?.cabinClass as string) || (opt.productType === 'flights' ? 'Economy Standard' : undefined),
        priceMinor: opt.priceBreakdown.totalMinor,
        currency: opt.currency,
        isBestPrice: opt.priceBreakdown.totalMinor === minPriceMinor,
        isDirectContract: opt.sourceType === 'MANUAL' || opt.sourceType === 'DIRECT_CONTRACT',
        cancellationPolicy: opt.cancellationPolicy.policyText,
        inclusions: opt.inclusions,
        bookingMode: opt.bookingMode as any,
        revalidationRequired: opt.revalidationSupported,
        travelCreditEligible: opt.travelCreditPolicy?.eligible ?? true
      })).sort((a, b) => {
        if (a.isDirectContract && !b.isDirectContract) return -1;
        if (!a.isDirectContract && b.isDirectContract) return 1;
        return a.priceMinor - b.priceMinor;
      });

      if (winningOffer.sourceType === 'MANUAL' || winningOffer.sourceType === 'DIRECT_CONTRACT') {
        winningOffer.badges = winningOffer.badges || [];
        if (!winningOffer.badges.some(b => b.text === 'Vacatina Exclusive')) {
          winningOffer.badges.push({ text: 'Vacatina Exclusive', variant: 'exclusive' });
        }
      }

      uniqueOffers.push(winningOffer);
    }
    const destQuery = criteria?.destination?.trim().toLowerCase() || '';
    const origQuery = criteria?.origin?.trim().toLowerCase() || '';

    return uniqueOffers.sort((a, b) => {
      const scoreA = this.calculateOfferRankScore(a, destQuery, origQuery);
      const scoreB = this.calculateOfferRankScore(b, destQuery, origQuery);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score wins
      }
      return a.price - b.price; // Lowest price tiebreaker
    });
  }

  private calculateOfferRankScore(
    offer: UnifiedCanonicalOffer,
    destQuery: string,
    origQuery: string
  ): number {
    let relevanceScore = 0;

    if (!destQuery) {
      relevanceScore = 50; // Neutral relevance when query is open
    } else {
      const destId = offer.destinationId.toLowerCase();
      const city = offer.location.city.toLowerCase();
      const country = offer.location.country.toLowerCase();
      const title = offer.title.toLowerCase();

      if (destId === destQuery || city === destQuery) {
        relevanceScore += 100;
      } else if (city.includes(destQuery) || country.includes(destQuery)) {
        relevanceScore += 80;
      } else if (title.includes(destQuery)) {
        relevanceScore += 50;
      }
    }

    if (origQuery && offer.originId) {
      if (offer.originId.toLowerCase() === origQuery) {
        relevanceScore += 40;
      }
    }

    // Guard: Irrelevant offers do NOT receive admin pin boosts
    if (destQuery && relevanceScore === 0) {
      return -100; // Deprioritized or irrelevant
    }

    // Admin Pin-Above-API Boost: Only applied if relevance is positive
    const isPinned = Boolean(
      offer.metadata?.isPinnedAboveApi ||
      (offer as any).isPinnedAboveApi ||
      (offer as any).pinAboveApi
    );
    const pinBoost = isPinned ? 500 : 0;

    // Commercial Source Tier Weight
    let sourceWeight = 10; // Default API
    if (offer.sourceType === 'MANUAL') sourceWeight = 30;
    else if (offer.sourceType === 'HYBRID') sourceWeight = 20;

    return relevanceScore + pinBoost + sourceWeight;
  }
}
