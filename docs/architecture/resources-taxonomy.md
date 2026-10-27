# Unified Resources Taxonomy Specification (v1.0)
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Content Architecture, Information Architecture & Global Navigation Standard  
**Target Systems:** Desktop Navigation Dropdown, Mobile Navigation Drawer, Global Enterprise Footer  
**Status:** **LOCKED & ENFORCED IN PRODUCTION**  

---

## 1. Resolution of Legacy Taxonomy Mixing

In previous revisions, company information and customer support items were erroneously mixed into the Resources section. This specification locks the definitive structural separation:
- **Company Information** belongs strictly to **Company** (`/about`, `/careers`, `/sustainability`, `/press`).
- **Support & Triage** belongs strictly to **Help & Support** (`/support`, `/manage-booking`, `/help/faq`, `/contact`).
- **Resources** is strictly reserved for editorial destination guides, travel tools, and regulatory guidance.

---

## 2. The Canonical 8-Item Resources Taxonomy

Across all 3 global UI locations (Desktop Header Dropdown, Mobile Navigation Drawer, and Global Enterprise Footer), the Resources taxonomy is identical:

| # | Canonical Label | Canonical Route | Scope & Editorial Function |
| :-: | :--- | :--- | :--- |
| **1** | **Travel Notes & Blog** | `/resources/travel-notes` | Editorial dispatches, route reviews, airline cabin comparisons, and travel news. |
| **2** | **Destination Guides** | `/resources/destinations` | Curated city, coastal, and cultural guides (Dubai, Maldives, Sri Lanka, London, Bali). |
| **3** | **Seasonal Travel Guide** | `/resources/seasonal-guide` | Monsoon timing, peak winter sun calendars, European summer logistics, and festival schedules. |
| **4** | **Visa Requirement Checker** | `/resources/visa-requirements` | Interactive consular requirements matrix for major transit and tourist jurisdictions. |
| **5** | **Travel Insurance Guide** | `/resources/travel-insurance-guide` | Underwriting concepts, medical emergency cover guidelines, and baggage claim standards. |
| **6** | **Travel Disruption Guide** | `/resources/travel-disruption` | Airline schedule change rights, hotel cancellation protocols, and refund escalation steps. |
| **7** | **Trip Bucket Guide** | `/resources/trip-bucket-guide` | Customer onboarding for the 8-state Trip Bucket, multi-product staging, and draft saves. |
| **8** | **View All Resources** | `/resources` | Centralized index hub displaying all editorial collections, checklists, and calculators. |

---

## 3. Deep-Linking Structure

Individual editorial content items follow hierarchical nested path patterns:
- Article / Dispatch: `/resources/travel-notes/:slug` (e.g. `/resources/travel-notes/dubai-transit-guide`)
- Destination Guide: `/resources/destinations/:slug` (e.g. `/resources/destinations/sri-lanka`)
- Seasonal Guide: `/resources/seasonal-guide/:slug` (e.g. `/resources/seasonal-guide/maldives-monsoon`)

---

## 4. Renamed Customer-Facing Labels

To maintain a calm, premium, and customer-centric tone, technical protocol labels have been renamed as mandated:
- ❌ *Disruption Protocol* $\rightarrow$ ✅ **Travel Disruption Guide**
- ❌ *Trip Bucket Guidelines* $\rightarrow$ ✅ **Trip Bucket Guide**
- ❌ *Review Protocols* $\rightarrow$ ✅ **How We Compare Options**
