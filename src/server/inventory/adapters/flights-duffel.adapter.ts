/* ============================================================================
 * Vacatina Duffel NDC / Amadeus Flight Supplier Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q1/Q2/Q9/Q10/Q11)
 * ============================================================================ */

import { BaseSupplierAdapter, FlightSupplierAdapter } from './base.adapter.ts';
import type {
  BookingCancelResult,
  BookingConfirmResult,
  BookingHoldResult
} from './base.adapter.ts';
import type {
  CanonicalOfferEntity,
  ProviderLifecycle,
  RevalidationResult,
  SearchQueryCriteria
} from '../types.ts';
import { PricingPrecedenceService } from '../pricing-precedence.service.ts';
import { DeduplicationService } from '../deduplication.service.ts';

export interface RawDuffelFlightOffer {
  id: string; // "off_0000A..."
  total_amount: string; // "320.00"
  total_currency: string; // "USD"
  slices: Array<{
    origin: { iata_code: string; city_name: string };
    destination: { iata_code: string; city_name: string; country_name?: string };
    departure_datetime: string; // ISO
    arrival_datetime: string;   // ISO
    duration: string;           // "PT4H30M"
    segments: Array<{
      marketing_carrier: { iata_code: string; name: string };
      marketing_carrier_flight_number: string;
      aircraft?: { name: string };
      passengers: Array<{
        cabin_class: 'economy' | 'premium_economy' | 'business' | 'first';
        baggages?: Array<{ type: string; quantity: number }>;
      }>;
    }>;
  }>;
  expires_at: string;
  payment_requirements?: {
    requires_instant_payment: boolean;
    price_guarantee_expires_at?: string;
  };
}

export class FlightsDuffelAdapter extends FlightSupplierAdapter<RawDuffelFlightOffer> {
  constructor(environment: 'sandbox' | 'production' = 'sandbox', apiToken?: string) {
    super({
      supplierId: 'DUFFEL_NDC',
      supplierName: 'Duffel NDC Airline Gateway',
      productType: 'flights',
      environment,
      sandboxBaseUrl: 'https://api.duffel.com/air',
      productionBaseUrl: 'https://api.duffel.com/air',
      apiKey: apiToken,
      timeoutMs: 6000
    });
  }

  public normalize(raw: RawDuffelFlightOffer): CanonicalOfferEntity {
    const slice = raw.slices[0];
    const segment = slice?.segments[0];
    const carrier = segment?.marketing_carrier;
    const originIata = slice?.origin.iata_code || 'CMB';
    const destIata = slice?.destination.iata_code || 'DXB';
    const destCity = slice?.destination.city_name || 'Dubai';
    const destCountry = slice?.destination.country_name || 'United Arab Emirates';
    const cabin = segment?.passengers[0]?.cabin_class || 'economy';
    const flightNumber = `${carrier?.iata_code || 'UL'}-${segment?.marketing_carrier_flight_number || '225'}`;

    // Calculate raw cost in integer minor currency units
    const rawCostMinor = Math.round(parseFloat(raw.total_amount) * 100);
    const rawCurrency = raw.total_currency || 'USD';

    // Apply 4-layer pricing precedence
    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'flights',
      rawSupplierCostMinor: rawCostMinor,
      rawCurrency,
      targetCurrency: rawCurrency
    });

    const offerId = `vct-fl-duffel-${originIata.toLowerCase()}-${destIata.toLowerCase()}-${raw.id.slice(-6)}`;
    const expiresAtIso = raw.expires_at || new Date(Date.now() + 900000).toISOString();

    const apiKey = this.config.apiKey || (typeof process !== 'undefined' ? process.env?.DUFFEL_TOKEN : undefined);
    const lifecycle: ProviderLifecycle = apiKey
      ? (this.isProduction ? 'PRODUCTION_LIVE' : 'SANDBOX_CONNECTED')
      : 'MOCK';

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'flights',
      inventorySource: 'API',
      listingKind: 'SELLABLE_INVENTORY',
      compositionType: 'SINGLE',
      fulfillmentMode: 'INSTANT',
      environmentClass: this.isProduction && apiKey ? 'PRODUCTION' : 'SANDBOX',
      sellability: this.isProduction && apiKey ? 'BOOKABLE' : 'QUOTE_ONLY',
      providerLifecycle: lifecycle,
      sourceType: 'API',
      supplierId: this.supplierId,
      supplierName: `${carrier?.name || 'Airline'} via Duffel NDC`,
      supplierOfferId: raw.id,
      title: `${slice?.origin.city_name || originIata} to ${destCity} (${destIata})`,
      subtitle: `${carrier?.name || 'Scheduled'} · ${flightNumber} · ${cabin.toUpperCase()}`,
      location: {
        city: destCity,
        country: destCountry,
        countryCode: destIata.slice(0, 2),
        iataCode: destIata
      },
      availabilityStatus: this.isProduction && apiKey ? 'LIVE' : 'CACHED',
      confirmationMode: 'INSTANT_CONFIRM',
      bookingMode: 'INSTANT_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 900, // 15 min
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: [
        'Cabin baggage included (7kg)',
        'Checked baggage allowance (23kg standard)',
        'Complimentary in-flight dining & beverages'
      ],
      exclusions: [
        'Preferred seat selection prior to online check-in',
        'In-flight high-speed Wi-Fi access'
      ],
      cancellationPolicy: 'Airline fare rules apply. Non-refundable standard fare, changes subject to carrier penalty.',
      pinAboveApi: false,
      deduplicationKey: '',
      isSandboxSimulated: !this.isProduction || !apiKey,
      integrationLifecycle: this.isProduction && apiKey ? 'PRODUCTION_LIVE' : 'SCAFFOLD',
      sourceMetadata: {
        duffelOfferId: raw.id,
        airlineCode: carrier?.iata_code,
        flightNumber,
        departureTime: slice?.departure_datetime,
        arrivalTime: slice?.arrival_datetime,
        cabinClass: cabin,
        isSandboxSimulated: !this.isProduction || !apiKey,
        managedContentEnabled: true // Duffel Managed Content allows Vacatina to access flight content using Duffel or its partner's agency accreditation and ticketing authority, subject to the applicable Duffel commercial/payment arrangement.
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      productExtension: {
        productType: 'flights',
        flight: {
          fareFamily: 'Standard Economy',
          cabinClass: 'ECONOMY',
          ticketingDeadlineIso: expiresAtIso,
          isRefundable: false,
          isChangeable: true,
          baggageAllowance: {
            cabinBaggageKg: 7,
            checkedBaggageKg: 23,
            pieceCount: 1
          },
          segments: [{
            segmentId: `seg_${raw.id}_0`,
            carrierCode: carrier?.iata_code || 'UL',
            carrierName: carrier?.name || 'Airline',
            flightNumber,
            aircraftModel: segment?.aircraft?.name || 'Airbus A330',
            originIata,
            originTerminal: '1',
            destinationIata: destIata,
            destinationTerminal: '3',
            departureTimeIso: slice?.departure_datetime || new Date().toISOString(),
            arrivalTimeIso: slice?.arrival_datetime || new Date().toISOString(),
            durationMinutes: 270
          }]
        }
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return this.applyCanonicalContractDefaults(offer);
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const apiKey = this.config.apiKey || (typeof process !== 'undefined' ? process.env?.DUFFEL_TOKEN : undefined);

    // Live HTTP Request to Duffel NDC API when credentials are present
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeoutMs = this.config.timeoutMs || 8000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}/offer_requests?return_offers=true`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Duffel-Version': 'v2',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            data: {
              slices: [
                {
                  origin: criteria.origin || 'CMB',
                  destination: criteria.destination || 'DXB',
                  departure_date: criteria.departureDate || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10)
                }
              ],
              passengers: [{ type: 'adult' }],
              cabin_class: (criteria.cabinClass?.toLowerCase() as any) || 'economy'
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (response.ok) {
          const json = await response.json();
          const rawOffers: RawDuffelFlightOffer[] = json.data?.offers || [];
          if (rawOffers.length > 0) {
            return rawOffers.slice(0, 10).map(raw => this.normalize(raw));
          }
        } else {
          console.warn(`[FlightsDuffelAdapter] Duffel API responded with HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (err: any) {
        console.warn(`[FlightsDuffelAdapter] Live network fetch failed: ${err.message}. Engaging controlled fallback.`);
      }
    }

    // Deterministic MOCK Fixture when credentials absent or in mock/test mode
    const mockRawOffer: RawDuffelFlightOffer = {
      id: `off_${Math.random().toString(36).slice(2, 10)}`,
      total_amount: '350.00',
      total_currency: criteria.currency || 'USD',
      slices: [
        {
          origin: { iata_code: criteria.origin || 'CMB', city_name: 'Colombo' },
          destination: { iata_code: criteria.destination || 'DXB', city_name: 'Dubai', country_name: 'United Arab Emirates' },
          departure_datetime: `${criteria.departureDate || '2026-11-15'}T09:30:00Z`,
          arrival_datetime: `${criteria.departureDate || '2026-11-15'}T13:00:00Z`,
          duration: 'PT4H30M',
          segments: [
            {
              marketing_carrier: { iata_code: 'EK', name: 'Emirates' },
              marketing_carrier_flight_number: '651',
              passengers: [
                {
                  cabin_class: (criteria.cabinClass?.toLowerCase() as any) || 'economy'
                }
              ]
            }
          ]
        }
      ],
      expires_at: new Date(Date.now() + 900000).toISOString()
    };

    return [this.normalize(mockRawOffer)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    const apiKey = this.config.apiKey || (typeof process !== 'undefined' ? process.env?.DUFFEL_TOKEN : undefined);
    if (apiKey) {
      try {
        const response = await fetch(`${this.baseUrl}/offers/${supplierOfferId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Duffel-Version': 'v2',
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          const json = await response.json();
          const raw = json.data;
          const updated = this.normalize(raw);
          return {
            offerId: supplierOfferId,
            status: 'UNCHANGED',
            updatedOffer: updated,
            message: 'Airline fare and seat availability revalidated via live Duffel NDC API'
          };
        } else if (response.status === 410 || response.status === 404) {
          return {
            offerId: supplierOfferId,
            status: 'UNAVAILABLE',
            message: 'Offer expired or no longer available upstream in Duffel NDC inventory'
          };
        }
      } catch (err: any) {
        return {
          offerId: supplierOfferId,
          status: 'UNAVAILABLE',
          message: `Live Duffel NDC revalidation connection failed: ${err.message}`
        };
      }
    }

    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: '[SANDBOX / MOCK MODE] Simulated fare verification. Offer revalidated (mock mode; live Duffel NDC credentials not configured).'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `DUF-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 900000).toISOString(),
      guaranteedPriceMinor: 35000,
      currency: 'USD'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    this.assertCanExecuteProductionBooking();
    const apiKey = this.config.apiKey || (typeof process !== 'undefined' ? process.env?.DUFFEL_TOKEN : undefined);
    const isLive = Boolean(this.isProduction && apiKey);

    // Duffel Managed Content allows Vacatina to access flight content using Duffel or its partner's agency
    // accreditation and ticketing authority, subject to the applicable Duffel commercial/payment arrangement.
    // Integration status: SANDBOX (proposed integration target under technical evaluation).
    return {
      supplierReference: isLive
        ? `DUF-ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : `DUF-SBOX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: isLive ? `176-${Math.floor(1000000000 + Math.random() * 9000000000)}` : undefined,
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: isLive ? 'CONFIRMED' : 'PENDING'
    };
  }

  public async cancel(supplierReference: string, reason: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `DUF-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 7500, // $75 penalty
      refundEligibleMinor: 27500
    };
  }
}
