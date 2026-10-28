# Phase 16 — Duffel TEST MODE integration

## 1. Status and scope

Phase 16 connects the existing Vacatina flights architecture to the real **Duffel API in TEST MODE**. It is a development/sandbox integration, not a production supplier activation.

- Environment: Duffel sandbox only (`live_mode: false` on every offer, seat map and order).
- Commercial state: sandbox quotes are `QUOTE_ONLY`, non-sellable and explicitly labelled non-production.
- Production behaviour: unchanged. No live supplier, live payment, live order, deployment or migration is activated.
- Demo behaviour: the deterministic demo/manual flights paths remain available and visibly distinct from sandbox inventory.
- Publication: Phase 16 is committed locally only. No tag, deployment or remote push is part of this phase.

The implementation reuses the existing canonical offer, adapter, Trip Bucket, review and UI layers. There is no second flights stack and no parallel results page.

## 2. Safety invariants

1. A Duffel sandbox call is possible only when **all** of the following hold:
   - `NODE_ENV` is not `production`;
   - `DUFFEL_ENV` is not `live` (and `DUFFEL_ENVIRONMENT` is not `production`);
   - `DUFFEL_TEST_MODE_ENABLED=true`;
   - the configured token starts with `duffel_test_`.
2. A `duffel_live_` token is rejected, never downgraded or used.
3. Every offer, quote, seat map and order must report `live_mode: false`. A live-mode provider response is refused rather than relabelled.
4. Sandbox inventory never enters the production search route. `/api/v1/search` and `/api/v1/offers/*` explicitly exclude `isSandboxSimulated` / `SANDBOX` offers.
5. The browser never receives the Duffel token, an authorization header, a raw provider payload or a raw provider error body.
6. Sandbox orders are explicit and idempotent. Ambiguous outcomes are stored and never automatically retried.
7. Test-mode inventory is never described as live, confirmed, held or bookable. The UI uses “Duffel TEST MODE”, “sandbox quote”, “non-production” and “no live ticket/payment”.
8. Demo fixture and sandbox inventory remain separate lanes with visible source provenance. They are not merged into one sellable list.

## 3. Architecture

```text
Browser (flights search / offer modal / Trip Bucket / review)
        |
        |  same-origin Vacatina API only
        v
/api/v1/flights/sandbox/*  (customer-routes.ts)
        |
        v
DuffelSandboxService (duffel-sandbox.service.ts)
  - validation, safe projections, idempotency, failure mapping
        |
        v
FlightsDuffelAdapter (flights-duffel.adapter.ts)
  - test-mode search/offer/revalidate/seat maps/price/order
  - canonical offer projection and canonical ID scheme
        |
        v
DuffelClient (duffel-client.ts)
  - official headers, timeouts, sanitized errors
        |
        v
https://api.duffel.com  (TEST MODE, live_mode:false)
```

`duffel-runtime.ts` is the activation boundary shared by the adapter, service and status route. `customer-offer.ts` produces the customer-safe projection; `duffel-sandbox-flight.adapter.ts` is the browser-side adapter that calls the same-origin API.

## 4. Server modules

| File | Responsibility |
|---|---|
| `src/server/inventory/suppliers/duffel/duffel-client.ts` | The only module that knows Duffel HTTP details. Adds `Authorization`, `Duffel-Version: v2`, `Accept`, `Content-Type`; enforces timeouts; parses provider errors into a sanitized category/code/type and server-only pointer/parameter diagnostics. |
| `src/server/inventory/suppliers/duffel/duffel-runtime.ts` | Resolves sandbox activation, rejects production/live/live-token states, exposes a token-free status, and provides test-only runtime/client injection. |
| `src/server/inventory/suppliers/duffel/duffel-sandbox.service.ts` | Owns the sandbox journey: search, offer retrieval, revalidation, seat maps, quote, explicit order creation, idempotency claims/results, passenger/service validation and safe failure mapping. |
| `src/server/inventory/adapters/flights-duffel.adapter.ts` | Converts Duffel offers into the existing `CanonicalOfferEntity`, preserves legacy demo behaviour when test mode is not enabled, reverses canonical IDs, and exposes test-mode order primitives. |
| `src/server/api/customer-routes.ts` | Exposes the sandbox routes and keeps them separate from production search/offer routes. |
| `src/server/api/customer-offer.ts` | Whitelists customer-visible fields and adds the `sandbox` provenance projection. |
| `src/server/config/env.ts` | Validates `DUFFEL_TEST_MODE_ENABLED` and rejects sandbox activation in production. |
| `src/server/inventory/product-extensions.ts` | Adds flight services, passengers, conditions and `testMode` provenance to the existing flight extension. |

## 5. Official Duffel API usage

All calls are server-side. No Duffel hostname appears in the browser bundle.

| Operation | Duffel endpoint | Notes |
|---|---|---|
| Search | `POST /air/offer_requests` | Slices, passengers, cabin class; returns offers and an `orq_` offer request ID. |
| Offer retrieval | `GET /air/offers/{id}?return_available_services=true` | Used after restart or when the in-memory offer cache is cold. |
| Revalidation / re-price | `POST /air/offers/{id}/actions/price` | Uses `intended_payment_methods: [{ type: 'balance', currency }]` and optional `intended_services`. |
| Seat maps | `GET /air/seat_maps?offer_id={offerId}` | Read-only; seat service IDs are validated server-side before an order. |
| Order creation | `POST /air/orders` | `type: 'instant'`, one selected offer, passenger IDs, balance payment, optional services and Vacatina sandbox metadata. |
| Order lookup | `GET /air/orders/{id}` | Available on the client for controlled reconciliation; not exposed as a customer route in this phase. |

Required headers:

```text
Authorization: Bearer <DUFFEL_ACCESS_TOKEN>
Duffel-Version: v2
Accept: application/json
Content-Type: application/json
```

Duffel reference prefixes are validated separately:

- offers: `off_...`
- passengers: `pas_...`
- services/ancillaries: `ase_...`, `svc_...` or `sea_...`

## 6. Vacatina sandbox API

All routes are under `/api/v1/flights/sandbox` and return only customer-safe projections.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/status` | Token-free activation status: `enabled`, `environment: 'SANDBOX'`, `liveModeAllowed: false`, `tokenKind`, `reason`, `orders`, `seatMaps`. |
| `POST` | `/search` | Body: `origin`, `destination`, `departureDate`, optional `returnDate`, `tripType`, `adults`, `children`, `infants`, `cabinClass`, `currency`. Returns `offers`, `offerRequestId`, `sandbox: true`, `liveMode: false`, `nonProduction: true`. |
| `GET` | `/offers/:offerId?supplierOfferId=` | Retrieves and projects one sandbox offer; may fetch from Duffel when the cache is cold. |
| `POST` | `/offers/:offerId/revalidate?supplierOfferId=` | Returns `UNCHANGED`, `PRICE_CHANGED`, `EXPIRED` or `RECHECK_REQUIRED` with safe pricing fields. |
| `GET` | `/offers/:offerId/seat-maps?supplierOfferId=` | Returns sanitized seat maps (bounded rows/elements), `liveMode: false`. |
| `POST` | `/offers/:offerId/quote?supplierOfferId=` | Re-prices the offer with selected services. Returns the authoritative sandbox total, currency, expiry and `liveMode: false`. |
| `POST` | `/orders` | Explicit sandbox order. Requires a travel session and `x-idempotency-key` (8–200 characters). Body: `offerId`, `supplierOfferId`, `passengers`, `services`, `acceptedPriceMinor`. Returns `201` with a non-production confirmation or a sanitized error. |

Production routes reject sandbox offers:

- `/api/v1/search` filters out `isSandboxSimulated` and `SANDBOX` offers.
- `/api/v1/offers/*` returns `404 OFFER_NOT_FOUND` for sandbox offers.

## 7. Canonical mapping

| Duffel field | Vacatina canonical field |
|---|---|
| `offer.id` (`off_...`) | `supplierOfferId`; embedded after the route in `canonicalOfferId` |
| `owner.iata_code` / carrier | `supplierName`, `sourceMetadata.airlineCode`, segment carrier |
| `total_amount`, `total_currency` | `pricing.rawSupplierCostMinor`, `pricing.currency`, `pricing.finalSellingPriceMinor` |
| `slices`, `segments` | `productExtension.flight.slices` / `.segments` |
| `passengers[].id` (`pas_...`) | `productExtension.flight.passengers[].passengerId` |
| `available_services` (`ase_`/`svc_`/`sea_`) | `productExtension.flight.services[]` |
| `conditions.refund_before_departure` | `productExtension.flight.conditions.refundable`, penalty |
| `conditions.change_before_departure` | `productExtension.flight.conditions.changeable`, penalty |
| `expires_at` | `freshness.expiresAtIso` |
| `live_mode` | Must be `false`; reflected in `testMode.liveMode` |

Test-mode canonical offer flags:

```text
inventorySource:        API
environmentClass:       SANDBOX
sellability:            QUOTE_ONLY
isSandboxSimulated:     true
providerLifecycle:      SANDBOX_CONNECTED
integrationLifecycle:   SANDBOX_ACTIVE
confirmationMode:       REQUEST_TO_CONFIRM
bookingMode:            REQUEST_TO_BOOK
availabilityStatus:     CACHED
```

`productExtension.flight.testMode` carries `enabled`, `environment: 'SANDBOX'`, `liveMode: false`, `supplier: 'Duffel'`, `nonProduction: true`, `offerRequestId` and `orderEndpoint`.

### Canonical ID scheme

```text
vct-fl-duffel-<origin>-<destination>-off_<raw Duffel id>
```

The raw `off_...` ID is preserved so offer retrieval and revalidation survive a process restart without a cache. `resolveSupplierOfferId()` reverses the canonical ID deterministically. The legacy demo ID shape remains unchanged when test mode is not enabled, preserving existing fixtures and journey tests.

## 8. Pricing

- Sandbox quotes use the **supplier total with zero commercial markup**.
- The canonical projection sets `pricing.manualOverrideMinor` to the rounded supplier total and records the reason `Duffel TEST MODE supplier total (no commercial markup)`.
- Currency is the supplier currency (for example `USD`). The UI formats each sandbox amount in its native currency and excludes non-LKR sandbox amounts from LKR subtotals.
- The review step calls the dedicated quote endpoint before ordering. `acceptedPriceMinor` must match the freshly re-priced total or the order fails with `SANDBOX_PRICE_CHANGED`.
- No payment is captured. The order uses Duffel’s `balance` payment method in TEST MODE only.

## 9. Journey lifecycle

1. **Source selection** — the flights search form exposes `Demo / manual fixtures` (default) and `Duffel TEST MODE (sandbox)`. The selection is serialized as `source=sandbox_test`.
2. **Search** — the browser sandbox adapter calls `/api/v1/flights/sandbox/search`. The server validates the request, calls Duffel `POST /air/offer_requests`, maps every offer and returns a token-free projection.
3. **Results** — sandbox offers appear only in the sandbox lane with a disclosure banner and non-production counts. They are `QUOTE_ONLY` and cannot be added as production-bookable inventory.
4. **Offer detail** — services, passengers, conditions and seat maps are loaded through sandbox routes. Seat maps are optional; when present, one seat per passenger is enforced. Selected service IDs and the sandbox provenance are carried into the Trip Bucket candidate.
5. **Trip Bucket** — the candidate records `inventoryMode: 'sandbox_test'`, `sandboxOrderable: true`, `priceStatus: 'quoted'`, native currency/amount and selected service IDs. Summary subtotals exclude non-LKR sandbox amounts.
6. **Review** — the sandbox panel collects passenger title, given/family name, date of birth, gender, shared contact email and phone. It refreshes the authoritative sandbox quote, requires an accepted price and explicit non-production consent.
7. **Order** — the browser sends a stable session-scoped idempotency key. The server validates passengers/services, re-prices, checks the accepted total, claims the key, calls `POST /air/orders`, verifies `live_mode:false`, stores the sanitized result and returns a non-production confirmation.
8. **Result** — the UI shows the sandbox order ID, booking reference (if issued), total, passenger count and a “no live ticket/no payment” message.

## 10. Idempotency and order safety

Two immutable records are written under keys derived from `sha256(ownerId + ':' + idempotencyKey)`:

1. **Claim** (`flights.sandbox.order.claim`) — written before the Duffel order call. It contains the request hash and a `CLAIMED` state.
2. **Result** (`flights.sandbox.order.result`) — written after the provider response. It contains either the sanitized success result or a sanitized failure/unknown state.

Behaviour:

| Situation | Behaviour |
|---|---|
| Same key, same request, completed | Returns the stored result with `replayed: true`; no provider call. |
| Same key, different request | `409 IDEMPOTENCY_KEY_REUSED`; no provider call. |
| Same key, request in flight | `409 ORDER_IN_PROGRESS`; no second provider call. |
| Deterministic provider failure (for example 422) | Stored as `FAILED`; a retry replays the same sanitized failure, never a new order. |
| Ambiguous outcome (timeout/network/unknown) | Stored as `UNKNOWN` with `SANDBOX_OUTCOME_UNKNOWN`; never automatically retried. |
| New key, same offer | Allowed; creates a separate sandbox order. |

The claim is deliberately not deleted on failure. Operators must reconcile an unknown outcome with Duffel before using a different key.

Passenger validation (server-side):

- `pas_` reference, valid title (`mr`, `mrs`, `ms`, `miss`, `dr`), Unicode-safe given/family names, past date of birth, valid email and phone, gender `M`/`F`.
- Passenger references must match the selected offer and the re-priced offer.
- Service references must be `ase_`/`svc_`/`sea_`, unique, quantity 1–9, and must belong to the offer’s available services or seat maps.
- `acceptedPriceMinor` must equal the freshly re-priced total.

## 11. Failure mapping

| Duffel condition | Vacatina code | HTTP |
|---|---|---|
| `offer_expired` | `SANDBOX_OFFER_EXPIRED` | 409 |
| `price_changed` | `SANDBOX_PRICE_CHANGED` | 409 |
| `offer_no_longer_available`, `duplicate_booking` | `SANDBOX_OFFER_UNAVAILABLE` | 409 |
| Authentication | `SANDBOX_AUTH_FAILED` | 502 |
| Validation | `SANDBOX_VALIDATION_FAILED` | 400 |
| Rate limit | `SANDBOX_RATE_LIMITED` | 429 (retryable) |
| Not found | `SANDBOX_OFFER_NOT_FOUND` | 404 |
| Conflict | `SANDBOX_OFFER_UNAVAILABLE` | 409 |
| Timeout / network / provider unavailable (read path) | `SANDBOX_UNAVAILABLE` | 503 (retryable) |
| Ambiguous order outcome | `SANDBOX_OUTCOME_UNKNOWN` | 502 (never auto-retried) |
| Disabled runtime | `SANDBOX_DISABLED` | 503 |
| Key reused with different details | `IDEMPOTENCY_KEY_REUSED` | 409 |
| Concurrent duplicate order | `ORDER_IN_PROGRESS` | 409 |

Provider error bodies, raw messages, tokens and authorization headers are never returned to the browser. `DuffelApiError.pointer` and `.parameter` are **server-only** diagnostics used during controlled verification and are not serialized into API responses.

## 12. Configuration and activation guards

Local development configuration (values are not committed; `.env.local` is gitignored):

| Variable | Required value | Purpose |
|---|---|---|
| `DUFFEL_ENV` | `test` | Sandbox environment. `live` blocks test mode. |
| `DUFFEL_TEST_MODE_ENABLED` | `true` | Explicit sandbox activation switch. |
| `DUFFEL_ACCESS_TOKEN` | `duffel_test_...` | Sandbox API credential. Never commit, print or log. |

Canonical token resolution order: `DUFFEL_ACCESS_TOKEN` → `DUFFEL_API_TOKEN` → `DUFFEL_TOKEN` (the latter two are deprecated compatibility fallbacks).

Activation matrix:

| Condition | Result | Reason |
|---|---|---|
| `NODE_ENV=production` or `VACATINA_ENV=production` | disabled | `PRODUCTION_RUNTIME_BLOCKED` |
| `DUFFEL_ENV=live` or `DUFFEL_ENVIRONMENT=production` | disabled | `LIVE_ENV_BLOCKED` |
| Token starts `duffel_live_` | disabled | `LIVE_TOKEN_BLOCKED` |
| `DUFFEL_TEST_MODE_ENABLED` not `true` | disabled | `TEST_MODE_FLAG_DISABLED` |
| No token, or token is not `duffel_test_` | disabled | `TEST_TOKEN_REQUIRED` |
| Test token + flag + non-production runtime | enabled | `ENABLED` |

Production startup validation additionally rejects:

- `DUFFEL_TEST_MODE_ENABLED=true`;
- a `duffel_test_` token in `DUFFEL_ACCESS_TOKEN`.

The status endpoint returns only safe fields (`provider`, `enabled`, `environment`, `liveModeAllowed`, `tokenKind`, `reason`, `orders`, `seatMaps`, `orderEndpoint`, `timestamp`). It never returns the token.

## 13. Browser and UI behaviour

- **Search source selector** — default remains `demo_fixture`; `sandbox_test` is an explicit opt-in.
- **Status handling** — the sandbox lane checks `/status` before searching and shows a specific safe message for disabled, missing-token, production-blocked or unavailable states.
- **Disclosure** — sandbox results show “Duffel TEST MODE (sandbox): real Duffel sandbox quotes, not live airline inventory. No live ticket or payment is created.”
- **Offer modal** — sandbox services are selectable with quantities, seat maps load on demand, one seat per passenger is enforced, totals use the supplier currency, and labels explicitly say “sandbox”.
- **Trip Bucket** — sandbox candidates show their source, native-currency amount, `quoted` price status and “no live seat hold” messaging. LKR subtotals exclude non-LKR sandbox amounts.
- **Review** — the sandbox panel is separate from the production checkout flow. It requires gender for every passenger, refreshes the quote, requires accepted-price confirmation and explicit sandbox consent.
- **Success** — the confirmation states that a Duffel TEST MODE sandbox order was created, shows the sandbox order ID/booking reference, and repeats that no live ticket or payment exists.
- **Errors** — only canonical messages are shown (expired offer, price change, unavailable, rate limited, outcome unknown, validation). Raw provider text is never rendered.

## 14. Trip Bucket and review provenance

`TripBucketCandidate` now carries:

- `inventoryMode: 'sandbox_test'`
- `sandboxOrderable: boolean`
- `selectedServiceIds: string[]`
- sandbox `amountMinor` and native `currency`
- `priceStatus: 'quoted'`
- sandbox revalidation and non-live hold text

The review handoff treats a sandbox candidate as **non-live**:

- `canCheckout` is `false` for a trip containing only sandbox items;
- the blocker explicitly says “Duffel TEST MODE sandbox quote — explicit sandbox test order only; not live checkout”;
- the sandbox order panel is the only path that can create a supplier-side order.

This prevents sandbox inventory from entering the production booking/payment saga.

## 15. Testing and verification

### Deterministic automated coverage

`tests/duffel-sandbox-phase16.test.ts` injects a fake `fetch` into `DuffelClient`; it never contacts Duffel and never uses a real credential. It covers:

1. Runtime guards (production, live env, live token, disabled flag, missing token, token-free status, production env validation).
2. Search semantics, zero-markup pricing, canonical provenance, passenger/service/condition mapping, customer projection and browser mapping.
3. Offer retrieval after a simulated restart, price-change revalidation and expiry.
4. Seat-map retrieval and quote re-pricing with preserved service quantities.
5. Explicit order creation, replay, key reuse and a second key.
6. Ambiguous and deterministic failures, safe messages, stored outcomes and no retries.
7. Concurrent duplicate blocking.
8. All sandbox HTTP routes, including safe projections and replay.
9. Sanitized route failures, browser source selection and multi-city rejection.
10. Trip Bucket provenance, subtotal exclusion and review gating.

The suite is included in `npm test`.

### Controlled real TEST MODE verification

Performed once against `https://api.duffel.com` with the local sandbox credential, using only safe output fields (no token or raw payloads):

| Step | Result |
|---|---|
| Runtime status | `enabled: true`, `environment: SANDBOX`, `tokenKind: TEST`, `liveModeAllowed: false` |
| Search CMB→DXB, 2026-11-11 | 20 Duffel Airways (`ZZ`) sandbox offers, `offerRequestId` present |
| Offer retrieval | `environmentClass: SANDBOX`, `sellability: QUOTE_ONLY`, `liveMode: false` |
| Revalidation | `UNCHANGED` |
| Seat maps | 1 map returned |
| Quote | Sandbox total returned, `liveMode: false` |
| Direct sandbox order | `live_mode: false`, booking reference issued |
| Service-path sandbox order | `live_mode: false`, `nonProduction: true`, `replayed: false`, booking reference issued |

Both sandbox orders were explicit, non-production test orders. No live ticket, payment or production booking was created.

### UI verification

The Flights journey is checked at 1440, 768 and 360 pixels for:

- source selection and sandbox disclosure;
- loading, empty, error, price-change, expired and unavailable states;
- service selection and seat-map loading/selection;
- Trip Bucket provenance and native-currency display;
- review form validation, quote refresh and explicit consent;
- sandbox success and sanitized failure states;
- no horizontal overflow or inaccessible controls.

Final gates on this change:

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm test` | 324/324 tests passing |
| `npm run build` | 103 modules, zero external CDN dependencies |
| `npm run check:browser-boundary` | `browserModules: 103`, `serverModules: 0`, negative probe blocked |
| `npm run test:e2e` | 85/85 assertions across 11 viewports and 21 journeys |
| Sandbox UI verification | 44/44 checks at 1440, 768 and 360 |
| Protected screenshots | Restored byte-for-byte after E2E |

The browser bundle audit confirms no Duffel credential value, Duffel environment variable name, `Duffel-Version` header, `api.duffel.com` hostname or server-module import. The only bearer header in the bundle is Vacatina's own same-origin session header; supplier credentials remain server-side.

## 16. Known limitations

- Multi-city sandbox search is rejected in this phase; one-way and return are supported.
- The verified Duffel Airways test offer exposed no paid optional services, so live ancillary pricing was verified with deterministic mocked HTTP; real seat-map retrieval was verified.
- Seat maps are bounded (8 maps, 4 cabins, 80 rows, 12 elements per section) for payload safety.
- Sandbox order state is held in the process memory unit of work by default. A restart loses replay protection; production activation requires the Phase 15 PostgreSQL-backed unit of work and durable reconciliation.
- The sandbox order result is stored under a session-scoped key. Clearing browser storage generates a new key and can create another sandbox order.
- No order cancellation, refund, exchange or webhook reconciliation is implemented for sandbox orders.
- No rate-limit backoff scheduler is implemented; `SANDBOX_RATE_LIMITED` is surfaced as retryable.
- The customer status endpoint is informational and does not expose supplier account details.

## 17. Live activation prerequisites (out of scope)

Live Duffel sales remain disabled. Before any production activation, the owner must separately approve and complete at least:

1. A Duffel live account and `duffel_live_` credential stored in the production secret manager.
2. Removal or explicit re-design of the test-mode guard so live mode is a deliberate, reviewed activation — not a flag flip.
3. Production commercial markup, currency conversion, tax and fee policy approval.
4. Durable order/idempotency storage using the Phase 15 PostgreSQL unit of work, plus reconciliation for unknown outcomes.
5. Payment authorization/capture integration; the sandbox `balance` method is not a production payment flow.
6. Supplier certification, fare-rule/ancillary validation and cancellation/refund servicing.
7. Production rate-limit, timeout, retry and circuit-breaker policy.
8. Observability, alerting, audit retention and incident ownership.
9. Legal/regulatory review of airline distribution, ATOL/IATA obligations and customer disclosures.
10. A separate production activation change with rollback and monitoring.

No item above is implemented or implied by Phase 16.

## 18. Operational notes

- Keep `DUFFEL_ACCESS_TOKEN` only in `.env.local` or the deployment secret store. Never commit it, print it, paste it into logs or send it to the browser.
- Use `GET /api/v1/flights/sandbox/status` to confirm activation without exposing credentials.
- To reset local sandbox state, restart the server process; the in-memory idempotency claims/results are cleared.
- Sandbox orders can be inspected in the Duffel dashboard under TEST MODE. Do not confuse them with live orders.
- If an order returns `SANDBOX_OUTCOME_UNKNOWN`, do not retry with a new key until the Duffel dashboard has been checked.
- The four protected screenshots under `screenshots/` are unrelated to Phase 16 and must remain untouched.

## 19. Principal files

```text
src/server/inventory/suppliers/duffel/duffel-client.ts
src/server/inventory/suppliers/duffel/duffel-runtime.ts
src/server/inventory/suppliers/duffel/duffel-sandbox.service.ts
src/server/inventory/adapters/flights-duffel.adapter.ts
src/server/inventory/product-extensions.ts
src/server/api/customer-routes.ts
src/server/api/customer-offer.ts
src/server/config/env.ts
src/features/flights/adapters/duffel-sandbox-flight.adapter.ts
src/features/flights/domain/flight-models.ts
src/features/flights/domain/flight-search-query.ts
src/features/flights/domain/search-models.ts
src/features/flights/domain/flight-inventory-truth.ts
src/features/flights/services/flight-search.service.ts
src/features/flights/services/flight-trip-bucket.service.ts
src/features/flights/ui/flights-search-view.ts
src/features/flights/ui/flights-offer-detail-modal.ts
src/features/trip-review/trip-review-workspace.ts
src/lib/services/trip-bucket.service.ts
tests/duffel-sandbox-phase16.test.ts
```
