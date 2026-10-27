# Vacatina B2C product journeys — local release checkpoint

This is a **customer-journey implementation checkpoint, not a live-sales release**. The production repository/Home Page, `DESIGN.md`, canonical routes and tested patterns remain authoritative. No supplier, production payment, migration, remote push or deployment was activated.

## 1–10. Product checkpoints

The frozen Phase 4 baseline remains `d8f5dfe488b8064b765d12c954c227c3e1381f4c` / `stabilization-server-backed-v1`.

| Phase / product | Local commit | Annotated local tag | Implemented journey / truthful boundary |
| --- | --- | --- | --- |
| 5 Flights | `0e0a071` | `phase5-flights-v1` | Hub → canonical search → offer/fare configuration → Trip Bucket → review. Manual schedules remain pending; demo/manual items cannot become Ready. |
| 6 Hotels | `4224699` | `phase6-hotels-v1` | Dedicated route precedence repaired. Destination, dates, rooms/adults/children → results/filters → property/room/rate → configured review. Hotel inventory, ratings, rates, meal plans and conditions are explicitly illustrative. |
| 7 Visa Assistance | `295c29a` | `phase7-visa-v1` | Destination, nationality, residence, purpose, date/applicants → options/checklist/fee examples → local assistance request. Eligibility is unverified; no passport collection, uploads, filing or approval simulation. |
| 8 Holiday Packages | `3d6c16a` | `phase8-packages-v1` | Explicit demo discovery → details/illustrative planning itinerary → dates, party, duration, style/accommodation request → Trip Bucket/review. Quote required; no hotel or flight allocation/inclusions invented. |
| 9 Cars & Transfers | `3890116` | `phase9-cars-transfers-v1` | Transfer and car-hire distinction, pickup/drop-off, local time, party, luggage, return timing and driver-age validation → category request → review. No driver or vehicle allocation. |
| 10 Activities | `15ad771` | `phase10-activities-v1` | Destination/date/participants → activity → session/ticket request → review. No session availability or ticket issuance assumed. |
| 11 Sightseeing Tours | `780125d` | `phase11-sightseeing-v1` | Separate taxonomy, guided-route/meeting-point/language context → tour departure/participant request → review. No guide, route or slot confirmation invented. |
| 12 Rails | `1369f14` | `phase12-rails-v1` | Station/date/party search → route details/class preference → request → review. No train number, timetable or seat fabricated. |
| 13 Cruises | `753e0e1` | `phase13-cruises-v1` | Region/port/date/party → details → cabin preference → request → review. Ship, ports of call, itinerary and cabin inventory remain unconfirmed/not supplied. |
| 14 Travel Insurance | `8c0b2d3` | `phase14-insurance-v1` | Destination/dates/travellers/ages/residence → comparison example → policy/eligibility-review request → review. No insurer, wording, benefits, exclusions, premium, eligibility or coverage invented; no cover in force. |

The seven newer products extend the existing `JourneyOffer`, `JourneyConfiguration`, `JourneyService` and `ProductWorkspace`. Their demo catalog is an explicit choice on the existing canonical routes, not a fallback masquerading as supplier inventory or a separate booking engine. Unknown prices display **Quote required**, not a zero-price product. Published-service requests still go through the existing authenticated API boundary.

## 11. All 11 Search Command Center tabs

All tabs activate, expose their own fields, validate required inputs and hand off intent through canonical routes. Editable dates, nationality/residence, categories, modes and preferences now update state rather than silently being ignored. Exact dates are normalized; a month/season is preserved as a preference, never converted into an invented date. Missing exact dates, applicant information, ages or hire logistics are completed on the relevant hub. Browser assertions verify a single navigation per accepted submission and no navigation for rejected submissions at 1440/768/360.

Build Your Bundle stays orchestration. When the service is unavailable it can retain preferences on the current page and open product configuration, explicitly without persistence, reservation, discount or checkout shortcut.

## 12–13. Mixed Trip Bucket and `/trip/review`

- All ten product types coexist with canonical/source identity, product-specific configuration, price/currency or unpriced state, freshness and revalidation metadata.
- Server display snapshots do not erase local demo/manual requests. These requests are not server booking records.
- Local checks dispatch by product: Flights, Hotels, Visa catalog, and canonical generic demo lookup. They do not claim supplier availability or confirmation.
- Demo/manual items are blocked from Ready at staging, snapshot replacement, generic resolution, allocation-reference and local-revalidation paths.
- Review links retain the original product configuration/search context, including hotel room/rate/occupancy and visa applicant context.
- Unpriced requests are excluded from numerical estimates. Checkout remains gated unless every item satisfies the existing live-supplier/Ready rules; server checkout independently owns booking/payment authority.

## 14–15. Responsive and accessibility QA

Every product journey is exercised at 1440 desktop, 768 tablet and 360 mobile. Gates cover document overflow, usable forms, CTA bounds, mixed-product drawer bounds, floating-control coordination and preservation of the header/footer. The original eleven viewport/navigation gates remain enabled.

Native inputs/selects/radios are retained where practical, with labels, meaningful headings, visible focus and keyboard-selectable options. Dialogs trap focus, close with Escape and restore focus. Real browser Tab events verify focus movement/naming/visibility on all ten product hubs. Route cancellation and autocomplete/dialog cleanup prevent stale responses or duplicate handlers. This is targeted engineering QA, not a claim of independent WCAG certification.

## 16–19. Final verification

Final required sequence:

1. `npm run typecheck` — **0 errors**.
2. `npm test` — **262/262 PASS**.
3. `npm test` again — **262/262 PASS**.
4. `npm run build` — **PASS**, including the browser/server import-boundary and bundle-syntax guards; zero external CDN dependencies.
5. `npm run test:e2e` without a focused-phase limit — **85/85 PASS**, zero runtime console errors and zero uncaught page exceptions.

The previous Hotels Journey N route-precedence failure is fixed, not skipped. All original unit suites and browser assertions remain enabled. A transient Windows `EPERM` rename failure was observed during the earlier Flights work; it was not hidden or “fixed” by weakening tests. No such failure occurred in the final two full test runs.

Machine-readable browser evidence: `docs/BROWSER_VERIFICATION_REPORT.json`. Product screenshots: `screenshots/vacatina_flights_*`, `screenshots/vacatina_hotels_*`, `screenshots/vacatina_visa_*`, and `screenshots/vacatina_b2c_*` (including mixed review at all three required widths).

## 20–21. Final release commit/tag

The shared SCC, review/revalidation, lifecycle, accessibility and regression fixes are included in the final local commit **`feat: complete Vacatina B2C product journeys`**, identified by annotated local tag **`b2c-product-journeys-v1`**. The ten per-product commits/tags above remain intact. Nothing is pushed.

## 22–24. Remaining work (intentionally not activated)

- **Product data:** verified operator inventory, property/rating evidence, room/rate terms, package inclusions, vehicle capacity/eligibility, experience/tour schedules, rail fares/seats, cruise itineraries/cabins and insurer-approved policy wording/premiums/eligibility. Generic demo catalogs currently provide one non-sellable planning example per product.
- **Visa:** authoritative/current eligibility and fee sources, secure application persistence, document storage/upload, staff review, audit and government/consular submission integrations. No personal documents should be collected in the local journey.
- **Supplier/API:** credential provisioning, commercial certification, sandbox/UAT, production-ready canonical search, real pricing/freshness/revalidation and verified allocation/confirmation for each supplier. Existing supplier scaffolds and legacy reference-test helpers are not evidence of an activated production supplier.
- **Production backend:** persist/synchronize local request configuration through approved server workflows; confirm readiness exclusively from verified operational evidence; complete approved database/CMS migration and deployment processes separately. Existing server auth/CSRF and hosted-payment gates remain intact. Browser-local requests cannot be paid as confirmed bookings.
- **Payments/deployment:** production payment configuration, verified webhook/settlement operations, supplier fulfillment and production deployment all remain separate, unexecuted work.

## 25. Worktree status and safety

Implementation, tests and selected journey evidence are committed. `opencode.json` remains untracked and is **not committed**; it uses the `STITCH_API_KEY` environment reference. `.env` / `.env.local` are not staged. Unrelated pre-existing/generated screenshot churn is intentionally left unstaged rather than discarded or folded into the release. Consequently the worktree is **dirty by design**, not because journey source changes are pending.

No supplier activation, production credentials, database/CMS migrations, migration-approval changes, payment activation, remote Git push, backend deployment or Vercel deployment was performed. Stop at this local checkpoint.
