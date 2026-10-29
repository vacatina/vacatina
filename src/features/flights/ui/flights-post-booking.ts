/* ============================================================================
 * Vacatina Flights — Dedicated Post-Booking Views (frontend-only)
 * Change / Cancellation / Refund / Disruption / Support.
 * Backend-dependent actions are clearly marked as preview/unavailable.
 * ============================================================================ */

type PostBookingKind = 'change' | 'cancel' | 'refund' | 'disruption' | 'support';

const TITLES: Record<PostBookingKind, string> = {
  change: 'Change Flight',
  cancel: 'Cancel Flight',
  refund: 'Refund & Airline Credit Tracker',
  disruption: 'Airline Schedule Change / Disruption',
  support: 'Support Case & Communication',
};

const DESCRIPTIONS: Record<PostBookingKind, string> = {
  change: 'Select passenger/slice and desired dates, review eligible alternatives, accept the fare difference and reissue.',
  cancel: 'Check cancellation eligibility, review the refund quote (penalties, destination, credit validity) and confirm explicitly.',
  refund: 'Track requested → quoted → approved → processing → paid/rejected refunds and airline credits.',
  disruption: 'Review original vs revised flight, accept the revised schedule, request an alternative, or contact support.',
  support: 'Accessibility needs, airline support, urgent cases, and case/message tracking.',
};

export class FlightsPostBookingView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement, kind: PostBookingKind, bookingId: string): void {
    this.mount = mount;
    const title = TITLES[kind];
    const desc = DESCRIPTIONS[kind];
    mount.innerHTML = `
      <section class="flights-post-booking max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="pb-heading">
        <header class="mb-6">
          <h1 id="pb-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${title}</h1>
          <p class="text-sm text-brand-muted mt-2">${desc}</p>
        </header>

        <!-- Realistic dummy booking summary -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="booking-summary-heading">
          <h2 id="booking-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Booking Summary (Demo)</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span class="text-brand-muted text-xs block">Booking Reference</span><strong class="text-brand-black">${bookingId}</strong></div>
            <div><span class="text-brand-muted text-xs block">Flight</span><strong class="text-brand-black">UL 503 / UL 504 — CMB ↔ DXB</strong></div>
            <div><span class="text-brand-muted text-xs block">Airline</span><strong class="text-brand-black">SriLankan Airlines (UL)</strong></div>
            <div><span class="text-brand-muted text-xs block">Dates</span><strong class="text-brand-black">15 Nov 2026 – 22 Nov 2026</strong></div>
            <div><span class="text-brand-muted text-xs block">Passengers</span><strong class="text-brand-black">1 Adult</strong></div>
            <div><span class="text-brand-muted text-xs block">Total Paid</span><strong class="text-brand-primary tabular-nums">LKR 248,500</strong></div>
            <div><span class="text-brand-muted text-xs block">Status</span><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Confirmed</span></div>
            <div><span class="text-brand-muted text-xs block">Ticket Status</span><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Issuing</span></div>
          </div>
        </div>

        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-5 mb-6" role="status">
          <h2 class="font-heading text-base font-semibold text-brand-black mb-2">Frontend Preview</h2>
          <p class="text-sm text-brand-muted leading-relaxed">
            This flow is a frontend-only preview until the booking backend is connected. Actions that require live supplier data
            (change quotes, cancellation quotes, refund processing, reissue) are disabled and marked unavailable. No booking state
            is mutated from this screen.
          </p>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Available Actions</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left">
              Request ${title.toLowerCase()} (backend required)
            </button>
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-muted text-sm font-semibold cursor-not-allowed opacity-60 text-left">
              View eligibility / quote (backend required)
            </button>
          </div>
          <p class="text-xs text-brand-muted mt-3">Actions become available once a booking is confirmed and the backend is connected.</p>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Lifecycle State (independent)</h2>
          <p class="text-sm text-brand-muted leading-relaxed">
            Payment, booking and ticketing states remain independent. A change in one lifecycle does not implicitly advance another.
          </p>
          <div class="mt-3">
            <a href="/flights/manage" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
              Open Manage Booking
            </a>
            <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors ml-2">
              Back to flight search
            </a>
          </div>
        </div>
      </section>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}