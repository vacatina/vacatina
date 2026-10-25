/* ============================================================================
 * Vacatina Unified Inventory System — Canonical Types & Contracts
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md & ADR-006
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

export type InventorySourceType = 'API' | 'MANUAL' | 'HYBRID' | 'SEED';

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

export interface CanonicalOfferEntity {
  canonicalOfferId: string;         // Universal stable identifier, e.g. "vct-fl-duffel-cmb-dxb-98a7c2"
  productType: TravelProductSlug;
  sourceType: InventorySourceType;
  supplierId: string;               // e.g. "DUFFEL_NDC", "AMADEUS", "LITEAPI", "PAYLOAD_CMS"
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
