# Vacatina — Final Normalized Inventory Matrix, Source Selection & Operational CMS Specification
## 40-Card Current vs Future Provider Matrix, Source Mode Separation & Multi-Criteria Selection Engine

> **Authority**: Vacatina Core Engineering Board & Architecture Review (Final Normalization Pass)  
> **Status**: RATIFIED & LOCKED FOR BACKEND CONTRACT SIGN-OFF  
> **Document Reference**: `docs/18_VACATINA_FINAL_NORMALIZED_INVENTORY_MATRIX_AND_SOURCE_SELECTION.md`  
> **Cross-References**: ADR-001 through ADR-008, `docs/09_CAPABILITY_PRESERVATION_MATRIX.md`, `docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md`, `docs/16_VACATINA_PRODUCTION_GOVERNANCE_AND_SUPPLIER_CERTIFICATION.md`, `docs/17_MASTER_INVENTORY_SOURCE_MATRIX_AND_ADMIN_CMS_SPECIFICATION.md`  
> **Live Production URL**: `https://vacatina-nu.vercel.app`

---

## 1. Executive Summary & Affirmation of Architecture Truthfulness

Following the rigorous final architectural audit, Vacatina establishes **zero ambiguity between current runtime reality and future certified provider capabilities**:

1. **Separation of `sourceMode` and `integrationStatus`**: Combined ambiguous terms like `MANUAL_DIRECT / API_FUTURE` are deprecated. The architecture now separates the origin mode (`sourceMode`: `CONTENT_ONLY` | `MANUAL` | `API`), the integration state (`integrationStatus`: `NOT_APPLICABLE` | `PLANNED` | `SANDBOX` | `CERTIFIED_LIVE`), and the manual contract type (`manualSourceType`: `DIRECT_CONTRACT` | `MANUAL_INTERNAL` | `PARTNER_MANUAL` | `null`).
2. **Current vs Future Provider Behavior**: Cards that represent future API candidates (such as Viator experiences or Duffel flights) are **never** described in their current backend action as performing live supplier queries. Current behavior is strictly prefill search form or local direct contract dispatch; future live API calls take place only after certification gates pass.
3. **Availability & Pricing Truth**: `LIVE_INSTANT` and `LIVE_DYNAMIC` are reserved exclusively for certified live integrations. Candidate and uncertified inventory truthfully operates as `CONTENT_ONLY`, `ON_REQUEST`, `ALLOTMENT`, or `MANUAL_CONFIRMATION` with `INDICATIVE`, `FIXED_MANUAL`, or `CONTRACTED` pricing.
4. **Verification Status (`verificationStatus`)**: Real direct contracts are backed by commercial references (`VERIFIED_CONTRACT`), internal operations by capacity SLA (`VERIFIED_INTERNAL`), while offline partner agreements in progress are labeled `PARTNER_PENDING`, and accelerator fixtures are labeled `PROTOTYPE`.
5. **Multi-Criteria Source Selection Engine**: When both manual inventory and API feeds exist for a destination (e.g. Dubai Safari), the system does **not** blindly favor API. It scores availability, verification status, net cost, gross margin, cancellation terms, and SLA confidence.

---

## 2. Orthogonal Source Taxonomy & Dimensions

```mermaid
flowchart TD
    subgraph Dimensions["Orthogonal Canonical Dimensions"]
        SM["1. sourceMode\nCONTENT_ONLY | MANUAL | API"]
        IS["2. integrationStatus\nNOT_APPLICABLE | PLANNED |\nSANDBOX | CERTIFIED_LIVE"]
        MST["3. manualSourceType\nDIRECT_CONTRACT | MANUAL_INTERNAL |\nPARTNER_MANUAL | null"]
        VS["4. verificationStatus\nVERIFIED_CONTRACT | VERIFIED_INTERNAL |\nPARTNER_PENDING | UNVERIFIED | PROTOTYPE"]
        CAM["5. currentAvailabilityMode\nCONTENT_ONLY | ON_REQUEST |\nALLOTMENT | MANUAL_CONFIRMATION | LIVE_INSTANT"]
        CPM["6. currentPricingMode\nINDICATIVE | FIXED_MANUAL |\nCONTRACTED | LIVE_DYNAMIC"]
    end

    subgraph Engine["Unified Normalization Engine"]
        Normalizer["Offer Normalizer & Scorer\n(computeOfferSourceScore)"]
        Canon["CanonicalOfferEntity v2.0"]
    end

    Dimensions --> Normalizer --> Canon
```

---

## 3. The Definitive 40-Card Master Inventory Matrix (Current vs. Future)

This table covers every card on the live Vacatina homepage (`https://vacatina-nu.vercel.app`), fixing the row 19 URL alignment and guaranteeing zero contradictory claims:

| # | Section | Card Title & Destination | Current `sourceMode` | `manualSourceType` | `verificationStatus` | Current Availability | Current Pricing | Current Backend Action (Live Today) | Future Provider | Future Integration Status | Future Backend Action (After Certification) | CTA Label | Destination URL |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- | :--- | :--- |
| **1** | Flights | Dubai (CMB ➔ DXB) | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Prefills Flight Search form; no live supplier query executed | `DUFFEL_NDC` | `SANDBOX` | Live NDC search, seat-map retrieval & instant ticket issuance | Explore Route | `/flights?from=CMB&to=DXB` |
| **2** | Flights | Malé (CMB ➔ MLE) | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Prefills Flight Search form; no live supplier query executed | `DUFFEL_NDC` | `SANDBOX` | Live regional carrier NDC query & fare validation | Explore Route | `/flights?from=CMB&to=MLE` |
| **3** | Flights | Bangkok (CMB ➔ BKK) | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Prefills Flight Search form; no live supplier query executed | `DUFFEL_NDC` | `SANDBOX` | Live Southeast Asia carrier query & fare validation | Explore Route | `/flights?from=CMB&to=BKK` |
| **4** | Flights | London (CMB ➔ LHR) | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Prefills Flight Search form; no live supplier query executed | `AMADEUS_GDS` | `PLANNED` | Live GDS flight search across scheduled long-haul carriers | Explore Route | `/flights?from=CMB&to=LHR` |
| **5** | Visa | UAE Tourist Visa | `MANUAL` | `MANUAL_INTERNAL` | `VERIFIED_INTERNAL` | `MANUAL_CONFIRMATION` | `FIXED_MANUAL` | Dispatches case intake to Vacatina Consular Concierge Desk | `null` | `NOT_APPLICABLE` | Automated consular status sync via UAE Embassy gateway | Start Visa Check | `/visa/apply/uae-tourist-visa` |
| **6** | Visa | UK Standard Visitor Visa | `MANUAL` | `MANUAL_INTERNAL` | `VERIFIED_INTERNAL` | `MANUAL_CONFIRMATION` | `FIXED_MANUAL` | Dispatches case intake to Vacatina Consular Concierge Desk | `null` | `NOT_APPLICABLE` | Document OCR audit & VFS Global appointment booking | Start Visa Check | `/visa/apply/uk-visitor-visa` |
| **7** | Visa | Thailand Tourist Visa | `MANUAL` | `MANUAL_INTERNAL` | `VERIFIED_INTERNAL` | `MANUAL_CONFIRMATION` | `FIXED_MANUAL` | Dispatches e-Visa application review to internal visa officer | `null` | `NOT_APPLICABLE` | Direct Thailand e-Visa consular portal integration | Start Visa Check | `/visa/apply/thailand-tourist-visa` |
| **8** | Visa | Singapore Entry Visa | `MANUAL` | `MANUAL_INTERNAL` | `VERIFIED_INTERNAL` | `MANUAL_CONFIRMATION` | `FIXED_MANUAL` | Dispatches case intake to Vacatina Consular Concierge Desk | `null` | `NOT_APPLICABLE` | ICA Singapore submission tracking integration | Start Visa Check | `/visa/apply/singapore-entry-visa` |
| **9** | Packages | Maldives Luxury Escape | `MANUAL` | `DIRECT_CONTRACT` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Opens Package Configurator; dispatches on-request quote to resort | `PACKAGES_BUNDLER` | `SANDBOX` | Dynamic packaging engine querying live resort allotment & seaplane | View Itinerary | `/packages/maldives-escape` |
| **10**| Packages | Dubai City Escape | `MANUAL` | `DIRECT_CONTRACT` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Opens Package Configurator; dispatches on-request quote to DMC | `PACKAGES_BUNDLER` | `SANDBOX` | Dynamic packaging engine querying flight NDC + hotel Bedbank | View Itinerary | `/packages/dubai-city-escape` |
| **11**| Packages | Bali Island Journey | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Opens Package Configurator; dispatches on-request quote to Bali DMC | `PACKAGES_BUNDLER` | `SANDBOX` | Automated DMC extranet inventory sync | View Itinerary | `/packages/bali-island-journey` |
| **12**| Packages | Thailand Discovery | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Opens Package Configurator; dispatches on-request quote to Thai DMC | `PACKAGES_BUNDLER` | `SANDBOX` | Automated multi-city tour packaging & hotel API sync | View Itinerary | `/packages/thailand-discovery` |
| **13**| Hotels | Ocean Lagoon Villa Maldives | `MANUAL` | `DIRECT_CONTRACT` | `VERIFIED_CONTRACT` | `ALLOTMENT` | `CONTRACTED` | Decrements Vacatina contracted villa allotment in database | `LITEAPI` | `SANDBOX` | Fallback bedbank query if contracted allotment sells out | View Details | `/hotels/ocean-lagoon-villa-maldives` |
| **14**| Hotels | Grand Skyline View Dubai | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens property detail page with indicative starting room rate | `LITEAPI` | `SANDBOX` | Live LiteAPI/Hotelbeds query for real-time room rates | View Details | `/hotels/grand-skyline-hotel-dubai` |
| **15**| Hotels | Riverside Luxury Bangkok | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens property detail page with indicative starting room rate | `LITEAPI` | `SANDBOX` | Live LiteAPI query for real-time room availability | View Details | `/hotels/riverside-luxury-bangkok` |
| **16**| Hotels | Historic Heritage London | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens property detail page with indicative starting room rate | `LITEAPI` | `SANDBOX` | Live LiteAPI query for London room availability | View Details | `/hotels/historic-heritage-london` |
| **17**| Activities | Coral Reef Snorkelling Maldives | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens experience detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for real-time excursion slot availability | Book Experience | `/activities/coral-reef-snorkelling-maldives` |
| **18**| Activities | Arabian Desert Sunset Safari | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches booking request to local Dubai safari operator | `VIATOR` | `SANDBOX` | Live Viator query with automated fallback to direct operator | Book Experience | `/activities/arabian-desert-safari-dubai` |
| **19**| Activities | Thai Culinary Masterclass | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens experience detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for culinary school class capacity | Book Experience | `/activities/thai-culinary-masterclass-bangkok` |
| **20**| Activities | Thames Twilight Cruise London | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens experience detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for river cruise departure availability | Book Experience | `/activities/thames-twilight-cruise-london` |
| **21**| Sightseeing| Dubai City Highlights & Sky Deck| `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens tour detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for observation sky deck timed vouchers | View Tour | `/sightseeing/dubai-city-sky-deck` |
| **22**| Sightseeing| Bangkok Temples & Grand Palace | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens tour detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for licensed temple guide bookings | View Tour | `/sightseeing/bangkok-temples-grand-palace` |
| **23**| Sightseeing| London Historic Landmarks | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens tour detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for monument skip-the-line admissions | View Tour | `/sightseeing/london-historic-landmarks` |
| **24**| Sightseeing| Singapore Civic District Tour | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens tour detail page with indicative starting rate | `VIATOR` | `SANDBOX` | Live Viator query for Supertree Grove walking tour slots | View Tour | `/sightseeing/singapore-civic-district` |
| **25**| Transfers | Dubai Airport Chauffeur | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches chauffeur transfer booking request to local fleet | `RENTALCARS` | `PLANNED` | Automated transfer dispatch integration | Book Transfer | `/transfers/dubai-airport-chauffeur` |
| **26**| Transfers | London Heathrow Transfer | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches chauffeur transfer booking request to UK partner | `RENTALCARS` | `PLANNED` | Automated UK chauffeur dispatch API | Book Transfer | `/transfers/london-heathrow-transfer` |
| **27**| Transfers | Sri Lanka Island Car Hire | `MANUAL` | `DIRECT_CONTRACT` | `VERIFIED_CONTRACT` | `ALLOTMENT` | `CONTRACTED` | Decrements Vacatina managed local fleet vehicle allotment | `RENTALCARS` | `PLANNED` | Consolidator fleet API sync for overflow rentals | Book Car Hire | `/cars/sri-lanka-island-discovery-hire` |
| **28**| Transfers | Bangkok Suvarnabhumi Van | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches private passenger van request to Bangkok fleet | `RENTALCARS` | `PLANNED` | Automated passenger van dispatch API | Book Transfer | `/transfers/bangkok-suvarnabhumi-transfer` |
| **29**| Cruises | Dubai & Arabian Gulf Cruise | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches cruise cabin hold request to partner agency | `TRAVELTEK` | `SANDBOX` | Live Traveltek query for cruise cabin inventory | View Sailing | `/cruises/dubai-arabian-gulf-cruise` |
| **30**| Cruises | Singapore & SE Asia Cruise | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens sailing detail page with indicative starting berth rate | `TRAVELTEK` | `SANDBOX` | Live Traveltek query for sailing departure dates & cabins | View Sailing | `/cruises/singapore-southeast-asia-cruise` |
| **31**| Cruises | Mediterranean Explorer | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens sailing detail page with indicative starting berth rate | `TRAVELTEK` | `SANDBOX` | Live Traveltek query for cabin holds & deck assignments | View Sailing | `/cruises/mediterranean-explorer-cruise` |
| **32**| Cruises | Indian Ocean Sea Voyage | `MANUAL` | `PARTNER_MANUAL` | `PARTNER_PENDING` | `ON_REQUEST` | `CONTRACTED` | Dispatches charter sailing inquiry to Seychelles partner | `TRAVELTEK` | `SANDBOX` | Live charter yacht inventory integration | View Sailing | `/cruises/indian-ocean-sea-voyage` |
| **33**| Rails | London to Paris Eurostar | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens rail route detail page with indicative starting fare | `TRAINLINE` | `SANDBOX` | Live Trainline query for Eurostar high-speed seats | Check Fares | `/rails/london-to-paris-eurostar` |
| **34**| Rails | Tokyo to Kyoto Shinkansen | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens rail route detail page with indicative starting fare | `TRAINLINE` | `PLANNED` | Japan Rail pass / seat reservation consolidator API | Check Fares | `/rails/tokyo-to-kyoto-shinkansen` |
| **35**| Rails | Kandy to Ella Scenic Train | `MANUAL` | `MANUAL_INTERNAL` | `VERIFIED_INTERNAL` | `ON_REQUEST` | `FIXED_MANUAL` | Dispatches station ticketing desk reservation request | `null` | `NOT_APPLICABLE` | Sri Lanka Railways online ticketing portal sync | Check Fares | `/rails/kandy-to-ella-scenic-train` |
| **36**| Rails | Swiss Alps Panoramic Train | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens rail route detail page with indicative starting fare | `TRAINLINE` | `SANDBOX` | Live Trainline query for SBB panoramic coaches | Check Fares | `/rails/swiss-alps-panoramic-journey` |
| **37**| Insurance | Essential Medical Plan | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens policy plan summary page with indicative premium | `ALLIANZ` | `SANDBOX` | Live Allianz underwriting premium query & policy bind | View Coverage | `/travel-insurance/plans?tier=essential` |
| **38**| Insurance | Comprehensive Single Trip | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens policy plan summary page with indicative premium | `ALLIANZ` | `SANDBOX` | Live Allianz underwriting premium query & policy bind | View Coverage | `/travel-insurance/plans?tier=comprehensive` |
| **39**| Insurance | Family Travel Protection | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens policy plan summary page with indicative premium | `ALLIANZ` | `SANDBOX` | Live Allianz underwriting family bundle premium calculation | View Coverage | `/travel-insurance/plans?tier=family` |
| **40**| Insurance | Annual Multi-Trip Cover | `CONTENT_ONLY` | `null` | `PROTOTYPE` | `CONTENT_ONLY` | `INDICATIVE` | Opens policy plan summary page with indicative premium | `ALLIANZ` | `SANDBOX` | Live Allianz underwriting multi-trip premium & certificate issue | View Coverage | `/travel-insurance/plans?tier=annual` |

---

## 4. Expanded `manual_listings` Admin CMS Collection for Operational Fulfillment

To ensure Vacatina operations staff can fulfill real customer bookings, the Payload CMS / PostgreSQL schema includes complete operational fields:

```typescript
export interface ManualListingOperationalEntity {
  id: UUID;
  productType: TravelProductSlug;
  sourceMode: 'MANUAL';
  manualSourceType: 'DIRECT_CONTRACT' | 'MANUAL_INTERNAL' | 'PARTNER_MANUAL';
  verificationStatus: 'VERIFIED_CONTRACT' | 'VERIFIED_INTERNAL' | 'PARTNER_PENDING' | 'UNVERIFIED' | 'PROTOTYPE';
  partnerSupplierId: string;
  partnerName: string;
  contractReference?: string;

  // Operational Fulfillment Contacts
  supplierContact?: {
    name: string;
    email: string;
    phone?: string;
    emergencyPhone?: string;
  };
  fulfilmentChannel: 'EMAIL' | 'PORTAL' | 'PHONE' | 'WHATSAPP' | 'AUTOMATED_WEBHOOK';
  confirmationDeadlineHours: number; // e.g. 24 or 48 hour SLA
  timezone: string;                  // e.g. 'Asia/Colombo', 'Asia/Dubai'

  // Pricing & Tax Breakdown
  contractedNetCostMinor: number;
  costCurrency: string;
  platformMarkupPercent: number;
  manualOverridePriceMinor?: number;
  overrideReason?: string;
  sellingPriceMinor: number;
  sellingCurrency: string;
  taxesAndFees?: {
    totalTaxMinor: number;
    isTaxInclusive: boolean;
    vatMinor?: number;
    tourismDirhamOrLevyMinor?: number;
    serviceChargeMinor?: number;
    mandatoryLocalFeesText?: string;
  };

  // Quota & Inventory Hold Lifecycle
  allottedQuota: number;
  heldQuota: number;
  bookedQuota: number;
  remainingQuota: number; // Computed: allottedQuota - heldQuota - bookedQuota
  availableQuota: number;
  isUnlimitedQuota: boolean;
  canAtomicallyReserve: boolean;
  inventoryHoldExpiryMinutes: number; // e.g. 15 or 30 minutes before release

  // Operational Rules & Policies
  validFrom: ISODateString;
  validUntil: ISODateString;
  effectiveFrom: ISODateString;
  effectiveTo: ISODateString;
  bookingWindow: {
    minAdvanceDays: number;
    maxAdvanceDays: number;
    minimumNoticeHours: number;
  };
  blackoutDates: string[]; // ISO YYYY-MM-DD
  stopSale: boolean;        // Operational kill-switch
  minTravellers: number;
  maxTravellers: number;
  childRules?: {
    minAgeYears?: number;
    infantFreeUnderYears?: number;
    childDiscountPercent?: number;
    note?: string;
  };

  // Terms, Inclusions & Cancellation
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  refundability: 'NON_REFUNDABLE' | 'PARTIALLY_REFUNDABLE' | 'FULLY_REFUNDABLE';
  refundEligibilityDescription?: string;
  bookingTerms?: string;
  internalNotes?: string;
  lastVerifiedAt?: ISODateString;

  // Media & Assets
  mediaAssets?: {
    heroUrl: string;
    galleryUrls: string[];
    brochurePdfUrl?: string;
  };

  // Governance Lifecycle & Audit History
  publicationStatus: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  distributionScope: 'B2C_ONLY' | 'B2B_ONLY' | 'BOTH' | 'INTERNAL_ONLY';
  editorUserId?: UUID;
  reviewedBy?: UUID;
  approvedBy?: UUID;
  publishedAt?: ISODateString;
  pausedAt?: ISODateString;
  archivedAt?: ISODateString;
  revisionNumber: number;
}
```

---

## 5. Multi-Criteria Source Selection Engine (Best Source Wins)

When both manual contracts and candidate/future API sources exist for the same travel product (e.g. Dubai Desert Safari), Vacatina does **not** automatically default to API.

The selection engine evaluates each offer using `computeOfferSourceScore(offer)`:

```
Score = Availability (0–30 pts)
      + Verification Status (0–25 pts)
      + Gross Margin (0–20 pts)
      + Cancellation Flexibility (0–15 pts)
      + SLA & Fulfillment Confidence (0–10 pts)
      + Pinned Override Bonus (+50 pts if verified & valid)
```

### Multi-Criteria Scoring Rules:
1. **Availability**:
   - `LIVE` or `MANUAL_AVAILABLE`: **30 pts**
   - `ON_REQUEST` or `CACHED`: **18 pts**
   - `SOLD_OUT` or `RATE_EXPIRED`: **-1000 pts** (Disqualified)
2. **Verification Status**:
   - `VERIFIED_CONTRACT` or `VERIFIED_INTERNAL`: **25 pts**
   - `PARTNER_PENDING`: **10 pts**
   - `UNVERIFIED`: **5 pts**
   - `PROTOTYPE` (SEED): **-2000 pts** (Quarantined)
3. **Gross Margin**:
   - $\ge 15\%$: **20 pts**
   - $10\% - 14.9\%$: **15 pts**
   - $5\% - 9.9\%$: **10 pts**
   - $< 5\%$: **5 pts**
4. **Cancellation Terms**:
   - Free cancellation: **15 pts**
   - Partial refund: **10 pts**
   - Non-refundable: **3 pts**
5. **Fulfillment SLA**:
   - Instant electronic issuance: **10 pts**
   - Concierge assisted service: **8 pts**
   - On-request manual dispatch: **5 pts**

> **Result**: A verified manual partner contract offering 25% margin and free cancellation scores **~85 points**, cleanly outranking an uncertified mock API offering 4% margin and non-refundable terms (**~35 points**). The best source wins dynamically.

---

## 6. Verification Evidence Across All Test Suites

```
========================================================================================
SUITE 1: Vacatina Domain & Core Architecture Invariant Tests (tests/unit.test.ts)
========================================================================================
✔ 41 / 41 Tests Passing (100% PASS, 0 failures, 0 skips)
- Invariant 1–37: Domain taxonomy, Trip Bucket 8 states, 4-layer pricing, circuit breakers,
  product extensions, deduplication composite keys, seed quarantine.
- Invariant 38: Discovery Content separation (assertDiscoveryContentCannotBeSold).
- Invariant 39: Production Response Safety & Package Component Provenance.
- Invariant 40: Complete Manual Listing Governance (Allotment, revisions, stop-sale, approver).
- Invariant 41: Granular Source Separation & Multi-Criteria Source Selection (GPT Audit v2.0).

========================================================================================
SUITE 2: Upstream Provider Certification & UAT Suite (tests/supplier-certification.test.ts)
========================================================================================
✔ 8 / 8 Tests Passing (100% PASS, 0 failures, 0 skips)
- Gate 1 & 2: Credentials guard (scaffolds cannot claim PRODUCTION_LIVE).
- Gate 3: Normalization integrity across candidate adapters.
- Gate 4: Integer minor pricing & multi-currency precedence.
- Gate 5: Pre-booking revalidation & state transition mapping.
- Gate 6 & 11: Invariant guard blocks scaffold providers from production bookings.
- Gate 7: Circuit breaker state transitions & rate limit fallbacks.
- Gate 8: RFC 7807 problem details error mapping.
- Gate 9, 10 & 12: Provider registry telemetry & audit compliance.

TOTAL AUTOMATED TEST COUNT: 49 / 49 PASSING
```

---

## 7. Next Step: Transition to Flights Real Product Flow (Step 5)

With the 40-card Master Inventory Matrix, truthful Current vs Future behaviors, and Admin CMS operational schema locked, Vacatina is fully ready to commence:

**Step 5: Flights Real Product Flow**
- `/flights` search form
- Live search aggregation (NDC Candidate + Direct Charter Allotments)
- Results presentation with Flight Product Extensions
- Fare family selection (`Economy`, `Value`, `Flex`)
- Staging into Trip Bucket (`Ready` state)
- Pre-booking fare revalidation
- Booking Saga handoff.

*Ratified by Vacatina Core Engineering Board.*
