/* ============================================================================
 * Vacatina Domain Model & TypeScript Contracts
 * Authorities:
 * - 01_PRODUCT_ARCHITECTURE.md
 * - 02_API_RESPONSIBILITY_MAP.md
 * - 04_DATA_STATE_MODEL.md (Screen 04 Trip Bucket Component States v1.2 Locked)
 * ============================================================================ */

/**
 * The 10 canonical Travel Products in Vacatina.
 */
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

/**
 * All 11 Search Command Center tabs (Tab 1 'bundle' is the cross-product orchestration engine).
 */
export type CommandCenterTabId = 'bundle' | TravelProductSlug;

/**
 * Canonical 8 Trip Bucket Component States (Locked in Screen 04 v1.2).
 */
export type TripBucketItemState =
  | 'draft'
  | 'ready'
  | 'needs_action'
  | 'refreshing_price'
  | 'price_changed'
  | 'recheck_required'
  | 'offer_expired'
  | 'unavailable';

/**
 * Canonical Trip Bucket Item Readiness States (Architecture v2.4):
 * Decoupled from transactional booking states.
 */
export type TripItemReadinessState =
  | 'DRAFT'
  | 'NEEDS_ACTION'
  | 'READY'
  | 'REFRESHING_PRICE'
  | 'PRICE_CHANGED'
  | 'RECHECK_REQUIRED'
  | 'OFFER_EXPIRED'
  | 'UNAVAILABLE';

/**
 * Canonical Booking & Checkout Lifecycle States (Architecture v2.4):
 * Evaluates the transactional saga of an order.
 */
export type BookingLifecycleState =
  | 'STAGED'
  | 'HELD'
  | 'BOOKING_IN_PROGRESS'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Canonical Trip Bucket Aggregate View States:
 */
export type TripBucketAggregateState =
  | 'EMPTY'
  | 'STAGED'
  | 'READY_FOR_REVIEW';

/**
 * Integration classification per 02_API_RESPONSIBILITY_MAP.md & 06_ANTIGRAVITY_MASTER_INSTRUCTION.md.
 */
export type IntegrationClassification = 'LIVE' | 'VERIFY-LIVE' | 'ADAPTER-READY' | 'MOCK';

export type SupportedCurrency =
  | 'LKR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SGD'
  | 'AUD'
  | 'INR'
  | 'SAR'
  | 'JPY'
  | 'CHF'
  | 'CAD';

export type SupportedLanguage =
  | 'EN'
  | 'SI'
  | 'TA'
  | 'AR'
  | 'FR'
  | 'DE'
  | 'ZH'
  | 'JA'
  | 'RU'
  | 'HI';

export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First';

export interface TravellerCounts {
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  rooms: number;
}

export interface TravellerValidationResult {
  valid: boolean;
  adjusted: TravellerCounts;
  errors: string[];
  notice: string | null;
}

export interface TripBucketCandidate {
  id: string;
  productType: TravelProductSlug;
  productLabel: string;
  title: string;
  subtitle: string;
  dateSummary: string;
  travellerSummary: string;
  state: TripBucketItemState;
  priceLkr: number;
  previousPriceLkr?: number;
  holdStatusText?: string;
  actionRequiredText?: string;
  primaryActionLabel?: string;
  supplierName: string;
  integrationMode: IntegrationClassification;
  // Hybrid Inventory & Canonical Offer Extensions
  offerId?: string;
  sourceType?: 'API' | 'MANUAL' | 'HYBRID' | 'SEED' | string;
  confirmationMode?: 'INSTANT_CONFIRM' | 'REQUEST_TO_CONFIRM' | 'ASSISTED_SERVICE' | 'INSTANT';
  rawSupplierPrice?: number;
  supplierBaseCurrency?: SupportedCurrency | string;
  markupAmountLkr?: number;
  // Flight configuration, provenance and revalidation truth (Phase 5)
  canonicalOfferId?: string;
  sourceId?: string;
  providerName?: string;
  inventoryMode?: 'demo_fixture' | 'manual_request' | 'live_supplier' | 'sandbox_test' | string;
  inventoryLabel?: string;
  truthDisclosure?: string;
  /** Duffel TEST MODE only: explicit sandbox order lane and selected services. */
  sandboxOrderable?: boolean;
  selectedServiceIds?: string[];
  scheduleStatus?: string;
  fareFamilyCode?: string;
  fareFamilyName?: string;
  travellerCounts?: { adults: number; children: number; infants: number };
  searchContext?: {
    searchId?: string;
    tripType?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
  };
  currency?: string;
  revalidationStatus?: string;
  revalidatedAt?: string;
  configuration?: Record<string, unknown>;
  availabilityStatus?: string;
  lastCheckedAt?: string;
  validUntil?: string;
  propertyId?: string;
  roomId?: string;
  ratePlanId?: string;
  priceStatus?: 'quote_required' | 'illustrative' | 'quoted';
  amountMinor?: number;
}

export interface TripBucketSummary {
  totalItems: number;
  readyCount: number;
  needsActionCount: number;
  draftCount: number;
  issueCount: number;
  readySubtotalLkr: number;
  excludedSubtotalLkr: number;
  statusHeadline: string;
  itemPillsSummary: string;
}

export interface FavoriteBookmark {
  id: string;
  title: string;
  category: TravelProductSlug;
  destination: string;
  priceHint: string;
  savedAtIso: string;
}

export interface SupplierAdapterMetadata {
  domain: string;
  provider: string;
  documentedStatus: IntegrationClassification;
  runtimeStatus: IntegrationClassification;
  credentialsConfigured: boolean;
  notes: string;
  inventorySourceMode?: 'API' | 'MANUAL' | 'HYBRID';
}

export interface ConfigurableProductOption {
  id: string;
  productType: TravelProductSlug;
  productLabel: string;
  title: string;
  destination: string;
  subtitle: string;
  defaultDateRange: string;
  basePriceLkr: number;
  supplierName: string;
  initialBucketState: 'ready' | 'needs_action';
  actionHint?: string;
  tiers: Array<{
    id: string;
    label: string;
    description: string;
    priceDeltaLkr: number;
  }>;
}

export interface HolidayPackageDetailData {
  id: string;
  title: string;
  destination: string;
  duration: string;
  priceDisplay: string;
  priceLkr: number;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: Array<{
    day: string;
    title: string;
    summary: string;
  }>;
}
