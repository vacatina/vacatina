/* ============================================================================
 * Vacatina Flight Favorites Service
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§28)
 * ============================================================================ */

import { favoritesService } from '../../../lib/services/favorites.service.ts';
import type { CanonicalFlightOffer } from '../domain/flight-models.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';

export interface SavedFlightRoute {
  routeKey: string;
  fromCode: string;
  toCode: string;
  fromCity: string;
  toCity: string;
  savedAtIso: string;
}

const FLIGHT_ROUTES_STORAGE_KEY = 'vacatina_saved_flight_routes_v1';
const FLIGHT_OFFERS_STORAGE_KEY = 'vacatina_saved_flight_offers_v1';

export class FlightFavoritesService {
  private savedOfferIds: Set<string> = new Set();

  constructor() {
    this.loadSavedOfferIds();
  }

  private loadSavedOfferIds(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(FLIGHT_OFFERS_STORAGE_KEY);
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
      localStorage.setItem(FLIGHT_OFFERS_STORAGE_KEY, JSON.stringify(Array.from(this.savedOfferIds)));
    } catch {
      // Graceful fallback
    }
  }

  /**
   * Toggles a flight offer in user favorites.
   */
  public toggleOfferFavorite(offer: CanonicalFlightOffer): boolean {
    const title = `${offer.marketingCarrier.name}: ${offer.origin.airportCode} → ${offer.destination.airportCode} (${offer.flightNumber})`;
    const priceHint = `From LKR ${(offer.price.totalMinor / 100).toLocaleString()}`;
    const destination = `${offer.destination.city} (${offer.destination.airportCode})`;

    let isNowSaved = false;
    if (this.savedOfferIds.has(offer.offerId)) {
      this.savedOfferIds.delete(offer.offerId);
      favoritesService.remove(offer.offerId);
      isNowSaved = false;
    } else {
      this.savedOfferIds.add(offer.offerId);
      favoritesService.toggle(offer.offerId, 'flights', `${destination} · ${title}`, priceHint);
      isNowSaved = true;
    }
    this.persistSavedOfferIds();

    telemetry.track(isNowSaved ? 'flight_favorite_added' : 'flight_favorite_removed', {
      offerId: offer.offerId,
      carrier: offer.marketingCarrier.code,
      route: `${offer.origin.airportCode}-${offer.destination.airportCode}`,
      isNowSaved
    });

    return isNowSaved;
  }

  public isOfferFavorite(offerId: string, offerTitle?: string): boolean {
    if (this.savedOfferIds.has(offerId)) return true;
    if (offerTitle && favoritesService.isSaved(offerTitle)) return true;
    return favoritesService.isSaved(offerId);
  }

  /**
   * Toggles a saved flight route (e.g. CMB ↔ DXB).
   */
  public toggleRouteFavorite(fromCode: string, toCode: string, fromCity: string, toCity: string): boolean {
    const key = `${fromCode.toUpperCase()}_${toCode.toUpperCase()}`;
    const routes = this.getSavedRoutes();
    const existingIdx = routes.findIndex(r => r.routeKey === key);

    if (existingIdx >= 0) {
      routes.splice(existingIdx, 1);
      this.persistRoutes(routes);
      favoritesService.remove(`Route: ${fromCode} ↔ ${toCode}`);
      return false;
    } else {
      routes.push({
        routeKey: key,
        fromCode: fromCode.toUpperCase(),
        toCode: toCode.toUpperCase(),
        fromCity,
        toCity,
        savedAtIso: new Date().toISOString()
      });
      this.persistRoutes(routes);
      favoritesService.toggle(
        `Route: ${fromCode} ↔ ${toCode}`,
        'flights',
        `${toCity} (${toCode})`,
        'Popular route alerts'
      );
      return true;
    }
  }

  public isRouteFavorite(fromCode: string, toCode: string): boolean {
    const key = `${fromCode.toUpperCase()}_${toCode.toUpperCase()}`;
    return this.getSavedRoutes().some(r => r.routeKey === key);
  }

  public getSavedRoutes(): SavedFlightRoute[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(FLIGHT_ROUTES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistRoutes(routes: SavedFlightRoute[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FLIGHT_ROUTES_STORAGE_KEY, JSON.stringify(routes));
    } catch {
      // storage quota or incognito fallback
    }
  }
}

export const flightFavoritesService = new FlightFavoritesService();
