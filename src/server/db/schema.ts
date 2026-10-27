/* ============================================================================
 * Vacatina Canonical Database Schema & Entity Definitions
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-001
 * Covers all 11 core domains:
 * 1. Identity
 * 2. Traveller
 * 3. Journey
 * 4. Offers
 * 5. Booking
 * 6. Payments
 * 7. Visa
 * 8. B2B
 * 9. Content
 * 10. Operations
 * 11. Platform
 * ============================================================================ */

// ----------------------------------------------------------------------------
// Common & Utility Types
// ----------------------------------------------------------------------------

export type UUID = string;
export type ISODateString = string;

export interface MoneyMinor {
  amountMinor: number; // Stored in 64-bit integer minor units (cents)
  currency: string;    // ISO 4217 code (LKR, USD, AED, EUR, etc.)
}

// ----------------------------------------------------------------------------
// 1. Identity Domain
// ----------------------------------------------------------------------------

export type UserRole =
  | 'CUSTOMER'
  | 'AGENCY_OWNER'
  | 'AGENCY_MANAGER'
  | 'BOOKING_AGENT'
  | 'CORPORATE_COORDINATOR'
  | 'SUPPLIER_USER'
  | 'SUPPORT_STAFF'
  | 'FINANCE_OPS'
  | 'CONTENT_MARKETING'
  | 'ANALYTICS'
  | 'PLATFORM_ADMIN'
  | 'SUPER_ADMIN'
  | 'B2B_AGENT'
  | 'FINANCE_OFFICER'
  | 'VISA_OFFICER'
  | 'OPS_SUPERVISOR';

export type OrganizationType = 'AGENCY' | 'CORPORATE' | 'SUPPLIER' | 'PLATFORM';

export interface UserEntity {
  id: UUID;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrganizationEntity {
  id: UUID;
  slug: string;
  name: string;
  type: OrganizationType;
  creditLimitMinor: number;
  currency: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'TERMINATED';
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrganizationMembershipEntity {
  id: UUID;
  organizationId: UUID;
  userId: UUID;
  role: UserRole;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: ISODateString;
}

export interface PermissionEntity {
  id: UUID;
  slug: string;
  description: string;
  domain: string;
}

export interface RoleAssignmentEntity {
  id: UUID;
  role: UserRole;
  permissionSlug: string;
}

// ----------------------------------------------------------------------------
// 2. Traveller Domain
// ----------------------------------------------------------------------------

export interface TravellerProfileEntity {
  id: UUID;
  userId?: UUID;
  organizationId?: UUID;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  passportNumber?: string;
  passportExpiry?: string;
  nationality: string; // ISO 3166-1 alpha-2
  residenceCountry: string;
  frequentFlyerPrograms?: Array<{ airline: string; number: string }>;
  dietaryRequirements?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TravellerDocumentMetadataEntity {
  id: UUID;
  travellerId: UUID;
  documentType: 'PASSPORT' | 'VISA_COPY' | 'NATIONAL_ID' | 'PHOTO';
  r2StorageKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  sha256Checksum: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  uploadedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// 3. Journey Domain
// ----------------------------------------------------------------------------

export type TripBucketState =
  | 'DRAFT'
  | 'NEEDS_ACTION'
  | 'READY'
  | 'REFRESHING_PRICE'
  | 'PRICE_CHANGED'
  | 'RECHECK_REQUIRED'
  | 'OFFER_EXPIRED'
  | 'UNAVAILABLE';

export interface TripBucketEntity {
  id: UUID;
  userId?: UUID;
  organizationId?: UUID;
  sessionId: string;
  currency: string;
  status: 'ACTIVE' | 'CHECKED_OUT' | 'EXPIRED' | 'ABANDONED';
  expiresAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TripBucketItemEntity {
  id: UUID;
  tripBucketId: UUID;
  canonicalOfferId: string;
  productType: string;
  sourceType: 'API' | 'DIRECT_CONTRACT' | 'MANUAL_SERVICE' | 'CURATED_PACKAGE' | 'HYBRID' | 'SEED' | 'MANUAL';
  inventorySource?: 'API' | 'DIRECT_CONTRACT' | 'MANUAL_INTERNAL' | 'PARTNER_MANUAL';
  listingKind?: 'DISCOVERY_CONTENT' | 'SELLABLE_INVENTORY' | 'SERVICE' | 'PACKAGE';
  compositionType?: 'SINGLE' | 'CURATED_PACKAGE' | 'DYNAMIC_BUNDLE';
  fulfillmentMode?: 'INSTANT' | 'ON_REQUEST' | 'MANUAL_CONFIRMATION';
  environmentClass?: 'PRODUCTION' | 'SANDBOX' | 'SEED';
  sellability?: 'DISCOVERY_ONLY' | 'QUOTE_ONLY' | 'BOOKABLE';
  bookingMode: 'INSTANT_BOOK' | 'REQUEST_TO_BOOK' | 'REQUEST_AVAILABILITY' | 'INQUIRY_ONLY';
  title: string;
  configuration: Record<string, unknown>;
  travellerManifest: Record<string, unknown>;
  unitSellingPriceMinor: number;
  currency: string;
  state: TripBucketState;
  lastRevalidatedAt: ISODateString;
  createdAt: ISODateString;
}

export interface FavoriteEntity {
  id: UUID;
  userId?: UUID;
  sessionId: string;
  canonicalOfferId: string;
  productType: string;
  title: string;
  snapshotPriceMinor: number;
  currency: string;
  savedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// 4. Offers & Manual Listing Management Domain
// ----------------------------------------------------------------------------

export type ManualListingStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'IN_REVIEW'
  | 'PUBLISHED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'COMMERCIALLY_VERIFIED'
  | 'VERIFICATION_PENDING'
  | 'CONTRACT_PENDING';

export interface ManualListingEntity {
  id: UUID;
  organizationId?: UUID;
  productType: string;
  sourceType: 'DIRECT_CONTRACT' | 'MANUAL_SERVICE' | 'CURATED_PACKAGE';
  inventorySource?: 'DIRECT_CONTRACT' | 'MANUAL_INTERNAL' | 'PARTNER_MANUAL';
  listingKind?: 'SELLABLE_INVENTORY' | 'SERVICE' | 'PACKAGE';
  compositionType?: 'SINGLE' | 'CURATED_PACKAGE' | 'DYNAMIC_BUNDLE';
  fulfillmentMode?: 'INSTANT' | 'ON_REQUEST' | 'MANUAL_CONFIRMATION';
  environmentClass?: 'PRODUCTION' | 'SANDBOX' | 'SEED';
  sellability?: 'DISCOVERY_ONLY' | 'QUOTE_ONLY' | 'BOOKABLE';
  partnerSupplierId: string;
  partnerName: string;
  contractReference: string;
  title: string;
  subtitle: string;
  description?: string;
  destinationCity: string;
  destinationCountry: string;
  destinationCountryCode?: string;
  latitude?: number;
  longitude?: number;
  contractedNetCostMinor: number;
  costCurrency: string;
  platformMarkupPercent: number;
  manualOverridePriceMinor?: number;
  overrideReason?: string;
  sellingPriceMinor: number;
  sellingCurrency: string;
  availableQuota: number;
  isUnlimitedQuota: boolean;
  blackoutDates: string[]; // ISO YYYY-MM-DD
  minimumNoticeHours: number;
  validFrom: ISODateString;
  validUntil: ISODateString;
  confirmationMode: 'INSTANT_CONFIRM' | 'REQUEST_TO_CONFIRM' | 'ASSISTED_SERVICE';
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  termsReference: string;
  heroImageUrl: string;
  galleryImageUrls: string[];
  isFeatured: boolean;
  pinAboveApi: boolean;
  isB2BVisible: boolean;
  isB2CVisible: boolean;
  publicationStatus?: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  distributionScope?: 'B2C_ONLY' | 'B2B_ONLY' | 'BOTH' | 'INTERNAL_ONLY';
  editorUserId?: UUID;
  approverUserId?: UUID;
  effectiveFrom?: ISODateString;
  effectiveTo?: ISODateString;
  bookingWindow?: {
    minAdvanceDays?: number;
    maxAdvanceDays?: number;
    minimumNoticeHours?: number;
  };
  stopSale?: boolean;
  allottedQuota?: number;
  heldQuota?: number;
  bookedQuota?: number;
  remainingQuota?: number;
  canAtomicallyReserve?: boolean;
  isExclusiveDeal?: boolean;
  pinReason?: string;
  pinValidFrom?: ISODateString;
  pinValidUntil?: ISODateString;
  sourceOwner?: {
    partnerId: string;
    partnerName: string;
    contactEmail: string;
  };
  revisionNumber?: number;
  refundEligibilityDescription?: string;
  refundability?: 'NON_REFUNDABLE' | 'PARTIALLY_REFUNDABLE' | 'FULLY_REFUNDABLE';
  confirmationDeadlineHours?: number;
  timezone?: string;
  supplierContact?: {
    name: string;
    email: string;
    phone?: string;
    emergencyPhone?: string;
  };
  fulfilmentChannel?: 'EMAIL' | 'PORTAL' | 'PHONE' | 'WHATSAPP' | 'AUTOMATED_WEBHOOK';
  minTravellers?: number;
  maxTravellers?: number;
  childRules?: {
    minAgeYears?: number;
    infantFreeUnderYears?: number;
    childDiscountPercent?: number;
    note?: string;
  };
  inventoryHoldExpiryMinutes?: number;
  mediaAssets?: {
    heroUrl: string;
    galleryUrls: string[];
    brochurePdfUrl?: string;
  };
  bookingTerms?: string;
  lastVerifiedAt?: ISODateString;
  internalNotes?: string;
  verificationStatus?: 'VERIFIED_CONTRACT' | 'VERIFIED_INTERNAL' | 'PARTNER_PENDING' | 'UNVERIFIED' | 'PROTOTYPE';
  createdBy?: UUID;
  reviewedBy?: UUID;
  approvedBy?: UUID;
  publishedAt?: ISODateString;
  pausedAt?: ISODateString;
  archivedAt?: ISODateString;
  taxesAndFees?: {
    totalTaxMinor: number;
    isTaxInclusive: boolean;
    vatMinor?: number;
    tourismDirhamOrLevyMinor?: number;
    serviceChargeMinor?: number;
    mandatoryLocalFeesText?: string;
  };
  b2bPricing?: {
    distributionScope: 'B2C_ONLY' | 'B2B_ONLY' | 'BOTH' | 'INTERNAL_ONLY';
    b2bNetPriceMinor: number;
    agencyMarkupPercent?: number;
    agencyMarkupMinor?: number;
    agencyCommissionPercent?: number;
    agencyCommissionMinor?: number;
    clientFacingPriceMinor?: number;
  };
  status: ManualListingStatus;
  publishedByUserId?: UUID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ManualListingAuditLogEntity {
  id: UUID;
  listingId: UUID;
  actorUserId: UUID;
  action: 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED' | 'PRICE_OVERRIDDEN';
  changeSummary: string;
  previousStateSnapshot?: Record<string, unknown>;
  newStateSnapshot: Record<string, unknown>;
  createdAt: ISODateString;
}

export interface OfferSnapshotEntity {
  id: UUID;
  canonicalOfferId: string;
  productType: string;
  sourceType: string;
  supplierId: string;
  title: string;
  originCode?: string;
  destinationCode?: string;
  validFrom?: ISODateString;
  validUntil?: ISODateString;
  rawSupplierCostMinor: number;
  rawCurrency: string;
  sellingPriceMinor: number;
  displayCurrency: string;
  inclusions: string[];
  exclusions: string[];
  termsHash: string;
  snapshotData: Record<string, unknown>;
  createdAt: ISODateString;
}

// ----------------------------------------------------------------------------
// 5. Booking Domain
// ----------------------------------------------------------------------------

export type BookingOverallStatus =
  | 'PENDING_REVALIDATION'
  | 'BOOKING'
  | 'CONFIRMED'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'MANUAL_REVIEW';

export type BookingItemStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface BookingGroupEntity {
  id: UUID;
  bookingReference: string; // e.g. VCT-2026-X8K92M
  userId?: UUID;
  organizationId?: UUID;
  checkoutSessionId: string;
  totalSellingPriceMinor: number;
  currency: string;
  paymentStatus: 'UNPAID' | 'AUTHORIZED' | 'SETTLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';
  overallFulfillmentStatus: BookingOverallStatus;
  createdAt: ISODateString;
  confirmedAt?: ISODateString;
}

export interface BookingItemEntity {
  id: UUID;
  bookingGroupId: UUID;
  vacatinaBookingReference: string; // Links to parent BookingGroupEntity.bookingReference
  canonicalOfferId: string;
  productType: string;
  supplierId: string;
  supplierBookingReference?: string;
  supplierPnr?: string; // Real upstream airline PNR (strictly undefined in sandbox/candidate)
  supplierConfirmationNumber?: string; // Real upstream hotel confirmation (strictly undefined in sandbox)
  vacatinaServiceReference?: string; // Internal Vacatina intake ref for visa/concierge
  isUpstreamConfirmed: boolean;
  title: string;
  bookingMode: string;
  itemPriceMinor: number;
  currency: string;
  fulfillmentStatus: BookingItemStatus;
  failureReason?: string;
  compensationAction?: 'NONE' | 'CANCEL_VOID' | 'REFUND' | 'MANUAL_TRIAGE';
  confirmedAt?: ISODateString;

  // --- Booking Provenance & Reconciliation (Audit v2.5 / Directive 5) ---
  inventorySourceType?: 'MANUAL_DIRECT' | 'API_SUPPLIER' | 'INTERNAL_SERVICE' | 'DYNAMIC_PACKAGE' | 'SAMPLE_INVENTORY' | string;
  providerId?: string;
  sourceOfferId?: string;
  sourceReference?: string;
  commercialEvidenceId?: string;
  originalNetMinor?: number;
  taxesMinor?: number;
  feesMinor?: number;
  markupMinor?: number;
  discountMinor?: number;
  customerSellingAmountMinor?: number;
  settlementCurrency?: string;
  priceRevalidationTimestamp?: ISODateString;
}

export interface BookingStatusHistoryEntity {
  id: UUID;
  bookingGroupId: UUID;
  bookingItemId?: UUID;
  previousStatus: string;
  newStatus: string;
  changedByUserId?: UUID;
  reason: string;
  timestamp: ISODateString;
}

// ----------------------------------------------------------------------------
// 6. Payments Domain
// ----------------------------------------------------------------------------

export type PaymentOrderStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'VOIDED'
  | 'REFUNDED';

export interface PaymentOrderEntity {
  id: UUID;
  bookingGroupId: UUID;
  organizationId?: UUID;
  gatewayId: 'STRIPE' | 'PAYPAL' | 'PAYHERE' | 'COMMERCIAL_BANK_LK' | 'MOCK_SANDBOX';
  gatewayOrderId?: string;
  amountMinor: number;
  currency: string;
  status: PaymentOrderStatus;
  idempotencyKey: string;
  createdAt: ISODateString;
  settledAt?: ISODateString;
}

export interface PaymentWebhookEventEntity {
  id: UUID;
  gatewayId: string;
  eventId: string;
  eventType: string;
  rawPayload: string;
  processedStatus: 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  idempotencyKey: string;
  receivedAt: ISODateString;
  processedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// 7. Visa Domain
// ----------------------------------------------------------------------------

export type VisaApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENT_CHECK'
  | 'CONSULAR_PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED';

export interface VisaApplicationEntity {
  id: UUID;
  bookingItemId?: UUID;
  userId?: UUID;
  organizationId?: UUID;
  destinationCountry: string;
  visaType: string;
  travelerName: string;
  passportNumber: string;
  appointmentDate?: string;
  status: VisaApplicationStatus;
  assignedOfficerId?: UUID;
  submittedAt?: ISODateString;
  updatedAt: ISODateString;
}

// ----------------------------------------------------------------------------
// 8. B2B Partner Domain
// ----------------------------------------------------------------------------

export interface ClientEntity {
  id: UUID;
  organizationId: UUID;
  clientType: 'INDIVIDUAL' | 'CORPORATE_SME' | 'VIP';
  corporateName?: string;
  primaryContactName: string;
  email: string;
  phone: string;
  creditLimitMinor: number;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: ISODateString;
}

export interface MarkupRuleEntity {
  id: UUID;
  organizationId: UUID;
  productType: string;
  destinationFilter?: string;
  markupType: 'PERCENTAGE' | 'FIXED';
  markupValue: number;
  allowAgentOverride: boolean;
  createdAt: ISODateString;
}

export interface CommissionLedgerEntity {
  id: UUID;
  organizationId: UUID;
  bookingGroupId: UUID;
  bookingItemId: UUID;
  commissionAmountMinor: number;
  currency: string;
  status: 'ACCRUED' | 'APPROVED' | 'PAID' | 'CLAWBACK';
  settlementBatchId?: string;
  timestamp: ISODateString;
}

// ----------------------------------------------------------------------------
// 9. Content Domain
// ----------------------------------------------------------------------------

export interface PackageEntity {
  id: UUID;
  slug: string;
  title: string;
  destinationId: string;
  durationDays: number;
  durationNights: number;
  theme: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  validFrom: string;
  validUntil: string;
  basePriceMinor: number;
  currency: string;
  createdAt: ISODateString;
}

// ----------------------------------------------------------------------------
// 10. Operations Domain
// ----------------------------------------------------------------------------

export interface SupportTicketEntity {
  id: UUID;
  ticketReference: string;
  userId?: UUID;
  organizationId?: UUID;
  bookingGroupId?: UUID;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'INVESTIGATING' | 'PENDING_SUPPLIER' | 'RESOLVED' | 'CLOSED';
  assignedAgentId?: UUID;
  subject: string;
  createdAt: ISODateString;
  resolvedAt?: ISODateString;
}

// ----------------------------------------------------------------------------
// 11. Platform Domain
// ----------------------------------------------------------------------------

export interface IdempotencyKeyEntity {
  id: UUID;
  idempotencyKey: string;
  targetEndpoint: string;
  requestHash: string;
  responseStatus?: number;
  responseBody?: string;
  expiresAt: ISODateString;
  createdAt: ISODateString;
}

export interface OutboxEventEntity {
  id: UUID;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  scheduledAt: ISODateString;
  publishedAt?: ISODateString;
}

export interface AuditLogEntity {
  id: UUID;
  actorUserId?: UUID;
  actorOrganizationId?: UUID;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  targetEntity: string;
  targetEntityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  justificationReason: string;
  timestamp: ISODateString;
}
