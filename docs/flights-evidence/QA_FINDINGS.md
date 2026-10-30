# Flights supplemental QA findings

Baseline under audit: application `6054dc541a0b3a703bf39cdca714bc238b472dc3`. These findings are separate from the accepted 72-case journey probe.

## Confirmed

### FL-QA-01 — misleading payment/refund claims on Screen 24

- Route: `/flights/checkout/booking-failed`.
- Reproduced locally at 390, 768 and 1440 CSS px; screenshots `gap-qa/screen-24-{width}.png`.
- Heading copy states "The payment was captured" and the alert promises "will be released or refunded automatically", although the footer states this is a deterministic preview with no payment capture.
- This is a commercial-truth/copy defect, not missing backend work. The smallest correction is to explicitly describe a simulated failure, remove captured-payment assertions and automatic-refund promises, and preserve the current layout, alert, recovery controls and preview disclaimer.

## Audit limits that are not application passes

- Screens 06/07: real ancillary/seat availability needs a supplier/sandbox fixture; planning inventory cannot prove these states.
- Screen 13: no live payment-authorization fixture is enabled. Do not implement a backend or fabricate a success state for QA.
- Screen 16: settled results do not prove loading/partial-state rendering.
- Screen 21: ordinary fare rules do not prove a changed-rules state.
- A modal screenshot without a selected fare-family control does not verify Screen 05. Use the existing labelled supplier fixture instead of weakening the assertion.
- Screens 26–45 and 58–64 may be explored as **local fixtures only**. Their local QA cannot remove hosted authentication/public-demo blockers.
- Accessibility-tree/axe output is semantic/automated evidence, not an actual screen-reader listening test or complete WCAG audit. 320 CSS px is a reflow approximation, not proof of browser zoom correctness.

## New deterministic fixtures added in this QA pass

| Screen | Fixture | Route / state | Evidence |
|---|---|---|---|
| 06 | Offer modal baggage/ancillary sub-state (existing fare-family baggage cards) | `/flights/offer/sup-flt-cmb-dxb-fz548` offer | `gap-qa/new-state-followup/screen-06-{390,768,1440}.png` |
| 16 | Controllable loading state (`qaHoldLoading=1` keeps spinner visible until `#btn-advance-loading`) | `/flights/search?...&qaHoldLoading=1` | `gap-qa/new-state-followup/screen-16-{390,768,1440}.png` |
| 21 | `sup-flt-fare-rules-changed-sim` simulated fare-rules change (adapter returns `RECHECK_REQUIRED`) | `/flights/offer/sup-flt-fare-rules-changed-sim` | `gap-qa/new-state-followup/screen-21-{390,768,1440}.png` |

Application changes: `src/features/flights/ui/flights-search-view.ts` (controllable loading), `src/features/flights/data/supplier-fixtures.ts` + `src/features/flights/adapters/supplier-api-flight.adapter.ts` (fare-rules-changed simulation). No real supplier/payment/booking integration.

## Still NOT VERIFIED (precise blockers)

- Screen 07 (seat availability): requires Duffel TEST MODE network via "Load seat maps"; no deterministic offline fixture. Do not fabricate seat maps.
- Screen 13 (payment authorization): no distinct authorization preview state; checkout remains a gated static preview with disabled payment methods.
- Workflows 19/20/22/36/56/57: existing E2E coverage confirmed (Batch E 44/44, Batch C 53/53 PASS). Deeper state-continuity evidence is in those suites; supplemental visual capture remains partial.
- Real screen-reader listening: no assistive technology available in this environment (NVDA/JAWS/VoiceOver not installed). Axe + keyboard + AX-tree checks are not a substitute. Blocker recorded; no WCAG compliance claim.
- True browser zoom (not 320px approximation), manual contrast exclusions, all interaction states, full-size/all-state visual acceptance: NOT VERIFIED.

## Fixed in application commit `3ce16d45f8be9e4dcfe3762e043db8f4d85e7b74`
| ID | Reproduced defect | Minimal fix | Validation |
|---|---|---|---|
| FL-QA-01 | Screen 24 captured-payment assertion / automatic-refund promise | Explicit simulated failure; no transaction promise | Local screenshots; hosted H24 at all 3 widths and H-K09 |
| FL-QA-02 | Screen 02 airport inputs expose aria-expanded without a supporting role (axe aria-allowed-attr) | Existing autocomplete becomes a combobox with listbox popup; stale active-descendant cleared | Local K01; hosted H-K01; H02 axe scans at all 3 widths |
| FL-QA-03 | Screen 04 Book Now white text on #059669 is 3.76:1 (needs 4.5:1) | Same green action, darker emerald-700 (#047857) | Source contrast test + local/hosted axe on H04 at all 3 widths |
| FL-QA-04 | Screen 04 scrollable details region has no keyboard access | Named tabindex=0 region; no layout change | K02/K04, hosted H-K02/H-K04, axe scroll-region recheck |
| FL-QA-05 | Screen 11 explanatory payment text faded to 2.77:1 | Remove opacity only from read-only explanatory panels; real payment controls stay gated | Local/hosted H11 axe; gating source test |
| FL-QA-06 | Screen 42 enabled accept action white text on #16a34a is 3.29:1 | Approved brand-success green (#15803D) | Local fixture axe 0; hosted H42 remains BLOCKED, not a hosted PASS |
| FL-QA-07 | Screen 46 shows literal &amp; in step label | Escape the raw ampersand once | Source test; local K06 and hosted H-K06; all-width screenshots |

Source changes are limited to six Flights UI files; no homepage/SCC/header/footer/Trip Bucket redesign, auth changes or backend changes. Local checks were 9/9 PASS; current application affected hosted checks were 24 PASS / 0 FAIL / 1 BLOCKED. These are separate denominators from the original 68/0/4 baseline.
