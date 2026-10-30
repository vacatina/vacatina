/* ============================================================================
 * Vacatina B2B Flights — Agent Booking Management & After-Sales (57)
 * Route: /b2b/flights/manage
 *
 * Frontend-only demo fixture. Servicing requests, exchanges, cancellations and
 * refunds are recorded locally and labelled preview — nothing is transmitted to
 * an airline, GDS or payment provider.
 * ============================================================================ */

import {
  AGENT_FIXTURE, agentBanner, escapeHtml, hideError, markInvalid, money, previewNote,
  readStore, showError, writeStore, type B2BTraveller,
} from './b2b-shared.ts';

type ServicingType = 'exchange' | 'cancel' | 'refund' | 'name_correction';

interface StoredBooking {
  reference: string;
  offer: { flight: string; airline: string; route: string; depart: string; arrive: string; netFare: number; seats: number; fareBasis: string };
  passengers: number;
  clientName: string;
  clientEmail: string;
  total: number;
  paymentMethod: 'agency_credit' | 'card' | 'bank_transfer';
  status: 'draft' | 'confirmed_pending_ticket' | 'ticketed_preview' | 'voided';
  travellers: B2BTraveller[];
  ticketNumbers: string[];
  audit: { at: string; action: string }[];
  voidReason: string;
}

interface ServicingRequest {
  reference: string;
  bookingReference: string;
  type: ServicingType;
  reason: string;
  newDate: string;
  estimatedValue: number;
  status: 'submitted_preview';
}

interface Ancillaries {
  bookingReference: string;
  baggageUnits: number;
  seatPreference: string;
  mealPreference: string;
  price: number;
}

const BAGGAGE_UNIT = 4500;
const SEAT_PRICES: Record<string, number> = { none: 0, aisle: 1200, window: 1500, extra_legroom: 3500 };
const MEAL_PRICES: Record<string, number> = { none: 0, standard: 0, vegetarian: 900, child: 700 };
const REFUND_PENALTY_PERCENT = 15;

const TYPE_LABELS: Record<ServicingType, string> = {
  exchange: 'Date change / exchange',
  cancel: 'Cancellation',
  refund: 'Refund request',
  name_correction: 'Passenger name correction',
};

const STATUS_LABELS: Record<StoredBooking['status'], string> = {
  draft: 'Draft — not confirmed',
  confirmed_pending_ticket: 'Confirmed — awaiting ticket issuance',
  ticketed_preview: 'Ticketed (preview)',
  voided: 'Voided',
};

/** Demo fallback so the after-sales desk is testable without walking the whole funnel. */
function demoBooking(): StoredBooking {
  return {
    reference: 'VCT-B2B-0001',
    offer: { flight: 'UL 505', airline: 'SriLankan Airlines', route: 'CMB → DXB', depart: '18 Nov 2026, 08:20', arrive: '18 Nov 2026, 11:35', netFare: 96500, seats: 9, fareBasis: 'YNET' },
    passengers: 2,
    clientName: 'Ceylon Corporate Travel',
    clientEmail: 'ops@example.com',
    total: 219660,
    paymentMethod: 'agency_credit',
    status: 'ticketed_preview',
    travellers: [
      { id: 'TRV-01-DEMO', title: 'Mr', firstName: 'Nuwan', lastName: 'Perera', dateOfBirth: '1988-04-12', passportNumber: 'N1234567', passportExpiry: '2031-06-30', nationality: 'Sri Lankan' },
      { id: 'TRV-02-DEMO', title: 'Ms', firstName: 'Ayesha', lastName: 'Fernando', dateOfBirth: '1991-09-03', passportNumber: 'N7654321', passportExpiry: '2030-02-14', nationality: 'Sri Lankan' },
    ],
    ticketNumbers: ['VCT-TKT-0001-01', 'VCT-TKT-0001-02'],
    audit: [
      { at: 'Preview timeline', action: 'Quotation VCT-QT-0001 reviewed and accepted' },
      { at: 'Preview timeline', action: 'Booking VCT-B2B-0001 confirmed — no payment captured' },
      { at: 'Preview timeline', action: 'Tickets issued in preview for 2 passenger(s)' },
    ],
    voidReason: '',
  };
}

export class B2BFlightsManageView {
  private mount: HTMLElement | null = null;
  private booking: StoredBooking | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.booking = null;
    mount.innerHTML = this.shell();
    this.wireSearch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ store */

  private storedBooking(): StoredBooking | null {
    const b = readStore<StoredBooking>('booking');
    return b && b.reference ? b : null;
  }

  private ancillaries(ref: string): Ancillaries {
    const saved = readStore<Ancillaries>(`ancillaries:${ref}`);
    return saved || { bookingReference: ref, baggageUnits: 0, seatPreference: 'none', mealPreference: 'none', price: 0 };
  }

  private requests(ref: string): ServicingRequest[] {
    return readStore<ServicingRequest[]>(`servicing:${ref}`) || [];
  }

  /* ------------------------------------------------------------------- view */

  private shell(): string {
    return `
      <section class="b2b-flights-manage max-w-6xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="manage-heading" data-b2b-stage="manage">
        <header class="mb-6">
          <h1 id="manage-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Agent Flight Booking Management</h1>
          <p class="text-sm text-brand-muted mt-2">Retrieve a booking to service ancillaries, exchanges, cancellations and refunds.</p>
        </header>
        ${agentBanner()}

        <form id="manage-lookup-form" class="rounded-2xl border border-brand-border bg-white p-5 mb-6" novalidate>
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Find booking</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
              <label for="manage-ref" class="block text-xs font-bold text-brand-muted uppercase mb-1">Booking reference</label>
              <input id="manage-ref" type="text" value="VCT-B2B-0001" aria-describedby="manage-lookup-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="manage-lastname" class="block text-xs font-bold text-brand-muted uppercase mb-1">Lead passenger surname</label>
              <input id="manage-lastname" type="text" value="Perera" aria-describedby="manage-lookup-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <p id="manage-lookup-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="submit" id="manage-lookup" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Retrieve booking</button>
            <button type="button" id="manage-use-demo" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Load demo booking</button>
          </div>
        </form>

        <div id="manage-workspace" aria-live="polite"></div>

        ${previewNote('Servicing actions, exchange quotes and refund estimates are deterministic demo values. No airline, GDS or payment system is contacted.')}

        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/b2b/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Back to search</a>
          <a href="/b2b/flights/review" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Booking review</a>
        </div>
      </section>
    `;
  }

  private wireSearch(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const form = $<HTMLFormElement>('#manage-lookup-form');
    const refInput = $<HTMLInputElement>('#manage-ref');
    const nameInput = $<HTMLInputElement>('#manage-lastname');
    const error = $('#manage-lookup-error');
    const workspace = $('#manage-workspace');

    const lookup = (ref: string, surname: string): boolean => {
      markInvalid(refInput, false); markInvalid(nameInput, false);
      const normalised = ref.trim().toUpperCase();
      if (!/^VCT-B2B-\d{4}$/.test(normalised)) {
        markInvalid(refInput, true);
        showError(error, 'Enter a booking reference in the format VCT-B2B-0000.');
        return false;
      }
      if (surname.trim().length < 2) {
        markInvalid(nameInput, true);
        showError(error, 'Enter the lead passenger surname to verify the booking.');
        return false;
      }
      const stored = this.storedBooking();
      const candidate = stored && stored.reference.toUpperCase() === normalised ? stored : null;
      const booking = candidate || (normalised === 'VCT-B2B-0001' ? demoBooking() : null);
      if (!booking) {
        showError(error, `No booking ${normalised} was found in this preview workspace. Try the demo booking VCT-B2B-0001.`);
        return false;
      }
      const lead = booking.travellers[0];
      if (lead && lead.lastName.toLowerCase() !== surname.trim().toLowerCase()) {
        markInvalid(nameInput, true);
        showError(error, 'Surname does not match the lead passenger on this booking.');
        return false;
      }
      hideError(error);
      this.booking = booking;
      if (workspace) {
        workspace.innerHTML = this.workspaceContent(booking);
        this.wireWorkspace(booking);
      }
      return true;
    };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      lookup(refInput?.value || '', nameInput?.value || '');
    });

    $<HTMLButtonElement>('#manage-use-demo')?.addEventListener('click', () => {
      if (refInput) refInput.value = 'VCT-B2B-0001';
      if (nameInput) nameInput.value = 'Perera';
      lookup('VCT-B2B-0001', 'Perera');
    });
  }

  /* -------------------------------------------------------------- workspace */

  private workspaceContent(b: StoredBooking): string {
    const anc = this.ancillaries(b.reference);
    const reqs = this.requests(b.reference);
    const refundEstimate = Math.round(b.total * (1 - REFUND_PENALTY_PERCENT / 100));

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="manage-booking-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 id="manage-booking-heading" class="font-heading text-lg font-semibold text-brand-black">Booking ${escapeHtml(b.reference)}</h2>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(b.offer.flight)} · ${escapeHtml(b.offer.airline)} · ${escapeHtml(b.offer.route)} · Dep ${escapeHtml(b.offer.depart)}</p>
          </div>
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-subtle text-brand-primary border border-brand-border">${escapeHtml(STATUS_LABELS[b.status])}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span class="text-brand-muted text-xs block">Passengers</span><strong class="text-brand-black">${b.travellers.length}</strong></div>
          <div><span class="text-brand-muted text-xs block">Booking total</span><strong class="text-brand-black tabular-nums">${money(b.total)}</strong></div>
          <div><span class="text-brand-muted text-xs block">Tickets</span><strong class="text-brand-black">${b.ticketNumbers.length ? `${b.ticketNumbers.length} issued (preview)` : 'Not issued'}</strong></div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="manage-ancillary-heading">
          <h2 id="manage-ancillary-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Ancillaries</h2>
          <div class="space-y-3">
            <div>
              <label for="manage-baggage" class="block text-xs font-bold text-brand-muted uppercase mb-1">Extra baggage units (${money(BAGGAGE_UNIT)} each)</label>
              <input id="manage-baggage" type="number" min="0" max="6" step="1" value="${anc.baggageUnits}" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="manage-seat" class="block text-xs font-bold text-brand-muted uppercase mb-1">Seat preference</label>
              <select id="manage-seat" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="none" ${anc.seatPreference === 'none' ? 'selected' : ''}>No preference</option>
                <option value="aisle" ${anc.seatPreference === 'aisle' ? 'selected' : ''}>Aisle (${money(SEAT_PRICES.aisle)})</option>
                <option value="window" ${anc.seatPreference === 'window' ? 'selected' : ''}>Window (${money(SEAT_PRICES.window)})</option>
                <option value="extra_legroom" ${anc.seatPreference === 'extra_legroom' ? 'selected' : ''}>Extra legroom (${money(SEAT_PRICES.extra_legroom)})</option>
              </select>
            </div>
            <div>
              <label for="manage-meal" class="block text-xs font-bold text-brand-muted uppercase mb-1">Meal preference</label>
              <select id="manage-meal" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="none" ${anc.mealPreference === 'none' ? 'selected' : ''}>No meal</option>
                <option value="standard" ${anc.mealPreference === 'standard' ? 'selected' : ''}>Standard</option>
                <option value="vegetarian" ${anc.mealPreference === 'vegetarian' ? 'selected' : ''}>Vegetarian (${money(MEAL_PRICES.vegetarian)})</option>
                <option value="child" ${anc.mealPreference === 'child' ? 'selected' : ''}>Child (${money(MEAL_PRICES.child)})</option>
              </select>
            </div>
          </div>
          <p id="manage-ancillary-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div class="flex flex-wrap items-center gap-3 mt-4">
            <button type="button" id="manage-save-ancillary" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Save ancillaries (preview)</button>
            <span class="text-sm text-brand-muted">Added value <strong class="text-brand-black tabular-nums" id="manage-ancillary-total">${money(anc.price)}</strong></span>
          </div>
          <div id="manage-ancillary-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="manage-servicing-heading">
          <h2 id="manage-servicing-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">After-sales request</h2>
          <div class="space-y-3">
            <div>
              <label for="manage-type" class="block text-xs font-bold text-brand-muted uppercase mb-1">Request type</label>
              <select id="manage-type" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="">Select a request…</option>
                <option value="exchange">${escapeHtml(TYPE_LABELS.exchange)}</option>
                <option value="cancel">${escapeHtml(TYPE_LABELS.cancel)}</option>
                <option value="refund">${escapeHtml(TYPE_LABELS.refund)}</option>
                <option value="name_correction">${escapeHtml(TYPE_LABELS.name_correction)}</option>
              </select>
            </div>
            <div id="manage-exchange-date-wrap" class="hidden">
              <label for="manage-new-date" class="block text-xs font-bold text-brand-muted uppercase mb-1">New travel date</label>
              <input id="manage-new-date" type="date" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="manage-reason" class="block text-xs font-bold text-brand-muted uppercase mb-1">Reason</label>
              <textarea id="manage-reason" rows="3" class="w-full px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary"></textarea>
            </div>
          </div>
          <p id="manage-servicing-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div id="manage-estimate" class="hidden mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 font-semibold" role="status"></div>
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="button" id="manage-estimate-btn" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Estimate (preview)</button>
            <button type="button" id="manage-submit-request" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Submit request (preview)</button>
          </div>
          <div id="manage-servicing-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
          <p class="text-[11px] text-brand-muted mt-3">Refund estimate assumes a ${REFUND_PENALTY_PERCENT}% cancellation penalty on ${money(b.total)} → <strong class="text-brand-black" id="manage-refund-estimate">${money(refundEstimate)}</strong>. Final values are airline-controlled.</p>
        </div>
      </div>

      <div class="rounded-2xl border border-brand-border bg-white p-5 mt-6" aria-labelledby="manage-requests-heading">
        <h2 id="manage-requests-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Servicing requests</h2>
        <div id="manage-request-list">
          ${reqs.length ? `
            <ul class="space-y-2">
              ${reqs.map(r => `
                <li class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-brand-border bg-brand-canvas text-sm">
                  <span><strong class="text-brand-black">${escapeHtml(r.reference)}</strong> · ${escapeHtml(TYPE_LABELS[r.type])}</span>
                  <span class="text-xs text-brand-muted">${r.estimatedValue ? money(r.estimatedValue) + ' · ' : ''}submitted (preview)</span>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="text-sm text-brand-muted" id="manage-requests-empty">No after-sales requests recorded for this booking.</p>'}
        </div>
      </div>
    `;
  }

  private wireWorkspace(b: StoredBooking): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;

    /* ancillaries */
    const baggage = $<HTMLInputElement>('#manage-baggage');
    const seat = $<HTMLSelectElement>('#manage-seat');
    const meal = $<HTMLSelectElement>('#manage-meal');
    const ancError = $('#manage-ancillary-error');
    const ancTotal = $('#manage-ancillary-total');
    const ancResult = $('#manage-ancillary-result');

    const ancillaryPrice = () => {
      const units = Number(baggage?.value || 0);
      return (Number.isFinite(units) ? units : 0) * BAGGAGE_UNIT
        + (SEAT_PRICES[seat?.value || 'none'] || 0)
        + (MEAL_PRICES[meal?.value || 'none'] || 0);
    };

    const paintAncillary = () => {
      if (ancTotal) ancTotal.textContent = money(ancillaryPrice());
    };
    [baggage, seat, meal].forEach(el => {
      el?.addEventListener('input', paintAncillary);
      el?.addEventListener('change', paintAncillary);
    });

    $<HTMLButtonElement>('#manage-save-ancillary')?.addEventListener('click', () => {
      hideError(ancError);
      const units = Number(baggage?.value || 0);
      markInvalid(baggage, false);
      if (!Number.isInteger(units) || units < 0 || units > 6) {
        markInvalid(baggage, true);
        showError(ancError, 'Baggage units must be a whole number between 0 and 6.');
        return;
      }
      const record: Ancillaries = {
        bookingReference: b.reference,
        baggageUnits: units,
        seatPreference: seat?.value || 'none',
        mealPreference: meal?.value || 'none',
        price: ancillaryPrice(),
      };
      writeStore(`ancillaries:${b.reference}`, record);
      paintAncillary();
      if (ancResult) {
        ancResult.textContent = `Ancillaries saved for ${b.reference} (preview): ${units} baggage unit(s), seat ${record.seatPreference}, meal ${record.mealPreference}. Added ${money(record.price)} — nothing charged.`;
        ancResult.classList.remove('hidden');
      }
    });

    /* servicing */
    const type = $<HTMLSelectElement>('#manage-type');
    const dateWrap = $('#manage-exchange-date-wrap');
    const newDate = $<HTMLInputElement>('#manage-new-date');
    const reason = $<HTMLTextAreaElement>('#manage-reason');
    const svcError = $('#manage-servicing-error');
    const estimate = $('#manage-estimate');
    const svcResult = $('#manage-servicing-result');
    const refundEstimate = Math.round(b.total * (1 - REFUND_PENALTY_PERCENT / 100));

    const estimateFor = (kind: ServicingType, day: string): number => {
      if (kind === 'cancel') return refundEstimate;
      if (kind === 'refund') return refundEstimate;
      if (kind === 'name_correction') return 5500;
      // exchange: fare difference placeholder depends on date shift
      const base = new Date('2026-11-18T00:00:00').getTime();
      const target = day ? new Date(day + 'T00:00:00').getTime() : NaN;
      const days = Number.isNaN(target) ? 0 : Math.max(0, Math.round((target - base) / 86400000));
      return 8500 + Math.min(12000, days * 400);
    };

    type?.addEventListener('change', () => {
      const kind = type.value as ServicingType | '';
      dateWrap?.classList.toggle('hidden', kind !== 'exchange');
      hideError(svcError);
      estimate?.classList.add('hidden');
    });

    $<HTMLButtonElement>('#manage-estimate-btn')?.addEventListener('click', () => {
      hideError(svcError);
      const kind = type?.value as ServicingType | '';
      if (!kind) {
        showError(svcError, 'Select a request type before estimating.');
        markInvalid(type, true);
        return;
      }
      markInvalid(type, false);
      const value = estimateFor(kind, newDate?.value || '');
      if (estimate) {
        const label = kind === 'exchange' ? 'Fare difference + change fee' : kind === 'name_correction' ? 'Correction fee' : 'Estimated refund';
        estimate.textContent = `${label} (preview): ${money(value)}. ${kind === 'cancel' || kind === 'refund' ? 'Airline penalty assumptions apply.' : 'Nothing has been charged.'}`;
        estimate.classList.remove('hidden');
      }
    });

    $<HTMLButtonElement>('#manage-submit-request')?.addEventListener('click', () => {
      hideError(svcError);
      const kind = type?.value as ServicingType | '';
      markInvalid(type, false); markInvalid(reason, false); markInvalid(newDate, false);

      if (!kind) {
        markInvalid(type, true);
        showError(svcError, 'Select a request type before submitting.');
        return;
      }
      if (b.status === 'voided' && kind !== 'refund') {
        showError(svcError, 'This booking is voided. Only a refund request can be raised.');
        return;
      }
      if (kind === 'exchange') {
        const day = newDate?.value || '';
        if (!day) {
          markInvalid(newDate, true);
          showError(svcError, 'Select the new travel date for the exchange.');
          return;
        }
        if (day <= '2026-10-30') {
          markInvalid(newDate, true);
          showError(svcError, 'The new travel date must be in the future.');
          return;
        }
      }
      if ((reason?.value || '').trim().length < 8) {
        markInvalid(reason, true);
        showError(svcError, 'Describe the reason in at least 8 characters so the airline can assess the request.');
        return;
      }

      const existing = this.requests(b.reference);
      const request: ServicingRequest = {
        reference: `VCT-AS-${String(existing.length + 1).padStart(4, '0')}`,
        bookingReference: b.reference,
        type: kind,
        reason: (reason?.value || '').trim(),
        newDate: newDate?.value || '',
        estimatedValue: estimateFor(kind, newDate?.value || ''),
        status: 'submitted_preview',
      };
      writeStore(`servicing:${b.reference}`, [...existing, request]);

      if (svcResult) {
        svcResult.textContent = `Request ${request.reference} recorded (preview): ${TYPE_LABELS[kind]} for ${b.reference}. No airline action, refund or ticket change has occurred.`;
        svcResult.classList.remove('hidden');
      }

      const list = $('#manage-request-list');
      if (list) {
        list.innerHTML = `
          <ul class="space-y-2">
            ${[...existing, request].map(r => `
              <li class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-brand-border bg-brand-canvas text-sm">
                <span><strong class="text-brand-black">${escapeHtml(r.reference)}</strong> · ${escapeHtml(TYPE_LABELS[r.type])}</span>
                <span class="text-xs text-brand-muted">${r.estimatedValue ? money(r.estimatedValue) + ' · ' : ''}submitted (preview)</span>
              </li>
            `).join('')}
          </ul>
        `;
      }
      reason!.value = '';
      if (newDate) newDate.value = '';
      estimate?.classList.add('hidden');
    });
  }
}
