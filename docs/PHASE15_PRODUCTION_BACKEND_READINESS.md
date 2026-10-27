# Phase 15 — production backend and persistence readiness

## Status and non-goals

Prepared locally from sanitized `release/b2c-product-journeys-v1` at `d8e071442781a3eb2ac950322829ba2e7b3962d5`.
This is **architecture/readiness work, not production verification or authorization**. No production HTTP entry point, worker, database connection, migration, supplier activation, payment activation, deployment or remote Git publication is introduced.

**UNRESOLVED PRODUCTION RELEASE GATE: the owner must confirm actual Clerk credential rotation/revocation.** A configuration flag is an owner attestation, not evidence that revocation happened. No exposed credential was read, restored, printed, copied or tested in this phase. Existing published exposure remains a separately coordinated owner action.

## 1. Backend audit and classification

No subsystem is claimed production-ready solely because its local tests pass.

| Area | Classification | Evidence and remaining limitation |
|---|---|---|
| Server modules | partial | `src/server` separates API/auth/config/inventory/services/runtime/db; browser bundling rejects server imports. No deployable production application is installed. |
| API routes | partial | `api/customer-routes.ts` owns current customer operations. `runtime/dev-http-application.ts` rejects production/Vercel, verifies sessions, scopes identity, checks origin/CSRF, limits JSON size. Legacy dispatcher branches are not a production transport. |
| Auth/session boundary | partial; credentials blocked | RS256 signature/issuer/time/authorized-party checks, signed HttpOnly guest cookies, tenant checks and admin MFA exist. Production session transport, claims provisioning and rotated Clerk configuration need independent verification. |
| Repositories | partial | Existing `db/storage.ts` map engine and runtime snapshots remain for the local application. New typed repositories share an atomic memory/PostgreSQL unit-of-work contract. PostgreSQL is contract-tested, not database-integrated. |
| PostgreSQL runtime state | blocked by migration/credentials | `runtime/persistence.ts` and migration 002 provide advisory/row-locked snapshot transactions. Production writes additionally require schema approval and owner-confirmed rotation. No implicit snapshot-to-relational cutover/backfill exists. |
| Manual inventory SQL | scaffold; production blocked | Migration 001 and legacy PostgreSQL catalog code exist, but that adapter has memory-first/fallback and incomplete transactional audit semantics. Factory use now requires explicit non-production opt-in; production construction is rejected. It must not be promoted as durable storage. |
| Manual catalog used by current UI | partial | Local CMS/runtime participants retain existing behavior, commercial evidence and separation-of-duties workflows. A transactional, reconciled production catalog cutover remains required. |
| Migrations | prepared; execution blocked | 001/002 retained; additive 003 and a separately guarded empty-schema rollback prepared. SQL parsing/static constraints are validated only; no SQL has been applied to a database. |
| Booking service | partial | Existing unpaid booking saga and payment verification remain. New readiness service adds guarded canonical lifecycle, authoritative persisted evidence, frozen selections and duplicate protection. It has no public production route. |
| Trip Bucket persistence | partial | Local runtime snapshots persist existing server buckets. Browser demo planning stays local and non-sellable. New repository supports owner-scoped aggregates, stable items and optimistic revisions. |
| Canonical offers/search | partial | Existing `CanonicalOfferEntity`, `SearchQueryCriteria`, `OfferSnapshotEntity` are reused. New immutable reference snapshots omit raw supplier payloads; adapter caches are not treated as durable booking authority. |
| Revalidation | partial | Multiple existing offer projections remain; the persistence boundary uses current runtime `RevalidationResult`. Persisted evidence, expiry, price acceptance and stale-intent guards added. Legacy TTL-only canonical helpers must not substitute for a live authoritative check. |
| Payment abstractions | partial; activation blocked | Existing provider clients/signature tests remain. Phase 15 creates references and pending outbox commands only, with a separately injected trusted verification port. No client/provider is configured by this service. |
| Operations/admin | partial | Canonical support-ticket statuses are reused for manual approval, fulfilment, cancellation/refund requests and reconciliation. New actions require operator/finance permission and tenant scope; platform admins require current MFA. |
| Audit/idempotency | partial | New events, state mutations, receipts and outbox commands commit together. Existing webhook storage now retains a verified summary/hash instead of the raw financial payload. Retention policy, restricted DB roles and external audit export remain launch gates. |
| Supplier adapter persistence | scaffold/partial | Existing adapters/registries/evidence ledger are not activated. No network side effect occurs inside the new unit of work. A worker/reconciliation contract is prepared, not running. |
| Failure/recovery | partial | Deterministic retries, bounded revalidation, failure categories, late-result reconciliation, pending cancellation/refund and partial-failure preservation are tested locally. Real provider fault injection and recovery drills remain required. |
| Observability | partial | Request IDs, response correlation, sanitized structured telemetry and durable event context are implemented. Production exporter, dashboards, alerts, SLOs and incident ownership are not configured. |
| Configuration/secrets | partial; release blocked | No actual dotenv/config secrets are tracked or copied into QA. Supplier/payment variables remain optional until activation. Production startup rejects unconfirmed rotation, test/mock Clerk configuration and weak signing defaults. |

## 2. Canonical persistence architecture

`persistence/readiness-contracts.ts` is an adapter boundary, **not a second offer or booking model**:

- Search context uses `SearchQueryCriteria` with an owner and expiry.
- Offer reference embeds existing `OfferSnapshotEntity` plus a selected provenance projection of `CanonicalOfferEntity`; source and supplier IDs, terms hash, commercial evidence reference, expiry and safe component references are retained. Raw adapter responses/documents are not stored.
- Trip aggregate embeds `TripBucketEntity` and `TripBucketItemEntity`, immutable offer-reference IDs, latest revalidation-record IDs and an optimistic revision. Configuration is whitelisted; passports, uploads and authentication fields are discarded.
- Booking aggregate embeds `BookingGroupEntity` and `BookingItemEntity`, frozen selected configurations/reference IDs, confirmation evidence and a revision.
- Revalidation stores the existing `RevalidationResult` status/amount projection without arbitrary supplier messages or raw replacement offers.
- Payment reference embeds `PaymentOrderEntity`, provider reference and verified event metadata, never card data, client secrets, tokens or browser assertions of success.
- Operational request embeds `SupportTicketEntity` and references a booking/item/payment; cancellation/refund are explicit pending requests, not financial settlement.
- Audit/event, idempotency and outbox contracts reuse existing platform entity shapes. Records contain actor, action/entity, previous/next state, timestamp, correlation ID and source context where applicable.

Named Trip Bucket, booking, canonical-offer, revalidation, operational, payment and audit repository interfaces are exposed through one `ReadinessUnitOfWork`. `MemoryReadinessUnitOfWork` clones/serializes transactions and commits only successful operations. `PostgresReadinessUnitOfWork` uses an injected pool, parameterized SQL, one connection, BEGIN/COMMIT/ROLLBACK, and a transaction advisory lock. It cannot connect without all three explicit write/migration/Clerk-rotation approvals. It never loads credentials or creates a pool itself.

The 12 additive tables use JSON payloads of the **existing canonical types** plus relational owner/status/revision projections. Selection tables enforce offer/trip/booking foreign keys, including owner scope. Active booking/payment and provider-event constraints prevent duplicates. A coarse lock is deliberately conservative; partitioning and throughput validation are future launch gates.

The existing local application is not silently switched to these tables. Future composition must adapt current DTOs to this application boundary without importing server modules into the UI. Existing 002 data must be exported, transformed and reconciled with stable IDs before any cutover; **no automatic backfill is supplied**.

## 3. Booking lifecycle — one canonical status family

`BookingOverallStatus` is authoritative; `booking-lifecycle.ts` defines allowed edges. Existing product-facing readiness aliases are unchanged. Only `FULFILMENT_PENDING`, `FULFILLED` and `EXPIRED` extend that existing booking union.

| Journey step | Persisted representation |
|---|---|
| Draft / needs action / awaiting revalidation / ready | Existing Trip Bucket item `DRAFT`, `NEEDS_ACTION`, `RECHECK_REQUIRED`, `READY` and associated evidence record |
| Booking intent / awaiting payment | `PENDING_REVALIDATION` + `UNPAID`, preserving the existing unpaid saga contract; selected items have already been frozen/rechecked |
| Manual allocation/quotation | `MANUAL_REVIEW` + open manual request; operator evidence is required before payment preparation |
| Payment initiated / authorized | Payment order `PENDING` / `AUTHORIZED`; booking payment `UNPAID` / `AUTHORIZED`, never supplier-confirmed |
| Verified capture / supplier pending | Booking payment `SETTLED`, overall `BOOKING`, durable supplier request/outbox record |
| Confirmed | Every item has a supplier/manual confirmation with reference, evidence, actor and timestamp; exact payment must be settled |
| Fulfilment | `CONFIRMED → FULFILMENT_PENDING → FULFILLED`, operator-authorized with evidence and operational records |
| Partial/ambiguous result | `PARTIAL_FAILURE` or `MANUAL_REVIEW`; captured money and already confirmed items remain intact |
| Cancellation | `CANCEL_PENDING → CANCELLED` only after operator evidence; payment is not automatically refunded |
| Refund | `REFUND_PENDING`, verified captured payment and finance permission; no provider refund is issued by Phase 15 |
| Failure/expiry | `FAILED` / `EXPIRED` are terminal pre-fulfilment failure states; no fabricated recovery/confirmation |

Manual/request-to-confirm cannot go straight from an unpaid draft to confirmed. Allocation approval and final manual confirmation are separate; ordinary customers cannot perform either. Manual confirmation uses a service reference and does **not** invent upstream API confirmation/PNR. Demo/sandbox references are quarantined and cannot enter booking; hybrid component provenance is checked too.

## 4. Idempotency, transaction and external-side-effect boundaries

Mutation IDs hash actor, tenant, current role/MFA context, operation and client request key. A stable canonical request fingerprint binds meaningful input, currency, terms and selection/configuration. Same-key/different-input conflicts; replays do not bypass changed privileges. Updates to an existing selected configuration require the expected revision.

Separate business protections cover distinct retry keys: one active booking per trip, one active payment per booking, one supplier/manual/cancellation/refund request per business target, and globally unique immutable provider-event receipt IDs. Provider receipts survive subsequent payment state updates. No retry key or arbitrary request body is logged.

| Atomic operation | Records committed together |
|---|---|
| Stage/update selection | Search context, safe offer snapshot, Trip Bucket selection/revision, audit, idempotency |
| Revalidation | Source result/evidence reference, item price/readiness, revision, audit, idempotency |
| Booking intent | Aggregate and selected items, frozen configurations/references, checked-out trip, manual requests/outbox, audit, idempotency |
| Payment reference | Pending reference, operational request/outbox, audit, idempotency |
| Verified payment result | Immutable provider receipt, exact reference/status, booking transition, audit, idempotency |
| Supplier/manual confirmation | Item evidence/reference, booking transition, operation/outbox state, audit, idempotency |
| Cancellation/refund request | Booking state, operational request/outbox, audit, idempotency; no external cancellation/refund success inferred |
| Fulfilment | Booking state, operational evidence and outbox state, audit, idempotency |

Revalidation and trusted payment verification happen **outside** the database transaction; the commit rechecks revision/ownership/evidence. All irreversible external work is represented by a durable pending command; **no dispatcher is implemented or started**. Future workers must claim/commit an attempt before contacting a provider, reuse its business idempotency key, revalidate immediately before irreversible work, and reconcile unknown outcomes before retrying. Never hold a DB transaction open around live payment/booking calls.

## 5. Failure and recovery behavior

- Supplier timeout/unreachable: bounded revalidation returns `RECHECK_REQUIRED`, with a categorized event and no readiness/confirmation claim.
- Stale/missing/unavailable offer: booking and new payment preparation fail closed. READY without a persisted matching authoritative revalidation record is insufficient.
- Price drift: `PRICE_CHANGED` remains blocked until explicit price acceptance and a fresh source check. No silent revalidation acceptance.
- Delayed payment preparation: frozen authoritative evidence older than five minutes, expired offers, or expired manual approval require fresh preparation. An existing pending payment is resumed, not replaced.
- Payment initiation/verification failure: no authorization/charge is invented. A failed authorization projects the booking to `MANUAL_REVIEW`/`UNPAID`; a later or out-of-order failure can never downgrade an already settled capture. The original pending reference is retained for reconciliation and the error is sanitized.
- Manual approval expiry: stale allocation approval blocks payment preparation until a different operator refreshes it with new evidence. Customers and booking owners cannot self-approve, and terminal operations cannot be reopened.
- Supplier booking failure/timeout: manual reconciliation; a new request key cannot dispatch a replacement booking. Late authoritative evidence may resolve the existing request.
- Partial fulfilment: confirmed items and exact captured payment remain, with `PARTIAL_FAILURE`; no automatic cancellation, refund or travel-credit minting.
- Customer interruption: saved booking/reference and deterministic retry keys resume the same aggregate.
- Cancellation and refund remain pending until separately authorized, verified provider/operator results. Refund settlement/reconciliation integration is a remaining activation gate, not a simulated Phase 15 success.

## 6. Authorization, secrets and observability

New customer reads and mutations require exact owner **and** tenant scope, including on admin-shaped calls to customer APIs. Operations use existing RBAC permission checks; `OPS_SUPERVISOR` receives operational reconciliation permissions, not financial privileges. Finance reconciliation/refund requires finance permissions. Platform operations require recent MFA. Manual self-approval is rejected.

Existing local HTTP authentication, origin/CSRF validation, signed sessions, JSON limits and trusted header scoping remain enabled. Request IDs are normalized and propagated in `X-Request-Id`. The existing payment route now uses saved amounts/currency rather than incomplete/client totals; cancellation arguments and owner-scoped request keys are corrected. Existing item revalidation and booking finalization cannot auto-confirm request inventory.

Structured telemetry whitelists request ID, booking ID, supplier adapter, operation, status, latency and error category; arbitrary headers/bodies, tokens, payment credentials, emails and Visa documents are not emitted. Durable audit records contain controlled state projections, not raw exception messages. Exporter errors cannot turn a committed operation into a new retry. A production JSON/OTEL sink, retention policy, monitoring and escalation ownership still need configuration.

Production configuration prerequisites (names only; no values are activated here):

| Variables | Requirement |
|---|---|
| `NODE_ENV`, `BASE_URL` / approved app origins | Explicit production HTTPS origin; no loopback or URL credentials |
| `DATABASE_URL`, pool limits | Approved TLS connection, isolated role, provisioned schema and capacity |
| `VACATINA_ENABLE_PRODUCTION_WRITES`, `VACATINA_MIGRATION_APPROVED`, `VACATINA_SCHEMA_VERSION` | Explicit separate approvals; expected schema `003`; all switches remain false in the template |
| `VACATINA_CLERK_ROTATION_CONFIRMED` | **Unresolved owner-confirmed revocation/rotation gate; false by default** |
| Clerk publishable/secret keys, issuer/frontend API, JWKS/public-key configuration, authorized parties/audience | Correct production instance and verified claim mapping; test/mock keys rejected by production validator |
| `JWT_SIGNING_SECRET` / session signing material | Owner-managed, non-placeholder, at least 32 characters, secure rotation/cookie policy |
| Supplier credentials, payment gateway keys/webhook secrets | **Optional and unused until separately approved activation**; presence is not activation/evidence |
| Document storage, notifications, OTEL exporter | Required only when their workflows are enabled; private storage/access/retention verification required |

`VACATINA_ENABLE_MANUAL_POSTGRES` is a legacy **non-production** opt-in, not a launch authorization. No actual dotenv files were modified; only `.env.example` documents disabled gates. `opencode.json` remains untracked.

## 7. Exact prerequisites before any database migration

1. Named owner/DBA authorization for a specific target, change window, exact migration checksum and rollback plan. No application-startup migrations.
2. Inventory actual deployed schema/001/002 status, roles, extensions, row counts and any existing snapshot/manual catalog data. Do not assume an empty database.
3. Verified encrypted backup plus restore rehearsal; reviewed stable-ID transformation/backfill and reconciliation if data exists. No silent parallel storage/cutover.
4. Review additive DDL, owner-scoped foreign keys, partial unique indexes, lock/statement timeouts, nullable evidence references and capacity against the actual PostgreSQL version (14+).
5. Apply and test in an isolated, approved staging database, including constraint violations, multi-connection concurrency, connection loss/commit ambiguity and rollback. Parser/fake-client tests do **not** substitute for these tests.
6. Provision least-privilege application roles; audit tables SELECT/INSERT only, no application table ownership. Approve retention, access controls and an independently retained audit export.
7. Explicitly set the migration approval session setting only in the approved runner. Readiness write flags stay disabled until post-migration validation and separate release authorization.

Rollback: disable the new composition first; retain data-bearing tables for reconciliation. The prepared rollback requires separate `vacatina.phase15_rollback_approved` approval and **empty Phase 15 tables**, drops only those 12 tables in dependency order without CASCADE, and leaves 001/002 intact. Data-bearing rollback requires a separately reviewed backup/restore/reconciliation plan, not a destructive automatic down migration.

## 8. Exact prerequisites before supplier activation

1. Owner approval for a named provider/product/environment and commercial evidence/settlement responsibilities in the existing evidence ledger.
2. Owner-confirmed Clerk rotation, production authentication/authorization sign-off, approved persistence migration/cutover and no demo/sandbox promotion.
3. Real authenticated sandbox search → canonical mapping → revalidation → booking/cancel contract certification, price/expiry/timeout tests and provider idempotency guarantees. No credentials are tested in this phase.
4. Durable outbox worker implementation/claim semantics, bounded timeouts, circuit breaking/rate limits, reference reconciliation and no blind retry of unknown outcomes.
5. Operational/manual handoff, emergency queue, reconciliation, observability alerts and tested fulfilment/cancellation runbooks.
6. Separate production credential/configuration approval, settlement verification and controlled live acceptance tests. Adapter code or an environment key alone is insufficient.

## 9. Exact prerequisites before payment activation

1. Owner/finance approval of merchant account, gateway, currency, capture/refund policy and applicable compliance responsibilities.
2. Owner-confirmed Clerk rotation and production auth/session/CSRF, database/cutover, supplier/manual readiness and operational sign-offs.
3. Hosted checkout integration using saved server totals and safe return origins; no card collection/storage in application code. Fresh source checks must happen before irreversible payment/booking work.
4. Official raw-body webhook verification, immutable event receipts, exact amount/currency reconciliation, authorization versus capture semantics, expiry and replay tests against the real sandbox.
5. Durable payment command/attempt handling and provider idempotency; verified refund completion, partial refund accounting, disputed/unknown outcomes and no automatic travel-credit minting.
6. Secrets vault/rotation, least privilege, privacy/retention review, dashboards/alerts, incident and reconciliation ownership; separate approval before production keys or live charging.

## 10. Verification and checkpoint

Focused Phase 15 tests (38) cover lifecycle/forbidden transitions, demo/manual guards, expired-approval refresh and self-approval rejection, failed-authorization recovery, idempotency and event replay, repository contracts, rollback, owner/tenant/MFA/CSRF authorization, revalidation/price/expiry, supplier/payment failure mapping, audit/telemetry and config gates. The default test command now also includes the two existing B2C test files that previously required a separate invocation.

SQL validation is parsing/static contract validation only (the parser's unsupported constant ACL statement is separately exact-validated). PostgreSQL query tests use fake clients only. No migration or live connection is used.

Verification on the final working tree in an isolated sanitized copy:

| Gate | Result |
|---|---|
| `npm run typecheck` | Passed, 0 errors |
| Migration forward/rollback parse + static contract check | Passed; no database connection, migration or rollback executed |
| Phase 15 suite | 38/38 passed |
| Full `npm test` (twice) | 314/314 passed on both runs |
| `npm run build` | Passed; browser bundle contains no `src/server` module |
| Negative browser/server boundary probe | Passed |
| B2C browser/e2e journeys | 85/85 assertions passed |

The browser harness runs in an isolated sanitized copy, redirecting only its legacy external artifact-output path. Product code and browser assertions are unchanged. Original source, protected screenshots, private dotenv/config, and untracked `opencode.json` remain outside QA writes and staging. No production service, supplier, payment gateway, migration, environment variable, deployment, remote branch or tag was activated or published.

Local checkpoint when all gates pass: commit `feat: prepare production backend and persistence`, annotated tag `phase15-backend-readiness-v1`. **No automatic push.** Production entrypoint/DB integration/load tests, actual Clerk rotation, catalog cutover, workers, provider/payment certification, monitoring and release approval remain unresolved.
