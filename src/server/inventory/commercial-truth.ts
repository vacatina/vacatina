/* ============================================================================
 * Vacatina Commercial Truth Layer
 *
 * Purpose
 * -------
 * Architecture + code existing does NOT mean a commercial relationship exists.
 * This module is the single place that answers: "what do we actually KNOW about
 * this supplier / listing / offer?" It is derived from the existing provider
 * registry (no parallel registry) plus an evidence ledger.
 *
 * Rules
 * -----
 * 1. VERIFIED_EXISTING is only reachable through entries in COMMERCIAL_EVIDENCE_LEDGER
 *    (a real contract / credential / owner confirmation). The ledger ships EMPTY.
 *    Engineering flags (adapter exists, tests pass, registry lifecycle) never
 *    count as evidence.
 * 2. Supplier names (Duffel, LiteAPI, Viator, Rentalcars, Trainline, Traveltek,
 *    Allianz ...) are proposed / configurable adapters until evidence says otherwise.
 * 3. SEED / sample fixtures resolve to SEED_ONLY and are never production-sellable.
 * 4. Customer-facing copy never exposes API / MANUAL / HYBRID / SEED labels.
 * ============================================================================ */

import type { CanonicalOfferEntity } from './types.ts';
import { ArchitecturalInvariantViolationError } from './types.ts';
import { ProviderRegistryService } from './provider-registry.ts';

// ----------------------------------------------------------------------------
// 1. Truth statuses
// ----------------------------------------------------------------------------

export type CommercialTruthStatus =
  /** Only when a real source document / credential / owner confirmation exists. */
  | 'VERIFIED_EXISTING'
  /** Provider selected or proposed; no adapter or no production credentials confirmed. */
  | 'PLANNED_INTEGRATION'
  /** Adapter exists, production key / credential is missing. */
  | 'CREDENTIALS_REQUIRED'
  /** Technical path exists, supplier / commercial agreement is not verified. */
  | 'COMMERCIAL_AGREEMENT_REQUIRED'
  /** Manual workflow is architecturally supported; actual operational contract / process is not verified. */
  | 'MANUAL_OPERATION_PROPOSED'
  /** Simulated integration only. */
  | 'SANDBOX_ONLY'
  /** Development / demo data. Never searchable as live inventory, never stageable, never bookable. */
  | 'SEED_ONLY';

export const ALL_COMMERCIAL_TRUTH_STATUSES: readonly CommercialTruthStatus[] = [
  'VERIFIED_EXISTING',
  'PLANNED_INTEGRATION',
  'CREDENTIALS_REQUIRED',
  'COMMERCIAL_AGREEMENT_REQUIRED',
  'MANUAL_OPERATION_PROPOSED',
  'SANDBOX_ONLY',
  'SEED_ONLY'
];

// ----------------------------------------------------------------------------
// 2. Evidence ledger (ships empty — nothing is verified by default)
// ----------------------------------------------------------------------------

export type CommercialEvidenceKind =
  | 'SIGNED_CONTRACT'
  | 'PRODUCTION_CREDENTIAL'
  | 'LICENCE_OR_ACCREDITATION'
  | 'OWNER_CONFIRMATION'
  | 'SOURCE_DOCUMENT';

export interface CommercialEvidenceRecord {
  entityId: string;          // providerId or manual supplier id
  kind: CommercialEvidenceKind;
  reference: string;         // document id / file path / ticket id — must be traceable
  verifiedBy: string;        // named Vacatina person
  verifiedAtIso: string;
}

/**
 * Evidence ledger. INTENTIONALLY EMPTY.
 * An entry may only be added together with the real source document it points to.
 */
export const COMMERCIAL_EVIDENCE_LEDGER: CommercialEvidenceRecord[] = [];

function evidenceFor(entityId: string, ledger: CommercialEvidenceRecord[]): CommercialEvidenceRecord[] {
  return ledger.filter(e => e.entityId === entityId);
}

// ----------------------------------------------------------------------------
// 3. Provider / adapter identity
// ----------------------------------------------------------------------------

/**
 * Adapter `supplierId` values do not always equal provider-registry `providerId`.
 * This alias table makes the mapping explicit so truth lookups never silently miss.
 */
export const ADAPTER_SUPPLIER_ID_TO_REGISTRY_ID: Readonly<Record<string, string>> = {
  RENTALCARS_CONNECT: 'RENTALCARS',
  TRAVELTEK_CRUISE: 'TRAVELTEK',
  ALLIANZ_PARTNERS: 'ALLIANZ',
  VIATOR_SIGHTSEEING: 'VIATOR',
  VACATINA_CONSULAR_DESK: 'VACATINA_CONSULAR_CONCIERGE'
};

/** Registry providers that have an in-repo adapter (all of them produce simulated data). */
const REGISTRY_IDS_WITH_IN_REPO_ADAPTER: ReadonlySet<string> = new Set([
  'DUFFEL_NDC',
  'LITEAPI',
  'VIATOR',
  'RENTALCARS',
  'TRAVELTEK',
  'TRAINLINE',
  'ALLIANZ',
  'PAYLOAD_CMS_DIRECT',
  'VACATINA_HYBRID_BUNDLER',
  'VACATINA_CONSULAR_CONCIERGE'
]);

export function toRegistryProviderId(idOrAdapterId: string): string {
  return ADAPTER_SUPPLIER_ID_TO_REGISTRY_ID[idOrAdapterId] ?? idOrAdapterId;
}

export interface ProviderTruthResolution {
  providerId: string;
  /** The single headline status. */
  primary: CommercialTruthStatus;
  /** Every status that applies (primary first). */
  statuses: CommercialTruthStatus[];
  hasInRepoAdapter: boolean;
  evidence: CommercialEvidenceRecord[];
}

export function resolveProviderTruth(
  idOrAdapterId: string,
  ledger: CommercialEvidenceRecord[] = COMMERCIAL_EVIDENCE_LEDGER
): ProviderTruthResolution {
  const providerId = toRegistryProviderId(idOrAdapterId);
  const record = ProviderRegistryService.getProvider(providerId);
  const evidence = evidenceFor(providerId, ledger);
  const hasInRepoAdapter = REGISTRY_IDS_WITH_IN_REPO_ADAPTER.has(providerId);

  const hasAgreement = evidence.some(e => e.kind === 'SIGNED_CONTRACT' || e.kind === 'OWNER_CONFIRMATION');
  const hasCredential = evidence.some(e => e.kind === 'PRODUCTION_CREDENTIAL');
  const isInternal = record?.role === 'INTERNAL_SERVICE' || record?.role === 'INTERNAL_PLATFORM';

  if (isInternal) {
    // Internal desks / platforms: truth hinges on an owner confirming the real process exists.
    if (evidence.some(e => e.kind === 'OWNER_CONFIRMATION' || e.kind === 'SOURCE_DOCUMENT')) {
      return { providerId, primary: 'VERIFIED_EXISTING', statuses: ['VERIFIED_EXISTING'], hasInRepoAdapter, evidence };
    }
    const statuses: CommercialTruthStatus[] = ['MANUAL_OPERATION_PROPOSED'];
    if (record?.lifecycle === 'SANDBOX_ACTIVE' || record?.lifecycle === 'SCAFFOLD') statuses.push('SANDBOX_ONLY');
    return { providerId, primary: 'MANUAL_OPERATION_PROPOSED', statuses, hasInRepoAdapter, evidence };
  }

  if (hasAgreement && hasCredential) {
    return { providerId, primary: 'VERIFIED_EXISTING', statuses: ['VERIFIED_EXISTING'], hasInRepoAdapter, evidence };
  }

  const primary: CommercialTruthStatus = hasInRepoAdapter ? 'SANDBOX_ONLY' : 'PLANNED_INTEGRATION';
  const statuses: CommercialTruthStatus[] = [primary];
  if (hasInRepoAdapter && !hasCredential) statuses.push('CREDENTIALS_REQUIRED');
  if (!hasAgreement) statuses.push('COMMERCIAL_AGREEMENT_REQUIRED');
  return { providerId, primary, statuses, hasInRepoAdapter, evidence };
}

// ----------------------------------------------------------------------------
// 3b. Provider Activation State Machine (Requirement 2 & 12)
// PLANNED -> SANDBOX -> CREDENTIALS_CONFIGURED -> COMMERCIAL_VERIFIED -> LIVE -> SUSPENDED
// ----------------------------------------------------------------------------

export type ProviderActivationStage =
  | 'PLANNED'
  | 'SANDBOX'
  | 'CREDENTIALS_CONFIGURED'
  | 'COMMERCIAL_VERIFIED'
  | 'LIVE'
  | 'SUSPENDED';

export interface ProviderActivationEvaluation {
  providerId: string;
  stage: ProviderActivationStage;
  hasCredentials: boolean;
  hasCommercialEvidence: boolean;
  isSuspended: boolean;
  canProduceProductionBookableInventory: boolean;
  blockers: string[];
}

export function hasEnvCredentialForProvider(
  providerId: string,
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): boolean {
  switch (providerId) {
    case 'DUFFEL_NDC': {
      // Reconcile canonical DUFFEL_ACCESS_TOKEN with migration fallbacks
      const token = (
        env.DUFFEL_ACCESS_TOKEN?.trim() ||
        env.DUFFEL_API_TOKEN?.trim() ||
        env.DUFFEL_TOKEN?.trim() ||
        ''
      );
      const isPlaceholder = !token || token.includes('placeholder');
      const isProduction = env.DUFFEL_ENVIRONMENT === 'production' || env.DUFFEL_ENV === 'live' || token.startsWith('duffel_live_');
      return Boolean(!isPlaceholder && isProduction);
    }
    case 'LITEAPI':
      return Boolean(env.LITEAPI_PRODUCTION_KEY && !env.LITEAPI_PRODUCTION_KEY.includes('placeholder'));
    case 'VIATOR':
    case 'VIATOR_TOURS':
      return Boolean(env.VIATOR_API_KEY && !env.VIATOR_API_KEY.includes('placeholder'));
    case 'TRAINLINE':
      return Boolean(env.TRAINLINE_PARTNER_KEY && !env.TRAINLINE_PARTNER_KEY.includes('placeholder'));
    case 'TRAVELTEK':
      return Boolean(env.TRAVELTEK_CLIENT_ID && !env.TRAVELTEK_CLIENT_ID.includes('placeholder'));
    case 'ALLIANZ':
      return Boolean(env.ALLIANZ_API_KEY && !env.ALLIANZ_API_KEY.includes('placeholder'));
    case 'RENTALCARS':
      return Boolean(env.RENTALCARS_API_KEY && !env.RENTALCARS_API_KEY.includes('placeholder'));
    default:
      return false;
  }
}

/**
 * Evaluates provider activation stage against the 6-state machine.
 * Hard Rule: A provider NEVER becomes LIVE merely because an API key exists.
 * LIVE requires BOTH verified production credentials AND verified commercial evidence.
 * Only LIVE sources may create production-bookable inventory.
 */
export function evaluateProviderActivation(
  idOrAdapterId: string,
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  ledger: CommercialEvidenceRecord[] = COMMERCIAL_EVIDENCE_LEDGER
): ProviderActivationEvaluation {
  const providerId = toRegistryProviderId(idOrAdapterId);
  const evidence = evidenceFor(providerId, ledger);
  const record = ProviderRegistryService.getProvider(providerId);
  const hasInRepoAdapter = REGISTRY_IDS_WITH_IN_REPO_ADAPTER.has(providerId);

  const hasAgreement = evidence.some(
    e => e.kind === 'SIGNED_CONTRACT' || e.kind === 'OWNER_CONFIRMATION' || e.kind === 'LICENCE_OR_ACCREDITATION'
  );
  const hasCredential =
    evidence.some(e => e.kind === 'PRODUCTION_CREDENTIAL') || hasEnvCredentialForProvider(providerId, env);

  const isSuspended =
    (record?.operationalState as string) === 'SUSPENDED' ||
    env[`SUSPEND_PROVIDER_${providerId}`] === '1';

  const blockers: string[] = [];

  if (isSuspended) {
    return {
      providerId,
      stage: 'SUSPENDED',
      hasCredentials: Boolean(hasCredential),
      hasCommercialEvidence: hasAgreement,
      isSuspended: true,
      canProduceProductionBookableInventory: false,
      blockers: ['PROVIDER_OPERATIONALLY_SUSPENDED']
    };
  }

  // State 5: LIVE (Strict Gate: BOTH credentials AND commercial evidence required)
  if (hasCredential && hasAgreement) {
    return {
      providerId,
      stage: 'LIVE',
      hasCredentials: true,
      hasCommercialEvidence: true,
      isSuspended: false,
      canProduceProductionBookableInventory: true,
      blockers: []
    };
  }

  // State 3: CREDENTIALS_CONFIGURED (Key exists, but commercial agreement/evidence missing)
  if (hasCredential && !hasAgreement) {
    blockers.push('COMMERCIAL_EVIDENCE_UNVERIFIED');
    return {
      providerId,
      stage: 'CREDENTIALS_CONFIGURED',
      hasCredentials: true,
      hasCommercialEvidence: false,
      isSuspended: false,
      canProduceProductionBookableInventory: false,
      blockers
    };
  }

  // State 4: COMMERCIAL_VERIFIED (Contract exists, but production API keys missing)
  if (!hasCredential && hasAgreement) {
    blockers.push('PRODUCTION_CREDENTIALS_MISSING');
    return {
      providerId,
      stage: 'COMMERCIAL_VERIFIED',
      hasCredentials: false,
      hasCommercialEvidence: true,
      isSuspended: false,
      canProduceProductionBookableInventory: false,
      blockers
    };
  }

  // State 2: SANDBOX (In-repo adapter exists without credentials or contract)
  if (hasInRepoAdapter) {
    blockers.push('PRODUCTION_CREDENTIALS_MISSING');
    blockers.push('COMMERCIAL_EVIDENCE_MISSING');
    return {
      providerId,
      stage: 'SANDBOX',
      hasCredentials: false,
      hasCommercialEvidence: false,
      isSuspended: false,
      canProduceProductionBookableInventory: false,
      blockers
    };
  }

  // State 1: PLANNED (No adapter, no credentials, no agreement)
  blockers.push('ADAPTER_NOT_IMPLEMENTED');
  blockers.push('PRODUCTION_CREDENTIALS_MISSING');
  blockers.push('COMMERCIAL_EVIDENCE_MISSING');
  return {
    providerId,
    stage: 'PLANNED',
    hasCredentials: false,
    hasCommercialEvidence: false,
    isSuspended: false,
    canProduceProductionBookableInventory: false,
    blockers
  };
}

// ----------------------------------------------------------------------------
// 4. Offer-level truth
// ----------------------------------------------------------------------------

type OfferTruthInput = Pick<CanonicalOfferEntity, 'environmentClass' | 'supplierId'> &
  Partial<Pick<CanonicalOfferEntity, 'sourceMetadata' | 'commercialEvidenceId' | 'commercialStatus' | 'providerId' | 'sourceType'>>;

export function isSeedOffer(offer: OfferTruthInput): boolean {
  const meta = (offer.sourceMetadata ?? {}) as Record<string, unknown>;
  return (
    offer.environmentClass === 'SEED' ||
    meta.dataOrigin === 'SEED_FIXTURE' ||
    offer.commercialStatus === 'SAMPLE_DEMO'
  );
}

export function resolveOfferTruth(
  offer: OfferTruthInput,
  ledger: CommercialEvidenceRecord[] = COMMERCIAL_EVIDENCE_LEDGER
): CommercialTruthStatus {
  if (isSeedOffer(offer)) return 'SEED_ONLY';

  const sourceType = String(offer.sourceType ?? '');
  const isManual = ['MANUAL', 'DIRECT_CONTRACT', 'MANUAL_SERVICE', 'CURATED_PACKAGE', 'MANUAL_DIRECT', 'MANUAL_CONTRACT'].includes(sourceType);

  if (isManual) {
    // A manual listing is only "verified" if it carries a traceable evidence dossier.
    const hasDossier = Boolean(offer.commercialEvidenceId) && offer.commercialStatus === 'COMMERCIALLY_VERIFIED';
    return hasDossier ? 'VERIFIED_EXISTING' : 'MANUAL_OPERATION_PROPOSED';
  }

  return resolveProviderTruth(offer.providerId || offer.supplierId, ledger).primary;
}

// ----------------------------------------------------------------------------
// 5. Production runtime policy
// ----------------------------------------------------------------------------

export function isProductionRuntime(env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}): boolean {
  return env.NODE_ENV === 'production' || env.VACATINA_ENV === 'production';
}

/** SEED fixtures may only be loaded outside production. */
export function isSeedFixtureLoadingAllowed(env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}): boolean {
  if (env.VACATINA_DISABLE_SEED_FIXTURES === '1') return false;
  return !isProductionRuntime(env);
}

export interface GlobalProductionBlocker {
  code: 'PERSISTENCE_NOT_CONFIGURED' | 'PAYMENT_GATEWAY_NOT_CONFIGURED' | 'AUTH_NOT_CONFIGURED' | 'NO_VERIFIED_COMMERCIAL_EVIDENCE';
  description: string;
}

/**
 * Cross-cutting blockers that stop real production booking regardless of supplier.
 * Computed from the real environment + evidence ledger — never hard-coded as "resolved".
 */
export function getGlobalProductionBlockers(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  ledger: CommercialEvidenceRecord[] = COMMERCIAL_EVIDENCE_LEDGER
): GlobalProductionBlocker[] {
  const blockers: GlobalProductionBlocker[] = [];
  const missing = (v?: string) => !v || v.includes('placeholder');

  if (missing(env.DATABASE_URL)) {
    blockers.push({ code: 'PERSISTENCE_NOT_CONFIGURED', description: 'No managed database configured; storage engine is in-memory and loses state on restart.' });
  }
  if (missing(env.STRIPE_SECRET_KEY) && missing(env.IPG_MERCHANT_SECRET)) {
    blockers.push({ code: 'PAYMENT_GATEWAY_NOT_CONFIGURED', description: 'No live payment gateway credential configured.' });
  }
  if (missing(env.CLERK_SECRET_KEY)) {
    blockers.push({ code: 'AUTH_NOT_CONFIGURED', description: 'No production identity provider secret configured.' });
  }
  if (ledger.length === 0) {
    blockers.push({ code: 'NO_VERIFIED_COMMERCIAL_EVIDENCE', description: 'Evidence ledger is empty: no supplier contract, credential, licence or owner confirmation has been recorded.' });
  }
  return blockers;
}

// ----------------------------------------------------------------------------
// 6. Booking modes & customer-facing confirmation language
// ----------------------------------------------------------------------------

export type CustomerBookingMode =
  | 'INSTANT_BOOK'
  | 'REQUEST_TO_BOOK'
  | 'MANUAL_CONFIRMATION'
  | 'ASSISTED_SERVICE';

type BookingModeInput = Pick<CanonicalOfferEntity, 'fulfillmentMode' | 'confirmationMode' | 'bookingMode' | 'listingKind' | 'productType'>;

/** Source-specific booking mode. Source (api/manual) decides this; the customer UI never sees the source. */
export function deriveCustomerBookingMode(offer: BookingModeInput): CustomerBookingMode {
  if (offer.confirmationMode === 'ASSISTED_SERVICE' || offer.listingKind === 'SERVICE' || offer.productType === 'visa') {
    return 'ASSISTED_SERVICE';
  }
  if (offer.fulfillmentMode === 'MANUAL_CONFIRMATION') return 'MANUAL_CONFIRMATION';
  if (offer.fulfillmentMode === 'INSTANT' && offer.bookingMode === 'INSTANT_BOOK') return 'INSTANT_BOOK';
  return 'REQUEST_TO_BOOK';
}

export const CUSTOMER_CONFIRMATION_LABELS: Readonly<Record<CustomerBookingMode, string>> = {
  INSTANT_BOOK: 'Instant confirmation',
  REQUEST_TO_BOOK: 'Confirmation required',
  MANUAL_CONFIRMATION: 'Confirmation required',
  ASSISTED_SERVICE: 'Vacatina assistance'
};

export function getCustomerConfirmationLabel(offer: BookingModeInput): string {
  return CUSTOMER_CONFIRMATION_LABELS[deriveCustomerBookingMode(offer)];
}

const FORBIDDEN_CUSTOMER_TERMS = /\b(API listing|manual listing|hybrid listing|seed|MANUAL|HYBRID|SEED|DUFFEL_NDC|LITEAPI|sourceType)\b/i;

/** True if a customer-facing string leaks an internal source label. */
export function leaksInternalSourceLabel(text: string): boolean {
  return FORBIDDEN_CUSTOMER_TERMS.test(text);
}

// ----------------------------------------------------------------------------
// 6b. Commercial Truth Booking & Checkout Invariant Guard (Requirement 2, 11, 14, 17)
// ----------------------------------------------------------------------------

export function assertOfferBookableInCurrentEnvironment(
  offer: Pick<CanonicalOfferEntity, 'environmentClass' | 'supplierId'> &
    Partial<Pick<CanonicalOfferEntity, 'offerId' | 'canonicalOfferId' | 'sourceType' | 'providerId' | 'commercialEvidenceId' | 'commercialStatus' | 'sourceMetadata'>>,
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  ledger: CommercialEvidenceRecord[] = COMMERCIAL_EVIDENCE_LEDGER
): void {
  // Invariant 1: SEED is strictly non-bookable across ALL environments
  if (isSeedOffer(offer)) {
    throw new ArchitecturalInvariantViolationError(
      'SEED_OFFER_NOT_BOOKABLE',
      `Commercial Truth Guard: Offer '${offer.offerId}' is classified as SEED and cannot be booked or staged as READY.`
    );
  }

  const isProd = isProductionRuntime(env);
  if (!isProd) return; // Non-production dev/test environments allow simulated sandbox verification

  // Invariant 2: In production runtime, external API / HYBRID providers MUST be in LIVE stage
  const isExternal = offer.sourceType === 'API' || offer.sourceType === 'HYBRID';
  if (isExternal) {
    const activation = evaluateProviderActivation(offer.providerId || offer.supplierId || '', env, ledger);
    if (activation.stage !== 'LIVE') {
      throw new ArchitecturalInvariantViolationError(
        'PROVIDER_NOT_LIVE_FOR_PRODUCTION',
        `Commercial Truth Guard: Provider '${offer.providerId || offer.supplierId}' is in '${activation.stage}' stage (LIVE required). Blockers: ${activation.blockers.join(', ')}`
      );
    }
  }

  // Invariant 3: In production runtime, MANUAL listings MUST have verified commercial evidence
  const isManual = offer.sourceType === 'MANUAL';
  if (isManual) {
    const hasDossier = Boolean(offer.commercialEvidenceId) && offer.commercialStatus === 'COMMERCIALLY_VERIFIED';
    const hasLedgerEntry = ledger.some(e => e.entityId === offer.supplierId || e.entityId === offer.providerId);
    if (!hasDossier && !hasLedgerEntry) {
      throw new ArchitecturalInvariantViolationError(
        'UNVERIFIED_MANUAL_LISTING_CANNOT_CHECKOUT',
        `Commercial Truth Guard: Manual offer '${offer.offerId}' lacks verified commercial evidence dossier and cannot be booked in production.`
      );
    }
  }
}

// ----------------------------------------------------------------------------
// 7. Unsupported-claim lint (used by tests against docs & customer copy)
// ----------------------------------------------------------------------------

const UNSUPPORTED_CLAIM_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'contracts-active', pattern: /contracts?\s+(are\s+|is\s+)?(active|operational)/i },
  { id: 'direct-contracts-operational', pattern: /direct\s+contracts?\s+operational/i },
  { id: 'quota-active', pattern: /quota\s+active/i },
  { id: 'charter-active', pattern: /charter\s+(contracts?\s+)?active/i },
  { id: 'operator-contracts-active', pattern: /operator\s+contracts?\s+active/i },
  { id: 'workflow-active', pattern: /workflow\s+(desk\s+)?active/i },
  { id: 'licensed-guides-contracted', pattern: /contracted\s+directly\s+with/i },
  { id: 'commercially-verified-spaced', pattern: /COMMERCIALLY VERIFIED/ },
  { id: 'production-ready-spaced', pattern: /PRODUCTION READY/ },
  { id: 'directly-curated-by-tour-designers', pattern: /directly\s+curated\s+by/i },
  { id: 'simulated-instant-confirmation', pattern: /Instant\s+confirmation\s+\(Simulated\)/i },
  { id: 'unverified-visa-sla', pattern: /4-hr\s+SLA|4-hour\s+SLA/i },
  { id: 'uncontracted-charter-fallback', pattern: /manual\s+charter\s+fallback/i }
];

/** Returns the ids of any unsupported commercial claims found in `text`. */
export function findUnsupportedCommercialClaims(text: string): string[] {
  return UNSUPPORTED_CLAIM_PATTERNS.filter(p => p.pattern.test(text)).map(p => p.id);
}
