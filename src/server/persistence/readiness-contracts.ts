import type {
  AuditLogEntity, BookingGroupEntity, BookingItemEntity, OfferSnapshotEntity,
  OutboxEventEntity, PaymentOrderEntity, SupportTicketEntity, TripBucketEntity, TripBucketItemEntity
} from '../db/schema.ts';
import type { CanonicalOfferEntity, RevalidationResult, SearchQueryCriteria } from '../inventory/types.ts';

/** Persistence projections reuse canonical models; they are not a second domain/status family. */
export interface OwnedRecord { id: string; ownerId: string; organizationId?: string; createdAt: string; updatedAt: string; }
export interface SearchContextRecord extends OwnedRecord { criteria: SearchQueryCriteria; expiresAt: string; }
export interface OfferReferenceRecord extends OwnedRecord {
  searchContextId?: string;
  snapshot: OfferSnapshotEntity;
  authority: Pick<CanonicalOfferEntity, 'sourceType' | 'environmentClass' | 'sellability' | 'bookingMode' |
    'confirmationMode' | 'fulfillmentMode' | 'providerLifecycle' | 'commercialStatus' | 'isSandboxSimulated'>;
  componentReferences?: CanonicalOfferEntity['components'];
}
export interface SelectedTripItem { item: TripBucketItemEntity; offerSnapshotId: string; revalidationRecordId?: string; }
export interface TripBucketRecord extends OwnedRecord { bucket: TripBucketEntity; items: SelectedTripItem[]; revision: number; }
export interface ConfirmationReference {
  kind: 'SUPPLIER' | 'MANUAL'; reference: string; evidenceId: string; actorId: string; confirmedAt: string;
}
export interface BookingRecord extends OwnedRecord {
  tripBucketId: string;
  group: BookingGroupEntity;
  items: BookingItemEntity[];
  selections: Array<{ tripItemId: string; offerSnapshotId: string; bookingItemId: string; revalidationRecordId?: string; configuration: TripBucketItemEntity['configuration'] }>;
  confirmations: Record<string, ConfirmationReference>;
  revision: number;
}
export type FailureCategory = 'SUPPLIER_TIMEOUT' | 'SUPPLIER_REJECTED' | 'OFFER_STALE' | 'OFFER_UNAVAILABLE' |
  'PRICE_CHANGED' | 'PAYMENT_INITIATION_FAILED' | 'OUTCOME_UNKNOWN' | 'PERSISTENCE_UNAVAILABLE';
export interface RevalidationRecord extends OwnedRecord {
  tripBucketId: string; tripItemId: string; offerSnapshotId: string;
  result: Omit<RevalidationResult, 'updatedOffer' | 'message'>;
  validUntil: string; correlationId: string; errorCategory?: FailureCategory;
}
export type OperationKind = 'MANUAL_CONFIRMATION' | 'SUPPLIER_BOOKING' | 'PAYMENT_INITIATION' | 'CANCELLATION' | 'REFUND' | 'FULFILMENT';
export interface OperationalRequestRecord extends OwnedRecord {
  bookingId: string; bookingItemId?: string; paymentId?: string; kind: OperationKind;
  ticket: SupportTicketEntity; correlationId: string; evidenceId?: string; reference?: string;
  amountMinor?: number; errorCategory?: FailureCategory;
}
export interface PaymentReferenceRecord extends OwnedRecord {
  bookingId: string; order: PaymentOrderEntity; providerReference?: string;
  verifiedEventId?: string; verifiedAt?: string;
}
export interface ReadinessAuditEvent extends AuditLogEntity {
  ownerId: string; correlationId: string; actorRole: string; operation: string;
  bookingId?: string;
  status: string; supplierAdapter?: string; latencyMs?: number; errorCategory?: FailureCategory;
}
export interface ReadinessCommand extends OutboxEventEntity, OwnedRecord { correlationId: string; }
export interface IdempotencyRecord extends OwnedRecord { scope: string; requestHash: string; result: unknown; }
export interface ReadinessRecords {
  searches: SearchContextRecord; offers: OfferReferenceRecord; trips: TripBucketRecord;
  bookings: BookingRecord; revalidations: RevalidationRecord; operations: OperationalRequestRecord;
  payments: PaymentReferenceRecord; events: ReadinessAuditEvent; commands: ReadinessCommand; idempotency: IdempotencyRecord;
}
export interface RecordRepository<T extends { id: string; ownerId: string }> {
  get(id: string): Promise<T | undefined>;
  list(ownerId: string): Promise<T[]>;
  put(record: T): Promise<void>;
}
export type TripBucketRepository = RecordRepository<TripBucketRecord>;
export type BookingRepository = RecordRepository<BookingRecord>;
export type CanonicalOfferRepository = RecordRepository<OfferReferenceRecord>;
export type RevalidationRepository = RecordRepository<RevalidationRecord>;
export type OperationalRequestRepository = RecordRepository<OperationalRequestRecord>;
export type PaymentReferenceRepository = RecordRepository<PaymentReferenceRecord>;
export type AuditEventRepository = RecordRepository<ReadinessAuditEvent>;
export type ReadinessRepositories = { [K in keyof ReadinessRecords]: RecordRepository<ReadinessRecords[K]> };
export interface ReadinessUnitOfWork {
  readonly engine: 'MEMORY_TEST' | 'POSTGRES';
  transaction<T>(operation: (repositories: ReadinessRepositories) => Promise<T>): Promise<T>;
}
export class ReadinessError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 409) { super(code); this.name = 'ReadinessError'; this.code = code; this.status = status; }
}
