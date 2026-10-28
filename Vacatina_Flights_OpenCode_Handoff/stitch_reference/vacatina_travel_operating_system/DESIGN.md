---
version: '3.0'
name: Vacatina Travel Operating System
description: Authoritative design DNA for the Vacatina Travel & Tourism B2C web experience,
  product discovery, Trip Bucket engine, responsive shell, accessibility, trust, and
  journey-continuity patterns.
omitted: []
colors:
  brand-primary: '#1B1464'
  canvas: '#FAFAFA'
  surface: '#FFFFFF'
  surface-subtle: '#F5F5F5'
  text-primary: '#000000'
  text-muted: '#525252'
  border: '#E5E5E5'
  success: '#15803D'
  warning: '#B45309'
  error: '#B91C1C'
  info: '#1D4ED8'
  focus: '#1D4ED8'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#474551'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#787682'
  outline-variant: '#c8c5d2'
  surface-tint: '#5855a3'
  primary: '#06003e'
  on-primary: '#ffffff'
  primary-container: '#1b1464'
  on-primary-container: '#8481d3'
  inverse-primary: '#c4c0ff'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e2'
  on-secondary-container: '#646464'
  tertiary: '#1f0500'
  on-tertiary: '#ffffff'
  tertiary-container: '#441200'
  on-tertiary-container: '#c57658'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c4c0ff'
  on-primary-fixed: '#13095d'
  on-primary-fixed-variant: '#403d8a'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#73351c'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-desktop:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: 800
    lineHeight: 64px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: 800
    lineHeight: 44px
    letterSpacing: -0.02em
  heading-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: 700
    lineHeight: 48px
    letterSpacing: -0.02em
  heading-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.01em
  heading-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: '0'
  title:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: -0.01em
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: '0'
  label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: '0'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  control: 12px
  card: 16px
  panel: 24px
  pill: 9999px
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  '16': 64px
  '20': 80px
  gutter: 1.5rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
components:
  button-primary:
    backgroundColor: '{colors.brand-primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    height: 44px
    padding: 0 20px
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.brand-primary}'
    rounded: '{rounded.control}'
    height: 44px
    padding: 0 20px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.control}'
    height: 48px
    padding: 0 16px
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.card}'
    padding: 20px
  major-panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.panel}'
    padding: 24px
---

# Overview

Vacatina is a premium, trustworthy travel decision-and-journey platform. It must not feel like a generic OTA catalogue or a retail shopping cart. The experience supports the complete traveller journey:

**Discover → Search → Compare → Plan → Configure → Build Trip → Book → Prepare → Travel → Manage → Get Support**

The design language is clean, premium, calm, travel-led, content-rich without feeling dense, and optimized for clarity, confidence, and task completion.

## Authoritative Locked References

Use these screen names exactly:
- `Screen 03 Foundation v1.1 Final Interaction — LOCKED`
- `Screen 04 Trip Bucket Component States v1.2 — LOCKED`
- `Screen 05 Homepage Popular Flights v1.0 — LOCKED`
- `Screen 06 Homepage Visa Assistance v1.0 — LOCKED`
- `Screen 07 Homepage Holiday Packages v1.0 — LOCKED`

`Screen 02` is deleted and must not be recreated, restored, or used as a design source.

## Product Architecture

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
- **Build Your Bundle** (trip-composition entry point that combines relevant configured products into one journey; not an eleventh product).

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

## Desktop Navigation & Breakpoint Rule

- Desktop navigation: **Home | Flights | Hotels | Visa Assistance | Holiday Packages | Cars & Transfers | More | Resources**
- `More` contains exactly: Activities, Sightseeing Tours, Rails, Cruises, Travel Insurance. Never place Build Your Bundle inside `More`.
- **1440px and above:** desktop navigation is visible.
- **Below 1440px:** use the approved hamburger/mobile navigation pattern. Never introduce a `1535px` navigation breakpoint.

## Colors & Elevation

- **Brand Primary (#1B1464)**: Space Cadet Navy for identity, structure, headers, active states, and approved brand moments.
- **Pure White (#FFFFFF)**: Cards, elevated panels, input surfaces.
- **Canvas Mist (#FAFAFA)**: Primary page canvas.
- **Subtle Cloud (#F5F5F5)**: Low-emphasis containers, chips, grouped controls.
- **True Black (#000000)** & **Muted Graphite (#525252)**: Text hierarchy.
- **Hairline Grey (#E5E5E5)**: 1px restrained borders and dividers.
- **Semantic Colors**: Ready Green (`#15803D`), Action Amber (`#B45309`), Critical Red (`#B91C1C`), Info Blue (`#1D4ED8`).
- **Prohibitions**: `#0071BC`, cyan/teal/purple accents, neon glow, decorative multicolor gradients, heavy glassmorphism.

## Typography

- **Headings & Major Titles**: Plus Jakarta Sans (600, 700, 800).
- **Controls, Body, & Form UI**: Inter (400, 500, 600, 700).
- **Tabular Numerals**: Mandatory `font-variant-numeric: tabular-nums` for prices, dates, times, durations, traveler counts, and totals.
- **Prohibitions**: Poppins, Roboto, Google Sans, Google Sans Flex, Raleway, Hanken Grotesk, JetBrains Mono, Figtree, Quicksand, Moderna.

## Trip Bucket Governance

- Persistent journey workspace with canonical 8 states: `Draft`, `Needs Action`, `Ready`, `Refreshing Price`, `Price Changed`, `Recheck Required`, `Offer Expired`, `Unavailable`.
- Subtotal invariant: Only `Ready` items contribute to the active estimate. Incomplete items are excluded.
- Favorites (`♡`) remain completely separate from Trip Bucket.
- Discovery cards lead to exploration and configuration before Trip Bucket staging. No direct `+ Bucket` or `Reserve` on unconfigured items.