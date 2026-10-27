/* Canonical test fixtures.
 *
 * Creates manual listings through the real DRAFT -> VERIFIED -> PRICED -> PUBLISHED
 * lifecycle and synchronizes them with unified inventory. Tests that need a
 * customer-visible offer must use these fixtures instead of SEED, sandbox or
 * hard-coded legacy offer identifiers.
 */

import type { SecurityContext } from '../../src/server/auth/rbac.ts';
import type { SupportedCurrency } from '../../src/lib/domain/types.ts';
import type { ConfirmationMode, StructuredLocation } from '../../src/lib/domain/inventory-models.ts';
import {
  manualInventoryService,
  type ManualListingRecord
} from '../../src/lib/services/manual-inventory.service.ts';
import { globalUnifiedInventory } from '../../src/server/inventory/unified-inventory.service.ts';

export interface CanonicalListingInput {
  id: string;
  productType: ManualListingRecord['productType'];
  collection?: string;
  title: string;
  subtitle?: string;
  partnerSupplierId: string;
  partnerName?: string;
  location: StructuredLocation;
  contractedBaseCost: number;
  standardSellingPriceLkr: number;
  costCurrency?: SupportedCurrency;
  availableQuota?: number;
  confirmationMode?: ConfirmationMode;
  inclusions?: string[];
  exclusions?: string[];
  cancellationPolicy?: string;
}

export interface CanonicalListingFixture {
  listing: ManualListingRecord;
  offerId: string;
}

const fixtureActors = {
  creator: { id: 'fixture_cms_creator', name: 'Fixture CMS Creator' },
  verifier: {
    id: 'fixture_commercial_verifier',
    name: 'Fixture Commercial Verifier',
    permissions: ['cms:verify_commercial']
  },
  approver: {
    id: 'fixture_pricing_approver',
    name: 'Fixture Pricing Approver',
    permissions: ['cms:approve_pricing']
  },
  publisher: {
    id: 'fixture_publishing_director',
    name: 'Fixture Publishing Director',
    permissions: ['cms:publish_listings']
  }
};

/** Canonical offer id produced by ManualCmsAdapter.computeOfferId. */
export function canonicalManualOfferId(listingId: string, productType: string): string {
  return `vct-man-${productType.slice(0, 2)}-${listingId.slice(-6)}`;
}

/**
 * Create and publish a real manual listing, then make it visible to the
 * customer search / offer APIs through the same synchronization the admin
 * publishing route performs.
 */
export function createPublishedManualListing(input: CanonicalListingInput): CanonicalListingFixture {
  const existing = manualInventoryService.getListingById(input.id);
  if (existing) {
    const offerId = canonicalManualOfferId(existing.id, existing.productType);
    globalUnifiedInventory.syncManualListing(existing);
    return { listing: existing, offerId };
  }

  const confirmationMode = input.confirmationMode ?? 'INSTANT_CONFIRM';
  const listing = manualInventoryService.createListing({
    id: input.id,
    collection: input.collection ?? 'canonical-test-inventory',
    productType: input.productType,
    title: input.title,
    subtitle: input.subtitle ?? input.title,
    slug: input.id,
    partnerSupplierId: input.partnerSupplierId,
    partnerName: input.partnerName ?? 'Vacatina Canonical Test Supplier',
    supplierLegalName: 'Vacatina Canonical Test Supplier (Private) Limited',
    supplierTaxId: 'TIN-TEST-CANONICAL',
    supplierContactEmail: 'contracts@canonical.test',
    contractReference: `CNT-${input.id}`,
    effectiveFromIso: '2026-01-01T00:00:00.000Z',
    effectiveToIso: '2027-12-31T23:59:59.000Z',
    location: input.location,
    contractedBaseCost: input.contractedBaseCost,
    standardSellingPriceLkr: input.standardSellingPriceLkr,
    costCurrency: input.costCurrency ?? 'LKR',
    sellingCurrency: input.costCurrency ?? 'LKR',
    markupPercent: 20,
    commissionPercent: 5,
    isTaxInclusive: true,
    availableQuota: input.availableQuota ?? 10,
    allotmentTotal: input.availableQuota ?? 10,
    minLeadDays: 0,
    validFromIso: '2026-01-01T00:00:00.000Z',
    validUntilIso: '2027-12-31T23:59:59.000Z',
    salesValidFromIso: '2026-01-01T00:00:00.000Z',
    salesValidUntilIso: '2027-12-31T23:59:59.000Z',
    confirmationMode,
    bookingMode: confirmationMode === 'INSTANT_CONFIRM' ? 'INSTANT_BOOK' : 'REQUEST_TO_BOOK',
    partnerSlaHours: 4,
    cancellationPolicy: input.cancellationPolicy ?? 'Free cancellation up to 48 hours before travel.',
    freeCancellationDeadlineHours: 48,
    inclusions: input.inclusions ?? ['Canonical fixture inclusion'],
    exclusions: input.exclusions ?? ['Canonical fixture exclusion'],
    exclusiveOffer: false,
    pinPriority: 0
  }, fixtureActors.creator);

  manualInventoryService.submitForVerification(input.id, fixtureActors.creator);
  manualInventoryService.verifyCommercialContract(input.id, fixtureActors.verifier, {
    contractReference: `CNT-${input.id}`,
    supplierLegalName: 'Vacatina Canonical Test Supplier (Private) Limited',
    commercialOwner: 'Fixture Commercial Verifier (fixture_commercial_verifier)',
    signedDateIso: '2026-01-01T00:00:00.000Z',
    effectiveFromIso: '2026-01-01T00:00:00.000Z',
    effectiveToIso: '2027-12-31T23:59:59.000Z',
    rateSource: 'CANONICAL_TEST_RATE_SHEET',
    settlementTerms: 'Net 30 days bank transfer',
    cancellationTerms: input.cancellationPolicy ?? 'Free cancellation up to 48 hours before travel.',
    allotmentRule: confirmationMode === 'INSTANT_CONFIRM' ? 'DAILY_COMMITTED_ALLOTMENT' : 'ON_REQUEST_4H_SLA',
    operationalContact: 'contracts@canonical.test',
    documentProofReference: `DOC-${input.id}`,
    approvedBy: 'fixture_commercial_verifier',
    approvalTimestampIso: '2026-10-01T00:00:00.000Z',
    isEvidenceVerified: true
  });
  manualInventoryService.approvePricingStructure(input.id, fixtureActors.approver, {
    markupPercent: 20,
    standardSellingPriceLkr: input.standardSellingPriceLkr,
    note: 'Canonical fixture pricing approval'
  });
  manualInventoryService.publishListing(input.id, fixtureActors.publisher);

  const published = manualInventoryService.getListingById(input.id)!;
  globalUnifiedInventory.syncManualListing(published);

  return {
    listing: published,
    offerId: canonicalManualOfferId(published.id, published.productType)
  };
}

/** Distinct customer identity per protected-route test. */
export function customerContext(userId: string, email = `${userId}@canonical.test`): SecurityContext {
  return { userId, email, role: 'CUSTOMER' };
}

/** Headers accepted by the customer session boundary for trip-bucket operations. */
export function sessionHeaders(sessionId: string, extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-session-id': sessionId, ...extra };
}

export function hotelFixture(
  id = 'fixture-ht-canonical-000101',
  city = 'Galle',
  location: Partial<StructuredLocation> = {}
): CanonicalListingFixture {
  return createPublishedManualListing({
    id,
    productType: 'hotels',
    title: `${city} Canonical Harbour Residence`,
    subtitle: 'Verified direct-contract suite with breakfast',
    partnerSupplierId: 'CANONICAL_TEST_HOTEL_PARTNER',
    location: { city, country: 'Sri Lanka', countryCode: 'LK', ...location },
    contractedBaseCost: 75000,
    standardSellingPriceLkr: 96000,
    availableQuota: 6,
    inclusions: ['Daily breakfast', 'Airport transfer'],
    exclusions: ['Spa treatments']
  });
}

export function flightFixture(id = 'fixture-fl-canonical-000201', city = 'Male', iataCode = 'MLE'): CanonicalListingFixture {
  return createPublishedManualListing({
    id,
    productType: 'flights',
    title: `Colombo to ${city} Canonical Charter`,
    subtitle: 'Verified direct-contract private charter',
    partnerSupplierId: 'CANONICAL_TEST_CHARTER_PARTNER',
    location: { city, country: 'Maldives', countryCode: 'MV', iataCode },
    contractedBaseCost: 120000,
    standardSellingPriceLkr: 150000,
    availableQuota: 8,
    inclusions: ['20kg checked baggage', 'Water aerodrome transfer'],
    exclusions: ['Hotel ground transfer']
  });
}

export function visaFixture(id = 'fixture-vs-canonical-000301'): CanonicalListingFixture {
  return createPublishedManualListing({
    id,
    productType: 'visa',
    title: 'United Arab Emirates Canonical Visit Visa',
    subtitle: 'Verified consular document audit and filing assistance',
    partnerSupplierId: 'CANONICAL_TEST_CONSULAR_PARTNER',
    location: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' },
    contractedBaseCost: 30000,
    standardSellingPriceLkr: 38000,
    availableQuota: 20,
    confirmationMode: 'ASSISTED_SERVICE',
    inclusions: ['Document audit', 'Embassy appointment filing assistance'],
    exclusions: ['Government visa fee (payable at embassy)']
  });
}
