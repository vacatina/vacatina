/* ============================================================================
 * Vacatina Manual Listing Repository Factory
 * Authority: Requirement 1 & 3 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
 * ============================================================================ */

import type { IManualListingRepository } from './manual-listing.repository.ts';
import { InMemoryManualListingRepository } from './manual-listing.repository.ts';
import { PostgresManualListingRepository } from './postgres-manual-listing.repository.ts';

let activeRepoInstance: IManualListingRepository | null = null;

export function getManualListingRepository(): IManualListingRepository {
  if (activeRepoInstance) {
    return activeRepoInstance;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.trim().length > 0) {
    activeRepoInstance = new PostgresManualListingRepository(dbUrl);
  } else {
    activeRepoInstance = new InMemoryManualListingRepository();
  }

  return activeRepoInstance;
}

export function setManualListingRepositoryForTesting(repo: IManualListingRepository): void {
  activeRepoInstance = repo;
}
