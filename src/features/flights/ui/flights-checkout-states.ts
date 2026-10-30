/* ============================================================================
 * Vacatina Flights — Checkout exception states (screens 23–24)
 *
 * 23 /flights/checkout/payment-failed   Payment Failed / Unknown
 * 24 /flights/checkout/booking-failed    Booking Creation Failed
 *
 * These are standalone, honestly-labelled preview states. They are NOT a live
 * payment gateway or booking engine: no card was charged, no PNR was created.
 * They exist so the exception journey is reachable and testable without editing
 * the server-backed checkout workspace.
 * ============================================================================ */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}

const BTN_PRIMARY = 'min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';
const BTN_GHOST = 'min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';

export class FlightsCheckoutPaymentFailedView {
  private mount: HTMLElement | null = null;
  public render(mount: HTMLElement): void {
    this.mount = mount;
    mount.innerHTML = `
      <section class="max-w-3xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="payment-failed-heading">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Screen 23 · Payment failed / unknown</p>
          <h1 id="payment-failed-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Payment Failed / Unknown</h1>
          <p class="text-sm text-brand-muted mt-2">The payment could not be confirmed. No card was charged and no booking was created.</p>
        </header>

        <div class="rounded-2xl border border-red-200 bg-red-50 p-5 mb-5" role="alert">
          <p class="text-sm font-semibold text-red-800">Payment status: failed (preview)</p>
          <p class="text-xs text-red-800 mt-1">Reason: the payment provider returned an unknown or declined result. Your payment method has not been charged.</p>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">What to do next</h2>
          <ul class="space-y-2 text-sm text-brand-muted">
            <li>Check that your card details and billing address are correct.</li>
            <li>Confirm with your bank that online payments are enabled.</li>
            <li>Retry the payment, or return to the trip review to change the payment method.</li>
          </ul>
          <div class="flex flex-wrap gap-3 mt-5">
            <button type="button" id="payment-retry" class="${BTN_PRIMARY}">Retry payment (preview)</button>
            <a href="/trip/review" class="${BTN_GHOST} inline-flex items-center">Return to trip review</a>
            <a href="/flights" class="${BTN_GHOST} inline-flex items-center">Back to flight search</a>
          </div>
          <p id="payment-retry-result" class="hidden mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-semibold" role="status"></p>
        </div>

        <p class="text-[11px] leading-relaxed text-brand-muted border-t border-brand-border pt-4" role="note">
          This is a deterministic preview state. No payment gateway, card network or bank was contacted and no charge was raised.
        </p>
      </section>
    `;
    const retry = mount.querySelector<HTMLButtonElement>('#payment-retry');
    const result = mount.querySelector<HTMLElement>('#payment-retry-result');
    retry?.addEventListener('click', () => {
      if (result) {
        result.textContent = 'Retry recorded in this preview. No payment was captured and no booking was created.';
        result.classList.remove('hidden');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export class FlightsCheckoutBookingFailedView {
  private mount: HTMLElement | null = null;
  public render(mount: HTMLElement): void {
    this.mount = mount;
    mount.innerHTML = `
      <section class="max-w-3xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="booking-failed-heading">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Screen 24 · Booking creation failed</p>
          <h1 id="booking-failed-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Booking Creation Failed</h1>
          <p class="text-sm text-brand-muted mt-2">The payment was captured, but the booking record could not be created. No PNR or ticket has been issued.</p>
        </header>

        <div class="rounded-2xl border border-red-200 bg-red-50 p-5 mb-5" role="alert">
          <p class="text-sm font-semibold text-red-800">Booking status: failed (preview)</p>
          <p class="text-xs text-red-800 mt-1">Reason: the supplier confirmation step did not complete. Any captured payment is held and will be released or refunded automatically.</p>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Recovery options</h2>
          <ul class="space-y-2 text-sm text-brand-muted">
            <li>Retry booking creation without re-entering your payment.</li>
            <li>Return to the trip review to re-check passenger and contact details.</li>
            <li>Contact support with the reference shown below.</li>
          </ul>
          <div class="flex flex-wrap gap-3 mt-5">
            <button type="button" id="booking-retry" class="${BTN_PRIMARY}">Retry booking creation (preview)</button>
            <a href="/trip/review" class="${BTN_GHOST} inline-flex items-center">Return to trip review</a>
            <a href="/flights" class="${BTN_GHOST} inline-flex items-center">Back to flight search</a>
          </div>
          <p id="booking-retry-result" class="hidden mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-semibold" role="status"></p>
          <p class="text-[11px] text-brand-muted mt-3">Support reference: <strong class="text-brand-black tabular-nums">VCT-ERR-0001</strong></p>
        </div>

        <p class="text-[11px] leading-relaxed text-brand-muted border-t border-brand-border pt-4" role="note">
          This is a deterministic preview state. No booking, PNR, ticket or payment capture was created with any airline, GDS or payment provider.
        </p>
      </section>
    `;
    const retry = mount.querySelector<HTMLButtonElement>('#booking-retry');
    const result = mount.querySelector<HTMLElement>('#booking-retry-result');
    retry?.addEventListener('click', () => {
      if (result) {
        result.textContent = 'Retry recorded in this preview. No booking or ticket was created and no payment was captured.';
        result.classList.remove('hidden');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
