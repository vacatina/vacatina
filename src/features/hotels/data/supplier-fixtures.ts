/* ============================================================================
 * Vacatina LiteAPI Bedbank Supplier Hotel Fixtures (API Inventory)
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Normalized into CanonicalHotelOffer format via adapter.
 * 2. Ranked beneath Vacatina Direct Manual contracts (Tier 3 Pin-Above-API rule).
 * 3. 100% provider-neutral with isSeed: false.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';

export const SUPPLIER_HOTEL_FIXTURES: CanonicalHotelOffer[] = [
  {
    hotelId: 'lp-atlantis-the-palm-dubai',
    canonicalOfferId: 'vct-ht-api-liteapi-dubai-atlantis',
    sourceType: 'API',
    providerId: 'LITEAPI',
    supplierName: 'LiteAPI Global Bedbank',
    name: 'Atlantis, The Palm — Dubai',
    subtitle: 'Iconic Luxury Ocean Resort on Palm Jumeirah',
    description: 'World-renowned 5-star destination resort located on the crescent of Dubai Palm Jumeirah. Home to Aquaventure Waterpark, The Lost Chambers Aquarium, award-winning celebrity chef restaurants, and pristine private beaches.',
    starRating: 5,
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      address: 'Crescent Road, Palm Jumeirah, Dubai, UAE',
      neighborhood: 'Palm Jumeirah',
      latitude: 25.1304,
      longitude: 55.1171,
      distanceToCenterKm: 22.0
    },
    heroImage: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      'Aquaventure Waterpark Access',
      'The Lost Chambers Aquarium',
      'Private White Sand Beach',
      'Nobu & Gordon Ramsay Dining',
      'Kids & Teens Activity Club',
      'AWAKEN Spa & Wellness'
    ],
    featuredBadge: 'Global Landmark',
    isPinnedAboveApi: false,
    guestRatingScore: 9.3,
    guestReviewCount: 1840,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: 14500000, // 145,000 LKR (~$475 USD)
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'lp-atlantis-ocean-king',
        name: 'Ocean King Room with Arabian Sea View',
        description: '47 sqm luxury room offering uninterrupted views across the azure Arabian Gulf. Features contemporary nautical décor, plush king bedding, and a French balcony.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 47,
        images: [
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Arabian Sea View', 'Free Waterpark Passes', 'Deep Soaking Tub', 'Balcony'],
        ratePlans: [
          {
            planId: 'lp-plan-ocean-ro',
            rateName: 'LiteAPI Standard Rate',
            boardBasis: 'RO',
            boardBasisLabel: 'Room Only',
            nightlyRateMinor: 14500000,
            totalTaxesMinor: 1450000,
            totalPriceMinor: 15950000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 4).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 72 hours before arrival.',
            isRecommended: false
          },
          {
            planId: 'lp-plan-ocean-bb',
            rateName: 'Kaleidoscope Breakfast Included',
            boardBasis: 'BB',
            boardBasisLabel: 'Buffet Breakfast Included',
            nightlyRateMinor: 16800000,
            totalTaxesMinor: 1680000,
            totalPriceMinor: 18480000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 4).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 72 hours before arrival.',
            isRecommended: true
          }
        ]
      }
    ]
  },
  {
    hotelId: 'lp-shangrila-colombo',
    canonicalOfferId: 'vct-ht-api-liteapi-colombo-shangrila',
    sourceType: 'API',
    providerId: 'LITEAPI',
    supplierName: 'LiteAPI Global Bedbank',
    name: 'Shangri-La Hotel — Colombo',
    subtitle: '5-Star Oceanfront Luxury overlooking Galle Face Green',
    description: 'Premier 5-star hotel centrally located along One Galle Face ocean promenade. Features panoramic views of the Indian Ocean, CHI The Spa, serene outdoor pool, and renowned dining at Capital Bar & Grill.',
    starRating: 5,
    location: {
      city: 'Colombo',
      country: 'Sri Lanka',
      countryCode: 'LK',
      address: '1 Galle Face, Colombo 02, Sri Lanka',
      neighborhood: 'Galle Face Promenade',
      latitude: 6.9271,
      longitude: 79.8436,
      distanceToCenterKm: 0.5
    },
    heroImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      'Galle Face Ocean Views',
      'CHI The Spa',
      'Outdoor Lagoon Pool',
      'Direct One Galle Face Mall Access',
      'Horizon Club Lounge'
    ],
    featuredBadge: 'City Center Favorite',
    isPinnedAboveApi: false,
    guestRatingScore: 9.2,
    guestReviewCount: 890,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: 6200000, // 62,000 LKR
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'lp-shangrila-deluxe-lake',
        name: 'Deluxe Lake & City View Room',
        description: 'Elegant 42 sqm contemporary room overlooking Beira Lake and the vibrant Colombo skyline with signature Shangri-La bedding.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 42,
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Marble Bathroom', 'City Views', 'Executive Desk', 'Pillow Menu'],
        ratePlans: [
          {
            planId: 'lp-plan-shangrila-bb',
            rateName: 'Table One Breakfast Buffet Rate',
            boardBasis: 'BB',
            boardBasisLabel: 'Breakfast Included',
            nightlyRateMinor: 6200000,
            totalTaxesMinor: 620000,
            totalPriceMinor: 6820000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 3).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours prior to check-in.',
            isRecommended: true
          }
        ]
      }
    ]
  },
  {
    hotelId: 'lp-ritz-carlton-maldives',
    canonicalOfferId: 'vct-ht-api-liteapi-maldives-ritzcarlton',
    sourceType: 'API',
    providerId: 'LITEAPI',
    supplierName: 'LiteAPI Global Bedbank',
    name: 'The Ritz-Carlton Maldives, Fari Islands',
    subtitle: 'Ultra-Luxury Spherical Overwater Villas in Fari Islands',
    description: 'Architectural masterpiece designed by Kerry Hill Architects. Iconic circular minimalist overwater villas set over turquoise lagoons, personal Aris Meeha butler service, and Jean-Michel Cousteau Environmental Ambassadors program.',
    starRating: 5,
    location: {
      city: 'Malé / Atolls',
      country: 'Maldives',
      countryCode: 'MV',
      address: 'Fari Islands, North Malé Atoll, 20013, Maldives',
      neighborhood: 'North Malé Atoll',
      latitude: 4.6136,
      longitude: 73.6128,
      distanceToCenterKm: 45.0
    },
    heroImage: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      'Spherical Overwater Architecture',
      'Personal Aris Meeha Island Butler',
      'The Ritz-Carlton Spa Overwater Ring',
      '7 Culinary Sanctuaries',
      'Speedboat & Seaplane Lounge'
    ],
    featuredBadge: 'Ultra-Luxury Sanctuary',
    isPinnedAboveApi: false,
    guestRatingScore: 9.9,
    guestReviewCount: 115,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: 48000000, // 480,000 LKR (~$1,550 USD)
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'lp-ritz-ocean-pool-villa',
        name: 'Ocean Pool Villa — Overwater Sanctuary',
        description: 'Breathtaking 150 sqm circular villa suspended over the crystal lagoon. Features private infinity plunge pool, sun deck, panoramic glass pavilion, and direct ladder into the reef.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 150,
        images: [
          'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Private Infinity Plunge Pool', 'Direct Lagoon Access', 'Outdoor Deck', 'Butler Service'],
        ratePlans: [
          {
            planId: 'lp-plan-ritz-hb',
            rateName: 'Luxury Half Board Island Retreat',
            boardBasis: 'HB',
            boardBasisLabel: 'Half Board (Breakfast + Dinner Across 7 Venues)',
            nightlyRateMinor: 48000000,
            totalTaxesMinor: 4800000,
            totalPriceMinor: 52800000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 14).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 14 days before arrival.',
            isRecommended: true
          }
        ]
      }
    ]
  }
];

export function getActiveSupplierHotels(): CanonicalHotelOffer[] {
  return SUPPLIER_HOTEL_FIXTURES.filter(h => h.availabilityStatus === 'AVAILABLE');
}
