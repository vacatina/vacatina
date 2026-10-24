import type { ProductVerticalDefinition } from '../flights/index.ts';

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
  supplierAdapterName: 'LiteAPI Hotel Adapter (Mock)'
};
