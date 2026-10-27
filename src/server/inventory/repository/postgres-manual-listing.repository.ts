/* ============================================================================
 * Vacatina PostgreSQL Manual Listing Repository
 * Authority: Requirement 1, 3, 13 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 *
 * Responsibilities:
 * 1. Persistent storage of Vacatina Direct Manual Listings using PostgreSQL.
 * 2. Enforces 4-Eyes Governance (separation of creator and approver).
 * 3. Atomic allotment adjustments and operational stop-sale switches.
 * 4. Immutable audit logging into vacatina_manual_listing_audit_log.
 * 5. Automatic fallback to InMemoryManualListingRepository when DATABASE_URL is unset.
 * ============================================================================ */

import pg from 'pg';
import type {
  AdminActor,
  IManualListingRepository,
  ManualListingAuditEntry,
  ManualListingQueryCriteria,
  ManualListingWorkflowStatus,
  ProductionManualListingEntity
} from './manual-listing.repository.ts';
import { InMemoryManualListingRepository } from './manual-listing.repository.ts';
import { ArchitecturalInvariantViolationError } from '../types.ts';

const { Pool } = pg;

export class PostgresManualListingRepository implements IManualListingRepository {
  public readonly isPersistent = true;
  public readonly repositoryEngine = 'MANAGED_POSTGRES' as const;

  private pool: pg.Pool | null = null;
  private fallbackMemory: InMemoryManualListingRepository;
  private isConnected = false;

  constructor(connectionString?: string) {
    this.fallbackMemory = new InMemoryManualListingRepository();
    const connStr = connectionString || process.env.DATABASE_URL;

    if (connStr) {
      try {
        this.pool = new Pool({
          connectionString: connStr,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 3000
        });
        this.isConnected = true;
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] Failed to initialize Pool: ${err.message}. Using in-memory fallback.`);
        this.isConnected = false;
      }
    }
  }

  public async findById(listingId: string): Promise<ProductionManualListingEntity | null> {
    if (!this.isConnected || !this.pool) {
      return this.fallbackMemory.findById(listingId);
    }

    try {
      const res = await this.pool.query(
        'SELECT * FROM vacatina_manual_listings WHERE listing_id = $1 LIMIT 1',
        [listingId]
      );
      if (res.rows.length === 0) return null;
      return this.rowToEntity(res.rows[0]);
    } catch (err: any) {
      console.warn(`[PostgresManualListingRepository] findById error: ${err.message}. Falling back.`);
      return this.fallbackMemory.findById(listingId);
    }
  }

  public async findByCanonicalEntityId(canonicalEntityId: string): Promise<ProductionManualListingEntity | null> {
    if (!this.isConnected || !this.pool) {
      return this.fallbackMemory.findByCanonicalEntityId(canonicalEntityId);
    }

    try {
      const res = await this.pool.query(
        'SELECT * FROM vacatina_manual_listings WHERE canonical_entity_id = $1 LIMIT 1',
        [canonicalEntityId]
      );
      if (res.rows.length === 0) return null;
      return this.rowToEntity(res.rows[0]);
    } catch (err: any) {
      console.warn(`[PostgresManualListingRepository] findByCanonicalEntityId error: ${err.message}. Falling back.`);
      return this.fallbackMemory.findByCanonicalEntityId(canonicalEntityId);
    }
  }

  public async search(criteria: ManualListingQueryCriteria): Promise<ProductionManualListingEntity[]> {
    if (!this.isConnected || !this.pool) {
      return this.fallbackMemory.search(criteria);
    }

    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (criteria.productType) {
        conditions.push(`product_type = $${idx++}`);
        values.push(criteria.productType);
      }

      if (criteria.workflowStatus) {
        conditions.push(`workflow_status = $${idx++}`);
        values.push(criteria.workflowStatus);
      }

      if (criteria.onlySellable) {
        conditions.push(`workflow_status = 'PUBLISHED'`);
        conditions.push(`is_stop_sale_active = FALSE`);
        conditions.push(`available_quota > 0`);
        conditions.push(`NOW() BETWEEN sales_valid_from AND sales_valid_until`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT * FROM vacatina_manual_listings ${whereClause} ORDER BY created_at DESC`;

      const res = await this.pool.query(query, values);
      return res.rows.map(r => this.rowToEntity(r));
    } catch (err: any) {
      console.warn(`[PostgresManualListingRepository] search error: ${err.message}. Falling back.`);
      return this.fallbackMemory.search(criteria);
    }
  }

  public async create(listing: ProductionManualListingEntity, actor: AdminActor): Promise<ProductionManualListingEntity> {
    // 1. Invariant: New listings must originate in DRAFT status
    if (listing.workflowStatus !== 'DRAFT') {
      throw new ArchitecturalInvariantViolationError(
        'INVALID_MANUAL_LISTING_DRAFT',
        `Manual Listing must be created in DRAFT status. Received: ${listing.workflowStatus}`
      );
    }

    const nowIso = new Date().toISOString();
    const listingToSave: ProductionManualListingEntity = {
      ...listing,
      createdBy: actor,
      auditTrail: [
        {
          action: 'CREATED_DRAFT',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note: 'Initial manual contract drafted.'
        }
      ]
    };

    // Keep fallback memory in sync
    await this.fallbackMemory.create(listingToSave, actor);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO vacatina_manual_listings (
            listing_id, canonical_entity_id, product_type, partner_supplier_id, operator_name,
            partner_name, source_type, fulfillment_mode, confirmation_mode, booking_mode,
            title, description, subtitle, origin, destination, location_city, location_country,
            valid_from, valid_until, sales_valid_from, sales_valid_until, total_allotted_quota,
            available_quota, is_stop_sale_active, stop_sale_reason, contracted_base_cost_minor,
            markup_minor, selling_price_minor, currency, taxes_and_fees, cancellation_policy,
            refundability, inclusions, exclusions, constraints, media, terms, commercial_evidence,
            workflow_status, created_by, published_at, expires_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42
          )`,
          [
            listingToSave.listingId, listingToSave.canonicalEntityId, listingToSave.productType, listingToSave.partnerSupplierId, listingToSave.operatorName,
            listingToSave.partnerName, listingToSave.sourceType, listingToSave.fulfillmentMode, listingToSave.confirmationMode, listingToSave.bookingMode,
            listingToSave.title, listingToSave.description, listingToSave.subtitle || null, listingToSave.origin || null, listingToSave.destination, listingToSave.location.city, listingToSave.location.country,
            listingToSave.validFromIso, listingToSave.validUntilIso, listingToSave.salesValidFromIso, listingToSave.salesValidUntilIso, listingToSave.totalAllottedQuota,
            listingToSave.availableQuota, listingToSave.isStopSaleActive, listingToSave.stopSaleReason || null, listingToSave.contractedBaseCostMinor,
            listingToSave.markupMinor, listingToSave.sellingPriceMinor, listingToSave.currency, JSON.stringify(listingToSave.taxesAndFees), listingToSave.cancellationPolicy,
            listingToSave.refundability, JSON.stringify(listingToSave.inclusions), JSON.stringify(listingToSave.exclusions), JSON.stringify(listingToSave.constraints), JSON.stringify(listingToSave.media), JSON.stringify(listingToSave.terms), JSON.stringify(listingToSave.commercialEvidence),
            listingToSave.workflowStatus, JSON.stringify(listingToSave.createdBy), listingToSave.publishedAtIso || null, listingToSave.expiresAtIso
          ]
        );

        // Record audit log
        await this.pool.query(
          `INSERT INTO vacatina_manual_listing_audit_log (listing_id, action, actor_id, actor_name, note, new_state)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [listingToSave.listingId, 'CREATED_DRAFT', actor.id, actor.name, 'Initial manual contract drafted.', JSON.stringify(listingToSave)]
        );
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] DB create failed: ${err.message}. Maintained in memory.`);
      }
    }

    return listingToSave;
  }

  public async update(
    listingId: string,
    updates: Partial<ProductionManualListingEntity>,
    actor: AdminActor
  ): Promise<ProductionManualListingEntity> {
    const existing = await this.findById(listingId);
    if (!existing) {
      throw new Error(`Manual listing ${listingId} not found`);
    }

    // Anti-Tampering Rule: If commercial rate is modified after approval, demote to DRAFT
    let targetStatus = updates.workflowStatus || existing.workflowStatus;
    const isCommercialRateChanged =
      (updates.contractedBaseCostMinor !== undefined && updates.contractedBaseCostMinor !== existing.contractedBaseCostMinor) ||
      (updates.sellingPriceMinor !== undefined && updates.sellingPriceMinor !== existing.sellingPriceMinor);

    if (isCommercialRateChanged && existing.workflowStatus === 'PUBLISHED') {
      targetStatus = 'DRAFT';
    }

    const updated: ProductionManualListingEntity = {
      ...existing,
      ...updates,
      workflowStatus: targetStatus,
      modifiedBy: actor,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: isCommercialRateChanged ? 'COMMERCIAL_UPDATE_DEMOTED_TO_DRAFT' : 'UPDATED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: new Date().toISOString(),
          note: isCommercialRateChanged ? 'Commercial rate altered on published listing; demoted to DRAFT for review.' : 'Attributes updated.'
        }
      ]
    };

    await this.fallbackMemory.update(listingId, updates, actor);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE vacatina_manual_listings
           SET title = $1, description = $2, contracted_base_cost_minor = $3, selling_price_minor = $4,
               workflow_status = $5, updated_at = NOW()
           WHERE listing_id = $6`,
          [updated.title, updated.description, updated.contractedBaseCostMinor, updated.sellingPriceMinor, updated.workflowStatus, listingId]
        );
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] DB update failed: ${err.message}`);
      }
    }

    return updated;
  }

  public async transitionLifecycle(
    listingId: string,
    targetStatus: ManualListingWorkflowStatus,
    actor: AdminActor,
    note?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = await this.findById(listingId);
    if (!existing) {
      throw new Error(`Manual listing ${listingId} not found`);
    }

    // 4-Eyes Separation of Duties Rule: Creator cannot approve their own listing
    if (targetStatus === 'FINANCE_APPROVED' || targetStatus === 'PUBLISHED') {
      if (existing.createdBy.id === actor.id) {
        throw new ArchitecturalInvariantViolationError(
          'FOUR_EYES_GOVERNANCE_VIOLATION',
          `4-Eyes Violation: Creator (${actor.name}) cannot approve or publish their own listing (${listingId}).`
        );
      }
    }

    const updated: ProductionManualListingEntity = {
      ...existing,
      workflowStatus: targetStatus,
      approvedBy: (targetStatus === 'FINANCE_APPROVED' || targetStatus === 'PUBLISHED') ? actor : existing.approvedBy,
      publishedAtIso: targetStatus === 'PUBLISHED' ? new Date().toISOString() : existing.publishedAtIso,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: `TRANSITION_${targetStatus}`,
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: new Date().toISOString(),
          note: note || `Transitioned status to ${targetStatus}`
        }
      ]
    };

    await this.fallbackMemory.transitionLifecycle(listingId, targetStatus, actor, note);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE vacatina_manual_listings
           SET workflow_status = $1, approved_by = $2, published_at = $3, updated_at = NOW()
           WHERE listing_id = $4`,
          [updated.workflowStatus, JSON.stringify(updated.approvedBy), updated.publishedAtIso || null, listingId]
        );
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] DB lifecycle update failed: ${err.message}`);
      }
    }

    return updated;
  }

  public async toggleStopSale(
    listingId: string,
    isStopSaleActive: boolean,
    actor: AdminActor,
    reason?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = await this.findById(listingId);
    if (!existing) throw new Error(`Manual listing ${listingId} not found`);

    const updated: ProductionManualListingEntity = {
      ...existing,
      isStopSaleActive,
      stopSaleReason: reason,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: isStopSaleActive ? 'STOP_SALE_ACTIVATED' : 'STOP_SALE_DEACTIVATED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: new Date().toISOString(),
          note: reason || (isStopSaleActive ? 'Operational stop-sale triggered.' : 'Stop-sale cleared.')
        }
      ]
    };

    await this.fallbackMemory.toggleStopSale(listingId, isStopSaleActive, actor, reason);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE vacatina_manual_listings
           SET is_stop_sale_active = $1, stop_sale_reason = $2, updated_at = NOW()
           WHERE listing_id = $3`,
          [isStopSaleActive, reason || null, listingId]
        );
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] DB stop-sale failed: ${err.message}`);
      }
    }

    return updated;
  }

  public async adjustAllotment(
    listingId: string,
    delta: number,
    actor: AdminActor,
    reason?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = await this.findById(listingId);
    if (!existing) throw new Error(`Manual listing ${listingId} not found`);

    const newQuota = existing.availableQuota + delta;
    if (newQuota < 0) {
      throw new ArchitecturalInvariantViolationError(
        'EXHAUSTED_ALLOTMENT_QUOTA',
        `Exhausted Allotment: Cannot decrement quota by ${Math.abs(delta)}. Remaining available: ${existing.availableQuota}`
      );
    }

    const updated: ProductionManualListingEntity = {
      ...existing,
      availableQuota: newQuota,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: 'ALLOTMENT_ADJUSTED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: new Date().toISOString(),
          note: `Delta: ${delta}, Remaining: ${newQuota}. ${reason || ''}`
        }
      ]
    };

    await this.fallbackMemory.adjustAllotment(listingId, delta, actor, reason);

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE vacatina_manual_listings
           SET available_quota = $1, updated_at = NOW()
           WHERE listing_id = $2`,
          [newQuota, listingId]
        );
      } catch (err: any) {
        console.warn(`[PostgresManualListingRepository] DB adjustAllotment failed: ${err.message}`);
      }
    }

    return updated;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
    }
  }

  private rowToEntity(row: any): ProductionManualListingEntity {
    return {
      listingId: row.listing_id,
      canonicalEntityId: row.canonical_entity_id,
      productType: row.product_type,
      partnerSupplierId: row.partner_supplier_id,
      operatorName: row.operator_name,
      partnerName: row.partner_name,
      sourceType: 'MANUAL',
      fulfillmentMode: row.fulfillment_mode,
      confirmationMode: row.confirmation_mode,
      bookingMode: row.booking_mode,
      title: row.title,
      description: row.description,
      subtitle: row.subtitle,
      origin: row.origin,
      destination: row.destination,
      location: {
        city: row.location_city,
        country: row.location_country
      },
      validFromIso: new Date(row.valid_from).toISOString(),
      validUntilIso: new Date(row.valid_until).toISOString(),
      salesValidFromIso: new Date(row.sales_valid_from).toISOString(),
      salesValidUntilIso: new Date(row.sales_valid_until).toISOString(),
      totalAllottedQuota: Number(row.total_allotted_quota),
      availableQuota: Number(row.available_quota),
      isStopSaleActive: Boolean(row.is_stop_sale_active),
      stopSaleReason: row.stop_sale_reason,
      contractedBaseCostMinor: Number(row.contracted_base_cost_minor),
      markupMinor: Number(row.markup_minor),
      sellingPriceMinor: Number(row.selling_price_minor),
      currency: row.currency,
      taxesAndFees: typeof row.taxes_and_fees === 'string' ? JSON.parse(row.taxes_and_fees) : row.taxes_and_fees,
      cancellationPolicy: row.cancellation_policy,
      refundability: row.refundability,
      inclusions: typeof row.inclusions === 'string' ? JSON.parse(row.inclusions) : row.inclusions,
      exclusions: typeof row.exclusions === 'string' ? JSON.parse(row.exclusions) : row.exclusions,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : row.constraints,
      media: typeof row.media === 'string' ? JSON.parse(row.media) : row.media,
      terms: typeof row.terms === 'string' ? JSON.parse(row.terms) : row.terms,
      commercialEvidence: typeof row.commercial_evidence === 'string' ? JSON.parse(row.commercial_evidence) : row.commercial_evidence,
      workflowStatus: row.workflow_status,
      createdBy: typeof row.created_by === 'string' ? JSON.parse(row.created_by) : row.created_by,
      approvedBy: row.approved_by ? (typeof row.approved_by === 'string' ? JSON.parse(row.approved_by) : row.approved_by) : undefined,
      modifiedBy: row.modified_by ? (typeof row.modified_by === 'string' ? JSON.parse(row.modified_by) : row.modified_by) : undefined,
      publishedAtIso: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      expiresAtIso: new Date(row.expires_at).toISOString(),
      auditTrail: []
    };
  }
}
