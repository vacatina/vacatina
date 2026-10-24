# Vacatina — Antigravity Master Implementation Instruction

You are the engineering implementation agent for the **Vacatina Travel and Tourism Web Application**.

You have been given Google Stitch visual exports plus a structured engineering handoff package.

Your task is to create the most complete **functional, responsive, accessible and premium animated B2C prototype** possible from these materials without changing the approved Vacatina product architecture.

## 1. Read before touching code

Read in this order:

1. `00_README_FIRST.md`
2. `Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md`
3. `01_PRODUCT_ARCHITECTURE.md`
4. `02_API_RESPONSIBILITY_MAP.md`
5. `03_FUNCTIONAL_FLOWS.md`
6. `04_DATA_STATE_MODEL.md`
7. `05_KNOWN_STITCH_EXPORT_ISSUES.md`
8. `07_ACCEPTANCE_TESTS.md`
9. relevant reference screens and source docs

Do not begin implementation until you can summarize the authority hierarchy and identify conflicts in older source material.

## 2. Preserve the design

Google Stitch screens are the visual source material.

Do not:

- replace them with a generic OTA template
- simplify away approved product sections
- collapse the 11-tab Search Command Center
- merge Activities with Sightseeing Tours
- merge Travel Insurance into Add-ons
- treat Build Your Bundle as an eleventh travel product
- convert Trip Bucket into a retail cart
- reintroduce legacy colors/fonts

Use the Stitch screens to understand visual composition, then implement maintainable components.

## 3. Treat generated Stitch JavaScript as untrusted prototype code

Audit it.

Do not preserve a broken controller merely because it exists in the export.

Specifically search for:

- undefined inline handlers
- duplicate IDs
- duplicate event listeners
- obsolete selectors
- competing tab controllers
- missing focus management
- incorrect CTA routing
- unconfigured direct booking/bucket actions

Rebuild controllers from the functional contracts in this handoff.

## 4. Architecture

If an existing Vacatina application repository is attached, preserve its framework/version and integrate non-destructively.

If only Stitch/reference files are attached, scaffold a modular frontend prototype using a maintainable App Router/component architecture with TypeScript and Tailwind-compatible tokens. Do not create another single giant HTML/JS file.

Suggested boundaries:

```text
app / routes
components
  shell
  search-command-center
  trip-bucket
  discovery
  dialogs
  forms
features
  flights
  hotels
  visa
  packages
  cars-transfers
  rails
  cruises
  activities
  sightseeing
  insurance
lib
  domain
  services
  adapters
  mock-data
  validation
```

Use domain interfaces so supplier integrations can change without rewriting the UI.

## 5. API / integration rules

Implement the boundary in `02_API_RESPONSIBILITY_MAP.md`.

Never call supplier APIs directly from presentational components.

At startup/audit, classify each integration as:

- LIVE
- VERIFY-LIVE
- ADAPTER-READY
- MOCK

For VERIFY-LIVE integrations, inspect the actual repository/environment before attempting live calls.

If credentials are unavailable, create deterministic mock adapters and continue the prototype without pretending the data is live.

Do not fabricate:

- credentials
- provider relationships
- supplier inventory
- approval status
- insurance terms
- licences/accreditations
- payment support
- regulatory status

## 6. Required prototype behavior

Implement all currently designed B2C homepage/product interactions, including:

- 11-tab Search Command Center
- per-product search state
- traveller selector and validation
- discovery filters
- discovery CTA → correct tab + prefill
- Favorites
- product details/configuration states
- Holiday Package details modal
- mobile navigation
- More / Resources submenus
- Trip Bucket drawer and states
- floating Trip control scroll behavior
- Build Your Bundle progressive composition
- loading / empty / error / retry states
- responsive card rails/grids
- keyboard accessibility
- restrained motion

Where full results/detail screens are not present in Stitch, build coherent prototype routes/states consistent with the design system rather than inventing a different visual language.

## 7. Trip Bucket rules

Trip Bucket is a journey workspace.

Correct flow:

**Discover → Explore → Configure → Trip Bucket candidate → Review**

Do not stage unconfigured discovery items.

Implement the exact item states from `04_DATA_STATE_MODEL.md`.

Favorites are separate.

Before checkout, supplier-dependent ready items should expose a revalidation boundary even when the prototype adapter returns deterministic mock success.

## 8. Motion system

Add premium restrained micro-interactions only:

- tabs: short crossfade/slide
- cards: subtle hover/focus elevation
- Favorites: short state confirmation
- filter selection: short state transition
- modal/drawer: polished open/close
- Trip floating control: smooth hide/show
- loading: skeletons, not fake instant data

Avoid:

- heavy parallax
- neon/glow
- bouncy/spring-heavy interfaces
- decorative motion that delays tasks

Respect `prefers-reduced-motion`.

## 9. Content/data honesty

The prototype may use high-quality deterministic mock data.

Mock data should be realistic enough to test layouts and flows, but must not be described in documentation as current supplier inventory.

Use safe provider-neutral copy unless a verified integration supplies the information.

Remove unsupported guarantees and scarcity.

## 10. Accessibility

Target WCAG 2.2 AA behavior for the prototype.

At minimum:

- semantic buttons/links/inputs
- visible focus
- 44px approximate targets
- dialog/drawer focus traps
- Escape close
- exact focus return
- inert background for blocking overlays
- accessible labels
- alt text
- keyboard-complete flows
- reduced motion
- correct ARIA tab behavior

## 11. First implementation phase

Before building new features:

1. inspect all Stitch/reference files
2. identify reusable components
3. create an implementation plan
4. identify old/legacy conflicts
5. identify data integrations and statuses
6. create modular architecture
7. reproduce the approved homepage visually
8. replace generated controllers with maintainable state logic
9. make every currently visible interaction functional
10. run browser QA

Do not stop at a static page.

## 12. Browser verification

Run the implementation and verify at least:

- 360px
- 768px
- 1280px
- 1440px+

Test:

- mouse/touch interactions
- keyboard-only navigation
- Tab/Shift+Tab
- Escape
- all 11 tabs
- all implemented discovery filters
- all discovery CTAs
- Favorites
- Trip Bucket
- mobile drawer/submenus
- modals
- responsive overflow
- console errors

Use the acceptance checklist in `07_ACCEPTANCE_TESTS.md`.

Do not mark an issue fixed based only on a code diff; re-run the same browser journey.

## 13. Output

Deliver:

1. complete working project
2. README with run instructions
3. architecture summary
4. component/feature map
5. integration status table
6. list of mock adapters
7. list of files changed/created
8. browser/test report
9. screenshots at key viewports
10. known limitations
11. backend/API integration backlog
12. explicit statement of any unresolved defect

Do not hide failures.

## 14. Success definition

The result is successful when a reviewer can run the project locally and experience a convincing Vacatina B2C prototype in which the homepage, all 10 travel product entry points, Build Your Bundle, Search Command Center, Favorites, Trip Bucket, responsive navigation and major configuration flows behave coherently with no console-breaking runtime defects and no material visual drift from the approved Stitch design.
