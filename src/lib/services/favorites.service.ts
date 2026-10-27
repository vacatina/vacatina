/* ============================================================================
 * Vacatina Saved Favorites Service
 * Authority: 01_PRODUCT_ARCHITECTURE.md & 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
 *
 * Workspace Separation Rule:
 * - Favorites (`♡`) are strictly non-committal bookmarks for inspiration.
 * - Toggling a Favorite NEVER adds an item to the Trip Bucket or alters the
 *   Ready items estimate.
 * ============================================================================ */

import type { FavoriteBookmark, TravelProductSlug } from '../domain/types.ts';

export type FavoritesListener = (favorites: FavoriteBookmark[]) => void;

export class FavoritesService {
  private items: Map<string, FavoriteBookmark> = new Map();
  private listeners: Set<FavoritesListener> = new Set();

  public getAll(): FavoriteBookmark[] {
    return Array.from(this.items.values());
  }

  public isSaved(titleOrId: string): boolean {
    const key = this.normalizeKey(titleOrId);
    return this.items.has(key);
  }

  public toggle(
    title: string,
    category: TravelProductSlug = 'flights',
    destination = 'Curated Destination',
    priceHint = 'Rate refreshed on search'
  ): boolean {
    const key = this.normalizeKey(title);
    if (this.items.has(key)) {
      this.items.delete(key);
      this.emit();
      return false;
    }

    this.items.set(key, {
      id: key,
      title,
      category,
      destination,
      priceHint,
      savedAtIso: new Date().toISOString()
    });
    this.emit();
    return true;
  }

  public remove(idOrTitle: string): void {
    const key = this.normalizeKey(idOrTitle);
    if (this.items.delete(key)) {
      this.emit();
    }
  }

  public subscribe(listener: FavoritesListener): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private normalizeKey(raw: string): string {
    return (raw || '')
      .toLowerCase()
      .replace(/&amp;/g, '&')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private emit(): void {
    const snapshot = this.getAll();
    this.listeners.forEach(fn => fn(snapshot));
  }
}

export const favoritesService = new FavoritesService();
