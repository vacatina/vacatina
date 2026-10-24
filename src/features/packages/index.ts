import type { ProductVerticalDefinition } from '../flights/index.ts';

export const PACKAGES_FEATURE: ProductVerticalDefinition = {
  slug: 'packages',
  label: 'Holiday Packages',
  tabDomId: 'tab-packages',
  panelDomId: 'panel-packages',
  sectionDomId: 'holiday-packages-section',
  gridDomId: 'holiday-packages-grid',
  filterPillsDomId: 'package-filter-pills',
  cardFilterAttribute: 'data-package-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Curated Package Engine (Mock)'
};
