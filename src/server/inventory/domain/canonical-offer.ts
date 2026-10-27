/* ============================================================================
 * Vacatina Canonical Inventory & Universal Offer Model
 * Authority: VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0 & ADR-006 through ADR-009
 *
 * Requirements:
 * 1. Defines the canonical inventory source model across MANUAL, API, and HYBRID.
 * 2. Defines the 6-state canonical offer lifecycle:
 *    DISCOVERABLE -> AVAILABLE -> NEEDS_RECHECK -> PRICE_CHANGED -> UNAVAILABLE -> EXPIRED.
 * 3. Enforces the stable-ID contract:
 *    offerId, productType, supplierId, price, currency, availabilityStatus, lastCheckedAt.
 * 4. Normalizes all product verticals (Flights, Hotels, Cars, Packages, Visas,
 *    Rails, Cruises, Activities, Sightseeing, Insurance) into one unified shape.
 * ============================================================================ */

import type { TravelProductSlug } from '../types.ts';

// ----------------------------------------------------------------------------
// 1. Source Classification & Lifecycle States
// ----------------------------------------------------------------------------

/**
 * Consumer-facing provenance of a UnifiedCanonicalOffer.
 *
 * This is intentionally distinct from `CanonicalInventorySourceType` in
 * `../types.ts`, which remains the authoritative 5-type persisted inventory
 * taxonomy used by the Commercial Truth Gate and supplier certification.
 * Supplier adapters must use that taxonomy for inventory records and this
 * type only for the consumer offer contract.
 */
export type CanonicalOfferSourceType =
  | 'API'
  | 'MANUAL'
  | 'DIRECT_CONTRACT'
  | 'COMPOSITE'
  | 'HYBRID'
  | 'SEED';

export type CanonicalOfferLifecycleStatus =
  | 'DISCOVERABLE'
  | 'AVAILABLE'
  | 'ON_REQUEST'
  | 'LOW_ALLOTMENT'
  | 'SOLD_OUT'
  | 'NEEDS_RECHECK'
  | 'PRICE_CHANGED'
  | 'UNAVAILABLE'
  | 'EXPIRED';

export type ManualListingStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'FINANCE_APPROVED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'ARCHIVED';

// ----------------------------------------------------------------------------
// 1b. Composite Package & Rate Option Types
// ----------------------------------------------------------------------------

export interface CompositeComponentDescriptor {
  componentType: 'flight' | 'hotel' | 'transfer' | 'activity' | 'visa';
  sourceType: CanonicalOfferSourceType;
  supplierId: string;
  title: string;
  externalOfferId?: string;
  unitPriceMinor: number;
  currency: string;
  status: CanonicalOfferLifecycleStatus;
  isRequired: boolean;
  revalidationStatus?: 'VALID' | 'PRICE_CHANGED' | 'UNAVAILABLE';
}

export interface CanonicalRateOption {
  rateId: string;
  sourceType: CanonicalOfferSourceType;
  supplierId: string;
  supplierName: string;
  roomType?: string;
  fareClass?: string;
  priceMinor: number;
  currency: string;
  isBestPrice: boolean;
  isDirectContract: boolean;
  cancellationPolicy: string;
  inclusions: string[];
  bookingMode: 'INSTANT_BOOK' | 'ALLOTMENT_HOLD' | 'ON_REQUEST_CONCIERGE';
  revalidationRequired: boolean;
  travelCreditEligible: boolean;
}

export interface CanonicalPricing {
  baseCostMinor: number;
  sellingPriceMinor: number;
  currency: string;
  taxInclusive: boolean;
  markupMinor: number;
  breakdown?: {
    baseMinor: number;
    taxesMinor: number;
    markupMinor: number;
    totalMinor: number;
    currency: string;
  };
}

export interface CanonicalMarkup {
  markupType: 'PERCENTAGE' | 'FIXED';
  markupValue: number;
  appliedMarkupMinor: number;
}

export interface CanonicalTravelCreditPolicy {
  eligible: boolean;
  applicableCreditTypes?: Array<'REFUND_CREDIT' | 'PROMOTIONAL_CREDIT' | 'SERVICE_CREDIT'>;
  maxApplicationMinor?: number;
  maxApplicationPercentage?: number;
  exclusionReason?: string;
}

// ----------------------------------------------------------------------------
// 2. Canonical Inventory Source Record (Persistent Layer Contract)
// ----------------------------------------------------------------------------

export interface CanonicalInventoryListing {
  // Mandatory 16 fields specified by authority
  sourceType: CanonicalOfferSourceType;
  productType: TravelProductSlug;
  listingId: string;
  supplierId: string;
  providerId: string;
  externalOfferId?: string;
  status: ManualListingStatus;
  market: string;                               // e.g. 'LK', 'AE', 'UK', 'GLOBAL'
  currency: string;                             // ISO 4217, e.g. 'LKR', 'USD'
  basePrice: number;                            // In standard units (e.g. 150.00 USD, 45000.00 LKR)
  availabilityStatus: CanonicalOfferLifecycleStatus;
  lastSyncedAt: string;                         // ISO 8601 UTC
  lastCheckedAt: string;                        // ISO 8601 UTC
  validFrom: string;                            // ISO 8601 UTC
  validTo: string;                              // ISO 8601 UTC
  createdBy: string;
  updatedBy: string;

  // Extended Commercial & Operational attributes
  canonicalEntityId: string;
  title: string;
  description: string;
  destination: string;
  origin?: string;
  contractedBaseCostMinor: number;
  markupMinor: number;
  sellingPriceMinor: number;
  totalQuota: number;
  availableQuota: number;
  isStopSaleActive: boolean;
  stopSaleReason?: string;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  refundability: 'NON_REFUNDABLE' | 'REFUNDABLE' | 'CONDITIONAL';
  media: {
    heroImageUrl: string;
    galleryUrls: string[];
  };
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// 3. Unified Canonical Offer (Consumer & Search Results Contract)
// ----------------------------------------------------------------------------

export interface UnifiedCanonicalOffer {
  // Stable Identifiers
  offerId: string;                              // Universal stable identifier (e.g. 'vct-man-colombo-kingsbury-deluxe')
  productId?: string;                           // Canonical product/property ID for deduplication (e.g. 'vct-htl-atlantis-the-palm')
  productType: TravelProductSlug;
  sourceType: CanonicalOfferSourceType;
  supplierId: string;                           // e.g. 'VACATINA_DIRECT', 'LITEAPI', 'DUFFEL'
  providerId: string;                           // e.g. 'manual_cms', 'liteapi_v2', 'duffel_ndc'
  externalOfferId?: string;                     // Upstream raw reference
  sourceListingId?: string;                     // CMS listing ID if originating from manual contract

  // Core Product & Destination Info
  title: string;
  subtitle: string;
  destinationId: string;
  destinationIds?: string[];
  originId?: string;
  travelDates?: {
    departureDate?: string;
    returnDate?: string;
    checkIn?: string;
    checkOut?: string;
    durationDays?: number;
  };
  location: {
    city: string;
    country: string;
    address?: string;
    coordinates?: { latitude: number; longitude: number };
  };

  // Pricing Contract (Customer Facing)
  price: number;                                // Major units for display (e.g. 89000)
  currency: string;                             // e.g. 'LKR', 'USD'
  basePrice: number;
  taxAmount: number;
  feeAmount: number;
  priceBreakdown: {
    baseMinor: number;
    taxesMinor: number;
    markupMinor: number;
    totalMinor: number;
    currency: string;
  };
  pricing?: CanonicalPricing;
  markup?: CanonicalMarkup;
  isTaxInclusive: boolean;

  // Lifecycle, Availability & Freshness
  availabilityStatus: CanonicalOfferLifecycleStatus;
  lastCheckedAt: string;                        // ISO 8601 UTC
  lastSyncedAt: string;                         // ISO 8601 UTC
  validUntil: string;                           // ISO 8601 UTC
  revalidateAt?: string;                        // ISO 8601 UTC Freshness revalidation threshold
  freshnessTtlSeconds: number;                  // Validity threshold in seconds (e.g. 900 for flights, 3600 for hotels)
  isStale: boolean;

  // Policies & Requirements
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: {
    isRefundable: boolean;
    policyText: string;
    deadlineIso?: string;
    penaltyMinor?: number;
  };
  cancellationTerms?: {
    policyType: string;
    isRefundable: boolean;
    deadlineIso?: string;
    penaltyMinor?: number;
    description: string;
  };
  confirmationMode: 'INSTANT' | 'ON_REQUEST' | 'ASSISTED';
  bookingMode: 'DIRECT_BOOKING' | 'REQUEST_TO_BOOK' | 'INQUIRY_ONLY' | 'INSTANT_BOOK' | 'ALLOTMENT_HOLD' | 'ON_REQUEST_CONCIERGE';
  fulfilmentMode?: 'AUTOMATED_SUPPLIER_API' | 'MANUAL_CONCIERGE_OPS' | 'DIRECT_VOUCHER_DISPATCH' | 'HYBRID_FULFILLMENT';
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

  // Closed-Loop Travel Credit Policy
  travelCreditPolicy?: CanonicalTravelCreditPolicy;

  // Truthful Commercial Badges (e.g. "Vacatina Exclusive")
  badges?: Array<{
    text: string;
    variant: 'exclusive' | 'promotional' | 'featured' | 'verified';
  }>;

  // Composite Package Components (for COMPOSITE holiday packages)
  compositeComponents?: CompositeComponentDescriptor[];

  // Multi-Supplier Rate Options (for deduplicated canonical products)
  rateOptions?: CanonicalRateOption[];

  // Media
  media: {
    heroImageUrl: string;
    galleryUrls: string[];
  };

  // Booking & Revalidation Governance
  revalidationSupported: boolean;
  metadata: Record<string, unknown>;

  // Strict Production Safety Flag (MUST BE FALSE IN REAL COMMERCE)
  isSeed: boolean;
}

/**
 * Primary universal canonical offer alias.
 */
export type CanonicalOffer = UnifiedCanonicalOffer;

// ----------------------------------------------------------------------------
// 4. Revalidation Sagas Contract
// ----------------------------------------------------------------------------

export interface CanonicalRevalidationResult {
  offerId: string;
  status: CanonicalOfferLifecycleStatus;
  isPriceChanged: boolean;
  previousPriceMinor: number;
  newPriceMinor: number;
  currency: string;
  requiresUserAction: boolean;
  actionMessage?: string;
  revalidatedAt: string;
}

// ----------------------------------------------------------------------------
// 5. Query Criteria Contract
// ----------------------------------------------------------------------------

export interface CanonicalSearchCriteria {
  productType: TravelProductSlug;
  destination: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  travellers?: {
    adults: number;
    children?: number;
    infants?: number;
    rooms?: number;
  };
  cabinClass?: string;
  currency?: string;
  market?: string;
  channel?: 'B2C' | 'B2B';
  minPriceMinor?: number;
  maxPriceMinor?: number;
}
