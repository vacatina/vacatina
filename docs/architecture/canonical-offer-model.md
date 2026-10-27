# Canonical Offer Model & Schema Specification (v1.0)
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Canonical Domain Data Contracts & Cross-Layer Interface Standard  
**Target Systems:** Vacatina Web Client, Inventory Orchestrator, Supplier Adapters, Trip Bucket  
**Status:** **LOCKED & ENFORCED IN PRODUCTION**  

---

## 1. Architectural Purpose

The Canonical Offer Model (`UnifiedCustomerOffer`) defines the unified schema consumed by all frontend results components, configurators, Trip Bucket drawers, and booking sagas. Upstream supplier schemas (Duffel NDC XML, LiteAPI JSON, Amadeus Edifact) are strictly encapsulated within provider adapters and normalized into this structure before leaving the server.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Duffel NDC Response         │       │     LiteAPI Hotel Response      │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 ▼                                         ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│      DuffelFlightAdapter        │       │       LiteApiHotelAdapter       │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
                        CANONICAL OFFER NORMALIZER
                                      │
                                      ▼
                       UnifiedCustomerOffer (Stable ID)
```

---

## 2. Comprehensive TypeScript Interface

```typescript
export interface UnifiedCustomerOffer {
  /** Stable immutable offer identifier (e.g. "vac-fl-duffel-001" or "vac-man-hotel-001") */
  offerId: string;
  
  /** Exactly one of the 10 locked travel products */
  productType:
    | 'flights'
    | 'hotels'
    | 'visa'
    | 'packages'
    | 'cars'
    | 'rails'
    | 'cruises'
    | 'activities'
    | 'sightseeing'
    | 'insurance';

  /** Provenance tier — Exactly 4 types */
  sourceType: 'API' | 'MANUAL' | 'HYBRID' | 'SEED';
  
  /** Operational subtype */
  sourceSubtype:
    | 'SUPPLIER_FEED'
    | 'DIRECT_CONTRACT'
    | 'MANUAL_SERVICE'
    | 'CURATED_PACKAGE'
    | 'DYNAMIC_PACKAGE'
    | 'PROTOTYPE_SAMPLE';

  /** Legal supplier entity identifier */
  supplierId: string;
  supplierName: string;
  externalOfferId?: string;
  manualListingId?: string;

  /** Merchandising & Content */
  title: string;
  subtitle?: string;
  description: string;
  imageUrl: string;
  tags: string[];

  /** Honest Customer-Facing Commercial State */
  confirmationMode: 'INSTANT_CONFIRM' | 'REQUEST_TO_CONFIRM' | 'ASSISTED_SERVICE';
  exclusivityBadge?: 'VACATINA_EXCLUSIVE' | 'DIRECT_PARTNER' | 'SPECIAL_OFFER';

  /** Financial Pricing (Integer Minor Units — Zero Floating-Point Rounding) */
  pricing: {
    currency: 'LKR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'AED';
    netCostMinor: number;
    markupMinor: number;
    taxesAndFeesMinor: number;
    sellingPriceMinor: number;
    pricingType: 'PER_PERSON' | 'PER_NIGHT' | 'TOTAL' | 'PER_VEHICLE' | 'QUOTE_REQUIRED';
  };

  /** Availability & Inventory Allocation */
  availability: {
    status: 'AVAILABLE' | 'LIMITED' | 'ON_REQUEST' | 'SOLD_OUT' | 'RECHECK_REQUIRED';
    remainingUnits?: number;
    inventoryModel: 'ALLOTMENT' | 'ON_REQUEST' | 'SERVICE_CAPACITY' | 'UNLIMITED_NON_INVENTORY';
  };

  /** Freshness, Expiry & Revalidation */
  validity: {
    validFrom: string;
    validTo: string;
    lastCheckedAt: string;
    expiresAt: string;
    ttlSeconds: number;
    revalidationRequired: boolean;
  };

  /** Standardized Cancellation Policy */
  cancellation: {
    policyType: 'FREE_CANCELLATION' | 'TIERED_PENALTY' | 'NON_REFUNDABLE';
    deadlineTimestamp?: string;
    penaltyDescription: string;
  };

  /** Commercial Sellability Gate */
  commercialReadiness: {
    architectureReady: boolean;
    codeVerified: boolean;
    supplierVerified: boolean;
    commercialApproved: boolean;
    financeApproved: boolean;
    legalApproved: boolean;
    productionSellable: boolean;
  };
}
```

---

## 3. Financial Invariant: Integer Minor Units

To eliminate floating-point arithmetic errors across currencies (LKR, USD, EUR, GBP, AUD, AED), all monetary values are represented strictly in integer minor units (cents):
- $\$100.00 \text{ USD} = 10,000 \text{ minor units}$
- $\text{LKR } 505,000.00 = 50,500,000 \text{ minor units}$

$$\text{sellingPriceMinor} = \text{netCostMinor} + \text{markupMinor} + \text{taxesAndFeesMinor}$$

---

## 4. Freshness & Pre-Booking Revalidation Lifecycle

API offers enforce an explicit freshness window (default: 20 minutes / 1,200 seconds):
$$\text{Search Timestamp} \xrightarrow{\le 20\text{ min}} \text{Fresh (READY)} \xrightarrow{> 20\text{ min}} \text{RECHECK\_REQUIRED (NEEDS\_ACTION)}$$

Before checkout initiation, if `revalidationRequired === true` or `Date.now() > expiresAt`:
1. The client invokes `POST /api/v1/offers/:id/revalidate`.
2. The supplier adapter queries upstream availability.
3. If price unchanged $\rightarrow$ remains `READY_FOR_CHECKOUT`.
4. If price changed $\rightarrow$ transitions to `PRICE_WATCH` ("Price Changed from X to Y") and requires user confirmation.
5. If inventory exhausted $\rightarrow$ transitions to `UNAVAILABLE` and offers alternatives.
