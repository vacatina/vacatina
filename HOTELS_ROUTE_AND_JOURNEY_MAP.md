# Vacatina — Hotels Route & Journey Map

## Canonical routes (reused, authoritative)
- `/hotels` — Hotels Product Hub (search form, featured direct contracts, destination collections)
- `/hotels/explore` — Explore All Hotels & Curated Collections (scrolls to recommended section)
- `/hotels/search` — Hotel Search Results (filters, sort, modify search)
- `/hotels/property/:id` — Hotel Property Overview (modal over hub/search)
- `/hotels/property/:id/configure` — Room configuration deep link (modal, configure flag)
- `/trip-bucket` — Trip Bucket drawer (shared, stages configured hotel items)
- `/trip/review` — Trip Review (shared, hotel + other services)
- `/checkout` — Checkout (shared, preview only)
- `/bookings/:ref` — Booking dossier (shared)
- `/manage-booking` — Manage booking (shared)

B2B/admin routes (`/partner/*`, `/admin/*`) are shared; hotel-specific sub-views are not yet distinct.

## Mandatory journey (implemented path)
Discover (Hub) → Search (form validation, autocomplete, occupancy) → Filter/Sort → Property Detail (modal) → Select Room & Rate → Stage in Trip Bucket (READY) → Trip Review → Checkout Preview → Confirmation Preview → Manage Booking.

## State persistence
- Search context (destination, check-in/out, occupancy) passed via URL query params (`hotelQuery`/`parseHotelQuery`).
- Property modal reads search context from query or `lastHotelContext`.
- Trip Bucket staging uses `hotelTripBucketService.stageHotelRoom` with `HotelSelectedConfiguration`.
- Revalidation via `hotelSearchService.revalidate(hotelId, roomId, planId)`.

## Data distinctions preserved
- Supplier inventory (`sourceType: API`, provider `LITEAPI`) vs direct-contracted (`MANUAL`, `VACATINA_DIRECT`).
- Indicative vs revalidated pricing (revalidate returns UNCHANGED/PRICE_CHANGED/UNAVAILABLE).
- Per-night vs total-stay pricing (nightlyRateMinor vs totalPriceMinor).
- Display currency vs settlement currency (currency field on config).
- Property cancellation rules vs room-rate-specific rules (freeCancellationBefore on plan).
- Confirmed bookings vs requests/pending/previews (all hotel booking actions labelled preview).

## Roles & permissions
- Public B2C: no wholesale net prices, commissions, or markups.
- B2B/admin: shared portals; hotel-specific role gating not yet distinct (uses existing admin/partner modal gates).
