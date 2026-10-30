/* ============================================================================
 * Vacatina B2B Flights — Agent Search + Wholesale Fare Comparison (51–52)
 * Route: /b2b/flights
 * Frontend-only demo fixture. Net rates, markups and commission are illustrative.
 * ============================================================================ */

import {
  B2B_OFFERS, agentBanner, escapeHtml, hideError, markInvalid, money, navigate,
  previewNote, showError, writeStore, type B2BOffer,
} from './b2b-shared.ts';

const DEFAULT_MARKUP = 12;

export class B2BFlightsSearchView {
  private mount: HTMLElement | null = null;
  private searched = false;
  private offers: B2BOffer[] = B2B_OFFERS;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.searched = false;
    mount.innerHTML = this.shell();
    this.wire();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private shell(): string {
    return `
      <section class="b2b-flights-search max-w-7xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="b2b-search-heading" data-b2b-stage="search">
        <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="b2b-search-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">B2B Flight Search</h1>
            <p class="text-sm text-brand-muted mt-2">Wholesale fare comparison for travel agents and corporate bookers.</p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">B2B Portal</span>
        </header>
        ${agentBanner()}

        <form id="b2b-search-form" class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-sm mb-6" novalidate>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label for="b2b-origin" class="block text-xs font-semibold text-brand-muted">Origin (IATA)</label>
              <input id="b2b-origin" type="text" value="CMB" maxlength="3" aria-describedby="b2b-search-error" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="b2b-destination" class="block text-xs font-semibold text-brand-muted">Destination (IATA)</label>
              <input id="b2b-destination" type="text" value="DXB" maxlength="3" aria-describedby="b2b-search-error" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="b2b-date" class="block text-xs font-semibold text-brand-muted">Departure date</label>
              <input id="b2b-date" type="date" value="2026-11-18" aria-describedby="b2b-search-error" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="b2b-pax" class="block text-xs font-semibold text-brand-muted">Passengers</label>
              <input id="b2b-pax" type="number" min="1" max="9" value="2" aria-describedby="b2b-search-error" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
            <div class="flex flex-wrap gap-4">
              <label class="inline-flex items-center gap-2 text-xs text-brand-muted"><input type="checkbox" id="b2b-show-net" class="w-4 h-4 rounded" checked /> Show net rates</label>
              <label class="inline-flex items-center gap-2 text-xs text-brand-muted"><input type="checkbox" id="b2b-show-markup" class="w-4 h-4 rounded" checked /> Show markups</label>
            </div>
            <button type="submit" id="b2b-search" class="min-h-[44px] px-6 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Search wholesale fares</button>
          </div>
          <p id="b2b-search-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
        </form>

        <div id="b2b-results" class="rounded-2xl border border-brand-border bg-white p-5" aria-live="polite" aria-labelledby="b2b-results-heading">
          <h2 id="b2b-results-heading" class="font-heading text-lg font-semibold text-brand-black mb-1">Wholesale Fare Comparison</h2>
          <p id="b2b-results-caption" class="text-xs text-brand-muted mb-4">Run a search to compare net fares, your markup and the sell rate.</p>
          <div id="b2b-result-rows" class="space-y-3"></div>
          <p id="b2b-select-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div id="b2b-select-actions" class="hidden mt-4">
            <button type="button" id="b2b-build-quote" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Build quotation</button>
          </div>
        </div>

        ${previewNote('Net rates, seat counts, markups and commissions are deterministic demo values. No GDS or supplier availability is queried.')}

        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/b2b/flights/quotation" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Quotation Builder</a>
          <a href="/b2b/flights/travellers" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Traveller Management</a>
          <a href="/b2b/flights/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Review</a>
          <a href="/b2b/flights/manage" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">Booking Management</a>
        </div>
      </section>
    `;
  }

  private wire(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const form = $<HTMLFormElement>('#b2b-search-form');
    const origin = $<HTMLInputElement>('#b2b-origin');
    const destination = $<HTMLInputElement>('#b2b-destination');
    const date = $<HTMLInputElement>('#b2b-date');
    const pax = $<HTMLInputElement>('#b2b-pax');
    const showNet = $<HTMLInputElement>('#b2b-show-net');
    const showMarkup = $<HTMLInputElement>('#b2b-show-markup');
    const error = $('#b2b-search-error');
    const rows = $('#b2b-result-rows');
    const caption = $('#b2b-results-caption');
    const selectError = $('#b2b-select-error');
    const selectActions = $('#b2b-select-actions');

    const renderRows = () => {
      if (!rows) return;
      const markup = DEFAULT_MARKUP;
      const net = !!showNet?.checked;
      const showMark = !!showMarkup?.checked;
      rows.innerHTML = this.offers.map(offer => {
        const sell = Math.round(offer.netFare * (1 + markup / 100));
        const commission = Math.round(sell * 0.03);
        return `
          <label class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-brand-border bg-white hover:border-brand-primary transition-colors cursor-pointer" data-offer-row="${escapeHtml(offer.id)}">
            <input type="radio" name="b2b-offer" value="${escapeHtml(offer.id)}" aria-label="${escapeHtml(offer.flight)} ${escapeHtml(offer.route)} departing ${escapeHtml(offer.depart)}" class="h-4 w-4" />
            <span class="flex-1">
              <span class="block font-semibold text-brand-black text-sm">${escapeHtml(offer.flight)} · ${escapeHtml(offer.airline)}</span>
              <span class="block text-xs text-brand-muted">${escapeHtml(offer.route)} · Dep ${escapeHtml(offer.depart)} · Arr ${escapeHtml(offer.arrive)} · ${escapeHtml(offer.fareBasis)} · ${offer.seats} seats</span>
            </span>
            <span class="text-right">
              ${net ? `<span class="block text-xs text-brand-muted" data-net-rate="${escapeHtml(offer.id)}">Net ${money(offer.netFare)}</span>` : ''}
              ${showMark ? `<span class="block text-xs text-brand-muted" data-markup="${escapeHtml(offer.id)}">Markup ${markup}%</span>` : ''}
              <span class="block text-sm font-bold text-brand-primary tabular-nums" data-sell-rate="${escapeHtml(offer.id)}">${money(sell)} / pax</span>
              <span class="block text-[11px] text-brand-muted tabular-nums">Commission ${money(commission)}</span>
            </span>
          </label>
        `;
      }).join('');

      rows.querySelectorAll<HTMLInputElement>('input[name="b2b-offer"]').forEach(radio => {
        radio.addEventListener('change', () => {
          hideError(selectError);
          selectActions?.classList.remove('hidden');
        });
      });
      if (caption) {
        caption.textContent = `${this.offers.length} wholesale options · ${pax?.value || '1'} passenger(s) · fares per passenger, taxes included in net rate.`;
      }
    };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      const from = (origin?.value || '').trim().toUpperCase();
      const to = (destination?.value || '').trim().toUpperCase();
      const day = date?.value || '';
      const count = Number(pax?.value || 0);
      markInvalid(origin, false); markInvalid(destination, false); markInvalid(date, false); markInvalid(pax, false);

      if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
        markInvalid(origin, !/^[A-Z]{3}$/.test(from));
        markInvalid(destination, !/^[A-Z]{3}$/.test(to));
        showError(error, 'Enter valid 3-letter IATA airport codes for origin and destination.');
        return;
      }
      if (from === to) {
        markInvalid(destination, true);
        showError(error, 'Origin and destination cannot be the same airport.');
        return;
      }
      if (!day) {
        markInvalid(date, true);
        showError(error, 'Select a departure date.');
        return;
      }
      if (!Number.isInteger(count) || count < 1 || count > 9) {
        markInvalid(pax, true);
        showError(error, 'Passenger count must be a whole number between 1 and 9.');
        return;
      }

      hideError(error);
      this.searched = true;
      this.offers = B2B_OFFERS;
      selectActions?.classList.add('hidden');
      hideError(selectError);
      renderRows();
      const results = $('#b2b-results');
      results?.setAttribute('data-b2b-stage', 'results');
    });

    showNet?.addEventListener('change', () => { if (this.searched) renderRows(); });
    showMarkup?.addEventListener('change', () => { if (this.searched) renderRows(); });

    $('#b2b-build-quote')?.addEventListener('click', () => {
      const selected = this.mount!.querySelector<HTMLInputElement>('input[name="b2b-offer"]:checked');
      if (!selected) {
        showError(selectError, 'Select a wholesale fare to build a quotation.');
        return;
      }
      const offer = this.offers.find(o => o.id === selected.value);
      if (!offer) {
        showError(selectError, 'Selected fare is no longer available in this preview.');
        return;
      }
      writeStore('selection', {
        offer,
        passengers: Math.max(1, Number(pax?.value || 1)),
        markupPercent: DEFAULT_MARKUP,
      });
      navigate('/b2b/flights/quotation');
    });
  }
}
