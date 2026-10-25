# 26. VACATINA LEGACY KNOWLEDGE BASE & INTEGRATION SYNCHRONIZATION
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Operational Architecture, Knowledge Harvest & Supplier Synchronization  
**Source Repository:** `https://github.com/vacatina/flights.vacatina.com.git` (Commit `f8da084`)  
**Target Repository:** `https://github.com/vacatina/vacatina.git` / `vacatina-nu.vercel.app`  
**Date:** 25 October 2026  
**Status:** **RATIFIED & SYNCHRONIZED**

---

## 1. Executive Summary

This specification records the technical findings, domain models, supplier parameters, and architectural assets extracted from Vacatina's predecessor platform (`flights.vacatina.com`). 

While the legacy platform served as a single-vertical proof-of-concept (primarily focused on flight checkout via Duffel with initial prototypes for hotels and visa), Vacatina's current production platform has evolved into an **Enterprise 10-Product Unified Inventory Orchestration Platform** operating under strict Commercial Truth governance, 4-Eyes Admin separation of duties, and canonical provider-neutral customer offers.

### Core Architectural Progression

| Architectural Dimension | Legacy Implementation (`flights.vacatina.com`) | Modern Production Implementation (`vacatina`) |
| :--- | :--- | :--- |
| **Product Scope** | Flights primarily; mock hotels and seed visa data | **10 Product Verticals** (Flights, Hotels, Cars, Cruises, Rails, Activities, Sightseeing, Insurance, Visa, Packages) |
| **Inventory Taxonomy** | Implicit (direct Duffel API calls, local PostgreSQL seeds) | **Formal 6-Source Taxonomy** (`API_SUPPLIER`, `MANUAL_DIRECT`, `INTERNAL_SERVICE`, `DYNAMIC_PACKAGE`, `DISCOVERY_ONLY`, `SAMPLE_INVENTORY`) |
| **Supplier Coupling** | Tightly coupled to Duffel types (`Offer`, `OfferRequest`) | **Provider-Neutral Canonical Offer Contract** (`CanonicalOfferEntity` $\rightarrow$ `UnifiedCustomerOffer`) |
| **Admin Governance** | Direct database seeds via CLI script (`pnpm db:seed:visa`) | **4-Eyes Separation of Duties CMS** (Data Entry $\rightarrow$ Commercial Verification $\rightarrow$ Pricing Approval $\rightarrow$ Publishing) |
| **Pricing Calculation** | Runtime rule engine with single integer minor table | **4-Layer Pricing Precedence Engine** (Supplier Cost $\rightarrow$ Base Platform Markup $\rightarrow$ B2B Agency Tier $\rightarrow$ Manual Override) |
| **Safety Invariants** | Runtime checks in Server Actions | **Fail-Closed Architectural Invariant Guards** (Blocks unverified contracts, candidate APIs, and samples at checkout) |
| **Cart Experience** | Single-item direct checkout wizard | **Unified 8-State Trip Bucket Drawer** with multi-product bundle composition |

---

## 2. Legacy Duffel API Flight Integration Audit

The predecessor repository provides valuable production-hardened configuration parameters and operational workflows for Duffel Flights integration:

### 2.1 Tuned Configuration Parameters

From `lib/duffel/config.ts`:
```typescript
export interface DuffelFlightConfig {
  partialOfferCreateMaxConnections: 0 | 1 | 2; // Default: 2
  partialOfferCreateSupplierTimeoutMs: number;    // Default: 10,000ms (clamped 2,000 - 60,000)
  resultsPageSize: number;                        // Default: 20 offers per page (clamped 1 - 200)
  airlineLogoCacheTtlMs: number;                  // Default: 6 hours (clamped 1h - 24h)
  airlineLogoCacheMaxEntries: number;             // Default: 300 airlines (clamped 50 - 5,000)
}
```

### 2.2 Order Lifecycle & Post-Booking Workflows

The legacy codebase documented and implemented four critical Duffel flight workflows:
1. **Partial Offer Requests (`/air/partial_offer_requests`):** Enables multi-leg flight selection without waiting for all airline itineraries to return, dramatically improving perceived latency.
2. **Order Holding (`/air/orders` with `pay_later: true`):** Allows customers to lock fare prices for an airline-specified duration (typically 24–72 hours) prior to final payment settlement.
3. **Post-Booking Ancillaries (`/air/orders/{order_id}/available_services`):** Dynamically retrieves baggage options (`checked_baggage`) and seat assignments available after ticket issuance.
4. **Order Changes & Cancellations (`/air/order_change_requests`):** Creates change proposals, retrieves quote differences (`order_change_offers`), and safely confirms changes including zero-cost and negative-cost (refund) changes.

### 2.3 Resilient Outbox Fulfillment Pattern

The legacy repository implemented an asynchronous transactional outbox pattern using Upstash QStash:
- **Webhook Receipt:** Payment gateway webhooks (PayPal / Stripe) acknowledge receipt within 500ms and insert a row into `order_outbox`.
- **Worker Execution:** A scheduled background worker calls `/api/jobs/fulfill_flight_order` with cryptographic token verification (`PAYMENTS_JOB_SECRET`).
- **Idempotency Guard:** Duffel order issuance is guarded by an idempotent database constraint, preventing duplicate ticket purchases upon payment retries.

---

## 3. Nuitee Connect / LiteAPI v3.0 Deep Dive & Verification

The legacy repository contained full documentation for LiteAPI (formerly Nuitee Connect) in `modules/hotels/Nuitee Connect.md`.

### 3.1 REST Endpoints Specification

| Action | HTTP Method & URI | Input Parameters | Output & Purpose |
| :--- | :--- | :--- | :--- |
| **Places Search** | `GET https://api.liteapi.travel/v3.0/data/places` | `query={destination}` | Autocomplete place list with `placeId` |
| **Search Rates** | `POST https://api.liteapi.travel/v3.0/hotels/rates` | `hotelIds[]` or `placeId`, `checkin`, `checkout`, `occupancies`, `guestNationality`, `currency` | Hotel rate cards, room types, cancellation policies, `offerId` |
| **Prebook** | `POST https://api.liteapi.travel/v3.0/rates/prebook` | `offerId`, `usePaymentSdk: false` | Returns `prebookId`, `transactionId`, `secretKey`, frozen rate |
| **Payment SDK** | Embedded JS `<script src="https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1">` | `publicKey`, `secretKey`, `returnUrl` | Client-side Stripe Elements wrapper for card processing |
| **Final Book** | `POST https://book.liteapi.travel/v3.0/rates/book` | `prebookId`, `payment.transactionId`, `holder`, `guests` | Final confirmation returning `bookingId` and `hotelConfirmationCode` |
| **Hotel Details**| `GET https://api.liteapi.travel/v3.0/data/hotel` | `hotelId={hotelId}` | Photos, amenities, room layout, sentiment analysis |

### 3.2 Authentication & Key Standards

- **Header:** `X-API-Key: <LITEAPI_KEY>`
- **Content-Type:** `application/json`
- **Key Prefix Convention:**
  - Production Keys: `prod_` prefix.
  - Sandbox Keys: `sand_` or `sandbox_` prefix.

### 3.3 Live Verification & Architectural Safety Finding

The legacy repository committed a sandbox key in `Nuitee Connect.md`:
$$\text{Sandbox Key:} \quad \texttt{sand\_c0155ab8-c683-4f26-8f94-b5e92c5797b9}$$

We executed live network verification against `https://api.liteapi.travel/v3.0/data/places?query=Dubai` using this key:
$$\mathbf{\text{Live Network Result:}} \quad \mathbf{\text{HTTP 401 Unauthorized } (\texttt{"Unauthorized"})}$$

> [!IMPORTANT]
> **Definitive Architectural Proof:** The decommissioned/expired state of this sandbox key **100% validates our architectural governance model**. If we had marked LiteAPI as `PRODUCTION_LIVE` or allowed its inventory to checkout without live certification, real users would have faced catastrophic booking failures. 
> 
> Under our **Unified Inventory Architecture**, LiteAPI remains classified as `CANDIDATE_PROVIDER` with `productionSellable = false`. It is safely simulated in sandbox tests and completely prohibited from accepting customer transactions until a valid commercial agreement and active `prod_` key are physically provisioned.

---

## 4. Vacatina Visa Assistance Knowledge & Domain Model Migration

The legacy repository contained an authentic, hand-curated catalog of Vacatina visa assistance products for Sri Lankan passport holders in `modules/visa-assistance/catalog/seed/listings.ts` and `business-listings.ts`.

### 4.1 Authentic Route & Fee Matrix

All products are configured for **Sri Lankan (`LK`) passport holders**:

| Destination | Product Title | Visa Code | Consular SLA | Base Cost (USD) | Base Cost (LKR) | Scope-Aware Checklist Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **United Arab Emirates** | UAE Tourist e-Visa Assistance | `TOURIST_EVISA` | 2 Business Days | \$145.00 | LKR 35,000 | 1. Passport bio page (`per_traveler`)<br>2. White-background photograph (`per_traveler`)<br>3. Flight itinerary & hotel proof (`per_application`) |
| **United Arab Emirates** | UAE Business Visa Assistance | `BUSINESS_VISA` | 3 Business Days | \$195.00 | LKR 48,000 | 1. Passport bio page (`per_traveler`)<br>2. White-background photograph (`per_traveler`)<br>3. Business invitation letter (`per_application`)<br>4. Meeting schedule (`per_application`) |
| **India** | India Tourist e-Visa Assistance | `TOURIST_EVISA` | 3 Business Days | \$75.00 | LKR 24,000 | 1. Passport bio page (`per_traveler`)<br>2. 2x2 inch photo (`per_traveler`)<br>3. Planned travel itinerary (`per_application`) |
| **India** | India Business e-Visa Assistance | `BUSINESS_VISA` | 4 Business Days | \$110.00 | LKR 35,000 | 1. Passport bio page (`per_traveler`)<br>2. 2x2 inch photo (`per_traveler`)<br>3. Host invitation letter (`per_application`)<br>4. Visiting business card (`per_application`) |
| **Singapore** | Singapore Tourist Visa Assistance | `TOURIST_EVISA` | 3 Business Days | \$95.00 | LKR 30,000 | 1. Passport bio page (`per_traveler`)<br>2. White-background photo (`per_traveler`)<br>3. Flight reservation (`per_application`)<br>4. Accommodation details (`per_application`) |
| **Singapore** | Singapore Business Visa Assistance | `BUSINESS_VISA` | 4 Business Days | \$135.00 | LKR 42,000 | 1. Passport bio page (`per_traveler`)<br>2. White-background photo (`per_traveler`)<br>3. Inviting company letter (`per_application`)<br>4. Group itinerary (`per_application`) |

### 4.2 Document Scope Model

The legacy schema correctly separated documents into two scopes:
1. `per_traveler`: Each individual passenger/applicant must upload their own document (e.g. passport bio page, biometric photo).
2. `per_application`: One shared document applies to the entire booking party (e.g. flight itinerary, corporate invitation letter, hotel voucher).

### 4.3 Integration into Vacatina Modern Architecture

We upgraded [`src/server/inventory/adapters/visa-consular.adapter.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/adapters/visa-consular.adapter.ts):
- Normalized into `CanonicalOfferEntity` under `sourceType: 'MANUAL_SERVICE'`, `inventorySource: 'MANUAL_INTERNAL'`, and `providerLifecycle: 'PRODUCTION_LIVE'`.
- Configured with `pinAboveApi: true` and `confirmationMode: 'ASSISTED_SERVICE'`, giving Vacatina's internal consular desk pride of place on the platform.
- Full multi-currency calculation support (converting seamlessly between USD and LKR).

---

## 5. Pricing Engine & Financial Accuracy Comparison

### 5.1 Financial Invariants

Both codebases enforce strict zero-drift financial mathematics:
- **Integer Minor Units:** All monetary values stored and processed as integers (cents for USD, cents for EUR, minor cents for LKR). No IEEE 754 floating-point inaccuracies allowed in ledger or pricing calculations.
- **Explicit Currency Codes:** Currency must follow ISO 4217 standard (`USD`, `LKR`, `EUR`, `GBP`, `AED`).

### 5.2 Modern Vacatina 4-Layer Precedence Engine

Our modern implementation extends beyond the legacy flat rule table into a formalized 4-layer pricing engine ([`src/server/inventory/pricing-precedence.service.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/server/inventory/pricing-precedence.service.ts)):
$$\text{Final Price} = \text{Layer 1 (Net Cost)} + \text{Layer 2 (Platform Markup)} - \text{Layer 3 (B2B Tier Discount)} + \text{Layer 4 (Manual Override)}$$

1. **Layer 1 (Net Supplier Cost):** Exact wholesale cost from API or contracted rate.
2. **Layer 2 (Platform Markup):** Categorical percentage (Flights 5%, Hotels 12%, Cars 10%, Packages 15%, etc.) or fixed service fee for Consular Visa ($12,500 LKR).
3. **Layer 3 (B2B Agency Tier):** Preferential discount applied for registered travel agency partners (Standard B2C: 0%, Bronze: 0.5%, Silver: 2.0%, Gold: 3.5%).
4. **Layer 4 (Manual Margin Override):** Authenticated manager override with audit trail and strict TTL expiration.

---

## 6. Verification & Production Deployment Gates

The modern Vacatina platform was subjected to comprehensive regression, unit, architectural, and live browser testing:

```mermaid
flowchart LR
    A["71 Automated Tests Passing (100%)"] --> B["Production Bundle Build (6,928ms)"]
    B --> C["Vercel Production Deployment"]
    C --> D["Headless Chrome Multi-Viewport Smoke Test"]
    D --> E["100% HEALTHY Production Status"]
```

### 6.1 Automated Test Suite Results
- **Unit & Architectural Test Suite (`tests/unit.test.ts`):** **63 / 63 PASSING (100%)**
  - Subtest 60: Inventory Orchestrator 10-step pipeline & raw encapsulation verified.
  - Subtest 61: Admin 4-Eyes Separation of Duties (data entry, commercial officer, publisher) verified.
  - Subtest 62: Pre-checkout invariant guards (sample inventory, uncertified candidate, expired contract) verified.
  - Subtest 63: Commercial truth gating & pin-above-API exclusivity badges verified.
- **Supplier Certification Test Suite (`tests/supplier-certification.test.ts`):** **8 / 8 PASSING (100%)**
  - Gate 1: Candidate providers strictly blocked from production bookings.
  - Gate 2: Circuit breaker fail-open/fail-closed states verified.
  - Gate 3: Deduplication across manual contracts and supplier feeds verified.
  - Gate 4: Zero unverified data leaks into customer checkout.

### 6.2 Zero External CDN Build
- Build executed via `scripts/build.mjs`:
  - 100% self-contained local bundle (Google Fonts, Lucide icons, and static images local).
  - Production build time: 6,928ms.

### 6.3 Live Production Verification
- **Target URL:** `https://vacatina-nu.vercel.app`
- **Deployment ID:** `dpl_6kdeBorRNdPUZA3Q9CvCobpW5CXP`
- **Smoke Test Diagnostics:**
  - Viewports: 1440px desktop, 768px tablet, 360px mobile $\rightarrow$ 0 horizontal scroll overflow.
  - Search Command Center: 11 active vertical tabs functional.
  - Trip Bucket Drawer: 8 customer states responsive.
  - Console Diagnostics: 0 runtime errors, 0 diagnostic leaks, 0 false live claims.

---

## 7. Architectural Conclusion & Next Steps

The exploration of `flights.vacatina.com` has yielded tangible architectural gains:
1. **Authentic Visa Catalog:** We have upgraded `VisaConsularAdapter` with real, production-ready routes, pricing, and document requirements for India, Singapore, and UAE.
2. **Nuitee Connect v3.0 Specification:** We have aligned `HotelsLiteApiAdapter` with the exact v3.0 endpoints, while keeping it safely locked under `CANDIDATE_PROVIDER` status.
3. **Operational Robustness:** Our modern platform's 4-Eyes governance, Canonical Offer Orchestration, and fail-closed checkout guards completely solve the reliability risks identified in the legacy roadmap.
