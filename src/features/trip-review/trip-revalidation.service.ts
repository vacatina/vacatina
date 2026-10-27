import { tripBucketService } from '../../lib/services/trip-bucket.service.ts';
import { flightTripBucketService } from '../flights/services/flight-trip-bucket.service.ts';
import { hotelSearchService } from '../hotels/services/hotel-search.service.ts';
import { visaSearchService } from '../visa/services/visa-search.service.ts';
import { journeyService } from '../journeys/services/journey-service.ts';

/** Product-aware local checks only. Never confirms a supplier allocation or enables payment. */
export async function revalidateStagedTrip(): Promise<void> {
  for (const item of tripBucketService.getItems()) {
    if (item.productType === 'flights' && item.offerId && item.inventoryMode) {
      await flightTripBucketService.revalidateFlightInTripBucket(item.id, item.offerId);
      continue;
    }
    let valid = false;
    let status = 'SERVER_RECHECK_REQUIRED';
    if (item.productType === 'hotels' && item.propertyId && item.roomId && item.ratePlanId) {
      const result = await hotelSearchService.revalidate(item.propertyId, item.roomId, item.ratePlanId);
      valid = result.isAvailable; status = `LOCAL_FIXTURE_${result.status}`;
    } else if (item.productType === 'visa' && item.offerId && item.inventoryMode) {
      valid = !!await visaSearchService.getOfferById(item.offerId); status = valid ? 'LOCAL_CATALOG_CHECK' : 'UNAVAILABLE';
    } else if (item.offerId?.startsWith('DEMO-')) {
      const result = await journeyService.revalidate(item.offerId);
      valid = result.status === 'UNCHANGED'; status = `LOCAL_FIXTURE_${result.status}`;
    }
    const nonLive = item.inventoryMode === 'demo_fixture' || item.inventoryMode === 'manual_request';
    tripBucketService.replaceCandidates(tripBucketService.getItems().map(current => current.id !== item.id ? current : {
      ...current,
      state: nonLive ? valid ? 'needs_action' : 'unavailable' : 'recheck_required',
      revalidationStatus: status, revalidatedAt: new Date().toISOString(),
      holdStatusText: 'Local check only · No supplier reservation hold',
      actionRequiredText: nonLive ? 'Current price, availability and operator confirmation still required. No supplier request was sent.' : 'Open authenticated server checkout to recheck this saved selection. A browser check cannot confirm it.'
    }));
  }
}
