---
# Vacatina Product Experience Skill

## Authority and non-negotiable protections

1. The currently approved Vacatina homepage at `https://vacatina-nu.vercel.app/` is LOCKED: do not redesign or rearrange header, 11 Search Command Center tabs, homepage forms/sections, existing typography, Trip Bucket, or approved interactions. Integration may route into Flights without changing home appearance/behavior. Snapshot and compare before editing.
2. Extend the existing repository, modules, router, design tokens, services and real product contracts. No second application, Vercel project, copy of the homepage, or disconnected static demo screen.
3. Use Plus Jakarta Sans for approved headings and Inter for body/UI; respect the actual current approved light surfaces and Vacatina primary `#1B1464`. Never apply legacy dark-page design docs globally without approval.
4. The current public development/review site is the SAME `https://vacatina-nu.vercel.app/`. Preserve rollback and verify the active exact deployment. Vercel deployment-specific URLs can exist internally but are not new separate projects. Do not deploy to an unrelated project.
5. B2C, authenticated B2B and mobile share domain contracts where sensible, but have distinct product journeys and access control. B2B is not a fake role toggle in the consumer UI.
6. NEVER fabricate airline fares, supplier availability, seats, PNRs, ticket issuance, payment success, reviews, approvals, visas or confirmed bookings. Distinguish working enquiry/request-to-book from live booking. No fake urgency timers. Gate any truly non-operational backend capability gracefully.
7. Protect PII and payment data. Do not put passport details in URL/localStorage, analytics, unprotected caches or client-side logs. Do not display a fake confirmation.
8. Don't silently clone competitors or copy copyrighted page assets/copy. Research patterns and improve them into Vacatina's own accessible product experience.

## Single-task execution protocol: DISCOVER → DESIGN → BUILD → VERIFY → SHIP

### A. Discover the real gap (fast, grounded)
- Inspect actual source code, routes, components, services, tests, and deployment config before editing.
- Identify the exact user journey, affected files, dependencies, and risk.
- Check existing approved patterns; reuse them instead of creating parallel implementations.
- If a task touches homepage, Trip Bucket, shared shell, search, payments, auth or deployment, treat it as high-risk and preserve rollback.

### B. Design the smallest coherent change
- Prefer extending existing modules.
- Keep changes scoped to the requested journey.
- Do not redesign approved locked screens.
- Preserve accessibility, responsive behavior and design tokens.
- Define expected states: loading, empty, error, success, disabled and recovery.

### C. Build with production discipline
- Use TypeScript and existing component patterns.
- Keep services/adapters boundary clean.
- Do not expose secrets.
- Do not fabricate backend capabilities.
- Add or update tests for changed behavior.

### D. Verify before claiming completion
- Run typecheck, build, unit tests and relevant E2E/browser tests.
- Test desktop, tablet and mobile where applicable.
- Test keyboard, focus, validation, error states and regressions.
- Verify no console errors, layout overflow or broken routes.
- Report actual evidence, not assumptions.

### E. Ship safely
- Commit only relevant approved changes.
- Push only to the approved development branch.
- Confirm GitHub and Vercel Preview synchronization.
- Never push to main, merge or deploy production without explicit approval.

## Permanent Auto-Sync Rule (LOCAL → GITHUB → VERCEL)

Apply to every future development task in this project.

**Workflow:** LOCAL → GITHUB → VERCEL

1. First verify the existing local repository, GitHub remote, active branches, Vercel project connection and deployment settings.
2. After each successfully completed and verified local development task, automatically commit and push only the relevant approved changes to the designated development branch.
3. Automatically synchronize the development branch with the existing Vercel Preview deployment, using the verified Git integration.
4. Confirm that the Local, GitHub and Vercel Preview commit SHAs match. Report the Preview URL and deployment status.
5. Never overwrite or discard uncommitted work, force-push, commit secrets, or overwrite approved project files.
6. If build, typecheck or required tests fail, stop synchronization and fix the failure first.
7. Do not push to main, merge, or update Production without explicit user approval.
8. If GitHub or Vercel integration is missing or misconfigured, report the blocker and configure the safest existing-project workflow without creating duplicate projects.

**PERMANENT POLICY:** Every verified local development milestone must synchronize automatically to GitHub and Vercel Preview. Production releases always require explicit approval. Do not repeatedly request approval for routine development-branch synchronization.