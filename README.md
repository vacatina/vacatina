# Vacatina Travel Operating System (`vacatina-travel-os`)

> **"we treasure your holidays"** — Unified Multi-Inventory B2C Travel Operating System (DESIGN v4 & Stitch Handoff Locked)

---

## 1. Document & Design Authority Hierarchy

This codebase strictly enforces the 8-tier authority hierarchy specified in [`docs/06_ANTIGRAVITY_MASTER_INSTRUCTION.md`](./docs/06_ANTIGRAVITY_MASTER_INSTRUCTION.md):

| Priority | Document / Source | Role |
|---|---|---|
| **1** | [`docs/06_ANTIGRAVITY_MASTER_INSTRUCTION.md`](./docs/06_ANTIGRAVITY_MASTER_INSTRUCTION.md) | Engineering, build, testing, and delivery authority |
| **2** | [`docs/Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md`](./docs/Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md) | Visual & design-system token authority (`#1B1464` sole brand-primary; `Plus Jakarta Sans` + `Inter` with `tabular-nums`) |
| **3** | [`docs/01_PRODUCT_ARCHITECTURE.md`](./docs/01_PRODUCT_ARCHITECTURE.md) | Product taxonomy (10 Travel Products + `Build Your Bundle` orchestration at Tab 1; `1440px` nav breakpoint) |
| **4** | [`docs/02_API_RESPONSIBILITY_MAP.md`](./docs/02_API_RESPONSIBILITY_MAP.md) | Supplier & backend API responsibility authority (`LIVE` / `VERIFY-LIVE` / `ADAPTER-READY` / `MOCK`) |
| **5** | [`docs/03_FUNCTIONAL_FLOWS.md`](./docs/03_FUNCTIONAL_FLOWS.md) + [`docs/04_DATA_STATE_MODEL.md`](./docs/04_DATA_STATE_MODEL.md) | Runtime behavior & 8-State Trip Bucket Candidate Engine authority (`LKR 505,000` Ready items estimate) |
| **6** | [`stitch_vacatina_master_ui_foundation/`](./stitch_vacatina_master_ui_foundation/) | Exported Google Stitch visual reference screens (`Screen 03`–`Screen 08`) |
| **7** | [`docs/08_STITCH_GENERATED_PRODUCT_BRIEF_REFERENCE.md`](./docs/08_STITCH_GENERATED_PRODUCT_BRIEF_REFERENCE.md) | **REFERENCE ONLY — NOT DESIGN TOKEN AUTHORITY.** Used for product vision, Trip Bucket model, and downstream roadmap; subordinate to DESIGN v4 |
| **8** | Older PRDs & reports | Historical context only |

---

## 2. Quick Start & Run Instructions

### Prerequisites
- **Node.js `>= 22.6.0`** (portable Node `v22.14.0` is pre-installed at `C:\Users\Madhusanka\.gemini\antigravity\scratch\tools\node\node-v22.14.0-win-x64`)
- Or **Python 3** (for static HTTP serving of the pre-built `index.html` + `dist/` ES modules)

### Option A — Node.js Build, Dev Server & Automated Verification
```powershell
$env:PATH = "C:\Users\Madhusanka\.gemini\antigravity\scratch\tools\node\node-v22.14.0-win-x64;" + $env:PATH
cd C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina

# 1. Transpile TypeScript modules (src/ -> dist/) and assemble index.html
npm run build

# 2. Run TypeScript Domain & Validation Unit Tests (6/6 tests)
npm test

# 3. Run Real Headless Chrome E2E Acceptance & Screenshot Suite (17/17 assertions across 1440px, 1280px, 768px, 360px)
npm run test:e2e

# 4. Start Local HTTP Dev/Preview Server at http://127.0.0.1:4173
npm run dev
```

### Option B — Static HTTP Server (Zero Build Step Required)
Because `dist/` is pre-compiled to standard browser ES modules, you can also serve the project root directly:
```powershell
cd C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina
python -m http.server 8080
# Open http://localhost:8080
```

---

## 3. Modular Project Architecture

```text
vacatina/
├── index.html                                  # Assembled 12-zone homepage (Screen 03–08 locked DOM + modular ES entry)
├── screen-04-states.html                       # Standalone Screen 04 v1.2 Locked 8-State Reference View
├── package.json                                # Scripts: build, dev, test, test:e2e
├── tsconfig.json                               # Strict ES2022 TypeScript configuration
├── docs/                                       # Complete Authority Hierarchy Handoff Package
│   ├── 00_README_FIRST.md
│   ├── 01_PRODUCT_ARCHITECTURE.md
│   ├── 02_API_RESPONSIBILITY_MAP.md
│   ├── 03_FUNCTIONAL_FLOWS.md
│   ├── 04_DATA_STATE_MODEL.md
│   ├── 05_KNOWN_STITCH_EXPORT_ISSUES.md
│   ├── 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
│   ├── 07_ACCEPTANCE_TESTS.md
│   ├── 08_STITCH_GENERATED_PRODUCT_BRIEF_REFERENCE.md
│   ├── Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md
│   └── BROWSER_VERIFICATION_REPORT.json
├── src/
│   ├── app/
│   │   └── main.ts                             # Application bootstrapper & Escape focus-restoration coordinator
│   ├── styles/
│   │   └── tokens.css                          # DESIGN v4 tokens (#1B1464, Plus Jakarta Sans, Inter, tabular-nums, 1440px nav, 44px targets)
│   ├── components/
│   │   ├── shell/
│   │   │   └── header-nav.ts                   # Sticky Header, 1440px nav, More 5-item menu, Currency switcher, Mobile drawer
│   │   ├── search-command-center/
│   │   │   └── command-center.ts               # 11 ARIA tabs (roving tabindex), Traveller & Cabin popover, Flight swap, AI prompt
│   │   ├── discovery/
│   │   │   └── discovery-controller.ts         # All 10 product sections, radiogroup filters, Favorites toggle, Search prefill
│   │   ├── trip-bucket/
│   │   │   └── trip-bucket-ui.ts               # 460px Trip Bucket drawer, Floating Trip Dock (10px rAF scroll), 8-state actions
│   │   ├── dialogs/
│   │   │   └── dialogs-controller.ts           # Package Details Modal, Product Configurator, Dossier Review, Screen 04 Inspector, Favorites Drawer
│   │   ├── trust/
│   │   │   └── macro-stages.ts                 # Seasonal Guide matrix, Clarity protocols, 6-tile Journey Triage, Newsletter validation
│   │   └── ui/
│   │       └── toast.ts                        # Focus trap, inert background shell, and polite ARIA live-region toasts
│   ├── features/
│   │   ├── bundle/index.ts                     # Tab 1 Cross-Product Orchestration + 10-product registry
│   │   ├── flights/index.ts                    # Product 01: Flights
│   │   ├── hotels/index.ts                     # Product 02: Hotels
│   │   ├── visa/index.ts                       # Product 03: Visa Assistance
│   │   ├── packages/index.ts                   # Product 04: Holiday Packages
│   │   ├── cars-transfers/index.ts             # Product 05: Cars & Transfers
│   │   ├── rails/index.ts                      # Product 06: Rails
│   │   ├── cruises/index.ts                    # Product 07: Cruises & Sea Voyages
│   │   ├── activities/index.ts                 # Product 08: Activities
│   │   ├── sightseeing/index.ts                # Product 09: Sightseeing Tours
│   │   └── insurance/index.ts                  # Product 10: Travel Insurance
│   └── lib/
│       ├── domain/types.ts                     # Core TypeScript domain contracts
│       ├── validation/travellers.ts            # Pure validation (Adults >= 1, Total <= 9, Infants <= Adults, Email)
│       ├── mock-data/catalog.ts                # Canonical LKR 505,000 Trip Bucket baseline, Screen 04 8 states, Package details
│       ├── adapters/supplier-adapters.ts       # 13 typed supplier/infrastructure adapters (02_API_RESPONSIBILITY_MAP.md)
│       ├── services/
│       │   ├── trip-bucket.service.ts          # 8-State Trip Bucket state machine & financial subtotal calculator
│       │   ├── favorites.service.ts            # Isolated Saved Favorites store
│       │   └── search.service.ts               # 11-tab Search Command Center & AI prompt state service
│       └── analytics/telemetry.ts              # Interaction telemetry logger
├── scripts/
│   ├── build.mjs                               # Native Node TypeScript -> dist/ transpiler & HTML assembler
│   ├── dev-server.mjs                          # Local HTTP dev/preview server
│   └── browser-verify.mjs                      # Headless Chrome CDP E2E acceptance test & screenshot runner
└── tests/
    └── unit.test.ts                            # Node native TypeScript unit tests
```
