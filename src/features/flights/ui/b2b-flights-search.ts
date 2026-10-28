/* ============================================================================
 * Vacatina B2B Flights — Flight Search & Wholesale Fare Comparison
 * Route: /b2b/flights
 * Separate authenticated portal — NOT a cosmetic toggle in B2C.
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class B2BFlightsSearchView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderSearch();
  }

  private renderSearch(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="b2b-flights-search max-w-7xl mx-auto px-4 py-8" aria-labelledby="b2b-search-heading">
        <header class="mb-6 flex items-center justify-between">
          <div>
            <h1 id="b2b-search-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">B2B Flight Search</h1>
            <p class="text-sm text-brand-muted mt-2">Wholesale fare comparison for travel agents and corporate bookers.</p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            B2B Portal
          </span>
        </header>

        <!-- Agent Auth Gate -->
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6" role="alert">
          <p class="text-sm text-amber-800 font-semibold">Authentication required</p>
          <p class="text-xs text-amber-700 mt-1">This is a separate, authenticated B2B portal. Agent credentials are required to access wholesale fares, markups, and booking policies. No B2B data is exposed through the public B2C interface.</p>
        </div>

        <!-- Search Form -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Origin (IATA)</span>
              <input type="text" placeholder="CMB" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Destination (IATA)</span>
              <input type="text" placeholder="DXB" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Departure Date</span>
              <input type="date" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Passengers</span>
              <input type="number" min="1" max="9" value="1" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row gap-3 justify-between">
            <div class="flex gap-2">
              <label class="inline-flex items-center gap-2 text-xs text-brand-muted">
                <input type="checkbox" class="w-4 h-4 rounded" /> Show net rates
              </label>
              <label class="inline-flex items-center gap-2 text-xs text-brand-muted">
                <input type="checkbox" class="w-4 h-4 rounded" /> Show markups
              </label>
            </div>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-6 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
              Search Wholesale Fares (auth required)
            </button>
          </div>
        </div>

        <!-- Results Placeholder -->
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-8 text-center">
          <p class="text-brand-muted text-sm">Wholesale fare results will appear here after agent authentication and search.</p>
          <p class="text-xs text-brand-muted mt-2">Net rates, markups, commission, and booking policies are server-validated. No B2B pricing is exposed to B2C users.</p>
        </div>

        <!-- Navigation -->
        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/b2b/flights/quotation" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Quotation Builder</a>
          <a href="/b2b/flights/travellers" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Traveller Management</a>
          <a href="/b2b/flights/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Review</a>
          <a href="/b2b/flights/manage" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Management</a>
        </div>
      </section>
    `;
  }
}
