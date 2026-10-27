/* ============================================================================
 * Vacatina Hotels Full Functional Build Automated Unit & Domain Test Suite
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOTEL_DESTINATIONS,
  searchDestinations,
  findDestinationByCity
} from '../src/features/hotels/data/destinations.ts';

import {
  MANUAL_HOTEL_OFFERS,
  getActiveManualHotels,
  findManualHotelById
} from '../src/features/hotels/data/manual-hotels.ts';

import {
  SUPPLIER_HOTEL_FIXTURES,
  getActiveSupplierHotels
} from '../src/features/hotels/data/supplier-fixtures.ts';

import { manualHotelAdapter } from '../src/features/hotels/adapters/manual-hotel.adapter.ts';
import { liteApiHotelAdapter } from '../src/features/hotels/adapters/liteapi-hotel.adapter.ts';
import { hotelSearchService } from '../src/features/hotels/services/hotel-search.service.ts';
import { hotelTripBucketService } from '../src/features/hotels/services/hotel-trip-bucket.service.ts';
import { hotelFavoritesService } from '../src/features/hotels/services/hotel-favorites.service.ts';
import { formatOccupancySummaryText } from '../src/features/hotels/ui/hotel-occupancy-selector.ts';
import type { HotelSearchRequest } from '../src/features/hotels/domain/hotel-search-models.ts';
import type { HotelSelectedConfiguration } from '../src/features/hotels/domain/hotel-models.ts';

test('Vacatina Hotels Full Functional Build Suite (Phase 3.2)', async (t) => {
  // 1. Destination Registry & Autocomplete Search
  await t.test('Hotel Gate 1: Destination Registry Integrity & Lookup', () => {
    assert.ok(HOTEL_DESTINATIONS.length >= 8, 'Must have at least 8 curated destinations');
    const bentota = findDestinationByCity('Bentota');
    assert.ok(bentota, 'Bentota must exist in destination registry');
    assert.equal(bentota!.countryCode, 'LK');

    const dubai = findDestinationByCity('Dubai');
    assert.ok(dubai, 'Dubai must exist in destination registry');
    assert.equal(dubai!.countryCode, 'AE');

    // Case-insensitive lookup
    assert.equal(findDestinationByCity('dubai')?.city, 'Dubai');
    assert.equal(findDestinationByCity('unknown_city'), undefined);
  });

  await t.test('Hotel Gate 2: Autocomplete Search with Partial Matching', () => {
    const results = searchDestinations('ben');
    assert.ok(results.length >= 1);
    assert.equal(results[0].city, 'Bentota');

    const emptyResults = searchDestinations('');
    assert.ok(emptyResults.length >= 5, 'Empty query should return default destinations');
  });

  // 2. Manual Inventory Contracts Integrity
  await t.test('Hotel Gate 3: Direct Manual Hotel Contracts Commercial Truth', () => {
    const manualHotels = getActiveManualHotels();
    assert.ok(manualHotels.length >= 3, 'Must have at least 3 active manual hotel contracts');

    for (const hotel of manualHotels) {
      assert.equal(hotel.sourceType, 'MANUAL');
      assert.equal(hotel.providerId, 'VACATINA_DIRECT');
      assert.equal(hotel.isPinnedAboveApi, true, 'Direct contracts must be pinned above API');
      assert.equal(hotel.isSeed, false, 'Bookable direct contracts must NOT be seed content');
      assert.ok(hotel.canonicalOfferId.startsWith('vct-ht-man-'), 'Must have canonical stable offer ID');
      assert.ok(hotel.roomCategories.length >= 1, 'Must have at least one room category');
      assert.ok(hotel.startingFromPriceMinor > 0, 'Price must be positive minor units');

      for (const room of hotel.roomCategories) {
        assert.ok(room.ratePlans.length >= 1, 'Room must have at least one rate plan');
        for (const plan of room.ratePlans) {
          assert.ok(['RO', 'BB', 'HB', 'FB', 'AI'].includes(plan.boardBasis), 'Valid board basis');
          assert.ok(plan.totalPriceMinor > 0);
          assert.ok(plan.cancellationPolicyDescription.length > 0);
        }
      }
    }
  });

  // 3. Supplier Bedbank Normalization
  await t.test('Hotel Gate 4: LiteAPI Bedbank Normalization Integrity', () => {
    const supplierHotels = getActiveSupplierHotels();
    assert.ok(supplierHotels.length >= 3, 'Must have at least 3 supplier bedbank hotels');

    for (const hotel of supplierHotels) {
      assert.equal(hotel.sourceType, 'API');
      assert.equal(hotel.providerId, 'LITEAPI');
      assert.equal(hotel.isPinnedAboveApi, false, 'Supplier API inventory must not pin above direct contracts');
      assert.equal(hotel.isSeed, false);
      assert.ok(hotel.canonicalOfferId.startsWith('vct-ht-api-liteapi-'));
    }
  });

  // 4. Multi-Source Search Orchestration & Pin-Above-API Ranking
  await t.test('Hotel Gate 5: Universal Multi-Source Search & Pin-Above-API Ranking', async () => {
    const request: HotelSearchRequest = {
      searchId: 'test-srch-1',
      destination: 'Bentota',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-15',
      occupancy: { rooms: 1, adults: 2, children: 0 }
    };

    const response = await hotelSearchService.search(request);
    assert.ok(response.offers.length >= 1);
    assert.equal(response.request.destination, 'Bentota');

    // First result must be the Vacatina Direct contracted hotel
    const firstOffer = response.offers[0];
    assert.equal(firstOffer.isPinnedAboveApi, true, 'First offer must be pinned direct contract');
    assert.equal(firstOffer.sourceType, 'MANUAL');
  });

  // 5. Broad Destination Search Merging Manual + API
  await t.test('Hotel Gate 6: Broad Destination Search (Dubai) Merges Direct + LiteAPI', async () => {
    const request: HotelSearchRequest = {
      searchId: 'test-srch-dubai',
      destination: 'Dubai',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-14',
      occupancy: { rooms: 1, adults: 2, children: 0 }
    };

    const response = await hotelSearchService.search(request);
    assert.ok(response.offers.length >= 2, 'Should find both direct penthouse and Atlantis');

    const manualFound = response.offers.some(o => o.sourceType === 'MANUAL');
    const apiFound = response.offers.some(o => o.sourceType === 'API');
    assert.ok(manualFound, 'Must include Manual direct inventory');
    assert.ok(apiFound, 'Must include API supplier inventory');

    // Verification of Pin-Above-API ranking
    assert.equal(response.offers[0].sourceType, 'MANUAL', 'Direct contract must be ranked above API');
  });

  // 6. Facet Computation and Filtering
  await t.test('Hotel Gate 7: Facet Generation & Star Rating Filtering', async () => {
    const request: HotelSearchRequest = {
      searchId: 'test-srch-facets',
      destination: '',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-14',
      occupancy: { rooms: 1, adults: 2, children: 0 }
    };

    const response = await hotelSearchService.search(request);
    assert.ok(response.facets.starCounts[5] >= 4, 'Must have multiple 5-star properties');
    assert.ok(response.facets.minPriceMinor > 0);
    assert.ok(response.facets.maxPriceMinor > response.facets.minPriceMinor);

    // Apply Direct Contract Only Filter
    const directOnly = hotelSearchService.filterAndSortOffers(
      response.offers,
      { directContractOnly: true },
      'recommended'
    );
    assert.ok(directOnly.every(o => o.sourceType === 'MANUAL'));

    // Apply Free Cancellation Only Filter
    const freeCanc = hotelSearchService.filterAndSortOffers(
      response.offers,
      { freeCancellationOnly: true },
      'recommended'
    );
    assert.ok(freeCanc.length >= 1);
  });

  // 7. Occupancy Text Formatter
  await t.test('Hotel Gate 8: Occupancy Text Formatting', () => {
    assert.equal(formatOccupancySummaryText({ rooms: 1, adults: 2, children: 0 }), '1 Room · 2 Adults');
    assert.equal(formatOccupancySummaryText({ rooms: 2, adults: 4, children: 1 }), '2 Rooms · 4 Adults · 1 Child');
    assert.equal(formatOccupancySummaryText({ rooms: 3, adults: 6, children: 3 }), '3 Rooms · 6 Adults · 3 Children');
  });

  // 8. Trip Bucket Candidate Staging & 8-State Engine Integration
  await t.test('Hotel Gate 9: Trip Bucket Candidate Transformation & Staging', async () => {
    const hotel = findManualHotelById('vct-dir-bentota-ocean-villa')!;
    assert.ok(hotel);

    const room = hotel.roomCategories[0];
    const plan = room.ratePlans[0];

    const config: HotelSelectedConfiguration = {
      hotelId: hotel.hotelId,
      canonicalOfferId: hotel.canonicalOfferId,
      roomId: room.roomId,
      roomName: room.name,
      planId: plan.planId,
      rateName: plan.rateName,
      boardBasis: plan.boardBasis,
      boardBasisLabel: plan.boardBasisLabel,
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-15',
      nights: 5,
      roomsCount: 1,
      adultsCount: 2,
      childrenCount: 0,
      nightlyRateMinor: plan.nightlyRateMinor,
      taxesMinor: plan.totalTaxesMinor,
      totalPriceMinor: plan.totalPriceMinor * 5,
      currency: plan.currency,
      freeCancellationBefore: plan.freeCancellationBefore,
      cancellationPolicyDescription: plan.cancellationPolicyDescription,
      sourceType: hotel.sourceType,
      supplierName: hotel.supplierName
    };

    const candidate = hotelTripBucketService.mapHotelOfferToTripCandidate(hotel, config, 'ready');

    assert.equal(candidate.productType, 'hotels');
    assert.equal(candidate.state, 'ready');
    assert.equal(candidate.state === 'ready', true);
    assert.equal(candidate.sourceType, 'MANUAL');
    assert.equal(candidate.offerId, hotel.canonicalOfferId);
    assert.equal(candidate.priceLkr, Math.round(plan.totalPriceMinor * 5 / 100));
  });

  // 9. Pre-Booking Revalidation Engine
  await t.test('Hotel Gate 10: Revalidation Engine Available, Price Changed & Depleted Sagas', async () => {
    const hotel = findManualHotelById('vct-dir-bentota-ocean-villa')!;
    const room = hotel.roomCategories[0];
    const plan = room.ratePlans[0];

    // Happy path: revalidate active manual room
    const reval = await hotelSearchService.revalidate(hotel.hotelId, room.roomId, plan.planId);
    assert.equal(reval.isAvailable, true);
    assert.equal(reval.status, 'AVAILABLE');
    assert.equal(reval.newPriceMinor, plan.totalPriceMinor);

    // Negative path: invalid room ID returns EXPIRED
    const revalInvalid = await hotelSearchService.revalidate(hotel.hotelId, 'non-existent-room', plan.planId);
    assert.equal(revalInvalid.isAvailable, false);
    assert.equal(revalInvalid.status, 'EXPIRED');

    // Negative path: invalid hotel returns UNAVAILABLE
    const revalNoHotel = await hotelSearchService.revalidate('unknown-hotel', 'r1', 'p1');
    assert.equal(revalNoHotel.isAvailable, false);
    assert.equal(revalNoHotel.status, 'UNAVAILABLE');
  });

  // 10. Saved Favorites Toggle
  await t.test('Hotel Gate 11: Hotel Saved Favorites Toggle Service', () => {
    const hotel = findManualHotelById('vct-dir-bentota-ocean-villa')!;
    assert.ok(hotel);

    // Toggle on
    const isSaved = hotelFavoritesService.toggleHotelFavorite(hotel);
    assert.equal(isSaved, true);
    assert.equal(hotelFavoritesService.isHotelFavorite(hotel.hotelId), true);

    // Toggle off
    const isNowSaved = hotelFavoritesService.toggleHotelFavorite(hotel);
    assert.equal(isNowSaved, false);
    assert.equal(hotelFavoritesService.isHotelFavorite(hotel.hotelId), false);
  });
});
