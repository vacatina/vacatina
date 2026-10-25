# Backend Integration Contract & Responsibility Map (v1.0)
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Backend Engineering Handoff Contract & API Specification  
**Target Systems:** Vacatina Backend API, Clerk JWT Verifier, Upstream Supplier Adapters  
**Status:** **LOCKED & ENFORCED IN PRODUCTION**  

---

## 1. Architectural Separation: Frontend Routes $\ne$ Backend API Endpoints

A foundational architectural rule governs the system:
$$\mathbf{\text{FRONTEND SPA ROUTES }} \ne \mathbf{\text{ BACKEND REST/GRAPHQL ENDPOINTS}}$$

Frontend routes (e.g. `/flights`, `/trip/review`, `/admin/inventory`) are client-side navigation views handled by `CanonicalRouterService`. Backend endpoints (e.g. `POST /api/v1/search`, `POST /api/v1/booking/checkout`) are stateless, authenticated API services returning standard JSON or RFC 7807 Problem Details.

---

## 2. The 15 Mandatory Backend Capabilities

The backend engineering team must provide implementation for these 15 explicit capabilities:

| # | Capability Domain | HTTP Method & Path | Primary Responsibility |
| :---: | :--- | :--- | :--- |
| **1** | **Multi-Product Search** | `POST /api/v1/search` | Dispatches criteria across manual repository and supplier adapters; returns normalized `UnifiedCustomerOffer[]`. |
| **2** | **Offer Details** | `GET /api/v1/offers/:id` | Returns complete offer dossier (carrier rules, room amenities, itinerary, inclusions). |
| **3** | **Pre-Booking Revalidation**| `POST /api/v1/offers/:id/revalidate` | Live availability and price freshness verification against upstream supplier API. |
| **4** | **Allotment Hold (Atomic)**| `POST /api/v1/inventory/hold` | Reserves 1 allotment unit for 15 minutes (`COMMITTED_HELD`) to prevent double-booking. |
| **5** | **Allotment Release** | `POST /api/v1/inventory/release` | Releases expired or cancelled allotment reservation back to available inventory. |
| **6** | **Manual Listing CMS** | `GET, POST /api/v1/admin/listings` | Admin backoffice CRUD for 18-attribute direct contracts and services. |
| **7** | **4-Eyes Governance** | `POST /api/v1/admin/listings/:id/lifecycle`| Enforces transition approvals: `DRAFT` $\rightarrow$ `COMMERCIAL_REVIEW` $\rightarrow$ `FINANCE_APPROVED` $\rightarrow$ `PUBLISHED`. |
| **8** | **Commercial Pricing Rules**| `GET, PUT /api/v1/admin/pricing-rules` | Dynamic markup percentages and consular fee schedules (never hardcoded). |
| **9** | **Trip Bucket Sync** | `POST /api/v1/trip-bucket/sync` | Persists multi-product customer trip dockets across guest/authenticated sessions. |
| **10**| **Saved Favorites** | `GET, POST, DELETE /api/v1/favorites` | Manages customer wishlists strictly isolated from Trip Bucket totals. |
| **11**| **Authentication & RBAC** | `Bearer <Clerk_JWT>` | RS256 JWT cryptographic verification using Clerk JWKS endpoints. |
| **12**| **Booking Saga Initiation**| `POST /api/v1/booking/checkout` | Orchestrates multi-source payment capture, PNR issuance, and voucher generation. |
| **13**| **Manage Booking Dossier** | `GET /api/v1/bookings/:ref` | Customer self-service booking retrieval, flight schedule updates, and voucher download. |
| **14**| **Consular Visa Desk** | `POST /api/v1/visa/applications` | Ingests applicant passport details and document uploads for consular vetting. |
| **15**| **Support & Exceptions** | `POST /api/v1/support/tickets` | Operational triage for flight cancellations, schedule changes, and manual refunds. |

---

## 3. Standardized Error Handling (RFC 7807 Problem Details)

All backend endpoints return standardized RFC 7807 error structures. Upstream errors are never masked into silent button failures or raw stack traces:

```json
{
  "type": "https://vacatina.com/errors/inventory-quarantine",
  "title": "Inventory Not Sellable in Production",
  "status": 422,
  "detail": "Listing vac-seed-hotel-kandalama-demo is quarantined as SEED demo data and cannot enter commercial checkout.",
  "instance": "/api/v1/booking/checkout",
  "code": "INVENTORY_QUARANTINED"
}
```

### Standard Error Codes:
- `VALIDATION_FAILED` (400): Incomplete search or configuration parameters.
- `UNAUTHORIZED` (401): Missing or expired Clerk JWT bearer token.
- `FORBIDDEN` (403): User lacks required RBAC role (`SUPER_ADMIN` or `B2B_AGENT`).
- `OFFER_EXPIRED` (410): Upstream supplier fare or room has expired; recheck required.
- `PRICE_CHANGED` (409): Upstream supplier rate mutated during checkout; requires customer reconfirmation.
- `ALLOTMENT_EXHAUSTED` (422): Remaining units = 0; room sold out.
- `UPSTREAM_OUTAGE` (502 / 504): Circuit breaker tripped for candidate adapter; automated fallback initiated.

---

## 4. Upstream Provider Adapter Interface

Backend supplier integrations implement the standardized provider interface:

```typescript
export interface SupplierProviderAdapter {
  providerId: string;
  providerName: string;
  productType: TravelProductSlug;
  operationalTier: 'CONFIGURED_SANDBOX' | 'CANDIDATE_INTEGRATION' | 'PRODUCTION_LIVE';

  search(criteria: SearchCriteria): Promise<UnifiedCustomerOffer[]>;
  getOffer(offerId: string): Promise<UnifiedCustomerOffer>;
  revalidate(offerId: string, options: any): Promise<RevalidationResult>;
  createBooking(payload: BookingPayload): Promise<BookingConfirmation>;
  cancelBooking(bookingRef: string, reason: string): Promise<CancellationResult>;
}
```
