# 03 — Functional Flows (`03_FUNCTIONAL_FLOWS.md`)

**Authority Rank:** 5 (Runtime behavior authority alongside `04_DATA_STATE_MODEL.md`)

## 1. Search Command Center Flow (11 Tabs)
1. **Tab Order:**
   1. `Build Your Bundle`
   2. `Flights`
   3. `Hotels`
   4. `Visa Assistance`
   5. `Holiday Packages`
   6. `Cars & Transfers`
   7. `Rails`
   8. `Cruises`
   9. `Activities`
   10. `Sightseeing Tours`
   11. `Travel Insurance`
2. **Keyboard Accessibility:** Full ARIA `role="tablist"` with roving `tabindex` (`0` on active tab, `-1` on inactive tabs) supporting `ArrowRight`, `ArrowLeft`, `Home`, `End`, `Enter`, and `Space`.
3. **Traveller & Cabin Selector Rules:**
   - `Adults >= 1` (minimum 1 adult required).
   - `Total passengers <= 9` (`Adults + Children + Infants <= 9`).
   - `Infants <= Adults` (1 infant per adult lap rule; if adults decrease below infants, infants auto-adjust and display a clear helper message).
   - Cabin class selector (`Economy`, `Premium Economy`, `Business`, `First`) shown for `Flights` and `Build Your Bundle`.

## 2. Discovery Card → Search / Configuration → Trip Bucket Flow
- Discovery cards **never** add unconfigured products directly into the Trip Bucket (`+ Add to Bucket` on static discovery cards is prohibited).
- Every discovery card supports:
  1. **Favorite Toggle (`♡`):** Updates `aria-pressed="true|false"` and persists to the Saved Favorites drawer without mutating the Trip Bucket.
  2. **Category Filter Pills:** Accessible `role="radiogroup"` / `role="radio"` with `aria-checked`, keyboard navigation, and dynamic visible card count badge.
  3. **Primary Exploration CTA (`Explore Route`, `Check Visa Requirements`, `View Details`, `View Stays`, `Explore Activity`, `Explore Tour`, `Explore Transfer`, `Explore Voyage`, `Explore Journey`, `Compare Coverage`):**
     - Prefills the corresponding Search Command Center tab and scrolls smoothly to `#search-command-center`, OR opens the interactive **Product Configuration & Rate Selection Drawer/Modal** where the user configures dates/passengers/options and explicitly stages the configured item into the **Trip Bucket**.

## 3. Trip Bucket Revalidation & Review Flow
- **Header & Floating Dock Sync:** Header badge, Floating Trip Dock (`Your Trip (N items)`), and Slide-Over Trip Bucket Drawer remain 100% synchronized.
- **Floating Dock Scroll Rule:** Uses passive scroll listener + `requestAnimationFrame` with a `10px` threshold (hides on downward scroll when no drawer/modal is open; reveals on upward scroll or near top of page).
- **8-State Resolution:**
  - `Draft` → `Complete Selection` opens configuration modal to promote item to `Ready`.
  - `Needs Action` → `Upload Passport Copy` / `Complete Details` resolves mandatory checklist and promotes item to `Ready` (updating the Ready subtotal).
  - `Price Changed` → Shows previous price vs. updated price; user must click `Accept Updated Price` (never silently auto-accepted).
  - `Recheck Required` → `Recheck Availability` triggers `Refreshing Price` spinner and transitions to `Ready` or `Price Changed`.
  - `Offer Expired` / `Unavailable` → `Find Replacement` / `Browse Alternatives` swaps or removes the item.
- **Primary Action:** `Review Trip` opens the **Unified Trip Dossier Review & Checkout Workspace**, separating `Ready` items from non-ready items and providing live `Revalidate Rates & Availability` simulation.
