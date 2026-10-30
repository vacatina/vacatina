/* ============================================================================
 * Vacatina Canonical Supplier Flight Fixtures Dataset
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§6, §47)
 * ============================================================================ */

import type { CanonicalFlightOffer } from '../domain/flight-models.ts';
import { getAirport } from './airports.ts';

export const SUPPLIER_FLIGHT_FIXTURES: CanonicalFlightOffer[] = [
  // 1. Direct Round Trip (CMB <-> DXB Flydubai / Emirates Codeshare)
  {
    offerId: 'sup-flt-cmb-dxb-fz548',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000AkDxB548Fz',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('DXB'),
    tripType: 'round_trip',
    departureAt: '2026-11-15T02:10:00.000Z',
    arrivalAt: '2026-11-15T05:40:00.000Z',
    durationMinutes: 270,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'FZ', name: 'Flydubai' }],
    marketingCarrier: { code: 'FZ', name: 'Flydubai' },
    operatingCarrier: { code: 'FZ', name: 'Flydubai' },
    flightNumber: 'FZ548',
    aircraft: 'Boeing 737 MAX 8',
    cabinClass: 'economy',
    fareFamily: 'Value Fare',
    fareBasis: 'VLKDXB1',
    bookingClass: 'V',
    fareFamiliesAvailable: [
      {
        familyCode: 'lite',
        familyName: 'Lite',
        priceDeltaMinor: -450000,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: 'None included (Paid add-on)',
        seatSelection: 'paid',
        changeFeeDescription: 'USD 60 penalty applies',
        refundDescription: 'Strictly non-refundable',
        mealIncluded: false,
        milesEligibility: 'No miles earned'
      },
      {
        familyCode: 'value',
        familyName: 'Value',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (20 kg)',
        seatSelection: 'standard_included',
        changeFeeDescription: '1 free change up to 24h before departure',
        refundDescription: 'Refundable with voucher',
        mealIncluded: true,
        milesEligibility: '50% Skywards Miles',
        isRecommended: true
      },
      {
        familyCode: 'flex',
        familyName: 'Flex',
        priceDeltaMinor: 1100000,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (30 kg)',
        seatSelection: 'any_included',
        changeFeeDescription: 'Unlimited free date changes',
        refundDescription: 'Full refund to original payment card',
        mealIncluded: true,
        milesEligibility: '100% Skywards Miles'
      }
    ],
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 carry-on item up to 7 kg' },
      checked: { pieces: 1, maxWeightKg: 20, description: '1 standard checked bag up to 20 kg' },
      isSupplied: true
    },
    changeRules: {
      allowed: true,
      feeMinor: 750000,
      currency: 'LKR',
      description: 'Changes allowed with fee of LKR 7,500'
    },
    refundRules: {
      refundable: false,
      description: 'Non-refundable fare'
    },
    seatAvailability: 9,
    mealInformation: 'Complimentary hot wrap & soft drinks',
    price: {
      totalMinor: 9850000, // LKR 98,500
      baseFareMinor: 7200000,
      taxesMinor: 2150000,
      feesMinor: 500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 9850000
    },
    baseFare: 72000,
    taxes: 21500,
    fees: 5000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T06:10:00.000Z',
    expiresAt: '2026-10-26T07:10:00.000Z',
    travellerPricing: [
      { type: 'adult', count: 1, perPersonMinor: 9850000, totalMinor: 9850000 }
    ],
    includedServices: ['20 kg Checked Baggage', 'In-flight Snack Meal', 'Electronic Boarding Pass'],
    optionalServices: [
      {
        id: 'opt-fz-seat',
        name: 'Seat Selection',
        description: 'Choose your preferred window or aisle seat in advance',
        priceMinor: 450000,
        currency: 'LKR',
        status: 'included'
      }
    ],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('DXB'),
        departureAt: '2026-11-15T02:10:00.000Z',
        arrivalAt: '2026-11-15T05:40:00.000Z',
        durationMinutes: 270,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-fz548-out',
            marketingCarrier: { code: 'FZ', name: 'Flydubai' },
            operatingCarrier: { code: 'FZ', name: 'Flydubai' },
            flightNumber: 'FZ548',
            aircraft: 'Boeing 737 MAX 8',
            origin: getAirport('CMB'),
            destination: getAirport('DXB'),
            departureAt: '2026-11-15T02:10:00.000Z',
            arrivalAt: '2026-11-15T05:40:00.000Z',
            durationMinutes: 270,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 20, description: '1 piece (20 kg)' },
              isSupplied: true
            }
          }
        ]
      },
      {
        sliceIndex: 1,
        sliceType: 'return',
        origin: getAirport('DXB'),
        destination: getAirport('CMB'),
        departureAt: '2026-11-22T18:50:00.000Z',
        arrivalAt: '2026-11-23T01:10:00.000Z',
        durationMinutes: 260,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-fz547-ret',
            marketingCarrier: { code: 'FZ', name: 'Flydubai' },
            operatingCarrier: { code: 'FZ', name: 'Flydubai' },
            flightNumber: 'FZ547',
            aircraft: 'Boeing 737 MAX 8',
            origin: getAirport('DXB'),
            destination: getAirport('CMB'),
            departureAt: '2026-11-22T18:50:00.000Z',
            arrivalAt: '2026-11-23T01:10:00.000Z',
            durationMinutes: 260,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 20, description: '1 piece (20 kg)' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: []
  },

  // 2. 1-Stop Round Trip (CMB <-> LHR Qatar Airways via DOH)
  {
    offerId: 'sup-flt-cmb-lhr-qr665',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000AkLhr665Qr',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('LHR'),
    tripType: 'round_trip',
    departureAt: '2026-11-15T04:20:00.000Z',
    arrivalAt: '2026-11-15T13:10:00.000Z',
    durationMinutes: 710, // 11h 50m total with layover
    stopCount: 1,
    stopAirports: ['DOH'],
    airlines: [{ code: 'QR', name: 'Qatar Airways' }],
    marketingCarrier: { code: 'QR', name: 'Qatar Airways' },
    operatingCarrier: { code: 'QR', name: 'Qatar Airways' },
    flightNumber: 'QR665 / QR7',
    aircraft: 'Boeing 787-8 / Airbus A350-1000',
    cabinClass: 'economy',
    fareFamily: 'Economy Classic',
    fareBasis: 'QLKUK1',
    bookingClass: 'Q',
    fareFamiliesAvailable: [
      {
        familyCode: 'classic',
        familyName: 'Economy Classic',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '2 pieces (23 kg each)',
        seatSelection: 'standard_included',
        changeFeeDescription: 'USD 100 change penalty',
        refundDescription: 'Refundable with USD 150 cancellation charge',
        mealIncluded: true,
        milesEligibility: '75% Avios'
      },
      {
        familyCode: 'convenience',
        familyName: 'Economy Convenience',
        priceDeltaMinor: 2800000,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '2 pieces (23 kg each)',
        seatSelection: 'any_included',
        changeFeeDescription: 'Free date changes',
        refundDescription: 'Full refund to original form of payment',
        mealIncluded: true,
        milesEligibility: '100% Avios'
      }
    ],
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece up to 7 kg' },
      checked: { pieces: 2, maxWeightKg: 23, description: '2 pieces up to 23 kg each' },
      isSupplied: true
    },
    changeRules: {
      allowed: true,
      feeMinor: 2500000,
      currency: 'LKR',
      description: 'Changes permitted with LKR 25,000 fee'
    },
    refundRules: {
      refundable: true,
      feeMinor: 3800000,
      currency: 'LKR',
      description: 'Refundable with LKR 38,000 penalty'
    },
    seatAvailability: 7,
    mealInformation: 'Full dining service on both flights + snacks in transit',
    price: {
      totalMinor: 24850000, // LKR 248,500
      baseFareMinor: 17500000,
      taxesMinor: 5850000,
      feesMinor: 1500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 24850000
    },
    baseFare: 175000,
    taxes: 58500,
    fees: 15000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T06:12:00.000Z',
    expiresAt: '2026-10-26T07:12:00.000Z',
    travellerPricing: [
      { type: 'adult', count: 1, perPersonMinor: 24850000, totalMinor: 24850000 }
    ],
    includedServices: ['2 x 23 kg Checked Baggage', 'Oryx One Entertainment System', 'Doha Transit Assistance'],
    optionalServices: [],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('LHR'),
        departureAt: '2026-11-15T04:20:00.000Z',
        arrivalAt: '2026-11-15T13:10:00.000Z',
        durationMinutes: 710,
        stopCount: 1,
        segments: [
          {
            segmentId: 'seg-qr665',
            marketingCarrier: { code: 'QR', name: 'Qatar Airways' },
            operatingCarrier: { code: 'QR', name: 'Qatar Airways' },
            flightNumber: 'QR665',
            aircraft: 'Boeing 787-8',
            origin: getAirport('CMB'),
            destination: getAirport('DOH'),
            departureAt: '2026-11-15T04:20:00.000Z',
            arrivalAt: '2026-11-15T06:50:00.000Z',
            durationMinutes: 270,
            cabinClass: 'economy',
            layoverDurationMinutes: 110,
            layoverAirportCode: 'DOH',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
              checked: { pieces: 2, maxWeightKg: 23, description: '2 pieces (23 kg each)' },
              isSupplied: true
            }
          },
          {
            segmentId: 'seg-qr7',
            marketingCarrier: { code: 'QR', name: 'Qatar Airways' },
            operatingCarrier: { code: 'QR', name: 'Qatar Airways' },
            flightNumber: 'QR7',
            aircraft: 'Airbus A350-1000',
            origin: getAirport('DOH'),
            destination: getAirport('LHR'),
            departureAt: '2026-11-15T08:40:00.000Z',
            arrivalAt: '2026-11-15T13:10:00.000Z',
            durationMinutes: 330,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
              checked: { pieces: 2, maxWeightKg: 23, description: '2 pieces (23 kg each)' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: []
  },

  // 3. Direct One-Way (CMB -> SIN SriLankan Airlines)
  {
    offerId: 'sup-flt-cmb-sin-ul302',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000AkSin302Ul',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('SIN'),
    tripType: 'one_way',
    departureAt: '2026-11-18T01:10:00.000Z',
    arrivalAt: '2026-11-18T07:45:00.000Z',
    durationMinutes: 245,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'UL', name: 'SriLankan Airlines' }],
    marketingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    operatingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    flightNumber: 'UL302',
    aircraft: 'Airbus A330-300',
    cabinClass: 'economy',
    fareFamily: 'Economy Saver',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
      checked: { pieces: 1, maxWeightKg: 30, description: '1 piece (30 kg)' },
      isSupplied: true
    },
    changeRules: { allowed: true, feeMinor: 900000, currency: 'LKR', description: 'Changes allowed for LKR 9,000' },
    refundRules: { refundable: false, description: 'Non-refundable' },
    price: {
      totalMinor: 6850000, // LKR 68,500
      baseFareMinor: 4900000,
      taxesMinor: 1450000,
      feesMinor: 500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 6850000
    },
    baseFare: 49000,
    taxes: 14500,
    fees: 5000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T06:14:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 6850000, totalMinor: 6850000 }],
    includedServices: ['30 kg Checked Baggage', 'In-Flight Hot Meal'],
    fareFamiliesAvailable: [
      {
        familyCode: 'saver',
        familyName: 'Economy Saver',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (30 kg)',
        seatSelection: 'standard_included',
        changeFeeDescription: 'LKR 9,000 fee',
        refundDescription: 'Non-refundable',
        mealIncluded: true,
        milesEligibility: '50% FlySmiLes'
      }
    ],
    optionalServices: [],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('SIN'),
        departureAt: '2026-11-18T01:10:00.000Z',
        arrivalAt: '2026-11-18T07:45:00.000Z',
        durationMinutes: 245,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-ul302-out',
            marketingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
            operatingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
            flightNumber: 'UL302',
            aircraft: 'Airbus A330-300',
            origin: getAirport('CMB'),
            destination: getAirport('SIN'),
            departureAt: '2026-11-18T01:10:00.000Z',
            arrivalAt: '2026-11-18T07:45:00.000Z',
            durationMinutes: 245,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
              checked: { pieces: 1, maxWeightKg: 30, description: '1 piece (30 kg)' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: []
  },

  // 4. Business Class Luxury Offer (CMB <-> LHR SriLankan Non-Stop)
  {
    offerId: 'sup-flt-cmb-lhr-ul503-biz',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000AkLhrBiz503Ul',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('LHR'),
    tripType: 'round_trip',
    departureAt: '2026-11-15T13:05:00.000Z',
    arrivalAt: '2026-11-15T20:00:00.000Z',
    durationMinutes: 655, // 10h 55m non-stop
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'UL', name: 'SriLankan Airlines' }],
    marketingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    operatingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    flightNumber: 'UL503',
    aircraft: 'Airbus A330-300 (Lie-Flat Beds)',
    cabinClass: 'business',
    fareFamily: 'Business Value',
    fareBasis: 'JLKUKBIZ',
    bookingClass: 'J',
    fareFamiliesAvailable: [
      {
        familyCode: 'biz_value',
        familyName: 'Business Value',
        priceDeltaMinor: 0,
        cabinBaggage: '2 pieces (14 kg total)',
        checkedBaggage: '2 pieces (40 kg total)',
        seatSelection: 'any_included',
        changeFeeDescription: 'Free date change',
        refundDescription: 'Refundable with LKR 25,000 fee',
        mealIncluded: true,
        milesEligibility: '150% FlySmiLes',
        isRecommended: true
      }
    ],
    baggage: {
      cabin: { pieces: 2, maxWeightKg: 14, description: '2 carry-on pieces (14 kg total)' },
      checked: { pieces: 2, maxWeightKg: 40, description: '2 checked pieces (40 kg total)' },
      isSupplied: true
    },
    changeRules: { allowed: true, feeMinor: 0, description: 'Free date changes' },
    refundRules: { refundable: true, feeMinor: 2500000, currency: 'LKR', description: 'Refundable with LKR 25,000 fee' },
    seatAvailability: 4,
    mealInformation: 'Multi-course gourmet fine dining with champagne service',
    price: {
      totalMinor: 68500000, // LKR 685,000
      baseFareMinor: 55000000,
      taxesMinor: 11000000,
      feesMinor: 2500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 68500000
    },
    baseFare: 550000,
    taxes: 110000,
    fees: 25000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'FEW_SEATS_LEFT',
    lastCheckedAt: '2026-10-26T06:14:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 68500000, totalMinor: 68500000 }],
    includedServices: [
      'Lie-flat bed with mattress and duvet',
      'Colombo Serendib Lounge & London Heathrow Plaza Premium Lounge',
      'Priority check-in, boarding, and baggage delivery',
      '40 kg Checked Baggage'
    ],
    optionalServices: [],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'outbound',
        origin: getAirport('CMB'),
        destination: getAirport('LHR'),
        departureAt: '2026-11-15T13:05:00.000Z',
        arrivalAt: '2026-11-15T20:00:00.000Z',
        durationMinutes: 655,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-ul503-biz',
            marketingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
            operatingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
            flightNumber: 'UL503',
            aircraft: 'Airbus A330-300',
            origin: getAirport('CMB'),
            destination: getAirport('LHR'),
            departureAt: '2026-11-15T13:05:00.000Z',
            arrivalAt: '2026-11-15T20:00:00.000Z',
            durationMinutes: 655,
            cabinClass: 'business',
            baggage: {
              cabin: { pieces: 2, maxWeightKg: 14, description: '2 pieces (14 kg total)' },
              checked: { pieces: 2, maxWeightKg: 40, description: '2 pieces (40 kg total)' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: []
  },

  // 5. Multi-City Flight (CMB -> DXB -> LHR)
  {
    offerId: 'sup-flt-mc-cmb-dxb-lhr',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000AkMcDxbLhr',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('LHR'),
    tripType: 'multi_city',
    departureAt: '2026-11-15T09:45:00.000Z',
    arrivalAt: '2026-11-20T18:25:00.000Z',
    durationMinutes: 1140,
    stopCount: 1,
    stopAirports: ['DXB'],
    airlines: [{ code: 'EK', name: 'Emirates' }],
    marketingCarrier: { code: 'EK', name: 'Emirates' },
    operatingCarrier: { code: 'EK', name: 'Emirates' },
    flightNumber: 'EK651 / EK29',
    aircraft: 'Boeing 777-300ER / Airbus A380-800',
    cabinClass: 'economy',
    fareFamily: 'Multi-City Flex',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
      checked: { pieces: 1, maxWeightKg: 25, description: '1 piece (25 kg)' },
      isSupplied: true
    },
    changeRules: { allowed: true, feeMinor: 1500000, description: 'Date changes permitted' },
    refundRules: { refundable: true, feeMinor: 3000000, description: 'Refundable with penalty' },
    price: {
      totalMinor: 28500000, // LKR 285,000
      baseFareMinor: 21000000,
      taxesMinor: 6000000,
      feesMinor: 1500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 28500000
    },
    baseFare: 210000,
    taxes: 60000,
    fees: 15000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T06:14:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 28500000, totalMinor: 28500000 }],
    includedServices: ['25 kg Checked Baggage across all legs', 'Multi-city stopover allowed in Dubai'],
    fareFamiliesAvailable: [
      {
        familyCode: 'mc_flex',
        familyName: 'Multi-City Flex',
        priceDeltaMinor: 0,
        cabinBaggage: '1 piece (7 kg)',
        checkedBaggage: '1 piece (25 kg)',
        seatSelection: 'standard_included',
        changeFeeDescription: 'Free date changes',
        refundDescription: 'Refundable with fee',
        mealIncluded: true,
        milesEligibility: '100% Skywards Miles'
      }
    ],
    optionalServices: [],
    slices: [
      {
        sliceIndex: 0,
        sliceType: 'leg',
        origin: getAirport('CMB'),
        destination: getAirport('DXB'),
        departureAt: '2026-11-15T09:45:00.000Z',
        arrivalAt: '2026-11-15T13:00:00.000Z',
        durationMinutes: 285,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-mc-1',
            marketingCarrier: { code: 'EK', name: 'Emirates' },
            operatingCarrier: { code: 'EK', name: 'Emirates' },
            flightNumber: 'EK651',
            origin: getAirport('CMB'),
            destination: getAirport('DXB'),
            departureAt: '2026-11-15T09:45:00.000Z',
            arrivalAt: '2026-11-15T13:00:00.000Z',
            durationMinutes: 285,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '7 kg' },
              checked: { pieces: 1, maxWeightKg: 25, description: '25 kg' },
              isSupplied: true
            }
          }
        ]
      },
      {
        sliceIndex: 1,
        sliceType: 'leg',
        origin: getAirport('DXB'),
        destination: getAirport('LHR'),
        departureAt: '2026-11-20T14:15:00.000Z',
        arrivalAt: '2026-11-20T18:25:00.000Z',
        durationMinutes: 490,
        stopCount: 0,
        segments: [
          {
            segmentId: 'seg-mc-2',
            marketingCarrier: { code: 'EK', name: 'Emirates' },
            operatingCarrier: { code: 'EK', name: 'Emirates' },
            flightNumber: 'EK29',
            origin: getAirport('DXB'),
            destination: getAirport('LHR'),
            departureAt: '2026-11-20T14:15:00.000Z',
            arrivalAt: '2026-11-20T18:25:00.000Z',
            durationMinutes: 490,
            cabinClass: 'economy',
            baggage: {
              cabin: { pieces: 1, maxWeightKg: 7, description: '7 kg' },
              checked: { pieces: 1, maxWeightKg: 25, description: '25 kg' },
              isSupplied: true
            }
          }
        ]
      }
    ],
    segments: []
  },

  // 6. Test Scenario Offer: Price Changed Simulation (Starts at 248,500 LKR, Revalidates to 256,000 LKR)
  {
    offerId: 'sup-flt-price-changed-sim',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000PriceChangeTest',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('LHR'),
    tripType: 'round_trip',
    departureAt: '2026-11-25T04:20:00.000Z',
    arrivalAt: '2026-11-25T13:10:00.000Z',
    durationMinutes: 710,
    stopCount: 1,
    stopAirports: ['DOH'],
    airlines: [{ code: 'QR', name: 'Qatar Airways' }],
    marketingCarrier: { code: 'QR', name: 'Qatar Airways' },
    operatingCarrier: { code: 'QR', name: 'Qatar Airways' },
    flightNumber: 'QR665 / QR7',
    cabinClass: 'economy',
    fareFamily: 'Economy Classic',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
      checked: { pieces: 2, maxWeightKg: 23, description: '2 pieces (23 kg each)' },
      isSupplied: true
    },
    changeRules: { allowed: true, description: 'Changes permitted' },
    refundRules: { refundable: true, description: 'Refundable with fee' },
    price: {
      totalMinor: 24850000, // LKR 248,500 initially
      baseFareMinor: 17500000,
      taxesMinor: 5850000,
      feesMinor: 1500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 24850000
    },
    baseFare: 175000,
    taxes: 58500,
    fees: 15000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'PRICE_CHANGED',
    lastCheckedAt: '2026-10-26T05:00:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 24850000, totalMinor: 24850000 }],
    includedServices: ['2 x 23 kg Checked Bags'],
    fareFamiliesAvailable: [],
    optionalServices: [],
    slices: [],
    segments: []
  },

  // 7. Test Scenario Offer: Fare Rules Changed Simulation (revalidates to RECHECK_REQUIRED)
  {
    offerId: 'sup-flt-fare-rules-changed-sim',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000FareRulesChangedTest',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('DXB'),
    tripType: 'round_trip',
    departureAt: '2026-11-20T08:00:00.000Z',
    arrivalAt: '2026-11-20T11:30:00.000Z',
    durationMinutes: 210,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'FZ', name: 'Flydubai' }],
    marketingCarrier: { code: 'FZ', name: 'Flydubai' },
    operatingCarrier: { code: 'FZ', name: 'Flydubai' },
    flightNumber: 'FZ551',
    cabinClass: 'economy',
    fareFamily: 'Value Fare',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '1 piece (7 kg)' },
      checked: { pieces: 1, maxWeightKg: 20, description: '1 piece (20 kg)' },
      isSupplied: true
    },
    changeRules: { allowed: false, description: 'No changes permitted (simulated fare-rules change on revalidation)' },
    refundRules: { refundable: false, description: 'Non-refundable (simulated fare-rules change on revalidation)' },
    price: {
      totalMinor: 18500000,
      baseFareMinor: 13000000,
      taxesMinor: 4000000,
      feesMinor: 1500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 18500000
    },
    baseFare: 130000,
    taxes: 40000,
    fees: 15000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'AVAILABLE',
    lastCheckedAt: '2026-10-26T05:00:00.000Z',
    travellerPricing: [{ type: 'adult', count: 1, perPersonMinor: 18500000, totalMinor: 18500000 }],
    includedServices: ['1 x 20 kg Checked Bag'],
    fareFamiliesAvailable: [],
    optionalServices: [],
    slices: [],
    segments: []
  },

  // 7. Test Scenario Offer: Expired Simulation
  {
    offerId: 'sup-flt-expired-sim',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000ExpiredTest',
    status: 'expired',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('DXB'),
    tripType: 'round_trip',
    departureAt: '2026-10-20T09:45:00.000Z',
    arrivalAt: '2026-10-20T13:00:00.000Z',
    durationMinutes: 285,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'EK', name: 'Emirates' }],
    marketingCarrier: { code: 'EK', name: 'Emirates' },
    operatingCarrier: { code: 'EK', name: 'Emirates' },
    flightNumber: 'EK651',
    cabinClass: 'economy',
    fareFamily: 'Expired Saver',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '7 kg' },
      checked: { pieces: 1, maxWeightKg: 20, description: '20 kg' },
      isSupplied: true
    },
    changeRules: { allowed: false, description: 'No changes' },
    refundRules: { refundable: false, description: 'Non-refundable' },
    price: {
      totalMinor: 11500000,
      baseFareMinor: 8500000,
      taxesMinor: 2000000,
      feesMinor: 1000000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 11500000
    },
    baseFare: 85000,
    taxes: 20000,
    fees: 10000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'EXPIRED',
    lastCheckedAt: '2026-10-20T00:00:00.000Z',
    expiresAt: '2026-10-21T00:00:00.000Z',
    travellerPricing: [],
    includedServices: [],
    fareFamiliesAvailable: [],
    optionalServices: [],
    slices: [],
    segments: []
  },

  // 8. Test Scenario Offer: Unavailable / Sold Out Simulation
  {
    offerId: 'sup-flt-unavailable-sim',
    sourceType: 'supplier_api',
    sourceProvider: 'Supplier GDS / NDC Gateway',
    supplierId: 'sup-duffel-sandbox',
    sourceOfferId: 'off_0000SoldOutTest',
    status: 'active',
    bookability: 'live_bookable',
    origin: getAirport('CMB'),
    destination: getAirport('MLE'),
    tripType: 'round_trip',
    departureAt: '2026-12-25T11:30:00.000Z',
    arrivalAt: '2026-12-25T12:55:00.000Z',
    durationMinutes: 85,
    stopCount: 0,
    stopAirports: [],
    airlines: [{ code: 'UL', name: 'SriLankan Airlines' }],
    marketingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    operatingCarrier: { code: 'UL', name: 'SriLankan Airlines' },
    flightNumber: 'UL101',
    cabinClass: 'economy',
    fareFamily: 'Sold Out Peak',
    baggage: {
      cabin: { pieces: 1, maxWeightKg: 7, description: '7 kg' },
      checked: { pieces: 1, maxWeightKg: 30, description: '30 kg' },
      isSupplied: true
    },
    changeRules: { allowed: false, description: 'N/A' },
    refundRules: { refundable: false, description: 'N/A' },
    price: {
      totalMinor: 9500000,
      baseFareMinor: 7000000,
      taxesMinor: 2000000,
      feesMinor: 500000,
      currency: 'LKR',
      displayCurrency: 'LKR',
      perAdultMinor: 9500000
    },
    baseFare: 70000,
    taxes: 20000,
    fees: 5000,
    currency: 'LKR',
    displayCurrency: 'LKR',
    availabilityStatus: 'UNAVAILABLE',
    seatAvailability: 0,
    lastCheckedAt: '2026-10-26T06:15:00.000Z',
    travellerPricing: [],
    includedServices: [],
    fareFamiliesAvailable: [],
    optionalServices: [],
    slices: [],
    segments: []
  }
];
