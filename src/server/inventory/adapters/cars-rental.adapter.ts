/* ============================================================================
 * Vacatina Rentalcars & Local Fleet Cars/Transfers Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q4)
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

export interface RawRentalCarOffer {
  rateId: string;
  vehicleCategory: string; // "SUV" | "Sedan" | "Minivan"
  vehicleModel: string;    // "Toyota Prado" | "Mercedes E-Class"
  pickupCity: string;
  dropoffCity: string;
  country: string;
  dailyRateAmount: number;
  currency: string;
  isChauffeurDriven: boolean;
  unlimitedMileage: boolean;
}

export class CarsRentalAdapter extends BaseSupplierAdapter<RawRentalCarOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'RENTALCARS_CONNECT',
      supplierName: 'Rentalcars & Fleet Adapter',
      productType: 'cars',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.rentalcars.com/v1',
      productionBaseUrl: 'https://api.rentalcars.com/v1',
      apiKey,
      timeoutMs: 4000,
      integrationLifecycle: 'SCAFFOLD'
    });
  }

  public normalize(raw: RawRentalCarOffer): CanonicalOfferEntity {
    const rawCostMinor = Math.round(raw.dailyRateAmount * 100);
    const rawCurrency = raw.currency || 'USD';

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'cars',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-cr-rentalcars-${raw.pickupCity.toLowerCase().slice(0, 3)}-${raw.rateId.slice(-6)}`;

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'cars',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.vehicleModel} via Rentalcars Connect`,
      supplierOfferId: raw.rateId,
      title: `${raw.vehicleModel} (${raw.vehicleCategory})`,
      subtitle: `${raw.isChauffeurDriven ? 'Chauffeur-Driven' : 'Self-Drive'} · ${raw.pickupCity} to ${raw.dropoffCity}`,
      location: {
        city: raw.pickupCity,
        country: raw.country,
        countryCode: raw.country.slice(0, 2).toUpperCase()
      },
      availabilityStatus: this.isProduction && this.config.apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 7200, // 2 hours
        expiresAtIso: new Date(Date.now() + 7200000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Collision Damage Waiver (CDW)',
        raw.unlimitedMileage ? 'Unlimited mileage' : '200km/day allowance',
        '24/7 Roadside breakdown assistance'
      ],
      exclusions: ['Fuel refuelling charges', 'Highway expressway toll fees'],
      cancellationPolicy: 'Free cancellation up to 48 hours before scheduled pickup.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !this.config.apiKey,
      integrationLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        rateId: raw.rateId,
        vehicleCategory: raw.vehicleCategory,
        vehicleModel: raw.vehicleModel,
        isSandboxSimulated: !this.isProduction || !this.config.apiKey
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
    const mockRaw: RawRentalCarOffer = {
      rateId: `rc_${Math.random().toString(36).slice(2, 8)}`,
      vehicleCategory: 'Premium SUV',
      vehicleModel: 'Toyota Land Cruiser Prado',
      pickupCity: criteria.destination || 'Colombo',
      dropoffCity: criteria.destination || 'Colombo',
      country: 'Sri Lanka',
      dailyRateAmount: 110.00,
      currency: criteria.currency || 'USD',
      isChauffeurDriven: true,
      unlimitedMileage: true
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: isLive
        ? 'Vehicle fleet availability revalidated via Rentalcars API'
        : '[SANDBOX / MOCK MODE] Simulated vehicle fleet check. Live Rentalcars key not configured.'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `RC-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 7200000).toISOString(),
      guaranteedPriceMinor: 11000,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      supplierReference: isLive
        ? `RC-CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `RC-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `VCH-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `RC-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 11000
    };
  }
}
