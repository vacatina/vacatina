# Local backend implementation and production approval boundary

The local preview now serves the browser and `/api/v1/*` from the same loopback
origin. Start it with `npm run dev` using the bundled Node 22 runtime. The server
cannot start with `NODE_ENV=production` or `VERCEL` set and binds only to
`127.0.0.1`. It does not deploy any function or change Vercel routing.

## Implemented locally

- Real `Request`/`Response` dispatch to `VacatinaApiRouter`.
- `/api/v1/config` exposes only the public Clerk key and frontend API URL.
- `/api/v1/session` returns a signed guest identity and CSRF token. Cookies are
  HttpOnly and SameSite=Lax. Browser JSON mutations use `X-CSRF-Token`, matching
  `Origin`, and `credentials: same-origin`. Verified Bearer tokens identify users.
- Incoming `x-session-id`, user-role headers and JSON session identifiers cannot
  select another guest's workspace. The server supplies the session identifier.
- Clerk RS256 checks require issuer, subject, session, expiration, time validity
  and authorized party. JWKS URLs come from configured issuer, never token input.
- Organization administrators remain agency administrators. Platform roles must
  come from exact verified application claims or server-maintained user IDs.
  Recent second-factor verification is required for platform administration.
- Operational maps are hydrated from a versioned local snapshot and committed
  atomically after each request. Failed commands restore the preceding snapshot.
  A local lock prevents cooperating preview processes from racing writes.
- Auxiliary services can register export/restore hooks in
  `registerRuntimeStateParticipant` to join the local request commit.
- The static preview exposes only built browser files, the approved HTML entry
  points, and public assets. `.env`, `.git`, source, documents and local storage
  cannot be downloaded through it.

Local state lives in `.data/operational-state.json`; the local signing key lives in
`.data/guest-session.key`. Keep `.data/` out of version control. These files may
contain private traveller data. This file mode is a development capability, not
an approved production financial store. `VACATINA_LOCAL_STORAGE_PATH` and
`VACATINA_LOCAL_SESSION_KEY_PATH` can select dedicated local test files.

## Production change awaiting explicit approval

Automatic approval review rejected two proposed production-capable additions:

1. A PostgreSQL operational transaction layer covering bookings, payments and
   auxiliary state, because incorrect schema or transaction assumptions could
   disrupt or corrupt operational data.
2. A shared production HTTP boundary covering authentication, CSRF, origins,
   rate limits and session cookies, because errors could lock out users or
   disrupt the service.

Neither rejected production runtime nor a Vercel API entry point was added.
Production mutations remain disabled. No remote migration, charge, booking,
deployment or push was performed as part of this foundation.

The proposed reviewable database migration is
`src/server/db/migrations/002_operational_runtime_state.sql`. It only adds a new
namespaced operational snapshot table; it does not alter existing inventory
tables. It has not been executed. An approved production implementation would
lock the namespaced row, hydrate the command state, execute one command and
commit booking/payment/idempotency/audit changes together. Provider webhooks
would use the same transaction. Load testing and backup/restore verification
would precede enabling customer writes.

The proposed HTTP deployment would run the same normalized router as a server
function before the SPA fallback. It would require configured HTTPS origins,
an independent random session-signing secret, verified Clerk settings, durable
database connectivity, and webhook signature verification. It must be reviewed
and approved before adding production routing or running a database migration.

## Verification

The Phase 4 stabilization baseline verified `npm run typecheck` (0 errors), two consecutive `npm test` runs (233/233 tests, 24 suites), and `npm run build` (PASS). The browser bundle contains zero runtime `src/server/*` edges and no Node built-ins. See [`ENGINEERING_BASELINE.md`](./ENGINEERING_BASELINE.md) for the authoritative baseline record.

`tests/backend-foundation.test.ts` exercises signed-cookie tampering and expiry,
Clerk signature/time/issuer/origin failures, agency-role isolation, local restart
durability, failed-command rollback, concurrent local commands, CSRF and origin
rejection, ignored client roles/session IDs, and production refusal. These tests
use generated keys and isolated local files; they do not contact suppliers or
perform external writes.

Implementation references: [Clerk manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification),
[Clerk session token claims](https://clerk.com/docs/guides/sessions/session-tokens).
