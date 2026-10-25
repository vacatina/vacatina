# ADR-003: Multi-Tenant B2B Architecture & Deny-by-Default Authorization

> **Status**: APPROVED & ADOPTED  
> **Date**: 2026-10-25  
> **Context**: Preventing cross-tenant data leakage in B2B partner agency and corporate travel operations.

---

## 1. Context & Problem Statement
Vacatina serves both B2C retail customers and B2B travel agency partners. Agency partners manage their own corporate clients, booking quotas, custom markups, and commission accounts. Cross-tenant data exposure (e.g., Agency A viewing Agency B's bookings or client PII) is a catastrophic compliance and security defect.

## 2. Decision
We implement a **Server-Enforced, Deny-by-Default Multi-Tenant RBAC/ABAC Model**:

### 2.1 Identity Hierarchy & Tenancy Boundary
$$\text{Authenticated User} \longrightarrow \text{Organization Membership} \longrightarrow \text{Role Assignment} \longrightarrow \text{Granted Permissions}$$

```
[User Context: userId, activeOrgId, roles[], permissions[]]
                     ↓
[Tenant Guard: WHERE organization_id = activeOrgId]
                     ↓
[Resource Access: Verify resource.organization_id === activeOrgId]
```

### 2.2 Canonical Role Taxonomy
1. **`CUSTOMER`**: Access restricted strictly to own profile, co-travelers, trip buckets, and bookings.
2. **`AGENCY_OWNER`**: Full agency administration, team management, commission payouts, and client policies.
3. **`AGENCY_MANAGER`**: Operational management of agency agents, booking approvals, and reporting.
4. **`BOOKING_AGENT`**: Authorized client quote generation, booking creation, and traveler management.
5. **`CORPORATE_COORDINATOR`**: Access restricted to corporate employee travel rosters and corporate approvals.
6. **`SUPPLIER_USER`**: Access restricted strictly to own contracted inventory and fulfillment requests.
7. **`SUPPORT_STAFF`**: Customer case resolution and policy-permitted booking modifications (masked finance).
8. **`FINANCE_OPS`**: Settlement reconciliation, refund authorization, and financial ledger review.
9. **`CONTENT_MARKETING`**: CMS listing curation, promotions, and travel guides (zero booking PII access).
10. **`PLATFORM_ADMIN`**: System administration under mandatory MFA and elevated audit logging.

### 2.3 Strict Security Rules
- **No Client Trust**: Never trust `organizationId` or `agencyId` supplied in client request payloads or URL parameters. The server resolves organization scope exclusively from the validated JWT / session context.
- **Negative Authorization Tests**: All API endpoints must pass automated negative test suites proving cross-tenant read/write attempts are rejected with HTTP 403 / 404.

## 3. Consequences
- Total logical isolation between agency tenants while sharing unified database tables.
- Seamless audit logging with authenticated actor attribution on every privileged action.
