/* ============================================================================
 * Vacatina Canonical Revalidation Engine
 * Authority: VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0
 *
 * Requirements:
 * 1. Enforces pre-booking revalidation across MANUAL, API, and HYBRID inventory.
 * 2. Manual offers cannot remain falsely "available" forever:
 *    rechecks stop-sale, allotment depletion, and validTo expiration.
 * 3. Returns deterministic CanonicalRevalidationResult.
 * ============================================================================ */

import type {
  CanonicalRevalidationResult,
  UnifiedCanonicalOffer
} from '../domain/canonical-offer.ts';
import type { IManualListingRepository } from '../repository/manual-listing.repository.ts';

export class CanonicalRevalidationService {
  private manualRepo: IManualListingRepository;

  constructor(manualRepo: IManualListingRepository) {
    this.manualRepo = manualRepo;
  }

  /**
   * Revalidates any canonical offer before Trip Bucket checkout or configuration.
   */
  public async revalidate(
    offer: UnifiedCanonicalOffer,
    upstreamPriceFetcher?: (externalOfferId: string) => Promise<{
      status: 'AVAILABLE' | 'PRICE_CHANGED' | 'UNAVAILABLE' | 'EXPIRED';
      newTotalMinor?: number;
    }>
  ): Promise<CanonicalRevalidationResult> {
    const now = Date.now();
    const nowIso = new Date().toISOString();

    // 1. MANUAL & DIRECT_CONTRACT Inventory Revalidation
    if (offer.sourceType === 'MANUAL' || offer.sourceType === 'DIRECT_CONTRACT') {
      const listingId = offer.sourceListingId || offer.offerId.replace(/^vct-man-[a-z_]+-/, '');
      const listing = await this.manualRepo.findById(listingId);

      if (!listing) {
        return {
          offerId: offer.offerId,
          status: 'UNAVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'This manual contract is no longer in the active catalog.',
          revalidatedAt: nowIso
        };
      }

      // Check operational stop-sale
      if (listing.isStopSaleActive) {
        return {
          offerId: offer.offerId,
          status: 'UNAVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: listing.stopSaleReason || 'Stop-sale activated by Vacatina Operations.',
          revalidatedAt: nowIso
        };
      }

      // Check allotment / quota depletion
      if (listing.availableQuota <= 0) {
        return {
          offerId: offer.offerId,
          status: 'UNAVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'Contract allotment quota exhausted for this departure / date.',
          revalidatedAt: nowIso
        };
      }

      // Check validity window expiration
      const validUntilMs = new Date(listing.salesValidUntilIso || listing.validUntilIso).getTime();
      if (now > validUntilMs) {
        return {
          offerId: offer.offerId,
          status: 'EXPIRED',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'The contracted validity window for this offer has expired.',
          revalidatedAt: nowIso
        };
      }

      // Check if price changed in CMS
      if (listing.sellingPriceMinor !== offer.priceBreakdown.totalMinor) {
        return {
          offerId: offer.offerId,
          status: 'PRICE_CHANGED',
          isPriceChanged: true,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: listing.sellingPriceMinor,
          currency: listing.currency,
          requiresUserAction: true,
          actionMessage: `Vacatina contracted rate adjusted to ${listing.currency} ${(listing.sellingPriceMinor / 100).toLocaleString()}.`,
          revalidatedAt: nowIso
        };
      }

      return {
        offerId: offer.offerId,
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: offer.priceBreakdown.totalMinor,
        newPriceMinor: offer.priceBreakdown.totalMinor,
        currency: offer.currency,
        requiresUserAction: false,
        revalidatedAt: nowIso
      };
    }

    // 2. API / Upstream Supplier Revalidation
    if (offer.sourceType === 'API') {
      if (upstreamPriceFetcher && offer.externalOfferId) {
        const upstreamResult = await upstreamPriceFetcher(offer.externalOfferId);

        if (upstreamResult.status === 'PRICE_CHANGED' && upstreamResult.newTotalMinor) {
          return {
            offerId: offer.offerId,
            status: 'PRICE_CHANGED',
            isPriceChanged: true,
            previousPriceMinor: offer.priceBreakdown.totalMinor,
            newPriceMinor: upstreamResult.newTotalMinor,
            currency: offer.currency,
            requiresUserAction: true,
            actionMessage: `Live carrier/supplier fare adjusted to ${offer.currency} ${(upstreamResult.newTotalMinor / 100).toLocaleString()}.`,
            revalidatedAt: nowIso
          };
        }

        if (upstreamResult.status !== 'AVAILABLE') {
          return {
            offerId: offer.offerId,
            status: upstreamResult.status,
            isPriceChanged: false,
            previousPriceMinor: offer.priceBreakdown.totalMinor,
            newPriceMinor: offer.priceBreakdown.totalMinor,
            currency: offer.currency,
            requiresUserAction: true,
            actionMessage: upstreamResult.status === 'EXPIRED' ? 'Supplier rate hold expired.' : 'Inventory sold out upstream.',
            revalidatedAt: nowIso
          };
        }
      }

      // Check TTL expiry if no live fetcher provided
      const validUntilMs = new Date(offer.validUntil).getTime();
      if (now > validUntilMs) {
        return {
          offerId: offer.offerId,
          status: 'EXPIRED',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'Search result hold expired. Please refresh search.',
          revalidatedAt: nowIso
        };
      }

      return {
        offerId: offer.offerId,
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: offer.priceBreakdown.totalMinor,
        newPriceMinor: offer.priceBreakdown.totalMinor,
        currency: offer.currency,
        requiresUserAction: false,
        revalidatedAt: nowIso
      };
    }

    // 3. HYBRID Inventory Revalidation
    // Evaluates upstream supplier availability + recalculates Vacatina markup
    const markupMinor = offer.priceBreakdown.markupMinor || 0;
    let upstreamBaseMinor = offer.priceBreakdown.baseMinor;

    if (upstreamPriceFetcher && offer.externalOfferId) {
      const upstreamResult = await upstreamPriceFetcher(offer.externalOfferId);
      if (upstreamResult.status !== 'AVAILABLE' && upstreamResult.status !== 'PRICE_CHANGED') {
        return {
          offerId: offer.offerId,
          status: upstreamResult.status,
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'Underlying supplier inventory is no longer available.',
          revalidatedAt: nowIso
        };
      }

      if (upstreamResult.newTotalMinor && upstreamResult.newTotalMinor !== upstreamBaseMinor) {
        upstreamBaseMinor = upstreamResult.newTotalMinor;
        const newHybridTotalMinor = upstreamBaseMinor + markupMinor;
        return {
          offerId: offer.offerId,
          status: 'PRICE_CHANGED',
          isPriceChanged: true,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: newHybridTotalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: `Underlying supplier cost adjusted. Updated rate: ${offer.currency} ${(newHybridTotalMinor / 100).toLocaleString()}.`,
          revalidatedAt: nowIso
        };
      }
    }

    // 4. COMPOSITE Package Inventory Revalidation
    if (offer.sourceType === 'COMPOSITE') {
      const components = offer.compositeComponents || [];
      if (components.length === 0) {
        return {
          offerId: offer.offerId,
          status: 'UNAVAILABLE',
          isPriceChanged: false,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: offer.priceBreakdown.totalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: 'Composite package has no defined journey components.',
          revalidatedAt: nowIso
        };
      }

      let hasPriceChange = false;
      let computedTotalMinor = 0;

      for (const comp of components) {
        if (comp.isRequired && (comp.status === 'UNAVAILABLE' || comp.status === 'EXPIRED')) {
          return {
            offerId: offer.offerId,
            status: 'UNAVAILABLE',
            isPriceChanged: false,
            previousPriceMinor: offer.priceBreakdown.totalMinor,
            newPriceMinor: offer.priceBreakdown.totalMinor,
            currency: offer.currency,
            requiresUserAction: true,
            actionMessage: `Required package component "${comp.title}" (${comp.componentType}) is no longer available.`,
            revalidatedAt: nowIso
          };
        }

        if (comp.revalidationStatus === 'PRICE_CHANGED' || comp.status === 'PRICE_CHANGED') {
          hasPriceChange = true;
        }
        computedTotalMinor += comp.unitPriceMinor;
      }

      if (hasPriceChange && computedTotalMinor !== offer.priceBreakdown.totalMinor) {
        return {
          offerId: offer.offerId,
          status: 'PRICE_CHANGED',
          isPriceChanged: true,
          previousPriceMinor: offer.priceBreakdown.totalMinor,
          newPriceMinor: computedTotalMinor,
          currency: offer.currency,
          requiresUserAction: true,
          actionMessage: `Composite package component prices changed. Updated total: ${offer.currency} ${(computedTotalMinor / 100).toLocaleString()}.`,
          revalidatedAt: nowIso
        };
      }

      return {
        offerId: offer.offerId,
        status: 'AVAILABLE',
        isPriceChanged: false,
        previousPriceMinor: offer.priceBreakdown.totalMinor,
        newPriceMinor: offer.priceBreakdown.totalMinor,
        currency: offer.currency,
        requiresUserAction: false,
        revalidatedAt: nowIso
      };
    }

    return {
      offerId: offer.offerId,
      status: 'AVAILABLE',
      isPriceChanged: false,
      previousPriceMinor: offer.priceBreakdown.totalMinor,
      newPriceMinor: offer.priceBreakdown.totalMinor,
      currency: offer.currency,
      requiresUserAction: false,
      revalidatedAt: nowIso
    };
  }
}
