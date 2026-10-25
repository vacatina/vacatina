# ADR-001: Application Runtime Architecture — TypeScript Modular Monolith

> **Status**: APPROVED & ADOPTED  
> **Date**: 2026-10-25  
> **Context**: Evaluating microservices vs distributed services vs modular monolith for Vacatina Travel Operating System.

---

## 1. Context & Problem Statement
Vacatina encompasses 10 distinct travel products, multi-product dynamic bundling, B2B partner agency workflows, backoffice operations, supplier adapter normalization, and real-time checkout orchestration. While older planning documents suggested separate microservices, premature distributed microservices introduce substantial operational latency, distributed transaction complexity, RPC failure modes, and heavy DevOps overhead during early platform scaling.

## 2. Decision
We adopt a **TypeScript Modular Monolith** architecture:
1. **Single Unified Codebase**: B2C Web, B2B Partner Portal, Admin Backoffice, and Server API/BFF share domain types, validation schemas, and normalizer utilities.
2. **Clear Internal Boundaries**: Modules are organized into cohesive domain packages (`Identity`, `Journey`, `Search`, `BookingSaga`, `ManualInventory`, `Payments`, `Visa`, `B2B`, `Operations`).
3. **Database Architecture**: Single PostgreSQL database with strict schema separation and versioned migrations.
4. **Serverless & Edge Ready**: The core server engine is implemented with pure web-standard primitives (`Request`, `Response`, `URL`, `Headers`), enabling execution within Node.js, Vercel Edge/Serverless functions, or standalone Docker containers.

## 3. Consequences
- **Positive**:
  - Zero network serialization overhead between internal domain boundaries.
  - Consistent type safety across client, server, and database interfaces.
  - Simplified CI/CD pipeline, unified local development, and deterministic E2E testing.
  - Clear extraction paths for high-throughput services (e.g. Flight Search Aggregator) if scale dictates in the future.
- **Negative / Mitigations**:
  - Requires strict discipline to prevent tight coupling across modules (enforced via domain service boundaries and explicit repository interfaces).
