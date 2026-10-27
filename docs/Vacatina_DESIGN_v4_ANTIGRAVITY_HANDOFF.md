---
version: "3.0"
name: "Vacatina Master Design System"
description: "Authoritative design DNA for the Vacatina Travel & Tourism B2C web experience and its homepage, product discovery, Trip Bucket, responsive shell, accessibility, trust, and journey-continuity patterns."
omitted: []
colors:
  brand-primary: "#1B1464"
  canvas: "#FAFAFA"
  surface: "#FFFFFF"
  surface-subtle: "#F5F5F5"
  text-primary: "#000000"
  text-muted: "#525252"
  border: "#E5E5E5"
  success: "#15803D"
  warning: "#B45309"
  error: "#B91C1C"
  info: "#1D4ED8"
  focus: "#1D4ED8"
typography:
  display-desktop:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: "64px"
    letterSpacing: "-0.03em"
  display-mobile:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: "44px"
    letterSpacing: "-0.02em"
  heading-xl:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: "48px"
    letterSpacing: "-0.02em"
  heading-lg:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  heading-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "0"
  title:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "0"
  body-lg:
    fontFamily: "Inter"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0"
  body-sm:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  label:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0"
  label-sm:
    fontFamily: "Inter"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.01em"
rounded:
  control: "12px"
  card: "16px"
  panel: "24px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand-primary}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  major-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Overview

Vacatina is a premium, trustworthy travel decision-and-journey platform. It must not feel like a generic OTA catalogue or a retail shopping cart. The experience should support the complete traveller journey:

**Discover → Search → Compare → Plan → Configure → Build Trip → Book → Prepare → Travel → Manage → Get Support**

The design language is clean, premium, calm, travel-led, content-rich without feeling dense, and optimized for clarity, confidence, and task completion.

## Authoritative locked references

Use these screen names exactly:

- `Screen 03 Foundation v1.1 Final Interaction — LOCKED`
- `Screen 04 Trip Bucket Component States v1.2 — LOCKED`
- `Screen 05 Homepage Popular Flights v1.0 — LOCKED`
- `Screen 06 Homepage Visa Assistance v1.0 — LOCKED`
- `Screen 07 Homepage Holiday Packages v1.0 — LOCKED`

`Screen 02` is deleted and must not be recreated, restored, or used as a design source.

### Reference responsibilities

- **Screen 03** — authoritative global Design DNA, app shell, header, navigation, Search Command Center, responsive behavior, accessibility, and interaction language.
- **Screen 04** — authoritative Trip Bucket states and behavioral contract.
- **Screen 05** — authoritative Popular Flights homepage section.
- **Screen 06** — authoritative Visa Assistance homepage section.
- **Screen 07** — authoritative Holiday Packages homepage section.

Future screens must inherit this system. A LOCKED screen must never be redesigned, regenerated, overwritten, or silently renamed.

## Product architecture

Vacatina has **10 travel products**:

1. Flights
2. Hotels
3. Visa Assistance
4. Holiday Packages
5. Cars & Transfers
6. Rails
7. Cruises
8. Activities
9. Sightseeing Tours
10. Travel Insurance

Vacatina also has one cross-product orchestration feature:

- **Build Your Bundle**

Build Your Bundle is not an eleventh travel product. It is the trip-composition entry point that can combine relevant configured products into one journey.

## Search Command Center

The Search Command Center has **11 primary tabs**, in this exact order:

1. Build Your Bundle
2. Flights
3. Hotels
4. Visa Assistance
5. Holiday Packages
6. Cars & Transfers
7. Rails
8. Cruises
9. Activities
10. Sightseeing Tours
11. Travel Insurance

Sightseeing Tours and Travel Insurance are first-class primary search tabs. They must not be hidden inside another tab panel.

## Desktop navigation

Use this exact top-level desktop navigation:

**Home | Flights | Hotels | Visa Assistance | Holiday Packages | Cars & Transfers | More | Resources**

`More` contains exactly:

- Activities
- Sightseeing Tours
- Rails
- Cruises
- Travel Insurance

Never place Build Your Bundle inside `More`.

## Responsive navigation rule

- **1440px and above:** desktop navigation is visible.
- **Below 1440px:** use the approved hamburger/mobile navigation pattern.
- Never introduce a `1535px` navigation breakpoint.

## Homepage experience model

The homepage should feel like one continuous travel journey rather than unrelated stacked card sections.

Use these macro experience zones:

1. **Intent & Search**
2. **Primary Discovery**
3. **Decision Intelligence**
4. **Trust & Confidence**
5. **Journey Continuity**
6. **Retention & Information**

The current layered build process may create these incrementally, but the final experience must remain visually and behaviorally coherent.

# Colors

The Vacatina palette is intentionally restrained. Use brand navy for identity and strong structure, neutrals for most surfaces, and semantic colors only when they communicate real state.

## Core palette

- **Space Cadet Navy (#1B1464)** — primary brand color, primary actions, selected states, important structural anchors, and approved high-emphasis regions.
- **Pure White (#FFFFFF)** — cards, elevated panels, input surfaces, and text on brand-primary where contrast is sufficient.
- **Canvas Mist (#FAFAFA)** — primary page canvas.
- **Subtle Cloud (#F5F5F5)** — low-emphasis containers, filters, chips, grouped controls, and background separation.
- **True Black (#000000)** — primary text where appropriate.
- **Muted Graphite (#525252)** — secondary copy, metadata, helper text.
- **Hairline Grey (#E5E5E5)** — restrained 1px borders and dividers.

## Semantic palette

- **Ready Green (#15803D)** — success and ready/completed states.
- **Action Amber (#B45309)** — warnings, needs-action states, caution.
- **Critical Red (#B91C1C)** — errors, expired, unavailable, destructive states.
- **Information Blue (#1D4ED8)** — information, accessible focus rings, neutral system emphasis.

Semantic colors must communicate meaning. Do not use them as arbitrary decoration.

## Color behavior

- Prefer light neutral surfaces across the homepage.
- Use #1B1464 selectively for strong structure, active emphasis, and approved brand moments.
- Maintain WCAG-aware contrast for text and controls.
- Do not create alternating dark sections merely for visual variety.
- Do not use a second brand palette.

## Prohibited color/style drift

Do not introduce:

- `#0071BC`
- legacy Material color systems
- random cyan/teal/purple accent palettes
- neon effects
- decorative multicolor gradients
- heavy glassmorphism
- fake glow effects

# Typography

Vacatina uses exactly two font families.

## Heading family

**Plus Jakarta Sans**

Use for:

- hero/display headings
- section headings
- card titles
- important journey labels
- major modal/drawer titles

Recommended hierarchy:

- Display desktop: 56/64, 800
- Display mobile: 36/44, 800
- H2 / large section: 40/48, 700
- H3: 28/36, 700
- H4: 22/28, 600
- Title: 18/24, 600

Use slightly tighter tracking on large display text only.

## Functional family

**Inter**

Use for:

- body copy
- navigation
- tabs
- buttons
- filters
- labels
- form controls
- metadata
- prices
- dates
- times
- traveller counts
- status text

## Numeric discipline

Use `font-variant-numeric: tabular-nums` for:

- prices
- dates where alignment matters
- times
- durations
- traveller counts
- totals
- status quantities

## Font prohibitions

Never introduce:

- Google Sans
- Google Sans Flex
- Roboto
- Poppins
- Raleway
- Hanken Grotesk
- JetBrains Mono
- Figtree
- Quicksand
- Moderna

Do not use a monospace family for product prices or UI data. Inter with tabular numerals is the standard.

# Layout

## Global shell

- Sticky global header height: approximately **76px**.
- Use a centered wide desktop content container, approximately **1360px max-width**, while allowing selected hero/background regions to span full width.
- Desktop gutters should feel generous; mobile gutters must remain compact and usable.
- Preserve a clear visual hierarchy between shell, search, discovery, decision support, trust, and post-booking tools.

## Spacing rhythm

Base spacing unit: **4px**.

Primary rhythm:

- 4px — micro alignment
- 8px — tight icon/text spacing
- 12px — compact control spacing
- 16px — default internal spacing
- 20px — card padding where compact
- 24px — standard card/panel padding
- 32px — group separation
- 40px — larger internal zone separation
- 48px — section intro separation
- 64px — standard desktop section vertical spacing
- 80px — major journey-stage separation when needed

Use spacing to communicate hierarchy. Avoid equal spacing everywhere.

## Header structure

Desktop header:

- Left: Vacatina brand identity.
- Center: approved navigation.
- Right: relevant journey/account utilities from the locked Foundation.

Do not overload the header with marketing claims.

## Hero and Search Command Center

The hero must prioritize travel intent and search.

The Search Command Center is a major panel with approximately **20–24px** outer corner radius. Search controls use approximately **10–12px** corner radius.

The search experience must:

- keep the 11 primary tabs intact
- use clear active/inactive state contrast
- preserve keyboard navigation
- avoid horizontal clipping
- progressively adapt on smaller screens
- keep product-specific controls inside their correct tab panels

## Discovery cards

Discovery cards are for exploration, not immediate checkout.

A discovery card may include:

- destination/product image
- product title
- concise decision-relevant metadata
- starting price when supported
- Save/Favorite
- View Details / Explore / Configure action

A discovery card must not add an unconfigured product directly to the Trip Bucket.

Do not use direct `Reserve`, `Checkout`, or `Add to Trip Bucket` actions when required dates, travellers, room type, departure slot, cabin class, or other required configuration is missing.

## Trip Bucket

Trip Bucket is a journey-composition workspace, not a shopping cart.

Favorites remain separate.

Canonical state language comes from Screen 04 and includes:

- Draft
- Needs Action
- Ready
- Refreshing Price
- Price Changed
- Recheck Required
- Offer Expired
- Unavailable

### Reference state example

The locked reference may use:

- Flight — Ready — LKR 248,500
- Hotel — Ready — LKR 256,500
- Visa Assistance — Needs Action — LKR 45,000
- Ready subtotal — LKR 505,000
- Visa excluded from ready subtotal until complete

These are reference-state values, not production pricing guarantees.

### Drawer behavior

Desktop:

- right-side drawer approximately 440–480px wide

Mobile:

- full-screen or bottom-sheet treatment appropriate to the approved Foundation

When open:

- triggering control sets `aria-expanded="true"`
- dialog/drawer uses correct `aria-hidden` state
- background content becomes inert
- focus moves inside
- Tab / Shift+Tab are trapped
- Escape closes
- closing restores focus to the exact origin control

### Floating Trip Bucket scroll behavior

- visible near top
- hide after meaningful scroll down
- return when scrolling up
- return near top
- use passive scroll handling plus `requestAnimationFrame`
- use approximately 10px movement threshold
- do not cover critical page navigation or content
- closing/resetting restores a clean scroll anchor

## Traveller selector

Support:

- Adults
- Children
- Infants

Rules:

- Adults minimum = 1
- Total travellers maximum = 9
- Infants cannot exceed Adults

Flights additionally support:

- Economy
- Premium Economy
- Business
- First

Selector behavior must include Apply, Cancel, Escape, focus management, and focus return.

## Homepage architecture

Final homepage should support these structural areas in journey order:

### Intent & Search
- Global Header
- Hero / travel intent
- 11-tab Search Command Center
- Trip Bucket / journey-context anchor

### Primary Discovery
- Popular Flights
- Visa Assistance
- Holiday Packages
- Recommended Hotels
- Activities
- Sightseeing Tours
- Cars & Transfers
- Cruises
- Rail Journeys
- Travel Insurance

### Decision Intelligence
- Seasonal Destination Guide
- decision-support patterns such as requirements, inclusions/exclusions, maps, reviews, cancellation information, and freshness indicators where supported

Do not implement a fake live weather or telemetry dashboard.

### Trust & Confidence
- Why Vacatina / Travel Confidence
- verified licences and accreditations
- payment and security confidence
- verified partners/brands only when genuine and authorized

### Journey Continuity
- Manage Your Journey
- Saved Travel / Favorites
- customer support / human assistance

### Retention & Information
- newsletter / travel updates
- full enterprise footer
- legal bar

## Footer

Footer should be comprehensive but not visually overpower the journey.

Reserve information architecture for:

- Products
- Company
- Help & Support
- Resources
- Legal

Product links should cover all 10 travel products.

Legal utility can include:

- Privacy Policy
- Terms & Conditions
- Cookie Preferences
- Accessibility
- Security

Footer legal bar:

**© 2026 Vacatina. All Rights Reserved.**

Only display payment brands, accreditations, regulatory marks, or partner logos that are genuinely supported and authorized.

# Elevation & Depth

Vacatina uses restrained depth.

## Standard elevation

- Most cards: flat or near-flat with a 1px #E5E5E5 border.
- Interactive cards: subtle hover lift only.
- Major floating surfaces: soft, low-opacity shadow.
- Dialogs and drawers: stronger but still diffused shadow to establish modal hierarchy.

## Visual character

Use:

- clean surface separation
- restrained diffused shadows
- clear borders
- consistent hover/focus changes

Avoid:

- heavy drop shadows
- dramatic floating-card effects everywhere
- glossy surfaces
- neon glows
- excessive blur
- persistent glass panels

Motion should reinforce hierarchy, not create spectacle.

# Shapes

Vacatina uses a controlled geometry system.

## Controls

Approximately **10–12px** corner radius.

Use for:

- buttons
- inputs
- dropdown triggers
- selectors
- compact action surfaces

## Cards

Approximately **16px** corner radius.

Use for:

- product cards
- discovery cards
- standard information cards
- decision-support modules

## Major panels

Approximately **20–24px** corner radius.

Use for:

- Search Command Center
- large itinerary/journey panels
- drawers where visually appropriate
- major grouped sections

## Pills

Use fully pill-shaped geometry only for:

- filters
- compact statuses
- small chips
- short category selectors

Do not make every control pill-shaped.

## Borders

- Standard border: 1px #E5E5E5
- Use semantic border colors only for meaningful state
- Avoid decorative multi-color borders

# Components

## Primary button

Character: confident, high-contrast, clean.

- Background: #1B1464
- Text: #FFFFFF
- Height: minimum 44px
- Radius: 10–12px
- Inter 600
- Clear hover, active, disabled, and focus states
- Accessible focus ring using #1D4ED8

Do not use gradients.

## Secondary button

- White or subtle neutral surface
- #1B1464 label
- restrained border
- same height/radius family as primary

## Destructive action

Use #B91C1C only when the action is actually destructive.

Never use red merely to increase conversion pressure.

## Tabs

Primary search tabs:

- semantic `tablist`, `tab`, `tabpanel`
- active state must be visually obvious without relying only on color
- keyboard reachable
- correct `aria-selected` and panel relationship
- 11 primary tabs must remain intact

## Filter chips

- compact pill geometry
- Inter 600
- active state uses clear contrast
- avoid excessive chip rows on small screens

## Cards

Card content hierarchy:

1. Visual
2. Product/destination identity
3. decision-relevant metadata
4. status or requirement where necessary
5. price or starting price only when supported
6. exploration/configuration action
7. Save/Favorite action when useful

Cards must remain readable without depending on hover.

## Images

Use the Vacatina premium image library.

Image direction:

- realistic
- editorial-quality
- premium but believable
- destination-relevant
- natural light
- clean composition
- responsive crop-safe
- no embedded text
- no watermarks
- no fake logos
- no malformed people/vehicles/architecture

Do not regenerate random replacement imagery when an approved relevant asset already exists.

## Status badges

Use icon + text where status is important.

Never communicate important state using color alone.

Approved semantic mapping:

- Ready / Success → #15803D
- Needs Action / Warning → #B45309
- Error / Expired / Unavailable → #B91C1C
- Information / Refreshing → #1D4ED8

## Dialogs, drawers, mobile navigation

Every modal surface must:

- use `role="dialog"` when appropriate
- use `aria-modal="true"` where modal
- have an accessible name
- manage `aria-expanded` on its exact trigger
- store the exact origin trigger
- move focus inside on open
- trap Tab / Shift+Tab
- close with Escape
- close through the approved backdrop interaction where appropriate
- make background shell inert while open
- prevent unintended background scroll
- restore inert state and body scroll on close
- return focus to the exact origin trigger

Do not use mismatched DOM IDs between markup and controllers.

## Accessibility baseline

- Minimum interactive target: approximately 44×44px
- Visible keyboard focus
- Logical heading hierarchy
- Semantic landmarks
- Adequate contrast
- Useful alt text for meaningful images
- Decorative images/icons hidden from assistive technology where appropriate
- Error messages linked to affected controls
- Do not rely on placeholders as labels
- Reduced-motion behavior for nonessential animations

## Copy and content behavior

Customer-facing language must be:

- clear
- concise
- provider-agnostic unless a verified supplier relationship is intentionally shown
- honest about availability and approval uncertainty

Preferred language:

- `Compare options`
- `Current options`
- `Prices and availability are refreshed during search and before booking.`

Avoid:

- `Live Fares`
- `Compare live options`
- `Fare locked`
- `Guaranteed real-time inventory`
- `Guaranteed visa approval`
- fake approval percentages
- fake embassy or government endorsement
- fake live telemetry
- unsupported supplier or GDS claims
- unsupported urgency such as fake seat scarcity

## Verified trust content

Licences, accreditations, payment methods, regulatory seals, and partner logos may appear only when:

- verified as true for Vacatina
- currently applicable
- legally safe to display
- brand/logo use is authorized where required

If verification is missing, preserve the structural slot but do not fabricate content.

# Do's and Don'ts

## Do

- Use Screen 03 as the authoritative Design DNA source.
- Use Screen 04 as the authoritative Trip Bucket state source.
- Preserve Screens 05–07 exactly as approved references.
- Keep 10 travel products + Build Your Bundle as the cross-product orchestration feature.
- Keep all 11 Search Command Center tabs.
- Keep Sightseeing Tours and Travel Insurance as primary tabs.
- Use the exact desktop navigation architecture.
- Use `More` with exactly five items.
- Use Plus Jakarta Sans + Inter only.
- Use #1B1464 as the sole brand-primary color.
- Use neutral light surfaces for clarity.
- Use semantic colors only for real state.
- Use tabular numerals.
- Use premium destination imagery.
- Build homepage work in controlled layers.
- Run QA after every generation.
- Fix regressions before adding new sections.
- Make localized repairs instead of regenerating a complete approved page.
- Treat Trip Bucket as a persistent journey workspace.
- Keep Favorites separate from Trip Bucket.
- Make discovery lead to configuration before Trip Bucket staging.
- Keep trust content verifiable.
- Preserve responsive and accessibility behavior.

## Don't

- Do not recreate or reference Screen 02.
- Do not modify a LOCKED screen.
- Do not rename authoritative locked screens casually.
- Do not use Add-Ons navigation.
- Do not place Build Your Bundle inside More.
- Do not collapse Sightseeing Tours or Travel Insurance into another product tab.
- Do not reintroduce 9-tab architecture.
- Do not use #0071BC.
- Do not introduce old Material palettes.
- Do not introduce Poppins, Roboto, Google Sans, Raleway, Hanken Grotesk, JetBrains Mono, Figtree, Quicksand, or Moderna.
- Do not use dominant gradients, glassmorphism, neon, or heavy shadows.
- Do not use fake real-time data.
- Do not fabricate ratings, supplier names, approvals, licences, certifications, partners, payment support, or regulatory seals.
- Do not use `+ Bucket`, `Checkout Bucket`, or immediate `Reserve` behavior on unconfigured discovery cards.
- Do not treat Trip Bucket as a cart.
- Do not hard-code production prices from reference mockups.
- Do not use LKR 421,000 as the reference ready subtotal.
- Do not use 1535px as the navigation breakpoint.
- Do not let floating Trip Bucket controls cover page navigation or critical content.
- Do not regenerate approved images without a specific reason.
- Do not generate the entire remaining homepage in one uncontrolled pass.
- Do not proceed to the next build layer until the current layer passes QA.

# Engineering Handoff Addendum

This section is authoritative for the Antigravity implementation and extends the visual rules above without changing the approved design DNA.

## Source-of-truth hierarchy

When generated Stitch markup conflicts with this document, preserve the intended visual appearance but implement the behavior defined by the handoff architecture/flow files.

Historical Stitch-export `DESIGN.md` files are not authoritative.

## Data-mode honesty

Every external-data-backed feature must be internally classified as one of:

- LIVE
- VERIFY-LIVE
- ADAPTER-READY
- MOCK

Never present MOCK or ADAPTER-READY data as real-time production inventory.

Prototype/sample prices are illustrative unless a verified live service returned them.

## Motion system

Vacatina motion is restrained, purposeful and task-supportive.

Recommended timing ranges:

- control/filter/favorite state: 120–160ms
- tab content transition: 120–180ms
- tooltip/popover: 120–180ms
- modal/drawer: 200–280ms
- floating Trip control hide/show: 180–240ms

Use ease-out/ease-in-out curves. Avoid exaggerated spring/bounce motion.

Cards may use subtle hover/focus elevation or translation up to approximately 2px. Do not scale cards aggressively.

Respect `prefers-reduced-motion: reduce`; remove nonessential transitions/scroll-reveal effects and keep required state changes immediate and clear.

## Loading and async states

Do not use fake instant results to hide async architecture.

Where async data is represented, support:

- loading/skeleton
- success
- empty
- error/retry
- stale/revalidation where relevant

Skeleton geometry should match final content to minimize layout shift.

## API boundary

Presentational components must not import supplier SDKs directly.

Use normalized Vacatina domain services/adapters. Supplier payloads are mapped before reaching UI components.

This allows supplier replacement and multi-source inventory without redesigning components.

## Prototype vs production behavior

The Antigravity deliverable may be a functional prototype with deterministic mock adapters where real services are unavailable.

Never fabricate provider credentials or mark mock flows as live.

A prototype may demonstrate the complete UX for Flights, Hotels, Visa, Packages, Cars & Transfers, Rails, Cruises, Activities, Sightseeing and Insurance while documenting which backend integrations remain pending.

## Runtime quality

The final implementation must have:

- no undefined inline handlers
- no duplicate IDs affecting behavior
- no competing global controller systems
- no obsolete selectors referencing removed DOM
- no console-breaking errors across primary journeys
- no page-level horizontal overflow at target viewports

## Performance character

The homepage is image-rich but must feel fast.

- reserve image aspect ratios
- lazy-load below-fold imagery
- avoid shipping all product logic in one monolithic client component
- keep motion lightweight
- avoid unnecessary rerenders on scroll
- use passive scroll handling and requestAnimationFrame where appropriate

## Final responsive verification

Verify at minimum:

- 360px mobile
- 768px tablet
- 1280px desktop
- 1440px navigation breakpoint
- wide desktop

No floating control, drawer, card rail or filter row may obscure critical content.
