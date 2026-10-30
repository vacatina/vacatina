# Vacatina — 64-Screen Status Matrix (evidence-based)

> Historical implementation/suite summary. For current case-level attribution, local-versus-hosted scope and explicit NOT VERIFIED gaps, use [the maintained 64-screen QA matrix](docs/flights-evidence/FLIGHTS_QA_COVERAGE.md). The preserved accepted application is `6054dc5` (68/0/4 cases); later QA fixes are `3ce16d4`. Neither result proves all 64 screens passed deployed acceptance or a full accessibility audit.

Last updated: Batch E acceptance (screens 15–33) + Batch D (58–64) + Batch C (51–57) + Batch B (46–50) — commit pending on `release/b2c-product-journeys-v1`.

This matrix separates **rendering**, **functional interaction**, **responsive**, **accessibility** and **animation** evidence. A screen is only marked as functionally verified when a browser test drives its controls and asserts a user-visible outcome.

## Evidence runs (this batch)

| Suite | Result | Scope |
|---|---|---|
| `npm run typecheck` | PASS (exit 0) | TypeScript strict |
| `node scripts/build.mjs` | PASS (exit 0) | 117 modules, zero CDN deps |
| `npm test` | 366 / 366 PASS, 0 fail, 0 skipped | Unit + negative-control tests |
| `scripts/browser-verify.mjs` | 126 / 126 PASS, 0 fail, 0 skip | Legacy product journeys (suite-level) |
| `scripts/verify-remaining-screens.mjs` | 79 / 79 PASS, 0 fail + negative control | Rendering / fit / naming / reduced-motion smoke at 360/768/1440 |
| `scripts/verify-batch-a-post-booking.mjs` | **21 / 21 PASS, 0 fail** | **Stage-specific interactions for screens 34–45** |
| Combined browser assertions | 226 PASS, 0 FAIL | 126 + 79 + 21 |

## Coverage tiers

- **Batch A E2E** — screens 34–45. Real clicks, input/change events, validation, quote invalidation, gated buttons, state transitions and preview outcomes.
- **Legacy journey E2E** — screens exercised inside `browser-verify.mjs` named journeys (suite is 126/126; per-screen granularity is journey-scoped, not a per-screen acceptance).
- **Smoke E2E** — renders with the expected heading, fits the viewport, zero console errors, named controls, global reduced-motion CSS. Not a functional interaction acceptance.

## Matrix

| # | Screen | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Home (Flights entry) | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 02 | Flights Hub | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 03 | Search Results | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 04 | Offer Details | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 05 | Fare Family Selection | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 06 | Baggage & Ancillaries | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 07 | Seat Selection | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 08 | Passenger Details | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 09 | Contact & Travel Docs | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 10 | Trip Bucket | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 11 | Review & Recheck | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 12 | Checkout & Payment | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 13 | Payment Authorization | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 14 | Confirmation / Ticketing | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 15 | Search Validation | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 16 | Search Loading / Partial | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 17 | No Flights Found | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 18 | Supplier Outage | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 19 | Expired / Unavailable Offer | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 20 | Price Changed | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 21 | Fare Rules Changed | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 22 | Seat / Baggage Unavailable | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 23 | Payment Failed / Unknown | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 24 | Booking Creation Failed | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 25 | Guest Booking Lookup | ✅ | ✅ | ✅ | Smoke (modal rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 26 | My Trips / My Bookings | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 27 | Booking Details | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 28 | E-Ticket & References | ✅ | ✅ | ✅ | Smoke (panel rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 29 | Receipt / Invoice | ✅ | ✅ | ✅ | Smoke (panel rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 30 | Ticketing Pending / Hold | ✅ | ✅ | ✅ | Smoke (state rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 31 | Travel Prep / Check-in | ✅ | ✅ | ✅ | Smoke (panel rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 32 | Post-Booking Extras | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 33 | Passenger Correction | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated | ❌ |
| 34 | Change — Start | ✅ | ✅ | ✅ | **Batch A E2E: quote, recalculation, invalidation, invalid-range error, continue gate** | Named controls + keyboard focus ring | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 35 | Change — Alternatives | ✅ | ✅ | ✅ | **Batch A E2E: selection gate, persisted choice, navigation** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 36 | Change — Quote & Review | ✅ | ✅ | ✅ | **Batch A E2E: consent gate, accept result, no-quote guard** | Named controls + error roles | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 37 | Change — Complete | ✅ | ✅ | ✅ | **Batch A E2E: completion state reached from review, preview labelled** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 38 | Cancellation Eligibility | ✅ | ✅ | ✅ | **Batch A E2E: continue navigation to quote stage** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 39 | Cancellation Quote / Approval | ✅ | ✅ | ✅ | **Batch A E2E: reason + consent gate, preview result** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 40 | Cancellation Result | ✅ | ✅ | ✅ | **Batch A E2E: result state + refund link** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 41 | Refund / Credit Tracker | ✅ | ✅ | ✅ | **Batch A E2E: quoted → paid → rejected lifecycle transitions** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 42 | Disruption Alert | ✅ | ✅ | ✅ | **Batch A E2E: accept / alternative / support outcomes distinct** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 43 | Disruption Alternative Decision | ✅ | ✅ | ✅ | **Batch A E2E: selection gate, decision recorded, outcome tied to choice** | Named controls | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 44 | Special Assistance / Support Request | ✅ | ✅ | ✅ | **Batch A E2E: type + consent gate, validation, preview reference** | Named controls + aria-invalid + role=alert | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 45 | Support Case Tracker | ✅ | ✅ | ✅ | **Batch A E2E: validation, case added to history, preview reference** | Named controls + aria-invalid + role=alert | Reduced-motion collapse + transitions verified | Simulated preview | ❌ |
| 46 | Manual Request Review | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 47 | Request Submitted | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 48 | Request Status Tracker | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 49 | Operator Quotation Review | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 50 | Declined Request Recovery | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 51 | Agent Flight Search (B2B) | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls (aria-labels) | Global reduced-motion | Simulated | ❌ |
| 52 | B2B Results & Net Fares | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 53 | Quotation Builder | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 54 | Client Passenger / Doc Collection | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 55 | Agent Booking / Credit / Payment | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 56 | Agent Booking & Ticket Mgmt | ✅ | ✅ | ✅ | Legacy journey E2E | Named controls | Global reduced-motion | Simulated | ❌ |
| 57 | Agent After-Sales Mgmt | ✅ | ✅ | ✅ | Smoke (view rendering) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 58 | Supplier Config & Health | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 59 | Manual Inventory CMS | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 60 | Pricing / Margin Rules | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 61 | Fulfilment & Ticketing Queue | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 62 | Exchanges / Cancel / Refund Desk | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 63 | Disruption Queue | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated preview | ❌ |
| 64 | Reconciliation & Audit | ✅ | ✅ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated preview | ❌ |

## Summary

| Metric | Value |
|---|---|
| Stitch designs | 64 / 64 |
| Locally implemented | 64 / 64 |
| Rendering verified at 360 / 768 / 1440 | 64 / 64 (smoke suite) |
| **Interaction E2E (stage-specific)** | **34 / 64 (53.1%) — 22 legacy journey + 12 Batch A** |
| Smoke-only (no stage-specific interaction acceptance) | 30 / 64 |
| A11y named controls | 64 / 64 |
| A11y full WCAG 2.2 AA audit | Not claimed. Batch A adds keyboard focus-ring (34), `role="alert"` errors and `aria-invalid` (39, 44, 45), `aria-disabled` honesty (all 34–45) |
| Animation | Batch A: reduced-motion collapse + transitions verified on 34; all screens carry global reduced-motion CSS |
| Backend integration | Simulated / preview only |
| Production verified | 0 / 64 (not authorized) |

## Batch A evidence detail (21/21 PASS)

`scripts/verify-batch-a-post-booking.mjs` — real browser interaction, no rendering-only checks:

1. 34 — continue blocked before quote (`disabled` + `aria-disabled="true"`)
2. 34 — quote calculates (7 days → LKR 15,000) and unlocks continue
3. 34 — quote recalculates for a longer stay (13 days → LKR 19,000)
4. 34 — date change invalidates quote, clears stored quote, re-locks continue, announces status
5. 34 — invalid date range blocks quote and sets `aria-invalid`
6. 34 — valid dates + continue navigates to `/change/alternatives`
7. 35 — alternative selection unlocks review and persists choice
8. 36 — explicit consent required before accept; preview result shown
9. 37 — completion state reached from review, preview labelled, reference shown
10. 36 guard — review without an active quote cannot accept
11. 38 — eligibility → quote stage navigation
12. 39 — reason + terms gate confirmation; preview result
13. 40 — result state and refund tracker link
14. 41 — quoted → paid → rejected lifecycle transitions
15. 42 — three disruption decisions produce distinct outcomes
16. 43 — decision selection gate and recorded outcome tied to choice
17. 44 — assistance type + consent gate, validation, preview reference
18. 45 — validation then case appended to case history
19. A11y — real keyboard Tab reaches the date input with a visible focus ring
20. Animation — reduced motion collapses animation/transition; normal motion preserved
21. Negative control — removing the wired listener stops invalidation (proves the assertion is listener-driven, not cosmetic)

## Known limits (no false claims)

- **Clerk auth:** the invalid-publishable-key error is caught by a scoped guard; real auth still needs a localhost-allowed key. No security bypass.
- **Backend:** no live reissue, refund processing, ticketing, payment or supplier confirmation. Every such action is labelled preview and never reported as completed.
- **A11y:** named controls and selected keyboard/error patterns are verified; a full WCAG 2.2 AA audit (contrast, zoom, screen-reader flows) has not been performed.
- **Animation:** verified for the Batch A change screen and global reduced-motion CSS; other screens are not individually animation-tested.
- **Legacy journey E2E** is suite-level (126/126), not a per-screen acceptance.
- **Production:** not authorized. No merge to `main`.
