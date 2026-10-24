# Vacatina API Responsibility Map

## Core rule

The UI must never be coupled directly to a supplier API.

Use this boundary:

```text
UI / Route Component
        ↓
Vacatina Domain Service / Server Action / API Route
        ↓
Normalized Vacatina Data Model
        ↓
Supplier Adapter
        ↓
External Provider / Internal Inventory
```

Presentational components consume normalized Vacatina models, not Duffel/LiteAPI/Amadeus/provider payloads.

## Integration maturity labels

- **LIVE** — confirmed credentials + working code + verified endpoint behavior in the attached implementation environment.
- **VERIFY-LIVE** — project documentation indicates existing integration/code, but Antigravity must inspect the actual repository/configuration before using live calls.
- **ADAPTER-READY** — create the domain interface and mock/reference adapter; provider selection/credentials are pending.
- **MOCK** — prototype-only data. Must be labelled internally and never presented as real-time inventory.

Never upgrade a status from MOCK/ADAPTER-READY to LIVE by assumption.

## Platform services

| Capability | Intended responsibility | Current handoff status | Rules |
|---|---|---|---|
| Authentication | guest session, customer account, MFA/RBAC where configured | VERIFY-LIVE: Clerk is the current architectural direction | Older Auth0 references are legacy alternatives. Verify actual repo before wiring. |
| Database | users, bookings, Trip Buckets, favorites, applications, content, audit records | VERIFY-LIVE: Neon PostgreSQL + Drizzle documented | Preserve relational domain boundaries. |
| File storage | visa/passport/supporting documents and generated files | VERIFY-LIVE: Cloudflare R2 documented | Use presigned upload/download patterns; do not expose private object URLs. |
| Payments | intent/order, authorization/capture, webhooks, idempotent finalization, refunds | VERIFY-LIVE: Stripe + PayPal documented | Raw card data must never touch Vacatina application servers. |
| Notifications | transactional email/SMS/WhatsApp/push abstraction | ADAPTER-READY unless actual provider config exists | UI should call notification domain service, not provider SDK directly. |
| FX/currency | display conversion and checkout currency normalization | VERIFY/ADAPTER-READY | Do not treat stale display FX as settlement truth. |
| Analytics/observability | product events, errors, traces | VERIFY/ADAPTER-READY | No PII leakage in analytics. |
| CMS/manual inventory | curated packages, direct contracts, manual listings, featured content | VERIFY/ADAPTER-READY | Admin-managed content must coexist with supplier inventory. |

## Flights

### Domain responsibilities

1. airport/location autocomplete
2. search offer request
3. sort/filter normalized offers
4. retrieve fare families/options
5. price/revalidate selected offer
6. ancillary discovery (baggage/seat where supported)
7. passenger validation
8. create booking/order
9. retrieve booking
10. post-booking change/cancel/refund quote where supported

### Supplier direction

- **Duffel NDC/GDS** — documented current/primary integration: **VERIFY-LIVE**.
- Other providers such as Amadeus/Sabre/Travelport may exist as future adapters and must not leak into UI contracts.

### Prototype rule

If credentials/code are unavailable, build a `FlightProvider` interface plus deterministic mock adapter. Do not label mock fares as live.

## Hotels

### Domain responsibilities

1. destination/property search
2. hotel results and normalized filters
3. property details/media
4. room/rate availability
5. selected rate revalidation/prebook
6. traveller/contact capture
7. booking
8. retrieve/cancel where provider supports it

### Supplier direction

- **LiteAPI / Nuitee Connect** — documented current integration: **VERIFY-LIVE**.

### Critical rule

A homepage/sample rate is never a guaranteed checkout price. Revalidate/prebook before payment.

## Visa Assistance

Visa Assistance is primarily a service workflow, not a generic supplier-booking API.

### Domain responsibilities

1. visa catalogue by destination/nationality
2. eligibility/decision guidance
3. requirement/document checklist
4. application draft
5. traveller/contact data
6. secure document upload
7. review and fee summary
8. payment for Vacatina service/application processing where applicable
9. admin/operations status workflow
10. applicant status tracking
11. approved document delivery when actually issued

### Integrations

- Cloudflare R2 for documents: **VERIFY-LIVE**.
- Database/application workflow: **VERIFY-LIVE**.
- External government/embassy approval API: **DO NOT ASSUME**.

Never fabricate approval, embassy verification, processing guarantee or approval percentage.

## Holiday Packages

### Domain responsibilities

1. curated catalogue
2. itinerary detail
3. accommodation/inclusion/exclusion views
4. customization
5. optional flight/hotel/visa/transfer/activity components
6. quote calculation
7. deposit/full-payment option where business rules permit
8. proposal/PDF generation when implemented
9. Trip Bucket candidate creation after required configuration

### Inventory model

Primarily internal CMS/database/manual-contract content with optional supplier components.

Status: **VERIFY/ADAPTER-READY** depending on attached repo.

## Cars & Transfers

### Transfers

1. pickup/drop-off
2. date/time
3. passengers/luggage
4. vehicle/service options
5. quote/revalidate
6. booking
7. tracking/status where a real provider supports it

### Car Hire

1. pickup/return location
2. pickup/return date/time
3. driver/age rules where needed
4. vehicle category
5. quote/revalidate
6. booking

### Provider direction

Amadeus Transfers is documented as an intended integration. Treat as **ADAPTER-READY / VERIFY-LIVE only if code and credentials are found**.

Do not fabricate flight monitoring, toll inclusion, mileage, licensing or fleet guarantees.

## Rails

### Domain responsibilities

1. route search
2. schedule/options
3. class/fare options
4. availability/revalidation
5. configured candidate
6. booking when a real provider exists

Status: **ADAPTER-READY** unless a verified supplier implementation is present.

Do not invent live timetables, seat availability, rail passes or operator relationships.

## Cruises

### Domain responsibilities

1. region/destination discovery
2. departure port/window
3. itinerary options
4. cabin categories
5. quote/revalidation
6. booking request/booking when a real provider exists

Status: **ADAPTER-READY** unless a verified cruise supplier exists.

Do not invent cruise-line partnerships, cabin holds, onboard credits, upgrades, port-fee inclusions or live inventory.

## Activities

### Domain responsibilities

1. destination/date/participant search
2. category/option discovery
3. timeslot/variant configuration
4. price/availability revalidation
5. booking when a provider exists

Status: **ADAPTER-READY** unless verified provider code exists.

## Sightseeing Tours

Separate domain from Activities.

### Domain responsibilities

1. destination/date/traveller search
2. tour type/duration
3. pickup/time slot/options
4. inclusion display
5. price/availability revalidation
6. booking when a provider exists

Status: **ADAPTER-READY** unless verified provider code exists.

Do not invent licensed-guide or guaranteed-entry claims.

## Travel Insurance

### Domain responsibilities

1. destination/region
2. dates
3. traveller profiles/ages where required
4. plan comparison
5. eligibility
6. quote
7. terms/benefits/exclusions retrieval
8. purchase/issuance only through a real verified provider integration
9. policy retrieval/support where supported

Status: **ADAPTER-READY** unless a verified insurer/aggregator integration is present.

Critical rules:

- never fabricate an insurer or underwriter
- never fabricate coverage amounts
- never guarantee claims, visa acceptance or medical coverage
- prototype plans must be clearly conceptual/mock

## Trip Bucket service

Trip Bucket is a Vacatina domain service, not a supplier API.

Responsibilities:

- create/load bucket
- add a **configured** candidate
- update/remove item
- persist draft state
- refresh/revalidate supplier-dependent items
- expose readiness/state per item
- calculate ready subtotal from valid items
- represent price changes/expiry/unavailability
- determine checkout readiness

Supplier-dependent items must be revalidated before final checkout.

## Favorites service

Responsibilities:

- save
- remove
- list
- sync guest/account state when possible

Favorites must be completely separate from Trip Bucket.

## Unified checkout

The prototype may model one checkout experience, but production implementation must retain per-product fulfillment boundaries.

Responsibilities:

1. validate Trip Bucket readiness
2. revalidate time-sensitive products
3. collect traveller/contact data
4. calculate final totals/taxes/fees using backend truth
5. create payment session
6. finalize through idempotent webhook/server process
7. create/confirm product bookings or applications
8. handle partial failure safely
9. issue confirmation state and references

Never finalize bookings solely from client-side state.
