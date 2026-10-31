/* ============================================================================
 * Vacatina Flights — Screen Gallery (Preview navigation aid)
 *
 * Lists all 64 Flights screens/states with links to the existing functional
 * routes. This is navigation only: it does not recreate, redesign or duplicate
 * any screen. Restricted workflows keep their existing gates.
 * ============================================================================ */
import { GALLERY_ENTRIES } from '../data/flights-screen-gallery.data.ts';

export class FlightsScreenGalleryView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    try { sessionStorage.setItem('vacatina:gallery', '1'); } catch { /* ignore */ }

    const categories = [...new Set(GALLERY_ENTRIES.map(e => e.category))];
    mount.innerHTML = `
      <section class="max-w-6xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="gallery-heading">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Preview navigation aid</p>
          <h1 id="gallery-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Flights Screen Gallery</h1>
          <p class="text-sm text-brand-muted mt-2">
            Index of all ${GALLERY_ENTRIES.length} Flights screens and states. Each link opens the existing functional screen/state.
            Restricted workflows keep their normal gates. This page is a navigation aid only.
          </p>
        </header>

        ${categories.map(cat => `
          <div class="mb-8">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">${cat}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${GALLERY_ENTRIES.filter(e => e.category === cat).map(e => `
                <a href="${e.route}" class="block rounded-xl border border-brand-border bg-white p-4 hover:border-brand-primary hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Screen ${e.id}</span>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-brand-muted">${e.state}</span>
                  </div>
                  <p class="mt-1 text-sm font-semibold text-brand-black">${e.name}</p>
                  <p class="mt-1 text-[11px] text-brand-muted truncate">${e.route}</p>
                </a>
              `).join('')}
            </div>
          </div>
        `).join('')}

        <p class="text-[11px] leading-relaxed text-brand-muted border-t border-brand-border pt-4" role="note">
          Routes open the real functional screens. Where a route has multiple states, use the in-screen controls (e.g. authorization lifecycle links, seat-map loader, retry buttons). Preview-only QA controls are gated and unavailable in normal production use.
        </p>
      </section>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
