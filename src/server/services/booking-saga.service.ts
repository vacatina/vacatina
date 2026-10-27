/* Booking preparation is separate from payment settlement and supplier fulfillment. */
import { createHash, randomBytes } from 'node:crypto';
import type { BookingGroupEntity, BookingItemEntity, TripBucketItemEntity, UUID } from '../db/schema.ts';
import { globalStorageEngine, type VacatinaStorageEngine } from '../db/storage.ts';
import { globalInventoryOrchestrator } from '../inventory/inventory-orchestrator.service.ts';
import type { SagaExecutionResult, InitiateBookingSagaParams } from './prototype-booking-fixture.ts';
export type { SagaExecutionResult, InitiateBookingSagaParams } from './prototype-booking-fixture.ts';

export class BookingOperationError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.name = 'BookingOperationError'; this.code = code; this.status = status; }
}
export interface SupplierFulfillmentResult {
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  supplierReference?: string;
  supplierPnr?: string;
  supplierConfirmationNumber?: string;
  isUpstreamConfirmed?: boolean;
  message?: string;
}
export interface BookingSagaOptions {
  revalidateItem?: (item: TripBucketItemEntity) => Promise<{ status: string; currentSellingPriceMinor?: number; newPriceMinor?: number; message?: string }>;
  fulfillItem?: (item: BookingItemEntity, input: { configuration: Record<string, unknown>; travellerManifest: Record<string, unknown> }, key: string) => Promise<SupplierFulfillmentResult>;
}

export class BookingSagaService {
  private storage: VacatinaStorageEngine;
  private options: BookingSagaOptions;
  private pending = new Map<string, Promise<any>>();
  constructor(storage: VacatinaStorageEngine = globalStorageEngine, options: BookingSagaOptions = {}) { this.storage = storage; this.options = options; }
  private async exclusive<T>(key: string, action: () => Promise<T>): Promise<T> {
    const prior = this.pending.get(key);
    const next = (prior ? prior.catch(() => undefined) : Promise.resolve()).then(action);
    this.pending.set(key, next);
    try { return await next; } finally { if (this.pending.get(key) === next) this.pending.delete(key); }
  }
  private remember(key: string, endpoint: string, hash: string, body: any): void {
    this.storage.recordIdempotency({ idempotencyKey: key, targetEndpoint: endpoint, requestHash: hash, responseStatus: 200,
      responseBody: JSON.stringify(body), expiresAt: new Date(Date.now() + 315360000000).toISOString() });
  }
  private get fixtures(): boolean {
    return process.env.VACATINA_TEST_FIXTURES === '1' && process.env.NODE_ENV !== 'production' &&
      (process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT));
  }
  private result(group: BookingGroupEntity): SagaExecutionResult {
    const items = this.storage.getBookingItems(group.id);
    return { bookingGroupId: group.id, bookingReference: group.bookingReference, overallStatus: group.overallFulfillmentStatus,
      paymentStatus: group.paymentStatus, totalSellingPriceMinor: group.totalSellingPriceMinor, currency: group.currency,
      items: items.map(item => ({ bookingItemId: item.id, canonicalOfferId: item.canonicalOfferId, productType: item.productType,
        fulfillmentStatus: item.fulfillmentStatus, vacatinaBookingReference: group.bookingReference,
        supplierBookingReference: item.supplierBookingReference, supplierPnr: item.supplierPnr,
        supplierConfirmationNumber: item.supplierConfirmationNumber, vacatinaServiceReference: item.vacatinaServiceReference,
        isUpstreamConfirmed: item.isUpstreamConfirmed, failureReason: item.failureReason })),
      requiresManualReview: ['MANUAL_REVIEW','PARTIAL_FAILURE','CANCEL_PENDING','REFUND_PENDING'].includes(group.overallFulfillmentStatus),
      compensationTriggered: false };
  }

  /** Freezes revalidated server inventory into an unpaid checkout draft. It never simulates payment. */
  public async executeBookingSaga(params: InitiateBookingSagaParams): Promise<SagaExecutionResult> {
    if (this.fixtures) {
      const { PrototypeBookingFixtureService } = await import('./prototype-booking-fixture.ts');
      return new PrototypeBookingFixtureService(this.storage).executeBookingSaga(params);
    }
    if (!params.idempotencyKey || params.idempotencyKey.length > 180 || !params.tripBucketId) throw new BookingOperationError('INVALID_CHECKOUT_REQUEST', 'A trip and request key are required.', 400);
    if (!params.customerName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.customerEmail || '')) throw new BookingOperationError('CONTACT_DETAILS_REQUIRED', 'Enter a contact name and valid email address.', 400);
    return this.exclusive('prepare:' + params.tripBucketId, async () => {
      const bucketItems = this.storage.getTripBucketItems(params.tripBucketId);
      if (!bucketItems.length) throw new BookingOperationError('TRIP_BUCKET_EMPTY', 'Add configured travel options to your trip before checkout.');
      if (bucketItems.some(item => item.sourceType === 'SEED' || item.environmentClass === 'SEED' || item.sellability === 'DISCOVERY_ONLY')) throw new BookingOperationError('SEED_CHECKOUT_BLOCKED', 'Demonstration and discovery content cannot enter checkout.');
      if (bucketItems.some(item => item.state !== 'READY' || item.sellability === 'QUOTE_ONLY' || item.bookingMode === 'INQUIRY_ONLY')) throw new BookingOperationError('TRIP_NOT_READY', 'Complete the required details and refresh each travel option before checkout.');
      if (process.env.NODE_ENV === 'production' && bucketItems.some(item => item.environmentClass !== 'PRODUCTION')) throw new BookingOperationError('SANDBOX_CHECKOUT_BLOCKED', 'Only verified production inventory can enter production checkout.');
      const currency = bucketItems[0].currency.toUpperCase();
      if (bucketItems.some(item => item.currency.toUpperCase() !== currency || !Number.isSafeInteger(item.unitSellingPriceMinor) || item.unitSellingPriceMinor <= 0)) throw new BookingOperationError('INVALID_SETTLEMENT_TOTAL', 'Checkout items must have valid prices in one settlement currency.');
      const totalMinor = bucketItems.reduce((sum, item) => sum + item.unitSellingPriceMinor, 0);
      if (!Number.isSafeInteger(totalMinor)) throw new BookingOperationError('INVALID_SETTLEMENT_TOTAL', 'The journey total exceeds supported limits.');
      const key = 'booking:' + params.idempotencyKey;
      const hash = createHash('sha256').update(JSON.stringify([params.tripBucketId, params.userId, params.organizationId, params.customerEmail.toLowerCase(),
        bucketItems.map(item => [item.id, item.canonicalOfferId, item.unitSellingPriceMinor, item.currency, item.configuration, item.travellerManifest])])).digest('hex');
      const previous = this.storage.getIdempotencyRecord(key);
      if (previous && previous.requestHash !== hash) throw new BookingOperationError('IDEMPOTENCY_CONFLICT', 'This request key was already used for another journey.');
      if (previous?.responseBody) {
        const saved = JSON.parse(previous.responseBody);
        const group = this.storage.getBookingGroup(saved.bookingGroupId);
        if (group) return this.result(group);
      }
      // Every item is rechecked by its authoritative supplier/manual inventory boundary.
      for (const item of bucketItems) {
        const result = await (this.options.revalidateItem ? this.options.revalidateItem(item) : globalInventoryOrchestrator.revalidateOffer(item.canonicalOfferId));
        const freshPrice = result.currentSellingPriceMinor ?? ('newPriceMinor' in result ? result.newPriceMinor : undefined);
        if (result.status !== 'UNCHANGED' || (freshPrice !== undefined && freshPrice !== item.unitSellingPriceMinor)) {
          const changed = result.status === 'PRICE_CHANGED' || (freshPrice !== undefined && freshPrice !== item.unitSellingPriceMinor);
          this.storage.updateTripBucketItem(item.id, { state: changed ? 'PRICE_CHANGED' : result.status === 'EXPIRED' ? 'OFFER_EXPIRED' : 'RECHECK_REQUIRED' });
          throw new BookingOperationError(changed ? 'PRICE_ACCEPTANCE_REQUIRED' : 'OFFER_REVALIDATION_REQUIRED', result.message || 'A travel option must be refreshed before payment.');
        }
      }
      const bookingReference = 'VCT-' + new Date().getUTCFullYear() + '-' + randomBytes(5).toString('hex').toUpperCase();
      const group = this.storage.createBookingGroup({ bookingReference, userId: params.userId, organizationId: params.organizationId,
        checkoutSessionId: params.checkoutSessionId || params.tripBucketId, totalSellingPriceMinor: totalMinor, currency,
        paymentStatus: 'UNPAID', overallFulfillmentStatus: 'PENDING_REVALIDATION' });
      for (const item of bucketItems) {
        const configuration: any = item.configuration || {};
        const provider = configuration.providerId || configuration.supplierId || (item.sourceType === 'MANUAL' ? 'VACATINA_DIRECT' : '');
        const booked = this.storage.addBookingItem({ bookingGroupId: group.id, vacatinaBookingReference: bookingReference,
          canonicalOfferId: item.canonicalOfferId, productType: item.productType, supplierId: provider || 'UNRESOLVED_SUPPLIER',
          isUpstreamConfirmed: false, title: item.title, bookingMode: item.bookingMode, itemPriceMinor: item.unitSellingPriceMinor,
          currency: item.currency, fulfillmentStatus: 'PENDING', inventorySourceType: item.sourceType,
          providerId: provider, sourceOfferId: configuration.supplierOfferId || item.canonicalOfferId,
          customerSellingAmountMinor: item.unitSellingPriceMinor, settlementCurrency: item.currency,
          priceRevalidationTimestamp: new Date().toISOString() });
        this.remember('booking-input:' + booked.id, '/api/v1/bookings', hash, { configuration: item.configuration, travellerManifest: item.travellerManifest });
      }
      this.storage.recordAuditLog({ actorUserId: params.userId, actorOrganizationId: params.organizationId, action: 'CHECKOUT_DRAFT_PREPARED',
        targetEntity: 'booking_groups', targetEntityId: group.id, newState: { bookingReference, amountMinor: totalMinor, currency, itemCount: bucketItems.length }, justificationReason: 'Server inventory revalidated and frozen before hosted payment.' });
      this.remember(key, '/api/v1/bookings', hash, { bookingGroupId: group.id });
      return this.result(group);
    });
  }

  /** Called only after a cryptographically verified capture, within the runtime storage transaction. */
  public async finalizePaidBooking(bookingGroupId: UUID): Promise<SagaExecutionResult> {
    return this.exclusive('finalize:' + bookingGroupId, async () => {
      let group = this.storage.getBookingGroup(bookingGroupId);
      if (!group) throw new BookingOperationError('BOOKING_NOT_FOUND', 'Booking was not found.', 404);
      const payment = this.storage.getPaymentOrdersForBooking(group.id).find(order => order.status === 'CAPTURED' &&
        order.amountMinor === group.totalSellingPriceMinor && order.currency.toUpperCase() === group.currency.toUpperCase() && order.gatewayId !== 'MOCK_SANDBOX');
      if (!payment || group.paymentStatus !== 'SETTLED') throw new BookingOperationError('PAYMENT_NOT_VERIFIED', 'A verified matching payment is required before booking fulfillment.');
      if (['CONFIRMED','CANCELLED','CANCEL_PENDING','REFUND_PENDING','FAILED'].includes(group.overallFulfillmentStatus)) return this.result(group);
      let needsReview = false;
      this.storage.updateBookingGroup(group.id, { overallFulfillmentStatus: 'BOOKING' });
      for (const item of this.storage.getBookingItems(group.id)) {
        if (item.fulfillmentStatus === 'CONFIRMED') continue;
        const dispatchKey = 'supplier-dispatch:' + item.id;
        const prior = this.storage.getIdempotencyRecord(dispatchKey);
        if (prior || !this.options.fulfillItem) { needsReview = true; continue; }
        const snapshot = this.storage.getIdempotencyRecord('booking-input:' + item.id);
        if (!snapshot?.responseBody) { needsReview = true; continue; }
        this.remember(dispatchKey, '/internal/supplier-booking', item.id, { status: 'DISPATCH_STARTED' });
        try {
          const outcome = await this.options.fulfillItem(item, JSON.parse(snapshot.responseBody), dispatchKey);
          if (outcome.status === 'CONFIRMED' && outcome.isUpstreamConfirmed === true && outcome.supplierReference) {
            this.storage.updateBookingItem(item.id, { fulfillmentStatus: 'CONFIRMED', isUpstreamConfirmed: true,
              supplierBookingReference: outcome.supplierReference, supplierPnr: outcome.supplierPnr,
              supplierConfirmationNumber: outcome.supplierConfirmationNumber, confirmedAt: new Date().toISOString() });
          } else {
            needsReview = true;
            this.storage.updateBookingItem(item.id, { failureReason: outcome.message || 'Supplier confirmation is pending.', compensationAction: 'MANUAL_TRIAGE' });
          }
          this.remember(dispatchKey, '/internal/supplier-booking', item.id, { status: outcome.status, supplierReference: outcome.supplierReference });
        } catch {
          needsReview = true;
          this.storage.updateBookingItem(item.id, { failureReason: 'Supplier outcome requires reconciliation before any retry.', compensationAction: 'MANUAL_TRIAGE' });
        }
      }
      const items = this.storage.getBookingItems(group.id); const confirmed = items.filter(item => item.fulfillmentStatus === 'CONFIRMED').length;
      const overallStatus = confirmed === items.length && !needsReview ? 'CONFIRMED' : confirmed ? 'PARTIAL_FAILURE' : 'MANUAL_REVIEW';
      group = this.storage.updateBookingGroup(group.id, { overallFulfillmentStatus: overallStatus, ...(overallStatus === 'CONFIRMED' ? { confirmedAt: new Date().toISOString() } : {}) });
      if (overallStatus !== 'CONFIRMED') {
        const ref = 'TKT-FULFILL-' + group.bookingReference;
        if (!this.storage.getSupportTickets().some(ticket => ticket.ticketReference === ref)) this.storage.createSupportTicket({ ticketReference: ref, bookingGroupId: group.id,
          userId: group.userId, organizationId: group.organizationId, category: 'BOOKING_PARTIAL_FAILURE', priority: 'URGENT', status: 'OPEN',
          subject: 'Paid journey awaiting supplier reconciliation: ' + group.bookingReference });
      }
      return this.result(group);
    });
  }

  public async requestCancellation(bookingGroupId: UUID, reason: string, requestKey: string, userId?: UUID): Promise<{ status: 'CANCEL_PENDING'; ticketReference: string }> {
    const group = this.storage.getBookingGroup(bookingGroupId);
    if (!group) throw new BookingOperationError('BOOKING_NOT_FOUND', 'Booking was not found.', 404);
    if (!reason?.trim() || !requestKey) throw new BookingOperationError('CANCELLATION_DETAILS_REQUIRED', 'A reason and request key are required.', 400);
    const key = 'cancel:' + requestKey; const hash = createHash('sha256').update(JSON.stringify([group.id, reason])).digest('hex');
    const prior = this.storage.getIdempotencyRecord(key);
    if (prior && prior.requestHash !== hash) throw new BookingOperationError('IDEMPOTENCY_CONFLICT', 'This request key was used for another cancellation.');
    if (prior?.responseBody) return JSON.parse(prior.responseBody);
    if (group.overallFulfillmentStatus === 'CANCELLED') throw new BookingOperationError('BOOKING_ALREADY_CANCELLED', 'This booking is already cancelled.');
    const ticketReference = 'TKT-CANCEL-' + group.bookingReference;
    if (!this.storage.getSupportTickets().some(ticket => ticket.ticketReference === ticketReference)) this.storage.createSupportTicket({
      ticketReference, bookingGroupId: group.id, userId: group.userId, organizationId: group.organizationId,
      category: 'CANCELLATION', priority: 'HIGH', status: 'OPEN', subject: reason.trim().slice(0, 500) });
    this.storage.updateBookingGroup(group.id, { overallFulfillmentStatus: 'CANCEL_PENDING' });
    this.storage.recordAuditLog({ actorUserId: userId, action: 'BOOKING_CANCELLATION_REQUESTED', targetEntity: 'booking_groups',
      targetEntityId: group.id, newState: { status: 'CANCEL_PENDING', ticketReference }, justificationReason: reason });
    const result = { status: 'CANCEL_PENDING' as const, ticketReference }; this.remember(key, '/api/v1/bookings/cancel', hash, result); return result;
  }
  public async compensateBookingGroup(bookingGroupId: UUID, reason: string): Promise<boolean> {
    if (this.fixtures) { const { PrototypeBookingFixtureService } = await import('./prototype-booking-fixture.ts'); return new PrototypeBookingFixtureService(this.storage).compensateBookingGroup(bookingGroupId, reason); }
    await this.requestCancellation(bookingGroupId, reason, 'compensate:' + bookingGroupId); return true;
  }

  public createVoucher(bookingGroupId: UUID): string {
    const group = this.storage.getBookingGroup(bookingGroupId); const items = this.storage.getBookingItems(bookingGroupId);
    if (!group || group.overallFulfillmentStatus !== 'CONFIRMED' || !items.length || items.some(item => !item.isUpstreamConfirmed || item.fulfillmentStatus !== 'CONFIRMED')) throw new BookingOperationError('VOUCHER_NOT_AVAILABLE', 'A voucher is available only after supplier confirmation.');
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
    return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Vacatina journey ' + escape(group.bookingReference) +
      '</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:48px auto;padding:24px;color:#171717}h1{color:#1B1464}article{border-top:1px solid #ddd;padding:24px 0}p{line-height:1.6}@media print{button{display:none}}</style><h1>Vacatina journey confirmation</h1><p>Booking reference: ' +
      escape(group.bookingReference) + '</p><p>Supplier confirmations are listed below. Supplier terms and travel document requirements apply.</p>' +
      items.map(item => '<article><h2>' + escape(item.title) + '</h2><p>Supplier confirmation: ' + escape(item.supplierBookingReference) +
        '</p>' + (item.supplierPnr ? '<p>Airline booking reference: ' + escape(item.supplierPnr) + '</p>' : '') + '</article>').join('') + '</html>';
  }
}
export const globalBookingSagaService = new BookingSagaService();
