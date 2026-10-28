# Phase 17 visual evidence

See the [audit report](../PHASE17_UI_UX_ACCEPTANCE_AUDIT.md) for acceptance, priorities, limitations and release readiness.

**209 indexed screenshots** and **57 contact sheets** cover the 1440/768/360px audit, before/intermediate defect captures, and the final E2E run. The [manifest](VISUAL_REVIEW_MANIFEST.json) lists every indexed image with dimensions, SHA-256 and review status. Images were actually reviewed; a “reviewed” flag does not mean a before-state is defect-free.

Some early `results` / `zero` filenames show the top-of-page search context rather than the below-fold message. Use the structured test assertions and focused state captures for the outcome, not the filename alone. Protected historical screenshots are listed separately in the manifest and were not recaptured as evidence of this build.

## Comparisons

| Finding | Before | After |
|---|---|---|
| Sandbox schedule and outbound stops | [Desktop](flights-hotels/flights-sandbox-1440.png) | [Desktop](sandbox-after/sandbox-schedule-results-1440.png), [tablet](sandbox-after/sandbox-schedule-results-768.png), [mobile](sandbox-after/sandbox-schedule-results-360.png) |
| Native-currency previous-price precision | [Desktop](comparison-before/sandbox-native-price-before-1440.png) | [Desktop](sandbox-after/sandbox-scenario-price_changed-1440.png), [mobile](sandbox-after/sandbox-scenario-price_changed-360.png) |
| SCC tablet readability | [Hotels](scc-before/scc-768-hotels.png) | [Hotels](scc-after/scc-768-hotels.png), [Rails](scc-after/scc-768-rails.png) |
| Bundle quote-required selection | [Mobile](comparison-before/bundle-quote-before-360.png) | [Mobile](bundle-after/bundle-components-360.png), [tablet](bundle-after/bundle-components-768.png), [desktop](bundle-after/bundle-components-1440.png) |
| Visa undefined color tokens | [Hub](fixes-before/visa-hub-1440.png) | [Hub](fixes-after/visa-hub-1440.png), [results](fixes-after/visa-search-1440.png) |
| Empty Trip Bucket | Baseline source falsely claimed all zero items were Ready | [Mobile disabled CTA](drawer-empty-after/drawer-empty-360.png) |

Fresh sandbox quotes can differ in price/count between searches. The price-change, expired and unavailable screenshots explicitly label deterministic UI scenarios; they are not supplier events or live inventory.

## Reviewed cohorts

| Cohort | Images | Contact-sheet entry |
|---|---:|---|
| SCC baseline, all eleven tabs at three widths | 33 | [SCC baseline](contact-sheets/scc-before-01.png) |
| SCC tablet after correction, all eleven tabs | 11 | [SCC after](contact-sheets/scc-after-01.png) |
| Generic product journeys, configuration, empty/review context | 46 | [Journeys](contact-sheets/journeys-01.png) |
| Seven generic products at tablet width | 14 | [Tablet products](contact-sheets/tablet-products-01.png) |
| Flight demo/manual/sandbox and hotel search/detail/staging | 11 | [Flights/hotels](contact-sheets/flights-hotels-01.png) |
| Visa valid/unsupported destination and mobile context | 8 | [Visa](contact-sheets/visa-01.png) |
| Paused search loading and failed-request recovery | 3 | [Loading/failure](contact-sheets/loading-failure-01.png) |
| Initial defect probes | 3 | [Before probes](contact-sheets/fixes-before-01.png) |
| Initial corrected Visa/review/flight views | 6 | [After probes](contact-sheets/fixes-after-01.png) |
| Bundle corrected components and review blockers | 4 | [Bundle](contact-sheets/bundle-after-01.png) |
| Empty drawer | 2 | [Empty drawer](contact-sheets/drawer-empty-after-01.png) |
| Singular counts, Visa recovery, missing offer and price-change probe | 5 | [Focused scenarios](contact-sheets/focused-scenarios-01.png) |
| Final fresh sandbox schedules and deterministic revalidation | 15 | [Sandbox final](contact-sheets/sandbox-after-01.png) |
| Quote/previous-price before comparisons | 4 | [Comparisons](contact-sheets/comparison-before-01.png) |
| Final E2E captures, excluding the four protected historical files | 44 | [Final E2E](contact-sheets/e2e-final-01.png) |

Remaining numbered contact sheets and their constituent originals are enumerated in the manifest; no image is inferred to be visually correct merely from a DOM assertion.

## Verification records

- [Full unit-test log](unit-tests.log): 331/331.
- [Full E2E log](e2e-final.log): 94/94; [structured report](../BROWSER_VERIFICATION_REPORT.json).
- [Fresh sandbox/scenario checks](sandbox-after-results.json): 16/16.
- [SCC after measurements](scc-after-results.json).
- [Bundle after measurements](bundle-after-results.json).
- [Loading/failure checks](loading-failure-results.json).

The two raw `.log` files retain PowerShell's UTF-16LE encoding; read them as UTF-16 rather than UTF-8. `GATE_RESULTS.json` provides a compact, UTF-8 summary.

The four protected files remain at their required original hashes. They differ from the generated Phase 16 Git blobs; restoring those historical bytes is intentional, not a new visual baseline. `opencode.json` is not part of this evidence or the checkpoint.
