# Vacatina Travel OS — Master Inventory Source Architecture & Engineering Handoff Specification (v2.4)

**Document Classification:** Master Architectural Contract & Defensible Pre-Flight Handoff Standard  
**Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Branch / Commit:** `main` (Locked at [`a62aec7`](https://github.com/vacatina/vacatina/commit/a62aec7))  
**Production URL:** [https://vacatina-nu.vercel.app](https://vacatina-nu.vercel.app)  
**TypeScript Status:** `0 errors` (`tsc --noEmit`)  
**Automated Verification:** `74 / 74 tests passing (100%)` across 2 test suites  

---

## 1. Executive Summary: The 5-Tier Operational Reality Boundary

To prevent miscommunication between frontend and backend engineering teams, this specification strictly separates what is currently implemented in code from what remains required future backend and commercial work:

```mermaid
flowchart LR
    subgraph A ["Tier A: Architecture (COMPLETE)"]
        direction TB
        A1["Domain Models"]
        A2["Canonical Schemas"]
        A3["Source Taxonomy"]
        A4["18 Manual Attributes"]
        A5["4-Eyes Governance"]
    end

    subgraph B ["Tier B: Frontend Shell (COMPLETE)"]
        direction TB
        B1["323 Clickable Elements"]
        B2["11 SCC Search Tabs"]
        B3["Screen 04 (8 States)"]
        B4["Clerk Auth SDK Bridge"]
        B5["0 Dead Buttons"]
    end

    subgraph C ["Tier C: Backend Services (PENDING)"]
        direction TB
        C1["15 Required Capabilities"]
        C2["Search Aggregator"]
        C3["Atomic Allotment Hold"]
        C4["Admin CMS Repository"]
        C5["Booking Saga Orchestrator"]
    end

    subgraph D ["Tier D: Supplier Integration (PENDING)"]
        direction TB
        D1["Proposed Target Providers"]
        D2["Adapter Code Boundaries"]
        D3["Commercial Agreements"]
        D4["Live Production Keys"]
        D5["12-Gate Certification"]
    end

    subgraph E ["Tier E: Production Verification (PENDING)"]
        direction TB
        E1["Live Financial Settlement"]
        E2["Real Carrier PNR Issuance"]
        E3["Payment Webhook Reconciliation"]
        E4["End-to-End Production Sign-off"]
    end

    A -->|Governs| B
    A -->|Specifies Contract For| C
    B -.->|Dispatches To (Pending)| C
    C -.->|Invokes (Pending)| D
    D -.->|Unlocks (Pending)| E

    classDef complete fill:#d4edda,stroke:#28a745,color:#155724;
    classDef pending fill:#fff3cd,stroke:#ffc107,color:#856404;
    class A,B complete;
    class C,D,E pending;
```

### The 5 Operational Tiers Defined:
* **Tier A — Architecture (COMPLETE):** Fully locked canonical schemas, orthogonal source dimensions, 10 products, 11 SCC tabs, Trip Bucket 8-state item readiness model, and 18 manual attributes with 4-Eyes principle.
* **Tier B — Frontend Shell (COMPLETE):** 323 interactive elements verified with 0 dead buttons, 71 canonical routes, accessible modals, and deterministic event dispatch.
* **Tier C — Backend Implementation (PENDING REQUIRED WORK):** The 15 backend capabilities (search aggregator, offer detail, revalidation, allotment hold/release, manual CMS CRUD, pricing rules, trip bucket persistence, booking saga) remain **required backend engineering work** until real microservice endpoints exist and pass integration tests.
* **Tier D — Supplier Integration (PENDING COMMERCIAL & KEYS):** Named providers (Duffel, LiteAPI, Viator, Rentalcars, Traveltek, Trainline, Allianz) are **proposed / recommended integration targets**. Adapter boundaries exist in code, but commercial agreements, live credentials, and compliance certification remain pending.
* **Tier E — Production Verification (PENDING LIVE KEYS):** Real financial settlement, airline e-ticketing issuance, and automated merchant capture are blocked until Tier C and Tier D are certified.

---

## 2. Inconsistency Reconciled #1: Trip Bucket Item Readiness vs Booking Lifecycle

We strictly decouple the item-level readiness of a staged product from the order-level transactional saga:

```
┌────────────────────────────────────────────────────────┐
│     TripItemReadinessState (Item-Level Lifecycle)      │
│  DRAFT  │  NEEDS_ACTION  │  READY  │  REFRESHING_PRICE │
│  PRICE_CHANGED  │  RECHECK_REQUIRED  │  OFFER_EXPIRED  │
│                   UNAVAILABLE                          │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ Staged in Trip Bucket
                            ▼
┌────────────────────────────────────────────────────────┐
│     BookingLifecycleState (Order-Level Transaction)    │
│  STAGED  │  HELD  │  BOOKING_IN_PROGRESS  │  CONFIRMED │
│               FAILED   │   CANCELLED                   │
└────────────────────────────────────────────────────────┘
```

### Rules & Invariants:
1. **Item Subtotal Contribution:** Only items with state `TripItemReadinessState === 'READY'` contribute to the financial checkout subtotal. Items with `NEEDS_ACTION`, `RECHECK_REQUIRED`, or `PRICE_CHANGED` are staged but excluded from financial commitment until resolved.
2. **`EMPTY` is Not an Item State:** `EMPTY` describes the aggregate container state of the Trip Bucket drawer when no items are staged (`TripBucketAggregateState`).
3. **`DEPOSIT_LOCK` and `CONFIRMED` Belong to Booking Lifecycle:** These states govern the post-review transaction saga (`BookingLifecycleState`), never the client-side item configurator.

---

## 3. Inconsistency Reconciled #2: Route Shell vs Backend Service Reality

Every operational route in Vacatina explicitly distinguishes between client shell dispatch, backend API readiness, and production commercial status. **A working `/admin/inventory` UI route does NOT imply that Manual CMS backend CRUD is production-ready:**

| Canonical Route Path | UI / Route Shell Status | Backend Service Status | Production Capability Status | Operational Responsibility & Notes |
| :--- | :---: | :---: | :---: | :--- |
| `/` (Homepage) | `COMPLETE (PASS)` | `LIVE (Static Shell)` | `PRODUCTION_LIVE` | 11 SCC tabs, 40 discovery seed cards. Zero direct checkout jump. |
| `/flights/search` | `COMPLETE (PASS)` | `PENDING (CAP-01)` | `PROTOTYPE` | Dispatches search; requires real upstream NDC aggregator service. |
| `/flights/offer/:offerId` | `COMPLETE (PASS)` | `PENDING (CAP-02)` | `PROTOTYPE` | Fare family modal; requires backend offer details dossier. |
| `/hotels/search` | `COMPLETE (PASS)` | `PENDING (CAP-01)` | `PROTOTYPE` | Curated hotel grid; connects to scaffolded LiteAPI & direct contract models. |
| `/hotels/property/:id` | `COMPLETE (PASS)` | `PENDING (CAP-02)` | `PROTOTYPE` | Property amenity & room configurator. |
| `/admin`, `/admin/inventory`| `COMPLETE (PASS)` | `PENDING (CAP-06)` | `NOT_READY` | **UI Shell is complete; Manual CMS CRUD & DB storage remain pending backend work.** |
| `/trip-bucket` | `COMPLETE (PASS)` | `PENDING (CAP-09)` | `PROTOTYPE` | Screen 04 8-state model active client-side; session sync service pending. |
| `/trip/review`, `/checkout` | `COMPLETE (PASS)` | `PENDING (CAP-12)` | `NOT_READY` | Review dossier shell active; multi-source booking saga pending backend. |
| `/manage-booking` | `COMPLETE (PASS)` | `PENDING (CAP-13)` | `NOT_READY` | Passenger lookup shell active; backend dossier retrieval pending. |
| `/visa-assistance/apply` | `COMPLETE (PASS)` | `PENDING (CAP-14)` | `NOT_READY` | Consular application form active; encrypted document ingest pending. |

---

## 4. Inconsistency Reconciled #3: Refined Provider Implementation Status

To prevent premature claims of sandbox connectivity, provider implementation statuses are refined to a strict 5-tier enum:

```typescript
export type ImplementationStatus =
  | 'PLANNED'              // Requirements & schemas defined; no adapter code
  | 'ADAPTER_SCAFFOLDED'    // Adapter code & fallback mocks complete; live credentials pending
  | 'SANDBOX_VERIFIED'     // Authenticated sandbox requests passing with real test keys
  | 'INTEGRATED'           // End-to-end integration sagas passing automated tests
  | 'PRODUCTION_VERIFIED'; // Live settlement verified & signed-off
```

### Provider Implementation Status Matrix:

| Provider Identifier | Integration Role | Target Product | Implementation Status | Commercial Agreement Status | Credential Status | Ticketing / Licensing Model & Compliance Disclosure |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`DUFFEL_NDC`** | Proposed Target | Flights | `ADAPTER_SCAFFOLDED` | Under Technical Evaluation | Adapter scaffolded; tokens pending | **Duffel Managed Content allows Vacatina to access flight content using Duffel or its partner's agency accreditation and ticketing authority, subject to the applicable Duffel commercial/payment arrangement.** |
| **`LITEAPI`** | Proposed Target | Hotels | `ADAPTER_SCAFFOLDED` | Under Technical Evaluation | Adapter scaffolded; keys pending | B2B Hotel Consolidator bedbank rates. Adapter scaffolded; production API key pending. |
| **`VIATOR_API`** | Proposed Target | Activities | `PLANNED` | Proposed Target | None | Destination experiences marketplace. Adapter interface scaffolded; API partner account pending. |
| **`RENTALCARS`** | Proposed Target | Cars & Transfers | `PLANNED` | Proposed Target | None | Car rental gateway. Contract discussions pending; local direct chauffeur fleet used as primary. |
| **`TRAVELTEK`** | Proposed Target | Cruises | `PLANNED` | Proposed Target | None | Cruise line aggregator. Commercial evaluation pending. |
| **`TRAINLINE`** | Proposed Target | Rails | `PLANNED` | Proposed Target | None | European/UK rail aggregator. Proposed target; scenic Sri Lankan rail managed via direct contract. |
| **`ALLIANZ_API`** | Proposed Target | Insurance | `PLANNED` | Proposed Target | None | Travel insurance underwriter. Informational comparison only; binding quote API pending. |
| **`PAYLOAD_CMS_DIRECT`**| Internal Platform | Direct DMC Contracts| `ADAPTER_SCAFFOLDED` | Operational Internal | Local in-memory / file active | Vacatina In-House Manual Contract Repository. 18 attributes enforced. |
| **`CONSULAR_DESK`** | Internal Service | Visa Assistance | `ADAPTER_SCAFFOLDED` | Operational Internal | Local service desk active | Vacatina Consular Document Vetting Desk. Assisted service with manual SLA. |
| **`VACATINA_BUNDLER`** | Internal Platform | Holiday Packages | `ADAPTER_SCAFFOLDED` | Operational Internal | Local orchestrator active | Dynamic package assembly engine combining API + Manual components. |

---

## 5. Explicit Rule for Project Accelerator & Prototype Records

1. **Quarantine Axiom:** All unverified imported, demo, and sample listings from the Project Accelerator are classified as **`SEED`**.
2. **Promotion Path:** A `SEED` record can never become sellable merely by toggling a flag or editing HTML. It must pass through the formal Manual CMS commercial intake:
   $$\mathbf{SEED} \xrightarrow{\text{Admin CMS Intake}} \mathbf{DRAFT} \xrightarrow{\text{Commercial Review}} \mathbf{FINANCE\_APPROVED} \xrightarrow{\text{4-Eyes Approval}} \mathbf{MANUAL\ PUBLISHED}$$
   Or be replaced by verified `API` inventory.
3. **Zero Checkout Access:** `SEED` content can prefill authentic searches (`prefillAndScrollToSearch`), but can **never** enter checkout directly, claim live airline/hotel availability, or create a `READY` Trip Bucket item.

---

## 6. The 15 Mandatory Backend Capabilities (Pending Backend Service Implementation)

The frontend route shells, dialog modals, and canonical schemas are complete. However, the backend commerce services are **NOT complete**. The backend engineering team must implement and certify these **15 Explicit API Capabilities**:

| # | Backend Capability | Endpoint Path | Implementation Status | UI Shell Status | Service Implementation | Primary Responsibility |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | Multi-Product Search Aggregator | `POST /api/v1/search` | `PLANNED` | `COMPLETE` | `PENDING` | Dispatches criteria across manual repository and supplier adapters; returns normalized `UnifiedCustomerOffer[]`. |
| **2** | Offer Details Dossier | `GET /api/v1/offers/:id` | `PLANNED` | `COMPLETE` | `PENDING` | Returns complete offer dossier (carrier rules, room amenities, itinerary, inclusions). |
| **3** | Pre-Booking Revalidation | `POST /api/v1/offers/:id/revalidate` | `ADAPTER_SCAFFOLDED` | `COMPLETE` | `PENDING` | Live availability and price freshness verification against upstream supplier API. |
| **4** | Atomic Allotment Hold | `POST /api/v1/inventory/hold` | `PLANNED` | `COMPLETE` | `PENDING` | Reserves 1 allotment unit for 15 minutes (`COMMITTED_HELD`) to prevent double-booking. |
| **5** | Allotment Release | `POST /api/v1/inventory/release` | `PLANNED` | `COMPLETE` | `PENDING` | Releases expired or cancelled allotment reservation back to available inventory. |
| **6** | Manual Listing CMS CRUD | `GET, POST /api/v1/admin/listings` | `PLANNED` | `COMPLETE` | `PENDING` | Admin backoffice CRUD for 18-attribute direct contracts and services. |
| **7** | 4-Eyes Lifecycle Governance | `POST /api/v1/admin/listings/:id/lifecycle` | `PLANNED` | `COMPLETE` | `PENDING` | Enforces transition approvals: `DRAFT` $\rightarrow$ `COMMERCIAL_REVIEW` $\rightarrow$ `FINANCE_APPROVED` $\rightarrow$ `PUBLISHED`. |
| **8** | Dynamic Pricing Engine | `GET, PUT /api/v1/admin/pricing-rules` | `PLANNED` | `COMPLETE` | `PENDING` | Dynamic markup percentages and consular fee schedules (never hardcoded). |
| **9** | Trip Bucket Session Sync | `POST /api/v1/trip-bucket/sync` | `PLANNED` | `COMPLETE` | `PENDING` | Persists multi-product customer trip dockets across guest/authenticated sessions. |
| **10**| Saved Favorites Persistence | `GET, POST, DELETE /api/v1/favorites` | `PLANNED` | `COMPLETE` | `PENDING` | Manages customer wishlists strictly isolated from Trip Bucket totals. |
| **11**| Clerk JWT Claims Verification | `Bearer <Clerk_JWT>` | `ADAPTER_SCAFFOLDED` | `COMPLETE` | `PENDING` | RS256 JWT cryptographic verification using Clerk JWKS endpoints. |
| **12**| Booking Saga Initiation | `POST /api/v1/booking/checkout` | `PLANNED` | `COMPLETE` | `PENDING` | Orchestrates multi-source payment capture, PNR issuance, and voucher generation. |
| **13**| Manage Booking Dossier | `GET /api/v1/bookings/:ref` | `PLANNED` | `COMPLETE` | `PENDING` | Customer self-service booking retrieval, flight schedule updates, and voucher download. |
| **14**| Consular Application Queue | `POST /api/v1/visa/applications` | `PLANNED` | `COMPLETE` | `PENDING` | Ingests applicant passport details and document uploads for consular vetting. |
| **15**| Support & Exceptions Triage | `POST /api/v1/support/tickets` | `PLANNED` | `COMPLETE` | `PENDING` | Operational triage for flight cancellations, schedule changes, and manual refunds. |

---

## 7. Product-by-Product Source Strategy

| Product Vertical | Primary Source Model | Secondary / Fallback Model | Availability Tracking | Customer Buying Condition |
| :--- | :--- | :--- | :--- | :--- |
| **1. Flights** | `API LIVE` (Duffel NDC) | None (Never fake airline seats) | Real-time GDS/NDC seat hold | *Instant Confirmation* (Search required) |
| **2. Hotels** | `API LIVE` (LiteAPI) | `MANUAL` Direct DMC Contracts | Daily Room Allotment Ledger | *Instant Confirmation* / *Vacatina Exclusive* |
| **3. Visa Assistance** | `MANUAL` Consular Desk | Rules API (future enrichment) | Service Specialist Capacity | *Assisted Service* (Document SLA) |
| **4. Holiday Packages** | `HYBRID` Dynamic Bundles | `MANUAL` Curated Itineraries | Atomic Component Evaluation | *Vacatina Curated Package* / *On Request* |
| **5. Cars & Transfers** | `MANUAL` Contracted Fleet | Supplier API | Vehicle Fleet Allotment | *Instant Confirmation* / *On Request* |
| **6. Rails** | `MANUAL` Scenic Allocations | Rail API (Trainline where live) | Station Seat Allocation | *Instant Confirmation* / *On Request* |
| **7. Cruises** | `API` / `HYBRID` | Direct Cruise Line Allocation | Cabin Category Allocation | *Instant Confirmation* / *On Request* |
| **8. Activities** | `API LIVE` (Viator) | `MANUAL` Local Operator Contracts| Time-Slot Booking Quota | *Instant Confirmation* / *Direct Rate* |
| **9. Sightseeing Tours**| `MANUAL` Curated Tours | API Sightseeing Marketplace | Vehicle / Guide Group Max | *Vacatina Exclusive* / *Instant* |
| **10. Travel Insurance**| `API` Provider Quotes | Informational / Assisted Quote | Policy Underwriter Capacity | *Assisted Service* (Non-binding quote) |

> **Build Your Bundle:** Inventory source එකක් නොවේ. එය ඉහත සියලුම sources (API, Manual, Hybrid) එකම docket එකකට එකතු කරන **Orchestration Layer** එකයි.

---

## 8. Canonical Offer Schema (17 Mandatory Declared Attributes)

```typescript
export interface CanonicalProductRecord {
  sourceType: 'API' | 'MANUAL' | 'HYBRID' | 'SEED';
  bookingMode: 'INSTANT' | 'REQUEST' | 'ASSISTED';
  availabilityMode: 'LIVE' | 'ON_REQUEST' | 'SCHEDULED' | 'STATIC';
  productType: TravelProductSlug;
  canonicalId: string;
  sourceRecordId: string;
  supplierId?: string;
  title: string;
  destinationId: string;
  price: number;
  currency: string;
  priceStatus: 'VERIFIED' | 'ESTIMATED' | 'PRICE_CHANGED' | 'EXPIRED' | 'STALE';
  availabilityStatus: AvailabilityState | 'AVAILABLE' | 'LIMITED' | 'ON_REQUEST' | 'SOLD_OUT' | 'UNAVAILABLE';
  lastCheckedAt: string;
  requiresRecheck: boolean;
  configurationStatus: 'NOT_CONFIGURED' | 'CONFIGURING' | 'CONFIGURED' | 'CONFIGURATION_COMPLETE';
  bookabilityStatus: 'BOOKABLE_NOW' | 'REQUIRES_CONFIGURATION' | 'ON_REQUEST_ONLY' | 'NOT_BOOKABLE';
}
```

---

## 9. Next Implementation Sequence (Flights Full Flow)

```
Flights Product Hub (/flights)
       │
       ▼
Flights Search Panel (SCC tab-flights)
       │
       ▼
Duffel Flight Adapter (POST /air/offer_requests)
       │
       ▼
Canonical Flight Offer Normalizer
       │
       ▼
Flights Results Grid (/flights/search)
       │
       ▼
Flight Offer Detail & Fare Family Configurator (/flights/offer/:id)
       │
       ▼
Stage into Screen 04 Trip Bucket
       │
       ▼
Pre-Booking Fare Revalidation (GET /air/offers/:id)
       │
       ▼
Booking Handoff to Checkout Saga
```
