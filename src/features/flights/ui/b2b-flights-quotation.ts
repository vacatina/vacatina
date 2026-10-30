/* ============================================================================
 * Vacatina B2B Flights — Quotation Builder (53)
 * Route: /b2b/flights/quotation
 * Frontend-only. Quotation totals are computed deterministically and clearly
 * labelled preview: nothing is issued to a supplier or client.
 * ============================================================================ */

import {
  AGENT_FIXTURE, agentBanner, escapeHtml, hideError, markInvalid, money, navigate,
  previewNote, readStore, showError, writeStore, type B2BSelection,
} from './b2b-shared.ts';

interface QuotationState extends B2BSelection {
  serviceFee: number;
  baggagePrice: number;
  baggageUnits: number;
  clientName: string;
  clientEmail: string;
  reference: string;
  status: 'draft' | 'sent';
}

const DEFAULT_SERVICE_FEE = 3500;
const BAGGAGE_UNIT = 4500;

function totals(q: QuotationState) {
  const net = q.offer.netFare * q.passengers;
  const markup = Math.round(net * (q.markupPercent / 100));
  const ancillary = q.baggageUnits * q.baggagePrice;
  const subtotal = net + markup + ancillary + q.serviceFee;
  return { net, markup, ancillary, subtotal, perPax: Math.round(subtotal / Math.max(1, q.passengers)) };
}

export class B2BFlightsQuotationView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    const state = this.load();
    mount.innerHTML = state ? this.shell(state) : this.emptyShell();
    this.wire(state);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private load(): QuotationState | null {
    const saved = readStore<QuotationState>('quotation');
    if (saved && saved.offer) return saved;
    const selection = readStore<B2BSelection>('selection');
    if (!selection || !selection.offer) return null;
    return {
      ...selection,
      serviceFee: DEFAULT_SERVICE_FEE,
      baggagePrice: BAGGAGE_UNIT,
      baggageUnits: 0,
      clientName: '',
      clientEmail: '',
      reference: 'VCT-QT-0001',
      status: 'draft',
    };
  }

  private persist(state: QuotationState): void {
    writeStore('quotation', state);
  }

  private emptyShell(): string {
    return `
      <section class="b2b-flights-quotation max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="b2b-quote-heading" data-b2b-stage="empty">
        <header class="mb-6">
          <h1 id="b2b-quote-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Quotation Builder</h1>
          <p class="text-sm text-brand-muted mt-2">Build a client quotation from a wholesale fare.</p>
        </header>
        ${agentBanner()}
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-6" role="status">
          <p class="text-sm text-amber-800 font-semibold">No wholesale fare selected.</p>
          <p class="text-xs text-amber-800 mt-1">Search wholesale fares and select an option before building a quotation.</p>
        </div>
        <a href="/b2b/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Search wholesale fares</a>
      </section>
    `;
  }

  private shell(state: QuotationState): string {
    const t = totals(state);
    return `
      <section class="b2b-flights-quotation max-w-5xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="b2b-quote-heading" data-b2b-stage="builder">
        <header class="mb-6">
          <h1 id="b2b-quote-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Quotation Builder</h1>
          <p class="text-sm text-brand-muted mt-2">Quotation ${escapeHtml(state.reference)} · ${escapeHtml(AGENT_FIXTURE.agency)}</p>
        </header>
        ${agentBanner()}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="rounded-2xl border border-brand-border bg-white p-5">
              <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Itinerary</h2>
              <div class="text-sm">
                <p class="font-semibold text-brand-black">${escapeHtml(state.offer.flight)} · ${escapeHtml(state.offer.airline)}</p>
                <p class="text-xs text-brand-muted mt-1">${escapeHtml(state.offer.route)} · Dep ${escapeHtml(state.offer.depart)} · Arr ${escapeHtml(state.offer.arrive)} · ${escapeHtml(state.offer.fareBasis)}</p>
                <p class="text-xs text-brand-muted mt-1">${state.passengers} passenger(s) · ${state.offer.seats} seats available in preview</p>
              </div>
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label for="b2b-markup" class="block text-xs font-bold text-brand-muted uppercase mb-1">Markup %</label>
                  <input id="b2b-markup" type="number" min="0" max="40" step="1" value="${state.markupPercent}" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <div>
                  <label for="b2b-fee" class="block text-xs font-bold text-brand-muted uppercase mb-1">Service fee (LKR)</label>
                  <input id="b2b-fee" type="number" min="0" step="100" value="${state.serviceFee}" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <div>
                  <label for="b2b-baggage" class="block text-xs font-bold text-brand-muted uppercase mb-1">Baggage units</label>
                  <input id="b2b-baggage" type="number" min="0" max="6" step="1" value="${state.baggageUnits}" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
              </div>
              <p id="b2b-quote-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
            </div>

            <div class="rounded-2xl border border-brand-border bg-white p-5">
              <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Client details</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="b2b-client-name" class="block text-xs font-bold text-brand-muted uppercase mb-1">Client name</label>
                  <input id="b2b-client-name" type="text" value="${escapeHtml(state.clientName)}" aria-describedby="b2b-send-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <div>
                  <label for="b2b-client-email" class="block text-xs font-bold text-brand-muted uppercase mb-1">Client email</label>
                  <input id="b2b-client-email" type="email" value="${escapeHtml(state.clientEmail)}" aria-describedby="b2b-send-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
              </div>
              <p id="b2b-send-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
              <div class="flex flex-wrap gap-3 mt-4">
                <button type="button" id="b2b-save-quote" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Save draft</button>
                <button type="button" id="b2b-send-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Send quotation</button>
              </div>
              <div id="b2b-quote-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
            </div>
          </div>

          <aside class="rounded-2xl border border-brand-border bg-brand-canvas p-5 h-fit" aria-labelledby="b2b-totals-heading">
            <h2 id="b2b-totals-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Totals</h2>
            <div class="space-y-1 text-sm text-brand-muted">
              <div class="flex justify-between"><span>Net fare × ${state.passengers}</span><strong class="text-brand-black tabular-nums" id="b2b-total-net">${money(t.net)}</strong></div>
              <div class="flex justify-between"><span>Markup (${state.markupPercent}%)</span><strong class="text-brand-black tabular-nums" id="b2b-total-markup">${money(t.markup)}</strong></div>
              <div class="flex justify-between"><span>Baggage (${state.baggageUnits} × ${money(state.baggagePrice)})</span><strong class="text-brand-black tabular-nums" id="b2b-total-baggage">${money(t.ancillary)}</strong></div>
              <div class="flex justify-between"><span>Service fee</span><strong class="text-brand-black tabular-nums" id="b2b-total-fee">${money(state.serviceFee)}</strong></div>
              <div class="flex justify-between border-t border-brand-border pt-2 mt-2"><span class="font-bold text-brand-black">Client total</span><strong class="text-brand-primary tabular-nums font-bold" id="b2b-total-client">${money(t.subtotal)}</strong></div>
              <div class="flex justify-between"><span>Per passenger</span><strong class="text-brand-black tabular-nums" id="b2b-total-perpax">${money(t.perPax)}</strong></div>
            </div>
            <p class="text-[11px] text-brand-muted mt-3">Quotation validity: 24 hours from send (preview). Fares are not held.</p>
          </aside>
        </div>

        ${previewNote('Quotation totals are computed locally from demo net fares. No fare is filed, held or ticketed.')}

        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/b2b/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Back to search</a>
          <a href="/b2b/flights/travellers" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Add travellers</a>
          <a href="/b2b/flights/review" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Booking review</a>
        </div>
      </section>
    `;
  }

  private wire(state: QuotationState | null): void {
    if (!this.mount || !state) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const markup = $<HTMLInputElement>('#b2b-markup');
    const fee = $<HTMLInputElement>('#b2b-fee');
    const baggage = $<HTMLInputElement>('#b2b-baggage');
    const name = $<HTMLInputElement>('#b2b-client-name');
    const email = $<HTMLInputElement>('#b2b-client-email');
    const quoteError = $('#b2b-quote-error');
    const sendError = $('#b2b-send-error');
    const result = $('#b2b-quote-result');

    let current: QuotationState = { ...state };

    const recollect = (): QuotationState => ({
      ...current,
      markupPercent: Number(markup?.value ?? current.markupPercent),
      serviceFee: Number(fee?.value ?? current.serviceFee),
      baggageUnits: Number(baggage?.value ?? current.baggageUnits),
      baggagePrice: BAGGAGE_UNIT,
      clientName: name?.value ?? current.clientName,
      clientEmail: email?.value ?? current.clientEmail,
    });

    const paint = (next: QuotationState) => {
      const t = totals(next);
      const set = (sel: string, text: string) => {
        const el = $(sel);
        if (el) el.textContent = text;
      };
      set('#b2b-total-net', money(t.net));
      set('#b2b-total-markup', money(t.markup));
      set('#b2b-total-baggage', money(t.ancillary));
      set('#b2b-total-fee', money(next.serviceFee));
      set('#b2b-total-client', money(t.subtotal));
      set('#b2b-total-perpax', money(t.perPax));
    };

    const validate = (next: QuotationState): string | null => {
      markInvalid(markup, false); markInvalid(fee, false); markInvalid(baggage, false);
      if (!Number.isFinite(next.markupPercent) || next.markupPercent < 0 || next.markupPercent > 40) {
        markInvalid(markup, true);
        return 'Markup must be between 0% and 40%.';
      }
      if (!Number.isFinite(next.serviceFee) || next.serviceFee < 0) {
        markInvalid(fee, true);
        return 'Service fee cannot be negative.';
      }
      if (!Number.isInteger(next.baggageUnits) || next.baggageUnits < 0 || next.baggageUnits > 6) {
        markInvalid(baggage, true);
        return 'Baggage units must be a whole number between 0 and 6.';
      }
      return null;
    };

    const onChange = () => {
      const next = recollect();
      const invalid = validate(next);
      if (invalid) {
        showError(quoteError, invalid);
      } else {
        hideError(quoteError);
        current = next;
        paint(current);
      }
    };
    [markup, fee, baggage].forEach(el => {
      el?.addEventListener('input', onChange);
      el?.addEventListener('change', onChange);
    });

    $('#b2b-save-quote')?.addEventListener('click', () => {
      const next = recollect();
      const invalid = validate(next);
      if (invalid) { showError(quoteError, invalid); return; }
      hideError(quoteError);
      current = { ...next, status: 'draft' };
      this.persist(current);
      if (result) {
        result.textContent = `Draft saved locally (preview). Quotation ${current.reference}.`;
        result.classList.remove('hidden');
        result.className = 'mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold';
      }
    });

    $('#b2b-send-quote')?.addEventListener('click', () => {
      const next = recollect();
      const invalid = validate(next);
      if (invalid) { showError(quoteError, invalid); return; }
      markInvalid(name, false); markInvalid(email, false);
      if ((next.clientName || '').trim().length < 2) {
        markInvalid(name, true);
        showError(sendError, 'Enter the client name before sending the quotation.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((next.clientEmail || '').trim())) {
        markInvalid(email, true);
        showError(sendError, 'Enter a valid client email address before sending the quotation.');
        return;
      }
      hideError(sendError);
      current = { ...next, status: 'sent' };
      this.persist(current);
      if (result) {
        result.className = 'mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold';
        result.textContent = `Quotation ${current.reference} prepared for ${current.clientName} (preview). No email was actually sent and no fare is held.`;
        result.classList.remove('hidden');
      }
    });
  }
}
