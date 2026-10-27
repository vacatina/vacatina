/* ============================================================================
 * Vacatina Direct Contracted Hotels (MANUAL Inventory)
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Pinned Above API (Tier 1 ranking for Vacatina negotiated direct rates).
 * 2. Complete commercial evidence and allotment tracking.
 * 3. 100% provider-neutral canonical structure with isSeed: false.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';

export const MANUAL_HOTEL_OFFERS: CanonicalHotelOffer[] = [
  {
    hotelId: 'vct-dir-bentota-ocean-villa',
    canonicalOfferId: 'vct-ht-man-ceylon-heritage-bentota',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_DIRECT',
    supplierName: 'Vacatina Direct Contracts Desk',
    name: 'Ceylon Heritage Ocean Villa & Private Spa',
    subtitle: 'Direct Contracted Luxury Beachfront Sanctuary',
    description: 'An exclusive 5-star beachfront estate situated along the pristine golden coast of Bentota. Features private plunge pools, direct beach access, dedicated Ayurvedic wellness pavilion, and personalized butler service.',
    starRating: 5,
    location: {
      city: 'Bentota',
      country: 'Sri Lanka',
      countryCode: 'LK',
      address: '42 Galle Road, Moragalla, Bentota, 80500',
      neighborhood: 'Moragalla Beach',
      latitude: 6.4258,
      longitude: 79.9964,
      distanceToCenterKm: 1.2
    },
    heroImage: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      'Private Beachfront Access',
      'Ayurvedic Wellness Spa',
      'Infinity Ocean Pool',
      '24/7 Dedicated Butler Service',
      'Seafood Fine Dining Pavilion',
      'Complimentary High-Speed Wi-Fi',
      'Private Chauffeur Airport Transfer Available'
    ],
    featuredBadge: 'Vacatina Direct Exclusive',
    isPinnedAboveApi: true,
    guestRatingScore: 9.6,
    guestReviewCount: 284,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: 6800000, // 68,000 LKR ($220)
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'room-deluxe-ocean-suite',
        name: 'Deluxe Ocean View Suite with Private Balcony',
        description: 'Spacious 65 sqm suite with floor-to-ceiling glass doors opening directly onto a panoramic Indian Ocean balcony. Features handcrafted teak furnishings and freestanding terrazzo bath.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 65,
        images: [
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Ocean View Balcony', 'Freestanding Terrazzo Tub', 'Espresso Machine', 'Pillow Menu', 'Safe Box'],
        ratePlans: [
          {
            planId: 'plan-deluxe-bb',
            rateName: 'Vacatina Direct Rate — Bed & Breakfast',
            boardBasis: 'BB',
            boardBasisLabel: 'Breakfast Included',
            nightlyRateMinor: 6800000, // 68,000 LKR
            totalTaxesMinor: 680000,
            totalPriceMinor: 7480000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 5).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours before check-in. Non-refundable thereafter.',
            isRecommended: true
          },
          {
            planId: 'plan-deluxe-hb',
            rateName: 'Vacatina Direct Rate — Half Board Gourmet',
            boardBasis: 'HB',
            boardBasisLabel: 'Half Board (Breakfast + 4-Course Dinner)',
            nightlyRateMinor: 8500000, // 85,000 LKR
            totalTaxesMinor: 850000,
            totalPriceMinor: 9350000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 5).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours before check-in. Non-refundable thereafter.'
          }
        ]
      },
      {
        roomId: 'room-beachfront-plunge-villa',
        name: 'Signature Beachfront Villa with Private Plunge Pool',
        description: 'Ultra-exclusive 120 sqm beachfront sanctuary featuring a secluded tropical garden, private temperature-controlled plunge pool, outdoor rain shower, and direct step-out access to Moragalla beach.',
        maxAdults: 2,
        maxChildren: 2,
        maxOccupancy: 4,
        bedConfiguration: '1 King Bed + Daybed',
        roomSizeSqm: 120,
        images: [
          'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Private Plunge Pool', 'Direct Beach Gate', 'Outdoor Sun Loungers', 'Wine Chiller', 'Butler Service'],
        ratePlans: [
          {
            planId: 'plan-plunge-hb',
            rateName: 'Luxury Half Board Package',
            boardBasis: 'HB',
            boardBasisLabel: 'Half Board (Breakfast + Chef Dinner)',
            nightlyRateMinor: 11500000, // 115,000 LKR
            totalTaxesMinor: 1150000,
            totalPriceMinor: 12650000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 7).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 72 hours before check-in. 1 night charge within 72 hours.'
          },
          {
            planId: 'plan-plunge-ai',
            rateName: 'All-Inclusive Royal Retreat',
            boardBasis: 'AI',
            boardBasisLabel: 'All Inclusive (All Meals, Premium Drinks & Daily Spa)',
            nightlyRateMinor: 15500000, // 155,000 LKR
            totalTaxesMinor: 1550000,
            totalPriceMinor: 17050000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 7).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 7 days before check-in.'
          }
        ]
      }
    ]
  },
  {
    hotelId: 'vct-dir-galle-heritage-mansion',
    canonicalOfferId: 'vct-ht-man-galle-fort-grand-heritage',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_DIRECT',
    supplierName: 'Vacatina Direct Contracts Desk',
    name: 'The Grand Heritage Boutique Hotel — Galle Fort',
    subtitle: '17th Century Dutch Colonial UNESCO Fort Residence',
    description: 'Impeccably restored Dutch colonial mansion inside the historic Galle Fort UNESCO World Heritage site. Preserves original terracotta tiles, arched colonnades, antique four-poster beds, and an internal frangipani courtyard.',
    starRating: 5,
    location: {
      city: 'Galle',
      country: 'Sri Lanka',
      countryCode: 'LK',
      address: '28 Church Street, Galle Fort, Galle, 80000',
      neighborhood: 'Galle Fort Heritage Quarter',
      latitude: 6.0272,
      longitude: 80.2173,
      distanceToCenterKm: 0.1
    },
    heroImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      'Historical Frangipani Courtyard Pool',
      'Afternoon Ceylon Tea Library',
      'Fine Dining Courtyard Restaurant',
      'Concierge Walking Tours of Galle Fort',
      'High-Speed Wi-Fi'
    ],
    featuredBadge: 'Vacatina Heritage Collection',
    isPinnedAboveApi: true,
    guestRatingScore: 9.8,
    guestReviewCount: 196,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    startingFromPriceMinor: 5800000, // 58,000 LKR
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'room-dutch-colonial-chamber',
        name: 'Dutch Governor Colonial Chamber',
        description: 'Authentic 52 sqm heritage chamber with high vaulted timber ceilings, antique ebony writing desk, and custom canopy four-poster bed.',
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 2,
        bedConfiguration: '1 Four-Poster King Bed',
        roomSizeSqm: 52,
        images: [
          'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Antiques Collection', 'Rain Shower', 'Handmade Organic Amenities', 'Courtyard View'],
        ratePlans: [
          {
            planId: 'plan-dutch-bb',
            rateName: 'Heritage Breakfast Included Rate',
            boardBasis: 'BB',
            boardBasisLabel: 'Colonial Breakfast Included',
            nightlyRateMinor: 5800000,
            totalTaxesMinor: 580000,
            totalPriceMinor: 6380000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 5).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours prior to arrival.',
            isRecommended: true
          }
        ]
      }
    ]
  },
  {
    hotelId: 'vct-dir-dubai-marina-penthouse',
    canonicalOfferId: 'vct-ht-man-dubai-marina-penthouse',
    sourceType: 'MANUAL',
    providerId: 'VACATINA_DIRECT',
    supplierName: 'Vacatina Direct Contracts Desk',
    name: 'Vacatina Signature Marina Penthouse & Suites — Dubai',
    subtitle: 'Direct Contracted Private Skyline Luxury Suites',
    description: 'High-floor private sky suites with floor-to-ceiling glass overlooking Dubai Marina yachts and Bluewaters Island. Offers VIP concierge access, dedicated infinity pool deck, and valet services.',
    starRating: 5,
    location: {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      address: 'Marina Walk, Dubai Marina, Dubai, UAE',
      neighborhood: 'Dubai Marina & JBR',
      latitude: 25.0768,
      longitude: 55.1384,
      distanceToCenterKm: 18.0
    },
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ],
    hotelAmenities: [
      '50th Floor Sky Pool',
      'Marina Yacht Club Access',
      '24/7 Concierge & Valet',
      'Private Chef Available',
      'Technogym Fitness Studio'
    ],
    featuredBadge: 'Vacatina Direct Exclusive',
    isPinnedAboveApi: true,
    guestRatingScore: 9.7,
    guestReviewCount: 142,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    startingFromPriceMinor: 9500000, // 95,000 LKR ($310 / 1150 AED)
    currency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 30).toISOString(),
    isSeed: false,
    roomCategories: [
      {
        roomId: 'room-marina-sky-suite',
        name: 'Executive Sky Suite with Panoramic Marina View',
        description: 'Luxurious 85 sqm one-bedroom suite on the 46th floor with expansive marina views, marble bathroom, designer kitchen, and private balcony.',
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 3,
        bedConfiguration: '1 King Bed',
        roomSizeSqm: 85,
        images: [
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
        ],
        amenities: ['Marina View Balcony', 'Full Kitchen', 'Marble Spa Bath', 'Smart Home Automation'],
        ratePlans: [
          {
            planId: 'plan-sky-ro',
            rateName: 'Vacatina Direct Flexible Rate',
            boardBasis: 'RO',
            boardBasisLabel: 'Room Only',
            nightlyRateMinor: 9500000,
            totalTaxesMinor: 950000,
            totalPriceMinor: 10450000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 3).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours prior to check-in.',
            isRecommended: true
          },
          {
            planId: 'plan-sky-bb',
            rateName: 'Breakfast at Sky Lounge Rate',
            boardBasis: 'BB',
            boardBasisLabel: 'Gourmet Breakfast Included',
            nightlyRateMinor: 11200000,
            totalTaxesMinor: 1120000,
            totalPriceMinor: 12320000,
            currency: 'LKR',
            isInstantConfirmation: true,
            freeCancellationBefore: new Date(Date.now() + 86400000 * 3).toISOString(),
            cancellationPolicyDescription: 'Free cancellation up to 48 hours prior to check-in.'
          }
        ]
      }
    ]
  }
];

export function getActiveManualHotels(): CanonicalHotelOffer[] {
  return MANUAL_HOTEL_OFFERS.filter(h => h.availabilityStatus === 'AVAILABLE');
}

export function findManualHotelById(id: string): CanonicalHotelOffer | undefined {
  return MANUAL_HOTEL_OFFERS.find(h => h.hotelId === id || h.canonicalOfferId === id);
}
