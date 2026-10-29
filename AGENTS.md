# Vacatina — OpenCode Project Instructions

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

## Authority and non-negotiable protections

1. The currently approved Vacatina homepage is LOCKED: do not redesign or rearrange header, 11 Search Command Center tabs, homepage forms/sections, existing typography, Trip Bucket, or approved interactions.
2. Extend the existing repository, modules, router, design tokens, services and real product contracts. No second application, Vercel project, copy of the homepage, or disconnected static demo screen.
3. Use Plus Jakarta Sans for approved headings and Inter for body/UI; respect the actual current approved light surfaces and Vacatina primary `#1B1464`.
4. NEVER fabricate airline fares, supplier availability, seats, PNRs, ticket issuance, payment success, reviews, approvals, visas or confirmed bookings. Distinguish working enquiry/request-to-book from live booking.
5. Protect PII and payment data. Do not put passport details in URL/localStorage, analytics, unprotected caches or client-side logs.
6. Don't silently clone competitors or copy copyrighted page assets/copy.

## Single-task execution protocol: DISCOVER → DESIGN → BUILD → VERIFY → SHIP

### A. Discover the real gap
- Inspect actual source code, routes, components, services, tests, and deployment config before editing.
- Identify the exact user journey, affected files, dependencies, and risk.

### B. Design the smallest coherent change
- Prefer extending existing modules. Keep changes scoped.
- Do not redesign approved locked screens.
- Preserve accessibility, responsive behavior and design tokens.

### C. Build with production discipline
- Use TypeScript and existing component patterns. Keep services/adapters boundary clean.
- Do not expose secrets. Do not fabricate backend capabilities.
- Add or update tests for changed behavior.

### D. Verify before claiming completion
- Run typecheck, build, unit tests and relevant E2E/browser tests.
- Test desktop, tablet and mobile where applicable.
- Test keyboard, focus, validation, error states and regressions.
- Report actual evidence, not assumptions.

### E. Ship safely
- Commit only relevant approved changes. Push only to the approved development branch.
- Confirm GitHub and Vercel Preview synchronization.
- Never push to main, merge or deploy production without explicit approval.