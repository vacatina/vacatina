import { FLIGHTS_FEATURE, type ProductVerticalDefinition } from '../flights/index.ts';
import { HOTELS_FEATURE } from '../hotels/index.ts';
import { VISA_FEATURE } from '../visa/index.ts';
import { PACKAGES_FEATURE } from '../packages/index.ts';
import { CARS_TRANSFERS_FEATURE } from '../cars-transfers/index.ts';
import { RAILS_FEATURE } from '../rails/index.ts';
import { CRUISES_FEATURE } from '../cruises/index.ts';
import { ACTIVITIES_FEATURE } from '../activities/index.ts';
import { SIGHTSEEING_FEATURE } from '../sightseeing/index.ts';
import { INSURANCE_FEATURE } from '../insurance/index.ts';

/**
 * Build Your Bundle is Tab 1 in the Search Command Center.
 * It is a cross-product orchestration engine, NOT an 11th product inside `More`.
 */
export const BUNDLE_ORCHESTRATION_METADATA = {
  id: 'bundle' as const,
  label: 'Build Your Bundle',
  tabDomId: 'tab-bundle',
  panelDomId: 'panel-bundle',
  isOrchestrationOnly: true,
  description: 'Combines multiple travel verticals into one synchronized Trip Bucket dossier.'
};

export const ALL_10_TRAVEL_PRODUCTS: ProductVerticalDefinition[] = [
  FLIGHTS_FEATURE,
  HOTELS_FEATURE,
  VISA_FEATURE,
  PACKAGES_FEATURE,
  CARS_TRANSFERS_FEATURE,
  RAILS_FEATURE,
  CRUISES_FEATURE,
  ACTIVITIES_FEATURE,
  SIGHTSEEING_FEATURE,
  INSURANCE_FEATURE
];
