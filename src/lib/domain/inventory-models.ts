/* ============================================================================
 * Vacatina Hybrid Inventory Strategy & Canonical Offer Contracts
 * Authority: Vacatina Hybrid Inventory Strategy v1.0
 *
 * Design Principles:
 * 1. Non-API-Only Architecture: Supports API, MANUAL, and HYBRID inventory modes.
 * 2. Canonical Normalization: All inventory sources normalize into one universal
 *    Vacatina Offer contract before reaching search, detail, or Trip Bucket.
 * 3. Stable Canonical Identifiers: Never uses display text or titles as IDs.
 * 4. Distinct Confirmation Modes: INSTANT_CONFIRM, REQUEST_TO_CONFIRM, ASSISTED_SERVICE.
 *    Customer UI displays honest buying conditions, never exposing internal "API/Manual" tags.
 * 5. Strict 4-Layer Pricing: Supplier Base -> Markup -> Audited Override -> Selling Price.
 *    Raw supplier cost is permanently preserved and never destroyed.
 * 6. Multi-Channel Booking Orchestration: Distinct fulfillment pipelines for API,
 *    manual inventory, on-request concierge dispatch, and assisted consular services.
 * ============================================================================ */

import type { SupportedCurrency, TravelProductSlug } from './types.ts';

/**
 * Canonical inventory source modes (Locked Part 5 & 6).
 * SEED represents development/prototype content that cannot enter production checkout as Ready.
 */
export type InventorySourceType =
  | 'API'
  | 'DIRECT_CONTRACT'
  | 'MANUAL'
  | 'CURATED_PACKAGE'
  | 'HYBRID'
  | 'SEED';

/**
 * Four canonical booking modes (Locked Part 8).
 * The customer CTA must truthfully reflect the real commercial condition.
 */
export type BookingMode =
  | 'INSTANT_BOOK'
  | 'REQUEST_TO_BOOK'
  | 'REQUEST_AVAILABILITY'
  | 'INQUIRY_ONLY';

/**
 * Manual listing lifecycle states for Payload CMS / Admin (Locked Part 10).
 */
export type ManualListingStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

/**
 * Three fundamental confirmation workflows.
 */
export type ConfirmationMode =
  | 'INSTANT_CONFIRM'      // Real-time API PNR / manual allocated quota
  | 'REQUEST_TO_CONFIRM'   // Supplier/concierge confirmation required within SLA
  | 'ASSISTED_SERVICE';    // Consular/visa specialist application case

/**
 * Customer-Facing Buying Condition.
 * Honest status strings shown to B2C travellers (never internal source flags).
 */
export type CustomerBuyingCondition =
  | 'Available'
  | 'Instant Confirmation'
  | 'Request to Confirm'
  | 'Recheck Required'
  | 'Sold Out'
  | 'Unavailable';

/**
 * Eight canonical inventory availability states.
 */
export type AvailabilityState =
  | 'LIVE'               // Verified in real-time with supplier
  | 'CACHED'             // Cached search result from API Hub, requires revalidation
  | 'MANUAL_AVAILABLE'   // Active listing in Payload CMS with remaining quota
  | 'ON_REQUEST'         // Quota on request from direct contract partner
  | 'RECHECK_REQUIRED'   // Fare/room state changed or expired
  | 'SOLD_OUT'           // 0 quota remaining
  | 'UNAVAILABLE'        // Blackout dates or provider downtime
  | 'EXPIRED';           // Validity window has passed

/**
 * Markup types supported by the Vacatina Pricing Engine.
 */
export type MarkupType = 'PERCENTAGE' | 'FIXED' | 'TIERED';

export interface MarkupSpecification {
  type: MarkupType;
  value: number;            // e.g. 7 for 7% or 5000 for LKR 5,000
  amountLkr: number;        // Computed markup amount in LKR
  ruleId?: string;
  ruleDescription?: string;
}

/**
 * Immutable administrative override audit log entry.
 */
export interface ManualPriceOverrideAudit {
  overrideId: string;
  previousValueLkr: number;
  newValueLkr: number;
  varianceLkr: number;
  overrideReason: string;
  authorizedByUserId: string;
  authorizedByName: string;
  timestampIso: string;
}

/**
 * 4-Layer Pricing Architecture.
 * Preserves raw supplier cost while maintaining full auditability of customer price.
 */
export interface PricingLayers {
  supplierRawBasePrice: number;        // Raw supplier cost in supplierBaseCurrency
  supplierBaseCurrency: SupportedCurrency;
  exchangeRateToBase: number;          // Rate from supplierBaseCurrency to LKR
  supplierBasePriceLkr: number;        // Converted base cost in LKR (raw * rate)
  vacatinaMarkup: MarkupSpecification; // Applied business rule markup
  manualOverride?: ManualPriceOverrideAudit; // Optional auditable administrative override
  customerSellingPriceLkr: number;     // Final authoritative customer price in LKR
  customerDisplayCurrency: SupportedCurrency;
  customerSellingPriceDisplay: number;  // Converted to user's selected viewing currency
  isPromotionalRate?: boolean;
}

/**
 * Component fulfillment routing methods for booking orchestration.
 */
export type FulfillmentRoutingMethod =
  | 'SUPPLIER_API'           // Sent to Duffel/Amadeus/LiteAPI for automated ticketing
  | 'MANUAL_INVENTORY'       // Decremented in Payload CMS database
  | 'ON_REQUEST_DISPATCH'    // Dispatched to concierge/supplier confirmation queue
  | 'ASSISTED_SERVICE_CASE'; // Dispatched to consular/visa document processing desk

export interface BookingFulfillmentRouting {
  fulfillmentMethod: FulfillmentRoutingMethod;
  workflowQueue: string;
  slaMinutes: number;
  autoTicketEligible: boolean;
  requiresPassportDetails: boolean;
  requiresSpecialistReview: boolean;
}

/**
 * Structured location identifier.
 */
export interface StructuredLocation {
  city: string;
  country: string;
  countryCode: string;
  iataCode?: string;
  stationCode?: string;
  portCode?: string;
  regionHint?: string;
}

/**
 * Required inputs before an offer can become Ready for booking.
 */
export interface ConfigurationRequirements {
  datesRequired: boolean;
  passengersRequired: boolean;
  roomConfigurationRequired: boolean;
  cabinClassRequired: boolean;
  pickupDropoffRequired: boolean;
  visaApplicantDetailsRequired: boolean;
  specialRequestsAllowed: boolean;
}

/**
 * Price Freshness & Revalidation Metadata.
 */
export interface PriceFreshness {
  lastCheckedAtIso: string;
  ttlSeconds: number;
  expiresAtIso: string;
  isStale: boolean;
  revalidationEndpoint?: string;
}

export interface CancellationPolicyDetail {
  policySummary: string;
  refundable: boolean;
  deadlineIso?: string;
  feeLkr?: number;
}

export interface ChangePolicyDetail {
  changeable: boolean;
  changeFeeLkr?: number;
  summary: string;
}

/**
 * Universal Normalized Vacatina Offer Structure.
 * Both API and Manual items normalize into this contract.
 */
export interface VacatinaNormalizedOffer {
  offerId: string; // Stable canonical ID, e.g. 'vct-fl-amadeus-cmb-dxb-001'
  productType: TravelProductSlug;
  sourceType: InventorySourceType;
  supplierId: string;              // e.g. 'AMADEUS', 'DUFFEL', 'PAYLOAD_CMS', 'LOCAL_CHAUFFEUR_LK'
  supplierName: string;
  supplierOfferId?: string;        // Upstream GDS/API identifier
  manualListingId?: string;        // Payload CMS document/listing ID
  title: string;
  subtitle: string;
  slug?: string;
  bookingMode?: BookingMode;
  location: StructuredLocation;
  configurationRequirements: ConfigurationRequirements;
  availabilityStatus: AvailabilityState;
  confirmationMode: ConfirmationMode;
  pricing: PricingLayers;
  freshness: PriceFreshness;
  cancellationTermsReference: string;
  cancellationTerms?: { policySummary: string; deadlineIso?: string; refundable: boolean };
  cancellationPolicy?: CancellationPolicyDetail;
  changePolicy?: ChangePolicyDetail;
  inclusions: string[];
  exclusions: string[];
  pinPriority?: number;           // For Admin "Pin Above API Results"
  featured?: boolean;
  exclusiveOffer?: boolean;       // For "Exclusive Vacatina Offer" badge
  isSeedContent?: boolean;        // True if prototype / accelerator content (blocks checkout Ready)
  remainingUnits?: number;
  validFrom?: string;
  validUntil?: string;
  sourceMetadata: Record<string, unknown>;
  revalidationCapability: {
    canRevalidateOnline: boolean;
    requiresSupplierPing: boolean;
    lastRevalidationResult?: 'UNCHANGED' | 'PRICE_CHANGED' | 'UNAVAILABLE';
  };
  fulfillmentRouting: BookingFulfillmentRouting;
}

/**
 * Maps booking mode to honest customer-facing CTA button label (Locked Part 8).
 */
export function getBookingModeCta(mode?: BookingMode): string {
  switch (mode) {
    case 'INSTANT_BOOK': return 'Check Availability';
    case 'REQUEST_TO_BOOK': return 'Request Booking';
    case 'REQUEST_AVAILABILITY': return 'Request Availability';
    case 'INQUIRY_ONLY': return 'Contact Vacatina';
    default: return 'Configure';
  }
}

/**
 * Helper to map technical availability and confirmation mode into customer-facing copy.
 * B2C users see clear commercial terms, never internal API/Manual source labels.
 */
export function getCustomerBuyingCondition(offer: VacatinaNormalizedOffer): CustomerBuyingCondition {
  if (offer.availabilityStatus === 'SOLD_OUT') {
    return 'Sold Out';
  }
  if (offer.availabilityStatus === 'UNAVAILABLE' || offer.availabilityStatus === 'EXPIRED') {
    return 'Unavailable';
  }
  if (offer.availabilityStatus === 'RECHECK_REQUIRED') {
    return 'Recheck Required';
  }
  if (offer.confirmationMode === 'REQUEST_TO_CONFIRM' || offer.availabilityStatus === 'ON_REQUEST') {
    return 'Request to Confirm';
  }
  if (offer.confirmationMode === 'INSTANT_CONFIRM' && (offer.availabilityStatus === 'LIVE' || offer.availabilityStatus === 'MANUAL_AVAILABLE')) {
    return 'Instant Confirmation';
  }
  return 'Available';
}
