import type { ReadinessRecords, ReadinessRepositories, ReadinessUnitOfWork } from './readiness-contracts.ts';
import { ReadinessError } from './readiness-contracts.ts';

export const READINESS_TABLES = {
  searches: 'vacatina_search_contexts', offers: 'vacatina_offer_references', trips: 'vacatina_trip_aggregates',
  bookings: 'vacatina_booking_aggregates', revalidations: 'vacatina_revalidation_records', operations: 'vacatina_operation_requests',
  payments: 'vacatina_payment_references', events: 'vacatina_backend_events', commands: 'vacatina_backend_outbox', idempotency: 'vacatina_mutation_keys'
} as const;
type Collection = keyof ReadinessRecords;
const collections = [...Object.keys(READINESS_TABLES), 'enquiries'] as Collection[];
const clone = <T>(value: T): T => structuredClone(value);
const immutable = new Set<Collection>(['searches', 'offers', 'revalidations', 'events', 'idempotency']);

function validateIdentity(record: { id: string; ownerId: string }): void {
  if (!record.id || !record.ownerId || record.id.length > 200 || record.ownerId.length > 200) throw new ReadinessError('INVALID_PERSISTENCE_ID', 400);
}

function validateMemoryRelations(name: Collection, record: any, state: Record<Collection, Map<string, any>>): void {
  const related = (collection: Collection, id: string) => {
    const value = state[collection].get(id);
    if (!value || value.ownerId !== record.ownerId) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
    return value;
  };
  if (name === 'offers' && record.searchContextId) related('searches', record.searchContextId);
  if (name === 'trips') {
    if (record.bucket.id !== record.id || record.bucket.userId !== record.ownerId || record.revision < 1) throw new ReadinessError('INVALID_AGGREGATE');
    const ids = new Set();
    for (const selected of record.items) {
      const offer = related('offers', selected.offerSnapshotId);
      if (selected.item.tripBucketId !== record.id || offer.snapshot.canonicalOfferId !== selected.item.canonicalOfferId || ids.has(selected.item.canonicalOfferId)) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
      ids.add(selected.item.canonicalOfferId);
    }
  }
  if (name === 'bookings') {
    const trip = related('trips', record.tripBucketId);
    if (record.group.id !== record.id || record.group.userId !== record.ownerId || record.revision < 1 || record.group.totalSellingPriceMinor !== record.items.reduce((sum, item) => sum + item.itemPriceMinor, 0)) throw new ReadinessError('INVALID_AGGREGATE');
    for (const selected of record.selections) {
      related('offers', selected.offerSnapshotId);
      if (!trip.items.some(item => item.item.id === selected.tripItemId) || !record.items.some(item => item.id === selected.bookingItemId)) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
    }
    const previous = state.bookings.get(record.id);
    if (previous && JSON.stringify(previous.selections) !== JSON.stringify(record.selections)) throw new ReadinessError('IMMUTABLE_SELECTION_CONFLICT');
    if (!['FAILED','EXPIRED','CANCELLED'].includes(record.group.overallFulfillmentStatus) && [...state.bookings.values()].some(booking => booking.id !== record.id && booking.tripBucketId === record.tripBucketId && !['FAILED','EXPIRED','CANCELLED'].includes(booking.group.overallFulfillmentStatus))) throw new ReadinessError('DUPLICATE_BOOKING');
  }
  if (name === 'revalidations') {
    const trip = related('trips', record.tripBucketId); related('offers', record.offerSnapshotId);
    if (!trip.items.some(item => item.item.id === record.tripItemId)) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
  }
  if (name === 'payments') {
    const booking = related('bookings', record.bookingId);
    if (record.order.id !== record.id || record.order.bookingGroupId !== record.bookingId || record.order.amountMinor !== booking.group.totalSellingPriceMinor || record.order.currency !== booking.group.currency || !['STRIPE','PAYPAL','PAYHERE'].includes(record.order.gatewayId)) throw new ReadinessError('PAYMENT_BOOKING_MISMATCH');
    for (const other of state.payments.values()) if (other.id !== record.id) {
      if (other.bookingId === record.bookingId && ['PENDING','AUTHORIZED','CAPTURED'].includes(other.order.status) && ['PENDING','AUTHORIZED','CAPTURED'].includes(record.order.status)) throw new ReadinessError('DUPLICATE_PAYMENT');
      if (other.order.gatewayId === record.order.gatewayId && ((record.providerReference && other.providerReference === record.providerReference) || (record.verifiedEventId && other.verifiedEventId === record.verifiedEventId))) throw new ReadinessError('DUPLICATE_PROVIDER_REFERENCE');
    }
  }
  if (name === 'operations') {
    const booking = related('bookings', record.bookingId);
    if (record.bookingItemId && !booking.items.some(item => item.id === record.bookingItemId)) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
    if (record.paymentId && related('payments', record.paymentId).bookingId !== record.bookingId) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
  }
  if (name === 'enquiries') related('trips', record.tripId);
  if (name === 'commands') {
    if (record.aggregateType === 'enquiry') related('enquiries', record.aggregateId);
    else { related('bookings', record.aggregateId); related('operations', record.id); }
  }
}

/** The same repository contract as PostgreSQL, including rollback and serialized concurrent mutations. */
export class MemoryReadinessUnitOfWork implements ReadinessUnitOfWork {
  readonly engine = 'MEMORY_TEST' as const;
  private state = Object.fromEntries(collections.map(name => [name, new Map()])) as Record<Collection, Map<string, any>>;
  private queue: Promise<unknown> = Promise.resolve();
  exportSnapshot(): Record<string, unknown[]> { return clone(Object.fromEntries(collections.map(name => [name, [...this.state[name].values()]]))); }
  restoreSnapshot(snapshot: Record<string, unknown[]>): void {
    if (!snapshot || typeof snapshot !== 'object' || collections.some(name => !Array.isArray(snapshot[name]))) throw new ReadinessError('INVALID_PERSISTENCE_SNAPSHOT');
    this.state = Object.fromEntries(collections.map(name => [name, new Map(snapshot[name].map((record: any) => {
      validateIdentity(record); return [record.id, clone(record)];
    }))])) as typeof this.state;
  }
  transaction<T>(operation: (repositories: ReadinessRepositories) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const draft = clone(this.state);
      const repositories = Object.fromEntries(collections.map(name => [name, {
        get: async (id: string) => clone(draft[name].get(id)),
         list: async (ownerId: string) => clone([...draft[name].values()].filter(record => record.ownerId === ownerId)),
         listByTenant: async (organizationId: string) => {
           if (!organizationId) throw new ReadinessError('TENANT_REQUIRED',403);
           return clone([...draft[name].values()].filter(record => record.organizationId === organizationId));
         },
        put: async (record: ReadinessRecords[Collection]) => {
          validateIdentity(record);
          const before = draft[name].get(record.id);
          if (before && (immutable.has(name) || before.ownerId !== record.ownerId)) throw new ReadinessError('IMMUTABLE_RECORD_CONFLICT');
          validateMemoryRelations(name, record, draft);
          draft[name].set(record.id, clone(record));
        }
      }])) as ReadinessRepositories;
      const result = await operation(repositories);
      this.state = draft;
      return clone(result);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

export interface ReadinessSqlClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number }>;
  release(): void;
}
export interface ReadinessSqlPool { connect(): Promise<ReadinessSqlClient>; }
export interface PostgresReadinessApproval { writesEnabled: boolean; migrationApproved: boolean; clerkRotationConfirmed: boolean; }

/** No pool is created, no migration is run, and no environment credentials are loaded here. */
export class PostgresReadinessUnitOfWork implements ReadinessUnitOfWork {
  readonly engine = 'POSTGRES' as const;
  private pool: ReadinessSqlPool;
  private approval: PostgresReadinessApproval;
  constructor(pool: ReadinessSqlPool, approval: PostgresReadinessApproval) { this.pool = pool; this.approval = approval; }

  async transaction<T>(operation: (repositories: ReadinessRepositories) => Promise<T>): Promise<T> {
    if (!this.approval.writesEnabled || !this.approval.migrationApproved || !this.approval.clerkRotationConfirmed) throw new ReadinessError('PRODUCTION_PERSISTENCE_NOT_APPROVED', 503);
    let client: ReadinessSqlClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // Coarse-grained safety first: serializes claims before an idempotency row exists.
      // Scale-out/per-aggregate lock partitioning is a separate load-tested launch gate.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['vacatina-readiness-v3']);
      const repositories = Object.fromEntries(collections.map(name => [name, {
        get: async (id: string) => {
          if (name === 'enquiries') throw new ReadinessError('ENQUIRY_SCHEMA_NOT_QUALIFIED',503);
          return (await client!.query(`SELECT payload FROM ${READINESS_TABLES[name]} WHERE id = $1 FOR UPDATE`, [id])).rows[0]?.payload;
        },
        list: async (ownerId: string) => {
          if (name === 'enquiries') throw new ReadinessError('ENQUIRY_SCHEMA_NOT_QUALIFIED',503);
          return (await client!.query(`SELECT payload FROM ${READINESS_TABLES[name]} WHERE owner_id = $1 ORDER BY id FOR UPDATE`, [ownerId])).rows.map(row => row.payload);
        },
        listByTenant: async (organizationId: string) => {
          if (name === 'enquiries') throw new ReadinessError('ENQUIRY_SCHEMA_NOT_QUALIFIED',503);
          if (!organizationId) throw new ReadinessError('TENANT_REQUIRED',403);
          return (await client!.query(`SELECT payload FROM ${READINESS_TABLES[name]} WHERE payload->>'organizationId' = $1 ORDER BY id FOR UPDATE`,[organizationId])).rows.map(row=>row.payload);
        },
         put: async (record: any) => {
          if (name === 'enquiries') throw new ReadinessError('ENQUIRY_SCHEMA_NOT_QUALIFIED', 503);
          validateIdentity(record);
          const fields: Record<string, unknown> = { id: record.id, owner_id: record.ownerId, payload: JSON.stringify(record) };
          if (name === 'offers') Object.assign(fields, { search_context_id: record.searchContextId || null, canonical_offer_id: record.snapshot.canonicalOfferId, supplier_id: record.snapshot.supplierId, environment_class: record.authority.environmentClass, sellability: record.authority.sellability });
          if (name === 'trips') Object.assign(fields, { status: record.bucket.status, revision: record.revision });
          if (name === 'bookings') Object.assign(fields, { trip_bucket_id: record.tripBucketId, status: record.group.overallFulfillmentStatus, payment_status: record.group.paymentStatus, revision: record.revision, amount_minor: record.group.totalSellingPriceMinor, currency: record.group.currency });
          if (name === 'revalidations') Object.assign(fields, { trip_bucket_id: record.tripBucketId, trip_item_id: record.tripItemId, offer_reference_id: record.offerSnapshotId, status: record.result.status, correlation_id: record.correlationId });
          if (name === 'operations') Object.assign(fields, { booking_id: record.bookingId, booking_item_id: record.bookingItemId || null, payment_id: record.paymentId || null, kind: record.kind, status: record.ticket.status });
          if (name === 'payments') Object.assign(fields, { booking_id: record.bookingId, status: record.order.status, gateway_id: record.order.gatewayId, provider_reference: record.providerReference || null, verified_event_id: record.verifiedEventId || null, request_key: record.order.idempotencyKey, amount_minor: record.order.amountMinor, currency: record.order.currency });
          if (name === 'events') Object.assign(fields, { correlation_id: record.correlationId, operation: record.operation });
          if (name === 'commands') Object.assign(fields, { aggregate_id: record.aggregateId, status: record.status });
          if (name === 'idempotency') Object.assign(fields, { scope: record.scope, request_hash: record.requestHash });
          const keys = Object.keys(fields), values = Object.values(fields);
          const conflict = immutable.has(name) ? '' : ` ON CONFLICT (id) DO UPDATE SET ${keys.filter(key => !['id', 'owner_id'].includes(key)).map(key => `${key} = EXCLUDED.${key}`).join(', ')}, updated_at = now() WHERE ${READINESS_TABLES[name]}.owner_id = EXCLUDED.owner_id`;
          const result = await client!.query(`INSERT INTO ${READINESS_TABLES[name]} (${keys.join(', ')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')})${conflict}`, values);
          if (result.rowCount === 0) throw new ReadinessError('IMMUTABLE_RECORD_CONFLICT');
          if (name === 'trips') {
            for (const selected of record.items) {
              const selectedRow = await client!.query(`INSERT INTO vacatina_trip_selections (id, owner_id, trip_bucket_id, offer_reference_id, canonical_offer_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET offer_reference_id = EXCLUDED.offer_reference_id, updated_at = now() WHERE vacatina_trip_selections.trip_bucket_id = EXCLUDED.trip_bucket_id AND vacatina_trip_selections.owner_id = EXCLUDED.owner_id`, [selected.item.id, record.ownerId, record.id, selected.offerSnapshotId, selected.item.canonicalOfferId]);
              if (selectedRow.rowCount === 0) throw new ReadinessError('REFERENCE_INTEGRITY_VIOLATION');
            }
          }
          if (name === 'bookings') {
            for (const selected of record.selections) {
              const selectedRow = await client!.query('INSERT INTO vacatina_booking_selections (booking_id, booking_item_id, owner_id, trip_bucket_id, trip_item_id, offer_reference_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (booking_id, booking_item_id) DO UPDATE SET booking_id = EXCLUDED.booking_id WHERE vacatina_booking_selections.trip_item_id = EXCLUDED.trip_item_id AND vacatina_booking_selections.offer_reference_id = EXCLUDED.offer_reference_id AND vacatina_booking_selections.owner_id = EXCLUDED.owner_id AND vacatina_booking_selections.trip_bucket_id = EXCLUDED.trip_bucket_id', [record.id, selected.bookingItemId, record.ownerId, record.tripBucketId, selected.tripItemId, selected.offerSnapshotId]);
              if (selectedRow.rowCount === 0) throw new ReadinessError('IMMUTABLE_SELECTION_CONFLICT');
            }
          }
        }
      }])) as ReadinessRepositories;
      const output = await operation(repositories);
      await client.query('COMMIT');
      return output;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      if (error instanceof ReadinessError) throw error;
      // Driver errors may contain connection strings, query values or provider references.
      throw new ReadinessError('PERSISTENCE_UNAVAILABLE', 503);
    } finally { try { client?.release(); } catch { /* Do not turn committed state into an unsafe retry or leak driver diagnostics. */ } }
  }
}
