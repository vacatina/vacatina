---
name: Precision Slate Analytics
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#00423c'
  on-tertiary: '#ffffff'
  tertiary-container: '#005c54'
  on-tertiary-container: '#69d6c9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies an authoritative, ultra-clean analytical aesthetic built for mission-critical enterprise workflows, usage-based billing structures, and multi-tenant telemetry dashboards. The visual identity merges Swiss International typography principles with rigorous Modern Enterprise ergonomics—prioritizing extreme data clarity, systematic layout discipline, and zero gratuitous ornamentation.

The experience evokes confidence, operational precision, and absolute transparency. Interfaces must feel crisp, institutional, and dependable, transforming high-density quantitative data into rapid executive insights. Structural micro-borders replace heavy shadows, creating clear spatial containers that remain effortless to scan during prolonged administrative sessions.

## Colors

The palette is engineered around high-clarity slate tones, strict semantic states, and uncompromising WCAG 2.2 AAA accessibility standards.

- **Primary (`#4338ca` - Indigo 700):** Reserved for primary interactive controls, active pagination, focused states, and key metric trend line highlights.
- **Secondary (`#0f172a` - Slate 900):** Anchors high-priority structural headers, primary metric displays, dark utility toggles, and primary CTA emphasis. Delivers a contrast ratio > 12:1 against light canvas surfaces.
- **Tertiary (`#0d9488` - Teal 600):** Dedicated to positive telemetry thresholds, confirmed invoice billing badges, and steady-state health indicators.
- **Neutral (`#64748b` - Slate 500):** Governs structural borders (`#e2e8f0` - Slate 200), card backings (`#f8fafc` - Slate 50), secondary body typography (`#334155` - Slate 700), and muted labels.

Text colors strictly adhere to readability rules: Headings use `#0f172a` (Slate 900), while body and tabular data utilize `#334155` (Slate 700), guaranteeing AAA contrast compliance on all `#ffffff` and `#f8fafc` container surfaces.

## Typography

The type scale pairs the balanced modern geometry of **Hanken Grotesk** with the strict, tabular precision of **JetBrains Mono**.

- **Hanken Grotesk** powers interface navigation, hierarchy labels, modal sheets, and narrative text. Precise negative tracking on display and headline tiers tightens headline density for rapid scanning across complex multi-column dashboards.
- **JetBrains Mono** is enforced across all metric cards, currency values, usage percentages, invoice line items, timestamp markers, and status chips. Tabular baseline figures ensure numbers do not jitter during real-time data polling or table sorting.

## Layout & Spacing

Layout geometry follows an absolute 8-point spatial model (`0.5rem` = 8px baseline increment), with `0.25rem` (4px) reserved exclusively for compact micro-alignments such as badge padding, icon spacing, and nested table rows.

- **Grid System:** Employs a 12-column responsive fluid grid with a fixed maximum canvas constraint of `1440px` on desktop. Multi-tier analytics cards snap to 3, 4, 6, or 12-column spans.
- **Desktop (1024px+):** Outer canvas margin of `2rem` (32px), column gutter of `1.5rem` (24px). Persistent left-hand collapsible navigation rail fixed at `256px` (`64px` collapsed).
- **Tablet (768px - 1023px):** Outer margin adjusts to `1.5rem` (24px), gutters reduce to `1rem` (16px). Secondary widgets reflow to 2-column or full-width blocks.
- **Mobile (< 768px):** Outer canvas margin transitions to `1rem` (16px), gutters to `1rem` (16px). All dashboard cards stack into single-column layouts with horizontal scrolling for dense data grids.

## Elevation & Depth

Visual separation relies on a **micro-border and tonal containment** paradigm rather than ambient shadows. Shadow pollution is eliminated to preserve analytical precision.

- **Borders over Shadows:** All containers, cards, tables, and dropdowns use a sharp, 1px solid micro-border (`#e2e8f0` - Slate 200). Surface distinction occurs via crisp contrast between the primary dashboard canvas (`#f8fafc` - Slate 50) and elevated card containers (`#ffffff`).
- **Hover & Active States:** Hover interactions on clickable cards or table rows introduce an elevated border tint (`#cbd5e1` - Slate 300) paired with an ultra-subtle, non-diffused elevation lift: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
- **Modals & Flyouts:** Floating elements (tooltips, filter sheets, context menus) leverage a 1px solid border (`#cbd5e1`) and a directional utility shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.

## Shapes

The design system implements a strict, restrained shape language using level `1` (Soft) corner geometry:

- **Base Radius (`0.25rem` / 4px):** Applied to form inputs, buttons, status chips, tooltips, and table cell highlights. Reinforces structural discipline and maximizes internal pixel area for dense data tables.
- **Container Radius (`rounded-lg` / `0.5rem` / 8px):** Applied to primary metric cards, analytical containers, invoice breakout modals, and segmented control panels.
- **Outer Shell Radius (`rounded-xl` / `0.75rem` / 12px):** Reserved for high-level modal dialogs and slide-over telemetry drawers. Full pill geometry is prohibited except for circular avatar chips and status indicator dots.

## Components

### Buttons
- **Primary:** Solid `#4338ca` background, `#ffffff` text, `0.25rem` border radius, `0.5rem` x `1rem` padding. Hover: `#3730a3`. Focus: 2px offset ring in `#4338ca`.
- **Secondary / Outline:** `#ffffff` background, `#0f172a` text, 1px border `#e2e8f0`. Hover: `#f8fafc` background, `#cbd5e1` border.
- **Destructive:** `#ef4444` background with `#ffffff` text, or subtle `#fef2f2` background with `#dc2626` text and border `#fecaca`.

### Metric & Analytics Cards
- Constructed on a `#ffffff` background with 1px solid `#e2e8f0` border and `0.5rem` corner radius.
- Standardized padding: `1.25rem` internally. Metric titles use `body-sm` (`#64748b`), primary KPIs use `display-lg` (`#0f172a`), and secondary trend delta badges use `label-sm` rendered in `JetBrains Mono`.

### Tables & Data Grids
- **Header:** Background `#f8fafc`, 1px solid bottom border `#e2e8f0`. Text style: `label-sm` in `#475569`, uppercase with `0.05em` letter spacing.
- **Rows:** Alternating subtle row hover `#f8fafc`. Row borders are 1px solid `#f1f5f9`. Numeric cells align right and utilize `JetBrains Mono`.

### Form Inputs & Selectors
- Background `#ffffff`, border 1px solid `#e2e8f0`, radius `0.25rem`. Height: `36px` for dense enterprise layouts.
- Text uses `body-md` (`#0f172a`). Placeholder uses `#94a3b8`. Focus state applies a 1px border `#4338ca` with an accompanying `0 0 0 1px #4338ca` ring.

### Status Badges & Chips
- Padding: `0.125rem` vertical by `0.5rem` horizontal with a `0.25rem` radius. Typography set to `label-sm`.
- **Success (Active / Paid):** `#f0fdf4` background, `#15803d` text, 1px border `#bbf7d0`.
- **Warning (Pending / Over-quota):** `#fffbeb` background, `#b45309` text, 1px border `#fde68a`.
- **Neutral (Draft / Inactive):** `#f8fafc` background, `#475569` text, 1px border `#e2e8f0`.

### Checkboxes & Radios
- Size `16px` by `16px`, border 1px solid `#cbd5e1`, background `#ffffff`, radius `2px` (checkbox) or `50%` (radio).
- Active state fills with `#4338ca` and a sharp `#ffffff` check icon.