/* ============================================================================
 * Vacatina Visa Feature Module Index
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import type { ProductVerticalDefinition } from '../flights/index.ts';

export * from './domain/visa-models.ts';
export * from './domain/visa-search-models.ts';
export * from './data/destinations.ts';
export * from './data/manual-visas.ts';
export * from './adapters/visa-adapter.interface.ts';
export * from './adapters/manual-visa.adapter.ts';
export * from './services/visa-search.service.ts';
export * from './services/visa-trip-bucket.service.ts';
export * from './services/visa-favorites.service.ts';
export * from './ui/visa-country-autocomplete.ts';
export * from './ui/visa-hub-view.ts';
export * from './ui/visa-search-view.ts';
export * from './ui/visa-application-modal.ts';

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
  supplierAdapterName: 'Vacatina Consular Desk & Document Concierge'
};
