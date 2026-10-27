import type { ProductVerticalDefinition } from '../flights/index.ts';

export const ACTIVITIES_FEATURE: ProductVerticalDefinition = {
  slug: 'activities',
  label: 'Activities',
  tabDomId: 'tab-activities',
  panelDomId: 'panel-activities',
  sectionDomId: 'popular-activities-section',
  gridDomId: 'popular-activities-grid',
  filterPillsDomId: 'activity-filter-pills',
  cardFilterAttribute: 'data-activity-category',
  integrationStatus: 'MOCK',
  supplierAdapterName: 'Vacatina Experiences Adapter (Mock)'
};
