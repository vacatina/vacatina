/* ============================================================================
 * Vacatina Flights — B2C Booking Dossier (screens 25–33)
 *
 * 25 /flights/manage              Guest booking lookup
 * 26 /account/trips               My trips / bookings
 * 27 /bookings/:ref               Booking details
 * 28 /bookings/:ref/ticket        E-ticket & references
 * 29 /bookings/:ref/receipt       Receipt / invoice
 * 30 /bookings/:ref/ticketing     Ticketing pending / hold
 * 31 /bookings/:ref/travel-prep   Travel prep / check-in
 * 32 /bookings/:ref/extras        Post-booking extras
 * 33 /bookings/:ref/correction    Passenger correction
 *
 * TRUTH MODEL
 * Everything here is a deterministic local demo fixture. No PNR, ticket number,
 * receipt, check-in or correction is transmitted to an airline, GDS, payment
 * provider or email service. Every action that would touch a real system says so
 * in the UI and is labelled "preview".
 *
 * PII: passport numbers are only ever rendered masked and never stored in the
 * URL. The demo data below is synthetic.
 * ============================================================================ */

export type DossierStage =
  | 'details'
  | 'ticket'
  | 'receipt'
  | 'ticketing'
  | 'travel-prep'
  | 'extras'
  | 'correction';

export interface DossierPassenger {
  id: string;
  type: 'adult' | 'child' | 'infant';
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  seat: string;
  meal: string;
  baggageUnits: number;
  ticketNumber: string;
}

export interface DossierLeg {
  flight: string;
  airline: string;
  route: string;
  departAt: string;
  arriveAt: string;
  duration: string;
  terminal: string;
}

export interface DossierCorrection {
  id: string;
  passengerId: string;
  field: 'name' | 'dob' | 'title';
  value: string;
  reason: string;
  status: 'pending_review' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface DossierRecord {
  reference: string;
  leadSurname: string;
  contactEmail: string;
  contactPhone: string;
  status: 'ticketed' | 'pending_ticketing' | 'cancelled';
  paymentStatus: 'paid' | 'refunded';
  currency: string;
  total: number;
  taxes: number;
  fees: number;
  paymentMethod: string;
  pnr: string;
  issuedAt: string;
  holdExpiresAt: string;
  legs: DossierLeg[];
  passengers: DossierPassenger[];
  receipt: { invoiceNo: string; issuedAt: string; method: string; lines: { label: string; amount: number }[] };
  checklist: Record<string, boolean>;
  checkInReminder: boolean;
  extras: { baggageUnits: number; seat: string; meal: string; insurance: boolean; savedAt: string };
  corrections: DossierCorrection[];
  lastResentAt: string;
  history: { at: string; label: string }[];
}

export const DOSSIER_STORE_PREFIX = 'vacatina:dossier:';

const BAGGAGE_UNIT = 4500;
const SEAT_PRICES: Record<string, number> = { none: 0, standard: 1200, extra_legroom: 3800 };
const MEAL_PRICES: Record<string, number> = { none: 0, standard: 0, vegetarian: 900, halal: 900 };
const INSURANCE_PRICE = 2500;

export const PREP_ITEMS: { id: string; label: string; hint: string }[] = [
  { id: 'passport', label: 'Passport valid for 6+ months', hint: 'Check the expiry date against your return date.' },
  { id: 'visa', label: 'Entry visa / e-visa confirmed', hint: 'UAE visit visa or eligibility checked.' },
  { id: 'documents', label: 'Travel documents uploaded', hint: 'Passport bio page stored securely with the booking.' },
  { id: 'baggage', label: 'Baggage allowance reviewed', hint: 'Cabin and checked allowances match what you packed.' },
  { id: 'airport', label: 'Airport arrival time planned', hint: 'Arrive at least 3 hours before an international departure.' },
];

/* ------------------------------------------------------------------ helpers */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}

export function money(value: number): string {
  return `LKR ${Number(value || 0).toLocaleString('en-US')}`;
}

export function maskPassport(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Not recorded';
  if (raw.length <= 3) return '•••';
  return `${raw.slice(0, 2)}•••${raw.slice(-2)}`;
}

declare const __VACATINA_PREVIEW_BUILD__: boolean;
function isLocalDemoHost(): boolean {
  const w = window as any;
  const previewBuild = typeof __VACATINA_PREVIEW_BUILD__ !== 'undefined' && __VACATINA_PREVIEW_BUILD__;
  if (w.__VACATINA_PUBLIC_DEMO__ && !previewBuild) return false;
  const host = window.location.hostname;
  return previewBuild || host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '';
}

/** Demo account surfaces are only available on a local, non-public-demo build. */
export function demoAccountLocalAvailable(): boolean {
  return isLocalDemoHost();
}

export function normalizeStage(raw: string): DossierStage {
  const s = String(raw || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (s === 'ticket' || s === 'e-ticket') return 'ticket';
  if (s === 'receipt' || s === 'invoice') return 'receipt';
  if (s === 'ticketing' || s === 'hold') return 'ticketing';
  if (s === 'travel-prep' || s === 'check-in') return 'travel-prep';
  if (s === 'extras' || s === 'ancillaries') return 'extras';
  if (s === 'correction' || s === 'passenger-correction') return 'correction';
  return 'details';
}

/* ------------------------------------------------------------- demo fixtures */

function baseRecord(reference: string): DossierRecord {
  return {
    reference,
    leadSurname: 'Silva',
    contactEmail: 'amara.silva@example.com',
    contactPhone: '+94 77 123 4567',
    status: 'ticketed',
    paymentStatus: 'paid',
    currency: 'LKR',
    total: 318400,
    taxes: 44400,
    fees: 18000,
    paymentMethod: 'Visa •••• 4242 (preview)',
    pnr: '6J8K2Q',
    issuedAt: '22 Oct 2026, 14:05',
    holdExpiresAt: '',
    legs: [
      {
        flight: 'UL 505',
        airline: 'SriLankan Airlines',
        route: 'CMB → DXB',
        departAt: '18 Nov 2026, 08:20',
        arriveAt: '18 Nov 2026, 11:35',
        duration: '4h 45m',
        terminal: 'Colombo Bandaranaike T1 · Dubai T3',
      },
      {
        flight: 'UL 506',
        airline: 'SriLankan Airlines',
        route: 'DXB → CMB',
        departAt: '25 Nov 2026, 19:10',
        arriveAt: '26 Nov 2026, 01:05',
        duration: '4h 25m',
        terminal: 'Dubai T3 · Colombo Bandaranaike T1',
      },
    ],
    passengers: [
      {
        id: 'pax-1', type: 'adult', title: 'Ms', firstName: 'Amara', lastName: 'Silva',
        dateOfBirth: '1990-05-14', seat: '14A', meal: 'Vegetarian', baggageUnits: 1,
        ticketNumber: 'VCT-TKT-0001-01',
      },
      {
        id: 'pax-2', type: 'adult', title: 'Mr', firstName: 'Dilan', lastName: 'Silva',
        dateOfBirth: '1988-11-02', seat: '14B', meal: 'Standard', baggageUnits: 1,
        ticketNumber: 'VCT-TKT-0001-02',
      },
    ],
    receipt: {
      invoiceNo: 'VCT-INV-0001',
      issuedAt: '22 Oct 2026, 14:05',
      method: 'Visa •••• 4242 (preview)',
      lines: [
        { label: 'Base fare · 2 adults (UL 505 / UL 506)', amount: 256000 },
        { label: 'Airline taxes and carrier charges', amount: 44400 },
        { label: 'Vacatina service fee', amount: 18000 },
      ],
    },
    checklist: {},
    checkInReminder: false,
    extras: { baggageUnits: 0, seat: 'none', meal: 'none', insurance: false, savedAt: '' },
    corrections: [],
    lastResentAt: '',
    history: [
      { at: '22 Oct 2026, 14:02', label: 'Payment captured (preview)' },
      { at: '22 Oct 2026, 14:05', label: 'Airline confirmation and ticket numbers recorded (preview)' },
    ],
  };
}

function pendingRecord(reference: string): DossierRecord {
  return {
    reference,
    leadSurname: 'Perera',
    contactEmail: 'nuwan.perera@example.com',
    contactPhone: '+94 71 555 8899',
    status: 'pending_ticketing',
    paymentStatus: 'paid',
    currency: 'LKR',
    total: 91300,
    taxes: 12300,
    fees: 4500,
    paymentMethod: 'Mastercard •••• 8210 (preview)',
    pnr: '',
    issuedAt: '',
    holdExpiresAt: '17 Nov 2026, 18:00',
    legs: [
      {
        flight: 'UL 101',
        airline: 'SriLankan Airlines',
        route: 'CMB → MLE',
        departAt: '20 Nov 2026, 07:35',
        arriveAt: '20 Nov 2026, 08:50',
        duration: '1h 15m',
        terminal: 'Colombo Bandaranaike T1 · Malé Velana T1',
      },
    ],
    passengers: [
      {
        id: 'pax-1', type: 'adult', title: 'Mr', firstName: 'Nuwan', lastName: 'Perera',
        dateOfBirth: '1985-02-19', seat: 'Not assigned', meal: 'Standard', baggageUnits: 0,
        ticketNumber: '',
      },
    ],
    receipt: {
      invoiceNo: 'VCT-INV-0002',
      issuedAt: '29 Oct 2026, 09:41',
      method: 'Mastercard •••• 8210 (preview)',
      lines: [
        { label: 'Base fare · 1 adult (UL 101)', amount: 74500 },
        { label: 'Airline taxes and carrier charges', amount: 12300 },
        { label: 'Vacatina service fee', amount: 4500 },
      ],
    },
    checklist: {},
    checkInReminder: false,
    extras: { baggageUnits: 0, seat: 'none', meal: 'none', insurance: false, savedAt: '' },
    corrections: [],
    lastResentAt: '',
    history: [
      { at: '29 Oct 2026, 09:38', label: 'Payment captured (preview)' },
      { at: '29 Oct 2026, 09:41', label: 'Airline seat hold placed — ticketing pending (preview)' },
    ],
  };
}

function cancelledRecord(reference: string): DossierRecord {
  return {
    reference,
    leadSurname: 'Fernando',
    contactEmail: 'kasun.fernando@example.com',
    contactPhone: '+94 76 222 3344',
    status: 'cancelled',
    paymentStatus: 'refunded',
    currency: 'LKR',
    total: 118500,
    taxes: 16500,
    fees: 6000,
    paymentMethod: 'Visa •••• 1188 (preview)',
    pnr: 'QX4M9T',
    issuedAt: '02 Oct 2026, 11:20',
    holdExpiresAt: '',
    legs: [
      {
        flight: 'SQ 469',
        airline: 'Singapore Airlines',
        route: 'CMB → SIN',
        departAt: '02 Dec 2026, 00:45',
        arriveAt: '02 Dec 2026, 07:10',
        duration: '3h 55m',
        terminal: 'Colombo Bandaranaike T1 · Singapore Changi T3',
      },
    ],
    passengers: [
      {
        id: 'pax-1', type: 'adult', title: 'Mr', firstName: 'Kasun', lastName: 'Fernando',
        dateOfBirth: '1992-07-08', seat: '22C', meal: 'Halal', baggageUnits: 1,
        ticketNumber: 'VCT-TKT-0003-01',
      },
    ],
    receipt: {
      invoiceNo: 'VCT-INV-0003',
      issuedAt: '02 Oct 2026, 11:20',
      method: 'Visa •••• 1188 (preview)',
      lines: [
        { label: 'Base fare · 1 adult (SQ 469)', amount: 96000 },
        { label: 'Airline taxes and carrier charges', amount: 16500 },
        { label: 'Vacatina service fee', amount: 6000 },
      ],
    },
    checklist: {},
    checkInReminder: false,
    extras: { baggageUnits: 0, seat: 'none', meal: 'none', insurance: false, savedAt: '' },
    corrections: [],
    lastResentAt: '',
    history: [
      { at: '02 Oct 2026, 11:18', label: 'Payment captured (preview)' },
      { at: '02 Oct 2026, 11:20', label: 'Airline confirmation and ticket number recorded (preview)' },
      { at: '21 Oct 2026, 10:02', label: 'Cancellation completed (preview) — refund of LKR 118,500 recorded' },
    ],
  };
}

const DEMO_BOOKINGS: DossierRecord[] = [
  baseRecord('VCT-2026-0001'),
  pendingRecord('VCT-2026-0002'),
  cancelledRecord('VCT-2026-0003'),
];

export const DEMO_BOOKING_REFS = DEMO_BOOKINGS.map(b => b.reference);

/** Read-only demo summary rows used by the guest lookup and My Trips. */
export function demoBookingSummaries(): {
  reference: string; surname: string; route: string; status: DossierRecord['status']; total: number;
}[] {
  return DEMO_BOOKINGS.map(b => ({
    reference: b.reference,
    surname: b.leadSurname,
    route: b.legs[0]?.route || '—',
    status: b.status,
    total: b.total,
  }));
}

export function seedDossier(reference: string): DossierRecord | null {
  const found = DEMO_BOOKINGS.find(b => b.reference === reference.toUpperCase());
  return found ? JSON.parse(JSON.stringify(found)) as DossierRecord : null;
}

function readDossier(reference: string): DossierRecord | null {
  const key = `${DOSSIER_STORE_PREFIX}${reference}`;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as DossierRecord;
      if (parsed && parsed.reference) return parsed;
    }
  } catch {
    /* fall through to the deterministic seed */
  }
  const seed = seedDossier(reference);
  if (seed) writeDossier(seed);
  return seed;
}

function writeDossier(record: DossierRecord): void {
  try {
    window.sessionStorage.setItem(`${DOSSIER_STORE_PREFIX}${record.reference}`, JSON.stringify(record));
  } catch {
    /* storage unavailable — the view stays in-page and never fabricates success */
  }
}

export function readStoredDossier(reference: string): DossierRecord | null {
  return readDossier(reference);
}

/* --------------------------------------------------------------- shared bits */

const STATUS_LABEL: Record<DossierRecord['status'], string> = {
  ticketed: 'Ticketed',
  pending_ticketing: 'Ticketing pending',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<DossierRecord['status'], string> = {
  ticketed: 'border-green-200 bg-green-50 text-green-800',
  pending_ticketing: 'border-amber-200 bg-amber-50 text-amber-900',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

const BTN_PRIMARY = 'min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';
const BTN_GHOST = 'min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2';
const BTN_SMALL = 'min-h-[44px] px-4 rounded-xl border border-brand-border text-brand-black font-semibold text-xs hover:bg-brand-subtle transition-colors';
const INPUT = 'w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary';

function previewNote(text: string): string {
  return `<p class="mt-6 text-[11px] leading-relaxed text-brand-muted border-t border-brand-border pt-4" role="note">${escapeHtml(text)}</p>`;
}

function errorBox(id: string): string {
  return `<p id="${id}" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>`;
}

function resultBox(id: string): string {
  return `<div id="${id}" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status" aria-live="polite"></div>`;
}

function statusBadge(record: DossierRecord): string {
  return `<span id="dossier-status-badge" data-booking-status="${record.status}" class="inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${STATUS_TONE[record.status]}">${STATUS_LABEL[record.status]}</span>`;
}

function initials(p: DossierPassenger): string {
  return `${(p.firstName[0] || '').toUpperCase()}${(p.lastName[0] || '').toUpperCase()}`;
}

/* ------------------------------------------------------------- view class */

let pendingMessage: { id: string; text: string } | null = null;

export class FlightsBookingDossierView {
  private mount: HTMLElement | null = null;
  private reference = 'VCT-2026-0001';
  private stage: DossierStage = 'details';

  public render(mount: HTMLElement, reference: string, rawStage = ''): void {
    this.mount = mount;
    this.reference = String(reference || 'VCT-2026-0001').toUpperCase();
    this.stage = normalizeStage(rawStage);

    const record = readDossier(this.reference);
    if (!record) {
      mount.innerHTML = this.unknownShell();
      this.wireUnknown();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    mount.innerHTML = this.shell(record, this.stageContent(record));
    this.wire(record);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ shell */

  private shell(record: DossierRecord, body: string): string {
    return `
      <section class="flights-booking-dossier max-w-6xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="dossier-heading" data-dossier-stage="${this.stage}" data-dossier-ref="${escapeHtml(record.reference)}">
        <nav class="mb-4 text-xs font-semibold text-brand-muted" aria-label="Breadcrumb">
          <a href="/account/trips" class="underline hover:text-brand-black">My trips</a>
          <span aria-hidden="true"> / </span>
          <span class="text-brand-black">${escapeHtml(record.reference)}</span>
        </nav>
        <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">${this.stageLabel()}</p>
            <h1 id="dossier-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${this.stageHeading()}</h1>
            <p class="text-sm text-brand-muted mt-2">${this.stageDescription()}</p>
          </div>
          <div class="text-right">
            ${statusBadge(record)}
            <p class="text-xs text-brand-muted mt-2">Booking <strong class="text-brand-black">${escapeHtml(record.reference)}</strong></p>
          </div>
        </header>
        ${this.stageNav()}
        ${body}
      </section>
    `;
  }

  private stageLabel(): string {
    const labels: Record<DossierStage, string> = {
      details: 'Screen 27 · Booking details',
      ticket: 'Screen 28 · E-ticket & references',
      receipt: 'Screen 29 · Receipt / invoice',
      ticketing: 'Screen 30 · Ticketing status',
      'travel-prep': 'Screen 31 · Travel preparation',
      extras: 'Screen 32 · Post-booking extras',
      correction: 'Screen 33 · Passenger correction',
    };
    return labels[this.stage];
  }

  private stageHeading(): string {
    const headings: Record<DossierStage, string> = {
      details: 'Booking Details',
      ticket: 'E-Ticket & References',
      receipt: 'Receipt & Invoice',
      ticketing: 'Ticketing Pending / Hold',
      'travel-prep': 'Travel Prep & Check-in',
      extras: 'Post-Booking Extras',
      correction: 'Passenger Correction',
    };
    return headings[this.stage];
  }

  private stageDescription(): string {
    const descriptions: Record<DossierStage, string> = {
      details: 'Everything confirmed for this journey, with the documents and services attached to it.',
      ticket: 'Ticket numbers, airline record locator and the preview e-ticket document.',
      receipt: 'A payment record for this booking. This is not a tax invoice unless issued by the airline.',
      ticketing: 'Follow the airline ticketing stage for this booking and understand what is still pending.',
      'travel-prep': 'Complete the pre-travel checks and see when online check-in opens.',
      extras: 'Add baggage, seats and meals to this booking. Nothing is charged in this preview.',
      correction: 'Request a correction to a passenger name, title or date of birth. Airline approval is required.',
    };
    return descriptions[this.stage];
  }

  private stageNav(): string {
    const items: { stage: DossierStage; label: string }[] = [
      { stage: 'details', label: 'Details' },
      { stage: 'ticket', label: 'E-ticket' },
      { stage: 'receipt', label: 'Receipt' },
      { stage: 'ticketing', label: 'Ticketing' },
      { stage: 'travel-prep', label: 'Travel prep' },
      { stage: 'extras', label: 'Extras' },
      { stage: 'correction', label: 'Correction' },
    ];
    return `
      <nav class="flex flex-wrap gap-2 mb-6" aria-label="Booking dossier sections">
        ${items.map(item => {
          const href = item.stage === 'details'
            ? `/bookings/${recordRef(this)}`
            : `/bookings/${recordRef(this)}/${item.stage}`;
          const active = item.stage === this.stage;
          return `<a href="${href}" data-dossier-nav="${item.stage}" ${active ? 'aria-current="page"' : ''}
            class="min-h-[44px] inline-flex items-center px-4 rounded-xl border text-sm font-semibold transition-colors ${active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-black border-brand-border hover:bg-brand-subtle'}">${item.label}</a>`;
        }).join('')}
      </nav>
    `;
  }

  private unknownShell(): string {
    return `
      <section class="max-w-3xl mx-auto px-4 py-16" aria-labelledby="dossier-missing-heading">
        <h1 id="dossier-missing-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Booking not found</h1>
        <p class="text-sm text-brand-muted mt-3">
          No booking <strong>${escapeHtml(this.reference)}</strong> exists in this demo session.
          Look it up again with the reference and lead passenger surname.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <a href="/flights/manage" class="${BTN_PRIMARY} inline-flex items-center">Look up another booking</a>
          <a href="/account/trips" class="${BTN_GHOST} inline-flex items-center">My trips</a>
        </div>
      </section>
    `;
  }

  /* ------------------------------------------------------------ 27 details */

  private detailsContent(record: DossierRecord): string {
    const cancelled = record.status === 'cancelled';
    return `
      ${cancelled ? `
        <div class="rounded-2xl border border-red-200 bg-red-50 p-4 mb-5" role="note">
          <p class="text-sm font-semibold text-red-800">This booking was cancelled.</p>
          <p class="text-xs text-red-800 mt-1">The refund of ${money(record.total)} is recorded in this preview. Change, extras and check-in actions are unavailable.</p>
        </div>
      ` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 space-y-5">
          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Itinerary</h2>
            <ol class="space-y-4">
              ${record.legs.map(leg => `
                <li class="rounded-xl border border-brand-border bg-brand-canvas p-4" data-leg="${escapeHtml(leg.flight)}">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="font-semibold text-brand-black">${escapeHtml(leg.route)} · ${escapeHtml(leg.flight)}</p>
                    <span class="text-xs text-brand-muted">${escapeHtml(leg.duration)}</span>
                  </div>
                  <p class="text-xs text-brand-muted mt-1">${escapeHtml(leg.airline)}</p>
                  <div class="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div><span class="block text-[11px] uppercase text-brand-muted">Departs</span><span class="font-semibold text-brand-black">${escapeHtml(leg.departAt)}</span></div>
                    <div><span class="block text-[11px] uppercase text-brand-muted">Arrives</span><span class="font-semibold text-brand-black">${escapeHtml(leg.arriveAt)}</span></div>
                  </div>
                  <p class="text-[11px] text-brand-muted mt-2">${escapeHtml(leg.terminal)}</p>
                </li>
              `).join('')}
            </ol>
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Passengers</h2>
            <ul class="divide-y divide-brand-border">
              ${record.passengers.map(p => `
                <li class="py-3 flex flex-wrap items-center justify-between gap-3" data-passenger-row="${escapeHtml(p.id)}">
                  <div class="flex items-center gap-3">
                    <span class="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-xs flex items-center justify-center" aria-hidden="true">${escapeHtml(initials(p))}</span>
                    <div>
                      <p class="font-semibold text-brand-black text-sm">${escapeHtml(p.title)} ${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</p>
                      <p class="text-[11px] text-brand-muted">${escapeHtml(p.type)} · DOB ${escapeHtml(p.dateOfBirth)} · Seat ${escapeHtml(p.seat)} · ${escapeHtml(p.meal)}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-[11px] uppercase text-brand-muted">Ticket</p>
                    <p class="text-sm font-semibold text-brand-black tabular-nums">${p.ticketNumber ? escapeHtml(p.ticketNumber) : 'Not issued'}</p>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Documents &amp; services</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/bookings/${escapeHtml(record.reference)}/ticket" data-action="view-ticket" class="${BTN_GHOST} inline-flex items-center justify-center">View e-ticket</a>
              <a href="/bookings/${escapeHtml(record.reference)}/receipt" data-action="view-receipt" class="${BTN_GHOST} inline-flex items-center justify-center">Receipt &amp; invoice</a>
              <a href="/bookings/${escapeHtml(record.reference)}/travel-prep" data-action="travel-prep" class="${BTN_GHOST} inline-flex items-center justify-center">Travel prep &amp; check-in</a>
              ${cancelled
                ? `<span class="${BTN_GHOST} inline-flex items-center justify-center opacity-50" aria-disabled="true">Extras unavailable</span>`
                : `<a href="/bookings/${escapeHtml(record.reference)}/extras" data-action="manage-extras" class="${BTN_GHOST} inline-flex items-center justify-center">Add extras</a>`}
              ${cancelled
                ? `<span class="${BTN_GHOST} inline-flex items-center justify-center opacity-50" aria-disabled="true">Correction unavailable</span>`
                : `<a href="/bookings/${escapeHtml(record.reference)}/correction" data-action="correct-passenger" class="${BTN_GHOST} inline-flex items-center justify-center">Correct passenger details</a>`}
              <button type="button" id="dossier-resend-toggle" class="${BTN_GHOST}">Resend confirmation</button>
            </div>

            <div id="dossier-resend-panel" class="hidden mt-4 rounded-xl border border-brand-border bg-brand-canvas p-4">
              <form id="dossier-resend-form" novalidate>
                <label for="dossier-resend-email" class="block text-xs font-bold uppercase text-brand-muted">Send confirmation to</label>
                <input id="dossier-resend-email" type="email" value="${escapeHtml(record.contactEmail)}" aria-describedby="dossier-resend-error" class="${INPUT} mt-1" />
                ${errorBox('dossier-resend-error')}
                <div class="flex flex-wrap gap-2 mt-3">
                  <button type="submit" id="dossier-resend-submit" class="${BTN_PRIMARY}">Send confirmation</button>
                  <button type="button" id="dossier-resend-cancel" class="${BTN_SMALL}">Cancel</button>
                </div>
              </form>
              ${resultBox('dossier-resend-result')}
            </div>
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Manage this booking</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/bookings/${escapeHtml(record.reference)}/change" class="${BTN_GHOST} inline-flex items-center justify-center">Change flight</a>
              <a href="/bookings/${escapeHtml(record.reference)}/cancel" class="${BTN_GHOST} inline-flex items-center justify-center">Cancel flight</a>
              <a href="/bookings/${escapeHtml(record.reference)}/refund" class="${BTN_GHOST} inline-flex items-center justify-center">Refund &amp; credit tracker</a>
              <a href="/bookings/${escapeHtml(record.reference)}/support" class="${BTN_GHOST} inline-flex items-center justify-center">Contact support</a>
            </div>
            <p class="text-[11px] text-brand-muted mt-3">Changes, cancellations and refunds open their own guided workflow. Nothing is actioned until you confirm it there.</p>
          </div>
        </div>

        <aside class="space-y-5">
          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Reference</h2>
            <dl class="space-y-3 text-sm">
              <div><dt class="text-[11px] uppercase text-brand-muted">Airline record locator (PNR)</dt>
                <dd class="font-bold text-brand-black tabular-nums text-lg" id="dossier-pnr">${record.pnr ? escapeHtml(record.pnr) : 'Not issued'}</dd></div>
              <div><dt class="text-[11px] uppercase text-brand-muted">Booking reference</dt><dd class="font-semibold text-brand-black">${escapeHtml(record.reference)}</dd></div>
              <div><dt class="text-[11px] uppercase text-brand-muted">Issued</dt><dd class="font-semibold text-brand-black">${record.issuedAt ? escapeHtml(record.issuedAt) : 'Pending ticketing'}</dd></div>
            </dl>
            <button type="button" id="dossier-copy-pnr" class="${BTN_SMALL} mt-4 w-full" ${record.pnr ? '' : 'disabled aria-disabled="true"'}>Select PNR to copy</button>
            <p id="dossier-copy-status" class="text-[11px] text-brand-muted mt-2" role="status"></p>
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Payment</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-3"><dt class="text-brand-muted">Status</dt><dd class="font-semibold text-brand-black">${record.paymentStatus === 'paid' ? 'Paid (preview)' : 'Refunded (preview)'}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-brand-muted">Taxes</dt><dd class="font-semibold text-brand-black tabular-nums">${money(record.taxes)}</dd></div>
              <div class="flex justify-between gap-3"><dt class="text-brand-muted">Fees</dt><dd class="font-semibold text-brand-black tabular-nums">${money(record.fees)}</dd></div>
              <div class="flex justify-between gap-3 border-t border-brand-border pt-2"><dt class="font-semibold text-brand-black">Total</dt><dd class="font-bold text-brand-primary tabular-nums">${money(record.total)}</dd></div>
            </dl>
            <p class="text-[11px] text-brand-muted mt-3">${escapeHtml(record.paymentMethod)}</p>
          </div>

          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">History</h2>
            <ol class="space-y-2 text-xs text-brand-muted">
              ${record.history.slice().reverse().map(h => `<li><span class="block text-[10px] uppercase">${escapeHtml(h.at)}</span><span class="text-brand-black font-semibold">${escapeHtml(h.label)}</span></li>`).join('')}
            </ol>
          </div>
        </aside>
      </div>

      ${previewNote('This dossier is a deterministic demo fixture. Ticket numbers, PNRs, receipts and status changes are simulated locally and are not valid for travel.')}
    `;
  }

  /* -------------------------------------------------------------- 28 ticket */

  private ticketContent(record: DossierRecord): string {
    if (record.status === 'cancelled') {
      return `${this.blockedNotice('This booking was cancelled', 'E-tickets for a cancelled booking are void. Contact support if you need the cancellation record.')}`;
    }
    const issued = record.status === 'ticketed' && record.passengers.every(p => p.ticketNumber);
    return `
      ${issued ? '' : this.pendingTicketNotice(record)}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="font-heading text-lg font-semibold text-brand-black">Airline references</h2>
              <p class="text-xs text-brand-muted mt-1">Record locator and per-passenger ticket numbers.</p>
            </div>
            <span class="text-xs font-semibold ${issued ? 'text-green-700' : 'text-amber-700'}">${issued ? 'Tickets issued (preview)' : 'Tickets not issued yet'}</span>
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div class="rounded-xl border border-brand-border bg-brand-canvas p-4">
              <dt class="text-[11px] uppercase text-brand-muted">PNR</dt>
              <dd class="font-bold text-brand-black tabular-nums text-xl mt-1" id="ticket-pnr">${record.pnr ? escapeHtml(record.pnr) : 'Not issued'}</dd>
            </div>
            <div class="rounded-xl border border-brand-border bg-brand-canvas p-4">
              <dt class="text-[11px] uppercase text-brand-muted">Issued</dt>
              <dd class="font-semibold text-brand-black mt-1">${record.issuedAt ? escapeHtml(record.issuedAt) : 'Pending ticketing'}</dd>
            </div>
          </dl>
          <table class="w-full text-sm">
            <caption class="sr-only">Passenger ticket numbers</caption>
            <thead><tr class="text-left text-[11px] uppercase text-brand-muted border-b border-brand-border">
              <th scope="col" class="py-2 pr-3">Passenger</th><th scope="col" class="py-2 pr-3">Seat</th><th scope="col" class="py-2">Ticket number</th>
            </tr></thead>
            <tbody>
              ${record.passengers.map((p, i) => `
                <tr class="border-b border-brand-border last:border-0" data-ticket-row="${i}">
                  <td class="py-3 pr-3 font-semibold text-brand-black">${escapeHtml(p.title)} ${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</td>
                  <td class="py-3 pr-3 text-brand-muted">${escapeHtml(p.seat)}</td>
                  <td class="py-3 tabular-nums font-semibold ${p.ticketNumber ? 'text-brand-black' : 'text-amber-700'}">${p.ticketNumber ? escapeHtml(p.ticketNumber) : 'Not issued'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="flex flex-wrap gap-3 mt-5">
            <button type="button" id="ticket-show-document" class="${BTN_PRIMARY}" ${issued ? '' : 'disabled aria-disabled="true"'}>Show e-ticket document</button>
            <a href="/bookings/${escapeHtml(record.reference)}/ticketing" class="${BTN_GHOST} inline-flex items-center">Ticketing status</a>
          </div>
          <div id="ticket-document" class="hidden mt-5 rounded-2xl border-2 border-dashed border-brand-border bg-brand-canvas p-5" aria-label="Preview e-ticket document">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-brand-border pb-3 mb-3">
              <div>
                <p class="text-[10px] uppercase font-bold text-brand-muted">Vacatina preview e-ticket</p>
                <p class="font-heading font-bold text-brand-black">${escapeHtml(record.legs[0]?.route || '')} · ${escapeHtml(record.legs[0]?.flight || '')}</p>
              </div>
              <p class="text-xs font-bold text-brand-black tabular-nums">PNR ${escapeHtml(record.pnr)}</p>
            </div>
            <ul class="space-y-1 text-xs text-brand-black">
              ${record.passengers.map(p => `<li>${escapeHtml(p.title)} ${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)} — ${escapeHtml(p.ticketNumber || 'Not issued')} — seat ${escapeHtml(p.seat)}</li>`).join('')}
            </ul>
            <p class="mt-3 text-[11px] font-bold text-red-700">Preview document — not a valid airline e-ticket and not accepted at the airport.</p>
            <button type="button" id="ticket-hide-document" class="${BTN_SMALL} mt-3">Hide document</button>
          </div>
        </div>

        <aside class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Send by email</h2>
          <form id="ticket-email-form" novalidate>
            <label for="ticket-email" class="block text-xs font-bold uppercase text-brand-muted">Recipient email</label>
            <input id="ticket-email" type="email" value="${escapeHtml(record.contactEmail)}" aria-describedby="ticket-email-error" class="${INPUT} mt-1" />
            ${errorBox('ticket-email-error')}
            <button type="submit" id="ticket-email-submit" class="${BTN_PRIMARY} mt-3 w-full">Queue e-ticket email</button>
          </form>
          ${resultBox('ticket-email-result')}
          <p class="text-[11px] text-brand-muted mt-3">No email service is connected. The request is recorded in this session only.</p>
        </aside>
      </div>
      ${previewNote('Ticket numbers and the e-ticket document are deterministic demo values. No GDS or airline has issued a ticket.')}
    `;
  }

  private pendingTicketNotice(record: DossierRecord): string {
    return `
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-5" role="note">
        <p class="text-sm font-semibold text-amber-900">Tickets are not issued yet.</p>
        <p class="text-xs text-amber-900 mt-1">
          ${record.status === 'pending_ticketing' && record.holdExpiresAt
            ? `The airline seat hold expires ${escapeHtml(record.holdExpiresAt)}.`
            : 'Ticketing has not completed for this booking.'}
          You will receive an e-ticket once the airline confirms. This is a preview status.
        </p>
      </div>
    `;
  }

  /* ------------------------------------------------------------- 29 receipt */

  private receiptContent(record: DossierRecord): string {
    const lines = record.receipt.lines;
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="font-heading text-lg font-semibold text-brand-black">Payment record</h2>
              <p class="text-xs text-brand-muted mt-1">Invoice ${escapeHtml(record.receipt.invoiceNo)} · issued ${escapeHtml(record.receipt.issuedAt)}</p>
            </div>
            <span class="inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${record.paymentStatus === 'paid' ? 'border-green-200 bg-green-50 text-green-800' : 'border-brand-border bg-brand-subtle text-brand-muted'}">${record.paymentStatus === 'paid' ? 'Paid (preview)' : 'Refunded (preview)'}</span>
          </div>
          <table class="w-full text-sm">
            <caption class="sr-only">Receipt line items</caption>
            <thead><tr class="text-left text-[11px] uppercase text-brand-muted border-b border-brand-border">
              <th scope="col" class="py-2">Description</th><th scope="col" class="py-2 text-right">Amount</th>
            </tr></thead>
            <tbody>
              ${lines.map(l => `<tr class="border-b border-brand-border"><td class="py-3 text-brand-black">${escapeHtml(l.label)}</td><td class="py-3 text-right tabular-nums font-semibold text-brand-black">${money(l.amount)}</td></tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td class="pt-3 font-semibold text-brand-black">Subtotal</td><td class="pt-3 text-right tabular-nums font-semibold text-brand-black">${money(subtotal)}</td></tr>
              <tr><td class="font-bold text-brand-black">Total ${record.paymentStatus === 'paid' ? 'paid' : 'refunded'}</td><td class="text-right tabular-nums font-bold text-brand-primary text-lg">${money(record.total)}</td></tr>
            </tfoot>
          </table>
          <p class="text-[11px] text-brand-muted mt-3">Payment method: ${escapeHtml(record.receipt.method)}</p>
          <div class="flex flex-wrap gap-3 mt-5">
            <button type="button" id="receipt-show-invoice" class="${BTN_PRIMARY}">Show printable invoice</button>
            <a href="/bookings/${escapeHtml(record.reference)}/ticket" class="${BTN_GHOST} inline-flex items-center">E-ticket</a>
          </div>
          <div id="receipt-invoice-document" class="hidden mt-5 rounded-2xl border border-brand-border bg-brand-canvas p-5">
            <div class="flex flex-wrap justify-between gap-3 border-b border-brand-border pb-3 mb-3">
              <div>
                <p class="text-[10px] uppercase font-bold text-brand-muted">Vacatina preview invoice</p>
                <p class="font-heading font-bold text-brand-black">${escapeHtml(record.receipt.invoiceNo)}</p>
              </div>
              <div class="text-right text-xs text-brand-black">
                <p class="font-semibold">${escapeHtml(record.reference)}</p>
                <p class="text-brand-muted">${escapeHtml(record.receipt.issuedAt)}</p>
              </div>
            </div>
            <ul class="space-y-1 text-xs text-brand-black">
              ${lines.map(l => `<li class="flex justify-between gap-3"><span>${escapeHtml(l.label)}</span><span class="tabular-nums font-semibold">${money(l.amount)}</span></li>`).join('')}
            </ul>
            <p class="mt-3 text-[11px] font-bold text-red-700">Preview invoice — not a tax invoice and not valid for reimbursement without airline documentation.</p>
            <button type="button" id="receipt-hide-invoice" class="${BTN_SMALL} mt-3">Hide invoice</button>
          </div>
        </div>

        <aside class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Email the receipt</h2>
          <form id="receipt-email-form" novalidate>
            <label for="receipt-email" class="block text-xs font-bold uppercase text-brand-muted">Recipient email</label>
            <input id="receipt-email" type="email" value="${escapeHtml(record.contactEmail)}" aria-describedby="receipt-email-error" class="${INPUT} mt-1" />
            ${errorBox('receipt-email-error')}
            <button type="submit" id="receipt-email-submit" class="${BTN_PRIMARY} mt-3 w-full">Queue receipt email</button>
          </form>
          ${resultBox('receipt-email-result')}
          <p class="text-[11px] text-brand-muted mt-3">No email service is connected. The request is recorded in this session only.</p>
        </aside>
      </div>
      ${previewNote('This receipt is a deterministic demo record. No payment was captured and no invoice was filed with any tax authority.')}
    `;
  }

  /* ----------------------------------------------------------- 30 ticketing */

  private ticketingContent(record: DossierRecord): string {
    const steps = [
      { id: 'payment', label: 'Payment captured (preview)', done: record.paymentStatus === 'paid' },
      { id: 'hold', label: 'Airline seat hold placed', done: record.status !== 'pending_ticketing' || !!record.holdExpiresAt },
      { id: 'ticket', label: 'Airline ticket issuance', done: record.status === 'ticketed' },
      { id: 'delivery', label: 'E-ticket delivery', done: record.status === 'ticketed' && record.passengers.every(p => p.ticketNumber) },
    ];
    const pending = record.status === 'pending_ticketing';
    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Ticketing progress</h2>
          <ol id="ticketing-timeline" class="space-y-3">
            ${steps.map((step, i) => `
              <li class="flex items-start gap-3" data-ticketing-step="${step.id}">
                <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.done ? 'bg-green-100 text-green-800' : 'bg-brand-subtle text-brand-muted border border-brand-border'}" aria-hidden="true">${step.done ? '✓' : i + 1}</span>
                <div>
                  <p class="text-sm font-semibold ${step.done ? 'text-brand-black' : 'text-brand-muted'}">${escapeHtml(step.label)}</p>
                  <p class="text-[11px] text-brand-muted">${step.done ? 'Complete in this preview' : 'Pending'}</p>
                </div>
              </li>
            `).join('')}
          </ol>

          ${record.status === 'cancelled' ? `
            <div class="rounded-xl border border-red-200 bg-red-50 p-4 mt-5" role="note">
              <p class="text-sm font-semibold text-red-800">This booking is cancelled.</p>
              <p class="text-xs text-red-800 mt-1">No further ticketing action is possible.</p>
            </div>
          ` : pending ? `
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-5" role="note">
              <p class="text-sm font-semibold text-amber-900">Airline ticketing is still pending.</p>
              <p class="text-xs text-amber-900 mt-1">Seat hold expires ${escapeHtml(record.holdExpiresAt)}. If the airline cannot confirm before then, the hold is released and any captured payment is refunded.</p>
            </div>
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" id="ticketing-refresh" class="${BTN_PRIMARY}">Refresh ticketing status</button>
            </div>
            <div class="mt-5 rounded-xl border border-brand-border bg-brand-canvas p-4">
              <label class="flex items-start gap-3 text-sm text-brand-black">
                <input id="ticketing-confirm" type="checkbox" class="mt-0.5 h-5 w-5 rounded border-brand-border" />
                <span>I understand that cancelling this hold ends the booking.</span>
              </label>
              ${errorBox('ticketing-error')}
              <button type="button" id="ticketing-cancel-hold" class="${BTN_SMALL} mt-3">Cancel this hold</button>
            </div>
            ${resultBox('ticketing-result')}
          ` : `
            <div class="rounded-xl border border-green-200 bg-green-50 p-4 mt-5" role="note">
              <p class="text-sm font-semibold text-green-800">Ticketing is complete (preview).</p>
              <p class="text-xs text-green-800 mt-1">PNR ${escapeHtml(record.pnr)} · ${record.passengers.length} ticket number(s) issued.</p>
            </div>
            <div class="mt-4 flex flex-wrap gap-3">
              <a href="/bookings/${escapeHtml(record.reference)}/ticket" class="${BTN_PRIMARY} inline-flex items-center">Open e-ticket</a>
              <a href="/bookings/${escapeHtml(record.reference)}/travel-prep" class="${BTN_GHOST} inline-flex items-center">Travel preparation</a>
            </div>
          `}
        </div>

        <aside class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">What this means</h2>
          <ul class="space-y-3 text-xs text-brand-muted">
            <li><strong class="text-brand-black">Paid</strong> means a payment was captured. It does not mean the airline has issued a ticket.</li>
            <li><strong class="text-brand-black">Hold</strong> means seats are reserved for a limited time while ticketing completes.</li>
            <li><strong class="text-brand-black">Ticketed</strong> means the airline returned a record locator and ticket numbers.</li>
            <li>Vacatina never shows "confirmed" until the airline has confirmed every passenger.</li>
          </ul>
        </aside>
      </div>
      ${resultBox('ticketing-result')}
      ${previewNote('Ticketing status transitions here are simulated. A real implementation must poll the airline or GDS and reconcile before showing "ticketed".')}
    `;
  }

  /* --------------------------------------------------------- 31 travel prep */

  private travelPrepContent(record: DossierRecord): string {
    const done = PREP_ITEMS.filter(item => record.checklist[item.id]).length;
    const allDone = done === PREP_ITEMS.length;
    const ticketed = record.status === 'ticketed';
    return `
      ${ticketed ? '' : `
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-5" role="note">
          <p class="text-sm font-semibold text-amber-900">Check-in needs an issued ticket.</p>
          <p class="text-xs text-amber-900 mt-1">This booking is ${escapeHtml(STATUS_LABEL[record.status].toLowerCase())}. You can still complete the preparation checks.</p>
        </div>
      `}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 class="font-heading text-lg font-semibold text-brand-black">Pre-travel checklist</h2>
            <span id="prep-progress" class="text-xs font-bold text-brand-primary tabular-nums">${done} of ${PREP_ITEMS.length} complete</span>
          </div>
          <ul class="space-y-3">
            ${PREP_ITEMS.map(item => `
              <li class="rounded-xl border border-brand-border bg-brand-canvas p-4">
                <label class="flex items-start gap-3">
                  <input type="checkbox" data-prep-item="${item.id}" ${record.checklist[item.id] ? 'checked' : ''} class="mt-0.5 h-5 w-5 rounded border-brand-border" />
                  <span>
                    <span class="block text-sm font-semibold text-brand-black">${escapeHtml(item.label)}</span>
                    <span class="block text-[11px] text-brand-muted mt-0.5">${escapeHtml(item.hint)}</span>
                  </span>
                </label>
              </li>
            `).join('')}
          </ul>

          <label class="flex items-start gap-3 mt-4 text-sm text-brand-black">
            <input id="prep-reminder" type="checkbox" ${record.checkInReminder ? 'checked' : ''} class="mt-0.5 h-5 w-5 rounded border-brand-border" />
            <span>Remind me when online check-in opens.</span>
          </label>
          ${errorBox('prep-error')}
          <div class="flex flex-wrap gap-3 mt-4">
            <button type="button" id="prep-checkin" class="${BTN_PRIMARY}" ${ticketed ? '' : 'disabled aria-disabled="true"'}>Start online check-in</button>
            <a href="/bookings/${escapeHtml(record.reference)}/extras" class="${BTN_GHOST} inline-flex items-center">Add baggage or seats</a>
          </div>
          ${resultBox('prep-result')}
        </div>

        <aside class="space-y-5">
          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Departure</h2>
            <p class="text-sm font-semibold text-brand-black">${escapeHtml(record.legs[0]?.route || '')}</p>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(record.legs[0]?.departAt || '')}</p>
            <p class="text-[11px] text-brand-muted mt-3">Arrive at the airport at least 3 hours before an international departure. Gates typically close 45 minutes before departure.</p>
          </div>
          <div class="rounded-2xl border border-brand-border bg-white p-5">
            <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Baggage allowance</h2>
            <p class="text-xs text-brand-muted">Cabin: 1 piece up to 7 kg. Checked: 1 piece up to 20 kg, plus ${record.extras.baggageUnits} extra unit(s) purchased in this preview.</p>
          </div>
        </aside>
      </div>
      ${previewNote('Check-in is not connected to the airline. Online check-in opens 48 hours before departure and is performed on the airline website or app.')}
    `;
  }

  /* -------------------------------------------------------------- 32 extras */

  private extrasContent(record: DossierRecord): string {
    if (record.status === 'cancelled') {
      return this.blockedNotice('Extras are unavailable', 'This booking was cancelled, so no ancillaries can be added.');
    }
    const e = record.extras;
    const total = e.baggageUnits * BAGGAGE_UNIT + (SEAT_PRICES[e.seat] || 0) + (MEAL_PRICES[e.meal] || 0) + (e.insurance ? INSURANCE_PRICE : 0);
    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-4">Choose extras</h2>
          <form id="extras-form" novalidate class="space-y-5">
            <div>
              <label for="extras-baggage" class="block text-xs font-bold uppercase text-brand-muted">Extra checked baggage (0–4 units · ${money(BAGGAGE_UNIT)} each)</label>
              <input id="extras-baggage" type="number" min="0" max="4" step="1" value="${e.baggageUnits}" aria-describedby="extras-error" class="${INPUT} mt-1 max-w-[140px]" />
            </div>
            <div>
              <label for="extras-seat" class="block text-xs font-bold uppercase text-brand-muted">Seat preference</label>
              <select id="extras-seat" class="${INPUT} mt-1">
                <option value="none" ${e.seat === 'none' ? 'selected' : ''}>No seat preference</option>
                <option value="standard" ${e.seat === 'standard' ? 'selected' : ''}>Standard seat · ${money(SEAT_PRICES.standard)}</option>
                <option value="extra_legroom" ${e.seat === 'extra_legroom' ? 'selected' : ''}>Extra legroom · ${money(SEAT_PRICES.extra_legroom)}</option>
              </select>
            </div>
            <div>
              <label for="extras-meal" class="block text-xs font-bold uppercase text-brand-muted">Meal preference</label>
              <select id="extras-meal" class="${INPUT} mt-1">
                <option value="none" ${e.meal === 'none' ? 'selected' : ''}>No meal requested</option>
                <option value="standard" ${e.meal === 'standard' ? 'selected' : ''}>Standard meal · included</option>
                <option value="vegetarian" ${e.meal === 'vegetarian' ? 'selected' : ''}>Vegetarian · ${money(MEAL_PRICES.vegetarian)}</option>
                <option value="halal" ${e.meal === 'halal' ? 'selected' : ''}>Halal · ${money(MEAL_PRICES.halal)}</option>
              </select>
            </div>
            <label class="flex items-start gap-3 text-sm text-brand-black">
              <input id="extras-insurance" type="checkbox" ${e.insurance ? 'checked' : ''} class="mt-0.5 h-5 w-5 rounded border-brand-border" />
              <span>Add travel insurance · ${money(INSURANCE_PRICE)}</span>
            </label>
            ${errorBox('extras-error')}
            <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 flex items-center justify-between gap-3">
              <span class="text-sm font-semibold text-brand-black">Extras total</span>
              <span id="extras-total" class="text-lg font-bold text-brand-primary tabular-nums">${money(total)}</span>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="submit" id="extras-save" class="${BTN_PRIMARY}">Save extras (preview)</button>
              <button type="button" id="extras-clear" class="${BTN_SMALL}">Remove all extras</button>
            </div>
          </form>
          ${resultBox('extras-result')}
        </div>

        <aside class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Current selection</h2>
          <ul class="space-y-2 text-xs text-brand-muted">
            <li class="flex justify-between gap-3"><span>Extra baggage</span><span class="font-semibold text-brand-black">${e.baggageUnits} unit(s)</span></li>
            <li class="flex justify-between gap-3"><span>Seat</span><span class="font-semibold text-brand-black">${escapeHtml(e.seat.replace('_', ' '))}</span></li>
            <li class="flex justify-between gap-3"><span>Meal</span><span class="font-semibold text-brand-black">${escapeHtml(e.meal)}</span></li>
            <li class="flex justify-between gap-3"><span>Insurance</span><span class="font-semibold text-brand-black">${e.insurance ? 'Added' : 'Not added'}</span></li>
            <li class="flex justify-between gap-3 border-t border-brand-border pt-2"><span>Saved</span><span class="font-semibold text-brand-black">${e.savedAt ? escapeHtml(e.savedAt) : 'Never'}</span></li>
          </ul>
          <p class="text-[11px] text-brand-muted mt-3">Saved extras are attached to the booking in this session. The airline collects ancillary payment at the airport or on its own website.</p>
        </aside>
      </div>
      ${previewNote('Ancillary prices are deterministic demo values. Nothing is charged and no ancillary is transmitted to the airline.')}
    `;
  }

  /* ---------------------------------------------------------- 33 correction */

  private correctionContent(record: DossierRecord): string {
    if (record.status === 'cancelled') {
      return this.blockedNotice('Corrections are unavailable', 'This booking was cancelled, so passenger details can no longer be corrected.');
    }
    const paxOptions = record.passengers.map(p =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)} ${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</option>`).join('');
    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-2">Request a correction</h2>
          <p class="text-xs text-brand-muted mb-4">Name, title and date-of-birth corrections need airline approval. Passport numbers can never be edited here — they must be re-verified with the airline.</p>
          <form id="correction-form" novalidate class="space-y-4">
            <div>
              <label for="correction-passenger" class="block text-xs font-bold uppercase text-brand-muted">Passenger</label>
              <select id="correction-passenger" class="${INPUT} mt-1">${paxOptions}</select>
            </div>
            <div>
              <label for="correction-field" class="block text-xs font-bold uppercase text-brand-muted">Field to correct</label>
              <select id="correction-field" class="${INPUT} mt-1">
                <option value="name">Passenger name</option>
                <option value="title">Title</option>
                <option value="dob">Date of birth</option>
              </select>
            </div>
            <div>
              <label for="correction-value" class="block text-xs font-bold uppercase text-brand-muted">Corrected value</label>
              <input id="correction-value" type="text" placeholder="e.g. Aamara" aria-describedby="correction-error" class="${INPUT} mt-1" />
            </div>
            <div>
              <label for="correction-reason" class="block text-xs font-bold uppercase text-brand-muted">Reason (at least 8 characters)</label>
              <textarea id="correction-reason" rows="3" class="${INPUT} mt-1" placeholder="e.g. spelling error made during booking"></textarea>
            </div>
            <label class="flex items-start gap-3 text-sm text-brand-black">
              <input id="correction-consent" type="checkbox" class="mt-0.5 h-5 w-5 rounded border-brand-border" />
              <span>I understand this is a request and that the airline may decline or charge a fee.</span>
            </label>
            ${errorBox('correction-error')}
            <button type="submit" id="correction-submit" class="${BTN_PRIMARY}">Submit correction request</button>
          </form>
          ${resultBox('correction-result')}
        </div>

        <aside class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Submitted requests</h2>
          <ul id="correction-list" class="space-y-2 text-xs">
            ${record.corrections.length ? record.corrections.map(c => `
              <li class="rounded-xl border border-brand-border bg-brand-canvas p-3">
                <p class="font-semibold text-brand-black">${escapeHtml(c.id)} · ${escapeHtml(c.field)}</p>
                <p class="text-brand-muted">${escapeHtml(c.value)}</p>
                <p class="text-[11px] text-amber-700 font-semibold mt-1">${escapeHtml(c.status.replace('_', ' '))}</p>
              </li>
            `).join('') : '<li id="correction-empty" class="text-brand-muted">No correction requests submitted.</li>'}
          </ul>
          <p class="text-[11px] text-brand-muted mt-3">A correction is applied only after the airline approves it. No ticket is reissued in this preview.</p>
        </aside>
      </div>
      ${previewNote('Correction requests are recorded locally. No airline, GDS or ticketing system is contacted and no ticket is reissued.')}
    `;
  }

  private blockedNotice(title: string, body: string): string {
    return `
      <div class="rounded-2xl border border-brand-border bg-brand-subtle p-6" role="note">
        <h2 class="font-heading text-lg font-semibold text-brand-black">${escapeHtml(title)}</h2>
        <p class="text-sm text-brand-muted mt-2">${escapeHtml(body)}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <a href="/bookings/${escapeHtml(this.reference)}" class="${BTN_GHOST} inline-flex items-center">Back to booking details</a>
          <a href="/bookings/${escapeHtml(this.reference)}/support" class="${BTN_GHOST} inline-flex items-center">Contact support</a>
        </div>
      </div>
    `;
  }

  private stageContent(record: DossierRecord): string {
    switch (this.stage) {
      case 'ticket': return this.ticketContent(record);
      case 'receipt': return this.receiptContent(record);
      case 'ticketing': return this.ticketingContent(record);
      case 'travel-prep': return this.travelPrepContent(record);
      case 'extras': return this.extrasContent(record);
      case 'correction': return this.correctionContent(record);
      default: return this.detailsContent(record);
    }
  }

  /* ----------------------------------------------------------------- events */

  private wire(record: DossierRecord): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;

    const showError = (id: string, message: string) => {
      const el = $<HTMLElement>('#' + id);
      if (!el) return;
      el.textContent = message;
      el.classList.remove('hidden');
    };
    const hideError = (id: string) => {
      const el = $<HTMLElement>('#' + id);
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
    };
    const showResult = (id: string, message: string) => {
      const el = $<HTMLElement>('#' + id);
      if (!el) return;
      el.textContent = message;
      el.classList.remove('hidden');
    };
    const markInvalid = (el: HTMLElement | null, invalid: boolean) => {
      if (!el) return;
      el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      el.classList.toggle('border-red-400', invalid);
    };
    const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

    /* --- resend confirmation (available on every stage) */
    const resendPanel = $('#dossier-resend-panel');
    $('#dossier-resend-toggle')?.addEventListener('click', () => {
      resendPanel?.classList.toggle('hidden');
      $<HTMLInputElement>('#dossier-resend-email')?.focus();
    });
    $('#dossier-resend-cancel')?.addEventListener('click', () => {
      hideError('dossier-resend-error');
      resendPanel?.classList.add('hidden');
    });
    $('#dossier-resend-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = $<HTMLInputElement>('#dossier-resend-email');
      hideError('dossier-resend-error');
      markInvalid(input, false);
      if (!input || !emailOk(input.value)) {
        markInvalid(input, true);
        showError('dossier-resend-error', 'Enter a valid email address before resending the confirmation.');
        return;
      }
      const next = { ...record, lastResentAt: 'Preview session' };
      writeDossier(next);
      showResult('dossier-resend-result', `Confirmation queued to ${input.value.trim()} (preview). No email was actually sent.`);
    });

    /* --- copy PNR (27) */
    $('#dossier-copy-pnr')?.addEventListener('click', () => {
      const pnrEl = $('#dossier-pnr');
      const status = $('#dossier-copy-status');
      if (!pnrEl || !record.pnr) return;
      try {
        const range = document.createRange();
        range.selectNodeContents(pnrEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        if (status) status.textContent = `PNR ${record.pnr} selected. Press Ctrl+C or ⌘C to copy.`;
      } catch {
        if (status) status.textContent = `PNR ${record.pnr}. Select the text above to copy it.`;
      }
    });

    if (this.stage === 'ticket') {
      const doc = $('#ticket-document');
      $('#ticket-show-document')?.addEventListener('click', () => doc?.classList.remove('hidden'));
      $('#ticket-hide-document')?.addEventListener('click', () => doc?.classList.add('hidden'));
      $('#ticket-email-form')?.addEventListener('submit', event => {
        event.preventDefault();
        const input = $<HTMLInputElement>('#ticket-email');
        hideError('ticket-email-error');
        markInvalid(input, false);
        if (!input || !emailOk(input.value)) {
          markInvalid(input, true);
          showError('ticket-email-error', 'Enter a valid email address before queueing the e-ticket.');
          return;
        }
        showResult('ticket-email-result', `E-ticket queued to ${input.value.trim()} (preview). No email was actually sent.`);
      });
    }

    if (this.stage === 'receipt') {
      const invoice = $('#receipt-invoice-document');
      $('#receipt-show-invoice')?.addEventListener('click', () => invoice?.classList.remove('hidden'));
      $('#receipt-hide-invoice')?.addEventListener('click', () => invoice?.classList.add('hidden'));
      $('#receipt-email-form')?.addEventListener('submit', event => {
        event.preventDefault();
        const input = $<HTMLInputElement>('#receipt-email');
        hideError('receipt-email-error');
        markInvalid(input, false);
        if (!input || !emailOk(input.value)) {
          markInvalid(input, true);
          showError('receipt-email-error', 'Enter a valid email address before queueing the receipt.');
          return;
        }
        showResult('receipt-email-result', `Receipt queued to ${input.value.trim()} (preview). No email was actually sent.`);
      });
    }

    if (this.stage === 'ticketing') {
      $('#ticketing-refresh')?.addEventListener('click', () => {
        hideError('ticketing-error');
        const next: DossierRecord = {
          ...record,
          status: 'ticketed',
          pnr: '6J8K2Q',
          issuedAt: 'Preview ticketing run',
          passengers: record.passengers.map((p, i) => ({ ...p, ticketNumber: `VCT-TKT-${record.reference.slice(-4)}-${String(i + 1).padStart(2, '0')}` })),
          history: [...record.history, { at: 'Preview ticketing run', label: 'Airline ticketing completed and ticket numbers issued (preview)' }],
        };
        writeDossier(next);
        pendingMessage = { id: 'ticketing-result', text: `Ticketing completed in this preview. PNR ${next.pnr} and ${next.passengers.length} ticket number(s) issued.` };
        this.render(this.mount!, record.reference, 'ticketing');
      });

      $('#ticketing-cancel-hold')?.addEventListener('click', () => {
        hideError('ticketing-error');
        const confirm = $<HTMLInputElement>('#ticketing-confirm');
        markInvalid(confirm, false);
        if (!confirm?.checked) {
          markInvalid(confirm, true);
          showError('ticketing-error', 'Confirm that you understand cancelling the hold ends this booking.');
          return;
        }
        const next: DossierRecord = {
          ...record,
          status: 'cancelled',
          paymentStatus: 'refunded',
          holdExpiresAt: '',
          history: [...record.history, { at: 'Preview hold cancellation', label: `Seat hold cancelled (preview) — refund of ${money(record.total)} queued for manual finance action` }],
        };
        writeDossier(next);
        pendingMessage = {
          id: 'ticketing-result',
          text: `Hold cancelled (preview). A refund of ${money(record.total)} is queued for manual finance action — no money has moved.`,
        };
        this.render(this.mount!, record.reference, 'ticketing');
      });
    }

    if (this.stage === 'travel-prep') {
      const paintProgress = () => {
        const boxes = Array.from(this.mount!.querySelectorAll<HTMLInputElement>('[data-prep-item]'));
        const complete = boxes.filter(b => b.checked).length;
        const progress = $('#prep-progress');
        if (progress) progress.textContent = `${complete} of ${boxes.length} complete`;
      };
      this.mount.querySelectorAll<HTMLInputElement>('[data-prep-item]').forEach(box => {
        box.addEventListener('change', () => {
          const key = box.getAttribute('data-prep-item') || '';
          const next: DossierRecord = { ...record, checklist: { ...record.checklist, [key]: box.checked } };
          writeDossier(next);
          paintProgress();
        });
      });
      $('#prep-reminder')?.addEventListener('change', event => {
        const checked = (event.target as HTMLInputElement).checked;
        writeDossier({ ...record, checkInReminder: checked });
        showResult('prep-result', checked
          ? 'Reminder saved for this session (preview). No message will actually be sent.'
          : 'Check-in reminder turned off for this session.');
      });
      $('#prep-checkin')?.addEventListener('click', () => {
        hideError('prep-error');
        const boxes = Array.from(this.mount!.querySelectorAll<HTMLInputElement>('[data-prep-item]'));
        const firstUnchecked = boxes.find(b => !b.checked);
        if (firstUnchecked) {
          markInvalid(firstUnchecked, true);
          showError('prep-error', 'Complete every pre-travel check before starting check-in.');
          return;
        }
        const leg = record.legs[0];
        showResult('prep-result', `Online check-in is not open yet. It opens 48 hours before departure on ${leg?.departAt || 'the departure date'} (preview). Vacatina will not check you in automatically.`);
      });
    }

    if (this.stage === 'extras') {
      const baggage = $<HTMLInputElement>('#extras-baggage');
      const seat = $<HTMLSelectElement>('#extras-seat');
      const meal = $<HTMLSelectElement>('#extras-meal');
      const insurance = $<HTMLInputElement>('#extras-insurance');
      const paintTotal = () => {
        const units = Number(baggage?.value || 0);
        const total = (Number.isFinite(units) ? units : 0) * BAGGAGE_UNIT
          + (SEAT_PRICES[seat?.value || 'none'] || 0)
          + (MEAL_PRICES[meal?.value || 'none'] || 0)
          + (insurance?.checked ? INSURANCE_PRICE : 0);
        const el = $('#extras-total');
        if (el) el.textContent = money(total);
      };
      [baggage, seat, meal, insurance].forEach(el => {
        el?.addEventListener('input', paintTotal);
        el?.addEventListener('change', paintTotal);
      });
      $('#extras-form')?.addEventListener('submit', event => {
        event.preventDefault();
        hideError('extras-error');
        markInvalid(baggage, false);
        const units = Number(baggage?.value || 0);
        if (!Number.isInteger(units) || units < 0 || units > 4) {
          markInvalid(baggage, true);
          showError('extras-error', 'Extra baggage must be a whole number between 0 and 4 units.');
          return;
        }
        const next: DossierRecord = {
          ...record,
          extras: {
            baggageUnits: units,
            seat: seat?.value || 'none',
            meal: meal?.value || 'none',
            insurance: !!insurance?.checked,
            savedAt: 'Preview session',
          },
        };
        writeDossier(next);
        const total = units * BAGGAGE_UNIT + (SEAT_PRICES[next.extras.seat] || 0) + (MEAL_PRICES[next.extras.meal] || 0) + (next.extras.insurance ? INSURANCE_PRICE : 0);
        pendingMessage = {
          id: 'extras-result',
          text: `Extras saved for ${record.reference} (preview). ${money(total)} will be collected by the airline at the airport or on its website — nothing was charged now.`,
        };
        this.render(this.mount!, record.reference, 'extras');
      });
      $('#extras-clear')?.addEventListener('click', () => {
        hideError('extras-error');
        writeDossier({ ...record, extras: { baggageUnits: 0, seat: 'none', meal: 'none', insurance: false, savedAt: 'Preview session' } });
        pendingMessage = { id: 'extras-result', text: 'All extras removed from this booking (preview). Nothing was charged or refunded.' };
        this.render(this.mount!, record.reference, 'extras');
      });
    }

    if (this.stage === 'correction') {
      $('#correction-form')?.addEventListener('submit', event => {
        event.preventDefault();
        hideError('correction-error');
        const passenger = $<HTMLSelectElement>('#correction-passenger');
        const field = $<HTMLSelectElement>('#correction-field');
        const value = $<HTMLInputElement>('#correction-value');
        const reason = $<HTMLTextAreaElement>('#correction-reason');
        const consent = $<HTMLInputElement>('#correction-consent');
        [value, reason, consent].forEach(el => markInvalid(el, false));

        const fieldValue = field?.value || 'name';
        const raw = (value?.value || '').trim();
        if (raw.length < 2 || raw.length > 40) {
          markInvalid(value, true);
          showError('correction-error', 'Enter the corrected value using 2 to 40 characters.');
          return;
        }
        if (fieldValue === 'dob' && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw)))) {
          markInvalid(value, true);
          showError('correction-error', 'Enter the corrected date of birth as YYYY-MM-DD.');
          return;
        }
        if ((reason?.value || '').trim().length < 8) {
          markInvalid(reason, true);
          showError('correction-error', 'Record a reason of at least 8 characters for the airline.');
          return;
        }
        if (!consent?.checked) {
          markInvalid(consent, true);
          showError('correction-error', 'Confirm that you understand the airline must approve this correction.');
          return;
        }
        const pax = record.passengers.find(p => p.id === passenger?.value) || record.passengers[0];
        const currentValue = fieldValue === 'name' ? `${pax.firstName} ${pax.lastName}` : fieldValue === 'title' ? pax.title : pax.dateOfBirth;
        if (raw.toLowerCase() === currentValue.toLowerCase()) {
          markInvalid(value, true);
          showError('correction-error', 'The corrected value is identical to the current value.');
          return;
        }
        const id = `VCT-COR-${String(record.corrections.length + 1).padStart(4, '0')}`;
        const correction: DossierCorrection = {
          id,
          passengerId: pax.id,
          field: fieldValue as DossierCorrection['field'],
          value: raw,
          reason: (reason?.value || '').trim(),
          status: 'pending_review',
          submittedAt: 'Preview session',
        };
        writeDossier({ ...record, corrections: [...record.corrections, correction] });
        pendingMessage = {
          id: 'correction-result',
          text: `Correction request ${id} recorded (preview) for ${pax.firstName} ${pax.lastName}. No ticket has been reissued; airline approval is required.`,
        };
        this.render(this.mount!, record.reference, 'correction');
      });
    }

    // Re-apply a confirmation that was destroyed by the re-render it triggered.
    if (pendingMessage) {
      const announcement = pendingMessage;
      pendingMessage = null;
      showResult(announcement.id, announcement.text);
    }
  }

  private wireUnknown(): void {
    /* The unknown-booking screen has no interactive controls beyond links. */
  }
}

/* ---------------------------------------------------------- 25 guest lookup */

export class FlightsGuestLookupView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    mount.innerHTML = `
      <section class="flights-guest-lookup max-w-3xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="lookup-heading">
        <header class="mb-6">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Screen 25 · Guest booking lookup</p>
          <h1 id="lookup-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Guest Booking Lookup</h1>
          <p class="text-sm text-brand-muted mt-2">Retrieve a booking with the Vacatina reference and the lead passenger surname. No account is required.</p>
        </header>

        <form id="lookup-form" class="rounded-2xl border border-brand-border bg-white p-5 sm:p-6" novalidate>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="lookup-reference" class="block text-xs font-bold uppercase text-brand-muted">Booking reference</label>
              <input id="lookup-reference" type="text" placeholder="VCT-2026-0001" autocomplete="off" aria-describedby="lookup-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary mt-1" />
            </div>
            <div>
              <label for="lookup-surname" class="block text-xs font-bold uppercase text-brand-muted">Lead passenger surname</label>
              <input id="lookup-surname" type="text" placeholder="Silva" autocomplete="off" aria-describedby="lookup-error" class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary mt-1" />
            </div>
          </div>
          <p id="lookup-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
          <div class="flex flex-wrap gap-3 mt-5">
            <button type="submit" id="lookup-submit" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">Find my booking</button>
            <button type="button" id="lookup-demo" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Use demo booking</button>
          </div>
        </form>

        <div class="mt-6 rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Demo bookings in this session</h2>
          <ul class="space-y-2 text-sm">
            ${demoBookingSummaries().map(b => `
              <li class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-border bg-brand-canvas p-3" data-demo-booking="${b.reference}">
                <span><strong class="text-brand-black">${escapeHtml(b.reference)}</strong> <span class="text-brand-muted">· ${escapeHtml(b.route)} · ${escapeHtml(b.surname)}</span></span>
                <span class="text-xs font-semibold text-brand-muted">${escapeHtml(STATUS_LABEL[b.status])}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        ${previewNote('This lookup only reads deterministic demo bookings stored in this browser session. Real bookings require an authenticated server lookup.')}
      </section>
    `;
    this.wire();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private wire(): void {
    if (!this.mount) return;
    const $ = <T extends Element = HTMLElement>(sel: string): T | null => this.mount!.querySelector(sel) as T | null;
    const form = $<HTMLFormElement>('#lookup-form');
    const referenceInput = $<HTMLInputElement>('#lookup-reference');
    const surnameInput = $<HTMLInputElement>('#lookup-surname');
    const error = $('#lookup-error');
    const showError = (message: string, target: HTMLElement | null) => {
      if (error) {
        error.textContent = message;
        error.classList.remove('hidden');
      }
      if (target) {
        target.setAttribute('aria-invalid', 'true');
        target.classList.add('border-red-400');
      }
    };
    const clearError = () => {
      if (error) {
        error.textContent = '';
        error.classList.add('hidden');
      }
      [referenceInput, surnameInput].forEach(el => {
        el?.setAttribute('aria-invalid', 'false');
        el?.classList.remove('border-red-400');
      });
    };

    form?.addEventListener('submit', event => {
      event.preventDefault();
      clearError();
      const reference = (referenceInput?.value || '').trim().toUpperCase();
      const surname = (surnameInput?.value || '').trim();
      if (!/^VCT-\d{4}-\d{4}$/.test(reference)) {
        showError('Enter the booking reference in the format VCT-2026-0000.', referenceInput);
        return;
      }
      if (surname.length < 2) {
        showError('Enter the lead passenger surname (at least 2 characters).', surnameInput);
        return;
      }
      const summary = demoBookingSummaries().find(b => b.reference === reference);
      if (!summary) {
        showError(`No booking ${reference} was found in this demo session.`, referenceInput);
        return;
      }
      if (summary.surname.toLowerCase() !== surname.toLowerCase()) {
        showError('The surname does not match the lead passenger on this booking.', surnameInput);
        return;
      }
      (window as any).__VACATINA_ROUTER__?.navigateTo?.(`/bookings/${reference}`);
    });

    $('#lookup-demo')?.addEventListener('click', () => {
      clearError();
      if (referenceInput) referenceInput.value = 'VCT-2026-0001';
      if (surnameInput) surnameInput.value = 'Silva';
      (window as any).__VACATINA_ROUTER__?.navigateTo?.('/bookings/VCT-2026-0001');
    });
  }
}

/* ------------------------------------------------------------- 26 my trips */

export class FlightsTripsView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    const rows = demoBookingSummaries();
    mount.innerHTML = `
      <section class="flights-trips max-w-5xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="trips-heading">
        <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Screen 26 · My trips</p>
            <h1 id="trips-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">My Trips &amp; Bookings</h1>
            <p class="text-sm text-brand-muted mt-2">Every flight booking held in this session, with its live ticketing status.</p>
          </div>
          <a href="/flights/manage" class="min-h-[44px] inline-flex items-center px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors">Guest lookup</a>
        </header>

        <ul class="space-y-3">
          ${rows.map(b => `
            <li class="rounded-2xl border border-brand-border bg-white p-5" data-trip-row="${b.reference}">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-heading text-lg font-semibold text-brand-black">${escapeHtml(b.route)}</p>
                  <p class="text-xs text-brand-muted mt-1">${escapeHtml(b.reference)} · ${escapeHtml(b.surname)}</p>
                </div>
                <div class="text-right">
                  <span class="inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold ${STATUS_TONE[b.status]}">${STATUS_LABEL[b.status]}</span>
                  <p class="text-sm font-bold text-brand-primary tabular-nums mt-2">${money(b.total)}</p>
                </div>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <a href="/bookings/${escapeHtml(b.reference)}" class="min-h-[44px] inline-flex items-center px-4 rounded-xl bg-brand-primary text-white font-semibold text-xs hover:opacity-90 transition-opacity">Open booking</a>
                <a href="/bookings/${escapeHtml(b.reference)}/ticket" class="min-h-[44px] inline-flex items-center px-4 rounded-xl border border-brand-border text-brand-black font-semibold text-xs hover:bg-brand-subtle transition-colors">E-ticket</a>
                <a href="/bookings/${escapeHtml(b.reference)}/receipt" class="min-h-[44px] inline-flex items-center px-4 rounded-xl border border-brand-border text-brand-black font-semibold text-xs hover:bg-brand-subtle transition-colors">Receipt</a>
              </div>
            </li>
          `).join('')}
        </ul>

        ${previewNote('This list is a deterministic demo fixture available only on a local build. A real account requires an authenticated, server-authorised booking lookup.')}
      </section>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* --------------------------------------------------------------- utilities */

function recordRef(view: FlightsBookingDossierView): string {
  // Kept as a helper so templates never interpolate an unescaped reference.
  return encodeURIComponent((view as any).reference || 'VCT-2026-0001');
}
