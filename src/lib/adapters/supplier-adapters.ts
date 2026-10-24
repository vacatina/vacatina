/* ============================================================================
 * Vacatina Supplier & Infrastructure Adapter Registry
 * Authority: 02_API_RESPONSIBILITY_MAP.md & 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
 *
 * Honesty Rule:
 * - Never invent live supplier calls or claim live connectivity where credentials
 *   are not present in the environment.
 * - All adapters expose typed interfaces ready for live backend swap while
 *   delivering deterministic, state-accurate responses in prototype mode.
 * ============================================================================ */

import type {
  ConfigurableProductOption,
  SupplierAdapterMetadata,
  TravelProductSlug
} from '../domain/types.ts';
import { CONFIGURABLE_PRODUCT_CATALOG } from '../mock-data/catalog.ts';

export const SUPPLIER_ADAPTER_REGISTRY: SupplierAdapterMetadata[] = [
  {
    domain: 'Flights (Search, Offer Validation, Hold, Order Creation)',
    provider: 'Duffel API (NDC / GDS)',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'Typed FlightSupplierAdapter interface active; using deterministic mock inventory (no DUFFEL_ACCESS_TOKEN in local env).'
  },
  {
    domain: 'Hotels (Search, Room Rates, Pre-Book Revalidation)',
    provider: 'LiteAPI',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'Typed HotelSupplierAdapter interface active; using deterministic mock room/tariff blocks (no LITEAPI_KEY in local env).'
  },
  {
    domain: 'Authentication & Session Identity',
    provider: 'Clerk Auth',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'AuthSessionAdapter interface active with guest & demo traveller session switch (no CLERK_PUBLISHABLE_KEY in local env).'
  },
  {
    domain: 'Primary Database & Trip Bucket Persistence',
    provider: 'Neon Serverless Postgres + Drizzle ORM',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'TripPersistenceAdapter active; persists Trip Bucket & Saved Favorites via browser localStorage when DATABASE_URL is absent.'
  },
  {
    domain: 'Visa Assistance & Consular Document Storage',
    provider: 'Vacatina Internal Consular Desk + Cloudflare R2',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'VisaDocumentVaultAdapter simulates encrypted bio-page scan verification and promotes Visa items from Needs Action to Ready.'
  },
  {
    domain: 'Checkout & Payment Processing',
    provider: 'Stripe (Primary) + PayPal (Secondary)',
    documentedStatus: 'VERIFY-LIVE',
    runtimeStatus: 'ADAPTER-READY',
    credentialsConfigured: false,
    notes: 'PaymentGatewayAdapter validates Ready items subtotal before dossier checkout simulation.'
  },
  {
    domain: 'Cars & Transfers',
    provider: 'Amadeus Transfers / Internal Fleet Adapter',
    documentedStatus: 'ADAPTER-READY',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Airport transfer, private chauffeur, and self-drive car hire mock adapter.'
  },
  {
    domain: 'Holiday Packages',
    provider: 'Vacatina Curated Package Engine',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Curated multi-day package configurator with day-by-day itinerary and inclusion auditing.'
  },
  {
    domain: 'Rails (High-Speed & Scenic Rail)',
    provider: 'Vacatina Rail Adapter',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Station-to-station rail schedule and cabin class mock adapter.'
  },
  {
    domain: 'Cruises & Sea Voyages',
    provider: 'Vacatina Cruise Inventory Adapter',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Ocean & regional archipelago stateroom configurator.'
  },
  {
    domain: 'Activities & Day Experiences',
    provider: 'Vacatina Experiences Adapter',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Participatory adventure, safari, watersports, and culinary workshop mock adapter.'
  },
  {
    domain: 'Sightseeing Tours',
    provider: 'Vacatina Sightseeing Adapter',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Guided landmark, cultural trail, and timed admission pass mock adapter.'
  },
  {
    domain: 'Travel Insurance',
    provider: 'Vacatina Insurance Underwriting Adapter',
    documentedStatus: 'MOCK',
    runtimeStatus: 'MOCK',
    credentialsConfigured: false,
    notes: 'Single-trip, family, and annual multi-trip policy comparison mock adapter.'
  }
];

export function queryProductOptions(
  productType: TravelProductSlug,
  queryHint?: string
): ConfigurableProductOption[] {
  const list = CONFIGURABLE_PRODUCT_CATALOG[productType] || [];
  if (!queryHint || !queryHint.trim()) {
    return list;
  }
  const normalized = queryHint.toLowerCase().trim();
  const matched = list.filter(
    item =>
      item.title.toLowerCase().includes(normalized) ||
      item.destination.toLowerCase().includes(normalized) ||
      item.subtitle.toLowerCase().includes(normalized)
  );
  return matched.length > 0 ? matched : list;
}
