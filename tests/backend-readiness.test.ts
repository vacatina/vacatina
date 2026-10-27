import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'pgsql-ast-parser';
import type { SecurityContext } from '../src/server/auth/rbac.ts';
import type { CanonicalOfferEntity } from '../src/server/inventory/types.ts';
import type { ReadinessUnitOfWork, ReadinessRepositories, BookingRecord } from '../src/server/persistence/readiness-contracts.ts';
import { ReadinessError } from '../src/server/persistence/readiness-contracts.ts';
import { MemoryReadinessUnitOfWork, PostgresReadinessUnitOfWork, READINESS_TABLES } from '../src/server/persistence/readiness-repositories.ts';
import { BackendReadinessService, type BackendReadinessOptions } from '../src/server/services/backend-readiness.service.ts';
import { BOOKING_TRANSITIONS, transitionBooking } from '../src/server/services/booking-lifecycle.ts';
import { readBackendReadinessConfig } from '../src/server/config/backend-readiness.ts';
import { validateServerEnv } from '../src/server/config/env.ts';
import { backendTelemetry } from '../src/server/runtime/observability.ts';
import { VacatinaStorageEngine } from '../src/server/db/storage.ts';
import { BookingSagaService } from '../src/server/services/booking-saga.service.ts';
import { RuntimePersistence, PersistenceUnavailableError } from '../src/server/runtime/persistence.ts';
import { createDevelopmentHttpApplication } from '../src/server/runtime/dev-http-application.ts';
import { PostgresManualListingRepository } from '../src/server/inventory/repository/postgres-manual-listing.repository.ts';
import { getManualListingRepository } from '../src/server/inventory/repository/repository-factory.ts';
import { VacatinaApiRouter } from '../src/server/api/router.ts';
import { globalUnifiedInventory } from '../src/server/inventory/unified-inventory.service.ts';
import { checkBackendMigrations } from '../scripts/check-backend-migrations.mjs';

// All commercial/provider states below are synthetic contract fixtures. No provider registry is activated.
const clock = Date.parse('2026-10-27T00:00:00Z');
const customer: SecurityContext = { userId: 'user_phase15_customer', email: 'customer@example.test', role: 'CUSTOMER' };
const other: SecurityContext = { userId: 'user_phase15_other', email: 'other@example.test', role: 'CUSTOMER' };
const ops: SecurityContext = { userId: 'user_phase15_operations', email: 'ops@example.test', role: 'OPS_SUPERVISOR' };
const finance: SecurityContext = { userId: 'user_phase15_finance', email: 'finance@example.test', role: 'FINANCE_OPS' };
const meta = (key: string) => ({ idempotencyKey: 'phase15_' + key, correlationId: 'phase15-correlation-' + key });
const code = (expected: string) => (error: unknown) => error instanceof ReadinessError && error.code === expected;
function offer(overrides: Partial<CanonicalOfferEntity> = {}): CanonicalOfferEntity {
  return { canonicalOfferId: 'unit-contract-offer', productType: 'flights', sourceType: 'API', supplierId: 'UNIT_PROVIDER', supplierName: 'Unit-only provider',
    inventorySource: 'API', listingKind: 'SELLABLE_INVENTORY', compositionType: 'SINGLE', fulfillmentMode: 'INSTANT', environmentClass: 'PRODUCTION',
    sellability: 'BOOKABLE', commercialStatus: 'COMMERCIALLY_VERIFIED', providerLifecycle: 'PRODUCTION_LIVE',
    title: 'Unit-only flight', subtitle: '', location: { city: 'Colombo', country: 'Sri Lanka' }, availabilityStatus: 'LIVE',
    confirmationMode: 'INSTANT_CONFIRM', bookingMode: 'INSTANT_BOOK', pricing: { rawSupplierCostMinor: 10000, rawCurrency: 'USD', platformMarkupMinor: 2345, b2bAgencyMarginMinor: 0, finalSellingPriceMinor: 12345, currency: 'USD' },
    validUntil: new Date(clock + 3600000).toISOString(), inclusions: [], exclusions: [], cancellationPolicy: 'Unit-only terms', pinAboveApi: false,
    deduplicationKey: 'unit-contract-key', isSandboxSimulated: false, integrationLifecycle: 'PRODUCTION_LIVE', ...overrides };
}
function setup(options: BackendReadinessOptions = {}) {
  const store = new MemoryReadinessUnitOfWork();
  const service = new BackendReadinessService(store, { now: () => clock,
    revalidate: async saved => ({ offerId: saved.snapshot.canonicalOfferId, status: 'UNCHANGED', newPriceMinor: saved.snapshot.sellingPriceMinor }),
    verifyPayment: async payment => ({ eventId: 'unit-event-' + payment.id, providerReference: 'unit-payment-' + payment.id,
      amountMinor: payment.order.amountMinor, currency: payment.order.currency, status: 'CAPTURED' }), ...options });
  return { store, service };
}
async function prepared(service: BackendReadinessService, count = 1) {
  let trip;
  for (let i = 0; i < count; i++) trip = await service.stage(customer, { offer: offer({ canonicalOfferId: 'unit-offer-' + i }), configuration: { adults: 1, departureDate: '2027-02-01' }, search: { destination: 'Dubai', productType: 'flights' } }, meta('stage-' + i));
  for (const selected of trip!.items) trip = await service.revalidate(customer, trip!.id, selected.item.id, meta('revalidate-' + selected.item.id));
  const booking = await service.createBookingIntent(customer, trip!.id, meta('booking'));
  return { trip: trip!, booking };
}
async function paid(service: BackendReadinessService, count = 1) {
  const ready = await prepared(service, count);
  const payment = await service.createPaymentReference(customer, ready.booking.id, 'STRIPE', meta('payment'));
  await service.reconcilePayment(finance, payment.id, 'unit-notification', meta('capture'));
  return { ...ready, payment };
}
async function records(store: ReadinessUnitOfWork, actor = customer): Promise<Record<string, any[]>> {
  return store.transaction(async r => Object.fromEntries(await Promise.all(Object.keys(READINESS_TABLES).map(async key => [key, await r[key as keyof ReadinessRepositories].list(actor.userId)]))));
}

test('Phase 15 stage/upsert has stable idempotency, defensive copies and whitelisted configuration', async () => {
  const { store, service } = setup();
  const input = { offer: offer({ sourceMetadata: { privateSupplierPayload: 'synthetic-not-for-persistence' } }), configuration: { adults: 1, departureDate: '2027-02-01', passportNumber: 'UNIT-PRIVATE', accessToken: 'unit-non-secret-token' } };
  const first = await service.stage(customer, input, meta('stable-stage'));
  const replay = await service.stage(customer, { ...input, configuration: { ...input.configuration } }, meta('stable-stage'));
  assert.deepEqual(first, replay); assert.equal(first.items.length, 1);
  first.items[0].item.title = 'external mutation';
  assert.notEqual((await service.getTrip(customer, first.id)).items[0].item.title, 'external mutation');
  const data = await records(store);
  assert.equal(data.offers.length, 1); assert.equal(data.events.length, 1);
  assert.ok(!JSON.stringify(data).includes('UNIT-PRIVATE')); assert.ok(!JSON.stringify(data).includes('synthetic-not-for-persistence'));
  await assert.rejects(service.stage(customer, { ...input, configuration: { adults: 2 } }, meta('stable-stage')), code('IDEMPOTENCY_CONFLICT'));
  const updated = await service.stage(customer, { ...input, tripBucketId: first.id, expectedRevision: 1, configuration: { adults: 2 } }, meta('update-stage'));
  assert.equal(updated.items.length, 1); assert.equal(updated.items[0].item.id, first.items[0].item.id);
  await assert.rejects(service.stage(customer, { ...input, tripBucketId: first.id, expectedRevision: 1 }, meta('stale-update')), code('REVISION_CONFLICT'));
});

test('Phase 15 customer/tenant access cannot be widened by customer or admin-shaped input', async () => {
  const { service } = setup(); const { trip, booking } = await prepared(service);
  await assert.rejects(service.getTrip(other, trip.id), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(service.getBooking(other, booking.id), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(service.getBooking({ ...customer, organizationId: 'other-tenant' }, booking.id), code('RESOURCE_NOT_FOUND'));
  await assert.rejects(service.getBooking({ ...other, role: 'PLATFORM_ADMIN', isElevatedMfa: true }, booking.id), code('RESOURCE_NOT_FOUND'));
});

test('Phase 15 demo, sandbox and unverified inventory never becomes sellable or enters booking', async () => {
  for (const change of [{ environmentClass: 'SEED' }, { isSandboxSimulated: true }, { commercialStatus: 'CANDIDATE_UNVERIFIED' }]) {
    const { service } = setup();
    let trip = await service.stage(customer, { offer: offer(change as any), configuration: { adults: 1 } }, meta('demo-stage'));
    trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('demo-reval'));
    assert.notEqual(trip.items[0].item.state, 'READY');
    if (change.environmentClass === 'SEED' || change.isSandboxSimulated) assert.equal(trip.items[0].item.sellability, 'DISCOVERY_ONLY');
    await assert.rejects(service.createBookingIntent(customer, trip.id, meta('demo-book')), code('DEMO_OR_UNVERIFIED_BOOKING_BLOCKED'));
  }
});

test('Phase 15 hybrid component provenance prevents a demo component bypass', async () => {
  const { service } = setup();
  const hybrid = offer({ sourceType: 'HYBRID', components: [{ componentId: 'unit-component', productType: 'hotels', inventorySource: 'API', listingKind: 'SELLABLE_INVENTORY', compositionType: 'SINGLE', fulfillmentMode: 'INSTANT', environmentClass: 'SEED', sellability: 'BOOKABLE', supplierId: 'UNIT_PROVIDER', supplierName: 'Unit', isSandboxSimulated: false, revalidationRequired: true, componentStatus: 'VALID', lastRevalidationResult: 'UNCHANGED' }] });
  let trip = await service.stage(customer, { offer: hybrid, configuration: { adults: 1 } }, meta('hybrid-stage'));
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('hybrid-check'));
  assert.notEqual(trip.items[0].item.state, 'READY');
  await assert.rejects(service.createBookingIntent(customer, trip.id, meta('hybrid-book')), code('DEMO_OR_UNVERIFIED_BOOKING_BLOCKED'));
});

test('Phase 15 concurrent booking retries with distinct keys produce one booking and frozen selections', async () => {
  const { store, service } = setup(); const { trip, booking } = await prepared(service);
  const copies = await Promise.all(Array.from({ length: 8 }, (_, i) => service.createBookingIntent(customer, trip.id, meta('booking-retry-' + i))));
  assert.ok(copies.every(value => value.id === booking.id));
  assert.equal((await records(store)).bookings.length, 1);
  assert.equal(booking.group.paymentStatus, 'UNPAID'); assert.equal(booking.group.overallFulfillmentStatus, 'PENDING_REVALIDATION');
  assert.ok(booking.items.every(item => !item.isUpstreamConfirmed && !item.supplierBookingReference));
  await assert.rejects(service.stage(customer, { offer: offer(), configuration: { adults: 1 }, tripBucketId: trip.id }, meta('late-stage')), code('TRIP_NOT_ACTIVE'));
});

test('Phase 15 transitions prohibit direct confirmation and require payment and per-item evidence', async () => {
  const { service } = setup(); const { booking } = await prepared(service);
  assert.throws(() => transitionBooking(booking, 'CONFIRMED'), code('FORBIDDEN_BOOKING_TRANSITION'));
  assert.throws(() => transitionBooking(booking, 'BOOKING'), code('VERIFIED_PAYMENT_REQUIRED'));
  const active = structuredClone(booking); active.group.overallFulfillmentStatus = 'BOOKING'; active.group.paymentStatus = 'SETTLED';
  assert.throws(() => transitionBooking(active, 'CONFIRMED'), code('CONFIRMATION_EVIDENCE_REQUIRED'));
  active.group.overallFulfillmentStatus = 'CANCELLED';
  assert.throws(() => transitionBooking(active, 'FULFILLED'), code('FORBIDDEN_BOOKING_TRANSITION'));
});

test('Phase 15 payment references are queued, duplicate-protected and never imply authorization', async () => {
  const { store, service } = setup(); const { booking } = await prepared(service);
  const first = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('first-pay'));
  const second = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('different-pay-key'));
  assert.equal(first.id, second.id); assert.equal(first.order.amountMinor, booking.group.totalSellingPriceMinor);
  assert.equal(first.order.status, 'PENDING'); assert.equal(first.providerReference, undefined);
  assert.ok(!('clientSecret' in first)); assert.ok(!('checkoutUrl' in first));
  const data = await records(store); assert.equal(data.payments.length, 1); assert.equal(data.commands.length, 1);
  assert.equal(data.commands[0].status, 'PENDING');
  await assert.rejects(service.createPaymentReference(customer, booking.id, 'PAYPAL', meta('other-gateway')), code('PAYMENT_ALREADY_PENDING'));
});

test('Phase 15 payment confirmation requires a configured trusted verifier and exact totals', async () => {
  const { service } = setup({ verifyPayment: undefined }); const { booking } = await prepared(service);
  const payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('unverified-pay'));
  await assert.rejects(service.reconcilePayment(finance, payment.id, 'unit-event', meta('unconfigured-proof')), code('PAYMENT_VERIFIER_NOT_CONFIGURED'));
  await assert.rejects(service.reconcilePayment(customer, payment.id, 'unit-event', meta('customer-proof')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  const mismatch = setup({ verifyPayment: async () => ({ eventId: 'unit-event', providerReference: 'unit-reference', status: 'CAPTURED', amountMinor: 1, currency: 'USD' }) });
  const ready = await prepared(mismatch.service), next = await mismatch.service.createPaymentReference(customer, ready.booking.id, 'STRIPE', meta('mismatch-pay'));
  await assert.rejects(mismatch.service.reconcilePayment(finance, next.id, 'unit-event', meta('mismatch-proof')), code('PAYMENT_EVIDENCE_MISMATCH'));
  assert.equal((await mismatch.service.getBooking(customer, ready.booking.id)).group.paymentStatus, 'UNPAID');
});

test('Phase 15 payment authorization remains distinct from verified capture and ignores late failure', async () => {
  let state: 'AUTHORIZED' | 'CAPTURED' | 'FAILED' = 'AUTHORIZED'; let calls = 0;
  const { service } = setup({ verifyPayment: async payment => { calls++; return { eventId: 'unit-event-' + state, providerReference: 'unit-payment', status: state, amountMinor: payment.order.amountMinor, currency: payment.order.currency }; } });
  const { booking } = await prepared(service), payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('authorize-pay'));
  await service.reconcilePayment(finance, payment.id, 'unit-authorization', meta('authorized'));
  assert.equal((await service.getBooking(customer, booking.id)).group.paymentStatus, 'AUTHORIZED');
  await assert.rejects(service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('early-dispatch')), code('SUPPLIER_REQUEST_NOT_READY'));
  state = 'CAPTURED'; await service.reconcilePayment(finance, payment.id, 'unit-capture', meta('captured'));
  await service.reconcilePayment(finance, payment.id, 'unit-capture', meta('captured')); assert.equal(calls, 2);
  state = 'FAILED'; await service.reconcilePayment(finance, payment.id, 'unit-late-failure', meta('late-failure'));
  assert.equal((await service.getBooking(customer, booking.id)).group.paymentStatus, 'SETTLED');
});

test('Phase 15 failed authorization clears held payment state and sends the booking to manual review', async () => {
  let state: 'AUTHORIZED' | 'FAILED' = 'AUTHORIZED';
  const { store, service } = setup({ verifyPayment: async payment => ({ eventId: 'unit-auth-fail-' + state, providerReference: 'unit-auth-fail',
    status: state, amountMinor: payment.order.amountMinor, currency: payment.order.currency }) });
  const { booking } = await prepared(service), payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('auth-failed-pay'));
  await service.reconcilePayment(finance, payment.id, 'unit-auth-fail-authorize', meta('auth-failed-authorize'));
  assert.equal((await service.getBooking(customer, booking.id)).group.paymentStatus, 'AUTHORIZED');
  state = 'FAILED'; await service.reconcilePayment(finance, payment.id, 'unit-auth-fail-fail', meta('auth-failed-fail'));
  const failed = await service.getBooking(customer, booking.id);
  assert.equal(failed.group.paymentStatus, 'UNPAID'); assert.equal(failed.group.overallFulfillmentStatus, 'MANUAL_REVIEW');
  assert.equal((await records(store)).payments[0].order.status, 'FAILED');
});

test('Phase 15 supplier confirmation, fulfilment and audits preserve authoritative evidence', async () => {
  const { store, service } = setup(); const { booking } = await paid(service);
  const request = await service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('supplier-queue'));
  assert.equal((await service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('supplier-queue-again'))).id, request.id);
  const confirmed = await service.confirmItem(ops, request.id, { kind: 'SUPPLIER', reference: 'UNIT-SUPPLIER-CONFIRMATION', evidenceId: 'UNIT-SUPPLIER-EVIDENCE' }, meta('supplier-confirm'));
  assert.equal(confirmed.group.overallFulfillmentStatus, 'CONFIRMED'); assert.equal(confirmed.items[0].isUpstreamConfirmed, true);
  const pending = await service.progressFulfilment(ops, booking.id, 'FULFILMENT_PENDING', 'UNIT-OPS-HANDOFF', meta('fulfilment-pending'));
  const fulfilled = await service.progressFulfilment(ops, booking.id, 'FULFILLED', 'UNIT-DELIVERY-EVIDENCE', meta('fulfilled'));
  assert.equal(pending.group.overallFulfillmentStatus, 'FULFILMENT_PENDING'); assert.equal(fulfilled.group.overallFulfillmentStatus, 'FULFILLED');
  const events = (await records(store)).events;
  assert.ok(events.every(event => event.actorUserId && event.actorRole && event.previousState && event.newState && event.timestamp && event.correlationId));
  assert.ok(events.some(event => event.bookingId === booking.id && event.supplierAdapter === 'UNIT_PROVIDER'));
  assert.ok(!JSON.stringify(events).includes(customer.email));
  const fulfilment = (await records(store)).operations.find(op => op.kind === 'FULFILMENT');
  assert.equal(fulfilment.evidenceId, 'UNIT-DELIVERY-EVIDENCE'); assert.equal(fulfilment.ticket.status, 'RESOLVED');
});

test('Phase 15 manual confirmation is two-stage, operator-only and never fabricated as upstream API issuance', async () => {
  const { store, service } = setup();
  let trip = await service.stage(customer, { offer: offer({ sourceType: 'MANUAL', inventorySource: 'DIRECT_CONTRACT', bookingMode: 'REQUEST_TO_BOOK', fulfillmentMode: 'ON_REQUEST', confirmationMode: 'REQUEST_TO_CONFIRM', commercialEvidenceId: 'UNIT-MANUAL-CONTRACT' }), configuration: { adults: 1 } }, meta('manual-stage'));
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('manual-reval'));
  assert.equal(trip.items[0].item.state, 'NEEDS_ACTION');
  const booking = await service.createBookingIntent(customer, trip.id, meta('manual-booking'));
  const request = (await records(store)).operations[0];
  assert.equal(booking.group.overallFulfillmentStatus, 'MANUAL_REVIEW');
  await assert.rejects(service.createPaymentReference(customer, booking.id, 'STRIPE', meta('unapproved-manual-pay')), code('MANUAL_APPROVAL_REQUIRED'));
  await assert.rejects(service.approveManualRequest(customer, request.id, 'UNIT-ALLOCATION', meta('customer-manual-approval')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  await service.approveManualRequest(ops, request.id, 'UNIT-ALLOCATION', meta('manual-approve'));
  await assert.rejects(service.approveManualRequest({ ...ops, role: 'CUSTOMER' }, request.id, 'UNIT-ALLOCATION', meta('manual-approve')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  await assert.rejects(service.confirmItem(ops, request.id, { kind: 'MANUAL', reference: 'UNIT-MANUAL', evidenceId: 'UNIT-EVIDENCE' }, meta('unpaid-manual-confirm')), code('CONFIRMATION_NOT_READY'));
  const payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('approved-manual-pay'));
  await service.reconcilePayment(finance, payment.id, 'unit-capture', meta('manual-capture'));
  const result = await service.confirmItem(ops, request.id, { kind: 'MANUAL', reference: 'UNIT-MANUAL', evidenceId: 'UNIT-EVIDENCE' }, meta('manual-confirm'));
  assert.equal(result.group.overallFulfillmentStatus, 'CONFIRMED'); assert.equal(result.items[0].isUpstreamConfirmed, false);
  assert.equal(result.items[0].supplierBookingReference, undefined); assert.equal(result.items[0].supplierPnr, undefined);
  assert.equal(result.items[0].vacatinaServiceReference, 'UNIT-MANUAL');
});

test('Phase 15 expired manual approval can be refreshed by an operator but never self-approved', async () => {
  let now = clock; const { store, service } = setup({ now: () => now });
  let trip = await service.stage(customer, { offer: offer({ sourceType: 'MANUAL', inventorySource: 'DIRECT_CONTRACT', bookingMode: 'REQUEST_TO_BOOK', fulfillmentMode: 'ON_REQUEST', confirmationMode: 'REQUEST_TO_CONFIRM', commercialEvidenceId: 'UNIT-MANUAL-CONTRACT' }), configuration: { adults: 1 } }, meta('manual-renew-stage'));
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('manual-renew-reval'));
  const booking = await service.createBookingIntent(customer, trip.id, meta('manual-renew-booking'));
  const request = (await records(store)).operations[0];
  const first = await service.approveManualRequest(ops, request.id, 'UNIT-ALLOCATION-1', meta('manual-renew-first'));
  assert.equal(first.ticket.status, 'PENDING_SUPPLIER'); assert.equal(first.evidenceId, 'UNIT-ALLOCATION-1');
  now = clock + 300001;
  await assert.rejects(service.createPaymentReference(customer, booking.id, 'STRIPE', meta('manual-renew-expired-pay')), code('MANUAL_APPROVAL_EXPIRED'));
  const renewed = await service.approveManualRequest(ops, request.id, 'UNIT-ALLOCATION-2', meta('manual-renew-second'));
  assert.equal(renewed.ticket.status, 'PENDING_SUPPLIER'); assert.equal(renewed.evidenceId, 'UNIT-ALLOCATION-2');
  assert.equal((await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('manual-renew-pay'))).order.status, 'PENDING');
  await assert.rejects(service.approveManualRequest(customer, request.id, 'UNIT-ALLOCATION-3', meta('manual-renew-customer')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  await assert.rejects(service.approveManualRequest({ ...ops, userId: customer.userId }, request.id, 'UNIT-ALLOCATION-3', meta('manual-renew-self')), code('MANUAL_SELF_APPROVAL_FORBIDDEN'));
  assert.equal((await records(store)).operations[0].evidenceId, 'UNIT-ALLOCATION-2');
});

test('Phase 15 platform operations require current MFA and tenant-scoped operators cannot cross tenants', async () => {
  const { service } = setup(); const { booking } = await paid(service);
  await assert.rejects(service.queueSupplierBooking({ ...ops, role: 'PLATFORM_ADMIN', isElevatedMfa: false }, booking.id, booking.items[0].id, meta('admin-no-mfa')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  await assert.rejects(service.queueSupplierBooking({ ...ops, organizationId: 'other-tenant' }, booking.id, booking.items[0].id, meta('ops-other-tenant')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
});

test('Phase 15 price changes remain blocked until explicit customer acceptance and fresh revalidation', async () => {
  let changed = true;
  const { service } = setup({ revalidate: async saved => ({ offerId: saved.snapshot.canonicalOfferId, status: changed ? 'PRICE_CHANGED' : 'UNCHANGED', newPriceMinor: 13000 }) });
  let trip = await service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('price-stage'));
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('price-change')); assert.equal(trip.items[0].item.state, 'PRICE_CHANGED');
  changed = false;
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('price-no-consent')); assert.equal(trip.items[0].item.state, 'PRICE_CHANGED');
  trip = await service.stage(customer, { tripBucketId: trip.id, expectedRevision: trip.revision, offer: offer({ pricing: { ...offer().pricing, finalSellingPriceMinor: 13000 } }), configuration: { adults: 1, acceptedPriceMinor: 13000 } }, meta('price-accept'));
  trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('accepted-reval')); assert.equal(trip.items[0].item.state, 'READY');
  assert.equal((await service.createBookingIntent(customer, trip.id, meta('accepted-book'))).group.totalSellingPriceMinor, 13000);
});

test('Phase 15 stale, unavailable and unknown revalidation outcomes fail closed', async () => {
  for (const status of ['UNAVAILABLE','EXPIRED','RECHECK_REQUIRED'] as const) {
    const { service } = setup({ revalidate: async saved => ({ offerId: saved.snapshot.canonicalOfferId, status }) });
    let trip = await service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('unavailable-stage'));
    trip = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('unavailable-reval'));
    assert.notEqual(trip.items[0].item.state, 'READY');
    await assert.rejects(service.createBookingIntent(customer, trip.id, meta('unavailable-book')), code('REVALIDATION_REQUIRED'));
  }
  const stale = setup(); const trip = await stale.service.stage(customer, { offer: offer({ validUntil: new Date(clock - 1).toISOString() }), configuration: { adults: 1 } }, meta('stale-stage'));
  const checked = await stale.service.revalidate(customer, trip.id, trip.items[0].item.id, meta('stale-reval'));
  assert.equal(checked.items[0].item.state, 'OFFER_EXPIRED');
  await assert.rejects(stale.service.createBookingIntent(customer, trip.id, meta('stale-book')), code('OFFER_STALE'));
});

test('Phase 15 supplier timeout is bounded, correlated, sanitized and replayed without another call', async () => {
  const telemetry: any[] = []; let calls = 0;
  const { store, service } = setup({ timeoutMs: 5, telemetry: event => telemetry.push(event), revalidate: async () => { calls++; return new Promise(() => {}); } });
  const trip = await service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('timeout-stage'));
  const checked = await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('timeout-reval'));
  await service.revalidate(customer, trip.id, trip.items[0].item.id, meta('timeout-reval'));
  assert.equal(calls, 1); assert.equal(checked.items[0].item.state, 'RECHECK_REQUIRED');
  assert.equal(telemetry[0].errorCategory, 'SUPPLIER_TIMEOUT'); assert.ok(telemetry[0].latencyMs >= 0);
  assert.equal((await records(store)).revalidations[0].errorCategory, 'SUPPLIER_TIMEOUT');
});

test('Phase 15 interrupted supplier request cannot be rebooked and can reconcile a late authoritative outcome', async () => {
  const { service } = setup(); const { booking } = await paid(service);
  const request = await service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('interrupted-dispatch'));
  const pending = await service.recordOperationFailure(ops, request.id, 'SUPPLIER_TIMEOUT', meta('interrupted-result'));
  assert.equal(pending.group.overallFulfillmentStatus, 'MANUAL_REVIEW'); assert.equal(pending.group.paymentStatus, 'SETTLED');
  await assert.rejects(service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('unsafe-retry')), code('SUPPLIER_REQUEST_NOT_READY'));
  const recovered = await service.confirmItem(ops, request.id, { kind: 'SUPPLIER', reference: 'UNIT-RECOVERED', evidenceId: 'UNIT-RECONCILIATION' }, meta('late-confirmation'));
  assert.equal(recovered.group.overallFulfillmentStatus, 'CONFIRMED');
  assert.equal((await service.getBooking(customer, booking.id)).id, booking.id);
});

test('Phase 15 partial operational failure retains successful items and exact captured money', async () => {
  const { service } = setup(); const { booking } = await paid(service, 2);
  const first = await service.queueSupplierBooking(ops, booking.id, booking.items[0].id, meta('partial-first'));
  const second = await service.queueSupplierBooking(ops, booking.id, booking.items[1].id, meta('partial-second'));
  await service.confirmItem(ops, first.id, { kind: 'SUPPLIER', reference: 'UNIT-FIRST', evidenceId: 'UNIT-FIRST-EVIDENCE' }, meta('partial-first-confirm'));
  const partial = await service.recordOperationFailure(ops, second.id, 'SUPPLIER_REJECTED', meta('partial-second-failed'));
  assert.equal(partial.group.overallFulfillmentStatus, 'PARTIAL_FAILURE'); assert.equal(partial.group.paymentStatus, 'SETTLED');
  assert.equal(partial.items[0].fulfillmentStatus, 'CONFIRMED'); assert.equal(partial.items[1].isUpstreamConfirmed, false);
});

test('Phase 15 payment initiation failure creates reconciliation, not a fake charge or replacement payment', async () => {
  const { store, service } = setup(); const { booking } = await prepared(service);
  const payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('failed-initiation'));
  const request = (await records(store)).operations.find(op => op.kind === 'PAYMENT_INITIATION');
  const pending = await service.recordOperationFailure(finance, request.id, 'PAYMENT_INITIATION_FAILED', meta('payment-failure'));
  assert.equal(pending.group.paymentStatus, 'UNPAID'); assert.equal(pending.group.overallFulfillmentStatus, 'MANUAL_REVIEW');
  const retry = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('payment-customer-retry'));
  assert.equal(retry.id, payment.id); assert.equal((await records(store)).payments.length, 1);
});

test('Phase 15 cancellation and refund requests are atomic and never claim an unverified refund', async () => {
  const { store, service } = setup(); const { booking, payment } = await paid(service);
  const cancel = await service.requestCancellation(customer, booking.id, meta('cancel'));
  assert.equal((await service.requestCancellation(customer, booking.id, meta('cancel-again'))).id, cancel.id);
  await assert.rejects(service.completeCancellation(customer, cancel.id, 'UNIT-CANCELLED', meta('customer-cancel-confirm')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  const cancelled = await service.completeCancellation(ops, cancel.id, 'UNIT-CANCEL-EVIDENCE', meta('cancel-confirm'));
  assert.equal(cancelled.group.overallFulfillmentStatus, 'CANCELLED'); assert.equal(cancelled.group.paymentStatus, 'SETTLED');
  await assert.rejects(service.requestRefund(customer, booking.id, payment.id, 12345, meta('customer-refund')), code('OPERATOR_AUTHORIZATION_REQUIRED'));
  const refund = await service.requestRefund(finance, booking.id, payment.id, 12345, meta('refund'));
  assert.equal((await service.requestRefund(finance, booking.id, payment.id, 12345, meta('refund-again'))).id, refund.id);
  await assert.rejects(service.requestRefund(finance, booking.id, payment.id, 1, meta('refund-other-amount')), code('REFUND_ALREADY_PENDING'));
  assert.equal((await service.getBooking(customer, booking.id)).group.overallFulfillmentStatus, 'REFUND_PENDING');
  assert.equal((await records(store)).payments[0].order.status, 'CAPTURED');
});

test('Phase 15 memory unit-of-work rolls back selection, event, outbox and idempotency writes together', async () => {
  const store = new MemoryReadinessUnitOfWork();
  const faulty: ReadinessUnitOfWork = { engine: 'MEMORY_TEST', transaction: work => store.transaction(r => work({ ...r, events: { ...r.events, put: async event => { await r.events.put(event); throw new Error('unit-fault-after-event'); } } })) };
  const service = new BackendReadinessService(faulty, { now: () => clock });
  await assert.rejects(service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('rollback')), /unit-fault-after-event/);
  const data = await records(store); assert.ok(Object.values(data).every(value => value.length === 0));
});

test('Phase 15 repository contracts reject dangling references and immutable audit replacement', async () => {
  const { store, service } = setup(); const { trip } = await prepared(service);
  const empty = new MemoryReadinessUnitOfWork();
  await assert.rejects(empty.transaction(r => r.trips.put(trip)), code('REFERENCE_INTEGRITY_VIOLATION'));
  const event = (await records(store)).events[0];
  await assert.rejects(store.transaction(r => r.events.put(event)), code('IMMUTABLE_RECORD_CONFLICT'));
});

test('Phase 15 PostgreSQL is disabled before any connection unless all three approvals are explicit', async () => {
  let connects = 0;
  const pool = { connect: async () => { connects++; throw new Error('must-not-connect'); } };
  for (const approval of [{ writesEnabled: false, migrationApproved: false, clerkRotationConfirmed: false }, { writesEnabled: true, migrationApproved: true, clerkRotationConfirmed: false }]) {
    const store = new PostgresReadinessUnitOfWork(pool, approval);
    await assert.rejects(store.transaction(async () => true), code('PRODUCTION_PERSISTENCE_NOT_APPROVED'));
  }
  assert.equal(connects, 0);
});

test('Phase 15 PostgreSQL query contract parameterizes data and rolls back driver failures without leaking details', async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = []; let released = 0;
  const store = new PostgresReadinessUnitOfWork({ connect: async () => ({ query: async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith('INSERT')) throw new Error('unit-only-private-driver-diagnostic');
    return { rows: [], rowCount: 1 };
  }, release: () => { released++; } }) }, { writesEnabled: true, migrationApproved: true, clerkRotationConfirmed: true });
  await assert.rejects(store.transaction(async r => r.events.put({ id: 'unit-event', ownerId: customer.userId, actorUserId: customer.userId, actorRole: 'CUSTOMER', operation: 'unit.operation', action: 'unit.operation', targetEntity: 'unit', targetEntityId: 'unit-id', previousState: { status: 'NONE' }, newState: { status: 'PENDING' }, status: 'PENDING', timestamp: new Date(clock).toISOString(), correlationId: 'unit-correlation', justificationReason: 'unit-only event' })), error => error instanceof ReadinessError && error.code === 'PERSISTENCE_UNAVAILABLE' && !error.message.includes('private-driver'));
  assert.equal(queries[0].sql, 'BEGIN'); assert.ok(queries.some(q => q.sql.includes('pg_advisory_xact_lock')));
  assert.ok(queries.some(q => q.sql === 'ROLLBACK')); assert.ok(!queries.some(q => q.sql === 'COMMIT')); assert.equal(released, 1);
  const insert = queries.find(q => q.sql.startsWith('INSERT'))!; assert.ok(insert.sql.includes('$1')); assert.ok(!insert.sql.includes(customer.userId)); assert.ok(insert.values!.includes(customer.userId));
});

test('Phase 15 PostgreSQL projections match every prepared table, with atomic commit and no database access', async () => {
  const { store, service } = setup(); await paid(service);
  const saved = await records(store); const queries: string[] = [];
  const postgres = new PostgresReadinessUnitOfWork({ connect: async () => ({ query: async sql => { queries.push(sql); return { rows: [], rowCount: 1 }; }, release: () => {} }) }, { writesEnabled: true, migrationApproved: true, clerkRotationConfirmed: true });
  await postgres.transaction(async r => { for (const key of Object.keys(READINESS_TABLES) as Array<keyof ReadinessRepositories>) for (const record of saved[key]) await (r[key] as any).put(record); });
  assert.equal(queries.at(-1), 'COMMIT'); assert.ok(!queries.includes('ROLLBACK'));
  for (const sql of queries) assert.ok(parse(sql).length > 0);
  assert.ok(queries.some(sql => sql.includes('vacatina_trip_selections'))); assert.ok(queries.some(sql => sql.includes('vacatina_booking_selections')));
});

test('Phase 15 failed PostgreSQL hydration preserves prior local state and invalid snapshots do not partially restore', async () => {
  const engine = new VacatinaStorageEngine(); const bucket = engine.getOrCreateTripBucket('unit-survives-failed-connect');
  const before = engine.exportSnapshot();
  const runtime = new RuntimePersistence({ mode: 'postgres', engine, enabled: true, pool: { connect: async () => { throw Object.assign(new Error('unit-refused'), { code: 'ECONNREFUSED' }); } } });
  await assert.rejects(runtime.run(async () => true), PersistenceUnavailableError);
  assert.equal(engine.getOrCreateTripBucket('unit-survives-failed-connect').id, bucket.id);
  const invalid = structuredClone(before); invalid.collections.tripBucketItems = [['invalid']] as any;
  assert.throws(() => engine.restoreSnapshot(invalid)); assert.deepEqual(engine.exportSnapshot(), before);
});

test('Phase 15 migration validation parses forward/rollback only and covers canonical status and foreign-key contracts', () => {
  const result = checkBackendMigrations(); assert.equal(result.migrationsExecuted, false); assert.equal(result.tables.length, 12);
  const sql = fs.readFileSync('src/server/db/migrations/003_backend_readiness.sql', 'utf8');
  for (const table of Object.values(READINESS_TABLES)) assert.ok(result.tables.includes(table));
  for (const status of Object.keys(BOOKING_TRANSITIONS)) assert.ok(sql.includes("'" + status + "'"));
  assert.ok(sql.includes('FOREIGN KEY (booking_id, owner_id)')); assert.ok(sql.includes('uq_operation_business_key'));
});

test('Phase 15 configuration leaves activation disabled and blocks unconfirmed Clerk rotation before reading keys', () => {
  const unapproved = readBackendReadinessConfig({ NODE_ENV: 'production', VACATINA_ENABLE_PRODUCTION_WRITES: 'true' });
  assert.equal(unapproved.productionWritesEnabled, false); assert.ok(unapproved.blockers.includes('CLERK_ROTATION_UNCONFIRMED'));
  const optional = validateServerEnv({ NODE_ENV: 'test' }); assert.equal(optional.STRIPE_SECRET_KEY, undefined); assert.equal(optional.DUFFEL_ACCESS_TOKEN, undefined);
  assert.throws(() => validateServerEnv({ NODE_ENV: 'production' }), /rotation\/revocation/);
  assert.throws(() => validateServerEnv({ NODE_ENV: 'production', BASE_URL: 'https://production.example.test', VACATINA_CLERK_ROTATION_CONFIRMED: 'true', DATABASE_URL: 'placeholder' }), /DATABASE_URL/);
  assert.equal(unapproved.supplierActivationEnabled, false); assert.equal(unapproved.paymentActivationEnabled, false);
  const previous = process.env.NODE_ENV;
  try { process.env.NODE_ENV = 'production'; assert.throws(() => new PostgresManualListingRepository(), /not production approved/); assert.throws(() => getManualListingRepository(), /not production approved/); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('Phase 15 telemetry whitelists metadata, and the HTTP boundary retains correlation, CSRF and identity scoping', async () => {
  const record = backendTelemetry({ requestId: 'unit-correlation', operation: 'unit.operation', status: 'PENDING', latencyMs: 12, authorization: 'unit-private-header', passportNumber: 'UNIT-PRIVATE-DOCUMENT' } as any);
  assert.ok(!JSON.stringify(record).includes('unit-private-header')); assert.ok(!JSON.stringify(record).includes('UNIT-PRIVATE-DOCUMENT'));
  let calls = 0; const telemetry: any[] = [];
  const handler = createDevelopmentHttpApplication({ sessionSecret: 'unit-test-only-session-signing-material-not-a-real-secret', authenticate: async () => customer,
    persistence: { run: async work => work() } as any, telemetry: event => telemetry.push(event), dispatch: async request => { calls++; return Response.json({ requestId: request.headers.get('x-request-id') }); } });
  const origin = 'http://127.0.0.1:4190';
  const sessionResponse = await handler(new Request(origin + '/api/v1/session')); const session = await sessionResponse.json(); const cookie = sessionResponse.headers.get('set-cookie')!;
  const rejected = await handler(new Request(origin + '/api/v1/admin/requests', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(rejected.status, 403); assert.equal(calls, 0);
  const accepted = await handler(new Request(origin + '/api/v1/trip-buckets/items', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken, 'X-Request-Id': 'unit-http-correlation' }, body: '{}' }));
  assert.equal(accepted.headers.get('x-request-id'), 'unit-http-correlation'); assert.equal((await accepted.json()).requestId, 'unit-http-correlation');
  assert.equal(calls, 1); assert.ok(telemetry.every(event => event.requestId && event.operation === 'http.request'));
});

test('Phase 15 existing customer routes use saved payment totals and corrected owner-scoped cancellation arguments', async () => {
  const engine = new VacatinaStorageEngine(); const group = engine.createBookingGroup({ bookingReference: 'UNIT-BOOKING', userId: customer.userId,
    checkoutSessionId: 'unit-checkout', totalSellingPriceMinor: 12345, currency: 'USD', paymentStatus: 'UNPAID', overallFulfillmentStatus: 'PENDING_REVALIDATION' });
  let paymentInput: any, cancellation: any[] = [];
  const router = new VacatinaApiRouter(engine, { requestCancellation: async (...args) => { cancellation = args; return { status: 'CANCEL_PENDING' }; } } as any,
    { createPaymentIntent: async input => { paymentInput = input; return { status: 'PENDING' }; } } as any);
  const paymentRequest = new Request('http://127.0.0.1/api/v1/checkout/payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'unit-payment-key' }, body: JSON.stringify({ bookingGroupId: group.id, customerName: 'Unit customer', amountMinor: 1, currency: 'XXX', gatewayId: 'STRIPE' }) });
  assert.equal((await router.handleRequest(paymentRequest, customer)).status, 200);
  assert.equal(paymentInput.amountMinor, 12345); assert.equal(paymentInput.currency, 'USD');
  const response = await router.handleRequest(new Request('http://127.0.0.1/api/v1/bookings/UNIT-BOOKING/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'unit-cancel-key' }, body: JSON.stringify({ reason: 'Unit cancellation reason' }) }), customer);
  assert.equal(response.status, 200); assert.equal(cancellation[0], group.id); assert.equal(cancellation[1], 'Unit cancellation reason'); assert.equal(cancellation[3], customer.userId);
  const denied = await router.handleRequest(new Request('http://127.0.0.1/api/v1/bookings/UNIT-BOOKING'), other); assert.equal(denied.status, 404);
});

test('Phase 15 request-to-confirm readiness still prepares an unpaid draft without upstream confirmation', async () => {
  const storage = new VacatinaStorageEngine(); const bucket = storage.getOrCreateTripBucket('user:' + customer.userId, customer.userId);
  const item = storage.addTripBucketItem({ tripBucketId: bucket.id, canonicalOfferId: 'unit-manual', productType: 'hotels', sourceType: 'MANUAL', bookingMode: 'REQUEST_TO_BOOK', sellability: 'BOOKABLE', environmentClass: 'PRODUCTION', title: 'Unit manual', configuration: {}, travellerManifest: {}, unitSellingPriceMinor: 1000, currency: 'USD', state: 'NEEDS_ACTION' });
  const original = globalUnifiedInventory.revalidateOffer;
  try {
    globalUnifiedInventory.revalidateOffer = async id => ({ offerId: id, status: 'UNCHANGED' });
    const router = new VacatinaApiRouter(storage);
    const response = await router.handleRequest(new Request('http://127.0.0.1/api/v1/trip-buckets/items/' + item.id + '/revalidate', { method: 'POST' }), customer);
    assert.equal(response.status, 200); assert.equal(storage.getTripBucketItems(bucket.id)[0].state, 'READY');
  } finally { globalUnifiedInventory.revalidateOffer = original; }
  const saga = new BookingSagaService(storage, { revalidateItem: async () => ({ status: 'UNCHANGED' }) });
  const prepared = await saga.executeBookingSaga({ tripBucketId: bucket.id, checkoutSessionId: 'unit-manual-checkout', customerEmail: 'customer@example.test', customerName: 'Unit customer', idempotencyKey: 'unit-manual-saga-key', userId: customer.userId });
  assert.equal(prepared.overallStatus, 'PENDING_REVALIDATION'); assert.equal(prepared.paymentStatus, 'UNPAID');
  assert.ok(prepared.items.every(entry => entry.isUpstreamConfirmed === false && entry.fulfillmentStatus === 'PENDING'));
});

test('Phase 15 configuration and fingerprint validation reject invalid parties and changed settlement terms', async () => {
  const { service } = setup();
  await assert.rejects(service.stage(customer, { offer: offer(), configuration: { adults: -1 } }, meta('invalid-party')), code('INVALID_CONFIGURATION'));
  await assert.rejects(service.stage(customer, { offer: offer(), configuration: { adults: Number.NaN } }, meta('invalid-number')), code('INVALID_CONFIGURATION'));
  const trip = await service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('bound-currency'));
  await assert.rejects(service.stage(customer, { offer: offer({ pricing: { ...offer().pricing, currency: 'EUR' } }), configuration: { adults: 1 } }, meta('bound-currency')), code('IDEMPOTENCY_CONFLICT'));
  await assert.rejects(service.stage(customer, { tripBucketId: trip.id, offer: offer(), configuration: { adults: 2 } }, meta('missing-revision')), code('REVISION_REQUIRED'));
});

test('Phase 15 immutable provider receipts prevent event reuse after a later capture replaces the last event', async () => {
  let event = 'unit-original-authorization'; let status: 'AUTHORIZED' | 'CAPTURED' = 'AUTHORIZED';
  const { service } = setup({ verifyPayment: async payment => ({ eventId: event, providerReference: 'unit-provider-' + payment.id, amountMinor: payment.order.amountMinor, currency: payment.order.currency, status }) });
  const { booking } = await prepared(service), first = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('receipt-pay'));
  await service.reconcilePayment(finance, first.id, 'unit-first-notification', meta('receipt-authorize'));
  event = 'unit-original-capture'; status = 'CAPTURED'; await service.reconcilePayment(finance, first.id, 'unit-capture-notification', meta('receipt-capture'));
  let trip = await service.stage(other, { offer: offer(), configuration: { adults: 1 } }, meta('other-stage'));
  trip = await service.revalidate(other, trip.id, trip.items[0].item.id, meta('other-revalidate'));
  const secondBooking = await service.createBookingIntent(other, trip.id, meta('other-booking'));
  const second = await service.createPaymentReference(other, secondBooking.id, 'STRIPE', meta('other-payment'));
  event = 'unit-original-authorization'; status = 'AUTHORIZED';
  await assert.rejects(service.reconcilePayment(finance, second.id, 'unit-reused-notification', meta('reused-event')), code('DUPLICATE_PROVIDER_EVENT'));
  assert.equal((await service.getBooking(other, secondBooking.id)).group.paymentStatus, 'UNPAID');
});

test('Phase 15 a failed command after PostgreSQL hydration restores the transaction checkpoint', async () => {
  const engine = new VacatinaStorageEngine(); const existing = engine.getOrCreateTripBucket('unit-before-transaction');
  const saved = { version: 1, engine: engine.exportSnapshot(), participants: {} }; const statements: string[] = [];
  const runtime = new RuntimePersistence({ mode: 'postgres', engine, enabled: true, pool: { connect: async () => ({ query: async sql => { statements.push(sql); return { rows: sql.startsWith('SELECT payload') ? [{ payload: saved }] : [] }; }, release: () => {} }) } });
  await assert.rejects(runtime.run(async () => { engine.getOrCreateTripBucket('unit-rolled-back'); throw new Error('unit-command-failure'); }), /unit-command-failure/);
  assert.equal(engine.getOrCreateTripBucket('unit-before-transaction').id, existing.id);
  assert.equal(engine.exportSnapshot().collections.tripBuckets.length, 1); assert.ok(statements.includes('ROLLBACK'));
});

test('Phase 15 READY without persisted authoritative revalidation evidence cannot create a booking', async () => {
  const { store, service } = setup();
  const trip = await service.stage(customer, { offer: offer(), configuration: { adults: 1 } }, meta('forged-ready-stage'));
  await store.transaction(async r => { const forged = (await r.trips.get(trip.id))!; forged.items[0].item.state = 'READY'; forged.items[0].item.lastRevalidatedAt = new Date(clock).toISOString(); await r.trips.put(forged); });
  await assert.rejects(service.createBookingIntent(customer, trip.id, meta('forged-ready-book')), code('REVALIDATION_REQUIRED'));
});

test('Phase 15 delayed payment preparation refuses stale frozen revalidation without creating an order', async () => {
  let current = clock;
  const { store, service } = setup({ now: () => current }); const { booking } = await prepared(service);
  current += 301000;
  await assert.rejects(service.createPaymentReference(customer, booking.id, 'STRIPE', meta('stale-payment')), code('REVALIDATION_REQUIRED'));
  assert.equal((await records(store)).payments.length, 0);
});

test('Phase 15 trusted payment-verifier failures are categorized without exposing provider diagnostics', async () => {
  const { service } = setup({ verifyPayment: async () => { throw new Error('unit-only-private-notification-detail'); } });
  const { booking } = await prepared(service); const payment = await service.createPaymentReference(customer, booking.id, 'STRIPE', meta('verifier-failure-pay'));
  await assert.rejects(service.reconcilePayment(finance, payment.id, 'unit-notification', meta('verifier-failure')), code('PAYMENT_VERIFICATION_UNAVAILABLE'));
  assert.equal((await service.getBooking(customer, booking.id)).group.paymentStatus, 'UNPAID');
});
