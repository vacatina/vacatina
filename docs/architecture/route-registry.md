# Canonical Route Registry (v1.0)
**Document Authority:** Vacatina Architectural Board & Senior Systems Architect  
**Classification:** Client-Side Single Page Application Routing Standard  
**Target Systems:** `CanonicalRouterService`, Browser History API, Vercel Static Rewrites  
**Status:** **LOCKED & ENFORCED IN PRODUCTION**  

---

## 1. Overview & 404 Fallback Governance

All client-side navigation within Vacatina is resolved via `CanonicalRouterService`. Direct page requests or subpaths are rewritten to `index.html` by `vercel.json` and dispatched without blank server errors.

### 404 Catch-All Behavior:
Any unrecognized path displays the branded Vacatina 404 Experience with:
1. "Search Travel" command center trigger.
2. "Return Home" reset action.
3. Popular product quick-links.
4. Live customer support direct contact (`tel:+94113606200`).

---

## 2. Complete Registry of the 66 Canonical Routes

### 2.1 Core Homepage & Product Hubs (12 Routes)
1. `/` (Homepage & Search Command Center)
2. `/flights` (Flights Hub & Search)
3. `/hotels` (Hotels & Stays Hub & Search)
4. `/visa-assistance` (Consular Visa Assistance Hub; also aliased as `/visa`)
5. `/holiday-packages` (Holiday Packages & Curated Itineraries; also aliased as `/packages`)
6. `/cars-transfers` (Ground Mobility & Chauffeur Fleet; also aliased as `/cars`)
7. `/rails` (Scenic & Regional Rail Journeys)
8. `/cruises` (Ocean & River Cruise Expeditions)
9. `/activities` (Curated Activities & Safaris)
10. `/sightseeing-tours` (Guided Sightseeing Tours; also aliased as `/tours`)
11. `/travel-insurance` (Travel Protection & Shield Comparison; also aliased as `/insurance`)
12. `/trip-builder/results` (Build Your Bundle Multi-Vertical Assembly)

### 2.2 Search & Result Exploration Routes (10 Routes)
13. `/flights/search` (Flights Search Results Grid)
14. `/flights/explore` (All Scheduled Routes Directory)
15. `/hotels/search` (Hotels Search Results Grid)
16. `/hotels/explore` (Curated Hotel Collections)
17. `/visa-assistance/options` (Consular Visa Options Directory)
18. `/holiday-packages/search` (Holiday Package Results)
19. `/cars-transfers/search` (Chauffeur & Rental Results)
20. `/rails/search` (Intercity Train Schedule Results)
21. `/cruises/search` (Cruise Sailing Results)
22. `/activities/search` (Activity Experiences Results)
23. `/sightseeing-tours/search` (Guided Tour Results)
24. `/travel-insurance/compare` (Travel Insurance Plan Comparison Grid)

### 2.3 Product Configuration & Detail Modals (10 Routes)
25. `/flights/offer/:offerId` (Flight Fare Family & Baggage Configurator)
26. `/hotels/property/:id` (Hotel Property Amenity & Room Details)
27. `/hotels/property/:id/configure` (Hotel Room & Meal Plan Configurator)
28. `/holiday-packages/:id` (Holiday Package Itinerary & Inclusions)
29. `/cars-transfers/offer/:id` (Ground Transfer Vehicle Selection)
30. `/rails/journeys/:id` (Scenic Rail Route Dossier)
31. `/cruises/:id` (Cruise Itinerary & Cabin Selection)
32. `/activities/:id` (Activity Schedule & Participant Selection)
33. `/sightseeing-tours/:id` (Sightseeing Tour Day Plan)
34. `/travel-insurance/plans/:id` (Insurance Policy Terms & Underwriter Wording)

### 2.4 Journey, Cart & Booking Flow Routes (6 Routes)
35. `/trip-planner` (Hero Structured Trip Planner Workflow)
36. `/trip-bucket` (Screen 04 Trip Bucket Full Experience; also aliased as `/trip`)
37. `/favorites` (Screen 05 Saved Favorites Wishlist Drawer)
38. `/trip/review` (Consolidated Trip Dossier Review; also aliased as `/checkout`)
39. `/booking/confirmation` (Confirmed Booking Voucher & PNR Display)
40. `/manage-booking` (Post-Booking Dossier Lookup & Passenger Self-Service)

### 2.5 Resources Information Architecture (8 Routes)
41. `/resources` (Resources Central Index Hub)
42. `/resources/travel-notes` (Travel Notes & Blog Dispatches)
43. `/resources/destinations` (Curated Destination City Guides)
44. `/resources/seasonal-guide` (Monsoon & Peak Travel Season Guides)
45. `/resources/visa-requirements` (Consular Requirements Matrix)
46. `/resources/travel-insurance-guide` (Insurance Protection Guidance)
47. `/resources/travel-disruption` (Airline Disruption & Passenger Rights Guide)
48. `/resources/trip-bucket-guide` (Trip Bucket 8-State Onboarding Guide)

### 2.6 Account & Authentication Routes (7 Routes)
49. `/auth/sign-in` (Clerk Universal Sign-In Modal)
50. `/auth/sign-up` (Clerk Universal Registration Modal)
51. `/account` (User Profile & Security Settings)
52. `/account/trips` (Passenger Past & Upcoming Trips Ledger)
53. `/account/visa-applications` (Consular Visa Application Tracker)
54. `/account/travelers` (Saved Passenger & Passport Dossier)
55. `/account/preferences` (Language, Currency & Travel Preferences)

### 2.7 Company & Help Pages (9 Routes)
56. `/about` (About Vacatina & Company Mission)
57. `/careers` (Vacatina Global Careers)
58. `/corporate-travel` (B2B Corporate Travel Solutions)
59. `/sustainability` (Sustainability, Carbon Offsets & Community Care)
60. `/press` (Press Releases & Media Kit)
61. `/support` (Customer Support & Live Desk Triage)
62. `/support/visa` (Consular Visa Help Desk)
63. `/help/faq` (Frequently Asked Questions)
64. `/contact` (Contact Us & Direct Telephony)

### 2.8 Legal, Trust & Operations (6 Routes)
65. `/legal/privacy` (Privacy Policy & GDPR Compliance)
66. `/legal/terms` (Terms of Service & Booking Conditions)
67. `/legal/cookies` (Cookie Consent Policy & Preferences Shell)
68. `/accessibility` (WCAG 2.1 AA Accessibility Statement)
69. `/policies/cancellations` (Transparent Cancellation & Refund Policy)
70. `/admin` (Platform Control & Operations Center; also `/admin/inventory`)
71. `/b2b/portal` (B2B Partner Agency Portal & Dashboard)
