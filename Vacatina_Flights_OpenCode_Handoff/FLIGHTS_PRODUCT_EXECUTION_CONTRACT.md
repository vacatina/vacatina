# VACATINA — FLIGHTS END-TO-END PRODUCT UX & ENGINEERING CONTRACT

**Status:** Owner review / execution instruction. This document is a target specification, not evidence that the product is operational.

**Source references:** User-supplied Stitch export containing 13 `code.html` screens, 13 matching `screen.png` references and one `DESIGN.md`. Existing release branch `release/b2c-product-journeys-v1` of `vacatina/vacatina`; actual repository code was inspected, including the listed Flights modules. **Do not copy Stitch code into production verbatim.**

## 0. Non-negotiable scope

1. **LOCK the currently deployed homepage.** Do not recreate, redesign, replace, restyle or reorder the homepage, its 76px header, 11 Search Command Center tabs, Trip Bucket, typography, cards or sections. Do not overwrite approved Stitch screens.
2. **Finish the B2C Flights journey end to end** as a connected, premium, responsive, accessible product flow using existing components and architecture. Produce real functioning frontend states and integrate existing genuine APIs only when available.
3. **B2B flight experience is a separate, authenticated, role-authorized agency/corporate area.** Reuse a shared design system and underlying flight domain primitives, but never expose net rates, markups, approval queues, credit balances or organization data through a cosmetic B2C/B2B toggle.
4. **Mobile app is a later client of the same domain contracts and design tokens.** Build responsive B2C flight UX now; avoid web-only assumptions in domain models. Do not begin a separate mobile app during this task.
5. No fake fares, mocked live inventory, fake PNR, fake issued ticket, fake payments, fake supplier holds, made-up expiration countdowns, fictional reviews/certification or demo wording presented to end customers. Marketing copy must be service-accurate.
6. The Stitch bundle is **concept/reference material, not final-approved screens**. Preserve visual quality where useful, reconcile contradictions with the approved live homepage, and reject unsupported transactional claims.
7. Never change origin/main, rewrite git history, expose API keys, commit untracked secrets or overwrite historical designs. Candidate builds first; promote to the existing Vercel deployment only after verification and owner review.

## 1. What was actually inspected

ZIP references:

| Stitch export screen | Intended UX purpose | Design adoption | Required correction |
|---|---|---|---|
| `01_vacatina_dual_flight_hub_b2c_b2b_master_portal` | Flight hub / trip search / editorial corridor cards | Premium search composition, route discovery | Do NOT expose B2B pricing via public mode toggle |
| `02_vacatina_flight_search_results_fare_selection_current_1` | Results with filters and fare cards | Filters, flexible results, fare tiers | Do not copy invented options/prices/corporate tools |
| `02_vacatina_flight_search_results_fare_selection_current_2` | Date comparison and fare upgrade | Date strip and comparison | Prices must be supplier-backed; fall back gracefully |
| `02_vacatina_flight_search_results_fare_selection_review` | Refined results concept | Strongest comparison reference; sidebar + result cards + fare families | Remove 'verified', 'guaranteed', synthetic seat/hold countdown and sample customer identity |
| `02b_vacatina_flight_itinerary_breakdown_fare_rules_desk` | Offer itinerary, fare rules, baggage | Segmented details, policy tabs, clear inclusions | Rules and allowances only from actual selected offer |
| `02c_vacatina_multi_city_flight_routing_stopover_hub` | Multi-city and open-jaw | Editable leg sequence / connected itinerary overview | Validate leg count/airport/date direction; show provider-supported capabilities only |
| `03_vacatina_interactive_seat_map_baggage_ancillaries_configurator` | Seat and ancillary configuration | Seat grid, grouped choices, running fare breakdown | Real seat availability, charges and aircraft layouts only when supplied |
| `03b_vacatina_flight_baggage_ancillaries_marketplace` | Extra bags, lounge/fast track | Optional-service hierarchy, totals | Only offer extras actually supported by the provider |
| `04_vacatina_passenger_details_document_verification_desk` | Traveller identity/contact/docs | Form sections and validation grouping | Remove prefilled invented personal data; protect PII |
| `05_vacatina_booking_review_dossier_staging_page` | Trip review & readiness | Final review sections, cross-product summary | No fake confirmed hotel/visa services; review only actual Trip Bucket items |
| `07_vacatina_unified_checkout_secure_payment` | Checkout/payments | Trust, transparent pricing, payment layout | Gate by real payment integration, never fake authorization |
| `08_vacatina_booking_confirmation_unified_dossier_issuance` | Confirmation & documents | Booking summary and post-booking navigation | Render only after persisted successful booking; documents only when issued |
| `09_vacatina_b2b_corporate_travel_management_treasury_desk` | Enterprise B2B operations | Dashboard, approvals, traveler oversight | Separate secured B2B app and verified financial records |

All source screenshots are desktop-width designs (commonly 1600 px height or width). **Mobile states and accessibility require deliberate new design**, not CSS shrinking. Multiple exported HTML files use `href="#"` links and inline pseudo-interactions: never paste these into the application as if functional.

Zip `DESIGN.md` typography: Plus Jakarta Sans for heading/display (600/700/800), Inter for UI/body/forms (400–700), brand primary `#1B1464`, white surfaces, canvas `#FAFAFA`, borders `#E5E5E5`, radius panel 24px, card 16px, control 12px. These agree with the current approved homepage design system; no unsolicited global font change.

Existing repository Flight modules inspected on release branch:

- `src/features/flights/ui/flights-hub-view.ts`
- `src/features/flights/ui/flights-search-view.ts`
- `src/features/flights/ui/flights-offer-detail-modal.ts`
- `src/features/flights/services/flight-search.service.ts`
- `src/features/flights/adapters/supplier-api-flight.adapter.ts`
- `src/features/flights/index.ts`

The supplier adapter still includes `supplier-fixtures.ts` and identifies demo fixtures. **Do not classify that adapter as real supplier-connected live inventory.** Inventory truth must be enforced in domain/API and UI. Before implementing, inspect the full routing registry, Trip Bucket, current tests and any more recent uncommitted local changes.

## 2. B2C Flights complete screen / route inventory (target)

**Do not invent final route names:** reuse existing router contracts whenever present; create the minimum missing deep-linkable routes only after documenting them. Existing known: `/flights`, `/flights/search`, `/flights/offer/:offerId`, `/trip/review`. Checkout and management routes must be discovered from the repository.

1. **Entry / Discovery — `/flights`**: Existing homepage Flight tab opens its form in place; header Flights link navigates to hub. Search one-way, round-trip, multi-city; origin/destination IATA lookup; swap; depart/return; traveller composition with infant and children validation; cabin; advanced options; meaningful search button. Dedicated Flight hub includes search, destination discovery, editorial travel information that is actually supportable, Saved/Favorites and support/enquiry access.
2. **Search Results — `/flights/search`**: Persistent editable search summary, full search validation, skeleton only during actual loading, no-results with edit/retry, errors with retry; sort price/duration/quality only when data supports; filter by non-stop/stops/carriers/time/baggage/refund options, coherent current result count; result offers display operating + marketing carrier where available, departure/arrival local timezone, segments, stopover airports & layover durations, total price/taxes/currency/inclusions, and honest freshness. Result card opens fully deep-linkable Offer Details.
3. **Offer Details — `/flights/offer/:offerId`**: Outbound/inbound segments, fare family comparison, actual baggage allowance, restrictions, ticketing and refund/change rules, itemized total, passenger applicability; accessible modal on desktop may be used while route remains deep-linkable; full-page mobile detail view; back retains filters/scroll/search context.
4. **Multi-City route builder**: Dynamic ordered legs, airport selectors and leg-specific dates, add/remove/reorder with sensible safeguards, clear pricing context, validation for impossible or invalid itineraries, per-leg handling as supported. Open-jaw should be shown only with a documented supported plan; never fabricate interline guarantees.
5. **Configure**: Select eligible fare family, optional seat, bags, meals/assistance and optional services only when inventory/booking provider supports them. For unavailable seat maps, show included seating conditions and skip the interactive seat map; do not draw an invented A330 layout as live inventory. Fare totals update from real offer data, not constants.
6. **Passenger Details**: Correct field groupings for each passenger; lead contact, consent, names matching travel document, DOB/nationality if required, document and loyalty fields only where necessary; input-level validation, useful help text, privacy/security. No prefilled fictional profile. UI retains entered data safely on recoverable errors without logging sensitive details.
7. **Trip Bucket**: Add Draft or Ready depending on completeness. Each item preserves canonical source IDs, search context, selected fare, passenger/configuration state, actual current price/freshness. Edit/Remove/Continue Shopping/Review. Respect all eight Vacatina states: Draft, Needs Action, Ready, Refreshing Price, Price Changed, Recheck Required, Offer Expired, Unavailable. No expired offer becomes Ready.
8. **Trip Review — `/trip/review`**: Real staged items only; flight and cross-product summaries, outstanding requirements, rules, costs, recheck. Permit returning to exact source configuration. Provide genuine next action: authorised checkout (when supported), a real enquiry/quote workflow (when operational), or a truthful unavailability response while preserving a draft.
9. **Checkout / Pay**: Display only genuine configured payment instruments and fees. Real authentication/authorization, idempotency, failure/retry; no fake 'bank wire instantly holds PNR', fake Apple/Google Pay, fake biometric approval. Do not submit real payment without transaction-level safeguards and owner configured credentials.
10. **Confirmation / Manage**: Show confirmed booking reference and issued tickets/vouchers **only after durable successful supplier order**; manage booking, updates, invoices and support according to verified backend permissions. Error after payment requires safe reconciliation, never false success.

For each route/screens design **loading, empty, validation error, network error, unavailable, offer expired, price changed, retry, session expiry, saved draft and back navigation**. Avoid redirect loops, broken browser refresh, duplicate event handlers, stale data and fake confirmation.

## 3. Interaction and animation specification

Animation is a usability enhancement, not decoration:

- 140–220ms tab state and active underline transitions; maintain keyboard roving tab focus and ARIA semantics.
- 180–260ms results filter/sort and fare-details accordion transitions without rerender jank or losing search state.
- 180–300ms mobile filter drawer and seat/details sheet entrance/exit, proper focus trap and escape/outside close.
- Short selected fare/seat/baggage feedback animation with actual computed totals, preserving focus and accessible announcements.
- Real async search loading indicators/skeletons only while pending; never synthetic 15-minute holds or artificial success progress.
- Sticky results action or Trip Bucket action must not cover controls or notch/safe area. Honor existing floating Trip control scroll hide/show rules.
- `prefers-reduced-motion: reduce`: remove nonessential motion, preserve clarity; no forced parallax, no auto-playing animations, no fake time pressure.
- Avoid layout shifts (reserve sizes), maintain target 60fps where practical, no giant animation dependencies if CSS/web platform primitives suffice.

**Screen breakpoints to verify:** 1440, 1280, 1024, 768, 390, 360 CSS pixels. Desktop search/results sidebar; tablet condensed/hybrid layout; mobile one-column summary, filter drawer/sheet, thumb reachable actions, natural seat-grid horizontal pan if seat map available, no horizontal body scrolling.

**Accessibility:** WCAG 2.2 AA targeted; keyboard accessible date/airport/guest widgets, visible focus, meaningful error text, aria-live for search results, 44px targets where practical, appropriate autocomplete labels, focus return on closing overlay, contrast, reduced motion, screen reader text for flight segments.

## 4. Data truth and technology contract

Flight search API boundary (re-use existing domain/services):

`FlightSearchRequest`: trip type, ordered origin/destination IATA codes, leg dates, adult/child/infant counts with birth-age context when needed, cabin, supported filters and optional correlation ID.

`CanonicalFlightOffer`: stable ID, supplier/provider ID (when real), source classification, slices/segments, validating carrier, operating carriers, cabin/fare family, per-passenger inclusions, taxes/total/currency, cancellation/change conditions, optional baggage/seat services with supported status, `expiresAt` or `lastCheckedAt` only when provider supplies them, readiness state.

**State differentiation:** Real supplier offer vs real manual quotation vs internal non-production fixture. Non-production fixtures must never appear on customer-facing search/results. Actual verified manual quotation may appear clearly as request-to-book and may never be called ticketed/held. If no real supplier data or verified quotation exists, return genuine empty/unavailable response or operational enquiry flow (verify enquiry backend first).

**Provider capability matrix:** seat maps, paid baggage, fare brands, cancellation penalties, ticket issuance, seat hold, itinerary revalidation, ancillary availability must be feature-gated per supplier/offer; do not assume all airlines support all services. Duffel documentation, for instance, distinguishes offer requests, offer freshness, available services and seat maps; use live provider payloads and feature availability rather than generic claims.

No new backend or database system during this frontend-first task, but do not bypass existing typed API boundaries. If hosted backend unavailable, finish polished UX with honest states and integration readiness without fake live data or fake successful actions. Log missing credentials/configuration as blocking operational dependencies separately from completed UX work.

## 5. B2B + future mobile separation

- B2C: customer total price, travel options, passenger/trip management, support.
- B2B: secured agency/corporate entry, roles, organizational pricing/markup, booking policy, approval, credit and audit screens **only after permission checks on server**; **not** a cosmetic public tab. Reuse flight models, fare comparison visual primitives and service adapters, but validate price visibility server-side.
- Mobile: reusable journey/domain APIs, design tokens, saved search/query state and trip state; do not fork business logic into a disconnected mobile implementation now. Mobile web must be complete at each B2C milestone.

## 6. Implementation sequencing — execute, do not stop at reports

0. Inventory current repository, tests, route registry, live homepage baseline screenshots, local uncommitted changes. Generate source/target map and a short implementation backlog, **then proceed to code**.
1. Flight Hub/search UX + query state + validation + mobile responsive. Preserve homepage integration; do not rebuild homepage.
2. Search results and detailed fare compare/itinerary/fare rules + real filtering/sorting/no results/error states.
3. Multi-city + provider-correct configuration, seat/bag/ancillary UX and passenger detail forms.
4. Trip Bucket/Review/Checkout eligibility/confirmed-only post-booking UX with honest API gating.
5. Mobile and accessibility audit, browser E2E paths, screenshot regression baselines; B2B design-domain handoff only, not a broad B2B rewrite.
6. Build candidate preview in existing project, owner visually verifies, then approved production promotion with rollback.

**No full-feature acceptance until each step is implemented in existing code, visually checked and browser-tested.** If credentials block actual payment/booking, mark operational workflow `BLOCKED_BY_INTEGRATION`; do not label the product fully live. But finish all genuinely implementable UX/screens before declaring frontend stage done.

## 7. Hard acceptance gates

- Homepage pixel/functional regression: **none**. 11 tabs, taxonomy, typography, Trip Bucket behavior unchanged.
- B2C flights: round-trip, one-way, multi-city, search validation, results sort/filter, details, fare rules, supportable options, passenger forms, bucket review, recovery, deep links/refresh/back all work.
- Guest & authenticated states handled; no demo customer names visible; B2B/organization pricing never leaks.
- No blank screens, `href="#"`, dead buttons, fake prices, fake holds, fake payments or fictitious issued tickets.
- Real supplier and hosted backend capabilities truthfully reflected; existing working contracts/tests remain intact.
- Keyboard, screen reader, reduced motion, mobile widths, contrast, loading/error/empty done; screenshot evidence at 1440/768/390/360.
- Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (plus specific Flight tests); report exact failures, not just pass-count.
- Candidate deployment test in existing Vercel project, report deployment ID, changed file list, exact screenshots and remaining true integration dependencies. Promotion only under owner's approved release procedure.

## 8. Primary benchmark references (patterns, not copying)

- Google Flights — flight discovery, flexible dates, price tracking and alternate date UX: https://www.google.com/travel/flights/english ; https://support.google.com/travel/answer/7664728
- Duffel offer requests (airline search truth): https://duffel.com/docs/api/v2/offer-requests
- Duffel seat/baggage capability gating: https://duffel.com/docs/guides/ancillaries-component
- Preserve unique Vacatina branding, Trip Bucket, journey orchestration and use policy-compliant original visual assets. Do not clone competitors' copyrighted layout, text, imagery or brand identity verbatim.

## 9. Execution report template

Provide after code changes: current files reused, screen list and routes implemented, B2C journey status, animations/a11y, screenshot paths, tests, homepage non-regression evidence, real operational dependencies, candidate URL and deployment ID. Every claim must be verifiable in source or browser; do not report a mocked flow as live.
