/* ============================================================================
 * Vacatina Manual Listing Repository Factory
 * Authority: Requirement 1 & 3 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 * ============================================================================ */

import type { IManualListingRepository } from './manual-listing.repository.ts';
import { InMemoryManualListingRepository } from './manual-listing.repository.ts';
import { PostgresManualListingRepository } from './postgres-manual-listing.repository.ts';

let activeRepoInstance: IManualListingRepository | null = null;

export function getManualListingRepository(): IManualListingRepository {
  // The legacy catalog adapter is not a production persistence boundary. Fail
  // closed instead of silently falling back to process-local memory.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    throw new Error('Legacy manual catalog persistence is not production approved; transactional catalog reconciliation is required.');
  }
  if (activeRepoInstance) {
    return activeRepoInstance;
  }

  const dbUrl = process.env.DATABASE_URL;
  // DATABASE_URL alone must never opt the catalog into a remote persistence path.
  if (dbUrl && dbUrl.trim().length > 0 && process.env.VACATINA_ENABLE_MANUAL_POSTGRES === 'true') {
    activeRepoInstance = new PostgresManualListingRepository(dbUrl);
  } else {
    activeRepoInstance = new InMemoryManualListingRepository();
  }

  return activeRepoInstance;
}

export function setManualListingRepositoryForTesting(repo: IManualListingRepository): void {
  activeRepoInstance = repo;
}
