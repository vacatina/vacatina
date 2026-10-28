/* ============================================================================
 * Vacatina Flights — Booking Confirmation UI Presentation
 * Route: /flights/confirmation
 * Gated: Only renders after durable successful supplier order.
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class FlightsConfirmationView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderConfirmation();
  }

  private renderConfirmation(): void {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <section class="flights-confirmation max-w-3xl mx-auto px-4 py-12 text-center" aria-labelledby="confirmation-heading">
        <div class="rounded-2xl border border-brand-border bg-white p-8 sm:p-12">
          <div class="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <span class="text-amber-700 text-2xl font-bold">!</span>
          </div>
          <h1 id="confirmation-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black mb-3">Booking Confirmation</h1>
          <p class="text-sm text-brand-muted mb-6 max-w-md mx-auto">
            A confirmed booking reference and issued tickets will appear here only after a durable successful supplier order.
            No booking has been created in this session.
          </p>

          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 text-left">
            <h2 class="font-semibold text-amber-900 text-sm mb-2">What happens next</h2>
            <ul class="space-y-1 text-xs text-amber-800">
              <li>• Complete passenger details and trip review</li>
              <li>• Proceed to checkout when payment integration is configured</li>
              <li>• Booking confirmation appears here after successful supplier order</li>
              <li>• E-tickets and vouchers issued only after durable booking</li>
            </ul>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/trip/review" class="min-h-[44px] px-6 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center">
              Return to trip review
            </a>
            <a href="/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">
              Search flights
            </a>
          </div>

          <p class="text-xs text-brand-muted mt-6">No booking reference, PNR or ticket has been generated. Confirmation requires a secure backend with supplier booking integration.</p>
        </div>
      </section>
    `;
  }
}
