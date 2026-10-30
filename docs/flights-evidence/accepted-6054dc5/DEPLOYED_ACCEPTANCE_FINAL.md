# Deployed acceptance — consolidated final run

Application SHA: `6054dc541a0b3a703bf39cdca714bc238b472dc3`
Preview: https://vacatina-8cgmadjx1-vacatinas-projects.vercel.app
Deployment: `dpl_ChwLz4tU3agQjmY1J9gFw5whjv7X`, READY; SHA verified through Vercel deployment metadata immediately before execution.

Results: **68 PASS / 0 FAIL / 4 BLOCKED / 72 cases**.
PASS / all planned cases: 68/72 = 94.44%. FAIL: 0/72 = 0%. BLOCKED: 4/72 = 5.56%. Executable-case pass rate: 68/68 = 100%. These are case rates, not 64-screen completion rates.

This table contains only the last complete consolidated run. Prior focused diagnostics, intermediate failed probe-development runs and earlier local checks are not added to these counts. Two consecutive complete runs of this corrected probe produced 68/0/4; counts below refer to the last run only.

| Case | Width (CSS px) | Assertion | Result | Detail |
|---|---:|---|---|---|
| D1 | 1440 | Preview boots | PASS |  |
| D2 | 1440 | Public demo flag | PASS |  |
| B390-1 | 390 | Homepage Flights entry usable | PASS | true |
| B390-2 | 390 | Flights entry responds | PASS |  |
| B390-3 | 390 | Selectable search offer | PASS | true |
| B390-4 | 390 | Offer details opens | PASS |  |
| B390-5 | 390 | Add-to-Trip action enabled | PASS | true |
| B390-6 | 390 | Selected flight enters Trip Bucket | PASS |  |
| B390-7 | 390 | Trip Bucket entry accessible | PASS | true |
| B390-8 | 390 | Review action enabled | PASS |  |
| B390-9 | 390 | Trip Review opens | PASS |  |
| B390-10 | 390 | Passenger continuation CTA | PASS | true |
| B390-11 | 390 | Passenger Details opens | PASS |  |
| B390-12 | 390 | Passenger Continue enabled | PASS | true |
| B390-13 | 390 | Custom passenger validation advances | PASS |  |
| B390-14 | 390 | Checkout Preview CTA enabled | PASS | true |
| B390-15 | 390 | Checkout Preview opens | PASS |  |
| B390-16 | 390 | Simulated completion enabled | PASS | true |
| B390-17 | 390 | Simulated result reached | PASS |  |
| B390-18 | 390 | No issued-ticket claim | PASS |  |
| B390-19 | 390 | Direct: selectable offer | PASS | true |
| B390-20 | 390 | Direct: offer opens | PASS |  |
| B390-21 | 390 | Direct: Book Now enabled | PASS | true |
| B390-22 | 390 | Direct: advances without adding to Trip Bucket | PASS |  |
| B1440-1 | 1440 | Homepage Flights entry usable | PASS | true |
| B1440-2 | 1440 | Flights entry responds | PASS |  |
| B1440-3 | 1440 | Selectable search offer | PASS | true |
| B1440-4 | 1440 | Offer details opens | PASS |  |
| B1440-5 | 1440 | Add-to-Trip action enabled | PASS | true |
| B1440-6 | 1440 | Selected flight enters Trip Bucket | PASS |  |
| B1440-7 | 1440 | Trip Bucket entry accessible | PASS | true |
| B1440-8 | 1440 | Review action enabled | PASS |  |
| B1440-9 | 1440 | Trip Review opens | PASS |  |
| B1440-10 | 1440 | Passenger continuation CTA | PASS | true |
| B1440-11 | 1440 | Passenger Details opens | PASS |  |
| B1440-12 | 1440 | Passenger Continue enabled | PASS | true |
| B1440-13 | 1440 | Custom passenger validation advances | PASS |  |
| B1440-14 | 1440 | Checkout Preview CTA enabled | PASS | true |
| B1440-15 | 1440 | Checkout Preview opens | PASS |  |
| B1440-16 | 1440 | Simulated completion enabled | PASS | true |
| B1440-17 | 1440 | Simulated result reached | PASS |  |
| B1440-18 | 1440 | No issued-ticket claim | PASS |  |
| B1440-19 | 1440 | Direct: selectable offer | PASS | true |
| B1440-20 | 1440 | Direct: offer opens | PASS |  |
| B1440-21 | 1440 | Direct: Book Now enabled | PASS | true |
| B1440-22 | 1440 | Direct: advances without adding to Trip Bucket | PASS |  |
| D4 | 1440 | /bookings/VCT-2026-0001 | BLOCKED | Public-demo/auth gate; underlying journey not exercised |
| D6 | 1440 | /account/trips | BLOCKED | Public-demo/auth gate; underlying journey not exercised |
| D7 | 1440 | /bookings/VCT-2026-0001/change | BLOCKED | Public-demo/auth gate; underlying journey not exercised |
| D8 | 1440 | /admin | BLOCKED | Public-demo/auth gate; underlying journey not exercised |
| D5 | 1440 | Active guest-lookup heading and validation | PASS |  |
| D5-focus | 1440 | Inactive homepage excluded from layout and AX tree | PASS |  |
| D9 | 1440 | Screen 46 cold review render | PASS |  |
| D10 | 1440 | Screen 46 invalid phone custom validation | PASS |  |
| D11 | 1440 | Screen 46 submission and persisted status | PASS |  |
| D12 | 1440 | Screen 48 tracker via click | PASS |  |
| D13 | 1440 | Screen 48 quote link after lifecycle advance | PASS |  |
| D14 | 1440 | Screen 49 preview quotation total | PASS |  |
| D15 | 1440 | Screen 51 B2B search | PASS |  |
| D16 | 1440 | Screen 52 three deterministic offers | PASS |  |
| D17a | 1440 | Selected offer enables quotation | PASS |  |
| D17 | 1440 | Screen 53 quotation via click | PASS |  |
| D18 | 1440 | Deterministic quote totals | PASS |  |
| D19 | 1440 | Markup recomputes client total | PASS |  |
| D20a | 1440 | Screen 03 boots | PASS |  |
| D20 | 1440 | All search-screen controls have accessible names | PASS |  |
| D21-1440 | 1440 | Screen 03 no horizontal overflow | PASS |  |
| D21-768 | 768 | Screen 03 no horizontal overflow | PASS |  |
| D21-390 | 390 | Screen 03 no horizontal overflow | PASS |  |
| D21-360 | 360 | Screen 03 no horizontal overflow | PASS |  |
| D22 | 360 | No uncaught page exceptions | PASS |  |
| D23 | 360 | No console errors | PASS |  |

## Corrected interpretation
- D4/D6/D7/D8 remain BLOCKED: public-demo/auth gate prevents exercising dossier 27, My Trips 26, change 34 and admin 58–64. Seeing the gate is not a PASS for those journeys.
- D14 is PASS in this run after D13 succeeded. Its earlier blocker was a D13 dependency, never an authentication blocker.
- Screen 46 is counted explicitly as D9, D10 and D11 (3/3 PASS); D11 also checks persisted preview status and transition to Screen 47. D12/D13 cover Screen 48; D14 covers Screen 49.
- Validation tested is custom application validation. Screen 46 uses novalidate; no claim is made that native browser constraint validation is enabled.
- D5 scopes its exact heading assertion to the active .flights-guest-lookup section, submits the empty lookup form and checks its accessible error, then tests the existing demo-prefill button. It does not claim access to authenticated booking records.
- D5-focus checks display:none and absence of rendered homepage descendants, absence of the inactive homepage heading from the accessibility tree, and 70 trusted Tab steps without focus entering #main-content. This is not a full WCAG audit.

## Deployed coverage by screen/state
- 03: results and modify panel; accessible control names at 1440; overflow at 1440×900, 768×1024, 390×844, 360×800.
- 04: offer details and Add-to-Trip / direct Book Now at 390×900 and 1440×900.
- 08: fictional passenger entry and custom validation transition at 390×900 and 1440×900.
- Flight review, 12 checkout preview and 14 confirmation: UI transitions only at 390×900 and 1440×900; simulated completion, no ticket/payment claim.
- 25: deployed active guest-lookup heading, empty-form validation, demo prefill, hidden-homepage keyboard/AX exclusion at 1440×900. This screen is not locally-only.
- 26/27/34 and admin 58–64: gated as described above; not accepted as working authenticated journeys.
- 28–33 and 35–45: not exercised in this final deployed run; no blanket deployed PASS or locally-only claim.
- 46: cold review, invalid phone, corrected phone, explicit consent, trusted submit, persisted preview status at 1440×900.
- 47: submitted next screen and Track link at 1440×900.
- 48: tracker and two preview lifecycle advances at 1440×900.
- 49: preview quotation and LKR 185,000 total at 1440×900; acceptance/decline not tested here.
- 51: default agency search; 52: three deterministic offers plus selection; 53: quotation totals and markup recomputation at 1440×900. Screens 54–57 are not exercised in this final run.
- All other screens/states, real authentication, live inventory, real payments, durable customer requests, ticketing and bookings remain outside this acceptance scope.

## Probe and browser safety
- New per-run user-data-dir via mkdtemp; Chrome chooses an ephemeral debugging port. Endpoint is read only from that profile’s DevToolsActivePort file.
- Only the spawned ChildProcess is terminated. No process-name kills, existing profile deletion, or access to user browser tabs.
- Trusted CDP mouse/keyboard/text input only; no el.click fallback, synthetic form events, storage seeding, DOM-value assignment, forced clicks or fixed action sleeps.
- Readiness uses observed visibility, enabled controls, stable rects/hit-testing, checked consent, custom errors, route and persisted status. Poll intervals are readiness checks, not unconditional action delays.
- Add-to-Trip waits for its real asynchronous revalidation and automatically opened drawer. Native date entry uses keyboard segments instead of injected field values.
- No application changes, new application commit, deployment, main merge or production release were performed in this verification task. Unrelated WIP was not edited.

Reproduce: run `scripts/run-acceptance-trusted.ps1` from this isolated worktree. Secrets are loaded at runtime and never included in this report or JSON.