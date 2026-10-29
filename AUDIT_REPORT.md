# Vacatina — Existing 64-Page Frontend Audit Report

**Date:** 29 Oct 2026 · **Branch:** `release/b2c-product-journeys-v1` · **Mode:** Read-only audit (no structural changes made)

## 1. Git / Workspace State
- Uncommitted changes present (must be preserved): `docs/phase18-evidence/browser-baseline.json`, `opencode.json`, `scripts/browser-verify.mjs`, `scripts/build.mjs`, `src/features/enquiries/enquiry-workspace.ts`, `src/features/flights/domain/search-models.ts`, `src/features/flights/services/flight-search.service.ts`, `src/features/flights/ui/flights-checkout.ts`, `flights-hub-view.ts`, `flights-offer-detail-modal.ts`, `flights-search-view.ts`, `flights-trip-review.ts`, `src/features/trip-review/trip-review-workspace.ts`, `src/lib/services/router.service.ts`, `src/server/api/router.ts`, plus untracked `scripts/verify-*`, `stitch_download/`, `stitch_export/`.
- **Policy applied:** No overwrites, no duplicate screens, no Stitch modifications (Stitch is READ-ONLY).

## 2. Build & Test Baseline (verified)
- `npm run build` → **PASS** (115 modules, 0 external CDN deps, Tailwind 61,246 bytes, 3.8s).
- `npm run typecheck` not re-run here; build succeeded.
- Flights unit tests: `flights-flow.test.ts` + `flights-phase5-journey.test.ts` → **22/22 PASS**.
- Browser E2E (`scripts/browser-verify.mjs` against `http://127.0.0.1:4173`) → **109 PASS / 0 FAIL**, covering global keyboard (Tab/focus/named controls) across all product routes, Phase 17 SCC grids + Trip Bucket, Flights full UI/UX journeys (Trip Bucket + Direct Book) at 390px & 1440px, Flights New Routes (Passenger/Review/Checkout/Confirmation/Manage) at 360/768/1440, and B2B Flights Routes at 1440.

## 3. Existing Flights Page Inventory (local)
Implemented as views/modals inside the monolithic SPA router (`src/lib/services/router.service.ts`):

| # | Route / Surface | Implementation | File |
|---|---|---|---|
| 01 | Home (Flights entry) | Existing page | `src/app` shell |
| 02 | Flights Hub `/flights` | View | `flights-hub-view.ts` |
| 03 | Search Results `/flights/search` | View | `flights-search-view.ts` |
| 04 | Offer Details `/flights/offer/:id` | Modal | `flights-offer-detail-modal.ts` |
| 05 | Fare Family Selection | Step inside offer modal | `flights-offer-detail-modal.ts` |
| 06 | Baggage & Ancillaries | Step inside offer modal | `flights-offer-detail-modal.ts` |
| 07 | Seat Selection | Step inside offer modal | `flights-offer-detail-modal.ts` |
| 08 | Passenger Details | View | `flights-passenger-details.ts` |
| 09 | Contact & Travel Documents | Step (passenger view) | `flights-passenger-details.ts` |
| 10 | Trip Bucket | Shared drawer | `trip-bucket/trip-bucket-ui.ts` |
| 11 | Booking Review & Recheck | View | `flights-trip-review.ts` |
| 12 | Checkout & Payment | View | `flights-checkout.ts` |
| 13 | Payment Authorization | State within checkout | `flights-checkout.ts` |
| 14 | Confirmation / Ticketing | View | `flights-confirmation.ts` |
| 25 | Guest Booking Lookup | Modal (dossier) | router `handleManageBookingLookup` |
| 26 | My Trips / My Bookings | Modal | router `handleAccountRoute` |
| 27 | Flight Booking Details | Modal (dossier) | `flights-manage-booking.ts` |
| 28 | E-Ticket & References | Panel in dossier | `flights-manage-booking.ts` |
| 29 | Receipt / Invoice | Panel in dossier | `flights-manage-booking.ts` |
| 30 | Ticketing Pending / Hold | State in dossier | `flights-manage-booking.ts` |
| 31 | Travel Prep / Check-in | Panel in dossier | `flights-manage-booking.ts` |
| 34–37 | Change Flight (start/alternatives/quote/complete) | B2B/Manage views | `b2b-flights-review.ts`, `flights-manage-booking.ts` |
| 38–41 | Cancel / Refund / Tracker | Manage views | `flights-manage-booking.ts` |
| 42–45 | Disruption / Special assistance / Support | Manage views | `flights-manage-booking.ts` |
| 51–57 | B2B portal (search/quotation/travellers/review/manage/after-sales) | Views | `b2b-flights-*.ts` |
| 58–64 | Admin portal (suppliers/inventory/pricing/fulfilment/after-sales/disruptions/reconciliation) | Views | `admin/admin-portal.ts`, `admin/admin-workspace.ts` |

**Exceptional states (15–24)** are implemented as conditional UI states within the above views (empty/loading/error/expired/price-changed), not standalone routes — consistent with the report's recommendation.

## 4. Reusable Shared Components
- `components/shell/header-nav.ts` — global header/nav (reuse for all customer pages).
- `components/trip-bucket/trip-bucket-ui.ts` — Trip Bucket drawer (preserve, locked).
- `components/search-command-center/command-center.ts` + `journey-handoff.ts` — SCC (preserve).
- `components/discovery/discovery-controller.ts`, `components/trust/macro-stages.ts`.
- `components/brand/vacatina-logo.ts`, `logo-assets.ts`.
- `components/ui/toast.ts`, `components/dialogs/*`.
- `features/flights/ui/reusable-traveller-selector.ts`, `airport-autocomplete.ts`.
- `features/flights/ui/flights-offer-detail-modal.ts` (offer → fare → bags → seats flow).

## 5. Current Blockers / Gaps
1. **Route granularity:** Many 64-spec screens are modal states, not dedicated routes. The report explicitly allows reusable steps/panels, but post-booking manage flows (change/cancel/refund/disruption/support) should gain dedicated routes (`/bookings/:id/change`, `/cancel`, `/refund`, `/disruption`, `/support`) for deep-linking and browser-back correctness. Currently `/bookings/:ref` collapses everything into one dossier modal.
2. **Manual request-to-book tracker (46–50):** Partially implemented; `Request Submitted / Status Tracker / Quotation Review / Declined Recovery` need verification against Stitch screens.
3. **Seat map & ancillary capability gating:** Offer modal shows steps, but capability-aware skip/refresh for unsupported extras needs audit.
4. **Mobile/tablet verification:** Browser verify covers 360/768/1440 for Flights routes, but post-booking manage flows and admin/B2B at tablet/mobile are not yet verified.
5. **WCAG 2.2 AA:** Keyboard/focus checks pass on product routes; manage/admin/B2B flows not yet covered by E2E.
6. **State machine independence:** Payment vs booking vs ticketing statuses must remain independent (currently simulated); reconciliation states need hardening.
7. **Uncommitted work** must be preserved before any structural edits.

## 6. Verified Progress Summary
- Build: ✅ (115 modules)
- Flights unit tests: ✅ 22/22
- Browser E2E: ✅ 109/109 (0 failures) at 360/768/1440
- Stitch (read-only): 64 screens generated in project `17278642140865517453` using locked design system.

## 7. Recommended Next Actions (awaiting approval)
1. Preserve uncommitted work (git stash/commit WIP) before edits.
2. Extract Homepage header/footer into reusable components (`components/shell/`) and apply across customer pages (preserve exact appearance).
3. Add dedicated routes for post-booking manage flows (change/cancel/refund/disruption/support) with browser-back + saved state, reusing existing dossier logic.
4. Verify mobile/tablet + WCAG for manage/B2B/admin flows; add E2E coverage.
5. Harden state-machine independence (payment/booking/ticketing/change/refund/disruption) in frontend contracts.
6. Re-run build + tests + browser verify after each change; report page-by-page status.

**No major structural changes have been made. Awaiting your approval to proceed.**