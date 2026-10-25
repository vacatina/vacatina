/* ============================================================================
 * Vacatina Unified Inventory System — Canonical Types & Contracts
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md,
 *            docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md,
 *            docs/14_CANONICAL_INVENTORY_TAXONOMY_AND_ADMIN_CMS_SCHEMA.md,
 *            ADR-006 & ADR-007
 * ============================================================================ */

export type TravelProductSlug =
  | 'flights'
  | 'hotels'
  | 'visa'
  | 'packages'
  | 'cars'
  | 'rails'
  | 'cruises'
  | 'activities'
  | 'sightseeing'
  | 'insurance';

// ----------------------------------------------------------------------------
// 1. The 7 Orthogonal Canonical Inventory Dimensions
// ----------------------------------------------------------------------------

/**
 * Dimension 1: Origin/Source Channel
 */
export type InventorySource =
  | 'API'                 // External supplier/GDS/NDC/Bedbank
  | 'DIRECT_CONTRACT'    // Directly negotiated commercial contract managed in Admin/Payload CMS
  | 'MANUAL_INTERNAL'    // Internal operational workflow executed by Vacatina operations staff
  | 'PARTNER_MANUAL';    // External travel partner managing inventory via Vacatina Extranet

/**
 * Dimension 2: Listing Archetype & Purpose
 */
export type ListingKind =
  | 'DISCOVERY_CONTENT'  // Marketing cards, destination inspiration, teasers (never directly bookable)
  | 'SELLABLE_INVENTORY' // Physical inventory (seats, rooms, vehicles, berths)
  | 'SERVICE'            // Human/operational service (visa assistance, concierge, airport escort)
  | 'PACKAGE';           // Structured multi-day holiday packages

/**
 * Dimension 3: Product Composition Architecture
 */
export type CompositionType =
  | 'SINGLE'             // Standalone individual product
  | 'CURATED_PACKAGE'    // Fixed multi-day itinerary pre-assembled by Vacatina
  | 'DYNAMIC_BUNDLE';    // Algorithmic or user-assembled multi-product bundle (e.g. flight + hotel)

/**
 * Dimension 4: Operational Fulfillment Mechanism
 */
export type FulfillmentMode =
  | 'INSTANT'              // Instant electronic issuance upon payment
  | 'ON_REQUEST'           // Requires supplier / allotment allocation before final confirmation
  | 'MANUAL_CONFIRMATION'; // Requires manual human document check and consular/concierge review

/**
 * Dimension 5: Data Environment & Sandbox Isolation
 */
export type EnvironmentClass =
  | 'PRODUCTION' // Live commercial environment
  | 'SANDBOX'    // Safe test/simulated environment
  | 'SEED';      // Prototype accelerator / demo data, strictly isolated from checkout

/**
 * Dimension 6: Commercial Transactability / Sellability
 */
export type Sellability =
  | 'DISCOVERY_ONLY' // Non-purchasable informational teaser; click prefills real search
  | 'QUOTE_ONLY'     // Requires agent quotation before checkout
  | 'BOOKABLE';      // Directly purchasable online through Vacatina checkout

/**
 * Dimension 7: Upstream Provider Integration Lifecycle
 */
export type ProviderLifecycle =
  | 'PLANNED'         // Target provider identified, API documentation evaluated
  | 'SCAFFOLD'        // Typed adapter scaffolded with mock/simulated contracts
  | 'SANDBOX_ACTIVE'  // Live test API credentials connected and verified
  | 'CERTIFIED'       // Upstream provider compliance & certification testing passed
  | 'PRODUCTION_LIVE';// Commercial contract signed, live credentials active, financial settlement enabled

// Backward-compatible aliases for existing codebase and tests
export type InventorySourceType =
  | 'API'
  | 'DIRECT_CONTRACT'
  | 'MANUAL_SERVICE'
  | 'CURATED_PACKAGE'
  | 'HYBRID'
  | 'SEED'
  | 'MANUAL';

export type IntegrationLifecycleStatus =
  | 'PLANNED'
  | 'SCAFFOLD'
  | 'SANDBOX_ACTIVE'
  | 'CERTIFIED'
  | 'OPERATIONALLY_LIVE_MANUAL'
  | 'PRODUCTION_LIVE';

export type AvailabilityState =
  | 'LIVE'
  | 'CACHED'
  | 'MANUAL_AVAILABLE'
  | 'ON_REQUEST'
  | 'SOLD_OUT'
  | 'RATE_EXPIRED';

export type ConfirmationMode =
  | 'INSTANT_CONFIRM'
  | 'REQUEST_TO_CONFIRM'
  | 'ASSISTED_SERVICE';

export type BookingMode =
  | 'INSTANT_BOOK'
  | 'REQUEST_TO_BOOK'
  | 'REQUEST_AVAILABILITY'
  | 'INQUIRY_ONLY';

export interface StructuredLocation {
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  iataCode?: string;
  stationCode?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface PricingLayersEntity {
  rawSupplierCostMinor: number;     // Layer 1: Net Supplier Wholesale Cost
  rawCurrency: string;
  platformMarkupMinor: number;      // Layer 2: Global Vacatina B2C Margin
  b2bAgencyMarginMinor: number;     // Layer 3: Dynamic B2B Preferential Adjustment
  manualOverrideMinor?: number;     // Layer 4: Administrative Override (if active)
  overrideReason?: string;
  finalSellingPriceMinor: number;   // Calculated Customer Selling Price in Minor Units
  currency: string;
}

export interface PriceFreshnessEntity {
  lastCheckedAtIso: string;
  ttlSeconds: number;
  expiresAtIso: string;
  isStale: boolean;
  revalidationEndpoint: string;
}

/**
 * Identity of an individual sub-component within a DYNAMIC_BUNDLE
 */
export interface ComponentOfferIdentity {
  componentId: string;
  productType: TravelProductSlug;
  inventorySource: InventorySource;
  listingKind: ListingKind;
  compositionType: CompositionType;
  fulfillmentMode: FulfillmentMode;
  environmentClass: EnvironmentClass;
  sellability: Sellability;
  supplierId: string;
  supplierName: string;
  isSandboxSimulated: boolean;
  revalidationRequired: boolean;
}

export interface CanonicalOfferEntity {
  canonicalOfferId: string;         // Universal stable identifier, e.g. "vct-fl-duffel-cmb-dxb-98a7c2"
  productType: TravelProductSlug;

  // --- 7 Orthogonal Canonical Dimensions ---
  inventorySource: InventorySource;
  listingKind: ListingKind;
  compositionType: CompositionType;
  fulfillmentMode: FulfillmentMode;
  environmentClass: EnvironmentClass;
  sellability: Sellability;
  providerLifecycle: ProviderLifecycle;

  // --- Backward Compatibility Alias ---
  sourceType: InventorySourceType;

  // --- Heterogeneous components (for dynamic bundles) ---
  components?: ComponentOfferIdentity[];

  supplierId: string;               // e.g. "DUFFEL_NDC", "AMADEUS", "LITEAPI", "PAYLOAD_CMS_DIRECT"
  supplierName: string;
  supplierOfferId?: string;         // Upstream provider ID
  manualListingId?: string;         // Payload CMS document ID
  title: string;
  subtitle: string;
  location: StructuredLocation;
  availabilityStatus: AvailabilityState;
  confirmationMode: ConfirmationMode;
  bookingMode: BookingMode;
  pricing: PricingLayersEntity;
  freshness: PriceFreshnessEntity;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  pinAboveApi: boolean;             // Administrative priority ranking
  deduplicationKey: string;         // Composite natural deduplication key
  isSandboxSimulated: boolean;      // Truthful flag: true if rendered by mock/sandbox adapter
  integrationLifecycle: IntegrationLifecycleStatus;
  sourceMetadata: Record<string, unknown>;
  revalidationCapability: {
    canRevalidateOnline: boolean;
    requiresSupplierPing: boolean;
    lastRevalidationResult?: 'UNCHANGED' | 'PRICE_CHANGED' | 'UNAVAILABLE';
  };
}

export interface SearchQueryCriteria {
  productType: TravelProductSlug;
  origin?: string;
  destination: string;
  departureDate?: string; // YYYY-MM-DD
  returnDate?: string;    // YYYY-MM-DD
  adults?: number;
  children?: number;
  rooms?: number;
  cabinClass?: string;
  currency?: string;
  organizationId?: string; // For B2B agency tier pricing
  preferredSourceType?: InventorySourceType;
}

export interface RevalidationResult {
  offerId: string;
  status: 'UNCHANGED' | 'PRICE_CHANGED' | 'UNAVAILABLE';
  updatedOffer?: CanonicalOfferEntity;
  previousPriceMinor?: number;
  newPriceMinor?: number;
  message?: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerTelemetry {
  supplierId: string;
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
  totalCalls: number;
  successfulCalls: number;
}

// ----------------------------------------------------------------------------
// 2. Customer Badge Standards & Disclosure Safeguards (Rules 2 & 3)
// ----------------------------------------------------------------------------

export type CustomerBadge =
  | 'Live Availability'
  | 'Instant Confirmation'
  | 'On Request'
  | 'Vacatina Assisted'
  | 'Direct Rate'
  | 'Exclusive Direct Deal';

/**
 * Derives truthful, customer-facing commercial badges.
 * Statically prevents any internal technical taxonomy leakage to end-users.
 */
export function deriveCustomerBadges(offer: CanonicalOfferEntity): CustomerBadge[] {
  const badges: CustomerBadge[] = [];

  // 1. Live Availability: strictly only when live, fresh, and production
  if (offer.availabilityStatus === 'LIVE' && !offer.freshness.isStale && offer.environmentClass === 'PRODUCTION') {
    badges.push('Live Availability');
  }

  // 2. Operational fulfillment badge
  if (offer.fulfillmentMode === 'INSTANT' && offer.confirmationMode === 'INSTANT_CONFIRM') {
    badges.push('Instant Confirmation');
  } else if (offer.fulfillmentMode === 'ON_REQUEST' || offer.confirmationMode === 'REQUEST_TO_CONFIRM') {
    badges.push('On Request');
  } else if (offer.fulfillmentMode === 'MANUAL_CONFIRMATION' || offer.listingKind === 'SERVICE') {
    badges.push('Vacatina Assisted');
  }

  // 3. Direct Commercial relationship badge
  if (offer.inventorySource === 'DIRECT_CONTRACT') {
    badges.push('Direct Rate');
    if (offer.pinAboveApi) {
      badges.push('Exclusive Direct Deal');
    }
  }

  return badges;
}

/**
 * Verifies that an array of customer badges contains zero internal technical terms.
 */
export function validateNoTechnicalLeakInCustomerBadges(badges: string[]): boolean {
  const technicalLeakPatterns = [
    'API',
    'DIRECT_CONTRACT',
    'MANUAL_INTERNAL',
    'PARTNER_MANUAL',
    'SCAFFOLD',
    'SANDBOX',
    'SEED',
    'API Listing',
    'Manual Listing',
    'HYBRID',
    'SINGLE',
    'CURATED_PACKAGE',
    'DYNAMIC_BUNDLE'
  ];
  return !badges.some(badge =>
    technicalLeakPatterns.some(tech => badge.toUpperCase().includes(tech.toUpperCase()))
  );
}

// ----------------------------------------------------------------------------
// 3. Invariant Architectural Safeguards (Rule 14)
// ----------------------------------------------------------------------------

export class ArchitecturalInvariantViolationError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(`[ARCHITECTURAL_INVARIANT_VIOLATION:${code}] ${message}`);
    this.name = 'ArchitecturalInvariantViolationError';
    this.code = code;
  }
}

/**
 * Invariant 1: SEED cannot become BOOKABLE
 */
export function assertSeedCannotBeBookable(offer: { environmentClass: EnvironmentClass; sellability: Sellability }): void {
  if (offer.environmentClass === 'SEED' && offer.sellability === 'BOOKABLE') {
    throw new ArchitecturalInvariantViolationError(
      'SEED_CANNOT_BE_BOOKABLE',
      'Prototype / SEED data must never have sellability = BOOKABLE. SEED data must be DISCOVERY_ONLY.'
    );
  }
}

/**
 * Invariant 2: SEED cannot enter checkout
 */
export function assertSeedCannotEnterCheckout(offer: { environmentClass: EnvironmentClass; canonicalOfferId: string }): void {
  if (offer.environmentClass === 'SEED') {
    throw new ArchitecturalInvariantViolationError(
      'SEED_CHECKOUT_BLOCKED',
      `Offer '${offer.canonicalOfferId}' has environmentClass = 'SEED' and is strictly prohibited from entering checkout, payment, or booking.`
    );
  }
}

/**
 * Invariant 3: SCAFFOLD providers cannot create production bookings
 */
export function assertScaffoldCannotCreateProductionBooking(provider: {
  providerId: string;
  lifecycle: ProviderLifecycle;
  environment: EnvironmentClass;
}): void {
  if (provider.environment === 'PRODUCTION' && provider.lifecycle !== 'PRODUCTION_LIVE') {
    throw new ArchitecturalInvariantViolationError(
      'SCAFFOLD_PRODUCTION_BOOKING_BLOCKED',
      `Provider '${provider.providerId}' has lifecycle '${provider.lifecycle}'. Only 'PRODUCTION_LIVE' providers may execute live production bookings.`
    );
  }
}

/**
 * Invariant 4: Manual / Direct offers require PUBLISHED state to be BOOKABLE
 */
export function assertManualOfferPublishedForBooking(listing: {
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  sellability: Sellability;
  title: string;
}): void {
  if (listing.status !== 'PUBLISHED' && listing.sellability === 'BOOKABLE') {
    throw new ArchitecturalInvariantViolationError(
      'MANUAL_OFFER_NOT_PUBLISHED',
      `Manual/Direct listing '${listing.title}' has status '${listing.status}' and cannot be BOOKABLE. Only 'PUBLISHED' listings can be sold.`
    );
  }
}

/**
 * Invariant 5: Unavailable or expired offers cannot become Trip Bucket READY
 */
export function assertUnavailableOfferCannotBeReady(item: {
  availabilityStatus: AvailabilityState;
  targetTripBucketState: 'DRAFT' | 'NEEDS_ACTION' | 'READY' | 'REFRESHING_PRICE' | 'PRICE_CHANGED' | 'RECHECK_REQUIRED' | 'OFFER_EXPIRED' | 'UNAVAILABLE';
}): void {
  if (
    (item.availabilityStatus === 'SOLD_OUT' || item.availabilityStatus === 'RATE_EXPIRED') &&
    item.targetTripBucketState === 'READY'
  ) {
    throw new ArchitecturalInvariantViolationError(
      'EXPIRED_OFFER_CANNOT_BE_READY',
      `An item with availabilityStatus '${item.availabilityStatus}' cannot transition to Trip Bucket 'READY' state.`
    );
  }
}
