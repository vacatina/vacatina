import { createHash, randomUUID } from 'node:crypto';
import type { PaymentOrderEntity, UUID } from '../db/schema.ts';
import { globalStorageEngine, type VacatinaStorageEngine } from '../db/storage.ts';
import { PaymentProviderClient, PaymentOperationError, decimalToMinor, type CheckoutGateway, type ProviderCheckout, type VerifiedPaymentNotification } from './payment-providers.ts';
export { PaymentOperationError } from './payment-providers.ts';
export interface CreatePaymentIntentParams {
  bookingGroupId: UUID; organizationId?: UUID; amountMinor: number; currency: string; customerEmail: string;
  customerName: string; idempotencyKey: string; returnUrl: string; gatewayId?: CheckoutGateway;
  customerPhone?: string; address?: string; city?: string; country?: string;
}
export interface PaymentIntentResult extends ProviderCheckout { paymentOrderId: UUID; clientSecret: string; status: 'PENDING' | 'AUTHORIZED'; gatewayId?: CheckoutGateway; }
export interface PaymentGatewayOptions { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: () => number; allowTestFixtures?: boolean; }
function amountValid(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new PaymentOperationError('INVALID_PAYMENT_AMOUNT', 'Amount must be a positive integer in minor currency units.', 400);
}

export class PaymentGatewayService {
  private client: PaymentProviderClient;
  private pending = new Map<string, Promise<any>>();
  private env: Record<string, string | undefined>;
  private storage: VacatinaStorageEngine;
  private options: PaymentGatewayOptions;
  constructor(storage: VacatinaStorageEngine = globalStorageEngine, options: PaymentGatewayOptions = {}) {
    this.storage = storage;
    this.options = options;
    this.env = options.env || process.env;
    this.client = new PaymentProviderClient(this.env, options.fetchImpl || fetch, options.now || Date.now);
  }
  private get now(): number { return (this.options.now || Date.now)(); }
  private get fixtures(): boolean {
    return (this.options.allowTestFixtures === true || this.env.VACATINA_TEST_FIXTURES === '1') && this.env.NODE_ENV !== 'production' &&
      (this.env.NODE_ENV === 'test' || Boolean(this.env.NODE_TEST_CONTEXT));
  }
  public getCapabilities() {
    const gateways = (['STRIPE','PAYPAL','PAYHERE'] as CheckoutGateway[]).map(gatewayId => ({ gatewayId, available: this.client.configured(gatewayId) && !(this.env.NODE_ENV === 'production' && this.client.testMode(gatewayId)), testMode: this.client.testMode(gatewayId) }));
    return { available: gateways.some(gateway => gateway.available), gateways, reason: gateways.some(gateway => gateway.available) ? undefined : 'PAYMENT_GATEWAY_NOT_CONFIGURED' };
  }
  private async exclusive<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key); const next = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(action);
    this.pending.set(key, next);
    try { return await next; } finally { if (this.pending.get(key) === next) this.pending.delete(key); }
  }
  private remember(key: string, endpoint: string, hash: string, status: number, body: any): void {
    this.storage.recordIdempotency({ idempotencyKey: key, targetEndpoint: endpoint, requestHash: hash, responseStatus: status,
      responseBody: JSON.stringify(body), expiresAt: new Date(this.now + 315360000000).toISOString() });
  }
  private fingerprint(body: unknown): string { return createHash('sha256').update(JSON.stringify(body)).digest('hex'); }

  public async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    amountValid(params.amountMinor);
    if (!/^[A-Za-z]{3}$/.test(params.currency) || !params.idempotencyKey || params.idempotencyKey.length > 180) throw new PaymentOperationError('INVALID_PAYMENT_REQUEST', 'A valid currency and request key are required.', 400);
    if (this.fixtures) return this.fixturePayment(params);
    const configured = this.getCapabilities().gateways.filter(gateway => gateway.available);
    const gatewayId = params.gatewayId || (configured.find(gateway => gateway.gatewayId === this.env.PAYMENT_GATEWAY_DEFAULT)?.gatewayId) || configured[0]?.gatewayId;
    if (!gatewayId || !configured.some(gateway => gateway.gatewayId === gatewayId)) throw new PaymentOperationError('PAYMENT_GATEWAY_NOT_CONFIGURED', 'Online payment is unavailable. Your journey can remain saved while Vacatina assists you.', 503);
    const group = this.storage.getBookingGroup(params.bookingGroupId);
    if (!group || group.totalSellingPriceMinor !== params.amountMinor || group.currency.toUpperCase() !== params.currency.toUpperCase()) throw new PaymentOperationError('PAYMENT_BOOKING_MISMATCH', 'Payment amount or currency does not match the saved booking.');
    if (group.paymentStatus !== 'UNPAID') throw new PaymentOperationError('BOOKING_ALREADY_PAID', 'This booking already has a payment. Refresh its status.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.customerEmail) || !params.customerName?.trim()) throw new PaymentOperationError('CONTACT_DETAILS_REQUIRED', 'Enter a contact name and valid email address.', 400);
    let returnUrl: URL;
    try { returnUrl = new URL(params.returnUrl); if (!this.env.BASE_URL || returnUrl.origin !== new URL(this.env.BASE_URL).origin || (this.env.NODE_ENV === 'production' && returnUrl.protocol !== 'https:')) throw new Error(); }
    catch { throw new PaymentOperationError('INVALID_RETURN_URL', 'Return URL must belong to this Vacatina application.', 400); }
    const currency = params.currency.toUpperCase(); const key = `payment:${params.idempotencyKey}`;
    const hash = this.fingerprint([group.id, gatewayId, params.amountMinor, currency, params.customerEmail.toLowerCase(), returnUrl.toString()]);
    return this.exclusive(`booking-payment:${group.id}`, async () => {
      const prior = this.storage.getIdempotencyRecord(key);
      if (prior && prior.requestHash !== hash) throw new PaymentOperationError('IDEMPOTENCY_CONFLICT', 'This request key was used for different payment details.');
      if (prior?.responseStatus === 200 && prior.responseBody) return JSON.parse(prior.responseBody);
      let order: PaymentOrderEntity | undefined = prior?.responseBody ? this.storage.getPaymentOrder(JSON.parse(prior.responseBody).paymentOrderId) : undefined;
      const active = this.storage.getPaymentOrdersForBooking(group.id).find(payment => ['PENDING','AUTHORIZED','CAPTURED'].includes(payment.status));
      if (active && active.id !== order?.id) throw new PaymentOperationError('PAYMENT_ALREADY_IN_PROGRESS', 'A payment is already in progress for this journey. Continue it or contact support before starting another.');
      if (!order) {
        order = this.storage.createPaymentOrder({ bookingGroupId: group.id, organizationId: group.organizationId, gatewayId, amountMinor: params.amountMinor, currency, status: 'PENDING', idempotencyKey: key });
        this.remember(key, '/api/v1/checkout/payment-intent', hash, 102, { paymentOrderId: order.id });
      }
      const checkout = await this.client.createCheckout(gatewayId, { ...params, paymentOrderId: order.id, bookingReference: group.bookingReference, bookingGroupId: group.id, currency, returnUrl: returnUrl.toString(), idempotencyKey: key });
      this.storage.updatePaymentOrder(order.id, { gatewayOrderId: checkout.gatewayOrderId, status: 'PENDING' });
      const result: PaymentIntentResult = { ...checkout, paymentOrderId: order.id, clientSecret: '', status: 'PENDING', gatewayId };
      this.remember(key, '/api/v1/checkout/payment-intent', hash, 200, result); return result;
    });
  }

  public verifyWebhookSignature(payload: string, signature: string, secret: string): boolean { return this.client.verifyStripeSignature(payload, signature, secret); }
  public async handleWebhookEvent(params: {
    gatewayId: string; eventId?: string; eventType?: string; payloadString: string; signatureHeader?: string; headers?: Headers | Record<string, string>;
  }): Promise<{ status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'ERROR'; reason?: string; bookingGroupId?: string }> {
    if (this.fixtures && params.signatureHeader === 'sig_mock_header_123') return this.fixtureWebhook(params);
    const gateway = params.gatewayId.toUpperCase() as CheckoutGateway;
    if (!['STRIPE','PAYPAL','PAYHERE'].includes(gateway)) return { status: 'ERROR', reason: 'UNSUPPORTED_PAYMENT_GATEWAY' };
    const headers = new Headers(params.headers);
    if (params.signatureHeader && !headers.has('stripe-signature')) headers.set('stripe-signature', params.signatureHeader);
    let event: VerifiedPaymentNotification;
    try { event = await this.client.verifyNotification(gateway, params.payloadString, headers); }
    catch (error) { return { status: 'ERROR', reason: error instanceof PaymentOperationError ? error.code : 'WEBHOOK_VERIFICATION_FAILED' }; }
    return this.exclusive(`webhook:${gateway}:${event.eventId}`, async () => {
      if (this.storage.hasProcessedWebhook(gateway, event.eventId)) return { status: 'ALREADY_PROCESSED' as const };
      if (!event.paymentOrderId && !event.gatewayOrderId) { this.recordWebhook(gateway, event, params.payloadString); return { status: 'SUCCESS' as const }; }
      const order = event.paymentOrderId ? this.storage.getPaymentOrder(event.paymentOrderId) : this.storage.findPaymentOrderByGatewayReference(gateway, event.gatewayOrderId!);
      const group = order && this.storage.getBookingGroup(order.bookingGroupId);
      if (!order || !group || order.gatewayId !== gateway || (event.bookingGroupId && event.bookingGroupId !== group.id) || (event.gatewayOrderId && event.gatewayOrderId !== order.gatewayOrderId)) return { status: 'ERROR' as const, reason: 'PAYMENT_ORDER_NOT_FOUND_OR_MISMATCH' };
      if (event.amountMinor !== order.amountMinor || String(event.currency).toUpperCase() !== order.currency.toUpperCase() || group.totalSellingPriceMinor !== order.amountMinor || group.currency.toUpperCase() !== order.currency.toUpperCase()) return { status: 'ERROR' as const, reason: 'PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH' };
      if (event.settled) this.settleOrder(order, event.paymentReference);
      else if (event.failed && order.status === 'PENDING') this.storage.updatePaymentOrder(order.id, { status: 'FAILED' });
      this.recordWebhook(gateway, event, params.payloadString);
      return { status: 'SUCCESS' as const, bookingGroupId: group.id };
    });
  }
  private recordWebhook(gateway: CheckoutGateway, event: VerifiedPaymentNotification, rawPayload: string): void {
    this.storage.recordPaymentWebhook({ gatewayId: gateway, eventId: event.eventId, eventType: event.eventType, rawPayload,
      processedStatus: 'PROCESSED', idempotencyKey: `webhook:${gateway}:${event.eventId}`, processedAt: new Date(this.now).toISOString() });
  }
  private settleOrder(order: PaymentOrderEntity, paymentReference?: string): void {
    if (['REFUNDED','VOIDED'].includes(order.status)) return;
    const group = this.storage.getBookingGroup(order.bookingGroupId)!;
    this.storage.updatePaymentOrder(order.id, { status: 'CAPTURED', settledAt: new Date(this.now).toISOString() });
    if (!['REFUNDED','PARTIALLY_REFUNDED'].includes(group.paymentStatus)) this.storage.updateBookingGroup(group.id, { paymentStatus: 'SETTLED' });
    if (paymentReference) this.remember(`provider-payment:${order.id}`, '/webhooks', order.id, 200, { paymentReference });
  }

  /** PayPal approval alone never settles a booking; capture is verified on the server. */
  public async capturePayPalOrder(paymentOrderId: string, requestKey: string): Promise<{ status: string; bookingGroupId: string }> {
    const order = this.storage.getPaymentOrder(paymentOrderId);
    if (!order || order.gatewayId !== 'PAYPAL' || !order.gatewayOrderId) throw new PaymentOperationError('PAYMENT_ORDER_NOT_FOUND', 'PayPal payment order was not found.', 404);
    if (!requestKey || requestKey.length > 180) throw new PaymentOperationError('IDEMPOTENCY_KEY_MISSING', 'A capture request key is required.', 400);
    return this.exclusive(`capture:${order.id}`, async () => {
      if (this.storage.getPaymentOrder(order.id)?.status === 'CAPTURED') return { status: 'COMPLETED', bookingGroupId: order.bookingGroupId };
      const details = await this.client.paypal(`/v2/checkout/orders/${encodeURIComponent(order.gatewayOrderId!)}`);
      const unit = details.purchase_units?.[0];
      if (details.id !== order.gatewayOrderId || details.purchase_units?.length !== 1 || unit?.custom_id !== order.id || decimalToMinor(unit?.amount?.value, unit?.amount?.currency_code || '') !== order.amountMinor || unit?.amount?.currency_code !== order.currency) throw new PaymentOperationError('PAYMENT_ORDER_MISMATCH', 'PayPal order does not match this booking.');
      const result = await this.client.capturePayPal(order.gatewayOrderId!, `capture:${order.id}`);
      const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
      if (result.id !== order.gatewayOrderId || result.status !== 'COMPLETED' || capture?.status !== 'COMPLETED' || decimalToMinor(capture?.amount?.value, capture?.amount?.currency_code || '') !== order.amountMinor || capture?.amount?.currency_code !== order.currency) throw new PaymentOperationError('PAYMENT_NOT_CAPTURED', 'PayPal has not confirmed the exact booking payment.');
      this.settleOrder(order, capture.id); return { status: 'COMPLETED', bookingGroupId: order.bookingGroupId };
    });
  }

  public async processRefund(orderOrBookingId: UUID, amountMinor: number, reason: string, requestKey?: string): Promise<{ success: boolean; refundId: string; status?: string }> {
    amountValid(amountMinor);
    const direct = this.storage.getPaymentOrder(orderOrBookingId);
    const orders = direct ? [direct] : this.storage.getPaymentOrdersForBooking(orderOrBookingId);
    if (this.fixtures && direct) { this.storage.updatePaymentOrder(direct.id, { status: 'REFUNDED' }); return { success: true, refundId: `fixture_refund_${randomUUID()}`, status: 'succeeded' }; }
    const order = orders.find(value => ['CAPTURED','REFUNDED'].includes(value.status));
    if (!order || !['STRIPE','PAYPAL','PAYHERE'].includes(order.gatewayId)) throw new PaymentOperationError('REFUND_PAYMENT_NOT_CAPTURED', 'A verified captured payment is required for a refund.');
    if (!requestKey || requestKey.length > 180) throw new PaymentOperationError('IDEMPOTENCY_KEY_MISSING', 'A refund request key is required.', 400);
    const key = `refund:${requestKey}`; const hash = this.fingerprint([order.id, amountMinor, reason]);
    return this.exclusive(`refund-order:${order.id}`, async () => {
      const prior = this.storage.getIdempotencyRecord(key);
      if (prior && prior.requestHash !== hash) throw new PaymentOperationError('IDEMPOTENCY_CONFLICT', 'This request key was used for different refund details.');
      if (prior?.responseBody) return JSON.parse(prior.responseBody);
      const logs = this.storage.getAuditLogs('payment_orders', order.id);
      const completed = logs.filter(log => log.action === 'PAYMENT_REFUND_CONFIRMED').reduce((sum, log) => sum + Number((log.newState as any)?.refundedAmountMinor || 0), 0);
      const pending = logs.some(log => log.action === 'PAYMENT_REFUND_PENDING');
      if (pending) throw new PaymentOperationError('REFUND_ALREADY_PENDING', 'An earlier refund is still pending. Operations must reconcile it before another refund.');
      if (order.status === 'REFUNDED' || amountMinor > order.amountMinor - completed) throw new PaymentOperationError('REFUND_EXCEEDS_CAPTURE', 'Refund exceeds the unrefunded payment.');
      const marker = this.storage.getIdempotencyRecord(`provider-payment:${order.id}`);
      const reference = marker?.responseBody && JSON.parse(marker.responseBody).paymentReference;
      if (!reference) throw new PaymentOperationError('REFUND_REFERENCE_UNAVAILABLE', 'Original provider payment reference is unavailable. Operations review is required.');
      const refund = await this.client.refund(order.gatewayId as CheckoutGateway, reference, amountMinor, order.currency, key);
      if (refund.success) {
        const full = completed + amountMinor === order.amountMinor;
        if (full) this.storage.updatePaymentOrder(order.id, { status: 'REFUNDED' });
        this.storage.updateBookingGroup(order.bookingGroupId, { paymentStatus: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' });
      }
      this.storage.recordAuditLog({ action: refund.success ? 'PAYMENT_REFUND_CONFIRMED' : 'PAYMENT_REFUND_PENDING', targetEntity: 'payment_orders', targetEntityId: order.id,
        newState: { refundId: refund.id, refundedAmountMinor: amountMinor, status: refund.status }, justificationReason: reason });
      const result = { success: refund.success, refundId: refund.id, status: refund.status }; this.remember(key, '/api/v1/bookings/refund', hash, 200, result); return result;
    });
  }

  private async fixturePayment(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const key = `fixture-payment:${params.idempotencyKey}`; const prior = this.storage.getIdempotencyRecord(key);
    if (prior?.responseBody) return JSON.parse(prior.responseBody);
    const order = this.storage.createPaymentOrder({ bookingGroupId: params.bookingGroupId, gatewayId: 'MOCK_SANDBOX', amountMinor: params.amountMinor, currency: params.currency,
      status: 'PENDING', idempotencyKey: key, gatewayOrderId: `fixture_order_${randomUUID()}` });
    const result = { paymentOrderId: order.id, clientSecret: '', gatewayOrderId: order.gatewayOrderId!, checkoutUrl: `${params.returnUrl}?fixture=1`, status: 'PENDING' as const };
    this.remember(key, '/test-fixtures/payment', String(params.amountMinor), 200, result); return result;
  }
  private async fixtureWebhook(params: { gatewayId: string; eventId?: string; eventType?: string; payloadString: string }): Promise<{ status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'ERROR' }> {
    if (!params.eventId) return { status: 'ERROR' };
    if (this.storage.hasProcessedWebhook(params.gatewayId, params.eventId)) return { status: 'ALREADY_PROCESSED' };
    const payload = JSON.parse(params.payloadString); const order = this.storage.getPaymentOrder(payload.paymentOrderId);
    if (!order || order.gatewayId !== 'MOCK_SANDBOX') return { status: 'ERROR' };
    this.storage.updatePaymentOrder(order.id, { status: 'CAPTURED', settledAt: new Date(this.now).toISOString() });
    this.storage.recordPaymentWebhook({ gatewayId: params.gatewayId, eventId: params.eventId, eventType: params.eventType || 'fixture', rawPayload: params.payloadString,
      processedStatus: 'PROCESSED', idempotencyKey: `fixture:${params.eventId}`, processedAt: new Date(this.now).toISOString() }); return { status: 'SUCCESS' };
  }
}
export const globalPaymentGatewayService = new PaymentGatewayService();
