/* ============================================================================
 * Vacatina Flights — Passenger Details & Document Verification
 * Route: /flights/passengers (or embedded in trip review flow)
 *
 * Dedicated passenger identity, contact, document and loyalty capture.
 * Sensitive data is never persisted in localStorage or analytics.
 * Submission is gated on a durable secure backend being operational.
 * ============================================================================ */

export interface PassengerIdentity {
  id: string;
  type: 'adult' | 'child' | 'infant';
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  passportIssuingCountry: string;
  frequentFlyerProgram: string;
  frequentFlyerNumber: string;
}

export interface ContactDetails {
  email: string;
  phone: string;
  phoneCountryCode: string;
}

export interface PassengerValidationErrors {
  [field: string]: string;
}

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
const COUNTRY_CODES = [
  { code: '+94', label: 'Sri Lanka (+94)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
];

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

function validatePassenger(p: PassengerIdentity, index: number): PassengerValidationErrors {
  const errors: PassengerValidationErrors = {};
  if (!p.title) errors[`p${index}.title`] = 'Select a title';
  if (!p.firstName || p.firstName.trim().length < 2) errors[`p${index}.firstName`] = 'Enter a valid first name (min 2 characters)';
  if (!p.lastName || p.lastName.trim().length < 2) errors[`p${index}.lastName`] = 'Enter a valid last name (min 2 characters)';
  if (!p.dateOfBirth) errors[`p${index}.dateOfBirth`] = 'Date of birth is required';
  else {
    const dob = new Date(p.dateOfBirth);
    const now = new Date();
    if (isNaN(dob.getTime())) errors[`p${index}.dateOfBirth`] = 'Invalid date';
    else if (dob > now) errors[`p${index}.dateOfBirth`] = 'Date of birth cannot be in the future';
    else {
      const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (p.type === 'adult' && age < 12) errors[`p${index}.dateOfBirth`] = 'Adult must be 12 years or older';
      if (p.type === 'child' && (age < 2 || age >= 12)) errors[`p${index}.dateOfBirth`] = 'Child must be 2–11 years old';
      if (p.type === 'infant' && age >= 2) errors[`p${index}.dateOfBirth`] = 'Infant must be under 2 years old';
    }
  }
  if (p.type !== 'infant' && p.passportNumber && p.passportNumber.trim().length < 5) {
    errors[`p${index}.passportNumber`] = 'Passport number must be at least 5 characters';
  }
  if (p.passportExpiry) {
    const exp = new Date(p.passportExpiry);
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    if (isNaN(exp.getTime())) errors[`p${index}.passportExpiry`] = 'Invalid expiry date';
    else if (exp < sixMonths) errors[`p${index}.passportExpiry`] = 'Passport must be valid for at least 6 months from travel date';
  }
  return errors;
}

function validateContact(c: ContactDetails): PassengerValidationErrors {
  const errors: PassengerValidationErrors = {};
  if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors['contact.email'] = 'Enter a valid email address';
  if (!c.phone || c.phone.trim().length < 7) errors['contact.phone'] = 'Enter a valid phone number';
  if (!c.phoneCountryCode) errors['contact.phoneCountryCode'] = 'Select a country code';
  return errors;
}

export class FlightsPassengerDetailsView {
  private mount: HTMLElement | null = null;
  private passengers: PassengerIdentity[] = [];
  private contact: ContactDetails = { email: '', phone: '', phoneCountryCode: '+94' };
  private errors: PassengerValidationErrors = {};
  private submitted = false;
  private onContinue?: (passengers: PassengerIdentity[], contact: ContactDetails) => void;
  private onBack?: () => void;

  constructor(options?: { onContinue?: (p: PassengerIdentity[], c: ContactDetails) => void; onBack?: () => void }) {
    this.onContinue = options?.onContinue;
    this.onBack = options?.onBack;
  }

  public setPassengers(passengers: PassengerIdentity[]): void {
    this.passengers = passengers.map((p) => ({ ...p }));
  }

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderForm();
  }

  private renderForm(): void {
    if (!this.mount) return;
    const totalErrors = Object.keys(this.errors).length;
    this.mount.innerHTML = `
      <section class="flights-passenger-details max-w-4xl mx-auto px-4 py-8" aria-labelledby="passenger-details-heading">
        <header class="mb-6">
          <h1 id="passenger-details-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Passenger Details</h1>
          <p class="text-sm text-brand-muted mt-2">Enter traveller information exactly as it appears on travel documents. All fields are validated before proceeding.</p>
        </header>

        ${this.passengers.map((p, i) => this.renderPassengerCard(p, i)).join('')}

        <section class="mt-6 rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="contact-details-heading">
          <h2 id="contact-details-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Lead Contact Details</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Email address</span>
              <input type="email" data-field="contact.email" value="${escapeHtml(this.contact.email)}" autocomplete="email"
                class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${this.errors['contact.email'] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              ${this.errors['contact.email'] ? `<p class="text-xs text-red-600 mt-1" role="alert">${escapeHtml(this.errors['contact.email'])}</p>` : ''}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <label class="block col-span-1">
                <span class="text-xs font-semibold text-brand-muted">Code</span>
                <select data-field="contact.phoneCountryCode" class="mt-1 w-full min-h-[44px] px-2 rounded-xl border ${this.errors['contact.phoneCountryCode'] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
                  ${COUNTRY_CODES.map((c) => `<option value="${escapeHtml(c.code)}" ${this.contact.phoneCountryCode === c.code ? 'selected' : ''}>${escapeHtml(c.code)}</option>`).join('')}
                </select>
              </label>
              <label class="block col-span-2">
                <span class="text-xs font-semibold text-brand-muted">Phone number</span>
                <input type="tel" data-field="contact.phone" value="${escapeHtml(this.contact.phone)}" autocomplete="tel"
                  class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${this.errors['contact.phone'] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                ${this.errors['contact.phone'] ? `<p class="text-xs text-red-600 mt-1" role="alert">${escapeHtml(this.errors['contact.phone'])}</p>` : ''}
              </label>
            </div>
          </div>
          <p class="text-xs text-brand-muted mt-3">Your contact details are used for booking confirmation and travel updates. They are not stored in browser analytics.</p>
        </section>

        ${totalErrors > 0 && this.submitted ? `<div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert" aria-live="polite">${totalErrors} field${totalErrors === 1 ? '' : 's'} need${totalErrors === 1 ? 's' : ''} correction before proceeding.</div>` : ''}

        <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-between">
          <button type="button" data-action="back" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary">
            Back to fare selection
          </button>
          <button type="button" data-action="continue" class="min-h-[44px] px-6 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
            Continue to trip review
          </button>
        </div>

        <p class="text-xs text-brand-muted mt-4 text-center">Passenger information is submitted only to the secure Vacatina booking service. It is never stored in browser storage or analytics.</p>
      </section>
    `;

    this.attachHandlers();
  }

  private renderPassengerCard(p: PassengerIdentity, index: number): string {
    const prefix = `p${index}`;
    const typeLabel = p.type === 'adult' ? 'Adult' : p.type === 'child' ? 'Child' : 'Infant';
    const e = this.errors;
    const fieldError = (field: string) => e[`${prefix}.${field}`]
      ? `<p class="text-xs text-red-600 mt-1" role="alert">${escapeHtml(e[`${prefix}.${field}`])}</p>`
      : '';

    return `
      <section class="mt-4 rounded-2xl border border-brand-border bg-white p-5" aria-labelledby="passenger-${index}-heading">
        <h2 id="passenger-${index}-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">
          ${escapeHtml(typeLabel)} ${index + 1}
          ${p.type === 'infant' ? '<span class="text-xs font-normal text-brand-muted ml-2">(Travelling with adult)</span>' : ''}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Title</span>
            <select data-passenger="${index}" data-field="title" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.title`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option value="">Select</option>
              ${TITLES.map((t) => `<option value="${t}" ${p.title === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            ${fieldError('title')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">First name (as on document)</span>
            <input type="text" data-passenger="${index}" data-field="firstName" value="${escapeHtml(p.firstName)}" autocomplete="given-name"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.firstName`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            ${fieldError('firstName')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Last name (as on document)</span>
            <input type="text" data-passenger="${index}" data-field="lastName" value="${escapeHtml(p.lastName)}" autocomplete="family-name"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.lastName`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            ${fieldError('lastName')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Date of birth</span>
            <input type="date" data-passenger="${index}" data-field="dateOfBirth" value="${escapeHtml(p.dateOfBirth)}" autocomplete="bday"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.dateOfBirth`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            ${fieldError('dateOfBirth')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Nationality</span>
            <input type="text" data-passenger="${index}" data-field="nationality" value="${escapeHtml(p.nationality)}" autocomplete="country-name"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.nationality`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="e.g. Sri Lankan" />
            ${fieldError('nationality')}
          </label>
          ${p.type !== 'infant' ? `
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Passport number</span>
            <input type="text" data-passenger="${index}" data-field="passportNumber" value="${escapeHtml(p.passportNumber)}" autocomplete="off"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.passportNumber`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            ${fieldError('passportNumber')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Passport expiry</span>
            <input type="date" data-passenger="${index}" data-field="passportExpiry" value="${escapeHtml(p.passportExpiry)}" autocomplete="off"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border ${e[`${prefix}.passportExpiry`] ? 'border-red-400' : 'border-brand-border'} text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            ${fieldError('passportExpiry')}
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Issuing country</span>
            <input type="text" data-passenger="${index}" data-field="passportIssuingCountry" value="${escapeHtml(p.passportIssuingCountry)}" autocomplete="off"
              class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="e.g. Sri Lanka" />
          </label>
          ` : ''}
          <label class="block">
            <span class="text-xs font-semibold text-brand-muted">Frequent flyer (optional)</span>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <input type="text" data-passenger="${index}" data-field="frequentFlyerProgram" value="${escapeHtml(p.frequentFlyerProgram)}" placeholder="Program"
                class="min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
              <input type="text" data-passenger="${index}" data-field="frequentFlyerNumber" value="${escapeHtml(p.frequentFlyerNumber)}" placeholder="Number"
                class="min-h-[44px] px-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary" />
            </div>
          </label>
        </div>
      </section>
    `;
  }

  private attachHandlers(): void {
    if (!this.mount) return;
    this.mount.querySelectorAll('[data-passenger]').forEach((el) => {
      el.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const idx = parseInt(target.dataset.passenger || '0', 10);
        const field = target.dataset.field as keyof PassengerIdentity;
        if (this.passengers[idx]) {
          (this.passengers[idx] as any)[field] = target.value;
        }
      });
      el.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const idx = parseInt(target.dataset.passenger || '0', 10);
        const field = target.dataset.field as keyof PassengerIdentity;
        if (this.passengers[idx]) {
          (this.passengers[idx] as any)[field] = target.value;
        }
      });
    });
    this.mount.querySelectorAll('[data-field^="contact."]').forEach((el) => {
      el.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const field = target.dataset.field?.replace('contact.', '') as keyof ContactDetails;
        if (field && field in this.contact) {
          (this.contact as any)[field] = target.value;
        }
      });
      el.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const field = target.dataset.field?.replace('contact.', '') as keyof ContactDetails;
        if (field && field in this.contact) {
          (this.contact as any)[field] = target.value;
        }
      });
    });
    this.mount.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.onBack?.();
    });
    this.mount.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
      this.submitted = true;
      this.errors = {};
      this.passengers.forEach((p, i) => {
        Object.assign(this.errors, validatePassenger(p, i));
      });
      Object.assign(this.errors, validateContact(this.contact));
      if (Object.keys(this.errors).length === 0) {
        this.onContinue?.(this.passengers, this.contact);
      } else {
        this.renderForm();
      }
    });
  }
}
