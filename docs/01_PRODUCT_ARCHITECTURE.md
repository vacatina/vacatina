# 01 — Product Architecture (`01_PRODUCT_ARCHITECTURE.md`)

**Authority Rank:** 3 (Subordinate to `06_ANTIGRAVITY_MASTER_INSTRUCTION.md` and `Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md`)

## 1. Core Product Identity & Invariant
Vacatina is a unified multi-inventory B2C & B2B travel operating system anchored by the tagline *"we treasure your holidays"*.

```text
Discover → Explore / Configure → Save (Favorites) OR Stage (Trip Bucket) → Reprice / Recheck → Dossier Checkout
```

## 2. The 10 Travel Products vs. 1 Cross-Product Orchestration Feature
Vacatina supports **10 distinct travel products**:
1. `Flights`
2. `Hotels` (Recommended Stays)
3. `Visa Assistance`
4. `Holiday Packages`
5. `Cars & Transfers`
6. `Rails` (Rail Journeys)
7. `Cruises` (Cruises & Sea Voyages)
8. `Activities`
9. `Sightseeing Tours`
10. `Travel Insurance`

**Cross-Product Orchestration:**
- `Build Your Bundle` is **Tab 1** in the Search Command Center. It is an orchestration feature that synthesizes Flights, Hotels, Transfers, Visa, Insurance, and Activities into one candidate trip — it is **never** a product inside the header `More` dropdown.

## 3. Navigation & Breakpoint Architecture
- **Desktop Header (`>= 1440px`):**
  `Home | Flights | Hotels | Visa Assistance | Holiday Packages | Cars & Transfers | More ▾ | Resources ▾`
- **`More` Dropdown (5 items only):**
  `Activities`, `Sightseeing Tours`, `Rails`, `Cruises`, `Travel Insurance`
- **Responsive Breakpoint:**
  Strict CSS boundary at `1440px` (`@media (min-width: 1440px)` for desktop navigation; `@media (max-width: 1439.98px)` for mobile hamburger drawer). Never use `1535px`.

## 4. Workspace Separation
- **Saved Favorites (`♡`):** Non-committal bookmark collection for inspiration. Never calculates a booking subtotal.
- **Trip Bucket (`Your Trip`):** Active candidate journey workspace holding multi-vertical items across 8 canonical lifecycle states (`Draft`, `Ready`, `Needs Action`, `Refreshing Price`, `Price Changed`, `Recheck Required`, `Offer Expired`, `Unavailable`). Only `Ready` items contribute to the **Ready items estimate** (`LKR 505,000` baseline).
