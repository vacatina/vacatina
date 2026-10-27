import { apiRequest } from '../../../lib/services/api-client.service.ts';
import type { JourneyConfiguration, JourneyOffer } from '../domain/journey-models.ts';
import type { TravelProductSlug } from '../../../lib/domain/types.ts';
import { journeyOfferId, validateJourneyConfiguration } from '../domain/journey-models.ts';
import { journeyMoney } from '../domain/journey-models.ts';
import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';
import type { TripBucketCandidate, TripBucketItemState } from '../../../lib/domain/types.ts';

export interface JourneySearchResponse { offers: JourneyOffer[]; totalResults: number; warnings?: string[] }
export interface JourneyRevalidation { status: string; priceChanged?: boolean; currentPrice?: number; previousPrice?: number; message?: string; checkedAt?: string }
export interface JourneyBucketItem {
  id: string; canonicalOfferId: string; title: string; productType: string; state: string;
  configuration: Record<string, unknown>; travellerManifest?: Record<string, unknown>;
  unitSellingPriceMinor: number; currency: string;
}
export interface JourneyBucket { bucketId: string; currency: string; items: JourneyBucketItem[]; readySubtotalMinor?: number; journey?: Partial<JourneyConfiguration>; bundleProductTypes?: string[] }
export type JourneyRequester = <T>(path: string, options?: RequestInit) => Promise<T>;

export class JourneyService {
  private readonly request: JourneyRequester;
  constructor(request: JourneyRequester = apiRequest) { this.request = request; }

  public async search(product: TravelProductSlug, configuration: JourneyConfiguration): Promise<JourneySearchResponse> {
    const errors = validateJourneyConfiguration(product, configuration);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const result = await this.request<JourneySearchResponse>('/api/v1/search', {
      method: 'POST', body: JSON.stringify({
        productType: product, destination: configuration.destination, origin: configuration.origin,
        departureDate: configuration.departureDate, returnDate: configuration.returnDate,
        dates: { departureDate: configuration.departureDate, returnDate: configuration.returnDate },
        passengers: { adults: configuration.adults, children: configuration.children, infants: configuration.infants },
        cabinClass: configuration.cabinClass, tripType: configuration.tripType,
        citizenshipCountry: configuration.citizenshipCountry, residenceCountry: configuration.residenceCountry, purpose: configuration.purpose,
        configuration, currency: 'LKR'
      })
    });
    return { ...result, offers: Array.isArray(result.offers) ? result.offers : [] };
  }

  public getOffer(id: string): Promise<{ offer: JourneyOffer }> {
    return this.request(`/api/v1/offers/${encodeURIComponent(id)}`);
  }

  public revalidate(id: string): Promise<JourneyRevalidation> {
    return this.request(`/api/v1/offers/${encodeURIComponent(id)}/revalidate`, { method: 'POST', body: '{}' });
  }

  public async stage(offer: JourneyOffer, configuration: JourneyConfiguration): Promise<{ success?: boolean; item: JourneyBucketItem }> {
    const errors = validateJourneyConfiguration(offer.productType, configuration, true);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    return this.request('/api/v1/trip-buckets/items', {
      method: 'POST', body: JSON.stringify({
        canonicalOfferId: journeyOfferId(offer), configuration,
        travellerManifest: { adults: configuration.adults, children: configuration.children, infants: configuration.infants }
      })
    });
  }

  public loadBucket(): Promise<JourneyBucket> { return this.request('/api/v1/trip-buckets'); }

  public saveBundle(journey: JourneyConfiguration, bundleProductTypes: string[]): Promise<JourneyBucket> {
    return this.request('/api/v1/trip-buckets', { method: 'PATCH', body: JSON.stringify({ journey, bundleProductTypes }) });
  }
}

export const journeyService = new JourneyService();

/** A display snapshot; the authenticated server remains the only checkout authority. */
export function syncServerTripBucketSnapshot(bucket: JourneyBucket): void {
  const states = new Set(['draft', 'ready', 'needs_action', 'refreshing_price', 'price_changed', 'recheck_required', 'offer_expired', 'unavailable']);
  const candidates: TripBucketCandidate[] = bucket.items.map(item => {
    const config = item.configuration || {};
    const manifest = item.travellerManifest || {};
    const state = String(item.state || '').toLowerCase();
    const localCurrency = item.currency === 'LKR';
    return {
      id: item.id, offerId: item.canonicalOfferId, productType: item.productType as TravelProductSlug,
      productLabel: item.productType.charAt(0).toUpperCase() + item.productType.slice(1), title: item.title,
      subtitle: `${String(config.destination || '')}${localCurrency ? '' : ` · ${journeyMoney(item.unitSellingPriceMinor / 100, item.currency)}`}`,
      dateSummary: `${String(config.departureDate || config.checkIn || '')}${config.returnDate || config.checkOut ? ' – ' + String(config.returnDate || config.checkOut) : ''}`,
      travellerSummary: `${Number(config.adults || manifest.adults || 1)} adults · ${Number(config.children || manifest.children || 0)} children`,
      state: localCurrency && states.has(state) ? state as TripBucketItemState : 'recheck_required',
      priceLkr: localCurrency ? item.unitSellingPriceMinor / 100 : 0,
      supplierName: 'Vacatina', integrationMode: 'ADAPTER-READY',
      holdStatusText: 'Saved selection · Availability checked again before booking',
      actionRequiredText: !localCurrency ? `Review your ${item.currency} selection and total in checkout.` : state === 'needs_action' ? 'Complete the required selection or confirmation before booking.' : undefined
    };
  });
  tripBucketService.replaceCandidates(candidates);
}

export async function refreshServerTripBucket(): Promise<void> {
  syncServerTripBucketSnapshot(await journeyService.loadBucket());
}
