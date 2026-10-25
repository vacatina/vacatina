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
// Canonical Inventory Source Model & Verification Invariants (GPT Audit v2.1)
// ----------------------------------------------------------------------------

/**
 * Exactly 4 Canonical Source Types:
 * - SUPPLIER_API: Live/sandbox external supplier (Duffel, Amadeus, LiteAPI, Viator, etc.)
 * - MANUAL_CONTRACT: Directly contracted allotment/charter managed in Backoffice
 * - MANUAL_SERVICE: Operational human service handled by Vacatina (Visa concierge, escort)
 * - ACCELERATOR_SEED: Prototype demo fixtures strictly quarantined from production
 */
export type CanonicalInventorySourceType =
  | 'SUPPLIER_API'
  | 'MANUAL_CONTRACT'
  | 'MANUAL_SERVICE'
  | 'ACCELERATOR_SEED';

/**
 * Canonical Source Environment States:
 * - LIVE_CERTIFIED: Supplier API with live certified production credentials & settlement
 * - LIVE_MANUAL_VERIFIED: Direct contract or internal service verified by operations
 * - CANDIDATE: Typed adapter scaffold under audit/testing (not certified for live bookings)
 * - SANDBOX: Provider test credentials or simulated payload active
 * - DEMO_ONLY: Design accelerator demo fixtures
 * - SUSPENDED: Circuit breaker tripped, expired allotment, or provider de-listed
 */
export type CanonicalSourceEnvironment =
  | 'LIVE_CERTIFIED'
  | 'LIVE_MANUAL_VERIFIED'
  | 'CANDIDATE'
  | 'SANDBOX'
  | 'DEMO_ONLY'
  | 'SUSPENDED';

/**
 * Canonical Booking Fulfillment Modes:
 * - INSTANT_API: Automated real-time ticketing/voucher issuance via supplier API
 * - MANUAL_ALLOTMENT: Direct decrement from confirmed Vacatina room/seat quota
 * - REQUEST_TO_BOOK: Partner SLA on-request booking requiring manual confirmation
 * - MANUAL_CONFIRMATION: Human document check / consular checklist review
 * - INFORMATION_ONLY: Informational discovery teaser / card (not bookable)
 */
export type CanonicalBookingMode =
  | 'INSTANT_API'
  | 'MANUAL_ALLOTMENT'
  | 'REQUEST_TO_BOOK'
  | 'MANUAL_CONFIRMATION'
  | 'INFORMATION_ONLY';

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
// Granular Source & Integration Orthogonal Dimensions (GPT Audit v2.0)
// ----------------------------------------------------------------------------

export type SourceMode =
  | 'CONTENT_ONLY'  // Non-bookable editorial, destination guides, inspiration cards
  | 'MANUAL'        // Direct contracts, internal operations, or offline partner rate sheets
  | 'API';          // Live or candidate external GDS/NDC/Bedbank aggregator

export type IntegrationStatus =
  | 'NOT_APPLICABLE' // Pure manual/internal service with no external API
  | 'PLANNED'        // Target provider identified; no live credentials
  | 'SANDBOX'        // Typed adapter scaffold active in test environment
  | 'CERTIFIED_LIVE';// Live credentials verified and certified for production bookings

export type ManualSourceType =
  | 'DIRECT_CONTRACT' // Directly negotiated commercial agreement (allotment/rate sheet)
  | 'MANUAL_INTERNAL' // In-house Vacatina operational product/service (e.g. Visa Concierge)
  | 'PARTNER_MANUAL'  // External travel partner providing offline inventory/extranet
  | null;

export type VerificationStatus =
  | 'VERIFIED_CONTRACT' // Signed commercial agreement with documented allotment
  | 'VERIFIED_INTERNAL' // Internal operational desk with SLA capability
  | 'PARTNER_PENDING'   // Partner agreement under negotiation/contracting
  | 'UNVERIFIED'        // Unconfirmed rate/inventory
  | 'PROTOTYPE';        // Design accelerator demo data (quarantined)

export type CurrentAvailabilityMode =
  | 'CONTENT_ONLY'         // No availability tracking; informational only
  | 'ON_REQUEST'           // Subject to partner confirmation within SLA
  | 'ALLOTMENT'            // Finite quota managed in Vacatina database
  | 'MANUAL_CONFIRMATION'  // Human document/consular audit required
  | 'LIVE_INSTANT';        // ONLY for verified CERTIFIED_LIVE supplier integrations!

export type CurrentPricingMode =
  | 'INDICATIVE'     // Starting from price for inspiration cards (*disclaimer required)
  | 'FIXED_MANUAL'   // Guaranteed flat manual rate (e.g. visa concierge advisory)
  | 'CONTRACTED'     // Negotiated contracted seasonal rate in minor integer units
  | 'LIVE_DYNAMIC';  // ONLY for verified CERTIFIED_LIVE supplier integrations!

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
  canonicalEntityId?: string;       // Stable real-world entity identifier (e.g. "HOTEL_DUBAI_001", "FLIGHT_CMB_DXB_EK651")
  alternateSourceOfferIds?: string[]; // IDs of alternate supplier offers consolidated under this entity
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

  // --- Canonical 4-Source Model & Verification (GPT Audit v2.1) ---
  canonicalSourceType?: CanonicalInventorySourceType;
  sourceEnvironment?: CanonicalSourceEnvironment;
  canonicalBookingMode?: CanonicalBookingMode;

  // --- Backward Compatibility Alias ---
  sourceType: InventorySourceType;

  // --- Heterogeneous components (for dynamic bundles) ---
  components?: ComponentOfferIdentity[];

  // --- Granular Source & Integration Separation (GPT Audit v2.0) ---
  sourceMode?: SourceMode;
  integrationStatus?: IntegrationStatus;
  manualSourceType?: ManualSourceType;
  verificationStatus?: VerificationStatus;
  currentAvailabilityMode?: CurrentAvailabilityMode;
  currentPricingMode?: CurrentPricingMode;
  futureProvider?: string | null;

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
 * Maps Canonical Booking Mode to customer-facing journey CTA copy (GPT Audit v2.2)
 * Customers see honest journey semantics, never technical source labels.
 */
export function getCanonicalBookingModeCta(mode?: CanonicalBookingMode): string {
  switch (mode) {
    case 'INSTANT_API':
    case 'MANUAL_ALLOTMENT':
      return 'Available — Continue';
    case 'REQUEST_TO_BOOK':
      return 'Request Availability';
    case 'MANUAL_CONFIRMATION':
      return 'Submit Details';
    case 'INFORMATION_ONLY':
      return 'Explore / Search';
    default:
      return 'View Options';
  }
}

/**
 * Verifies that an array of customer badges contains zero internal technical terms.
 */
export function validateNoTechnicalLeakInCustomerBadges(badges: string[]): boolean {
  const technicalLeakPatterns = [
    'API',
    'SUPPLIER_API',
    'MANUAL_CONTRACT',
    'MANUAL_SERVICE',
    'ACCELERATOR_SEED',
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
 * Invariant 8: Discovery Content is Never Sellable Inventory (Directive 1 & GPT Audit v2.2)
 * Editorial guides, marketing teasers, and homepage destination cards are NEVER inventory.
 * They cannot enter checkout, have no live availability, and cannot be purchased.
 */
export function assertDiscoveryContentCannotBeSold(content: DiscoveryContentEntity): void {
  if (content.isLiveInventoryOffer !== false || content.sellability !== 'DISCOVERY_ONLY') {
    throw new ArchitecturalInvariantViolationError(
      'DISCOVERY_CONTENT_CANNOT_BE_SOLD',
      `Discovery content '${content.contentId}' must have isLiveInventoryOffer = false and sellability = 'DISCOVERY_ONLY'. It cannot be sold as an inventory offer.`
    );
  }
}

export function assertDiscoveryLayerCannotEnterInventoryCheckout(content: { sellability?: string; isLiveInventoryOffer?: boolean; canonicalOfferId?: string }): void {
  if (content.sellability === 'DISCOVERY_ONLY' || content.isLiveInventoryOffer === false) {
    throw new ArchitecturalInvariantViolationError(
      'DISCOVERY_CONTENT_CHECKOUT_BLOCKED',
      `Content Layer Safety Guard: Discovery/Editorial content '${content.canonicalOfferId || 'item'}' cannot enter checkout or booking flows.`
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

/**
 * Invariant 12: Production Search Excludes Demo / Accelerator Seed (Audit v2.1)
 * Guarantees prototype accelerator fixtures and demo seed data never leak into production search responses.
 */
export function assertProductionSearchExcludesDemoSeed(offers: CanonicalOfferEntity[]): void {
  for (const offer of offers) {
    if (
      offer.canonicalSourceType === 'ACCELERATOR_SEED' ||
      offer.environmentClass === 'SEED' ||
      offer.sourceEnvironment === 'DEMO_ONLY' ||
      offer.sourceType === 'SEED' ||
      offer.verificationStatus === 'PROTOTYPE'
    ) {
      throw new ArchitecturalInvariantViolationError(
        'PRODUCTION_SEED_LEAK',
        `Production Isolation Guard: DEMO_ONLY / ACCELERATOR_SEED offer '${offer.canonicalOfferId}' cannot enter production search responses.`
      );
    }
  }
}

/**
 * Invariant 13: Candidate or Sandbox Cannot Masquerade as Production Ready (Audit v2.1)
 * Uncertified scaffolds and sandbox adapters can never be marked Ready for live production execution.
 */
export function assertCandidateCannotBeProductionReady(offer: CanonicalOfferEntity): void {
  const isCandidateOrSandbox =
    offer.sourceEnvironment === 'CANDIDATE' ||
    offer.sourceEnvironment === 'SANDBOX' ||
    offer.environmentClass === 'SANDBOX' ||
    offer.providerLifecycle === 'INTEGRATION_CANDIDATE' ||
    offer.providerLifecycle === 'SANDBOX_ACTIVE' ||
    offer.providerLifecycle === 'SCAFFOLD' ||
    offer.providerLifecycle === 'PLANNED';

  if (isCandidateOrSandbox) {
    if (
      offer.environmentClass === 'PRODUCTION' &&
      offer.sellability === 'BOOKABLE' &&
      offer.availabilityStatus === 'LIVE' &&
      offer.confirmationMode === 'INSTANT_CONFIRM'
    ) {
      throw new ArchitecturalInvariantViolationError(
        'CANDIDATE_MASQUERADING_AS_LIVE',
        `Lifecycle Safety Guard: Candidate/Sandbox offer '${offer.canonicalOfferId}' cannot claim PRODUCTION instant live bookability.`
      );
    }
  }
}

/**
 * Invariant 14: Truthful Booking Reference Semantics & Upstream Isolation (Audit v2.1)
 * Guarantees that internal booking reference VCT-2026-XXXXXX is never disguised as an airline PNR,
 * and that upstream PNRs / hotel vouchers are strictly undefined in sandbox or uncertified runs.
 */
export function assertNoFabricatedUpstreamReferences(bookingItem: {
  isUpstreamConfirmed: boolean;
  supplierPnr?: string;
  supplierConfirmationNumber?: string;
  vacatinaBookingReference: string;
  vacatinaServiceReference?: string;
}): void {
  if (!bookingItem.vacatinaBookingReference || !/^VCT-2026-[A-Z0-9]{6}$/.test(bookingItem.vacatinaBookingReference)) {
    throw new ArchitecturalInvariantViolationError(
      'INVALID_VACATINA_BOOKING_REFERENCE',
      `Booking Reference Guard: Item missing valid canonical Vacatina booking reference 'VCT-2026-XXXXXX'.`
    );
  }

  // If not confirmed by real upstream provider, supplier PNR & confirmation number MUST be undefined
  if (!bookingItem.isUpstreamConfirmed) {
    if (bookingItem.supplierPnr !== undefined) {
      throw new ArchitecturalInvariantViolationError(
        'FABRICATED_UPSTREAM_PNR',
        `Integrity Guard: supplierPnr cannot be set for uncertified / sandbox booking item without real upstream confirmation.`
      );
    }
    if (bookingItem.supplierConfirmationNumber !== undefined) {
      throw new ArchitecturalInvariantViolationError(
        'FABRICATED_UPSTREAM_CONFIRMATION',
        `Integrity Guard: supplierConfirmationNumber cannot be set for uncertified / sandbox booking item without real upstream confirmation.`
      );
    }
  }
}

/**
 * Invariant 11: Multi-Criteria Source Selection Engine (GPT Audit v2.2)
 * Does NOT blindly prefer API over manual. Evaluates 8 orthogonal dimensions:
 * 1. Certification & environment readiness (LIVE_CERTIFIED / LIVE_MANUAL_VERIFIED vs CANDIDATE)
 * 2. Inventory certainty (guaranteed ALLOTMENT / LIVE stock vs ON_REQUEST)
 * 3. Verification status (VERIFIED_CONTRACT / VERIFIED_INTERNAL vs UNVERIFIED)
 * 4. Price freshness & cache TTL safety
 * 5. Commercial margin & net-to-selling yield
 * 6. Cancellation terms & traveler flexibility
 * 7. Operational fulfillment SLA & booking mode
 * 8. Administrative pin override (if verified with auditable reason)
 */
export function computeOfferSourceScore(offer: CanonicalOfferEntity): number {
  let score = 0;

  // 1. Certification & Environment Readiness (0 - 30 pts)
  if (offer.sourceEnvironment === 'LIVE_CERTIFIED' || offer.sourceEnvironment === 'LIVE_MANUAL_VERIFIED') {
    score += 30; // Certified commercial provider with guaranteed fulfillment
  } else if (offer.sourceEnvironment === 'CANDIDATE' || offer.sourceEnvironment === 'SANDBOX') {
    score += 10; // Scaffold/sandbox provider under audit
  } else if (offer.sourceEnvironment === 'DEMO_ONLY' || offer.environmentClass === 'SEED') {
    return -2000; // Prototype demo fixtures strictly disqualified
  } else if (offer.sourceEnvironment === 'SUSPENDED') {
    return -3000; // Circuit-breaker tripped or stop-sale active
  } else {
    score += 15;
  }

  // 2. Inventory Certainty & Availability (0 - 30 pts)
  if (offer.availabilityStatus === 'LIVE' || offer.availabilityStatus === 'MANUAL_AVAILABLE') {
    score += (offer.availabilityMode === 'ALLOTMENT' || offer.canonicalBookingMode === 'MANUAL_ALLOTMENT') ? 30 : 25;
  } else if (offer.availabilityStatus === 'CACHED' || offer.availabilityStatus === 'ON_REQUEST') {
    score += 15;
  } else if (offer.availabilityStatus === 'SOLD_OUT' || offer.availabilityStatus === 'RATE_EXPIRED' || offer.availabilityStatus === 'UNAVAILABLE') {
    return -1000; // Unsellable
  }

  // 3. Verification Status (0 - 25 pts)
  if (offer.verificationStatus === 'VERIFIED_CONTRACT' || offer.verificationStatus === 'VERIFIED_INTERNAL') {
    score += 25;
  } else if (offer.verificationStatus === 'PARTNER_PENDING') {
    score += 10;
  } else if (offer.verificationStatus === 'PROTOTYPE') {
    return -2000;
  } else {
    score += 5; // UNVERIFIED
  }

  // 4. Price Freshness & Cache TTL (0 - 15 pts)
  if (offer.freshness) {
    if (offer.freshness.isStale) {
      score -= 20; // Stale cache penalty
    } else {
      score += 15; // Fresh rate
    }
  } else {
    score += 10;
  }

  // 5. Selling Margin Score (0 - 20 pts)
  const net = offer.pricing?.rawSupplierCostMinor || 1;
  const selling = offer.pricing?.finalSellingPriceMinor || net;
  const marginPercent = net > 0 ? ((selling - net) / net) * 100 : 0;
  if (marginPercent >= 15) score += 20;
  else if (marginPercent >= 10) score += 15;
  else if (marginPercent >= 5) score += 10;
  else score += 5;

  // 6. Cancellation Flexibility Score (0 - 15 pts)
  const policy = (offer.cancellationPolicy || '').toLowerCase();
  if (policy.includes('free cancellation')) {
    score += 15;
  } else if (policy.includes('refundable')) {
    score += 10;
  } else {
    score += 3;
  }

  // 7. Fulfilment SLA & Booking Mode Score (0 - 15 pts)
  if (
    (offer.fulfillmentMode === 'INSTANT' && offer.bookingCapability === 'INSTANT_RESERVATION') ||
    offer.canonicalBookingMode === 'INSTANT_API' ||
    offer.canonicalBookingMode === 'MANUAL_ALLOTMENT'
  ) {
    score += 15; // Instant guaranteed allocation
  } else if (offer.fulfillmentMode === 'MANUAL_CONFIRMATION' || offer.canonicalBookingMode === 'MANUAL_CONFIRMATION') {
    score += 10;
  } else {
    score += 5; // On request
  }

  // 8. Pin override bonus (if legitimately eligible)
  if (offer.pinAboveApi && isOfferEligibleForPinOverride(offer)) {
    score += 50;
  }

  return score;
}

export function selectBestSourceOffer(candidates: CanonicalOfferEntity[]): CanonicalOfferEntity | undefined {
  if (!candidates || candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const scored = candidates
    .filter(o => o.environmentClass !== 'SEED' && o.sellability !== 'DISCOVERY_ONLY')
    .map(offer => ({
      offer,
      score: computeOfferSourceScore(offer)
    }))
    .sort((a, b) => {
      // Primary: Score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary: Lower final customer selling price wins
      const priceA = a.offer.pricing?.finalSellingPriceMinor || 0;
      const priceB = b.offer.pricing?.finalSellingPriceMinor || 0;
      return priceA - priceB;
    });

  return scored.length > 0 ? scored[0].offer : candidates[0];
}

// ----------------------------------------------------------------------------
// 15. Commercial Entity Classification & Production Sellability Guards (Rule 5 & 13)
// ----------------------------------------------------------------------------

export type CommercialEntityClassification =
  | 'VERIFIED_CONTRACT'
  | 'PRODUCTION_CREDENTIALS_VERIFIED'
  | 'SANDBOX_APPROVED'
  | 'CANDIDATE'
  | 'TARGET_ONLY'
  | 'EXAMPLE_ONLY'
  | 'REMOVE_UNVERIFIED';

export interface CommercialEntityAuditRecord {
  entityId: string;
  commercialEntityName: string;
  category: TravelProductSlug | 'MULTI_PRODUCT' | 'PLATFORM';
  classification: CommercialEntityClassification;
  legalContractVerified: boolean;
  productionCredentialsVerified: boolean;
  sandboxApproved: boolean;
  canEnterProductionSellable: boolean;
  auditNotes: string;
}

export function assertCommercialEntitySellable(
  entityName: string,
  classification: CommercialEntityClassification
): void {
  if (
    classification === 'CANDIDATE' ||
    classification === 'TARGET_ONLY' ||
    classification === 'EXAMPLE_ONLY' ||
    classification === 'REMOVE_UNVERIFIED'
  ) {
    throw new ArchitecturalInvariantViolationError(
      'UNVERIFIED_COMMERCIAL_ENTITY',
      `Commercial Safety Invariant: Entity '${entityName}' is classified as '${classification}'. Unverified or candidate entities are strictly blocked from entering production sellable inventory.`
    );
  }
}

export function assertProviderCanExecuteLiveBooking(provider: {
  providerId: string;
  lifecycle: ProviderLifecycle;
  bookingExecutionSupported: boolean;
  role: string;
}): void {
  if (provider.lifecycle !== 'PRODUCTION_LIVE' || !provider.bookingExecutionSupported) {
    throw new ArchitecturalInvariantViolationError(
      'PROVIDER_NOT_PRODUCTION_LIVE',
      `Provider Certification Invariant: Provider '${provider.providerId}' (lifecycle: ${provider.lifecycle}, role: ${provider.role}) cannot execute live bookings. Live bookings require lifecycle 'PRODUCTION_LIVE' and bookingExecutionSupported = true.`
    );
  }
  if (provider.role === 'CANDIDATE' || provider.role === 'TARGET') {
    throw new ArchitecturalInvariantViolationError(
      'CANDIDATE_PROVIDER_BLOCKED_FROM_LIVE',
      `Provider Certification Invariant: Provider '${provider.providerId}' has role '${provider.role}'. Live production bookings are forbidden until contract and operational certification are complete.`
    );
  }
}
