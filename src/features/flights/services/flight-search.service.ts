/* ============================================================================
 * Vacatina Canonical Flight Search & Aggregation Service
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§7, §13, §14-§16, §34, §35)
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightOptionalService
} from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightFilterCriteria,
  FlightRevalidationResult,
  FlightSearchRequest,
  FlightSearchResponse,
  FlightSearchValidation,
  FlightSortOption
} from '../domain/search-models.ts';
import type { IFlightAdapter } from '../adapters/flight-adapter.interface.ts';
import { ManualFlightAdapter } from '../adapters/manual-flight.adapter.ts';
import { SupplierApiFlightAdapter } from '../adapters/supplier-api-flight.adapter.ts';
import { duffelSandboxFlightAdapter } from '../adapters/duffel-sandbox-flight.adapter.ts';
import { findAirportByCode } from '../data/airports.ts';

export class FlightSearchService {
  private adapters: IFlightAdapter[] = [];
  private sandboxAdapter: IFlightAdapter = duffelSandboxFlightAdapter;

  constructor() {
    // Register canonical adapters
    this.adapters.push(new ManualFlightAdapter());
    this.adapters.push(new SupplierApiFlightAdapter());
  }

  public registerAdapter(adapter: IFlightAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Validates a Flight Search Request against strict domain rules.
   */
  public validateSearchRequest(req: Partial<FlightSearchRequest>): FlightSearchValidation {
    const errors: Record<string, string> = {};
    let firstErrorField: string | undefined;

    const setError = (field: string, msg: string) => {
      errors[field] = msg;
      if (!firstErrorField) firstErrorField = field;
    };

    // 1. Origin validation
    if (!req.origin || !req.origin.airportCode) {
      setError('origin', 'Please select a valid departure airport.');
    } else if (!findAirportByCode(req.origin.airportCode)) {
      setError('origin', `Airport code ${req.origin.airportCode} is not recognized.`);
    }

    // 2. Destination validation
    if (!req.destination || !req.destination.airportCode) {
      setError('destination', 'Please select a valid arrival airport.');
    } else if (!findAirportByCode(req.destination.airportCode)) {
      setError('destination', `Airport code ${req.destination.airportCode} is not recognized.`);
    }

    // 3. Same airport check
    if (
      req.origin?.airportCode &&
      req.destination?.airportCode &&
      req.origin.airportCode.toUpperCase() === req.destination.airportCode.toUpperCase()
    ) {
      setError('destination', 'Origin and destination airports cannot be identical.');
    }

    // 4. Date validation
    const todayStr = new Date().toISOString().split('T')[0];
    if (!req.departureDate) {
      setError('departureDate', 'Please select a departure date.');
    } else if (req.departureDate < todayStr) {
      setError('departureDate', 'Departure date cannot be in the past.');
    }

    if (req.tripType === 'round_trip') {
      if (!req.returnDate) {
        setError('returnDate', 'Please select a return date for round trip.');
      } else if (req.returnDate < (req.departureDate || todayStr)) {
        setError('returnDate', 'Return date cannot precede departure date.');
      }
    }

    // 5. Multi-City validation
    if (req.tripType === 'multi_city') {
      if (!req.legs || req.legs.length < 2) {
        setError('legs', 'Multi-city itinerary requires at least 2 flight legs.');
      } else {
        let prevDate = req.departureDate || todayStr;
        req.legs.forEach((leg, idx) => {
          if (!leg.origin?.airportCode || !leg.destination?.airportCode) {
            setError(`leg_${idx}`, `Leg ${idx + 1} has an incomplete route.`);
          } else if (leg.origin.airportCode.toUpperCase() === leg.destination.airportCode.toUpperCase()) {
            setError(`leg_${idx}`, `Leg ${idx + 1} origin and destination cannot be identical.`);
          }
          if (!leg.departureDate) {
            setError(`leg_${idx}_date`, `Leg ${idx + 1} requires a departure date.`);
          } else if (leg.departureDate < prevDate) {
            setError(`leg_${idx}_date`, `Leg ${idx + 1} date cannot precede the previous leg.`);
          } else {
            prevDate = leg.departureDate;
          }
        });
      }
    }

    // 6. Travellers validation
    const travellers = req.travellers || { adults: 1, children: 0, infants: 0 };
    if (!travellers.adults || travellers.adults < 1) {
      setError('adults', 'At least 1 adult passenger is required.');
    }
    if (travellers.infants > travellers.adults) {
      setError('infants', 'Number of infants cannot exceed the number of accompanying adults.');
    }
    const total = travellers.adults + (travellers.children || 0) + (travellers.infants || 0);
    if (total > 9) {
      setError('travellers', 'Total passengers cannot exceed 9 per online booking.');
    }

    // 7. Duffel TEST MODE lane is one-way/return only in this phase.
    if (req.inventorySource === 'sandbox_test' && req.tripType === 'multi_city') {
      setError('tripType', 'Duffel TEST MODE search supports one-way and return journeys in this phase.');
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstErrorField
    };
  }

  /**
   * Executes unified flight search across all registered adapters with deduplication,
   * deterministic sorting, and faceting.
   */
  public async search(
    request: FlightSearchRequest,
    sortOption: FlightSortOption = 'recommended',
    filters?: FlightFilterCriteria
  ): Promise<FlightSearchResponse> {
    const searchTimestamp = new Date().toISOString();

    // Query adapters in parallel. Sandbox test inventory is an exclusive lane:
    // demo fixtures and manual request-to-book results are never mixed into it.
    const adapters = request.inventorySource === 'sandbox_test' ? [this.sandboxAdapter] : this.adapters;
    const adapterPromises = adapters.map(a => a.search(request));
    const adapterResults = await Promise.all(adapterPromises);

    const sourcesQueried: FlightSearchResponse['sourcesQueried'] = [];
    let combinedOffers: CanonicalFlightOffer[] = [];

    for (const res of adapterResults) {
      sourcesQueried.push({
        source: res.sourceType,
        provider: res.providerName,
        count: res.offers.length,
        status: res.status
      });
      if (res.status === 'ok') {
        combinedOffers.push(...res.offers);
      }
    }

    // Deduplicate by signature: carrier + flightNumber + departureAt + tripType
    const seenSignatures = new Set<string>();
    const deduplicatedOffers: CanonicalFlightOffer[] = [];

    for (const offer of combinedOffers) {
      const sig = `${offer.marketingCarrier.code}_${offer.flightNumber}_${offer.departureAt}_${offer.tripType}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        deduplicatedOffers.push(offer);
      }
    }

    // Compute pre-filter aggregates
    const availableAirlinesMap = new Map<string, { code: string; name: string; minPriceMinor: number; count: number }>();
    const availableStopsSet = new Set<number>();
    let minPrice = Infinity;
    let maxPrice = 0;
    let minDuration = Infinity;
    let maxDuration = 0;

    deduplicatedOffers.forEach(o => {
      // Airlines
      const carrier = o.marketingCarrier;
      const existing = availableAirlinesMap.get(carrier.code);
      if (existing) {
        existing.count += 1;
        existing.minPriceMinor = Math.min(existing.minPriceMinor, o.price.totalMinor);
      } else {
        availableAirlinesMap.set(carrier.code, {
          code: carrier.code,
          name: carrier.name,
          minPriceMinor: o.price.totalMinor,
          count: 1
        });
      }

      // Stops
      availableStopsSet.add(o.stopCount);

      // Price range
      if (o.price.totalMinor < minPrice) minPrice = o.price.totalMinor;
      if (o.price.totalMinor > maxPrice) maxPrice = o.price.totalMinor;

      // Duration range
      if (o.durationMinutes < minDuration) minDuration = o.durationMinutes;
      if (o.durationMinutes > maxDuration) maxDuration = o.durationMinutes;
    });

    if (minPrice === Infinity) minPrice = 0;
    if (minDuration === Infinity) minDuration = 0;

    // Apply Filters
    let filteredOffers = deduplicatedOffers.filter(offer => {
      if (!filters) return true;

      // Stops filter
      if (filters.stops && filters.stops.length > 0) {
        if (!filters.stops.includes(offer.stopCount)) return false;
      }

      // Airline filter
      if (filters.airlineCodes && filters.airlineCodes.length > 0) {
        if (!filters.airlineCodes.includes(offer.marketingCarrier.code)) return false;
      }

      // Price filter
      if (filters.maxPriceMinor !== undefined && offer.price.totalMinor > filters.maxPriceMinor) {
        return false;
      }
      if (filters.minPriceMinor !== undefined && offer.price.totalMinor < filters.minPriceMinor) {
        return false;
      }

      // Cabin filter
      if (filters.cabinClass && offer.cabinClass !== filters.cabinClass) {
        return false;
      }

      // Baggage included only
      if (filters.baggageIncludedOnly && offer.baggage.checked.pieces === 0) {
        return false;
      }

      // Refundable only
      if (filters.refundableOnly && !offer.refundRules.refundable) {
        return false;
      }

      // Departure time window
      if (filters.departureTimeWindow && filters.departureTimeWindow !== 'all') {
        const depHour = new Date(offer.departureAt).getUTCHours();
        if (filters.departureTimeWindow === 'morning' && (depHour < 0 || depHour >= 12)) return false;
        if (filters.departureTimeWindow === 'afternoon' && (depHour < 12 || depHour >= 18)) return false;
        if (filters.departureTimeWindow === 'evening' && depHour < 18) return false;
      }

      // Max duration
      if (filters.maxDurationMinutes && offer.durationMinutes > filters.maxDurationMinutes) {
        return false;
      }

      return true;
    });

    // Apply Sorting
    filteredOffers = this.sortOffers(filteredOffers, sortOption);

    return {
      searchId: request.searchId,
      request,
      offers: filteredOffers,
      totalCount: deduplicatedOffers.length,
      filteredCount: filteredOffers.length,
      searchTimestamp,
      sourcesQueried,
      availableAirlines: Array.from(availableAirlinesMap.values()),
      availableStops: Array.from(availableStopsSet).sort((a, b) => a - b),
      priceRange: {
        minMinor: minPrice,
        maxMinor: maxPrice
      },
      durationRange: {
        minMinutes: minDuration,
        maxMinutes: maxDuration
      }
    };
  }

  /**
   * Deterministic sorting logic compatible with future backend ranker.
   */
  public sortOffers(offers: CanonicalFlightOffer[], sort: FlightSortOption): CanonicalFlightOffer[] {
    const list = [...offers];

    switch (sort) {
      case 'price_asc':
        return list.sort((a, b) => a.price.totalMinor - b.price.totalMinor);

      case 'duration_asc':
        return list.sort((a, b) => a.durationMinutes - b.durationMinutes);

      case 'departure_asc':
        return list.sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime());

      case 'arrival_asc':
        return list.sort((a, b) => new Date(a.arrivalAt).getTime() - new Date(b.arrivalAt).getTime());

      case 'recommended':
      default:
        // Deterministic scoring formula:
        // Score = (durationMinutes * 0.4) + (priceMinor / 100000 * 0.4) + (stopCount * 80)
        // Lower score is better!
        return list.sort((a, b) => {
          const scoreA = a.durationMinutes * 0.4 + (a.price.totalMinor / 100000) * 0.4 + a.stopCount * 80;
          const scoreB = b.durationMinutes * 0.4 + (b.price.totalMinor / 100000) * 0.4 + b.stopCount * 80;
          return scoreA - scoreB;
        });
    }
  }

  /**
   * Retrieves single offer across all adapters.
   */
  public async getOfferById(offerId: string): Promise<CanonicalFlightOffer | null> {
    if (this.isSandboxOfferId(offerId)) {
      return this.sandboxAdapter.getOfferById(offerId);
    }
    for (const adapter of this.adapters) {
      const offer = await adapter.getOfferById(offerId);
      if (offer) return offer;
    }
    return null;
  }

  private isSandboxOfferId(offerId: string): boolean {
    return offerId.includes('-off_') || offerId.startsWith('off_');
  }

  /**
   * Revalidates an offer by delegating to its authoritative adapter.
   */
  public async revalidateOffer(
    offerId: string,
    configuration?: FlightConfigurationSelection
  ): Promise<FlightRevalidationResult> {
    if (this.isSandboxOfferId(offerId)) {
      return this.sandboxAdapter.revalidateOffer(offerId, configuration);
    }
    for (const adapter of this.adapters) {
      const offer = await adapter.getOfferById(offerId);
      if (offer) {
        return adapter.revalidateOffer(offerId, configuration);
      }
    }

    return {
      offerId,
      status: 'UNAVAILABLE',
      originalPriceMinor: 0,
      newPriceMinor: 0,
      priceDeltaMinor: 0,
      currency: 'LKR',
      message: 'Flight offer was not found or has been withdrawn.',
      revalidatedAt: new Date().toISOString(),
      requiresUserAction: true
    };
  }

  /**
   * Retrieves optional ancillaries for an offer.
   */
  public async getAncillaries(offerId: string): Promise<FlightOptionalService[]> {
    if (this.isSandboxOfferId(offerId)) {
      return this.sandboxAdapter.getAncillaries(offerId);
    }
    for (const adapter of this.adapters) {
      const offer = await adapter.getOfferById(offerId);
      if (offer) {
        return adapter.getAncillaries(offerId);
      }
    }
    return [];
  }
}

export const flightSearchService = new FlightSearchService();
