# Vacatina Route-to-Inventory Integration Matrix & Commercial Truth Gap Report (v1.0)

> **Historical snapshot:** verification counts and release status in this document predate the Phase 4 local baseline. Current verified baseline: **233/233 tests**, **0 typecheck errors**, build PASS, browser/server bundle isolated. See [../ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md).

**Document Reference:** `docs/architecture/35_vacatina_route_to_inventory_integration_matrix_and_truth_gap_report.md`  
**Parent Specifications:**
- `docs/architecture/34_vacatina_supplier_and_listing_architecture_v1.md`
- `docs/architecture/33_vacatina_canonical_offer_and_flight_functional_architecture.md`
- `docs/architecture/31_vacatina_supplier_readiness_matrix_and_truth_audit.md`
- `docs/architecture/click-destination-contract.md`
- `docs/architecture/backend-integration-contract.md`

**Status:** `RATIFIED & COMMITTED (HARDENED COMMERCIAL TRUTH)`  
**Governing Authority:** Vacatina Executive Commerce Architecture  
**Verification Target:** 122 / 122 Passing Automated Tests | 33 / 33 Passing Browser E2E Assertions  
**Production URL:** `https://vacatina-nu.vercel.app` (HTTP 200 OK)

---

## 1. Executive Summary & Foundational Principles

This specification delivers the **Route-to-Inventory Realization Matrix**, **Provider Activation State Machine**, and **Commercial Truth Gap Report** for Vacatina Travel OS. It governs how customer navigation, discovery teasers, and search forms map into real inventory sources without violating commercial truth.

### Core Non-Negotiable Rules

1. **Preserve Canonical Source Taxonomy:** Inventory is classified strictly into 4 classes:
   - `MANUAL`: Direct commercial contracts and in-house Vacatina services managed via CMS.
   - `API`: Dynamic external supplier inventory normalized via typed adapters.
   - `HYBRID`: Split-authority inventory (supplier net rate/stock + Vacatina markup/inclusions).
   - `SEED`: Prototype demo content strictly isolated from checkout and bookings.
2. **Zero Technical Terminology Leakage:** Travellers are never presented internal source jargon (`API`, `MANUAL`, `HYBRID`, `SEED`). Instead, travellers see honest confirmation terms:
   - `Instant confirmation` (Only when provider is verified `LIVE` and supports instant reservation)
   - `Confirmation required` (Standard request-to-book and allotment validation)
   - `Vacatina assistance` (Dedicated concierge and consular case officer service)
3. **Provider Activation State Machine (6 Stages):**
   $$\text{PLANNED} \longrightarrow \text{SANDBOX} \longrightarrow \text{CREDENTIALS\_CONFIGURED} \longrightarrow \text{COMMERCIAL\_VERIFIED} \longrightarrow \text{LIVE} \longrightarrow \text{SUSPENDED}$$
   - **Hard Invariant:** A provider NEVER becomes `LIVE` merely because an API key exists. Activation to `LIVE` strictly requires BOTH:
     1. Verified production credentials, AND
     2. Verified commercial/legal evidence in `COMMERCIAL_EVIDENCE_LEDGER`.
   - **Only `LIVE` sources may create production-bookable inventory.**
4. **Hybrid Field Authority Invariant:**
   - Upstream Supplier API strictly owns: real-time availability, supplier net cost, cost currency, and operational schedules.
   - Vacatina Commercial Desk strictly owns: retail markup, selling price in LKR, curated inclusions/exclusions, exclusive badges, and service SLA.
   - Two sources NEVER silently overwrite the same commercial field.
5. **Homepage Discovery Teasers Are Not Inventory:** The 40 cards across Screens 05–08 remain `DISCOVERY_CONTENT` (`dsc_...`) with explicit pricing disclaimers (`*Indicative starting fare; live search required`). Clicking a card prefills real search parameters into the Search Command Center (SCC); it **never** pretends live inventory exists or creates a live booking.
6. **Zero Falsified Fallbacks:** Flights or other verticals never fallback to phantom "manual charters" or uncontracted operators. When no verified source is available, the platform returns an honest unavailable notice and prompts a search retry.
7. **Persistence-Ready Boundary:** The Manual CMS is architectured with a strict `IManualListingRepository` contract with PostgreSQL DDL defined, but remains explicitly identified as running in-memory until `DATABASE_URL` is configured.

---

## 2. Hardened 10-Product + Bundle Integration Matrix

| # | Travel Vertical | Manual Support | API Support | Hybrid Support | Candidate Upstream Supplier | Current Real Status | Customer Confirmation Mode | Revalidation Authority | Booking Authority | Fallback Behaviour | Commercial Evidence Required |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **01** | **Flights** | Proposed (Charter only when evidenced) | Candidate (`DUFFEL_NDC`) | Scaffold | Duffel (Candidate) | **`SANDBOX`** | `Confirmation required` | `FlightsDuffelAdapter` (API) | Duffel NDC live ticketing API | Honest unavailable notice / retry prompt (zero unevidenced charter fallback) | Signed IATA merchant agreement & production Duffel token |
| **02** | **Hotels** | Yes (`ManualListingRepository`) | Candidate (`LITEAPI`) | Primary (`API rate + Vacatina perk`) | LiteAPI (Candidate) | **`SANDBOX`** (API)<br>**`MANUAL_OPERATION_PROPOSED`** (CMS) | `Confirmation required` | LiteAPI Bedbank (API) / Vacatina CMS (Manual) | LiteAPI XML/REST API / Vacatina Allotment hold | Return remaining verified manual inventory or honest empty results | Wholesale bedbank merchant agreement & signed hotel partner contracts |
| **03** | **Visa Assistance** | Primary (`ConsularConcierge`) | No (Direct govt portals) | No | Vacatina Consular Concierge (Internal) | **`MANUAL_OPERATION_PROPOSED`** | `Vacatina assistance` | Vacatina Consular Desk | Vacatina Consular Desk Case Officer | Direct link to official consular portal & offline triage intake | Consular accreditation / travel agency licence with VFS Global / GDRFA |
| **04** | **Holiday Packages** | Yes (`CuratedPackages`) | Candidate (Component APIs) | Primary (`DynamicBundler`) | Vacatina Hybrid Bundler (Internal Platform) | **`MANUAL_OPERATION_PROPOSED`** | `Confirmation required` | Component adapters & Bundler | Vacatina Dynamic Packaging Desk | Suggest alternative itinerary dates or custom concierge request | Tour operator / DMC agreements with ground handlers & transport |
| **05** | **Cars & Transfers** | Yes (`ChauffeurFleet`) | Candidate (`RENTALCARS`) | Yes (`API Hire + Local Fleet`) | Rentalcars Connect (Candidate) | **`SANDBOX`** (API)<br>**`MANUAL_OPERATION_PROPOSED`** (Fleet) | `Confirmation required` | Rentalcars API / Fleet Allotment | Rentalcars API / Chauffeur Dispatch Desk | Honest unavailable notice; prompt for on-request chauffeur dispatch | B2B affiliate distribution agreement & transport provider vehicle fleet contracts |
| **06** | **Rails** | Yes (`ScenicQuota`) | Candidate (`TRAINLINE`) | Proposed | Trainline Partner B2B (Candidate) | **`SANDBOX`** (API)<br>**`MANUAL_OPERATION_PROPOSED`** (Scenic) | `Confirmation required` | Trainline REST API / Scenic Ledger | Trainline Partner API / Vacatina Station Desk | Return scenic train on-request queue or station schedule guide | Trainline Partner distribution agreement & Sri Lanka Railways seat allocation letter |
| **07** | **Cruises** | Yes (`CatamaranCharter`) | Candidate (`TRAVELTEK`) | Yes (`Traveltek API + Charter`) | Traveltek Cruise Gateway (Candidate) | **`SANDBOX`** (API)<br>**`MANUAL_OPERATION_PROPOSED`** (Charter) | `Confirmation required` | Traveltek XML Gateway / Charter Ledger | Traveltek Gateway / Catamaran Operator Desk | Prompt for bespoke yacht charter enquiry or alternative sailing dates | Traveltek API gateway commercial licence & yacht charter operator contracts |
| **08** | **Activities** | Yes (`LocalPartners`) | Candidate (`VIATOR`) | Primary (`Viator + Local Perks`) | Viator Sightseeing (Candidate) | **`SANDBOX`** (API)<br>**`MANUAL_OPERATION_PROPOSED`** (Local) | `Confirmation required` | Viator Partner API / Activity CMS | Viator Barcode Issuance / Local Operator Voucher | Return verified local activity alternatives or prompt for concierge request | Viator Partner API agreement & tour operator liability insurance certificates |
| **09** | **Sightseeing Tours**| Primary (`CuratedHeritage`) | Candidate (`VIATOR_TOURS`) | Yes | Vacatina Tour Desk / Viator | **`MANUAL_OPERATION_PROPOSED`** | `Confirmation required` | Vacatina Tour Desk / Viator | Vacatina Guide Dispatch / Viator | Return next available tour date or suggest self-guided walking route | Licensed National Tour Guide agreements & tourist board registration |
| **10** | **Travel Insurance**| No | Candidate (`ALLIANZ`) | No | Allianz Global Assistance (Candidate) | **`SANDBOX`** | `Confirmation required` | Allianz Policy API | Allianz Policy Issuance Engine | Display general insurance guideline & prompt customer to contact insurer directly | IRCSL insurance broker licence & underwriter distribution agreement |
| **11** | **Build Your Bundle**| Yes | Candidate | Primary (`UnifiedPackaging`) | Vacatina Packaging Orchestrator | **`SANDBOX`** | `Confirmation required` | Component-level adapters concurrently | Multi-product Booking Saga Engine | Remove unconfirmed component with customer consent; proceed with confirmed items | Dependent on all constituent product contracts being in place |

---

## 3. Detailed Realization Architecture

### 3.1 Click-to-Destination Flow (Zero Dead-Ends)

```
[ Homepage Discovery Card (dsc_...) ]
              │
              ▼
[ onClick: prefillAndScrollToSearch(tab, criteria) ]
              │
              ├─ Prefills Search Command Center tab (origin, destination, dates)
              ├─ Activates target tab (tab-flights, tab-hotels, etc.)
              └─ Highlights SCC panel with focus ring
              │
              ▼
[ User Selects Specific Dates & Travellers ]
              │
              ▼
[ Form Submit: navigateTo('/<product>/search?<params>') ]
              │
              ▼
[ CanonicalRouterService.dispatchRoute() ]
              │
              ▼
[ UnifiedInventoryService.search(criteria) ]
              │
              ├─ Fetch: Manual CMS (Published, Active, Non-Expired, Allotment > 0)
              ├─ Fetch: Target API Supplier via Circuit Breaker
              ├─ Quarantine: Strip SEED / DISCOVERY_ONLY items
              ├─ Deduplicate: Natural composite key resolution
              ├─ Rank: Pinned manual offers -> Lowest Selling Price
              └─ Render: Unified Product Offer Cards (Same UI for API & Manual)
              │
              ▼
[ User Selects Offer -> Details (/offer/:id) -> Configure ]
              │
              ▼
[ Pre-Booking Revalidation: POST /api/v1/offers/:id/revalidate ]
              │
              ├─ UNCHANGED: Status -> 'Ready', Proceed to Trip Bucket / Checkout
              ├─ PRICE_CHANGED: Status -> 'Price Changed', Demote from Ready, Require customer approval
              ├─ UNAVAILABLE: Status -> 'Unavailable', Demote from Ready, Suggest alternatives
              ├─ EXPIRED: Status -> 'Offer Expired', Demote from Ready, Trigger fresh search
              └─ RECHECK_REQUIRED: Status -> 'Recheck Required', Demote from Ready
              │
              ▼
[ Trip Bucket Drawer (LKR Subtotal preserves stable offer IDs) ]
              │
              ▼
[ Checkout Saga: Atomic Allotment Hold -> Payment Gateway -> PNR Dossier ]
```

---

## 4. Comprehensive Commercial Truth Gap Report

This gap report provides complete, transparent accounting of production readiness across the Vacatina engineering, legal, and commercial boundaries.

### 4.1 What Is Fully Implemented (Production-Grade Code)

1. **Canonical Schema & Normalization:** `CanonicalOfferEntity` (22 attributes) and `ProductionManualListingEntity` (24 attributes) fully implemented and enforced. Upstream JSON payloads never leak into UI components.
2. **Provider Activation State Machine:** 6-stage lifecycle (`PLANNED` $\rightarrow$ `SANDBOX` $\rightarrow$ `CREDENTIALS_CONFIGURED` $\rightarrow$ `COMMERCIAL_VERIFIED` $\rightarrow$ `LIVE` $\rightarrow$ `SUSPENDED`) preventing live checkout unless BOTH production credentials AND commercial evidence exist.
3. **Hybrid Field Authority Engine:** Explicit authority rules separating supplier-authoritative operational fields from Vacatina-authoritative commercial fields, preventing silent overwriting.
4. **Tri-Source Inventory Engine:** Concurrent multi-source query architecture combining `MANUAL`, `API`, and `HYBRID` inventory with composite deduplication and dynamic winner resolution.
5. **Persistence-Ready Manual CMS Contract:** `IManualListingRepository` boundary with full PostgreSQL DDL schema defined, implementing 4-Eyes separation of duties (`DRAFT` $\rightarrow$ `REVIEW` $\rightarrow$ `FINANCE_APPROVED` $\rightarrow$ `PUBLISHED`), anti-tamper rate demotion, and instant operational stop-sell toggling.
6. **Pre-Booking Revalidation Engine:** 5-state revalidation saga (`UNCHANGED`, `PRICE_CHANGED`, `UNAVAILABLE`, `EXPIRED`, `RECHECK_REQUIRED`) with automatic circuit breaker outage isolation.
7. **Trip Bucket 8-State Governance:** Strict readiness gate preserving stable canonical offer IDs. Only `Ready` items contribute to the payable subtotal.
8. **SEED Quarantine Invariant:** SEED and prototype demo cards are tagged `isBookable: false` and throw `ArchitecturalInvariantViolationError` if attempted to stage or check out.
9. **Discovery Content Safety:** All 40 homepage cards are classified as `DISCOVERY_CONTENT` (`dsc_...`) with mandatory price disclaimers (`*Indicative starting fare; live search required`).
10. **Client-Side Routing Service:** Full `CanonicalRouterService` handling all 10 product hubs, deep-link offer modals, search results, resources, legal policies, and admin dashboards with zero dead-ends or unhandled clicks.
11. **Automated Verification:** 122 automated test gates and 33 browser acceptance assertions across 11 viewports.
12. **Zero External CDN Dependencies:** Pure local self-contained build with compiled Tailwind CSS (42.9 KB) deployed to Vercel production.

---

### 4.2 What Is Scaffolded Only

1. **Candidate Supplier Adapters (Simulated Sandbox Data):**
   - `FlightsDuffelAdapter`: NDC data models mapped; upstream requests simulate sandbox payloads when `DUFFEL_ACCESS_TOKEN` is unset.
   - `HotelsLiteApiAdapter`: Bedbank room contracts mapped; upstream requests simulate sandbox payloads when `LITEAPI_PRODUCTION_KEY` is unset.
   - `CarsRentalAdapter`: Data mapping contracts defined; upstream HTTP transport points to simulated sandbox mock.
   - `RailsTrainlineAdapter`: Station-to-station ticket payload models defined; awaiting production REST endpoints.
   - `CruisesTraveltekAdapter`: XML cabin payload structures defined; XML gateway client stubbed.
   - `ActivitiesViatorAdapter` & `SightseeingViatorAdapter`: Product experience mappings defined; shares Viator sandbox mock.
   - `InsuranceAllianzAdapter`: Policy schedule underwriting schemas defined; awaiting live quote calculation engine.
2. **B2B Extranet Commission Distribution:** Client/quote ledger exists in-memory; split-settlement banking payouts are scaffolded.
3. **Notification Service:** Customer booking emails and consular SMS dispatches currently log to telemetry.

---

### 4.3 What Requires Backend Persistence (Infrastructure)

1. **Relational Database (PostgreSQL):** Migration of local in-memory storage maps (`src/server/db/storage.ts`) and `InMemoryManualListingRepository` to managed PostgreSQL (Supabase / AWS RDS). Table definitions documented in `POSTGRES_MANUAL_LISTING_SCHEMA_DDL`.
2. **Distributed Cache (Redis):** Distributed TTL cache for supplier search results and circuit breaker state across serverless runtime instances.
3. **Blob Storage (AWS S3 / Cloudflare R2):** Encrypted document vault for customer passport scans and visa supporting documents.

---

### 4.4 What Requires Supplier Credentials (API Keys)

| Supplier | Required Secret Environment Variables | Expected API Format | Fallback Behavior When Missing |
|---|---|---|---|
| **Duffel** | `DUFFEL_ACCESS_TOKEN`, `DUFFEL_ENVIRONMENT=production` | REST / NDC JSON API | Returns clear supplier outage notice or verified manual charter if evidenced in repository. |
| **LiteAPI** | `LITEAPI_PRODUCTION_KEY`, `LITEAPI_SANDBOX_KEY` | REST JSON Bedbank API | Serves verified manual direct hotel listings. |
| **Viator** | `VIATOR_API_KEY`, `VIATOR_PARTNER_ID` | REST JSON Experience API | Serves verified manual local tour listings. |
| **Trainline** | `TRAINLINE_PARTNER_KEY`, `TRAINLINE_SECRET` | REST JSON Rail API | Serves verified manual scenic train seat allotments. |
| **Traveltek** | `TRAVELTEK_CLIENT_ID`, `TRAVELTEK_XML_GATEWAY_URL` | SOAP / XML Cruise Gateway | Serves verified manual catamaran charter itineraries. |
| **Allianz** | `ALLIANZ_PARTNER_ID`, `ALLIANZ_API_KEY` | REST JSON Policy API | Displays insurance comparison tier cards with request-for-quote. |

---

### 4.5 What Requires Commercial & Legal Agreements (Business Policy)

1. **Airline Merchant / IATA Agreement:** Duffel NDC live ticketing requires a countersigned IATA distribution agreement or accredited Host Agency ARC/BSP ticketing bond.
2. **Hotel Wholesale Direct Settlement:** Bedbank post-pay merchant terms and credit facility agreements with LiteAPI.
3. **Consular Processing Licensing:** Travel agency accreditation with relevant consular authorities (VFS Global, UAE GDRFA portal).
4. **Insurance Brokerage Authorization:** Policy distribution authorization with Insurance Regulatory Commission of Sri Lanka (IRCSL) or international underwriter broker agreement.
5. **Payment Gateway Merchant Processing:** Countersigned merchant agreement with Stripe, Commercial Bank of Ceylon, or Seylan Bank IPG for live 3D-Secure 2.0 card processing.

---

### 4.6 What Blocks Real Production Booking

To achieve zero-risk commercial launch, the following 4 blockers must be resolved:
1. **Commercial Evidence Ledger Empty:** `COMMERCIAL_EVIDENCE_LEDGER` contains zero entries; all external supplier contracts, credentials, and manual SLAs remain unverified.
2. **Live Supplier Credentials Missing:** Injection of live production environment variables (`DUFFEL_ACCESS_TOKEN`, `LITEAPI_PRODUCTION_KEY`, etc.) replacing sandbox simulators.
3. **Production Payment Gateway Credentials Missing:** Injection of live payment gateway secret keys and webhook endpoints (`STRIPE_SECRET_KEY`, `IPG_MERCHANT_SECRET`).
4. **PostgreSQL Database Connection Missing:** Configuration of `DATABASE_URL` for persistent multi-tenant ledger storage.

Until these 4 blockers are configured, Vacatina operates strictly in **governed sandbox simulation mode**, preventing any customer from being charged or issued phantom tickets.

---

## 5. Acceptance Verification

- **Automated Tests:** 122 / 122 tests passing (`npm test`).
- **Browser Acceptance Journeys:** 33 / 33 assertions passing across 11 viewports (`npm run test:e2e`).
- **TypeScript Typecheck:** 0 errors (`npx tsc --noEmit`).
- **Live Production URL:** `https://vacatina-nu.vercel.app` (**HTTP 200 OK**).
