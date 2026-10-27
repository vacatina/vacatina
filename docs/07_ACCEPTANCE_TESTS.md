# 07 — Acceptance Tests (`07_ACCEPTANCE_TESTS.md`)

All acceptance tests required by `06_ANTIGRAVITY_MASTER_INSTRUCTION.md` §10:

1. **Brand & Typography Authority (`DESIGN v4`):**
   - `#1B1464` (Space Cadet Navy) is the sole brand-primary token (`#0071BC` is absent from runtime styles).
   - Only `Plus Jakarta Sans` and `Inter` fonts are loaded/used; `tabular-nums` is enforced on all prices, dates, durations, counts, and subtotals.
2. **Navigation Breakpoint (`1440px`):**
   - At `1440px` (`>= 1440px`), desktop navigation (`#desktop-nav`) is visible and hamburger button (`#mobile-menu-btn`) is hidden.
   - At `1280px`, `768px`, and `360px` (`< 1440px`), desktop navigation is hidden and hamburger button is visible.
3. **Desktop Navigation & `More` Menu:**
   - Top-level items: `Home`, `Flights`, `Hotels`, `Visa Assistance`, `Holiday Packages`, `Cars & Transfers`, `More`, `Resources`.
   - `More` menu contains **only** the 5 remaining products: `Activities`, `Sightseeing Tours`, `Rails`, `Cruises`, `Travel Insurance` (never `Build Your Bundle`).
4. **Search Command Center (11 Tabs + Keyboard Roving Tabindex):**
   - All 11 tabs render in the locked order (`Build Your Bundle`, `Flights`, `Hotels`, `Visa Assistance`, `Holiday Packages`, `Cars & Transfers`, `Rails`, `Cruises`, `Activities`, `Sightseeing Tours`, `Travel Insurance`).
   - Clicking any tab or using `ArrowRight`, `ArrowLeft`, `Home`, `End` switches the active tab (`aria-selected="true"`, `tabindex="0"`) and displays its dedicated search panel.
5. **Traveller & Cabin Selector Validation:**
   - Enforces `Adults >= 1`, `Total passengers <= 9`, and `Infants <= Adults` (auto-adjusting infants with a clear message if adults are reduced below infants).
6. **10 Product Discovery Sections:**
   - All 10 product sections (`Popular Flights`, `Visa Assistance`, `Holiday Packages`, `Recommended Stays`, `Popular Activities`, `Sightseeing Tours`, `Cars & Transfers`, `Cruises & Sea Voyages`, `Rail Journeys`, `Travel Insurance`) have working category filter pills (`role="radiogroup"`), working Favorite toggles (`aria-pressed`), and working exploration CTAs that prefill the corresponding search tab or open product configuration.
   - Zero discovery cards add unconfigured items directly to the Trip Bucket.
7. **Holiday Package Details Modal & Product Configuration Modal:**
   - Clicking `View Details` on any Holiday Package card opens `#holiday-package-details-modal` with the package's itinerary, inclusions, price, focus trap, `Escape` close, and focus restoration.
   - Clicking `Customize in Search` prefills the `Holiday Packages` tab; clicking `Configure & Stage to Trip Bucket` allows staging a configured candidate into the Trip Bucket.
8. **Trip Bucket 8-State Engine & Financial Math:**
   - Default baseline shows 3 items (`CMB → DXB Flight` Ready `LKR 248,500`, `Jumeirah Creekside Hotel` Ready `LKR 256,500`, `UAE 30-Day e-Visa` Needs Action `LKR 45,000`).
   - Ready items estimate equals `LKR 505,000` (excluding the `LKR 45,000` Needs Action item).
   - Interactive actions resolve `Needs Action`, `Price Changed`, `Recheck Required`, `Draft`, `Offer Expired`, and `Unavailable` states, and the Screen 04 8-State Inspector showcases all 8 canonical states.
9. **Responsive & Accessibility Guardrails:**
   - Zero horizontal overflow (`scrollWidth <= clientWidth`) at `360px`, `768px`, `1280px`, and `1440px`.
   - Zero console or page runtime errors.
   - All interactive controls meet the `44×44px` minimum touch target size.
