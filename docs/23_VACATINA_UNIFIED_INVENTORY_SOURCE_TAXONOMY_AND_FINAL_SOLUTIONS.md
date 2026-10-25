# Vacatina Unified Inventory Source Taxonomy & Final Architecture Solutions v1.0
**Document ID:** `docs/23_VACATINA_UNIFIED_INVENTORY_SOURCE_TAXONOMY_AND_FINAL_SOLUTIONS.md`  
**Ratified System Architectural Status:**
$$\mathbf{\text{Inventory Architecture LOCKED — Provider Integration \& Operational Certification Pending}}$$

**Governing Authorities & Specifications:**
- `ADR-007: Inventory Source Taxonomy, Discovery Layer Isolation, and Certification Gating`
- `ADR-008: Provider Registry Lifecycle, Manual Listing Governance, Unified Ranking, and Offer Source Scorer`
- `docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md`
- `docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md`
- `docs/20_VACATINA_PROVIDER_INTEGRATION_CERTIFICATION_AND_FALLBACK_MATRIX.md`
- `docs/21_VACATINA_FINAL_PROVIDER_CERTIFICATION_AND_OPERATIONAL_PROOF.md`
- `docs/22_VACATINA_COMMERCIAL_TRUTH_AND_OPERATIONAL_STATUS_MATRIX.md`

---

## 1. Executive Summary: The Unified Inventory Paradigm

The Vacatina platform achieves an out-of-the-box, comprehensive resolution to the unified inventory architecture challenge. By separating **commercial reality** from **data transport mechanisms**, the platform treats direct supplier contracts and external API aggregators through an identical, customer-facing canonical contract while strictly enforcing the **Commercial Truth Gate**.

```
                    VACATINA INVENTORY SYSTEM
 Manual Direct ───────┐
 API Supplier ────────┤
 Internal Service ────┤
 Dynamic Package ─────┼─→ Canonical Offer Model (Unified Contract)
 Sample Inventory ────┘
                              ↓
                     Commercial Truth Gate
                              ↓
               Sellable / Not Sellable Decision
                              ↓
 Search → Results → Details → Configure
                              ↓
                       Price Recheck
                              ↓
                         Trip Bucket
                              ↓
                        Review / Book
```

---

## 2. The Five Canonical Inventory Source Types

Every inventory record within the Vacatina Travel OS is categorized under exactly one of five canonical source types:

| Inventory Source Type | Commercial Meaning | Real-World Operational Examples | Production Sellable? |
| :--- | :--- | :--- | :---: |
| **`MANUAL_DIRECT`** | Vacatina staff or partner administrator manually provisions verified contracted inventory via Payload CMS / Admin Portal. | Direct hotel allotments, boutique villas, private helicopter/seaplane charters, licensed chauffeur transfers, bespoke local tours. | **YES**, strictly after bilateral contract verification via Commercial Truth Gate (`REAL_CONTRACTED`). |
| **`API_SUPPLIER`** | External GDS, NDC, or bedbank API provides dynamic inventory. | Duffel (NDC Flights), LiteAPI (Wholesale Hotels), Viator (Tours & Activities), Trainline (European Rail). | **YES**, strictly after live production credentials and operational certification (`LIVE_API_CERTIFIED`). |
| **`INTERNAL_SERVICE`** | Vacatina's in-house operational team delivers the service end-to-end. | Vacatina Consular Concierge (Visa Document Review, Embassy Escort, Application Processing). | **YES**, operationally certified with 24–48h SLA (`VERIFIED_INTERNAL`). |
| **`DYNAMIC_PACKAGE`** | Vacatina's dynamic package engine combines multiple underlying inventory sources into a single bundled itinerary. | Curated Flight + Hotel + Airport Transfer package. | **ONLY** when every required underlying component is individually certified and sellable. |
| **`SAMPLE_INVENTORY`** | Demonstration, prototype accelerator, or UI mock content. | Uncounter-signed demo villa, mock flight teaser, staging test records. | **STRICTLY FORBIDDEN** in production checkout. |

---

## 3. How Manual Listing Operates: "Manual $\neq$ Fake"

A foundational principle of Vacatina's architecture is that **manual listing does NOT mean fake listing**.
- **API** is simply a digital transport mechanism.
- **Manual** represents direct, bilateral supplier relationships where an intermediary software aggregator (e.g. GDS or bedbank) does not exist.
- Commercial truth is determined by legal contracts, allotment quotas, settlement terms, and partner SLAs—**not** by whether an HTTP API was called.

### 3.1 The Direct Contract Lifecycle
When Vacatina secures a direct contract with a boutique luxury resort or charter operator:
1. **No External API Exists**: The property or operator does not maintain an NDC or GDS connection.
2. **Payload CMS Administration**: Vacatina administrators create the structured listing:
   $$\text{Property} \rightarrow \text{Room/Cabin Types} \rightarrow \text{Contracted Rates} \rightarrow \text{Cancellation Policy} \rightarrow \text{Allotment Quota} \rightarrow \text{Validity Dates} \rightarrow \text{Taxes} \rightarrow \text{Contract Evidence}$$
3. **Evidence Verification Gate**:
   $$\mathbf{\text{MANUAL\_DIRECT}} \xrightarrow{\text{Commercial Evidence Verified}} \mathbf{\text{REAL\_CONTRACTED}} \xrightarrow{\text{Published}} \mathbf{\text{PRODUCTION\_SELLABLE = true}}$$
4. **Unified Customer Experience**: The customer searches for hotels in Sri Lanka or Dubai and receives both API and direct offers in the same list. The customer cannot tell whether the backend queried an API or an in-house database—they experience a fast, consistent, professional booking journey.

---

## 4. How API Listing Operates

When an external supplier integration is active:
1. **Raw Upstream Isolation**: Raw supplier responses (e.g. Duffel JSON, LiteAPI XML/JSON) are strictly isolated behind typed adapters.
2. **Standard Normalization Flow**:
   $$\text{Supplier API} \rightarrow \text{Adapter} \rightarrow \text{Normalizer} \rightarrow \text{Canonical Offer} \rightarrow \text{Commercial Truth Gate} \rightarrow \text{Search Results} \rightarrow \text{Trip Bucket}$$
3. **Truthful Sandbox Protection**: External candidate suppliers without verified live production credentials and executed distributor contracts operate strictly in `SANDBOX` or `SCAFFOLD` lifecycle. `assertProviderIsProductionSellable` blocks them from selling live until all 12 certification gates are cleared.

---

## 5. Unified Customer Offer Contract

To ensure frontend simplicity, robust TypeScript typing, and zero technical leakage, both `API_SUPPLIER` offers and `MANUAL_DIRECT` offers serialize into the identical **Unified Customer Offer** shape:

```typescript
export interface UnifiedCustomerOffer {
  offerId: string;                 // Stable canonical offer identifier (e.g. "vct-ht-liteapi-dxb-01")
  productType: TravelProductSlug;  // Exactly one of the 10 canonical products (e.g. "hotels")
  inventorySourceType: CanonicalInventorySourceType; // MANUAL_DIRECT, API_SUPPLIER, INTERNAL_SERVICE
  providerId: string;              // Upstream platform provider ID (e.g. "LITEAPI", "PAYLOAD_CMS_DIRECT")
  supplierId: string;              // Specific commercial supplier ID (e.g. "DIRECT_HOTEL_DESK")
  title: string;                   // Display title (e.g. "Heritance Kandalama Eco-Luxury Resort")
  price: number;                   // Customer unit selling price in display currency (e.g. 89000)
  currency: string;                // Active display currency (e.g. "LKR", "USD")
  availabilityStatus: AvailabilityState; // LIVE, MANUAL_AVAILABLE, ON_REQUEST, SOLD_OUT
  lastCheckedAt: string;           // ISO 8601 timestamp of last price/quota verification
  commercialStatus: 'SAMPLE_DEMO' | 'CANDIDATE_UNVERIFIED' | 'COMMERCIALLY_VERIFIED';
  sellable: boolean;               // Boolean verdict computed strictly by Commercial Truth Gate
}
```

### 5.1 Object Comparison: LiteAPI vs Direct Hotel
Both records present the identical API contract to the client application:

```json
// Quote A: Candidate Wholesale Bedbank (API_SUPPLIER)
{
  "offerId": "vct-ht-liteapi-dxb-grandpalace-01",
  "productType": "hotels",
  "inventorySourceType": "API_SUPPLIER",
  "providerId": "LITEAPI",
  "supplierId": "LITEAPI",
  "title": "Grand Palace Hotel Dubai",
  "price": 52800,
  "currency": "LKR",
  "availabilityStatus": "LIVE",
  "lastCheckedAt": "2026-10-25T12:00:00.000Z",
  "commercialStatus": "CANDIDATE_UNVERIFIED",
  "sellable": false
}

// Quote B: Verified Direct Hotel Contract (MANUAL_DIRECT)
{
  "offerId": "vct-ht-direct-dambulla-kandalama-02",
  "productType": "hotels",
  "inventorySourceType": "MANUAL_DIRECT",
  "providerId": "PAYLOAD_CMS_DIRECT",
  "supplierId": "DIRECT_HOTEL_DESK",
  "title": "Heritance Kandalama Signature Resort",
  "price": 89000,
  "currency": "LKR",
  "availabilityStatus": "MANUAL_AVAILABLE",
  "lastCheckedAt": "2026-10-25T12:05:00.000Z",
  "commercialStatus": "COMMERCIALLY_VERIFIED",
  "sellable": true
}
```

---

## 6. Project Accelerator & Seed Inventory Integrity

In strict adherence to the Commercial Truth Gate:
1. **Accelerator Quota Rule**: Prototype code, scaffolds, or demo listings generated during accelerator prototyping are classified as **`PLATFORM_CAPABILITY`** or **`SAMPLE_INVENTORY`**.
2. **Zero Fictitious Contract Claims**: The platform strictly prohibits fabricating legal document hashes (e.g. `DOC-VAULT-LK-2026-0881`) to claim commercial readiness for unverified seed records.
3. **Current Catalog Audit**:
   - In `CANONICAL_MANUAL_LISTINGS`, **100% of seed demonstration records** (`charter-cmb-mle-airtaxi`, `heritance-kandalama-signature`, `careem_fleet_dxb-...`, `sample-boutique-villa-mirissa`) are classified as `SAMPLE_INVENTORY` (`commercialReady: false`, `productionSellable: false`).
   - The **only** commercially live operational entity in production today is `VACATINA_CONSULAR_CONCIERGE` (`VERIFIED_INTERNAL`), which operates real manual human consular review with 24–48h SLA.

---

## 7. Homepage Discovery Layer vs Transactional Inventory

A critical architectural invariant is enforced between discovery content and inventory offers:
- **Homepage Cards are Discovery Content (`DISCOVERY_ONLY`)**: Cards for "Dubai Winter Sun", "Maldives Overwater Getaway", or "Sigiriya Cultural Tour" provide editorial inspiration and destination prefill parameters.
- **Search Pre-fill Flow**: Clicking an editorial card populates the canonical Search Command Center (SCC) inputs (destination, dates, passenger count) and executes a real search.
- **Checkout Guard**: Discovery content entities have `isLiveInventoryOffer: false` and are strictly blocked by `assertDiscoveryLayerCannotEnterInventoryCheckout` from entering checkout.

---

## 8. Automated Verification Suite: 65 / 65 Tests Passing (100%)

The complete system invariant rules, 4-tier operational readiness, commercial evidence guards, and 5-source unified offer patterns are verified by 65 automated tests:

1. **`tests/unit.test.ts` (57 / 57 PASS - 100%)**:
   - Subtests 1–54: Core domain, 11 SCC tabs order, 8 Trip Bucket states, RBAC, Saga compensation, dedupe tie-breaking, RFC 7807 router, 18-attribute manual contract model, and candidate live booking guards.
   - **Subtest 55**: Enforces 4-tier operational readiness on all 11 providers; blocks Duffel, Amadeus, and LiteAPI while admitting Consular Concierge.
   - **Subtest 56**: Enforces commercial evidence validation; blocks unverified sample listings while admitting genuine signed contracts.
   - **Subtest 57**: Enforces 5-source unified offer serialization consistency across LiteAPI and direct contract hotels, and validates discovery layer checkout quarantine.

2. **`tests/supplier-certification.test.ts` (8 / 8 PASS - 100%)**:
   - Gates 1–12: Credentials guards, RFC 7807 problem details, integer minor currency math, and circuit breaker fallback telemetry.

**Total Automated Test Count:** **65 / 65 PASSING (100% HEALTHY)**
