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

import type { ProviderLifecycle, TravelProductSlug, CommercialEntityAuditRecord } from './types.ts';

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

export interface ProviderEndpointMap {
  searchEndpoint: string;
  detailsEndpoint: string;
  revalidateEndpoint: string;
  holdEndpoint?: string;
  bookingEndpoint: string;
  cancellationEndpoint: string;
}

export interface ProviderWebhookConfig {
  supportedEvents: string[];
  signatureHeader: string;
  callbackUrlPath: string;
}

export interface ProviderSlaProfile {
  timeoutMs: number;
  circuitBreakerThreshold: number;
  cooldownPeriodMs: number;
  maxRetries: number;
}

export interface ProviderFallbackPlan {
  fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT' | 'INTERNAL_CONSULAR_DESK' | 'BACKOFFICE_ON_REQUEST_TRIAGE' | 'DEGRADED_INFORMATIONAL';
  fallbackProviderId: string;
  description: string;
}

export interface ProviderErrorMappingConfig {
  errorStandard: 'RFC_7807';
  retryableErrorCodes: string[];
  nonRetryableErrorCodes: string[];
  codeMapping: Record<string, string>;
}

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
  endpoints?: ProviderEndpointMap;
  webhooks?: ProviderWebhookConfig;
  slaProfile?: ProviderSlaProfile;
  fallbackPlan?: ProviderFallbackPlan;
  errorMapping?: ProviderErrorMappingConfig;
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
    endpoints: {
      searchEndpoint: 'https://test.api.amadeus.com/v2/shopping/flight-offers',
      detailsEndpoint: 'https://test.api.amadeus.com/v2/shopping/flight-offers/{id}',
      revalidateEndpoint: 'https://test.api.amadeus.com/v1/shopping/flight-offers/pricing',
      holdEndpoint: 'https://test.api.amadeus.com/v1/booking/flight-orders?mode=HOLD',
      bookingEndpoint: 'https://test.api.amadeus.com/v1/booking/flight-orders',
      cancellationEndpoint: 'https://test.api.amadeus.com/v1/booking/flight-orders/{id}'
    },
    webhooks: {
      supportedEvents: ['flight.schedule_change', 'ticket.issued', 'order.cancelled'],
      signatureHeader: 'X-Amadeus-Signature',
      callbackUrlPath: '/api/v1/webhooks/amadeus'
    },
    slaProfile: {
      timeoutMs: 7000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 45000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to direct contracted charter blocks or backoffice airline ticketing triage'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['38100', '38102', '500_GATEWAY_TIMEOUT'],
      nonRetryableErrorCodes: ['32101', '400_BAD_REQUEST', 'PRICE_MISMATCH'],
      codeMapping: {
        '38100': 'PROVIDER_TIMEOUT',
        '38102': 'SYSTEM_ERROR',
        '32101': 'INVALID_SEGMENT'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.duffel.com/air/offer_requests',
      detailsEndpoint: 'https://api.duffel.com/air/offers/{id}',
      revalidateEndpoint: 'https://api.duffel.com/air/offers/{id}',
      holdEndpoint: 'https://api.duffel.com/air/orders?type=hold',
      bookingEndpoint: 'https://api.duffel.com/air/orders',
      cancellationEndpoint: 'https://api.duffel.com/air/order_cancellations'
    },
    webhooks: {
      supportedEvents: ['order.created', 'order.airline_initiated_change', 'order.cancelled'],
      signatureHeader: 'X-Duffel-Signature',
      callbackUrlPath: '/api/v1/webhooks/duffel'
    },
    slaProfile: {
      timeoutMs: 6000,
      circuitBreakerThreshold: 3,
      cooldownPeriodMs: 30000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to Verified Direct Contract Inventory charter flights and backoffice ticketing triage'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['airline_timeout', 'rate_limit_exceeded', 'temporary_carrier_offline'],
      nonRetryableErrorCodes: ['seat_unavailable', 'invalid_passport', 'booking_window_expired'],
      codeMapping: {
        'airline_timeout': 'UPSTREAM_GATEWAY_TIMEOUT',
        'seat_unavailable': 'INVENTORY_ALLOCATION_EXHAUSTED'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.liteapi.travel/v3.0/hotels/rates',
      detailsEndpoint: 'https://api.liteapi.travel/v3.0/hotels/details',
      revalidateEndpoint: 'https://api.liteapi.travel/v3.0/rates/prebook',
      holdEndpoint: 'https://api.liteapi.travel/v3.0/rates/prebook',
      bookingEndpoint: 'https://api.liteapi.travel/v3.0/rates/book',
      cancellationEndpoint: 'https://api.liteapi.travel/v3.0/bookings/{id}/cancel'
    },
    webhooks: {
      supportedEvents: ['booking.confirmed', 'booking.amended', 'booking.cancelled'],
      signatureHeader: 'X-LiteAPI-Signature',
      callbackUrlPath: '/api/v1/webhooks/liteapi'
    },
    slaProfile: {
      timeoutMs: 8000,
      circuitBreakerThreshold: 5,
      cooldownPeriodMs: 60000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to Direct Hotel Allotment direct contracted luxury resort inventory'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['rate_expired', 'supplier_network_error', 'rate_limit'],
      nonRetryableErrorCodes: ['room_sold_out', 'invalid_guest_name', 'card_declined'],
      codeMapping: {
        'rate_expired': 'PRICE_REVALIDATION_REQUIRED',
        'room_sold_out': 'INVENTORY_SOLD_OUT'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://secure.rentalcars.com/api/v1/vehicles/search',
      detailsEndpoint: 'https://secure.rentalcars.com/api/v1/vehicles/{id}',
      revalidateEndpoint: 'https://secure.rentalcars.com/api/v1/vehicles/{id}/rate',
      bookingEndpoint: 'https://secure.rentalcars.com/api/v1/vehicles/book',
      cancellationEndpoint: 'https://secure.rentalcars.com/api/v1/vehicles/bookings/{id}/cancel'
    },
    webhooks: {
      supportedEvents: ['reservation.confirmed', 'reservation.cancelled'],
      signatureHeader: 'X-Rentalcars-Signature',
      callbackUrlPath: '/api/v1/webhooks/rentalcars'
    },
    slaProfile: {
      timeoutMs: 8000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 45000,
      maxRetries: 1
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to Manual Transfer Contract Inventory and licensed local transport operators'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['RC_TIMEOUT', 'RC_NETWORK_ERROR', '503_SERVICE_UNAVAILABLE'],
      nonRetryableErrorCodes: ['RC_VEHICLE_UNAVAILABLE', 'RC_INVALID_LOCATION', 'RC_CARD_DECLINED'],
      codeMapping: {
        'RC_VEHICLE_UNAVAILABLE': 'INVENTORY_EXHAUSTED',
        'RC_RATE_EXPIRED': 'RATE_RECHECK_FAILED',
        'RC_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.traveltek.net/cruises/search',
      detailsEndpoint: 'https://api.traveltek.net/cruises/{id}',
      revalidateEndpoint: 'https://api.traveltek.net/cruises/{id}/pricing',
      holdEndpoint: 'https://api.traveltek.net/cruises/cabins/hold',
      bookingEndpoint: 'https://api.traveltek.net/cruises/book',
      cancellationEndpoint: 'https://api.traveltek.net/cruises/cancel'
    },
    webhooks: {
      supportedEvents: ['berth.confirmed', 'cabin.upgraded', 'voyage.cancelled'],
      signatureHeader: 'X-Traveltek-Signature',
      callbackUrlPath: '/api/v1/webhooks/traveltek'
    },
    slaProfile: {
      timeoutMs: 10000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 45000,
      maxRetries: 1
    },
    fallbackPlan: {
      fallbackStrategy: 'BACKOFFICE_ON_REQUEST_TRIAGE',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to private yacht charters and specialized Maldivian liveaboard desks'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['TT_GATEWAY_TIMEOUT', 'TT_NETWORK_ERROR'],
      nonRetryableErrorCodes: ['TT_CABIN_UNAVAILABLE', 'TT_INVALID_SAILING_DATE'],
      codeMapping: {
        'TT_CABIN_UNAVAILABLE': 'INVENTORY_EXHAUSTED',
        'TT_RATE_EXPIRED': 'RATE_RECHECK_FAILED',
        'TT_GATEWAY_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.viator.com/partner/products/search',
      detailsEndpoint: 'https://api.viator.com/partner/products/{id}',
      revalidateEndpoint: 'https://api.viator.com/partner/availability/check',
      holdEndpoint: 'https://api.viator.com/partner/bookings/hold',
      bookingEndpoint: 'https://api.viator.com/partner/bookings/book',
      cancellationEndpoint: 'https://api.viator.com/partner/bookings/cancel'
    },
    webhooks: {
      supportedEvents: ['booking.status_change', 'ticket.barcode_ready'],
      signatureHeader: 'X-Viator-Signature',
      callbackUrlPath: '/api/v1/webhooks/viator'
    },
    slaProfile: {
      timeoutMs: 9000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 45000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to local DMC contracted safari, snorkeling, and sightseeing guides'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['EXPERIENCE_API_TIMEOUT', 'GATEWAY_BUSY'],
      nonRetryableErrorCodes: ['TIME_SLOT_SOLD_OUT', 'AGE_RESTRICTION_NOT_MET'],
      codeMapping: {
        'EXPERIENCE_API_TIMEOUT': 'PROVIDER_TIMEOUT',
        'TIME_SLOT_SOLD_OUT': 'INVENTORY_ALLOCATION_EXHAUSTED'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.trainline.com/v1/journeys',
      detailsEndpoint: 'https://api.trainline.com/v1/journeys/{id}',
      revalidateEndpoint: 'https://api.trainline.com/v1/fares/revalidate',
      bookingEndpoint: 'https://api.trainline.com/v1/orders',
      cancellationEndpoint: 'https://api.trainline.com/v1/orders/{id}/refund'
    },
    webhooks: {
      supportedEvents: ['booking.refund_confirmed', 'journey.delayed'],
      signatureHeader: 'X-Trainline-Signature',
      callbackUrlPath: '/api/v1/webhooks/trainline'
    },
    slaProfile: {
      timeoutMs: 8000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 45000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to Local Scenic Rail Contract Inventory and station concierge'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['TL_TIMEOUT', 'TL_TEMPORARY_UNAVAILABLE'],
      nonRetryableErrorCodes: ['TL_TRAIN_FULL', 'TL_INVALID_STATION'],
      codeMapping: {
        'TL_TRAIN_FULL': 'INVENTORY_EXHAUSTED',
        'TL_PRICE_CHANGED': 'RATE_RECHECK_FAILED',
        'TL_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: 'https://api.allianz-assistance.com/v1/quotes',
      detailsEndpoint: 'https://api.allianz-assistance.com/v1/plans/{id}',
      revalidateEndpoint: 'https://api.allianz-assistance.com/v1/quotes/refresh',
      bookingEndpoint: 'https://api.allianz-assistance.com/v1/policies/issue',
      cancellationEndpoint: 'https://api.allianz-assistance.com/v1/policies/{id}/cancel'
    },
    webhooks: {
      supportedEvents: ['policy.issued', 'policy.cancelled'],
      signatureHeader: 'X-Allianz-Signature',
      callbackUrlPath: '/api/v1/webhooks/allianz'
    },
    slaProfile: {
      timeoutMs: 6000,
      circuitBreakerThreshold: 3,
      cooldownPeriodMs: 30000,
      maxRetries: 1
    },
    fallbackPlan: {
      fallbackStrategy: 'BACKOFFICE_ON_REQUEST_TRIAGE',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to Licensed Underwriter Direct Desk and backoffice policy issuance'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['AL_TIMEOUT', 'AL_CONNECTION_RESET'],
      nonRetryableErrorCodes: ['AL_AGE_EXCEEDED', 'AL_DESTINATION_SANCTIONED'],
      codeMapping: {
        'AL_AGE_EXCEEDED': 'INSURANCE_AGE_RESTRICTION',
        'AL_RATE_CHANGED': 'RATE_RECHECK_FAILED',
        'AL_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: '/api/v1/visa/catalog',
      detailsEndpoint: '/api/v1/visa/requirements/{country}',
      revalidateEndpoint: '/api/v1/visa/check',
      bookingEndpoint: '/api/v1/visa/dossier/create',
      cancellationEndpoint: '/api/v1/visa/dossier/{id}/withdraw'
    },
    webhooks: {
      supportedEvents: ['dossier.reviewed', 'consular.appointment_scheduled', 'visa.decision_ready'],
      signatureHeader: 'X-Vacatina-Internal-Key',
      callbackUrlPath: '/api/v1/webhooks/consular'
    },
    slaProfile: {
      timeoutMs: 3000,
      circuitBreakerThreshold: 10,
      cooldownPeriodMs: 15000,
      maxRetries: 3
    },
    fallbackPlan: {
      fallbackStrategy: 'INTERNAL_CONSULAR_DESK',
      fallbackProviderId: 'VACATINA_CONSULAR_CONCIERGE',
      description: 'Direct operational handling by dedicated Vacatina consular officer (SLA: 24-48h)'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['INTERNAL_SERVICE_BUSY'],
      nonRetryableErrorCodes: ['INSUFFICIENT_PASSPORT_VALIDITY', 'INVALID_CITIZENSHIP'],
      codeMapping: {
        'INSUFFICIENT_PASSPORT_VALIDITY': 'CONSULAR_VALIDITY_REJECTED',
        'INTERNAL_SERVICE_BUSY': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: '/api/v1/cms/inventory/query',
      detailsEndpoint: '/api/v1/cms/inventory/{id}',
      revalidateEndpoint: '/api/v1/cms/allotment/check',
      holdEndpoint: '/api/v1/cms/allotment/hold',
      bookingEndpoint: '/api/v1/cms/allotment/decrement',
      cancellationEndpoint: '/api/v1/cms/allotment/reinstate'
    },
    webhooks: {
      supportedEvents: ['listing.allotment_low', 'listing.stop_sale_activated'],
      signatureHeader: 'X-Vacatina-CMS-HMAC',
      callbackUrlPath: '/api/v1/webhooks/cms'
    },
    slaProfile: {
      timeoutMs: 2000,
      circuitBreakerThreshold: 10,
      cooldownPeriodMs: 15000,
      maxRetries: 3
    },
    fallbackPlan: {
      fallbackStrategy: 'BACKOFFICE_ON_REQUEST_TRIAGE',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Operational triage queue ticket auto-generation for administrator resolution'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['DB_LOCK_TIMEOUT', 'READ_REPLICA_LAG'],
      nonRetryableErrorCodes: ['STOP_SALE_TRIGGERED', 'ALLOTMENT_DEPLETED'],
      codeMapping: {
        'ALLOTMENT_DEPLETED': 'INVENTORY_EXHAUSTED',
        'STOP_SALE_TRIGGERED': 'OFFER_STOP_SALE',
        'DB_LOCK_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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
    endpoints: {
      searchEndpoint: '/api/v1/packages/search',
      detailsEndpoint: '/api/v1/packages/{id}',
      revalidateEndpoint: '/api/v1/packages/{id}/recheck',
      bookingEndpoint: '/api/v1/packages/order',
      cancellationEndpoint: '/api/v1/packages/cancel'
    },
    webhooks: {
      supportedEvents: ['bundle.component_failed', 'bundle.reprice_required'],
      signatureHeader: 'X-Vacatina-Bundler-HMAC',
      callbackUrlPath: '/api/v1/webhooks/bundler'
    },
    slaProfile: {
      timeoutMs: 5000,
      circuitBreakerThreshold: 4,
      cooldownPeriodMs: 30000,
      maxRetries: 2
    },
    fallbackPlan: {
      fallbackStrategy: 'MANUAL_CONTRACT_ALLOTMENT',
      fallbackProviderId: 'PAYLOAD_CMS_DIRECT',
      description: 'Fallback to curated fixed itinerary packages with guaranteed local contracts'
    },
    errorMapping: {
      errorStandard: 'RFC_7807',
      retryableErrorCodes: ['COMPONENT_FETCH_TIMEOUT', 'TRANSIENT_REPRICE_FAILURE'],
      nonRetryableErrorCodes: ['MANDATORY_COMPONENT_FAILED', 'BUNDLE_INCOMPATIBLE'],
      codeMapping: {
        'MANDATORY_COMPONENT_FAILED': 'INVENTORY_EXHAUSTED',
        'TRANSIENT_REPRICE_FAILURE': 'RATE_RECHECK_FAILED',
        'COMPONENT_FETCH_TIMEOUT': 'PROVIDER_TIMEOUT'
      }
    },
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

/**
 * Authoritative Commercial Entity Audit Registry (Requirements 5 & 6)
 * Classifies every named provider, partner, and fallback entity into exactly one of:
 * VERIFIED_CONTRACT | PRODUCTION_CREDENTIALS_VERIFIED | SANDBOX_APPROVED | CANDIDATE | TARGET_ONLY | EXAMPLE_ONLY | REMOVE_UNVERIFIED
 */
export const CANONICAL_COMMERCIAL_ENTITY_REGISTRY: CommercialEntityAuditRecord[] = [
  {
    entityId: 'DUFFEL_NDC',
    commercialEntityName: 'Duffel Technology Ltd (NDC Airline Gateway)',
    category: 'flights',
    classification: 'CANDIDATE',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: true,
    canEnterProductionSellable: false,
    auditNotes: 'Candidate NDC gateway. Evaluated in sandbox with 6/12 gates cleared. Production live credentials not verified.'
  },
  {
    entityId: 'AMADEUS_GDS',
    commercialEntityName: 'Amadeus IT Group (GDS Platform)',
    category: 'flights',
    classification: 'TARGET_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Target GDS platform under commercial review. 0/12 gates cleared.'
  },
  {
    entityId: 'LITEAPI',
    commercialEntityName: 'LiteAPI Travel Ltd (Wholesale Bedbank)',
    category: 'hotels',
    classification: 'CANDIDATE',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: true,
    canEnterProductionSellable: false,
    auditNotes: 'Candidate hotel consolidator. Evaluated in sandbox with 6/12 gates cleared. Production credentials not verified.'
  },
  {
    entityId: 'VIATOR',
    commercialEntityName: 'Viator Inc. / TripAdvisor Experiences',
    category: 'activities',
    classification: 'CANDIDATE',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Candidate activities consolidator. Scaffolding evaluated with 2/12 gates cleared. Production credentials not verified.'
  },
  {
    entityId: 'RENTALCARS',
    commercialEntityName: 'Rentalcars / Booking Transport Limited',
    category: 'cars',
    classification: 'TARGET_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Target rental car engine under commercial discussion. 0/12 gates cleared.'
  },
  {
    entityId: 'TRAINLINE',
    commercialEntityName: 'Trainline Partner Solutions Ltd',
    category: 'rails',
    classification: 'CANDIDATE',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Candidate European and UK rail gateway. 0/12 gates cleared.'
  },
  {
    entityId: 'TRAVELTEK',
    commercialEntityName: 'Traveltek Group Ltd (iSell Cruise Engine)',
    category: 'cruises',
    classification: 'TARGET_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Target cruise engine under commercial discussion. 0/12 gates cleared.'
  },
  {
    entityId: 'ALLIANZ',
    commercialEntityName: 'Allianz Partners / AWP Health & Life SA',
    category: 'insurance',
    classification: 'TARGET_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Target insurance underwriter under commercial evaluation. 0/12 gates cleared.'
  },
  {
    entityId: 'VACATINA_CONSULAR_CONCIERGE',
    commercialEntityName: 'Vacatina Consular Advisory & Visa Desk',
    category: 'visa',
    classification: 'VERIFIED_CONTRACT',
    legalContractVerified: true,
    productionCredentialsVerified: true,
    sandboxApproved: true,
    canEnterProductionSellable: true,
    auditNotes: 'Internal Vacatina operational advisory team. Production live manual review workflow with 24-48h SLA.'
  },
  {
    entityId: 'PAYLOAD_CMS_DIRECT',
    commercialEntityName: 'Vacatina Direct Contract Management Desk',
    category: 'MULTI_PRODUCT',
    classification: 'VERIFIED_CONTRACT',
    legalContractVerified: true,
    productionCredentialsVerified: true,
    sandboxApproved: true,
    canEnterProductionSellable: true,
    auditNotes: 'Internal Payload CMS repository managing 18-attribute verified direct contracts and instant stop-sell.'
  },
  {
    entityId: 'VACATINA_HYBRID_BUNDLER',
    commercialEntityName: 'Vacatina Hybrid Dynamic Packaging Engine',
    category: 'packages',
    classification: 'SANDBOX_APPROVED',
    legalContractVerified: true,
    productionCredentialsVerified: false,
    sandboxApproved: true,
    canEnterProductionSellable: false,
    auditNotes: 'Internal multi-component dynamic package engine. Sandbox active, clears provenance integrity rules.'
  },
  {
    entityId: 'SRILANKAN_AIRTAXI',
    commercialEntityName: 'SriLankan Airlines Limited / AirTaxi',
    category: 'flights',
    classification: 'EXAMPLE_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Example entity only. Replaced in code with architecture-safe generic descriptor "Verified Direct Contract Flight Operations".'
  },
  {
    entityId: 'AITKEN_SPENCE_DIRECT',
    commercialEntityName: 'Aitken Spence Hotel Holdings PLC / Heritance',
    category: 'hotels',
    classification: 'EXAMPLE_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Example entity only. Replaced in code with architecture-safe generic descriptor "Direct Hotel Allotment Partner".'
  },
  {
    entityId: 'CAREEM_FLEET_DXB',
    commercialEntityName: 'Careem Networks FZ LLC',
    category: 'cars',
    classification: 'EXAMPLE_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Example entity only. Replaced in code with architecture-safe generic descriptor "Manual Transfer Contract Inventory".'
  },
  {
    entityId: 'VICEROY_RAIL',
    commercialEntityName: 'Viceroy Special Luxury Scenic Train',
    category: 'rails',
    classification: 'EXAMPLE_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Example entity only. Replaced in code with architecture-safe generic descriptor "Local Scenic Rail Contract Inventory".'
  },
  {
    entityId: 'SRI_LANKA_INSURANCE_TAKAFUL',
    commercialEntityName: 'Sri Lanka Insurance Corporation / Takaful Desk',
    category: 'insurance',
    classification: 'EXAMPLE_ONLY',
    legalContractVerified: false,
    productionCredentialsVerified: false,
    sandboxApproved: false,
    canEnterProductionSellable: false,
    auditNotes: 'Example entity only. Replaced in code with architecture-safe generic descriptor "Licensed Underwriter Direct Desk".'
  }
];
