/* ============================================================================
 * Vacatina Unified Inventory System — Canonical Types & Contracts
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md,
 *            docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md,
 *            docs/14_CANONICAL_INVENTORY_TAXONOMY_AND_ADMIN_CMS_SCHEMA.md,
 *            ADR-006, ADR-007 & ADR-008
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
// 1. The 7 Orthogonal Canonical Inventory Dimensions (ADR-007 & ADR-008)
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
  | 'INTEGRATION_CANDIDATE' // Candidate integration undergoing technical and sandbox audit
  | 'SANDBOX_ACTIVE'  // Live test API credentials connected and verified
  | 'CERTIFIED'       // Upstream provider compliance & certification testing passed
  | 'PRODUCTION_LIVE';// Commercial contract signed, live credentials active, financial settlement enabled

// ----------------------------------------------------------------------------
// 2. Publication, Distribution & Booking Capabilities (ADR-008)
// ----------------------------------------------------------------------------

export type PublicationStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ARCHIVED';

export type DistributionScope =
  | 'B2C_ONLY'
  | 'B2B_ONLY'
  | 'BOTH'
  | 'INTERNAL_ONLY';

export type BookingCapability =
  | 'INSTANT_RESERVATION'
  | 'HOLD_AND_CONFIRM'
  | 'REQUEST_TO_BOOK'
  | 'INQUIRY_ONLY';

export type AvailabilityMode =
  | 'INSTANT'       // Guaranteed real-time stock / instant decrement
  | 'ON_REQUEST'    // Request to confirm with supplier / partner SLA
  | 'ALLOTMENT'     // Dedicated block allotment with fixed allocation counts
  | 'SCHEDULED'     // Fixed date departures (charters, cruises, curated packages)
  | 'UNAVAILABLE';  // Stop sale / blacked out

export type PricingMode =
  | 'FIXED'         // Stable fixed price
  | 'FROM_PRICE'    // Starting price indicator for custom itineraries
  | 'DYNAMIC'       // Live real-time pricing from GDS/API
  | 'PER_PERSON'    // Per passenger / applicant basis
  | 'PER_ROOM'      // Per room per night basis
  | 'PER_VEHICLE'   // Per transfer vehicle basis
  | 'PER_PACKAGE'   // Flat whole-package price
  | 'QUOTE_REQUIRED';// Complex custom quote required

export type {
  ProductExtension,
  FlightProductExtension,
  FlightSegmentEntity,
  HotelProductExtension,
  CarTransferProductExtension,
  CruiseProductExtension,
  CruisePortCallEntity,
  RailProductExtension,
  ActivityProductExtension,
  SightseeingProductExtension,
  InsuranceProductExtension,
  VisaProductExtension,
  PackageProductExtension,
  PackageDayItineraryEntity
} from './product-extensions.ts';
import type { ProductExtension } from './product-extensions.ts';

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

export interface TaxesAndFeesEntity {
  totalTaxMinor: number;
  isTaxInclusive: boolean;
  vatMinor?: number;
  tourismDirhamOrLevyMinor?: number;
  serviceChargeMinor?: number;
  mandatoryLocalFeesText?: string;
}

export interface B2BDistributionPricingEntity {
  distributionScope: DistributionScope;
  b2bNetPriceMinor: number;
  agencyMarkupPercent?: number;
  agencyMarkupMinor?: number;
  agencyCommissionPercent?: number;
  agencyCommissionMinor?: number;
  clientFacingPriceMinor?: number;
  isCreditLineEligible?: boolean;
}

export interface PinAuditEntity {
  isPinned: boolean;
  pinReason?: string;
  pinValidFrom?: string;
  pinValidUntil?: string;
  approverUserId?: string;
}

export interface PriceFreshnessEntity {
  lastCheckedAtIso: string;
  ttlSeconds: number;
  expiresAtIso: string;
  isStale: boolean;
  revalidationEndpoint: string;
}

// ----------------------------------------------------------------------------
// Discovery Content vs Sellable Inventory Separation (Directive 1)
// ----------------------------------------------------------------------------

export interface DiscoveryContentEntity {
  contentId: string;               // e.g. "dsc_dxb_winter_escape"
  slug: string;                    // e.g. "dubai-winter-escape"
  title: string;                   // e.g. "Dubai Winter Sun & Skyline"
  subtitle: string;                // e.g. "Experience futuristic architecture and desert adventures"
  category: 'DESTINATION_INSPIRATION' | 'SEASONAL_GUIDE' | 'EDITORIAL_FEATURE' | 'ROUTE_SUGGESTION';
  heroImageUrl: string;
  targetProductType: TravelProductSlug;
  targetRoute: string;             // Canonical frontend route, e.g. "/flights" or "/packages"
  prefillSearchParams: {
    origin?: string;
    destination: string;
    departureDate?: string;
    returnDate?: string;
    cabinClass?: string;
  };
  editorialBadge?: string;         // e.g. "Staff Pick", "Trending Destination", "Seasonal Special"
  priceIndication?: {
    indicativeFromPriceMinor: number;
    indicativeCurrency: string;
    priceDisclaimer: string;       // e.g. "*Indicative starting fare based on historical searches; live search required"
  };
  isLiveInventoryOffer: false;     // STRICT INVARIANT: Always false. Never an inventory offer.
  sellability: 'DISCOVERY_ONLY';   // Never directly bookable
  authorOrCurator: string;
  publishedAtIso: string;
}

export interface SourceProvenanceEntity {
  originAdapter: string;           // e.g. "FlightsDuffelAdapter"
  fetchTimestampIso: string;
  providerEndpoint?: string;
  rawPayloadHash?: string;
  providerResponseTimeMs?: number;
  ratePlanCode?: string;
}

/**
 * Identity of an individual sub-component within a DYNAMIC_BUNDLE or Holiday Package
 */
export interface ComponentOfferIdentity {
  componentId: string;
  productType: TravelProductSlug;
  sourceOfferId?: string;          // Upstream offer ID or CMS listing ID
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
  lastRevalidationResult?: 'UNCHANGED' | 'PRICE_CHANGED' | 'UNAVAILABLE';
  componentStatus?: 'VALID' | 'PRICE_CHANGED' | 'EXPIRED' | 'UNAVAILABLE' | 'NEEDS_ACTION';
  costMinor?: number;
  currency?: string;
}

/**
 * Universal Canonical Offer Model (v2.0)
 * Authority: ADR-008 & Core Architecture Master Contract
 */
export interface CanonicalOfferEntity {
  // Stable universal identifiers
  canonicalOfferId: string;         // Universal stable identifier, e.g. "vct-fl-duffel-cmb-dxb-98a7c2"
  offerId?: string;                 // Explicit alias for canonicalOfferId
  sourceOfferId?: string;           // Original upstream provider offer ID / CMS listing ID
  productType: TravelProductSlug;
  providerId?: string;              // Explicit alias for supplierId
  providerOfferId?: string;         // Explicit alias for supplierOfferId

  // --- 7 Orthogonal Canonical Dimensions ---
  inventorySource: InventorySource;
  listingKind: ListingKind;
  compositionType: CompositionType;
  fulfillmentMode: FulfillmentMode;
  environmentClass: EnvironmentClass;
  sellability: Sellability;
  providerLifecycle: ProviderLifecycle;

  // --- Publication & Distribution Scope (ADR-008) ---
  publicationStatus: PublicationStatus;
  distributionScope: DistributionScope;
  bookingCapability: BookingCapability;

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
  availabilityMode?: AvailabilityMode;
  pricingMode?: PricingMode;
  confirmationMode: ConfirmationMode;
  bookingMode: BookingMode;
  pricing: PricingLayersEntity;
  taxesAndFees: TaxesAndFeesEntity;
  b2bPricing?: B2BDistributionPricingEntity;
  productExtension?: ProductExtension;
  freshness: PriceFreshnessEntity;
  validFrom: string;
  validUntil: string;
  expiresAt: string;
  lastCheckedAt: string;
  requiresRevalidation: boolean;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  pinAboveApi: boolean;             // Administrative priority ranking
  isExclusiveDeal?: boolean;        // Contractual exclusive rate badge eligibility
  pinAudit?: PinAuditEntity;        // Auditable pin justification
  deduplicationKey: string;         // Composite natural deduplication key
  isSandboxSimulated: boolean;      // Truthful flag: true if rendered by mock/sandbox adapter
  integrationLifecycle: IntegrationLifecycleStatus;
  sourceMetadata: Record<string, unknown>;
  sourceProvenance?: SourceProvenanceEntity;
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
  channel?: 'B2C' | 'B2B'; // Distribution channel context
  distributionScope?: DistributionScope;
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
// 3. Customer Badge Standards & Disclosure Safeguards (Rules 2 & 5)
// ----------------------------------------------------------------------------

export type CustomerBadge =
  | 'Live Availability'
  | 'Instant Confirmation'
  | 'On Request'
  | 'Vacatina Assisted'
  | 'Direct Rate'
  | 'Exclusive Direct Deal';

/**
 * Derives truthful, customer-facing commercial badges strictly from verified system state.
 * Never based on arbitrary marketing toggles.
 */
export function deriveCustomerBadges(offer: CanonicalOfferEntity): CustomerBadge[] {
  const badges: CustomerBadge[] = [];

  // 1. Live Availability: strictly only when production-live, real availability, and fresh
  const isProdLive = offer.providerLifecycle === 'PRODUCTION_LIVE';
  const isRealLive = offer.availabilityStatus === 'LIVE';
  const isFresh = !offer.freshness.isStale;
  const isProduction = offer.environmentClass === 'PRODUCTION';

  if (isProdLive && isRealLive && isFresh && isProduction) {
    badges.push('Live Availability');
  }

  // 2. Operational fulfillment badge: strictly based on verified instant execution capability
  if (
    offer.fulfillmentMode === 'INSTANT' &&
    (offer.bookingCapability === 'INSTANT_RESERVATION' || offer.confirmationMode === 'INSTANT_CONFIRM')
  ) {
    badges.push('Instant Confirmation');
  } else if (
    offer.fulfillmentMode === 'ON_REQUEST' ||
    offer.bookingCapability === 'REQUEST_TO_BOOK' ||
    offer.confirmationMode === 'REQUEST_TO_CONFIRM'
  ) {
    badges.push('On Request');
  } else if (
    offer.fulfillmentMode === 'MANUAL_CONFIRMATION' ||
    offer.listingKind === 'SERVICE' ||
    offer.inventorySource === 'MANUAL_INTERNAL' ||
    offer.confirmationMode === 'ASSISTED_SERVICE'
  ) {
    badges.push('Vacatina Assisted');
  }

  // 3. Direct Commercial relationship badge
  if (offer.inventorySource === 'DIRECT_CONTRACT') {
    badges.push('Direct Rate');

    // Exclusive Direct Deal strictly requires verified exclusive contract flag + published + valid dates
    const hasValidDate = !offer.validUntil || new Date(offer.validUntil).getTime() >= Date.now();
    const isPublished = offer.publicationStatus === 'PUBLISHED';
    if (offer.isExclusiveDeal && isPublished && hasValidDate) {
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
    'DYNAMIC_BUNDLE',
    'B2C_ONLY',
    'B2B_ONLY',
    'INTERNAL_ONLY'
  ];
  return !badges.some(badge =>
    technicalLeakPatterns.some(tech => badge.toUpperCase().includes(tech.toUpperCase()))
  );
}

// ----------------------------------------------------------------------------
// 4. Invariant Architectural Safeguards (Rules 14 & ADR-008)
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
  status: PublicationStatus;
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

/**
 * Invariant 6: B2C vs B2B Distribution Scope Separation (Rule 4)
 */
export function assertDistributionScopeIntegrity(
  offer: { distributionScope: DistributionScope; canonicalOfferId: string },
  channel: 'B2C' | 'B2B'
): void {
  if (channel === 'B2C' && (offer.distributionScope === 'B2B_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
    throw new ArchitecturalInvariantViolationError(
      'B2C_DISTRIBUTION_LEAK',
      `Offer '${offer.canonicalOfferId}' has distributionScope '${offer.distributionScope}' and cannot appear in B2C channel.`
    );
  }
  if (channel === 'B2B' && (offer.distributionScope === 'B2C_ONLY' || offer.distributionScope === 'INTERNAL_ONLY')) {
    throw new ArchitecturalInvariantViolationError(
      'B2B_DISTRIBUTION_LEAK',
      `Offer '${offer.canonicalOfferId}' has distributionScope '${offer.distributionScope}' and cannot appear in B2B channel.`
    );
  }
}

/**
 * Invariant 7: Pinned Ranking Eligibility Rules (Rule 6)
 */
export function isOfferEligibleForPinOverride(offer: CanonicalOfferEntity): boolean {
  if (!offer.pinAboveApi) return false;
  // Must be production and published
  if (offer.environmentClass !== 'PRODUCTION' || offer.publicationStatus !== 'PUBLISHED') return false;
  // Cannot be unavailable or expired
  if (offer.availabilityStatus === 'SOLD_OUT' || offer.availabilityStatus === 'RATE_EXPIRED') return false;
  // Must have an audit reason
  if (!offer.pinAudit?.pinReason && !offer.pricing.overrideReason) return false;
  // Check date bounds if provided
  const now = Date.now();
  if (offer.pinAudit?.pinValidFrom && new Date(offer.pinAudit.pinValidFrom).getTime() > now) return false;
  if (offer.pinAudit?.pinValidUntil && new Date(offer.pinAudit.pinValidUntil).getTime() < now) return false;
  return true;
}

/**
 * Invariant 8: Discovery Content is Never Sellable Inventory (Directive 1)
 */
export function assertDiscoveryContentCannotBeSold(content: DiscoveryContentEntity): void {
  if (content.isLiveInventoryOffer !== false || content.sellability !== 'DISCOVERY_ONLY') {
    throw new ArchitecturalInvariantViolationError(
      'DISCOVERY_CONTENT_CANNOT_BE_SOLD',
      `Discovery content '${content.contentId}' must have isLiveInventoryOffer = false and sellability = 'DISCOVERY_ONLY'. It cannot be sold as an inventory offer.`
    );
  }
}

/**
 * Invariant 9: Package Component Provenance & Checkout Readiness (Directive 7)
 */
export function isPackageReadyForCheckout(pkgOffer: CanonicalOfferEntity): boolean {
  if (pkgOffer.productType !== 'packages') return true;
  if (!pkgOffer.components || pkgOffer.components.length === 0) return true;
  return !pkgOffer.components.some(c =>
    c.componentStatus === 'EXPIRED' ||
    c.componentStatus === 'UNAVAILABLE' ||
    c.componentStatus === 'NEEDS_ACTION' ||
    c.lastRevalidationResult === 'UNAVAILABLE'
  );
}

/**
 * Invariant 10: Production Response Environment Safety Guard (Directive 9)
 * Guarantees zero SEED, zero SANDBOX-bookable, zero B2B/INTERNAL leaks into B2C,
 * zero unpublished manual offers, and zero expired bookables in production responses.
 */
export function assertProductionResponseSafety(
  offers: CanonicalOfferEntity[],
  context: { channel?: 'B2C' | 'B2B'; environment?: 'PRODUCTION' | 'SANDBOX' | 'DEVELOPMENT' } = {}
): void {
  const isProd = context.environment !== 'SANDBOX' && context.environment !== 'DEVELOPMENT';
  const isB2C = context.channel !== 'B2B';

  for (const offer of offers) {
    if (isProd) {
      if (offer.environmentClass === 'SEED') {
        throw new ArchitecturalInvariantViolationError(
          'PRODUCTION_SEED_LEAK',
          `Environment Safety Violation: SEED offer '${offer.canonicalOfferId}' leaked into PRODUCTION response`
        );
      }
      if (offer.environmentClass === 'SANDBOX' && offer.sellability === 'BOOKABLE') {
        throw new ArchitecturalInvariantViolationError(
          'PRODUCTION_SANDBOX_LEAK',
          `Environment Safety Violation: SANDBOX simulated offer '${offer.canonicalOfferId}' marked BOOKABLE in PRODUCTION response`
        );
      }
    }

    if (isB2C) {
      if (offer.distributionScope === 'B2B_ONLY') {
        throw new ArchitecturalInvariantViolationError(
          'B2C_DISTRIBUTION_LEAK',
          `Distribution Isolation Violation: B2B_ONLY offer '${offer.canonicalOfferId}' leaked into B2C response`
        );
      }
      if (offer.distributionScope === 'INTERNAL_ONLY') {
        throw new ArchitecturalInvariantViolationError(
          'INTERNAL_DISTRIBUTION_LEAK',
          `Distribution Isolation Violation: INTERNAL_ONLY offer '${offer.canonicalOfferId}' leaked into B2C response`
        );
      }
    }

    if (offer.publicationStatus && offer.publicationStatus !== 'PUBLISHED') {
      throw new ArchitecturalInvariantViolationError(
        'UNPUBLISHED_OFFER_IN_SEARCH',
        `Publication Safety Violation: Non-published offer '${offer.canonicalOfferId}' (status: ${offer.publicationStatus}) presented in search response`
      );
    }

    if (offer.sellability === 'BOOKABLE' && offer.availabilityStatus === 'EXPIRED') {
      throw new ArchitecturalInvariantViolationError(
        'EXPIRED_OFFER_BOOKABLE',
        `Freshness Safety Violation: EXPIRED offer '${offer.canonicalOfferId}' presented as BOOKABLE`
      );
    }
  }
}
