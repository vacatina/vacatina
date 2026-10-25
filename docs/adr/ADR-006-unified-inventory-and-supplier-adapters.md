# ADR-006: Unified Inventory Normalization, Supplier Adapters & Precedence Engine

## Status
**ACCEPTED** (2026-10-25)

## Context
Vacatina operates a hybrid commercial travel platform combining dynamic Global Distribution System (GDS) and supplier REST APIs with manually managed direct-contract boutique hotels, charters, chauffeur transport, consular visa advisory, and curated packages.

A core defect in prior travel systems is allowing raw upstream supplier models (e.g. Duffel, Amadeus, LiteAPI, Hotelbeds) or internal administrative CMS models to bleed into client-facing search results, Trip Bucket composition, and checkout flows. This creates multiple fragmented UI patterns, unpredictable pricing calculations, and broken booking lifecycles when third-party APIs experience outages.

Furthermore, clear rules were required to govern:
1. Canonical 4-source taxonomy (`API`, `MANUAL`, `HYBRID`, `SEED`).
2. Deduplication and ranking when both API and Manual offers exist for the same travel product.
3. 4-layer pricing precedence using integer minor currency units.
4. Product-by-product cache TTLs.
5. Circuit-breaker fault tolerance without presenting fabricated live inventory.

## Decision
1. **Four Canonical Source Types**:
   - `API`: Live third-party supplier integration with mandatory revalidation.
   - `MANUAL`: Curated Vacatina direct contracts and concierge services governed via `/admin/*`.
   - `HYBRID`: Composite multi-component packages uniting API and manual components.
   - `SEED`: Prototype and design test fixtures strictly forbidden from production checkout.

2. **Universal Normalization Contract (`CanonicalOfferEntity`)**:
   - All inventory sources must normalize into the single `CanonicalOfferEntity` before reaching search results, product details, or the Trip Bucket.
   - The frontend never receives raw supplier response structures or provider-specific flags.

3. **Typed Supplier Adapter Architecture (`ISupplierAdapter`)**:
   - Every provider integration extends `BaseSupplierAdapter` implementing concrete methods:
     `search()`, `revalidate()`, `hold()`, `confirm()`, `cancel()`, `refund()`.
   - Adapters cleanly segregate Sandbox vs Production credentials and target URLs via environment configuration.

4. **Composite Key Deduplication & Tie-Breaking**:
   - Upstream duplicates are consolidated using composite natural keys.
   - Tie-breaking rules prioritize `pinAboveApi` direct contracts and "Best Price Wins" with explicit `"Exclusive Direct Deal"` customer badges.

5. **4-Layer Pricing Precedence**:
   - Layer 1: Raw Net Supplier Cost in minor units.
   - Layer 2: Platform B2C Margin.
   - Layer 3: B2B Agency Tier Adjustment.
   - Layer 4: Admin Manual Override (with mandatory audit log reason).

6. **Fault-Tolerant Circuit Breakers & Truthful Degradation**:
   - Supplier connections implement Closed/Open/Half-Open state transitions.
   - On provider outage, search gracefully falls back to direct-contract manual inventory and cached on-request items with zero fabricated live claims.

## Consequences
### Positive
- **Provider Agnostic UI**: The frontend maintains a single, unified search, detail, Trip Bucket, and booking interface regardless of whether an offer is API, Manual, or Hybrid.
- **Commercial Flexibility**: Vacatina administrators can promote high-margin direct contracts, override supplier rates, and curate exclusive packages.
- **Financial Integrity**: Integer minor currency math prevents floating-point discrepancies across multi-currency transactions.
- **Operational Resilience**: Circuit breakers and cached fallbacks prevent supplier API outages from crashing the platform.

### Negative
- Requires maintaining normalization mappings and integration test fixtures for each integrated provider adapter.
- Demands continuous monitoring of upstream supplier API version deprecations and rate-limit quotas.

## References
- `docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md`
- `docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md`
- `docs/adr/ADR-001-application-runtime.md` through `ADR-005`
