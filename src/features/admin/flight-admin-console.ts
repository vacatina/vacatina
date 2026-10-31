/* ============================================================================
 * Vacatina Flight Admin — Operations Console (Screens 58–64)
 *
 * 58 /admin/suppliers      Supplier configuration & health
 * 59 /admin/inventory      Manual inventory CMS
 * 60 /admin/pricing        Pricing / margin rules
 * 61 /admin/fulfilment     Fulfilment & ticketing queue
 * 62 /admin/after-sales    Exchanges / cancel / refund desk
 * 63 /admin/disruptions    Disruption queue
 * 64 /admin/reconciliation Reconciliation & audit
 *
 * SECURITY MODEL
 * Real operations access is server-authorised (Clerk identity + API permission
 * checks). This module is an ISOLATED DEMO FIXTURE for UI acceptance only. It is
 * never enabled on a hosted origin and never replaces production auth: the
 * fixture can only be entered explicitly from a local (127.0.0.1 / localhost)
 * non-public-demo build, and every mutation stays in sessionStorage.
 * ============================================================================ */

export const DEMO_OPS_KEY = 'vacatina:admin:demoOpsRole';
export const DEMO_OPS_ROLE = 'OPS_DEMO_FIXTURE';

const STORE = 'vacatina:admin:';

/* ------------------------------------------------------------------ helpers */

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]!));
}

function money(value: number): string {
  return `LKR ${Number(value || 0).toLocaleString('en-US')}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(STORE + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(STORE + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — UI still works in-page, nothing is fabricated */
  }
}

export function demoOpsLocalAvailable(): boolean {
  const w = window as any;
  let gallery = false;
  try { gallery = window.sessionStorage.getItem('vacatina:gallery') === '1'; } catch { gallery = false; }
  if (w.__VACATINA_PUBLIC_DEMO__ && !gallery) return false;
  const host = window.location.hostname;
  return gallery || host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '';
}

export function demoOpsEnabled(): boolean {
  if (!demoOpsLocalAvailable()) return false;
  try {
    return window.sessionStorage.getItem(DEMO_OPS_KEY) === DEMO_OPS_ROLE;
  } catch {
    return false;
  }
}

export function enableDemoOpsFixture(): void {
  try {
    window.sessionStorage.setItem(DEMO_OPS_KEY, DEMO_OPS_ROLE);
  } catch {
    /* ignore */
  }
}

export function disableDemoOpsFixture(): void {
  try {
    window.sessionStorage.removeItem(DEMO_OPS_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------- types */

interface Supplier {
  id: string; code: string; name: string; region: string; endpoint: string;
  active: boolean; health: 'unknown' | 'healthy' | 'degraded' | 'down'; lastChecked: string;
}

interface InventoryLot {
  id: string; flight: string; route: string; date: string; seats: number;
  netCost: number; sellPrice: number; status: 'draft' | 'published' | 'stopped';
}

interface PricingRule {
  id: string; product: string; type: 'percent' | 'fixed'; value: number; active: boolean;
}

interface FulfilmentItem {
  id: string; reference: string; passenger: string; route: string;
  status: 'queued' | 'assigned' | 'ticketed' | 'rejected'; pnr: string; assignee: string; reason: string;
}

interface AfterSalesCase {
  id: string; reference: string; type: 'exchange' | 'cancel' | 'refund';
  amount: number; status: 'pending' | 'approved' | 'rejected'; note: string;
}

interface DisruptionCase {
  id: string; flight: string; route: string; date: string; impact: string;
  status: 'open' | 'notified' | 'closed'; resolution: string;
}

interface LedgerRow {
  id: string; reference: string; supplier: string; expected: number; actual: number;
  status: 'matched' | 'mismatch' | 'resolved'; note: string;
}

interface AuditEntry { at: string; actor: string; action: string; }

/* --------------------------------------------------------------- seed data */

function seedSuppliers(): Supplier[] {
  return [
    { id: 'SUP-01', code: 'DUFFEL', name: 'Duffel Airways Network', region: 'Global', endpoint: 'https://api.duffel.example/v2', active: true, health: 'healthy', lastChecked: 'Preview baseline' },
    { id: 'SUP-02', code: 'TBO', name: 'TBO Holidays Consolidator', region: 'South Asia', endpoint: 'https://api.tbo.example/flights', active: true, health: 'degraded', lastChecked: 'Preview baseline' },
    { id: 'SUP-03', code: 'MYST', name: 'Mystifly Consolidator', region: 'Middle East', endpoint: 'https://api.mystifly.example/v1', active: false, health: 'unknown', lastChecked: 'Never' },
  ];
}

function seedInventory(): InventoryLot[] {
  return [
    { id: 'INV-01', flight: 'UL 505', route: 'CMB → DXB', date: '2026-11-18', seats: 9, netCost: 96500, sellPrice: 108100, status: 'published' },
    { id: 'INV-02', flight: 'EK 651', route: 'CMB → DXB', date: '2026-11-18', seats: 6, netCost: 104200, sellPrice: 116700, status: 'published' },
    { id: 'INV-03', flight: 'QR 665', route: 'CMB → DOH', date: '2026-11-20', seats: 4, netCost: 89200, sellPrice: 99900, status: 'draft' },
  ];
}

function seedPricing(): PricingRule[] {
  return [
    { id: 'PR-01', product: 'flights', type: 'percent', value: 12, active: true },
    { id: 'PR-02', product: 'flights', type: 'fixed', value: 3500, active: true },
  ];
}

function seedFulfilment(): FulfilmentItem[] {
  return [
    { id: 'FUL-01', reference: 'VCT-B2B-0001', passenger: 'Nuwan Perera', route: 'CMB → DXB', status: 'queued', pnr: '', assignee: '', reason: '' },
    { id: 'FUL-02', reference: 'VCT-2026-0001', passenger: 'Amara Silva', route: 'CMB → MLE', status: 'assigned', pnr: '', assignee: 'ops.demo', reason: '' },
  ];
}

function seedAfterSales(): AfterSalesCase[] {
  return [
    { id: 'AS-01', reference: 'VCT-2026-0001', type: 'refund', amount: 84000, status: 'pending', note: '' },
    { id: 'AS-02', reference: 'VCT-B2B-0001', type: 'exchange', amount: 15000, status: 'pending', note: '' },
  ];
}

function seedDisruptions(): DisruptionCase[] {
  return [
    { id: 'DIS-01', flight: 'UL 505', route: 'CMB → DXB', date: '2026-11-18', impact: 'Schedule change +65 minutes', status: 'open', resolution: '' },
    { id: 'DIS-02', flight: 'QR 665', route: 'CMB → DOH', date: '2026-11-20', impact: 'Aircraft downgrade — seat revalidation', status: 'open', resolution: '' },
  ];
}

function seedLedger(): LedgerRow[] {
  return [
    { id: 'LED-01', reference: 'VCT-B2B-0001', supplier: 'SriLankan Airlines', expected: 193000, actual: 193000, status: 'matched', note: '' },
    { id: 'LED-02', reference: 'VCT-2026-0001', supplier: 'Maldivian', expected: 84000, actual: 82500, status: 'mismatch', note: '' },
  ];
}

/**
 * Materialises the deterministic fixture state on first entry so the console
 * footer ("stored under vacatina:admin:*") is literally true, and so reloading
 * an area always shows the same baseline. Existing values are never overwritten.
 */
function seedConsoleState(): void {
  const has = (key: string) => {
    try {
      return window.sessionStorage.getItem(STORE + key) !== null;
    } catch {
      return false;
    }
  };
  if (!has('suppliers')) write('suppliers', seedSuppliers());
  if (!has('inventory')) write('inventory', seedInventory());
  if (!has('pricing')) write('pricing', seedPricing());
  if (!has('fulfilment')) write('fulfilment', seedFulfilment());
  if (!has('after-sales')) write('after-sales', seedAfterSales());
  if (!has('disruptions')) write('disruptions', seedDisruptions());
  if (!has('ledger')) write('ledger', seedLedger());
  if (!has('audit')) write('audit', []);
}

/* ------------------------------------------------------------ area metadata */

type Area = 'suppliers' | 'inventory' | 'pricing' | 'fulfilment' | 'after-sales' | 'disruptions' | 'reconciliation';

const AREAS: { id: Area; screen: string; label: string; route: string }[] = [
  { id: 'suppliers', screen: '58', label: 'Suppliers', route: '/admin/suppliers' },
  { id: 'inventory', screen: '59', label: 'Inventory', route: '/admin/inventory' },
  { id: 'pricing', screen: '60', label: 'Pricing', route: '/admin/pricing' },
  { id: 'fulfilment', screen: '61', label: 'Fulfilment', route: '/admin/fulfilment' },
  { id: 'after-sales', screen: '62', label: 'After-sales', route: '/admin/after-sales' },
  { id: 'disruptions', screen: '63', label: 'Disruptions', route: '/admin/disruptions' },
  { id: 'reconciliation', screen: '64', label: 'Reconciliation', route: '/admin/reconciliation' },
];

const HEADINGS: Record<Area, string> = {
  suppliers: 'Supplier Configuration & Health',
  inventory: 'Manual Inventory CMS',
  pricing: 'Pricing & Margin Rules',
  fulfilment: 'Fulfilment & Ticketing Queue',
  'after-sales': 'Exchanges, Cancellations & Refunds',
  disruptions: 'Disruption Queue',
  reconciliation: 'Reconciliation & Audit',
};

function normalizeArea(raw: string): Area {
  const value = (raw || '').toLowerCase().replace(/\/+$/, '');
  if (value === 'overview' || value === '') return 'suppliers';
  if (value === 'listings') return 'inventory';
  const match = AREAS.find(a => a.id === value);
  return match ? match.id : 'suppliers';
}

/* ---------------------------------------------------------------- utilities */

function auditTrail(): AuditEntry[] {
  return read<AuditEntry[]>('audit', []);
}

function pushAudit(action: string): void {
  const entries = auditTrail();
  entries.unshift({ at: 'Preview timeline', actor: 'ops.demo (fixture)', action });
  write('audit', entries.slice(0, 40));
}

function badge(text: string, tone: 'green' | 'amber' | 'red' | 'neutral' | 'blue'): string {
  const map = {
    green: 'bg-green-50 text-green-800 border-green-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-800 border-red-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    neutral: 'bg-brand-subtle text-brand-muted border-brand-border',
  } as const;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${map[tone]}">${escapeHtml(text)}</span>`;
}

const inputCls = 'mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary';
const btnPrimary = 'min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity';
const btnGhost = 'min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors';
const btnDanger = 'min-h-[44px] px-4 rounded-xl border border-red-300 text-red-700 font-semibold text-sm hover:bg-red-50 transition-colors';
const btnSmall = 'min-h-[44px] px-3 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-subtle transition-colors';

function field(id: string, label: string, input: string): string {
  return `<div><label for="${id}" class="block text-xs font-bold text-brand-muted uppercase">${label}</label>${input}</div>`;
}

/* ------------------------------------------------------------------- shell */

export function flightAdminConsoleHtml(areaRaw: string): string {
  seedConsoleState();
  const area = normalizeArea(areaRaw);
  const tabs = AREAS.map(a => `
    <button type="button" data-admin-area="${a.route}" aria-current="${a.id === area ? 'page' : 'false'}"
      class="min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${a.id === area ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-black border-brand-border hover:bg-brand-subtle'}">
      ${a.screen} · ${escapeHtml(a.label)}
    </button>
  `).join('');

  return `
    <section id="flight-admin-console" data-admin-area="${area}" class="p-5 md:p-7" aria-labelledby="admin-console-heading">
      <div class="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-5" role="note">
        <p class="text-xs font-bold uppercase tracking-wide text-amber-900">Isolated demo fixture · not production access</p>
        <p class="text-xs text-amber-900 mt-1">
          Actor <strong>ops.demo (OPS_DEMO_FIXTURE)</strong>. Real operations require authenticated staff identity and server-side permission checks.
          Every action below is simulated in this browser session and never reaches a supplier, GDS or payment system.
        </p>
      </div>
      <header class="mb-4">
        <p class="text-xs font-bold uppercase tracking-wide text-brand-primary mb-1">Flight operations · screen ${AREAS.find(a => a.id === area)!.screen}</p>
        <h1 id="admin-console-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">${escapeHtml(HEADINGS[area])}</h1>
      </header>
      <nav class="flex flex-wrap gap-2 mb-5" aria-label="Operations areas">${tabs}</nav>
      <div id="admin-console-body" aria-live="polite">${areaContent(area)}</div>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="/flights" class="inline-flex items-center ${btnGhost}">Back to flight search</a>
        <button type="button" id="admin-exit-fixture" class="${btnGhost}">Exit demo fixture</button>
      </div>
      <p class="text-[11px] text-brand-muted mt-4">
        Fixture data is stored under <code>vacatina:admin:*</code> in sessionStorage and cleared when this tab closes.
      </p>
    </section>
  `;
}

/* ------------------------------------------------------------ area content */

function areaContent(area: Area): string {
  switch (area) {
    case 'inventory': return inventoryContent();
    case 'pricing': return pricingContent();
    case 'fulfilment': return fulfilmentContent();
    case 'after-sales': return afterSalesContent();
    case 'disruptions': return disruptionsContent();
    case 'reconciliation': return reconciliationContent();
    default: return suppliersContent();
  }
}

/* 58 — suppliers */
function suppliersContent(): string {
  const rows = read<Supplier[]>('suppliers', seedSuppliers());
  const tone = (h: Supplier['health']) => h === 'healthy' ? 'green' : h === 'degraded' ? 'amber' : h === 'down' ? 'red' : 'neutral';
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5 mb-5">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">Flight suppliers, endpoints and health</caption>
          <thead><tr class="text-left text-xs uppercase text-brand-muted border-b border-brand-border">
            <th scope="col" class="py-2 pr-3">Supplier</th><th scope="col" class="py-2 pr-3">Endpoint</th>
            <th scope="col" class="py-2 pr-3">Status</th><th scope="col" class="py-2 pr-3">Health</th><th scope="col" class="py-2">Actions</th>
          </tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr class="border-b border-brand-border last:border-0" data-supplier-row="${escapeHtml(s.id)}">
                <td class="py-3 pr-3"><strong class="text-brand-black">${escapeHtml(s.code)}</strong><span class="block text-xs text-brand-muted">${escapeHtml(s.name)} · ${escapeHtml(s.region)}</span></td>
                <td class="py-3 pr-3 text-xs text-brand-muted break-all">${escapeHtml(s.endpoint)}</td>
                <td class="py-3 pr-3">${s.active ? badge('Active', 'green') : badge('Inactive', 'neutral')}</td>
                <td class="py-3 pr-3">${badge(s.health, tone(s.health))}<span class="block text-[11px] text-brand-muted mt-1">${escapeHtml(s.lastChecked)}</span></td>
                <td class="py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" data-supplier-check="${escapeHtml(s.id)}" class="${btnSmall}">Run health check</button>
                    <button type="button" data-supplier-toggle="${escapeHtml(s.id)}" class="${btnSmall}">${s.active ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p id="admin-supplier-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div id="admin-supplier-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
      <div class="mt-4">
        ${field('admin-supplier-reason', 'Reason for activation change (required)', `<input id="admin-supplier-reason" type="text" placeholder="e.g. contract renewed for 2026 season" class="${inputCls}" />`)}
        <p class="text-[11px] text-brand-muted mt-1">Supplier state changes require a documented reason and, in production, a second approver.</p>
      </div>
    </div>

    <form id="admin-supplier-form" class="rounded-2xl border border-brand-border bg-white p-5" novalidate>
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Register supplier</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${field('admin-sup-code', 'Supplier code', `<input id="admin-sup-code" type="text" maxlength="8" class="${inputCls}" />`)}
        ${field('admin-sup-name', 'Legal name', `<input id="admin-sup-name" type="text" class="${inputCls}" />`)}
        ${field('admin-sup-region', 'Region', `<select id="admin-sup-region" class="${inputCls}"><option value="Global">Global</option><option value="South Asia">South Asia</option><option value="Middle East">Middle East</option><option value="Europe">Europe</option></select>`)}
        ${field('admin-sup-endpoint', 'API endpoint (https)', `<input id="admin-sup-endpoint" type="url" placeholder="https://" class="${inputCls}" />`)}
      </div>
      <p id="admin-supplier-form-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div class="flex flex-wrap gap-3 mt-4">
        <button type="submit" class="${btnPrimary}">Register supplier (preview)</button>
      </div>
    </form>
  `;
}

/* 59 — inventory */
function inventoryContent(): string {
  const rows = read<InventoryLot[]>('inventory', seedInventory());
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5 mb-5">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">Manual flight inventory lots</caption>
          <thead><tr class="text-left text-xs uppercase text-brand-muted border-b border-brand-border">
            <th scope="col" class="py-2 pr-3">Flight</th><th scope="col" class="py-2 pr-3">Date</th>
            <th scope="col" class="py-2 pr-3">Seats</th><th scope="col" class="py-2 pr-3">Net / Sell</th>
            <th scope="col" class="py-2 pr-3">Status</th><th scope="col" class="py-2">Actions</th>
          </tr></thead>
          <tbody>
            ${rows.map(l => `
              <tr class="border-b border-brand-border last:border-0" data-inventory-row="${escapeHtml(l.id)}">
                <td class="py-3 pr-3"><strong class="text-brand-black">${escapeHtml(l.flight)}</strong><span class="block text-xs text-brand-muted">${escapeHtml(l.route)}</span></td>
                <td class="py-3 pr-3 text-xs text-brand-muted">${escapeHtml(l.date)}</td>
                <td class="py-3 pr-3 tabular-nums text-brand-black">${l.seats}</td>
                <td class="py-3 pr-3 text-xs tabular-nums"><span class="block text-brand-muted">${money(l.netCost)}</span><span class="block text-brand-black font-semibold">${money(l.sellPrice)}</span></td>
                <td class="py-3 pr-3">${l.status === 'published' ? badge('Published', 'green') : l.status === 'stopped' ? badge('Stopped', 'red') : badge('Draft', 'neutral')}</td>
                <td class="py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" data-inv-publish="${escapeHtml(l.id)}" class="${btnSmall}">${l.status === 'published' ? 'Stop sales' : 'Publish'}</button>
                    <button type="button" data-inv-seats="${escapeHtml(l.id)}" class="${btnSmall}">Adjust seats</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p id="admin-inventory-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div id="admin-inventory-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${field('admin-inv-seats-input', 'New seat count (for Adjust seats)', `<input id="admin-inv-seats-input" type="number" min="0" max="99" value="9" class="${inputCls}" />`)}
      </div>
      <p class="text-[11px] text-brand-muted mt-2">Select “Adjust seats” on a lot to apply the seat count above. Zero seats stops sales automatically.</p>
    </div>

    <form id="admin-inventory-form" class="rounded-2xl border border-brand-border bg-white p-5" novalidate>
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Create manual lot</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${field('admin-inv-flight', 'Flight number', `<input id="admin-inv-flight" type="text" placeholder="UL 505" class="${inputCls}" />`)}
        ${field('admin-inv-route', 'Route', `<input id="admin-inv-route" type="text" placeholder="CMB → DXB" class="${inputCls}" />`)}
        ${field('admin-inv-date', 'Travel date', `<input id="admin-inv-date" type="date" class="${inputCls}" />`)}
        ${field('admin-inv-seats', 'Seats', `<input id="admin-inv-seats" type="number" min="1" max="99" class="${inputCls}" />`)}
        ${field('admin-inv-net', 'Net cost (LKR)', `<input id="admin-inv-net" type="number" min="0" step="100" class="${inputCls}" />`)}
        ${field('admin-inv-sell', 'Selling price (LKR)', `<input id="admin-inv-sell" type="number" min="0" step="100" class="${inputCls}" />`)}
      </div>
      <p id="admin-inventory-form-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div class="flex flex-wrap gap-3 mt-4">
        <button type="submit" class="${btnPrimary}">Create draft lot (preview)</button>
      </div>
    </form>
  `;
}

/* 60 — pricing */
function pricingContent(): string {
  const rules = read<PricingRule[]>('pricing', seedPricing());
  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <form id="admin-pricing-form" class="rounded-2xl border border-brand-border bg-white p-5" novalidate>
        <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">New margin rule</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${field('admin-rule-product', 'Product', `<select id="admin-rule-product" class="${inputCls}"><option value="flights">flights</option><option value="hotels">hotels</option><option value="visa">visa</option><option value="packages">packages</option></select>`)}
          ${field('admin-rule-type', 'Rule type', `<select id="admin-rule-type" class="${inputCls}"><option value="percent">Percentage markup</option><option value="fixed">Fixed service fee</option></select>`)}
          ${field('admin-rule-value', 'Value', `<input id="admin-rule-value" type="number" min="0" step="0.5" class="${inputCls}" />`)}
          ${field('admin-rule-active', 'State', `<select id="admin-rule-active" class="${inputCls}"><option value="true">Active</option><option value="false">Draft</option></select>`)}
        </div>
        <p class="text-[11px] text-brand-muted mt-2">Percentage rules accept 0–40%. Fixed fees accept 0–50,000 LKR.</p>
        <p id="admin-pricing-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
        <div class="rounded-xl border border-brand-border bg-brand-canvas p-4 mt-4" role="status" aria-live="polite">
          <p class="text-xs font-bold uppercase text-brand-muted">Live preview on a LKR 96,500 net fare</p>
          <p class="text-sm mt-1">Selling price <strong class="text-brand-primary tabular-nums" id="admin-pricing-preview">LKR 96,500</strong></p>
        </div>
        <div class="flex flex-wrap gap-3 mt-4">
          <button type="submit" class="${btnPrimary}">Save rule (preview)</button>
        </div>
        <div id="admin-pricing-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
      </form>

      <div class="rounded-2xl border border-brand-border bg-white p-5">
        <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Active rules</h2>
        <div id="admin-pricing-list" class="space-y-2">
          ${rules.length ? rules.map(r => `
            <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-brand-border bg-brand-canvas" data-rule-row="${escapeHtml(r.id)}">
              <span class="text-sm"><strong class="text-brand-black">${escapeHtml(r.product)}</strong> · ${r.type === 'percent' ? `${r.value}% markup` : `${money(r.value)} fee`} ${r.active ? badge('Active', 'green') : badge('Draft', 'neutral')}</span>
              <button type="button" data-rule-delete="${escapeHtml(r.id)}" class="${btnSmall}">Delete</button>
            </div>
          `).join('') : '<p class="text-sm text-brand-muted" id="admin-pricing-empty">No margin rules configured.</p>'}
        </div>
      </div>
    </div>
  `;
}

/* 61 — fulfilment */
function fulfilmentContent(): string {
  const items = read<FulfilmentItem[]>('fulfilment', seedFulfilment());
  const tone = (s: FulfilmentItem['status']) => s === 'ticketed' ? 'green' : s === 'rejected' ? 'red' : s === 'assigned' ? 'blue' : 'amber';
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5">
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-1">Ticketing queue</h2>
      <p class="text-xs text-brand-muted mb-4">Assign, issue or reject ticketing work. PNRs must be 6 alphanumeric characters (demo format).</p>
      <div class="space-y-3">
        ${items.map(item => `
          <div class="rounded-xl border border-brand-border bg-brand-canvas p-4" data-fulfil-row="${escapeHtml(item.id)}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-brand-black">${escapeHtml(item.reference)} · ${escapeHtml(item.passenger)}</p>
                <p class="text-xs text-brand-muted">${escapeHtml(item.route)}${item.assignee ? ` · assigned to ${escapeHtml(item.assignee)}` : ''}${item.pnr ? ` · PNR ${escapeHtml(item.pnr)}` : ''}</p>
              </div>
              ${badge(item.status, tone(item.status))}
            </div>
            ${item.status === 'rejected' ? `<p class="text-xs text-red-800 mt-2">Rejected — ${escapeHtml(item.reason || 'no reason recorded')}</p>` : ''}
            ${item.status === 'ticketed' ? `<p class="text-xs text-green-800 mt-2">Ticketed in preview — no airline ticket exists.</p>` : ''}
            ${item.status === 'queued' ? `
              <div class="mt-3"><button type="button" data-fulfil-assign="${escapeHtml(item.id)}" class="${btnSmall}">Assign to me</button></div>
            ` : ''}
            ${item.status === 'assigned' ? `
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="pnr-${escapeHtml(item.id)}" class="block text-[11px] font-bold uppercase text-brand-muted">PNR (6 characters)</label>
                  <input id="pnr-${escapeHtml(item.id)}" type="text" maxlength="6" data-fulfil-pnr="${escapeHtml(item.id)}" class="${inputCls}" />
                </div>
                <div>
                  <label for="rej-${escapeHtml(item.id)}" class="block text-[11px] font-bold uppercase text-brand-muted">Rejection reason</label>
                  <input id="rej-${escapeHtml(item.id)}" type="text" data-fulfil-reason="${escapeHtml(item.id)}" class="${inputCls}" />
                </div>
              </div>
              <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" data-fulfil-ticket="${escapeHtml(item.id)}" class="${btnPrimary}">Issue ticket (preview)</button>
                <button type="button" data-fulfil-reject="${escapeHtml(item.id)}" class="${btnDanger}">Reject</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <p id="admin-fulfilment-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div id="admin-fulfilment-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
    </div>
  `;
}

/* 62 — after-sales */
function afterSalesContent(): string {
  const cases = read<AfterSalesCase[]>('after-sales', seedAfterSales());
  const typeLabel: Record<AfterSalesCase['type'], string> = { exchange: 'Exchange', cancel: 'Cancellation', refund: 'Refund' };
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5">
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-1">After-sales cases</h2>
      <p class="text-xs text-brand-muted mb-4">Refund estimates assume a 15% airline penalty. Approvals require a documented note; production requires separation of duties.</p>
      <div class="space-y-3">
        ${cases.map(c => `
          <div class="rounded-xl border border-brand-border bg-brand-canvas p-4" data-case-row="${escapeHtml(c.id)}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-brand-black">${escapeHtml(c.reference)} · ${escapeHtml(typeLabel[c.type])}</p>
                <p class="text-xs text-brand-muted">Requested ${money(c.amount)} · refund estimate ${money(Math.round(c.amount * 0.85))}</p>
              </div>
              ${c.status === 'approved' ? badge('Approved', 'green') : c.status === 'rejected' ? badge('Rejected', 'red') : badge('Pending', 'amber')}
            </div>
            ${c.note ? `<p class="text-xs text-brand-muted mt-2">Decision note: ${escapeHtml(c.note)}</p>` : ''}
            ${c.status === 'pending' ? `
              <div class="mt-3">
                <label for="note-${escapeHtml(c.id)}" class="block text-[11px] font-bold uppercase text-brand-muted">Decision note (min 8 characters)</label>
                <input id="note-${escapeHtml(c.id)}" type="text" data-case-note="${escapeHtml(c.id)}" class="${inputCls}" />
              </div>
              <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" data-case-approve="${escapeHtml(c.id)}" class="${btnPrimary}">Approve (preview)</button>
                <button type="button" data-case-reject="${escapeHtml(c.id)}" class="${btnDanger}">Reject</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <p id="admin-after-sales-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div id="admin-after-sales-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
    </div>
  `;
}

/* 63 — disruptions */
function disruptionsContent(): string {
  const cases = read<DisruptionCase[]>('disruptions', seedDisruptions());
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5">
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-1">Disruption queue</h2>
      <p class="text-xs text-brand-muted mb-4">Notify affected passengers, record a rebooking option, then close the case. Closing requires a notification first.</p>
      <div class="space-y-3">
        ${cases.map(c => `
          <div class="rounded-xl border border-brand-border bg-brand-canvas p-4" data-disruption-row="${escapeHtml(c.id)}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-brand-black">${escapeHtml(c.flight)} · ${escapeHtml(c.route)}</p>
                <p class="text-xs text-brand-muted">${escapeHtml(c.date)} · ${escapeHtml(c.impact)}</p>
              </div>
              ${c.status === 'closed' ? badge('Closed', 'green') : c.status === 'notified' ? badge('Notified', 'blue') : badge('Open', 'amber')}
            </div>
            ${c.resolution ? `<p class="text-xs text-brand-muted mt-2">Resolution: ${escapeHtml(c.resolution)}</p>` : ''}
            ${c.status !== 'closed' ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label for="rebook-${escapeHtml(c.id)}" class="block text-[11px] font-bold uppercase text-brand-muted">Rebooking option</label>
                  <select id="rebook-${escapeHtml(c.id)}" data-disruption-rebook="${escapeHtml(c.id)}" class="${inputCls}">
                    <option value="">Select an option…</option>
                    <option value="same_day_alt">Same-day alternative carrier</option>
                    <option value="next_day">Next-day protected rebooking</option>
                    <option value="refund">Full refund option</option>
                  </select>
                </div>
                <div>
                  <label for="res-${escapeHtml(c.id)}" class="block text-[11px] font-bold uppercase text-brand-muted">Resolution note</label>
                  <input id="res-${escapeHtml(c.id)}" type="text" data-disruption-note="${escapeHtml(c.id)}" class="${inputCls}" />
                </div>
              </div>
              <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" data-disruption-notify="${escapeHtml(c.id)}" class="${btnSmall}">Notify passengers (preview)</button>
                <button type="button" data-disruption-close="${escapeHtml(c.id)}" class="${btnPrimary}">Close case</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <p id="admin-disruptions-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div id="admin-disruptions-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
    </div>
  `;
}

/* 64 — reconciliation */
function reconciliationContent(): string {
  const rows = read<LedgerRow[]>('ledger', seedLedger());
  const audit = auditTrail();
  const mismatches = rows.filter(r => r.status === 'mismatch').length;
  return `
    <div class="rounded-2xl border border-brand-border bg-white p-5 mb-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 class="font-heading text-lg font-semibold text-brand-black">Supplier settlement ledger</h2>
        <span class="text-xs text-brand-muted">${rows.length} rows · ${mismatches} mismatch(es)</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">Settlement reconciliation rows</caption>
          <thead><tr class="text-left text-xs uppercase text-brand-muted border-b border-brand-border">
            <th scope="col" class="py-2 pr-3">Reference</th><th scope="col" class="py-2 pr-3">Supplier</th>
            <th scope="col" class="py-2 pr-3">Expected</th><th scope="col" class="py-2 pr-3">Actual</th>
            <th scope="col" class="py-2 pr-3">Status</th><th scope="col" class="py-2">Resolve</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr class="border-b border-brand-border last:border-0" data-ledger-row="${escapeHtml(r.id)}">
                <td class="py-3 pr-3 font-semibold text-brand-black">${escapeHtml(r.reference)}</td>
                <td class="py-3 pr-3 text-xs text-brand-muted">${escapeHtml(r.supplier)}</td>
                <td class="py-3 pr-3 tabular-nums">${money(r.expected)}</td>
                <td class="py-3 pr-3 tabular-nums">${money(r.actual)}</td>
                <td class="py-3 pr-3">${r.status === 'matched' ? badge('Matched', 'green') : r.status === 'resolved' ? badge('Resolved', 'blue') : badge('Mismatch', 'red')}</td>
                <td class="py-3">
                  ${r.status === 'mismatch' ? `
                    <div class="flex flex-col sm:flex-row gap-2">
                      <label class="sr-only" for="ledger-note-${escapeHtml(r.id)}">Resolution note for ${escapeHtml(r.reference)}</label>
                      <input id="ledger-note-${escapeHtml(r.id)}" type="text" data-ledger-note="${escapeHtml(r.id)}" placeholder="Resolution note" class="min-h-[44px] px-3 rounded-xl border border-brand-border text-sm" />
                      <button type="button" data-ledger-resolve="${escapeHtml(r.id)}" class="${btnSmall}">Resolve</button>
                    </div>
                  ` : r.note ? `<span class="text-xs text-brand-muted">${escapeHtml(r.note)}</span>` : '<span class="text-xs text-brand-muted">—</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p id="admin-reconciliation-error" role="alert" class="hidden text-xs text-red-700 font-semibold mt-3"></p>
      <div class="flex flex-wrap gap-3 mt-4">
        <button type="button" id="admin-run-reconciliation" class="${btnPrimary}">Run reconciliation (preview)</button>
        <button type="button" id="admin-reset-ledger" class="${btnGhost}">Reset demo ledger</button>
      </div>
      <div id="admin-reconciliation-result" class="hidden mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-semibold" role="status"></div>
    </div>

    <div class="rounded-2xl border border-brand-border bg-white p-5">
      <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Audit trail</h2>
      <ol class="space-y-2 text-sm" id="admin-audit-list">
        ${audit.length ? audit.map(a => `
          <li class="flex flex-wrap gap-2 text-brand-muted"><span class="text-xs whitespace-nowrap">${escapeHtml(a.at)}</span><span class="text-xs">${escapeHtml(a.actor)}</span><span class="text-brand-black">${escapeHtml(a.action)}</span></li>
        `).join('') : '<li class="text-sm text-brand-muted" id="admin-audit-empty">No operations actions recorded in this session.</li>'}
      </ol>
    </div>
  `;
}

/* -------------------------------------------------------------- interaction */

const RESULT_IDS: Record<Area, string> = {
  suppliers: 'admin-supplier-result',
  inventory: 'admin-inventory-result',
  pricing: 'admin-pricing-result',
  fulfilment: 'admin-fulfilment-result',
  'after-sales': 'admin-after-sales-result',
  disruptions: 'admin-disruptions-result',
  reconciliation: 'admin-reconciliation-result',
};

/**
 * A successful action re-renders the area from persisted state, which replaces
 * the DOM node holding its confirmation message. The message is carried across
 * the re-render so the operator always sees the outcome of their action.
 */
let pendingAnnouncement: { id: string; message: string; tone: 'green' | 'amber' } | null = null;

export function wireFlightAdminConsole(root: HTMLElement, areaRaw: string): void {
  const area = normalizeArea(areaRaw);
  const $ = <T extends Element = HTMLElement>(sel: string): T | null => root.querySelector(sel) as T | null;

  const showError = (id: string, message: string) => {
    const el = root.querySelector<HTMLElement>('#' + id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };
  const hideError = (id: string) => {
    const el = root.querySelector<HTMLElement>('#' + id);
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  };
  const showResult = (id: string, message: string, tone: 'green' | 'amber' = 'green') => {
    const el = root.querySelector<HTMLElement>('#' + id);
    if (!el) return;
    el.className = `mt-4 rounded-xl border p-4 text-sm font-semibold ${tone === 'green' ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`;
    el.textContent = message;
    el.classList.remove('hidden');
  };
  const markInvalid = (el: HTMLElement | null, invalid: boolean) => {
    if (!el) return;
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    el.classList.toggle('border-red-400', invalid);
  };
  const rerender = () => {
    const resultId = RESULT_IDS[area];
    const currentResult = root.querySelector<HTMLElement>('#' + resultId);
    if (currentResult && !currentResult.classList.contains('hidden') && (currentResult.textContent || '').trim()) {
      pendingAnnouncement = {
        id: resultId,
        message: currentResult.textContent!.trim(),
        tone: currentResult.className.includes('amber') ? 'amber' : 'green',
      };
    }
    const router = (window as any).__VACATINA_ROUTER__;
    if (router?.navigateTo) {
      const route = AREAS.find(a => a.id === area)!.route;
      router.navigateTo(route);
    }
  };

  // Consume any confirmation carried across the re-render that followed it.
  if (pendingAnnouncement) {
    const announcement = pendingAnnouncement;
    pendingAnnouncement = null;
    if (announcement.id === RESULT_IDS[area]) {
      showResult(announcement.id, announcement.message, announcement.tone);
    }
  }

  /* tabs + exit */
  root.querySelectorAll<HTMLButtonElement>('[data-admin-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.getAttribute('data-admin-area');
      const router = (window as any).__VACATINA_ROUTER__;
      if (route && router?.navigateTo) router.navigateTo(route);
    });
  });
  $<HTMLButtonElement>('#admin-exit-fixture')?.addEventListener('click', () => {
    disableDemoOpsFixture();
    const router = (window as any).__VACATINA_ROUTER__;
    if (router?.navigateTo) router.navigateTo('/admin/suppliers');
    else window.location.reload();
  });

  /* 58 — suppliers */
  if (area === 'suppliers') {
    const rows = read<Supplier[]>('suppliers', seedSuppliers());
    const persist = (next: Supplier[]) => write('suppliers', next);

    root.querySelectorAll<HTMLButtonElement>('[data-supplier-check]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-supplier-check');
        const current = read<Supplier[]>('suppliers', seedSuppliers());
        const target = current.find(s => s.id === id);
        if (!target) return;
        const health: Supplier['health'] = target.endpoint.includes('down')
          ? 'down'
          : target.code === 'TBO' ? 'degraded' : 'healthy';
        const next = current.map(s => s.id === id ? { ...s, health, lastChecked: 'Preview run' } : s);
        persist(next);
        pushAudit(`Health check on ${target.code} → ${health}`);
        showResult('admin-supplier-result', `Health check complete for ${target.code} (preview): ${health}. No live supplier endpoint was contacted.`);
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-supplier-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-supplier-toggle');
        const reason = $<HTMLInputElement>('#admin-supplier-reason');
        const current = read<Supplier[]>('suppliers', seedSuppliers());
        const target = current.find(s => s.id === id);
        if (!target) return;
        markInvalid(reason, false);
        hideError('admin-supplier-error');
        if ((reason?.value || '').trim().length < 8) {
          markInvalid(reason, true);
          showError('admin-supplier-error', 'Enter a reason of at least 8 characters before changing supplier activation.');
          return;
        }
        const next = current.map(s => s.id === id ? { ...s, active: !s.active } : s);
        persist(next);
        pushAudit(`${target.code} ${target.active ? 'deactivated' : 'activated'} — ${reason!.value.trim()}`);
        showResult('admin-supplier-result', `${target.code} is now ${target.active ? 'inactive' : 'active'} (preview). Reason recorded in the audit trail.`);
        if (reason) reason.value = '';
        rerender();
      });
    });

    const form = $<HTMLFormElement>('#admin-supplier-form');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const code = $<HTMLInputElement>('#admin-sup-code');
      const name = $<HTMLInputElement>('#admin-sup-name');
      const endpoint = $<HTMLInputElement>('#admin-sup-endpoint');
      const region = $<HTMLSelectElement>('#admin-sup-region');
      hideError('admin-supplier-form-error');
      [code, name, endpoint].forEach(el => markInvalid(el, false));

      const codeValue = (code?.value || '').trim().toUpperCase();
      const nameValue = (name?.value || '').trim();
      const endpointValue = (endpoint?.value || '').trim();
      const current = read<Supplier[]>('suppliers', seedSuppliers());

      if (!/^[A-Z0-9]{2,8}$/.test(codeValue)) {
        markInvalid(code, true);
        showError('admin-supplier-form-error', 'Supplier code must be 2–8 letters or digits.');
        return;
      }
      if (current.some(s => s.code === codeValue)) {
        markInvalid(code, true);
        showError('admin-supplier-form-error', `Supplier code ${codeValue} already exists.`);
        return;
      }
      if (nameValue.length < 3) {
        markInvalid(name, true);
        showError('admin-supplier-form-error', 'Enter the supplier legal name (at least 3 characters).');
        return;
      }
      if (!/^https:\/\/.+\..+/.test(endpointValue)) {
        markInvalid(endpoint, true);
        showError('admin-supplier-form-error', 'Enter an https API endpoint, e.g. https://api.supplier.example/v1.');
        return;
      }
      const supplier: Supplier = {
        id: `SUP-${String(current.length + 1).padStart(2, '0')}`,
        code: codeValue,
        name: nameValue,
        region: region?.value || 'Global',
        endpoint: endpointValue,
        active: false,
        health: 'unknown',
        lastChecked: 'Never',
      };
      persist([...current, supplier]);
      pushAudit(`Supplier ${codeValue} registered (inactive draft)`);
      showResult('admin-supplier-result', `${codeValue} registered as an inactive draft (preview). Activate it with a documented reason.`);
      form.reset();
      rerender();
    });
    return;
  }

  /* 59 — inventory */
  if (area === 'inventory') {
    const persist = (next: InventoryLot[]) => write('inventory', next);

    root.querySelectorAll<HTMLButtonElement>('[data-inv-publish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-inv-publish');
        const current = read<InventoryLot[]>('inventory', seedInventory());
        const target = current.find(l => l.id === id);
        if (!target) return;
        hideError('admin-inventory-error');
        if (target.status !== 'published' && target.seats < 1) {
          showError('admin-inventory-error', `${target.flight} has no seats available. Adjust the seat count before publishing.`);
          return;
        }
        const nextStatus: InventoryLot['status'] = target.status === 'published' ? 'stopped' : 'published';
        persist(current.map(l => l.id === id ? { ...l, status: nextStatus } : l));
        pushAudit(`${target.flight} ${target.date} → ${nextStatus}`);
        showResult('admin-inventory-result', `${target.flight} on ${target.date} is now ${nextStatus} (preview). No supplier allotment was changed.`);
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-inv-seats]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-inv-seats');
        const seatsInput = $<HTMLInputElement>('#admin-inv-seats-input');
        const current = read<InventoryLot[]>('inventory', seedInventory());
        const target = current.find(l => l.id === id);
        if (!target) return;
        const value = Number(seatsInput?.value ?? '');
        hideError('admin-inventory-error');
        markInvalid(seatsInput, false);
        if (!Number.isInteger(value) || value < 0 || value > 99) {
          markInvalid(seatsInput, true);
          showError('admin-inventory-error', 'Seat count must be a whole number between 0 and 99.');
          return;
        }
        const status: InventoryLot['status'] = value === 0 && target.status === 'published' ? 'stopped' : target.status;
        persist(current.map(l => l.id === id ? { ...l, seats: value, status } : l));
        pushAudit(`${target.flight} ${target.date} seats → ${value}${status === 'stopped' ? ' (sales stopped)' : ''}`);
        showResult('admin-inventory-result', `${target.flight} seat count set to ${value} (preview)${status === 'stopped' ? ' — sales stopped automatically because no seats remain' : ''}.`);
        rerender();
      });
    });

    const form = $<HTMLFormElement>('#admin-inventory-form');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const flight = $<HTMLInputElement>('#admin-inv-flight');
      const route = $<HTMLInputElement>('#admin-inv-route');
      const date = $<HTMLInputElement>('#admin-inv-date');
      const seats = $<HTMLInputElement>('#admin-inv-seats');
      const net = $<HTMLInputElement>('#admin-inv-net');
      const sell = $<HTMLInputElement>('#admin-inv-sell');
      hideError('admin-inventory-form-error');
      [flight, route, date, seats, net, sell].forEach(el => markInvalid(el, false));

      const flightValue = (flight?.value || '').trim().toUpperCase();
      const routeValue = (route?.value || '').trim();
      const dateValue = date?.value || '';
      const seatsValue = Number(seats?.value ?? '');
      const netValue = Number(net?.value ?? '');
      const sellValue = Number(sell?.value ?? '');

      if (!/^[A-Z0-9]{2} ?\d{2,4}$/.test(flightValue)) {
        markInvalid(flight, true);
        showError('admin-inventory-form-error', 'Enter a flight number such as UL 505 or EK651.');
        return;
      }
      if (!routeValue.includes('→')) {
        markInvalid(route, true);
        showError('admin-inventory-form-error', 'Enter the route using the arrow format, e.g. CMB → DXB.');
        return;
      }
      if (!dateValue || dateValue < '2026-10-30') {
        markInvalid(date, true);
        showError('admin-inventory-form-error', 'Select a future travel date.');
        return;
      }
      if (!Number.isInteger(seatsValue) || seatsValue < 1 || seatsValue > 99) {
        markInvalid(seats, true);
        showError('admin-inventory-form-error', 'Seats must be a whole number between 1 and 99.');
        return;
      }
      if (!Number.isFinite(netValue) || netValue <= 0) {
        markInvalid(net, true);
        showError('admin-inventory-form-error', 'Net cost must be greater than zero.');
        return;
      }
      if (!Number.isFinite(sellValue) || sellValue < netValue) {
        markInvalid(sell, true);
        showError('admin-inventory-form-error', `Selling price cannot be below net cost (${money(netValue || 0)}).`);
        return;
      }
      const current = read<InventoryLot[]>('inventory', seedInventory());
      const lot: InventoryLot = {
        id: `INV-${String(current.length + 1).padStart(2, '0')}`,
        flight: flightValue,
        route: routeValue,
        date: dateValue,
        seats: seatsValue,
        netCost: netValue,
        sellPrice: sellValue,
        status: 'draft',
      };
      persist([...current, lot]);
      pushAudit(`Manual lot ${flightValue} ${dateValue} created as draft (${seatsValue} seats)`);
      showResult('admin-inventory-result', `${flightValue} ${dateValue} created as a draft lot (preview). Publish it to make it bookable.`);
      form.reset();
      rerender();
    });
    return;
  }

  /* 60 — pricing */
  if (area === 'pricing') {
    const rules = read<PricingRule[]>('pricing', seedPricing());
    const valueInput = $<HTMLInputElement>('#admin-rule-value');
    const typeInput = $<HTMLSelectElement>('#admin-rule-type');
    const preview = $<HTMLElement>('#admin-pricing-preview');
    const SAMPLE_NET = 96500;

    const paintPreview = () => {
      if (!preview) return;
      const raw = Number(valueInput?.value ?? '');
      const value = Number.isFinite(raw) ? raw : 0;
      const sell = typeInput?.value === 'fixed' ? SAMPLE_NET + value : Math.round(SAMPLE_NET * (1 + value / 100));
      preview.textContent = money(Number.isFinite(sell) ? sell : SAMPLE_NET);
    };
    valueInput?.addEventListener('input', paintPreview);
    typeInput?.addEventListener('change', paintPreview);

    root.querySelectorAll<HTMLButtonElement>('[data-rule-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-rule-delete');
        const current = read<PricingRule[]>('pricing', seedPricing());
        const target = current.find(r => r.id === id);
        if (!target) return;
        write('pricing', current.filter(r => r.id !== id));
        pushAudit(`Margin rule ${id} deleted`);
        showResult('admin-pricing-result', `Rule ${id} deleted from the preview rule set.`, 'amber');
        rerender();
      });
    });

    const form = $<HTMLFormElement>('#admin-pricing-form');
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const product = $<HTMLSelectElement>('#admin-rule-product');
      const type = $<HTMLSelectElement>('#admin-rule-type');
      const value = $<HTMLInputElement>('#admin-rule-value');
      const active = $<HTMLSelectElement>('#admin-rule-active');
      hideError('admin-pricing-error');
      markInvalid(value, false);

      const raw = Number(value?.value ?? '');
      const kind = (type?.value || 'percent') as PricingRule['type'];
      if (!Number.isFinite(raw)) {
        markInvalid(value, true);
        showError('admin-pricing-error', 'Enter a numeric margin value.');
        return;
      }
      if (kind === 'percent' && (raw < 0 || raw > 40)) {
        markInvalid(value, true);
        showError('admin-pricing-error', 'Percentage markup must be between 0% and 40%.');
        return;
      }
      if (kind === 'fixed' && (raw < 0 || raw > 50000)) {
        markInvalid(value, true);
        showError('admin-pricing-error', 'Fixed service fee must be between 0 and 50,000 LKR.');
        return;
      }
      const current = read<PricingRule[]>('pricing', seedPricing());
      const rule: PricingRule = {
        id: `PR-${String(current.length + 1).padStart(2, '0')}`,
        product: product?.value || 'flights',
        type: kind,
        value: raw,
        active: active?.value !== 'false',
      };
      write('pricing', [...current, rule]);
      pushAudit(`Margin rule ${rule.id} saved (${rule.product} ${kind} ${raw})`);
      showResult('admin-pricing-result', `Rule saved (preview): ${rule.product} ${kind === 'percent' ? `${raw}%` : money(raw)}. Nothing was published to a live fare.`);
      form.reset();
      paintPreview();
      rerender();
    });
    return;
  }

  /* 61 — fulfilment */
  if (area === 'fulfilment') {
    const persist = (next: FulfilmentItem[]) => write('fulfilment', next);

    root.querySelectorAll<HTMLButtonElement>('[data-fulfil-assign]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-fulfil-assign');
        const current = read<FulfilmentItem[]>('fulfilment', seedFulfilment());
        const target = current.find(i => i.id === id);
        if (!target) return;
        persist(current.map(i => i.id === id ? { ...i, status: 'assigned', assignee: 'ops.demo' } : i));
        pushAudit(`${target.reference} assigned to ops.demo`);
        showResult('admin-fulfilment-result', `${target.reference} assigned to ops.demo (preview).`);
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-fulfil-ticket]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-fulfil-ticket');
        const pnr = root.querySelector<HTMLInputElement>(`[data-fulfil-pnr="${id}"]`);
        const current = read<FulfilmentItem[]>('fulfilment', seedFulfilment());
        const target = current.find(i => i.id === id);
        if (!target) return;
        hideError('admin-fulfilment-error');
        markInvalid(pnr, false);
        const value = (pnr?.value || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(value)) {
          markInvalid(pnr, true);
          showError('admin-fulfilment-error', 'Enter the 6-character PNR before issuing a ticket.');
          return;
        }
        persist(current.map(i => i.id === id ? { ...i, status: 'ticketed', pnr: value } : i));
        pushAudit(`${target.reference} ticketed in preview with PNR ${value}`);
        showResult('admin-fulfilment-result', `${target.reference} marked ticketed (preview) with PNR ${value}. No airline ticket was issued.`);
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-fulfil-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-fulfil-reject');
        const reason = root.querySelector<HTMLInputElement>(`[data-fulfil-reason="${id}"]`);
        const current = read<FulfilmentItem[]>('fulfilment', seedFulfilment());
        const target = current.find(i => i.id === id);
        if (!target) return;
        hideError('admin-fulfilment-error');
        markInvalid(reason, false);
        const value = (reason?.value || '').trim();
        if (value.length < 8) {
          markInvalid(reason, true);
          showError('admin-fulfilment-error', 'Enter a rejection reason of at least 8 characters.');
          return;
        }
        persist(current.map(i => i.id === id ? { ...i, status: 'rejected', reason: value } : i));
        pushAudit(`${target.reference} ticketing rejected — ${value}`);
        showResult('admin-fulfilment-result', `${target.reference} rejected (preview). Reason recorded in the audit trail.`, 'amber');
        rerender();
      });
    });
    return;
  }

  /* 62 — after-sales */
  if (area === 'after-sales') {
    const decide = (id: string | null, decision: 'approved' | 'rejected') => {
      if (!id) return;
      const note = root.querySelector<HTMLInputElement>(`[data-case-note="${id}"]`);
      const current = read<AfterSalesCase[]>('after-sales', seedAfterSales());
      const target = current.find(c => c.id === id);
      if (!target) return;
      hideError('admin-after-sales-error');
      markInvalid(note, false);
      const value = (note?.value || '').trim();
      if (value.length < 8) {
        markInvalid(note, true);
        showError('admin-after-sales-error', 'Record a decision note of at least 8 characters before deciding this case.');
        return;
      }
      write('after-sales', current.map(c => c.id === id ? { ...c, status: decision, note: value } : c));
      pushAudit(`${target.reference} ${target.type} ${decision} — ${value}`);
      const refund = Math.round(target.amount * 0.85);
      showResult(
        'admin-after-sales-result',
        decision === 'approved'
          ? `${target.reference} ${target.type} approved (preview). ${target.type === 'refund' ? `Refund of ${money(refund)} queued for manual finance action — no money moved.` : 'Airline action required — nothing was transmitted.'}`
          : `${target.reference} ${target.type} rejected (preview). Note recorded.`,
        decision === 'approved' ? 'green' : 'amber',
      );
      rerender();
    };
    root.querySelectorAll<HTMLButtonElement>('[data-case-approve]').forEach(btn => {
      btn.addEventListener('click', () => decide(btn.getAttribute('data-case-approve'), 'approved'));
    });
    root.querySelectorAll<HTMLButtonElement>('[data-case-reject]').forEach(btn => {
      btn.addEventListener('click', () => decide(btn.getAttribute('data-case-reject'), 'rejected'));
    });
    return;
  }

  /* 63 — disruptions */
  if (area === 'disruptions') {
    root.querySelectorAll<HTMLButtonElement>('[data-disruption-notify]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-disruption-notify');
        const current = read<DisruptionCase[]>('disruptions', seedDisruptions());
        const target = current.find(c => c.id === id);
        if (!target) return;
        if (target.status === 'closed') {
          showError('admin-disruptions-error', 'This case is closed and cannot be notified again.');
          return;
        }
        hideError('admin-disruptions-error');
        write('disruptions', current.map(c => c.id === id ? { ...c, status: 'notified' } : c));
        pushAudit(`${target.flight} disruption notification queued (preview)`);
        showResult('admin-disruptions-result', `Passenger notification queued for ${target.flight} (preview). No message was actually sent.`);
        rerender();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-disruption-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-disruption-close');
        const note = root.querySelector<HTMLInputElement>(`[data-disruption-note="${id}"]`);
        const rebook = root.querySelector<HTMLSelectElement>(`[data-disruption-rebook="${id}"]`);
        const current = read<DisruptionCase[]>('disruptions', seedDisruptions());
        const target = current.find(c => c.id === id);
        if (!target) return;
        hideError('admin-disruptions-error');
        markInvalid(note, false); markInvalid(rebook, false);

        if (target.status === 'open') {
          showError('admin-disruptions-error', 'Notify affected passengers before closing this disruption case.');
          return;
        }
        if (!rebook?.value) {
          markInvalid(rebook, true);
          showError('admin-disruptions-error', 'Select a rebooking option before closing the case.');
          return;
        }
        const value = (note?.value || '').trim();
        if (value.length < 8) {
          markInvalid(note, true);
          showError('admin-disruptions-error', 'Record a resolution note of at least 8 characters.');
          return;
        }
        const label = rebook.options[rebook.selectedIndex]?.text || rebook.value;
        write('disruptions', current.map(c => c.id === id ? { ...c, status: 'closed', resolution: `${label} — ${value}` } : c));
        pushAudit(`${target.flight} disruption closed — ${label}`);
        showResult('admin-disruptions-result', `${target.flight} disruption closed (preview) with option “${label}”. No rebooking was transmitted to the airline.`);
        rerender();
      });
    });
    return;
  }

  /* 64 — reconciliation */
  if (area === 'reconciliation') {
    const persist = (next: LedgerRow[]) => write('ledger', next);

    $<HTMLButtonElement>('#admin-run-reconciliation')?.addEventListener('click', () => {
      const current = read<LedgerRow[]>('ledger', seedLedger());
      const next = current.map(r => ({
        ...r,
        status: r.status === 'resolved' ? 'resolved' : (r.expected === r.actual ? 'matched' : 'mismatch'),
      } as LedgerRow));
      persist(next);
      const mismatches = next.filter(r => r.status === 'mismatch').length;
      pushAudit(`Reconciliation run — ${next.length - mismatches} matched, ${mismatches} mismatch(es)`);
      showResult(
        'admin-reconciliation-result',
        `Reconciliation complete (preview): ${next.length - mismatches} of ${next.length} rows matched${mismatches ? `, ${mismatches} mismatch(es) need resolution` : ''}. No supplier statement was downloaded.`,
        mismatches ? 'amber' : 'green',
      );
      rerender();
    });

    $<HTMLButtonElement>('#admin-reset-ledger')?.addEventListener('click', () => {
      write('ledger', seedLedger());
      pushAudit('Demo ledger reset to seed values');
      showResult('admin-reconciliation-result', 'Demo ledger reset to its seed values.', 'amber');
      rerender();
    });

    root.querySelectorAll<HTMLButtonElement>('[data-ledger-resolve]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ledger-resolve');
        const note = root.querySelector<HTMLInputElement>(`[data-ledger-note="${id}"]`);
        const current = read<LedgerRow[]>('ledger', seedLedger());
        const target = current.find(r => r.id === id);
        if (!target) return;
        hideError('admin-reconciliation-error');
        markInvalid(note, false);
        const value = (note?.value || '').trim();
        if (value.length < 8) {
          markInvalid(note, true);
          showError('admin-reconciliation-error', 'Record a resolution note of at least 8 characters before resolving a mismatch.');
          return;
        }
        persist(current.map(r => r.id === id ? { ...r, status: 'resolved', note: value } : r));
        pushAudit(`Ledger ${target.reference} mismatch resolved — ${value}`);
        showResult('admin-reconciliation-result', `Mismatch on ${target.reference} resolved (preview) with a documented note. No journal entry was posted.`);
        rerender();
      });
    });
  }
}
