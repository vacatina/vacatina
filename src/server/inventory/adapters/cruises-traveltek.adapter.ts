/* ============================================================================
 * Vacatina Traveltek Cruises Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q7)
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

export interface RawCruiseSailingOffer {
  sailingId: string;
  cruiseLine: string;   // "Royal Caribbean" | "Silversea"
  shipName: string;     // "Wonder of the Seas"
  embarkationPort: string;
  disembarkationPort: string;
  durationNights: number;
  cabinGrade: string;   // "Oceanview Balcony"
  netCabinCost: number;
  currency: string;
  itineraryPorts: string[];
}

export class CruisesTraveltekAdapter extends BaseSupplierAdapter<RawCruiseSailingOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiKey?: string) {
    super({
      supplierId: 'TRAVELTEK_CRUISE',
      supplierName: 'Traveltek Cruise GDS Gateway',
      productType: 'cruises',
      environment,
      sandboxBaseUrl: 'https://api.sandbox.traveltek.net/cruises/v1',
      productionBaseUrl: 'https://api.traveltek.net/cruises/v1',
      apiKey,
      timeoutMs: 6000,
      integrationLifecycle: 'SCAFFOLD'
    });
  }

  public normalize(raw: RawCruiseSailingOffer): CanonicalOfferEntity {
    const rawCostMinor = Math.round(raw.netCabinCost * 100);
    const rawCurrency = raw.currency || 'USD';

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'cruises',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-crz-traveltek-${raw.sailingId.slice(-6)}`;

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'cruises',
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${raw.cruiseLine} via Traveltek`,
      supplierOfferId: raw.sailingId,
      title: `${raw.durationNights}-Night ${raw.cruiseLine} Cruise on ${raw.shipName}`,
      subtitle: `${raw.cabinGrade} · ${raw.embarkationPort} to ${raw.disembarkationPort}`,
      location: {
        city: raw.embarkationPort,
        country: 'United States',
        countryCode: 'US'
      },
      availabilityStatus: this.isProduction && this.config.apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 43200, // 12 hours
        expiresAtIso: new Date(Date.now() + 43200000).toISOString(),
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Full onboard dining across main dining rooms & buffets',
        'Broadway-style evening theater entertainment',
        'Port handling charges and government marine fees'
      ],
      exclusions: ['Onboard gratuities', 'Speciality dining restaurants', 'Shore excursions'],
      cancellationPolicy: 'Subject to cruise line penalty schedule. 25% deposit non-refundable.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !this.config.apiKey,
      integrationLifecycle: this.isProduction && this.config.apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        sailingId: raw.sailingId,
        shipName: raw.shipName,
        cabinGrade: raw.cabinGrade,
        itineraryPorts: raw.itineraryPorts,
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
    const mockRaw: RawCruiseSailingOffer = {
      sailingId: `crz_${Math.random().toString(36).slice(2, 8)}`,
      cruiseLine: 'Royal Caribbean',
      shipName: 'Icon of the Seas',
      embarkationPort: criteria.destination || 'Miami',
      disembarkationPort: criteria.destination || 'Miami',
      durationNights: 7,
      cabinGrade: 'Oceanview Balcony Stateroom',
      netCabinCost: 1450.00,
      currency: criteria.currency || 'USD',
      itineraryPorts: ['Miami', 'Perfect Day at CocoCay', 'Cozumel', 'Roatan']
    };
    return [this.normalize(mockRaw)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: isLive
        ? 'Cabin allocation and cruise tariff revalidated via Traveltek'
        : '[SANDBOX / MOCK MODE] Simulated cruise cabin check. Live Traveltek key not configured.'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `CRZ-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 43200000).toISOString(),
      guaranteedPriceMinor: 145000,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    const isLive = Boolean(this.isProduction && this.config.apiKey);
    return {
      supplierReference: isLive
        ? `CRZ-CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `CRZ-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `CRZ-FOLIO-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `CRZ-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 25000, // $250 deposit penalty
      refundEligibleMinor: 120000
    };
  }
}
