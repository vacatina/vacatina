/* ============================================================================
 * Vacatina Provider-Neutral Supplier API Flight Adapter
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§3, §19, §25, §34)
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightOptionalService
} from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightRevalidationResult,
  FlightSearchRequest
} from '../domain/search-models.ts';
import type {
  FlightAdapterCapabilities,
  FlightAdapterSearchResult,
  IFlightAdapter
} from './flight-adapter.interface.ts';
import { SUPPLIER_FLIGHT_FIXTURES } from '../data/supplier-fixtures.ts';

const DEMO_PROVIDER_NAME = 'Vacatina Flight Fixtures (demo, non-production)';

/**
 * All supplier records in this phase are local fixtures. Mark them explicitly
 * so no UI, Trip Bucket item, or revalidation message can imply live inventory.
 */
function asDemoFixture(offer: CanonicalFlightOffer): CanonicalFlightOffer {
  return {
    ...offer,
    inventoryMode: 'demo_fixture',
    sourceProvider: DEMO_PROVIDER_NAME
  };
}

export class SupplierApiFlightAdapter implements IFlightAdapter {
  public readonly adapterId = 'adapter-supplier-api-flights';
  public readonly sourceType = 'supplier_api' as const;
  public readonly providerName = DEMO_PROVIDER_NAME;
  public readonly capabilities: FlightAdapterCapabilities = {
    supportsRealtimeFareRules: true,
    supportsAncillaries: true,
    supportsSeatSelection: true,
    supportsInstantRevalidation: true,
    supportsMultiCity: true
  };

  public async search(request: FlightSearchRequest): Promise<FlightAdapterSearchResult> {
    try {
      const originCode = request.origin.airportCode.toUpperCase();
      const destCode = request.destination.airportCode.toUpperCase();

      // Filter fixture dataset
      const matched = SUPPLIER_FLIGHT_FIXTURES.filter(offer => {
        // Exclude deliberately expired or unavailable test offers from general search
        if (offer.offerId === 'sup-flt-expired-sim' || offer.offerId === 'sup-flt-unavailable-sim') {
          return false;
        }

        // Multi-city match
        if (request.tripType === 'multi_city') {
          return offer.tripType === 'multi_city';
        }

        // Match origin & destination
        const originMatches =
          offer.origin.airportCode.toUpperCase() === originCode ||
          offer.origin.cityCode.toUpperCase() === request.origin.cityCode.toUpperCase();
        const destMatches =
          offer.destination.airportCode.toUpperCase() === destCode ||
          offer.destination.cityCode.toUpperCase() === request.destination.cityCode.toUpperCase();

        if (!originMatches || !destMatches) return false;

        // Trip type
        if (request.tripType === 'one_way' && offer.tripType !== 'one_way') return false;

        // Cabin class
        if (request.cabinClass && offer.cabinClass !== request.cabinClass) return false;

        // Direct flights only filter
        if (request.directFlightsOnly && offer.stopCount > 0) return false;

        return true;
      });

      return {
        adapterId: this.adapterId,
        sourceType: this.sourceType,
        providerName: this.providerName,
        offers: matched.map(asDemoFixture),
        status: 'ok'
      };
    } catch (err) {
      return {
        adapterId: this.adapterId,
        sourceType: this.sourceType,
        providerName: this.providerName,
        offers: [],
        status: 'error',
        errorMessage: (err as Error).message
      };
    }
  }

  public async getOfferById(offerId: string): Promise<CanonicalFlightOffer | null> {
    const found = SUPPLIER_FLIGHT_FIXTURES.find(o => o.offerId === offerId);
    return found ? asDemoFixture(found) : null;
  }

  public async revalidateOffer(
    offerId: string,
    configuration?: FlightConfigurationSelection
  ): Promise<FlightRevalidationResult> {
    const offer = await this.getOfferById(offerId);
    const now = new Date().toISOString();

    if (!offer) {
      return {
        offerId,
        status: 'UNAVAILABLE',
        originalPriceMinor: 0,
        newPriceMinor: 0,
        priceDeltaMinor: 0,
        currency: 'LKR',
        message: 'Flight offer was not found or has been withdrawn by carrier.',
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // 1. Simulation: Expired Offer Test
    if (offer.offerId === 'sup-flt-expired-sim' || offer.status === 'expired') {
      return {
        offerId,
        status: 'OFFER_EXPIRED',
        originalPriceMinor: offer.price.totalMinor,
        newPriceMinor: offer.price.totalMinor,
        priceDeltaMinor: 0,
        currency: offer.price.currency,
        message: 'This flight fare offer has expired. Please refresh search to view current fares.',
        updatedOffer: offer,
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // 2. Simulation: Sold Out / Unavailable Test
    if (offer.offerId === 'sup-flt-unavailable-sim' || offer.seatAvailability === 0) {
      return {
        offerId,
        status: 'UNAVAILABLE',
        originalPriceMinor: offer.price.totalMinor,
        newPriceMinor: offer.price.totalMinor,
        priceDeltaMinor: 0,
        currency: offer.price.currency,
        message: 'Seats are no longer available at this fare class. Please select another flight.',
        updatedOffer: offer,
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // 3. Simulation: Price Changed Test
    if (offer.offerId === 'sup-flt-price-changed-sim') {
      const originalPriceMinor = offer.price.totalMinor; // 248,500 LKR
      const newPriceMinor = 25600000;                     // 256,000 LKR
      const deltaMinor = newPriceMinor - originalPriceMinor; // +7,500 LKR

      const updatedOffer: CanonicalFlightOffer = {
        ...offer,
        price: {
          ...offer.price,
          totalMinor: newPriceMinor,
          baseFareMinor: 18250000
        },
        availabilityStatus: 'PRICE_CHANGED',
        lastCheckedAt: now
      };

      return {
        offerId,
        status: 'PRICE_CHANGED',
        originalPriceMinor,
        newPriceMinor,
        priceDeltaMinor: deltaMinor,
        currency: offer.price.currency,
        message: `Upstream airline fare changed from LKR ${(originalPriceMinor / 100).toLocaleString()} to LKR ${(newPriceMinor / 100).toLocaleString()} (+LKR ${(deltaMinor / 100).toLocaleString()}).`,
        updatedOffer,
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // 3b. Simulation: Fare Rules Changed Test
    if (offer.offerId === 'sup-flt-fare-rules-changed-sim') {
      const updatedOffer: CanonicalFlightOffer = {
        ...offer,
        changeRules: { allowed: false, description: 'No changes permitted after fare-rules update (simulated)' },
        refundRules: { refundable: false, description: 'Non-refundable after fare-rules update (simulated)' },
        lastCheckedAt: now
      };
      return {
        offerId,
        status: 'RECHECK_REQUIRED',
        originalPriceMinor: offer.price.totalMinor,
        newPriceMinor: offer.price.totalMinor,
        priceDeltaMinor: 0,
        currency: offer.price.currency,
        message: 'Fare rules changed: change and refund conditions were updated by the carrier. Review before proceeding.',
        updatedOffer,
        revalidatedAt: now,
        requiresUserAction: true
      };
    }

    // 4. Standard Revalidation with Fare Family adjustments
    let totalMinor = offer.price.totalMinor;
    if (configuration?.selectedFareFamilyCode && offer.fareFamiliesAvailable) {
      const selected = offer.fareFamiliesAvailable.find(
        f => f.familyCode === configuration.selectedFareFamilyCode
      );
      if (selected) {
        totalMinor += selected.priceDeltaMinor;
      }
    }

    return {
      offerId,
      status: 'UNCHANGED',
      originalPriceMinor: offer.price.totalMinor,
      newPriceMinor: totalMinor,
      priceDeltaMinor: totalMinor - offer.price.totalMinor,
      currency: offer.price.currency,
      message: 'Demo fixture fare revalidated locally. No live airline inventory, seat hold, or supplier booking was queried.',
      updatedOffer: {
        ...offer,
        price: {
          ...offer.price,
          totalMinor
        },
        availabilityStatus: 'AVAILABLE',
        lastCheckedAt: now
      },
      revalidatedAt: now,
      requiresUserAction: false
    };
  }

  public async getAncillaries(offerId: string): Promise<FlightOptionalService[]> {
    const offer = await this.getOfferById(offerId);
    return offer?.optionalServices || [];
  }
}
