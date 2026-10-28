/* ============================================================================
 * Vacatina B2B Flights — Booking Review & Approval
 * Route: /b2b/flights/review
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class B2BFlightsReviewView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderReview();
  }

  private renderReview(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="b2b-flights-review max-w-5xl mx-auto px-4 py-8" aria-labelledby="review-heading">
        <header class="mb-6">
          <h1 id="review-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">B2B Flight Booking Review & Approval</h1>
          <p class="text-sm text-brand-muted mt-2">Review flight bookings, approve or reject, and track audit trail.</p>
        </header>

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6" role="alert">
          <p class="text-sm text-amber-800 font-semibold">Authentication required</p>
          <p class="text-xs text-amber-700 mt-1">Agent credentials required. Booking review and approval require role-aware access control.</p>
        </div>

        <!-- Booking Summary -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Pending Booking Reviews</h2>
          <div class="rounded-xl border border-brand-border bg-brand-subtle p-8 text-center">
            <p class="text-brand-muted text-sm">No pending booking reviews. Agent authentication required to access booking review queue.</p>
          </div>
        </div>

        <!-- Approval Actions -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Approval Workflow</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">Approve Booking (auth required)</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl border border-red-200 text-red-400 font-semibold text-sm cursor-not-allowed opacity-60">Reject Booking (auth required)</button>
          </div>
          <p class="text-xs text-brand-muted mt-3">Approval actions require agent authentication and role-based authorization.</p>
        </div>

        <!-- Audit Trail -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Audit Trail</h2>
          <div class="rounded-xl border border-brand-border bg-brand-subtle p-8 text-center">
            <p class="text-brand-muted text-sm">Audit history will appear here after booking actions are performed.</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <a href="/b2b/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Back to Search</a>
          <a href="/b2b/flights/quotation" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Quotation Builder</a>
          <a href="/b2b/flights/travellers" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Traveller Management</a>
          <a href="/b2b/flights/manage" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Management</a>
        </div>
      </section>
    `;
  }
}
