/* ============================================================================
 * Vacatina Cache TTL & Freshness Service
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q14) & ADR-006
 *
 * Enforces product-by-product cache lifecycles and cache-busting for manual listings.
 * ============================================================================ */

import type { CanonicalOfferEntity, TravelProductSlug } from './types.ts';

interface CacheEntry<T> {
  data: T;
  cachedAtMs: number;
  expiresAtMs: number;
  productType: TravelProductSlug;
  cacheTag?: string;
}

export class CacheTtlService {
  /**
   * Product-by-product TTL definitions in seconds
   */
  public static readonly TTL_MATRIX_SECONDS: Record<TravelProductSlug, number> = {
    flights: 900,       // 15 minutes
    hotels: 1800,       // 30 minutes
    cars: 7200,         // 2 hours
    activities: 14400,  // 4 hours
    sightseeing: 14400, // 4 hours
    rails: 3600,        // 1 hour
    cruises: 43200,     // 12 hours
    insurance: 86400,   // 24 hours
    visa: 86400,        // 24 hours
    packages: 3600      // 1 hour
  };

  private cache: Map<string, CacheEntry<CanonicalOfferEntity[]>>;

  constructor() {
    this.cache = new Map();
  }

  public getTtlSeconds(productType: TravelProductSlug): number {
    return CacheTtlService.TTL_MATRIX_SECONDS[productType] || 1800;
  }

  public get(key: string): CanonicalOfferEntity[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAtMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(
    key: string,
    data: CanonicalOfferEntity[],
    productType: TravelProductSlug,
    cacheTag?: string
  ): void {
    const ttlSeconds = this.getTtlSeconds(productType);
    const now = Date.now();
    this.cache.set(key, {
      data,
      cachedAtMs: now,
      expiresAtMs: now + ttlSeconds * 1000,
      productType,
      cacheTag
    });
  }

  /**
   * Real-time cache busting: instantly purges manual listings upon Admin publish/edit.
   */
  public invalidateTag(tag: string): number {
    let purged = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.cacheTag === tag || key.includes(tag)) {
        this.cache.delete(key);
        purged++;
      }
    }
    return purged;
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const globalInventoryCache = new CacheTtlService();
