/* ============================================================================
 * Vacatina Hotels Feature Module Index
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

import type { ProductVerticalDefinition } from '../flights/index.ts';

export * from './domain/hotel-models.ts';
export * from './domain/hotel-search-models.ts';
export * from './data/destinations.ts';
export * from './data/manual-hotels.ts';
export * from './data/supplier-fixtures.ts';
export * from './adapters/hotel-adapter.interface.ts';
export * from './adapters/manual-hotel.adapter.ts';
export * from './adapters/liteapi-hotel.adapter.ts';
export * from './services/hotel-search.service.ts';
export * from './services/hotel-trip-bucket.service.ts';
export * from './services/hotel-favorites.service.ts';
export * from './ui/hotel-destination-autocomplete.ts';
export * from './ui/hotel-occupancy-selector.ts';
export * from './ui/hotels-hub-view.ts';
export * from './ui/hotels-search-view.ts';
export * from './ui/hotels-offer-detail-modal.ts';

export const HOTELS_FEATURE: ProductVerticalDefinition = {
  slug: 'hotels',
  label: 'Hotels',
  tabDomId: 'tab-hotels',
  panelDomId: 'panel-hotels',
  sectionDomId: 'recommended-hotels-section',
  gridDomId: 'recommended-hotels-grid',
  filterPillsDomId: 'hotel-filter-pills',
  cardFilterAttribute: 'data-hotel-category',
  integrationStatus: 'ADAPTER-READY',
  supplierAdapterName: 'LiteAPI Global Bedbank + Vacatina Direct Contracts'
};
