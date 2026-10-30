/* ============================================================================
 * Vacatina Flights — Dedicated Post-Booking Views (frontend-only, interactive)
 * Change / Cancellation / Refund / Disruption / Support.
 * Deterministic mock data. Backend-dependent actions are labelled preview.
 *
 * Stage-aware: each route suffix renders its own step of the workflow.
 *   /change                    -> select (dates + quote)
 *   /change/alternatives       -> alternative selection
 *   /change/review             -> quote review + explicit acceptance
 *   /change/complete           -> completion state
 *   /cancel/eligibility        -> eligibility check
 *   /cancel/quote              -> quote + reason + explicit confirmation
 *   /cancel/result             -> cancellation result
 *   /refund                    -> refund / credit tracker
 *   /disruption                -> schedule change alert
 *   /disruption/decision       -> decision form
 *   /support/special           -> special assistance request
 *   /support                   -> support case tracker
 * ============================================================================ */

type PostBookingKind = 'change' | 'cancel' | 'refund' | 'disruption' | 'support';
type PostBookingStage = 'select' | 'alternatives' | 'review' | 'complete' | 'eligibility' | 'quote' | 'result' | 'alert' | 'decision' | 'special' | 'tracker';

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

const STAGE_LABELS: Record<PostBookingKind, Record<string, string>> = {
  change: { select: 'Step 1 of 4 · Select & quote', alternatives: 'Step 2 of 4 · Alternatives', review: 'Step 3 of 4 · Review & accept', complete: 'Step 4 of 4 · Complete' },
  cancel: { eligibility: 'Step 1 of 3 · Eligibility', quote: 'Step 2 of 3 · Quote & approval', result: 'Step 3 of 3 · Result' },
  refund: { tracker: 'Refund lifecycle tracker' },
  disruption: { alert: 'Disruption alert', decision: 'Alternative decision' },
  support: { special: 'Special assistance request', tracker: 'Case tracker' },
};

const CHANGE_ALTERNATIVES = [
  { id: 'UL505', flight: 'UL 505', route: 'CMB → DXB', dep: '18 Nov 2026, 08:20', arr: '18 Nov 2026, 11:35', fareDiff: 12500 },
  { id: 'UL507', flight: 'UL 507', route: 'CMB → DXB', dep: '18 Nov 2026, 13:10', arr: '18 Nov 2026, 16:25', fareDiff: 9800 },
  { id: 'EK651', flight: 'EK 651', route: 'CMB → DXB via MLE', dep: '18 Nov 2026, 19:45', arr: '19 Nov 2026, 00:55', fareDiff: 15400 },
];

interface ChangeQuote {
  dep: string;
  ret: string;
  days: number;
  fareDiff: number;
  penalty: number;
  fee: number;
  total: number;
}

interface ChangeSelection {
  alternativeId: string;
  flight: string;
  dep: string;
  arr: string;
  fareDiff: number;
}

function normalizeStage(kind: PostBookingKind, rawStage: string): PostBookingStage {
  const s = (rawStage || '').replace(/^\/+|\/+$/g, '');
  if (kind === 'change') {
    if (s === 'alternatives') return 'alternatives';
    if (s === 'review') return 'review';
    if (s === 'complete') return 'complete';
    return 'select';
  }
  if (kind === 'cancel') {
    if (s === 'quote') return 'quote';
    if (s === 'result') return 'result';
    return 'eligibility';
  }
  if (kind === 'disruption') return s === 'decision' ? 'decision' : 'alert';
  if (kind === 'support') return s === 'special' ? 'special' : 'tracker';
  return 'tracker';
}

export class FlightsPostBookingView {
  private mount: HTMLElement | null = null;
  private bookingId = '';
  private kind: PostBookingKind = 'change';
  private stage: PostBookingStage = 'select';

  private quoteKey(): string {
    return `vacatina:postbooking:${this.bookingId}:changeQuote`;
  }

  private selectionKey(): string {
    return `vacatina:postbooking:${this.bookingId}:changeSelection`;
  }

  private readJson<T>(key: string): T | null {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — flow degrades to inline-only, never fabricates success */
    }
  }

  private clearQuote(): void {
    try {
      window.sessionStorage.removeItem(this.quoteKey());
    } catch {
      /* ignore */
    }
  }

  public render(mount: HTMLElement, kind: PostBookingKind, bookingId: string, rawStage = ''): void {
    this.mount = mount;
    this.bookingId = bookingId;
    this.kind = kind;
    this.stage = normalizeStage(kind, rawStage);
    const title = TITLES[kind];
    const desc = DESCRIPTIONS[kind];
    const stageLabel = STAGE_LABELS[kind]?.[this.stage] || '';
    mount.innerHTML = this.renderShell(title, desc, stageLabel, kind);
    this.wireEvents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private renderShell(title: string, desc: string, stageLabel: string, kind: PostBookingKind): string {
    return `
      <section class="flights-post-booking max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="pb-heading" data-pb-kind="${kind}" data-pb-stage="${this.stage}">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">${stageLabel}</p>
          <h1 id="pb-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${title}</h1>
          <p class="text-sm text-brand-muted mt-2">${desc}</p>
        </header>
        ${this.renderBookingSummary()}
        ${this.renderKindContent()}
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-4 mt-6" role="note">
          <p class="text-xs text-brand-muted leading-relaxed">
            <strong class="text-brand-black">Frontend preview:</strong> deterministic mock data only. Live reissue, refund processing and supplier confirmation are disabled and never reported as completed.
          </p>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <a href="/bookings/${encodeURIComponent(this.bookingId)}" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to booking
          </a>
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to flight search
          </a>
        </div>
      </section>
    `;
  }

  private renderBookingSummary(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="booking-summary-heading">
        <h2 id="booking-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Booking Summary</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span class="text-brand-muted text-xs block">Booking Reference</span><strong class="text-brand-black">${this.bookingId}</strong></div>
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

  private renderKindContent(): string {
    switch (this.kind) {
      case 'change':
        if (this.stage === 'alternatives') return this.renderChangeAlternatives();
        if (this.stage === 'review') return this.renderChangeReview();
        if (this.stage === 'complete') return this.renderChangeComplete();
        return this.renderChangeSelect();
      case 'cancel':
        if (this.stage === 'quote') return this.renderCancelQuote();
        if (this.stage === 'result') return this.renderCancelResult();
        return this.renderCancelEligibility();
      case 'refund':
        return this.renderRefundTracker();
      case 'disruption':
        return this.stage === 'decision' ? this.renderDisruptionDecision() : this.renderDisruptionAlert();
      case 'support':
        return this.stage === 'special' ? this.renderSupportSpecial() : this.renderSupportTracker();
      default:
        return '';
    }
  }

  /* ------------------------------------------------------------------ change */

  private renderChangeSelect(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="change-heading">
        <h2 id="change-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Change Flight Request</h2>
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="change-passenger" class="block text-xs font-bold text-brand-muted uppercase mb-1">Passenger</label>
              <select id="change-passenger" aria-label="Passenger to change" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="adult-1">1. Adult — Passenger One</option>
                <option value="adult-2">2. Adult — Passenger Two</option>
              </select>
            </div>
            <div>
              <label for="change-slice" class="block text-xs font-bold text-brand-muted uppercase mb-1">Slice</label>
              <select id="change-slice" aria-label="Flight slice to change" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="outbound">Outbound — 15 Nov 2026</option>
                <option value="return">Return — 22 Nov 2026</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="change-dep-date" class="block text-xs font-bold text-brand-muted uppercase mb-1">New Departure Date</label>
              <input type="date" id="change-dep-date" value="2026-11-18" aria-label="New departure date" aria-describedby="change-date-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="change-ret-date" class="block text-xs font-bold text-brand-muted uppercase mb-1">New Return Date</label>
              <input type="date" id="change-ret-date" value="2026-11-25" aria-label="New return date" aria-describedby="change-date-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <p id="change-date-error" role="alert" class="hidden text-xs text-red-700 font-semibold"></p>
          <p id="change-quote-status" role="status" aria-live="polite" class="hidden text-xs text-amber-700 font-semibold"></p>
          <div id="change-quote" class="rounded-xl border border-brand-border bg-brand-canvas p-4 hidden" aria-live="polite"></div>
          <div class="flex flex-wrap gap-3">
            <button type="button" id="btn-get-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
              Get Change Quote
            </button>
            <button type="button" id="btn-continue-alternatives" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
              Continue to alternatives
            </button>
          </div>
          <div id="change-result" class="hidden rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status">
            Change request submitted (preview). Reissue pending backend confirmation.
          </div>
        </div>
      </div>
    `;
  }

  private renderChangeAlternatives(): string {
    const rows = CHANGE_ALTERNATIVES.map(a => `
      <label class="flex items-start gap-3 p-4 rounded-xl border border-brand-border bg-white hover:border-brand-primary transition-colors cursor-pointer">
        <input type="radio" name="change-alt" value="${a.id}" aria-label="${a.flight} ${a.route} departing ${a.dep}" class="mt-1 h-4 w-4" />
        <span class="flex-1">
          <span class="block font-semibold text-brand-black text-sm">${a.flight} — ${a.route}</span>
          <span class="block text-xs text-brand-muted">Dep ${a.dep} · Arr ${a.arr}</span>
        </span>
        <span class="text-sm font-bold text-brand-primary tabular-nums">+LKR ${a.fareDiff.toLocaleString()}</span>
      </label>
    `).join('');

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="alt-heading">
        <h2 id="alt-heading" class="font-heading text-lg font-semibold text-brand-black mb-2">Eligible Alternatives</h2>
        <p class="text-sm text-brand-muted mb-4">Deterministic preview inventory. Fare difference is added to the change penalty and service fee.</p>
        <div class="space-y-3" role="radiogroup" aria-label="Eligible alternative flights">${rows}</div>
        <p id="alt-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3">Select an alternative to continue.</p>
        <div class="flex flex-wrap gap-3 mt-4">
          <button type="button" id="btn-review-change" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
            Continue to review
          </button>
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/change" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to dates
          </a>
        </div>
      </div>
    `;
  }

  private renderChangeReview(): string {
    const selection = this.readJson<ChangeSelection>(this.selectionKey());
    const quote = this.readJson<ChangeQuote>(this.quoteKey());
    const hasValidQuote = !!(quote && selection && quote.total > 0);

    const summary = hasValidQuote && quote && selection
      ? `
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 mb-4" aria-labelledby="review-flight-heading">
          <h3 id="review-flight-heading" class="font-heading text-sm font-semibold text-brand-black mb-2">Selected Alternative</h3>
          <div class="text-sm text-brand-black font-semibold">${selection.flight}</div>
          <div class="text-xs text-brand-muted">Dep ${selection.dep} · Arr ${selection.arr}</div>
        </div>
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 mb-4" aria-labelledby="review-quote-heading">
          <h3 id="review-quote-heading" class="font-heading text-sm font-semibold text-brand-black mb-2">Change Quote</h3>
          <div class="space-y-1 text-sm text-brand-muted">
            <div class="flex justify-between"><span>Fare difference</span><strong class="text-brand-black tabular-nums">+LKR ${quote.fareDiff.toLocaleString()}</strong></div>
            <div class="flex justify-between"><span>Airline penalty</span><strong class="text-brand-black tabular-nums">LKR ${quote.penalty.toLocaleString()}</strong></div>
            <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums">LKR ${quote.fee.toLocaleString()}</strong></div>
            <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Total due</span><strong class="text-brand-primary tabular-nums font-bold">LKR ${quote.total.toLocaleString()}</strong></div>
          </div>
        </div>
        <label class="flex items-start gap-3 text-sm text-brand-black mb-4">
          <input type="checkbox" id="change-accept-terms" aria-label="I accept the fare difference and change conditions" class="mt-1 h-4 w-4" />
          <span>I accept the fare difference, airline penalty and change conditions.</span>
        </label>
        <div class="flex flex-wrap gap-3">
          <button type="button" id="btn-accept-change" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
            Accept &amp; reissue
          </button>
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/change/alternatives" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to alternatives
          </a>
        </div>
        <div id="change-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status">
          Change request submitted (preview). Reissue pending backend confirmation.
        </div>
      `
      : `
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-semibold" role="status">
          No active change quote. Request a quote before reviewing or accepting a change.
        </div>
        <div class="mt-4">
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/change" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Request a change quote
          </a>
        </div>
      `;

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="review-heading">
        <h2 id="review-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Review Change</h2>
        ${summary}
      </div>
    `;
  }

  private renderChangeComplete(): string {
    const selection = this.readJson<ChangeSelection>(this.selectionKey());
    const flightLine = selection ? `${selection.flight} — dep ${selection.dep}` : 'UL 505 — dep 18 Nov 2026, 08:20';
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="complete-heading">
        <h2 id="complete-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Change Completion</h2>
        <div class="rounded-xl border border-green-200 bg-green-50 p-4 mb-4" role="status">
          <p class="text-sm text-green-800 font-semibold">Change request recorded (preview). No ticket has been reissued.</p>
          <p class="text-xs text-green-800 mt-1">Reference: VCT-CHG-0042 · ${flightLine}</p>
        </div>
        <ul class="space-y-2 text-sm text-brand-muted">
          <li>• Airline reissue: pending supplier confirmation (backend disabled)</li>
          <li>• Payment capture: not attempted in preview</li>
          <li>• Original ticket remains valid until reissue completes</li>
        </ul>
        <div class="mt-4">
          <a href="/bookings/${encodeURIComponent(this.bookingId)}" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Return to booking
          </a>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ cancel */

  private renderCancelEligibility(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="cancel-heading">
        <h2 id="cancel-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Cancellation Eligibility</h2>
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4">
          <ul class="space-y-2 text-sm text-brand-muted">
            <li>• Fare family: Standard (refundable with penalty)</li>
            <li>• Cancellation window: up to 24h before departure — eligible</li>
            <li>• Airline penalty: LKR 8,500</li>
            <li>• Refund destination: original payment method</li>
            <li>• Airline credit validity: 12 months from issue</li>
          </ul>
        </div>
        <div class="mt-4">
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/cancel/quote" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Continue to cancellation quote
          </a>
        </div>
      </div>
    `;
  }

  private renderCancelQuote(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="cancel-quote-heading">
        <h2 id="cancel-quote-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Cancellation Quote &amp; Approval</h2>
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 mb-4">
          <div class="space-y-1 text-sm text-brand-muted">
            <div class="flex justify-between"><span>Original fare</span><strong class="text-brand-black tabular-nums">LKR 248,500</strong></div>
            <div class="flex justify-between"><span>Airline penalty</span><strong class="text-brand-black tabular-nums">-LKR 8,500</strong></div>
            <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums">-LKR 1,500</strong></div>
            <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Refund amount</span><strong class="text-green-700 tabular-nums font-bold">LKR 238,500</strong></div>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <label for="cancel-reason" class="block text-xs font-bold text-brand-muted uppercase mb-1">Reason for cancellation</label>
            <select id="cancel-reason" aria-label="Cancellation reason" aria-describedby="cancel-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="">Select a reason…</option>
              <option value="plans">Change of plans</option>
              <option value="medical">Medical reason</option>
              <option value="visa">Visa refusal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <label class="flex items-start gap-3 text-sm text-brand-black">
            <input type="checkbox" id="cancel-confirm-terms" aria-label="I understand the penalty and refund timeline" class="mt-1 h-4 w-4" />
            <span>I understand the airline penalty and the refund timeline.</span>
          </label>
          <p id="cancel-error" role="alert" class="hidden text-xs text-red-700 font-semibold"></p>
          <div class="flex flex-wrap gap-3">
            <button type="button" id="btn-confirm-cancel" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-red-600 text-white font-semibold text-sm cursor-not-allowed opacity-60">
              Confirm cancellation
            </button>
            <a href="/bookings/${encodeURIComponent(this.bookingId)}/cancel/eligibility" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
              Back to eligibility
            </a>
          </div>
          <div id="cancel-result" class="hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-semibold" role="status">
            Cancellation submitted (preview). Refund processing pending backend confirmation.
          </div>
          <div id="cancel-result-link" class="hidden">
            <a href="/bookings/${encodeURIComponent(this.bookingId)}/cancel/result" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
              View cancellation result
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private renderCancelResult(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="cancel-result-heading">
        <h2 id="cancel-result-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Cancellation Result</h2>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4" role="status">
          <p class="text-sm text-amber-800 font-semibold">Cancellation recorded (preview). Refund not yet processed.</p>
          <p class="text-xs text-amber-800 mt-1">Reference: VCT-CXL-0042 · Refund status: Requested</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
          <div><span class="text-brand-muted text-xs block">Refund amount</span><strong class="text-brand-black tabular-nums">LKR 238,500</strong></div>
          <div><span class="text-brand-muted text-xs block">Destination</span><strong class="text-brand-black">Original payment method</strong></div>
          <div><span class="text-brand-muted text-xs block">Expected timeline</span><strong class="text-brand-black">5–7 banking days after approval</strong></div>
          <div><span class="text-brand-muted text-xs block">Airline credit</span><strong class="text-brand-black">Alternative — 12 months validity</strong></div>
        </div>
        <a href="/bookings/${encodeURIComponent(this.bookingId)}/refund" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
          Track refund status
        </a>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ refund */

  private renderRefundTracker(): string {
    const steps = ['Requested', 'Quoted', 'Approved', 'Processing', 'Paid'];
    const rows = steps.map((step, i) => `
      <li class="flex items-center gap-3 p-3 rounded-xl bg-brand-canvas border border-brand-border" data-refund-step="${step.toLowerCase()}">
        <span class="refund-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">${step}</span>
        <span class="refund-detail text-sm text-brand-muted">${i === 0 ? '15 Nov 2026 — Refund request submitted for booking VCT-2026-0001' : i === 1 ? '16 Nov 2026 — Refund quote: LKR 238,500' : 'Pending'}</span>
      </li>
    `).join('');

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="refund-heading">
        <h2 id="refund-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Refund &amp; Airline Credit Tracker</h2>
        <div class="mb-4">
          <label for="refund-scenario" class="block text-xs font-bold text-brand-muted uppercase mb-1">Preview lifecycle state</label>
          <select id="refund-scenario" aria-label="Refund lifecycle preview state" class="w-full sm:w-72 min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
            <option value="quoted">Quoted (current)</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <ol class="space-y-3" aria-label="Refund lifecycle">${rows}</ol>
        <div id="refund-rejected" class="hidden mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-semibold" role="status">
          Refund rejected (preview). Airline credit remains available for 12 months.
        </div>
        <p id="refund-status" role="status" aria-live="polite" class="text-xs text-brand-muted mt-4">Preview state: Quoted. Refund processing requires backend integration.</p>
      </div>
    `;
  }

  /* -------------------------------------------------------------- disruption */

  private renderDisruptionAlert(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="disruption-heading">
        <h2 id="disruption-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Schedule Change &amp; Disruption</h2>
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
          <button type="button" id="btn-accept-revised" data-decision="accepted" class="min-h-[44px] px-5 rounded-xl bg-brand-success text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Accept revised schedule
          </button>
          <button type="button" id="btn-request-alternative" data-decision="alternative" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Request alternative
          </button>
          <button type="button" id="btn-contact-support" data-decision="support" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Contact support
          </button>
        </div>
        <div id="disruption-result" class="hidden mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold" role="status"></div>
        <div class="mt-4">
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/disruption/decision" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Open decision form
          </a>
        </div>
      </div>
    `;
  }

  private renderDisruptionDecision(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="decision-heading">
        <h2 id="decision-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Disruption Alternative Decision</h2>
        <p class="text-sm text-brand-muted mb-4">Choose how you want to proceed with the revised schedule.</p>
        <div class="space-y-3" role="radiogroup" aria-label="Disruption decision">
          <label class="flex items-start gap-3 p-4 rounded-xl border border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="disruption-decision" value="accept" aria-label="Accept the revised schedule" class="mt-1 h-4 w-4" />
            <span class="text-sm text-brand-black">Accept the revised schedule (15 Nov 2026, 04:15)</span>
          </label>
          <label class="flex items-start gap-3 p-4 rounded-xl border border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="disruption-decision" value="alternative" aria-label="Request an alternative flight" class="mt-1 h-4 w-4" />
            <span class="text-sm text-brand-black">Request an alternative flight</span>
          </label>
          <label class="flex items-start gap-3 p-4 rounded-xl border border-brand-border cursor-pointer hover:border-brand-primary transition-colors">
            <input type="radio" name="disruption-decision" value="refund" aria-label="Request a refund or airline credit" class="mt-1 h-4 w-4" />
            <span class="text-sm text-brand-black">Request a refund or airline credit</span>
          </label>
        </div>
        <div class="mt-4">
          <label for="decision-note" class="block text-xs font-bold text-brand-muted uppercase mb-1">Note (optional)</label>
          <textarea id="decision-note" rows="3" aria-label="Decision note" class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary"></textarea>
        </div>
        <p id="decision-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3">Select a decision to continue.</p>
        <div class="flex flex-wrap gap-3 mt-4">
          <button type="button" id="btn-confirm-decision" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
            Confirm decision
          </button>
          <a href="/bookings/${encodeURIComponent(this.bookingId)}/disruption" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">
            Back to disruption
          </a>
        </div>
        <div id="decision-result" class="hidden mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold" role="status"></div>
      </div>
    `;
  }

  /* ----------------------------------------------------------------- support */

  private renderSupportSpecial(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="special-heading">
        <h2 id="special-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Special Assistance Request</h2>
        <div class="space-y-4">
          <div>
            <label for="special-type" class="block text-xs font-bold text-brand-muted uppercase mb-1">Assistance type</label>
            <select id="special-type" aria-label="Assistance type" aria-describedby="special-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="">Select assistance type…</option>
              <option value="wheelchair">Wheelchair / mobility assistance</option>
              <option value="medical">Medical assistance</option>
              <option value="dietary">Special dietary meal</option>
              <option value="visual">Visual impairment support</option>
              <option value="hearing">Hearing impairment support</option>
            </select>
          </div>
          <div>
            <label for="special-segment" class="block text-xs font-bold text-brand-muted uppercase mb-1">Applies to</label>
            <select id="special-segment" aria-label="Flight segment" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="both">Both outbound and return</option>
              <option value="outbound">Outbound only</option>
              <option value="return">Return only</option>
            </select>
          </div>
          <div>
            <label for="special-notes" class="block text-xs font-bold text-brand-muted uppercase mb-1">Notes</label>
            <textarea id="special-notes" rows="3" aria-label="Assistance notes" aria-describedby="special-error" placeholder="Describe the assistance required (min 10 characters)" class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary"></textarea>
          </div>
          <label class="flex items-start gap-3 text-sm text-brand-black">
            <input type="checkbox" id="special-consent" aria-label="I consent to sharing these requirements with the airline" class="mt-1 h-4 w-4" />
            <span>I consent to sharing these requirements with the airline.</span>
          </label>
          <p id="special-error" role="alert" class="hidden text-xs text-red-700 font-semibold"></p>
          <button type="button" id="btn-submit-special" disabled aria-disabled="true" class="min-h-[44px] px-5 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
            Submit assistance request
          </button>
          <div id="special-result" class="hidden rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status">
            Assistance request recorded (preview). Reference VCT-ASST-0042. Airline confirmation pending.
          </div>
        </div>
      </div>
    `;
  }

  private renderSupportTracker(): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="support-heading">
        <h2 id="support-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Support Case &amp; Communication</h2>
        <div class="space-y-4">
          <div>
            <label for="support-type" class="block text-xs font-bold text-brand-muted uppercase mb-1">Request type</label>
            <select id="support-type" aria-label="Support request type" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="accessibility">Special Assistance / Accessibility</option>
              <option value="airline">Airline Support</option>
              <option value="urgent">Urgent Case</option>
              <option value="document">Document Correction</option>
            </select>
          </div>
          <div>
            <label for="support-message" class="block text-xs font-bold text-brand-muted uppercase mb-1">Message</label>
            <textarea id="support-message" rows="4" aria-label="Support message" aria-describedby="support-error" placeholder="Describe your request (min 10 characters)" class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary"></textarea>
            <p id="support-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-1"></p>
          </div>
          <button type="button" id="btn-submit-support" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Submit support request
          </button>
          <div id="support-result" class="hidden rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status">
            Support case created (preview). Case ID: VCT-SUP-0042. Backend confirmation pending.
          </div>
        </div>
        <div class="mt-6 rounded-xl border border-brand-border bg-brand-canvas p-4">
          <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Case History</h3>
          <div id="support-history" class="space-y-2 text-sm text-brand-muted">
            <div class="flex justify-between"><span>Case VCT-SUP-0041</span><span class="text-green-700 font-semibold">Resolved</span></div>
            <div class="flex justify-between"><span>Case VCT-SUP-0040</span><span class="text-amber-700 font-semibold">In Progress</span></div>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ events */

  private wireEvents(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const nav = (p: string) => {
      const router = (window as any).__VACATINA_ROUTER__;
      if (router?.navigateTo) router.navigateTo(p);
    };
    const setEnabled = (btn: HTMLButtonElement | null, enabled: boolean, enabledLabel: string, disabledLabel: string) => {
      if (!btn) return;
      btn.disabled = !enabled;
      btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      btn.textContent = enabled ? enabledLabel : disabledLabel;
      if (enabled) {
        btn.classList.remove('bg-gray-200', 'text-gray-500', 'cursor-not-allowed', 'opacity-60');
        btn.classList.add('bg-brand-primary', 'text-white', 'hover:opacity-90');
      } else {
        btn.classList.add('bg-gray-200', 'text-gray-500', 'cursor-not-allowed');
        btn.classList.remove('bg-brand-primary', 'text-white', 'hover:opacity-90');
      }
    };
    const showError = (el: HTMLElement | null, msg: string) => {
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
    };
    const hideError = (el: HTMLElement | null) => {
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
    };

    if (this.kind === 'change' && this.stage === 'select') {
      const depInput = $<HTMLInputElement>('#change-dep-date');
      const retInput = $<HTMLInputElement>('#change-ret-date');
      const passenger = $<HTMLSelectElement>('#change-passenger');
      const slice = $<HTMLSelectElement>('#change-slice');
      const quoteDiv = $('#change-quote');
      const status = $('#change-quote-status');
      const error = $('#change-date-error');
      const btnQuote = $<HTMLButtonElement>('#btn-get-quote');
      const btnContinue = $<HTMLButtonElement>('#btn-continue-alternatives');

      const invalidate = () => {
        this.clearQuote();
        quoteDiv?.classList.add('hidden');
        if (quoteDiv) quoteDiv.innerHTML = '';
        setEnabled(btnContinue, false, 'Continue to alternatives', 'Continue to alternatives');
        if (status) {
          status.textContent = 'Selection changed — request a new quote to continue.';
          status.classList.remove('hidden');
        }
        hideError(error);
        depInput?.classList.remove('border-red-400');
        retInput?.classList.remove('border-red-400');
        depInput?.setAttribute('aria-invalid', 'false');
        retInput?.setAttribute('aria-invalid', 'false');
      };

      [depInput, retInput, passenger, slice].forEach(el => {
        el?.addEventListener('input', invalidate);
        el?.addEventListener('change', invalidate);
      });

      btnQuote?.addEventListener('click', () => {
        const dep = depInput?.value || '';
        const ret = retInput?.value || '';
        const depMs = dep ? new Date(dep + 'T00:00:00').getTime() : NaN;
        const retMs = ret ? new Date(ret + 'T00:00:00').getTime() : NaN;

        if (!dep || !ret || Number.isNaN(depMs) || Number.isNaN(retMs) || retMs <= depMs) {
          this.clearQuote();
          quoteDiv?.classList.add('hidden');
          if (quoteDiv) quoteDiv.innerHTML = '';
          setEnabled(btnContinue, false, 'Continue to alternatives', 'Continue to alternatives');
          showError(error, 'Return date must be after the departure date. Enter valid dates to get a quote.');
          depInput?.setAttribute('aria-invalid', 'true');
          retInput?.setAttribute('aria-invalid', 'true');
          depInput?.classList.add('border-red-400');
          retInput?.classList.add('border-red-400');
          if (status) status.classList.add('hidden');
          return;
        }

        hideError(error);
        depInput?.setAttribute('aria-invalid', 'false');
        retInput?.setAttribute('aria-invalid', 'false');
        depInput?.classList.remove('border-red-400');
        retInput?.classList.remove('border-red-400');

        const days = Math.round((retMs - depMs) / 86400000);
        const fareDiff = days > 7 ? 12500 : 8500;
        const penalty = 5000;
        const fee = 1500;
        const total = fareDiff + penalty + fee;
        const quote: ChangeQuote = { dep, ret, days, fareDiff, penalty, fee, total };
        this.writeJson(this.quoteKey(), quote);

        if (quoteDiv) {
          quoteDiv.innerHTML = `
            <h3 class="font-heading text-sm font-semibold text-brand-black mb-2">Change Quote (Preview)</h3>
            <div class="space-y-1 text-sm text-brand-muted">
              <div class="flex justify-between"><span>Fare difference (${days} day${days === 1 ? '' : 's'})</span><strong class="text-brand-black tabular-nums">+LKR ${fareDiff.toLocaleString()}</strong></div>
              <div class="flex justify-between"><span>Airline penalty</span><strong class="text-brand-black tabular-nums">LKR ${penalty.toLocaleString()}</strong></div>
              <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums">LKR ${fee.toLocaleString()}</strong></div>
              <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Total due</span><strong class="text-brand-primary tabular-nums font-bold">LKR ${total.toLocaleString()}</strong></div>
            </div>
          `;
          quoteDiv.classList.remove('hidden');
        }
        if (status) {
          status.textContent = `Quote ready for ${dep} → ${ret}. Valid only for these dates.`;
          status.classList.remove('hidden');
        }
        setEnabled(btnContinue, true, 'Continue to alternatives', 'Continue to alternatives');
      });

      btnContinue?.addEventListener('click', () => {
        if (btnContinue.disabled) return;
        const quote = this.readJson<ChangeQuote>(this.quoteKey());
        if (!quote) {
          showError(error, 'Quote expired. Request a new quote.');
          setEnabled(btnContinue, false, 'Continue to alternatives', 'Continue to alternatives');
          return;
        }
        nav(`/bookings/${encodeURIComponent(this.bookingId)}/change/alternatives`);
      });
    }

    if (this.kind === 'change' && this.stage === 'alternatives') {
      const btnReview = $<HTMLButtonElement>('#btn-review-change');
      const error = $('#alt-error');
      const radios = Array.from(this.mount.querySelectorAll<HTMLInputElement>('input[name="change-alt"]'));
      radios.forEach(radio => {
        radio.addEventListener('change', () => {
          const alt = CHANGE_ALTERNATIVES.find(a => a.id === radio.value);
          if (alt) {
            this.writeJson(this.selectionKey(), { alternativeId: alt.id, flight: alt.flight, dep: alt.dep, arr: alt.arr, fareDiff: alt.fareDiff } satisfies ChangeSelection);
          }
          hideError(error);
          setEnabled(btnReview, true, 'Continue to review', 'Continue to review');
        });
      });
      btnReview?.addEventListener('click', () => {
        const selected = this.mount!.querySelector<HTMLInputElement>('input[name="change-alt"]:checked');
        if (!selected) {
          showError(error, 'Select an alternative to continue.');
          setEnabled(btnReview, false, 'Continue to review', 'Continue to review');
          return;
        }
        nav(`/bookings/${encodeURIComponent(this.bookingId)}/change/review`);
      });
    }

    if (this.kind === 'change' && this.stage === 'review') {
      const btnAccept = $<HTMLButtonElement>('#btn-accept-change');
      const terms = $<HTMLInputElement>('#change-accept-terms');
      const resultDiv = $('#change-result');
      terms?.addEventListener('change', () => {
        const quote = this.readJson<ChangeQuote>(this.quoteKey());
        const selection = this.readJson<ChangeSelection>(this.selectionKey());
        const canAccept = !!terms.checked && !!quote && !!selection;
        setEnabled(btnAccept, canAccept, 'Accept & reissue', 'Accept & reissue');
      });
      btnAccept?.addEventListener('click', () => {
        if (btnAccept.disabled) return;
        const quote = this.readJson<ChangeQuote>(this.quoteKey());
        if (!quote) {
          this.clearQuote();
          resultDiv?.classList.add('hidden');
          return;
        }
        resultDiv?.classList.remove('hidden');
        btnAccept.disabled = true;
        btnAccept.setAttribute('aria-disabled', 'true');
        btnAccept.textContent = 'Change request submitted';
        btnAccept.classList.add('opacity-60', 'cursor-not-allowed');
        const link = document.createElement('div');
        link.className = 'mt-4';
        link.innerHTML = `<a href="/bookings/${encodeURIComponent(this.bookingId)}/change/complete" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">View change completion</a>`;
        resultDiv?.parentElement?.insertBefore(link, resultDiv?.nextSibling || null);
      });
    }

    if (this.kind === 'cancel' && this.stage === 'quote') {
      const reason = $<HTMLSelectElement>('#cancel-reason');
      const terms = $<HTMLInputElement>('#cancel-confirm-terms');
      const btnConfirm = $<HTMLButtonElement>('#btn-confirm-cancel');
      const error = $('#cancel-error');
      const resultDiv = $('#cancel-result');
      const resultLink = $('#cancel-result-link');

      const sync = () => {
        const ok = !!reason?.value && !!terms?.checked;
        setEnabled(btnConfirm, ok, 'Confirm cancellation', 'Confirm cancellation');
        if (ok) {
          btnConfirm.classList.remove('bg-gray-200', 'text-gray-500');
          btnConfirm.classList.add('bg-red-600', 'text-white', 'hover:opacity-90');
        } else {
          btnConfirm.classList.remove('bg-red-600', 'hover:opacity-90');
          btnConfirm.classList.add('bg-gray-200', 'text-gray-500');
        }
        if (ok) hideError(error);
      };
      reason?.addEventListener('change', sync);
      terms?.addEventListener('change', sync);

      btnConfirm?.addEventListener('click', () => {
        if (btnConfirm.disabled) {
          showError(error, 'Select a cancellation reason and accept the terms before confirming.');
          return;
        }
        hideError(error);
        resultDiv?.classList.remove('hidden');
        resultLink?.classList.remove('hidden');
        btnConfirm.disabled = true;
        btnConfirm.setAttribute('aria-disabled', 'true');
        btnConfirm.textContent = 'Cancellation submitted (preview)';
        btnConfirm.classList.add('opacity-60', 'cursor-not-allowed');
      });
    }

    if (this.kind === 'refund') {
      const scenario = $<HTMLSelectElement>('#refund-scenario');
      const status = $('#refund-status');
      const rejected = $('#refund-rejected');
      const order = ['requested', 'quoted', 'approved', 'processing', 'paid'];
      const apply = (value: string) => {
        const steps = Array.from(this.mount!.querySelectorAll<HTMLElement>('[data-refund-step]'));
        const reached = value === 'rejected' ? 2 : order.indexOf(value) + 1;
        steps.forEach((li, idx) => {
          const badge = li.querySelector<HTMLElement>('.refund-badge');
          const detail = li.querySelector<HTMLElement>('.refund-detail');
          const active = idx < reached;
          li.classList.toggle('opacity-50', !active);
          if (badge) {
            badge.className = 'refund-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ' + (active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600');
          }
          if (detail) {
            if (idx === 0) detail.textContent = '15 Nov 2026 — Refund request submitted for booking VCT-2026-0001';
            else if (idx === 1) detail.textContent = '16 Nov 2026 — Refund quote: LKR 238,500';
            else if (active) detail.textContent = `Preview — ${order[idx][0].toUpperCase() + order[idx].slice(1)} on 18 Nov 2026`;
            else detail.textContent = 'Pending';
          }
        });
        if (value === 'rejected') {
          rejected?.classList.remove('hidden');
          if (status) status.textContent = 'Preview state: Rejected. Airline credit available for 12 months.';
        } else {
          rejected?.classList.add('hidden');
          if (status) status.textContent = `Preview state: ${value[0].toUpperCase() + value.slice(1)}. Refund processing requires backend integration.`;
        }
      };
      scenario?.addEventListener('change', () => apply(scenario.value));
    }

    if (this.kind === 'disruption' && this.stage === 'alert') {
      const resultDiv = $('#disruption-result');
      const messages: Record<string, string> = {
        accepted: 'Revised schedule accepted (preview). Reissue pending backend confirmation.',
        alternative: 'Alternative requested (preview). The rebooking desk will respond.',
        support: 'Support contacted (preview). Case created, an agent will follow up.',
      };
      ['#btn-accept-revised', '#btn-request-alternative', '#btn-contact-support'].forEach(sel => {
        const btn = $(sel);
        btn?.addEventListener('click', () => {
          const decision = btn.getAttribute('data-decision') || '';
          if (resultDiv) {
            resultDiv.textContent = messages[decision] || 'Decision recorded (preview).';
            resultDiv.classList.remove('hidden');
            resultDiv.setAttribute('data-decision', decision);
          }
        });
      });
    }

    if (this.kind === 'disruption' && this.stage === 'decision') {
      const btnConfirm = $<HTMLButtonElement>('#btn-confirm-decision');
      const error = $('#decision-error');
      const resultDiv = $('#decision-result');
      const radios = Array.from(this.mount.querySelectorAll<HTMLInputElement>('input[name="disruption-decision"]'));
      const labels: Record<string, string> = {
        accept: 'Revised schedule accepted (preview). Reissue pending backend confirmation.',
        alternative: 'Alternative flight requested (preview). Rebooking desk will respond.',
        refund: 'Refund / airline credit requested (preview). Processing pending backend confirmation.',
      };
      radios.forEach(radio => {
        radio.addEventListener('change', () => {
          hideError(error);
          setEnabled(btnConfirm, true, 'Confirm decision', 'Confirm decision');
        });
      });
      btnConfirm?.addEventListener('click', () => {
        const selected = this.mount!.querySelector<HTMLInputElement>('input[name="disruption-decision"]:checked');
        if (!selected) {
          showError(error, 'Select a decision to continue.');
          return;
        }
        hideError(error);
        if (resultDiv) {
          resultDiv.textContent = labels[selected.value] || 'Decision recorded (preview).';
          resultDiv.classList.remove('hidden');
          resultDiv.setAttribute('data-decision', selected.value);
        }
        btnConfirm.disabled = true;
        btnConfirm.setAttribute('aria-disabled', 'true');
        btnConfirm.textContent = 'Decision recorded (preview)';
        btnConfirm.classList.add('opacity-60', 'cursor-not-allowed');
      });
    }

    if (this.kind === 'support' && this.stage === 'special') {
      const type = $<HTMLSelectElement>('#special-type');
      const notes = $<HTMLTextAreaElement>('#special-notes');
      const consent = $<HTMLInputElement>('#special-consent');
      const btn = $<HTMLButtonElement>('#btn-submit-special');
      const error = $('#special-error');
      const resultDiv = $('#special-result');

      const sync = () => setEnabled(btn, !!type?.value && !!consent?.checked, 'Submit assistance request', 'Submit assistance request');
      type?.addEventListener('change', sync);
      consent?.addEventListener('change', sync);

      btn?.addEventListener('click', () => {
        if (btn.disabled) {
          showError(error, 'Select an assistance type and provide consent before submitting.');
          return;
        }
        const text = (notes?.value || '').trim();
        if (text.length < 10) {
          notes?.classList.add('border-red-400');
          notes?.setAttribute('aria-invalid', 'true');
          showError(error, 'Describe the assistance required in at least 10 characters.');
          resultDiv?.classList.add('hidden');
          return;
        }
        notes?.classList.remove('border-red-400');
        notes?.setAttribute('aria-invalid', 'false');
        hideError(error);
        resultDiv?.classList.remove('hidden');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Assistance request recorded (preview)';
        btn.classList.add('opacity-60', 'cursor-not-allowed');
      });
    }

    if (this.kind === 'support' && this.stage === 'tracker') {
      const btn = $<HTMLButtonElement>('#btn-submit-support');
      const resultDiv = $('#support-result');
      const msgField = $<HTMLTextAreaElement>('#support-message');
      const error = $('#support-error');
      const history = $('#support-history');

      btn?.addEventListener('click', () => {
        const text = (msgField?.value || '').trim();
        if (text.length < 10) {
          msgField?.classList.add('border-red-400');
          msgField?.setAttribute('aria-invalid', 'true');
          showError(error, 'Message must be at least 10 characters.');
          resultDiv?.classList.add('hidden');
          return;
        }
        msgField?.classList.remove('border-red-400');
        msgField?.setAttribute('aria-invalid', 'false');
        hideError(error);
        resultDiv?.classList.remove('hidden');
        if (history && !history.querySelector('[data-new-case]')) {
          const row = document.createElement('div');
          row.className = 'flex justify-between';
          row.setAttribute('data-new-case', 'true');
          row.innerHTML = '<span>Case VCT-SUP-0042</span><span class="text-blue-700 font-semibold">Open (preview)</span>';
          history.insertBefore(row, history.firstChild);
        }
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Support request recorded (preview)';
        btn.classList.add('opacity-60', 'cursor-not-allowed');
      });
    }
  }
}
