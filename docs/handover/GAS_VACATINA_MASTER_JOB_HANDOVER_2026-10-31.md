# VACATINA — FULL PROJECT JOB HANDOVER TO GOOGLE AI STUDIO (GAS)
**Document ID:** VAC-GAS-HANDOVER-2026-10-31 | **Status:** HANDOVER CREATED; not acceptance or execution proof  
**Handover owner:** Vacatina / ChatGPT project coordinator  
**Receiving executor:** Google AI Studio, the **existing** Vacatina app (NOT a new project)  
**Scope of this GitHub change:** Documentation only; no source code, design or deployment changes authorized by the handover itself  
**Authoritative date:** 2026-10-31 | **Repository:** https://github.com/vacatina/vacatina | **Handover branch:** `release/b2c-product-journeys-v1`

## 0. සිංහල — භාරදීමේ සාරාංශය
මෙය GAS වෙත ලබාදෙන **සම්පූර්ණ Job Handover** එකකි; තනි generic prompt එකක් නොවේ. දැනට තිබෙන Vacatina Web App සහ GitHub code එක, Google Stitch designs, සියලුම LOCKED/APPROVED Homepage තීරණ සහ Trip Bucket ආරක්ෂා කරන්න. පළමුව GAS workspace එක GitHub release branch එක සමඟ එකම codebase එකක්දැයි තහවුරු කර, තිබෙන 64 Flights screens/states නැවත සැලසුම් නොකර audit → gap-fix → functional QA → visual QA → preview verification යන ක්‍රමයෙන් ඉවර කරන්න. Real supplier APIs, booking, payment, production deployment දැන් අනුමත නැත. Report කරන සෑම % එකක්ම evidence මත පදනම් විය යුතුය.

## 1. Handover contract: what GAS inherits
- **Business intent:** Premium, trustworthy international OTA-quality travel platform for Sri Lanka and international customers and partner agents; B2C + B2B responsive web first, not only a Flights microsite.
- **Immediate job:** Finish previously authored **64 Flights UI/UX screens and states** and real, deterministic frontend journey behavior. Preserve approved platform shell and prior functional work. Do NOT interpret this as 64 new independent URL pages.
- **Product vision:** discover → explore → search → results → detail → configure → Trip Bucket → review → booking preview → manage journey; truthful and reversible fallback when backend capabilities are not live.
- **Later scope, NOT permission to implement now:** Hotels, Visa Assistance, Holiday Packages, Cars & Transfers, Rails, Cruises, Activities, Sightseeing Tours, Travel Insurance, Build Your Bundle, B2B/admin breadth, real auth/inventory/checkout/booking services, native mobile. Mobile responsive browser UI is in current scope; native iOS/Android, white-label, full backend are future gates.
- **Delivery:** No new app, no new repo, no repo reset, no force push, no main merge, no production deployment, no Stitch source edits, no speculative transaction success.

## 2. Identity, source provenance and unresolved HIGH-risk split
| Item | Recorded value / status | Evidence classification |
|---|---|---|
| GAS existing app | https://aistudio.google.com/apps/c02aa166-b588-4c4e-ab59-b0c038dd71d7 | Browser-read observed 2026-10-31 |
| Stitch expansion source | https://stitch.withgoogle.com/projects/17278642140865517453; 148 artifacts reportedly visible to GAS | **USER-REPORTED**; MCP access and 64 exact Stitch IDs not independently verified by ChatGPT |
| Older Stitch QA project | https://stitch.withgoogle.com/projects/18423800103870948786 | Historical **different** project; do not conflate or overwrite |
| GitHub | https://github.com/vacatina/vacatina | **VERIFIED** accessible |
| GitHub `main` | `05a4d9af2aa8d11334a9e69a2e298815f79df894` (observed 2026-10-31, commit dated 2026-10-25) | **VERIFIED** branch ref |
| GitHub `release/b2c-product-journeys-v1` pre-handover | `0199372e6cbb4523564657d33ad0272b26101385` (2026-10-31, Stitch visual fixes) | **VERIFIED** branch ref; expected to advance with this documentation commit |
| Accepted 72-case hosted acceptance application | `6054dc541a0b3a703bf39cdca714bc238b472dc3` / `dpl_ChwLz4tU3agQjmY1J9gFw5whjv7X` | **HISTORICAL REPOSITORY EVIDENCE**, not present HEAD |
| Later 7-defect targeted fix | `3ce16d45f8be9e4dcfe3762e043db8f4d85e7b74` / `dpl_42SvpZE3YPhFqwpMw776mg2tf7fe` | **HISTORICAL REPOSITORY EVIDENCE**, targeted checks only |
| GAS browser source/runtime | GAS reported Next.js 16.4.3 (App Router), React, Tailwind; `next dev -p 3000` started | **BROWSER-OBSERVED**, not verified equivalent to GitHub build |
| GAS build error | `Cannot find module '/app/applet/scripts/build.mjs'` | **BROWSER-OBSERVED**, reproducible in shown log |
| GitHub build script | `scripts/build.mjs` EXISTS on `main` and `release/b2c-product-journeys-v1`; their package scripts use it | **VERIFIED** GitHub files |
| Repo build/runtime | GitHub package.json uses custom TypeScript+Tailwind script, not Next.js dev script | **VERIFIED** GitHub file; GAS vs GitHub may be divergent projects/snapshots |
| Vercel current URL/production SHAs | Unresolved; historic previews are attribution-specific and not proofs of current deploy | **NOT VERIFIED CURRENT** |

**STOP-GATE 0 — source divergence:** GAS must fingerprint its current files/package.json, Git remotes/current branch, active source tree, and exact deployment target **before editing anything**. The GAS Next.js scaffold and the GitHub custom build pipeline conflict; `scripts/build.mjs` missing only in GAS is NOT evidence it should be newly generated. Never replace the working GitHub app with an AI Studio scaffold, never blindly copy the GitHub scripts into Next, and never assume the workspace is synchronized. Produce a specific "GAS↔GitHub parity report" showing paths, checksums/commit IDs, framework/build differences and a minimal no-loss reconciliation proposal. Request approval only if reconciliation would be destructive or change the approved runtime architecture.

## 3. LOCKED decisions: no-touch homepage + design system
**Home and Trip Bucket are APPROVED and LOCKED** in the master user instructions. Treat them as regression-protected, not a Flights redesign target:
- Existing premium shared Homepage, Header, Footer, branding, route/navigation and content order; no new second homepage, visual retheme, global style replacement, or card rerouting without approval.
- **Search Command Center has 11 distinct tabs**: Flights; Hotels; Visa Assistance; Holiday Packages; Cars & Transfers; Rails; Cruises; Activities; Sightseeing Tours; Travel Insurance; **Build Your Bundle**. The 10 standalone products remain distinct; Activities ≠ Sightseeing Tours; Insurance remains its own tab. Historical notes call Build Your Bundle the 11th tab; the UI label may vary according to approved design. No new taxonomy.
- Reusable Traveller Selector including adults/children/infants constraints, correct count validation, product-specific filters/date/airport controls, search form state continuity and correct route transitions.
- Hero/product cards take users to a suitable search/detail/configuration step; **never directly to unconfigured checkout/book-now**.
- **Trip Bucket** unifies product selections and readiness; the source reports an 8-state readiness model. Preserve source offer identity, configurations, price/currency freshness, item status, add/edit/remove/recheck, drawer and mobile behavior. Floating Trip control hides on downscroll and reappears on upscroll, never overlays Search Flights or navigational controls. Drawer/modal open/close and focus recovery must not conflict with floating dock.
- Preserve premium Dark Edition + Enterprise Hybrid design: **Space Cadet Navy #1B1464**, **French Blue #0071BC**, Plus Jakarta Sans display + Inter body, current `DESIGN.md`, approved geometric rhythm and responsive behavior. Different source versions may include supporting fonts/colors: defer to existing canonical repo DESIGN.md and verified approved rendered reference; do not silently merge/retheme.
- Header height 76px appears in historical homepage planning; validate against approved locked implementation before enforcing as a global numerical change.
- No false claims of IATA certificates, payment processing, supplier live rates, actual inventory, ticket numbers, refunds or guaranteed bundle savings unless operationally verified and approved.
- The historic Homepage accessibility audit scored **76/100**, not current compliance. Retest keyboard, visible focus, semantic form labels, contrast and icon-only names, real zoom/reflow, reduced motion, and drawer focus without visual redesign. Historic Trip overlay regression was reported as corrected but browser verification was incomplete; retest.
- Preserve source designs in Stitch as READ-ONLY; do not edit LOCKED, APPROVED or ARCHIVE screens. Naming convention if ever separately authorized: `NN — Vacatina — [Area / Feature] — [Version] — [Status]`.

### Homepage preservation acceptance probes
| Protected element | Mandatory non-regression proof at 390 / 768 / 1440 |
|---|---|
| Header, navigation, footer, logo | Same approved visual baseline; no overlap, clipping, lost keyboard navigation |
| 11 search tabs | Exactly all 11; active tab content correct; keyboard tabs and product routing verified |
| Traveller selector | Adult/child/infant boundaries, invalid inputs, return state preserved |
| Build Your Bundle | Correct product taxonomy and real UI transitions; no placeholder actions |
| Trip Bucket | Readiness/state and item continuity; add/update/remove; drawer focus/close |
| Floating Trip button | Scroll down hides / up restores; never obscures search CTA or mobile nav |
| Search-to-Flight navigation | Flight query inputs carry into Flights Hub/Results; no homepage button dead ends |
| Responsive/accessibility | Actual browser screenshots + interaction traces, not CSS presence or axe-only claims |

**No-touch list:** homepage source components, header/footer shell, global SCC and tokens, Trip Bucket service/dock, existing routes, auth gates, supplier/payment contract, unrelated verticals and active WIP. A *documented critical regression fix* is a tiny, reversible scoped diff with baseline/test proof; do not interpret handover as blanket approval to change these areas.

## 4. Domain architecture and product contract
- Canonical frontend travel offer identity must remain stable: `offerId`, `productType`, `supplierId`, `price`, `currency`, `availabilityStatus`, `lastCheckedAt`, exact selected configuration and recheck outcomes. Do not key bookings by display names or lose supplier IDs.
- UX must represent `LOADING`, `SUCCESS`, `NO_RESULTS`, `VALIDATION_ERROR`, `SUPPLIER_ERROR`, `TIMEOUT`, `PRICE_CHANGED`, `UNAVAILABLE`, `EXPIRED`, plus appropriate `RECHECK_REQUIRED` and actionable recovery. No fake live offers.
- Book/hold/payment authorization/payment capture/ticket issue/refund are **different states**; no automatic "paid", "ticketed", or "refunded" claims in deterministic previews.
- B2B wholesale/net pricing, quotations, client passenger details and after-sales require role-aware UI. Admin supplier, inventory, pricing, fulfilment and reconciliation are role-gated; do not expose privileged actions via B2C or public-demo workarounds.
- Auth, supplier APIs (e.g. Duffel, LiteAPI and others), storage, payment gateway, booking saga are scaffolded/planned in prior code and docs, **not production-proven services**. Real backend activation is an explicit later approval gate; historical source/environment/API mismatches require a separate read-only review, not expansion into this frontend handover.
- The development precedence is **approved UI/UX → existing frontend journey/QA → authorized backend integration → complete production validation**. Older future mobile ambitions do not override later explicit responsive-web-only current scope.

## 5. Existing Flights 64-state source matrix — exact prior repository inventory
The following 64 rows are extracted from the established GitHub `docs/flights-evidence/FLIGHTS_QA_COVERAGE.md` on `release/b2c-product-journeys-v1`. They represent **repository inventory and route/state mapping, not 64 verified Stitch source IDs or fully accepted visual pages**. Actual Stitch ID, screenshot/HTML, and current code/test evidence must be crosswalked separately. Screen 01 is homepage Flights entry but the Homepage itself remains LOCKED.

| # | Existing repository inventory name | Canonical route / fixture state (historical) |
|---|---|---|
| 01 | Home / Flights entry | / — default |
| 02 | Flights Hub | /flights — default |
| 03 | Search Results | /flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1 — default |
| 04 | Offer Details | /flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1 — offer |
| 05 | Fare Family Selection | /flights/offer/sup-flt-cmb-dxb-fz548 — fare |
| 06 | Baggage & Ancillaries | /flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1 — ancillary |
| 07 | Seat Selection | /flights/offer/sup-flt-seat-map-sim — seat |
| 08 | Passenger Details | /flights/passengers — default |
| 09 | Contact & Travel Docs | /flights/passengers — contact |
| 10 | Trip Bucket | /flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1 — bucket |
| 11 | Review & Recheck | /flights/review — default |
| 12 | Checkout & Payment | /flights/checkout — default |
| 13 | Payment Authorization | /flights/checkout/authorization — authorization |
| 14 | Confirmation / Ticketing | /flights/confirmation — default |
| 15 | Search Validation | /flights/search?from=ZZZZ&to=DXB&depart=2026-11-18&adults=2 — default |
| 16 | Search Loading / Partial | /flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1&qaHoldLoading=1 — transient |
| 17 | No Flights Found | /flights/search?from=CMB&to=BKK&depart=2026-11-18&adults=1 — default |
| 18 | Supplier Outage | /flights/search?from=CMB&to=DXB&depart=2026-11-18&adults=1&source=sandbox_test — default |
| 19 | Expired / Unavailable Offer | /flights/offer/sup-flt-expired-sim — revalidate |
| 20 | Price Changed | /flights/offer/sup-flt-price-changed-sim — revalidate |
| 21 | Fare Rules Changed | /flights/offer/sup-flt-fare-rules-changed-sim — revalidate |
| 22 | Seat / Baggage Unavailable | /flights/offer/sup-flt-unavailable-sim — revalidate |
| 23 | Payment Failed / Unknown | /flights/checkout/payment-failed — default |
| 24 | Booking Creation Failed | /flights/checkout/booking-failed — default |
| 25 | Guest Booking Lookup | /flights/manage — default |
| 26 | My Trips / My Bookings | /account/trips — default |
| 27 | Booking Details | /bookings/VCT-2026-0001 — default |
| 28 | E-Ticket & References | /bookings/VCT-2026-0001/ticket — default |
| 29 | Receipt / Invoice | /bookings/VCT-2026-0001/receipt — default |
| 30 | Ticketing Pending / Hold | /bookings/VCT-2026-0002/ticketing — default |
| 31 | Travel Prep / Check-in | /bookings/VCT-2026-0001/travel-prep — default |
| 32 | Post-Booking Extras | /bookings/VCT-2026-0001/extras — default |
| 33 | Passenger Correction | /bookings/VCT-2026-0001/correction — default |
| 34 | Change — Start | /bookings/VCT-2026-0001/change — default |
| 35 | Change — Alternatives | /bookings/VCT-2026-0001/change/alternatives — default |
| 36 | Change — Quote & Review | /bookings/VCT-2026-0001/change/review — default |
| 37 | Change — Complete | /bookings/VCT-2026-0001/change/complete — default |
| 38 | Cancellation Eligibility | /bookings/VCT-2026-0001/cancel/eligibility — default |
| 39 | Cancellation Quote / Approval | /bookings/VCT-2026-0001/cancel/quote — default |
| 40 | Cancellation Result | /bookings/VCT-2026-0001/cancel/result — default |
| 41 | Refund / Credit Tracker | /bookings/VCT-2026-0001/refund — default |
| 42 | Disruption Alert | /bookings/VCT-2026-0001/disruption — default |
| 43 | Disruption Alternative Decision | /bookings/VCT-2026-0001/disruption/decision — default |
| 44 | Special Assistance Request | /bookings/VCT-2026-0001/support/special — default |
| 45 | Support Case Tracker | /bookings/VCT-2026-0001/support — default |
| 46 | Manual Request Review | /flights/requests/VCT-REQ-0001/review — default |
| 47 | Request Submitted | /flights/requests/VCT-REQ-0001/submitted — default |
| 48 | Request Status Tracker | /flights/requests/VCT-REQ-0001 — default |
| 49 | Operator Quotation Review | /flights/requests/VCT-REQ-0001/quote — default |
| 50 | Declined Request Recovery | /flights/requests/VCT-REQ-0001/declined — default |
| 51 | Agent Flight Search | /b2b/flights — default |
| 52 | B2B Results & Net Fares | /b2b/flights — b2b-results |
| 53 | Quotation Builder | /b2b/flights/quotation — b2b-quote |
| 54 | Client Passenger / Doc Collection | /b2b/flights/travellers — default |
| 55 | Agent Booking / Credit / Payment | /b2b/flights/review — default |
| 56 | Agent Booking & Ticket Mgmt | /b2b/flights/review/ticket — ticket-guard |
| 57 | Agent After-Sales Mgmt | /b2b/flights/manage — default |
| 58 | Supplier Config & Health | /admin/suppliers — admin |
| 59 | Manual Inventory CMS | /admin/inventory — admin |
| 60 | Pricing / Margin Rules | /admin/pricing — admin |
| 61 | Fulfilment & Ticketing Queue | /admin/fulfilment — admin |
| 62 | Exchanges / Cancel / Refund Desk | /admin/after-sales — admin |
| 63 | Disruption Queue | /admin/disruptions — admin |
| 64 | Reconciliation & Audit | /admin/reconciliation — admin |

**Ownership boundaries:** 01–50 B2C (including manual request, after-sales and exception states); 51–57 B2B; 58–64 Admin. Some numbered items are modals, embedded states, or fixtures rather than pages. Do not open 64 new routes by default. The separate Stitch project reportedly has 148 design artifacts (including variants); do not claim all are unique screens or directly equivalent to these 64 source rows. Read-only Stitch MCP retrieval and actual per-row ID evidence are required before asserting 64 designs received.

## 6. Historical QA snapshot (never substitute for today's acceptance)
Historical repository evidence in `docs/flights-evidence/` records:
- Accepted public hosted sample **68 PASS / 0 FAIL / 4 BLOCKED / 72 cases** at **`6054dc5`**; exactly four public-demo/auth-gated checks, not successful authenticated journeys.
- Later **24 PASS / 0 FAIL / 1 BLOCKED / 25 affected hosted checks** at targeted fix `3ce16d4`; distinct run, not a new 72-case acceptance.
- **64/64 = inventory coverage only**; **59/64** partial local/visual macro review; **177/177** viewport-fit measurements across 59 states at 390/768/1440, not usability/interaction acceptance; **366/366** unit tests in a historical verification worktree, not a current run.
- The report explicitly says **full visual acceptance 0/64 completed** and **full WCAG audit 0/64** at that checkpoint (meaning *not verified*, not demonstrated 64 failures).
- Follow-up evidence recorded deterministic seat-map, loading, changed-fare-rules and 3DS authorization **preview** fixtures. These are not supplier/payment implementations. Preserve the latest tests/fixtures: do not regress them or say these gaps remain untouched without checking.
- Known operational gates: My Trips, booking dossier, after-sales/admin gated on hosted public demo; component scans cannot remove those blockers. Real screen-reader listening, manual contrast, full interactive states and real authenticated end-to-end remain pending. Browser zoom emulation ≠ complete zoom accessibility.
- Historical *confirmed* defects corrected with constrained diffs: Flight airport combobox semantics, offer details contrast/keyboard scroll, review explanatory contrast, disruption action contrast, simulated payment failure honesty, manual request encoded ampersand. Do not reintroduce them.
- Recent release tip `0199372e` changed Flights Hub headline, container width and animations relative to prior QA; its visual, build and E2E acceptance must be independently verified. Never reattribute historic checks to this tip.

## 7. OpenCode/Antigravity mistakes -> GAS preventive control
| Severity | Historical failure / recurrence scenario | Prevention and acceptance evidence |
|---|---|---|
| P0 | GAS works on a divergent Next.js copy while GitHub source is a separate custom TypeScript app | STOP-GATE 0: source fingerprint, Git branch/commit and framework parity before any Flights changes; preservation diff |
| P0 | Lost WIP, deleted locked screens, rebuilt Homepage, duplicated apps/components | Read-only initial audit, no-touch zone, inventory-based minimal diffs, no resets/force pushes, check unrelated WIP byte equality |
| P0 | False booking/payment/refund/ticket claims from mock fixtures | All previews labelled simulated; negative flows and copy assertions; no live APIs or payment mutation |
| P0 | Wrong SHA / wrong Vercel preview credited for passing QA | Report source HEAD SHA + committed tested SHA + exact deployment ID/URL; reject unmapped probes |
| P1 | 68/72 PASS mistaken for all 64 pages accepted | Keep separate denominators: case probes, source inventory, visual state coverage, responsive test, WCAG audit |
| P1 | Four auth/public-demo checks converted into fictional PASS | BLOCKED stays BLOCKED; local mock never substitutes for gated authenticated hosted journey |
| P1 | 'Page loads' counted as functional QA | Browser click/tab/input/submit/back/reload, negative/error/recheck, focus and state continuity recordings |
| P1 | Source design import overwrites existing implementation or styles | Stitch READ ONLY and scoped visual diff; no one-shot 64-screen export replacing app shell |
| P1 | Trip overlay obstructs Search Flights; scroll/drawer regression | 390/768/1440 actual scroll + drawer + focus + CTA clickability tests |
| P1 | Duplicate handlers/routes, offer state identity loss | Single route/state owner; canonical offer contract tests; trace via selected fare → review |
| P1 | Missing or ineffective accessibility | Keyboard, semantics, manual contrast, screen-reader/manual gap record, real/approximate zoom correctly described |
| P1 | 'Fix missing build.mjs' blindly alters project runtime | Reconcile GAS Next vs repo build, then approved smallest fix; never generate replacement pipeline speculatively |
| P2 | Giant GAS prompts exceed context limit | Use short `GAS_START_HERE.md` plus bounded source sections and status file, no pasted mega-prompt |
| P2 | Scope drift into Hotels/backend/production | Current 64-state Flights frontend only; separate user approval for other modules/live services |

## 8. Execution gates, deliverables, evidence
**G0 — Platform/source preflight (READ ONLY).** Confirm GAS app ID, actual files, package scripts, source SHA, Git remote, branch, working tree dirt, Stitch MCP live read, deployment target, and document authority order. Highlight any GAS vs GitHub divergence. Deliver `GAS↔GitHub parity report` and an itemized no-loss plan; **STOP on unresolved framework parity**.

**G1 — Locked-baseline capture.** Save evidence for Homepage/SCC/Trip Bucket and current Flights routes at 390, 768, 1440; baseline route/interaction/critical accessibility tests. Do not modify approved shell.

**G2 — 64 design crosswalk.** Pull actual required Stitch references through the existing verified integration; match **64 repo inventory items** one-to-one to Stitch screen IDs and implemented route/state. Categorize `EXISTS+VERIFIED`, `EXISTS+DEFECT`, `MISSING`, `BLOCKED`, `NOT_VERIFIED`. Distinguish 148 total artifacts from 64 Flights states. Provenance of every row must be recorded.

**G3 — Bounded gap implementation.** Four review groups **01–16 → 17–32 → 33–48 → 49–64**, first fix confirmed defects and missing states, not rewrite all 64. Per group: baseline -> smallest diff -> typecheck/build/required tests -> actual browser actions -> screenshot compare -> regression -> report. Permission to perform routine non-destructive Flights frontend fixes does not authorize touching locked Homepage, auth architecture, payment services or production.

**G4 — Comprehensive Flights visual/functional/a11y acceptance.** Test every applicable state, selected fare continuity and alerts, passenger validation, price/fare rules recheck, ancillary/seat simulation, bookings & after-sales preview, B2B pricing and role gates, admin role gates, negative and recovery transitions. 390/768/1440 viewport tests; keyboard/screen-reader evaluations when available; document gaps honestly. Auth-gated E2E is BLOCKED, not PASS; don't bypass security.

**G5 — Reproducible release-branch preview.** Only after proven parity and QA, commit reviewed scoped app changes on appropriate existing development/release branch, never `main` or production. Verify exact commit SHA ↔ Vercel deployment ID ↔ tested URL, test in preview and record all failures/blockers. The handover document commit is not an app release.

**G6 — Final decision and owner acceptance.** Present route/QA matrix, full regression against locked Homepage, unresolved blockers, code/test list, current SHA and preview identity. Mark Flights acceptance only when all applicable gates are satisfied. Explicit user approval required for destructive changes, scope expansion or release.

### Percentage arithmetic (do not fabricate)
- **Inventory accounted for** = verified repo inventory rows / 64. (Repository report has 64/64; current GAS parity still unverified.)
- **Stitch refs retrieved** = actual confirmed Stitch IDs/screenshots linked / 64.
- **Mapped** = cases with source+route+component crosswalk / 64.
- **Implemented** = independently confirmed requisite route/state behavior present / 64.
- **Functional** = passed *applicable actual browser interactions* / total executable applicable checks, plus separate blocked/not verified counts.
- **Visual** = full-size source comparison accepted / 64 (or explicit applicable denominator with exclusions).
- **Responsive** = screen × requested viewport scenarios passed / testable screen×viewport scenarios, report partial usability separately.
- **Accessibility** = passed applicable tested WCAG criteria / tested applicable criteria, with manual rules NOT VERIFIED until performed. Do not claim WCAG level from axe alone.
- **Preview provenance** = identified expected SHA + deployment ID + READY result + browser checks; if missing, NOT VERIFIED.
- **Whole platform completion** = NOT VERIFIED until all modules and backend production scope separately measured.
- A **0% verified** label must mean no verified evidence within that dimension, not zero underlying work. Use `PASS / FAIL / BLOCKED / NOT VERIFIED / N/A` and state denominator.

## 9. Whole-platform subsequent roadmap (do not begin without user authorization)
1. Flights frontend/UX/a11y/preview acceptance and protected Homepage regression closure.
2. Hotels search, property/room, Trip Bucket/checkout preview and Hotel QA, reusing shared design/components.
3. Remaining 8 standalone products plus Build Your Bundle, preserving taxonomy and separate activities/sightseeing/insurance states.
4. Role-specific B2B agents (net rates, quotes, booking operations, customer management) and Admin (inventory, supplier health, markups, reports) across verticals.
5. Backend API contracts/schema, auth/RBAC, inventory normalization, search/revalidation and actual supplier sandbox certification — separately approved.
6. Authorized payments, booking saga, webhooks, after-sales/refund, operational security, observability, performance, production QA and release gate.
7. Native mobile applications/white-label only upon subsequent scope approval.

## 10. Authority hierarchy, files and communication
**Decision authority:** Current explicit user instruction > latest documented approved project decisions > repo `DESIGN.md` and architecture ADRs > protected approved visual Stitch references > code and tests as *state evidence* > historic reports. Report conflicts; do not silently overwrite approved choices to match old docs.

Read directly (same release branch):
- [Canonical brand and visuals](../../DESIGN.md)
- [Flights 64-screen matrix](../flights-evidence/FLIGHTS_QA_COVERAGE.md)
- [Flights release QA attribution](../flights-evidence/QA_RELEASE_REPORT.md)
- [Flights defects and later fixture changes](../flights-evidence/QA_FINDINGS.md)
- [Flights evidence README](../flights-evidence/README.md)
- [Baseline proof details](../flights-evidence/coverage-matrix.json)
- `src/features/flights/`, `src/components/trip-bucket/`, `src/components/search-command-center/`, `src/app/`, `scripts/build.mjs`, `package.json` for current actual code.
- Existing `docs/` ADRs/contracts on repository branches where present; take care that main and release may differ.
- Project-level upstream references available to the user: `VACATINA-—-MASTER-PROJECT-INSTRUCTIONS.txt`, project PRD, Homepage & Trip Bucket report, homepage accessibility audit and role-permissions lists. These are historical source material external to this branch; do not claim GAS has all attachments unless it can access them.
- Stitch design project `17278642140865517453` (reported 148 artifacts); older project `18423800103870948786` is different.

**Communication channel protocol:** ChatGPT user/coordinator creates/updates *handover docs* in GitHub; GAS reads the exact branch+file and implements only approved scoped tasks in its own verified workspace; GAS writes evidence/status back to a versioned `docs/handover/GAS_EXECUTION_STATUS.md` when repository write/sync actually works; ChatGPT reviews committed diff, test logs, status and deployment identity via GitHub. **A GitHub commit does NOT automatically deliver a conversational message to GAS or cause GAS to execute.** The user must initiate the first read in GAS (short activation message), and the integration must be proven bidirectional before relying on future status exchange. GitHub is a durable task ledger, not a magic remote execution interface.

## 11. Immediate receiving-party response required
Before touching code, GAS must return a compact handover receipt:
1. Exact app ID, repo owner/name, current branch/HEAD and dirty state.
2. `package.json` framework/build scripts in GAS vs GitHub; explain missing `scripts/build.mjs` mismatch.
3. Whether `docs/handover/GAS_START_HERE.md` and this document can be read from the *intended branch*.
4. Real Stitch MCP read test: one screen ID/name and retrieval result; do not claim all 64 retrieved.
5. Protected Homepage baseline status, Flights inventory and historical QA references recognized.
6. G0 PASS / FAIL / BLOCKED / NOT VERIFIED, exact blockers and next smallest safe action.
7. Confirmation **no files or deployments changed** during G0.

**No downstream implementation before successful, non-destructive G0 source identity reconciliation.**
