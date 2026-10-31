# VACATINA — GAS WORK ORDER G0B: SAFE GITHUB REPOSITORY HYGIENE AUDIT
**Date:** 2026-10-31 | **Status:** OPEN / AUDIT ONLY | **Priority:** After G0 source-parity confirmation, before broad Flights changes  
**Owner request (Sinhala):** "Git eka clean karanna kiuwwa nam hari anawashya files goda athi" — audit and make a safe cleanup proposal; protect existing work.  
**Repo:** `vacatina/vacatina` | **Branch:** `release/b2c-product-journeys-v1`  
**Parent handover:** [GAS_START_HERE.md](GAS_START_HERE.md) / [Master job](GAS_VACATINA_MASTER_JOB_HANDOVER_2026-10-31.md)

## Scope: hygiene WITHOUT destructive guessing
There may be unnecessary or duplicated artifacts in Git. **First inventory and prove what is disposable**; do not confuse "old", "large", "unused by current route", or "generated" with "safe to delete". Git history, approval evidence, archived Stitch source and QA baselines are valuable project assets.

### Evidence from coordinator's read-only GitHub browse on 2026-10-31
- Public GitHub repository metadata reports repo size `209889` KB (roughly 205 MiB in GitHub metadata; **not** a measured working-tree footprint).
- Root contains **both** `Vacatina_Flights_OpenCode_Handoff.zip` (6,744,275 bytes) **and** `Vacatina_Flights_OpenCode_Handoff/`; **both** `Vacatina_OpenCode_UX_Skill.zip` (11,649 bytes) **and** `Vacatina_OpenCode_UX_Skill/`. These are **duplicate-format candidates**, not proven identical or unreferenced. ZIP extraction artifacts may include references absent from folders.
- `screenshots/` contains 55 images with 7,563,449 bytes in immediate tracked files. These can be irreplaceable acceptance evidence; **do not delete by size alone**.
- `stitch_vacatina_master_ui_foundation/` contains explicitly `*_locked` historical source exports. **PROTECTED, not cleanup trash**.
- `docs/` contains source-of-truth architecture decisions, inventory certifications, route contracts, Flights QA artifact directories and newly-created GAS handover. **Preserve by default**.
- `.opencode/`, `opencode.json`, `AGENTS.md`, old OpenCode handoff and automation files are legacy-tool candidates; they may still be referenced in CI, project instructions or provenance. **Do not blindly delete**.
- `.gitignore` already excludes `node_modules/`, `dist/`, `dist-site/`, `.vercel/`, `tmp/`, `.data/`, local test profile, secrets and logs. `.vercelignore` already excludes `screenshots` from deploy packaging. **Tracked files are not retroactively deleted by adding ignores**.
- `scripts/build.mjs` **exists on BOTH GitHub branches** checked; it is a required build script for the canonical repository and must **not be removed**. GAS workspace's missing-build error signals source divergence, not useless script.
- Source and acceptance assets are spread across `public/`, `src/`, `scripts/`, `tests/`, `docs/flights-evidence/`, `docs/stitch-reference/`, and root `DESIGN.md`; some look old but are dependent on approved work.

## Execution protocol
### Gate A — verify GAS source parity first
Complete G0: current GAS package/framework, remote, branch, HEAD, uncommitted work; record differences vs GitHub. **Stop if they differ**; do not clean one app while another is source-of-truth.

### Gate B — produce a REPO CLEANUP INVENTORY (READ ONLY)
1. Enumerate tracked and untracked files, top-level and deeper sizes, duplicates by **content SHA256**, branches and references, CI/CD/deployment/build paths, test fixtures, and last-usage evidence. Do not commit untracked secrets.
2. Identify actual bloat and duplicates; categorize **KEEP LOCKED**, **KEEP RUNTIME**, **KEEP AUDIT/QA**, **ARCHIVE CANDIDATE**, **REMOVAL CANDIDATE**, **IGNORE-ONLY**, **UNCERTAIN**. A ZIP+directory is a *candidate* only, not automatic duplication.
3. Detect generated outputs accidentally committed, personal machine artifacts, caches and environment/credential exposure; **never print secret values** or include credentials in a GitHub document. If a secret is found, report it privately to the owner and follow security remediation; do not rely on deletion alone to remove Git history.
4. Trace every candidate to imports, routes, asset manifests, build scripts, workflows, tests, README/docs links and current Stitch handover. Check existence on other branches.
5. Estimate separately: tracked working-tree bytes and repository history size. Ordinary deletion will not shrink Git history. **History rewriting/force pushes are prohibited** without separate explicit approval and coordinated safety procedure.
6. Propose the smallest safe improvements: deduplicate references by reusing authoritative file, update docs links first, extend ignores for newly discovered generated outputs, and archive-only options when uncertain. Keep lockfile and build dependencies consistent; do not switch runtimes or package managers under a cleanup label.
7. Save `docs/handover/GAS_REPO_CLEANUP_AUDIT.md` with per-candidate **path, size, duplicates hashes, references, classification, test blast radius, proposed action, bytes saved, evidence, approval status**; append a dated G0B entry to `GAS_EXECUTION_STATUS.md`.
8. Return a concise owner review: **KEEP / SAFE PROPOSAL / NEEDS APPROVAL / NOT VERIFIED**. Do not claim "cleanup 100%" after only scanning.

### Gate C — changes permitted?
**This work order authorizes only a READ-ONLY AUDIT and CLEANUP PLAN. It does NOT authorize bulk removal.**
- No `git clean -fdx`, `rm -rf`, `git reset --hard`, BFG/history rewrite, forced push, broad import replacement, blanket doc pruning or empty-folder deletion.
- Do not delete/archive/rename **tracked** files, screenshots, Stitch exports, LOCKED screens, supplier fixtures, tests, versioned reports, docs or handover artifacts without an explicit separate approval identifying exact paths.
- If a *separately approved* tiny cleanup is performed later, work on the designated release branch, preserve baseline, list exact paths and before/after hashes, run typecheck/build/tests/routes/locked Homepage QA, commit and verify preview SHA. No `main` merge or production deployment.
- Avoid preemptively committing modifications while source parity and build are blocked.

## Successful handoff result
A grounded per-file clean-up candidate list + non-destructive recommendation, not a magically smaller Git repository. Development can proceed in parallel only on verified unaffected areas. Any removal request must be approved by owner at exact-file scope.

**Completion metric:** G0B audit = audited candidate entries / identified candidate entries, with count and evidence; cleanup execution = 0 changes pending approval, **not** proof files are all unnecessary.
