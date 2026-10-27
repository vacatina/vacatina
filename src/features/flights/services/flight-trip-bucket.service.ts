/* ============================================================================
 * Vacatina Flight Trip Bucket Integration Service
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§26, §27)
 * ============================================================================ */

import type {
  TripBucketCandidate,
  TripBucketItemState
} from '../../../lib/domain/types.ts';
import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';
import type { CanonicalFlightOffer } from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightRevalidationResult,
  FlightSearchRequest
} from '../domain/search-models.ts';
import { flightSearchService } from './flight-search.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';

export class FlightTripBucketService {
  /**
   * Transforms a Canonical Flight Offer and its configuration into a Trip Bucket Candidate,
   * enforcing the canonical 8-state engine.
   */
  public mapFlightOfferToTripCandidate(
    offer: CanonicalFlightOffer,
    config?: FlightConfigurationSelection,
    searchContext?: Partial<FlightSearchRequest>,
    overrideState?: TripBucketItemState
  ): TripBucketCandidate {
    // 1. Calculate final price (including selected fare family delta)
    let finalPriceMinor = offer.price.totalMinor;
    let selectedFamilyName = offer.fareFamily;

    if (config?.selectedFareFamilyCode && offer.fareFamiliesAvailable) {
      const family = offer.fareFamiliesAvailable.find(
        f => f.familyCode === config.selectedFareFamilyCode
      );
      if (family) {
        finalPriceMinor += family.priceDeltaMinor;
        selectedFamilyName = family.familyName;
      }
    }

    const priceLkr = Math.round(finalPriceMinor / 100);

    // 2. Format Route & Dates summary
    const originCode = offer.origin.airportCode;
    const destCode = offer.destination.airportCode;
    const title = `${offer.marketingCarrier.name}: ${originCode} → ${destCode}`;

    const depDate = offer.departureAt ? offer.departureAt.split('T')[0] : '2026-11-15';
    const retDate =
      offer.slices && offer.slices.length > 1 && offer.slices[1].departureAt
        ? offer.slices[1].departureAt.split('T')[0]
        : undefined;

    const dateSummary =
      offer.tripType === 'round_trip' && retDate
        ? `${depDate} — ${retDate} (${offer.flightNumber})`
        : `${depDate} · ${offer.flightNumber} (${offer.cabinClass})`;

    // 3. Format Traveller summary
    const adults = searchContext?.travellers?.adults ?? 1;
    const children = searchContext?.travellers?.children ?? 0;
    const infants = searchContext?.travellers?.infants ?? 0;
    let travellerSummary = `${adults} Adult${adults > 1 ? 's' : ''}`;
    if (children > 0) travellerSummary += ` · ${children} Child${children > 1 ? 'ren' : ''}`;
    if (infants > 0) travellerSummary += ` · ${infants} Infant${infants > 1 ? 's' : ''}`;
    travellerSummary += ` · ${offer.cabinClass.charAt(0).toUpperCase() + offer.cabinClass.slice(1)}`;

    const subtitle = `${selectedFamilyName} · ${offer.stopCount === 0 ? 'Non-Stop' : `${offer.stopCount} Stop`} · ${Math.floor(offer.durationMinutes / 60)}h ${offer.durationMinutes % 60}m`;

    // 4. Derive Trip Bucket Item State
    let state: TripBucketItemState = overrideState || 'ready';
    let holdStatusText = 'Fare held for 15 minutes upon confirmation';
    let actionRequiredText: string | undefined;
    let primaryActionLabel = 'Modify Flight';

    if (overrideState) {
      state = overrideState;
    } else if (offer.availabilityStatus === 'PRICE_CHANGED') {
      state = 'price_changed';
      actionRequiredText = 'Upstream fare adjusted by carrier';
      primaryActionLabel = 'Accept New Price';
      holdStatusText = 'Fare adjustment pending traveler review';
    } else if (offer.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
      actionRequiredText = 'Offer expired upstream';
      primaryActionLabel = 'Find New Flight';
      holdStatusText = 'Expired';
    } else if (offer.availabilityStatus === 'UNAVAILABLE') {
      state = 'unavailable';
      actionRequiredText = 'Seats sold out';
      primaryActionLabel = 'Choose Alternative';
      holdStatusText = 'Sold out';
    } else if (offer.bookability === 'request_to_book') {
      state = 'needs_action';
      actionRequiredText = 'Vacatina Concierge desk allocation confirmation required';
      primaryActionLabel = 'Request Desk Confirmation';
      holdStatusText = 'Allocation on-request';
    } else if (offer.bookability === 'informational') {
      state = 'needs_action';
      actionRequiredText = 'Promotional fare availability check required';
      primaryActionLabel = 'Verify Fare Availability';
      holdStatusText = 'Promotional fare';
    } else if (!config?.selectedFareFamilyCode && offer.fareFamiliesAvailable && offer.fareFamiliesAvailable.length > 1) {
      state = 'needs_action';
      actionRequiredText = 'Select preferred fare family (Lite / Classic / Flex)';
      primaryActionLabel = 'Select Fare';
    }

    return {
      id: `tb-${offer.offerId}`,
      productType: 'flights',
      productLabel: 'Flight',
      title,
      subtitle,
      dateSummary,
      travellerSummary,
      state,
      priceLkr,
      previousPriceLkr: state === 'price_changed' ? Math.round(offer.price.baseFareMinor / 100) : undefined,
      holdStatusText,
      actionRequiredText,
      primaryActionLabel,
      supplierName: offer.marketingCarrier.name,
      integrationMode: offer.sourceType === 'supplier_api' ? 'ADAPTER-READY' : 'MOCK',
      offerId: offer.offerId,
      sourceType: offer.sourceType.toUpperCase(),
      confirmationMode:
        offer.bookability === 'live_bookable'
          ? 'INSTANT_CONFIRM'
          : offer.bookability === 'request_to_book'
          ? 'REQUEST_TO_CONFIRM'
          : 'ASSISTED_SERVICE',
      rawSupplierPrice: priceLkr,
      supplierBaseCurrency: offer.price.currency,
      markupAmountLkr: 0
    };
  }

  /**
   * Adds or stages a flight offer into the Trip Bucket.
   */
  public addFlightToTripBucket(
    offer: CanonicalFlightOffer,
    config?: FlightConfigurationSelection,
    searchContext?: Partial<FlightSearchRequest>,
    overrideState?: TripBucketItemState
  ): TripBucketCandidate {
    const candidate = this.mapFlightOfferToTripCandidate(offer, config, searchContext, overrideState);
    tripBucketService.stageCandidate(candidate);

    telemetry.track('flight_added_to_trip', {
      offerId: offer.offerId,
      sourceType: offer.sourceType,
      carrier: offer.marketingCarrier.code,
      state: candidate.state,
      priceLkr: candidate.priceLkr
    });

    return candidate;
  }

  /**
   * Executes price revalidation on a flight candidate already in the Trip Bucket.
   */
  public async revalidateFlightInTripBucket(
    candidateId: string,
    offerId: string
  ): Promise<FlightRevalidationResult> {
    const currentItems = tripBucketService.getItems();
    const existing = currentItems.find(i => i.id === candidateId);

    if (existing) {
      // Transition to refreshing_price
      existing.state = 'refreshing_price';
      existing.holdStatusText = 'Rechecking live airline seat availability & fare rules…';
      tripBucketService.stageCandidate(existing);
    }

    telemetry.track('flight_revalidation_started', { candidateId, offerId });

    const result = await flightSearchService.revalidateOffer(offerId);

    if (!existing) return result;

    if (result.status === 'UNCHANGED') {
      existing.state = 'ready';
      existing.holdStatusText = 'Fare held for 15 minutes upon confirmation';
      existing.actionRequiredText = undefined;
      existing.primaryActionLabel = 'Modify Flight';
      tripBucketService.stageCandidate(existing);
    } else if (result.status === 'PRICE_CHANGED') {
      existing.state = 'price_changed';
      existing.previousPriceLkr = existing.priceLkr;
      existing.priceLkr = Math.round(result.newPriceMinor / 100);
      existing.holdStatusText = 'Price updated by airline';
      existing.actionRequiredText = result.message;
      existing.primaryActionLabel = 'Accept Price & Proceed';
      tripBucketService.stageCandidate(existing);
      telemetry.track('flight_price_changed', { candidateId, delta: result.priceDeltaMinor });
    } else if (result.status === 'OFFER_EXPIRED') {
      existing.state = 'offer_expired';
      existing.holdStatusText = 'Fare offer expired';
      existing.actionRequiredText = result.message;
      existing.primaryActionLabel = 'Search Current Flights';
      tripBucketService.stageCandidate(existing);
      telemetry.track('flight_offer_expired', { candidateId });
    } else if (result.status === 'UNAVAILABLE') {
      existing.state = 'unavailable';
      existing.holdStatusText = 'Flight no longer available';
      existing.actionRequiredText = result.message;
      existing.primaryActionLabel = 'Select Alternative';
      tripBucketService.stageCandidate(existing);
    }

    return result;
  }
}

export const flightTripBucketService = new FlightTripBucketService();
