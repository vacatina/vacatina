# Phase 17 — B2C UI/UX acceptance audit

**Date:** 28 October 2026

**Branch / starting checkpoint:** `release/b2c-product-journeys-v1` / `e313e0d`

**Authority:** current repository and `DESIGN.md`; no Stitch regeneration or Home Page redesign.

## Outcome

**Conditional acceptance for the existing non-production planning and Duffel TEST MODE experience. Not approval for a production booking launch.**

- All ten product entry/search/detail/configuration/staging journeys, all eleven Search Command Center (SCC) tabs, Build Your Bundle, mixed Trip Bucket and `/trip/review` were exercised.
- Four P1 defect groups and eight safe P2 groups were fixed. No P0, or unresolved P1 in the exercised scope, remains.
- Final gates: typecheck **pass**; unit tests **331/331**; build **103 modules**; browser boundary **103 browser / 0 server modules**; full E2E **94/94**; targeted sandbox checks **16/16**.
- Primary visual/interaction sizes: **1440px, 768px, 360px**. The E2E shell suite additionally checks eleven widths from 360px to 1920px.
- Deferred responsive/accessibility improvements and scenario limitations below prevent an unconditional production UX sign-off.

No push, deployment, migration, production-supplier activation, payment activation, credential change or live booking was performed. Phase 17 used sandbox searches/quote retrieval and local staging, not a new supplier order.

## Method and evidence

Chrome rendered the actual built application. Browser checks used real page navigation, form submission, clicks, scrolling, dialogs, and keyboard events; assertions supplemented, rather than replaced, screenshot inspection. Representative images were inspected at full resolution; contact sheets support the larger comparison set.

Local verification ran on Node `v24.22.1`; `package.json` declares `22.x`. The declared production runtime was not separately qualified in this UX audit.

Inventory was kept explicit:

- **Flights:** real Duffel TEST MODE quotes where configured, plus the existing labelled demo/manual lane. The final fresh sandbox search returned three quotes; an earlier search returned five. Neither is live inventory.
- **Other nine products:** existing canonical demonstration catalogs. Fees, availability, schedules, rooms, documents and policy examples are not supplier confirmations.
- **Failure scenarios:** a paused/failed same-origin published-inventory search request, without changing supplier configuration. Demo searches are local and correctly do not depend on that request.
- **Sandbox price change / expiry / unavailable:** deterministic browser response interception, with the on-screen message explicitly identifying a Phase 17 scenario, not an actual supplier outcome.

Evidence is in [`phase17-evidence/`](phase17-evidence/README.md). The [visual manifest](phase17-evidence/VISUAL_REVIEW_MANIFEST.json) records individual image names, dimensions and SHA-256 values. Before/intermediate captures are intentionally retained as evidence of defects; they are not assertions about the final UI. E2E's historical baseline fixtures are not sellable offers.

## Product acceptance

“Pass” below means the available **demo/manual/sandbox** journey, not fulfillment or live bookability. All rows were checked at 1440/768/360px. Shared stale/price/failure-state coverage is distinguished from independent supplier-specific verification in the next section.

| Product | Browser journey and configuration checked | Result / booking boundary |
|---|---|---|
| Flights | Valid and past-date search; multiple and zero results; fare detail/family; dates/travellers; manual request; sandbox quote staging | Pass. Non-live disclosure retained. Sandbox card schedule/stops now agree with segment detail; explicit quote-change/expired/unavailable states remain non-ready. |
| Hotels | Bentota search; dates, rooms and guests; property dialog; four stageable room/rate-plan actions; missing property and zero results | Pass. Illustrative room request stays Needs Action; no room hold is claimed. |
| Visa Assistance | UAE multiple options, UK single option, invalid applicant/travel context, unsupported destination, checklist/request dialog, applicant count and nationality/residence context | Pass. No passport upload, filing, eligibility verification or approval is simulated. |
| Holiday Packages | Dubai example; required/past-date rejection; dates/party/rooms; package style/accommodation; itinerary and cancellation disclosure; missing option and zero results | Pass. Quote-required operator request, not a confirmed package. |
| Cars & Transfers | Pickup/drop-off/time, travellers/luggage, transfer/return context and vehicle preference; missing logistics/date rejection; detail/staging/empty state | Pass. No vehicle, driver or allocation is represented as reserved. |
| Rails | Colombo–Kandy; departure/arrival validation; date/party/class preference; detail/staging/missing option/empty state | Pass. No invented train, timetable or assigned seat. |
| Cruises | Mediterranean; preferred port/date window, party/cabin preference; detail/staging/missing option/empty state | Pass. No ship, sailing or cabin allocation is assumed. |
| Activities | Dubai; date/party/session/ticket request; invalid/missing input, zero results, detail and local recheck/staging | Pass. No ticket or session is reserved. |
| Sightseeing Tours | London; date/party/session/language, meeting-point/route disclosure; invalid/missing option/empty state and staging | Pass. No guide, admission or tour slot is confirmed. |
| Travel Insurance | Ages per traveller, residence, trip dates, requested cover and explicit demo acknowledgement; invalid input/empty/missing option/staging | Pass. No premium, verified policy wording, eligibility decision or insurance cover is supplied. |

### Scenario coverage and limits

| Scenario | Verified coverage | Limit / interpretation |
|---|---|---|
| Valid/invalid search, dates and travellers | All ten browser journeys; product-domain tests cover additional impossible dates/counts/logistics | Native browser date controls were used; this is not an exhaustive locale/device matrix. |
| Multiple results | Flights demo/manual and Duffel TEST MODE; UAE Visa | Generic catalogs have one canonical planning example per vertical. Multiple genuinely distinct offers were **not fabricated** to claim coverage. Hotel multiple-property comparison and generic multi-offer acceptance remain limited by fixture breadth. |
| Zero results and recovery | All ten; current filters, alternate destination and no-booking messaging checked | Visa copy now mentions changing destination as well as clearing filters. |
| Results → detail → configuration → Trip Bucket | All ten at all three primary widths | Local staging is not a booking or a reservation hold. |
| Loading / request failure | Accessible skeleton, disabled searching action, retryable network failure at 1440/360; shared workspace contract | Local fixtures often resolve immediately. Independent supplier-timeout rendering for every vertical is not available without additional approved adapters/scenarios. |
| Expired / unavailable / invalid identity | Invalid canonical identities across product E2E; product/service stale-state tests; shared eight-state inspector; explicit sandbox expired/unavailable UI at all three widths | A missing offer is a recovery-path test, not proof that a real supplier expired an offer. |
| Revalidation and changed price | Mixed ten-product local checks; authoritative service unit tests; explicit changed-price sandbox browser state at 1440/768/360 | Demo/manual checks never promote a request to Ready. The sandbox price-change response is deterministic, not a claimed live price movement. |
| Add/update/remove/undo | All ten stage with retained product configuration; room change and shared remove/undo/detail controls; mixed-product revalidation | Shared drawer mutations are tested at the state-engine level as well as browser interactions, not independently against ten live suppliers. |
| Review and checkout gate | Ten-product mixed review, empty review, product-specific requests, disabled checkout and direct `/checkout` navigation | No enabled payment or production booking bypass was observed. |

This audit does **not** claim that every supplier-specific failure permutation has been independently rendered for every product. Broader multi-offer and supplier-specific operational scenarios are outstanding before a live-product release.

## Search Command Center and composition

The approved order is unchanged: **Build Your Bundle, Flights, Hotels, Visa Assistance, Holiday Packages, Cars & Transfers, Rails, Cruises, Activities, Sightseeing Tours, Travel Insurance**.

- Each tab selects its associated panel; `aria-selected`, `aria-controls`, invalid-input rejection, preserved date/traveller/product intent and single navigation handler pass.
- At 360px the tab rail intentionally scrolls horizontally with its affordance and keyboard behaviour. That is not page overflow.
- At 768px the desktop twelve-column field grid was compressing destinations/classes into unreadable fragments. It now uses two field columns; 360px remains one column and 1440px retains twelve.
- Bundle defaults, multi-selection, saving preferences and component handoff were exercised. Holiday Packages correctly remains a separate product, not a bundle component.
- Server snapshots remain authoritative by identity, while locally staged demo/manual selections now remain visible in the bundle. Non-live selections cannot make it Ready.
- Unpriced requests now say **Quote required**, not `LKR 0.00`. A selected request asks for confirmation/review rather than incorrectly saying it has not been chosen.

## Prioritized defects resolved

| ID | Priority | Verified defect → correction | Recheck / evidence |
|---|---|---|---|
| UX17-01 | P1 | Sandbox cards used the fetch time when Duffel provided schedule only on segments → server normalization derives each slice's schedule from its first/last segment. | Fresh sandbox quotes match source segment schedules and detail at all three widths; regression unit test. [Before](phase17-evidence/flights-hotels/flights-sandbox-1440.png) / [after](phase17-evidence/sandbox-after/sandbox-schedule-results-1440.png). |
| UX17-02 | P1 | A return leg was counted as an outbound stop → cards count connections/airports in the outbound slice only. | Direct return itinerary now displays Direct; connected outbound displays `1 Stop (DEL)`, not return airports. Same before/after pair; direct/connecting regression tests. |
| UX17-03 | P1 | Changed sandbox quote's struck-through previous USD amount came from a rounded LKR-style shadow → preserve previous native-currency minor units and render exact cents. | Native-currency unit and browser checks at all three widths. [Before](phase17-evidence/comparison-before/sandbox-native-price-before-1440.png) / [after](phase17-evidence/sandbox-after/sandbox-scenario-price_changed-1440.png). Quotes differ between fresh searches; compare precision, not the nominal quote. |
| UX17-04 | P1 | A successful empty server bucket hid locally staged requests in Build Your Bundle → merge display snapshots, deduplicating by server item identity. | Local activity remains visible, server wins duplicates, bundle stays non-ready. Unit tests and new three-width E2E regression checks. |
| UX17-05 | P2 | Bundle rendered quote-required requests as free and used contradictory “choose” copy → retain price status/native amount and use Quote required / review-selected-option copy. | [Before 360](phase17-evidence/comparison-before/bundle-quote-before-360.png) / [after 360](phase17-evidence/bundle-after/bundle-components-360.png); 768/1440 counterparts retained. |
| UX17-06 | P2 | SCC tablet field values were heavily truncated → scoped two-column override between 640 and 1023.98px. | All eleven tabs inspected and regression-tested. [Before](phase17-evidence/scc-before/scc-768-hotels.png) / [after](phase17-evidence/scc-after/scc-768-hotels.png). |
| UX17-07 | P2 | Visa used undefined `brand-gold` utilities → use existing white/primary tokens for action, category and hero text surfaces. | Hub/results reviewed at desktop/mobile; no undefined gold classes remain. [Hub before](phase17-evidence/fixes-before/visa-hub-1440.png) / [after](phase17-evidence/fixes-after/visa-hub-1440.png). |
| UX17-08 | P2 | `font-display` had no configured family → alias it to the approved Plus Jakarta Sans heading family. | Computed browser font verified; no new typeface/design language introduced. |
| UX17-09 | P2 | Flight and hotel results lacked a page-level heading → add screen-reader-only h1 elements. | Three-width semantic E2E checks. This deliberately creates no visible redesign; it is not described as a newly visible heading. |
| UX17-10 | P2 | Review exposed raw configuration keys/enums, zero “duration” and an irrelevant flight-search link → readable labels/values, omit zero duration, show flight link only for trips with flights. | Package/activity-only review and mixed-flight review checked; checkout blockers unaffected. [Readable package review](phase17-evidence/fixes-after/review-package-360.png). |
| UX17-11 | P2 | Empty drawer claimed “All 0 … Ready” and offered Review Trip → honest empty-state copy and disabled, aria-disabled CTA. | Click is a no-op; focus/drawer behaviour and three-width regression checks pass. [Mobile after](phase17-evidence/drawer-empty-after/drawer-empty-360.png). |
| UX17-12 | P2 | Single hotel/Visa counts used plurals; Visa empty recovery mentioned only filters → correct singular counts and add destination guidance. | Single and empty states checked. [Visa count after](phase17-evidence/focused-scenarios/visa-count-1440.png); recovery text additionally checked in the rendered DOM. |

The Home Page section architecture, approved header, product components, Trip Bucket state model and inventory/payment boundaries were not rebuilt.

## Responsive and accessibility findings

### Confirmed working

- No page-level horizontal overflow in the audited primary-width journeys. Scrollable tab/filter rails are contained within the page.
- Desktop navigation hierarchy and the mobile/tablet shell remain intact. Primary product forms stack and dialogs remain scrollable inside the viewport.
- Trip Bucket opens inside the viewport, coordinates with the dock, traps/restores focus and supports Escape. Removal/undo retains item state.
- Product controls have accessible names; the audited route scan found no missing image alt text or duplicate IDs. Flight/hotel results now have an accessible h1.
- Real Tab-key checks for all ten products retain visible focus and named controls. Existing reduced-motion and mobile hamburger target checks pass.
- Errors use alerts; searching feedback uses status semantics; non-live provenance and booking blockers remain textual, not color-only.

### Remaining improvements requiring approval

| Priority | Finding | Why not changed in this correction pass / proposed next decision |
|---|---|---|
| P2 | Floating Trip Bucket dock can cover lower SCC actions or discovery filters at tablet/compact desktop positions, especially with the historical three-item fixture. | A dock breakpoint/placement or reserved-space decision affects the approved shared shell. Approve a dedicated collision treatment and re-test 640–1280px rather than silently moving the Home Page. [768 evidence](phase17-evidence/scc-after/scc-768-packages.png), [compact-desktop contact sheet](phase17-evidence/contact-sheets/e2e-final-01.png). |
| P2 | Several dense secondary/header links and favourite controls fall below the design's 44px touch-target ambition; some legal/provenance text remains 10–12px. | Enlarging these across the locked shell/cards changes layout and needs a coordinated accessibility/visual pass. Primary journey actions are usable; this is not a blanket WCAG conformance claim. |
| P2 | Hotel/Visa mobile filter blocks precede results and make the first option slow to reach. | Approve a collapsed/filter-sheet pattern or reordered mobile hierarchy; do not rebuild approved components opportunistically. |
| P3 | Some remaining technical status/provenance values and singular/plural microcopy can be simplified further. | Cosmetic copy inventory; retain precise booking disclosures and obtain product/legal review where meaning could change. |
| Pre-live gate | Sparse generic catalogs and no connected live suppliers for nine products limit multi-offer comparison and independent operational-scenario coverage. | Approve richer canonical test data and later supplier-specific acceptance. Never substitute simulated sellable inventory. |

This is a Chrome/keyboard/responsive audit, **not** a screen-reader certification, measured full-site contrast audit, physical-device Safari/Firefox audit, or accessibility compliance declaration.

## Final verification

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass, zero TypeScript errors |
| `npm test` | **331/331 pass**, 24 suites; no skipped/cancelled tests |
| `npm run build` | Pass; 103 modules; no external CDN dependency |
| `npm run check:browser-boundary` | 103 browser modules / **0 server modules**; negative probe blocked |
| `npm run test:e2e` | **94/94 pass**, eleven viewports, 21 reported journey groups; zero runtime console errors / uncaught page exceptions |
| Fresh sandbox and deterministic revalidation UI | **16/16 pass** at 1440/768/360; source-segment schedules and exact previous USD cents checked |
| Targeted bundle/SCC and loading/failure checks | Pass after fixes; capture/results files retained with the evidence |
| Protected historical screenshot hashes | All four match the required originals; see below |

Logs: [unit tests](phase17-evidence/unit-tests.log), [E2E](phase17-evidence/e2e-final.log), [structured E2E report](BROWSER_VERIFICATION_REPORT.json), [sandbox scenarios](phase17-evidence/sandbox-after-results.json), [loading/failure](phase17-evidence/loading-failure-results.json).

An earlier unit attempt hit the already observed Windows `EPERM` temporary-file rename in `backend-foundation.test.ts`; the final full suite passed without changing persistence code. An early parallel browser attempt raced a rebuild; a later SCC handoff timing failure was addressed in the harness by bounded waiting for actual async completion, without removing its assertions. Final runs were sequenced around builds. Thailand correctly had no canonical Visa offer; UK was used for the positive flow and unsupported destinations were checked separately.

### Protected historical files

These required historical bytes differ from the generated images present in the Phase 16 Git blobs. They were restored from the verified pre-audit backup, not replaced with fresh captures. Other E2E screenshot churn was archived in the audit evidence and removed from the normal screenshot baselines.

| File | Required and final SHA-256 |
|---|---|
| `screenshots/vacatina_360px_mobile.png` | `9EAE7117379C6A58B7EBCB5C2416B7FDE1E94ED5A911853411E1001DBEA71B83` |
| `screenshots/vacatina_footer_1440px.png` | `204F32DF10EF52E9D46BFADDEE7FABFC17A53D7F7BA682A7380A0F71EA08FA6D` |
| `screenshots/vacatina_holiday_package_modal.png` | `583E08E8D37AE6C850DC554535AF2C8E38C2D2D8EC927865A787E8FB2D561B26` |
| `screenshots/vacatina_screen04_8states_inspector.png` | `724111435606760A5DC35537400425E2FB350AA729724BFF67E3408E73BBA2B2` |

## Release decision and stop point

**Local Phase 17 checkpoint eligible after the final gates above pass.** The audited non-production journeys are usable with truthful confirmation/payment gates and the documented P2 limitations. A production transaction launch remains **no-go** pending separate supplier/payment authorization, operational acceptance and the deferred UX/accessibility decisions.

Stop at Phase 17. Do not push the branch/tag, deploy, migrate, enable production suppliers/payments, or change production credentials. Untracked `opencode.json` is preserved and excluded from the checkpoint.
