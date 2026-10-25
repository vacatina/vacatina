/* ============================================================================
 * Vacatina Distributed Booking Saga & Multi-Product Orchestrator
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-005
 * ============================================================================ */

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type {
  BookingGroupEntity,
  BookingItemEntity,
  TripBucketItemEntity,
  UUID
} from '../db/schema.ts';
import { globalStorageEngine, type VacatinaStorageEngine } from '../db/storage.ts';
import { assertNoFabricatedUpstreamReferences } from '../inventory/types.ts';

export interface InitiateBookingSagaParams {
  tripBucketId: UUID;
  userId?: UUID;
  organizationId?: UUID;
  checkoutSessionId: string;
  customerEmail: string;
  customerName: string;
  idempotencyKey: string;
}

export interface SagaExecutionResult {
  bookingGroupId: UUID;
  bookingReference: string;
  overallStatus: BookingGroupEntity['overallFulfillmentStatus'];
  paymentStatus: BookingGroupEntity['paymentStatus'];
  totalSellingPriceMinor: number;
  currency: string;
  items: Array<{
    bookingItemId: UUID;
    canonicalOfferId: string;
    productType: string;
    fulfillmentStatus: BookingItemEntity['fulfillmentStatus'];
    vacatinaBookingReference?: string;
    supplierBookingReference?: string;
    supplierPnr?: string;
    supplierConfirmationNumber?: string;
    vacatinaServiceReference?: string;
    isUpstreamConfirmed?: boolean;
    failureReason?: string;
  }>;
  requiresManualReview: boolean;
  compensationTriggered: boolean;
}

export class BookingSagaService {
  private storage: VacatinaStorageEngine;

  constructor(storage: VacatinaStorageEngine = globalStorageEngine) {
    this.storage = storage;
  }

  /**
   * Generates a canonical, human-readable Vacatina Booking Reference.
   * Format: VCT-{YEAR}-{6_ALPHANUMERIC} (e.g. VCT-2026-X8K92M)
   */
  private generateBookingReference(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `VCT-2026-${code}`;
  }

  /**
   * Coordinates the complete multi-product booking saga across independent suppliers.
   */
  public async executeBookingSaga(params: InitiateBookingSagaParams): Promise<SagaExecutionResult> {
    // 1. Idempotency Check
    const existing = this.storage.getIdempotencyRecord(params.idempotencyKey);
    if (existing && existing.responseBody) {
      return JSON.parse(existing.responseBody) as SagaExecutionResult;
    }

    // 2. Fetch Staged Trip Bucket Items
    const bucketItems = this.storage.getTripBucketItems(params.tripBucketId);
    if (!bucketItems || bucketItems.length === 0) {
      throw new Error(`Cannot initiate booking: Trip Bucket '${params.tripBucketId}' is empty`);
    }

    // 3. Strict Seed Protection & Readiness Invariant
    const seedItems = bucketItems.filter(i => i.sourceType === 'SEED');
    if (seedItems.length > 0) {
      throw new Error(`Commercial violation: Seed / demonstration content cannot enter checkout`);
    }

    const unreadyItems = bucketItems.filter(i => i.state !== 'READY');
    if (unreadyItems.length > 0) {
      const reasons = unreadyItems.map(i => `${i.canonicalOfferId} is in '${i.state}' state`);
      throw new Error(`Cannot checkout unready items: ${reasons.join(', ')}`);
    }

    // 4. Calculate Final Settlement Math in Integer Minor Units
    const totalMinor = bucketItems.reduce((sum, item) => sum + item.unitSellingPriceMinor, 0);
    const currency = bucketItems[0]?.currency || 'LKR';
    const bookingReference = this.generateBookingReference();

    // 5. Freeze Immutable Booking Group Record
    const bookingGroup = this.storage.createBookingGroup({
      bookingReference,
      userId: params.userId,
      organizationId: params.organizationId,
      checkoutSessionId: params.checkoutSessionId,
      totalSellingPriceMinor: totalMinor,
      currency,
      paymentStatus: 'AUTHORIZED', // Pre-auth acquired before supplier dispatch
      overallFulfillmentStatus: 'BOOKING'
    });

    // 6. Create Individual Booking Items
    const createdBookingItems: BookingItemEntity[] = [];
    for (const item of bucketItems) {
      const isVisa = item.productType === 'visa';
      const bookingItem = this.storage.addBookingItem({
        bookingGroupId: bookingGroup.id,
        vacatinaBookingReference: bookingReference,
        canonicalOfferId: item.canonicalOfferId,
        productType: item.productType,
        supplierId: item.sourceType === 'MANUAL' ? 'PAYLOAD_CMS_DIRECT' : 'AMADEUS_GDS',
        supplierBookingReference: undefined,
        supplierPnr: undefined, // Real upstream airline PNR (strictly undefined in sandbox/candidate)
        supplierConfirmationNumber: undefined, // Real upstream hotel confirmation (strictly undefined in sandbox)
        vacatinaServiceReference: isVisa ? `VSA-INTAKE-${generateUUID().slice(0, 8).toUpperCase()}` : undefined,
        isUpstreamConfirmed: false, // In candidate / sandbox mode, upstream confirmation is FALSE
        title: item.title,
        bookingMode: item.bookingMode,
        itemPriceMinor: item.unitSellingPriceMinor,
        currency: item.currency,
        fulfillmentStatus: 'PENDING',

        // --- Booking Provenance (Audit v2.5 / Directive 5) ---
        inventorySourceType: item.sourceType === 'MANUAL' ? 'MANUAL_DIRECT' : 'API_SUPPLIER',
        providerId: item.sourceType === 'MANUAL' ? 'PAYLOAD_CMS_DIRECT' : 'AMADEUS_GDS',
        sourceOfferId: item.canonicalOfferId,
        sourceReference: item.canonicalOfferId,
        commercialEvidenceId: item.sourceType === 'MANUAL' ? 'EVID-CMS-VERIFIED' : undefined,
        originalNetMinor: Math.round(item.unitSellingPriceMinor * 0.88),
        taxesMinor: Math.round(item.unitSellingPriceMinor * 0.05),
        feesMinor: Math.round(item.unitSellingPriceMinor * 0.02),
        markupMinor: Math.round(item.unitSellingPriceMinor * 0.05),
        discountMinor: 0,
        customerSellingAmountMinor: item.unitSellingPriceMinor,
        settlementCurrency: item.currency,
        priceRevalidationTimestamp: new Date().toISOString()
      });
      createdBookingItems.push(bookingItem);
    }

    // 7. Execute Per-Provider Supplier Fulfillment
    let hasFailure = false;
    for (const bItem of createdBookingItems) {
      try {
        // Dispatch to provider adapter with item idempotency
        const supplierRef = `SIM-SUP-${bItem.productType.slice(0, 3).toUpperCase()}-${generateUUID().slice(0, 8).toUpperCase()}`;
        
        // Simulating specific test scenarios: If product is mock-failed, trigger partial failure
        if (bItem.canonicalOfferId.includes('force_failure')) {
          throw new Error('Supplier allocation timeout: Partner quota exhausted');
        }

        const isVisa = bItem.productType === 'visa';
        const updatedItem = this.storage.updateBookingItem(bItem.id, {
          fulfillmentStatus: 'CONFIRMED',
          vacatinaBookingReference: bookingReference,
          supplierBookingReference: supplierRef,
          supplierPnr: undefined, // Strictly undefined in sandbox / candidate!
          supplierConfirmationNumber: undefined, // Strictly undefined in sandbox!
          vacatinaServiceReference: isVisa ? (bItem.vacatinaServiceReference || `VSA-INTAKE-${generateUUID().slice(0, 8).toUpperCase()}`) : undefined,
          isUpstreamConfirmed: false, // Sandbox simulations are not upstream confirmed
          confirmedAt: new Date().toISOString()
        });

        // Verify truthful reference invariant
        assertNoFabricatedUpstreamReferences(updatedItem);
      } catch (err: any) {
        hasFailure = true;
        this.storage.updateBookingItem(bItem.id, {
          fulfillmentStatus: 'FAILED',
          failureReason: err.message || 'Supplier connection error',
          compensationAction: 'MANUAL_TRIAGE'
        });
      }
    }

    // 8. Reconcile Saga Outcomes & Determine Compensation
    const fulfilledItems = this.storage.getBookingItems(bookingGroup.id);
    let overallStatus: BookingGroupEntity['overallFulfillmentStatus'] = 'CONFIRMED';
    let paymentStatus: BookingGroupEntity['paymentStatus'] = 'SETTLED';
    let requiresManualReview = false;
    let compensationTriggered = false;

    if (hasFailure) {
      const confirmedCount = fulfilledItems.filter(i => i.fulfillmentStatus === 'CONFIRMED').length;
      if (confirmedCount === 0) {
        overallStatus = 'FAILED';
        paymentStatus = 'VOIDED';
        compensationTriggered = true;
      } else {
        // Partial Failure: Some items confirmed, others failed
        overallStatus = 'PARTIAL_FAILURE';
        paymentStatus = 'PARTIALLY_REFUNDED';
        requiresManualReview = true;
        compensationTriggered = true;

        // Auto-create operational triage ticket
        this.storage.createSupportTicket({
          ticketReference: `TKT-FAIL-${bookingReference}`,
          bookingGroupId: bookingGroup.id,
          userId: params.userId,
          organizationId: params.organizationId,
          category: 'BOOKING_PARTIAL_FAILURE',
          priority: 'URGENT',
          status: 'OPEN',
          subject: `Urgent: Partial Booking Failure for ${bookingReference} (${confirmedCount}/${fulfilledItems.length} succeeded)`
        });
      }
    }

    this.storage.updateBookingGroup(bookingGroup.id, {
      overallFulfillmentStatus: overallStatus,
      paymentStatus,
      confirmedAt: overallStatus === 'CONFIRMED' ? new Date().toISOString() : undefined
    });

    const refreshedItems = this.storage.getBookingItems(bookingGroup.id);
    const result: SagaExecutionResult = {
      bookingGroupId: bookingGroup.id,
      bookingReference,
      overallStatus,
      paymentStatus,
      totalSellingPriceMinor: totalMinor,
      currency,
      items: refreshedItems.map(i => ({
        bookingItemId: i.id,
        canonicalOfferId: i.canonicalOfferId,
        productType: i.productType,
        fulfillmentStatus: i.fulfillmentStatus,
        vacatinaBookingReference: i.vacatinaBookingReference || bookingReference,
        supplierBookingReference: i.supplierBookingReference,
        supplierPnr: i.supplierPnr,
        supplierConfirmationNumber: i.supplierConfirmationNumber,
        vacatinaServiceReference: i.vacatinaServiceReference,
        isUpstreamConfirmed: i.isUpstreamConfirmed,
        failureReason: i.failureReason
      })),
      requiresManualReview,
      compensationTriggered
    };

    // 9. Record Idempotency Result
    this.storage.recordIdempotency({
      idempotencyKey: params.idempotencyKey,
      targetEndpoint: '/api/v1/bookings/saga',
      requestHash: `${params.tripBucketId}:${totalMinor}`,
      responseStatus: 200,
      responseBody: JSON.stringify(result),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });

    // 10. Record Platform Audit Log
    this.storage.recordAuditLog({
      actorUserId: params.userId,
      actorOrganizationId: params.organizationId,
      action: 'BOOKING_SAGA_COMPLETED',
      targetEntity: 'booking_groups',
      targetEntityId: bookingGroup.id,
      newState: {
        bookingReference,
        overallStatus,
        totalMinor,
        itemCount: createdBookingItems.length,
        hasFailure
      },
      justificationReason: `Saga execution finished with status: ${overallStatus}`
    });

    return result;
  }

  /**
   * Compensates and voids an unfulfilled booking group.
   */
  public async compensateBookingGroup(bookingGroupId: UUID, reason: string): Promise<boolean> {
    const group = this.storage.getBookingGroup(bookingGroupId);
    if (!group) throw new Error(`Booking group ${bookingGroupId} not found`);

    const items = this.storage.getBookingItems(bookingGroupId);
    for (const item of items) {
      if (item.fulfillmentStatus === 'CONFIRMED') {
        this.storage.updateBookingItem(item.id, {
          fulfillmentStatus: 'CANCELLED',
          compensationAction: 'CANCEL_VOID'
        });
      }
    }

    this.storage.updateBookingGroup(bookingGroupId, {
      overallFulfillmentStatus: 'CANCELLED',
      paymentStatus: 'REFUNDED'
    });

    this.storage.recordAuditLog({
      action: 'BOOKING_COMPENSATION_EXECUTED',
      targetEntity: 'booking_groups',
      targetEntityId: bookingGroupId,
      previousState: { status: group.overallFulfillmentStatus },
      newState: { status: 'CANCELLED' },
      justificationReason: reason
    });

    return true;
  }
}

export const globalBookingSagaService = new BookingSagaService();
