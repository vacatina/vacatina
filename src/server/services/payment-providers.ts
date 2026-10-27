import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type CheckoutGateway = 'STRIPE' | 'PAYPAL' | 'PAYHERE';
export class PaymentOperationError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, message: string, status = 409) { super(message); this.name = 'PaymentOperationError'; this.code = code; this.status = status; }
}
export interface ProviderCheckoutInput {
  paymentOrderId: string; bookingGroupId: string; bookingReference: string; amountMinor: number; currency: string;
  customerEmail: string; customerName: string; customerPhone?: string; address?: string; city?: string; country?: string;
  returnUrl: string; idempotencyKey: string;
}
export interface ProviderCheckout {
  gatewayOrderId: string; checkoutUrl: string; checkoutForm?: { action: string; fields: Record<string, string> };
}
export interface VerifiedPaymentNotification {
  eventId: string; eventType: string; gatewayOrderId?: string; paymentOrderId?: string; bookingGroupId?: string;
  amountMinor?: number; currency?: string; paymentReference?: string; settled?: boolean; failed?: boolean;
}

const ZERO_DECIMAL = new Set(['BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
const THREE_DECIMAL = new Set(['BHD','IQD','JOD','KWD','LYD','OMR','TND']);
export function currencyDigits(currency: string): number { return ZERO_DECIMAL.has(currency) ? 0 : THREE_DECIMAL.has(currency) ? 3 : 2; }
export function minorToDecimal(amount: number, currency: string): string {
  const digits = currencyDigits(currency.toUpperCase()); const scale = 10 ** digits;
  return `${Math.floor(amount / scale)}${digits ? `.${String(amount % scale).padStart(digits, '0')}` : ''}`;
}
export function decimalToMinor(value: unknown, currency: string): number {
  const digits = currencyDigits(currency.toUpperCase());
  if (typeof value !== 'string' || !new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1,digits)}})?$`).test(value) || (!digits && value.includes('.'))) throw new PaymentOperationError('INVALID_PROVIDER_AMOUNT', 'Payment amount format is invalid.', 400);
  const [whole, fraction = ''] = value.split('.'); const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(amount)) throw new PaymentOperationError('INVALID_PROVIDER_AMOUNT', 'Payment amount exceeds supported limits.', 400);
  return amount;
}
function md5(value: string): string { return createHash('md5').update(value, 'utf8').digest('hex').toUpperCase(); }
function constantEqual(a: string, b: string): boolean {
  return /^[a-f0-9]+$/i.test(a) && /^[a-f0-9]+$/i.test(b) && a.length === b.length && timingSafeEqual(Buffer.from(a.toLowerCase()), Buffer.from(b.toLowerCase()));
}

export class PaymentProviderClient {
  public env: Record<string, string | undefined>;
  private fetchImpl: typeof fetch;
  private now: () => number;
  constructor(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) { this.env = env; this.fetchImpl = fetchImpl; this.now = now; }
  public configured(gateway: CheckoutGateway): boolean {
    if (gateway === 'STRIPE') return /^(sk|rk)_(test|live)_/.test(this.env.STRIPE_SECRET_KEY || '') && Boolean(this.env.STRIPE_WEBHOOK_SECRET);
    if (gateway === 'PAYPAL') return Boolean(this.env.PAYPAL_CLIENT_ID && this.env.PAYPAL_CLIENT_SECRET && this.env.PAYPAL_WEBHOOK_ID);
    return Boolean(this.env.PAYHERE_MERCHANT_ID && this.env.PAYHERE_MERCHANT_SECRET);
  }
  public testMode(gateway: CheckoutGateway): boolean {
    if (gateway === 'STRIPE') return !/^(sk|rk)_live_/.test(this.env.STRIPE_SECRET_KEY || '');
    if (gateway === 'PAYPAL') return this.env.PAYPAL_ENV !== 'live';
    return this.env.PAYHERE_ENV !== 'live';
  }
  private assertConfigured(gateway: CheckoutGateway): void {
    if (!this.configured(gateway)) throw new PaymentOperationError('PAYMENT_GATEWAY_NOT_CONFIGURED', `${gateway} online payment is currently unavailable.`, 503);
    if (this.env.NODE_ENV === 'production' && this.testMode(gateway)) throw new PaymentOperationError('PAYMENT_ENVIRONMENT_MISMATCH', 'Production payment requires a production merchant account.', 503);
  }
  private async request(url: string, init: RequestInit): Promise<any> {
    const response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(15000) });
    let result: any; try { result = await response.json(); } catch { throw new PaymentOperationError('PAYMENT_PROVIDER_RESPONSE_INVALID', 'The payment provider response could not be read. Retry with the same request key.', 502); }
    if (!response.ok) throw new PaymentOperationError('PAYMENT_PROVIDER_REQUEST_FAILED', 'The payment provider could not complete this request. Retry with the same request key or contact support.', 502);
    return result;
  }
  private async stripe(path: string, body: URLSearchParams, key: string): Promise<any> {
    this.assertConfigured('STRIPE');
    return this.request(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers: {
      Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.env.STRIPE_API_VERSION || '2026-04-22.dahlia', 'Idempotency-Key': key
    }, body: body.toString() });
  }
  private get paypalBase(): string { return this.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }
  public async paypal(path: string, body?: any, key?: string): Promise<any> {
    this.assertConfigured('PAYPAL');
    const token = await this.request(`${this.paypalBase}/v1/oauth2/token`, { method: 'POST', headers: {
      Authorization: `Basic ${Buffer.from(`${this.env.PAYPAL_CLIENT_ID}:${this.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, body: 'grant_type=client_credentials' });
    if (!token.access_token) throw new PaymentOperationError('PAYMENT_PROVIDER_AUTH_FAILED', 'Payment provider authentication failed.', 503);
    return this.request(`${this.paypalBase}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: {
      Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...(key ? { 'PayPal-Request-Id': createHash('sha256').update(key).digest('hex').slice(0, 36) } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }

  public async createCheckout(gateway: CheckoutGateway, input: ProviderCheckoutInput): Promise<ProviderCheckout> {
    this.assertConfigured(gateway);
    const returnUrl = new URL(input.returnUrl); returnUrl.searchParams.set('booking', input.bookingReference); returnUrl.searchParams.set('payment_order', input.paymentOrderId);
    const cancelUrl = new URL(returnUrl); cancelUrl.searchParams.set('payment', 'cancelled');
    if (gateway === 'STRIPE') {
      returnUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
      const session = await this.stripe('checkout/sessions', new URLSearchParams({
        mode: 'payment', success_url: returnUrl.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'), cancel_url: cancelUrl.toString(),
        customer_email: input.customerEmail, client_reference_id: input.bookingGroupId,
        'line_items[0][price_data][currency]': input.currency.toLowerCase(), 'line_items[0][price_data][unit_amount]': String(input.amountMinor),
        'line_items[0][price_data][product_data][name]': `Vacatina journey ${input.bookingReference}`, 'line_items[0][quantity]': '1',
        'metadata[paymentOrderId]': input.paymentOrderId, 'metadata[bookingGroupId]': input.bookingGroupId,
        'payment_intent_data[metadata][paymentOrderId]': input.paymentOrderId, 'payment_intent_data[metadata][bookingGroupId]': input.bookingGroupId
      }), input.idempotencyKey);
      if (!session.id?.startsWith('cs_') || session.amount_total !== input.amountMinor || String(session.currency).toUpperCase() !== input.currency) throw new PaymentOperationError('PAYMENT_SESSION_MISMATCH', 'Payment session does not match the saved booking.', 502);
      const url = new URL(session.url); if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new PaymentOperationError('PAYMENT_CHECKOUT_URL_INVALID', 'Payment provider returned an invalid checkout link.', 502);
      return { gatewayOrderId: session.id, checkoutUrl: url.toString() };
    }
    if (gateway === 'PAYPAL') {
      const order = await this.paypal('/v2/checkout/orders', {
        intent: 'CAPTURE', purchase_units: [{ reference_id: input.bookingGroupId, custom_id: input.paymentOrderId,
          invoice_id: input.paymentOrderId, description: `Vacatina journey ${input.bookingReference}`,
          amount: { currency_code: input.currency, value: minorToDecimal(input.amountMinor, input.currency) } }],
        payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: returnUrl.toString(), cancel_url: cancelUrl.toString() } } }
      }, input.idempotencyKey);
      const url = new URL(order.links?.find((link: any) => ['approve', 'payer-action'].includes(link.rel))?.href || '');
      if (!order.id || url.protocol !== 'https:' || !['www.paypal.com', 'www.sandbox.paypal.com', 'paypal.com', 'sandbox.paypal.com'].includes(url.hostname)) throw new PaymentOperationError('PAYMENT_CHECKOUT_URL_INVALID', 'PayPal returned an invalid approval link.', 502);
      return { gatewayOrderId: order.id, checkoutUrl: url.toString() };
    }
    if (!['LKR','USD','GBP','EUR','AUD'].includes(input.currency)) throw new PaymentOperationError('UNSUPPORTED_GATEWAY_CURRENCY', 'PayHere does not support this checkout currency.', 400);
    if (![input.customerPhone, input.address, input.city, input.country].every(value => typeof value === 'string' && value.trim())) throw new PaymentOperationError('BILLING_DETAILS_REQUIRED', 'PayHere requires a contact phone and billing address.', 400);
    const amount = minorToDecimal(input.amountMinor, input.currency); const merchant = this.env.PAYHERE_MERCHANT_ID!;
    const names = input.customerName.trim().split(/\s+/); const action = this.testMode('PAYHERE') ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
    const fields = { merchant_id: merchant, order_id: input.paymentOrderId, amount, currency: input.currency,
      return_url: returnUrl.toString(), cancel_url: cancelUrl.toString(), notify_url: new URL('/webhooks/payhere', this.env.BASE_URL).toString(),
      items: `Vacatina journey ${input.bookingReference}`, first_name: names.shift() || '', last_name: names.join(' ') || input.customerName,
      email: input.customerEmail, phone: input.customerPhone!, address: input.address!, city: input.city!, country: input.country!,
      hash: md5(merchant + input.paymentOrderId + amount + input.currency + md5(this.env.PAYHERE_MERCHANT_SECRET!)) };
    return { gatewayOrderId: input.paymentOrderId, checkoutUrl: '', checkoutForm: { action, fields } };
  }

  public verifyStripeSignature(raw: string, header: string, secret = this.env.STRIPE_WEBHOOK_SECRET || ''): boolean {
    if (!raw || !header || !secret) return false;
    const fields = header.split(',').map(part => part.trim().split('=', 2)); const times = fields.filter(([key]) => key === 't');
    if (times.length !== 1 || !/^\d+$/.test(times[0][1] || '')) return false;
    const timestamp = Number(times[0][1]); const age = this.now() / 1000 - timestamp;
    if (!Number.isSafeInteger(timestamp) || age > 300 || age < -60) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`, 'utf8').digest('hex');
    return fields.some(([key, value]) => key === 'v1' && value?.length === 64 && constantEqual(expected, value));
  }

  public async verifyNotification(gateway: CheckoutGateway, raw: string, headers: Headers): Promise<VerifiedPaymentNotification> {
    this.assertConfigured(gateway);
    if (gateway === 'PAYHERE') {
      const data = new URLSearchParams(raw); const get = (key: string) => data.get(key) || '';
      for (const key of ['merchant_id','order_id','payment_id','payhere_amount','payhere_currency','status_code','md5sig']) if (data.getAll(key).length !== 1) throw new PaymentOperationError('INVALID_WEBHOOK_PAYLOAD', 'Invalid payment notification.', 400);
      const expected = md5(get('merchant_id') + get('order_id') + get('payhere_amount') + get('payhere_currency') + get('status_code') + md5(this.env.PAYHERE_MERCHANT_SECRET!));
      if (get('merchant_id') !== this.env.PAYHERE_MERCHANT_ID || !constantEqual(expected, get('md5sig')) || !['2','0','-1','-2','-3'].includes(get('status_code'))) throw new PaymentOperationError('INVALID_WEBHOOK_SIGNATURE', 'Payment notification could not be verified.', 400);
      return { eventId: `${get('payment_id')}:${get('status_code')}`, eventType: `payhere.${get('status_code')}`, gatewayOrderId: get('order_id'), paymentOrderId: get('order_id'),
        amountMinor: decimalToMinor(get('payhere_amount'), get('payhere_currency')), currency: get('payhere_currency'), paymentReference: get('payment_id'), settled: get('status_code') === '2', failed: ['-1','-2','-3'].includes(get('status_code')) };
    }
    let event: any; try { event = JSON.parse(raw); } catch { throw new PaymentOperationError('INVALID_WEBHOOK_PAYLOAD', 'Payment notification could not be read.', 400); }
    if (gateway === 'STRIPE') {
      if (!this.verifyStripeSignature(raw, headers.get('stripe-signature') || '')) throw new PaymentOperationError('INVALID_WEBHOOK_SIGNATURE', 'Payment notification signature is invalid.', 400);
      if (!/^evt_[A-Za-z0-9_]+$/.test(event.id || '') || typeof event.type !== 'string' || !event.data?.object) throw new PaymentOperationError('INVALID_WEBHOOK_PAYLOAD', 'Invalid Stripe event.', 400);
      if (this.env.NODE_ENV === 'production' && event.livemode !== true) throw new PaymentOperationError('PAYMENT_ENVIRONMENT_MISMATCH', 'Sandbox notification cannot settle production payment.', 400);
      const obj = event.data.object; const session = event.type.startsWith('checkout.session.');
      const supported = ['checkout.session.completed','checkout.session.async_payment_succeeded','payment_intent.succeeded','checkout.session.expired','checkout.session.async_payment_failed','payment_intent.payment_failed'];
      if (!supported.includes(event.type)) return { eventId: event.id, eventType: event.type };
      return { eventId: event.id, eventType: event.type, gatewayOrderId: session ? obj.id : undefined, paymentOrderId: obj.metadata?.paymentOrderId,
        bookingGroupId: obj.metadata?.bookingGroupId, amountMinor: session ? obj.amount_total : obj.amount_received ?? obj.amount, currency: obj.currency,
        paymentReference: session ? obj.payment_intent : obj.id,
        settled: event.type.endsWith('.succeeded') || event.type === 'checkout.session.async_payment_succeeded' || (event.type === 'checkout.session.completed' && obj.payment_status === 'paid'),
        failed: ['checkout.session.expired','checkout.session.async_payment_failed','payment_intent.payment_failed'].includes(event.type) };
    }
    const required = ['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
    if (!required.every(key => headers.get(key))) throw new PaymentOperationError('INVALID_WEBHOOK_SIGNATURE', 'PayPal transmission signature is missing.', 400);
    const verified = await this.paypal('/v1/notifications/verify-webhook-signature', {
      auth_algo: headers.get('paypal-auth-algo'), cert_url: headers.get('paypal-cert-url'), transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'), transmission_time: headers.get('paypal-transmission-time'), webhook_id: this.env.PAYPAL_WEBHOOK_ID, webhook_event: event
    });
    if (verified.verification_status !== 'SUCCESS' || !event.id || !event.event_type) throw new PaymentOperationError('INVALID_WEBHOOK_SIGNATURE', 'PayPal notification signature is invalid.', 400);
    const obj = event.resource;
    if (!['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.DENIED'].includes(event.event_type)) return { eventId: event.id, eventType: event.event_type };
    return { eventId: event.id, eventType: event.event_type, gatewayOrderId: obj?.supplementary_data?.related_ids?.order_id,
      paymentOrderId: obj?.custom_id, amountMinor: decimalToMinor(obj?.amount?.value, obj?.amount?.currency_code || ''), currency: obj?.amount?.currency_code,
      paymentReference: obj?.id, settled: event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && obj?.status === 'COMPLETED', failed: event.event_type === 'PAYMENT.CAPTURE.DENIED' };
  }

  public async capturePayPal(orderId: string, key: string): Promise<any> {
    return this.paypal(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, key);
  }
  public async refund(gateway: CheckoutGateway, paymentReference: string, amountMinor: number, currency: string, key: string): Promise<{ id: string; success: boolean; status: string }> {
    if (gateway === 'STRIPE') {
      const result = await this.stripe('refunds', new URLSearchParams({ payment_intent: paymentReference, amount: String(amountMinor) }), key);
      if (!result.id?.startsWith('re_') || result.amount !== amountMinor || String(result.currency).toUpperCase() !== currency) throw new PaymentOperationError('REFUND_PROVIDER_MISMATCH', 'Refund provider response does not match the request.', 502);
      return { id: result.id, success: result.status === 'succeeded', status: result.status };
    }
    if (gateway === 'PAYPAL') {
      const result = await this.paypal(`/v2/payments/captures/${encodeURIComponent(paymentReference)}/refund`, { amount: { currency_code: currency, value: minorToDecimal(amountMinor, currency) } }, key);
      if (!result.id || decimalToMinor(result.amount?.value, currency) !== amountMinor || result.amount?.currency_code !== currency) throw new PaymentOperationError('REFUND_PROVIDER_MISMATCH', 'Refund provider response does not match the request.', 502);
      return { id: result.id, success: result.status === 'COMPLETED', status: result.status };
    }
    throw new PaymentOperationError('REFUND_REQUIRES_OPERATIONS', 'PayHere refunds require merchant operations review. No refund has been issued.', 409);
  }
}
