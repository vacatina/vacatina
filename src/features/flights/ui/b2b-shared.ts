/* ============================================================================
 * Vacatina B2B Flights — shared frontend helpers
 *
 * Deterministic demo fixtures for the agent portal. The agent identity is an
 * isolated demo/test fixture: it never authenticates a real user, never grants
 * production access and never mutates supplier or financial systems.
 * ============================================================================ */

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}

export function money(value: number): string {
  return `LKR ${Number(value || 0).toLocaleString('en-US')}`;
}

export function readStore<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(`vacatina:b2b:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(`vacatina:b2b:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable — flow stays in-page, never fabricates success */
  }
}

export function clearStore(key: string): void {
  try {
    window.sessionStorage.removeItem(`vacatina:b2b:${key}`);
  } catch {
    /* ignore */
  }
}

export interface B2BOffer {
  id: string;
  flight: string;
  airline: string;
  route: string;
  depart: string;
  arrive: string;
  netFare: number;
  seats: number;
  fareBasis: string;
}

export interface B2BSelection {
  offer: B2BOffer;
  passengers: number;
  markupPercent: number;
}

export interface B2BTraveller {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
}

export const B2B_OFFERS: B2BOffer[] = [
  { id: 'B2B-UL505', flight: 'UL 505', airline: 'SriLankan Airlines', route: 'CMB → DXB', depart: '18 Nov 2026, 08:20', arrive: '18 Nov 2026, 11:35', netFare: 96500, seats: 9, fareBasis: 'YNET' },
  { id: 'B2B-EK651', flight: 'EK 651', airline: 'Emirates', route: 'CMB → DXB', depart: '18 Nov 2026, 19:45', arrive: '19 Nov 2026, 00:55', netFare: 104200, seats: 6, fareBasis: 'MNET' },
  { id: 'B2B-QR665', flight: 'QR 665', airline: 'Qatar Airways', route: 'CMB → DXB', depart: '18 Nov 2026, 04:10', arrive: '18 Nov 2026, 09:40', netFare: 89200, seats: 4, fareBasis: 'QNET' },
];

export const AGENT_FIXTURE = {
  agency: 'Ceylon Voyages (demo fixture)',
  agentId: 'AGT-DEMO-0042',
  iata: '08-3 1234 5',
  creditLimit: 750000,
  creditUsed: 248500,
};

export function agentBanner(): string {
  return `
    <div class="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 mb-6" role="note" data-agent-fixture="AGT-DEMO-0042">
      <p class="text-xs font-bold uppercase tracking-wide text-brand-primary">Isolated demo agent session</p>
      <p class="text-xs text-brand-muted mt-1">
        ${escapeHtml(AGENT_FIXTURE.agency)} · ${escapeHtml(AGENT_FIXTURE.agentId)} · IATA ${escapeHtml(AGENT_FIXTURE.iata)}.
        This is a test-only fixture for UI acceptance. Production requires authenticated agent identity and server-side permission checks.
      </p>
    </div>
  `;
}

export function previewNote(text = 'No supplier booking, ticketing or payment is performed in this preview.'): string {
  return `
    <div class="rounded-2xl border border-brand-border bg-brand-subtle p-4 mt-6" role="note">
      <p class="text-xs text-brand-muted leading-relaxed"><strong class="text-brand-black">Frontend preview:</strong> ${escapeHtml(text)}</p>
    </div>
  `;
}

export function markInvalid(el: HTMLElement | null, invalid: boolean): void {
  if (!el) return;
  el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  el.classList.toggle('border-red-400', invalid);
}

export function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

export function hideError(el: HTMLElement | null): void {
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

export function navigate(path: string): void {
  const router = (window as any).__VACATINA_ROUTER__;
  if (router?.navigateTo) router.navigateTo(path);
}
