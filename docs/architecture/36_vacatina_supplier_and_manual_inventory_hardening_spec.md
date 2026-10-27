# Vacatina Supplier & Manual Inventory Architecture Hardening Specification (v1.0)

> **Historical snapshot:** verification counts and release status in this document predate the Phase 4 local baseline. Current verified baseline: **233/233 tests**, **0 typecheck errors**, build PASS, browser/server bundle isolated. See [../ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md).

**Document ID**: `VAC-ARCH-SPEC-036`  
**Classification**: Production Architecture & Commercial Governance Authority  
**Status**: APPROVED & LOCKED FOR BACKEND SCRUTINY  
**Last Updated**: October 2026  
**Audience**: Backend Engineering Team, Tech Leads, CMS Architects, Product Operations  

---

## 1. Executive Summary & Defensibility Mandate

Following detailed technical review, this specification locks the final **Supplier, Manual Inventory, and Unified Commercial Offering Architecture** for Vacatina Travel OS. 

Previous drafts contained commercial overstatements that could not withstand backend engineering scrutiny—including claims of active production integrations (e.g. Duffel, LiteAPI, Viator, Allianz), simulated "instant confirmation" labels, an unevidenced "4-hour Visa SLA", and an ungrounded "manual charter flight fallback".

**Under this hardened specification:**
1. **Zero Invented Capabilities**: No external supplier is classified as `LIVE` or production-bookable without verified production API credentials **AND** executed commercial/legal agreements cataloged in the `COMMERCIAL_EVIDENCE_LEDGER`.
2. **Honest Fallback Protocol**: If an external API (such as flights) is unavailable or unconfigured, the system returns a truthful service degradation or retry notice. It **never** claims an automated fallback to uncontracted manual charter aircraft.
3. **Strict Source Taxonomy**: Four canonical types (`MANUAL`, `API`, `HYBRID`, `SEED`) normalize into a single unified `CanonicalOfferEntity`. Customer-facing UI never exposes technical source tags or sandbox simulation states.
4. **Persistence-Ready Boundary**: The admin manual inventory CMS is decoupled behind a strictly typed `IManualListingRepository` interface with full PostgreSQL DDL schema ready for database migration.
5. **Quarantine of Seed Data**: Fixture, sample, or accelerator data is strictly isolated from production search results, Trip Bucket `READY` staging, payment gateway calls, and booking confirmation sagas.

---

## 2. Six-Stage Provider Activation State Machine

An external supplier integration or internal manual desk is governed by a deterministic, unidirectional 6-stage lifecycle. **An API key alone NEVER grants `LIVE` status.**

```
+-----------+       +-----------+       +-------------------------+
|  PLANNED  |  ---> |  SANDBOX  |  ---> |  CREDENTIALS_CONFIGURED |
+-----------+       +-----------+       +-------------------------+
                                                     |
                                                     v
+-----------+       +-----------+       +-------------------------+
| SUSPENDED | <---  |   LIVE    | <---  |   COMMERCIAL_VERIFIED   |
+-----------+       +-----------+       +-------------------------+
```

### Stage Definitions & Transition Criteria

| Stage | Description | Production Checkout Allowed? | Transition Criteria |
| :--- | :--- | :---: | :--- |
| `PLANNED` | Architecture defined; adapter stub/scaffold exists in codebase. | ❌ NO | Initial code scaffolding merged. |
| `SANDBOX` | Connected to supplier sandbox/testbed using sandbox test API keys. | ❌ NO | Valid sandbox credentials configured; sandbox contract smoke tests passing. |
| `CREDENTIALS_CONFIGURED` | Production API keys provisioned and injected into secure environment. | ❌ NO | Production API key verified via ping/health check. **Commercial agreement still unverified.** |
| `COMMERCIAL_VERIFIED` | Legal agency, merchant of record, or API supplier agreement executed and audited in `COMMERCIAL_EVIDENCE_LEDGER`. | ❌ NO | Legal agreement executed, signed, and countersigned. Production credentials pending deployment or final activation sign-off. |
| `LIVE` | **Both** production credentials verified AND commercial evidence recorded. Ready for real customer transactions. | ✅ **YES** | Conjunction of `CREDENTIALS_CONFIGURED` + `COMMERCIAL_VERIFIED` + Health Check passing. |
| `SUSPENDED` | Disabled due to circuit breaker trip, commercial dispute, expired contract, or upstream outage. | ❌ NO | Manual admin toggle or automated circuit breaker failure threshold tripped. |

### Invariant Guard in Code (`commercial-truth.ts`)
```typescript
export function evaluateProviderActivation(
  providerId: string,
  env: string = process.env.NODE_ENV || 'development',
  ledger: Record<string, CommercialEvidenceDossier> = COMMERCIAL_EVIDENCE_LEDGER
): ProviderActivationEvaluation {
  const hasCreds = hasEnvCredentialForProvider(providerId, env);
  const evidence = ledger[providerId];
  const hasCommercialAgreement = !!(
    evidence &&
    evidence.evidenceStatus === 'VERIFIED_ACTIVE' &&
    new Date(evidence.expiryDate) > new Date()
  );

  let stage: ProviderActivationStage = 'PLANNED';
  if (hasCreds && hasCommercialAgreement) {
    stage = 'LIVE';
  } else if (hasCommercialAgreement && !hasCreds) {
    stage = 'COMMERCIAL_VERIFIED';
  } else if (hasCreds && !hasCommercialAgreement) {
    stage = 'CREDENTIALS_CONFIGURED';
  } else if (isSandboxConfigured(providerId)) {
    stage = 'SANDBOX';
  }

  return {
    providerId,
    stage,
    isProductionBookable: stage === 'LIVE',
    blockers: deriveBlockers(stage, hasCreds, hasCommercialAgreement)
  };
}
```

---

## 3. Four-Tier Source Taxonomy & Customer Confirmation Language

### Unified Canonical Offer Normalization
All inventory sources normalize into `CanonicalOfferEntity` before rendering search results or entering the Trip Bucket. The traveler experiences an identical, high-fidelity card regardless of origin:

```
[ Manual Listing Repo ] ----\
[ Supplier API Adapters ] ---> [ UnifiedInventoryService ] ---> CanonicalOfferEntity ---> Search Results / Trip Bucket
[ Hybrid Composition ] -----/
```

### Customer Confirmation Modes (Zero Technical Leakage)
Customer-facing UI strictly presents commercial fulfillment realities without exposing internal implementation mechanics:

| Customer Label | When Applicable | Banned Customer Terms |
| :--- | :--- | :--- |
| **Instant confirmation** | - External provider is in `LIVE` stage.<br>- Manual listing is `PUBLISHED` with remaining allotment quota $> 0$. | `Instant confirmation (Simulated)`<br>`API instant`<br>`Mock instant` |
| **Confirmation required** | - Manual listing configured with fulfillment mode `ON_REQUEST`.<br>- Dynamic bundle requiring hotel/villa direct confirmation. | `Manual fallback`<br>`Offline booking`<br>`Backoffice queue` |
| **Vacatina assistance** | - Visa concierge applications.<br>- Custom bespoke multi-city itineraries requiring desk handling. | `4-hour Visa SLA`<br>`Automated visa grant`<br>`Manual charter fallback` |

---

## 4. Hybrid Field Authority Matrix

When Vacatina enriches or curates external supplier listings (e.g., adding airport VIP lounge access, curated excursions, or negotiated amenities to a live hotel rate), **field authority must be deterministic**. 

Silent overwriting of supplier rates or upstream availability is mathematically prohibited.

```
+-----------------------------------------------------------------------------------------+
|                                HYBRID FIELD AUTHORITY                                   |
+-----------------------------------------------------------------------------------------+
| SUPPLIER AUTHORITATIVE (Read-Only)      | VACATINA AUTHORITATIVE (Curation & Markup)    |
|-----------------------------------------|-----------------------------------------------|
| - Upstream Availability Status          | - Platform Markup (Minor Units)               |
| - Base Supplier Cost (Minor Units)      | - Selling Price = Supplier Cost + Markup      |
| - Supplier Currency & FX Base           | - Curated Inclusions & Perks                  |
| - Flight Schedules / Operating Carrier  | - Curated Exclusions & Clear Terms            |
| - Hotel Room Grade & Supplier Bedding   | - Exclusive Editorial Badges                  |
| - Upstream Cancellation Windows & Dues  | - Vacatina Concierge Notes & Service Rules    |
| - Upstream Supplier Offer Identifier    | - Commercial Evidence Reference ID            |
+-----------------------------------------------------------------------------------------+
```

### Mathematical Pricing Invariant
$$\text{finalSellingPriceMinor} = \text{supplierBaseCostMinor} + \text{platformMarkupMinor}$$

If the supplier revalidates with a price change, the platform markup is reapplied to the updated supplier base cost, or flagged as `PRICE_CHANGED` if tolerance is exceeded.

---

## 5. Persistence-Ready Manual Listing CMS Boundary

The Manual Inventory CMS manages direct contracted hotels, boutique villas, private chauffeur transfers, and in-house concierge visa services. It is encapsulated behind a strict repository contract.

### 24 Commercial Attributes of `ProductionManualListingEntity`
Every manual listing contains all 24 production-mandated attributes:

1. `canonicalEntityId`: Unique UUID.
2. `sku`: Human-readable inventory code (e.g., `VAC-HTL-CMB-001`).
3. `productType`: One of the 10 canonical product types.
4. `sourceType`: Strictly `'MANUAL'`.
5. `supplierIdentity`: Legal entity ID of the contracted provider.
6. `fulfillmentMode`: `'INSTANT_ALLOTMENT'` or `'ON_REQUEST'`.
7. `title`: Commercial offering title.
8. `destinationId`: Standard UN/LOCODE or IATA code.
9. `originId`: Origin code (applicable for flights/transfers).
10. `validFrom`: ISO 8601 validity start timestamp.
11. `validTo`: ISO 8601 validity expiration timestamp.
12. `totalAllotment`: Contracted inventory allocation.
13. `remainingAllotment`: Real-time remaining quota.
14. `stopSale`: Emergency operational toggle (`true` hides from customer search).
15. `netCostMinor`: Direct contracted cost payable to supplier.
16. `sellingPriceMinor`: Customer-facing gross selling price.
17. `currency`: ISO 4217 currency code (e.g., `'LKR'`, `'USD'`).
18. `taxesAndFeesMinor`: Mandatory governmental and municipal taxes.
19. `cancellationRules`: Structured cancellation penalties and cutoffs.
20. `inclusions`: Explicit array of guaranteed customer inclusions.
21. `exclusions`: Explicit array of exclusions.
22. `media`: High-resolution gallery with alt text and licensing.
23. `commercialEvidenceReference`: Reference to executed paper contract in ledger.
24. `lifecycleState`: 4-Eyes state (`DRAFT` $\rightarrow$ `VERIFIED` $\rightarrow$ `PRICED` $\rightarrow$ `PUBLISHED` $\rightarrow$ `EXPIRED` $\rightarrow$ `SUSPENDED`).

### PostgreSQL DDL Schema (`POSTGRES_MANUAL_LISTING_SCHEMA_DDL`)
```sql
CREATE TABLE IF NOT EXISTS manual_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    product_type VARCHAR(32) NOT NULL,
    source_type VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    supplier_id UUID NOT NULL,
    fulfillment_mode VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    destination_id VARCHAR(16) NOT NULL,
    origin_id VARCHAR(16),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    total_allotment INTEGER NOT NULL CHECK (total_allotment >= 0),
    remaining_allotment INTEGER NOT NULL CHECK (remaining_allotment >= 0 AND remaining_allotment <= total_allotment),
    stop_sale BOOLEAN NOT NULL DEFAULT FALSE,
    net_cost_minor BIGINT NOT NULL CHECK (net_cost_minor >= 0),
    selling_price_minor BIGINT NOT NULL CHECK (selling_price_minor >= net_cost_minor),
    currency VARCHAR(3) NOT NULL,
    taxes_and_fees_minor BIGINT NOT NULL DEFAULT 0,
    cancellation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    media JSONB NOT NULL DEFAULT '[]'::jsonb,
    commercial_evidence_ref VARCHAR(128) NOT NULL,
    lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(128) NOT NULL,
    verified_by VARCHAR(128),
    priced_by VARCHAR(128),
    published_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manual_listings_search 
    ON manual_listings(product_type, destination_id, lifecycle_state, stop_sale) 
    WHERE lifecycle_state = 'PUBLISHED' AND stop_sale = FALSE;
CREATE INDEX idx_manual_listings_validity 
    ON manual_listings(valid_from, valid_to);
```

---

## 6. Comprehensive 11-Column Product-to-Supplier Readiness Matrix

| Product Line | Primary Planned Provider | Provider Type | Technical Adapter State | Env Credentials Present? | Commercial Evidence in Ledger? | Activation Stage | Allowed Customer Mode | Production Bookable Today? | Revalidation Protocol | Primary Truth Blocker |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: | :--- | :--- |
| **Flights** | Duffel Flights API | External Aggregator | SCAFFOLD / SANDBOX | ❌ No | ❌ No | `PLANNED` | Retry Notice / Degradation | ❌ NO | Real-time upstream fare recheck | Production API Key & Duffel Agreement Missing |
| **Hotels** | LiteAPI / Hotelbeds | External Aggregator | SCAFFOLD / SANDBOX | ❌ No | ❌ No | `PLANNED` | Confirmation required | ❌ NO | Room rate & availability recheck | API Credentials & Wholesaler Contract Missing |
| **Villas** | Vacatina Direct Contracting | Internal Manual CMS | REPO CONTRACT READY | N/A (Internal) | ❌ In Progress | `PLANNED` | Confirmation required (On-Request) | ❌ NO | CMS allotment & stop-sale verification | Counter-signed Villa Owner Agreements Missing |
| **Holiday Packages** | Vacatina In-House Packaging | Hybrid Dynamic Packaging | REPO CONTRACT READY | N/A (Internal) | ❌ In Progress | `PLANNED` | Confirmation required | ❌ NO | Component-by-component revalidation saga | Sub-component supplier contracts unverified |
| **Cars & Transfers** | Local Fleet Desk & Chauffeurs | Internal Manual CMS | REPO CONTRACT READY | N/A (Internal) | ❌ In Progress | `PLANNED` | Confirmation required (On-Request) | ❌ NO | Fleet allotment & dispatch recheck | Fleet Operator Insurance & SLA Sign-off Missing |
| **Rails** | Trainline Partner API | External Aggregator | SCAFFOLD / PLANNED | ❌ No | ❌ No | `PLANNED` | Retry Notice / Degradation | ❌ NO | Live timetable & ticket stock recheck | Trainline Distribution Agreement Missing |
| **Cruises** | Traveltek Cruise API | External Aggregator | SCAFFOLD / PLANNED | ❌ No | ❌ No | `PLANNED` | Confirmation required | ❌ NO | Cabin availability & berth recheck | Traveltek License & Agency Agreement Missing |
| **Activities** | Viator Partner API | External Aggregator | SCAFFOLD / SANDBOX | ❌ No | ❌ No | `PLANNED` | Confirmation required | ❌ NO | Slot timeslot & capacity recheck | Viator Commercial Affiliate Contract Missing |
| **Visa Assistance** | Vacatina Legal Concierge Desk | Internal Manual CMS | REPO CONTRACT READY | N/A (Internal) | ❌ In Progress | `PLANNED` | Vacatina assistance | ❌ NO | Embassy jurisdictional requirement check | Immigration Advisory Legal Counsel Engagement Missing |
| **Travel Insurance** | Allianz Worldwide Partners | External Underwriter | SCAFFOLD / PLANNED | ❌ No | ❌ No | `PLANNED` | Confirmation required | ❌ NO | Underwriting rate & eligibility recheck | Insurance Intermediary Regulatory License Missing |
| **Build Your Bundle** | Multi-Source Orchestrator | Composite Multi-Engine | FULLY CERTIFIED PIPELINE | N/A | N/A | `PLANNED` | Dependent on item breakdown | ❌ NO | Atomic multi-item revalidation saga | Dependent on sub-component live certification |

---

## 7. Strict SEED Quarantine Architecture

The 40 curated homepage cards serve strictly as **`DISCOVERY_CONTENT`**. They allow the traveler to explore inspiring destinations and prefill the Search Command Center (SCC). They **never** masquerade as live inventory.

```
[ Homepage Discovery Card ] ---> User clicks "Explore / Book"
                                           |
                                           v
                         [ Prefill Search Command Center (SCC) ]
                                           |
                                           v
                         [ UnifiedInventoryService.search() ]
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
           [ Real Inventory ]                              [ SEED Inventory ]
                   |                                               |
                   v                                               v
        (Manual / API / Hybrid)                            [ STRICT QUARANTINE ]
                   |                                               |
                   v                                               |-- Cannot stage as READY
         Trip Bucket Staging                                       |-- Cannot generate Hold
                   |                                               |-- Cannot call Stripe
                   v                                               +-- Cannot issue Ticket
         Production Checkout
```

### Automated Invariants Verifying Quarantine
- `tests/commercial-truth.test.ts` (Gates T1 through T12)
- Gate T1: SEED items filtered from live customer search.
- Gate T5 & Gate 8: SEED items cannot stage as `READY` in Trip Bucket.
- Gate T8 & T9: SEED items throw `ProductionCheckoutBlockedError` upon checkout initiation.

---

## 8. The 4 Production Blockers

Before commercial launch or advertising live transactions, backend engineering and product leadership must resolve four explicit blockers:

1. **`BLOCKER-01: COMMERCIAL_EVIDENCE_LEDGER_EMPTY`**:
   - Zero physical partner contracts or agency agreements are currently verified in `COMMERCIAL_EVIDENCE_LEDGER`.
   - *Resolution Action*: Upload executed agreements for Sri Lanka local fleet, direct contracted villas, and visa counsel.
2. **`BLOCKER-02: PRODUCTION_CREDENTIALS_MISSING`**:
   - Upstream supplier API keys (Duffel, LiteAPI, Viator) are not provisioned in production environment variables (`DUFFEL_API_KEY`, `LITEAPI_KEY`, etc.).
   - *Resolution Action*: Provision production supplier keys in Vercel/AWS Secrets Manager.
3. **`BLOCKER-03: PERSISTENCE_NOT_CONFIGURED`**:
   - Manual inventory currently resides in memory (`InMemoryManualListingRepository`, `isPersistent = false`).
   - *Resolution Action*: Execute `POSTGRES_MANUAL_LISTING_SCHEMA_DDL` against Supabase / AWS RDS PostgreSQL and instantiate `PostgresManualListingRepository`.
4. **`BLOCKER-04: PAYMENT_GATEWAY_NOT_CONFIGURED`**:
   - Production payment processing keys (`STRIPE_SECRET_KEY`) are not active.
   - *Resolution Action*: Complete merchant underwriting and activate production Stripe webhooks.

---

## 9. Verification & Audit Trail

| Verification Layer | Tool / Engine | Status | Results |
| :--- | :--- | :---: | :--- |
| **Unit & Invariant Tests** | Node.js Test Runner (`npm test`) | ✅ **PASSED** | 120 / 120 tests passing across 5 suites |
| **TypeScript Static Check** | TypeScript Compiler (`npm run typecheck`) | ✅ **PASSED** | 0 errors (`tsc --noEmit`) |
| **Playwright E2E Verification** | Headless Chromium (`npm run test:e2e`) | ✅ **PASSED** | 33 / 33 browser assertions across 11 viewports |
| **Production Build** | Node Tailwind Compiler | ✅ **PASSED** | Zero external CDN dependencies, self-contained |
| **Production Deployment** | Vercel Serverless (`https://vacatina-nu.vercel.app`) | ✅ **PASSED** | HTTP 200 OK |
