# OpenCode execution instruction — Vacatina Flights

You are in the **existing** `vacatina/vacatina` repository. Read `FLIGHTS_PRODUCT_EXECUTION_CONTRACT.md` in this handoff folder and inspect all bundled `stitch_reference/` HTML + screenshots + DESIGN.md. The references are **design concepts, not final approved code**.

**Owner priorities:** Currently deployed homepage remains LOCKED; build the entire **B2C Flights end-to-end premium UX** in-place (hub, search, results, details/fare rules, multi-city, fare/seat/bag configuration when supported, passengers, Trip Bucket, review, truth-gated checkout/confirmation, recovery, responsive mobile and motion). Existing APIs and typed domain contracts are to be reused. Do not fake supplier prices, operational bookings, payments, PNRs, a 15-minute hold or paid ancillaries.

**Procedure:**

1. Inspect current uncommitted changes and preserve them; confirm `release/b2c-product-journeys-v1` and existing live homepage baseline. Never change main/origin/main.
2. Audit existing Flight feature code (`src/features/flights/ui/flights-hub-view.ts`, `flights-search-view.ts`, `flights-offer-detail-modal.ts`, service/adapters and any later local changes) and product routes; read `FLIGHTS_PRODUCT_EXECUTION_CONTRACT.md` fully.
3. Use Stitch ZIP layouts as inspiration, but inspect actual state of every handler. B2B samples are NOT public B2C screens. Treat unsupported real-time/finance/confirmed claims in samples as non-production inspiration only.
4. Produce a brief source-vs-target gap list, then **implement all reasonable frontend UX work in the existing application in this same workflow**. Work in coherent steps; do not stop after writing design docs or generic placeholders.
5. Add true loading/empty/unavailable/error/retry states, UI animations and responsive layouts; verify accessible interaction. For supplier-dependent experiences, feature-gate based on actual provider capabilities, never simulate success.
6. Do not touch locked homepage except smallest necessary tested integration fix explicitly documented; keep approved typography and 11 SCC tabs intact.
7. Run all relevant typecheck, test, build and browser screenshot regression. Check 1440/768/390/360 widths and deep-link/refresh/back/navigation; validate no B2B data leaks. Create candidate build on existing Vercel project for owner visual review; preserve rollback. No production promotion without release approval.
8. Report code changes, routes/screens completed, what is genuinely functional vs integration-blocked, screenshot evidence, test status and candidate deployment URL.

**Execution rule:** UI/UX means the complete journey, not a static page. Do not deliver generic/partial screens or claim 100% completion with missing supplier/backend dependencies. Proceed without repeatedly requesting previously provided references.
