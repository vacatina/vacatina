> **REFERENCE ONLY — NOT DESIGN TOKEN AUTHORITY.**
> Use this document for product vision, product taxonomy, Trip Bucket model, homepage experience stages, accessibility intent and downstream screen roadmap.
> Where this document conflicts with Vacatina DESIGN v4, current Product Architecture, API Responsibility Map or Master Instruction, those newer handoff documents take precedence.
> *(Specifically: ignore §2.2 `#0071BC` Action Primary and §2.3 `Poppins` / `Google Sans Flex` — per `Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md`, `#1B1464` Space Cadet Navy is the sole brand-primary token and only `Plus Jakarta Sans` + `Inter` with `tabular-nums` are permitted.)*

---

# Product Requirements Document (PRD): Vacatina Travel Operating System

**Document Version:** 1.0  
**Status:** Supporting Product-Intent / Reference Document (Subordinate to DESIGN v4 & Master Instruction)  
**Project:** Vacatina Travel Operating System (B2C Travel Marketplace & Concierge)  
**Entities:** Vacatina (Pvt) Ltd (Sri Lanka) & Vacatina FZE (United Arab Emirates)  
**Authoritative Tagline:** *"we treasure your holidays"*

---

## 1. Executive Summary & Vision

Vacatina is a premium, high-trust, multi-inventory travel super-app designed to unify fragmented leisure and corporate travel procurement into a single, cohesive, and performant web platform. Rather than operating as a transactional low-cost Online Travel Agency (OTA) or an overwhelming catalogue, Vacatina provides a calm, curated, and transparent travel operating system.

### Core Product Archetype
A multi-vertical travel orchestration platform supporting Indian Ocean luxury corridors (Maldives, Sri Lanka, Seychelles, Bali) and global transit hubs (Dubai, London, Singapore, Bangkok).

### Core Product Invariant
```
Discover → Explore / Configure → Save (Favorites) OR Stage (Trip Bucket) → Reprice / Recheck → Dossier Checkout
```

---

## 2. Strategic Brand DNA & Token Governance

> **AUTHORITY OVERRIDE NOTE:** Section 2.2 (`#0071BC`) and Section 2.3 (`Poppins` / `Google Sans Flex`) in the raw Stitch PRD are superseded by `Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md`. Use `#1B1464` as the sole brand-primary color (`#130E4B` hover, `#F0EFFC` tint) and `Plus Jakarta Sans` + `Inter` (`tabular-nums`) only.

### 2.1 Brand Identity Invariants
- **Brand Wordmark:** `vacatina` (lowercase geometric typography, confident letter-spacing).
- **Tagline:** `"we treasure your holidays"`.
- **Contact & Duty Assistance:** Official telephone desk `+94113606200`, live email desk `info@vacatina.com`. Strictly zero fabricated physical street addresses.
- **Tone & Voice:** Honest, calm, transparent, high-craft, and authoritative. Prohibits artificial conversion timers, synthetic seat scarcity, fake live weather sensors, or unverified accreditation badges.

### 2.2 Color Tokens & Semantic Hierarchy (Superseded by DESIGN v4)
- **Action Primary (Superseded — use `#1B1464` / `#130E4B` per DESIGN v4):** Legacy `#0071BC` is retired.
- **Structure Navy (`#1B1464`):** Space Cadet Navy anchoring structural shells, primary CTAs, active tabs, persistent sticky header brand accents, hero intent container, Trip Bucket dock, and global enterprise 5-column footer.
- **Canvas & Surfaces:**
  - Page Canvas: `#FAFAFA` (Canvas Mist) / `#F8FAFC`.
  - Content Cards & Elevated Panels: `#FFFFFF` (Pure White Container) with 1px hairline borders (`#E5E5E5` / `#E2E8F0`).
  - Subtle Wells & Filter Chips: `#F5F5F5` / `#F1F5F9`.
- **Semantic Cues:**
  - *Ready / Validated:* `#15803D` (Ready Green).
  - *Needs Action / Attention:* `#B45309` (Amber).
  - *Unavailable / Error:* `#B91C1C` (Critical Red).
  - *Information / Refreshing:* `#1D4ED8` (System Blue).

### 2.3 Typography & Tabular Discipline (Superseded by DESIGN v4)
- **Display & Headings:** `Plus Jakarta Sans` (H1–H4, Display Hero, major section titles).
- **Controls, Navigation & Labels:** `Inter` (Navigation links, buttons, filter pills, card titles).
- **Body & Tabular Data:** `Inter` with mandatory `tabular-nums` (`font-variant-numeric: tabular-nums`) applied across all currency prices, durations, flight times, dates, and traveler tallies.
- **Prohibited Fonts:** Quicksand, Moderna, Poppins, Google Sans Flex, Roboto, JetBrains Mono.

---

## 3. Architecture & Information Structure

### 3.1 10 Travel Products & 1 Orchestration Engine
Vacatina comprises **10 first-class travel verticals**:
1. **Flights:** Commercial airfare routes, schedule comparisons, cabin configurations.
2. **Hotels / Stays:** Direct-contracted island resorts, city hotels, private villas.
3. **Visa Assistance:** Consular checklists, e-Visa guidance, appointment pre-checks.
4. **Holiday Packages:** Multi-day curated itineraries with customizable inclusions.
5. **Cars & Transfers:** Airport transfers, private chauffeur sedans, executive SUVs, touring vans.
6. **Rails:** Scenic alpine railways, observation carriages, intercity connections.
7. **Cruises & Sea Voyages:** Ocean liners, regional archipelago cruises, island-hopping yachts.
8. **Activities:** Participatory day experiences (watersports, safaris, cooking masterclasses).
9. **Sightseeing Tours:** Guided landmark passes, architectural trails, heritage walking tours.
10. **Travel Insurance:** Comprehensive medical, disruption, baggage, and sports protection options.

**Cross-Product Orchestration:**
- **Build Your Bundle:** Sits at Tab 1 as a unified trip-composition tool. It is **not** an 11th travel vertical; it synthesizes multiple verticals into a single cohesive dossier.

### 3.2 Global Navigation Shell (Desktop 1440px / Mobile <1440px)
- **Sticky Global Header (~76px):**
  - Brand identity with airplane apex mark.
  - Desktop Navigation links: `Home | Flights | Hotels | Visa Assistance | Holiday Packages | Cars & Transfers | More ▾ | Resources ▾`.
  - `More` contains exactly: `Activities`, `Sightseeing Tours`, `Rails`, `Cruises`, `Travel Insurance`.
  - Utility cluster: `🌐 EN · LKR / USD` locale selector, `♡` Saved Favorites, `Trip Bucket (3 items)`, and user authentication state (`Sign In` or Profile Avatar).
  - Breakpoint rule: Full desktop nav at >= 1440px; accessible slide-over mobile drawer below 1440px.

---

## 4. Central Booking Model: The 8-State Trip Bucket Candidate Engine

Vacatina rejects the generic e-commerce "shopping cart" in favor of an **8-State Travel Candidate Engine**. Travel inventory is volatile and governed by external supplier hold timers (GDS/NDC airline tariffs, hotel room blocks, consular policies).

### 4.1 Candidate State Machine
1. **Draft:** Initialized via AI trip prompt (`✦ Ask Vacatina`) or partial search. Missing required dates, room types, or traveler tiers. Excluded from totals.
2. **Needs Action:** Item staged in the bucket requiring mandatory traveler input (e.g., passport bio-page scan, visa document review). Excluded from Ready subtotal.
3. **Refreshing Price / Repricing:** Background revalidation querying supplier APIs before final checkout commitment.
4. **Ready:** Verified against supplier inventory with active price hold. Included in the "Ready items estimate" (Reference baseline: `LKR 505,000`).
5. **Price Changed:** Explicit notification displaying original vs. updated rate. Requires traveler confirmation; never silently accepted.
6. **Recheck Required:** Session hold window elapsed (e.g., >15 minutes). Requires one-click re-verification.
7. **Offer Expired:** Inventory sold out or fare withdrawn. Renders alternatives without destroying dossier state.
8. **Unavailable:** Supplier block completely depleted. Prompts date/property alternatives.

### 4.2 Workspace Isolation: Favorites vs. Trip Bucket
- **Saved Favorites (`♡`):** Persistent, non-committal visual bookmarks for inspiration and incomplete concepts.
- **Trip Bucket (`▢`):** Active candidate journey staged for multi-product dossier compilation, revalidation, and single checkout.

---

## 5. Homepage Experience Model: 6 Macro Stages (12 Zones)

### Stage 1: Intent & Search
- **Zone 01: Global Sticky Header:** 76px white header with navigation, locale switcher, and Trip Bucket trigger.
- **Zone 02: Primary Travel Intent Hero:** Deep Space Cadet Navy frame with display typography and secondary AI input (`✦ Ask Vacatina: "Plan 5 days in Dubai with flights, hotel and visa"`).
- **Zone 03: 11-Tab Unified Search Command Center:** Elevated card (20–24px radius) housing all 11 primary tabs in sequence.
- **Zone 04: Persistent Trip Bucket Anchor:** Directional floating desktop dock (`Your Trip (3 items) • 2 ready · 1 needs action • Ready items estimate: LKR 505,000`) and mobile sticky bottom bar.

### Stage 2: Primary Discovery (10 Verticals)
- **Zone 05: Popular Flights:** 4-card route grid (Dubai, Maldives, Bangkok, London) with region pills and search prefill.
- **Zone 06: Visa Assistance:** 4-card guidance grid (UAE, UK, Thailand, Singapore) with consular disclaimers and detail modals.
- **Zone 07: Holiday Packages:** Curated 4-card package grid with interactive detail modal (`holiday-package-details-modal`) and search customization routing.
- **Zone 08: Recommended Stays (Hotels):** 4-card accommodation grid with category filtering and rate configuration links.
- **Zone 09: Popular Activities:** Participatory adventure, water, safari, and culinary experiences.
- **Zone 10: Sightseeing Tours:** Guided landmark and heritage excursions with dedicated category routing.
- **Zone 11: Cars & Transfers:** Executive sedans, luxury 4WD SUVs, and passenger vans with airport/intercity options.
- **Zone 12: Cruises & Sea Voyages:** Ocean and island-hopping cruise itineraries with region filtering and prefill.
- **Zone 13: Rail Journeys:** Scenic alpine and observation train routes with route filtering and station prefill.
- **Zone 14: Travel Insurance:** Single-trip, extended-trip, and family protection options with coverage comparison.

### Stage 3: Decision Intelligence
- **Zone 15: Seasonal Destination Guide:** Macro climatic window matrix (Sri Lanka, Maldives, Bali, Seychelles) without synthetic live weather telemetry.
- **Zone 16: Decision Support & Clarity Protocol:** Inclusions, exclusions, policy transparency, and availability indicators.

### Stage 4: Trust & Confidence
- **Zone 17: Why Vacatina:** Core value propositions and multi-vertical coordination clarity.
- **Zone 18: Statutory Registrations:** Verified DMC licensing and official travel agency accreditations.
- **Zone 19: Secure Checkout Protocol:** Bank-grade encryption standards and payment security protections.
- **Zone 20: Verified Partner Registry (Conditional):** Formal airline, rail, and hotel carrier partnerships.

### Stage 5: Journey Continuity & Support
- **Zone 21: Manage Your Journey Action Triage Grid:** 6-tile portal for PNR lookup, date changes, visa tracking, vouchers, driver meetup notes, and concierge triage.
- **Zone 22: Verified Duty Support:** Direct telephone (`+94113606200`) and email (`info@vacatina.com`) access channels.

### Stage 6: Retention & Information
- **Zone 23: Travel Notes Newsletter:** Clean dispatch subscription bar with input validation.
- **Zone 24: Global Enterprise 5-Column Footer:** Comprehensive product index, corporate links, customer support routes, and legal bar (`© 2026 Vacatina. All Rights Reserved.`).

---

## 6. Functional & Accessibility Non-Negotiables (WCAG 2.2 AA)

1. **Touch Targets:** All interactive controls (buttons, tabs, inputs, dropdown triggers, and filter pills) must maintain a minimum bounding target of 44 x 44px across all active and inactive states.
2. **Keyboard Navigation:**
   - Tabs support roving `tabindex` and arrow key cycling (`ArrowRight`, `ArrowLeft`, `Home`, `End`).
   - Modals and slide-overs implement strict Tab / Shift+Tab focus trapping.
   - `Escape` dismisses active drawers/modals and restores focus to the originating trigger element.
3. **Contrast Ratios:**
   - Text on Space Cadet Navy (`#1B1464`): Minimum 15.7:1 AAA contrast.
   - No low-contrast muted text on dark backgrounds.
4. **Semantic State Dual-Coding:**
   - State indicators must never rely on color alone. Every status badge must combine an icon with descriptive text (e.g., `✓ Ready`, `! Needs action`).

---

## 7. Downstream Screen Delivery Roadmap

| Phase | Screen ID & Title | Primary Objective | Key Integration / Contract |
|---|---|---|---|
| **Phase 1** | `Screen 01 Master Homepage` | Full 12-zone homepage assembly | 11-tab command center, 10 discovery sections, 6 macro stages |
| **Phase 2** | `Screen 02 Flight Search Results` | Airfare matrix, cabin tiers, seat maps | Real-time GDS/NDC offer revalidation & 15m hold timer |
| **Phase 3** | `Screen 03 Hotel Room Configurator` | Split-screen map/list, room selection | Rate tiers, meal plans, cancellation policies |
| **Phase 4** | `Screen 04 Holiday Package Customizer` | Itinerary tailoring, bundle builder | Dynamic repricing, flight/hotel component toggles |
| **Phase 5** | `Screen 05 Visa Assistance Desk` | 5-step application & consular upload | 3-line fee breakdown, Cloudflare R2 bio-page uploads |
| **Phase 6** | `Screen 06 B2B Portal & Dashboard` | Corporate travel desk, net/client toggle | Multi-passenger manifest, co-branded proposal generator |
| **Phase 7** | `Screen 07 Unified Dossier Checkout` | Single-dossier multi-rail checkout | Stripe / PayPal webhooks, instantaneous PNR issuance |

---

*Authored by Stitch for the Vacatina Platform Engineering & Product Architecture Team.*
