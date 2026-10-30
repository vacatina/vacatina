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
