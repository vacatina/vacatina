/* ============================================================================
 * Vacatina Canonical Visa Search Service
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Invariants:
 * 1. Multi-source orchestrator (Vacatina Consular Desk + Future Global Consular Feeds).
 * 2. Strict SEED quarantine: filters any demo item with isSeed === true.
 * 3. Enforces Pin-Above-API ranking: Direct consular services pinned to the top.
 * 4. Resolves destination entry rules for the applicant's citizenship.
 * ============================================================================ */

import type { CanonicalVisaOffer, VisaCategory } from '../domain/visa-models.ts';
import type {
  VisaFilterCriteria,
  VisaRequirementRule,
  VisaSearchCriteria,
  VisaSearchFacets,
  VisaSearchResponse
} from '../domain/visa-search-models.ts';
import { ManualVisaAdapter } from '../adapters/manual-visa.adapter.ts';
import { resolveVisaRequirement, POPULAR_VISA_DESTINATIONS } from '../data/destinations.ts';

export class VisaSearchService {
  private manualAdapter: ManualVisaAdapter;
  private lastSearchResponse: VisaSearchResponse | null = null;

  constructor() {
    this.manualAdapter = new ManualVisaAdapter();
  }

  public async search(criteria: VisaSearchCriteria): Promise<VisaSearchResponse> {
    const rawOffers = await this.manualAdapter.search(criteria);

    // Strictly quarantine any SEED content
    const offers = rawOffers.filter(o => (o as any).isSeed !== true);

    // Resolve citizenship and destination requirement rule
    const destCode = criteria.destinationCountryCode || this.inferCountryCode(criteria.destinationCountry);
    const rule: VisaRequirementRule = resolveVisaRequirement(
      criteria.citizenshipCountryCode || 'LK',
      destCode
    );

    // Calculate facets
    const facets = this.computeFacets(offers);

    const lowestPrice = offers.length > 0
      ? Math.min(...offers.map(o => o.pricing.totalPriceMinor))
      : 0;

    const response: VisaSearchResponse = {
      searchId: `visa-srch-${Date.now()}`,
      criteria: {
        ...criteria,
        destinationCountryCode: destCode,
        citizenshipCountryCode: criteria.citizenshipCountryCode || 'LK'
      },
      requirementRule: rule,
      offers,
      totalCount: offers.length,
      lowestPriceMinor: lowestPrice,
      currency: offers[0]?.pricing.currency || 'LKR',
      facets,
      isStale: false,
      searchedAt: new Date().toISOString()
    };

    this.lastSearchResponse = response;
    return response;
  }

  public async getOfferById(offerId: string): Promise<CanonicalVisaOffer | null> {
    return await this.manualAdapter.getOffer(offerId);
  }

  public filterOffers(offers: CanonicalVisaOffer[], filters: VisaFilterCriteria): CanonicalVisaOffer[] {
    return offers.filter(offer => {
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(offer.category)) return false;
      }
      if (filters.maxSlaDays !== undefined && filters.maxSlaDays > 0) {
        if (offer.processingSlaBusinessDays > filters.maxSlaDays) return false;
      }
      if (filters.maxPriceMinor !== undefined && filters.maxPriceMinor > 0) {
        if (offer.pricing.totalPriceMinor > filters.maxPriceMinor) return false;
      }
      if (filters.directDeskOnly) {
        if (!offer.isPinnedAboveApi) return false;
      }
      return true;
    });
  }

  public getLastSearchResponse(): VisaSearchResponse | null {
    return this.lastSearchResponse;
  }

  private computeFacets(offers: CanonicalVisaOffer[]): VisaSearchFacets {
    const categoryCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};
    let minPriceMinor = Infinity;
    let maxPriceMinor = 0;
    let minSlaDays = Infinity;
    let maxSlaDays = 0;

    for (const offer of offers) {
      categoryCounts[offer.category] = (categoryCounts[offer.category] || 0) + 1;
      regionCounts[offer.region] = (regionCounts[offer.region] || 0) + 1;

      const price = offer.pricing.totalPriceMinor;
      if (price < minPriceMinor) minPriceMinor = price;
      if (price > maxPriceMinor) maxPriceMinor = price;

      const sla = offer.processingSlaBusinessDays;
      if (sla < minSlaDays) minSlaDays = sla;
      if (sla > maxSlaDays) maxSlaDays = sla;
    }

    return {
      categoryCounts,
      regionCounts,
      minPriceMinor: minPriceMinor === Infinity ? 0 : minPriceMinor,
      maxPriceMinor,
      minSlaDays: minSlaDays === Infinity ? 0 : minSlaDays,
      maxSlaDays
    };
  }

  private inferCountryCode(query: string): string {
    const q = (query || '').trim().toLowerCase();
    if (!q) return 'AE';
    for (const dest of POPULAR_VISA_DESTINATIONS) {
      if (dest.countryName.toLowerCase().includes(q) || dest.countryCode.toLowerCase() === q) {
        return dest.countryCode;
      }
    }
    if (q.includes('dubai') || q.includes('uae') || q.includes('emirates')) return 'AE';
    if (q.includes('uk') || q.includes('london') || q.includes('britain')) return 'GB';
    if (q.includes('singapore')) return 'SG';
    if (q.includes('india') || q.includes('delhi')) return 'IN';
    if (q.includes('france') || q.includes('schengen') || q.includes('paris')) return 'FR';
    if (q.includes('thailand') || q.includes('bangkok')) return 'TH';
    if (q.includes('japan') || q.includes('tokyo')) return 'JP';
    if (q.includes('australia') || q.includes('sydney')) return 'AU';
    if (q.includes('sri lanka') || q.includes('colombo')) return 'LK';
    return 'AE';
  }
}

export const visaSearchService = new VisaSearchService();
