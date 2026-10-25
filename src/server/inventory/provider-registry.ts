/* ============================================================================
 * Vacatina Provider Registry & Candidate Tracking System
 * Authority: docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md, ADR-007 & ADR-008
 *
 * Rules:
 * - Tracks lifecycle, credentials, and certification PER PROVIDER (not just per product).
 * - All currently named upstream partners are strictly labeled 'CANDIDATE' or 'TARGET'
 *   until commercial agreements, compliance certification, and production keys are verified.
 * - Enforces the 12 explicit Certification Gates before advancing to PRODUCTION_LIVE.
 * - Architecture is truthful: 'Production-ready supplier integration architecture'.
 * ============================================================================ */

import type { ProviderLifecycle, TravelProductSlug } from './types.ts';

export type ProviderRole =
  | 'CANDIDATE'          // Under active technical and sandbox evaluation
  | 'TARGET'             // Identified target provider under commercial / contract discussions
  | 'INTERNAL_SERVICE'   // Vacatina internal operational team (e.g. Consular Concierge)
  | 'INTERNAL_PLATFORM'; // Vacatina internal platform subsystem (e.g. Payload CMS, Bundler)

export type CommercialContractStatus =
  | 'EVALUATING'
  | 'UNDER_DISCUSSION'
  | 'CONTRACTED'
  | 'OPERATIONAL_INTERNAL';

export type CertificationComplianceStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'CERTIFIED'
  | 'NOT_APPLICABLE';

/**
 * The 12 Mandatory Certification Gates for Provider Production Readiness (Rule 7)
 */
export interface ProviderCertificationChecklist {
  credentialsConfigured: boolean;       // Gate 1: Live production API credentials authenticated
  searchContractVerified: boolean;      // Gate 2: Search payload mapping & Canonical Offer normalization verified
  availabilityCheckVerified: boolean;   // Gate 3: Real-time room/seat allotment availability confirmed
  pricingIntegrityVerified: boolean;    // Gate 4: Net cost and 4-layer pricing precedence validated in integer minor units
  revalidationFlowVerified: boolean;    // Gate 5: Pre-booking price/availability recheck functional
  bookingSagaVerified: boolean;         // Gate 6: Hold and confirmed ticket/voucher issuance executed
  cancelChangePolicyVerified: boolean;  // Gate 7: Upstream cancellation and penalty calculation verified
  errorMappingVerified: boolean;        // Gate 8: RFC 7807 problem details and retryable errors mapped
  idempotencyLedgerVerified: boolean;   // Gate 9: Idempotency-Key headers and transaction ledger active
  webhooksReconciled: boolean;          // Gate 10: Asynchronous event webhooks signature verified
  monitoringTelemetryVerified: boolean; // Gate 11: Circuit breaker latency and failure telemetry active
  rollbackDisableCapable: boolean;      // Gate 12: Emergency circuit kill-switch and zero-downtime rollback ready
}

export interface ProviderRegistryRecord {
  providerId: string;
  providerName: string;
  role: ProviderRole;
  targetProducts: TravelProductSlug[];
  lifecycle: ProviderLifecycle;
  commercialStatus: CommercialContractStatus;
  credentialsConfigured: boolean;
  certificationStatus: CertificationComplianceStatus;
  certificationGates: ProviderCertificationChecklist;
  bookingExecutionSupported: boolean;
  revalidationSupported: boolean;
  notes: string;
}

const DEFAULT_UNVERIFIED_GATES: ProviderCertificationChecklist = {
  credentialsConfigured: false,
  searchContractVerified: false,
  availabilityCheckVerified: false,
  pricingIntegrityVerified: false,
  revalidationFlowVerified: false,
  bookingSagaVerified: false,
  cancelChangePolicyVerified: false,
  errorMappingVerified: false,
  idempotencyLedgerVerified: false,
  webhooksReconciled: false,
  monitoringTelemetryVerified: false,
  rollbackDisableCapable: false
};

const OPERATIONAL_INTERNAL_GATES: ProviderCertificationChecklist = {
  credentialsConfigured: true,
  searchContractVerified: true,
  availabilityCheckVerified: true,
  pricingIntegrityVerified: true,
  revalidationFlowVerified: true,
  bookingSagaVerified: true,
  cancelChangePolicyVerified: true,
  errorMappingVerified: true,
  idempotencyLedgerVerified: true,
  webhooksReconciled: true,
  monitoringTelemetryVerified: true,
  rollbackDisableCapable: true
};

export const CANONICAL_PROVIDER_REGISTRY: ProviderRegistryRecord[] = [
  {
    providerId: 'AMADEUS_GDS',
    providerName: 'Amadeus Travel Platform (GDS)',
    role: 'TARGET',
    targetProducts: ['flights', 'hotels'],
    lifecycle: 'PLANNED',
    commercialStatus: 'UNDER_DISCUSSION',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: { ...DEFAULT_UNVERIFIED_GATES },
    bookingExecutionSupported: false,
    revalidationSupported: false,
    notes: 'Target global distribution system for scheduled flights and enterprise hotels. Under commercial evaluation.'
  },
  {
    providerId: 'DUFFEL_NDC',
    providerName: 'Duffel NDC Airline Gateway',
    role: 'CANDIDATE',
    targetProducts: ['flights'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'EVALUATING',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: {
      ...DEFAULT_UNVERIFIED_GATES,
      searchContractVerified: true,
      errorMappingVerified: true,
      monitoringTelemetryVerified: true
    },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Candidate NDC gateway for direct carrier booking. Adapter scaffolded with strict sandbox validation.'
  },
  {
    providerId: 'LITEAPI',
    providerName: 'LiteAPI Hotel Bedbank Gateway',
    role: 'CANDIDATE',
    targetProducts: ['hotels'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'EVALUATING',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: {
      ...DEFAULT_UNVERIFIED_GATES,
      searchContractVerified: true,
      errorMappingVerified: true,
      monitoringTelemetryVerified: true
    },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Candidate hotel consolidator bedbank. Scaffolding verified with 30m TTL cache.'
  },
  {
    providerId: 'RENTALCARS',
    providerName: 'Rentalcars Connect Gateway',
    role: 'TARGET',
    targetProducts: ['cars'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'UNDER_DISCUSSION',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: { ...DEFAULT_UNVERIFIED_GATES },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Target rental car consolidator for airport pick-up and self-drive.'
  },
  {
    providerId: 'TRAVELTEK',
    providerName: 'Traveltek Cruise Engine',
    role: 'TARGET',
    targetProducts: ['cruises'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'UNDER_DISCUSSION',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: { ...DEFAULT_UNVERIFIED_GATES },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Target cruise aggregator. Scaffolding verified with 12h TTL cache.'
  },
  {
    providerId: 'VIATOR',
    providerName: 'Viator Experiences & Attractions',
    role: 'CANDIDATE',
    targetProducts: ['activities', 'sightseeing'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'EVALUATING',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: {
      ...DEFAULT_UNVERIFIED_GATES,
      searchContractVerified: true,
      monitoringTelemetryVerified: true
    },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Candidate activities and tours consolidator. Adapter scaffolded with 4h TTL cache.'
  },
  {
    providerId: 'TRAINLINE',
    providerName: 'Trainline Partner Rail Engine',
    role: 'CANDIDATE',
    targetProducts: ['rails'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'EVALUATING',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: { ...DEFAULT_UNVERIFIED_GATES },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Candidate European & UK rail gateway.'
  },
  {
    providerId: 'ALLIANZ',
    providerName: 'Allianz Global Assistance Underwriting',
    role: 'TARGET',
    targetProducts: ['insurance'],
    lifecycle: 'SCAFFOLD',
    commercialStatus: 'UNDER_DISCUSSION',
    credentialsConfigured: false,
    certificationStatus: 'NOT_STARTED',
    certificationGates: { ...DEFAULT_UNVERIFIED_GATES },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Target underwriter for Vacatina travel insurance policies.'
  },
  {
    providerId: 'VACATINA_CONSULAR_CONCIERGE',
    providerName: 'Vacatina Consular Concierge Desk',
    role: 'INTERNAL_SERVICE',
    targetProducts: ['visa'],
    lifecycle: 'PRODUCTION_LIVE',
    commercialStatus: 'OPERATIONAL_INTERNAL',
    credentialsConfigured: true,
    certificationStatus: 'NOT_APPLICABLE',
    certificationGates: { ...OPERATIONAL_INTERNAL_GATES },
    bookingExecutionSupported: true,
    revalidationSupported: true,
    notes: 'Vacatina in-house operational consular advisory service. Operationally live manual workflow.'
  },
  {
    providerId: 'PAYLOAD_CMS_DIRECT',
    providerName: 'Vacatina Direct Contract Desk',
    role: 'INTERNAL_PLATFORM',
    targetProducts: ['hotels', 'flights', 'cars', 'activities', 'sightseeing'],
    lifecycle: 'PRODUCTION_LIVE',
    commercialStatus: 'OPERATIONAL_INTERNAL',
    credentialsConfigured: true,
    certificationStatus: 'NOT_APPLICABLE',
    certificationGates: { ...OPERATIONAL_INTERNAL_GATES },
    bookingExecutionSupported: true,
    revalidationSupported: true,
    notes: 'Internal Payload CMS/Postgres repository for boutique direct contracts.'
  },
  {
    providerId: 'VACATINA_HYBRID_BUNDLER',
    providerName: 'Vacatina Hybrid Package Engine',
    role: 'INTERNAL_PLATFORM',
    targetProducts: ['packages'],
    lifecycle: 'SANDBOX_ACTIVE',
    commercialStatus: 'OPERATIONAL_INTERNAL',
    credentialsConfigured: true,
    certificationStatus: 'NOT_APPLICABLE',
    certificationGates: {
      ...DEFAULT_UNVERIFIED_GATES,
      searchContractVerified: true,
      pricingIntegrityVerified: true,
      revalidationFlowVerified: true
    },
    bookingExecutionSupported: false,
    revalidationSupported: true,
    notes: 'Dynamic multi-component bundle assembler combining API and Direct contract components.'
  }
];

export class ProviderRegistryService {
  private static registry = new Map<string, ProviderRegistryRecord>(
    CANONICAL_PROVIDER_REGISTRY.map(r => [r.providerId, r])
  );

  public static getProvider(providerId: string): ProviderRegistryRecord | undefined {
    return this.registry.get(providerId);
  }

  public static getAllProviders(): ProviderRegistryRecord[] {
    return Array.from(this.registry.values());
  }

  public static getCandidates(): ProviderRegistryRecord[] {
    return this.getAllProviders().filter(p => p.role === 'CANDIDATE');
  }

  public static getTargets(): ProviderRegistryRecord[] {
    return this.getAllProviders().filter(p => p.role === 'TARGET');
  }

  public static canExecuteLiveBooking(providerId: string): boolean {
    const record = this.registry.get(providerId);
    if (!record) return false;
    return record.lifecycle === 'PRODUCTION_LIVE' && record.bookingExecutionSupported;
  }

  /**
   * Evaluates whether a provider has cleared all 12 certification gates to advance to PRODUCTION_LIVE
   */
  public static evaluateCertificationGates(checklist: ProviderCertificationChecklist): {
    isCertified: boolean;
    isProductionReady: boolean;
    clearedCount: number;
    pendingGates: string[];
  } {
    const gates: Array<[keyof ProviderCertificationChecklist, string]> = [
      ['credentialsConfigured', 'Live credentials configured and authenticated'],
      ['searchContractVerified', 'Search query mapping and canonical normalization verified'],
      ['availabilityCheckVerified', 'Real-time room/seat allotment availability confirmed'],
      ['pricingIntegrityVerified', 'Net cost and 4-layer pricing precedence validated'],
      ['revalidationFlowVerified', 'Pre-booking price/availability recheck functional'],
      ['bookingSagaVerified', 'Hold and confirmed ticket/voucher issuance executed'],
      ['cancelChangePolicyVerified', 'Upstream cancellation and refund calculation verified'],
      ['errorMappingVerified', 'RFC 7807 problem details and retryable errors mapped'],
      ['idempotencyLedgerVerified', 'Idempotency-Key headers and transaction ledger active'],
      ['webhooksReconciled', 'Asynchronous event webhooks signature verified'],
      ['monitoringTelemetryVerified', 'Circuit breaker latency and failure telemetry active'],
      ['rollbackDisableCapable', 'Emergency circuit kill-switch and zero-downtime rollback ready']
    ];

    const pendingGates = gates.filter(([key]) => !checklist[key]).map(([_, desc]) => desc);
    const isCertified = pendingGates.length === 0;
    return {
      isCertified,
      isProductionReady: isCertified,
      clearedCount: gates.length - pendingGates.length,
      pendingGates
    };
  }
}
