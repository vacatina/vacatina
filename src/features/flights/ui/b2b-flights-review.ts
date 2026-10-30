/* ============================================================================
 * Vacatina B2B Flights — Agent Booking Review, Credit & Ticket Management
 *
 * Screen 55: /b2b/flights/review          → booking review, credit check, confirm
 * Screen 56: /b2b/flights/review/ticket   → ticket management after confirmation
 *
 * Frontend-only demo fixture. Credit limits, payment authorisation, PNRs and
 * ticket numbers are deterministic previews — never presented as real.
 * ============================================================================ */

import {
  AGENT_FIXTURE, agentBanner, clearStore, escapeHtml, hideError, markInvalid,
  money, navigate, previewNote, readStore, showError, writeStore,
  type B2BTraveller,
} from './b2b-shared.ts';

interface StoredQuotation {
  offer: { id: string; flight: string; airline: string; route: string; depart: string; arrive: string; netFare: number; seats: number; fareBasis: string };
  passengers: number;
  markupPercent: number;
  serviceFee: number;
  baggagePrice: number;
  baggageUnits: number;
  clientName: string;
  clientEmail: string;
  reference: string;
  status: 'draft' | 'sent';
}

type PaymentMethod = 'agency_credit' | 'card' | 'bank_transfer';
type BookingStatus = 'draft' | 'confirmed_pending_ticket' | 'ticketed_preview' | 'voided';

interface B2BBooking {
  reference: string;
  quotationReference: string;
  offer: StoredQuotation['offer'];
  passengers: number;
  clientName: string;
  clientEmail: string;
  total: number;
  paymentMethod: PaymentMethod;
  status: BookingStatus;
  travellers: B2BTraveller[];
  ticketNumbers: string[];
  audit: { at: string; action: string }[];
  voidReason: string;
}

type Stage = 'review' | 'ticket';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  agency_credit: 'Agency credit account (IATA)',
  card: 'Corporate card (payment link, preview)',
  bank_transfer: 'Bank transfer (proforma, preview)',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Draft — not confirmed',
  confirmed_pending_ticket: 'Confirmed — awaiting ticket issuance',
  ticketed_preview: 'Ticketed (preview)',
  voided: 'Voided',
};

function quotationTotals(q: StoredQuotation): number {
  const net = q.offer.netFare * q.passengers;
  const markup = Math.round(net * (q.markupPercent / 100));
  return net + markup + q.baggageUnits * q.baggagePrice + q.serviceFee;
}

function normalizeStage(raw: string): Stage {
  return (raw || '').replace(/^\/+|\/+$/g, '') === 'ticket' ? 'ticket' : 'review';
}

export class B2BFlightsReviewView {
  private mount: HTMLElement | null = null;
  private stage: Stage = 'review';

  public render(mount: HTMLElement, rawStage = ''): void {
    this.mount = mount;
    this.stage = normalizeStage(rawStage);
    mount.innerHTML = this.shell(this.stage === 'ticket' ? this.ticketContent() : this.reviewContent());
    this.wire();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ store */

  private quotation(): StoredQuotation | null {
    const q = readStore<StoredQuotation>('quotation');
    if (q && q.offer) return q;
    const selection = readStore<{ offer: StoredQuotation['offer']; passengers: number; markupPercent: number }>('selection');
    if (!selection || !selection.offer) return null;
    return {
      ...selection,
      serviceFee: 3500,
      baggagePrice: 4500,
      baggageUnits: 0,
      clientName: '',
      clientEmail: '',
      reference: 'VCT-QT-0001',
      status: 'draft',
    };
  }

  private travellers(): B2BTraveller[] {
    return readStore<B2BTraveller[]>('travellers') || [];
  }

  private booking(): B2BBooking | null {
    return readStore<B2BBooking>('booking');
  }

  /* ------------------------------------------------------------------- view */

  private shell(body: string): string {
    const heading = this.stage === 'ticket'
      ? 'Agent Booking &amp; Ticket Management'
      : 'B2B Flight Booking Review &amp; Approval';
    return `
      <section class="b2b-flights-review max-w-5xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="b2b-review-heading" data-b2b-stage="${this.stage}">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Agent booking desk · ${this.stage === 'ticket' ? 'Step 2 of 2 · Ticketing' : 'Step 1 of 2 · Review &amp; confirm'}</p>
          <h1 id="b2b-review-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${heading}</h1>
          <p class="text-sm text-brand-muted mt-2">Review the booking, check agency credit and confirm. Ticketing is a separate preview step.</p>
        </header>
        ${agentBanner()}
        ${body}
        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/b2b/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Back to search</a>
          <a href="/b2b/flights/quotation" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Quotation builder</a>
          <a href="/b2b/flights/travellers" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Travellers</a>
          <a href="/b2b/flights/manage" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Booking management</a>
        </div>
      </section>
    `;
  }

  private emptyBlock(title: string, message: string): string {
    return `
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6" role="status">
        <p class="text-sm text-amber-800 font-semibold">${escapeHtml(title)}</p>
        <p class="text-xs text-amber-800 mt-1">${escapeHtml(message)}</p>
        <a href="/b2b/flights" class="inline-flex items-center min-h-[44px] mt-4 px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Search wholesale fares</a>
      </div>
    `;
  }

  /* -------------------------------------------------------- 55 review/credit */

  private reviewContent(): string {
    const existing = this.booking();
    if (existing && existing.status !== 'draft') {
      return `
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="b2b-existing-heading">
          <h2 id="b2b-existing-heading" class="font-heading text-lg font-semibold text-brand-black mb-2">Booking ${escapeHtml(existing.reference)} already confirmed</h2>
          <p class="text-sm text-brand-muted mb-1">Status: <strong class="text-brand-black" data-booking-status>${escapeHtml(STATUS_LABELS[existing.status])}</strong></p>
          <p class="text-xs text-brand-muted">Total ${money(existing.total)} · ${existing.travellers.length} traveller(s) · ${escapeHtml(PAYMENT_LABELS[existing.paymentMethod])}</p>
          <div class="flex flex-wrap gap-3 mt-4">
            <a href="/b2b/flights/review/ticket" id="b2b-goto-ticket" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Open ticket management</a>
            <button type="button" id="b2b-start-new" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Start a new booking</button>
          </div>
        </div>
        ${previewNote('This booking exists only in this browser session. No supplier reservation or payment was created.')}
      `;
    }

    const q = this.quotation();
    if (!q) {
      return this.emptyBlock('No quotation in progress', 'Build a quotation from a wholesale fare before reviewing a booking.');
    }

    const travellers = this.travellers();
    const total = quotationTotals(q);
    const available = Math.max(0, AGENT_FIXTURE.creditLimit - AGENT_FIXTURE.creditUsed);
    const overLimit = total > available;
    const shortfall = total - available;

    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="b2b-itinerary-heading">
            <h2 id="b2b-itinerary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Booking summary</h2>
            <p class="font-semibold text-brand-black text-sm">${escapeHtml(q.offer.flight)} · ${escapeHtml(q.offer.airline)}</p>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(q.offer.route)} · Dep ${escapeHtml(q.offer.depart)} · Arr ${escapeHtml(q.offer.arrive)} · ${escapeHtml(q.offer.fareBasis)}</p>
            <p class="text-xs text-brand-muted mt-1">Quotation ${escapeHtml(q.reference)} · ${q.passengers} passenger(s) · ${travellers.length} traveller record(s) captured</p>
            ${q.clientName ? `<p class="text-xs text-brand-muted mt-1">Client: ${escapeHtml(q.clientName)}${q.clientEmail ? ` · ${escapeHtml(q.clientEmail)}` : ''}</p>` : ''}

            <h3 class="font-heading text-sm font-semibold text-brand-black mt-4 mb-2">Passengers</h3>
            ${travellers.length ? `
              <ul class="space-y-2">
                ${travellers.map(t => `
                  <li class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-brand-border bg-brand-canvas text-sm">
                    <span class="font-semibold text-brand-black">${escapeHtml(t.title)} ${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</span>
                    <span class="text-xs text-brand-muted">Passport on file · expires ${escapeHtml(t.passportExpiry)}</span>
                  </li>
                `).join('')}
              </ul>
            ` : `
              <p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3" id="b2b-no-travellers">
                No traveller records captured. <a href="/b2b/flights/travellers" class="underline font-semibold">Add passengers</a> before confirming.
              </p>
            `}
            ${travellers.length && travellers.length !== q.passengers
              ? `<p class="text-xs text-amber-800 mt-2">Quotation is for ${q.passengers} passenger(s) but ${travellers.length} traveller record(s) exist. Names must match the quotation before ticketing.</p>`
              : ''}
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="b2b-payment-heading">
            <h2 id="b2b-payment-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Payment method</h2>
            <label for="b2b-payment-method" class="block text-xs font-bold text-brand-muted uppercase mb-1">Settlement</label>
            <select id="b2b-payment-method" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="agency_credit">${escapeHtml(PAYMENT_LABELS.agency_credit)}</option>
              <option value="card">${escapeHtml(PAYMENT_LABELS.card)}</option>
              <option value="bank_transfer">${escapeHtml(PAYMENT_LABELS.bank_transfer)}</option>
            </select>
            <p id="b2b-payment-note" class="text-xs text-brand-muted mt-2">Credit bookings are checked against the agency credit limit before confirmation.</p>

            <label class="flex items-start gap-3 text-sm text-brand-black mt-4">
              <input type="checkbox" id="b2b-review-consent" class="mt-1 h-4 w-4" />
              <span>I confirm the passenger names and itinerary are correct and that I am authorised to book on behalf of this agency.</span>
            </label>
            <p id="b2b-review-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
            <div class="flex flex-wrap gap-3 mt-4">
              <button type="button" id="b2b-credit-check" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Check credit</button>
              <button type="button" id="b2b-confirm-booking" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Confirm booking (preview)</button>
            </div>
            <div id="b2b-credit-result" class="hidden mt-4 rounded-xl border p-4 text-sm font-semibold" role="status"></div>
          </div>
        </div>

        <aside class="rounded-2xl border border-brand-border bg-brand-canvas p-5 h-fit" aria-labelledby="b2b-credit-heading">
          <h2 id="b2b-credit-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Agency credit</h2>
          <div class="space-y-1 text-sm text-brand-muted">
            <div class="flex justify-between"><span>Credit limit</span><strong class="text-brand-black tabular-nums" id="b2b-credit-limit">${money(AGENT_FIXTURE.creditLimit)}</strong></div>
            <div class="flex justify-between"><span>Used</span><strong class="text-brand-black tabular-nums" id="b2b-credit-used">${money(AGENT_FIXTURE.creditUsed)}</strong></div>
            <div class="flex justify-between"><span>Available</span><strong class="text-brand-primary tabular-nums" id="b2b-credit-available">${money(available)}</strong></div>
            <div class="flex justify-between border-t border-brand-border pt-2 mt-2"><span class="font-bold text-brand-black">This booking</span><strong class="text-brand-black tabular-nums" id="b2b-booking-total">${money(total)}</strong></div>
          </div>
          <p class="text-xs mt-3 ${overLimit ? 'text-red-700 font-semibold' : 'text-brand-muted'}" id="b2b-credit-verdict">
            ${overLimit
              ? `Exceeds available credit by ${money(shortfall)}. Reduce the markup, pay by card or request a credit extension.`
              : 'Within available agency credit (preview calculation).'}
          </p>
        </aside>
      </div>

      ${previewNote('Credit limits, authorisation and payment capture are simulated locally. A live system requires server-side credit control and a real payment provider.')}
    `;
  }

  /* --------------------------------------------------------- 56 ticket mgmt */

  private ticketContent(): string {
    const b = this.booking();
    if (!b) {
      return this.emptyBlock('No confirmed booking', 'Confirm a booking review before opening ticket management.');
    }
    const ticketed = b.status === 'ticketed_preview';
    const voided = b.status === 'voided';

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="b2b-ticket-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 id="b2b-ticket-heading" class="font-heading text-lg font-semibold text-brand-black">Booking ${escapeHtml(b.reference)}</h2>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(b.offer.flight)} · ${escapeHtml(b.offer.route)} · Dep ${escapeHtml(b.offer.depart)}</p>
          </div>
          <span id="b2b-booking-status" data-booking-status="${escapeHtml(b.status)}" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${ticketed ? 'bg-green-50 text-green-800 border-green-200' : voided ? 'bg-red-50 text-red-800 border-red-200' : 'bg-brand-subtle text-brand-primary border-brand-border'}">${escapeHtml(STATUS_LABELS[b.status])}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span class="text-brand-muted text-xs block">PNR</span><strong class="text-brand-black">Not issued (preview)</strong></div>
          <div><span class="text-brand-muted text-xs block">Total</span><strong class="text-brand-black tabular-nums">${money(b.total)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Settlement</span><strong class="text-brand-black">${escapeHtml(PAYMENT_LABELS[b.paymentMethod])}</strong></div>
        </div>
        ${voided ? `<p class="text-xs text-red-800 mt-3">Voided — ${escapeHtml(b.voidReason || 'no reason recorded')}. No refund has been processed in this preview.</p>` : ''}
      </div>

      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="b2b-tickets-heading">
        <h2 id="b2b-tickets-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Passenger tickets</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <caption class="sr-only">Passengers and ticket numbers for this booking</caption>
            <thead>
              <tr class="text-left text-xs uppercase text-brand-muted border-b border-brand-border">
                <th scope="col" class="py-2 pr-3">Passenger</th>
                <th scope="col" class="py-2 pr-3">Document</th>
                <th scope="col" class="py-2">Ticket number</th>
              </tr>
            </thead>
            <tbody>
              ${b.travellers.map((t, i) => `
                <tr class="border-b border-brand-border last:border-0" data-ticket-row="${i}">
                  <td class="py-3 pr-3 font-semibold text-brand-black">${escapeHtml(t.title)} ${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</td>
                  <td class="py-3 pr-3 text-xs text-brand-muted">Passport ${escapeHtml(t.passportNumber.slice(0, 2))}••••${escapeHtml(t.passportNumber.slice(-2))} · ${escapeHtml(t.nationality)}</td>
                  <td class="py-3 text-xs tabular-nums ${ticketed ? 'text-brand-black font-semibold' : 'text-brand-muted'}">${ticketed ? escapeHtml(b.ticketNumbers[i] || '—') : 'Not issued'}</td>
                </tr>
              `).join('') || '<tr><td colspan="3" class="py-4 text-sm text-brand-muted">No passengers on this booking.</td></tr>'}
            </tbody>
          </table>
        </div>

        ${!ticketed && !voided ? `
          <label class="flex items-start gap-3 text-sm text-brand-black mt-4">
            <input type="checkbox" id="b2b-issue-consent" class="mt-1 h-4 w-4" />
            <span>I have verified every passenger name against their travel document and understand ticketing is irreversible in a live system.</span>
          </label>
          <p id="b2b-ticket-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="button" id="b2b-issue-tickets" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Issue tickets (preview)</button>
          </div>
          <div id="b2b-ticket-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        ` : ''}

        ${ticketed ? `
          <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p class="text-sm text-amber-800 font-semibold">Tickets issued in preview only</p>
            <p class="text-xs text-amber-800 mt-1">These numbers are deterministic demo values. No airline ticket or PNR exists.</p>
            <label for="b2b-void-reason" class="block text-xs font-bold text-brand-muted uppercase mt-3 mb-1">Void reason</label>
            <div class="flex flex-col sm:flex-row gap-3">
              <select id="b2b-void-reason" class="flex-1 min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="">Select a reason…</option>
                <option value="duplicate">Duplicate booking</option>
                <option value="name_error">Passenger name error</option>
                <option value="client_cancelled">Client cancelled</option>
              </select>
              <button type="button" id="b2b-void-ticket" class="min-h-[44px] px-5 rounded-xl border border-red-300 text-red-700 font-semibold text-sm hover:bg-red-50 transition-colors">Void tickets</button>
            </div>
            <p id="b2b-void-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-2"></p>
          </div>
        ` : ''}
      </div>

      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="b2b-audit-heading">
        <h2 id="b2b-audit-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Audit trail</h2>
        <ol class="space-y-2 text-sm text-brand-muted" id="b2b-audit-list">
          ${b.audit.map(a => `<li class="flex gap-3"><span class="text-xs text-brand-muted whitespace-nowrap">${escapeHtml(a.at)}</span><span class="text-brand-black">${escapeHtml(a.action)}</span></li>`).join('')}
        </ol>
      </div>

      ${previewNote('Ticket numbers, PNRs and voids are deterministic demo values. Nothing is transmitted to a GDS, airline or payment provider.')}
    `;
  }

  /* ----------------------------------------------------------------- events */

  private wire(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;

    if (this.stage === 'review') {
      const startNew = $<HTMLButtonElement>('#b2b-start-new');
      startNew?.addEventListener('click', () => {
        clearStore('booking');
        clearStore('selection');
        clearStore('quotation');
        navigate('/b2b/flights');
      });

      const q = this.quotation();
      if (!q) return;

      const method = $<HTMLSelectElement>('#b2b-payment-method');
      const consent = $<HTMLInputElement>('#b2b-review-consent');
      const error = $('#b2b-review-error');
      const creditResult = $('#b2b-credit-result');
      const paymentNote = $('#b2b-payment-note');
      const available = Math.max(0, AGENT_FIXTURE.creditLimit - AGENT_FIXTURE.creditUsed);
      const total = quotationTotals(q);

      method?.addEventListener('change', () => {
        if (paymentNote) {
          paymentNote.textContent = method.value === 'agency_credit'
            ? 'Credit bookings are checked against the agency credit limit before confirmation.'
            : 'A payment request would be issued to the agency in a live system. Nothing is charged in this preview.';
        }
        hideError(error);
      });

      $<HTMLButtonElement>('#b2b-credit-check')?.addEventListener('click', () => {
        if (!creditResult) return;
        if (method?.value !== 'agency_credit') {
          creditResult.className = 'mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold';
          creditResult.textContent = `${PAYMENT_LABELS[method?.value as PaymentMethod] || 'Selected method'} does not consume agency credit. A payment request would be raised (preview).`;
          creditResult.classList.remove('hidden');
          return;
        }
        if (total > available) {
          creditResult.className = 'mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-semibold';
          creditResult.textContent = `Credit check failed (preview): booking ${money(total)} exceeds available credit ${money(available)} by ${money(total - available)}.`;
        } else {
          creditResult.className = 'mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold';
          creditResult.textContent = `Credit check passed (preview): ${money(total)} within ${money(available)} available. Remaining after booking ${money(available - total)}.`;
        }
        creditResult.classList.remove('hidden');
      });

      $<HTMLButtonElement>('#b2b-confirm-booking')?.addEventListener('click', () => {
        hideError(error);
        const travellers = this.travellers();
        if (!travellers.length) {
          showError(error, 'Add at least one traveller before confirming the booking.');
          return;
        }
        if (travellers.length !== q.passengers) {
          showError(error, `Quotation covers ${q.passengers} passenger(s) but ${travellers.length} traveller record(s) exist. Align the passenger count before confirming.`);
          return;
        }
        if (!consent?.checked) {
          showError(error, 'Confirm that passenger names and the itinerary are correct before booking.');
          return;
        }
        const chosen = (method?.value || 'agency_credit') as PaymentMethod;
        if (chosen === 'agency_credit' && total > available) {
          showError(error, `Agency credit is insufficient: ${money(total)} exceeds ${money(available)} available. Choose card or bank transfer, or reduce the markup.`);
          return;
        }

        const booking: B2BBooking = {
          reference: 'VCT-B2B-0001',
          quotationReference: q.reference,
          offer: q.offer,
          passengers: q.passengers,
          clientName: q.clientName,
          clientEmail: q.clientEmail,
          total,
          paymentMethod: chosen,
          status: 'confirmed_pending_ticket',
          travellers,
          ticketNumbers: [],
          audit: [
            { at: 'Preview timeline', action: `Quotation ${q.reference} reviewed and accepted by ${AGENT_FIXTURE.agentId}` },
            { at: 'Preview timeline', action: `Booking VCT-B2B-0001 confirmed with ${PAYMENT_LABELS[chosen]} — no payment captured` },
          ],
          voidReason: '',
        };
        writeStore('booking', booking);
        navigate('/b2b/flights/review/ticket');
      });
      return;
    }

    /* stage: ticket */
    const b = this.booking();
    if (!b) return;
    const error = $('#b2b-ticket-error');
    const result = $('#b2b-ticket-result');

    $<HTMLButtonElement>('#b2b-issue-tickets')?.addEventListener('click', () => {
      const consent = $<HTMLInputElement>('#b2b-issue-consent');
      hideError(error);
      if (!b.travellers.length) {
        showError(error, 'This booking has no passengers to ticket.');
        return;
      }
      const incomplete = b.travellers.find(t => !/^[A-Z0-9]{6,12}$/.test(t.passportNumber) || !t.passportExpiry);
      if (incomplete) {
        showError(error, `Passenger ${incomplete.firstName} ${incomplete.lastName} has incomplete document details. Update travellers before ticketing.`);
        return;
      }
      if (!consent?.checked) {
        showError(error, 'Confirm that you have verified every passenger name against their travel document.');
        return;
      }
      const ticketNumbers = b.travellers.map((_, i) => `VCT-TKT-0001-${String(i + 1).padStart(2, '0')}`);
      const updated: B2BBooking = {
        ...b,
        status: 'ticketed_preview',
        ticketNumbers,
        audit: [...b.audit, { at: 'Preview timeline', action: `Tickets issued in preview for ${ticketNumbers.length} passenger(s)` }],
      };
      writeStore('booking', updated);
      if (result) {
        result.textContent = `Tickets issued in preview for ${ticketNumbers.length} passenger(s). No airline ticket, PNR or invoice exists.`;
        result.classList.remove('hidden');
      }
      this.render(this.mount!, 'ticket');
    });

    $<HTMLButtonElement>('#b2b-void-ticket')?.addEventListener('click', () => {
      const reason = $<HTMLSelectElement>('#b2b-void-reason');
      const voidError = $('#b2b-void-error');
      if (!reason?.value) {
        showError(voidError, 'Select a reason before voiding the tickets.');
        markInvalid(reason, true);
        return;
      }
      markInvalid(reason, false);
      hideError(voidError);
      const label = reason.options[reason.selectedIndex]?.text || 'Voided';
      const updated: B2BBooking = {
        ...b,
        status: 'voided',
        voidReason: label,
        audit: [...b.audit, { at: 'Preview timeline', action: `Tickets voided in preview — ${label}` }],
      };
      writeStore('booking', updated);
      this.render(this.mount!, 'ticket');
    });
  }
}
