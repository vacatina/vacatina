/* ============================================================================
 * Vacatina Provider-Neutral Flight Adapter Contract
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§3, §34, §35)
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightOptionalService
} from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightRevalidationResult,
  FlightSearchRequest
} from '../domain/search-models.ts';

export interface FlightAdapterCapabilities {
  supportsRealtimeFareRules: boolean;
  supportsAncillaries: boolean;
  supportsSeatSelection: boolean;
  supportsInstantRevalidation: boolean;
  supportsMultiCity: boolean;
}

export interface FlightAdapterSearchResult {
  adapterId: string;
  sourceType: 'manual' | 'supplier_api';
  providerName: string;
  offers: CanonicalFlightOffer[];
  status: 'ok' | 'degraded' | 'error';
  errorMessage?: string;
}

/**
 * Provider-Neutral Flight Adapter Interface
 * All internal and external flight inventory sources must implement this contract.
 */
export interface IFlightAdapter {
  readonly adapterId: string;
  readonly sourceType: 'manual' | 'supplier_api';
  readonly providerName: string;
  readonly capabilities: FlightAdapterCapabilities;

  /**
   * Searches for flights matching the canonical search request.
   */
  search(request: FlightSearchRequest): Promise<FlightAdapterSearchResult>;

  /**
   * Retrieves a single canonical flight offer by ID.
   */
  getOfferById(offerId: string): Promise<CanonicalFlightOffer | null>;

  /**
   * Revalidates price, fare basis, and seat availability prior to Trip Bucket or checkout.
   */
  revalidateOffer(
    offerId: string,
    configuration?: FlightConfigurationSelection
  ): Promise<FlightRevalidationResult>;

  /**
   * Retrieves available optional ancillaries (extra bags, seat selection, lounge passes).
   */
  getAncillaries(offerId: string): Promise<FlightOptionalService[]>;
}
