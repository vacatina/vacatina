/* ============================================================================
 * Vacatina Canonical Hotel Adapter Interface
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Requirements:
 * 1. Decouples frontend and search orchestrator from supplier-specific APIs.
 * 2. Unifies Vacatina Direct Manual contracts and LiteAPI Bedbank adapters.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';
import type {
  HotelRevalidationResult,
  HotelSearchRequest
} from '../domain/hotel-search-models.ts';

export interface HotelAdapterCapabilities {
  supportsRealtimeAvailability: boolean;
  supportsInstantConfirmation: boolean;
  supportsDynamicRoomUpgrades: boolean;
  supportsSpecialRequests: boolean;
}

export interface HotelAdapterSearchResult {
  offers: CanonicalHotelOffer[];
  totalMatches: number;
  providerId: string;
  sourceType: 'MANUAL' | 'API' | 'HYBRID';
  executionTimeMs: number;
  isDegraded?: boolean;
}

export interface IHotelAdapter {
  readonly adapterId: string;
  readonly sourceType: 'MANUAL' | 'API' | 'HYBRID';
  readonly providerName: string;
  readonly capabilities: HotelAdapterCapabilities;

  search(request: HotelSearchRequest): Promise<HotelAdapterSearchResult>;
  getOfferById(hotelId: string): Promise<CanonicalHotelOffer | null>;
  revalidate(hotelId: string, roomId: string, planId: string): Promise<HotelRevalidationResult>;
}
