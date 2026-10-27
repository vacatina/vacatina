/* ============================================================================
 * Vacatina Discovery Content Service & Canonical Inspiration Catalog
 * Authority: docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md
 *            Directive 1: Discovery Content ≠ Inventory Offer
 * ============================================================================ */

import type { DiscoveryContentEntity, TravelProductSlug } from './types.ts';

export const CANONICAL_DISCOVERY_CATALOG: DiscoveryContentEntity[] = [
  {
    contentId: 'dsc_dxb_flight_01',
    slug: 'dubai-flights-inspiration',
    title: 'Dubai Flights & Skyline Discovery',
    subtitle: 'Daily non-stop connections from Colombo to Dubai International (DXB)',
    category: 'ROUTE_SUGGESTION',
    heroImageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c',
    targetProductType: 'flights',
    targetRoute: '/flights',
    prefillSearchParams: {
      origin: 'CMB',
      destination: 'DXB',
      departureDate: '2026-11-15',
      cabinClass: 'ECONOMY'
    },
    editorialBadge: 'Popular Route',
    priceIndication: {
      indicativeFromPriceMinor: 24850000, // LKR 248,500.00
      indicativeCurrency: 'LKR',
      priceDisclaimer: '*Indicative starting fare based on recent searches; live availability and pricing verified on search.'
    },
    isLiveInventoryOffer: false,
    sellability: 'DISCOVERY_ONLY',
    authorOrCurator: 'Vacatina Flight Desk',
    publishedAtIso: '2026-10-01T00:00:00Z'
  },
  {
    contentId: 'dsc_mle_pkg_01',
    slug: 'maldives-luxury-escape',
    title: 'Maldives Overwater Sanctuary',
    subtitle: 'All-inclusive resort villas, speedboat transfers, and coral reef excursions',
    category: 'DESTINATION_INSPIRATION',
    heroImageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8',
    targetProductType: 'packages',
    targetRoute: '/packages',
    prefillSearchParams: {
      destination: 'Maldives',
      departureDate: '2026-12-01'
    },
    editorialBadge: 'Staff Pick',
    priceIndication: {
      indicativeFromPriceMinor: 38500000, // LKR 385,000.00
      indicativeCurrency: 'LKR',
      priceDisclaimer: '*Indicative package price per person based on double occupancy. Customization available upon search.'
    },
    isLiveInventoryOffer: false,
    sellability: 'DISCOVERY_ONLY',
    authorOrCurator: 'Vacatina Curated Escapes',
    publishedAtIso: '2026-10-01T00:00:00Z'
  },
  {
    contentId: 'dsc_dxb_ht_01',
    slug: 'dubai-luxury-hotels-guide',
    title: 'Top 5 Iconic Stays in Palm Jumeirah',
    subtitle: 'Private beaches, Michelin-starred dining, and breathtaking city skyline views',
    category: 'EDITORIAL_FEATURE',
    heroImageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b',
    targetProductType: 'hotels',
    targetRoute: '/hotels',
    prefillSearchParams: {
      destination: 'Dubai'
    },
    editorialBadge: 'Curated Guide',
    priceIndication: {
      indicativeFromPriceMinor: 8500000, // LKR 85,000.00 per night
      indicativeCurrency: 'LKR',
      priceDisclaimer: '*Indicative nightly room rates vary by season and room type; click to search real-time rates.'
    },
    isLiveInventoryOffer: false,
    sellability: 'DISCOVERY_ONLY',
    authorOrCurator: 'Vacatina Editorial Team',
    publishedAtIso: '2026-10-05T00:00:00Z'
  },
  {
    contentId: 'dsc_uae_vs_01',
    slug: 'uae-visa-requirements-guide',
    title: 'UAE Tourist Visa Application Protocol',
    subtitle: 'Comprehensive checklist, required paperwork, and 48-hour SLA filing instructions',
    category: 'SEASONAL_GUIDE',
    heroImageUrl: 'https://images.unsplash.com/photo-1546412414-e1885259563a',
    targetProductType: 'visa',
    targetRoute: '/visa',
    prefillSearchParams: {
      destination: 'United Arab Emirates'
    },
    editorialBadge: 'Official Advisory',
    priceIndication: {
      indicativeFromPriceMinor: 4500000, // LKR 45,000.00
      indicativeCurrency: 'LKR',
      priceDisclaimer: '*Indicative advisory fee; embassy and consular verification fees apply. Dedicated case manager liaison included.'
    },
    isLiveInventoryOffer: false,
    sellability: 'DISCOVERY_ONLY',
    authorOrCurator: 'Vacatina Consular Desk',
    publishedAtIso: '2026-10-10T00:00:00Z'
  }
];

export class DiscoveryContentService {
  /**
   * Retrieves all discovery content cards
   */
  public static getAllDiscoveryContent(): DiscoveryContentEntity[] {
    return [...CANONICAL_DISCOVERY_CATALOG];
  }

  /**
   * Retrieves discovery content cards by product type
   */
  public static getByProductType(productType: TravelProductSlug): DiscoveryContentEntity[] {
    return CANONICAL_DISCOVERY_CATALOG.filter(c => c.targetProductType === productType);
  }

  /**
   * Retrieves discovery content by unique slug
   */
  public static getBySlug(slug: string): DiscoveryContentEntity | undefined {
    return CANONICAL_DISCOVERY_CATALOG.find(c => c.slug === slug);
  }

  /**
   * Transforms a DiscoveryContent card into a canonical search query URL
   * Invariant: Discovery content never directly books; it redirects to real search!
   */
  public static generateSearchPrefillUrl(content: DiscoveryContentEntity): string {
    const params = new URLSearchParams();
    if (content.prefillSearchParams.origin) {
      params.set('from', content.prefillSearchParams.origin);
    }
    if (content.prefillSearchParams.destination) {
      params.set('to', content.prefillSearchParams.destination);
    }
    if (content.prefillSearchParams.departureDate) {
      params.set('departureDate', content.prefillSearchParams.departureDate);
    }
    if (content.prefillSearchParams.returnDate) {
      params.set('returnDate', content.prefillSearchParams.returnDate);
    }
    if (content.prefillSearchParams.cabinClass) {
      params.set('cabinClass', content.prefillSearchParams.cabinClass);
    }
    const query = params.toString();
    return query ? `${content.targetRoute}?${query}` : content.targetRoute;
  }
}
