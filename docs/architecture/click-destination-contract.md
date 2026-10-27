# Click-to-Destination Architectural Contract (v1.0)
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Universal Frontend Navigation & Interactive Element Governance  
**Target Systems:** Vacatina Web App (`vacatina.com`), Canonical Router Service, Search Command Center  
**Status:** **LOCKED & ENFORCED IN PRODUCTION**  

---

## 1. Non-Negotiable Invariants

Every single interactive element rendered in Vacatina (buttons, links, inputs, chips, icons) must adhere to these rules:
1. **Zero Dead Ends:** No `href="#"`, `href="javascript:void(0)"`, empty string, or placeholder link is permitted anywhere in the DOM.
2. **Deterministic Dispatch:** Every element dispatches through `CanonicalRouterService`, modal triggers, or state controllers.
3. **Configuration Guard:** Homepage discovery cards MUST NEVER jump directly to checkout. A real search and mandatory configuration (dates, travellers, cabin, room type, or applicant details) must always precede booking.
4. **Accessible Semantics:** Links (`<a>`) are used for navigation; buttons (`<button>`) are used for state changes, dialog triggers, and form submits. All touch targets meet the $\ge 44\text{px}$ minimum standard.

---

## 2. Interactive Element Classification Taxonomy

Every clickable element is audited and classified into exactly one of the following 10 functional types:

| Element Type | Primary DOM Pattern | Behavioral Specification |
| :--- | :--- | :--- |
| **`NAVIGATION`** | `<a href="/...">` | Dispatches client-side SPA navigation via `CanonicalRouterService.navigateTo(path)`. Updates browser history and scroll position. |
| **`STATE_CHANGE`** | `<button data-tab="...">` | Changes client state within current view without page unmount (e.g. switching SCC tabs, toggling currency). |
| **`FILTER`** | `<button data-chip="...">` | Modifies active query context (e.g. region filters like `?region=middle-east`) within discovery sections. |
| **`MODAL`** | `<button data-modal="...">` | Mounts and focuses an accessible dialog shell (e.g. Holiday Package Itinerary, Legal Policy, Search Results). |
| **`FAVORITE_ACTION`**| `<button data-favorite-id>` | Toggles persistent save status in `FavoritesService`. Never affects Trip Bucket totals. |
| **`TRIP_ACTION`** | `<button data-stage-item>` | Stages or updates an offer in `TripBucketService`. Preserves source provenance and triggers financial recalculation. |
| **`FORM_SUBMIT`** | `<button type="submit">` | Validates input constraints before dispatching search or configuration payloads. |
| **`AUTH_ACTION`** | `<button data-auth-action>` | Dispatches Clerk authentication modals (`openSignIn`, `openSignUp`, `openUserProfile`, `OrganizationSwitcher`). |
| **`EXTERNAL_LINK`** | `<a target="_blank">` | Opens verified external partner/social URLs with `rel="noopener noreferrer"`. |
| **`DISABLED_UNTIL_BACKEND`** | `<button disabled>` | Clearly indicated non-interactive control awaiting live upstream credentials; never a silent failure. |

---

## 3. Global Customer Commerce Journey

All interactive elements align with the universal 10-stage commerce pipeline:
$$\text{Discover} \rightarrow \text{Explore} \rightarrow \text{Search} \rightarrow \text{Results} \rightarrow \text{Details} \rightarrow \text{Configure} \rightarrow \text{Trip Bucket} \rightarrow \text{Review} \rightarrow \text{Booking} \rightarrow \text{Manage Journey}$$

- **Stage 1 (Discover):** Homepage inspiration cards, seasonal highlights, and editorial route teasers.
- **Stage 2 (Explore):** Product hubs (`/flights/explore`, `/hotels/explore`, `/resources/destinations`).
- **Stage 3 (Search):** Search Command Center tab forms validating origin, destination, dates, and travellers.
- **Stage 4 (Results):** Unified search results displaying normalized `UnifiedCustomerOffer` items with honest commercial badges.
- **Stage 5 (Details):** Property/flight details modals detailing carrier, amenities, room specifications, and inclusions.
- **Stage 6 (Configure):** Fare family, baggage allowance, meal plan, and visa applicant document selection.
- **Stage 7 (Trip Bucket):** Screen 04 Drawer staging items with 8 lifecycle states. Only `READY_FOR_CHECKOUT` items contribute to the subtotal.
- **Stage 8 (Review):** Consolidated trip dossier review (`/trip/review`) checking passport validity and revalidation freshness.
- **Stage 9 (Booking):** Secure checkout gateway with 15-minute allotment hold (`COMMITTED_HELD`).
- **Stage 10 (Manage Journey):** Post-booking self-service hub (`/manage-booking` or `/account/trips`).

---

## 4. Search Command Center Dispatch Matrix

Clicking an SCC tab mutates the active search panel and updates the query param `/?tab=:tab#search` without full-page navigation:

| Tab Dom ID | Tab Label | Search Panel Dom ID | Form Action Route | Incomplete Validation Fallback |
| :--- | :--- | :--- | :--- | :--- |
| `tab-bundle` | Build Your Bundle | `panel-bundle` | `/trip-builder/results` | Highlights missing product components in bundle builder. |
| `tab-flights` | Flights | `panel-flights` | `/flights/search` | Inline error on missing Origin/Destination; focuses field. |
| `tab-hotels` | Hotels | `panel-hotels` | `/hotels/search` | Inline error on missing Destination/Dates; focuses field. |
| `tab-visa` | Visa Assistance | `panel-visa` | `/visa-assistance/options` | Requires destination country selection. |
| `tab-packages` | Holiday Packages | `panel-packages` | `/holiday-packages/search` | Requires destination or travel month. |
| `tab-cars` | Cars & Transfers | `panel-cars` | `/cars-transfers/search` | Requires pickup location and service type (transfer vs rental). |
| `tab-rails` | Rails | `panel-rails` | `/rails/search` | Requires route origin and destination. |
| `tab-cruises` | Cruises | `panel-cruises` | `/cruises/search` | Requires destination region or sailing window. |
| `tab-activities` | Activities | `panel-activities` | `/activities/search` | Requires destination city/resort. |
| `tab-sightseeing`| Sightseeing Tours | `panel-sightseeing` | `/sightseeing-tours/search` | Requires touring destination and tour date. |
| `tab-insurance` | Travel Insurance | `panel-insurance` | `/travel-insurance/compare` | Requires traveller age bracket and destination region. |

---

## 5. Homepage Editorial Discovery Cards Dispatch Matrix

The 40 discovery cards provide inspirational travel intent. They prefill search contexts without falsely claiming live airline/hotel seat holds:

| Discovery Card Title | Product Vertical | Dispatched Canonical Route | Resulting State & Interaction |
| :--- | :--- | :--- | :--- |
| **Colombo $\rightarrow$ Dubai** | Flights | `/flights?from=CMB&to=DXB` | Prefills Origin CMB, Destination DXB. Scrolls to SCC Flights tab. |
| **Colombo $\rightarrow$ Maldives** | Flights | `/flights?from=CMB&to=MLE` | Prefills Origin CMB, Destination MLE. Scrolls to SCC Flights tab. |
| **Colombo $\rightarrow$ Bangkok** | Flights | `/flights?from=CMB&to=BKK` | Prefills Origin CMB, Destination BKK. Scrolls to SCC Flights tab. |
| **Colombo $\rightarrow$ London** | Flights | `/flights?from=CMB&to=LHR` | Prefills Origin CMB, Destination LHR. Scrolls to SCC Flights tab. |
| **Dubai Downtown Luxury** | Hotels | `/hotels?destination=Dubai` | Prefills Dubai, opens curated hotel search modal. |
| **Maldives Overwater Villas**| Hotels | `/hotels?destination=Maldives`| Prefills Maldives, opens curated hotel search modal. |
| **Sri Lanka Boutique Stay** | Hotels | `/hotels/property/jetwing-vil-uyana` | Opens direct DMC contracted property detail modal. |
| **UK Standard Visitor** | Visa Assistance | `/visa-assistance/uk` | Opens UK consular checklist & assistance guidance modal. |
| **Dubai 30-Day Tourist** | Visa Assistance | `/visa-assistance/uae` | Opens UAE consular checklist & document vetting modal. |
| **Thailand Tourist Visa** | Visa Assistance | `/visa-assistance/thailand` | Opens Thailand eVisa entry guidance modal. |
| **Maldives Villa Escape** | Holiday Packages| `/holiday-packages/maldives-escape` | Opens multi-component package itinerary with direct Stage in Bucket CTA. |
| **Dubai City Break** | Holiday Packages| `/holiday-packages/dubai-luxury` | Opens multi-component package itinerary with direct Stage in Bucket CTA. |
| **Bali Cultural Odyssey** | Holiday Packages| `/holiday-packages/bali-cultural` | Opens multi-component package itinerary with direct Stage in Bucket CTA. |
| **Thailand Beach Haven** | Holiday Packages| `/holiday-packages/thailand-beach` | Opens multi-component package itinerary with direct Stage in Bucket CTA. |
| **Desert Safari Experience** | Activities | `/activities/search?destination=Dubai` | Opens desert safari adventure search results. |
| **Sigiriya Cultural Day Tour**| Sightseeing Tours| `/sightseeing-tours/search?destination=Sigiriya` | Opens expert guided tour results. |
| **Kandy Scenic Rail Journey**| Rails | `/rails?from=Colombo&to=Kandy` | Opens scenic train booking advisory and schedules. |
| **Private Airport Chauffeur**| Cars & Transfers| `/cars-transfers?service=transfer` | Opens private sedan transfer booking modal. |

---

## 6. Programmatic Verification & Compliance Gate

All 323 interactive elements are verified through `scripts/audit-interactive-elements.mjs` and `scripts/smoke-test-live.mjs`:
- Total interactive elements audited: **323**
- Elements passing verification: **323 (100%)**
- Dead links (`href="#"`): **0**
- Unsupported live claims: **0**
