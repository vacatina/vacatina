import type { ProductVerticalDefinition } from '../flights/index.ts';

export const SIGHTSEEING_FEATURE: ProductVerticalDefinition = {
  slug: 'sightseeing',
  label: 'Sightseeing Tours',
  tabDomId: 'tab-sightseeing',
  panelDomId: 'panel-sightseeing',
  sectionDomId: 'sightseeing-tours-section',
  gridDomId: 'sightseeing-tours-grid',
  filterPillsDomId: 'sightseeing-filter-pills',
  cardFilterAttribute: 'data-sightseeing-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Sightseeing Adapter (Mock)'
};
