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

  // 18. Audit & Approver History
  createdBy?: string;
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
}

export class ManualInventoryService {
  private listings: Map<string, ManualListingRecord> = new Map();

  constructor(initialSeed: ManualListingRecord[] = []) {
    initialSeed.forEach(listing => this.listings.set(listing.id, listing));
  }

  /**
   * Returns all listings matching status (defaults to PUBLISHED for customer queries).
   */
  public queryListings(filter: {
    productType?: TravelProductSlug;
    destination?: string;
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

    // Filter out expired items or stopped sales for active queries
    if (filter.onlyActive !== false) {
      list = list.filter(l => l.validUntilIso >= nowIso && l.availableQuota > 0 && !l.isStopSaleActive);
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
      cmsCollection: listing.collection,
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
    this.listings.set(listing.id, listing);
  }
}

// Canonical manual listings seed database
export const CANONICAL_MANUAL_LISTINGS: ManualListingRecord[] = [
  {
    id: 'charter-cmb-mle-airtaxi',
    collection: 'manual-charter-flights',
    productType: 'flights',
    canonicalEntityId: 'ent_fl_cmb_mle_airtaxi',
    partnerSupplierId: 'SRILANKAN_AIRTAXI',
    partnerName: 'SriLankan AirTaxi Charter Operations',
    supplierLegalName: 'SriLankan Airlines Limited',
    supplierTaxId: 'TIN-LK-9021481',
    supplierContactEmail: 'charters@srilankan.com',
    contractReference: 'CNT-AIRTAXI-2026-Q4',
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
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Direct seasonal charter contract' }
    ]
  },
  {
    id: 'heritance-kandalama-signature',
    collection: 'contracted-boutique-hotels',
    productType: 'hotels',
    canonicalEntityId: 'ent_ht_kandalama_direct',
    partnerSupplierId: 'AITKEN_SPENCE_DIRECT',
    partnerName: 'Heritance Kandalama Direct Contract',
    supplierLegalName: 'Aitken Spence Hotel Holdings PLC',
    supplierTaxId: 'TIN-LK-8830114',
    supplierContactEmail: 'contracts@heritancehotels.com',
    contractReference: 'CNT-KANDALAMA-2026-A',
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
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z', note: 'Direct luxury resort contract' }
    ]
  },
  {
    id: 'careem_fleet_dxb-dubai-airport-mercedes-transfer',
    collection: 'manual-ground-mobility',
    productType: 'cars',
    canonicalEntityId: 'ent_cr_careem_dxb_transfer',
    partnerSupplierId: 'CAREEM_FLEET_DXB',
    partnerName: 'Dubai Premium Chauffeur Logistics',
    supplierLegalName: 'Careem Networks FZ LLC',
    supplierTaxId: 'TRN-AE-100294812300003',
    supplierContactEmail: 'fleet-b2b@careem.com',
    contractReference: 'CNT-CAREEM-DXB-2026',
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
    auditTrail: [
      { action: 'INITIAL_IMPORT', changedBy: 'Admin (System)', timestampIso: '2026-10-24T00:00:00Z' }
    ]
  }
];

export const manualInventoryService = new ManualInventoryService(CANONICAL_MANUAL_LISTINGS);
