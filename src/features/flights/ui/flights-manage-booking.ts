/* ============================================================================
 * Vacatina Flights — Manage Booking UI Presentation
 * Route: /flights/manage
 * Gated: Requires durable backend with booking persistence.
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class FlightsManageBookingView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderManage();
  }

  private renderManage(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="flights-manage-booking max-w-4xl mx-auto px-4 py-8" aria-labelledby="manage-heading">
        <header class="mb-6">
          <h1 id="manage-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Manage Booking</h1>
          <p class="text-sm text-brand-muted mt-2">View and manage your existing flight bookings, modify dates, or request changes.</p>
        </header>

        <!-- Booking Reference Lookup -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="lookup-heading">
          <h2 id="lookup-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Find Your Booking</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Enter booking reference (e.g. VCT-2026-XXXX)" disabled
              class="flex-1 min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-muted bg-brand-subtle cursor-not-allowed" />
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-6 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
              Look Up
            </button>
          </div>
          <p class="text-xs text-brand-muted mt-2">Booking lookup requires a secure backend with booking persistence.</p>
        </div>

        <!-- No Bookings State -->
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-8 text-center mb-6">
          <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <span class="text-gray-500 text-xl">✈</span>
          </div>
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-2">No Bookings Found</h2>
          <p class="text-sm text-brand-muted mb-4">You have no confirmed flight bookings in this session.</p>
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Search flights
          </a>
        </div>

        <!-- Available Actions (Gated) -->
        <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="actions-heading">
          <h2 id="actions-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Booking Actions</h2>
          <p class="text-sm text-brand-muted mb-4">The following actions become available when a booking is confirmed:</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>📄</span> View E-Ticket
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>📅</span> Modify Dates
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>🧳</span> Add Baggage
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>❌</span> Request Cancellation
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>📧</span> Resend Confirmation
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left flex items-center gap-2">
              <span>💬</span> Contact Support
            </button>
          </div>
          <p class="text-xs text-amber-700 mt-4 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
            Booking management requires a secure backend with durable booking persistence and supplier integration.
          </p>
        </div>
      </section>
    `;
  }
}
