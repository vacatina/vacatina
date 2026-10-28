/* ============================================================================
 * Vacatina Hotel Trip Bucket Integration Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Transforms CanonicalHotelOffer + HotelSelectedConfiguration into TripBucketCandidate.
 * 2. Enforces the canonical 8-state Trip Bucket candidate engine.
 * 3. Never stages SEED items; only bookable manual/API inventory.
 * ============================================================================ */

import type {
  TripBucketCandidate,
  TripBucketItemState
} from '../../../lib/domain/types.ts';
import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';
import type {
  CanonicalHotelOffer,
  HotelSelectedConfiguration
} from '../domain/hotel-models.ts';
import { hotelSearchService } from './hotel-search.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { HOTEL_DEMO_DISCLOSURE, validateHotelConfiguration } from '../domain/hotel-journey.ts';

export class HotelTripBucketService {
  public mapHotelOfferToTripCandidate(
    hotel: CanonicalHotelOffer,
    config: HotelSelectedConfiguration,
    overrideState?: TripBucketItemState
  ): TripBucketCandidate {
    const priceLkr = Math.round(config.totalPriceMinor / 100);
    const title = `${hotel.name} (${hotel.starRating}★)`;
    const subtitle = `${config.roomName} · ${config.boardBasisLabel} (${config.nights} Night${config.nights > 1 ? 's' : ''})`;
    const dateSummary = `${config.checkInDate} — ${config.checkOutDate}`;
    const travellerSummary = `${config.roomsCount} Room${config.roomsCount > 1 ? 's' : ''} · ${config.adultsCount} Adult${config.adultsCount > 1 ? 's' : ''}${config.childrenCount > 0 ? ` · ${config.childrenCount} Child${config.childrenCount > 1 ? 'ren' : ''}` : ''}`;

    let state: TripBucketItemState = overrideState || 'ready';
    let holdStatusText = 'Room allotment held for 15 minutes upon confirmation';
    let actionRequiredText: string | undefined;
    let primaryActionLabel = 'Modify Room';

    if (overrideState) {
      state = overrideState;
    } else if (hotel.availabilityStatus === 'PRICE_CHANGED') {
      state = 'price_changed';
      actionRequiredText = 'Upstream room rate adjusted by hotel bedbank';
      primaryActionLabel = 'Accept New Rate';
      holdStatusText = 'Rate adjustment pending guest confirmation';
    } else if (hotel.availabilityStatus === 'EXPIRED') {
      state = 'offer_expired';
      actionRequiredText = 'Room rate hold has expired';
      primaryActionLabel = 'Find Alternative Room';
      holdStatusText = 'Expired';
    } else if (hotel.availabilityStatus === 'UNAVAILABLE') {
      state = 'unavailable';
      actionRequiredText = 'Selected room category is sold out';
      primaryActionLabel = 'Select Another Property';
      holdStatusText = 'Sold out';
    }

    if (hotel.inventoryMode && hotel.inventoryMode !== 'live_supplier') {
      if (state === 'ready' || state === 'draft') state = 'needs_action';
      holdStatusText = 'Local fixture check only · No room hold';
      actionRequiredText = 'Request a verified room/rate quote and hotel confirmation before booking.';
      primaryActionLabel = 'Review hotel request';
    }
    return {
      id: `tb-${hotel.canonicalOfferId}-${config.roomId}-${config.planId}`,
      productType: 'hotels',
      productLabel: 'Hotel Stay',
      title,
      subtitle,
      dateSummary,
      travellerSummary,
      priceLkr,
      state,
      actionRequiredText,
      primaryActionLabel,
      holdStatusText,
      supplierName: hotel.supplierName,
      integrationMode: hotel.sourceType === 'MANUAL' ? 'ADAPTER-READY' : 'MOCK',
      offerId: hotel.canonicalOfferId,
      sourceType: hotel.sourceType,
      confirmationMode: hotel.inventoryMode ? 'REQUEST_TO_CONFIRM' : 'INSTANT_CONFIRM',
      canonicalOfferId: hotel.canonicalOfferId,
      sourceId: hotel.providerId,
      propertyId: hotel.hotelId,
      roomId: config.roomId,
      ratePlanId: config.planId,
      inventoryMode: hotel.inventoryMode,
      inventoryLabel: hotel.inventoryMode ? 'Planning reference' : undefined,
      truthDisclosure: hotel.inventoryMode ? HOTEL_DEMO_DISCLOSURE : undefined,
      providerName: `${hotel.supplierName}${hotel.inventoryMode ? ' (fixture reference only)' : ''}`,
      currency: config.currency,
      configuration: { ...config },
      availabilityStatus: hotel.inventoryMode ? 'ON_REQUEST' : hotel.availabilityStatus,
      lastCheckedAt: hotel.lastCheckedAt,
      validUntil: hotel.validUntil,
      revalidationStatus: 'NOT_REVALIDATED',
      rawSupplierPrice: config.nightlyRateMinor / 100,
      supplierBaseCurrency: config.currency
    };
  }

  public async stageHotelRoom(
    hotel: CanonicalHotelOffer,
    config: HotelSelectedConfiguration
  ): Promise<{ candidate: TripBucketCandidate; success: boolean }> {
    validateHotelConfiguration(hotel, config);
    hotel = { ...hotel, inventoryMode: hotel.inventoryMode || 'demo_fixture' };
    // 1. Mandatory Pre-Staging Revalidation Guard
    const reval = await hotelSearchService.revalidate(
      hotel.hotelId,
      config.roomId,
      config.planId
    );

    let state: TripBucketItemState = 'needs_action';
    const checkedTotal = reval.newPriceMinor * config.nights * config.roomsCount;
    if (!reval.isAvailable) {
      state = reval.status === 'EXPIRED' ? 'offer_expired' : 'unavailable';
    } else if (checkedTotal !== config.totalPriceMinor) {
      state = 'price_changed';
      config = { ...config, totalPriceMinor: checkedTotal };
    }

    const candidate = this.mapHotelOfferToTripCandidate(hotel, config, state);
    candidate.revalidationStatus = `LOCAL_FIXTURE_${reval.status}`;
    candidate.revalidatedAt = reval.revalidatedAt;
    tripBucketService.stageCandidate(candidate);

    telemetry.track('hotel_room_staged_in_trip_bucket', {
      hotelId: hotel.hotelId,
      roomId: config.roomId,
      planId: config.planId,
      priceMinor: config.totalPriceMinor,
      state
    });

    return { candidate, success: reval.isAvailable };
  }
}

export const hotelTripBucketService = new HotelTripBucketService();
