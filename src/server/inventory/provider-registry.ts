/* ============================================================================
 * Vacatina Provider Registry & Candidate Tracking System
 * Authority: docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md & ADR-007
 *
 * Rules:
 * - Tracks lifecycle, credentials, and certification PER PROVIDER (not just per product).
 * - All currently named upstream partners are strictly labeled 'CANDIDATE' or 'TARGET'
 *   until commercial agreements, compliance certification, and production keys are verified.
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

export interface ProviderRegistryRecord {
  providerId: string;
  providerName: string;
  role: ProviderRole;
  targetProducts: TravelProductSlug[];
  lifecycle: ProviderLifecycle;
  commercialStatus: CommercialContractStatus;
  credentialsConfigured: boolean;
  certificationStatus: CertificationComplianceStatus;
  bookingExecutionSupported: boolean;
  revalidationSupported: boolean;
  notes: string;
}

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
}
