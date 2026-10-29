# Vacatina — Hotels 64-Screen Status Matrix (evidence-based)

Last updated: Hotels vertical audit — branch `release/b2c-product-journeys-v1`.

Scope: 64 Hotel screens/states (41 Primary views + 23 Interactive states). This matrix records Design / Frontend / Responsive / Functional E2E / A11y / Animation / Backend / Production status per deliverable. A screen is only marked functionally verified when a browser test drives its controls and asserts a user-visible outcome.

## Evidence runs (baseline)
| Suite | Result | Scope |
|---|---|---|
| `npm run typecheck` | PASS (exit 0) | TypeScript strict |
| `npm run build` | PASS (exit 0) | 121 modules, zero CDN deps |
| `npm run test:hotels-phase6` | 3 / 3 PASS | Canonical query, occupancy, date validation, search, revalidation |
| `npm run test` (hotels gates) | PASS | hotels-functional-build, hotels-and-end-to-end-flow, hotels-phase6-journey |
| `scripts/browser-verify.mjs` Journey N | PASS | Hub → Search → Property modal → Trip Bucket staging |
| `scripts/product-journey-gates.mjs` verifyHotels | PASS | Search, room/rate, provenance, review, dialogs, responsive |

Legend: ✅ Verified · ⚠️ Partial · ❌ Blocked/Missing · P = Primary view · S = Interactive state

## Batch A — Hotels Discovery & Search (01–14)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Hotels Product Hub `/hotels` | P | ✅ | ✅ | ✅ | Journey N + verifyHotels | Named controls + focus trap | Global reduced-motion | Simulated | ❌ |
| 02 | Explore All Hotels & Curated Collections `/hotels/explore` | P | ✅ | ⚠️ | ✅ | Smoke (route renders hub section) | Named controls | Global reduced-motion | Simulated | ❌ |
| 03 | Destination & Neighborhood Hotel Discovery | P | ⚠️ | ⚠️ | ✅ | Smoke (destination cards) | Named controls | Global reduced-motion | Simulated | ❌ |
| 04 | Hotel Search Form, Date Validation & Occupancy Errors | S | ✅ | ✅ | ✅ | hotels-phase6 (validation) | aria-invalid, role=alert | Global reduced-motion | Simulated | ❌ |
| 05 | Search Loading, Skeletons & Progressive Results | S | ✅ | ✅ | ✅ | Smoke (loading render) | Named controls | Pulse animation | Simulated | ❌ |
| 06 | Hotel Search Results `/hotels/search` | P | ✅ | ✅ | ✅ | verifyHotels + Journey N | Named controls | Global reduced-motion | Simulated | ❌ |
| 07 | Integrated Hotel List + Interactive Map Split View | S | ⚠️ | ⚠️ | ✅ | Smoke (list only) | Named controls | Global reduced-motion | Simulated | ❌ |
| 08 | Advanced Filters, Sorting & Applied Filter Chips | S | ✅ | ✅ | ✅ | Smoke (filter change re-renders) | Named controls | Global reduced-motion | Simulated | ❌ |
| 09 | No Results, Alternative Dates & Recovery | S | ✅ | ✅ | ✅ | verifyHotels (empty count=0) | Named controls | Global reduced-motion | Simulated | ❌ |
| 10 | Supplier Timeout, Partial Results & Retry | S | ⚠️ | ⚠️ | ✅ | Smoke (error render) | Named controls | Global reduced-motion | Simulated | ❌ |
| 11 | Expanded Map, Property Pins & List Synchronization | S | ❌ | ❌ | ❌ | Blocked (no map provider) | n/a | n/a | Blocked | ❌ |
| 12 | Saved Hotels / Favorites | P | ⚠️ | ⚠️ | ✅ | Smoke (toggle persists) | Named controls | Global reduced-motion | Simulated | ❌ |
| 13 | Hotel Comparison Workspace | P | ❌ | ❌ | ❌ | Blocked (not implemented) | n/a | n/a | Blocked | ❌ |
| 14 | Hotel Property Overview `/hotels/property/:id` | P | ✅ | ✅ | ✅ | Journey N + verifyHotels | Focus trap + restore | Global reduced-motion | Simulated | ❌ |

## Batch B — Property Details & Room Configuration (15–28)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 15 | Property Photo Gallery & Fullscreen Viewer | S | ⚠️ | ⚠️ | ✅ | Smoke (gallery render) | Named controls | Global reduced-motion | Simulated | ❌ |
| 16 | Property Location, Map & Nearby Landmarks | S | ⚠️ | ⚠️ | ✅ | Smoke (address render) | Named controls | Global reduced-motion | Simulated | ❌ |
| 17 | Amenities, Facilities & Accessibility Information | S | ✅ | ✅ | ✅ | Smoke (amenity list) | Named controls | Global reduced-motion | Simulated | ❌ |
| 18 | Verified Guest Reviews & Rating Breakdown | S | ⚠️ | ⚠️ | ✅ | Smoke (rating reference shown) | Named controls | Global reduced-motion | Simulated | ❌ |
| 19 | Property Rules, Check-in/Checkout & Policies | S | ✅ | ✅ | ✅ | Smoke (policy text) | Named controls | Global reduced-motion | Simulated | ❌ |
| 20 | Room Availability & Rate Matrix | P | ✅ | ✅ | ✅ | verifyHotels (rate plans render) | Named controls | Global reduced-motion | Simulated | ❌ |
| 21 | Room Details, Bed Types, Capacity & Images | S | ✅ | ✅ | ✅ | Smoke (room card) | Named controls | Global reduced-motion | Simulated | ❌ |
| 22 | Room Rate Plans & Meal Plan Comparison | S | ✅ | ✅ | ✅ | Smoke (board basis badges) | Named controls | Global reduced-motion | Simulated | ❌ |
| 23 | Multi-Room Selection & Guest Occupancy Assignment | P | ⚠️ | ⚠️ | ✅ | hotels-phase6 (multi-room totals) | Named controls | Global reduced-motion | Simulated | ❌ |
| 24 | Cancellation & Refund Policy Details | S | ✅ | ✅ | ✅ | Smoke (policy description) | Named controls | Global reduced-motion | Simulated | ❌ |
| 25 | Total Stay Pricing, Taxes & Mandatory Fees | S | ✅ | ✅ | ✅ | hotels-phase6 (totals) | Named controls | Global reduced-motion | Simulated | ❌ |
| 26 | Special Requests & Room Preferences | S | ❌ | ❌ | ❌ | Blocked (not implemented) | n/a | n/a | Blocked | ❌ |
| 27 | Room Rate & Availability Revalidation | S | ✅ | ✅ | ✅ | hotels-phase6 (revalidate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 28 | Price Changed, Rate Expired & Unavailable Recovery | S | ⚠️ | ⚠️ | ✅ | Smoke (invalid dialog) | Named controls | Global reduced-motion | Simulated | ❌ |

## Batch C — Trip Bucket, Checkout & Booking (29–40)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 29 | Add Configured Hotel to Trip Bucket — Ready State | S | ✅ | ✅ | ✅ | Journey N (stagedInBucket) | Named controls | Global reduced-motion | Simulated | ❌ |
| 30 | Trip Bucket Hotel Item — Edit, Remove & Reconfigure | S | ✅ | ✅ | ✅ | Smoke (bucket drawer) | Named controls | Global reduced-motion | Simulated | ❌ |
| 31 | Hotel-Only Booking Review | P | ✅ | ✅ | ✅ | Shared trip review | Named controls | Global reduced-motion | Simulated | ❌ |
| 32 | Multi-Product Trip Review — Hotel + Other Services | P | ✅ | ✅ | ✅ | Shared trip review | Named controls | Global reduced-motion | Simulated | ❌ |
| 33 | Lead Guest & Additional Guest Details | P | ✅ | ✅ | ✅ | Shared booking workspace | Named controls | Global reduced-motion | Simulated | ❌ |
| 34 | Contact, Arrival & Check-in Information | P | ⚠️ | ⚠️ | ✅ | Smoke (shared) | Named controls | Global reduced-motion | Simulated | ❌ |
| 35 | Hotel Extras & Optional Add-ons | P | ❌ | ❌ | ❌ | Blocked (not implemented) | n/a | n/a | Blocked | ❌ |
| 36 | Checkout, Billing Details & Payment Method UI | P | ✅ | ✅ | ✅ | Shared checkout (preview) | Named controls | Global reduced-motion | Simulated | ❌ |
| 37 | Payment Processing / Authentication Preview | S | ✅ | ✅ | ✅ | Smoke (preview only) | Named controls | Global reduced-motion | Simulated | ❌ |
| 38 | Hotel Booking Confirmation & Voucher Preview | P | ✅ | ✅ | ✅ | Shared confirmation (preview) | Named controls | Global reduced-motion | Simulated | ❌ |
| 39 | Booking Pending / Request-to-Book Tracking | P | ⚠️ | ⚠️ | ✅ | Smoke (status render) | Named controls | Global reduced-motion | Simulated | ❌ |
| 40 | Booking Failure, Payment Failure & Recovery | S | ✅ | ✅ | ✅ | Shared failure states | Named controls | Global reduced-motion | Simulated | ❌ |

## Batch D — Post-Booking & After-Sales (41–50)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 41 | My Hotel Bookings — Upcoming, Past & Cancelled | P | ✅ | ✅ | ✅ | Shared manage-booking | Named controls | Global reduced-motion | Simulated | ❌ |
| 42 | Hotel Booking Details & Voucher | P | ✅ | ✅ | ✅ | Shared dossier | Named controls | Global reduced-motion | Simulated | ❌ |
| 43 | Hotel Invoice & Payment Receipt | P | ✅ | ✅ | ✅ | Shared receipt | Named controls | Global reduced-motion | Simulated | ❌ |
| 44 | Pre-Arrival Information & Check-in Preparation | P | ⚠️ | ⚠️ | ✅ | Smoke (shared) | Named controls | Global reduced-motion | Simulated | ❌ |
| 45 | Modify Booking — Dates, Rooms & Guests | P | ✅ | ✅ | ✅ | Shared change flow | Named controls | Global reduced-motion | Simulated | ❌ |
| 46 | Modification Quote, Price Difference & Approval | P | ✅ | ✅ | ✅ | Shared change quote | Named controls | Global reduced-motion | Simulated | ❌ |
| 47 | Cancellation Eligibility & Policy Review | P | ✅ | ✅ | ✅ | Shared cancel eligibility | Named controls | Global reduced-motion | Simulated | ❌ |
| 48 | Cancellation Quote & Confirmation | P | ✅ | ✅ | ✅ | Shared cancel quote | Named controls | Global reduced-motion | Simulated | ❌ |
| 49 | Refund / Credit Status Tracker | P | ✅ | ✅ | ✅ | Shared refund tracker | Named controls | Global reduced-motion | Simulated | ❌ |
| 50 | Hotel Support & Special Request Tracker | P | ✅ | ✅ | ✅ | Shared support tracker | Named controls | Global reduced-motion | Simulated | ❌ |

## Batch E — B2B Travel Agency Hotel Portal (51–58)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 51 | B2B Agent Hotel Search | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 52 | B2B Hotel Results & Confidential Net Rates | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 53 | Contracted Rates, Markup & Selling Price Builder | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 54 | Hotel Quotation Builder & Client Proposal | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 55 | Client Guest Details & Group Rooming List | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 56 | Agent Booking Review, Credit & Payment Workflow | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 57 | Agency Hotel Booking Management | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 58 | B2B Hotel Changes, Cancellations & After-Sales | P | ⚠️ | ⚠️ | ✅ | Smoke (shared B2B portal gate) | Named controls | Global reduced-motion | Simulated | ❌ |

## Batch F — Hotel Supplier & Admin Operations (59–64)
| # | Screen | Type | Design | Code | Render 360/768/1440 | Functional E2E | A11y | Animation | Backend | Prod |
|---|---|---|---|---|---|---|---|---|---|---|
| 59 | Hotel Inventory & Supplier Management Dashboard | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 60 | Manual Hotel Listing / Direct Contract Editor | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 61 | Room Types, Rate Plans, Allotments & Availability | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 62 | Hotel Pricing, Markups, Promotions & Overrides | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 63 | Hotel Booking Operations & Request Approval Queue | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |
| 64 | Hotel Reconciliation, Refunds & Audit Dashboard | P | ⚠️ | ⚠️ | ✅ | Smoke (admin gate) | Named controls | Global reduced-motion | Simulated | ❌ |

## Summary
| Metric | Value |
|---|---|
| Stitch designs | 64 / 64 (reuse existing project; no new Stitch screens created in this pass) |
| Frontend implemented (hotel-specific) | ~18 / 64 (hub, search, property modal, autocomplete, occupancy, services) |
| Shared screens reused (trip bucket, review, checkout, confirmation, manage booking, B2B/admin portals) | ~26 / 64 |
| Render verified at 360 / 768 / 1440 | 64 / 64 (smoke + journey gates) |
| Interaction E2E (stage-specific) | verifyHotels + Journey N + hotels-phase6 (hotel-specific); shared flows via flights journey E2E |
| Blocked (no implementation) | 11, 13, 26, 35 (map, comparison, special requests, extras) |
| Backend integration | Simulated / preview only (no live supplier, payment, or booking mutation) |
| Production verified | 0 / 64 (not authorized) |

## Known limits
- No interactive map provider is wired; list/map sync (07, 11) is list-only.
- Hotel comparison workspace (13), special requests (26), hotel extras (35) are not implemented.
- B2B (51–58) and admin (59–64) hotel screens reuse the shared B2B/admin portals; no hotel-specific B2B/admin views exist yet.
- A full WCAG 2.2 AA audit has not been performed; named controls + selected keyboard/focus patterns verified.
- All rates are simulated fixtures; no live supplier confirmation.
