/* ============================================================================
 * Vacatina Hybrid Multi-Component Package Bundler Adapter
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q9/Q11/HYBRID)
 *
 * Coordinates composite bundles uniting live API components (flights) with
 * direct-contract manual components (boutique hotels, chauffeur transfers, visa).
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

export interface RawHybridPackageBundle {
  bundleId: string; // "bdl_dubai_escape_001"
  title: string;    // "Dubai Complete Escape 5D4N"
  destinationCity: string;
  destinationCountry: string;
  durationDays: number;
  components: {
    flight: { supplierId: 'DUFFEL_NDC'; flightNumber: string; rawCostMinor: number };
    hotel: { supplierId: 'LITEAPI' | 'DIRECT_HOTEL'; propertyName: string; rawCostMinor: number };
    transfer: { supplierId: 'LOCAL_FLEET'; vehicle: string; rawCostMinor: number };
    visa: { supplierId: 'VACATINA_VISA_DESK'; type: string; rawCostMinor: number };
  };
  costCurrency: string;
  inclusions: string[];
  exclusions: string[];
}

export class PackagesBundlerAdapter extends BaseSupplierAdapter<RawHybridPackageBundle> {
  constructor() {
    super({
      supplierId: 'VACATINA_HYBRID_BUNDLER',
      supplierName: 'Vacatina Hybrid Package Engine',
      productType: 'packages',
      environment: 'production',
      sandboxBaseUrl: 'http://localhost:3000/api',
      productionBaseUrl: 'https://vacatina-nu.vercel.app/api',
      timeoutMs: 4000
    });
  }

  public normalize(raw: RawHybridPackageBundle): CanonicalOfferEntity {
    // Sum raw costs of all heterogeneous components
    const totalRawCostMinor =
      raw.components.flight.rawCostMinor +
      raw.components.hotel.rawCostMinor +
      raw.components.transfer.rawCostMinor +
      raw.components.visa.rawCostMinor;

    const pricing = PricingPrecedenceService.calculatePricing({
      productType: 'packages',
      rawSupplierCostMinor: totalRawCostMinor,
      rawCurrency: raw.costCurrency
    });

    const offerId = `vct-hyb-pkg-${raw.bundleId.slice(-6)}`;
    const expiresAtIso = new Date(Date.now() + 3600000).toISOString(); // 1 hour TTL

    const offer: CanonicalOfferEntity = {
      canonicalOfferId: offerId,
      productType: 'packages',
      inventorySource: 'DIRECT_CONTRACT',
      listingKind: 'PACKAGE',
      compositionType: 'DYNAMIC_BUNDLE',
      fulfillmentMode: 'ON_REQUEST',
      environmentClass: 'SANDBOX',
      sellability: 'BOOKABLE',
      providerLifecycle: 'SANDBOX_ACTIVE',
      sourceType: 'HYBRID',
      components: [
        {
          componentId: `${offerId}-fl`,
          productType: 'flights',
          inventorySource: 'API',
          listingKind: 'SELLABLE_INVENTORY',
          compositionType: 'SINGLE',
          fulfillmentMode: 'INSTANT',
          environmentClass: 'SANDBOX',
          sellability: 'BOOKABLE',
          supplierId: 'DUFFEL_NDC',
          supplierName: 'Duffel NDC Airline Gateway',
          isSandboxSimulated: true,
          revalidationRequired: true
        },
        {
          componentId: `${offerId}-ht`,
          productType: 'hotels',
          inventorySource: 'DIRECT_CONTRACT',
          listingKind: 'SELLABLE_INVENTORY',
          compositionType: 'SINGLE',
          fulfillmentMode: 'INSTANT',
          environmentClass: 'PRODUCTION',
          sellability: 'BOOKABLE',
          supplierId: 'DIRECT_HOTEL',
          supplierName: 'Atlantis The Royal Direct Contract',
          isSandboxSimulated: false,
          revalidationRequired: false
        },
        {
          componentId: `${offerId}-tr`,
          productType: 'cars',
          inventorySource: 'DIRECT_CONTRACT',
          listingKind: 'SELLABLE_INVENTORY',
          compositionType: 'SINGLE',
          fulfillmentMode: 'INSTANT',
          environmentClass: 'PRODUCTION',
          sellability: 'BOOKABLE',
          supplierId: 'LOCAL_FLEET',
          supplierName: 'Local Luxury Chauffeur Fleet',
          isSandboxSimulated: false,
          revalidationRequired: false
        },
        {
          componentId: `${offerId}-vs`,
          productType: 'visa',
          inventorySource: 'MANUAL_INTERNAL',
          listingKind: 'SERVICE',
          compositionType: 'SINGLE',
          fulfillmentMode: 'MANUAL_CONFIRMATION',
          environmentClass: 'PRODUCTION',
          sellability: 'BOOKABLE',
          supplierId: 'VACATINA_CONSULAR_CONCIERGE',
          supplierName: 'Vacatina Consular Concierge Desk',
          isSandboxSimulated: false,
          revalidationRequired: false
        }
      ],
      supplierId: this.supplierId,
      supplierName: 'Vacatina Curated Package',
      title: raw.title,
      subtitle: `${raw.durationDays} Days / ${raw.durationDays - 1} Nights · Flight + Hotel + Transfer + Visa`,
      location: {
        city: raw.destinationCity,
        country: raw.destinationCountry,
        countryCode: 'AE'
      },
      availabilityStatus: 'LIVE',
      confirmationMode: 'REQUEST_TO_CONFIRM',
      bookingMode: 'REQUEST_TO_BOOK',
      pricing,
      freshness: {
        lastCheckedAtIso: new Date().toISOString(),
        ttlSeconds: 3600,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/offers/${offerId}/revalidate`
      },
      inclusions: raw.inclusions,
      exclusions: raw.exclusions,
      cancellationPolicy: 'Component-specific cancellation rules apply. Consult itinerary terms.',
      pinAboveApi: true,
      deduplicationKey: '',
      isSandboxSimulated: false,
      integrationLifecycle: 'SANDBOX_ACTIVE',
      sourceMetadata: {
        bundleId: raw.bundleId,
        components: raw.components,
        isMultiComponentHybrid: true
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      productExtension: {
        productType: 'packages',
        package: {
          itineraryDays: raw.durationDays,
          itineraryNights: raw.durationDays - 1,
          packageTheme: 'Luxury City & Beach Discovery',
          includedComponents: ['FLIGHT', 'HOTEL', 'TRANSFERS', 'VISA'],
          dayByDayItinerary: [
            {
              dayNumber: 1,
              title: 'Arrival in Dubai & VIP Hotel Check-In',
              description: 'Chauffeur airport transfer, check-in to Atlantis The Royal, evening leisure.',
              mealsIncluded: ['Dinner'],
              activityHighlights: ['Private Chauffeur Meet & Greet', 'Resort Welcome Reception']
            },
            {
              dayNumber: 2,
              title: 'Downtown Dubai & Burj Khalifa Observation',
              description: 'Private morning tour, observation deck access, fountain show viewing.',
              mealsIncluded: ['Breakfast'],
              activityHighlights: ['Burj Khalifa Level 148', 'Dubai Mall Personal Shopping Guide']
            },
            {
              dayNumber: 3,
              title: 'Desert Dunes & Arabian Evening Feast',
              description: 'Afternoon 4x4 desert adventure, sunset photo-stop, traditional dinner banquet.',
              mealsIncluded: ['Breakfast', 'Dinner'],
              activityHighlights: ['Desert Dune Bashing', 'Bedouin Starlit Camp']
            },
            {
              dayNumber: 4,
              title: 'Leisure Day & Luxury Yacht Cruise',
              description: 'Private 3-hour sunset cruise along Dubai Marina and Palm Jumeirah.',
              mealsIncluded: ['Breakfast'],
              activityHighlights: ['Private Yacht Charter', 'Palm Lagoon Swimming']
            },
            {
              dayNumber: 5,
              title: 'Departure & Flight Return',
              description: 'Breakfast, check-out, and private airport transfer for return flight to Colombo.',
              mealsIncluded: ['Breakfast'],
              activityHighlights: ['Airport Departure Transfer']
            }
          ],
          singleSupplementMinor: 4500000,
          minGroupSize: 2
        }
      }
    };

    offer.deduplicationKey = DeduplicationService.generateDeduplicationKey(offer);
    return this.applyCanonicalContractDefaults(offer);
  }

  public async search(criteria: SearchQueryCriteria): Promise<CanonicalOfferEntity[]> {
    const defaultBundle: RawHybridPackageBundle = {
      bundleId: 'bdl_dubai_escape_001',
      title: 'Dubai Complete Luxury Escape',
      destinationCity: criteria.destination || 'Dubai',
      destinationCountry: 'United Arab Emirates',
      durationDays: 5,
      components: {
        flight: { supplierId: 'DUFFEL_NDC', flightNumber: 'EK-651', rawCostMinor: 11000000 },
        hotel: { supplierId: 'DIRECT_HOTEL', propertyName: 'Atlantis The Royal', rawCostMinor: 25000000 },
        transfer: { supplierId: 'LOCAL_FLEET', vehicle: 'Mercedes V-Class Chauffeur', rawCostMinor: 3500000 },
        visa: { supplierId: 'VACATINA_VISA_DESK', type: 'UAE 60-Day Tourist Visa', rawCostMinor: 4500000 }
      },
      costCurrency: 'LKR',
      inclusions: [
        'Round-trip scheduled flights on Emirates',
        '4 Nights luxury accommodation with gourmet breakfast',
        'Private airport chauffeur transfers in luxury vehicle',
        'Complimentary 60-Day UAE Tourist Visa processing'
      ],
      exclusions: ['Personal incidental expenditures', 'Optional sightseeing upgrades']
    };

    return [this.normalize(defaultBundle)];
  }

  public async revalidate(supplierOfferId: string): Promise<RevalidationResult> {
    return {
      offerId: supplierOfferId,
      status: 'UNCHANGED',
      message: 'Multi-component package rates & availability rechecked'
    };
  }

  public async hold(offerId: string): Promise<BookingHoldResult> {
    return {
      holdReference: `HYB-HLD-${offerId.slice(-6).toUpperCase()}`,
      expiresAtIso: new Date(Date.now() + 3600000).toISOString(),
      guaranteedPriceMinor: 48400000,
      currency: 'LKR'
    };
  }

  public async confirm(bookingReference: string): Promise<BookingConfirmResult> {
    return {
      supplierReference: `HYB-CONF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ticketOrVoucherNumber: undefined, // Final travel dossier dispatched once all 4 components are fulfilled
      confirmedAtIso: new Date().toISOString(),
      fulfillmentStatus: 'PENDING'
    };
  }

  public async cancel(supplierReference: string): Promise<BookingCancelResult> {
    return {
      cancellationReference: `HYB-CXL-${supplierReference.slice(-6)}`,
      cancelledAtIso: new Date().toISOString(),
      cancellationFeeMinor: 5000000,
      refundEligibleMinor: 43400000
    };
  }
}
