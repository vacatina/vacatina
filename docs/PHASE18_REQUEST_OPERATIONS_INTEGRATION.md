# Phase 18 — request/operations integration

## A0 contract freeze (before implementation)

Baseline: `8f72243`, `release/b2c-product-journeys-v1`. Main and origin/main are not release targets.

| State | Authority / ownership | Meaning / forbidden implication |
|---|---|---|
| Saved planning selection | Owner-scoped canonical Trip Bucket aggregate, revision | Preferences only; no verified price, hold or booking |
| Submitted enquiry | Durable owner-scoped enquiry with immutable selection snapshot and consent | Operations request, not a booking; receipt only after commit |
| Operator quotation | Versioned draft/published non-commercial quotation, expiry, operator audit | Customer acknowledgement is not payment, allocation or supplier confirmation |
| Unpaid booking intent | Existing booking aggregate/lifecycle | Existing commercial eligibility guards apply; demo enquiries never enter this lifecycle |
| Supplier-confirmed booking | Existing booking lifecycle plus authoritative evidence | Not created by Phase 18 |

| Proposed allowlisted API | Method / actor | Ownership / mutation rules |
|---|---|---|
| `/api/v1/demo/capabilities`, `/api/v1/session`, `/api/v1/health` | GET, guest | Safe status; no credential or supplier account details |
| `/api/v1/planning/trip` | GET/PUT, signed guest or verified account | Exact owner+tenant; optimistic revision, idempotency, non-commercial snapshot |
| `/api/v1/planning/trip/items/:id/remove` and `/restore` | POST, owner | Revision checked; stable identities preserved |
| `/api/v1/enquiries` | GET/POST, owner | Consent; frozen dossier; idempotent submission; no fabricated booking ID |
| `/api/v1/enquiries/:id` | GET, owner | Exact owner+tenant |
| `/api/v1/enquiries/:id/withdraw` and `/acknowledge` | POST, owner | Expected revision; current unexpired quotation only |
| `/api/v1/admin/enquiries` | GET, authorized operator | Exact tenant, RBAC and MFA; no global legacy triage |
| `/api/v1/admin/enquiries/:id` | GET/POST, authorized operator | Assignment/review/follow-up/draft/publish/close; revision, independent quote publication, audit |
| All other APIs | denied | No financial legacy routes, booking, payment, documents, supplier dispatch or sandbox order creation |

One repository contract and canonical Trip Bucket/offer reference types are retained. Local file persistence is explicitly loopback-only, not a hosted persistence substitute. Hosted capabilities remain closed until an independently approved durable backend and fresh isolated identity are qualified. Notifications remain pending; no worker sends them.

## Execution record

The implementation is **PARTIAL overall**: the isolated local customer/operations round trip is implemented, but hosted persistence/identity and deployment qualification remain blocked. No historical test count is used as a fresh result.

### Implemented boundary

`browser → dedicated loopback HTTP allowlist → EnquiryService → existing readiness repositories/canonical Trip Bucket → LocalReadinessUnitOfWork`

The hosted build instead packages only `hosted-demo-closed.mjs`. It does not import the application, legacy API router, storage, identity verifier, supplier client, payment client or notification worker. An environment flag cannot turn that function into the local request backend.

- Planning selections have optimistic revisions, explicit save, remove/restore, frozen offer-reference snapshots and idempotent mutations.
- Browser references are declared, unverified planning inputs. Stored authority is always `SEED` / `DISCOVERY_ONLY` / `NEEDS_ACTION`, with zero authoritative price. Native currency is retained without treating a supplied price as authority.
- Submission requires consent and a committed dossier. The `ENQ-DEMO-*` reference is an enquiry reference, never a booking ID. Distinct retry keys cannot duplicate an active request for the same saved trip revision.
- Customer access requires the exact owner and tenant. Local guests use signed, server-created sessions, not caller-supplied owner/role headers.
- Operator access additionally requires a verified server-injected identity, tenant scope, triage permission and current MFA. The actual `dev:phase18` server configures **no operator authenticator**; generated bearer identities exist only inside the test harness.
- The existing admin workspace hosts the enquiry queue, filters, assignment/investigation, manual follow-up status, visible versioned quotation drafts, independent publication, closure and audit history. It is not a second financial/admin system.
- Publication must use a different operator from the draft author. A customer can acknowledge only the current, unexpired published version. Acknowledgement is not acceptance of payment, allocation, issuance or booking confirmation.
- Notification records remain durable `PENDING` outbox commands. There is no sending worker or external delivery activation.

### Local safety and durability

The HTTP boundary verifies origin and CSRF, bounds streamed JSON bodies to 64 KiB, rate-limits requests, emits correlation IDs and sanitizes errors. Unknown APIs and all financial, supplier-order, document and legacy triage routes are denied.

Local storage serializes independent instances using an exclusive lock, writes and syncs a temporary snapshot, and renames atomically before returning success. Unchanged reads do not rewrite the snapshot. Only transient `EPERM`/`EBUSY` file operations receive a bounded retry (eight attempts); access denial and persistent failure still fail. A crash can leave a local lock requiring an owner's inspection/recovery. This is **not** a hosted, multi-region or load-qualified persistence design.

PostgreSQL enquiry access explicitly fails as `ENQUIRY_SCHEMA_NOT_QUALIFIED`. No schema was provisioned or migrated. Existing production-readiness approval gates were not enabled.

### Verification and remaining scope

| Area | Status | Evidence / limit |
|---|---|---|
| State separation, ownership, idempotency, consent and pending notifications | COMPLETE locally | `tests/phase18-integration.test.ts`; no commercial state created |
| Customer → operator → independent publisher → customer | COMPLETE in isolated local harness | [Request browser report](phase18-evidence/request-operations-browser.json), at 1440/768/360 pixels |
| Persistence reconstruction, conflicting writes, read-only snapshots and rollback | COMPLETE for tested local cases | Fresh unit logs; no hosted durability claim |
| Default product UI and canonical architecture | COMPLETE for existing regression gates | [Baseline browser report](phase18-evidence/browser-baseline.json); ten products, eleven SCC tabs and eight Trip Bucket states retained |
| A6 scenario/catalog breadth | PARTIAL | Two distinct synthetic planning options per product are tested; default catalogs were not expanded and independent per-product failure/price/expiry permutations are not exhaustively browser-tested |
| Actual browser-adapter planning projections | COMPLETE for tested shapes | Flight candidates now carry canonical `configuration` (trip type, origin/destination, dates, traveller counts, cabin class, fare family, multi-city legs) and preserved service selections; hotel room/plan/dates/occupancy are preserved through the enquiry; visa context is stamped with its review states. `tests/phase18-integration.test.ts` builds real flight/hotel adapter shapes and confirms stored authority remains zero-priced, `DISCOVERY_ONLY`, `NEEDS_ACTION` |
| Duffel stable intent recovery | PARTIAL | Two injected-HTTP regressions prove same-owner reconstruction, replay after browser idempotency-key loss and unknown-outcome retention without another order call. Authenticated upstream reconciliation is not implemented/qualified. Loss of the owner identity is not recovered |
| Hosted authenticated requests and operations | BLOCKED | Fresh isolated identity, an approved isolated database/schema and deployment qualification are unavailable |
| Real suppliers, payments, bookings, uploads and notification sending | DISABLED | Not an objective or authorized activation of this phase |

The full fresh results, reviewed captures and deployment limits are in [hosted-demo acceptance](PHASE18_HOSTED_DEMO_ACCEPTANCE.md) and [the gated deployment report](PHASE18_VERCEL_AUTO_DEPLOYMENT.md).

### Defects found during execution

1. Restored selections initially did not rerender the review page. Hydration now rerenders only `/trip/review`, avoiding a separate race that destroyed an independently loaded request acknowledgement form.
2. A 360px operator load initially returned a sanitized 503. It passed after read-only rewrite avoidance and bounded filesystem retries; the precise cause of that original 503 was not instrumented. A later full run directly reproduced Windows `EPERM` on rename in the older local runtime adapter. Its failed raw log is retained as `phase18-evidence/unit-full-filesystem-failure.log`; that adapter now uses the same bounded retry.
3. Operator queue rows now refresh after mutations, and the independent publisher can read the stored draft text/version/expiry instead of approving blindly.
4. Full search fingerprints now include every material criterion. Configured LiteAPI errors or unmapped responses no longer silently substitute deterministic inventory, and unqualified prebook data cannot mark a rate unchanged/ready.
5. Public-demo auth fallback, checkout, request submission and the non-form newsletter click/Enter collection path are explicitly disabled. Public demo markup has a visible notice, noindex, a root base URL and revalidating fixed-name JavaScript/CSS.
6. The real flight candidate lacked canonical configuration, so a multi-city flight with a fare-family choice would have saved only part of the request. The mapping now emits it, and the enquiry preserves it (with multi-city leg validation) while zeroing all price/commercial authority. Hotel room/plan/date/count fields and visa review states are preserved by the same regression.

### Local operation

Use `npm run build`, then `npm run dev:phase18` on `http://127.0.0.1:4175`. Enter only synthetic planning data. The isolated operator browser test is `npm run test:phase18:e2e`; its identities are test composition, not hosted login or human UAT. Run normal and public builds sequentially because they share generated output.
