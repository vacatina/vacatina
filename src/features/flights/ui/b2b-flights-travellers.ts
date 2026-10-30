/* ============================================================================
 * Vacatina B2B Flights — Client Passenger & Document Collection (54)
 * Route: /b2b/flights/travellers
 * Frontend-only. Passenger records are demo fixtures stored in sessionStorage.
 * Never place passport data in URLs, analytics or client-side logs.
 * ============================================================================ */

import {
  agentBanner, escapeHtml, hideError, markInvalid, navigate, previewNote, readStore,
  showError, writeStore, type B2BTraveller,
} from './b2b-shared.ts';

const KEY = 'travellers';

export class B2BFlightsTravellersView {
  private mount: HTMLElement | null = null;
  private travellers: B2BTraveller[] = [];

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.travellers = readStore<B2BTraveller[]>(KEY) || [];
    mount.innerHTML = this.shell();
    this.wire();
    this.paint();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private shell(): string {
    return `
      <section class="b2b-flights-travellers max-w-5xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="b2b-trav-heading" data-b2b-stage="travellers">
        <header class="mb-6">
          <h1 id="b2b-trav-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Traveller Management</h1>
          <p class="text-sm text-brand-muted mt-2">Collect client passenger and document details for the quotation.</p>
        </header>
        ${agentBanner()}

        <form id="b2b-trav-form" class="rounded-2xl border border-brand-border bg-white p-5 mb-6" novalidate>
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Add traveller</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label for="trav-title" class="block text-xs font-bold text-brand-muted uppercase mb-1">Title</label>
              <select id="trav-title" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                <option value="Mr">Mr</option><option value="Ms">Ms</option><option value="Mrs">Mrs</option><option value="Dr">Dr</option>
              </select>
            </div>
            <div>
              <label for="trav-first" class="block text-xs font-bold text-brand-muted uppercase mb-1">First name</label>
              <input id="trav-first" type="text" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="trav-last" class="block text-xs font-bold text-brand-muted uppercase mb-1">Last name</label>
              <input id="trav-last" type="text" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="trav-dob" class="block text-xs font-bold text-brand-muted uppercase mb-1">Date of birth</label>
              <input id="trav-dob" type="date" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="trav-passport" class="block text-xs font-bold text-brand-muted uppercase mb-1">Passport number</label>
              <input id="trav-passport" type="text" autocomplete="off" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="trav-expiry" class="block text-xs font-bold text-brand-muted uppercase mb-1">Passport expiry</label>
              <input id="trav-expiry" type="date" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div>
              <label for="trav-nationality" class="block text-xs font-bold text-brand-muted uppercase mb-1">Nationality</label>
              <input id="trav-nationality" type="text" aria-describedby="trav-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </div>
          <p id="trav-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="submit" id="trav-add" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Add traveller</button>
            <button type="button" id="trav-clear" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Clear form</button>
          </div>
          <div id="trav-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        </form>

        <div class="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="trav-list-heading">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="trav-list-heading" class="font-heading text-lg font-semibold text-brand-black">Passengers on this quotation</h2>
            <span id="trav-count" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-brand-subtle text-brand-primary border border-brand-border">0 travellers</span>
          </div>
          <div id="trav-list" class="space-y-3"></div>
          <p id="trav-empty" class="text-sm text-brand-muted">No travellers added yet. Add at least one passenger before booking review.</p>
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="button" id="trav-save" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Save traveller list</button>
            <a href="/b2b/flights/review" id="trav-continue" class="inline-flex items-center min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Continue to booking review</a>
          </div>
          <div id="trav-save-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
        </div>

        ${previewNote('Passenger records are stored only in this browser session for UI acceptance. They are not transmitted, logged or persisted to a backend.')}
      </section>
    `;
  }

  private paint(): void {
    if (!this.mount) return;
    const list = this.mount.querySelector('#trav-list');
    const empty = this.mount.querySelector('#trav-empty');
    const count = this.mount.querySelector('#trav-count');
    if (count) count.textContent = `${this.travellers.length} traveller${this.travellers.length === 1 ? '' : 's'}`;
    if (empty) empty.classList.toggle('hidden', this.travellers.length > 0);
    if (!list) return;
    list.innerHTML = this.travellers.map((t, index) => `
      <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-brand-border bg-brand-canvas" data-traveller-row="${escapeHtml(t.id)}">
        <div>
          <p class="font-semibold text-brand-black text-sm">${escapeHtml(t.title)} ${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}</p>
          <p class="text-xs text-brand-muted">DOB ${escapeHtml(t.dateOfBirth)} · Passport ${escapeHtml(maskPassport(t.passportNumber))} · Expires ${escapeHtml(t.passportExpiry)} · ${escapeHtml(t.nationality)}</p>
        </div>
        <button type="button" data-remove="${escapeHtml(t.id)}" aria-label="Remove traveller ${escapeHtml(t.firstName)} ${escapeHtml(t.lastName)}" class="min-h-[44px] px-4 rounded-xl border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors">Remove</button>
      </div>
      ${index === -1 ? '' : ''}
    `).join('');

    list.querySelectorAll<HTMLButtonElement>('button[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove');
        this.travellers = this.travellers.filter(t => t.id !== id);
        this.paint();
        const result = this.mount!.querySelector('#trav-result');
        if (result) {
          result.className = 'mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 font-semibold';
          result.textContent = 'Traveller removed from the quotation (preview). Save the list to persist.';
          result.classList.remove('hidden');
        }
      });
    });
  }

  private wire(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const form = $<HTMLFormElement>('#b2b-trav-form');
    const error = $('#trav-error');
    const result = $('#trav-result');
    const saveResult = $('#trav-save-result');

    const fields = {
      title: $<HTMLSelectElement>('#trav-title'),
      first: $<HTMLInputElement>('#trav-first'),
      last: $<HTMLInputElement>('#trav-last'),
      dob: $<HTMLInputElement>('#trav-dob'),
      passport: $<HTMLInputElement>('#trav-passport'),
      expiry: $<HTMLInputElement>('#trav-expiry'),
      nationality: $<HTMLInputElement>('#trav-nationality'),
    };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      Object.values(fields).forEach(el => markInvalid(el, false));
      const first = (fields.first?.value || '').trim();
      const last = (fields.last?.value || '').trim();
      const dob = fields.dob?.value || '';
      const passport = (fields.passport?.value || '').trim().toUpperCase();
      const expiry = fields.expiry?.value || '';
      const nationality = (fields.nationality?.value || '').trim();

      if (first.length < 2 || last.length < 2) {
        markInvalid(fields.first, first.length < 2);
        markInvalid(fields.last, last.length < 2);
        showError(error, 'Enter the traveller’s first and last name (at least 2 characters each).');
        return;
      }
      const dobMs = dob ? new Date(dob + 'T00:00:00').getTime() : NaN;
      if (!dob || Number.isNaN(dobMs) || dobMs >= Date.now()) {
        markInvalid(fields.dob, true);
        showError(error, 'Enter a valid date of birth in the past.');
        return;
      }
      if (!/^[A-Z0-9]{6,12}$/.test(passport)) {
        markInvalid(fields.passport, true);
        showError(error, 'Passport number must be 6–12 letters or digits.');
        return;
      }
      const expiryMs = expiry ? new Date(expiry + 'T00:00:00').getTime() : NaN;
      if (!expiry || Number.isNaN(expiryMs) || expiryMs <= Date.now()) {
        markInvalid(fields.expiry, true);
        showError(error, 'Passport expiry must be a valid future date.');
        return;
      }
      if (nationality.length < 2) {
        markInvalid(fields.nationality, true);
        showError(error, 'Enter the traveller’s nationality.');
        return;
      }

      hideError(error);
      const traveller: B2BTraveller = {
        id: `TRV-${String(this.travellers.length + 1).padStart(2, '0')}-${Date.now().toString(36).slice(-4)}`,
        title: fields.title?.value || 'Mr',
        firstName: first,
        lastName: last,
        dateOfBirth: dob,
        passportNumber: passport,
        passportExpiry: expiry,
        nationality,
      };
      this.travellers = [...this.travellers, traveller];
      this.paint();
      form.reset();
      fields.title!.value = 'Mr';
      if (result) {
        result.className = 'mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold';
        result.textContent = `${traveller.firstName} ${traveller.lastName} added to the quotation (preview). Save the list to persist it.`;
        result.classList.remove('hidden');
      }
    });

    $('#trav-clear')?.addEventListener('click', () => {
      form?.reset();
      if (fields.title) fields.title.value = 'Mr';
      hideError(error);
      Object.values(fields).forEach(el => markInvalid(el, false));
    });

    $('#trav-save')?.addEventListener('click', () => {
      if (!this.travellers.length) {
        showError(error, 'Add at least one traveller before saving.');
        return;
      }
      writeStore(KEY, this.travellers);
      if (saveResult) {
        saveResult.textContent = `${this.travellers.length} traveller(s) saved for this session (preview). No passenger record was transmitted.`;
        saveResult.classList.remove('hidden');
      }
    });

    $('#trav-continue')?.addEventListener('click', event => {
      if (!this.travellers.length) {
        event.preventDefault();
        showError(error, 'Add at least one traveller before continuing to booking review.');
        return;
      }
      writeStore(KEY, this.travellers);
      event.preventDefault();
      navigate('/b2b/flights/review');
    });
  }
}

function maskPassport(value: string): string {
  const v = String(value || '');
  if (v.length <= 3) return v;
  return v.slice(0, 2) + '•'.repeat(Math.max(0, v.length - 4)) + v.slice(-2);
}
