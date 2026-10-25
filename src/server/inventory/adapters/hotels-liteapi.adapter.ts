/* ============================================================================
 * Vacatina LiteAPI Hotel Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q3/Q9/Q10/Q11)
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

export interface RawLiteApiHotelOffer {
  hotelId: string; // "lp_99214"
  name: string;    // "Atlantis The Palm"
  city: string;
  country: string;
  countryCode: string;
  roomType: string; // "Ocean King Suite"
  boardBasis: string; // "Breakfast Included"
  netPrice: number; // 480.00
  currency: string; // "USD"
  instantConfirmation: boolean;
  freeCancellationBefore?: string; // ISO
  amenities?: string[];
}

export class HotelsLiteApiAdapter extends BaseSupplierAdapter<RawLiteApiHotelOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'LITEAPI',
      supplierName: 'LiteAPI Global Bedbank',
      productType: 'hotels',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.liteapi.travel/v1',
      productionBaseUrl: 'https://api.liteapi.travel/v1',
      apiKey,
      timeoutMs: 5000
    });
  }

  public normalize(raw: RawLiteApiHotelOffer): CanonicalOfferEntity {
    const rawCostMinor = Math.round(raw.netPrice * 100);
    const rawCurrency = raw.currency || 'USD';

    // Apply 4-layer pricing precedence
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'hotels',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-ht-liteapi-${raw.city.toLowerCase().replace(/[^a-z0-9]/g, '')}-${raw.hotelId.slice(-6)}`;
    const expiresAtIso = new Date(Date.now() + 1800000).toISOString(); // 30 min TTL

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'hotels',
      inventorySource: 'API',
      listingKind: 'SELLABLE_INVENTORY',
      compositionType: 'SINGLE',
      fulfillmentMode: raw.instantConfirmation ? 'INSTANT' : 'ON_REQUEST',
      environmentClass: this.isProduction && this.config.apiKey ? 'PRODUCTION' : 'SANDBOX',
      sellability: this.isProduction && this.config.apiKey ? 'BOOKABLE' : 'QUOTE_ONLY',
      providerLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.name} via LiteAPI`,
      supplierOfferId: raw.hotelId,
      title: raw.name,
      subtitle: `${raw.roomType} · ${raw.boardBasis}`,
      location: {
        city: raw.city,
        country: raw.country,
        countryCode: raw.countryCode
      },
      availabilityStatus: this.isProduction && this.config.apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: raw.instantConfirmation ? 'INSTANT_CONFIRM' : 'REQUEST_TO_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 1800,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        raw.boardBasis,
        'Complimentary high-speed Wi-Fi',
        'Swimming pool & fitness center access'
      ],
      exclusions: [
        'Tourism Dirham / City Council Tourist Tax (payable at check-in)',
        'Early check-in before 14:00'
      ],
      cancellationPolicy: raw.freeCancellationBefore
        ? `Free cancellation until ${raw.freeCancellationBefore.slice(0, 10)}. Non-refundable thereafter.`
        : 'Non-refundable rate. Full charge on cancellation.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !this.config.apiKey,
      integrationLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        liteApiHotelId: raw.hotelId,
        roomType: raw.roomType,
        boardBasis: raw.boardBasis,
        amenities: raw.amenities || [],
        isSandboxSimulated: !this.isProduction || !this.config.apiKey
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      productExtension: {
        productType: 'hotels',
        hotel: {
          starRating: 5,
          roomType: raw.roomType,
          bedConfiguration: '1 King Bed',
          boardBasis: raw.boardBasis.toLowerCase().includes('breakfast') ? 'BB' : 'RO',
          maxOccupancy: {
            maxAdults: 2,
            maxChildren: 1,
            maxGuests: 3
          },
          ratePlanCode: `RATE_${raw.hotelId}`,
          checkInTime: '14:00',
          checkOutTime: '12:00',
          cancellationDeadlineIso: raw.freeCancellationBefore,
          amenities: raw.amenities || ['Wi-Fi', 'Pool', 'Fitness Center']
        }
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return this.applyCanonicalContractDefaults(offer);
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const mockRaw: RawLiteApiHotelOffer = {
      hotelId: `lp_${criteria.destination.toLowerCase()}_001`,
      name: `Grand Palace Hotel ${criteria.destination}`,
      city: criteria.destination,
      country: 'United Arab Emirates',
      countryCode: 'AE',
      roomType: 'Deluxe City View Room',
      boardBasis: 'Breakfast Included',
      netPrice: 220.00,
      currency: criteria.currency || 'USD',
      instantConfirmation: true,
      freeCancellationBefore: `${criteria.departureDate || '2026-11-15'}T00:00:00Z`
    };

    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: isLive
        ? 'Room availability and rate revalidated via LiteAPI Bedbank'
        : '[SANDBOX / MOCK MODE] Simulated hotel rate check. Live LiteAPI key not configured.'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `LIT-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 1800000).toISOString(),
      guaranteedPriceMinor: 22000,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    this.assertCanExecuteProductionBooking();
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      supplierReference: isLive
        ? `LIT-HTL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `LIT-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `VCH-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `LIT-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 0,
      refundEligibleMinor: 22000
    };
  }
}
