# VACATINA DESIGN DNA — IMMUTABLE SPECIFICATION

## Version: 1.0
## Status: AUTHORITATIVE — Do not modify without owner approval

## 1. Brand Colors

| Token | Value | Usage |
|---|---|---|
| `brand-primary` | `#1B1464` | Primary brand color, headers, CTAs, active states |
| `brand-canvas` | `#FAFAFA` | Page background |
| `brand-surface` | `#FFFFFF` | Card/panel backgrounds |
| `brand-subtle` | `#F5F5F5` | Subtle backgrounds, hover states |
| `brand-border` | `#E5E5E5` | Borders, dividers |
| `brand-muted` | `#525252` | Secondary text, captions |
| `brand-black` | `#000000` | Primary text, headings |
| `brand-success` | `#15803D` | Success states, ready badges |
| `brand-warning` | `#B45309` | Warning states, needs-action badges |
| `brand-error` | `#B91C1C` | Error states, validation errors |
| `brand-info` | `#1D4ED8` | Info states, links |

## 2. Typography

| Role | Font Family | Weights | Usage |
|---|---|---|---|
| Headings | Plus Jakarta Sans | 600, 700, 800 | H1-H6, section titles, card titles |
| Body/UI | Inter | 400, 500, 600, 700 | Body text, form labels, buttons, navigation |

## 3. Layout

| Breakpoint | Width | Usage |
|---|---|---|
| Desktop XL | 1440px | Primary desktop layout |
| Desktop | 1280px | Standard desktop |
| Tablet | 1024px / 768px | Tablet layouts |
| Mobile | 390px / 360px | Mobile single-column |

- 12-column grid system
- Max content width: 1280px (max-w-7xl)
- Section padding: px-4 sm:px-6 lg:px-8
- Card radius: 16px (rounded-2xl)
- Button radius: 12px (rounded-xl)
- Input radius: 12px (rounded-xl)

## 4. LOCKED Homepage Rules

The approved live homepage at `https://vacatina-nu.vercel.app/` is IMMUTABLE:
- 76px header with Vacatina logo and navigation
- 11-tab Search Command Center (Bundle, Flights, Hotels, Visa, Packages, Cars, Rails, Cruises, Activities, Sightseeing, Insurance)
- Trip Bucket dock with scroll hide/show
- Typography: Plus Jakarta Sans headings, Inter body
- No redesign, restyle, reorder, or modification of any homepage element
- Integration may route into Flights without changing home appearance/behavior

## 5. Trip Bucket Rules

- 8 states: Draft, Needs Action, Ready, Refreshing Price, Price Changed, Recheck Required, Offer Expired, Unavailable
- No expired offer becomes Ready
- No fake prices or fabricated inventory
- Respect all Vacatina states

## 6. Accessibility Standards

- WCAG 2.2 AA targeted
- 44px minimum touch targets
- Visible focus indicators
- Keyboard navigation for all interactive elements
- ARIA labels and roles
- `prefers-reduced-motion: reduce` respected
- Screen reader text for flight segments
- Meaningful error text with field-level validation

## 7. Animation Standards

- 140-220ms tab state transitions
- 180-260ms filter/sort and accordion transitions
- 180-300ms mobile drawer/sheet entrance/exit
- `prefers-reduced-motion: reduce` removes nonessential motion
- No forced parallax, no auto-playing animations, no fake time pressure
- No layout shifts (reserve sizes)

## 8. Component Standards

- Shared header, navigation, breadcrumbs, cards, search forms, summary panels, footer
- Consistent spacing, typography, borders, buttons, form controls
- No duplicate styling systems
- No unauthorized Homepage changes
- B2C and B2B are separate journeys with shared domain primitives
- B2B is not a cosmetic toggle in B2C UI

## 9. Data Truth Rules

- No fake fares, mocked live inventory, fake PNR, fake issued tickets, fake payments, fake supplier holds
- Non-production fixtures must never appear on customer-facing search/results
- Actual verified manual quotations may appear clearly as request-to-book
- Marketing copy must be service-accurate
- No fabricated discounts, reviews, certifications, or availability

## 10. Commercial Truth Rules

- Guest & authenticated states handled
- No demo customer names visible
- B2B/organization pricing never leaks to B2C
- No blank screens, dead buttons, fake prices, fake holds, fake payments, fictitious issued tickets
- Real supplier and hosted backend capabilities truthfully reflected
- Existing working contracts/tests remain intact
