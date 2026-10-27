import type { ProductVerticalDefinition } from '../flights/index.ts';

export const INSURANCE_FEATURE: ProductVerticalDefinition = {
  slug: 'insurance',
  label: 'Travel Insurance',
  tabDomId: 'tab-insurance',
  panelDomId: 'panel-insurance',
  sectionDomId: 'travel-insurance-section',
  gridDomId: 'travel-insurance-grid',
  filterPillsDomId: 'insurance-filter-pills',
  cardFilterAttribute: 'data-insurance-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Insurance Underwriting Adapter (Mock)'
};
