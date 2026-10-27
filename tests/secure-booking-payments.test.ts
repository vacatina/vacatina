import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { VacatinaStorageEngine } from '../src/server/db/storage.ts';
import { BookingSagaService } from '../src/server/services/booking-saga.service.ts';
import { PaymentGatewayService } from '../src/server/services/payment-gateway.service.ts';
import { PaymentProviderClient, decimalToMinor, minorToDecimal } from '../src/server/services/payment-providers.ts';

const now = 1793059200000;
const baseEnv = { NODE_ENV: 'test', BASE_URL: 'https://vacatina.example', STRIPE_SECRET_KEY: 'sk_test_unit_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_unit_fixture' };
function group(storage: VacatinaStorageEngine, total = 12345, currency = 'USD') {
  return storage.createBookingGroup({ bookingReference: `VCT-2026-${Math.random().toString(36).slice(2)}`, checkoutSessionId: 'session_test',
    userId: 'customer_1', totalSellingPriceMinor: total, currency, paymentStatus: 'UNPAID', overallFulfillmentStatus: 'PENDING_REVALIDATION' });
}
function sign(payload: string, timestamp = Math.floor(now / 1000)) {
  return `t=${timestamp},v1=${createHmac('sha256', baseEnv.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex')}`;
}
function stripeEvent(order: any, booking: any, overrides: Record<string, any> = {}) {
  return JSON.stringify({ id: 'evt_signed_completion', type: 'checkout.session.completed', livemode: false, data: { object: {
    id: order.gatewayOrderId, metadata: { paymentOrderId: order.id, bookingGroupId: booking.id }, payment_status: 'paid',
    payment_intent: 'pi_real_provider_reference', amount_total: order.amountMinor, currency: order.currency.toLowerCase(), ...overrides
  } } });
}

test('Stripe raw-body signatures reject tampering, old timestamps and unsigned requests', () => {
  const service = new PaymentGatewayService(new VacatinaStorageEngine(), { env: baseEnv, now: () => now });
  const raw = '{"id":"evt_test","test":true}';
  assert.equal(service.verifyWebhookSignature(raw, sign(raw), baseEnv.STRIPE_WEBHOOK_SECRET), true);
  assert.equal(service.verifyWebhookSignature(raw + ' ', sign(raw), baseEnv.STRIPE_WEBHOOK_SECRET), false);
  assert.equal(service.verifyWebhookSignature(raw, sign(raw, now / 1000 - 301), baseEnv.STRIPE_WEBHOOK_SECRET), false);
  assert.equal(service.verifyWebhookSignature(raw, 'sig_valid_mock', baseEnv.STRIPE_WEBHOOK_SECRET), false);
});

test('Verified payment reconciles exact saved amount and ignores caller-supplied event identifiers', async () => {
  const storage = new VacatinaStorageEngine(); const booking = group(storage);
  const order = storage.createPaymentOrder({ bookingGroupId: booking.id, gatewayId: 'STRIPE', gatewayOrderId: 'cs_test_saved', amountMinor: 12345, currency: 'USD', status: 'PENDING', idempotencyKey: 'saved' });
  const service = new PaymentGatewayService(storage, { env: baseEnv, now: () => now });
  let raw = stripeEvent(order, booking, { amount_total: 12344 });
  const mismatch = await service.handleWebhookEvent({ gatewayId: 'STRIPE', payloadString: raw, signatureHeader: sign(raw) });
  assert.equal(mismatch.status, 'ERROR'); assert.equal(storage.getBookingGroup(booking.id)?.paymentStatus, 'UNPAID');
  raw = stripeEvent(order, booking);
  const request = { gatewayId: 'STRIPE', payloadString: raw, signatureHeader: sign(raw), eventId: 'forged', eventType: 'forged' };
  assert.equal((await service.handleWebhookEvent(request)).status, 'SUCCESS');
  assert.equal(storage.getPaymentOrder(order.id)?.status, 'CAPTURED');
  assert.equal(storage.getBookingGroup(booking.id)?.paymentStatus, 'SETTLED');
  assert.equal(storage.hasProcessedWebhook('STRIPE', 'forged'), false);
  assert.equal((await service.handleWebhookEvent(request)).status, 'ALREADY_PROCESSED');
});

test('Hosted Stripe checkout is idempotent, uses backend totals and rejects foreign return origins', async () => {
  const storage = new VacatinaStorageEngine(); const booking = group(storage); let calls = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    calls++; assert.equal(String(url), 'https://api.stripe.com/v1/checkout/sessions');
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.has('payment_method_types'), false); assert.equal(body.get('line_items[0][price_data][unit_amount]'), '12345');
    assert.ok(body.get('metadata[paymentOrderId]'));
    return new Response(JSON.stringify({ id: 'cs_test_saved', url: 'https://checkout.stripe.com/c/pay/saved', amount_total: 12345, currency: 'usd' }), { status: 200 });
  };
  const service = new PaymentGatewayService(storage, { env: baseEnv, fetchImpl });
  const input = { bookingGroupId: booking.id, amountMinor: 12345, currency: 'USD', customerName: 'Customer', customerEmail: 'customer@example.com',
    idempotencyKey: 'checkout-unit-key', returnUrl: 'https://vacatina.example/checkout', gatewayId: 'STRIPE' as const };
  const first = await service.createPaymentIntent(input); const second = await service.createPaymentIntent(input);
  assert.equal(first.paymentOrderId, second.paymentOrderId); assert.equal(calls, 1); assert.equal(first.clientSecret, '');
  await assert.rejects(service.createPaymentIntent({ ...input, idempotencyKey: 'foreign-url', returnUrl: 'https://attacker.example' }), /Return URL/);
  await assert.rejects(service.createPaymentIntent({ ...input, amountMinor: 1 }), /does not match/);
});

test('Unconfigured payments fail closed without creating a simulated order', async () => {
  const storage = new VacatinaStorageEngine(); const booking = group(storage);
  const service = new PaymentGatewayService(storage, { env: { NODE_ENV: 'test' } });
  await assert.rejects(service.createPaymentIntent({ bookingGroupId: booking.id, amountMinor: 12345, currency: 'USD', customerName: 'Customer', customerEmail: 'customer@example.com', idempotencyKey: 'disabled', returnUrl: 'https://vacatina.example' }), /unavailable/);
  assert.equal(storage.getPaymentOrdersForBooking(booking.id).length, 0);
});

test('PayHere verifies its official checksum, exact merchant and integer amount', async () => {
  const env = { NODE_ENV: 'test', BASE_URL: 'https://vacatina.example', PAYHERE_MERCHANT_ID: 'unit_merchant', PAYHERE_MERCHANT_SECRET: 'unit_secret' };
  const md5 = (input: string) => createHash('md5').update(input).digest('hex').toUpperCase();
  const provider = new PaymentProviderClient(env);
  const fields = new URLSearchParams({ merchant_id: env.PAYHERE_MERCHANT_ID, order_id: 'payment_local', payment_id: 'provider_payment',
    payhere_amount: '123.45', payhere_currency: 'LKR', status_code: '2', md5sig: md5('unit_merchant' + 'payment_local' + '123.45' + 'LKR' + '2' + md5(env.PAYHERE_MERCHANT_SECRET)) });
  const verified = await provider.verifyNotification('PAYHERE', fields.toString(), new Headers());
  assert.equal(verified.settled, true); assert.equal(verified.amountMinor, 12345);
  fields.set('payhere_amount', '999.99');
  await assert.rejects(provider.verifyNotification('PAYHERE', fields.toString(), new Headers()), /could not be verified/);
  assert.equal(decimalToMinor('123.45', 'USD'), 12345); assert.equal(minorToDecimal(12345, 'USD'), '123.45');
  assert.equal(decimalToMinor('123', 'JPY'), 123); assert.equal(minorToDecimal(123456, 'KWD'), '123.456');
});

test('PayPal completed capture requires verified transmission and matching stored order', async () => {
  const storage = new VacatinaStorageEngine(); const booking = group(storage);
  const order = storage.createPaymentOrder({ bookingGroupId: booking.id, gatewayId: 'PAYPAL', gatewayOrderId: 'PAYPALORDER1', amountMinor: 12345, currency: 'USD', status: 'PENDING', idempotencyKey: 'paypal-save' });
  const env = { NODE_ENV: 'test', PAYPAL_CLIENT_ID: 'unit_client', PAYPAL_CLIENT_SECRET: 'unit_secret', PAYPAL_WEBHOOK_ID: 'unit_webhook' };
  let verification = 'SUCCESS';
  const fetchImpl: typeof fetch = async url => new Response(JSON.stringify(String(url).endsWith('/oauth2/token') ? { access_token: 'unit_access' } : { verification_status: verification }), { status: 200 });
  const service = new PaymentGatewayService(storage, { env, fetchImpl });
  const raw = JSON.stringify({ id: 'paypal_evt_1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPTURE1', status: 'COMPLETED',
    custom_id: order.id, amount: { value: '123.45', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'PAYPALORDER1' } } } });
  const headers = new Headers(Object.fromEntries(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].map(key => [key, 'unit'])));
  verification = 'FAILURE'; assert.equal((await service.handleWebhookEvent({ gatewayId: 'PAYPAL', payloadString: raw, headers })).status, 'ERROR');
  verification = 'SUCCESS'; assert.equal((await service.handleWebhookEvent({ gatewayId: 'PAYPAL', payloadString: raw, headers })).status, 'SUCCESS');
  assert.equal(storage.getPaymentOrder(order.id)?.status, 'CAPTURED');
});

function configuredBucket(storage: VacatinaStorageEngine) {
  const bucket = storage.getOrCreateTripBucket('secure-checkout-session', 'customer_1');
  storage.addTripBucketItem({ tripBucketId: bucket.id, canonicalOfferId: 'verified_offer_1', productType: 'flights', sourceType: 'API',
    environmentClass: 'PRODUCTION', sellability: 'BOOKABLE', bookingMode: 'INSTANT_BOOK', title: 'Configured flight', configuration: { providerId: 'DUFFEL_NDC' },
    travellerManifest: { adults: 1 }, unitSellingPriceMinor: 12345, currency: 'USD', state: 'READY' }); return bucket;
}
test('Booking preparation remains unpaid and cannot generate confirmed supplier references', async () => {
  const previous = process.env.VACATINA_TEST_FIXTURES; delete process.env.VACATINA_TEST_FIXTURES;
  try {
    const storage = new VacatinaStorageEngine(); const bucket = configuredBucket(storage);
    const saga = new BookingSagaService(storage, { revalidateItem: async () => ({ status: 'UNCHANGED', currentSellingPriceMinor: 12345 }) });
    const params = { tripBucketId: bucket.id, userId: 'customer_1', customerName: 'Customer', customerEmail: 'customer@example.com', checkoutSessionId: 'checkout_session', idempotencyKey: 'secure-booking' };
    const prepared = await saga.executeBookingSaga(params);
    assert.equal(prepared.paymentStatus, 'UNPAID'); assert.equal(prepared.overallStatus, 'PENDING_REVALIDATION');
    assert.ok(prepared.items.every(item => !item.isUpstreamConfirmed && !item.supplierBookingReference));
    assert.equal((await saga.executeBookingSaga(params)).bookingGroupId, prepared.bookingGroupId);
    await assert.rejects(saga.finalizePaidBooking(prepared.bookingGroupId), /verified matching payment/);
    storage.createPaymentOrder({ bookingGroupId: prepared.bookingGroupId, gatewayId: 'STRIPE', gatewayOrderId: 'cs_verified', amountMinor: 12345, currency: 'USD', status: 'CAPTURED', idempotencyKey: 'paid' });
    storage.updateBookingGroup(prepared.bookingGroupId, { paymentStatus: 'SETTLED' });
    const pending = await saga.finalizePaidBooking(prepared.bookingGroupId);
    assert.equal(pending.overallStatus, 'MANUAL_REVIEW'); assert.equal(pending.paymentStatus, 'SETTLED');
    assert.throws(() => saga.createVoucher(prepared.bookingGroupId), /only after supplier confirmation/);
    const cancel = await saga.requestCancellation(prepared.bookingGroupId, 'Plans changed', 'cancel_request');
    assert.equal(cancel.status, 'CANCEL_PENDING');
    assert.equal(storage.getBookingGroup(prepared.bookingGroupId)?.paymentStatus, 'SETTLED');
  } finally { if (previous === undefined) delete process.env.VACATINA_TEST_FIXTURES; else process.env.VACATINA_TEST_FIXTURES = previous; }
});

test('Price drift requires explicit acceptance before any booking draft or payment', async () => {
  const previous = process.env.VACATINA_TEST_FIXTURES; delete process.env.VACATINA_TEST_FIXTURES;
  try {
    const storage = new VacatinaStorageEngine(); const bucket = configuredBucket(storage);
    const saga = new BookingSagaService(storage, { revalidateItem: async () => ({ status: 'PRICE_CHANGED', currentSellingPriceMinor: 15000 }) });
    await assert.rejects(saga.executeBookingSaga({ tripBucketId: bucket.id, customerName: 'Customer', customerEmail: 'customer@example.com', checkoutSessionId: 'checkout', idempotencyKey: 'price_change' }), /refreshed/);
    assert.equal(storage.getTripBucketItems(bucket.id)[0].state, 'PRICE_CHANGED');
    assert.equal(storage.getPaymentOrdersForBooking(bucket.id).length, 0);
  } finally { if (previous === undefined) delete process.env.VACATINA_TEST_FIXTURES; else process.env.VACATINA_TEST_FIXTURES = previous; }
});
