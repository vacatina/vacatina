/* ============================================================================
 * Vacatina Base Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md & ADR-006
 * ============================================================================ */

import {
  ArchitecturalInvariantViolationError,
  type CanonicalOfferEntity,
  type IntegrationLifecycleStatus,
  type RevalidationResult,
  type SearchQueryCriteria,
  type TravelProductSlug
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
  integrationLifecycle?: IntegrationLifecycleStatus;
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

  public get integrationLifecycle(): IntegrationLifecycleStatus {
    return this.config.integrationLifecycle || 'SCAFFOLD';
  }

  /**
   * Asserts that provider is permitted to execute live production bookings.
   * Prevents premature live bookings for SCAFFOLD or SANDBOX_ACTIVE adapters.
   */
  public assertCanExecuteProductionBooking(): void {
    if (this.config.environment === 'production' && this.integrationLifecycle !== 'PRODUCTION_LIVE') {
      throw new ArchitecturalInvariantViolationError(
        'SCAFFOLD_PRODUCTION_BOOKING_BLOCKED',
        `Supplier '${this.supplierId}' has lifecycle '${this.integrationLifecycle}'. Only 'PRODUCTION_LIVE' providers may execute live production bookings.`
      );
    }
  }

  /**
   * Applies universal Canonical Offer v2.0 baseline fields (ADR-008).
   * Ensures all required contract fields are guaranteed across every upstream adapter.
   */
  protected applyCanonicalContractDefaults(offer: CanonicalOfferEntity): CanonicalOfferEntity {
    const nowIso = new Date().toISOString();
    const expiresAtIso = offer.freshness?.expiresAtIso || new Date(Date.now() + 900000).toISOString();

    if (!offer.offerId) offer.offerId = offer.canonicalOfferId;
    if (!offer.providerId) offer.providerId = offer.supplierId || this.supplierId;
    if (!offer.providerOfferId) offer.providerOfferId = offer.supplierOfferId;
    if (!offer.publicationStatus) offer.publicationStatus = 'PUBLISHED';
    if (!offer.distributionScope) offer.distributionScope = 'BOTH';
    if (!offer.bookingCapability) {
      offer.bookingCapability = offer.confirmationMode === 'INSTANT_CONFIRM' ? 'INSTANT_RESERVATION' : 'REQUEST_TO_BOOK';
    }
    if (!offer.taxesAndFees) {
      offer.taxesAndFees = {
        totalTaxMinor: 0,
        isTaxInclusive: true
      };
    }
    if (!offer.validFrom) offer.validFrom = nowIso;
    if (!offer.validUntil) offer.validUntil = expiresAtIso;
    if (!offer.expiresAt) offer.expiresAt = expiresAtIso;
    if (!offer.lastCheckedAt) offer.lastCheckedAt = nowIso;
    if (offer.requiresRevalidation === undefined) {
      offer.requiresRevalidation = offer.inventorySource === 'API';
    }
    if (offer.isExclusiveDeal === undefined) {
      offer.isExclusiveDeal = false;
    }
    if (!offer.pinAudit) {
      offer.pinAudit = {
        isPinned: Boolean(offer.pinAboveApi)
      };
    }
    return offer;
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
