# GAS START HERE — Vacatina Direct GitHub Handover
**Status:** HANDOVER AVAILABLE; GAS receipt pending  
**Entry point:** `docs/handover/GAS_START_HERE.md`  
**Full job dossier:** [GAS_VACATINA_MASTER_JOB_HANDOVER_2026-10-31.md](GAS_VACATINA_MASTER_JOB_HANDOVER_2026-10-31.md)  
**Ongoing task/status ledger:** [GAS_EXECUTION_STATUS.md](GAS_EXECUTION_STATUS.md)  
**Repo:** `vacatina/vacatina` | **Required source branch:** `release/b2c-product-journeys-v1`  
**Target app:** `c02aa166-b588-4c4e-ab59-b0c038dd71d7`  
**Stitch design source (reported connected):** `17278642140865517453`

## Purpose — JOB HANDOVER, not a giant chat prompt
Vacatina's current owner has transferred the complete project context and the Flights 64-state frontend/UI/UX work package in the linked dossier. **Read the full document in bounded sections as needed**; preserve all source-linked authority and acceptance records. Do not regenerate approved UI or start a new project.

## Immediate work package: G0, read-only preflight
**Do not modify any app files yet.**
1. Confirm the real GAS app ID, repository remote, exact branch/HEAD, and dirty/uncommitted state. Do not assume imported code equals remote GitHub.
2. Compare local GAS `package.json`, build command/framework and filesystem against the repository branch. Browser-observed GAS Next.js 16.4.3 and missing `scripts/build.mjs` **conflict** with the GitHub branch's existing custom build script. Identify why; do not create a replacement build script or change runtime yet.
3. Confirm one real read from Stitch project `17278642140865517453` via MCP; distinguish an asset count of 148 from 64 Flights inventory rows.
4. Protect LOCKED Homepage, 11-tab Search Command Center, Header/Footer, Trip Bucket, DESIGN.md, all existing Flights fixtures and role gates. Observe only.
5. Read `docs/flights-evidence/QA_RELEASE_REPORT.md` and `FLIGHTS_QA_COVERAGE.md`. Distinguish 64/64 *inventory* from 68/72 historic acceptance probes and incomplete visual/WCAG audits.

## Required G0 receipt (short)
Respond with **ACTUAL** App ID, repo+branch+SHA, workspace parity PASS/FAIL/BLOCKED, build script conflict explanation, Stitch MCP read proof, no-touch baseline recognition, genuine blockers and a minimal non-destructive plan. State if GitHub files are readable from GAS. DO NOT report integration complete or touch production.

## Later process
Only after G0 is proven: inventory/source crosswalk → 01–16 → 17–32 → 33–48 → 49–64 targeted Flights gap fixes → actual browser interaction/visual/a11y QA → verified GitHub SHA/Vercel Preview → acceptance. Report each stage in the ledger. No backend, live supplier, payment, auth bypass, main merge or production writes without explicit approval.

## Communication / activation truth
The coordinator can put written work orders in GitHub. **A commit does not proactively send a chat instruction to GAS**. To activate this handover from the existing GAS app, the user sends one short message:

`Read docs/handover/GAS_START_HERE.md from GitHub vacatina/vacatina branch release/b2c-product-journeys-v1. Perform G0 read-only handover receipt only. Do not change code.`

If GAS cannot read that branch, report `BLOCKED: GitHub read/sync not verified` instead of inventing access or silently switching to main.
