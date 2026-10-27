/* ============================================================================
 * Vacatina Canonical Storage Engine & Repository Layer
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-001
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
  UUID,
  UserEntity,
  OrganizationEntity,
  OrganizationMembershipEntity,
  TravellerProfileEntity,
  TripBucketEntity,
  TripBucketItemEntity,
  FavoriteEntity,
  BookingGroupEntity,
  BookingItemEntity,
  BookingStatusHistoryEntity,
  PaymentOrderEntity,
  PaymentWebhookEventEntity,
  VisaApplicationEntity,
  ManualListingEntity,
  ManualListingAuditLogEntity,
  ClientEntity,
  MarkupRuleEntity,
  CommissionLedgerEntity,
  PackageEntity,
  SupportTicketEntity,
  IdempotencyKeyEntity,
  OutboxEventEntity,
  AuditLogEntity,
  UserRole,
  ManualListingStatus
} from './schema.ts';
import type { StorageLifecycle } from '../inventory/types.ts';

export interface IPersistenceAdapter {
  lifecycle: StorageLifecycle;
  save<T>(collection: string, key: string, data: T): Promise<void>;
  get<T>(collection: string, key: string): Promise<T | null>;
  getAll<T>(collection: string): Promise<T[]>;
  delete(collection: string, key: string): Promise<boolean>;
  flush(): Promise<void>;
}

export class InMemoryPersistenceAdapter implements IPersistenceAdapter {
  public readonly lifecycle: StorageLifecycle = 'IN_MEMORY_PROTOTYPE';
  private store = new Map<string, Map<string, unknown>>();

  public async save<T>(collection: string, key: string, data: T): Promise<void> {
    if (!this.store.has(collection)) {
      this.store.set(collection, new Map());
    }
    this.store.get(collection)!.set(key, data);
  }

  public async get<T>(collection: string, key: string): Promise<T | null> {
    const col = this.store.get(collection);
    if (!col) return null;
    return (col.get(key) as T) || null;
  }

  public async getAll<T>(collection: string): Promise<T[]> {
    const col = this.store.get(collection);
    if (!col) return [];
    return Array.from(col.values()) as T[];
  }

  public async delete(collection: string, key: string): Promise<boolean> {
    const col = this.store.get(collection);
    if (!col) return false;
    return col.delete(key);
  }

  public async flush(): Promise<void> {
    // In-memory data is ephemeral prototype state
  }
}

export class FileBackedPersistenceAdapter implements IPersistenceAdapter {
  public readonly lifecycle: StorageLifecycle = 'FILE_BACKED_PROTOTYPE';
  private filePath: string;
  private cache: Record<string, Record<string, unknown>> = {};
  private isLoaded = false;

  constructor(filePath: string = '.data/vacatina-storage.json') {
    this.filePath = filePath;
  }

  private async load(): Promise<void> {
    if (this.isLoaded) return;
    try {
      if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        const fs = await import('node:fs/promises');
        const content = await fs.readFile(this.filePath, 'utf-8');
        this.cache = JSON.parse(content);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw new Error('Operational storage could not be read safely');
      this.cache = {};
    }
    this.isLoaded = true;
  }

  public async save<T>(collection: string, key: string, data: T): Promise<void> {
    await this.load();
    if (!this.cache[collection]) {
      this.cache[collection] = {};
    }
    this.cache[collection][key] = data;
    await this.flush();
  }

  public async get<T>(collection: string, key: string): Promise<T | null> {
    await this.load();
    return (this.cache[collection]?.[key] as T) || null;
  }

  public async getAll<T>(collection: string): Promise<T[]> {
    await this.load();
    const col = this.cache[collection];
    if (!col) return [];
    return Object.values(col) as T[];
  }

  public async delete(collection: string, key: string): Promise<boolean> {
    await this.load();
    if (!this.cache[collection] || !this.cache[collection][key]) return false;
    delete this.cache[collection][key];
    await this.flush();
    return true;
  }

  public async flush(): Promise<void> {
    try {
      if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
        const temporaryPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(temporaryPath, JSON.stringify(this.cache, null, 2), { encoding: 'utf-8', mode: 0o600 });
        await fs.rename(temporaryPath, this.filePath);
      }
    } catch {
      throw new Error('Operational storage could not be committed safely');
    }
  }
}

const STORAGE_COLLECTION_NAMES = [
  'users', 'organizations', 'memberships', 'travellerProfiles', 'tripBuckets',
  'tripBucketItems', 'favorites', 'bookingGroups', 'bookingItems', 'bookingHistory',
  'paymentOrders', 'paymentWebhooks', 'visaApplications', 'clients', 'markupRules',
  'commissionLedgers', 'packages', 'supportTickets', 'manualListings',
  'manualListingAudits', 'idempotencyKeys', 'outboxEvents', 'auditLogs'
] as const;

export class VacatinaStorageEngine {
  private persistenceAdapter: IPersistenceAdapter;
  private users = new Map<UUID, UserEntity>();
  private organizations = new Map<UUID, OrganizationEntity>();
  private memberships = new Map<UUID, OrganizationMembershipEntity>();
  private travellerProfiles = new Map<UUID, TravellerProfileEntity>();
  private tripBuckets = new Map<UUID, TripBucketEntity>();
  private tripBucketItems = new Map<UUID, TripBucketItemEntity>();
  private favorites = new Map<UUID, FavoriteEntity>();
  private bookingGroups = new Map<UUID, BookingGroupEntity>();
  private bookingItems = new Map<UUID, BookingItemEntity>();
  private bookingHistory = new Map<UUID, BookingStatusHistoryEntity>();
  private paymentOrders = new Map<UUID, PaymentOrderEntity>();
  private paymentWebhooks = new Map<UUID, PaymentWebhookEventEntity>();
  private visaApplications = new Map<UUID, VisaApplicationEntity>();
  private clients = new Map<UUID, ClientEntity>();
  private markupRules = new Map<UUID, MarkupRuleEntity>();
  private commissionLedgers = new Map<UUID, CommissionLedgerEntity>();
  private packages = new Map<UUID, PackageEntity>();
  private supportTickets = new Map<UUID, SupportTicketEntity>();
  private manualListings = new Map<UUID, ManualListingEntity>();
  private manualListingAudits = new Map<UUID, ManualListingAuditLogEntity>();
  private idempotencyKeys = new Map<string, IdempotencyKeyEntity>();
  private outboxEvents = new Map<UUID, OutboxEventEntity>();
  private auditLogs = new Map<UUID, AuditLogEntity>();

  constructor(adapter?: IPersistenceAdapter) {
    this.persistenceAdapter = adapter || new InMemoryPersistenceAdapter();
    this.seedDefaultPlatformEntities();
  }

  public get storageLifecycle(): StorageLifecycle {
    return this.persistenceAdapter.lifecycle;
  }

  public getPersistenceAdapter(): IPersistenceAdapter {
    return this.persistenceAdapter;
  }

  public attachPersistenceAdapter(adapter: IPersistenceAdapter): void {
    this.persistenceAdapter = adapter;
  }

  /** One versioned snapshot is committed inside the runtime transaction boundary. */
  public exportSnapshot(): { version: 1; collections: Record<string, Array<[string, unknown]>> } {
    const collections: Record<string, Array<[string, unknown]>> = {};
    for (const name of STORAGE_COLLECTION_NAMES) {
      collections[name] = Array.from((this[name] as Map<string, unknown>).entries());
    }
    return JSON.parse(JSON.stringify({ version: 1, collections }));
  }

  public restoreSnapshot(snapshot?: { version: number; collections: Record<string, Array<[string, unknown]>> }): void {
    if (snapshot && (snapshot.version !== 1 || !snapshot.collections || typeof snapshot.collections !== 'object')) {
      throw new Error('Unsupported operational storage snapshot');
    }
    const validated: Record<string, Map<string, unknown>> = {};
    for (const name of STORAGE_COLLECTION_NAMES) {
      const entries = snapshot?.collections[name] || [];
      if (!Array.isArray(entries) || entries.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string')) {
        throw new Error('Invalid operational storage collection: ' + name);
      }
      validated[name] = new Map(entries);
    }
    for (const name of STORAGE_COLLECTION_NAMES) this[name] = validated[name] as any;
  }

  public async flush(): Promise<void> {
    await this.persistenceAdapter.save('runtime', 'operational-state', this.exportSnapshot());
    await this.persistenceAdapter.flush();
  }

  // --------------------------------------------------------------------------
  // Default Platform Seeding
  // --------------------------------------------------------------------------
  private seedDefaultPlatformEntities(): void {
    const defaultOrg: OrganizationEntity = {
      id: 'org_vacatina_hq_001',
      slug: 'vacatina-global-ops',
      name: 'Vacatina Global Operations',
      type: 'PLATFORM',
      creditLimitMinor: 1000000000,
      currency: 'LKR',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.organizations.set(defaultOrg.id, defaultOrg);

    const partnerOrg: OrganizationEntity = {
      id: 'org_partner_ceylon_tours',
      slug: 'ceylon-prestige-travel',
      name: 'Ceylon Prestige Travel (Pvt) Ltd',
      type: 'AGENCY',
      creditLimitMinor: 500000000, // LKR 5,000,000
      currency: 'LKR',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.organizations.set(partnerOrg.id, partnerOrg);

    const partnerClient: ClientEntity = {
      id: 'cli_dialog_axiata',
      organizationId: partnerOrg.id,
      clientType: 'CORPORATE_SME',
      corporateName: 'Dialog Axiata PLC',
      primaryContactName: 'Samantha Perera',
      email: 'samantha.p@dialog.lk',
      phone: '+94777123456',
      creditLimitMinor: 250000000,
      currency: 'LKR',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    this.clients.set(partnerClient.id, partnerClient);

    const markupRule: MarkupRuleEntity = {
      id: 'mr_flights_standard',
      organizationId: partnerOrg.id,
      productType: 'flights',
      markupType: 'PERCENTAGE',
      markupValue: 4.5,
      allowAgentOverride: true,
      createdAt: new Date().toISOString()
    };
    this.markupRules.set(markupRule.id, markupRule);
  }

  // --------------------------------------------------------------------------
  // Audit Logging
  // --------------------------------------------------------------------------
  public recordAuditLog(entry: Omit<AuditLogEntity, 'id' | 'timestamp'>): AuditLogEntity {
    const record: AuditLogEntity = {
      ...entry,
      id: generateUUID(),
      timestamp: new Date().toISOString()
    };
    this.auditLogs.set(record.id, record);
    return record;
  }

  public getAuditLogs(entityType?: string, entityId?: string): AuditLogEntity[] {
    let logs = Array.from(this.auditLogs.values());
    if (entityType) logs = logs.filter(l => l.targetEntity === entityType);
    if (entityId) logs = logs.filter(l => l.targetEntityId === entityId);
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // --------------------------------------------------------------------------
  // Idempotency
  // --------------------------------------------------------------------------
  public getIdempotencyRecord(key: string): IdempotencyKeyEntity | undefined {
    return this.idempotencyKeys.get(key);
  }

  public recordIdempotency(entry: Omit<IdempotencyKeyEntity, 'id' | 'createdAt'>): IdempotencyKeyEntity {
    const record: IdempotencyKeyEntity = {
      ...entry,
      id: generateUUID(),
      createdAt: new Date().toISOString()
    };
    this.idempotencyKeys.set(record.idempotencyKey, record);
    return record;
  }

  // --------------------------------------------------------------------------
  // Trip Bucket Persistence
  // --------------------------------------------------------------------------
  public getOrCreateTripBucket(sessionId: string, userId?: UUID, organizationId?: UUID): TripBucketEntity {
    let bucket = Array.from(this.tripBuckets.values()).find(b => b.sessionId === sessionId && b.status === 'ACTIVE');
    if (!bucket) {
      bucket = {
        id: generateUUID(),
        sessionId,
        userId,
        organizationId,
        currency: 'LKR',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.tripBuckets.set(bucket.id, bucket);
    }
    return bucket;
  }

  public getTripBucketItems(tripBucketId: UUID): TripBucketItemEntity[] {
    return Array.from(this.tripBucketItems.values()).filter(i => i.tripBucketId === tripBucketId);
  }

  public addTripBucketItem(item: Omit<TripBucketItemEntity, 'id' | 'createdAt' | 'lastRevalidatedAt'>): TripBucketItemEntity {
    const record: TripBucketItemEntity = {
      ...item,
      id: generateUUID(),
      lastRevalidatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    this.tripBucketItems.set(record.id, record);
    return record;
  }

  public updateTripBucketItem(id: UUID, updates: Partial<TripBucketItemEntity>): TripBucketItemEntity {
    const existing = this.tripBucketItems.get(id);
    if (!existing) throw new Error(`TripBucketItem ${id} not found`);
    const updated = { ...existing, ...updates, lastRevalidatedAt: new Date().toISOString() };
    this.tripBucketItems.set(id, updated);
    return updated;
  }

  public removeTripBucketItem(id: UUID): boolean {
    return this.tripBucketItems.delete(id);
  }

  // --------------------------------------------------------------------------
  // Booking Group & Booking Items
  // --------------------------------------------------------------------------
  public createBookingGroup(group: Omit<BookingGroupEntity, 'id' | 'createdAt'>): BookingGroupEntity {
    const record: BookingGroupEntity = {
      ...group,
      id: generateUUID(),
      createdAt: new Date().toISOString()
    };
    this.bookingGroups.set(record.id, record);
    return record;
  }

  public getBookingGroup(id: UUID): BookingGroupEntity | undefined {
    return this.bookingGroups.get(id);
  }

  public getBookingGroupByReference(ref: string): BookingGroupEntity | undefined {
    return Array.from(this.bookingGroups.values()).find(b => b.bookingReference.toLowerCase() === ref.toLowerCase());
  }

  public updateBookingGroup(id: UUID, updates: Partial<BookingGroupEntity>): BookingGroupEntity {
    const existing = this.bookingGroups.get(id);
    if (!existing) throw new Error(`BookingGroup ${id} not found`);
    const updated = { ...existing, ...updates };
    this.bookingGroups.set(id, updated);
    return updated;
  }

  public addBookingItem(item: Omit<BookingItemEntity, 'id'>): BookingItemEntity {
    const record: BookingItemEntity = {
      ...item,
      id: generateUUID()
    };
    this.bookingItems.set(record.id, record);
    return record;
  }

  public getBookingItems(bookingGroupId: UUID): BookingItemEntity[] {
    return Array.from(this.bookingItems.values()).filter(i => i.bookingGroupId === bookingGroupId);
  }

  public updateBookingItem(id: UUID, updates: Partial<BookingItemEntity>): BookingItemEntity {
    const existing = this.bookingItems.get(id);
    if (!existing) throw new Error(`BookingItem ${id} not found`);
    const updated = { ...existing, ...updates };
    this.bookingItems.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // Payments & Webhooks
  // --------------------------------------------------------------------------
  public createPaymentOrder(order: Omit<PaymentOrderEntity, 'id' | 'createdAt'>): PaymentOrderEntity {
    const record: PaymentOrderEntity = {
      ...order,
      id: generateUUID(),
      createdAt: new Date().toISOString()
    };
    this.paymentOrders.set(record.id, record);
    return record;
  }

  public getPaymentOrder(id: UUID): PaymentOrderEntity | undefined {
    return this.paymentOrders.get(id);
  }

  public getPaymentOrdersForBooking(bookingGroupId: UUID): PaymentOrderEntity[] {
    return Array.from(this.paymentOrders.values()).filter(order => order.bookingGroupId === bookingGroupId);
  }

  public findPaymentOrderByGatewayReference(gatewayId: string, gatewayOrderId: string): PaymentOrderEntity | undefined {
    return Array.from(this.paymentOrders.values()).find(order => order.gatewayId === gatewayId && order.gatewayOrderId === gatewayOrderId);
  }

  public updatePaymentOrder(id: UUID, updates: Partial<PaymentOrderEntity>): PaymentOrderEntity {
    const existing = this.paymentOrders.get(id);
    if (!existing) throw new Error(`PaymentOrder ${id} not found`);
    const updated = { ...existing, ...updates };
    this.paymentOrders.set(id, updated);
    return updated;
  }

  public recordPaymentWebhook(event: Omit<PaymentWebhookEventEntity, 'id' | 'receivedAt'>): PaymentWebhookEventEntity {
    const record: PaymentWebhookEventEntity = {
      ...event,
      id: generateUUID(),
      receivedAt: new Date().toISOString()
    };
    this.paymentWebhooks.set(record.id, record);
    return record;
  }

  public hasProcessedWebhook(gatewayId: string, eventId: string): boolean {
    return Array.from(this.paymentWebhooks.values()).some(
      w => w.gatewayId === gatewayId && w.eventId === eventId && w.processedStatus === 'PROCESSED'
    );
  }

  // --------------------------------------------------------------------------
  // B2B Partner Domain
  // --------------------------------------------------------------------------
  public getOrganization(id: UUID): OrganizationEntity | undefined {
    return this.organizations.get(id);
  }

  public getClientsByOrg(organizationId: UUID): ClientEntity[] {
    return Array.from(this.clients.values()).filter(c => c.organizationId === organizationId);
  }

  public addClient(client: Omit<ClientEntity, 'id' | 'createdAt'>): ClientEntity {
    const record: ClientEntity = {
      ...client,
      id: generateUUID(),
      createdAt: new Date().toISOString()
    };
    this.clients.set(record.id, record);
    return record;
  }

  public getMarkupRules(organizationId: UUID): MarkupRuleEntity[] {
    return Array.from(this.markupRules.values()).filter(r => r.organizationId === organizationId);
  }

  public addCommissionRecord(comm: Omit<CommissionLedgerEntity, 'id' | 'timestamp'>): CommissionLedgerEntity {
    const record: CommissionLedgerEntity = {
      ...comm,
      id: generateUUID(),
      timestamp: new Date().toISOString()
    };
    this.commissionLedgers.set(record.id, record);
    return record;
  }

  public getCommissionLedger(organizationId: UUID): CommissionLedgerEntity[] {
    return Array.from(this.commissionLedgers.values()).filter(c => c.organizationId === organizationId);
  }

  // --------------------------------------------------------------------------
  // Visa Applications
  // --------------------------------------------------------------------------
  public createVisaApplication(app: Omit<VisaApplicationEntity, 'id' | 'updatedAt'>): VisaApplicationEntity {
    const record: VisaApplicationEntity = {
      ...app,
      id: generateUUID(),
      updatedAt: new Date().toISOString()
    };
    this.visaApplications.set(record.id, record);
    return record;
  }

  public getVisaApplication(id: UUID): VisaApplicationEntity | undefined {
    return this.visaApplications.get(id);
  }

  public getVisaApplicationsByOrg(organizationId?: UUID): VisaApplicationEntity[] {
    const apps = Array.from(this.visaApplications.values());
    return organizationId ? apps.filter(a => a.organizationId === organizationId) : apps;
  }

  public updateVisaApplication(id: UUID, updates: Partial<VisaApplicationEntity>): VisaApplicationEntity {
    const existing = this.visaApplications.get(id);
    if (!existing) throw new Error(`VisaApplication ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.visaApplications.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // Operations & Triage
  // --------------------------------------------------------------------------
  public getSupportTickets(status?: string): SupportTicketEntity[] {
    let list = Array.from(this.supportTickets.values());
    if (status) list = list.filter(t => t.status === status);
    return list;
  }

  public createSupportTicket(ticket: Omit<SupportTicketEntity, 'id' | 'createdAt'>): SupportTicketEntity {
    const record: SupportTicketEntity = {
      ...ticket,
      id: generateUUID(),
      createdAt: new Date().toISOString()
    };
    this.supportTickets.set(record.id, record);
    return record;
  }

  // --------------------------------------------------------------------------
  // Manual Inventory & Direct Contracts Domain (Payload CMS / PostgreSQL)
  // --------------------------------------------------------------------------
  public createManualListing(listing: Omit<ManualListingEntity, 'id' | 'createdAt' | 'updatedAt'>, actorUserId?: UUID): ManualListingEntity {
    const now = new Date().toISOString();
    const id = generateUUID();
    const record: ManualListingEntity = {
      ...listing,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.manualListings.set(id, record);

    if (actorUserId) {
      this.recordManualListingAudit(id, actorUserId, 'CREATED', `Created ${listing.productType} direct contract listing: ${listing.title}`, undefined, record as any);
    }
    return record;
  }

  public getManualListing(id: UUID): ManualListingEntity | undefined {
    return this.manualListings.get(id);
  }

  public getManualListings(filter?: { productType?: string; status?: string; destination?: string }): ManualListingEntity[] {
    let list = Array.from(this.manualListings.values());
    if (filter?.productType) list = list.filter(l => l.productType === filter.productType);
    if (filter?.status) list = list.filter(l => l.status === filter.status);
    if (filter?.destination) {
      const d = filter.destination.toLowerCase();
      list = list.filter(l => l.destinationCity.toLowerCase().includes(d) || l.destinationCountry.toLowerCase().includes(d));
    }
    return list;
  }

  public updateManualListing(id: UUID, updates: Partial<ManualListingEntity>, actorUserId: UUID, changeReason: string): ManualListingEntity {
    const existing = this.manualListings.get(id);
    if (!existing) throw new Error(`ManualListing ${id} not found`);
    const nextRevision = (existing.revisionNumber || 1) + 1;
    const allotted = updates.allottedQuota ?? existing.allottedQuota ?? existing.availableQuota ?? 0;
    const held = updates.heldQuota ?? existing.heldQuota ?? 0;
    const booked = updates.bookedQuota ?? existing.bookedQuota ?? 0;
    const remainingQuota = Math.max(0, allotted - held - booked);

    const updated: ManualListingEntity = {
      ...existing,
      ...updates,
      revisionNumber: nextRevision,
      allottedQuota: allotted,
      heldQuota: held,
      bookedQuota: booked,
      remainingQuota,
      availableQuota: remainingQuota,
      updatedAt: new Date().toISOString()
    };
    this.manualListings.set(id, updated);
    this.recordManualListingAudit(id, actorUserId, 'UPDATED', changeReason, existing as any, updated as any);
    return updated;
  }

  public transitionManualListingStatus(
    id: UUID,
    nextStatus: ManualListingStatus,
    actorUserId: UUID,
    approverUserId?: UUID,
    reason: string = 'Status transition'
  ): ManualListingEntity {
    const existing = this.manualListings.get(id);
    if (!existing) throw new Error(`ManualListing ${id} not found`);

    const validTransitions: Partial<Record<ManualListingStatus, ManualListingStatus[]>> = {
      DRAFT: ['IN_REVIEW', 'ARCHIVED'],
      IN_REVIEW: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
      PUBLISHED: ['PAUSED', 'ARCHIVED'],
      PAUSED: ['PUBLISHED', 'ARCHIVED'],
      ARCHIVED: []
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid status transition from '${existing.status}' to '${nextStatus}'`);
    }

    if (nextStatus === 'PUBLISHED') {
      if (!approverUserId) {
        throw new Error(`ApproverUserId is required to publish listing '${existing.title}'`);
      }
      if (existing.contractedNetCostMinor <= 0 || existing.sellingPriceMinor <= 0) {
        throw new Error(`Listing '${existing.title}' must have positive net cost and selling price to publish`);
      }
      if (!existing.isUnlimitedQuota && existing.availableQuota <= 0) {
        throw new Error(`Listing '${existing.title}' must have quota > 0 to publish`);
      }
      if (!existing.cancellationPolicy) {
        throw new Error(`Listing '${existing.title}' requires a cancellation policy to publish`);
      }
      if (existing.stopSale === true) {
        throw new Error(`Cannot publish listing '${existing.title}' while stopSale flag is active`);
      }
    }

    const now = new Date().toISOString();
    const nextRevision = (existing.revisionNumber || 1) + 1;
    const updated: ManualListingEntity = {
      ...existing,
      status: nextStatus,
      publicationStatus: nextStatus as any,
      revisionNumber: nextRevision,
      reviewedBy: nextStatus === 'IN_REVIEW' ? actorUserId : existing.reviewedBy,
      approvedBy: nextStatus === 'PUBLISHED' ? approverUserId : existing.approvedBy,
      publishedByUserId: nextStatus === 'PUBLISHED' ? approverUserId : existing.publishedByUserId,
      publishedAt: nextStatus === 'PUBLISHED' ? now : existing.publishedAt,
      pausedAt: nextStatus === 'PAUSED' ? now : existing.pausedAt,
      archivedAt: nextStatus === 'ARCHIVED' ? now : existing.archivedAt,
      updatedAt: now
    };

    this.manualListings.set(id, updated);
    this.recordManualListingAudit(
      id,
      actorUserId,
      nextStatus === 'PUBLISHED' ? 'PUBLISHED' : nextStatus === 'PAUSED' ? 'PAUSED' : nextStatus === 'ARCHIVED' ? 'ARCHIVED' : 'UPDATED',
      reason,
      existing as any,
      updated as any
    );
    return updated;
  }

  public recordManualListingAudit(
    listingId: UUID,
    actorUserId: UUID,
    action: ManualListingAuditLogEntity['action'],
    changeSummary: string,
    prevState?: Record<string, unknown>,
    newState: Record<string, unknown> = {}
  ): ManualListingAuditLogEntity {
    const audit: ManualListingAuditLogEntity = {
      id: generateUUID(),
      listingId,
      actorUserId,
      action,
      changeSummary,
      previousStateSnapshot: prevState,
      newStateSnapshot: newState,
      createdAt: new Date().toISOString()
    };
    this.manualListingAudits.set(audit.id, audit);
    return audit;
  }

  public getManualListingAudits(listingId: UUID): ManualListingAuditLogEntity[] {
    return Array.from(this.manualListingAudits.values()).filter(a => a.listingId === listingId);
  }
}

  // Global Singleton Instance for Runtime
export const globalStorageEngine = new VacatinaStorageEngine();
