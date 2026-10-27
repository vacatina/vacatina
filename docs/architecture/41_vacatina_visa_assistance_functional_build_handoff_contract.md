# VACATINA — CONSULAR VISA ASSISTANCE FUNCTIONAL BUILD & CANONICAL HANDOFF CONTRACT (v1.0)

> **Historical snapshot:** verification counts and release status in this document predate the Phase 4 local baseline. Current verified baseline: **233/233 tests**, **0 typecheck errors**, build PASS, browser/server bundle isolated. See [../ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md).

**Authority**: Vacatina Master Product & Engineering Roadmap v2.0 (Phase 3.3) · PRD Section 4  
**Classification**: Authoritative Vertical Delivery & Architecture Contract  
**Target Systems**: `/visa-assistance` Hub · `/visa-assistance/search` Results View · `/visa-assistance/options` Catalog · `/visa-assistance/apply/:id` Application Modal · Provider Adapters · Trip Bucket Integration  
**Status**: 100% Implemented & Verified (169/169 Automated Tests Passing · 36/36 Browser Acceptance Assertions Verified)

---

## 1. Executive Vertical Summary

Visa Assistance is the third fully functional travel vertical delivered on Vacatina, strictly replicating the canonical customer journey and multi-tier inventory standard established by Flights and Hotels.

It models authentic consular services and document vetting workflows across:

1. **`MANUAL` (Vacatina Consular Concierge Desk)**:
   - Dedicated direct operations desk providing document pre-audit, official GDRFA/ICP portal filing, priority VFS/TLS biometric appointment scheduling, and consular embassy liaison.
   - Initial operational focus on key outbound corridors for Sri Lankan passport holders:
     - **United Arab Emirates (Dubai / Abu Dhabi)**: 30-Day and 60-Day Tourist e-Visas + 30-Day Business Investor Visas (2-3 business days SLA).
     - **United Kingdom**: 6-Month Standard Visitor Visa biometric filing and VFS Colombo appointment coordination.
     - **Singapore**: 30-Day Tourist e-Visa application via authorized strategic channel (SAVE portal).
     - **India**: 30-Day Double-Entry e-Tourist Visa (72-hour rapid issuance).
     - **France & Schengen Area**: 90-Day Short-Stay Uniform Type C dossier assembly & cover letter vetting.
     - **Sri Lanka (Inbound ETA)**: 30-Day inbound electronic travel authorization concierge for foreign tourists and diaspora.
   - Pinned above third-party aggregators (`isPinnedAboveApi: true`, Tier 1 ranking).
2. **Transparent Commercial Breakdown**:
   - Clear distinction between sovereign government consular fees (non-refundable once lodged) and Vacatina document vetting concierge fees.
3. **Statutory Compliance & Legal Guard**:
   - Prominent, inescapable legal disclaimer: *"Vacatina is a private travel orchestration provider and document assistance service. We do not issue visas or guarantee consular approval; sovereign decisions remain exclusively with official immigration authorities."*
4. **`SEED` Isolation**:
   - Homepage discovery cards strictly prefill search criteria.
   - Seed items are blocked from staging as `READY` in Trip Bucket or advancing to checkout.

---

## 2. Customer Journey Flow

```
Discover (Homepage / SCC)
       │
       ▼
Product Hub (`/visa-assistance`)
       │
       ▼
Sovereign Rule Resolution & Search Grid (`/visa-assistance/search` & `/visa-assistance/options`)
       │
       ▼
Application & Document Intake Wizard (`/visa-assistance/apply/:id`)
       │
       ▼
Configure & Stage in Trip Bucket (8-State Engine: `needs_action` or `ready`)
       │
       ▼
Pre-Booking Revalidation (`AVAILABLE` / `PRICE_CHANGED` / `UNAVAILABLE`)
       │
       ▼
Booking Review & Checkout
```

---

## 3. Implemented Components & Code Artifacts

### 3.1 Domain & Search Models
- [`src/features/visa/domain/visa-models.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/domain/visa-models.ts): Canonical visa offer model (`CanonicalVisaOffer`), document checklist item (`DocumentChecklistItem`), fee breakdown (`VisaPricingBreakdown`), applicant bio-data (`VisaApplicantBioData`), and configuration models.
- [`src/features/visa/domain/visa-search-models.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/domain/visa-search-models.ts): Search criteria, entry requirement rules (`VisaRequirementRule`), filter criteria, and facet models.

### 3.2 Data Layer
- [`src/features/visa/data/destinations.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/data/destinations.ts): Curated destination catalog with dynamic entry rule resolver (`resolveVisaRequirement()`), handling nationality-destination matrices, SLA expectations, and citizen exemptions.
- [`src/features/visa/data/manual-visas.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/data/manual-visas.ts): Direct contracted consular services with authentic pricing, document checklists, turnaround SLAs, and Pin-Above-API metadata.

### 3.3 Adapters & Search Service
- [`src/features/visa/adapters/visa-adapter.interface.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/adapters/visa-adapter.interface.ts): Provider-neutral adapter interface (`IVisaAdapter`).
- [`src/features/visa/adapters/manual-visa.adapter.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/adapters/manual-visa.adapter.ts): Vacatina Consular Desk adapter.
- [`src/features/visa/services/visa-search.service.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/services/visa-search.service.ts): Multi-source search orchestrator, entry rule lookup, SEED quarantine, and facet computation.
- [`src/features/visa/services/visa-favorites.service.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/services/visa-favorites.service.ts): Saved consular services favorites toggle.
- [`src/features/visa/services/visa-trip-bucket.service.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/services/visa-trip-bucket.service.ts): Candidate mapping to Trip Bucket with 8-state engine (`needs_action` when documents pending, `ready` when documents attached).

### 3.4 User Interface Views
- [`src/features/visa/ui/visa-country-autocomplete.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/ui/visa-country-autocomplete.ts): Accessible autocomplete dropdown for destinations and citizenships with keyboard navigation.
- [`src/features/visa/ui/visa-hub-view.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/ui/visa-hub-view.ts): Dedicated `/visa-assistance` Product Hub mounted at `#visa-view-mount`.
- [`src/features/visa/ui/visa-search-view.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/ui/visa-search-view.ts): Results view with prominent requirement rule banner, sidebar filters, and transparent fee schedules.
- [`src/features/visa/ui/visa-application-modal.ts`](file:///C:/Users/Madhusanka/.gemini/antigravity/scratch/vacatina/src/features/visa/ui/visa-application-modal.ts): 3-step application modal with document upload preview, bio-data inputs, and pre-booking revalidation hold staging.

---

## 4. Verification Evidence

1. **Automated Unit Tests**:
   - `tests/visa-assistance-functional-build.test.ts` (11 gates, 12 assertions, 100% pass).
   - Full test suite: **169/169 tests passing across 10 test suites (0 failures)**.
2. **Browser End-to-End Acceptance**:
   - `scripts/browser-verify.mjs`: Added **Journey O - Full B2C Consular Visa Experience**.
   - **All 36/36 browser acceptance assertions passing across 11 viewports and 15 journeys with zero console errors**.
3. **Captured Visual Artifacts**:
   - `vacatina_visa_hub_1440px.png`
   - `vacatina_visa_search_1440px.png`
   - `vacatina_visa_search_360px.png`
   - `vacatina_visa_modal_1440px.png`
