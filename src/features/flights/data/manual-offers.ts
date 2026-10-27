/* ============================================================================
 * Vacatina Canonical Manual Flight Inventory Dataset
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§4, §5, §18)
 * ============================================================================ */

import type { CanonicalFlightOffer } from '../domain/flight-models.ts';
import { getAirport } from './airports.ts';

export const MANUAL_FLIGHT_OFFERS: CanonicalFlightOffer[] = [
  // 1. Informational Promotional Fare (CMB -> DXB Emirates Special)
  {
    offerId: 'man-flt-cmb-dxb-ek651',
    sourceType: 'manual',
    sourceProvider: 'Vacatina Commercial Promotions Desk',
    supplierId: 'sup-vacatina-manual-promo',
    sourceOfferId: 'promo-cmb-dxb-2026-q4',
    status: 'active',
    bookability: 'informational',
    origin: getAirport('CMB'),
    destination: getAirport('DXB'),
    tripType: 'round_trip',
    departureAt: '2026-11-15T09:45:00.000Z',
    arrivalAt: '2026-11-15T13:00:00.000Z',
    durationMinutes: 285, // 4h 45m
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'EK', name: 'Emirates' }],
    marketingCarrier: { code: 'EK', name: 'Emirates' },
    operatingCarrier: { code: 'EK', name: 'Emirates' },
    flightNumber: 'EK651',
    aircraft: 'Boeing 777-300ER',
    cabinClass: 'economy',
    fareFamily: 'Promotional Saver',
    fareBasis: 'SPROMO1LK',
    bookingClass: 'T',
    fareFamiliesAvailable: [
      {
        familyCode: 'promo_saver',
        familyName: 'Promotional Saver',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (20 kg)',
        seatSelection: 'paid',
        changeFeeDescription: 'USD 50 change penalty applies',
        refundDescription: 'Non-refundable fare condition',
        mealIncluded: true,
        milesEligibility: '50% Skywards Miles',
        isRecommended: true
      },
      {
        familyCode: 'promo_flex',
        familyName: 'Promotional Flex',
        priceDeltaMinor: 1450000, // +14,500 LKR
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '2 pieces (30 kg total)',
        seatSelection: 'standard_included',
        changeFeeDescription: 'Free date change up to 48h prior',
        refundDescription: 'Refundable with USD 75 administrative deduction',
        mealIncluded: true,
        milesEligibility: '100% Skywards Miles'
      }
    ],
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on piece up to 7 kg' },
      checked: { pieces: 1, maxWeightKg: 20, description: '1 standard checked bag up to 20 kg' },
      isSupplied: true,
      notes: 'Standard baggage allowance per passenger'
    },
    changeRules: {
      allowed: true,
      feeMinor: 1500000,
      currency: 'LKR',
      description: 'Changes permitted with LKR 15,000 fee plus fare difference'
    },
    refundRules: {
      refundable: false,
      description: 'Promotional fare is non-refundable upon cancellation'
    },
    seatAvailability: 4,
    mealInformation: 'Complimentary halal hot meal & refreshments included',
    price: {
      totalMinor: 12450000, // LKR 124,500
      baseFareMinor: 8900000,
      taxesMinor: 2550000,
      feesMinor: 1000000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 12450000
    },
    baseFare: 89000,
    taxes: 25500,
    fees: 10000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T06:00:00.000Z',
    travellerPricing: [
      { type: 'adult', count: 1, perPersonMinor: 12450000, totalMinor: 12450000 }
    ],
    includedServices: [
      'In-flight entertainment screen with ice system',
      'Complimentary multi-course meal',
      'Standard 20 kg checked baggage'
    ],
    optionalServices: [
      {
        id: 'opt-ek-seat',
        name: 'Extra Legroom Seat Selection',
        description: 'Exit row or bulkhead seat selection with 34-inch pitch',
        priceMinor: 950000,
        currency: 'LKR',
        status: 'available_later'
      },
      {
        id: 'opt-ek-lounge',
        name: 'Dubai Marhaba Lounge Access (4 Hours)',
        description: 'T3 transit lounge with buffet and shower facilities',
        priceMinor: 1650000,
        currency: 'LKR',
        status: 'available_later'
      }
    ],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('DXB'),
        departureAt: '2026-11-15T09:45:00.000Z',
        arrivalAt: '2026-11-15T13:00:00.000Z',
        durationMinutes: 285,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-ek651-out',
            marketingCarrier: { code: 'EK', name: 'Emirates' },
            operatingCarrier: { code: 'EK', name: 'Emirates' },
            flightNumber: 'EK651',
            aircraft: 'Boeing 777-300ER',
            origin: getAirport('CMB'),
            destination: getAirport('DXB'),
            departureAt: '2026-11-15T09:45:00.000Z',
            arrivalAt: '2026-11-15T13:00:00.000Z',
            durationMinutes: 285,
            cabinClass: 'economy',
            bookingClass: 'T',
            fareBasis: 'SPROMO1LK',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 20, description: '1 checked piece (20 kg)' },
              isSupplied: true
            },
            mealInformation: 'Hot meal & beverage service'
          }
        ]
      },
      {
        sliceIndex: 1,
        sliceType: 'return',
        origin: getAirport('DXB'),
        destination: getAirport('CMB'),
        departureAt: '2026-11-22T02:40:00.000Z',
        arrivalAt: '2026-11-22T08:35:00.000Z',
        durationMinutes: 265,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-ek650-ret',
            marketingCarrier: { code: 'EK', name: 'Emirates' },
            operatingCarrier: { code: 'EK', name: 'Emirates' },
            flightNumber: 'EK650',
            aircraft: 'Boeing 777-300ER',
            origin: getAirport('DXB'),
            destination: getAirport('CMB'),
            departureAt: '2026-11-22T02:40:00.000Z',
            arrivalAt: '2026-11-22T08:35:00.000Z',
            durationMinutes: 265,
            cabinClass: 'economy',
            bookingClass: 'T',
            fareBasis: 'SPROMO1LK',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 20, description: '1 checked piece (20 kg)' },
              isSupplied: true
            },
            mealInformation: 'Hot breakfast service'
          }
        ]
      }
    ],
    segments: [],
    manualInventoryMetadata: {
      commercialState: 'informational',
      campaignCode: 'DXB-AUTUMN-2026',
      contactDeskNote: 'Special negotiated promotional fare published via Vacatina Marketing Desk.'
    }
  },

  // 2. Request-To-Book Special Negotiated Fare (CMB -> MLE Maldivian Island Shuttle)
  {
    offerId: 'man-flt-cmb-mle-q2701',
    sourceType: 'manual',
    sourceProvider: 'Vacatina Maldives Concierge Desk',
    supplierId: 'sup-vacatina-mle-allotment',
    sourceOfferId: 'allot-mle-q4-001',
    status: 'active',
    bookability: 'request_to_book',
    origin: getAirport('CMB'),
    destination: getAirport('MLE'),
    tripType: 'round_trip',
    departureAt: '2026-11-20T11:30:00.000Z',
    arrivalAt: '2026-11-20T12:55:00.000Z',
    durationMinutes: 85,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'Q2', name: 'Maldivian' }],
    marketingCarrier: { code: 'Q2', name: 'Maldivian' },
    operatingCarrier: { code: 'Q2', name: 'Maldivian' },
    flightNumber: 'Q2701',
    aircraft: 'Airbus A320',
    cabinClass: 'economy',
    fareFamily: 'Resort Negotiated Shuttle',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on piece (7 kg)' },
      checked: { pieces: 1, maxWeightKg: 30, description: '1 checked bag up to 30 kg for dive gear' },
      isSupplied: true,
      notes: 'Includes generous dive/surf luggage allowance'
    },
    changeRules: {
      allowed: true,
      description: 'Changes permitted with concierge re-issuance fee'
    },
    refundRules: {
      refundable: true,
      feeMinor: 1000000,
      currency: 'LKR',
      description: 'Refundable up to 72 hours prior with LKR 10,000 cancellation fee'
    },
    price: {
      totalMinor: 7800000, // LKR 78,000
      baseFareMinor: 5500000,
      taxesMinor: 1800000,
      feesMinor: 500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 7800000
    },
    baseFare: 55000,
    taxes: 18000,
    fees: 5000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'ON_REQUEST',
    lastCheckedAt: '2026-10-26T06:00:00.000Z',
    travellerPricing: [
      { type: 'adult', count: 1, perPersonMinor: 7800000, totalMinor: 7800000 }
    ],
    includedServices: [
      'Direct island hopper non-stop service',
      '30 kg generous baggage allowance for resort vacationers'
    ],
    fareFamiliesAvailable: [
      {
        familyCode: 'island_standard',
        familyName: 'Resort Negotiated Shuttle',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (30 kg)',
        seatSelection: 'standard_included',
        changeFeeDescription: 'LKR 8,000 change fee',
        refundDescription: 'Refundable with LKR 10,000 cancellation fee',
        mealIncluded: true,
        milesEligibility: 'None'
      }
    ],
    optionalServices: [],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('MLE'),
        departureAt: '2026-11-20T11:30:00.000Z',
        arrivalAt: '2026-11-20T12:55:00.000Z',
        durationMinutes: 85,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-q2701-out',
            marketingCarrier: { code: 'Q2', name: 'Maldivian' },
            operatingCarrier: { code: 'Q2', name: 'Maldivian' },
            flightNumber: 'Q2701',
            origin: getAirport('CMB'),
            destination: getAirport('MLE'),
            departureAt: '2026-11-20T11:30:00.000Z',
            arrivalAt: '2026-11-20T12:55:00.000Z',
            durationMinutes: 85,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 30, description: '1 checked piece (30 kg)' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: [],
    manualInventoryMetadata: {
      commercialState: 'request_to_book',
      campaignCode: 'MLE-RESORT-NEGOTIATED',
      quotaRemaining: 8,
      contactDeskNote: 'Dedicated resort allotment held under Vacatina Maldives contract.'
    }
  },

  // 3. Paused / Inactive Manual Offer (Testing Paused Handling)
  {
    offerId: 'man-flt-cmb-sin-sq469-paused',
    sourceType: 'manual',
    sourceProvider: 'Vacatina Singapore Group Desk',
    supplierId: 'sup-vacatina-sin-allotment',
    sourceOfferId: 'group-sin-2026-paused',
    status: 'paused',
    bookability: 'request_to_book',
    origin: getAirport('CMB'),
    destination: getAirport('SIN'),
    tripType: 'round_trip',
    departureAt: '2026-12-01T00:50:00.000Z',
    arrivalAt: '2026-12-01T07:25:00.000Z',
    durationMinutes: 245,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'SQ', name: 'Singapore Airlines' }],
    marketingCarrier: { code: 'SQ', name: 'Singapore Airlines' },
    operatingCarrier: { code: 'SQ', name: 'Singapore Airlines' },
    flightNumber: 'SQ469',
    cabinClass: 'economy',
    fareFamily: 'Group Allotment (Paused)',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '7 kg' },
      checked: { pieces: 1, maxWeightKg: 25, description: '25 kg' },
      isSupplied: true
    },
    changeRules: { allowed: false, description: 'No changes' },
    refundRules: { refundable: false, description: 'Non-refundable' },
    price: {
      totalMinor: 14200000,
      baseFareMinor: 10500000,
      taxesMinor: 2700000,
      feesMinor: 1000000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 14200000
    },
    baseFare: 105000,
    taxes: 27000,
    fees: 10000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'UNAVAILABLE',
    lastCheckedAt: '2026-10-26T06:00:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 14200000, totalMinor: 14200000 }],
    includedServices: [],
    fareFamiliesAvailable: [],
    optionalServices: [],
    slices: [],
    segments: [],
    manualInventoryMetadata: {
      commercialState: 'request_to_book',
      contactDeskNote: 'Temporarily paused due to contract renegotiation.'
    }
  }
];

export function getActiveManualOffers(): CanonicalFlightOffer[] {
  return MANUAL_FLIGHT_OFFERS.filter(o => o.status === 'active');
}
