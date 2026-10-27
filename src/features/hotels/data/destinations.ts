/* ============================================================================
 * Vacatina Curated Hotel Destinations
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

export interface HotelDestination {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  popularPropertyCount: number;
  highlightTag: string;
  imageUrl: string;
}

export const HOTEL_DESTINATIONS: HotelDestination[] = [
  {
    id: 'dest-bentota-lk',
    name: 'Bentota, Sri Lanka',
    city: 'Bentota',
    country: 'Sri Lanka',
    countryCode: 'LK',
    popularPropertyCount: 42,
    highlightTag: 'Golden Sandy Coast & River Lagoons',
    imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-dubai-ae',
    name: 'Dubai, United Arab Emirates',
    city: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    popularPropertyCount: 185,
    highlightTag: 'Skyline Luxury & Palm Beachfronts',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-colombo-lk',
    name: 'Colombo, Sri Lanka',
    city: 'Colombo',
    country: 'Sri Lanka',
    countryCode: 'LK',
    popularPropertyCount: 68,
    highlightTag: 'Oceanfront Dining & Colonial Charm',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-galle-lk',
    name: 'Galle Fort, Sri Lanka',
    city: 'Galle',
    country: 'Sri Lanka',
    countryCode: 'LK',
    popularPropertyCount: 38,
    highlightTag: 'UNESCO Heritage Boutiques',
    imageUrl: 'https://images.unsplash.com/photo-1588598198321-9735fd52455b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-maldives-mv',
    name: 'Maldives (North & South Atolls)',
    city: 'Malé / Atolls',
    country: 'Maldives',
    countryCode: 'MV',
    popularPropertyCount: 54,
    highlightTag: 'Overwater Bungalows & Coral Reefs',
    imageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-bangkok-th',
    name: 'Bangkok, Thailand',
    city: 'Bangkok',
    country: 'Thailand',
    countryCode: 'TH',
    popularPropertyCount: 120,
    highlightTag: 'Chao Phraya Riverside Luxury',
    imageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-singapore-sg',
    name: 'Singapore, Marina Bay',
    city: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    popularPropertyCount: 95,
    highlightTag: 'Garden City Luxury & Rooftop Pools',
    imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'dest-bali-id',
    name: 'Bali (Seminyak & Ubud), Indonesia',
    city: 'Bali',
    country: 'Indonesia',
    countryCode: 'ID',
    popularPropertyCount: 88,
    highlightTag: 'Jungle Sanctuaries & Oceanfront Cliffs',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'
  }
];

export function searchDestinations(query: string): HotelDestination[] {
  if (!query || query.trim().length === 0) return HOTEL_DESTINATIONS.slice(0, 5);
  const q = query.toLowerCase().trim();
  return HOTEL_DESTINATIONS.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.city.toLowerCase().includes(q) ||
    d.country.toLowerCase().includes(q) ||
    d.countryCode.toLowerCase().includes(q)
  );
}

export function findDestinationByCity(city: string): HotelDestination | undefined {
  const c = city.toLowerCase().trim();
  return HOTEL_DESTINATIONS.find(d => d.city.toLowerCase() === c || d.name.toLowerCase().includes(c));
}
