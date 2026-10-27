/* ============================================================================
 * Vacatina Flight Trip Bucket Integration Service
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§26, §27)
 * Phase 5: demo fixtures and manual inventory are never promoted to Ready by a
 * local revalidation. Only a desk-confirmed allocation may do that.
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
import { resolveFlightInventoryTruth } from '../domain/flight-inventory-truth.ts';
import { flightSearchService } from './flight-search.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';

export class FlightTripBucketService {
  private lastSearchContext: FlightSearchRequest | null = null;

  /** Keeps the current search context available to offer detail and review views. */
  public rememberSearchContext(request: FlightSearchRequest): void {
    this.lastSearchContext = {
      ...request,
      origin: { ...request.origin },
      destination: { ...request.destination },
      travellers: { ...request.travellers }
    };
  }

  public getLastSearchContext(): FlightSearchRequest | null {
    return this.lastSearchContext
      ? {
          ...this.lastSearchContext,
          origin: { ...this.lastSearchContext.origin },
          destination: { ...this.lastSearchContext.destination },
          travellers: { ...this.lastSearchContext.travellers }
        }
      : null;
  }

  /**
   * Transforms a Canonical Flight Offer and its configuration into a Trip Bucket Candidate,
   * enforcing the canonical 8-state engine and explicit inventory truth.
   */
  public mapFlightOfferToTripCandidate(
    offer: CanonicalFlightOffer,
    config?: FlightConfigurationSelection,
    searchContext?: Partial<FlightSearchRequest>,
    overrideState?: TripBucketItemState
  ): TripBucketCandidate {
    const truth = resolveFlightInventoryTruth(offer);

    // 1. Calculate final price (including selected fare family delta)
    let finalPriceMinor = offer.price.totalMinor;
    let selectedFamilyName = offer.fareFamily;
    let selectedFamilyCode = config?.selectedFareFamilyCode;

    if (config?.selectedFareFamilyCode && offer.fareFamiliesAvailable) {
      const family = offer.fareFamiliesAvailable.find(
        f => f.familyCode === config.selectedFareFamilyCode
      );
      if (family) {
        finalPriceMinor += family.priceDeltaMinor;
        selectedFamilyName = family.familyName;
        selectedFamilyCode = family.familyCode;
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

    let dateSummary: string;
    if (truth.isManual) {
      const requestedDeparture = searchContext?.departureDate;
      const requestedReturn = searchContext?.returnDate;
      dateSummary = requestedDeparture
        ? requestedReturn
          ? `${requestedDeparture} — ${requestedReturn} · schedule pending desk confirmation`
          : `${requestedDeparture} · schedule pending desk confirmation`
        : 'Schedule pending desk confirmation';
    } else {
      dateSummary =
        offer.tripType === 'round_trip' && retDate
          ? `${depDate} — ${retDate} (${offer.flightNumber})${truth.isDemo ? ' · demo schedule' : ''}`
          : `${depDate} · ${offer.flightNumber} (${offer.cabinClass})${truth.isDemo ? ' · demo schedule' : ''}`;
    }

    // 3. Format Traveller summary
    const adults = searchContext?.travellers?.adults ?? 1;
    const children = searchContext?.travellers?.children ?? 0;
    const infants = searchContext?.travellers?.infants ?? 0;
    let travellerSummary = `${adults} Adult${adults > 1 ? 's' : ''}`;
    if (children > 0) travellerSummary += ` · ${children} Child${children > 1 ? 'ren' : ''}`;
    if (infants > 0) travellerSummary += ` · ${infants} Infant${infants > 1 ? 's' : ''}`;
    travellerSummary += ` · ${offer.cabinClass.charAt(0).toUpperCase() + offer.cabinClass.slice(1)}`;

    const subtitle = truth.isManual
      ? 'Request to book · Schedule pending'
      : `${selectedFamilyName} · ${offer.stopCount === 0 ? 'Non-Stop' : `${offer.stopCount} Stop`} · ${Math.floor(offer.durationMinutes / 60)}h ${offer.durationMinutes % 60}m`;

    // 4. Derive Trip Bucket Item State
    let state: TripBucketItemState = overrideState || 'ready';
    let holdStatusText = truth.isLive
      ? 'Fare held for 15 minutes upon confirmation'
      : truth.isManual
        ? 'Allocation on-request — no live seat hold'
        : 'No seat hold — demo fixture';
    let actionRequiredText: string | undefined;
    let primaryActionLabel = truth.isManual ? 'Request Desk Confirmation' : 'Modify Flight';

    if (overrideState) {
      state = overrideState;
    } else if (offer.availabilityStatus === 'PRICE_CHANGED') {
      state = 'price_changed';
      actionRequiredText = truth.isLive
        ? 'Upstream fare adjusted by carrier'
        : 'Fare estimate changed. A desk quote is required before booking.';
      primaryActionLabel = 'Accept New Price';
      holdStatusText = truth.isLive
        ? 'Fare adjustment pending traveler review'
        : 'Estimate adjustment pending review';
    } else if (offer.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
      actionRequiredText = truth.isLive ? 'Offer expired upstream' : 'Demo fare has expired';
      primaryActionLabel = 'Find New Flight';
      holdStatusText = 'Expired';
    } else if (offer.availabilityStatus === 'UNAVAILABLE') {
      state = 'unavailable';
      actionRequiredText = truth.isLive ? 'Seats sold out' : 'Not available in the current demo inventory';
      primaryActionLabel = 'Choose Alternative';
      holdStatusText = 'Unavailable';
    } else if (offer.bookability === 'request_to_book') {
      state = 'needs_action';
      actionRequiredText = 'Vacatina desk confirmation required for carrier, schedule, baggage and fare.';
      primaryActionLabel = 'Request Desk Confirmation';
      holdStatusText = 'Allocation on-request — no live seat hold';
    } else if (offer.bookability === 'informational') {
      state = 'needs_action';
      actionRequiredText = 'Promotional estimate — request a confirmed desk quote before booking.';
      primaryActionLabel = 'Request Desk Quote';
      holdStatusText = 'Promotional estimate only';
    } else if (truth.isDemo) {
      state = 'needs_action';
      actionRequiredText =
        'Demo fixture fare — not live airline inventory. Request a desk quote before booking.';
      primaryActionLabel = 'Request Desk Quote';
      holdStatusText = 'No seat hold — demo fixture';
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
      integrationMode: truth.isDemo ? 'MOCK' : 'ADAPTER-READY',
      offerId: offer.offerId,
      canonicalOfferId: offer.offerId,
      sourceType: offer.sourceType.toUpperCase(),
      sourceId: offer.supplierId,
      providerName: offer.sourceProvider,
      inventoryMode: truth.mode,
      inventoryLabel: truth.label,
      truthDisclosure: truth.disclosure,
      scheduleStatus: truth.isManual
        ? offer.manualInventoryMetadata?.scheduleStatus || 'PENDING_OPERATOR_CONFIRMATION'
        : truth.isDemo
          ? 'DEMO_ILLUSTRATIVE'
          : offer.manualInventoryMetadata?.scheduleStatus || 'PUBLISHED',
      fareFamilyCode: selectedFamilyCode,
      fareFamilyName: selectedFamilyName,
      travellerCounts: { adults, children, infants },
      searchContext: searchContext
        ? {
            searchId: searchContext.searchId,
            tripType: searchContext.tripType,
            origin: searchContext.origin?.airportCode,
            destination: searchContext.destination?.airportCode,
            departureDate: searchContext.departureDate,
            returnDate: searchContext.returnDate
          }
        : undefined,
      currency: offer.price.currency,
      revalidationStatus: 'NOT_REVALIDATED',
      confirmationMode: truth.isLive
        ? 'INSTANT_CONFIRM'
        : 'REQUEST_TO_CONFIRM',
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
    const context = searchContext || this.lastSearchContext || undefined;
    const candidate = this.mapFlightOfferToTripCandidate(offer, config, context, overrideState);
    tripBucketService.stageCandidate(candidate);

    telemetry.track('flight_added_to_trip', {
      offerId: offer.offerId,
      sourceType: offer.sourceType,
      inventoryMode: candidate.inventoryMode,
      carrier: offer.marketingCarrier.code,
      state: candidate.state,
      priceLkr: candidate.priceLkr
    });

    return candidate;
  }

  /**
   * Executes price revalidation on a flight candidate already in the Trip Bucket.
   * A local/demo/manual revalidation never turns a request-to-book item Ready.
   */
  public async revalidateFlightInTripBucket(
    candidateId: string,
    offerId: string
  ): Promise<FlightRevalidationResult> {
    const currentItems = tripBucketService.getItems();
    const existing = currentItems.find(i => i.id === candidateId);

    if (existing) {
      existing.state = 'refreshing_price';
      existing.holdStatusText = 'Rechecking the staged fare and rules…';
      tripBucketService.stageCandidate(existing);
    }

    telemetry.track('flight_revalidation_started', { candidateId, offerId });

    const result = await flightSearchService.revalidateOffer(offerId);

    if (!existing) return result;

    const requiresDeskConfirmation =
      existing.confirmationMode === 'REQUEST_TO_CONFIRM' ||
      existing.inventoryMode === 'demo_fixture' ||
      existing.inventoryMode === 'manual_request';

    existing.revalidationStatus = result.status;
    existing.revalidatedAt = result.revalidatedAt;

    if (result.status === 'UNCHANGED') {
      if (requiresDeskConfirmation) {
        existing.state = 'needs_action';
        existing.holdStatusText =
          existing.inventoryMode === 'demo_fixture'
            ? 'Demo fixture checked locally — no live seat hold'
            : 'On request — no live seat hold placed';
        existing.actionRequiredText =
          existing.inventoryMode === 'demo_fixture'
            ? 'Demo fixture revalidated locally. No live airline availability was checked; request a desk quote.'
            : 'Revalidation did not confirm a live seat. The Vacatina desk must confirm carrier, schedule, baggage and fare.';
        existing.primaryActionLabel =
          existing.primaryActionLabel || 'Request Desk Confirmation';
      } else {
        existing.state = 'ready';
        existing.holdStatusText = 'Fare held for 15 minutes upon confirmation';
        existing.actionRequiredText = undefined;
        existing.primaryActionLabel = 'Modify Flight';
      }
      tripBucketService.stageCandidate(existing);
    } else if (result.status === 'PRICE_CHANGED') {
      existing.state = 'price_changed';
      existing.previousPriceLkr = existing.priceLkr;
      existing.priceLkr = Math.round(result.newPriceMinor / 100);
      existing.holdStatusText = requiresDeskConfirmation
        ? 'Estimate updated — desk confirmation still required'
        : 'Price updated by airline';
      existing.actionRequiredText = requiresDeskConfirmation
        ? `${result.message} Desk confirmation is still required.`
        : result.message;
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
    } else {
      existing.state = 'recheck_required';
      existing.holdStatusText = 'Recheck required';
      existing.actionRequiredText = result.message;
      existing.primaryActionLabel = 'Recheck Fare';
      tripBucketService.stageCandidate(existing);
    }

    return result;
  }
}

export const flightTripBucketService = new FlightTripBucketService();
