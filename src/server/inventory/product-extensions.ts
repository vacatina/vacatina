/* ============================================================================
 * Vacatina Product-Specific Extension Schemas across All 10 Travel Products
 * Authority: docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md
 *            ADR-008 & Core Backend Architecture Contract
 * ============================================================================ */

import type { TravelProductSlug } from './types.ts';

// ----------------------------------------------------------------------------
// 1. Flights Product Extension
// ----------------------------------------------------------------------------
export interface FlightSegmentEntity {
  segmentId: string;
  carrierCode: string;       // e.g. "UL", "EK", "QR"
  carrierName: string;
  flightNumber: string;      // e.g. "UL-225"
  aircraftModel?: string;    // e.g. "Airbus A330-300"
  originIata: string;        // e.g. "CMB"
  originTerminal?: string;
  destinationIata: string;   // e.g. "DXB"
  destinationTerminal?: string;
  departureTimeIso: string;
  arrivalTimeIso: string;
  durationMinutes: number;
  layoverMinutes?: number;
}

export interface FlightProductExtension {
  fareFamily: string;        // e.g. "Value", "Classic", "Flex"
  cabinClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  ticketingDeadlineIso: string;
  isRefundable: boolean;
  isChangeable: boolean;
  baggageAllowance: {
    cabinBaggageKg: number;
    checkedBaggageKg: number;
    pieceCount?: number;
  };
  segments: FlightSegmentEntity[];
}

// ----------------------------------------------------------------------------
// 2. Hotels Product Extension
// ----------------------------------------------------------------------------
export interface HotelProductExtension {
  starRating: number;        // 1 to 5
  roomType: string;          // e.g. "Deluxe Ocean View King"
  bedConfiguration: string;  // e.g. "1 King Bed or 2 Twin Beds"
  boardBasis: 'RO' | 'BB' | 'HB' | 'FB' | 'AI'; // Room Only, Breakfast, Half Board, Full Board, All Inclusive
  maxOccupancy: {
    maxAdults: number;
    maxChildren: number;
    maxGuests: number;
  };
  ratePlanCode: string;
  checkInTime: string;       // e.g. "14:00"
  checkOutTime: string;      // e.g. "12:00"
  cancellationDeadlineIso?: string;
  amenities: string[];
  hotelChain?: string;
}

// ----------------------------------------------------------------------------
// 3. Cars & Transfers Product Extension
// ----------------------------------------------------------------------------
export interface CarTransferProductExtension {
  vehicleCategory: 'ECONOMY' | 'COMPACT' | 'SUV' | 'PREMIUM' | 'VAN' | 'LUXURY';
  vehicleModel: string;      // e.g. "Mercedes V-Class", "Toyota Prius"
  driverType: 'SELF_DRIVE' | 'CHAUFFEUR';
  transmission: 'AUTOMATIC' | 'MANUAL';
  passengerCapacity: number;
  luggageCapacity: number;
  pickupLocation: {
    type: 'AIRPORT' | 'HOTEL' | 'CITY_CENTER';
    name: string;
    code?: string;
  };
  dropoffLocation: {
    type: 'AIRPORT' | 'HOTEL' | 'CITY_CENTER';
    name: string;
    code?: string;
  };
  mileagePolicy: 'UNLIMITED' | 'LIMITED';
  hasMeetAndGreet: boolean;
  includesFuelAndTolls: boolean;
}

// ----------------------------------------------------------------------------
// 4. Cruises Product Extension
// ----------------------------------------------------------------------------
export interface CruisePortCallEntity {
  dayNumber: number;
  portName: string;
  country: string;
  arrivalTime?: string;
  departureTime?: string;
}

export interface CruiseProductExtension {
  cruiseLine: string;        // e.g. "Royal Caribbean", "Celebrity"
  shipName: string;          // e.g. "Icon of the Seas"
  sailingDurationNights: number;
  cabinGrade: 'INSIDE' | 'OCEAN_VIEW' | 'BALCONY' | 'SUITE';
  cabinNumber?: string;
  embarkationPort: string;
  disembarkationPort: string;
  portsOfCall: CruisePortCallEntity[];
  diningSeating?: 'EARLY' | 'LATE' | 'OPEN';
  includesPortChargesAndGratuities: boolean;
}

// ----------------------------------------------------------------------------
// 5. Rails Product Extension
// ----------------------------------------------------------------------------
export interface RailProductExtension {
  trainOperator: string;     // e.g. "Eurostar", "SNCF", "Sri Lanka Railways"
  trainNumber: string;       // e.g. "EST-9024"
  originStation: string;     // e.g. "London St Pancras"
  destinationStation: string;// e.g. "Paris Gare du Nord"
  departureTimeIso: string;
  arrivalTimeIso: string;
  travelClass: 'STANDARD' | 'FIRST' | 'BUSINESS_QUIET';
  hasSeatReservation: boolean;
  assignedCarriage?: string;
  assignedSeat?: string;
  isFlexibleFare: boolean;
}

// ----------------------------------------------------------------------------
// 6. Activities Product Extension
// ----------------------------------------------------------------------------
export interface ActivityProductExtension {
  activityCode: string;
  durationHours: number;
  scheduledDateTimeIso: string;
  timeSlot?: string;         // e.g. "09:00 - 13:00"
  meetingPointAddress: string;
  maxGroupSize?: number;
  languageOptions: string[];
  minimumAgeYears?: number;
  physicalFitnessLevel: 'EASY' | 'MODERATE' | 'CHALLENGING';
}

// ----------------------------------------------------------------------------
// 7. Sightseeing Product Extension
// ----------------------------------------------------------------------------
export interface SightseeingProductExtension {
  tourCode: string;
  tourType: 'PRIVATE' | 'SHARED_GROUP';
  guideLanguage: string;
  hasSkipTheLine: boolean;
  includesMonumentAdmissions: boolean;
  transportType: 'WALKING' | 'AIR_CONDITIONED_COACH' | 'PRIVATE_CAR';
  itineraryHighlights: string[];
}

// ----------------------------------------------------------------------------
// 8. Insurance Product Extension
// ----------------------------------------------------------------------------
export interface InsuranceProductExtension {
  underwriterName: string;   // e.g. "Allianz Partners"
  planTier: 'SILVER' | 'GOLD' | 'PLATINUM';
  coverageRegion: 'WORLDWIDE' | 'SCHENGEN' | 'ASIA_PACIFIC' | 'DOMESTIC';
  emergencyMedicalLimitMinor: number;
  tripCancellationLimitMinor: number;
  baggageDelayLimitMinor: number;
  preExistingConditionsCovered: boolean;
  policyWordingUrl: string;
  coolingOffPeriodDays: number;
}

// ----------------------------------------------------------------------------
// 9. Visa Assistance Product Extension
// ----------------------------------------------------------------------------
export interface VisaProductExtension {
  destinationCountry: string;// e.g. "United Arab Emirates", "United Kingdom"
  visaType: 'TOURIST_EVISA' | 'STICKER_VISA' | 'BUSINESS_VISA' | 'TRANSIT';
  eligibleNationality: string;
  residenceCountry: string;
  processingSlaBusinessDays: number;
  embassyFeeMinor: number;
  vacatinaServiceFeeMinor: number;
  documentChecklist: string[];
  submissionMethod: 'ONLINE_PORTAL' | 'VFS_APPOINTMENT' | 'EMBASSY_INTERVIEW';
}

// ----------------------------------------------------------------------------
// 10. Holiday Packages Product Extension
// ----------------------------------------------------------------------------
export interface PackageDayItineraryEntity {
  dayNumber: number;
  title: string;
  description: string;
  mealsIncluded: string[];   // e.g. ["Breakfast", "Dinner"]
  activityHighlights: string[];
}

export interface PackageProductExtension {
  itineraryDays: number;
  itineraryNights: number;
  packageTheme: string;      // e.g. "Cultural Heritage", "Romantic Honeymoon"
  includedComponents: Array<'FLIGHT' | 'HOTEL' | 'TRANSFERS' | 'ACTIVITIES' | 'VISA' | 'INSURANCE'>;
  dayByDayItinerary: PackageDayItineraryEntity[];
  singleSupplementMinor?: number;
  minGroupSize?: number;
}

// ----------------------------------------------------------------------------
// Discriminated Product Extension Union
// ----------------------------------------------------------------------------
export type ProductExtension =
  | { productType: 'flights'; flight: FlightProductExtension }
  | { productType: 'hotels'; hotel: HotelProductExtension }
  | { productType: 'cars'; car: CarTransferProductExtension }
  | { productType: 'cruises'; cruise: CruiseProductExtension }
  | { productType: 'rails'; rail: RailProductExtension }
  | { productType: 'activities'; activity: ActivityProductExtension }
  | { productType: 'sightseeing'; sightseeing: SightseeingProductExtension }
  | { productType: 'insurance'; insurance: InsuranceProductExtension }
  | { productType: 'visa'; visa: VisaProductExtension }
  | { productType: 'packages'; package: PackageProductExtension };
