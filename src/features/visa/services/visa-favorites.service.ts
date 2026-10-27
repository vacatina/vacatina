/* ============================================================================
 * Vacatina Visa Favorites Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Invariants:
 * 1. Client-side saved consular services persistence.
 * 2. Strictly decoupled from Trip Bucket (saved != staged).
 * ============================================================================ */

import { favoritesService } from '../../../lib/services/favorites.service.ts';
import type { CanonicalVisaOffer } from '../domain/visa-models.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';

const VISA_SERVICES_STORAGE_KEY = 'vacatina_saved_visa_services_v1';

export class VisaFavoritesService {
  private savedOfferIds: Set<string> = new Set();

  constructor() {
    this.loadSavedOfferIds();
  }

  private loadSavedOfferIds(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(VISA_SERVICES_STORAGE_KEY);
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
      localStorage.setItem(VISA_SERVICES_STORAGE_KEY, JSON.stringify(Array.from(this.savedOfferIds)));
    } catch {
      // Graceful fallback
    }
  }

  public toggleVisaFavorite(visa: CanonicalVisaOffer): boolean {
    const isSaved = this.savedOfferIds.has(visa.visaId);
    const title = `${visa.flagEmoji} ${visa.title}`;
    const priceHint = `LKR ${(visa.pricing.totalPriceMinor / 100).toLocaleString()} · ${visa.processingSlaBusinessDays}d SLA`;

    if (isSaved) {
      this.savedOfferIds.delete(visa.visaId);
      favoritesService.remove(visa.canonicalOfferId);
      telemetry.track('visa_favorite_removed', { visaId: visa.visaId });
    } else {
      this.savedOfferIds.add(visa.visaId);
      favoritesService.toggle(visa.canonicalOfferId, 'visa', title, priceHint);
      telemetry.track('visa_favorite_added', { visaId: visa.visaId });
    }

    this.persistSavedOfferIds();
    return !isSaved;
  }

  public isVisaSaved(visaId: string): boolean {
    return this.savedOfferIds.has(visaId);
  }

  public getSavedVisaIds(): string[] {
    return Array.from(this.savedOfferIds);
  }
}

export const visaFavoritesService = new VisaFavoritesService();
