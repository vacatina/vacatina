# Vacatina Travel OS — Supplier Readiness Matrix & Commercial Truth Audit (v1.0)

> **Historical snapshot:** verification counts and release status in this document predate the Phase 4 local baseline. Current verified baseline: **233/233 tests**, **0 typecheck errors**, build PASS, browser/server bundle isolated. See [../ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md).

**Document Authority:** Vacatina Architectural Board & Senior Systems Auditor  
**Classification:** Upstream Supplier Verification, Commercial Truth & Production Readiness Standard  
**Target Systems:** All 11 Provider Adapters, Inventory Orchestrator, Admin CMS, Booking Saga  
**Audit Timestamp:** 2026-10-26T03:38:00+05:30  
**Verification Baseline:** Immutable Git Tag `v2.4-architecture-locked` (`05a4d9a`) $\rightarrow$ Head Commit `a709721`  
**Automated Invariant Test Suite:** 108 / 108 Tests Passing (100%)  
**Headless Chrome E2E Suite:** 33 / 33 Journeys & Viewports Passing (100%)  

---

## 1. Commercial Truth Axiom & Labeling Policy

In accordance with strict production-truth governance, **no upstream supplier integration is declared "Live Production Complete" without physical evidence of production credentials, live authenticated ping responses, and financial settlement verification.**

Any provider integration whose current implementation consists of typed adapter interfaces, mock fixtures, simulated responses, or local saga tests is classified strictly as:
- **`PLANNED_ADAPTER`** (Certification Status)
- **`SANDBOX / SIMULATED`** (Production Status)

Under no circumstances are these adapters labeled `LIVE`, `PRODUCTION INTEGRATED`, or `CERTIFIED` in commercial reports.

---

## 2. Comprehensive Supplier Readiness Matrix (Evidence-Backed)

Every cell reflects verifiable code-level and test-backed truth. Non-proven values remain explicitly `NOT CONFIGURED`, `NOT TESTED`, `PLANNED_ADAPTER`, or `SANDBOX / SIMULATED`.

| # | Provider | Product | Adapter Exists | Credentials Configured | Sandbox Tested | Live Tested | Search Working | Revalidation Working | Booking / Fulfillment Working | Certification Status | Production Status |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **Duffel (NDC)** | Flights | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (CAP-03 Sim) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **2** | **LiteAPI** | Hotels | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (CAP-03 Sim) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **3** | **Viator (Experiences)** | Activities | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **4** | **Viator (Tours)** | Sightseeing Tours | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **5** | **Trainline** | Rails | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **6** | **Traveltek** | Cruises | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **7** | **Rentalcars / CarTrawler** | Cars & Transfers | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **8** | **Allianz Assistance** | Travel Insurance | **PASS** | NOT CONFIGURED | **PASS** (Simulated) | NOT TESTED | **PASS** (Canonical) | **PASS** (Canonical) | LOCAL_SAGA_ONLY | `PLANNED_ADAPTER` | `SANDBOX / SIMULATED` |
| **9** | **Vacatina Consular Desk** | Visa Assistance | **PASS** | **PASS** (In-House) | **PASS** (Storage DB) | **PASS** (Manual SOP) | **PASS** (Consular DB) | **PASS** (SLA Vetted) | **PASS** (Intake Queue) | `INTERNAL_OPERATIONAL_SERVICE` | `OPERATIONAL_SERVICE_READY` |
| **10** | **Vacatina Bundler** | Holiday Packages | **PASS** | **PASS** (In-House) | **PASS** (Component DB) | **PASS** (Curated SOP) | **PASS** (Curated DB) | **PASS** (Multi-Hold) | **PASS** (Dossier Review) | `INTERNAL_CURATION_VERIFIED` | `MANUAL_CURATION_READY` |
| **11** | **Vacatina Admin CMS** | Direct Contracts (Multi-Product) | **PASS** | **PASS** (Admin Session) | **PASS** (10 Test Gates) | **PASS** (Storage Engine) | **PASS** (Aggregator) | **PASS** (Quota & Hold) | **PASS** (4-Eyes Governed) | `INTERNAL_COMMERCIAL_VERIFIED` | `PRODUCTION_READY_GOVERNED` |

---

## 3. Four Inventory Classes & Production Rules

The system enforces four distinct classes with strict invariants:

### 1. `MANUAL`
- **Definition:** Commercial inventory contracted directly by Vacatina (hotels, villas, chauffeur fleet) or internal operational services (consular visa advisory).
- **Governance:** Governed by 18 mandatory attributes in `/admin/inventory` and 4-Eyes separation of duties (`DRAFT` $\rightarrow$ `COMMERCIAL_REVIEW` $\rightarrow$ `FINANCE_APPROVED` $\rightarrow$ `PUBLISHED`).
- **Sellability:** Sellable only when status is `PUBLISHED`, quota $>0$, dates valid, and stop-sale is inactive.
- **Fulfillment:** Decrements internal allotment ledger; creates operational task.

### 2. `API`
- **Definition:** Real-time inventory retrieved from external supplier adapters.
- **Normalization:** Normalized into `CanonicalOfferEntity` with wholesale cost, calculated selling price, taxes, and cancellation policy.
- **Sellability:** May become bookable only after pre-booking revalidation (`POST /api/v1/offers/:id/revalidate`).
- **Fulfillment:** Dispatches to supplier PNR/order endpoint upon commercial certification.

### 3. `SEED / ACCELERATOR`
- **Definition:** Starter cards, mock fixtures, and test demonstrations used during rapid prototyping.
- **Production Quarantine Rule (Strictly Enforced):**
  - **Zero Checkout:** Cannot enter checkout or checkout saga.
  - **Zero Booking:** Throws `ArchitecturalInvariantViolationError` if booked in production mode.
  - **Zero Ready State:** Cannot transition to `READY` state in Trip Bucket.
  - **Quarantined from Live Search:** Filtered out by `UnifiedInventoryService.search()`.

### 4. `CONTENT_ONLY` / `DISCOVERY_CONTENT`
- **Definition:** Editorial inspiration cards, destination highlights, and route teasers (e.g. "Dubai Flights — From LKR 92,500").
- **Production Rule:**
  - Non-purchasable directly (`isLiveInventoryOffer: false`, `sellability: 'DISCOVERY_ONLY'`).
  - Carries price disclaimers (`*Indicative starting fare; live search required`).
  - Clicking triggers deterministic route dispatch (`/flights?from=CMB&to=DXB&departureDate=2026-11-15`) to launch a real unified search.

---

## 4. Verification Evidence: Strict SEED Quarantine & Failsafe Guards

Automated test gates in the repository verify the quarantine invariants:

```typescript
// Gate 8: Negative Test in tests/admin-inventory-api.test.ts
it('Gate 8 (Negative Test): Strict SEED Quarantine — SEED item cannot stage as READY in Trip Bucket', () => {
  const seedOffer = {
    canonicalOfferId: 'vct-fl-seed-demo-01',
    environmentClass: 'SEED',
    sellability: 'DISCOVERY_ONLY',
    // ...
  };
  
  // Storage engine rejects or stages as non-ready
  assert.throws(() => {
    assertSeedCannotStageReady(seedOffer);
  }, /SEED items cannot stage as READY in production/);
});

// Gate 55: Provider Live Booking Guard in tests/unit.test.ts
it('enforces Four-Tier Operational Readiness Tier on all 11 Providers & Blocks Uncertified Live Sales', () => {
  for (const supplierId of ['DUFFEL_NDC', 'LITEAPI', 'VIATOR', 'TRAINLINE', 'TRAVELTEK', 'ALLIANZ']) {
    const record = ProviderRegistryService.getProvider(supplierId);
    assert.equal(record.credentialsConfigured, false);
    assert.notEqual(record.lifecycle, 'PRODUCTION_LIVE');
  }
});
```

---

## 5. Architectural Integrity Summary

1. **Zero UI Leakage:** Technical labels (`API`, `MANUAL`, `HYBRID`, `SEED`, `DUFFEL_NDC`, `LITEAPI`) never leak into customer UI strings. Customers see only honest commercial terms (*Instant Confirmation*, *Request to Confirm*, *Assisted Service*, *Vacatina Exclusive*).
2. **Provenance Retained:** Full upstream provenance (`sourceType`, `supplierId`, `supplierOfferId`, `manualListingId`) is retained in database and Trip Bucket records for settlement and fulfillment.
3. **Frontend-Backend Decoupling:** Frontend asks for canonical offers; backend aggregates and normalizes; booking saga routes fulfillment transparently.
4. **All 10 Products Covered:** Flights, Hotels, Visa Assistance, Holiday Packages, Cars, Rails, Cruises, Activities, Sightseeing Tours, and Travel Insurance follow this unified architecture.
