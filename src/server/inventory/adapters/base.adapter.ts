/* ============================================================================
 * Vacatina Base Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md & ADR-006
 * ============================================================================ */

import type {
  CanonicalOfferEntity,
  RevalidationResult,
  SearchQueryCriteria,
  TravelProductSlug
} from '../types.ts';

export interface SupplierAdapterConfig {
  supplierId: string;
  supplierName: string;
  productType: TravelProductSlug;
  environment: 'sandbox' | 'production';
  sandboxBaseUrl: string;
  productionBaseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  timeoutMs: number;
}

export interface BookingHoldResult {
  holdReference: string;
  expiresAtIso: string;
  guaranteedPriceMinor: number;
  currency: string;
}

export interface BookingConfirmResult {
  supplierReference: string;
  ticketOrVoucherNumber?: string;
  confirmedAtIso: string;
  fulfillmentStatus: 'CONFIRMED' | 'PENDING' | 'MANUAL_REVIEW';
}

export interface BookingCancelResult {
  cancellationReference: string;
  cancelledAtIso: string;
  cancellationFeeMinor: number;
  refundEligibleMinor: number;
}

export abstract class BaseSupplierAdapter<TRaw = unknown> {
  protected config: SupplierAdapterConfig;

  constructor(config: SupplierAdapterConfig) {
    this.config = config;
  }

  public get supplierId(): string {
    return this.config.supplierId;
  }

  public get supplierName(): string {
    return this.config.supplierName;
  }

  public get productType(): TravelProductSlug {
    return this.config.productType;
  }

  public get baseUrl(): string {
    return this.config.environment === 'production'
      ? this.config.productionBaseUrl
      : this.config.sandboxBaseUrl;
  }

  public get isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Dispatches search query to upstream supplier and normalizes into CanonicalOfferEntity[]
   */
  public abstract search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]>;

  /**
   * Revalidates price and availability for an existing offer before booking
   */
  public abstract revalidate(supplierOfferId: string): Promise<RevalidationResult>;

  /**
   * Places temporary seat/room hold (e.g. 15-minute PNR hold)
   */
  public abstract hold(offerId: string, durationSeconds?: number): Promise<BookingHoldResult>;

  /**
   * Executes authoritative ticket / voucher issuance
   */
  public abstract confirm(bookingReference: string, holdReference?: string): Promise<BookingConfirmResult>;

  /**
   * Cancels upstream booking and calculates penalty
   */
  public abstract cancel(supplierReference: string, reason: string): Promise<BookingCancelResult>;

  /**
   * Maps heterogeneous raw supplier payload into universal CanonicalOfferEntity
   */
  public abstract normalize(raw: TRaw): CanonicalOfferEntity;
}
