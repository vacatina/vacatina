import type { CanonicalOfferEntity } from '../inventory/types.ts';

/** Explicit customer projection: never leak cost, margins, contract evidence or supplier payloads. */
export function customerOffer(offer: CanonicalOfferEntity) {
  const envelope = offer.productExtension as Record<string, any> | undefined;
  const nestedKey = ({flights:'flight',hotels:'hotel',visa:'visa',packages:'package',cars:'carTransfer',rails:'rail',cruises:'cruise',activities:'activity',sightseeing:'sightseeing',insurance:'insurance'} as any)[offer.productType];
  const extension = envelope ? { ...envelope, ...(envelope[nestedKey] || {}) } : undefined;
  const allowed = ['productType','fareFamily','cabinClass','ticketingDeadlineIso','isRefundable','isChangeable','baggageAllowance','segments','starRating','roomType','bedConfiguration','boardBasis','maxOccupancy','ratePlanCode','checkInTime','checkOutTime','cancellationDeadlineIso','amenities','hotelChain','vehicleCategory','vehicleModel','driverType','transmission','passengerCapacity','luggageCapacity','pickupLocation','dropoffLocation','mileagePolicy','hasMeetAndGreet','includesFuelAndTolls','cruiseLine','shipName','sailingDurationNights','cabinGrade','embarkationPort','disembarkationPort','portsOfCall','diningSeating','includesPortChargesAndGratuities','trainOperator','trainNumber','originStation','destinationStation','departureTimeIso','arrivalTimeIso','travelClass','hasSeatReservation','isFlexibleFare','durationHours','scheduledDateTimeIso','timeSlot','meetingPointAddress','maxGroupSize','languageOptions','minimumAgeYears','physicalFitnessLevel','tourType','guideLanguage','hasSkipTheLine','includesMonumentAdmissions','transportType','itineraryHighlights','itinerary','dayByDayItinerary','days','durationDays','durationNights','timeSlots','roomTypes','boardBasisOptions','cabinCategories','languages','requirements','documentChecklist','processingDays','validityDays','entries','purpose','policyUrl','policyWordingUrl','coverage','exclusions','eligibility','underwriter','minimumAge','maximumAge','benefits'];
  const productExtension = extension ? Object.fromEntries(allowed.filter(key => key in extension).map(key => [key, extension[key]])) : undefined;
  const minor = offer.pricing.finalSellingPriceMinor;
  return {
    canonicalOfferId: offer.canonicalOfferId, offerId: offer.canonicalOfferId,
    productType: offer.productType, title: offer.title, subtitle: offer.subtitle,
    location: offer.location, pricing: { finalSellingPriceMinor: minor, currency: offer.pricing.currency },
    sellingPrice: minor / 100, price: minor / 100, currency: offer.pricing.currency,
    displayCurrency: offer.pricing.currency, availabilityStatus: offer.availabilityStatus,
    bookingMode: offer.bookingMode, confirmationMode: offer.confirmationMode,
    sellable: offer.sellability === 'BOOKABLE', offerExpiresAt: offer.freshness?.expiresAtIso || offer.expiresAt || offer.validUntil,
    lastCheckedAt: offer.freshness?.lastCheckedAtIso || offer.lastCheckedAt,
    inclusions: offer.inclusions, exclusions: offer.exclusions,
    cancellationPolicy: offer.cancellationPolicy, productExtension
  };
}
