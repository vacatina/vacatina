/* ============================================================================
 * Vacatina B2B Flights — Corporate Traveller Management
 * Route: /b2b/flights/travellers
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class B2BFlightsTravellersView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderTravellers();
  }

  private renderTravellers(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="b2b-flights-travellers max-w-6xl mx-auto px-4 py-8" aria-labelledby="travellers-heading">
        <header class="mb-6 flex items-center justify-between">
          <div>
            <h1 id="travellers-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Corporate Traveller Management</h1>
            <p class="text-sm text-brand-muted mt-2">Manage corporate traveller profiles, documents, and travel policies.</p>
          </div>
          <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">Add Traveller (auth required)</button>
        </header>

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6" role="alert">
          <p class="text-sm text-amber-800 font-semibold">Authentication required</p>
          <p class="text-xs text-amber-700 mt-1">Agent credentials required. Traveller profiles and corporate policies are server-validated.</p>
        </div>

        <!-- Traveller List -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Traveller Profiles</h2>
          <div class="rounded-xl border border-brand-border bg-brand-subtle p-8 text-center">
            <p class="text-brand-muted text-sm">No travellers loaded. Agent authentication required to access corporate traveller profiles.</p>
          </div>
        </div>

        <!-- Travel Policy -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Travel Policy Compliance</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="p-4 rounded-xl border border-brand-border bg-brand-subtle">
              <p class="text-xs font-semibold text-brand-muted">Max Fare Class</p>
              <p class="text-sm font-bold text-brand-black mt-1">Economy / Premium Economy</p>
            </div>
            <div class="p-4 rounded-xl border border-brand-border bg-brand-subtle">
              <p class="text-xs font-semibold text-brand-muted">Advance Booking</p>
              <p class="text-sm font-bold text-brand-black mt-1">14 days minimum</p>
            </div>
            <div class="p-4 rounded-xl border border-brand-border bg-brand-subtle">
              <p class="text-xs font-semibold text-brand-muted">Approval Required</p>
              <p class="text-sm font-bold text-brand-black mt-1">Above USD 2,000</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <a href="/b2b/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Back to Search</a>
          <a href="/b2b/flights/quotation" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Quotation Builder</a>
          <a href="/b2b/flights/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Review</a>
          <a href="/b2b/flights/manage" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Management</a>
        </div>
      </section>
    `;
  }
}
