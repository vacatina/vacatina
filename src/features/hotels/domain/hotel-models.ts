/* ============================================================================
 * Vacatina Canonical Hotel Domain Models
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Requirements:
 * 1. Provider-neutral canonical hotel property and room rate model.
 * 2. Multi-tier inventory support: MANUAL (Vacatina Direct), API (LiteAPI Bedbank), HYBRID.
 * 3. Structured room categories with granular board basis options (RO, BB, HB, FB, AI).
 * 4. Transparent cancellation policies, amenities, and commercial provenance.
 * 5. SEED quarantine: isSeed is strictly false for bookable hotel inventory.
 * ============================================================================ */

import type { CanonicalOfferSourceType, CanonicalOfferLifecycleStatus } from '../../../server/inventory/domain/canonical-offer.ts';

export type HotelBoardBasisCode = 'RO' | 'BB' | 'HB' | 'FB' | 'AI';

export interface HotelLocation {
  city: string;
  country: string;
  countryCode: string;
  address: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  distanceToCenterKm?: number;
}

export interface HotelRatePlan {
  planId: string;
  rateName: string;                     // e.g. "Standard Rate", "Vacatina Exclusive Rate"
  boardBasis: HotelBoardBasisCode;      // RO, BB, HB, FB, AI
  boardBasisLabel: string;               // e.g. "Breakfast Included", "Half Board (Dinner + Breakfast)"
  nightlyRateMinor: number;
  totalTaxesMinor: number;
  totalPriceMinor: number;
  currency: string;
  isInstantConfirmation: boolean;
  freeCancellationBefore?: string;      // ISO 8601 UTC or undefined
  cancellationPolicyDescription: string;
  isRecommended?: boolean;
}

export interface HotelRoomCategory {
  roomId: string;
  name: string;                         // e.g. "Deluxe Ocean View King", "Premier Lagoon Suite"
  description: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  bedConfiguration: string;             // e.g. "1 King Bed" or "2 Queen Beds"
  roomSizeSqm: number;
  images: string[];
  amenities: string[];                  // e.g. ["Balcony", "Free Wi-Fi", "Espresso Machine", "Rain Shower"]
  ratePlans: HotelRatePlan[];
}

export interface CanonicalHotelOffer {
  inventoryMode?: 'demo_fixture' | 'manual_request' | 'live_supplier';
  hotelId: string;                      // Stable hotel property ID
  canonicalOfferId: string;             // Stable universal offer ID (e.g. vct-ht-man-ceylon-heritage)
  sourceType: CanonicalOfferSourceType; // 'MANUAL' | 'API' | 'HYBRID'
  providerId: string;                   // 'VACATINA_DIRECT' | 'LITEAPI'
  supplierName: string;                 // 'Vacatina Direct Contracts' | 'LiteAPI Global Bedbank'
  name: string;                         // e.g. "Ceylon Heritage Ocean Villa & Spa"
  subtitle?: string;
  description: string;
  starRating: number;                   // 1 to 5 stars
  location: HotelLocation;
  heroImage: string;
  galleryImages: string[];
  hotelAmenities: string[];             // e.g. ["Infinity Pool", "Private Beach", "Fine Dining", "Spa"]
  featuredBadge?: string;               // e.g. "Vacatina Direct Exclusive", "Best Seller", "Luxury Sanctuary"
  isPinnedAboveApi: boolean;            // Direct contracted hotels are pinned above API
  guestRatingScore: number;             // e.g. 9.4
  guestReviewCount: number;             // e.g. 340
  checkInTime: string;                  // e.g. "15:00"
  checkOutTime: string;                 // e.g. "12:00"
  startingFromPriceMinor: number;       // Lowest available room rate across plans
  currency: string;
  roomCategories: HotelRoomCategory[];
  availabilityStatus: CanonicalOfferLifecycleStatus;
  lastCheckedAt: string;                // ISO 8601 UTC
  validUntil: string;                   // ISO 8601 UTC
  isSeed: false;                        // Strict quarantine
}

export interface HotelSelectedConfiguration {
  hotelId: string;
  canonicalOfferId: string;
  roomId: string;
  roomName: string;
  planId: string;
  rateName: string;
  boardBasis: HotelBoardBasisCode;
  boardBasisLabel: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomsCount: number;
  adultsCount: number;
  childrenCount: number;
  nightlyRateMinor: number;
  taxesMinor: number;
  totalPriceMinor: number;
  currency: string;
  freeCancellationBefore?: string;
  cancellationPolicyDescription: string;
  sourceType: CanonicalOfferSourceType;
  supplierName: string;
}
