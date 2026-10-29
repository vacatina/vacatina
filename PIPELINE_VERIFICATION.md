# Vacatina — Local → GitHub → Vercel Pipeline Verification (READ-ONLY)

**Date:** 30 Oct 2026 · **Mode:** Read-only (no code changes, commits, pushes, merges, resets or deployments)

## 1. Local Git State
| Field | Value |
|---|---|
| Current branch | `release/b2c-product-journeys-v1` |
| HEAD commit | `88bc74369724ee40c941a97caeb8d678fc7ec50e` |
| Remote URL | `https://github.com/vacatina/vacatina.git` |
| Upstream tracking | **None configured** (no upstream for this branch) |
| Uncommitted modified files | 20 |
| Untracked files | 20 (includes AUDIT_REPORT.md, SCREEN_STATUS_MATRIX.md, IMPLEMENTATION_EVIDENCE.md, stitch_download/, stitch_export/, new scripts, new src files, tests) |
| Git user | `vacatina` <vacatinaglobal@gmail.com> |

## 2. Local vs GitHub (origin)
| Branch | Local HEAD | Remote HEAD | Ahead | Behind | Status |
|---|---|---|---|---|---|
| `main` | 88bc743 (local) | 05a4d9a (origin/main) | 51 | 38 | **Diverged** (no common ancestor) |
| `release/b2c-product-journeys-v1` | 88bc743 | 413aba8 (origin/release) | 1 | 0 | Local is 1 commit ahead of origin/release |

**Key findings:**
- Local HEAD (`88bc743`) is **51 commits ahead** and **38 commits behind** `origin/main` (`05a4d9a`). These branches have **no common ancestor** (unrelated histories) — they are completely diverged.
- Local branch is **1 commit ahead** of `origin/release/b2c-product-journeys-v1` (`413aba8`), with no upstream tracking configured.
- There are **20 uncommitted modified files** and **20 untracked files** that are NOT pushed to GitHub.

## 3. Vercel Project Connection
| Field | Value |
|---|---|
| Vercel project name | `vacatina` |
| Current linked project ID | `prj_7ceGtYsnEZMwaAWftIYZRz32iGa7` |
| Org/Team ID | `team_xj1N5ykrhBZsd1EAbEFvZU2v` |
| Backup project ID (in .env.preview.local) | `prj_EqFcUJ21EAwVswuSg6sE83cm4L05` |
| Vercel CLI | **Not installed** (cannot query deployments directly) |

**Mismatch detected:** The `.vercel/project.json` points to `prj_7ceGtYsnEZMwaAWftIYZRz32iGa7`, but the `.env.preview.local` OIDC token and `.vercel/project.json.backup` reference `prj_EqFcUJ21EAwVswuSg6sE83cm4L05`. The Vercel CLI-linked project may differ from the one used for preview environment tokens.

## 4. Automatic Deployment Settings
From `vercel.json`:
```json
"git": { "deploymentEnabled": { "release/b2c-product-journeys-v1": false } }
```
- **Automatic deployment is DISABLED** for the `release/b2c-product-journeys-v1` branch.
- Production branch (presumably `main`) deployment status not explicitly configured in vercel.json.
- Build command: `node scripts/build.mjs`
- Output directory: `dist-site`
- Node version: 24.x (from backup settings)

## 5. Latest Vercel Deployment
- **Cannot be determined** — Vercel CLI is not installed and no API token is available.
- The `.vercel/output/` directory contains a local build output (from `npm run build`), not a deployment record.
- No deployment SHA or deployment ID found in the repository.

## 6. Synchronization Summary

| Layer | Status | Evidence |
|---|---|---|
| Local working tree | Has uncommitted changes (20 modified + 20 untracked) | `git status --short` |
| Local → GitHub (origin/main) | **Diverged** (51 ahead, 38 behind, no common ancestor) | `git rev-list --left-right --count origin/main...HEAD` |
| Local → GitHub (origin/release) | 1 commit ahead, no upstream tracking | `git rev-list --left-right --count origin/release...HEAD` |
| GitHub → Vercel (auto-deploy) | **Disabled** for current branch | `vercel.json` `deploymentEnabled: false` |
| Vercel project link | Mismatch between project.json and .env.preview.local | Two different project IDs |
| Latest Vercel deployment | **Unknown** (no CLI, no API token) | N/A |

## 7. Verified Percentages
| Check | Result |
|---|---|
| Local branch identified | 100% (release/b2c-product-journeys-v1) |
| Remote URL identified | 100% (https://github.com/vacatina/vacatina.git) |
| GitHub sync status | Verified (diverged from main, 1 ahead of release) |
| Vercel project link | Partial (project.json vs .env.preview.local mismatch) |
| Vercel auto-deploy status | Verified (disabled for current branch) |
| Latest Vercel deployment commit | **Unknown** (no CLI/API access) |
| Overall pipeline verification | **~70%** (local+GitHub verified; Vercel deployment details unavailable without CLI) |

## 8. Missing Connections / Blockers
1. **No upstream tracking** for `release/b2c-product-journeys-v1` — `git push` without arguments will fail.
2. **Branch divergence** — local `main` (if it exists) and `origin/main` have unrelated histories (no common ancestor).
3. **Vercel project ID mismatch** — `.vercel/project.json` (`prj_7ceGtY...`) differs from `.env.preview.local` OIDC token (`prj_EqFcUJ...`). Re-link with `vercel link` to resolve.
4. **Auto-deployment disabled** — `vercel.json` explicitly disables deployment for the current branch.
5. **No Vercel CLI installed** — cannot query deployment history or status.
6. **No Vercel API token** in environment — cannot fetch deployment info via REST API.
7. **Uncommitted work not pushed** — 20 modified + 20 untracked files are local only.

## 9. Recommendations (no actions taken)
1. Install Vercel CLI (`npm i -g vercel`) and run `vercel link` to resolve project ID mismatch.
2. Set upstream tracking: `git push -u origin release/b2c-product-journeys-v1`.
3. Reconcile the divergence between local and origin/main before any merge.
4. Enable deployment for the release branch in vercel.json when ready to deploy.
5. Commit or stash all WIP before any push/merge operation.