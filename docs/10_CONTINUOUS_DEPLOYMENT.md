# Vacatina Continuous Deployment Architecture & Workflow Specification

This document details the continuous deployment architecture, environment configurations, and release procedures for the Vacatina B2C Travel Operating System.

> **Current baseline (27 October 2026):** the local server-backed stabilization checkpoint verifies at **233/233 tests**, **0 typecheck errors**, and a passing build. No push, production deployment or database migration was performed. See [`ENGINEERING_BASELINE.md`](./ENGINEERING_BASELINE.md). Generated `dist/`, `dist-site/` and `.vercel/` outputs are not committed.

---

## 1. Environment & Infrastructure Topology

| Resource | Value / Identifier | Notes |
|---|---|---|
| **GitHub Repository** | `https://github.com/vacatina/vacatina` | Dedicated private repository |
| **Vercel Project** | `vacatina` (`prj_EqFcUJ21EAwVswuSg6sE83cm4L05`) | Hosted on Vercel Edge Network |
| **Vercel Team / Org** | `vacatinas-projects` (`team_xj1N5ykrhBZsd1EAbEFvZU2v`) | Team owner |
| **Live Production Alias** | `https://vacatina-nu.vercel.app` | Canonical live URL preserved |
| **Production Branch** | `main` | Production deployment branch |
| **Build Command** | `node scripts/build.mjs` | Compiles Tailwind, TypeScript, generates `dist-site` |
| **Output Directory** | `dist-site` | Preserves root `index.html` with assets |

---

## 2. GitHub Secrets

The private repository `vacatina/vacatina` is pre-configured with the following encrypted GitHub Actions secrets:

- `VERCEL_TOKEN`: Vercel automation authentication token
- `VERCEL_ORG_ID`: `team_xj1N5ykrhBZsd1EAbEFvZU2v`
- `VERCEL_PROJECT_ID`: `prj_EqFcUJ21EAwVswuSg6sE83cm4L05`

---

## 3. Continuous Deployment Workflows

### Automatic CI/CD via GitHub Actions (`.github/workflows/deploy.yml`)
When code is pushed to `main`:
1. **Runner Provisioning**: GitHub Actions runner launches with Ubuntu latest & Node.js 22.
2. **Fresh Installation**: `npm ci` installs clean deterministic dependencies.
3. **Build Pipeline**: `npm run build` runs Tailwind local compiler and assembles `dist-site/`.
4. **Validation Test Suite**: `npm run typecheck` and `npm test` run the full TypeScript and invariant suite (233/233 tests across 24 suites at the Phase 4 baseline).
5. **Vercel Production Pull & Build**: Pulls project metadata and creates production build artifacts.
6. **Vercel Production Deploy**: Deploys prebuilt artifacts and promotes them to `https://vacatina-nu.vercel.app`.
7. **Health Verification**: Performs HTTP 200 health check against `https://vacatina-nu.vercel.app`.

### CLI / Local Continuous Deployment Runner (`npm run cd`)
For rapid workspace testing and deployment:
```powershell
npm run cd
# Or with a custom commit message:
npm run cd -- "feat: updated discovery card details"
```

The runner executes:
1. `npm run build` (Tailwind & module bundling)
2. `npm test` (full 233-test suite at the Phase 4 baseline)
3. `verify-image-relevance.mjs` (40 unique cards, 0 duplicates)
4. `scan-truthful-copy.mjs` (0 unsupported claims)
5. `git add .` + `git commit` + `git push origin main`
6. `npx vercel build --prod` + `npx vercel deploy --prebuilt --prod`
7. Polling and live health verification of `https://vacatina-nu.vercel.app`.

---

## 4. UI & Brand Invariants (Locked)

Every continuous deployment must strictly preserve:
- **Brand Primary**: Space Cadet `#1B1464`
- **Typography**: Plus Jakarta Sans (headings) + Inter (body & numeric tables with `tabular-nums`)
- **Navigation Breakpoint**: `1440px` (Desktop full nav with logo + tagline $\ge 1440\text{px}$; compact mark $< 1440\text{px}$)
- **Product Architecture**: 10 products + Build Your Bundle at Tab 1
- **Card Imagery**: 40 unique, verified high-resolution editorial travel photographs (0 duplicates, 0 AI composite artifacts)
- **Truthful Copy**: Zero unverified claims (`Live Desk`, `Compliance Verified`, `Guaranteed`, etc. strictly prohibited)
