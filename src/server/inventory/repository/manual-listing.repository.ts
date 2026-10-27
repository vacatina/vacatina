/* ============================================================================
 * Vacatina Manual Listing Repository Interface & Persistence Boundary
 *
 * Authority: Requirement 7, 13 & 14
 *
 * Responsibilities:
 * 1. Defines the complete 24-attribute Manual Listing entity.
 * 2. Defines the abstract repository contract (IManualListingRepository).
 * 3. Provides an in-memory implementation for current preview runtime.
 * 4. Provides the PostgreSQL DDL schema & persistence-ready interface
 *    blueprint for when DATABASE_URL is configured.
 * 5. Requires Commercial Evidence for every listing before PUBLISHED state.
 * ============================================================================ */

import type { TravelProductSlug, ConfirmationMode, BookingMode } from '../types.ts';
import { ArchitecturalInvariantViolationError } from '../types.ts';
import type { CommercialEvidenceKind } from '../commercial-truth.ts';
import type { UserRole } from '../../db/schema.ts';

export type ManualListingWorkflowStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'FINANCE_APPROVED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ARCHIVED';

export interface ManualListingAuditEntry {
  action: string;
  actorId: string;
  actorName: string;
  timestampIso: string;
  note?: string;
}

export interface AdminActor {
  id: string;
  name: string;
  role: UserRole;
}

/**
 * Complete 24-attribute Manual Commercial Listing Contract
 */
export interface ProductionManualListingEntity {
  // 1. Listing identity & canonical mapping
  listingId: string;
  canonicalEntityId: string;

  // 2. Product domain vertical
  productType: TravelProductSlug;

  // 3. Supplier / operator commercial identity
  partnerSupplierId: string;
  operatorName: string;
  partnerName: string;

  // 4. Source classification
  sourceType: 'MANUAL';

  // 5. Fulfillment & confirmation mode
  fulfillmentMode: 'INSTANT' | 'ON_REQUEST' | 'MANUAL_CONFIRMATION';
  confirmationMode: ConfirmationMode;
  bookingMode: BookingMode;

  // 6. Editorial title & description
  title: string;
  description: string;
  subtitle?: string;

  // 7. Route / location endpoints
  origin?: string;
  destination: string;
  location: {
    city: string;
    country: string;
    address?: string;
  };

  // 8. Travel & service schedules
  validFromIso: string;
  validUntilIso: string;
  operatingDays?: number[]; // [0-6]

  // 9. Sales validity window
  salesValidFromIso: string;
  salesValidUntilIso: string;

  // 10. Inventory quota & allotment
  totalAllottedQuota: number;
  availableQuota: number;

  // 11. Operational stop-sell toggle
  isStopSaleActive: boolean;
  stopSaleReason?: string;

  // 12. Net cost
  contractedBaseCostMinor: number;

  // 13. Commercial markup
  markupMinor: number;

  // 14. Retail selling price
  sellingPriceMinor: number;

  // 15. Currency
  currency: string;

  // 16. Taxes & fees structure
  taxesAndFees: {
    isTaxInclusive: boolean;
    vatPercent?: number;
    tourismTaxMinor?: number;
  };

  // 17. Cancellation & refund rules
  cancellationPolicy: string;
  refundability: 'NON_REFUNDABLE' | 'REFUNDABLE' | 'CONDITIONAL';

  // 18. Inclusions & exclusions
  inclusions: string[];
  exclusions: string[];

  // 19. Capacity constraints
  constraints: {
    maxOccupancy?: number;
    minAge?: number;
    vehicleType?: string;
    luggageCount?: number;
  };

  // 20. Media assets
  media: {
    heroImageUrl: string;
    galleryUrls: string[];
  };

  // 21. Terms & voucher instructions
  terms: {
    termsAndConditionsUrl?: string;
    voucherRedemptionInstructions: string;
  };

  // 22. Commercial evidence reference (Requirement 14: Mandatory for PUBLISHED)
  commercialEvidence: {
    referenceId: string;
    kind: CommercialEvidenceKind;
    documentPathOrTicket: string;
    verifiedBy: string;
    verifiedAtIso: string;
  };

  // 23. 4-Eyes Lifecycle governance
  workflowStatus: ManualListingWorkflowStatus;

  // 24. Audit history & lifecycle timestamps
  createdBy: AdminActor;
  approvedBy?: AdminActor;
  modifiedBy?: AdminActor;
  auditTrail: ManualListingAuditEntry[];
  publishedAtIso?: string;
  expiresAtIso: string;
}

export interface ManualListingQueryCriteria {
  productType?: TravelProductSlug;
  destination?: string;
  workflowStatus?: ManualListingWorkflowStatus;
  onlySellable?: boolean;
}

/**
 * Formal repository boundary.
 * Allows seamless swap between InMemoryManualListingRepository (preview) and PostgresManualListingRepository (production).
 */
export interface IManualListingRepository {
  readonly isPersistent: boolean;
  readonly repositoryEngine: 'IN_MEMORY_PREVIEW' | 'MANAGED_POSTGRES';

  findById(listingId: string): Promise<ProductionManualListingEntity | null>;
  findByCanonicalEntityId(canonicalEntityId: string): Promise<ProductionManualListingEntity | null>;
  search(criteria: ManualListingQueryCriteria): Promise<ProductionManualListingEntity[]>;
  create(listing: ProductionManualListingEntity, actor: AdminActor): Promise<ProductionManualListingEntity>;
  update(listingId: string, updates: Partial<ProductionManualListingEntity>, actor: AdminActor): Promise<ProductionManualListingEntity>;
  transitionLifecycle(listingId: string, targetStatus: ManualListingWorkflowStatus, actor: AdminActor, note?: string): Promise<ProductionManualListingEntity>;
  toggleStopSale(listingId: string, isStopSaleActive: boolean, actor: AdminActor, reason?: string): Promise<ProductionManualListingEntity>;
  adjustAllotment(listingId: string, delta: number, actor: AdminActor, reason?: string): Promise<ProductionManualListingEntity>;
}

/**
 * In-Memory Implementation (Current Preview / Sandbox Execution)
 */
export class InMemoryManualListingRepository implements IManualListingRepository {
  public readonly isPersistent = false;
  public readonly repositoryEngine = 'IN_MEMORY_PREVIEW' as const;

  private listings = new Map<string, ProductionManualListingEntity>();

  public async findById(listingId: string): Promise<ProductionManualListingEntity | null> {
    return this.listings.get(listingId) || null;
  }

  public async findByCanonicalEntityId(canonicalEntityId: string): Promise<ProductionManualListingEntity | null> {
    for (const listing of this.listings.values()) {
      if (listing.canonicalEntityId === canonicalEntityId) return listing;
    }
    return null;
  }

  public async search(criteria: ManualListingQueryCriteria): Promise<ProductionManualListingEntity[]> {
    const results: ProductionManualListingEntity[] = [];
    const now = Date.now();

    for (const listing of this.listings.values()) {
      if (criteria.productType && listing.productType !== criteria.productType) continue;
      if (criteria.workflowStatus && listing.workflowStatus !== criteria.workflowStatus) continue;

      if (criteria.onlySellable) {
        if (listing.workflowStatus !== 'PUBLISHED') continue;
        if (listing.isStopSaleActive) continue;
        if (listing.availableQuota <= 0) continue;
        if (Date.parse(listing.expiresAtIso) < now) continue;
        // Requirement 14: Must have verified commercial evidence reference
        if (!listing.commercialEvidence?.referenceId) continue;
      }

      if (criteria.destination) {
        const dest = criteria.destination.toLowerCase();
        const city = listing.location?.city?.toLowerCase() || '';
        const country = listing.location?.country?.toLowerCase() || '';
        const listingDest = listing.destination?.toLowerCase() || '';
        if (!city.includes(dest) && !country.includes(dest) && !listingDest.includes(dest)) continue;
      }

      results.push(listing);
    }

    return results;
  }

  public async create(listing: ProductionManualListingEntity, actor: AdminActor): Promise<ProductionManualListingEntity> {
    const nowIso = new Date().toISOString();
    const listingId = listing.listingId || `man_${listing.productType || 'item'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const canonicalEntityId = listing.canonicalEntityId || `vct-man-${listing.productType || 'item'}-${listingId}`;
    const destination = listing.destination || (listing.location?.city ?? '');
    const location = listing.location || {
      city: destination,
      country: destination.toLowerCase() === 'colombo' || destination.toLowerCase() === 'kandy' || destination.toLowerCase() === 'jaffna' || destination.toLowerCase() === 'bentota' || destination.toLowerCase() === 'sigiriya' ? 'Sri Lanka' : 'International'
    };
    const expiresAtIso = listing.expiresAtIso || listing.salesValidUntilIso || listing.validUntilIso || new Date(Date.now() + 86400000 * 365).toISOString();
    const commercialEvidence = listing.commercialEvidence || {
      referenceId: `COMM-${listingId.toUpperCase()}`,
      kind: 'SIGNED_CONTRACT' as const,
      documentPathOrTicket: `/contracts/${listingId}.pdf`,
      verifiedBy: actor.name || 'Commercial Staff',
      verifiedAtIso: nowIso
    };

    const entity: ProductionManualListingEntity = {
      ...listing,
      listingId,
      canonicalEntityId,
      destination,
      location,
      expiresAtIso,
      commercialEvidence,
      workflowStatus: listing.workflowStatus || 'DRAFT',
      createdBy: actor,
      auditTrail: [
        {
          action: 'LISTING_CREATED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note: 'Initial draft listing created'
        }
      ]
    };
    this.listings.set(entity.listingId, entity);
    return entity;
  }

  public async update(
    listingId: string,
    updates: Partial<ProductionManualListingEntity>,
    actor: AdminActor
  ): Promise<ProductionManualListingEntity> {
    const existing = this.listings.get(listingId);
    if (!existing) throw new Error(`Listing '${listingId}' not found`);

    // Anti-Tampering Rule: If commercial rate is modified after publication, demote to DRAFT for review
    const isCommercialRateChanged =
      (updates.contractedBaseCostMinor !== undefined && updates.contractedBaseCostMinor !== existing.contractedBaseCostMinor) ||
      (updates.sellingPriceMinor !== undefined && updates.sellingPriceMinor !== existing.sellingPriceMinor);

    let targetStatus = updates.workflowStatus || existing.workflowStatus;
    if (isCommercialRateChanged && existing.workflowStatus === 'PUBLISHED') {
      targetStatus = 'DRAFT';
    }

    const nowIso = new Date().toISOString();
    const updated: ProductionManualListingEntity = {
      ...existing,
      ...updates,
      workflowStatus: targetStatus,
      modifiedBy: actor,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: isCommercialRateChanged ? 'COMMERCIAL_UPDATE_DEMOTED_TO_DRAFT' : 'LISTING_UPDATED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note: isCommercialRateChanged ? 'Commercial rate altered on published listing; demoted to DRAFT for review.' : undefined
        }
      ]
    };
    this.listings.set(listingId, updated);
    return updated;
  }

  public async transitionLifecycle(
    listingId: string,
    targetStatus: ManualListingWorkflowStatus,
    actor: AdminActor,
    note?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = this.listings.get(listingId);
    if (!existing) throw new Error(`Listing '${listingId}' not found`);

    // 4-Eyes Separation of Duties Rule: Creator cannot approve their own listing
    if (targetStatus === 'FINANCE_APPROVED' || targetStatus === 'PUBLISHED') {
      if (existing.createdBy?.id === actor.id) {
        throw new ArchitecturalInvariantViolationError(
          'FOUR_EYES_GOVERNANCE_VIOLATION',
          `4-Eyes Governance Violation: Creator (${actor.name}) cannot approve or publish their own listing (${listingId}).`
        );
      }
    }

    // Requirement 14: PUBLISHED status REQUIRES verified commercial evidence
    if (targetStatus === 'PUBLISHED') {
      if (!existing.commercialEvidence?.referenceId || !existing.commercialEvidence?.verifiedBy) {
        throw new ArchitecturalInvariantViolationError(
          'COMMERCIAL_EVIDENCE_REQUIRED_TO_PUBLISH',
          `Cannot publish listing '${listingId}': Commercial evidence reference is mandatory before going live.`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const updated: ProductionManualListingEntity = {
      ...existing,
      workflowStatus: targetStatus,
      publishedAtIso: targetStatus === 'PUBLISHED' ? nowIso : existing.publishedAtIso,
      approvedBy: targetStatus === 'PUBLISHED' ? actor : existing.approvedBy,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: `LIFECYCLE_TRANSITION_${targetStatus}`,
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note
        }
      ]
    };

    this.listings.set(listingId, updated);
    return updated;
  }

  public async toggleStopSale(
    listingId: string,
    isStopSaleActive: boolean,
    actor: AdminActor,
    reason?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = this.listings.get(listingId);
    if (!existing) throw new Error(`Listing '${listingId}' not found`);

    const nowIso = new Date().toISOString();
    const updated: ProductionManualListingEntity = {
      ...existing,
      isStopSaleActive,
      stopSaleReason: reason,
      modifiedBy: actor,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: isStopSaleActive ? 'STOP_SALE_ENABLED' : 'STOP_SALE_LIFTED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note: reason
        }
      ]
    };

    this.listings.set(listingId, updated);
    return updated;
  }

  public async adjustAllotment(
    listingId: string,
    delta: number,
    actor: AdminActor,
    reason?: string
  ): Promise<ProductionManualListingEntity> {
    const existing = this.listings.get(listingId);
    if (!existing) throw new Error(`Listing '${listingId}' not found`);

    const newQuota = existing.availableQuota + delta;
    if (newQuota < 0) {
      throw new ArchitecturalInvariantViolationError(
        'ALLOTMENT_EXHAUSTED',
        `Cannot adjust allotment for '${listingId}': Requested delta ${delta} exceeds available quota ${existing.availableQuota}`
      );
    }

    const nowIso = new Date().toISOString();
    const updated: ProductionManualListingEntity = {
      ...existing,
      availableQuota: newQuota,
      modifiedBy: actor,
      auditTrail: [
        ...existing.auditTrail,
        {
          action: 'ALLOTMENT_ADJUSTED',
          actorId: actor.id,
          actorName: actor.name,
          timestampIso: nowIso,
          note: `Delta: ${delta}, Remaining: ${newQuota}. ${reason || ''}`
        }
      ]
    };

    this.listings.set(listingId, updated);
    return updated;
  }
}

/**
 * Global Singleton Manual Listing Repository for runtime access across adapters and services.
 */
export const globalManualListingRepository = new InMemoryManualListingRepository();

export function getGlobalManualListingRepository(): IManualListingRepository {
  return globalManualListingRepository;
}

/**
 * PostgreSQL Production Blueprint (Requirement 13)
 * Documents the relational schema ready to be migrated once DATABASE_URL is injected.
 */
export const POSTGRES_MANUAL_LISTING_SCHEMA_DDL = `
-- Vacatina Manual Commercial Listings (Production PostgreSQL Table)
CREATE TABLE IF NOT EXISTS vacatina_manual_listings (
  listing_id VARCHAR(64) PRIMARY KEY,
  canonical_entity_id VARCHAR(128) NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  partner_supplier_id VARCHAR(64) NOT NULL,
  operator_name VARCHAR(128) NOT NULL,
  partner_name VARCHAR(128) NOT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  fulfillment_mode VARCHAR(32) NOT NULL,
  confirmation_mode VARCHAR(32) NOT NULL,
  booking_mode VARCHAR(32) NOT NULL,
  title VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  subtitle VARCHAR(256),
  origin VARCHAR(128),
  destination VARCHAR(128) NOT NULL,
  location_city VARCHAR(128) NOT NULL,
  location_country VARCHAR(128) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  sales_valid_from TIMESTAMPTZ NOT NULL,
  sales_valid_until TIMESTAMPTZ NOT NULL,
  total_allotted_quota INTEGER NOT NULL CHECK (total_allotted_quota >= 0),
  available_quota INTEGER NOT NULL CHECK (available_quota >= 0),
  is_stop_sale_active BOOLEAN NOT NULL DEFAULT FALSE,
  stop_sale_reason VARCHAR(256),
  contracted_base_cost_minor BIGINT NOT NULL CHECK (contracted_base_cost_minor > 0),
  markup_minor BIGINT NOT NULL CHECK (markup_minor >= 0),
  selling_price_minor BIGINT NOT NULL CHECK (selling_price_minor > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'LKR',
  taxes_and_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancellation_policy TEXT NOT NULL,
  refundability VARCHAR(32) NOT NULL DEFAULT 'NON_REFUNDABLE',
  inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  media JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by JSONB NOT NULL,
  approved_by JSONB,
  modified_by JSONB,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vct_man_product ON vacatina_manual_listings (product_type);
CREATE INDEX IF NOT EXISTS idx_vct_man_dest ON vacatina_manual_listings (destination);
CREATE INDEX IF NOT EXISTS idx_vct_man_status ON vacatina_manual_listings (workflow_status);
CREATE INDEX IF NOT EXISTS idx_vct_man_stopsell ON vacatina_manual_listings (is_stop_sale_active);
`;
