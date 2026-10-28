/* ============================================================================
 * Vacatina B2B Flights — Agent Booking Management & Servicing
 * Route: /b2b/flights/manage
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class B2BFlightsManageView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderManage();
  }

  private renderManage(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="b2b-flights-manage max-w-6xl mx-auto px-4 py-8" aria-labelledby="manage-heading">
        <header class="mb-6">
          <h1 id="manage-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Agent Flight Booking Management & Servicing</h1>
          <p class="text-sm text-brand-muted mt-2">Manage flight bookings, servicing requests, and post-booking operations.</p>
        </header>

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6" role="alert">
          <p class="text-sm text-amber-800 font-semibold">Authentication required</p>
          <p class="text-xs text-amber-700 mt-1">Agent credentials required. Booking management requires role-based access control and server-side persistence.</p>
        </div>

        <!-- Booking Search -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Find Booking</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Booking reference or PNR" disabled class="flex-1 min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-muted bg-brand-subtle cursor-not-allowed" />
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-6 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">Look Up (auth required)</button>
          </div>
        </div>

        <!-- No Bookings State -->
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-8 text-center mb-6">
          <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <span class="text-gray-500 text-xl">✈</span>
          </div>
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-2">No Bookings Found</h2>
          <p class="text-sm text-brand-muted mb-4">No flight bookings in the agent queue. Authentication required to access booking management.</p>
        </div>

        <!-- Servicing Actions -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Servicing Actions</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>📄</span> View E-Ticket</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>📅</span> Modify Dates</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>🧳</span> Add Baggage</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>❌</span> Request Cancellation</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>📧</span> Resend Confirmation</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2"><span>💬</span> Contact Support</button>
          </div>
          <p class="text-xs text-amber-700 mt-4 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
            Booking management requires a secure backend with durable booking persistence and supplier integration.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <a href="/b2b/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Back to Search</a>
          <a href="/b2b/flights/quotation" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Quotation Builder</a>
          <a href="/b2b/flights/travellers" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Traveller Management</a>
          <a href="/b2b/flights/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Review</a>
        </div>
      </section>
    `;
  }
}
