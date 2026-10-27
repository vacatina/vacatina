# Vacatina — Production Implementation Charter v1.0

> **Authority**: Vacatina Engineering Steering Committee & Product Ownership  
> **Status**: RATIFIED & ACTIVE  
> **Supersedes**: Scope restrictions of prototype-only instructions  
> **Preserves**: Approved Google Stitch screens, DESIGN.md, brand DNA (#1B1464), 10-product taxonomy, 11-tab Search Command Center, Trip Bucket 8-state model, and zero-dead-end canonical routing.

---

## 1. Production Implementation Mandate

The existing Antigravity instruction remains authoritative for approved Vacatina design and functional invariants. 

This production charter formally expands the implementation scope from **"locked B2C prototype"** to a **complete, production-grade modular travel platform** spanning:
1. **B2C Core Experience**: Deep-linkable search, dynamic bundling, offer revalidation, 8-state Trip Bucket, and commercial dossier review.
2. **B2B Partner Portal**: Multi-tenant agency workspace, client roster management, dynamic markup rules, commission ledger, and team collaboration.
3. **Admin & Operations Backoffice**: Real-time operational queues, manual inventory CMS lifecycle, pricing/override audits, visa application advisory desk, and supplier health dashboards.
4. **Server & Database Architecture**: TypeScript modular monolith, PostgreSQL / Drizzle-compatible schema, versioned migrations, transactional outbox, and durable job processing.
5. **Security & Identity**: Tenant-aware RBAC/ABAC authorization, deny-by-default access control, Cloudflare R2 presigned private document storage, and OWASP ASVS 5.0.0 compliance.
6. **Commercial Saga Orchestration**: Distributed multi-item booking saga with independent provider fulfillment, idempotency ledger, payment gateway abstraction, and automated compensation/manual review workflows.
7. **Release Governance**: Previews, gated production promotions, zero downtime schema migrations, and immutable audit logs.

> [!IMPORTANT]
> **Non-Negotiable Constraints**:
> - **No Redesign of Approved Screens**: Do not redesign or alter the approved homepage visual system, 1440px desktop breakpoint, mobile drawer semantics, or official typography.
> - **No Fabricated Live Capabilities**: Never invent airline booking references, mock merchant accounts as live banks, or misrepresent simulated provider adapters as certified live connections.
> - **Separation of State Machines**: The customer Trip Bucket (8 states) and backend booking fulfillment (saga states) must remain distinct, decoupled state machines.

---

## 2. Ownership & Governance Boundary

| Domain | Antigravity Engineering Ownership | Product Owner Approval Gate |
| :--- | :--- | :--- |
| **Architecture** | Repository structure, TypeScript modular monolith, API endpoints, schema | Framework choice, server hosting provider |
| **Design System** | Component fidelity, responsive layouts, accessibility (WCAG 2.2 AA) | Locked visual changes, brand identity changes |
| **Integrations** | Normalized supplier adapters, sandbox testing, webhook handlers | Commercial supplier agreements, live credentials |
| **Payments** | Gateway abstraction layer, idempotency ledger, refund saga logic | Merchant of Record (MoR) legal entity, acquiring bank |
| **B2B & Admin** | Tenant isolation logic, role enforcement, operational queue UI | Commission policy, agency credit limits |
| **Deployment** | Preview pipelines, automated test gates, build artifacts | Final production promotion approval |

---

## 3. Architecture Decision Records (ADRs) Framework

All foundational technical decisions are recorded as immutable Architecture Decision Records:
- **`ADR-001`**: Application Runtime Architecture (TypeScript Modular Monolith)
- **`ADR-002`**: Canonical Routing Contract (Unified B2C, B2B, Admin & API Endpoints)
- **`ADR-003`**: Multi-Tenant B2B & Deny-by-Default Authorization Model
- **`ADR-004`**: Payment Gateway Abstraction & Merchant of Record Strategy
- **`ADR-005`**: Distributed Booking Saga & Compensation Orchestration

---

## 4. Definition of Done for Milestones

Every production milestone requires:
$$\text{DoD} = \text{Code} + \text{Schema/Migrations} + \text{Tests} + \text{Documentation} + \text{Preview Evidence} + \text{Security Assessment} + \text{Rollback Path}$$

A visually convincing UI without backing contracts, persistence, and tests does not constitute completion.
