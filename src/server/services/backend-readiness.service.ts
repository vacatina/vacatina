import { createHash, randomUUID } from 'node:crypto';
import type { SecurityContext, PermissionSlug } from '../auth/rbac.ts';
import { AuthorizationEngine } from '../auth/rbac.ts';
import type { BookingOverallStatus, PaymentOrderEntity, TripBucketState } from '../db/schema.ts';
import type { CanonicalOfferEntity, RevalidationResult, SearchQueryCriteria } from '../inventory/types.ts';
import type {
  BookingRecord, FailureCategory, OfferReferenceRecord, OperationalRequestRecord, OperationKind,
  PaymentReferenceRecord, ReadinessRepositories, ReadinessUnitOfWork, TripBucketRecord, OwnedRecord
} from '../persistence/readiness-contracts.ts';
import { ReadinessError } from '../persistence/readiness-contracts.ts';
import { transitionBooking } from './booking-lifecycle.ts';
import { backendTelemetry, requestCorrelationId, safeBackendIdentifier, type BackendTelemetrySink } from '../runtime/observability.ts';

export interface MutationMetadata { idempotencyKey: string; correlationId?: string; }
export interface VerifiedPaymentEvidence {
  eventId: string; providerReference: string; amountMinor: number; currency: string;
  status: 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
}
export interface BackendReadinessOptions {
  now?: () => number; timeoutMs?: number; telemetry?: BackendTelemetrySink;
  revalidate?: (offer: OfferReferenceRecord, signal: AbortSignal) => Promise<RevalidationResult>;
  /** Trusted, independently verified provider boundary. Never implement as body.verified === true. */
  verifyPayment?: (payment: PaymentReferenceRecord, notificationReference: string) => Promise<VerifiedPaymentEvidence>;
}

function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item ?? null)).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const configKeys = new Set(['destination','origin','departureDate','returnDate','adults','children','infants','rooms','serviceType','tripType','pickup','dropoff','pickupTime','returnTime','luggage','driverAge','cabinClass','roomType','boardBasis','timeSlot','language','cabinType','travellerAges','residenceCountry','acceptedPriceMinor','optionId','selectedFareFamilyCode','selectedRoomId','selectedPlanId','packageStyle','accommodationTier','vehicleCategory','ticketType','durationDays','departurePort','coverageOption','policyReviewAcknowledged']);
function configuration(input: Record<string, unknown>): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ReadinessError('INVALID_CONFIGURATION', 400);
  const cleaned = Object.fromEntries(Object.entries(input).filter(([key, value]) => configKeys.has(key) && ['string','number','boolean'].includes(typeof value))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value]));
  if (Object.values(cleaned).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new ReadinessError('INVALID_CONFIGURATION', 400);
  const adults = Number(cleaned.adults ?? 1), children = Number(cleaned.children ?? 0), infants = Number(cleaned.infants ?? 0);
  if (![adults, children, infants].every(Number.isSafeInteger) || adults < 1 || children < 0 || infants < 0 || infants > adults || adults + children + infants > 9) throw new ReadinessError('INVALID_CONFIGURATION', 400);
  return cleaned;
}
function reference(value: string): string {
  if (!safeBackendIdentifier(value) || value.length < 3) throw new ReadinessError('INVALID_EVIDENCE_REFERENCE', 400);
  return value;
}
function owner(context: SecurityContext, record: { ownerId: string; organizationId?: string }): void {
  if (!context?.userId) throw new ReadinessError('SIGN_IN_REQUIRED', 401);
  if (record.ownerId !== context.userId || record.organizationId !== context.organizationId) throw new ReadinessError('RESOURCE_NOT_FOUND', 404);
}
function operator(context: SecurityContext, record: { organizationId?: string }, permission: PermissionSlug = 'ops:reconcile_booking'): void {
  if (!context?.userId) throw new ReadinessError('SIGN_IN_REQUIRED', 401);
  if (!AuthorizationEngine.authorizeResourceAccess(context, permission, record.organizationId).allowed ||
    (context.role === 'PLATFORM_ADMIN' && !context.isElevatedMfa)) throw new ReadinessError('OPERATOR_AUTHORIZATION_REQUIRED', 403);
}
function manual(offer: OfferReferenceRecord): boolean {
  return offer.authority.bookingMode !== 'INSTANT_BOOK' || !['INSTANT_CONFIRM','INSTANT'].includes(offer.authority.confirmationMode) || offer.authority.fulfillmentMode !== 'INSTANT';
}
function eligible(offer: OfferReferenceRecord): boolean {
  const a = offer.authority;
  return a.environmentClass === 'PRODUCTION' && !a.isSandboxSimulated && a.sourceType !== 'SEED' &&
    a.sellability !== 'DISCOVERY_ONLY' && a.commercialStatus === 'COMMERCIALLY_VERIFIED' &&
    (a.sourceType === 'API' ? a.providerLifecycle === 'PRODUCTION_LIVE' : Boolean(offer.snapshot.snapshotData.commercialEvidenceId)) &&
    (!['HYBRID','COMPOSITE','CURATED_PACKAGE'].includes(a.sourceType) || Boolean(offer.componentReferences?.length)) &&
    (offer.componentReferences || []).every(component => component.environmentClass === 'PRODUCTION' && !component.isSandboxSimulated && component.sellability === 'BOOKABLE' && component.componentStatus === 'VALID' && component.lastRevalidationResult === 'UNCHANGED');
}

/** Preparation-only application boundary. No live client, worker, global instance, or production route is installed. */
export class BackendReadinessService {
  private persistence: ReadinessUnitOfWork;
  private options: BackendReadinessOptions;
  constructor(persistence: ReadinessUnitOfWork, options: BackendReadinessOptions = {}) { this.persistence = persistence; this.options = options; }
  private now(): string { return new Date((this.options.now || Date.now)()).toISOString(); }
  private base(context: SecurityContext, id: string = randomUUID()): OwnedRecord {
    return { id, ownerId: context.userId, organizationId: context.organizationId, createdAt: this.now(), updatedAt: this.now() };
  }
  private mutationId(context: SecurityContext, operation: string, metadata: MutationMetadata): string {
    if (!context?.userId) throw new ReadinessError('SIGN_IN_REQUIRED', 401);
    if (!metadata.idempotencyKey || metadata.idempotencyKey.length < 8 || metadata.idempotencyKey.length > 180) throw new ReadinessError('IDEMPOTENCY_KEY_REQUIRED', 400);
    // A replay cannot bypass a revoked role, tenant change or expired admin MFA.
    return hash([context.userId, context.organizationId, context.role, context.isElevatedMfa === true, operation, metadata.idempotencyKey]);
  }
  private async replay<T>(context: SecurityContext, operation: string, input: unknown, metadata: MutationMetadata): Promise<T | undefined> {
    const id = this.mutationId(context, operation, metadata);
    return this.persistence.transaction(async r => {
      const prior = await r.idempotency.get(id);
      if (prior && prior.requestHash !== hash(input)) throw new ReadinessError('IDEMPOTENCY_CONFLICT');
      return prior?.result as T | undefined;
    });
  }
  private async mutate<T>(context: SecurityContext, operation: string, input: unknown, metadata: MutationMetadata,
    work: (r: ReadinessRepositories, correlationId: string) => Promise<T>): Promise<T> {
    const id = this.mutationId(context, operation, metadata), requestHash = hash(input);
    const correlationId = requestCorrelationId(metadata.correlationId);
    return this.persistence.transaction(async r => {
      const prior = await r.idempotency.get(id);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new ReadinessError('IDEMPOTENCY_CONFLICT');
        return prior.result as T;
      }
      const result = await work(r, correlationId);
      await r.idempotency.put({ ...this.base(context, id), scope: operation, requestHash, result });
      return result;
    });
  }
  private async audit(r: ReadinessRepositories, context: SecurityContext, record: { id: string; ownerId: string; bookingId?: string; group?: BookingRecord['group'] },
    action: string, previous: string, next: string, correlationId: string, supplierAdapter?: string, errorCategory?: FailureCategory): Promise<void> {
    await r.events.put({ id: randomUUID(), ownerId: record.ownerId, actorUserId: context.userId, actorOrganizationId: context.organizationId,
      actorRole: context.role, action, operation: action, targetEntity: 'backend_readiness', targetEntityId: record.id,
      previousState: { status: previous }, newState: { status: next }, status: next, timestamp: this.now(), correlationId,
      ...(record.group ? { bookingId: record.id } : record.bookingId ? { bookingId: record.bookingId } : {}),
      ...(safeBackendIdentifier(supplierAdapter) ? { supplierAdapter } : {}), ...(errorCategory ? { errorCategory } : {}),
      justificationReason: 'Explicit backend lifecycle operation; no provider success is inferred.' });
  }
  async getTrip(context: SecurityContext, id: string): Promise<TripBucketRecord> {
    return this.persistence.transaction(async r => { const trip = await r.trips.get(id); if (!trip) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, trip); return trip; });
  }
  async getBooking(context: SecurityContext, id: string): Promise<BookingRecord> {
    return this.persistence.transaction(async r => { const booking = await r.bookings.get(id); if (!booking) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, booking); return booking; });
  }

  async stage(context: SecurityContext, input: { offer: CanonicalOfferEntity; configuration: Record<string, unknown>; search?: SearchQueryCriteria; tripBucketId?: string; expectedRevision?: number }, metadata: MutationMetadata): Promise<TripBucketRecord> {
    const config = configuration(input.configuration);
    const offer = input.offer;
    if (!offer?.canonicalOfferId || !offer.supplierId || !/^[A-Z]{3}$/.test(offer.pricing?.currency || '') || !Number.isSafeInteger(offer.pricing.finalSellingPriceMinor) || offer.pricing.finalSellingPriceMinor < 0) throw new ReadinessError('INVALID_CANONICAL_OFFER', 400);
    return this.mutate(context, 'trip.stage', { offerId: offer.canonicalOfferId, supplier: offer.supplierId, price: offer.pricing.finalSellingPriceMinor, currency: offer.pricing.currency, termsHash: hash(offer.cancellationPolicy), search: input.search, authority: [offer.environmentClass,offer.commercialStatus,offer.sellability,offer.providerLifecycle,offer.bookingMode,offer.isSandboxSimulated], expires: offer.validUntil || offer.expiresAt || offer.freshness?.expiresAtIso, config, tripId: input.tripBucketId, expectedRevision: input.expectedRevision }, metadata, async (r, correlationId) => {
      const id = input.tripBucketId || 'trip_' + hash([context.userId, context.organizationId]).slice(0, 40);
      let trip = await r.trips.get(id);
      if (trip) { owner(context, trip); if (trip.bucket.status !== 'ACTIVE') throw new ReadinessError('TRIP_NOT_ACTIVE'); if (input.expectedRevision !== undefined && input.expectedRevision !== trip.revision) throw new ReadinessError('REVISION_CONFLICT'); }
      else trip = { ...this.base(context, id), bucket: { id, userId: context.userId, organizationId: context.organizationId, sessionId: 'user:' + context.userId, currency: offer.pricing.currency, status: 'ACTIVE', expiresAt: new Date((this.options.now || Date.now)() + 86400000).toISOString(), createdAt: this.now(), updatedAt: this.now() }, items: [], revision: 0 };
      if (trip.items.some(selected => selected.item.currency !== offer.pricing.currency)) throw new ReadinessError('MIXED_CURRENCY');
      let searchContextId: string | undefined;
      if (input.search) { searchContextId = randomUUID(); await r.searches.put({ ...this.base(context, searchContextId), criteria: { productType: input.search.productType, origin: input.search.origin, destination: input.search.destination, departureDate: input.search.departureDate, returnDate: input.search.returnDate, adults: input.search.adults, children: input.search.children, rooms: input.search.rooms, currency: input.search.currency, channel: 'B2C' }, expiresAt: trip.bucket.expiresAt }); }
      const snapshotId = randomUUID();
      const demo = offer.environmentClass === 'SEED' || offer.sourceType === 'SEED' || offer.isSandboxSimulated;
      const stored: OfferReferenceRecord = { ...this.base(context, snapshotId), searchContextId, componentReferences: offer.components?.map(component => ({ componentId: component.componentId, productType: component.productType, sourceOfferId: component.sourceOfferId, inventorySource: component.inventorySource, listingKind: component.listingKind, compositionType: component.compositionType, fulfillmentMode: component.fulfillmentMode, environmentClass: component.environmentClass, sellability: component.sellability, supplierId: component.supplierId, supplierName: component.supplierName, isSandboxSimulated: component.isSandboxSimulated, revalidationRequired: component.revalidationRequired, lastRevalidationResult: component.lastRevalidationResult, componentStatus: component.componentStatus, costMinor: component.costMinor, currency: component.currency })), authority: {
        sourceType: offer.sourceType, environmentClass: offer.environmentClass, sellability: demo ? 'DISCOVERY_ONLY' : offer.sellability, bookingMode: offer.bookingMode,
        confirmationMode: offer.confirmationMode, fulfillmentMode: offer.fulfillmentMode, providerLifecycle: offer.providerLifecycle,
        commercialStatus: offer.commercialStatus, isSandboxSimulated: offer.isSandboxSimulated
      }, snapshot: { id: snapshotId, canonicalOfferId: offer.canonicalOfferId, productType: offer.productType, sourceType: offer.sourceType,
        supplierId: offer.supplierId, title: offer.title, validUntil: offer.validUntil || offer.expiresAt || offer.freshness?.expiresAtIso || this.now(),
        rawSupplierCostMinor: offer.pricing.rawSupplierCostMinor, rawCurrency: offer.pricing.rawCurrency,
        sellingPriceMinor: offer.pricing.finalSellingPriceMinor, displayCurrency: offer.pricing.currency, inclusions: [], exclusions: [],
        termsHash: hash(offer.cancellationPolicy || ''), snapshotData: { commercialEvidenceId: offer.commercialEvidenceId || null, sourceOfferId: offer.supplierOfferId || offer.canonicalOfferId }, createdAt: this.now() } };
      await r.offers.put(stored);
      const existing = trip.items.find(selected => selected.item.canonicalOfferId === offer.canonicalOfferId);
      if (existing && input.expectedRevision === undefined && hash(existing.item.configuration) !== hash(config)) throw new ReadinessError('REVISION_REQUIRED');
      const itemId = existing?.item.id || randomUUID();
      const selected = { offerSnapshotId: snapshotId, item: { id: itemId, tripBucketId: id, canonicalOfferId: offer.canonicalOfferId, productType: offer.productType,
        sourceType: offer.sourceType as any, title: offer.title, bookingMode: offer.bookingMode, configuration: config,
        travellerManifest: { adults: Number(config.adults || 1), children: Number(config.children || 0) }, unitSellingPriceMinor: offer.pricing.finalSellingPriceMinor,
        currency: offer.pricing.currency, state: (offer.environmentClass === 'SEED' || offer.isSandboxSimulated ? 'DRAFT' : manual(stored) ? 'NEEDS_ACTION' : 'RECHECK_REQUIRED') as 'DRAFT' | 'NEEDS_ACTION' | 'RECHECK_REQUIRED',
        environmentClass: offer.environmentClass, sellability: stored.authority.sellability, lastRevalidatedAt: '', createdAt: existing?.item.createdAt || this.now() } };
      trip.items = [...trip.items.filter(item => item.item.id !== itemId), selected]; trip.revision++; trip.updatedAt = this.now(); trip.bucket.updatedAt = trip.updatedAt;
      await r.trips.put(trip); await this.audit(r, context, trip, 'trip.stage', existing?.item.state || 'NONE', selected.item.state, correlationId, offer.supplierId);
      return trip;
    });
  }

  async revalidate(context: SecurityContext, tripId: string, itemId: string, metadata: MutationMetadata): Promise<TripBucketRecord> {
    const trip = await this.getTrip(context, tripId), selected = trip.items.find(item => item.item.id === itemId);
    if (!selected) throw new ReadinessError('RESOURCE_NOT_FOUND', 404);
    const replay = await this.replay<TripBucketRecord>(context, 'trip.revalidate', { tripId, itemId }, metadata);
    if (replay) return replay;
    const offer = await this.persistence.transaction(r => r.offers.get(selected.offerSnapshotId));
    if (!offer) throw new ReadinessError('OFFER_SNAPSHOT_MISSING');
    const started = Date.now(); let failure: FailureCategory | undefined;
    let result: RevalidationResult = { offerId: selected.item.canonicalOfferId, status: 'RECHECK_REQUIRED' };
    if (this.options.revalidate) {
      const controller = new AbortController(); let timeout: ReturnType<typeof setTimeout>;
      try {
        result = await Promise.race([this.options.revalidate(offer, controller.signal), new Promise<never>((_, reject) => {
          timeout = setTimeout(() => { controller.abort(); reject(new ReadinessError('SUPPLIER_TIMEOUT')); }, this.options.timeoutMs || 5000);
        })]);
      } catch (error) { failure = error instanceof ReadinessError && error.code === 'SUPPLIER_TIMEOUT' ? 'SUPPLIER_TIMEOUT' : 'OUTCOME_UNKNOWN'; }
      finally { clearTimeout(timeout!); }
    }
    const safeResult = { offerId: selected.item.canonicalOfferId, status: result.status, previousPriceMinor: selected.item.unitSellingPriceMinor, newPriceMinor: result.newPriceMinor ?? selected.item.unitSellingPriceMinor };
    if (!['UNCHANGED','PRICE_CHANGED','UNAVAILABLE','EXPIRED','RECHECK_REQUIRED'].includes(result.status) || result.offerId !== selected.item.canonicalOfferId || (result.updatedOffer && result.updatedOffer.pricing.currency !== selected.item.currency) || !Number.isSafeInteger(safeResult.newPriceMinor) || safeResult.newPriceMinor < 0) throw new ReadinessError('INVALID_REVALIDATION_RESULT');
    if (!Number.isFinite(Date.parse(offer.snapshot.validUntil || '')) || Date.parse(offer.snapshot.validUntil || '') <= (this.options.now || Date.now)()) safeResult.status = 'EXPIRED';
    if (safeResult.newPriceMinor !== selected.item.unitSellingPriceMinor && safeResult.status === 'UNCHANGED') safeResult.status = 'PRICE_CHANGED';
    const output = await this.mutate(context, 'trip.revalidate', { tripId, itemId }, metadata, async (r, correlationId) => {
      const current = await r.trips.get(tripId); if (!current) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, current);
      if (current.revision !== trip.revision || current.bucket.status !== 'ACTIVE') throw new ReadinessError('REVISION_CONFLICT');
      const target = current.items.find(item => item.item.id === itemId)!; const previous = target.item.state;
      let next: TripBucketState = ({ UNCHANGED: 'READY', PRICE_CHANGED: 'PRICE_CHANGED', UNAVAILABLE: 'UNAVAILABLE', EXPIRED: 'OFFER_EXPIRED', RECHECK_REQUIRED: 'RECHECK_REQUIRED' } as const)[safeResult.status] || 'RECHECK_REQUIRED';
      if (next === 'READY' && !eligible(offer)) next = 'RECHECK_REQUIRED';
      if (next === 'READY' && manual(offer)) next = 'NEEDS_ACTION';
      if (next === 'READY' && offer.authority.sellability !== 'BOOKABLE') next = 'RECHECK_REQUIRED';
      if (next === 'READY' && previous === 'PRICE_CHANGED' && target.item.configuration.acceptedPriceMinor !== safeResult.newPriceMinor) next = 'PRICE_CHANGED';
      target.item.state = next; target.item.unitSellingPriceMinor = safeResult.newPriceMinor; target.item.lastRevalidatedAt = this.now();
      const revalidationId = randomUUID(); target.revalidationRecordId = revalidationId;
      current.revision++; current.updatedAt = this.now(); current.bucket.updatedAt = current.updatedAt;
      await r.revalidations.put({ ...this.base(context, revalidationId), tripBucketId: tripId, tripItemId: itemId, offerSnapshotId: selected.offerSnapshotId,
        result: safeResult, validUntil: offer.snapshot.validUntil!, correlationId, ...(failure ? { errorCategory: failure } : {}) });
      await r.trips.put(current); await this.audit(r, context, current, 'trip.revalidate', previous, next, correlationId, offer.snapshot.supplierId, failure);
      return current;
    });
    backendTelemetry({ requestId: requestCorrelationId(metadata.correlationId), supplierAdapter: offer.snapshot.supplierId, operation: 'trip.revalidate', status: safeResult.status, latencyMs: Date.now() - started, errorCategory: failure }, this.options.telemetry);
    return output;
  }

  async createBookingIntent(context: SecurityContext, tripId: string, metadata: MutationMetadata): Promise<BookingRecord> {
    return this.mutate(context, 'booking.intent', { tripId }, metadata, async (r, correlationId) => {
      const trip = await r.trips.get(tripId); if (!trip) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, trip);
      const existing = (await r.bookings.list(context.userId)).find(booking => booking.tripBucketId === tripId && !['FAILED','EXPIRED','CANCELLED'].includes(booking.group.overallFulfillmentStatus));
      if (existing) return existing;
      if (trip.bucket.status !== 'ACTIVE' || !trip.items.length) throw new ReadinessError('TRIP_NOT_READY');
      const offers: OfferReferenceRecord[] = [];
      for (const selected of trip.items) {
        const offer = await r.offers.get(selected.offerSnapshotId); if (!offer || !eligible(offer)) throw new ReadinessError('DEMO_OR_UNVERIFIED_BOOKING_BLOCKED');
        if (!Number.isFinite(Date.parse(offer.snapshot.validUntil || '')) || Date.parse(offer.snapshot.validUntil || '') <= (this.options.now || Date.now)()) throw new ReadinessError('OFFER_STALE');
        if (!manual(offer)) {
          const evidence = selected.revalidationRecordId ? await r.revalidations.get(selected.revalidationRecordId) : undefined;
          const checked = Date.parse(selected.item.lastRevalidatedAt);
          if (selected.item.state !== 'READY' || !Number.isFinite(checked) || checked > (this.options.now || Date.now)() + 5000 || (this.options.now || Date.now)() - checked > 300000 ||
            !evidence || evidence.ownerId !== trip.ownerId || evidence.offerSnapshotId !== selected.offerSnapshotId || evidence.tripItemId !== selected.item.id || evidence.result.status !== 'UNCHANGED' || evidence.result.newPriceMinor !== selected.item.unitSellingPriceMinor) throw new ReadinessError('REVALIDATION_REQUIRED');
        }
        if (manual(offer) && selected.item.state !== 'NEEDS_ACTION') throw new ReadinessError('MANUAL_REVIEW_REQUIRED');
        offers.push(offer);
      }
      const total = trip.items.reduce((sum, selected) => sum + selected.item.unitSellingPriceMinor, 0);
      if (!Number.isSafeInteger(total) || total <= 0 || trip.items.some(item => item.item.currency !== trip.bucket.currency || item.item.unitSellingPriceMinor <= 0)) throw new ReadinessError('INVALID_BOOKING_TOTAL');
      const id = randomUUID(), bookingReference = 'VCT-' + id.replace(/-/g, '').slice(0, 16).toUpperCase();
      const hasManual = offers.some(manual);
      const items = trip.items.map((selected, i) => ({ id: randomUUID(), bookingGroupId: id, vacatinaBookingReference: bookingReference,
        canonicalOfferId: selected.item.canonicalOfferId, productType: selected.item.productType, supplierId: offers[i].snapshot.supplierId,
        providerId: offers[i].snapshot.supplierId, sourceOfferId: String(offers[i].snapshot.snapshotData.sourceOfferId), isUpstreamConfirmed: false,
        title: selected.item.title, bookingMode: selected.item.bookingMode, itemPriceMinor: selected.item.unitSellingPriceMinor,
        currency: selected.item.currency, fulfillmentStatus: 'PENDING' as const, inventorySourceType: selected.item.sourceType }));
      const booking: BookingRecord = { ...this.base(context, id), tripBucketId: trip.id, group: { id, bookingReference, userId: context.userId,
        organizationId: context.organizationId, checkoutSessionId: trip.bucket.sessionId, totalSellingPriceMinor: total, currency: trip.bucket.currency,
        paymentStatus: 'UNPAID', overallFulfillmentStatus: hasManual ? 'MANUAL_REVIEW' : 'PENDING_REVALIDATION', createdAt: this.now() }, items,
        selections: trip.items.map((selected, i) => ({ tripItemId: selected.item.id, offerSnapshotId: selected.offerSnapshotId, bookingItemId: items[i].id, revalidationRecordId: selected.revalidationRecordId, configuration: selected.item.configuration })), confirmations: {}, revision: 1 };
      await r.bookings.put(booking);
      for (let i = 0; i < items.length; i++) if (manual(offers[i])) await this.queue(r, context, booking, 'MANUAL_CONFIRMATION', correlationId, items[i].id);
      trip.bucket.status = 'CHECKED_OUT'; trip.revision++; trip.updatedAt = this.now(); trip.bucket.updatedAt = trip.updatedAt; await r.trips.put(trip);
      await this.audit(r, context, booking, 'booking.intent', 'NONE', booking.group.overallFulfillmentStatus, correlationId);
      return booking;
    });
  }

  private async queue(r: ReadinessRepositories, context: SecurityContext, booking: BookingRecord, kind: OperationKind, correlationId: string, bookingItemId?: string, paymentId?: string, amountMinor?: number): Promise<OperationalRequestRecord> {
    const id = 'operation_' + hash([booking.id, kind, bookingItemId, paymentId]).slice(0, 48);
    const existing = await r.operations.get(id); if (existing) return existing; // Business-level duplicate protection across different retry keys.
    const operation: OperationalRequestRecord = { id, ownerId: booking.ownerId, organizationId: booking.organizationId, createdAt: this.now(), updatedAt: this.now(), bookingId: booking.id, bookingItemId, paymentId, kind, correlationId, amountMinor,
      ticket: { id, ticketReference: id, userId: booking.ownerId, organizationId: booking.organizationId, bookingGroupId: booking.id, category: kind,
        priority: 'HIGH', status: 'OPEN', subject: kind + ' requires authoritative processing', createdAt: this.now() } };
    await r.operations.put(operation);
    await r.commands.put({ id, ownerId: booking.ownerId, organizationId: booking.organizationId, createdAt: this.now(), updatedAt: this.now(),
      eventType: kind, aggregateType: 'booking', aggregateId: booking.id, payload: { bookingId: booking.id, operationId: id },
      status: 'PENDING', retryCount: 0, scheduledAt: this.now(), correlationId });
    await this.audit(r, context, operation, kind + '.request', 'NONE', 'OPEN', correlationId);
    return operation;
  }

  async approveManualRequest(context: SecurityContext, operationId: string, evidenceId: string, metadata: MutationMetadata): Promise<OperationalRequestRecord> {
    reference(evidenceId);
    return this.mutate(context, 'manual.approve', { operationId, evidenceId }, metadata, async (r, correlationId) => {
      const operation = await r.operations.get(operationId); if (!operation) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, operation);
      if (operation.ownerId === context.userId) throw new ReadinessError('MANUAL_SELF_APPROVAL_FORBIDDEN', 403);
      const previous = operation.ticket.status;
      if (operation.kind !== 'MANUAL_CONFIRMATION' || !['OPEN','PENDING_SUPPLIER'].includes(previous)) throw new ReadinessError('MANUAL_REQUEST_NOT_OPEN');
      operation.evidenceId = evidenceId; operation.ticket.status = 'PENDING_SUPPLIER'; operation.ticket.assignedAgentId = context.userId; operation.updatedAt = this.now();
      await r.operations.put(operation); await this.audit(r, context, operation, 'manual.approve', previous, 'PENDING_SUPPLIER', correlationId); return operation;
    });
  }

  async createPaymentReference(context: SecurityContext, bookingId: string, gateway: PaymentOrderEntity['gatewayId'], metadata: MutationMetadata): Promise<PaymentReferenceRecord> {
    return this.mutate(context, 'payment.intent', { bookingId, gateway }, metadata, async (r, correlationId) => {
      const booking = await r.bookings.get(bookingId); if (!booking) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, booking);
      if (!['STRIPE','PAYPAL','PAYHERE'].includes(gateway)) throw new ReadinessError('PAYMENT_PROVIDER_NOT_APPROVED');
      if (!['PENDING_REVALIDATION','MANUAL_REVIEW'].includes(booking.group.overallFulfillmentStatus) || booking.group.paymentStatus !== 'UNPAID') throw new ReadinessError('BOOKING_NOT_PAYABLE');
      const manuals = (await r.operations.list(booking.ownerId)).filter(op => op.bookingId === bookingId && op.kind === 'MANUAL_CONFIRMATION');
      if (manuals.some(op => !op.evidenceId || op.ticket.status !== 'PENDING_SUPPLIER')) throw new ReadinessError('MANUAL_APPROVAL_REQUIRED');
      const existing = (await r.payments.list(booking.ownerId)).find(payment => payment.bookingId === bookingId && ['PENDING','AUTHORIZED','CAPTURED'].includes(payment.order.status));
      if (existing) { if (existing.order.gatewayId !== gateway) throw new ReadinessError('PAYMENT_ALREADY_PENDING'); return existing; }
      for (const selected of booking.selections) {
        const snapshot = await r.offers.get(selected.offerSnapshotId);
        if (!snapshot || !Number.isFinite(Date.parse(snapshot.snapshot.validUntil || '')) || Date.parse(snapshot.snapshot.validUntil || '') <= (this.options.now || Date.now)()) throw new ReadinessError('OFFER_STALE');
        if (!manual(snapshot)) {
          const evidence = selected.revalidationRecordId ? await r.revalidations.get(selected.revalidationRecordId) : undefined;
          if (!evidence || evidence.result.status !== 'UNCHANGED' || (this.options.now || Date.now)() - Date.parse(evidence.createdAt) > 300000) throw new ReadinessError('REVALIDATION_REQUIRED');
        }
      }
      if (manuals.some(op => (this.options.now || Date.now)() - Date.parse(op.updatedAt) > 300000)) throw new ReadinessError('MANUAL_APPROVAL_EXPIRED');
      const id = randomUUID(); const payment: PaymentReferenceRecord = { ...this.base(context, id), bookingId,
        order: { id, bookingGroupId: bookingId, organizationId: booking.organizationId, gatewayId: gateway, amountMinor: booking.group.totalSellingPriceMinor,
          currency: booking.group.currency, status: 'PENDING', idempotencyKey: 'payment_' + id, createdAt: this.now() } };
      await r.payments.put(payment); await this.queue(r, context, booking, 'PAYMENT_INITIATION', correlationId, undefined, id);
      await this.audit(r, context, payment, 'payment.intent', 'NONE', 'PENDING', correlationId);
      return payment; // No hosted checkout URL, secret, external charge, or simulated authorization.
    });
  }

  async reconcilePayment(context: SecurityContext, paymentId: string, notificationReference: string, metadata: MutationMetadata): Promise<PaymentReferenceRecord> {
    reference(notificationReference);
    const saved = await this.persistence.transaction(async r => { const record = await r.payments.get(paymentId); if (!record) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, record, 'finance:reconcile_gateway'); return record; });
    const replay = await this.replay<PaymentReferenceRecord>(context, 'payment.reconcile', { paymentId, notificationReference }, metadata);
    if (replay) return replay;
    if (!this.options.verifyPayment) throw new ReadinessError('PAYMENT_VERIFIER_NOT_CONFIGURED', 503);
    let proof: VerifiedPaymentEvidence;
    try { proof = await this.options.verifyPayment(saved, notificationReference); }
    catch { throw new ReadinessError('PAYMENT_VERIFICATION_UNAVAILABLE', 503); }
    reference(proof.eventId); reference(proof.providerReference);
    if (proof.amountMinor !== saved.order.amountMinor || typeof proof.currency !== 'string' || proof.currency.toUpperCase() !== saved.order.currency || !['AUTHORIZED','CAPTURED','FAILED'].includes(proof.status)) throw new ReadinessError('PAYMENT_EVIDENCE_MISMATCH');
    return this.mutate(context, 'payment.reconcile', { paymentId, notificationReference }, metadata, async (r, correlationId) => {
      const payment = (await r.payments.get(paymentId))!; operator(context, payment, 'finance:reconcile_gateway');
      const receiptId = hash(['provider.receipt', payment.order.gatewayId, proof.eventId]);
      const receiptHash = hash([payment.id, proof.providerReference, proof.amountMinor, proof.currency.toUpperCase(), proof.status]);
      const receipt = await r.idempotency.get(receiptId);
      if (receipt) {
        if (receipt.requestHash !== receiptHash) throw new ReadinessError('DUPLICATE_PROVIDER_EVENT');
        return payment;
      }
      await r.idempotency.put({ id: receiptId, ownerId: payment.ownerId, organizationId: payment.organizationId, createdAt: this.now(), updatedAt: this.now(), scope: 'provider.receipt', requestHash: receiptHash, result: { paymentId: payment.id, status: proof.status } });
      if (payment.order.status === 'CAPTURED' || payment.verifiedEventId === proof.eventId) return payment;
      if (['REFUNDED','VOIDED','FAILED'].includes(payment.order.status)) throw new ReadinessError('TERMINAL_PAYMENT_STATE');
      const booking = (await r.bookings.get(payment.bookingId))!;
      // A settlement is authoritative. A later/out-of-order failure must never
      // downgrade captured money or a confirmed booking.
      if (proof.status !== 'CAPTURED' && booking.group.paymentStatus === 'SETTLED') return payment;
      const previous = payment.order.status; payment.order.status = proof.status; payment.providerReference = proof.providerReference;
      payment.verifiedEventId = proof.eventId; payment.verifiedAt = this.now(); payment.updatedAt = this.now();
      if (proof.status === 'CAPTURED') { payment.order.settledAt = this.now(); booking.group.paymentStatus = 'SETTLED'; }
      if (proof.status === 'AUTHORIZED') booking.group.paymentStatus = 'AUTHORIZED';
      if (proof.status === 'CAPTURED' && ['PENDING_REVALIDATION','MANUAL_REVIEW'].includes(booking.group.overallFulfillmentStatus)) Object.assign(booking, transitionBooking(booking, 'BOOKING'));
      if (proof.status === 'FAILED') {
        booking.group.paymentStatus = 'UNPAID';
        if (['PENDING_REVALIDATION','BOOKING','MANUAL_REVIEW','PARTIAL_FAILURE'].includes(booking.group.overallFulfillmentStatus)) {
          Object.assign(booking, transitionBooking(booking, 'MANUAL_REVIEW'));
        }
      }
      booking.updatedAt = this.now(); await r.payments.put(payment); await r.bookings.put(booking);
      await this.audit(r, context, payment, 'payment.reconcile', previous, proof.status, correlationId);
      return payment;
    });
  }

  async queueSupplierBooking(context: SecurityContext, bookingId: string, itemId: string, metadata: MutationMetadata): Promise<OperationalRequestRecord> {
    return this.mutate(context, 'supplier.request', { bookingId, itemId }, metadata, async (r, correlationId) => {
      const booking = await r.bookings.get(bookingId); if (!booking) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, booking);
      const item = booking.items.find(item => item.id === itemId);
      if (!item || item.bookingMode !== 'INSTANT_BOOK' || booking.group.overallFulfillmentStatus !== 'BOOKING' || booking.group.paymentStatus !== 'SETTLED') throw new ReadinessError('SUPPLIER_REQUEST_NOT_READY');
      return this.queue(r, context, booking, 'SUPPLIER_BOOKING', correlationId, itemId);
    });
  }

  async confirmItem(context: SecurityContext, operationId: string, input: { reference: string; evidenceId: string; kind: 'SUPPLIER' | 'MANUAL' }, metadata: MutationMetadata): Promise<BookingRecord> {
    reference(input.reference); reference(input.evidenceId);
    return this.mutate(context, 'booking.confirm-item', { operationId, ...input }, metadata, async (r, correlationId) => {
      const operation = await r.operations.get(operationId); if (!operation) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, operation);
      const booking = (await r.bookings.get(operation.bookingId))!, item = booking.items.find(item => item.id === operation.bookingItemId);
      if (input.kind === 'MANUAL' && operation.ownerId === context.userId) throw new ReadinessError('MANUAL_SELF_APPROVAL_FORBIDDEN', 403);
      if (!item || booking.group.paymentStatus !== 'SETTLED' || !['BOOKING','MANUAL_REVIEW','PARTIAL_FAILURE'].includes(booking.group.overallFulfillmentStatus)) throw new ReadinessError('CONFIRMATION_NOT_READY');
      if ((input.kind === 'MANUAL' && (operation.kind !== 'MANUAL_CONFIRMATION' || !operation.evidenceId)) ||
        (input.kind === 'SUPPLIER' && (operation.kind !== 'SUPPLIER_BOOKING' || item.bookingMode !== 'INSTANT_BOOK'))) throw new ReadinessError('CONFIRMATION_KIND_MISMATCH');
      if (booking.confirmations[item.id]) throw new ReadinessError('ALREADY_CONFIRMED');
      item.fulfillmentStatus = 'CONFIRMED'; item.isUpstreamConfirmed = input.kind === 'SUPPLIER'; item.confirmedAt = this.now();
      if (input.kind === 'SUPPLIER') item.supplierBookingReference = input.reference; else item.vacatinaServiceReference = input.reference;
      booking.confirmations[item.id] = { ...input, actorId: context.userId, confirmedAt: this.now() };
      operation.reference = input.reference; operation.ticket.status = 'RESOLVED'; operation.updatedAt = this.now();
      const previous = booking.group.overallFulfillmentStatus;
      if (booking.items.every(item => item.fulfillmentStatus === 'CONFIRMED')) { Object.assign(booking, transitionBooking(booking, 'CONFIRMED')); booking.group.confirmedAt = this.now(); }
      else booking.revision++;
      booking.updatedAt = this.now(); await r.operations.put(operation); await r.bookings.put(booking);
      const command = await r.commands.get(operationId); if (command) { command.status = 'PUBLISHED'; command.publishedAt = this.now(); command.updatedAt = this.now(); await r.commands.put(command); }
      await this.audit(r, context, booking, 'booking.confirm-item', previous, booking.group.overallFulfillmentStatus, correlationId, item.supplierId); return booking;
    });
  }

  async recordOperationFailure(context: SecurityContext, operationId: string, category: FailureCategory, metadata: MutationMetadata): Promise<BookingRecord> {
    if (!['SUPPLIER_TIMEOUT','SUPPLIER_REJECTED','OUTCOME_UNKNOWN','PAYMENT_INITIATION_FAILED'].includes(category)) throw new ReadinessError('INVALID_FAILURE_CATEGORY', 400);
    return this.mutate(context, 'operation.failure', { operationId, category }, metadata, async (r, correlationId) => {
      const operation = await r.operations.get(operationId); if (!operation) throw new ReadinessError('RESOURCE_NOT_FOUND', 404);
      operator(context, operation, operation.kind === 'PAYMENT_INITIATION' ? 'finance:reconcile_gateway' : 'ops:reconcile_booking');
      if (['RESOLVED','CLOSED'].includes(operation.ticket.status)) throw new ReadinessError('OPERATION_ALREADY_RESOLVED');
      const booking = (await r.bookings.get(operation.bookingId))!, previous = booking.group.overallFulfillmentStatus;
      operation.errorCategory = category; operation.ticket.status = 'PENDING_SUPPLIER'; operation.updatedAt = this.now();
      const next: BookingOverallStatus = booking.items.some(item => item.fulfillmentStatus === 'CONFIRMED') ? 'PARTIAL_FAILURE' : 'MANUAL_REVIEW';
      Object.assign(booking, transitionBooking(booking, next)); booking.updatedAt = this.now();
      const command = await r.commands.get(operationId); if (command) { command.status = 'FAILED'; command.retryCount++; command.updatedAt = this.now(); await r.commands.put(command); }
      await r.operations.put(operation); await r.bookings.put(booking);
      await this.audit(r, context, booking, 'operation.failure', previous, next, correlationId, undefined, category); return booking;
    });
  }

  async requestCancellation(context: SecurityContext, bookingId: string, metadata: MutationMetadata): Promise<OperationalRequestRecord> {
    return this.mutate(context, 'booking.cancel-request', { bookingId }, metadata, async (r, correlationId) => {
      const booking = await r.bookings.get(bookingId); if (!booking) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); owner(context, booking);
      const previous = booking.group.overallFulfillmentStatus; Object.assign(booking, transitionBooking(booking, 'CANCEL_PENDING')); booking.updatedAt = this.now();
      const operation = await this.queue(r, context, booking, 'CANCELLATION', correlationId); await r.bookings.put(booking);
      await this.audit(r, context, booking, 'booking.cancel-request', previous, 'CANCEL_PENDING', correlationId); return operation;
    });
  }

  async requestRefund(context: SecurityContext, bookingId: string, paymentId: string, amountMinor: number, metadata: MutationMetadata): Promise<OperationalRequestRecord> {
    return this.mutate(context, 'booking.refund-request', { bookingId, paymentId, amountMinor }, metadata, async (r, correlationId) => {
      const booking = await r.bookings.get(bookingId), payment = await r.payments.get(paymentId);
      if (!booking || !payment || payment.bookingId !== bookingId) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, booking, 'finance:authorize_refund');
      if (payment.order.status !== 'CAPTURED' || !payment.verifiedEventId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > payment.order.amountMinor) throw new ReadinessError('REFUND_NOT_ELIGIBLE');
      const operation = await this.queue(r, context, booking, 'REFUND', correlationId, undefined, paymentId, amountMinor);
      if (operation.amountMinor !== amountMinor) throw new ReadinessError('REFUND_ALREADY_PENDING');
      const previous = booking.group.overallFulfillmentStatus; Object.assign(booking, transitionBooking(booking, 'REFUND_PENDING'));
      booking.updatedAt = this.now(); await r.bookings.put(booking);
      await this.audit(r, context, booking, 'booking.refund-request', previous, 'REFUND_PENDING', correlationId); return operation;
    });
  }

  async completeCancellation(context: SecurityContext, operationId: string, evidenceId: string, metadata: MutationMetadata): Promise<BookingRecord> {
    reference(evidenceId);
    return this.mutate(context, 'booking.cancel-confirm', { operationId, evidenceId }, metadata, async (r, correlationId) => {
      const operation = await r.operations.get(operationId); if (!operation) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, operation);
      if (operation.kind !== 'CANCELLATION') throw new ReadinessError('CANCELLATION_REQUEST_REQUIRED');
      const booking = (await r.bookings.get(operation.bookingId))!, previous = booking.group.overallFulfillmentStatus;
      Object.assign(booking, transitionBooking(booking, 'CANCELLED'));
      booking.items.forEach(item => { item.fulfillmentStatus = 'CANCELLED'; }); booking.updatedAt = this.now();
      operation.evidenceId = evidenceId; operation.ticket.status = 'RESOLVED'; operation.updatedAt = this.now();
      await r.operations.put(operation); await r.bookings.put(booking);
      const command = await r.commands.get(operationId); if (command) { command.status = 'PUBLISHED'; command.updatedAt = this.now(); command.publishedAt = this.now(); await r.commands.put(command); }
      await this.audit(r, context, booking, 'booking.cancel-confirm', previous, 'CANCELLED', correlationId); return booking;
    });
  }

  async progressFulfilment(context: SecurityContext, bookingId: string, next: 'FULFILMENT_PENDING' | 'FULFILLED', evidenceId: string, metadata: MutationMetadata): Promise<BookingRecord> {
    reference(evidenceId);
    return this.mutate(context, 'booking.fulfilment', { bookingId, next, evidenceId }, metadata, async (r, correlationId) => {
      const booking = await r.bookings.get(bookingId); if (!booking) throw new ReadinessError('RESOURCE_NOT_FOUND', 404); operator(context, booking);
      const previous = booking.group.overallFulfillmentStatus; Object.assign(booking, transitionBooking(booking, next)); booking.updatedAt = this.now();
      const operation = await this.queue(r, context, booking, 'FULFILMENT', correlationId);
      operation.ticket.status = next === 'FULFILLED' ? 'RESOLVED' : 'INVESTIGATING'; operation.evidenceId = evidenceId; operation.updatedAt = this.now();
      await r.operations.put(operation);
      const command = await r.commands.get(operation.id);
      if (command) { command.status = next === 'FULFILLED' ? 'PUBLISHED' : 'PROCESSING'; command.updatedAt = this.now(); if (next === 'FULFILLED') command.publishedAt = this.now(); await r.commands.put(command); }
      await r.bookings.put(booking); await this.audit(r, context, booking, 'booking.fulfilment', previous, next, correlationId); return booking;
    });
  }
}
