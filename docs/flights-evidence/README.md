# Flights verification evidence

## Accepted application (immutable attribution)

- Application SHA: `6054dc541a0b3a703bf39cdca714bc238b472dc3`.
- Deployment: `dpl_ChwLz4tU3agQjmY1J9gFw5whjv7X`, READY.
- URL: https://vacatina-8cgmadjx1-vacatinas-projects.vercel.app
- Saved original results: [72-case JSON](accepted-6054dc5/acceptance-trusted-results.json) and [case-level report](accepted-6054dc5/DEPLOYED_ACCEPTANCE_FINAL.md).
- 68 PASS / 0 FAIL / 4 BLOCKED. The four blocked cases are D4, D6, D7 and D8 (public-demo/auth gates). D14 passed.
- Prior attribution to `ca84e34` was incorrect. Evidence-only commits made later are **not** this tested application SHA.

The artifacts were copied from the accepted isolated verification worktree, not recreated by rerunning the suite. The probe is now `scripts/verify-flights-deployed-acceptance.mjs`, with transport in `scripts/lib/flights-deployed-cdp.mjs` and the runtime-credential launcher `scripts/run-flights-deployed-acceptance.ps1`. Only import/path relocation and transport extraction were needed; case IDs, assertions, routes and viewport sizes are preserved. The historical report retains its original reproduction filenames; use the repository paths in this README going forward.

This is Flights-only case evidence, not evidence of all 64 screens passing, live booking, authentication, payment, ticketing, or WCAG compliance. Custom validation is used (`novalidate` on the manual-request form). No credentials or browser profiles belong in this directory.

## Additional gap QA

See `FLIGHTS_QA_COVERAGE.md` for the 64-screen inventory and `gap-qa/` for subsequent results. Local fixture runs are separate from hosted acceptance and cannot remove the four hosted blockers. Absence of evidence is recorded as **NOT VERIFIED**.

### Reproduction and provenance

- Evidence-only commit preserving the accepted baseline: `e1724c0824e360ca1ef7d972e1710d5eb074f2f6` (no application-source changes).
- Subsequent application QA fixes: `3ce16d45f8be9e4dcfe3762e043db8f4d85e7b74`.
- Resulting tested Preview: https://vacatina-c9hgdrkwi-vacatinas-projects.vercel.app — `dpl_42SvpZE3YPhFqwpMw776mg2tf7fe`, READY, source SHA verified through Vercel metadata.
- Affected hosted QA only: `gap-qa/hosted-fix-validation/results.json`, **24 PASS / 0 FAIL / 1 BLOCKED / 25 cases**. This is not a new 72-case acceptance run. H42 is blocked by the public-demo/auth gate; its styling was checked locally.
- Baseline local gap scan: `gap-qa/results.json`; corrected fixtures and affected rechecks: `gap-qa/fix-validation/results.json`; accurate Screen 56 route and updated Screen 46: `gap-qa/route-state-followup/results.json`.
- Dedicated local keyboard/focus/feedback checks: `gap-qa/keyboard-focus/results.json` (9/9). The pre-commit local checks explicitly record dirty application files rather than misattributing them to their HEAD. The hosted follow-up is attributed to the committed application SHA.
- `gap-qa/visual-review.json` records **partial macro-layout review**, not complete visual acceptance. Contact sheets and full-size screenshots are stored alongside their JSON measurements.

Local gap QA requires a non-public-demo build (`npm run build` with VERCEL/VACATINA_PUBLIC_DEMO unset), then `node scripts/verify-flights-qa-gaps.mjs`. Limit follow-ups with `QA_SCREENS=02,04,...`, set `QA_FOCUSED=1` for keyboard checks, and keep `FLIGHTS_QA_OUTPUT` distinct to preserve prior evidence. Do not run this against the dirty primary workspace when validating a committed application.

The optional automated accessibility engine is **axe-core 4.10.3**, downloaded outside the repository from `https://unpkg.com/axe-core@4.10.3/axe.min.js`, SHA256 `880970C081707360E64F34CEA25FF91892F5BC95675B0776925B9709DD8A68BB`. Set `AXE_CORE_PATH` to that reviewed local file. It is a QA dependency only, not shipped in the application bundle or installed into the project. Incomplete axe rules still require human review. No real assistive-technology listening test or complete browser-zoom audit was performed.

`scripts/verify-flights-qa-preview.mjs` checks only the affected hosted components; it requires metadata-verified `PREVIEW_BASE`, `EXPECTED_SHA`, `EXPECTED_DEPLOYMENT`, and a runtime-only automation bypass where protection requires it. No secret value is saved in this repository.
