/* ============================================================================
 * Vacatina Flights — Manual Request-to-Book (Screens 46–50)
 *
 * Frontend-only, deterministic mock. Real state machine transitions, validation,
 * persistence and navigation. No ticket is ever issued here: every operator /
 * supplier / payment step is labelled preview and never reported as completed.
 *
 * Stages (route suffix):
 *   /flights/requests/:id/review     -> 46 request review & submit
 *   /flights/requests/:id/submitted  -> 47 request submitted
 *   /flights/requests/:id            -> 48 status tracker
 *   /flights/requests/:id/quote      -> 49 operator quotation accept/decline
 *   /flights/requests/:id/declined   -> 50 declined recovery
 * ============================================================================ */

import { canTransition, type ManualRequestState } from '../domain/flight-state-machines.ts';

export { type ManualRequestState };

export const MANUAL_REQUEST_LABELS: Record<ManualRequestState, string> = {
  submitted: 'Request Submitted',
  operator_review: 'Operator Review',
  quote_prepared: 'Quotation Prepared',
  customer_approval: 'Awaiting Your Approval',
  payment_pending: 'Payment Pending',
  confirmed: 'Confirmed (Ticketing in progress)',
  declined: 'Request Declined',
  unavailable: 'No Longer Available',
};

export const MANUAL_REQUEST_FLOW: ManualRequestState[] = [
  'submitted',
  'operator_review',
  'quote_prepared',
  'customer_approval',
  'payment_pending',
  'confirmed',
];

type Stage = 'review' | 'submitted' | 'tracker' | 'quote' | 'declined';

export interface ManualRequestQuote {
  adults: number;
  children: number;
  baseFare: number;
  taxes: number;
  serviceFee: number;
  total: number;
}

export interface ManualRequestRecord {
  id: string;
  status: ManualRequestState;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
  cabin: string;
  contactPhone: string;
  notes: string;
  quote: ManualRequestQuote | null;
  declineReason: string;
  history: { status: ManualRequestState; at: string; note: string }[];
}

const ADULT_FARE = 62000;
const CHILD_FARE = 45000;
const TAX_PER_PAX = 4000;
const SERVICE_FEE = 4000;

export function computeManualQuote(adults: number, children: number): ManualRequestQuote {
  const pax = adults + children;
  const baseFare = adults * ADULT_FARE + children * CHILD_FARE;
  const taxes = pax * TAX_PER_PAX;
  return { adults, children, baseFare, taxes, serviceFee: SERVICE_FEE, total: baseFare + taxes + SERVICE_FEE };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}

function normalizeStage(raw: string): Stage {
  const s = (raw || '').replace(/^\/+|\/+$/g, '');
  if (s === 'review') return 'review';
  if (s === 'submitted') return 'submitted';
  if (s === 'quote') return 'quote';
  if (s === 'declined') return 'declined';
  return 'tracker';
}

export class FlightsManualRequestView {
  private mount: HTMLElement | null = null;
  private requestId = 'VCT-REQ-0001';
  private stage: Stage = 'tracker';

  public render(mount: HTMLElement, stateOrStage: ManualRequestState | string = 'submitted', requestId = 'VCT-REQ-0000', rawStage = ''): void {
    this.mount = mount;
    this.requestId = requestId;
    // Back-compat: callers that pass a lifecycle state still get the tracker.
    this.stage = normalizeStage(rawStage || stateOrStage);
    mount.innerHTML = this.shell(this.stageContent());
    this.wire();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ store */

  private storeKey(): string {
    return `vacatina:manualRequest:${this.requestId}`;
  }

  private defaultRecord(): ManualRequestRecord {
    return {
      id: this.requestId,
      status: 'submitted',
      origin: 'CMB',
      destination: 'MLE',
      departDate: '2026-12-10',
      returnDate: '2026-12-17',
      adults: 2,
      children: 1,
      cabin: 'Economy',
      contactPhone: '+94 77 000 0000',
      notes: 'Island shuttle; prefer morning departure and through baggage.',
      quote: null,
      declineReason: '',
      history: [{ status: 'submitted', at: '10 Nov 2026, 09:12', note: 'Request submitted by traveller' }],
    };
  }

  private read(): ManualRequestRecord {
    try {
      const raw = window.sessionStorage.getItem(this.storeKey());
      if (!raw) return this.defaultRecord();
      const parsed = JSON.parse(raw) as ManualRequestRecord;
      if (!parsed || typeof parsed !== 'object' || !parsed.status) return this.defaultRecord();
      return { ...this.defaultRecord(), ...parsed };
    } catch {
      return this.defaultRecord();
    }
  }

  private write(record: ManualRequestRecord): void {
    try {
      window.sessionStorage.setItem(this.storeKey(), JSON.stringify(record));
    } catch {
      /* storage unavailable — flow still works in-page, never fabricates success */
    }
  }

  private advance(record: ManualRequestRecord, to: ManualRequestState, note: string): ManualRequestRecord {
    if (!canTransition('manualRequest', record.status, to)) {
      throw new Error(`Illegal manual request transition ${record.status} -> ${to}`);
    }
    const next: ManualRequestRecord = {
      ...record,
      status: to,
      history: [...record.history, { status: to, at: 'Preview timestamp', note }],
    };
    if (to === 'quote_prepared' && !next.quote) next.quote = computeManualQuote(next.adults, next.children);
    this.write(next);
    return next;
  }

  /* ------------------------------------------------------------------- view */

  private shell(body: string): string {
    return `
      <section class="flights-manual-request max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="mr-heading" data-mr-stage="${this.stage}">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Manual request-to-book · ${escapeHtml(this.stageLabel())}</p>
          <h1 id="mr-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Manual Flight Request</h1>
          <p class="text-sm text-brand-muted mt-2">Request reference: <strong class="text-brand-black">${escapeHtml(this.requestId)}</strong></p>
        </header>
        ${body}
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-4 mt-6" role="note">
          <p class="text-xs text-brand-muted leading-relaxed">
            <strong class="text-brand-black">Frontend preview:</strong> carrier, schedule, baggage and fare are confirmed by the Vacatina flight desk before any ticket exists. No instant ticket, payment capture or supplier confirmation is performed here.
          </p>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Back to flight search</a>
          <a href="/bookings/lookup" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Find another booking</a>
        </div>
      </section>
    `;
  }

  private stageLabel(): string {
    return {
      review: 'Step 1 of 4 · Review &amp; submit',
      submitted: 'Step 2 of 4 · Submitted',
      tracker: 'Status tracker',
      quote: 'Step 3 of 4 · Quotation',
      declined: 'Recovery',
    }[this.stage];
  }

  private stageContent(): string {
    switch (this.stage) {
      case 'review': return this.renderReview();
      case 'submitted': return this.renderSubmitted();
      case 'quote': return this.renderQuote();
      case 'declined': return this.renderDeclined();
      default: return this.renderTracker();
    }
  }

  private summaryCard(record: ManualRequestRecord): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-summary-heading">
        <h2 id="mr-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Request Summary</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span class="text-brand-muted text-xs block">Route</span><strong class="text-brand-black">${escapeHtml(record.origin)} → ${escapeHtml(record.destination)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Dates</span><strong class="text-brand-black">${escapeHtml(record.departDate)} → ${escapeHtml(record.returnDate)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Passengers</span><strong class="text-brand-black">${record.adults} Adult${record.adults === 1 ? '' : 's'}${record.children ? `, ${record.children} Child${record.children === 1 ? '' : 'ren'}` : ''}</strong></div>
          <div><span class="text-brand-muted text-xs block">Cabin</span><strong class="text-brand-black">${escapeHtml(record.cabin)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Contact</span><strong class="text-brand-black">${escapeHtml(record.contactPhone)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Status</span><span id="mr-status-badge" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-brand-subtle text-brand-primary border border-brand-border">${escapeHtml(MANUAL_REQUEST_LABELS[record.status])}</span></div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------- 46 review/submit */

  private renderReview(): string {
    const r = this.read();
    return `
      <form id="mr-review-form" class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-review-heading" novalidate>
        <h2 id="mr-review-heading" class="font-heading text-lg font-semibold text-brand-black mb-1">Review your request</h2>
        <p class="text-sm text-brand-muted mb-4">This sends a request to the flight desk. It is not a confirmed booking and no fare is locked.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="mr-depart" class="block text-xs font-bold text-brand-muted uppercase mb-1">Departure date</label>
            <input type="date" id="mr-depart" value="${escapeHtml(r.departDate)}" aria-describedby="mr-form-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label for="mr-return" class="block text-xs font-bold text-brand-muted uppercase mb-1">Return date</label>
            <input type="date" id="mr-return" value="${escapeHtml(r.returnDate)}" aria-describedby="mr-form-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div>
            <label for="mr-adults" class="block text-xs font-bold text-brand-muted uppercase mb-1">Adults</label>
            <select id="mr-adults" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              ${[1, 2, 3, 4].map(n => `<option value="${n}" ${r.adults === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="mr-children" class="block text-xs font-bold text-brand-muted uppercase mb-1">Children (2–11)</label>
            <select id="mr-children" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              ${[0, 1, 2, 3].map(n => `<option value="${n}" ${r.children === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div class="sm:col-span-2">
            <label for="mr-phone" class="block text-xs font-bold text-brand-muted uppercase mb-1">Contact phone</label>
            <input type="tel" id="mr-phone" value="${escapeHtml(r.contactPhone)}" aria-describedby="mr-form-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div class="sm:col-span-2">
            <label for="mr-notes" class="block text-xs font-bold text-brand-muted uppercase mb-1">Preferences (optional)</label>
            <textarea id="mr-notes" rows="3" class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">${escapeHtml(r.notes)}</textarea>
          </div>
        </div>
        <label class="flex items-start gap-3 text-sm text-brand-black mt-4">
          <input type="checkbox" id="mr-consent" class="mt-1 h-4 w-4" />
          <span>I understand this is a request, not a confirmed booking, and that the fare is only locked after I approve a quotation.</span>
        </label>
        <p id="mr-form-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
        <div class="flex flex-wrap gap-3 mt-4">
          <button type="submit" id="mr-submit" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Submit request</button>
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Cancel</a>
        </div>
        <div id="mr-submit-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
      </form>
    `;
  }

  /* ------------------------------------------------------------ 47 submitted */

  private renderSubmitted(): string {
    const r = this.read();
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-submitted-heading">
        <h2 id="mr-submitted-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Request submitted</h2>
        <div class="rounded-xl border border-green-200 bg-green-50 p-4 mb-4" role="status">
          <p class="text-sm text-green-800 font-semibold">Your request was recorded (preview). Reference ${escapeHtml(r.id)}.</p>
          <p class="text-xs text-green-800 mt-1">No seat is held and no fare is locked until you approve the quotation.</p>
        </div>
        ${this.summaryCard(r)}
        <ol class="space-y-2 text-sm text-brand-muted mb-4" aria-label="What happens next">
          <li>• The flight desk verifies carrier, schedule, baggage and fare rules.</li>
          <li>• You receive a quotation with the verified itinerary and price.</li>
          <li>• Nothing is ticketed until you approve and payment is verified separately.</li>
        </ol>
        <div class="flex flex-wrap gap-3">
          <a href="/flights/requests/${encodeURIComponent(r.id)}" id="mr-track-link" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Track this request</a>
          <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Back to search</a>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------- 48 tracker */

  private renderTracker(): string {
    const r = this.read();
    const currentIndex = MANUAL_REQUEST_FLOW.indexOf(r.status);
    const rows = MANUAL_REQUEST_FLOW.map((status, index) => {
      const reached = currentIndex >= index && r.status !== 'declined' && r.status !== 'unavailable';
      return `
        <li class="flex items-start gap-3 p-3 rounded-xl border border-brand-border ${reached ? 'bg-brand-canvas' : 'bg-white opacity-70'}" data-mr-step="${status}" data-reached="${reached}">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${reached ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-500'}">${index + 1}</span>
          <span class="flex-1">
            <span class="block text-sm font-semibold ${reached ? 'text-brand-black' : 'text-brand-muted'}">${escapeHtml(MANUAL_REQUEST_LABELS[status])}</span>
            <span class="block text-xs text-brand-muted">${reached ? 'Reached — preview timeline' : 'Pending'}</span>
          </span>
        </li>
      `;
    }).join('');

    const terminal = r.status === 'declined' || r.status === 'unavailable';
    const canAdvance = !terminal && MANUAL_REQUEST_FLOW.indexOf(r.status) < MANUAL_REQUEST_FLOW.length - 1;

    return `
      ${this.summaryCard(r)}
      ${terminal ? `
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 mb-4" role="status">
          <p class="text-sm text-red-800 font-semibold">${escapeHtml(MANUAL_REQUEST_LABELS[r.status])}${r.declineReason ? ` — ${escapeHtml(r.declineReason)}` : ''}</p>
          <p class="text-xs text-red-800 mt-1">You can edit your request and resubmit it.</p>
        </div>
      ` : ''}
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-timeline-heading">
        <h2 id="mr-timeline-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Request timeline</h2>
        <ol class="space-y-3" aria-label="Manual request lifecycle">${rows}</ol>
      </div>
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-actions-heading">
        <h2 id="mr-actions-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Request actions</h2>
        <div class="flex flex-wrap gap-3">
          ${r.quote && (r.status === 'quote_prepared' || r.status === 'customer_approval' || r.status === 'payment_pending')
            ? `<a href="/flights/requests/${encodeURIComponent(r.id)}/quote" id="mr-open-quote" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Review quotation</a>`
            : ''}
          ${canAdvance ? `<button type="button" id="mr-demo-advance" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Advance desk review (demo)</button>` : ''}
          ${terminal ? `<a href="/flights/requests/${encodeURIComponent(r.id)}/declined" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Recover this request</a>` : ''}
          <a href="/flights/requests/${encodeURIComponent(r.id)}/review" id="mr-edit" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Edit request</a>
        </div>
        <div class="mt-4 pt-4 border-t border-brand-border">
          <label for="mr-withdraw-reason" class="block text-xs font-bold text-brand-muted uppercase mb-1">Withdraw request</label>
          <div class="flex flex-col sm:flex-row gap-3">
            <select id="mr-withdraw-reason" class="flex-1 min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="">Select a reason…</option>
              <option value="plans">Change of plans</option>
              <option value="found">Found another option</option>
              <option value="timing">Dates no longer work</option>
            </select>
            <button type="button" id="mr-withdraw" class="min-h-[44px] px-5 rounded-xl border border-red-300 text-red-700 font-semibold text-sm hover:bg-red-50 transition-colors">Withdraw request</button>
          </div>
          <p id="mr-withdraw-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-2"></p>
          <div id="mr-withdraw-result" class="hidden mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-semibold" role="status"></div>
        </div>
        <div id="mr-advance-result" class="hidden mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold" role="status"></div>
      </div>
    `;
  }

  /* ---------------------------------------------------------- 49 quotation */

  private renderQuote(): string {
    let r = this.read();
    if (!r.quote && (r.status === 'quote_prepared' || r.status === 'customer_approval' || r.status === 'payment_pending')) {
      r = { ...r, quote: computeManualQuote(r.adults, r.children) };
      this.write(r);
    }
    const q = r.quote || computeManualQuote(r.adults, r.children);

    return `
      ${this.summaryCard(r)}
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-quote-heading">
        <h2 id="mr-quote-heading" class="font-heading text-lg font-semibold text-brand-black mb-1">Operator quotation</h2>
        <p class="text-sm text-brand-muted mb-4">Verified itinerary and price prepared by the flight desk (preview).</p>
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 mb-4" aria-labelledby="mr-quote-breakdown">
          <h3 id="mr-quote-breakdown" class="font-heading text-sm font-semibold text-brand-black mb-2">Fare breakdown</h3>
          <div class="space-y-1 text-sm text-brand-muted">
            <div class="flex justify-between"><span>Base fare (${q.adults} adult${q.adults === 1 ? '' : 's'}${q.children ? `, ${q.children} child${q.children === 1 ? '' : 'ren'}` : ''})</span><strong class="text-brand-black tabular-nums" id="mr-quote-base">LKR ${q.baseFare.toLocaleString()}</strong></div>
            <div class="flex justify-between"><span>Taxes &amp; carrier charges</span><strong class="text-brand-black tabular-nums" id="mr-quote-taxes">LKR ${q.taxes.toLocaleString()}</strong></div>
            <div class="flex justify-between"><span>Vacatina service fee</span><strong class="text-brand-black tabular-nums" id="mr-quote-fee">LKR ${q.serviceFee.toLocaleString()}</strong></div>
            <div class="flex justify-between border-t border-brand-border pt-1 mt-1"><span class="font-bold text-brand-black">Total due on approval</span><strong class="text-brand-primary tabular-nums font-bold" id="mr-quote-total">LKR ${q.total.toLocaleString()}</strong></div>
          </div>
        </div>
        <p class="text-xs text-brand-muted mb-4">Quotation reference ${escapeHtml(r.id)}-Q1 · valid for 24 hours in a live system. This preview does not reserve inventory.</p>

        <label class="flex items-start gap-3 text-sm text-brand-black mb-3">
          <input type="checkbox" id="mr-quote-consent" class="mt-1 h-4 w-4" />
          <span>I approve this quotation and understand a ticket is issued only after payment and supplier confirmation.</span>
        </label>
        <p id="mr-quote-error" role="alert" class="hidden text-xs text-red-700 font-semibold mb-3"></p>
        <div class="flex flex-wrap gap-3">
          <button type="button" id="mr-accept-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Approve quotation</button>
          <button type="button" id="mr-decline-quote" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Decline quotation</button>
        </div>
        <div id="mr-quote-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        <div id="mr-decline-panel" class="hidden mt-4 rounded-xl border border-brand-border bg-brand-canvas p-4">
          <label for="mr-decline-reason" class="block text-xs font-bold text-brand-muted uppercase mb-1">Reason for declining</label>
          <select id="mr-decline-reason" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
            <option value="">Select a reason…</option>
            <option value="price">Price too high</option>
            <option value="schedule">Schedule does not suit</option>
            <option value="other">Other</option>
          </select>
          <p id="mr-decline-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-2"></p>
          <button type="button" id="mr-confirm-decline" class="mt-3 min-h-[44px] px-5 rounded-xl border border-red-300 text-red-700 font-semibold text-sm hover:bg-red-50 transition-colors">Confirm decline</button>
        </div>
      </div>
    `;
  }

  /* ----------------------------------------------------------- 50 declined */

  private renderDeclined(): string {
    const r = this.read();
    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="mr-declined-heading">
        <h2 id="mr-declined-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Request declined</h2>
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 mb-4" role="status">
          <p class="text-sm text-red-800 font-semibold">This request was declined${r.declineReason ? ` — ${escapeHtml(r.declineReason)}` : ''}.</p>
          <p class="text-xs text-red-800 mt-1">No payment was taken and no ticket was issued.</p>
        </div>
        <p class="text-sm text-brand-muted mb-4">Adjust the dates or passenger mix and resubmit, or start a new search for live availability.</p>
        <form id="mr-recovery-form" novalidate class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="mr-recover-depart" class="block text-xs font-bold text-brand-muted uppercase mb-1">New departure date</label>
              <input type="date" id="mr-recover-depart" value="${escapeHtml(r.departDate)}" aria-describedby="mr-recover-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="mr-recover-return" class="block text-xs font-bold text-brand-muted uppercase mb-1">New return date</label>
              <input type="date" id="mr-recover-return" value="${escapeHtml(r.returnDate)}" aria-describedby="mr-recover-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <p id="mr-recover-error" role="alert" class="hidden text-xs text-red-700 font-semibold"></p>
          <div class="flex flex-wrap gap-3">
            <button type="submit" id="mr-resubmit" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Resubmit request</button>
            <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Start a new search</a>
          </div>
          <div id="mr-recover-result" class="hidden rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        </form>
      </div>
    `;
  }

  /* ----------------------------------------------------------------- events */

  private wire(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const nav = (p: string) => {
      const router = (window as any).__VACATINA_ROUTER__;
      if (router?.navigateTo) router.navigateTo(p);
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
    const mark = (el: HTMLElement | null, invalid: boolean) => {
      if (!el) return;
      el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      el.classList.toggle('border-red-400', invalid);
    };
    const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

    /* 46 — review & submit */
    if (this.stage === 'review') {
      const form = $<HTMLFormElement>('#mr-review-form');
      const depart = $<HTMLInputElement>('#mr-depart');
      const ret = $<HTMLInputElement>('#mr-return');
      const phone = $<HTMLInputElement>('#mr-phone');
      const adults = $<HTMLSelectElement>('#mr-adults');
      const children = $<HTMLSelectElement>('#mr-children');
      const consent = $<HTMLInputElement>('#mr-consent');
      const error = $('#mr-form-error');
      const result = $('#mr-submit-result');

      const submitBtn = $<HTMLButtonElement>('#mr-submit');
      let submitting = false;
      const submitRequest = () => {
        if (submitting) return;
        submitting = true;
        result?.classList.add('hidden');
        const dep = depart?.value || '';
        const back = ret?.value || '';
        const depMs = dep ? new Date(dep + 'T00:00:00').getTime() : NaN;
        const backMs = back ? new Date(back + 'T00:00:00').getTime() : NaN;
        const phoneDigits = (phone?.value || '').replace(/\D/g, '');

        mark(depart, false); mark(ret, false); mark(phone, false);

        if (!dep || !back || Number.isNaN(depMs) || Number.isNaN(backMs) || backMs <= depMs) {
          mark(depart, true); mark(ret, true);
          showError(error, 'Return date must be after the departure date. Enter valid dates to continue.');
          submitting = false;
          return;
        }
        if (phoneDigits.length < 9) {
          mark(phone, true);
          showError(error, 'Enter a contact phone number with at least 9 digits so the flight desk can reach you.');
          submitting = false;
          return;
        }
        if (!consent?.checked) {
          showError(error, 'Confirm that you understand this is a request, not a confirmed booking.');
          submitting = false;
          return;
        }

        hideError(error);
        const record: ManualRequestRecord = {
          ...this.defaultRecord(),
          id: this.requestId,
          status: 'submitted',
          departDate: dep,
          returnDate: back,
          adults: Number(adults?.value || 1),
          children: Number(children?.value || 0),
          contactPhone: phone?.value || '',
          notes: $<HTMLTextAreaElement>('#mr-notes')?.value || '',
          quote: null,
          declineReason: '',
          history: [{ status: 'submitted', at: 'Preview timestamp', note: 'Request submitted by traveller' }],
        };
        this.write(record);
        if (result) {
          result.textContent = `Request recorded (preview). Reference ${record.id} — ${daysBetween(dep, back)} nights.`;
          result.classList.remove('hidden');
        }
        nav(`/flights/requests/${encodeURIComponent(record.id)}/submitted`);
      };

      form?.addEventListener('submit', event => {
        event.preventDefault();
        submitRequest();
      });

      submitBtn?.addEventListener('click', event => {
        event.preventDefault();
        submitRequest();
      });

      // Keyboard activation (Enter/Space) — ensures Enter submission works even
      // when the browser does not synthesise a click from key activation.
      submitBtn?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          submitRequest();
        }
      });
    }

    /* 47 — submitted */
    if (this.stage === 'submitted') {
      const link = $<HTMLAnchorElement>('#mr-track-link');
      link?.addEventListener('click', event => {
        event.preventDefault();
        nav(link.getAttribute('href') || '/flights');
      });
    }

    /* 48 — tracker */
    if (this.stage === 'tracker') {
      const advanceBtn = $<HTMLButtonElement>('#mr-demo-advance');
      const advanceResult = $('#mr-advance-result');
      advanceBtn?.addEventListener('click', () => {
        const record = this.read();
        const idx = MANUAL_REQUEST_FLOW.indexOf(record.status);
        const next = MANUAL_REQUEST_FLOW[idx + 1];
        if (!next) return;
        let updated: ManualRequestRecord;
        try {
          updated = this.advance(record, next, `Desk moved request to ${MANUAL_REQUEST_LABELS[next]}`);
        } catch (e) {
          if (advanceResult) {
            advanceResult.textContent = `Cannot advance: ${(e as Error).message}`;
            advanceResult.classList.remove('hidden');
          }
          return;
        }
        if (advanceResult) {
          advanceResult.textContent = `Preview: request moved to “${MANUAL_REQUEST_LABELS[updated.status]}”. No supplier action was performed.`;
          advanceResult.classList.remove('hidden');
        }
        this.render(this.mount!, updated.status, this.requestId, 'tracker');
        // Re-render replaces the DOM, so re-announce the preview outcome.
        const refreshed = this.mount!.querySelector<HTMLElement>('#mr-advance-result');
        if (refreshed) {
          refreshed.textContent = `Preview: request moved to “${MANUAL_REQUEST_LABELS[updated.status]}”. No supplier action was performed.`;
          refreshed.classList.remove('hidden');
        }
      });

      const withdrawReason = $<HTMLSelectElement>('#mr-withdraw-reason');
      const withdrawBtn = $<HTMLButtonElement>('#mr-withdraw');
      const withdrawError = $('#mr-withdraw-error');
      const withdrawResult = $('#mr-withdraw-result');

      withdrawBtn?.addEventListener('click', () => {
        if (!withdrawReason?.value) {
          showError(withdrawError, 'Select a reason before withdrawing the request.');
          withdrawReason?.setAttribute('aria-invalid', 'true');
          return;
        }
        hideError(withdrawError);
        const record = this.read();
        const reasonLabel = withdrawReason.options[withdrawReason.selectedIndex]?.text || 'Withdrawn by traveller';
        let updated: ManualRequestRecord;
        try {
          updated = this.advance(record, 'declined', `Withdrawn by traveller — ${reasonLabel}`);
        } catch {
          // Terminal states cannot be withdrawn; stay honest instead of faking a change.
          showError(withdrawError, 'This request can no longer be withdrawn in its current state.');
          return;
        }
        updated = { ...updated, declineReason: `Withdrawn by traveller — ${reasonLabel}` };
        this.write(updated);
        if (withdrawResult) {
          withdrawResult.textContent = 'Request withdrawn (preview). No payment was taken and no ticket was issued.';
          withdrawResult.classList.remove('hidden');
        }
        withdrawBtn.disabled = true;
        withdrawBtn.setAttribute('aria-disabled', 'true');
      });

      const edit = $<HTMLAnchorElement>('#mr-edit');
      edit?.addEventListener('click', event => {
        event.preventDefault();
        nav(edit.getAttribute('href') || '/flights');
      });
      const quoteLink = $<HTMLAnchorElement>('#mr-open-quote');
      quoteLink?.addEventListener('click', event => {
        event.preventDefault();
        nav(quoteLink.getAttribute('href') || '/flights');
      });
    }

    /* 49 — quotation */
    if (this.stage === 'quote') {
      const consent = $<HTMLInputElement>('#mr-quote-consent');
      const accept = $<HTMLButtonElement>('#mr-accept-quote');
      const decline = $<HTMLButtonElement>('#mr-decline-quote');
      const error = $('#mr-quote-error');
      const result = $('#mr-quote-result');
      const declinePanel = $('#mr-decline-panel');
      const declineReason = $<HTMLSelectElement>('#mr-decline-reason');
      const declineError = $('#mr-decline-error');
      const confirmDecline = $<HTMLButtonElement>('#mr-confirm-decline');

      accept?.addEventListener('click', () => {
        const record = this.read();
        if (!consent?.checked) {
          showError(error, 'Approve the quotation before continuing.');
          return;
        }
        if (!record.quote) {
          showError(error, 'No active quotation. Request a new quotation from the tracker.');
          return;
        }
        hideError(error);
        let updated = record;
        try {
          updated = this.advance(updated, 'customer_approval', 'Traveller approved the quotation');
          updated = this.advance(updated, 'payment_pending', 'Payment step opened (preview — no capture)');
        } catch (e) {
          showError(error, (e as Error).message);
          return;
        }
        if (result) {
          result.textContent = `Quotation approved (preview). Status: ${MANUAL_REQUEST_LABELS[updated.status]}. No payment was captured and no ticket was issued.`;
          result.classList.remove('hidden');
        }
        accept.disabled = true;
        accept.setAttribute('aria-disabled', 'true');
        accept.textContent = 'Quotation approved (preview)';
        accept.classList.add('opacity-60', 'cursor-not-allowed');
        decline?.setAttribute('disabled', 'true');
        decline?.setAttribute('aria-disabled', 'true');
        decline?.classList.add('opacity-60', 'cursor-not-allowed');
      });

      decline?.addEventListener('click', () => {
        declinePanel?.classList.remove('hidden');
        declineReason?.focus();
      });

      confirmDecline?.addEventListener('click', () => {
        if (!declineReason?.value) {
          showError(declineError, 'Select a reason for declining the quotation.');
          declineReason?.setAttribute('aria-invalid', 'true');
          return;
        }
        hideError(declineError);
        const record = this.read();
        const label = declineReason.options[declineReason.selectedIndex]?.text || 'Declined';
        let updated: ManualRequestRecord;
        try {
          updated = this.advance(record, 'declined', `Quotation declined — ${label}`);
        } catch (e) {
          showError(declineError, (e as Error).message);
          return;
        }
        updated = { ...updated, declineReason: `Quotation declined — ${label}` };
        this.write(updated);
        nav(`/flights/requests/${encodeURIComponent(this.requestId)}/declined`);
      });
    }

    /* 50 — declined recovery */
    if (this.stage === 'declined') {
      const form = $<HTMLFormElement>('#mr-recovery-form');
      const depart = $<HTMLInputElement>('#mr-recover-depart');
      const ret = $<HTMLInputElement>('#mr-recover-return');
      const error = $('#mr-recover-error');
      const result = $('#mr-recover-result');

      form?.addEventListener('submit', event => {
        event.preventDefault();
        const dep = depart?.value || '';
        const back = ret?.value || '';
        const depMs = dep ? new Date(dep + 'T00:00:00').getTime() : NaN;
        const backMs = back ? new Date(back + 'T00:00:00').getTime() : NaN;
        mark(depart, false); mark(ret, false);
        if (!dep || !back || Number.isNaN(depMs) || Number.isNaN(backMs) || backMs <= depMs) {
          mark(depart, true); mark(ret, true);
          showError(error, 'Return date must be after the departure date. Enter valid dates to resubmit.');
          return;
        }
        hideError(error);
        const record = this.read();
        let updated: ManualRequestRecord;
        try {
          updated = this.advance({ ...record, departDate: dep, returnDate: back, quote: null }, 'submitted', 'Request resubmitted after decline');
        } catch (e) {
          showError(error, (e as Error).message);
          return;
        }
        updated = { ...updated, departDate: dep, returnDate: back, quote: null, declineReason: '' };
        this.write(updated);
        if (result) {
          result.textContent = `Request resubmitted (preview). Reference ${updated.id} · ${dep} → ${back}.`;
          result.classList.remove('hidden');
        }
        nav(`/flights/requests/${encodeURIComponent(updated.id)}/submitted`);
      });
    }
  }
}
