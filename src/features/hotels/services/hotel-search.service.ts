/* ============================================================================
 * Vacatina Canonical Hotel Search Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Parallel execution across MANUAL (Vacatina Direct) and API (LiteAPI Bedbank).
 * 2. Strict SEED quarantine: filters any demo item with isSeed === true.
 * 3. Enforces Pin-Above-API ranking: Direct manual contracts pinned to the top.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';
import type {
  HotelFilterCriteria,
  HotelRevalidationResult,
  HotelSearchFacets,
  HotelSearchRequest,
  HotelSearchResponse,
  HotelSortOption
} from '../domain/hotel-search-models.ts';
import { manualHotelAdapter } from '../adapters/manual-hotel.adapter.ts';
import { liteApiHotelAdapter } from '../adapters/liteapi-hotel.adapter.ts';

export class HotelSearchService {
  private lastSearchResponse: HotelSearchResponse | null = null;

  public async search(request: HotelSearchRequest): Promise<HotelSearchResponse> {
    const [manualResult, supplierResult] = await Promise.all([
      manualHotelAdapter.search(request),
      liteApiHotelAdapter.search(request)
    ]);

    // Merge and strictly quarantine any SEED content
    const allOffers: CanonicalHotelOffer[] = [
      ...manualResult.offers,
      ...supplierResult.offers
    ].filter(o => (o as any).isSeed !== true);

    // Compute facets
    const facets = this.computeFacets(allOffers);

    // Apply default Pin-Above-API ranking
    const rankedOffers = this.rankOffers(allOffers, 'recommended');

    const lowestPrice = rankedOffers.length > 0
      ? Math.min(...rankedOffers.map(o => o.startingFromPriceMinor))
      : 0;

    const response: HotelSearchResponse = {
      searchId: request.searchId || `hotel-srch-${Date.now()}`,
      request,
      offers: rankedOffers,
      totalCount: rankedOffers.length,
      lowestPriceMinor: lowestPrice,
      currency: rankedOffers[0]?.currency || 'LKR',
      facets,
      isStale: false,
      searchedAt: new Date().toISOString()
    };

    this.lastSearchResponse = response;
    return response;
  }

  public async getOfferById(hotelId: string): Promise<CanonicalHotelOffer | null> {
    // Check manual adapter first
    const manual = await manualHotelAdapter.getOfferById(hotelId);
    if (manual) return manual;

    // Check supplier adapter
    return await liteApiHotelAdapter.getOfferById(hotelId);
  }

  public async revalidate(
    hotelId: string,
    roomId: string,
    planId: string
  ): Promise<HotelRevalidationResult> {
    const offer = await this.getOfferById(hotelId);
    if (!offer) {
      return {
        offerId: hotelId,
        roomId,
        planId,
        isAvailable: false,
        status: 'UNAVAILABLE',
        oldPriceMinor: 0,
        newPriceMinor: 0,
        currency: 'LKR',
        message: 'Hotel property not found in registry.',
        revalidatedAt: new Date().toISOString()
      };
    }

    if (offer.sourceType === 'MANUAL') {
      return await manualHotelAdapter.revalidate(hotelId, roomId, planId);
    }
    return await liteApiHotelAdapter.revalidate(hotelId, roomId, planId);
  }

  public filterAndSortOffers(
    offers: CanonicalHotelOffer[],
    filters: HotelFilterCriteria,
    sort: HotelSortOption = 'recommended'
  ): CanonicalHotelOffer[] {
    let filtered = offers.filter(offer => {
      // Direct contract only filter
      if (filters.directContractOnly && offer.sourceType !== 'MANUAL') {
        return false;
      }

      // Star rating filter
      if (filters.starRatings && filters.starRatings.length > 0) {
        if (!filters.starRatings.includes(offer.starRating)) return false;
      }

      // Max price filter
      if (filters.maxPriceMinor && offer.startingFromPriceMinor > filters.maxPriceMinor) {
        return false;
      }

      // Board basis filter: at least one room has one of the requested board bases
      if (filters.boardBasis && filters.boardBasis.length > 0) {
        const hasBoard = offer.roomCategories.some(r =>
          r.ratePlans.some(p => filters.boardBasis!.includes(p.boardBasis))
        );
        if (!hasBoard) return false;
      }

      // Free cancellation only
      if (filters.freeCancellationOnly) {
        const hasFreeCanc = offer.roomCategories.some(r =>
          r.ratePlans.some(p => !!p.freeCancellationBefore)
        );
        if (!hasFreeCanc) return false;
      }

      // Amenities filter
      if (filters.amenities && filters.amenities.length > 0) {
        const hasAllAmenities = filters.amenities.every(reqAmenity =>
          offer.hotelAmenities.some(a => a.toLowerCase().includes(reqAmenity.toLowerCase()))
        );
        if (!hasAllAmenities) return false;
      }

      return true;
    });

    return this.rankOffers(filtered, sort);
  }

  public rankOffers(offers: CanonicalHotelOffer[], sort: HotelSortOption): CanonicalHotelOffer[] {
    const list = [...offers];

    if (sort === 'recommended') {
      // Pin-Above-API Rule: Tier 1 (Manual Direct) pinned top, then Supplier API by ascending price
      return list.sort((a, b) => {
        if (a.isPinnedAboveApi && !b.isPinnedAboveApi) return -1;
        if (!a.isPinnedAboveApi && b.isPinnedAboveApi) return 1;
        // Secondary: Guest rating score descending
        if (b.guestRatingScore !== a.guestRatingScore) {
          return b.guestRatingScore - a.guestRatingScore;
        }
        return a.startingFromPriceMinor - b.startingFromPriceMinor;
      });
    }

    if (sort === 'price_low_high') {
      return list.sort((a, b) => a.startingFromPriceMinor - b.startingFromPriceMinor);
    }

    if (sort === 'price_high_low') {
      return list.sort((a, b) => b.startingFromPriceMinor - a.startingFromPriceMinor);
    }

    if (sort === 'guest_rating') {
      return list.sort((a, b) => b.guestRatingScore - a.guestRatingScore);
    }

    if (sort === 'stars_high_low') {
      return list.sort((a, b) => b.starRating - a.starRating);
    }

    return list;
  }

  private computeFacets(offers: CanonicalHotelOffer[]): HotelSearchFacets {
    const starCounts: Record<number, number> = {};
    const boardBasisCounts: Record<string, number> = {};
    const amenityCounts: Record<string, number> = {};
    let minPrice = Infinity;
    let maxPrice = 0;

    for (const o of offers) {
      // Stars
      starCounts[o.starRating] = (starCounts[o.starRating] || 0) + 1;

      // Price
      if (o.startingFromPriceMinor < minPrice) minPrice = o.startingFromPriceMinor;
      if (o.startingFromPriceMinor > maxPrice) maxPrice = o.startingFromPriceMinor;

      // Board
      for (const r of o.roomCategories) {
        for (const p of r.ratePlans) {
          boardBasisCounts[p.boardBasis] = (boardBasisCounts[p.boardBasis] || 0) + 1;
        }
      }

      // Amenities
      for (const a of o.hotelAmenities) {
        amenityCounts[a] = (amenityCounts[a] || 0) + 1;
      }
    }

    return {
      starCounts,
      boardBasisCounts,
      minPriceMinor: minPrice === Infinity ? 0 : minPrice,
      maxPriceMinor: maxPrice,
      amenityCounts
    };
  }
}

export const hotelSearchService = new HotelSearchService();
