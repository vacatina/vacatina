# VACATINA FLIGHTS — FULL FUNCTIONAL BUILD & BACKEND INTEGRATION HANDOFF CONTRACT (v1.0)

> **Historical snapshot:** verification counts and release status in this document predate the Phase 4 local baseline. Current verified baseline: **233/233 tests**, **0 typecheck errors**, build PASS, browser/server bundle isolated. See [../ENGINEERING_BASELINE.md](../ENGINEERING_BASELINE.md).

**Authority**: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD  
**Status**: PRODUCTION-VERIFIED (Frontend Architecture & Adapters Complete, 135/135 Unit & Domain Tests Passing, 34/34 Browser Acceptance Assertions Passing)  
**Target Backend Team**: Vacatina Core Engine & Supplier Integrations  

---

## 1. Executive Summary & Architecture Scope

Vacatina Flights represents the premier B2C travel vertical in the Vacatina Travel OS. It has been built not as a visual mock-up, but as a **fully functional, production-ready frontend and adapter architecture** adhering strictly to the **Unified Inventory Model (`MANUAL`, `API`, `HYBRID`, `SEED`)**.

### Architectural Pillars
1. **Zero Supplier Hardcoding**: Provider-neutral adapter contract (`IFlightAdapter`). Future live suppliers (e.g., Duffel, Amadeus Enterprise, TBO Air, Sabre NDC) plug in without modifying UI components or search aggregator logic.
2. **Unified Search Pipeline**: Merges Manual Direct Inventory (in-house contracts, promotional fares, private shuttles) and Supplier API offers into a canonical format (`CanonicalFlightOffer`).
3. **Trip Bucket 8-State Lifecycle**: Seamless integration into the Trip Bucket candidate engine preserving all segment, slice, baggage, and fare family metadata without flattening.
4. **Pre-Booking Revalidation Protocol**: Enforces atomic upstream price and seat checks prior to checkout, supporting `UNCHANGED`, `PRICE_CHANGED`, `OFFER_EXPIRED`, and `UNAVAILABLE` resolution flows.
5. **Commercial Truth & Honest UI**: Clear segregation between live bookable, request-to-book desk allocations, and informational promotional inventory.

---

## 2. Canonical Flight Domain Model Schema (`CanonicalFlightOffer`)

All flight inventory—regardless of whether it originates from the Vacatina Manual CMS or an upstream GDS/NDC gateway—normalizes to this 39-field canonical schema before reaching the UI or Trip Bucket.

```typescript
export interface CanonicalFlightOffer {
  // Identity & Source Provenance
  offerId: string;                              // Stable canonical ID (e.g. 'sup-flt-cmb-dxb-fz548', 'man-flt-cmb-dxb-ek651')
  sourceType: 'manual' | 'supplier_api';        // Inventory origin taxonomy
  sourceProvider: string;                       // Adapter ID ('manual_cms', 'gds_ndc_gateway', 'duffel_adapter', etc.)
  supplierId: string;                           // Upstream supplier identifier
  sourceOfferId: string;                        // Upstream provider's raw offer/rate key
  createdAtIso: string;                         // Ingestion/Search timestamp
  validUntilIso: string;                        // Price hold expiration timestamp

  // Operational Status & Governance
  status: 'active' | 'paused' | 'expired';      // Catalog lifecycle status
  bookability: 'informational' | 'request_to_book' | 'live_bookable';

  // Route & Schedule Core
  tripType: 'round_trip' | 'one_way' | 'multi_city';
  origin: FlightLocation;                       // { airportCode, airportName, city, country, terminal? }
  destination: FlightLocation;                  // { airportCode, airportName, city, country, terminal? }
  departureAt: string;                          // ISO 8601 UTC
  arrivalAt: string;                            // ISO 8601 UTC
  durationMinutes: number;                      // Total journey duration
  stopCount: number;                            // 0 = Direct, 1 = 1-Stop, etc.

  // Itinerary Topology
  slices: FlightSlice[];                        // Outbound, Inbound, or Multi-City legs
  segments: FlightSegment[];                    // Individual aircraft legs (handling layovers & technical stops)

  // Marketing & Operating Carriers
  airlines: FlightCarrierSummary[];             // All participating airlines
  marketingCarrier: FlightCarrierSummary;       // Ticketing carrier (code, name, logoUrl)
  operatingCarrier: FlightCarrierSummary;       // Aircraft operator (code, name)
  flightNumber: string;                         // e.g. 'FZ 548', 'QR 665 / QR 003'
  aircraft: string;                             // e.g. 'Boeing 737 MAX 8', 'Airbus A350-900'

  // Cabin & Fare Family Configuration
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  fareFamily: string;                           // Active/Base family name ('Lite', 'Classic', 'Flex')
  fareFamiliesAvailable: FlightFareFamilyOption[]; // Matrix of available upgrade tiers

  // Baggage & Amenities
  baggage: StructuredBaggage;                   // Personal item, Cabin bag (kg), Checked bag (pieces & kg)
  mealInformation?: string;                     // e.g. 'Complimentary hot meal & beverages included'
  seatAvailability?: number;                    // Remaining quota/allotment (e.g. 4)

  // Flexibility & Fare Rules
  changeRules: FlightFlexibilityRule;           // { allowed, feeMinor, currency, description }
  refundRules: FlightFlexibilityRule;           // { allowed, feeMinor, currency, description }

  // Pricing & Commercial Breakdown
  price: FlightPriceBreakdown;                  // { baseFareMinor, taxesMinor, feesMinor, totalMinor, currency }
  availabilityStatus: 'AVAILABLE' | 'PRICE_CHANGED' | 'EXPIRED' | 'UNAVAILABLE';

  // Traveller Pricing & Inclusions
  travellerPricing?: TravellerPriceItem[];      // Itemized adult, child, infant breakdowns
  includedServices: string[];                   // e.g. ['20kg Checked Bag', 'Standard Seat Selection']
  optionalServices?: FlightOptionalService[];   // Available add-ons (extra baggage, priority boarding)

  // Manual Inventory Metadata (Present only when sourceType === 'manual')
  manualInventoryMetadata?: {
    allotmentTotal: number;
    allotmentRemaining: number;
    requiresManualConfirmation: boolean;
    contractReference: string;
    internalDeskNotes?: string;
  };
}
```

---

## 3. Canonical Search Request & Aggregation Protocol

### Endpoint: `POST /api/v1/flights/search`

#### Request Payload Specification (`FlightSearchRequest`)
```json
{
  "searchId": "srch-1740520000000",
  "tripType": "round_trip",
  "origin": {
    "airportCode": "CMB",
    "airportName": "Bandaranaike International Airport",
    "city": "Colombo",
    "country": "Sri Lanka"
  },
  "destination": {
    "airportCode": "DXB",
    "airportName": "Dubai International Airport",
    "city": "Dubai",
    "country": "United Arab Emirates"
  },
  "departureDate": "2026-11-15",
  "returnDate": "2026-11-22",
  "travellers": {
    "adults": 1,
    "children": 0,
    "infants": 0
  },
  "cabinClass": "economy",
  "directFlightsOnly": false,
  "nearbyAirports": false,
  "displayCurrency": "LKR",
  "locale": "en"
}
```

#### Response Envelope Specification (`FlightSearchResponse`)
```json
{
  "searchId": "srch-1740520000000",
  "totalCount": 8,
  "filteredCount": 8,
  "currency": "LKR",
  "offers": [
    {
      "offerId": "sup-flt-cmb-dxb-fz548",
      "sourceType": "supplier_api",
      "sourceProvider": "gds_ndc_gateway",
      "status": "active",
      "bookability": "live_bookable",
      "price": {
        "baseFareMinor": 8500000,
        "taxesMinor": 1250000,
        "feesMinor": 1000000,
        "totalMinor": 10750000,
        "currency": "LKR"
      }
    }
  ],
  "facets": {
    "airlines": [{ "code": "FZ", "name": "flydubai", "count": 2, "minPriceMinor": 10750000 }],
    "stops": [{ "stops": 0, "count": 5, "minPriceMinor": 8900000 }],
    "priceRange": { "minMinor": 8900000, "maxMinor": 62500000, "currency": "LKR" },
    "durationRange": { "minMinutes": 285, "maxMinutes": 1050 }
  },
  "warnings": []
}
```

---

## 4. Provider-Neutral Flight Adapter Interface (`IFlightAdapter`)

To attach any live supplier, the backend team must implement the `IFlightAdapter` contract:

```typescript
export interface IFlightAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceType: 'manual' | 'supplier_api';

  isHealthy(): Promise<boolean>;
  search(request: FlightSearchRequest): Promise<CanonicalFlightOffer[]>;
  getOfferById(offerId: string): Promise<CanonicalFlightOffer | null>;
  revalidateOffer(offerId: string, currentPriceMinor: number): Promise<FlightRevalidationResult>;
  getAncillaries?(offerId: string): Promise<FlightOptionalService[]>;
}
```

---

## 5. Pre-Booking Revalidation Protocol & 8-State Handling

Prior to checkout or whenever an offer in the Trip Bucket is refreshed, `revalidateOffer` is triggered. The backend returns one of 4 deterministic statuses:

| Upstream Status | Canonical Code | Action Required | Trip Bucket State Transition |
| :--- | :--- | :--- | :--- |
| Price & Seats Confirmed | `UNCHANGED` | None | Stays `ready` |
| Upstream Fare Adjusted | `PRICE_CHANGED` | Traveler must accept or reject new fare | Moves to `price_changed` (displays previous & new price with "Accept New Price" CTA) |
| Ticket Allotment Expired | `OFFER_EXPIRED` | Traveler must re-search or choose replacement | Moves to `offer_expired` ("Find New Flight" CTA) |
| Cabin / Inventory Sold Out | `UNAVAILABLE` | Item blocked from checkout | Moves to `unavailable` ("Choose Alternative" CTA) |

---

## 6. Trip Bucket Candidate Mapping (`mapFlightOfferToTripCandidate`)

When staged into the Trip Bucket, flight items generate a `TripBucketCandidate`:
- **ID**: `tb-${offer.offerId}`
- **Product Type**: `'flights'`
- **State Rule**: If multiple fare families exist and none is selected $\rightarrow$ `'needs_action'`. If configured with selected family $\rightarrow$ `'ready'`.
- **Price**: Calculated as base offer `totalMinor` + selected fare family delta.
- **Provenance**: Preserves `rawSupplierPrice`, `supplierBaseCurrency`, `confirmationMode` (`INSTANT_CONFIRM` vs `REQUEST_TO_CONFIRM` vs `ASSISTED_SERVICE`).

---

## 7. Automated Verification & QA Sign-Off

- **Unit & Domain Tests**: 135/135 tests passing (`tests/flights-functional-build.test.ts` added to master suite).
- **E2E Browser Acceptance Tests**: 34/34 assertions passing across 11 viewports (360px–1920px) and 13 full user journeys (`scripts/browser-verify.mjs`).
- **Zero Console Errors**: CDP console errors = 0, page exceptions = 0.
- **Production URL**: Verified live at [https://vacatina-nu.vercel.app](https://vacatina-nu.vercel.app).
