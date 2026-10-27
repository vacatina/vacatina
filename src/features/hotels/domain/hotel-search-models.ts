/* ============================================================================
 * Vacatina Canonical Hotel Search Models
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

import type { CanonicalHotelOffer, HotelBoardBasisCode } from './hotel-models.ts';

export interface HotelOccupancyRequest {
  rooms: number;
  adults: number;
  children: number;
  childAges?: number[];
}

export interface HotelSearchRequest {
  searchId: string;
  destination: string;                  // City, region, or landmark query (e.g. "Bentota", "Dubai", "Colombo")
  cityCode?: string;
  checkInDate: string;                  // YYYY-MM-DD
  checkOutDate: string;                 // YYYY-MM-DD
  occupancy: HotelOccupancyRequest;
  starRatings?: number[];               // Filter: e.g. [4, 5]
  priceRange?: {
    minMinor?: number;
    maxMinor?: number;
  };
  boardBasis?: HotelBoardBasisCode[];   // Filter: e.g. ['BB', 'HB', 'AI']
  amenities?: string[];                 // Filter: e.g. ['Pool', 'Spa', 'Beach']
  freeCancellationOnly?: boolean;
}

export type HotelSortOption =
  | 'recommended'
  | 'price_low_high'
  | 'price_high_low'
  | 'guest_rating'
  | 'stars_high_low';

export interface HotelFilterCriteria {
  starRatings?: number[];
  maxPriceMinor?: number;
  boardBasis?: HotelBoardBasisCode[];
  amenities?: string[];
  freeCancellationOnly?: boolean;
  directContractOnly?: boolean;
}

export interface HotelSearchFacets {
  starCounts: Record<number, number>;
  boardBasisCounts: Record<string, number>;
  minPriceMinor: number;
  maxPriceMinor: number;
  amenityCounts: Record<string, number>;
}

export interface HotelSearchResponse {
  searchId: string;
  request: HotelSearchRequest;
  offers: CanonicalHotelOffer[];
  totalCount: number;
  lowestPriceMinor: number;
  currency: string;
  facets: HotelSearchFacets;
  isStale: boolean;
  searchedAt: string;
}

export interface HotelRevalidationResult {
  offerId: string;
  roomId: string;
  planId: string;
  isAvailable: boolean;
  status: 'AVAILABLE' | 'PRICE_CHANGED' | 'UNAVAILABLE' | 'EXPIRED';
  oldPriceMinor: number;
  newPriceMinor: number;
  currency: string;
  message?: string;
  revalidatedAt: string;
}
