import type { TravelProductSlug } from '../../lib/domain/types.ts';

export interface ProductVerticalDefinition {
  slug: TravelProductSlug;
  label: string;
  tabDomId: string;
  panelDomId: string;
  sectionDomId: string;
  gridDomId: string;
  filterPillsDomId: string;
  cardFilterAttribute: string;
  integrationStatus: 'ADAPTER-READY' | 'MOCK';
  supplierAdapterName: string;
}

export const FLIGHTS_FEATURE: ProductVerticalDefinition = {
  slug: 'flights',
  label: 'Flights',
  tabDomId: 'tab-flights',
  panelDomId: 'panel-flights',
  sectionDomId: 'popular-flights-section',
  gridDomId: 'popular-flights-grid',
  filterPillsDomId: 'popular-filter-pills',
  cardFilterAttribute: 'data-region',
  integrationStatus: 'ADAPTER-READY',
  supplierAdapterName: 'Duffel API (NDC / GDS Mock Adapter)'
};
