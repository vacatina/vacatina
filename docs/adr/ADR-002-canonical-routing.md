# ADR-002: Canonical Production Routing Architecture

> **Status**: APPROVED & ADOPTED  
> **Date**: 2026-10-25  
> **Context**: Establishing explicit canonical routes across B2C, B2B, Admin, and API surfaces with zero dead-ends.

---

## 1. Context & Problem Statement
Vacatina requires a definitive, deep-linkable routing contract that supports customer discovery, search result parameterization, multi-product configuration, partner agency operations, operational triage queues, and programmatic API interactions.

## 2. Decision
The application adopts a unified, multi-surface canonical routing architecture:

### 2.1 B2C Commercial Surface
- **Discovery & Hubs**: `/`, `/flights`, `/hotels`, `/visa-assistance`, `/holiday-packages`, `/cars-transfers`, `/rails`, `/cruises`, `/activities`, `/sightseeing-tours`, `/travel-insurance`.
- **Search & Results**: `/trip-builder/results`, `/flights/search`, `/hotels/search`, `/visa-assistance/options`, `/holiday-packages/search`, `/cars-transfers/search`, `/rails/search`, `/cruises/search`, `/activities/search`, `/sightseeing-tours/search`, `/travel-insurance/quote`.
- **Details & Configuration**: `/flights/offers/:offerId`, `/hotels/:propertyId`, `/visa/:destination`, `/packages/:slug`, `/packages/:slug/customize`, `/cars-transfers/reserve`, `/rails/itinerary`, `/cruises/:id`, `/activities/:id`, `/sightseeing-tours/:id`, `/travel-insurance/coverage`.
- **Trip Orchestration**: `/trip-bucket`, `/favorites`, `/checkout/:checkoutId`, `/bookings/:reference`, `/manage/:reference`.
- **Account & Trust**: `/account/*`, `/support/*`, `/resources/*`, `/about`, `/careers`, `/legal/*`.

### 2.2 B2B Partner Portal Surface
- `/partner`: Partner agency executive dashboard (metrics, recent bookings, quick quotes).
- `/partner/clients`: Client roster, traveler profiles, corporate policies.
- `/partner/quotes`: Tailored quote generator, commission estimation, markup rules.
- `/partner/bookings`: Multi-product agency bookings, status tracking, hold management.
- `/partner/commissions`: Ledger of earned commissions, settlement requests, payouts.
- `/partner/team`: Sub-agent management, role assignments (`AGENCY_OWNER`, `AGENCY_MANAGER`, `BOOKING_AGENT`).

### 2.3 Admin & Operations Backoffice Surface
- `/admin`: Operational overview, critical alerts, SLA counters.
- `/admin/queues`: Real-time booking triage, manual review queue, failed supplier reconciliations.
- `/admin/listings`: Manual inventory CMS (lifecycle: Draft $\rightarrow$ Review $\rightarrow$ Published $\rightarrow$ Paused $\rightarrow$ Expired).
- `/admin/pricing`: Global markup rules, seasonal overrides, and manual price adjustments with mandatory audit reasons.
- `/admin/visa`: Consular document verification desk, checklist audits, application approval pipeline.
- `/admin/audit`: Immutable platform audit trail, privileged action logs, and system events.

### 2.4 API Surface
- `/api/v1/search/:product`: Aggregated multi-source search.
- `/api/v1/offers/:id/revalidate`: Real-time price and availability check.
- `/api/v1/trip-buckets`: Persistent multi-item trip bucket operations.
- `/api/v1/checkout-sessions`: Server-computed checkout snapshot creation.
- `/api/v1/bookings`: Saga-backed multi-product booking execution.
- `/api/v1/partner/*`: Authenticated tenant-scoped agency endpoints.
- `/api/v1/admin/*`: Privileged backoffice operations endpoints.
- `/webhooks/:provider`: Cryptographically verified supplier & payment webhooks.

## 3. Consequences
- Zero `#` links, zero placeholder modals, and zero silent actions.
- Client router and server API routes share identical parameter and path conventions.
