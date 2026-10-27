import type { ProductVerticalDefinition } from '../flights/index.ts';

export const RAILS_FEATURE: ProductVerticalDefinition = {
  slug: 'rails',
  label: 'Rails',
  tabDomId: 'tab-rails',
  panelDomId: 'panel-rails',
  sectionDomId: 'rail-journeys-section',
  gridDomId: 'rail-journeys-grid',
  filterPillsDomId: 'rail-filter-pills',
  cardFilterAttribute: 'data-rail-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Rail Adapter (Mock)'
};
