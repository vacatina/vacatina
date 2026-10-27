import type { ProductVerticalDefinition } from '../flights/index.ts';

export const CRUISES_FEATURE: ProductVerticalDefinition = {
  slug: 'cruises',
  label: 'Cruises',
  tabDomId: 'tab-cruises',
  panelDomId: 'panel-cruises',
  sectionDomId: 'cruises-section',
  gridDomId: 'cruises-grid',
  filterPillsDomId: 'cruise-filter-pills',
  cardFilterAttribute: 'data-cruise-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Cruise Inventory Adapter (Mock)'
};
