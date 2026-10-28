/* ============================================================================
 * Vacatina B2B Flights — Agent Flight Quotation Builder
 * Route: /b2b/flights/quotation
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class B2BFlightsQuotationView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderQuotation();
  }

  private renderQuotation(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="b2b-flights-quotation max-w-5xl mx-auto px-4 py-8" aria-labelledby="quotation-heading">
        <header class="mb-6">
          <h1 id="quotation-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Agent Flight Quotation Builder</h1>
          <p class="text-sm text-brand-muted mt-2">Build and send flight quotations to customers with markup and commission settings.</p>
        </header>

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6" role="alert">
          <p class="text-sm text-amber-800 font-semibold">Authentication required</p>
          <p class="text-xs text-amber-700 mt-1">Agent credentials required. Quotation generation requires verified wholesale fare access.</p>
        </div>

        <!-- Quotation Form -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Quotation Details</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Customer Name</span>
              <input type="text" placeholder="Customer name" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Customer Email</span>
              <input type="email" placeholder="customer@example.com" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Markup (%)</span>
              <input type="number" min="0" max="50" value="10" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Commission (%)</span>
              <input type="number" min="0" max="20" value="5" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Validity (days)</span>
              <input type="number" min="1" max="30" value="7" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Currency</span>
              <select class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option>LKR</option><option>USD</option><option>AED</option><option>EUR</option><option>GBP</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Quotation Preview -->
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-5 mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Quotation Preview</h2>
          <p class="text-sm text-brand-muted">Flight details, fare breakdown, and total will appear here after selecting flights and configuring markup.</p>
          <div class="mt-4 flex gap-2">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">Generate Quote (auth required)</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-muted font-semibold text-sm cursor-not-allowed opacity-60">Export PDF</button>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <a href="/b2b/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Back to Search</a>
          <a href="/b2b/flights/travellers" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Traveller Management</a>
          <a href="/b2b/flights/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Review</a>
          <a href="/b2b/flights/manage" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Management</a>
        </div>
      </section>
    `;
  }
}
