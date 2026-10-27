/* ============================================================================
 * Vacatina Canonical Inventory Normalizer Service
 * Authority: Vacatina Hybrid Inventory Strategy v1.0 — Normalization Layer
 *
 * Responsibilities:
 * 1. Converts heterogeneous upstream data shapes (GDS, NDC, API Hub, Payload CMS)
 *    into the single authoritative VacatinaNormalizedOffer contract.
 * 2. Shields frontend search results, detail views, and the Trip Bucket from
 *    provider-specific anomalies.
 * 3. Enforces stable canonical IDs (e.g. 'vct-fl-api-amadeus-cmb-dxb-001'), never titles.
 * 4. Determines truthful confirmation modes and booking fulfillment routing.
 * ============================================================================ */

import type { SupportedCurrency, TravelProductSlug } from '../domain/types.ts';
import type {
  AvailabilityState,
  ConfirmationMode,
  FulfillmentRoutingMethod,
  InventorySourceType,
  StructuredLocation,
  VacatinaNormalizedOffer
} from '../domain/inventory-models.ts';
import { PricingEngineService } from './pricing-engine.service.ts';

/**
 * Shape of a raw API GDS/NDC flight offer from Vacatina API Hub.
 */
export interface RawApiFlightPayload {
  gdsProvider: 'AMADEUS' | 'SABRE' | 'DUFFEL_NDC';
  gdsOfferId: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  originIata: string;
  originCity: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  departureDateTimeIso: string;
  arrivalDateTimeIso: string;
  cabinClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  durationMinutes: number;
  rawFareAmount: number;
  fareCurrency: SupportedCurrency;
  instantTicketingEligible: boolean;
  ttlSeconds?: number;
  inclusions?: string[];
  baggageAllowance?: string;
}

/**
 * Shape of a raw API hotel offer (e.g. LiteAPI).
 */
export interface RawApiHotelPayload {
  provider: 'LITEAPI' | 'EXPEDIA_PARTNER' | 'HOTELBEDS';
  providerPropertyId: string;
  providerRateId: string;
  propertyName: string;
  city: string;
  country: string;
  countryCode: string;
  roomType: string;
  boardBasis: string;
  netRateAmount: number;
  rateCurrency: SupportedCurrency;
  instantConfirmation: boolean;
  cancellationDeadlineIso?: string;
  amenities?: string[];
}

/**
 * Shape of a manual listing from Payload CMS / Admin portal.
 */
export interface RawManualCmsPayload {
  cmsCollection:
    | 'manual-charter-flights'
    | 'contracted-boutique-hotels'
    | 'visa-assistance-services'
    | 'curated-holiday-packages'
    | 'local-cars-transfers'
    | 'contracted-activities'
    | 'heritage-sightseeing-tours'
    | 'scenic-rail-journeys'
    | 'niche-cruises'
    | 'insurance-policies';
  cmsListingId: string;
  productType: TravelProductSlug;
  partnerSupplierId: string;
  partnerName: string;
  title: string;
  subtitle: string;
  location: StructuredLocation;
  confirmationMode: ConfirmationMode;
  availableQuota: number;
  isBlackedOut?: boolean;
  contractedBaseCost: number;
  costCurrency: SupportedCurrency;
  standardSellingPriceLkr?: number;
  validFromIso: string;
  validUntilIso: string;
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  requiresSpecialistReview?: boolean;
}

/**
 * Shape of a hybrid bundle package combining API and manual components.
 */
export interface RawHybridBundlePayload {
  bundleId: string;
  title: string;
  destination: StructuredLocation;
  durationDays: number;
  apiFlightComponent: RawApiFlightPayload;
  manualHotelComponent: RawManualCmsPayload;
  manualTransferComponent?: RawManualCmsPayload;
  inclusions: string[];
  exclusions: string[];
  validUntilIso: string;
}

export class InventoryNormalizerService {
  /**
   * Normalizes an API flight offer into a canonical Vacatina offer.
   */
  public static normalizeApiFlight(raw: RawApiFlightPayload): VacatinaNormalizedOffer {
    const offerId = `vct-fl-${raw.gdsProvider.toLowerCase()}-${raw.originIata.toLowerCase()}-${raw.destinationIata.toLowerCase()}-${raw.gdsOfferId.slice(-6)}`;
    const nowIso = new Date().toISOString();
    const ttlSeconds = raw.ttlSeconds || 1200; // 20-minute default TTL for flight GDS offers
    const expiresAtIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const pricing = PricingEngineService.calculatePricing({
      supplierRawBasePrice: raw.rawFareAmount,
      supplierBaseCurrency: raw.fareCurrency,
      markup: {
        type: 'PERCENTAGE',
        value: 6.5,
        ruleId: 'AIR_STANDARD_GDS_MARGIN',
        ruleDescription: 'Standard 6.5% Airline GDS Markup'
      },
      customerDisplayCurrency: 'LKR'
    });

    return {
      offerId,
      productType: 'flights',
      sourceType: 'API',
      supplierId: raw.gdsProvider,
      supplierName: `${raw.airlineName} (${raw.gdsProvider})`,
      supplierOfferId: raw.gdsOfferId,
      title: `${raw.originCity} (${raw.originIata}) to ${raw.destinationCity} (${raw.destinationIata})`,
      subtitle: `${raw.airlineName} · ${raw.cabinClass} · Direct / Scheduled`,
      location: {
        city: raw.destinationCity,
        country: raw.destinationCountry,
        countryCode: raw.destinationCountry.slice(0, 2).toUpperCase(),
        iataCode: raw.destinationIata
      },
      configurationRequirements: {
        datesRequired: true,
        passengersRequired: true,
        roomConfigurationRequired: false,
        cabinClassRequired: true,
        pickupDropoffRequired: false,
        visaApplicantDetailsRequired: false,
        specialRequestsAllowed: true
      },
      availabilityStatus: 'LIVE',
      confirmationMode: raw.instantTicketingEligible ? 'INSTANT_CONFIRM' : 'REQUEST_TO_CONFIRM',
      pricing,
      freshness: {
        lastCheckedAtIso: nowIso,
        ttlSeconds,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/flights/revalidate/${encodeURIComponent(raw.gdsOfferId)}`
      },
      cancellationTermsReference: 'Carrier fare rules apply. Non-refundable standard fare, changes subject to airline penalty.',
      inclusions: raw.inclusions || [
        `Cabin baggage allowance included`,
        raw.baggageAllowance || '23kg checked luggage',
        'Standard seat assignment during check-in'
      ],
      exclusions: ['In-flight Wi-Fi premium packages', 'Speciality extra legroom seats (available during check-in)'],
      sourceMetadata: {
        airlineCode: raw.airlineCode,
        flightNumber: raw.flightNumber,
        departureTime: raw.departureDateTimeIso,
        arrivalTime: raw.arrivalDateTimeIso
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      fulfillmentRouting: {
        fulfillmentMethod: 'SUPPLIER_API',
        workflowQueue: 'gds-automated-ticketing',
        slaMinutes: 15,
        autoTicketEligible: raw.instantTicketingEligible,
        requiresPassportDetails: true,
        requiresSpecialistReview: false
      }
    };
  }

  /**
   * Normalizes an API hotel offer into a canonical Vacatina offer.
   */
  public static normalizeApiHotel(raw: RawApiHotelPayload): VacatinaNormalizedOffer {
    const offerId = `vct-ht-${raw.provider.toLowerCase()}-${raw.countryCode.toLowerCase()}-${raw.providerRateId.slice(-6)}`;
    const nowIso = new Date().toISOString();
    const ttlSeconds = 1800; // 30-minute default TTL
    const expiresAtIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const pricing = PricingEngineService.calculatePricing({
      supplierRawBasePrice: raw.netRateAmount,
      supplierBaseCurrency: raw.rateCurrency,
      markup: {
        type: 'PERCENTAGE',
        value: 12.0,
        ruleId: 'HOTEL_B2C_API_MARGIN',
        ruleDescription: 'Standard 12% Hotel B2C Distribution Markup'
      },
      customerDisplayCurrency: 'LKR'
    });

    return {
      offerId,
      productType: 'hotels',
      sourceType: 'API',
      supplierId: raw.provider,
      supplierName: `${raw.propertyName} via ${raw.provider}`,
      supplierOfferId: raw.providerRateId,
      title: raw.propertyName,
      subtitle: `${raw.roomType} · ${raw.boardBasis}`,
      location: {
        city: raw.city,
        country: raw.country,
        countryCode: raw.countryCode
      },
      configurationRequirements: {
        datesRequired: true,
        passengersRequired: true,
        roomConfigurationRequired: true,
        cabinClassRequired: false,
        pickupDropoffRequired: false,
        visaApplicantDetailsRequired: false,
        specialRequestsAllowed: true
      },
      availabilityStatus: 'LIVE',
      confirmationMode: raw.instantConfirmation ? 'INSTANT_CONFIRM' : 'REQUEST_TO_CONFIRM',
      pricing,
      freshness: {
        lastCheckedAtIso: nowIso,
        ttlSeconds,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/hotels/revalidate/${encodeURIComponent(raw.providerRateId)}`
      },
      cancellationTermsReference: raw.cancellationDeadlineIso
        ? `Free cancellation until ${raw.cancellationDeadlineIso.slice(0, 10)}.`
        : 'Non-refundable tariff block.',
      inclusions: raw.amenities || [
        `${raw.boardBasis} included`,
        'High-speed complimentary Wi-Fi',
        'Air-conditioned accommodation'
      ],
      exclusions: ['City tourism tax payable directly at property', 'Early check-in / late check-out fees'],
      sourceMetadata: {
        propertyId: raw.providerPropertyId,
        rateId: raw.providerRateId
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      fulfillmentRouting: {
        fulfillmentMethod: 'SUPPLIER_API',
        workflowQueue: 'hotel-channel-reservations',
        slaMinutes: 30,
        autoTicketEligible: raw.instantConfirmation,
        requiresPassportDetails: false,
        requiresSpecialistReview: false
      }
    };
  }

  /**
   * Normalizes a manual Payload CMS catalog listing into a canonical Vacatina offer.
   */
  public static normalizeManualCmsListing(raw: RawManualCmsPayload): VacatinaNormalizedOffer {
    const offerId = `vct-${raw.productType.slice(0, 2)}-manual-${raw.partnerSupplierId.toLowerCase()}-${raw.cmsListingId}`;
    const nowIso = new Date().toISOString();
    const ttlSeconds = 86400; // 24-hour cache TTL for manual contracted inventory
    const expiresAtIso = raw.validUntilIso || new Date(Date.now() + 86400 * 1000 * 30).toISOString();

    // Determine availability status based on CMS quota and blackout
    let availabilityStatus: AvailabilityState = 'MANUAL_AVAILABLE';
    if (raw.isBlackedOut) {
      availabilityStatus = 'UNAVAILABLE';
    } else if (raw.availableQuota <= 0) {
      availabilityStatus = raw.confirmationMode === 'REQUEST_TO_CONFIRM' ? 'ON_REQUEST' : 'SOLD_OUT';
    }

    // Pricing calculation: If CMS administrator defined a custom selling price override
    let manualOverrideInput = undefined;
    if (raw.standardSellingPriceLkr && raw.standardSellingPriceLkr > 0) {
      manualOverrideInput = {
        overrideId: `cms-def-${raw.cmsListingId}`,
        newValueLkr: raw.standardSellingPriceLkr,
        overrideReason: 'Payload CMS Administrator Published Rate',
        authorizedByUserId: 'payload-admin-01',
        authorizedByName: 'Vacatina Product Team'
      };
    }

    const pricing = PricingEngineService.calculatePricing({
      supplierRawBasePrice: raw.contractedBaseCost,
      supplierBaseCurrency: raw.costCurrency,
      markup: {
        type: 'PERCENTAGE',
        value: 10.0,
        ruleId: 'MANUAL_CONTRACT_MARGIN',
        ruleDescription: 'Direct Contract Partner Commercial Margin'
      },
      manualOverride: manualOverrideInput,
      customerDisplayCurrency: 'LKR'
    });

    // Map fulfillment method based on product type & confirmation mode
    let fulfillmentMethod: FulfillmentRoutingMethod = 'MANUAL_INVENTORY';
    let workflowQueue = 'manual-inventory-allocation';

    if (raw.productType === 'visa') {
      fulfillmentMethod = 'ASSISTED_SERVICE_CASE';
      workflowQueue = 'consular-desk-applications';
    } else if (raw.confirmationMode === 'REQUEST_TO_CONFIRM') {
      fulfillmentMethod = 'ON_REQUEST_DISPATCH';
      workflowQueue = 'concierge-partner-liaison';
    }

    return {
      offerId,
      productType: raw.productType,
      sourceType: 'MANUAL',
      supplierId: raw.partnerSupplierId,
      supplierName: raw.partnerName,
      manualListingId: raw.cmsListingId,
      title: raw.title,
      subtitle: raw.subtitle,
      location: raw.location,
      configurationRequirements: {
        datesRequired: true,
        passengersRequired: true,
        roomConfigurationRequired: raw.productType === 'hotels',
        cabinClassRequired: raw.productType === 'flights' || raw.productType === 'rails',
        pickupDropoffRequired: raw.productType === 'cars',
        visaApplicantDetailsRequired: raw.productType === 'visa',
        specialRequestsAllowed: true
      },
      availabilityStatus,
      confirmationMode: raw.confirmationMode,
      pricing,
      freshness: {
        lastCheckedAtIso: nowIso,
        ttlSeconds,
        expiresAtIso,
        isStale: false,
        revalidationEndpoint: `/api/v1/cms/revalidate/${encodeURIComponent(raw.cmsListingId)}`
      },
      cancellationTermsReference: raw.cancellationPolicy,
      inclusions: raw.inclusions,
      exclusions: raw.exclusions,
      sourceMetadata: {
        collection: raw.cmsCollection,
        listingId: raw.cmsListingId,
        availableQuota: raw.availableQuota
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: false,
        lastRevalidationResult: 'UNCHANGED'
      },
      fulfillmentRouting: {
        fulfillmentMethod,
        workflowQueue,
        slaMinutes: raw.confirmationMode === 'REQUEST_TO_CONFIRM' ? 120 : 15,
        autoTicketEligible: raw.confirmationMode === 'INSTANT_CONFIRM',
        requiresPassportDetails: raw.productType === 'visa' || raw.productType === 'flights',
        requiresSpecialistReview: Boolean(raw.requiresSpecialistReview)
      }
    };
  }

  /**
   * Normalizes a dynamic hybrid package composed of API Flight + Manual Hotel.
   */
  public static normalizeHybridBundle(raw: RawHybridBundlePayload): VacatinaNormalizedOffer {
    const offerId = `vct-pk-hybrid-${raw.destination.city.toLowerCase()}-${raw.bundleId}`;
    const nowIso = new Date().toISOString();

    const flightNorm = this.normalizeApiFlight(raw.apiFlightComponent);
    const hotelNorm = this.normalizeManualCmsListing(raw.manualHotelComponent);

    // Sum base costs and apply package bundling discount
    const combinedBaseCostLkr = flightNorm.pricing.supplierBasePriceLkr + hotelNorm.pricing.supplierBasePriceLkr;
    const bundledRawPrice = Math.round(combinedBaseCostLkr * 0.96); // 4% bundle supplier optimization

    const pricing = PricingEngineService.calculatePricing({
      supplierRawBasePrice: bundledRawPrice,
      supplierBaseCurrency: 'LKR',
      markup: {
        type: 'PERCENTAGE',
        value: 10.0,
        ruleId: 'HYBRID_BUNDLE_PACKAGE_MARGIN',
        ruleDescription: 'Vacatina Curated Dynamic Bundle Margin'
      },
      customerDisplayCurrency: 'LKR'
    });

    return {
      offerId,
      productType: 'packages',
      sourceType: 'HYBRID',
      supplierId: 'VACATINA_BUNDLE_ENGINE',
      supplierName: 'Vacatina Unified Curated Journey',
      title: raw.title,
      subtitle: `${raw.durationDays} Days · Return Flights (${raw.apiFlightComponent.airlineName}) + ${raw.manualHotelComponent.partnerName}`,
      location: raw.destination,
      configurationRequirements: {
        datesRequired: true,
        passengersRequired: true,
        roomConfigurationRequired: true,
        cabinClassRequired: true,
        pickupDropoffRequired: Boolean(raw.manualTransferComponent),
        visaApplicantDetailsRequired: false,
        specialRequestsAllowed: true
      },
      availabilityStatus: 'LIVE',
      confirmationMode: 'REQUEST_TO_CONFIRM', // Packages requiring concierge component coordination
      pricing,
      freshness: {
        lastCheckedAtIso: nowIso,
        ttlSeconds: 1200,
        expiresAtIso: new Date(Date.now() + 1200 * 1000).toISOString(),
        isStale: false
      },
      cancellationTermsReference: 'Package cancellation tier: 90% refundable up to 14 days before departure.',
      inclusions: raw.inclusions,
      exclusions: raw.exclusions,
      sourceMetadata: {
        apiFlightOfferId: flightNorm.offerId,
        manualHotelListingId: hotelNorm.offerId,
        componentsCount: raw.manualTransferComponent ? 3 : 2
      },
      revalidationCapability: {
        canRevalidateOnline: true,
        requiresSupplierPing: true,
        lastRevalidationResult: 'UNCHANGED'
      },
      fulfillmentRouting: {
        fulfillmentMethod: 'ON_REQUEST_DISPATCH',
        workflowQueue: 'concierge-bundle-orchestration',
        slaMinutes: 60,
        autoTicketEligible: false,
        requiresPassportDetails: true,
        requiresSpecialistReview: true
      }
    };
  }
}
