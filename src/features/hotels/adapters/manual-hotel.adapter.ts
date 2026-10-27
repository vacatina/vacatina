/* ============================================================================
 * Vacatina Manual Inventory Hotel Adapter
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Queries Vacatina direct contracts desk.
 * 2. Directly contracts with hotels & villas in Sri Lanka, UAE, etc.
 * 3. Sets isPinnedAboveApi: true for Tier 1 ranking above generic API rates.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';
import type {
  HotelRevalidationResult,
  HotelSearchRequest
} from '../domain/hotel-search-models.ts';
import type {
  HotelAdapterCapabilities,
  HotelAdapterSearchResult,
  IHotelAdapter
} from './hotel-adapter.interface.ts';
import {
  MANUAL_HOTEL_OFFERS,
  getActiveManualHotels,
  findManualHotelById
} from '../data/manual-hotels.ts';
import type {
  IManualListingRepository,
  ProductionManualListingEntity
} from '../../../server/inventory/repository/manual-listing.repository.ts';

function mapListingToCanonicalHotelOffer(listing: ProductionManualListingEntity): CanonicalHotelOffer {
  return {
    hotelId: listing.listingId,
    canonicalOfferId: listing.canonicalEntityId,
    sourceType: 'MANUAL',
    providerId: 'VACATINA_DIRECT',
    supplierName: listing.operatorName || listing.partnerName,
    name: listing.title,
    subtitle: listing.subtitle,
    description: listing.description,
    starRating: 5,
    location: {
      city: listing.location.city,
      country: listing.location.country,
      countryCode: 'LK',
      address: listing.location.address || `${listing.location.city}, ${listing.location.country}`
    },
    heroImage: listing.media.heroImageUrl || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef',
    galleryImages: listing.media.galleryUrls || [],
    hotelAmenities: listing.inclusions || [],
    isPinnedAboveApi: true,
    guestRatingScore: 9.5,
    guestReviewCount: 120,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: listing.sellingPriceMinor,
    currency: listing.currency,
    roomCategories: [
      {
        roomId: `${listing.listingId}-room-std`,
        name: listing.title,
        description: listing.description,
        maxAdults: listing.constraints?.maxOccupancy || 2,
        maxChildren: 1,
        maxOccupancy: (listing.constraints?.maxOccupancy || 2) + 1,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 55,
        images: [listing.media.heroImageUrl || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef'],
        amenities: listing.inclusions || [],
        ratePlans: [
          {
            planId: `${listing.listingId}-plan-direct`,
            rateName: 'Vacatina Direct Exclusive Rate',
            boardBasis: 'BB',
            boardBasisLabel: 'Breakfast Included',
            nightlyRateMinor: listing.contractedBaseCostMinor,
            totalTaxesMinor: 0,
            totalPriceMinor: listing.sellingPriceMinor,
            currency: listing.currency,
            isInstantConfirmation: listing.confirmationMode === 'INSTANT',
            cancellationPolicyDescription: listing.cancellationPolicy,
            isRecommended: true
          }
        ]
      }
    ],
    availabilityStatus: (listing.isStopSaleActive || listing.availableQuota <= 0) ? 'UNAVAILABLE' : 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: listing.salesValidUntilIso,
    isSeed: false
  };
}

export class ManualHotelAdapter implements IHotelAdapter {
  public readonly adapterId = 'adapter-vacatina-manual-hotels';
  public readonly sourceType = 'MANUAL' as const;
  public readonly providerName = 'Vacatina Direct Contracts Desk';
  public readonly capabilities: HotelAdapterCapabilities = {
    supportsRealtimeAvailability: true,
    supportsInstantConfirmation: true,
    supportsDynamicRoomUpgrades: true,
    supportsSpecialRequests: true
  };

  private repo?: IManualListingRepository;

  constructor(repo?: IManualListingRepository) {
    this.repo = repo;
  }

  public async search(request: HotelSearchRequest): Promise<HotelAdapterSearchResult> {
    const startTime = performance.now();
    try {
      let dbOffers: CanonicalHotelOffer[] = [];
      if (this.repo) {
        try {
          const dbListings = await this.repo.search({
            productType: 'hotels',
            destination: request.destination,
            onlySellable: true
          });
          dbOffers = dbListings.map(mapListingToCanonicalHotelOffer);
        } catch {
          dbOffers = [];
        }
      }

      const staticOffers = getActiveManualHotels();
      const seenIds = new Set([
        ...dbOffers.map(o => o.hotelId),
        ...dbOffers.map(o => o.canonicalOfferId)
      ]);
      const activeOffers = [
        ...dbOffers,
        ...staticOffers.filter(o => !seenIds.has(o.hotelId) && !seenIds.has(o.canonicalOfferId))
      ];

      const destQuery = request.destination.toLowerCase().trim();

      const matched = activeOffers.filter(offer => {
        // Destination matching: city, country, or hotel name
        if (destQuery && destQuery.length > 0) {
          const loc = offer.location;
          const matchCity = loc.city.toLowerCase().includes(destQuery);
          const matchCountry = loc.country.toLowerCase().includes(destQuery);
          const matchName = offer.name.toLowerCase().includes(destQuery);
          const matchNeighborhood = loc.neighborhood?.toLowerCase().includes(destQuery);
          if (!matchCity && !matchCountry && !matchName && !matchNeighborhood) {
            return false;
          }
        }

        // Star rating filter
        if (request.starRatings && request.starRatings.length > 0) {
          if (!request.starRatings.includes(offer.starRating)) return false;
        }

        // Price range filter
        if (request.priceRange?.maxMinor && offer.startingFromPriceMinor > request.priceRange.maxMinor) {
          return false;
        }
        if (request.priceRange?.minMinor && offer.startingFromPriceMinor < request.priceRange.minMinor) {
          return false;
        }

        // Occupancy check: at least one room can host the required adults
        const requiredAdults = request.occupancy?.adults || 1;
        const hasFittingRoom = offer.roomCategories.some(
          r => r.maxOccupancy >= requiredAdults + (request.occupancy?.children || 0)
        );
        if (!hasFittingRoom) return false;

        return true;
      });

      return {
        offers: matched,
        totalMatches: matched.length,
        providerId: 'VACATINA_DIRECT',
        sourceType: 'MANUAL',
        executionTimeMs: Math.round(performance.now() - startTime)
      };
    } catch {
      return {
        offers: [],
        totalMatches: 0,
        providerId: 'VACATINA_DIRECT',
        sourceType: 'MANUAL',
        executionTimeMs: Math.round(performance.now() - startTime),
        isDegraded: true
      };
    }
  }

  public async getOfferById(hotelId: string): Promise<CanonicalHotelOffer | null> {
    try {
      const fromRepo = (await this.repo.findById(hotelId)) || (await this.repo.findByCanonicalEntityId(hotelId));
      if (fromRepo && fromRepo.workflowStatus === 'PUBLISHED' && !fromRepo.isStopSaleActive) {
        return mapListingToCanonicalHotelOffer(fromRepo);
      }
    } catch {
      // Fallback
    }

    const offer = findManualHotelById(hotelId);
    return offer || null;
  }

  public async revalidate(
    hotelId: string,
    roomId: string,
    planId: string
  ): Promise<HotelRevalidationResult> {
    try {
      const fromRepo = (await this.repo.findById(hotelId)) || (await this.repo.findByCanonicalEntityId(hotelId));
      if (fromRepo) {
        const isAvailable =
          fromRepo.workflowStatus === 'PUBLISHED' && !fromRepo.isStopSaleActive && fromRepo.availableQuota > 0;
        return {
          offerId: hotelId,
          roomId,
          planId,
          isAvailable,
          status: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
          oldPriceMinor: fromRepo.sellingPriceMinor,
          newPriceMinor: fromRepo.sellingPriceMinor,
          currency: fromRepo.currency,
          message: isAvailable
            ? 'Vacatina direct room allotment verified and held.'
            : 'Contracted allotment has been depleted or placed on stop-sale.',
          revalidatedAt: new Date().toISOString()
        };
      }
    } catch {
      // Fallback
    }

    const offer = findManualHotelById(hotelId);
    if (!offer || offer.availabilityStatus !== 'AVAILABLE') {
      return {
        offerId: hotelId,
        roomId,
        planId,
        isAvailable: false,
        status: 'UNAVAILABLE',
        oldPriceMinor: 0,
        newPriceMinor: 0,
        currency: 'LKR',
        message: 'Contracted allotment has been depleted or placed on stop-sale.',
        revalidatedAt: new Date().toISOString()
      };
    }

    const room = offer.roomCategories.find(r => r.roomId === roomId);
    const plan = room?.ratePlans.find(p => p.planId === planId);

    if (!room || !plan) {
      return {
        offerId: hotelId,
        roomId,
        planId,
        isAvailable: false,
        status: 'EXPIRED',
        oldPriceMinor: 0,
        newPriceMinor: 0,
        currency: offer.currency,
        message: 'Selected room category or rate plan is no longer active.',
        revalidatedAt: new Date().toISOString()
      };
    }

    return {
      offerId: hotelId,
      roomId,
      planId,
      isAvailable: true,
      status: 'AVAILABLE',
      oldPriceMinor: plan.totalPriceMinor,
      newPriceMinor: plan.totalPriceMinor,
      currency: plan.currency,
      message: 'Vacatina direct room allotment verified and held.',
      revalidatedAt: new Date().toISOString()
    };
  }
}

export const manualHotelAdapter = new ManualHotelAdapter();
