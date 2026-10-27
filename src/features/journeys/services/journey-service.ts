import { apiRequest } from '../../../lib/services/api-client.service.ts';
import type { JourneyConfiguration, JourneyOffer } from '../domain/journey-models.ts';
import type { TravelProductSlug } from '../../../lib/domain/types.ts';
import { journeyOfferId, journeyProductDetails, validateJourneyConfiguration } from '../domain/journey-models.ts';
import { getDemoJourneyOffer, searchDemoJourneyOffers, JOURNEY_DEMO_DISCLOSURE } from '../data/demo-offers.ts';
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

  public async search(product: TravelProductSlug, configuration: JourneyConfiguration, inventoryMode?: 'demo_fixture'): Promise<JourneySearchResponse> {
    const errors = validateJourneyConfiguration(product, configuration);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    if (inventoryMode === 'demo_fixture') {
      const offers = searchDemoJourneyOffers(product, configuration);
      return { offers, totalResults: offers.length };
    }
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
    if (id.startsWith('DEMO-')) {
      const offer = getDemoJourneyOffer(id);
      return offer ? Promise.resolve({ offer }) : Promise.reject(new Error('This demo option was not found. No reservation or payment was created.'));
    }
    return this.request(`/api/v1/offers/${encodeURIComponent(id)}`);
  }

  public revalidate(id: string): Promise<JourneyRevalidation> {
    if (id.startsWith('DEMO-')) return Promise.resolve({ status: getDemoJourneyOffer(id) ? 'UNCHANGED' : 'UNAVAILABLE', message: 'Local fixture checked only. Availability, price and operator confirmation are not verified.', checkedAt: new Date().toISOString() });
    return this.request(`/api/v1/offers/${encodeURIComponent(id)}/revalidate`, { method: 'POST', body: '{}' });
  }

  public async stage(offer: JourneyOffer, configuration: JourneyConfiguration): Promise<{ success?: boolean; item: JourneyBucketItem }> {
    const errors = validateJourneyConfiguration(offer.productType, configuration, true);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    if (offer.inventoryMode === 'demo_fixture' || journeyOfferId(offer).startsWith('DEMO-')) {
      const canonical = getDemoJourneyOffer(journeyOfferId(offer));
      if (!canonical || canonical.productType !== offer.productType) throw new Error('Choose a canonical demo option for this product.');
      if (!`${canonical.location?.city || ''} ${canonical.location?.country || ''}`.toLowerCase().includes(configuration.destination.toLowerCase().trim())) throw new Error('The destination does not match this option. Search again.');
      if (canonical.productType === 'rails' && String(journeyProductDetails(canonical).originStation || '').toLowerCase() !== configuration.origin.toLowerCase().trim()) throw new Error('The departure station does not match this rail option. Search again.');
      validatePublishedJourneySelection(canonical, configuration);
      const candidate: TripBucketCandidate = {
        id: `tb-${journeyOfferId(canonical)}`, offerId: journeyOfferId(canonical), canonicalOfferId: journeyOfferId(canonical),
        productType: canonical.productType, productLabel: canonical.productType === 'sightseeing' ? 'Sightseeing Tour' : canonical.productType,
        title: canonical.title, subtitle: 'Local planning request · Quote and operator confirmation required', dateSummary: `${configuration.departureDate}${configuration.returnDate ? ` – ${configuration.returnDate}` : ''}`,
        travellerSummary: `${configuration.adults} adults · ${configuration.children} children · ${configuration.infants} infants`,
        configuration: { ...configuration }, priceLkr: 0, currency: canonical.currency, state: 'needs_action',
        inventoryMode: 'demo_fixture', inventoryLabel: 'Canonical demo fixture · Not live inventory', truthDisclosure: JOURNEY_DEMO_DISCLOSURE,
        sourceType: 'MANUAL', sourceId: canonical.sourceId, providerName: canonical.providerName, supplierName: canonical.providerName || 'Local demo catalog', integrationMode: 'MOCK',
        confirmationMode: 'REQUEST_TO_CONFIRM', availabilityStatus: 'ON_REQUEST', revalidationStatus: 'LOCAL_FIXTURE_CHECK', revalidatedAt: new Date().toISOString(),
        lastCheckedAt: canonical.lastCheckedAt, validUntil: canonical.offerExpiresAt, primaryActionLabel: 'Review operator request',
        actionRequiredText: 'No live quote, allocation or confirmation exists. Request current details before booking.', holdStatusText: 'No reservation hold'
      };
      tripBucketService.stageCandidate(candidate);
      return { success: true, item: { id: candidate.id, canonicalOfferId: journeyOfferId(canonical), title: canonical.title, productType: canonical.productType, state: 'NEEDS_ACTION', configuration: { ...configuration }, unitSellingPriceMinor: 0, currency: canonical.currency || 'LKR' } };
    }
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

/** Only a published option can be selected; a text value is not proof of availability. */
export function validatePublishedJourneySelection(offer: JourneyOffer, config: JourneyConfiguration): void {
  const details = journeyProductDetails(offer);
  if (offer.productType === 'insurance' && !config.policyReviewAcknowledged) throw new Error('Acknowledge that this demo request does not provide insurance cover.');
  for (const [source, key] of [['packageStyles', 'packageStyle'], ['accommodationTiers', 'accommodationTier'], ['vehicleCategories', 'vehicleCategory'], ['ticketTypes', 'ticketType'], ['timeSlots', 'timeSlot'], ['languages', 'language'], ['cabinCategories', 'cabinType'], ['coverageOptions', 'coverageOption'], ['travelClasses', 'cabinClass']] as const) {
    const options = details[source];
    if (!Array.isArray(options) || !options.length) continue;
    const ids = options.map(value => typeof value === 'string' ? value : String(value.id || value.code || value.value));
    if (!ids.includes(String(config[key] || ''))) throw new Error(`Select a published ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} option.`);
  }
}

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
  const local = tripBucketService.getItems().filter(item => item.inventoryMode === 'demo_fixture' || item.inventoryMode === 'manual_request');
  tripBucketService.replaceCandidates([...local, ...candidates.filter(item => !local.some(saved => saved.id === item.id))]);
}

export async function refreshServerTripBucket(): Promise<void> {
  syncServerTripBucketSnapshot(await journeyService.loadBucket());
}
