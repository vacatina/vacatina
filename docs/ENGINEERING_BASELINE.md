# Vacatina Engineering Baseline — Server-Backed Customer Architecture

**Status:** Local stabilization baseline accepted for continued product work  
**Date:** 27 October 2026  
**Checkpoint tag:** `stabilization-server-backed-v1`  
**Scope:** Phase 4 engineering baseline only. No production deployment, supplier credential activation, database migration or new product work.

---

## 1. Verified baseline

| Check | Command | Verified result |
| :--- | :--- | :--- |
| TypeScript | `npm run typecheck` | **0 errors** |
| Automated tests, run 1 | `npm test` | **233 / 233 pass**, 24 suites, 0 failures |
| Automated tests, run 2 | `npm test` | **233 / 233 pass**, 24 suites, 0 failures |
| Production build | `npm run build` | **PASS** |
| Browser/server isolation | build-output scan | **0 runtime `src/server/*` edges** and **0 Node built-ins** in the browser bundle |

These counts supersede every older test total in the numbered architecture and audit documents. Test totals in historical snapshots are not current verification evidence.

---

## 2. What is active locally

- The browser and `/api/v1/*` are served from the same loopback origin by `npm run dev`.
- The normalized API router, guest session/CSRF handling, Clerk JWT verification, local runtime-state persistence and booking/payment foundations are active locally.
- Booking preparation remains unpaid. Fulfillment is gated on captured payment and supplier confirmation.
- Partial fulfillment failures route to manual triage; they do not produce confirmed supplier references.
- The browser build is isolated from `src/server/*`. Server code is not bundled into the static customer application.

## 3. Production boundary

The following remain **pending explicit approval** and were not performed in Phase 4:

- Production backend deployment or Vercel API routing.
- Execution or approval of `src/server/db/migrations/002_operational_runtime_state.sql`.
- Activation or production verification of real supplier credentials (Duffel, Amadeus, LiteAPI, or others).
- Remote database provisioning, production payment capture, live booking issuance, or a push to the production branch.

Local verification is not evidence of production supplier certification. Adapter scaffolds remain candidates until commercial agreements, credentials and certification gates are completed.

## 4. Canonical model decisions

### Inventory source taxonomy

- `CanonicalInventorySourceType` in `src/server/inventory/types.ts` is the **authoritative** taxonomy for persisted inventory records, Commercial Truth Gate checks and supplier certification.
- `CanonicalOfferSourceType` in `src/server/inventory/domain/canonical-offer.ts` is the consumer-offer provenance union used by `UnifiedCanonicalOffer` and adapter search results. It is deliberately a separate name so imports cannot be confused.
- Supplier adapters must use `CanonicalInventorySourceType` when recording inventory/commercial classification, and `CanonicalOfferSourceType` only for the consumer offer contract.

### Booking modes

- `BookingMode` is `INSTANT_BOOK | REQUEST_TO_BOOK | REQUEST_AVAILABILITY | INQUIRY_ONLY`.
- `CanonicalRateOption.bookingMode` is `INSTANT_BOOK | ALLOTMENT_HOLD | ON_REQUEST_CONCIERGE`.
- `INSTANT_CONFIRMATION` is not a valid booking mode. Deduplication maps request/availability/inquiry offers to `ON_REQUEST_CONCIERGE`, never to instant confirmation.

### Administrative actors

- `AdminActor.role` uses the canonical `UserRole` union from `src/server/db/schema.ts`.
- `AdminActor` role is audit metadata in the manual-listing repository; it is not an authorization decision. Narrowing the type does not broaden permissions, and no role-check behavior was added.

### Manual flight listings

- Manual listing rows do not contain live carrier, flight-number, timing or baggage fields.
- Offers derived from those rows are `request_to_book` with `availabilityStatus: 'ON_REQUEST'` and `scheduleStatus: 'PENDING_OPERATOR_CONFIRMATION'`.
- Synthetic airline codes, flight numbers, durations and baggage allowances were removed. The desk must confirm schedule, carrier and baggage before ticketing.

## 5. Generated artifacts and version control

`dist/`, `dist-site/` and `.vercel/` are generated outputs. They are ignored by `.gitignore` and are not version-controlled:

- Do **not** commit `dist/`, `dist-site/` or `.vercel/output/static`.
- Regenerate them from source with `npm run build`.
- Deployment remains a CI/release action, not an artifact commit.

## 6. Documentation status

- This document is authoritative for the Phase 4 verification counts and release boundary.
- `docs/29_VACATINA_UNIFIED_INVENTORY_SUPPLIER_AND_ROUTING_MASTER_SPECIFICATION.md` and `docs/architecture/inventory-source-architecture-master-handoff.md` carry a current-baseline amendment.
- `docs/architecture/30_vacatina_hybrid_inventory_master_architecture_lock.md` carries a superseded-status note because it previously claimed production deployment.
- Numbered audits and architecture handoffs remain historical records. Their old totals (74/74, 108/108, 120/120, 135/135, 169/169, 177/177, 205 assertions, etc.) describe their original snapshots and must not be cited as current verification.

## 7. Remaining architecture debt

Deliberately deferred beyond Phase 4:

1. Multiple offer/status models still coexist: `CanonicalOfferEntity`, `UnifiedCanonicalOffer` and `UnifiedCustomerOffer`, with overlapping availability/lifecycle unions.
2. `CanonicalRateOption.bookingMode` has no explicit inquiry-only state; the conservative mapping to `ON_REQUEST_CONCIERGE` must be revisited if a canonical rate-mode contract is introduced.
3. The manual-listing model still lacks structured flight schedule, carrier and baggage fields; manual-flight offers remain request-to-book until those fields and operator verification exist.
4. PostgreSQL manual-listing/CMS persistence and the operational runtime migration remain approval-gated.
5. Supplier adapters remain scaffolds until commercial agreements, credentials and live certification are approved.
6. Production backend deployment and the shared production HTTP boundary remain unapproved.
