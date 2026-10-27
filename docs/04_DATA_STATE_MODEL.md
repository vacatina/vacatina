# 04 — Data & State Model (`04_DATA_STATE_MODEL.md`)

**Authority Rank:** 5 (State & domain model authority)

## 1. Canonical 8 Trip Bucket Item States (`Screen 04 Locked`)

| Code | State ID | Badge Label | Accent Token | Included in Ready Estimate? | Primary Recovery / Action |
|---|---|---|---|---|---|
| `01` | `draft` | `Draft` | `#475569` (Slate) | **No** | `Complete Selection` |
| `02` | `ready` | `Ready` | `#15803D` (Green) | **Yes** | `Edit` / `Remove` |
| `03` | `needs_action` | `Needs Action` | `#B45309` (Amber) | **No** | `Upload Passport Copy` / `Complete Requirement` |
| `04` | `refreshing_price` | `Refreshing Price` | `#1D4ED8` (System Blue) | **No** (Pending) | `Checking live supplier inventory…` |
| `05` | `price_changed` | `Price Changed` | `#B45309` (Amber) | **No** (Until accepted) | `Accept Updated Price` |
| `06` | `recheck_required` | `Recheck Required` | `#B45309` (Amber) | **No** | `Recheck Availability` |
| `07` | `offer_expired` | `Offer Expired` | `#B91C1C` (Red) | **No** | `Select New Fare` / `Find Replacement` |
| `08` | `unavailable` | `Unavailable` | `#B91C1C` (Red) | **No** | `Find Replacement` |

## 2. Default Reference Baseline (`Screen 03` & `Screen 04` Locked)
The default seeded Trip Bucket contains **3 items** for `"Dubai Family Escape · Oct 2026"`:
1. **Flights (`Ready`):** `Colombo (CMB) → Dubai (DXB)` · `12 Oct – 17 Oct · 2 Adults · Economy · Emirates EK 651` — **`LKR 248,500`** (Hold active: `14m remaining`)
2. **Hotels (`Ready`):** `Jumeirah Creekside Hotel, Dubai` · `5 Nights · Superior King Room · Breakfast Included` — **`LKR 256,500`** (Rate verified)
3. **Visa Assistance (`Needs Action`):** `UAE 30-Day Tourist e-Visa (×2)` · `Action required: Upload passport bio-page scans` — **`LKR 45,000`** *(Excluded from Ready items estimate)*

### Financial Math Invariant
- **Ready items estimate:** `LKR 248,500 + LKR 256,500 = LKR 505,000`
- **Pending / Excluded items:** `LKR 45,000` (1 item Needs Action)
- If the user completes the UAE Visa requirement (transitions `Needs Action → Ready`), the Ready items estimate updates dynamically to `LKR 550,000` (`3 ready · 0 needs action`).
- Users can also reset to the canonical 3-item baseline or switch between all 8 canonical states from `Screen 04` to inspect every state transitions in real time.
