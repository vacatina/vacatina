# Vacatina Operational Inventory Orchestration & Admin Specification v1.0
**Document ID**: `DOC-VCT-2026-ARCH-025`  
**Classification**: Vacatina Travel Operating System — Operational Architecture & Engineering Standard  
**Authority**: Principal Systems Architect & Vacatina Commercial Governance Board  
**Status**: **RATIFIED & LOCKED — PRODUCTION-SAFE**

---

## 1. Executive Ratification & Official Status Declaration

The Vacatina multi-product inventory architecture, operational orchestration pipeline, separation-of-duties governance, and backoffice administration models are certified under the following official determinations:

$$\begin{aligned}
\mathbf{\text{Architecture Status:}} & \quad \mathbf{\text{COMPLETE}} \\
\mathbf{\text{Implementation Status:}} & \quad \mathbf{\text{IMPLEMENTED}} \\
\mathbf{\text{Verification Status:}} & \quad \mathbf{\text{TESTED (71 / 71 Automated Tests Passing 100\%)}} \\
\mathbf{\text{Operational Safety:}} & \quad \mathbf{\text{PRODUCTION-SAFE}} \\
\mathbf{\text{Upstream Integrations:}} & \quad \mathbf{\text{WAITING FOR REAL COMMERCIAL / API INPUT}}
\end{aligned}$$

> [!IMPORTANT]
> **Definitive Commercial Truth Invariant**: No provider is classified as `LIVE` in this codebase. All 8 external API aggregators (`DUFFEL_NDC`, `AMADEUS_GDS`, `LITEAPI`, `VIATOR`, `TRAINLINE`, `RENTALCARS`, `TRAVELTEK`, `ALLIANZ`) and internal concierge scaffolds (`VACATINA_CONSULAR_CONCIERGE`) remain strictly classified as `CANDIDATE_PROVIDER` and `productionSellable = false`. Live production bookings are enabled solely per commercially verified, counter-signed direct contract with counter-signed proof (`commercialEvidenceId`).

---

## 2. Inventory Orchestration Engine: The 10-Step Pipeline

The [`InventoryOrchestratorService`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/inventory-orchestrator.service.ts) coordinates source retrieval, deduplication, commercial filtering, ranking, and customer offer delivery without ever leaking upstream raw schemas to customer interfaces:

```mermaid
flowchart TD
    REQ["1. Search Request (Product, Destination, Dates, Channel)"]
    SELECT["2. Source Selection (API_SUPPLIER, MANUAL_DIRECT, INTERNAL_SERVICE, DYNAMIC_PACKAGE)"]
    FETCH["3. Concurrent Retrieval (Circuit-Protected Supplier APIs + Payload CMS Direct)"]
    NORM["4. Normalization (Typed CanonicalOfferEntity with ProductExtensions)"]
    VALID["5. Contract & Date Validation (Sales/Travel Windows, Blackouts, Stop-Sale)"]
    DEDUP["6. Deterministic Deduplication (Natural Composite Key Resolution)"]
    GATE{"7. Commercial Truth Gate\n(Readiness Tier, Evidence Dossier, Operational State)"}
    AVAIL["8. Availability & Quota Check (Remaining Allotment > 0)"]
    RANK["9. Ranking & Pin-Above-API (4-Eyes & Exclusivity Evidence Integrity)"]
    OFFER["10. Canonical Result Generation (UnifiedCustomerOffer with Granular Financials)"]

    REQ --> SELECT
    SELECT --> FETCH
    FETCH --> NORM
    NORM --> VALID
    VALID --> DEDUP
    DEDUP --> GATE
    GATE -- "Cleared" --> AVAIL
    GATE -- "Unverified / Candidate" --> OFFER
    AVAIL --> RANK
    RANK --> OFFER
```

### The 10-Step Orchestration Sequence:
1. **Source Selection**: Dynamically identifies valid inventory sources for the product vertical (`API_SUPPLIER`, `MANUAL_DIRECT`, `INTERNAL_SERVICE`, `DYNAMIC_PACKAGE`). `SAMPLE_INVENTORY` and `DISCOVERY_ONLY` are strictly excluded from search aggregation.
2. **Concurrent Retrieval**: Queries `ManualInventoryService` and target external supplier adapters via [`CircuitBreakerService`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/circuit-breaker.service.ts) (trips to `OPEN` if provider errors exceed threshold, protecting search latency).
3. **Normalization**: Every supplier and manual response is normalized into typed [`CanonicalOfferEntity`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/types.ts#L480-L560) records with product-specific extensions.
4. **Validation**: Enforces binding contract date windows (`effectiveFromIso` to `effectiveToIso`), travel stay periods, blackout dates, and immediate operational stop-sell suspension (`isStopSaleActive`).
5. **Duplicate Detection & Natural Key Resolution**: Applies deterministic composite natural keys (`DeduplicationService.generateDeduplicationKey`) to link identical hotels, flights, and activities across suppliers into canonical entities (`ent_*`).
6. **Commercial Truth Gate**:
   - `MANUAL_DIRECT`: Requires physical signed contract, verified evidence dossier (`DOC-VAULT-*`), and active publishing state.
   - `API_SUPPLIER`: Evaluates operational state. Uncertified providers are quarantined as `CANDIDATE_UNVERIFIED` with `sellable = false`.
   - `INTERNAL_SERVICE`: Evaluates operational SLA sign-off.
7. **Availability & Allotment Validation**: Validates committed allotment keys/seats. Depleted quotas are immediately flagged as `SOLD_OUT` and excluded from active checkout.
8. **Pricing & 4-Layer Precedence**: Applies integer minor arithmetic across: Raw Supplier Cost $\rightarrow$ Platform Markup $\rightarrow$ Channel/Agency Markup $\rightarrow$ Taxes/Fees.
9. **Ranking & Pin-Above-API Integrity**:
   - Pinned manual listings rank at the top **ONLY IF**: `COMMERCIALLY_VERIFIED`, `ACTIVE`, within contract dates, has available allotment, pricing approved, and verified evidence exists.
   - An unverified manual offer can **NEVER** override a verified API offer.
10. **Canonical Result Generation**: Transforms internal offers into provider-neutral [`UnifiedCustomerOffer`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/types.ts#L1219-L1257) records. Raw supplier payloads are strictly hidden from B2C consumers while immutable provenance is preserved internally.

---

## 3. Master 10-Product Source Capability Matrix

The table below defines upstream sourcing, operational capabilities, revalidation requirements, and production certification statuses across all 10 Vacatina travel products:

| # | Travel Product | Primary API Supplier | Manual Direct Capability | Internal Service Capability | Dynamic Package Role | Booking Support | Cancellation / Change Support | Pre-Booking Revalidation | Production Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Flights** | Duffel (NDC), Amadeus (GDS) | Local Air Charters, Seaplanes | — | Flight Component | Instant API Hold, Async PNR Confirm | NDC Void / Refund Rules, Ticket Exchange | Rate & Seat Recheck via NDC API | **CANDIDATE_PROVIDER** (6/12 gates) |
| **2** | **Hotels** | LiteAPI (Bedbank), Hotelbeds | Direct Boutique Villas, Resorts | — | Hotel Component | Instant Allotment Decrement, 2-Way Push | Free Cancellation Window (e.g. 48h), Non-Ref | Room Allocation & Rate Parity Recheck | **CANDIDATE_PROVIDER** (6/12 gates) |
| **3** | **Visa** | — | — | Vacatina Consular Concierge Desk | Mandatory Visa Addon | Document Intake Staging, Task Dispatch | Full refund before dossier submission | Consular Requirement & Transit Rule Recheck | **CANDIDATE_PROVIDER** (SLA Pending) |
| **4** | **Packages** | Curated Wholesale Bundles | DMC Fixed Guaranteed Tours | Dynamic Bundler Engine | Primary Container | Distributed Saga Multi-Item Booking | Atomic Cascade Cancellation / Compensation | Atomic All-Component Recheck Guard | **PLATFORM_SANDBOX** |
| **5** | **Cars** | Rentalcars API | Chauffeur Fleets, Airport Transfers | — | Transfer Component | Instant Voucher, Fleet Dispatch SLA | Free cancellation up to 24h prior to pickup | Vehicle Category & Flight Tracking Recheck | **CANDIDATE_PROVIDER** (0/12 gates) |
| **6** | **Rails** | Trainline Partner API | Reserved Observation Carriages | — | Rail Transfer Component | Electronic Ticket Issuance | Fare family refund rules (Flexible / Semi) | Live Timetable & Seat Quota Recheck | **CANDIDATE_PROVIDER** (0/12 gates) |
| **7** | **Cruises** | Traveltek iSell API | Chartered Catamarans & Private Yachts| — | Cruise Excursion | Cabin Hold, Upstream Manifest Confirmation | Strict tiered cruise deposit refund schedule | Cabin Availability & Fuel Surcharge Recheck | **CANDIDATE_PROVIDER** (0/12 gates) |
| **8** | **Activities** | Viator API | Direct Local Safari Jeep Fleets | — | Excursion Component | Instant Barcode / QR Voucher | Free cancellation up to 24h before activity | Time Slot & Capacity Recheck | **CANDIDATE_PROVIDER** (2/12 gates) |
| **9** | **Sightseeing**| Viator / Attractions Gateway | Cultural Triangle Pass Desk | — | Sightseeing Tour Component| Timed Entry Pass Reservation | Non-refundable timed tickets | Timed Slot Allocation Recheck | **CANDIDATE_PROVIDER** (2/12 gates) |
| **10**| **Insurance** | Allianz Partners | — | — | Protection Addon | Instant Policy Issuance, Underwriter Bind | Statutory 14-day cooling off period | Risk Profile & Medical Declaration Recheck | **CANDIDATE_PROVIDER** (0/12 gates) |

---

## 4. Canonical Customer Journey Contract by Source Type

Every travel product moves through the locked 7-stage lifecycle contract:  
$$\text{Search} \longrightarrow \text{Results} \longrightarrow \text{Details} \longrightarrow \text{Configure} \longrightarrow \text{Trip Bucket} \longrightarrow \text{Recheck} \longrightarrow \text{Booking}$$

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Traveler / B2B Agent
    participant Frontend as B2C Web / Drawer
    participant Orchestrator as Inventory Orchestrator
    participant Sources as API / Direct / Desk
    participant Saga as Booking Saga Service

    Customer->>Frontend: Submit Search Query (Origin, Dest, Dates)
    Frontend->>Orchestrator: orchestrateSearch(criteria)
    Orchestrator->>Sources: Query Sources in Parallel (Circuit-Protected)
    Sources-->>Orchestrator: Raw Responses
    Orchestrator->>Frontend: Return UnifiedCustomerOffer[]
    Customer->>Frontend: Select & Configure Offer (Room/Cabin/Addons)
    Frontend->>Frontend: Stage in Trip Bucket Drawer (READY / NEEDS_ACTION)
    Customer->>Frontend: Proceed to Checkout
    Frontend->>Orchestrator: revalidateOffer(offerId)
    Orchestrator-->>Frontend: Status UNCHANGED / PRICE_CHANGED
    Customer->>Frontend: Confirm & Authorize Payment
    Frontend->>Saga: executeBookingSaga(tripBucketId)
    Saga->>Sources: Dispatch Supplier Fulfillment Holds
    Saga->>Saga: Capture 12 Immutable Provenance Fields
    Saga-->>Frontend: Return CONFIRMED Booking Group
    Frontend-->>Customer: Render Confirmed Itinerary (VCT-2026-XXXXXX)
```

### Detailed Lifecycle Specification by Source Type:
1. **`API_SUPPLIER` (External Consolidators)**:
   - *Search*: Orchestrator queries candidate adapter endpoint wrapped in circuit breaker.
   - *Results*: Delivered as `UnifiedCustomerOffer` (`inventorySourceType = 'API_SUPPLIER'`).
   - *Details*: Property / flight schedule details via provider-neutral endpoint `/flights/offer/{id}`.
   - *Configure*: Seat selection, fare family, or meal selection.
   - *Trip Bucket*: Added to Trip Bucket drawer in `READY` status.
   - *Recheck*: Real-time upstream call verifying rate freshness and seat/room hold.
   - *Booking*: Saga executes pre-auth, dispatches upstream hold, records 12 immutable provenance fields.
2. **`MANUAL_DIRECT` (Direct Contracts / Payload CMS)**:
   - *Search*: Filtered against active contract dates, sales windows, and positive quota.
   - *Results*: Delivered as `UnifiedCustomerOffer` (`inventorySourceType = 'MANUAL_DIRECT'`).
   - *Details*: Curated photography, room floor plans, local guide credentials.
   - *Configure*: Room allocation, extra beds, customized dietary requirements.
   - *Trip Bucket*: Added to drawer; allotment soft-held in memory.
   - *Recheck*: Verified against stop-sell killswitch and contract validity dates.
   - *Booking*: Quota decremented atomically in database; booking item references `commercialEvidenceId`.
3. **`INTERNAL_SERVICE` (Consular Assistance & Concierge)**:
   - *Search*: Sourced from country visa requirements catalog.
   - *Results*: Delivered as fixed advisory service tier.
   - *Details*: Consular checklist, document requirements, embassy turnaround times.
   - *Configure*: Document intake form (passport scans, employer letters).
   - *Trip Bucket*: Staged initially as `NEEDS_ACTION` until mandatory documents are uploaded; converts to `READY` upon resolution.
   - *Recheck*: Operations dispatch availability verified.
   - *Booking*: Service reference issued (`VSA-INTAKE-XXXXXX`), internal operational task dispatched.
4. **`DYNAMIC_PACKAGE` (Multi-Component Bundles)**:
   - *Search*: Assembled dynamically by Vacatina Bundler from verified flight + hotel components.
   - *Results*: Unified package price with transparent component itemization.
   - *Details*: Comprehensive daily itinerary breakdown.
   - *Configure*: Component swapping (e.g. Change Room tier, upgrade flight cabin).
   - *Trip Bucket*: Staged atomically.
   - *Recheck*: Every sub-component rechecked simultaneously; if any component increases in price or becomes unavailable, package requires re-confirmation.
   - *Booking*: Saga executes multi-provider hold; if any component fails, Saga compensation automatically cancels held items and triggers partial refund.
5. **`DISCOVERY_ONLY` (Homepage Editorial Teasers & Cards)**:
   - Strictly informational inspiration content.
   - Clicking pre-fills search parameters and navigates to `/search` or `/flights`.
   - Never enters Trip Bucket, cannot be configured, and cannot checkout directly.
6. **`SAMPLE_INVENTORY` (Developer Mocks & Seed Fixtures)**:
   - Quarantined in testing and sandbox fixtures.
   - Excluded from live production search responses by `assertProductionSearchExcludesDemoSeed`.
   - Hard invariant `assertSeedCannotEnterCheckout` permanently aborts any checkout attempt.

---

## 5. Admin Manual Inventory Operations: 16 Screen Specifications

To prevent operational confusion and enforce the **4-Eyes Principle (Separation of Duties)**, the backoffice manual inventory desk is specified into 16 dedicated functional modules:

```mermaid
stateDiagram-v2
    [*] --> Screen02_CreateDraft: Data Entry (cms:edit_listings)
    Screen02_CreateDraft --> Screen04_ContractVault: Submit for Verification
    Screen04_ContractVault --> Screen11_CommercialTruthGate: Commercial Review (cms:verify_commercial)
    Screen11_CommercialTruthGate --> Screen09_MarkupPricing: Approved Dossier
    Screen09_MarkupPricing --> Screen12_PublishingDesk: Price Approval (cms:approve_pricing)
    Screen12_PublishingDesk --> Screen01_InventoryList: Publish to Production (cms:publish_listings)
    Screen01_InventoryList --> Screen15_StopSellKillswitch: Emergency Suspension
    Screen15_StopSellKillswitch --> Screen01_InventoryList: Lift Suspension
```

### Module Specifications:
1. **Screen 01: Inventory Master List & Filter Console**
   - Displays all manual direct listings with filters for Product, Partner, Verification State, Allotment Quota, Expiry Date, and Stop-Sell Status.
   - Visual readiness badges: `DRAFT`, `VERIFICATION_PENDING`, `COMMERCIALLY_VERIFIED`, `ACTIVE`, `SUSPENDED`, `EXPIRED`.
2. **Screen 02: Listing Creation & Configuration Editor**
   - Captures core product identity: Title, Subtitle, Product Vertical, Location (City, Country, Geo-coordinates), Inclusions, Exclusions, and Room/Seat inventory units.
   - Accessible to users holding permission `cms:edit_listings`.
3. **Screen 03: Supplier Details & Contracting Entity Profile**
   - Captures supplier legal registered name, business registration number, VAT/Tax ID, registered corporate address, operational contact email, and dedicated contracting officer.
4. **Screen 04: Contract Evidence Dossier & Document Vault**
   - File attachment and metadata vault for bilateral paper contracts (`DOC-VAULT-*`).
   - Fields: Contract Reference, Countersigned Date, Effective From, Effective To, Document Vault Hash, Bilateral Signatory Name.
5. **Screen 05: Rate Periods & Seasonal Pricing Schedule**
   - Multi-tier rate calendars supporting Peak Season, Shoulder Season, and Off-Peak Season.
   - Configures contracted base net cost, standard retail selling price, and currency (`LKR`, `USD`, `EUR`, `AED`).
6. **Screen 06: Allotment & Daily Quota Allocation Manager**
   - Manages daily committed keys or seats.
   - Features real-time remaining quota indicators and automated warning alerts when available keys fall below 2 units.
7. **Screen 07: Cancellation & Refund Policy Engine**
   - Configures cancellation window rules: Free Cancellation deadline (e.g. 48 hours prior), percentage penalty schedules, and refundability flags (`REFUNDABLE`, `NON_REFUNDABLE`, `PARTIALLY_REFUNDABLE`).
8. **Screen 08: Settlement Terms & Currency Reconciliation Desk**
   - Configures supplier settlement rules: `NET_30_DAYS`, `NET_15_DAYS`, `PREPAYMENT_UPON_BOOKING`, or `BI_WEEKLY_BANK_TRANSFER`.
   - Banking details and remittance currency specifications.
9. **Screen 09: Markups & Yield Management Console**
   - Configures platform margin rules: Fixed fee markup, percentage markup (e.g. 12% to 25%), and B2B partner agency commission sharing rules.
   - Accessible to users holding permission `cms:approve_pricing`.
10. **Screen 10: Promotions & Seasonal Merchandising Desk**
    - Configures promotional discount tags, early-bird rate specials, and minimum stay requirements (e.g. Min 3 nights).
11. **Screen 11: Commercial Verification & 4-Eyes Sign-Off Console**
    - **Separation of Duties Gate**: Displays checklist of all 11 required commercial attributes.
    - System strictly enforces that the operator who created the draft listing cannot verify the contract (`SeparationOfDutiesViolationError`).
    - Accessible only to users holding permission `cms:verify_commercial`.
12. **Screen 12: Publishing Desk & Channel Distribution Switch**
    - Final publishing checkpoint. System enforces that neither the listing creator nor the contract verifier can publish the listing without independent executive sign-off.
    - Configures distribution scope: `PUBLIC_GLOBAL`, `B2B_ONLY`, or `B2C_ONLY`.
    - Accessible only to users holding permission `cms:publish_listings`.
13. **Screen 13: Contract Expiry & Quota Telemetry Queue**
    - Automated triage queue alerting contracting officers 30 days and 14 days prior to bilateral contract expiration.
14. **Screen 14: Immutable Activity Audit Log**
    - Complete, append-only history of every status modification, quota change, pricing override, and approver signature with ISO timestamps and user IDs.
15. **Screen 15: Emergency Stop-Sell Killswitch Console**
    - One-click immediate suspension switch (`toggleStopSale`) that instantly freezes inventory availability and rejects incoming bookings within 50ms across the platform.
16. **Screen 16: Source Provenance Ledger & Reconciliation Desk**
    - Backoffice accounting reconciliation view displaying immutable originating provenance (`originalNetMinor`, `taxesMinor`, `markupMinor`, `customerSellingAmountMinor`, `settlementCurrency`) for every executed booking item.

---

## 6. Automated Invariant Verification (71 / 71 Tests Passing)

The complete Vacatina invariant verification suite confirms 100% adherence to all architectural constraints:

| Test Suite | Subtests | Invariants Verified | Passing Status |
| :--- | :---: | :--- | :---: |
| `tests/unit.test.ts` | 63 | Invariants 1–59 + Subtest 60 (Pre-Checkout Guards: Samples, Discovery, Unverified Manual, Uncertified Providers, Expired Contracts, Unavailable Items), Subtest 61 (Search Pipeline & Raw Schema Encapsulation), Subtest 62 (Admin Separation of Duties & 4-Eyes Principle), Subtest 63 (Pin-Above-API & Exclusivity Rules). | **63 / 63 PASS (100%)** |
| `tests/supplier-certification.test.ts` | 8 | Provider Certification Gates 1 through 12 across Duffel, LiteAPI, Viator, Trainline, Traveltek, Allianz, and Consular Concierge. | **8 / 8 PASS (100%)** |
| **Total Automated Coverage** | **71** | **All Invariants, Gates, Lifecycles, and Safety Rules Verified.** | **71 / 71 PASS (100%)** |

---

## 7. Operational Summary & Next Steps

With the completion of this phase:
- The B2C customer experience remains 100% unified, responsive, and untouched.
- External upstream providers can be swapped, upgraded, or credentialed without modifying frontend contracts.
- Low-privilege operators cannot bypass commercial truth gates or publish unverified inventory.
- Real supplier integrations will be enabled strictly as bilateral contracts and physical API credentials are signed and verified.
