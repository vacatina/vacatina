import type { ProductVerticalDefinition } from '../flights/index.ts';

export const CARS_TRANSFERS_FEATURE: ProductVerticalDefinition = {
  slug: 'cars',
  label: 'Cars & Transfers',
  tabDomId: 'tab-cars',
  panelDomId: 'panel-cars',
  sectionDomId: 'cars-transfers-section',
  gridDomId: 'cars-transfers-grid',
  filterPillsDomId: 'car-filter-pills',
  cardFilterAttribute: 'data-car-category',
  integrationStatus: 'ADAPTER-READY',
  supplierAdapterName: 'Vacatina Canonical Ground Mobility Search'
};
