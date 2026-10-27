/* ============================================================================
 * Vacatina Flights Feature Module Index
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD
 * ============================================================================ */

import type { TravelProductSlug } from '../../lib/domain/types.ts';

export * from './domain/flight-models.ts';
export * from './domain/search-models.ts';
export * from './data/airports.ts';
export * from './data/manual-offers.ts';
export * from './data/supplier-fixtures.ts';
export * from './adapters/flight-adapter.interface.ts';
export * from './adapters/manual-flight.adapter.ts';
export * from './adapters/supplier-api-flight.adapter.ts';
export * from './services/flight-search.service.ts';
export * from './services/flight-trip-bucket.service.ts';
export * from './services/flight-favorites.service.ts';
export * from './ui/reusable-traveller-selector.ts';
export * from './ui/airport-autocomplete.ts';
export * from './ui/flights-hub-view.ts';
export * from './ui/flights-search-view.ts';
export * from './ui/flights-offer-detail-modal.ts';

export interface ProductVerticalDefinition {
  slug: TravelProductSlug;
  label: string;
  tabDomId: string;
  panelDomId: string;
  sectionDomId: string;
  gridDomId: string;
  filterPillsDomId: string;
  cardFilterAttribute: string;
  integrationStatus: 'ADAPTER-READY' | 'MOCK';
  supplierAdapterName: string;
}

export const FLIGHTS_FEATURE: ProductVerticalDefinition = {
  slug: 'flights',
  label: 'Flights',
  tabDomId: 'tab-flights',
  panelDomId: 'panel-flights',
  sectionDomId: 'popular-flights-section',
  gridDomId: 'popular-flights-grid',
  filterPillsDomId: 'popular-filter-pills',
  cardFilterAttribute: 'data-region',
  integrationStatus: 'ADAPTER-READY',
  supplierAdapterName: 'Provider-Neutral Flight Normalizer (Manual CMS + GDS/NDC Gateway)'
};
