/* ============================================================================
 * Vacatina Flights — Dedicated Post-Booking Views (frontend-only, interactive)
 * Change / Cancellation / Refund / Disruption / Support.
 * Uses deterministic mock data. Backend-dependent actions show preview results.
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
  private state: Record<string, string> = {};

  public render(mount: HTMLElement, kind: PostBookingKind, bookingId: string): void {
    this.mount = mount;
    const title = TITLES[kind];
    const desc = DESCRIPTIONS[kind];
    mount.innerHTML = this.renderShell(title, desc, bookingId, kind);
    this.wireEvents(kind, bookingId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private renderShell(title: string, desc: string, bookingId: string, kind: PostBookingKind): string {
    const bookingSummary = this.renderBookingSummary(bookingId);
    const kindContent = this.renderKindContent(kind, bookingId);
    return `
      <section class="flights-post-booking max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="pb-heading">
        <header class="mb-6">
          <h1 id="pb-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${title}</h1>
          <p class="text-sm text-brand-muted mt-2">${desc}</p>
        </header>
        ${bookingSummary}
        ${kindContent}
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-4 mt-6" role="status">
          <p class="text-xs text-brand-muted leading-relaxed">
            <strong class="text-brand-black">Frontend Preview:</strong> Actions below use deterministic mock data. Backend-dependent operations (live reissue, refund processing, supplier confirmation) are simulated and clearly marked.
          </p>
        </div>
        <div class="mt-4">
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to flight search
          </a>
        </div>
      </section>
    `;
  }

  private renderBookingSummary(bookingId: string): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="booking-summary-heading">
        <h2 id="booking-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Booking Summary</h2>
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
    `;
  }

  private renderKindContent(kind: PostBookingKind, bookingId: string): string {
    switch (kind) {
      case 'change':
        return `
          <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="change-heading">
            <h2 id="change-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Change Flight Request</h2>
            <div class="space-y-4">
              <div>
                <label for="change-dep-date" class="block text-xs font-bold text-brand-muted uppercase mb-1">New Departure Date</label>
                <input type="date" id="change-dep-date" value="2026-11-18" aria-label="New departure date" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div>
                <label for="change-ret-date" class="block text-xs font-bold text-brand-muted uppercase mb-1">New Return Date</label>
                <input type="date" id="change-ret-date" value="2026-11-25" aria-label="New return date" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              </div>
              <div id="change-quote" class="rounded-xl border border-brand-border bg-brand-canvas p-4 hidden">
                <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Change Quote (Preview)</h3>
                <div class="space-y-1 text-sm text-brand-muted">
                  <div class="flex justify-between"><span>Fare difference</span><strong class="text-brand-black tabular-nums">+LKR 12,500</strong></div>
                  <div class="flex justify-between"><span>Airline penalty</span><strong class="text-brand-black tabular-nums">LKR 5,000</strong></div>
                  <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums">LKR 1,500</strong></div>
                  <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Total due</span><strong class="text-brand-primary tabular-nums font-bold">LKR 19,000</strong></div>
                </div>
              </div>
              <div class="flex gap-3">
                <button type="button" id="btn-get-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                  Get Change Quote
                </button>
                <button type="button" id="btn-accept-change" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
                  Accept & Reissue (quote required)
                </button>
              </div>
              <div id="change-result" class="hidden rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold">
                Change request submitted (preview). Reissue pending backend confirmation.
              </div>
            </div>
          </div>
        `;
      case 'cancel':
        return `
          <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="cancel-heading">
            <h2 id="cancel-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Cancellation & Refund</h2>
            <div class="space-y-4">
              <div class="rounded-xl border border-brand-border bg-brand-canvas p-4">
                <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Cancellation Eligibility</h3>
                <ul class="space-y-1 text-sm text-brand-muted">
                  <li>• Fare family: Standard (refundable with penalty)</li>
                  <li>• Cancellation window: up to 24h before departure</li>
                  <li>• Airline penalty: LKR 8,500</li>
                  <li>• Refund destination: original payment method</li>
                </ul>
              </div>
              <div id="cancel-quote" class="rounded-xl border border-brand-border bg-brand-canvas p-4 hidden">
                <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Cancellation Quote (Preview)</h3>
                <div class="space-y-1 text-sm text-brand-muted">
                  <div class="flex justify-between"><span>Original fare</span><strong class="text-brand-black tabular-nums">LKR 248,500</strong></div>
                  <div class="flex justify-between"><span>Airline penalty</span><strong class="text-brand-black tabular-nums">-LKR 8,500</strong></div>
                  <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums">-LKR 1,500</strong></div>
                  <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Refund amount</span><strong class="text-green-700 tabular-nums font-bold">LKR 238,500</strong></div>
                </div>
              </div>
              <div class="flex gap-3">
                <button type="button" id="btn-get-cancel-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                  Get Cancellation Quote
                </button>
                <button type="button" id="btn-confirm-cancel" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-red-600 text-white font-semibold text-sm cursor-not-allowed opacity-60">
                  Confirm Cancellation (quote required)
                </button>
              </div>
              <div id="cancel-result" class="hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-semibold">
                Cancellation submitted (preview). Refund processing pending backend confirmation.
              </div>
            </div>
          </div>
        `;
      case 'refund':
        return `
          <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="refund-heading">
            <h2 id="refund-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Refund & Airline Credit Tracker</h2>
            <div class="space-y-3">
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Requested</span>
                <span class="text-sm text-brand-muted">15 Nov 2026 — Refund request submitted for booking VCT-2026-0001</span>
              </div>
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Quoted</span>
                <span class="text-sm text-brand-muted">16 Nov 2026 — Refund quote: LKR 238,500 (pending approval)</span>
              </div>
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border opacity-50">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Approved</span>
                <span class="text-sm text-brand-muted">Pending</span>
              </div>
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border opacity-50">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Processing</span>
                <span class="text-sm text-brand-muted">Pending</span>
              </div>
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border opacity-50">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Paid</span>
                <span class="text-sm text-brand-muted">Pending</span>
              </div>
            </div>
            <p class="text-xs text-brand-muted mt-4">Refund processing requires backend integration. Statuses above are deterministic mock data.</p>
          </div>
        `;
      case 'disruption':
        return `
          <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="disruption-heading">
            <h2 id="disruption-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Schedule Change & Disruption</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div class="rounded-xl border border-red-200 bg-red-50 p-4">
                <h3 class="font-heading text-sm font-semibold text-red-800 mb-2">Original Flight</h3>
                <div class="space-y-1 text-sm text-brand-muted">
                  <div><strong>UL 503</strong> — CMB → DXB</div>
                  <div>Dep: 15 Nov 2026, 02:30</div>
                  <div>Arr: 15 Nov 2026, 05:45</div>
                  <div>Terminal 1, Gate 12</div>
                </div>
              </div>
              <div class="rounded-xl border border-green-200 bg-green-50 p-4">
                <h3 class="font-heading text-sm font-semibold text-green-800 mb-2">Revised Flight</h3>
                <div class="space-y-1 text-sm text-brand-muted">
                  <div><strong>UL 503</strong> — CMB → DXB</div>
                  <div>Dep: 15 Nov 2026, 04:15 (+1h45m)</div>
                  <div>Arr: 15 Nov 2026, 07:30 (+1h45m)</div>
                  <div>Terminal 1, Gate 15</div>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="button" id="btn-accept-revised" class="min-h-[44px] px-5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                Accept Revised Schedule
              </button>
              <button type="button" id="btn-request-alternative" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
                Request Alternative
              </button>
              <button type="button" id="btn-contact-support" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
                Contact Support
              </button>
            </div>
            <div id="disruption-result" class="hidden mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold">
              Decision recorded (preview). Backend confirmation pending.
            </div>
          </div>
        `;
      case 'support':
        return `
          <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="support-heading">
            <h2 id="support-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Support Case & Communication</h2>
            <div class="space-y-4">
              <div>
                <label for="support-type" class="block text-xs font-bold text-brand-muted uppercase mb-1">Request Type</label>
                <select id="support-type" aria-label="Support request type" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  <option value="accessibility">Special Assistance / Accessibility</option>
                  <option value="airline">Airline Support</option>
                  <option value="urgent">Urgent Case</option>
                  <option value="document">Document Correction</option>
                </select>
              </div>
              <div>
                <label for="support-message" class="block text-xs font-bold text-brand-muted uppercase mb-1">Message</label>
                <textarea id="support-message" rows="4" aria-label="Support message" placeholder="Describe your request..." class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary"></textarea>
              </div>
              <button type="button" id="btn-submit-support" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                Submit Support Request
              </button>
              <div id="support-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold">
                Support case created (preview). Case ID: VCT-SUP-0042. Backend confirmation pending.
              </div>
            </div>
            <div class="mt-6 rounded-xl border border-brand-border bg-brand-canvas p-4">
              <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Case History</h3>
              <div class="space-y-2 text-sm text-brand-muted">
                <div class="flex justify-between"><span>Case VCT-SUP-0041</span><span class="text-green-700 font-semibold">Resolved</span></div>
                <div class="flex justify-between"><span>Case VCT-SUP-0040</span><span class="text-amber-700 font-semibold">In Progress</span></div>
              </div>
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  private wireEvents(kind: PostBookingKind, bookingId: string): void {
    if (!this.mount) return;
    const $ = (sel: string) => this.mount!.querySelector(sel);

    // Change flow
    if (kind === 'change') {
      const btnQuote = $('#btn-get-quote');
      const btnAccept = $('#btn-accept-change') as HTMLButtonElement | null;
      const quoteDiv = $('#change-quote');
      const resultDiv = $('#change-result');
      btnQuote?.addEventListener('click', () => {
        quoteDiv?.classList.remove('hidden');
        if (btnAccept) { btnAccept.disabled = false; btnAccept.classList.remove('bg-gray-200', 'text-gray-500', 'cursor-not-allowed', 'opacity-60'); btnAccept.classList.add('bg-brand-primary', 'text-white', 'hover:opacity-90'); btnAccept.textContent = 'Accept & Reissue'; }
      });
      btnAccept?.addEventListener('click', () => {
        resultDiv?.classList.remove('hidden');
      });
    }

    // Cancel flow
    if (kind === 'cancel') {
      const btnQuote = $('#btn-get-cancel-quote');
      const btnConfirm = $('#btn-confirm-cancel') as HTMLButtonElement | null;
      const quoteDiv = $('#cancel-quote');
      const resultDiv = $('#cancel-result');
      btnQuote?.addEventListener('click', () => {
        quoteDiv?.classList.remove('hidden');
        if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.classList.remove('opacity-60', 'cursor-not-allowed'); }
      });
      btnConfirm?.addEventListener('click', () => {
        resultDiv?.classList.remove('hidden');
      });
    }

    // Disruption flow
    if (kind === 'disruption') {
      const resultDiv = $('#disruption-result');
      ['#btn-accept-revised', '#btn-request-alternative', '#btn-contact-support'].forEach(sel => {
        $(sel)?.addEventListener('click', () => {
          if (resultDiv) { resultDiv.classList.remove('hidden'); resultDiv.textContent = (sel === '#btn-accept-revised' ? 'Revised schedule accepted (preview). Reissue pending.' : sel === '#btn-request-alternative' ? 'Alternative requested (preview). Desk will respond.' : 'Support contacted (preview). Case created.'); }
        });
      });
    }

    // Support flow
    if (kind === 'support') {
      const btnSubmit = $('#btn-submit-support');
      const resultDiv = $('#support-result');
      const msgField = $('#support-message') as HTMLTextAreaElement | null;
      btnSubmit?.addEventListener('click', () => {
        if (msgField && msgField.value.trim().length < 10) {
          msgField.classList.add('border-red-400');
          return;
        }
        msgField?.classList.remove('border-red-400');
        resultDiv?.classList.remove('hidden');
      });
    }
  }
}
