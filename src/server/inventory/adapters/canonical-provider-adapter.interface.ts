/* ============================================================================
 * Vacatina Canonical Provider Adapter Interface
 * Authority: Requirement 4 & 11 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 *
 * Requirements:
 * 1. Supplier API inventory is NEVER copied into manual listing tables.
 * 2. Adapters normalize upstream supplier responses into UnifiedCanonicalOffer.
 * 3. Enforces provider pluggability across all 10 products:
 *    Flights, Hotels, Cars & Transfers, Packages, Visa, Rails, Cruises,
 *    Activities, Sightseeing, Insurance.
 * ============================================================================ */

import type { TravelProductSlug } from '../types.ts';
import type {
  CanonicalOfferSourceType,
  CanonicalOffer,
  CanonicalRevalidationResult,
  CanonicalSearchCriteria,
  UnifiedCanonicalOffer
} from '../domain/canonical-offer.ts';

export interface ICanonicalProviderAdapter {
  readonly providerId: string;                  // e.g. 'duffel_ndc', 'liteapi_v2', 'viator_act', 'manual_cms'
  readonly supplierId: string;                  // e.g. 'DUFFEL', 'LITEAPI', 'VIATOR', 'VACATINA_DIRECT'
  readonly productType: TravelProductSlug;      // 'flights' | 'hotels' | 'cars' | etc.
  readonly sourceType: CanonicalOfferSourceType;

  /**
   * Pings upstream gateway to verify API keys and network health.
   */
  isHealthy(): Promise<boolean>;

  /**
   * Executes search query against upstream supplier and returns normalized offers.
   */
  search(criteria: CanonicalSearchCriteria): Promise<CanonicalOffer[]>;

  /**
   * Retrieves single offer by provider/offer ID.
   */
  getOfferById(offerId: string): Promise<CanonicalOffer | null>;

  /**
   * Executes atomic pre-booking price and seat/room revalidation.
   */
  revalidate(offerId: string, currentPriceMinor: number): Promise<CanonicalRevalidationResult>;
}

// ----------------------------------------------------------------------------
// Vertical-Specific Canonical Supplier Adapter Contracts
// ----------------------------------------------------------------------------

export interface FlightSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'flights';
}

export interface HotelSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'hotels';
}

export interface TransferSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'cars';
}

export interface RailSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'rails';
}

export interface CruiseSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'cruises';
}

export interface ActivitySupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'activities';
}

export interface SightseeingSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'sightseeing';
}

export interface InsuranceSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'insurance';
}

export interface VisaSupplierAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'visa';
}

export interface CompositePackageAdapter extends ICanonicalProviderAdapter {
  readonly productType: 'packages';
}

export interface ManualInventoryAdapter extends ICanonicalProviderAdapter {
  readonly sourceType: 'MANUAL' | 'DIRECT_CONTRACT';
}
