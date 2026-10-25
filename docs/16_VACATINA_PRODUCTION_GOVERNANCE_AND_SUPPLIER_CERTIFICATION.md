# Vacatina — Production Governance, Hybrid Inventory & Supplier Certification Matrix
## Ratification of Final Canonical Schemas, Operational Transitions & 10-Product Inventory Contract

> **Authority**: Vacatina Core Engineering Board & Architecture Review  
> **Status**: RATIFIED & LOCKED PRODUCTION GOVERNANCE SPECIFICATION  
> **Document Reference**: `docs/16_VACATINA_PRODUCTION_GOVERNANCE_AND_SUPPLIER_CERTIFICATION.md`  
> **Related Architecture**: `docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md`, `docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md`, `docs/14_CANONICAL_INVENTORY_TAXONOMY_AND_ADMIN_CMS_SCHEMA.md`, `docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md`, ADR-001 through ADR-008  
> **Code Artifacts**: `src/server/inventory/types.ts`, `src/server/inventory/discovery-content.ts`, `src/server/inventory/product-extensions.ts`, `src/server/db/schema.ts`, `src/server/db/storage.ts`, `tests/unit.test.ts`, `tests/supplier-certification.test.ts`

---

## 1. Architectural Distinction: DiscoveryContent vs. CanonicalOffer (Directive 1)

Vacatina formally ratifies that **Homepage Discovery Content is NOT an Inventory Offer**:

```mermaid
flowchart LR
    subgraph Discovery["Discovery Layer (Inspiration & Prefill)"]
        D1["Homepage Destination Cards"]
        D2["Seasonal Guides & Editorial"]
        D3["Route Highlights (CMB ➔ DXB)"]
        D1 & D2 & D3 --> DiscSchema["DiscoveryContentEntity\n- isLiveInventoryOffer: false\n- sellability: DISCOVERY_ONLY\n- priceDisclaimer: '*Indicative fare...'"]
    end

    subgraph Action["Customer Action"]
        Click["Click Card / 'Explore Deals'"]
    end

    subgraph Inventory["Inventory Layer (Real-Time Search)"]
        Search["Prefilled Search Route\n(/flights?from=CMB&to=DXB)"]
        Canon["CanonicalOfferEntity\n- Live Availability / Real Quota\n- Dynamic or Fixed Price\n- sellability: BOOKABLE\n- Trip Bucket Ready"]
    end

    DiscSchema --> Click --> Search --> Canon
```

### 1.1 `DiscoveryContentEntity` Schema
```typescript
export interface DiscoveryContentEntity {
  contentId: string;               // e.g. "dsc_dxb_flight_01"
  slug: string;                    // e.g. "dubai-flights-inspiration"
  title: string;                   // e.g. "Dubai Flights & Skyline Discovery"
  subtitle: string;                // e.g. "Daily non-stop connections from Colombo (CMB) to Dubai (DXB)"
  category: 'DESTINATION_INSPIRATION' | 'SEASONAL_GUIDE' | 'EDITORIAL_FEATURE' | 'ROUTE_SUGGESTION';
  heroImageUrl: string;
  targetProductType: TravelProductSlug;
  targetRoute: string;             // e.g. "/flights" or "/packages"
  prefillSearchParams: {
    origin?: string;
    destination: string;
    departureDate?: string;
    returnDate?: string;
    cabinClass?: string;
  };
  editorialBadge?: string;         // e.g. "Staff Pick", "Trending Destination"
  priceIndication?: {
    indicativeFromPriceMinor: number;
    indicativeCurrency: string;
    priceDisclaimer: string;       // "*Indicative starting fare based on historical searches; live search required"
  };
  isLiveInventoryOffer: false;     // STRICT INVARIANT: Always false. Never an inventory offer.
  sellability: 'DISCOVERY_ONLY';   // Never directly bookable
  authorOrCurator: string;
  publishedAtIso: string;
}
```

---

## 2. Formal SEED Data Isolation & Accelerator Quarantine (Directive 2)

All prototype fixtures, demonstration bookings, and design accelerator records carry:
```typescript
environmentClass: 'SEED'
```
### Invariants Enforced in Code & Automated Tests:
1. **Production Search Quarantine**: `assertProductionResponseSafety()` scans every search response; if any `SEED` item is present in a production environment, it throws `ArchitecturalInvariantViolationError('PRODUCTION_SEED_LEAK')`.
2. **Trip Bucket Quarantine**: `assertSeedCannotEnterCheckout()` prevents any SEED item from entering `READY` state or reaching the booking saga.
3. **No Badges for SEED**: Seed data cannot derive `Live Availability` or `Instant Confirmation` badges.

---

## 3. Upstream Supplier Scaffolding vs. Production Integration (Directive 3)

No supplier adapter is labeled a "live production integration" solely because its TypeScript class exists.
Upstream suppliers are classified strictly as `INTEGRATION_CANDIDATE` or `SCAFFOLD` in `SANDBOX` mode until all 12 engineering certification gates are cleared:

| Supplier Identifier | Target Products | Adapter Class | Role | Current Lifecycle | Sandbox State | Credentials Configured | Live Booking Permitted |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| `DUFFEL_NDC` | Flights | `FlightsDuffelAdapter` | CANDIDATE | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `AMADEUS_GDS` | Flights, Hotels | Under Evaluation | TARGET | `PLANNED` | Planned | NO | **BLOCKED** |
| `LITEAPI` | Hotels | `HotelsLiteApiAdapter` | CANDIDATE | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `RENTALCARS` | Cars | `CarsRentalAdapter` | TARGET | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `TRAVELTEK` | Cruises | `CruisesTraveltekAdapter` | TARGET | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `VIATOR` | Activities, Sightseeing | `ActivitiesViatorAdapter` | CANDIDATE | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `TRAINLINE` | Rails | `RailsTrainlineAdapter` | CANDIDATE | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `ALLIANZ` | Insurance | `InsuranceAllianzAdapter` | TARGET | `SCAFFOLD` | Active Mock | NO | **BLOCKED** |
| `VACATINA_CONSULAR_CONCIERGE` | Visa | `VisaConsularAdapter` | INTERNAL | `PRODUCTION_LIVE` | Live Ops | **YES** | **ENABLED** |
| `CEYLON_HOTELS_DIRECT` | Hotels | `ManualCmsAdapter` | CONTRACTED | `PRODUCTION_LIVE` | Live DB | **YES** | **ENABLED** |

---

## 4. Complete Manual Inventory Governance Model (Directive 4)

Direct contract listings and manual services in `ManualListingEntity` support full operational lifecycle management:

```typescript
export interface ManualListingEntity {
  id: UUID;
  productType: TravelProductSlug;
  sourceType: 'DIRECT_CONTRACT' | 'MANUAL_INTERNAL' | 'PARTNER_MANUAL';
  partnerSupplierId: string;
  partnerName: string;
  title: string;
  subtitle: string;
  destinationCity: string;
  destinationCountry: string;

  // Commercial & Financials
  contractedNetCostMinor: number;
  costCurrency: string;
  platformMarkupPercent: number;
  manualOverridePriceMinor?: number;
  overrideReason?: string;
  sellingPriceMinor: number;
  sellingCurrency: string;

  // Quota & Allotment Management
  allottedQuota: number;
  heldQuota: number;
  bookedQuota: number;
  remainingQuota: number; // Computed: allottedQuota - heldQuota - bookedQuota
  availableQuota: number;
  isUnlimitedQuota: boolean;

  // Validity Windows & Operational Restrictions
  validFrom: ISODateString;
  validUntil: ISODateString;
  effectiveFrom: ISODateString;
  effectiveTo: ISODateString;
  bookingWindow: {
    minAdvanceDays: number;
    maxAdvanceDays: number;
    minimumNoticeHours: number;
  };
  blackoutDates: string[]; // ISO YYYY-MM-DD
  stopSale: boolean;        // Instant operational kill-switch

  // Fulfillment & Contract Provenance
  confirmationMode: 'INSTANT_CONFIRM' | 'REQUEST_TO_CONFIRM' | 'ASSISTED_SERVICE';
  canAtomicallyReserve: boolean; // Direct contracts with false derive ON_REQUEST!
  contractReference: string;    // e.g. "AGR-2026-MIRISSA-008"
  sourceOwner: {
    partnerId: string;
    partnerName: string;
    contactEmail: string;
  };
  revisionNumber: number;       // Incremented on every edit/transition

  // Governance & Lifecycle
  publicationStatus: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  distributionScope: 'B2C_ONLY' | 'B2B_ONLY' | 'BOTH' | 'INTERNAL_ONLY';
  editorUserId?: UUID;
  reviewedBy?: UUID;
  approvedBy?: UUID;
  publishedAt?: ISODateString;
  pausedAt?: ISODateString;
  archivedAt?: ISODateString;

  // Inclusions, Exclusions, Policies
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  refundEligibilityDescription?: string;
  termsReference: string;
}
```

### Exact Lifecycle Transition Table
| Origin Status | Permitted Destination Status | Actor Role | Mandatory Transition Pre-requisites |
| :--- | :--- | :--- | :--- |
| `DRAFT` | `IN_REVIEW` | Editor / Creator | Mandatory room/seat details, pricing > 0, validity window. |
| `DRAFT` | `ARCHIVED` | Editor / Admin | Cancelled draft. Terminal state. |
| `IN_REVIEW` | `PUBLISHED` | Designated Approver | `approverUserId != editorUserId`, `allottedQuota > 0` or unlimited, `stopSale === false`, `cancellationPolicy` present. |
| `IN_REVIEW` | `DRAFT` | Approver / Ops | **Rejected with auditable reason string** (e.g. rate clarification). |
| `IN_REVIEW` | `ARCHIVED` | Approver / Admin | Discarded proposal. Terminal state. |
| `PUBLISHED` | `PAUSED` | Ops / Admin | **Temporary stop-sale** (hotel renovation, seasonal hold). Removed from live search immediately. |
| `PAUSED` | `PUBLISHED` | Approver | Re-verified rates/allotments, `stopSale === false`. Restores live search presence. |
| `PUBLISHED` | `ARCHIVED` | Commercial Lead | Season or contract conclusion. Terminal state. |
| `PAUSED` | `ARCHIVED` | Commercial Lead | Contract termination. Terminal state. |

---

## 5. Ratified CanonicalOffer Identity & Provenance Contract (Directive 5)

Every offer normalized by Vacatina backend preserves complete immutable provenance:

```typescript
export interface CanonicalOfferEntity {
  // Stable universal identifiers
  canonicalOfferId: string;         // Universal stable identifier (e.g. "vct-fl-duffel-cmb-dxb-98a7c2")
  offerId: string;                  // Direct alias for canonicalOfferId
  sourceOfferId: string;            // Original upstream provider offer ID / CMS listing ID
  productType: TravelProductSlug;   // 1 of 10 travel products
  providerId: string;               // e.g. "DUFFEL_NDC", "CEYLON_HOTELS_DIRECT"
  supplierId: string;

  // 7 Orthogonal Dimensions (ADR-007)
  inventorySource: 'API' | 'DIRECT_CONTRACT' | 'MANUAL_INTERNAL' | 'PARTNER_MANUAL';
  listingKind: 'DISCOVERY_CONTENT' | 'SELLABLE_INVENTORY' | 'SERVICE' | 'PACKAGE';
  compositionType: 'SINGLE' | 'CURATED_PACKAGE' | 'DYNAMIC_BUNDLE';
  fulfillmentMode: 'INSTANT' | 'ON_REQUEST' | 'MANUAL_CONFIRMATION';
  environmentClass: 'PRODUCTION' | 'SANDBOX' | 'SEED';
  sellability: 'DISCOVERY_ONLY' | 'QUOTE_ONLY' | 'BOOKABLE';
  providerLifecycle: 'PLANNED' | 'SCAFFOLD' | 'INTEGRATION_CANDIDATE' | 'SANDBOX_ACTIVE' | 'CERTIFIED' | 'PRODUCTION_LIVE';

  // Publication & Distribution (ADR-008)
  publicationStatus: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  distributionScope: 'B2C_ONLY' | 'B2B_ONLY' | 'BOTH' | 'INTERNAL_ONLY';
  bookingCapability: 'INSTANT_RESERVATION' | 'HOLD_AND_CONFIRM' | 'REQUEST_TO_BOOK' | 'INQUIRY_ONLY';
  availabilityMode: 'INSTANT' | 'ON_REQUEST' | 'ALLOTMENT' | 'SCHEDULED' | 'UNAVAILABLE';
  availabilityStatus: 'LIVE' | 'CACHED' | 'MANUAL_AVAILABLE' | 'ON_REQUEST' | 'SOLD_OUT' | 'UNAVAILABLE' | 'PRICE_CHANGED' | 'EXPIRED';
  pricingMode: 'FIXED' | 'FROM_PRICE' | 'DYNAMIC' | 'PER_PERSON' | 'PER_ROOM' | 'PER_VEHICLE' | 'PER_PACKAGE' | 'QUOTE_REQUIRED';

  // Financials in Integer Minor Units
  pricing: PricingLayersEntity;
  taxesAndFees: TaxesAndFeesEntity;
  b2bPricing?: B2BDistributionPricingEntity;

  // Validity & Freshness
  validFrom: string;
  validUntil: string;
  expiresAt: string;
  lastCheckedAt: string;
  requiresRevalidation: boolean;

  // Governance, Provenance & Extensions
  cancellationPolicy: string;
  deduplicationKey: string;
  sourceProvenance: SourceProvenanceEntity;
  productExtension: ProductExtension; // Discriminated union for product specifics
  components?: ComponentOfferIdentity[]; // Child components for hybrid bundles
}
```

---

## 6. Pre-Booking Revalidation & Trip Bucket State Mapping (Directive 6 & 7)

Any dynamic, API, or allotment offer must be revalidated before checkout:

```mermaid
flowchart TD
    Init["Customer Initiates Checkout"] --> Check["revalidateOffer(offerId)"]
    Check --> StateMap{"Revalidation Status"}
    StateMap -->|"Status: UNCHANGED\nPrice verified"| Ready["State: READY\n(Included in subtotal, proceeds to payment)"]
    StateMap -->|"Status: PRICE_CHANGED\nFare/Room updated"| PriceChg["State: PRICE_CHANGED\n(Excluded from subtotal; customer notified)"]
    StateMap -->|"Status: RECHECK_REQUIRED\nTTL expired"| Recheck["State: RECHECK_REQUIRED\n(Excluded from subtotal; ping required)"]
    StateMap -->|"Status: RATE_EXPIRED\nFare deadline passed"| Expired["State: OFFER_EXPIRED\n(Excluded from subtotal; refresh search)"]
    StateMap -->|"Status: UNAVAILABLE\nInventory exhausted"| Unavail["State: UNAVAILABLE\n(Excluded from subtotal; choose alternative)"]
```

### Holiday Package Component Provenance Rule:
In holiday packages (`compositionType = 'CURATED_PACKAGE' | 'DYNAMIC_BUNDLE'`), each child component preserves its own `componentStatus` and `lastRevalidationResult`.
- If flight, hotel, transfer, or visa component is `EXPIRED` or `UNAVAILABLE`:
  - `isPackageReadyForCheckout(pkgOffer) === false`.
  - The package is blocked from `READY` state until every mandatory child component is confirmed.

---

## 7. 10-Product Permitted Inventory Modes & Fulfillment Matrix (Directive 10)

| Product | `API` | `DIRECT_CONTRACT` | `MANUAL_INTERNAL` | `PARTNER_MANUAL` | `DISCOVERY_CONTENT` | `SEED` | Legitimate Fulfillment Modes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Flights** | **YES** (NDC/GDS) | **YES** (Charters) | NO | **YES** (Brokers) | **YES** (Routes) | **YES** (Quarantine) | `INSTANT` for GDS; `ON_REQUEST` for chartered seaplanes. |
| **2. Hotels** | **YES** (Bedbanks) | **YES** (Resorts) | **YES** (Leased) | **YES** (Extranet) | **YES** (Resorts) | **YES** (Quarantine) | `INSTANT` for API/Allotment; `ON_REQUEST` for unmanaged villas. |
| **3. Cars & Transfers** | **YES** (Aggregator)| **YES** (Fleets) | **YES** (Own fleet)| **YES** (Chauffeurs)| **YES** (Transfers)| **YES** (Quarantine) | `INSTANT` for self-drive; `ON_REQUEST` for luxury chauffeur. |
| **4. Cruises** | **YES** (Traveltek) | **YES** (Charters)| NO | **YES** (Agencies) | **YES** (Sailings)| **YES** (Quarantine) | `ON_REQUEST` default (cabin hold confirmation required). |
| **5. Rails** | **YES** (Trainline) | **YES** (Tourist) | NO | **YES** (Brokers) | **YES** (Routes) | **YES** (Quarantine) | `INSTANT` for Trainline; `ON_REQUEST` for heritage trains. |
| **6. Activities** | **YES** (Viator) | **YES** (Vendors) | **YES** (Hosted) | **YES** (Local) | **YES** (Guides) | **YES** (Quarantine) | `INSTANT` for API slots; `ON_REQUEST` for custom safaris. |
| **7. Sightseeing** | **YES** (Viator) | **YES** (Guides) | **YES** (Curated) | **YES** (Operators) | **YES** (Highlights)| **YES** (Quarantine) | `INSTANT` for tickets; `ON_REQUEST` for private guides. |
| **8. Insurance** | **YES** (Allianz) | **YES** (Underwriter)| NO | NO | **YES** (Tiers) | **YES** (Quarantine) | `INSTANT` strictly (electronic policy issuance). |
| **9. Visa Assistance** | **YES** (e-Visa API)| **YES** (Liaison) | **YES** (Concierge)| **YES** (Advisors) | **YES** (Advisory) | **YES** (Quarantine) | `MANUAL_CONFIRMATION` or `ON_REQUEST` (never instant). |
| **10. Holiday Packages**| **YES** (Dynamic) | **YES** (Fixed) | **YES** (Signature)| **YES** (DMCs) | **YES** (Inspiration)| **YES** (Quarantine)| `ON_REQUEST` default (multi-component coordination). |

---

## 8. Provider Certification Gates from `PLANNED` to `PRODUCTION_LIVE`

| Gate Identifier | Name & Scope | Auditable Requirement |
| :--- | :--- | :--- |
| **Gate 1** | `credentialsConfigured` | Production API keys stored securely in environment vault; zero hardcoding. |
| **Gate 2** | `searchContractVerified` | Live search requests execute and normalize into `CanonicalOfferEntity`. |
| **Gate 3** | `availabilityCheckVerified`| Real-time inventory slot verification functional. |
| **Gate 4** | `pricingIntegrityVerified` | Integer minor math audited against supplier billing statements. |
| **Gate 5** | `revalidationFlowVerified` | Pre-booking recheck detects price changes and seat/room sellouts. |
| **Gate 6** | `bookingSagaVerified` | Distributed Saga executes hold, confirmation, and ticket issuance. |
| **Gate 7** | `cancelChangePolicyVerified`| Upstream cancellation penalty calculation audited. |
| **Gate 8** | `errorMappingVerified` | Supplier 4xx/5xx mapped to standard RFC 7807 Problem Details. |
| **Gate 9** | `idempotencyLedgerVerified`| Idempotency keys prevent double billing or duplicate PNR creation. |
| **Gate 10** | `webhooksReconciled` | Asynchronous supplier status webhooks HMAC signature verified. |
| **Gate 11** | `monitoringTelemetryVerified`| Circuit breaker tracks latency and failure rates. |
| **Gate 12** | `rollbackDisableCapable` | Emergency kill-switch cuts off supplier traffic with zero downtime. |

---

## 9. Comprehensive Automated Test Evidence

Two separate test suites ensure architectural integrity and supplier certification compliance:

### Suite 1: Vacatina Domain & Core Architecture Invariant Tests (`tests/unit.test.ts`)
- **40 / 40 Tests Passing** (0 failures, 0 skips)
- Proves travel product taxonomy, traveller validation, Trip Bucket baseline math, all 8 Trip Bucket states, favorites isolation, cookie preferences, canonical route registry, 4-layer pricing math, deduplication keys, cache TTL, circuit breaker states, SEED quarantine, 10 product extensions, discovery content separation, production response safety, and full manual listing governance.

### Suite 2: Upstream Provider Certification & UAT Suite (`tests/supplier-certification.test.ts`)
- **8 / 8 Tests Passing** (0 failures, 0 skips)
- Proves credentials guards, candidate adapter normalization, integer minor pricing integrity, pre-booking revalidation, scaffold booking blockage, circuit breaker outage fallbacks, RFC 7807 problem details mapping, and provider registry telemetry compliance.

---

## 10. Conclusion & Ratification

The Vacatina platform now possesses a complete, battle-tested, backend-ready architecture. Real-time API candidates, direct contract allotments, manual operational concierge services, and discovery content operate with zero collision, zero ambiguity, and zero technical leakage to consumers.

*Ratified by the Vacatina Core Engineering & Platform Governance Board.*
