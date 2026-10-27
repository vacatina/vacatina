/* ============================================================================
 * Vacatina Hotel Favorites Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Client-side saved hotels persistence.
 * 2. Strictly decoupled from Trip Bucket (saved != staged).
 * ============================================================================ */

import { favoritesService } from '../../../lib/services/favorites.service.ts';
import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';

const HOTEL_OFFERS_STORAGE_KEY = 'vacatina_saved_hotel_offers_v1';

export class HotelFavoritesService {
  private savedOfferIds: Set<string> = new Set();

  constructor() {
    this.loadSavedOfferIds();
  }

  private loadSavedOfferIds(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(HOTEL_OFFERS_STORAGE_KEY);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.savedOfferIds = new Set(parsed);
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  private persistSavedOfferIds(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(HOTEL_OFFERS_STORAGE_KEY, JSON.stringify(Array.from(this.savedOfferIds)));
    } catch {
      // Graceful fallback
    }
  }

  public toggleHotelFavorite(hotel: CanonicalHotelOffer): boolean {
    const isSaved = this.savedOfferIds.has(hotel.hotelId);
    const title = `${hotel.name} (${hotel.starRating}★) — ${hotel.location.city}`;
    const priceHint = `From LKR ${(hotel.startingFromPriceMinor / 100).toLocaleString()}/night`;
    const destination = `${hotel.location.city}, ${hotel.location.country}`;

    if (isSaved) {
      this.savedOfferIds.delete(hotel.hotelId);
      this.persistSavedOfferIds();
      favoritesService.remove(hotel.hotelId);
      telemetry.track('hotel_favorite_removed', { hotelId: hotel.hotelId });
      return false;
    } else {
      this.savedOfferIds.add(hotel.hotelId);
      this.persistSavedOfferIds();
      favoritesService.toggle(hotel.hotelId, 'hotels', `${destination} · ${title}`, priceHint);
      telemetry.track('hotel_favorite_added', { hotelId: hotel.hotelId });
      return true;
    }
  }

  public isHotelFavorite(hotelId: string): boolean {
    return this.savedOfferIds.has(hotelId);
  }
}

export const hotelFavoritesService = new HotelFavoritesService();
