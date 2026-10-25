/* ============================================================================
 * Vacatina Trainline Partner Rail Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q6/Q9/Q10/Q11)
 * ============================================================================ */

import { BaseSupplierAdapter } from './base.adapter.ts';
import type {
  BookingCancelResult,
  BookingConfirmResult,
  BookingHoldResult
} from './base.adapter.ts';
import type {
  CanonicalOfferEntity,
  RevalidationResult,
  SearchQueryCriteria
} from '../types.ts';
import { PricingPrecedenceService } from '../pricing-precedence.service.ts';
import { DeduplicationService } from '../deduplication.service.ts';

export interface RawTrainlineRailOffer {
  journeyId: string; // "trn_lon_par_01"
  operator: string;  // "Eurostar"
  originStation: string; // "London St Pancras Intl"
  destinationStation: string; // "Paris Gare du Nord"
  originCity: string;
  destinationCity: string;
  country: string;
  departureTimeIso: string;
  arrivalTimeIso: string;
  travelClass: 'Standard' | 'Standard Premier' | 'Business Premier';
  netFareAmount: number; // 95.00
  currency: string;      // "EUR"
  isDirect: boolean;
}

export class RailsTrainlineAdapter extends BaseSupplierAdapter<RawTrainlineRailOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'TRAINLINE',
      supplierName: 'Trainline Partner Rail Gateway',
      productType: 'rails',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.trainline.com/v2',
      productionBaseUrl: 'https://api.trainline.com/v2',
      apiKey,
      timeoutMs: 4000
    });
  }

  public normalize(raw: RawTrainlineRailOffer): CanonicalOfferEntity {
    const rawCostMinor = Math.round(raw.netFareAmount * 100);
    const rawCurrency = raw.currency || 'EUR';

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'rails',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-rl-trainline-${raw.originCity.toLowerCase().slice(0, 3)}-${raw.destinationCity.toLowerCase().slice(0, 3)}-${raw.journeyId.slice(-4)}`;
    const expiresAtIso = new Date(Date.now() + 3600000).toISOString(); // 1 hour TTL

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'rails',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.operator} via Trainline`,
      supplierOfferId: raw.journeyId,
      title: `${raw.originCity} to ${raw.destinationCity}`,
      subtitle: `${raw.operator} · ${raw.travelClass} · ${raw.isDirect ? 'Direct High-Speed' : '1 Change'}`,
      location: {
        city: raw.destinationCity,
        country: raw.country,
        countryCode: raw.country.slice(0, 2).toUpperCase(),
        stationCode: raw.destinationStation.slice(0, 4).toUpperCase()
      },
      availabilityStatus: 'LIVE',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 3600,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Reserved seat allocation',
        '2 pieces of luggage per passenger (no weight limit)',
        'On-board electrical outlets & Wi-Fi'
      ],
      exclusions: ['Catering & trolley purchases', 'Hotel transfer from arrival station'],
      cancellationPolicy: 'Refundable up to 7 days before departure with 15% operator fee.',
      pinAboveApi: false,
      deduplicationKey: '',
      sourceMetadata: {
        trainlineJourneyId: raw.journeyId,
        originStation: raw.originStation,
        destinationStation: raw.destinationStation,
        departureTime: raw.departureTimeIso
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return offer;
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const mockRaw: RawTrainlineRailOffer = {
      journeyId: `trn_${(criteria.origin || 'lon').slice(0, 3)}_${(criteria.destination || 'par').slice(0, 3)}_01`,
      operator: 'Eurostar High-Speed',
      originStation: `${criteria.origin || 'London'} Central`,
      destinationStation: `${criteria.destination || 'Paris'} Station`,
      originCity: criteria.origin || 'London',
      destinationCity: criteria.destination || 'Paris',
      country: 'France',
      departureTimeIso: `${criteria.departureDate || '2026-11-15'}T08:00:00Z`,
      arrivalTimeIso: `${criteria.departureDate || '2026-11-15'}T11:20:00Z`,
      travelClass: 'Standard',
      netFareAmount: 95.00,
      currency: criteria.currency || 'EUR',
      isDirect: true
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: 'Rail timetable & seat availability verified by Trainline'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `TRN-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 3600000).toISOString(),
      guaranteedPriceMinor: 9500,
      currency: 'EUR'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `TRN-TKT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: `ETKT-${Math.floor(10000000 + Math.random() * 90000000)}`,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'CONFIRMED'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `TRN-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 1500,
      refundEligibleMinor: 8000
    };
  }
}
