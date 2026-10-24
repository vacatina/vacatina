import type { ProductVerticalDefinition } from '../flights/index.ts';

export const VISA_FEATURE: ProductVerticalDefinition = {
  slug: 'visa',
  label: 'Visa Assistance',
  tabDomId: 'tab-visa',
  panelDomId: 'panel-visa',
  sectionDomId: 'visa-assistance-section',
  gridDomId: 'visa-assistance-grid',
  filterPillsDomId: 'visa-filter-pills',
  cardFilterAttribute: 'data-visa-region',
  integrationStatus: 'ADAPTER-READY',
  supplierAdapterName: 'Vacatina Consular Desk + Cloudflare R2 Vault (Mock)'
};
