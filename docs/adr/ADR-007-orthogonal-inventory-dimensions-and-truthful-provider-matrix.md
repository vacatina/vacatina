# ADR-007: Orthogonal 7-Dimension Canonical Inventory Taxonomy, Provider Candidate Tracking & Truthful Disclosure Safeguards

**Status**: APPROVED  
**Date**: 2026-10-25  
**Deciders**: Vacatina Chief Architect, Travel Platform Operations, Backend Integration Lead  
**Cross-References**: ADR-006, `docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md`, `docs/13_SUPPLIER_INTEGRATION_READINESS_MATRIX.md`, `docs/14_CANONICAL_INVENTORY_TAXONOMY_AND_ADMIN_CMS_SCHEMA.md`

---

## 1. Context & Architectural Problem

Previously, the unified inventory layer attempted to compress multiple distinct business and architectural aspects into a single 6-value `sourceType` enum (`API`, `DIRECT_CONTRACT`, `MANUAL_SERVICE`, `CURATED_PACKAGE`, `HYBRID`, `SEED`).

As identified in technical reviews, conflating these concepts into a single flat field created architectural coupling across completely orthogonal dimensions:
1. **Source Channel**: Where did the data originate? (API vs Direct Contract vs Internal Manual Workflow)
2. **Listing Archetype / Kind**: What is the purpose of the item? (Physical Inventory vs Service vs Package vs Discovery Content)
3. **Product Composition**: How is the product constructed? (Single standalone item vs Fixed curated package vs Dynamic hybrid bundle)
4. **Fulfillment Mode**: How is the order fulfilled operationally? (Instant electronic issuance vs On Request allotment vs Manual document review)
5. **Environment / Isolation**: What tier does this data belong to? (Production live vs Sandbox test vs Prototype SEED demo)
6. **Sellability / Transactability**: Can a user buy this right now? (Discovery Only vs Quote Only vs Bookable)
7. **Provider Integration Lifecycle**: What is the supplier's engineering readiness? (Planned vs Scaffold vs Sandbox Active vs Certified vs Production Live)

Furthermore, claiming "production supplier integrations complete" when commercial agreements, production API credentials, and certification tests have not been executed is technically inaccurate. Upstream suppliers (e.g. Amadeus, Duffel, LiteAPI, Viator, Rentalcars, Traveltek, Trainline, Allianz) must be truthfully classified as `TARGET` or `CANDIDATE` providers, and the system described as **"Production-ready supplier integration architecture"**.

---

## 2. Decision

### (A) The 7 Orthogonal Canonical Inventory Dimensions

We decompose the inventory model into seven strictly separated, typed dimensions across all offers:

```ts
// 1. Source Origin
export type InventorySource =
  | 'API'
  | 'DIRECT_CONTRACT'
  | 'MANUAL_INTERNAL'
  | 'PARTNER_MANUAL';

// 2. Listing Archetype
export type ListingKind =
  | 'DISCOVERY_CONTENT'
  | 'SELLABLE_INVENTORY'
  | 'SERVICE'
  | 'PACKAGE';

// 3. Product Composition
export type CompositionType =
  | 'SINGLE'
  | 'CURATED_PACKAGE'
  | 'DYNAMIC_BUNDLE';

// 4. Fulfillment Mode
export type FulfillmentMode =
  | 'INSTANT'
  | 'ON_REQUEST'
  | 'MANUAL_CONFIRMATION';

// 5. Environment Class
export type EnvironmentClass =
  | 'PRODUCTION'
  | 'SANDBOX'
  | 'SEED';

// 6. Sellability
export type Sellability =
  | 'DISCOVERY_ONLY'
  | 'QUOTE_ONLY'
  | 'BOOKABLE';

// 7. Provider Lifecycle (Tracked PER PROVIDER)
export type ProviderLifecycle =
  | 'PLANNED'
  | 'SCAFFOLD'
  | 'SANDBOX_ACTIVE'
  | 'CERTIFIED'
  | 'PRODUCTION_LIVE';
```

### (B) Heterogeneous Dynamic Bundles (Rule 9)
When an offer has `compositionType: 'DYNAMIC_BUNDLE'`, the parent offer coordinates the bundle while each sub-component retains its own source identity, fulfillment mechanism, and revalidation rules in `offer.components`:
- **Flight Component**: `inventorySource: 'API'`, `fulfillmentMode: 'INSTANT'`, `revalidationRequired: true`
- **Hotel Component**: `inventorySource: 'DIRECT_CONTRACT'`, `fulfillmentMode: 'INSTANT'`, `revalidationRequired: false`
- **Visa Component**: `inventorySource: 'MANUAL_INTERNAL'`, `listingKind: 'SERVICE'`, `fulfillmentMode: 'MANUAL_CONFIRMATION'`, `revalidationRequired: false`

### (C) Customer-Facing Badges vs Technical Privacy (Rules 2 & 3)
Customer-facing UI **NEVER** displays internal technical terms (`API`, `DIRECT_CONTRACT`, `MANUAL_INTERNAL`, `SCAFFOLD`, `SANDBOX`, `SEED`).
Instead, customer UI derives strictly truthful operational and commercial badges:
- `Live Availability`: Strictly when live, fresh, and in production
- `Instant Confirmation`: When electronic issuance is instant
- `On Request`: When allotment release is required
- `Vacatina Assisted`: When operations concierge vets documents (Visa, Custom packages)
- `Direct Rate`: Directly contracted physical inventory
- `Exclusive Direct Deal`: Pinned administrative exclusive direct contract

### (D) Provider Registry & Candidate Tracking (Rules 10 & 11)
Provider readiness is tracked **per provider**, not merely per product:
- `AMADEUS_GDS`: Flight / Hotel GDS ➔ `TARGET` supplier, `PLANNED` lifecycle, commercial evaluation.
- `DUFFEL_NDC`: Flight NDC Gateway ➔ `CANDIDATE` supplier, `SCAFFOLD` lifecycle, sandbox simulated.
- `LITEAPI`: Hotel Bedbank Gateway ➔ `CANDIDATE` supplier, `SCAFFOLD` lifecycle, 30m TTL cache.
- `VIATOR`: Experiences Gateway ➔ `CANDIDATE` supplier, `SCAFFOLD` lifecycle, 4h TTL cache.
- `RENTALCARS`: Cars Gateway ➔ `TARGET` supplier, `SCAFFOLD` lifecycle.
- `TRAVELTEK`: Cruise GDS Gateway ➔ `TARGET` supplier, `SCAFFOLD` lifecycle, 12h TTL cache.
- `TRAINLINE`: Rail Gateway ➔ `CANDIDATE` supplier, `SCAFFOLD` lifecycle, 1h TTL cache.
- `ALLIANZ`: Insurance Underwriting ➔ `TARGET` supplier, `SCAFFOLD` lifecycle, 24h TTL cache.
- `VACATINA_CONSULAR_CONCIERGE`: Consular Vetting ➔ `INTERNAL_SERVICE`, `PRODUCTION_LIVE`.
- `PAYLOAD_CMS_DIRECT`: Direct Contract Desk ➔ `INTERNAL_PLATFORM`, `PRODUCTION_LIVE`.
- `VACATINA_HYBRID_BUNDLER`: Dynamic Bundler ➔ `INTERNAL_PLATFORM`, `SANDBOX_ACTIVE`.

### (E) Strict Invariant Safeguards (Rule 14)
The following programmatic invariant guards are compiled into `src/server/inventory/types.ts`:
1. `SEED` data cannot have `sellability = 'BOOKABLE'` (throws `SEED_CANNOT_BE_BOOKABLE`).
2. `SEED` data cannot enter checkout or payment (throws `SEED_CHECKOUT_BLOCKED`).
3. `SCAFFOLD` providers cannot execute production bookings (throws `SCAFFOLD_PRODUCTION_BOOKING_BLOCKED`).
4. Only `PRODUCTION_LIVE` providers can execute live bookings.
5. Manual / Direct contract offers require `status: 'PUBLISHED'` to be bookable.
6. `SOLD_OUT` or `RATE_EXPIRED` items cannot transition to Trip Bucket `READY` state.
7. Customer UI badge validator statically confirms 0 technical taxonomy leakage.

---

## 3. Consequences

### Positive
- **Architectural Purity**: Clean separation between source channel, product type, packaging, fulfillment, environment, and transactability.
- **Backend Defense**: Any audit by backend or supplier partners immediately verifies that Vacatina does not falsely claim active production credentials for candidate suppliers.
- **Dynamic Packaging**: Supports multi-product hybrid itineraries where flights are API, hotels are direct contracts, and visas are internal manual workflows without type confusion.
- **Zero Customer Leakage**: End users only see clear, reassuring commercial statuses (`Instant Confirmation`, `Vacatina Assisted`, `Direct Rate`).

### Negative / Mitigation
- Requires mapping 7 dimensions across all 10 product adapters.
- **Mitigation**: Base adapter and helper normalizers enforce sane defaults and provide backward compatibility aliases for `sourceType`.
