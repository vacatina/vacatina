/* ============================================================================
 * Vacatina Manual Inventory Service & Repository Boundary
 * Authority: VACATINA MASTER INSTRUCTION — PART 4, 10, 11, 12, 13 & PART 35 (STEP 6)
 *
 * Manages Vacatina-controlled listings from Payload CMS / Admin portal:
 * - Charter flights, boutique hotels, curated packages, private cars/chauffeurs,
 *   niche cruises, scenic rails, activities, tours, and visa assistance.
 * - Strict lifecycle: DRAFT -> REVIEW -> PUBLISHED -> PAUSED -> EXPIRED -> ARCHIVED.
 * - Admin controls: markup, booking mode, pin above API results, exclusive badge,
 *   quota tracking, and auditable status transitions.
 * ============================================================================ */

import type { SupportedCurrency, TravelProductSlug } from '../domain/types.ts';
import type {
  BookingMode,
  ConfirmationMode,
  ManualListingStatus,
  StructuredLocation,
  VacatinaNormalizedOffer
} from '../domain/inventory-models.ts';
import { InventoryNormalizerService } from './inventory-normalizer.service.ts';
import type {
  InventoryCommercialClass,
  OperationalReadinessTier,
  CommercialEvidenceDossier
} from '../../server/inventory/types.ts';
import { ArchitecturalInvariantViolationError } from '../domain/architectural-invariants.ts';

export class SeparationOfDutiesViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeparationOfDutiesViolationError';
  }
}

export interface ManualListingRecord {
  // 1. Supplier Commercial Identity
  id: string; // e.g. 'man-ht-kandalama-direct-001'
  collection: string; // e.g. 'contracted-boutique-hotels'
  partnerSupplierId: string;
  partnerName: string;
  supplierLegalName?: string;
  supplierTaxId?: string;
  supplierContactEmail?: string;

  // 2. Product & Canonical Entity Identity
  productType: TravelProductSlug;
  canonicalEntityId?: string;
  title: string;
  subtitle: string;
  slug: string;
  location: StructuredLocation;

  // 3. Contract Reference & Effective Period
  contractReference?: string;
  effectiveFromIso?: string;
  effectiveToIso?: string;

  // 4. Rate & Financial Structure
  contractedBaseCost: number; // Net supplier cost
  standardSellingPriceLkr: number; // Selling price in LKR
  markupPercent?: number;
  commissionPercent?: number;

  // 5. Currency
  costCurrency: SupportedCurrency;
  sellingCurrency?: SupportedCurrency;

  // 6. Taxes & Fees
  isTaxInclusive?: boolean;
  taxRatePercent?: number;

  // 7. Availability & Allotment
  availableQuota: number; // Remaining allotment
  allotmentTotal?: number;
  minLeadDays?: number;

  // 8. Sales Window
  validFromIso: string;
  validUntilIso: string;
  salesValidFromIso?: string;
  salesValidUntilIso?: string;

  // 9. Travel / Stay Window
  travelValidFromIso?: string;
  travelValidUntilIso?: string;

  // 10. Blackout Dates
  blackoutDates?: string[];

  // 11. Stop-Sell Immediate Suspension
  isStopSaleActive?: boolean;

  // 12. Booking Mode & Fulfillment
  confirmationMode: ConfirmationMode;
  bookingMode: BookingMode;

  // 13. SLA & Response Commitment
  partnerSlaHours?: number; // e.g. 2, 4, 24 hours

  // 14. Cancellation & Refund Terms
  cancellationPolicy: string;
  freeCancellationDeadlineHours?: number;

  // 15. Occupancy & Duration Constraints
  maxOccupancy?: number;
  minNights?: number;
  maxNights?: number;

  // 16. Content & Editorial Assets
  description?: string;
  images?: string[];
  inclusions: string[];
  exclusions: string[];
  featured?: boolean;
  exclusiveOffer?: boolean;
  pinPriority?: number; // Higher number = ranks higher when pinned

  // 17. Publishing Lifecycle
  status: ManualListingStatus;

  // 18. Audit & Approver History (Separation of Duties - Directive 8)
  createdBy?: string;
  verifiedBy?: string;
  pricingApprovedBy?: string;
  publishedBy?: string;
  isPricingApproved?: boolean;
  lastEditedBy?: string;
  approvedBy?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
  auditTrail: {
    action: string;
    changedBy: string;
    timestampIso: string;
    note?: string;
  }[];

  // 19. Commercial Truth & Operational Evidence Dossier (Audit v2.3)
  inventoryClass?: InventoryCommercialClass;
  readinessTier?: OperationalReadinessTier;
  commercialEvidence?: CommercialEvidenceDossier;
}

export function assertListingIsProductionSellable(listing: ManualListingRecord): void {
  if (listing.inventoryClass === 'SAMPLE_INVENTORY') {
    throw new ArchitecturalInvariantViolationError(
      'SAMPLE_INVENTORY_CANNOT_SELL',
      `Commercial Truth Guard: Listing '${listing.id}' is classified as SAMPLE_INVENTORY. Sample listings are for system demonstration only and cannot be sold in production.`
    );
  }

  // Required 11 Commercial Attributes Check (Directive 2)
  if (!listing.partnerSupplierId) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_SUPPLIER_IDENTITY',
      `Commercial Truth Guard: Listing '${listing.id}' lacks verified supplier identity.`
    );
  }
  if (!listing.contractReference) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_CONTRACT_REFERENCE',
      `Commercial Truth Guard: Listing '${listing.id}' lacks binding contract reference.`
    );
  }
  if (!listing.effectiveFromIso || !listing.effectiveToIso) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_EFFECTIVE_DATES',
      `Commercial Truth Guard: Listing '${listing.id}' lacks effective validity dates.`
    );
  }
  if (!listing.productType || !listing.title) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_PRODUCT_CONFIGURATION',
      `Commercial Truth Guard: Listing '${listing.id}' lacks product configuration.`
    );
  }
  if (listing.contractedBaseCost <= 0 || listing.standardSellingPriceLkr <= 0) {
    throw new ArchitecturalInvariantViolationError(
      'INVALID_RATE_STRUCTURE',
      `Commercial Truth Guard: Listing '${listing.id}' lacks positive net cost or selling price.`
    );
  }
  if (listing.availableQuota === undefined || listing.availableQuota < 0) {
    throw new ArchitecturalInvariantViolationError(
      'INVALID_ALLOTMENT_RULE',
      `Commercial Truth Guard: Listing '${listing.id}' lacks defined allotment quota.`
    );
  }
  if (!listing.cancellationPolicy) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_CANCELLATION_POLICY',
      `Commercial Truth Guard: Listing '${listing.id}' lacks cancellation conditions.`
    );
  }
  if (!listing.confirmationMode || !listing.bookingMode) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_CONFIRMATION_METHOD',
      `Commercial Truth Guard: Listing '${listing.id}' lacks confirmation or booking mode.`
    );
  }

  if (!listing.readinessTier || !listing.readinessTier.commercialReady) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_COMMERCIAL_EVIDENCE',
      `Commercial Truth Guard: Listing '${listing.id}' lacks verified commercial readiness. Real signed contract and settlement terms are required.`
    );
  }
  if (!listing.commercialEvidence || !listing.commercialEvidence.isEvidenceVerified) {
    throw new ArchitecturalInvariantViolationError(
      'UNVERIFIED_EVIDENCE_DOSSIER',
      `Commercial Truth Guard: Listing '${listing.id}' lacks verified commercialEvidence dossier (document reference, signed date, legal name, settlement terms).`
    );
  }
  if (!listing.commercialEvidence.settlementTerms) {
    throw new ArchitecturalInvariantViolationError(
      'MISSING_SETTLEMENT_TERMS',
      `Commercial Truth Guard: Listing '${listing.id}' lacks verified commercial settlement terms.`
    );
  }
  if (!listing.readinessTier.productionSellable || (listing.status !== 'ACTIVE' && listing.status !== 'PUBLISHED')) {
    throw new ArchitecturalInvariantViolationError(
      'LISTING_NOT_PRODUCTION_SELLABLE',
      `Commercial Truth Guard: Listing '${listing.id}' has productionSellable = false or status is not ACTIVE/PUBLISHED.`
    );
  }
}

export class ManualInventoryService {
  private listings: Map<string, ManualListingRecord> = new Map();
  private activeHolds: Map<string, { listingId: string; quantity: number; expiresAt: number }> = new Map();

  constructor(initialSeed: ManualListingRecord[] = []) {
    initialSeed.forEach(listing => this.listings.set(listing.id, listing));
  }

  /**
   * Holds allotment atomically with a TTL (e.g. 15 minutes during checkout wizard).
   * Prevents two concurrent users from booking the last available room/seat.
   */
  public holdAllotment(
    listingId: string,
    quantity: number,
    holdDurationMs: number = 900000 // 15 mins default
  ): { holdId: string; expiresAtIso: string; remainingQuota: number } {
    const listing = this.listings.get(listingId);
    if (!listing) {
      throw new Error(`Listing '${listingId}' not found.`);
    }

    // Clean up expired holds for this listing
    const now = Date.now();
    for (const [holdId, hold] of this.activeHolds.entries()) {
      if (hold.listingId === listingId && hold.expiresAt <= now) {
        this.activeHolds.delete(holdId);
      }
    }

    // Calculate currently active held units
    let totalHeld = 0;
    for (const hold of this.activeHolds.values()) {
      if (hold.listingId === listingId) {
        totalHeld += hold.quantity;
      }
    }

    const availableUnits = listing.availableQuota - totalHeld;
    if (availableUnits < quantity) {
      throw new Error(
        `Allotment Exceeded: Requested ${quantity} units, but only ${Math.max(0, availableUnits)} units are currently available (Total Quota: ${listing.availableQuota}, Active Holds: ${totalHeld}).`
      );
    }

    const holdId = `HLD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const expiresAt = now + holdDurationMs;
    this.activeHolds.set(holdId, { listingId, quantity, expiresAt });

    return {
      holdId,
      expiresAtIso: new Date(expiresAt).toISOString(),
      remainingQuota: availableUnits - quantity
    };
  }

  /**
   * Commits an active hold upon payment confirmation, permanently decrementing availableQuota.
   */
  public commitAllotment(listingId: string, holdId: string): number {
    const hold = this.activeHolds.get(holdId);
    if (!hold || hold.listingId !== listingId) {
      throw new Error(`Active allotment hold '${holdId}' for listing '${listingId}' not found or already expired.`);
    }
    if (hold.expiresAt <= Date.now()) {
      this.activeHolds.delete(holdId);
      throw new Error(`Allotment hold '${holdId}' has expired.`);
    }

    const listing = this.listings.get(listingId);
    if (!listing) {
      throw new Error(`Listing '${listingId}' not found.`);
    }

    listing.availableQuota = Math.max(0, listing.availableQuota - hold.quantity);
    listing.updatedAtIso = new Date().toISOString();
    this.activeHolds.delete(holdId);

    listing.auditTrail.push({
      action: 'ALLOTMENT_COMMITTED',
      changedBy: 'Booking System',
      timestampIso: new Date().toISOString(),
      note: `Committed ${hold.quantity} units via hold '${holdId}'. Remaining quota: ${listing.availableQuota}.`
    });

    return listing.availableQuota;
  }

  /**
   * Releases an allotment hold (e.g. user abandons checkout or payment fails).
   */
  public releaseAllotment(listingId: string, holdId: string): void {
    const hold = this.activeHolds.get(holdId);
    if (hold && hold.listingId === listingId) {
      this.activeHolds.delete(holdId);
    }
  }

  /**
   * Returns all listings matching status (defaults to PUBLISHED for customer queries).
   */
  public queryListings(filter: {
    productType?: TravelProductSlug;
    destination?: string;
    travelDate?: string;
    status?: ManualListingStatus;
    onlyActive?: boolean;
  } = {}): ManualListingRecord[] {
    const targetStatus = filter.status || (filter.onlyActive !== false ? 'PUBLISHED' : undefined);
    const nowIso = new Date().toISOString();

    let list = Array.from(this.listings.values());

    if (targetStatus) {
      list = list.filter(l => l.status === targetStatus);
    }

    if (filter.productType) {
      list = list.filter(l => l.productType === filter.productType);
    }

    if (filter.destination) {
      const q = filter.destination.toLowerCase();
      list = list.filter(
        l =>
          l.location.city.toLowerCase().includes(q) ||
          l.location.country.toLowerCase().includes(q) ||
          (l.location.iataCode && l.location.iataCode.toLowerCase().includes(q))
      );
    }

    // Filter out expired items, zero quotas, or stopped sales for active queries
    if (filter.onlyActive !== false) {
      list = list.filter(l => l.validUntilIso >= nowIso && l.availableQuota > 0 && !l.isStopSaleActive);
    }

    // Filter out blacked out dates and out-of-travel-window dates
    if (filter.travelDate) {
      const tDate = filter.travelDate;
      list = list.filter(l => {
        if (l.blackoutDates && l.blackoutDates.includes(tDate)) return false;
        if (l.travelValidFromIso && tDate < l.travelValidFromIso.split('T')[0]) return false;
        if (l.travelValidUntilIso && tDate > l.travelValidUntilIso.split('T')[0]) return false;
        return true;
      });
    }

    return list;
  }

  /**
   * Returns all listings (used by Backoffice admin operations).
   */
  public getAllListings(): ManualListingRecord[] {
    return Array.from(this.listings.values());
  }

  /**
   * Returns a specific listing by its unique identifier.
   */
  public getListingById(id: string): ManualListingRecord | undefined {
    return this.listings.get(id);
  }

  public getListing(id: string): ManualListingRecord | undefined {
    return this.getListingById(id);
  }

  public updateListingStatus(
    id: string,
    newStatus: ManualListingStatus,
    reason = 'Status changed via backoffice'
  ): boolean {
    return this.updateStatus(id, newStatus, { id: 'usr_admin_ops', name: 'Operations Admin' }, reason);
  }

  public updateListingPricing(
    id: string,
    pricingUpdate: { manualOverrideAmount?: number; overrideReason?: string }
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;
    if (pricingUpdate.manualOverrideAmount !== undefined) {
      listing.standardSellingPriceLkr = pricingUpdate.manualOverrideAmount;
    }
    return true;
  }

  /**
   * Immediate operational Stop-Sell suspension toggle (GPT Audit v2.2)
   */
  public toggleStopSale(
    id: string,
    adminUser: { id: string; name: string },
    reason?: string
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    listing.isStopSaleActive = !listing.isStopSaleActive;
    listing.auditTrail.push({
      action: listing.isStopSaleActive ? 'STOP_SALE_ACTIVATED' : 'STOP_SALE_LIFTED',
      changedBy: `${adminUser.name} (${adminUser.id})`,
      timestampIso: new Date().toISOString(),
      note: reason || (listing.isStopSaleActive ? 'Operational stop-sale suspended inventory' : 'Stop-sale lifted by administrator')
    });
    return true;
  }

  /**
   * Updates allotment quota with audit trail.
   */
  public updateAllotment(
    id: string,
    newQuota: number,
    adminUser: { id: string; name: string },
    reason?: string
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    const oldQuota = listing.availableQuota;
    listing.availableQuota = newQuota;
    listing.auditTrail.push({
      action: `ALLOTMENT_UPDATED: ${oldQuota} -> ${newQuota}`,
      changedBy: `${adminUser.name} (${adminUser.id})`,
      timestampIso: new Date().toISOString(),
      note: reason
    });
    return true;
  }

  /**
   * Updates blackout dates with audit trail.
   */
  public updateBlackoutDates(
    id: string,
    blackoutDates: string[],
    adminUser: { id: string; name: string }
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    listing.blackoutDates = [...blackoutDates];
    listing.auditTrail.push({
      action: `BLACKOUT_DATES_UPDATED: count=${blackoutDates.length}`,
      changedBy: `${adminUser.name} (${adminUser.id})`,
      timestampIso: new Date().toISOString()
    });
    return true;
  }

  /**
   * Updates listing attributes with Anti-Tamper Demotion Governance.
   * If commercial or rate terms change on an ACTIVE or PUBLISHED listing,
   * its status automatically demotes to DRAFT, requiring independent
   * re-verification before it can be sold again.
   */
  public updateListingAttributes(
    id: string,
    patch: Partial<ManualListingRecord>,
    adminUser: { id: string; name: string; permissions?: string[] },
    reason?: string
  ): ManualListingRecord {
    const listing = this.listings.get(id);
    if (!listing) {
      throw new Error(`Listing '${id}' not found.`);
    }

    const wasPublished = listing.status === 'PUBLISHED' || listing.status === 'ACTIVE';
    const isCommercialOrRateChanged =
      (patch.contractedBaseCost !== undefined && patch.contractedBaseCost !== listing.contractedBaseCost) ||
      (patch.standardSellingPriceLkr !== undefined && patch.standardSellingPriceLkr !== listing.standardSellingPriceLkr) ||
      (patch.cancellationPolicy !== undefined && patch.cancellationPolicy !== listing.cancellationPolicy) ||
      (patch.contractReference !== undefined && patch.contractReference !== listing.contractReference) ||
      (patch.partnerSupplierId !== undefined && patch.partnerSupplierId !== listing.partnerSupplierId);

    Object.assign(listing, patch);
    listing.updatedAtIso = new Date().toISOString();
    listing.lastEditedBy = `${adminUser.name} (${adminUser.id})`;

    if (wasPublished && isCommercialOrRateChanged) {
      listing.status = 'DRAFT';
      if (listing.readinessTier) {
        listing.readinessTier.productionSellable = false;
        listing.readinessTier.commercialReady = false;
      }
      if (listing.commercialEvidence) {
        listing.commercialEvidence.isEvidenceVerified = false;
      }
      listing.auditTrail.push({
        action: 'ANTI_TAMPER_DEMOTION_TO_DRAFT',
        changedBy: `${adminUser.name} (${adminUser.id})`,
        timestampIso: new Date().toISOString(),
        note: reason || 'Anti-Tamper Governance: Critical commercial/pricing terms modified on live listing. Demoted to DRAFT for re-verification.'
      });
    } else {
      listing.auditTrail.push({
        action: 'ATTRIBUTES_UPDATED',
        changedBy: `${adminUser.name} (${adminUser.id})`,
        timestampIso: new Date().toISOString(),
        note: reason || 'Updated listing attributes'
      });
    }

    return listing;
  }

  /**
   * Returns normalized Vacatina offers from manual listings ready for search aggregation.
   */
  public getNormalizedOffers(productType?: TravelProductSlug, destination?: string): VacatinaNormalizedOffer[] {
    const rawListings = this.queryListings({ productType, destination, onlyActive: true });
    return rawListings.map(listing => this.normalizeManualListing(listing));
  }

  /**
   * Normalizes a Payload CMS manual listing into a canonical Vacatina offer.
   */
  public normalizeManualListing(listing: ManualListingRecord): VacatinaNormalizedOffer {
    const baseOffer = InventoryNormalizerService.normalizeManualCmsListing({
      cmsCollection: listing.collection as any,
      cmsListingId: listing.id,
      productType: listing.productType,
      partnerSupplierId: listing.partnerSupplierId,
      partnerName: listing.partnerName,
      title: listing.title,
      subtitle: listing.subtitle,
      location: listing.location,
      confirmationMode: listing.confirmationMode,
      availableQuota: listing.availableQuota,
      contractedBaseCost: listing.contractedBaseCost,
      costCurrency: listing.costCurrency,
      standardSellingPriceLkr: listing.standardSellingPriceLkr,
      validFromIso: listing.validFromIso,
      validUntilIso: listing.validUntilIso,
      inclusions: listing.inclusions,
      exclusions: listing.exclusions,
      cancellationPolicy: listing.cancellationPolicy
    });

    baseOffer.slug = listing.slug;
    baseOffer.bookingMode = listing.bookingMode;
    baseOffer.pinPriority = listing.pinPriority || 0;
    baseOffer.featured = Boolean(listing.featured);
    baseOffer.exclusiveOffer = Boolean(listing.exclusiveOffer);
    baseOffer.isSeedContent = false;
    baseOffer.remainingUnits = listing.availableQuota;
    baseOffer.validFrom = listing.validFromIso;
    baseOffer.validUntil = listing.validUntilIso;

    return baseOffer;
  }

  /**
   * Administrative status change with mandatory audit record.
   */
  public updateStatus(
    id: string,
    newStatus: ManualListingStatus,
    adminUser: { id: string; name: string },
    reason?: string
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    const previousStatus = listing.status;
    listing.status = newStatus;

    if (!listing.readinessTier) {
      listing.readinessTier = {
        systemReady: true,
        sandboxReady: true,
        commercialReady: Boolean(listing.commercialEvidence?.isEvidenceVerified),
        productionSellable: false
      };
    }

    if (newStatus === 'COMMERCIALLY_VERIFIED') {
      listing.readinessTier.commercialReady = Boolean(listing.commercialEvidence?.isEvidenceVerified);
      listing.readinessTier.productionSellable = false;
    } else if (newStatus === 'ACTIVE' || newStatus === 'PUBLISHED') {
      listing.readinessTier.productionSellable = Boolean(
        listing.readinessTier.commercialReady && listing.commercialEvidence?.isEvidenceVerified
      );
    } else {
      listing.readinessTier.productionSellable = false;
    }

    listing.auditTrail.push({
      action: `STATUS_CHANGE: ${previousStatus} -> ${newStatus}`,
      changedBy: `${adminUser.name} (${adminUser.id})`,
      timestampIso: new Date().toISOString(),
      note: reason
    });

    return true;
  }

  /**
   * Registers or updates a manual listing.
   */
  public registerListing(listing: ManualListingRecord): void {
    if (!listing.inventoryClass) {
      listing.inventoryClass = 'SAMPLE_INVENTORY';
    }
    if (!listing.readinessTier) {
      listing.readinessTier = {
        systemReady: true,
        sandboxReady: true,
        commercialReady: Boolean(listing.commercialEvidence?.isEvidenceVerified),
        productionSellable: false
      };
    }
    this.listings.set(listing.id, listing);
  }

  /**
   * Creates a new manual listing in DRAFT status with initial audit trail.
   */
  public createListing(
    listingData: Omit<ManualListingRecord, 'status' | 'auditTrail' | 'createdAtIso' | 'updatedAtIso' | 'id' | 'slug'> & {
      id?: string;
      slug?: string;
    },
    adminUser: { id: string; name: string }
  ): ManualListingRecord {
    const nowIso = new Date().toISOString();
    const id = listingData.id || `lst_${listingData.productType}_${Date.now()}`;
    const slug = listingData.slug || listingData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const isCommercial = Boolean(listingData.commercialEvidence?.isEvidenceVerified);
    const newListing: ManualListingRecord = {
      ...listingData,
      id,
      slug,
      status: 'DRAFT',
      inventoryClass: listingData.inventoryClass || (isCommercial ? 'REAL_CONTRACTED' : 'SAMPLE_INVENTORY'),
      readinessTier: listingData.readinessTier || {
        systemReady: true,
        sandboxReady: true,
        commercialReady: isCommercial,
        productionSellable: false // DRAFT is not sellable until published
      },
      createdBy: `${adminUser.name} (${adminUser.id})`,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      auditTrail: [
        {
          action: 'LISTING_CREATED',
          changedBy: `${adminUser.name} (${adminUser.id})`,
          timestampIso: nowIso,
          note: 'Created listing in DRAFT status'
        }
      ]
    };
    this.listings.set(newListing.id, newListing);
    return newListing;
  }

  /**
   * Transitions listing to ARCHIVED status.
   */
  public archiveListing(
    id: string,
    adminUser: { id: string; name: string },
    reason?: string
  ): boolean {
    return this.updateStatus(id, 'ARCHIVED', adminUser, reason || 'Archived listing');
  }

  /**
   * Stage 1 -> 2: Operator submits DRAFT listing for commercial verification.
   */
  public submitForVerification(
    id: string,
    operator: { id: string; name: string; permissions?: string[] }
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;
    if (listing.status !== 'DRAFT' && listing.status !== 'CONTRACT_PENDING') {
      throw new Error(`Cannot submit listing in '${listing.status}' status for verification.`);
    }

    listing.status = 'VERIFICATION_PENDING';
    listing.auditTrail.push({
      action: 'SUBMITTED_FOR_COMMERCIAL_VERIFICATION',
      changedBy: `${operator.name} (${operator.id})`,
      timestampIso: new Date().toISOString(),
      note: 'Listing and contract evidence submitted for independent commercial verification'
    });
    return true;
  }

  /**
   * Stage 2: Commercial Verification by Contracting Officer / Commercial Risk Officer.
   * Enforces 4-Eyes Principle: Listing creator cannot verify their own contract!
   */
  public verifyCommercialContract(
    id: string,
    verifier: { id: string; name: string; permissions?: string[] },
    evidence: CommercialEvidenceDossier
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    // Separation of Duties Invariant: Low-privilege creator cannot self-verify
    const isCreator = listing.createdBy && (listing.createdBy.includes(verifier.id) || listing.createdBy === verifier.id);
    const hasSuperAdmin = verifier.permissions?.includes('platform:system_admin');
    if (isCreator && !hasSuperAdmin) {
      throw new SeparationOfDutiesViolationError(
        `Separation of Duties Violation: Operator '${verifier.id}' who created listing '${id}' cannot independently verify its commercial contract. Requires independent commercial officer.`
      );
    }

    // Permission check
    if (verifier.permissions && !verifier.permissions.includes('cms:verify_commercial') && !hasSuperAdmin) {
      throw new Error(`Permission Denied: User lacks 'cms:verify_commercial' capability.`);
    }

    // Evidence completeness check
    if (!evidence.contractReference || !evidence.supplierLegalName || !evidence.settlementTerms || !evidence.isEvidenceVerified) {
      throw new Error(`Commercial Verification Invariant: Evidence dossier incomplete or unverified.`);
    }

    listing.commercialEvidence = { ...evidence };
    listing.inventoryClass = 'REAL_CONTRACTED';
    listing.verifiedBy = `${verifier.name} (${verifier.id})`;
    listing.status = 'COMMERCIALLY_VERIFIED';
    if (!listing.readinessTier) {
      listing.readinessTier = { systemReady: true, sandboxReady: true, commercialReady: true, productionSellable: false };
    } else {
      listing.readinessTier.commercialReady = true;
      listing.readinessTier.productionSellable = false; // Requires separate pricing approval & publishing
    }

    listing.auditTrail.push({
      action: 'COMMERCIALLY_VERIFIED',
      changedBy: `${verifier.name} (${verifier.id})`,
      timestampIso: new Date().toISOString(),
      note: `Contract ${evidence.contractReference} verified with legal name '${evidence.supplierLegalName}'.`
    });
    return true;
  }

  /**
   * Stage 3: Pricing Approval by Finance / Pricing Lead.
   */
  public approvePricingStructure(
    id: string,
    approver: { id: string; name: string; permissions?: string[] },
    pricingUpdate?: { markupPercent?: number; standardSellingPriceLkr?: number; note?: string }
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    const hasSuperAdmin = approver.permissions?.includes('platform:system_admin');
    if (approver.permissions && !approver.permissions.includes('cms:approve_pricing') && !hasSuperAdmin) {
      throw new Error(`Permission Denied: User lacks 'cms:approve_pricing' capability.`);
    }

    if (pricingUpdate?.markupPercent !== undefined) {
      listing.markupPercent = pricingUpdate.markupPercent;
    }
    if (pricingUpdate?.standardSellingPriceLkr !== undefined) {
      listing.standardSellingPriceLkr = pricingUpdate.standardSellingPriceLkr;
    }

    listing.pricingApprovedBy = `${approver.name} (${approver.id})`;
    listing.isPricingApproved = true;

    listing.auditTrail.push({
      action: 'PRICING_STRUCTURE_APPROVED',
      changedBy: `${approver.name} (${approver.id})`,
      timestampIso: new Date().toISOString(),
      note: pricingUpdate?.note || `Pricing structure approved: base=${listing.contractedBaseCost}, selling=${listing.standardSellingPriceLkr}`
    });
    return true;
  }

  /**
   * Stage 4: Publishing by Commercial Director / CMS Publisher.
   * Enforces 4-Eyes Principle: Cannot be published by creator or verifier without super-admin override.
   */
  public publishListing(
    id: string,
    publisher: { id: string; name: string; permissions?: string[] }
  ): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    const hasSuperAdmin = publisher.permissions?.includes('platform:system_admin');

    // Separation of Duties Invariant: Low-privilege creator or verifier cannot independently publish
    const isCreator = listing.createdBy && (listing.createdBy.includes(publisher.id) || listing.createdBy === publisher.id);
    const isVerifier = listing.verifiedBy && (listing.verifiedBy.includes(publisher.id) || listing.verifiedBy === publisher.id);
    if ((isCreator || isVerifier) && !hasSuperAdmin) {
      throw new SeparationOfDutiesViolationError(
        `Separation of Duties Violation: Publisher '${publisher.id}' created or verified listing '${id}'. Final publishing requires independent publishing officer.`
      );
    }

    if (publisher.permissions && !publisher.permissions.includes('cms:publish_listings') && !hasSuperAdmin) {
      throw new Error(`Permission Denied: User lacks 'cms:publish_listings' capability.`);
    }

    // Verification and commercial checks
    if (listing.status !== 'COMMERCIALLY_VERIFIED') {
      throw new Error(`Publishing Invariant: Listing must be 'COMMERCIALLY_VERIFIED' before publishing. Current status: '${listing.status}'.`);
    }
    if (!listing.commercialEvidence?.isEvidenceVerified || !listing.readinessTier?.commercialReady) {
      throw new Error(`Publishing Invariant: Commercial contract evidence is not verified.`);
    }

    // Set published
    listing.publishedBy = `${publisher.name} (${publisher.id})`;
    listing.status = 'ACTIVE';
    listing.readinessTier.productionSellable = true;

    listing.auditTrail.push({
      action: 'LISTING_PUBLISHED_TO_PRODUCTION',
      changedBy: `${publisher.name} (${publisher.id})`,
      timestampIso: new Date().toISOString(),
      note: 'Listing published to live production sales channel'
    });
    return true;
  }
}

// Canonical manual listings seed database
export const CANONICAL_MANUAL_LISTINGS: ManualListingRecord[] = [
  {
    id: 'charter-cmb-mle-airtaxi',
    collection: 'manual-charter-flights',
    productType: 'flights',
    canonicalEntityId: 'ent_fl_cmb_mle_airtaxi',
    partnerSupplierId: 'DIRECT_CHARTER_DESK',
    partnerName: 'Verified Direct Contract Flight Operations',
    supplierLegalName: 'Vacatina Aviation & Seaplane Operations Desk',
    supplierTaxId: 'TIN-LK-DIR-CHARTER',
    supplierContactEmail: 'charters@direct-desk.vacatina.com',
    contractReference: 'CNT-DIR-CHARTER-2026-Q4',
    effectiveFromIso: '2026-10-01T00:00:00Z',
    effectiveToIso: '2026-12-31T23:59:59Z',
    title: 'Colombo to Maldives Seaplane Charter',
    subtitle: 'Twin Otter Floatplane · Private Lagoon Transfer · On-Demand Departure',
    slug: 'colombo-maldives-seaplane-charter',
    location: { city: 'Male', country: 'Maldives', countryCode: 'MV', iataCode: 'MLE' },
    status: 'PUBLISHED',
    confirmationMode: 'REQUEST_TO_CONFIRM',
    bookingMode: 'REQUEST_TO_BOOK',
    availableQuota: 6,
    allotmentTotal: 10,
    minLeadDays: 1,
    contractedBaseCost: 195000,
    costCurrency: 'LKR',
    sellingCurrency: 'LKR',
    markupPercent: 15.38,
    commissionPercent: 5.0,
    standardSellingPriceLkr: 225000,
    isTaxInclusive: true,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    salesValidFromIso: '2026-10-01T00:00:00Z',
    salesValidUntilIso: '2026-12-31T23:59:59Z',
    travelValidFromIso: '2026-10-01T00:00:00Z',
    travelValidUntilIso: '2026-12-31T23:59:59Z',
    blackoutDates: ['2026-12-25', '2026-12-31'],
    isStopSaleActive: false,
    partnerSlaHours: 4,
    freeCancellationDeadlineHours: 72,
    maxOccupancy: 8,
    inclusions: ['Direct lagoon water landing', 'Luggage handling up to 25kg per guest', 'VIP lounge access in Colombo'],
    exclusions: ['Overweight baggage beyond 25kg', 'Night flight operations (daylight only)'],
    cancellationPolicy: 'Full refund up to 72 hours prior to scheduled departure time.',
    pinPriority: 10,
    exclusiveOffer: true,
    featured: true,
    createdBy: 'Admin (System)',
    createdAtIso: '2026-10-24T00:00:00Z',
    updatedAtIso: '2026-10-24T00:00:00Z',
    inventoryClass: 'SAMPLE_INVENTORY',
    readinessTier: {
      systemReady: true,
      sandboxReady: true,
      commercialReady: false,
      productionSellable: false
    },
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Direct seasonal charter contract' }
    ]
  },
  {
    id: 'heritance-kandalama-signature',
    collection: 'contracted-boutique-hotels',
    productType: 'hotels',
    canonicalEntityId: 'ent_ht_kandalama_direct',
    partnerSupplierId: 'DIRECT_HOTEL_DESK',
    partnerName: 'Direct Hotel Allotment Partner',
    supplierLegalName: 'Boutique Eco-Luxury Resort Operations',
    supplierTaxId: 'TIN-LK-DIR-HOTEL',
    supplierContactEmail: 'contracts@direct-desk.vacatina.com',
    contractReference: 'CNT-DIR-HOTEL-2026-A',
    effectiveFromIso: '2026-10-01T00:00:00Z',
    effectiveToIso: '2026-12-31T23:59:59Z',
    title: 'Heritance Kandalama Eco-Luxury Resort',
    subtitle: 'Deluxe Lake View Wing · Geoffrey Bawa Architectural Masterpiece',
    slug: 'heritance-kandalama-eco-luxury-resort',
    location: { city: 'Dambulla', country: 'Sri Lanka', countryCode: 'LK', regionHint: 'Cultural Triangle' },
    status: 'PUBLISHED',
    confirmationMode: 'INSTANT_CONFIRM',
    bookingMode: 'INSTANT_BOOK',
    availableQuota: 12,
    allotmentTotal: 15,
    minLeadDays: 0,
    contractedBaseCost: 78000,
    costCurrency: 'LKR',
    sellingCurrency: 'LKR',
    markupPercent: 14.1,
    standardSellingPriceLkr: 89000,
    isTaxInclusive: true,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    salesValidFromIso: '2026-10-01T00:00:00Z',
    salesValidUntilIso: '2026-12-31T23:59:59Z',
    travelValidFromIso: '2026-10-01T00:00:00Z',
    travelValidUntilIso: '2026-12-31T23:59:59Z',
    blackoutDates: [],
    isStopSaleActive: false,
    partnerSlaHours: 2,
    freeCancellationDeadlineHours: 48,
    maxOccupancy: 2,
    inclusions: ['Breakfast buffet included', 'Forest lake birdwatching trail guide', 'Complimentary infinity pool access'],
    exclusions: ['Spa treatments and alcohol'],
    cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in date.',
    pinPriority: 15,
    exclusiveOffer: true,
    featured: true,
    createdBy: 'Admin (System)',
    createdAtIso: '2026-10-24T00:00:00Z',
    updatedAtIso: '2026-10-24T00:00:00Z',
    inventoryClass: 'SAMPLE_INVENTORY',
    readinessTier: {
      systemReady: true,
      sandboxReady: true,
      commercialReady: false,
      productionSellable: false
    },
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Direct luxury resort contract' }
    ]
  },
  {
    id: 'careem_fleet_dxb-dubai-airport-mercedes-transfer',
    collection: 'manual-ground-mobility',
    productType: 'cars',
    canonicalEntityId: 'ent_cr_careem_dxb_transfer',
    partnerSupplierId: 'DIRECT_TRANSFER_DESK',
    partnerName: 'Manual Transfer Contract Inventory',
    supplierLegalName: 'Executive Chauffeur Logistics Desk',
    supplierTaxId: 'TRN-AE-DIR-TRANSFER',
    supplierContactEmail: 'transfers@direct-desk.vacatina.com',
    contractReference: 'CNT-DIR-TRANSFER-2026',
    effectiveFromIso: '2026-10-01T00:00:00Z',
    effectiveToIso: '2026-12-31T23:59:59Z',
    title: 'Dubai Airport (DXB) to Downtown Luxury Chauffeur',
    subtitle: 'Mercedes-Benz E-Class · Flight Tracked Meet & Greet · Highway Tolls Included',
    slug: 'dubai-airport-mercedes-chauffeur-transfer',
    location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', iataCode: 'DXB' },
    status: 'PUBLISHED',
    confirmationMode: 'INSTANT_CONFIRM',
    bookingMode: 'INSTANT_BOOK',
    availableQuota: 25,
    allotmentTotal: 30,
    contractedBaseCost: 22000,
    costCurrency: 'LKR',
    sellingCurrency: 'LKR',
    markupPercent: 20.45,
    standardSellingPriceLkr: 26500,
    isTaxInclusive: true,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    salesValidFromIso: '2026-10-01T00:00:00Z',
    salesValidUntilIso: '2026-12-31T23:59:59Z',
    travelValidFromIso: '2026-10-01T00:00:00Z',
    travelValidUntilIso: '2026-12-31T23:59:59Z',
    blackoutDates: [],
    isStopSaleActive: false,
    partnerSlaHours: 1,
    freeCancellationDeadlineHours: 4,
    maxOccupancy: 3,
    inclusions: ['Flight arrival tracking & 60-min complimentary wait time', 'Salik road tolls and airport parking fees', 'Bottled water and mobile device chargers on board'],
    exclusions: ['Additional passenger stops beyond primary hotel destination'],
    cancellationPolicy: 'Free cancellation up to 4 hours before flight arrival.',
    pinPriority: 5,
    exclusiveOffer: false,
    featured: true,
    createdBy: 'Admin (System)',
    createdAtIso: '2026-10-24T00:00:00Z',
    updatedAtIso: '2026-10-24T00:00:00Z',
    inventoryClass: 'SAMPLE_INVENTORY',
    readinessTier: {
      systemReady: true,
      sandboxReady: true,
      commercialReady: false,
      productionSellable: false
    },
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Direct ground transport contract' }
    ]
  },
  {
    id: 'verified-boutique-villa-mirissa',
    collection: 'contracted-boutique-hotels',
    productType: 'hotels',
    canonicalEntityId: 'ent_ht_mirissa_boutique_villa',
    partnerSupplierId: 'DIRECT_HOTEL_DESK',
    partnerName: 'Direct Hotel Allotment Partner',
    supplierLegalName: 'Mirissa Ocean Horizon Private Limited',
    supplierTaxId: 'TIN-LK-DIR-MIRISSA-901',
    supplierContactEmail: 'contracts@oceanhorizon.vacatina.com',
    contractReference: 'CNT-DIR-HOTEL-2026-MIRISSA',
    effectiveFromIso: '2026-10-01T00:00:00Z',
    effectiveToIso: '2026-12-31T23:59:59Z',
    title: 'Ocean Horizon Luxury Boutique Villa Mirissa',
    subtitle: 'Private Oceanfront Suite · Panoramic Indian Ocean Balcony',
    slug: 'ocean-horizon-luxury-boutique-villa-mirissa',
    location: { city: 'Mirissa', country: 'Sri Lanka', countryCode: 'LK', regionHint: 'Southern Province' },
    status: 'PUBLISHED',
    confirmationMode: 'INSTANT_CONFIRM',
    bookingMode: 'INSTANT_BOOK',
    availableQuota: 5,
    allotmentTotal: 8,
    minLeadDays: 0,
    contractedBaseCost: 65000,
    costCurrency: 'LKR',
    sellingCurrency: 'LKR',
    markupPercent: 15.38,
    standardSellingPriceLkr: 75000,
    isTaxInclusive: true,
    validFromIso: '2026-10-01T00:00:00Z',
    validUntilIso: '2026-12-31T23:59:59Z',
    salesValidFromIso: '2026-10-01T00:00:00Z',
    salesValidUntilIso: '2026-12-31T23:59:59Z',
    travelValidFromIso: '2026-10-01T00:00:00Z',
    travelValidUntilIso: '2026-12-31T23:59:59Z',
    blackoutDates: [],
    isStopSaleActive: false,
    partnerSlaHours: 2,
    freeCancellationDeadlineHours: 48,
    maxOccupancy: 2,
    inclusions: ['A la carte oceanfront breakfast', 'Sunset rooftop tea experience', 'Complimentary beach equipment'],
    exclusions: ['Alcohol and motorized watersports'],
    cancellationPolicy: 'Free cancellation up to 48 hours prior to check-in.',
    pinPriority: 20,
    exclusiveOffer: true,
    featured: true,
    createdBy: 'Admin (System)',
    createdAtIso: '2026-10-24T00:00:00Z',
    updatedAtIso: '2026-10-24T00:00:00Z',
    inventoryClass: 'SAMPLE_INVENTORY',
    readinessTier: {
      systemReady: true,
      sandboxReady: true,
      commercialReady: false,
      productionSellable: false
    },
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Sample demonstration listing. Physical legal contract and bilateral rate sheet counter-signature pending before commercial activation.' }
    ]
  }
];

export const manualInventoryService = new ManualInventoryService(CANONICAL_MANUAL_LISTINGS);
