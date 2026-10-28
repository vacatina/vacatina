import {
  evaluateBundleReadiness, JOURNEY_PRODUCTS, journeyConfigurationFromQuery,
  journeyEscape, journeyMoney, validateJourneyConfiguration
} from '../journeys/domain/journey-models.ts';
import type { JourneyConfiguration } from '../journeys/domain/journey-models.ts';
import { journeyService, syncServerTripBucketSnapshot } from '../journeys/services/journey-service.ts';
import type { JourneyBucket, JourneyBucketItem } from '../journeys/services/journey-service.ts';
import { readJourneyForm, renderJourneyFields } from '../journeys/ui/product-workspace.ts';
import type { JourneyNavigate } from '../journeys/ui/product-workspace.ts';
import { tripBucketService } from '../../lib/services/trip-bucket.service.ts';
import type { TripBucketCandidate } from '../../lib/domain/types.ts';

const BUNDLE_COMPONENTS = [
  { productType: 'flights', label: 'Flights', route: '/flights' },
  { productType: 'hotels', label: 'Hotels', route: '/hotels' },
  { productType: 'cars', label: 'Cars & Transfers', route: '/cars-transfers' },
  { productType: 'visa', label: 'Visa Assistance', route: '/visa-assistance' },
  ...JOURNEY_PRODUCTS.filter(p => !['packages', 'cars', 'flights', 'hotels', 'visa'].includes(p.productType))
];

/** Server snapshots win by identity; local planning requests must remain visible. */
export function bundleItemsFromSnapshots(serverItems: JourneyBucketItem[], localItems: TripBucketCandidate[]): JourneyBucketItem[] {
  const serverIds = new Set(serverItems.map(item => item.id));
  const localSnapshot = localItems.filter(item => !serverIds.has(item.id)).map(item => ({
    id: item.id,
    canonicalOfferId: item.offerId || item.id,
    title: item.title,
    productType: item.productType,
    state: item.inventoryMode === 'live_supplier' ? item.state : 'NEEDS_ACTION',
    configuration: { ...(item.configuration || {}), ...(item.travellerCounts || {}) },
    travellerManifest: item.travellerCounts,
    unitSellingPriceMinor: item.amountMinor ?? item.priceLkr * 100,
    currency: item.currency || 'LKR',
    priceStatus: item.priceStatus
  }));
  return [...serverItems, ...localSnapshot];
}

export function bundleItemPrice(item: JourneyBucketItem): string {
  return item.priceStatus === 'quote_required' ? 'Quote required' : journeyMoney(item.unitSellingPriceMinor / 100, item.currency);
}

export class BundleWorkspace {
  private config!: JourneyConfiguration;
  private products: string[] = ['flights', 'hotels', 'cars'];
  private bucket: JourneyBucket | null = null;
  private loading = false;
  private busy = false;
  private error = '';
  private notice = '';
  private host!: HTMLElement;
  private navigate!: JourneyNavigate;
  private generation = 0;
  private localPlanning = false;
  public cancel(): void { this.generation++; }

  public async load(host: HTMLElement, query: URLSearchParams, navigate: JourneyNavigate): Promise<void> {
    this.host = host; this.navigate = navigate;
    this.busy = false;
    this.config = journeyConfigurationFromQuery(query);
    this.products = query.getAll('product').filter(type => BUNDLE_COMPONENTS.some(component => component.productType === type));
    if (this.products.length < 2) this.products = ['flights', 'hotels', 'cars'];
    this.localPlanning = false;
    this.bucket = null; this.error = ''; this.notice = ''; this.loading = true;
    const generation = ++this.generation;
    this.render();
    try {
      this.bucket = await journeyService.loadBucket();
      if (generation !== this.generation) return;
      syncServerTripBucketSnapshot(this.bucket);
      if (this.bucket.journey) this.config = { ...this.config, ...this.bucket.journey };
      if (Array.isArray(this.bucket.bundleProductTypes) && this.bucket.bundleProductTypes.length) this.products = this.bucket.bundleProductTypes;
    } catch {
      if (generation !== this.generation) return;
      this.localPlanning = true;
      this.error = 'Server preferences are unavailable. Continue planning locally on this page; no preferences, booking or payment are persisted.';
    }
    finally { if (generation === this.generation) { this.loading = false; this.render(); } }
  }

  private render(): void {
    // Server items are authoritative, but demo/manual selections only exist in the local
    // Trip Bucket snapshot. Merge both so Build Your Bundle never contradicts the drawer.
    const items = bundleItemsFromSnapshots(this.bucket?.items || [], tripBucketService.getItems());
    const readiness = evaluateBundleReadiness(this.products, items.map(item => ({ ...item, configuration: { ...item.configuration, ...item.travellerManifest } })), this.config);
    this.host.innerHTML = `<section id="bundle-workspace" class="min-h-screen bg-brand-canvas pb-20 text-brand-black"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <nav aria-label="Breadcrumb" class="text-xs text-brand-muted flex items-center gap-2 mb-6"><a href="/" class="min-h-[44px] inline-flex items-center hover:underline">Home</a><span aria-hidden="true">/</span><span>Build Your Bundle</span></nav>
      <header class="max-w-3xl mb-10"><p class="text-xs font-semibold tracking-widest uppercase text-brand-primary mb-3">One journey, your choices</p><h1 class="font-heading font-bold text-3xl sm:text-5xl tracking-tight leading-tight">Build Your Bundle</h1><p class="text-brand-muted text-base leading-relaxed mt-4">Bring your flights, stays, transfers, and experiences into one trip. Every component keeps its own availability, conditions, and confirmation status.</p></header>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8"><div class="lg:col-span-2 min-w-0"><form id="bundle-journey-form" class="bg-white border border-brand-border rounded-3xl p-5 sm:p-7" novalidate><h2 class="font-heading text-xl font-semibold mb-5">Your journey</h2><div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><label class="text-xs font-semibold text-brand-muted"><span class="block mb-2">Departure city or airport</span><input name="origin" value="${journeyEscape(this.config.origin)}" class="w-full min-h-[44px] rounded-xl border border-brand-border px-3 text-sm" maxlength="160"></label>${renderJourneyFields('packages', this.config)}</div>
      <fieldset class="mt-7"><legend class="font-heading font-semibold mb-4">What would you like to include?</legend><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${BUNDLE_COMPONENTS.map(component => `<label class="min-h-[44px] flex items-center gap-3 border border-brand-border rounded-xl px-4 py-3 text-sm"><input type="checkbox" name="bundleProductType" value="${component.productType}"${this.products.includes(component.productType) ? ' checked' : ''} class="w-5 h-5 accent-[#1B1464]"><span>${journeyEscape(component.label)}</span></label>`).join('')}</div></fieldset>
      <button type="submit" class="min-h-[44px] mt-6 px-5 py-3 bg-brand-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50"${this.busy || this.loading ? ' disabled' : ''}>${this.busy ? 'Saving journey…' : 'Save journey preferences'}</button><p class="text-xs text-brand-muted mt-3">Preferences are saved to your trip. They do not reserve inventory or create a booking.</p></form>
      <section class="mt-8" aria-labelledby="bundle-components-title"><h2 id="bundle-components-title" class="text-xl font-heading font-semibold mb-5">Choose each component</h2><div class="space-y-4">${this.products.map(type => {
        const component = BUNDLE_COMPONENTS.find(p => p.productType === type);
        if (!component) return '';
        const selected = items.filter(item => item.productType === type);
        const issue = readiness.missing.includes(type) ? (selected.length ? 'Review selected option — confirmation required' : 'Choose an option') : readiness.conflicts.includes(type) ? 'Review dates and travellers' : 'Ready for review';
        return `<article class="bg-white border border-brand-border rounded-2xl p-5 sm:p-6"><div class="flex flex-wrap justify-between items-start gap-4"><div><h3 class="font-heading text-lg font-semibold">${journeyEscape(component.label)}</h3><p class="text-xs mt-2 ${issue === 'Ready for review' ? 'text-brand-success' : 'text-brand-warning'}">${issue}</p></div><button type="button" data-bundle-search="${type}" class="min-h-[44px] border border-brand-border text-brand-primary rounded-xl px-4 py-2 text-sm font-semibold">${selected.length ? 'Find another option' : 'Find options'}</button></div>${selected.map(item => `<div class="border-t border-brand-border mt-4 pt-4"><p class="text-sm font-semibold">${journeyEscape(item.title)}</p><div class="flex flex-wrap gap-2 justify-between mt-2 text-xs text-brand-muted"><span>${journeyEscape(item.state.toLowerCase().replace(/_/g, ' '))}</span><span class="tabular-nums">${journeyEscape(bundleItemPrice(item))}</span></div></div>`).join('')}</article>`;
      }).join('')}</div></section></div>
      <aside class="min-w-0"><div class="border border-brand-border rounded-2xl bg-white p-6 lg:sticky lg:top-24"><p class="text-xs uppercase tracking-widest text-brand-muted font-semibold">Journey readiness</p><h2 class="font-heading text-xl font-semibold mt-3">${readiness.ready ? 'Your components are ready for review' : 'Keep shaping your trip'}</h2><p class="text-sm text-brand-muted leading-relaxed mt-3">${readiness.ready ? 'Your selected product types have matching dates and travellers. Each option is checked again before payment.' : 'Choose and configure every selected component. Incomplete or mismatched selections stay outside a ready bundle.'}</p>
      <dl class="mt-6 space-y-3 text-sm"><div class="flex justify-between gap-4"><dt class="text-brand-muted">Products selected</dt><dd class="font-semibold tabular-nums">${this.products.length}</dd></div><div class="flex justify-between gap-4"><dt class="text-brand-muted">Components needing action</dt><dd class="font-semibold tabular-nums">${readiness.missing.length}</dd></div><div class="flex justify-between gap-4"><dt class="text-brand-muted">Configuration to review</dt><dd class="font-semibold tabular-nums">${readiness.conflicts.length}</dd></div></dl>
      <a href="/trip/review" class="min-h-[44px] mt-6 flex items-center justify-center bg-brand-primary text-white rounded-xl px-5 py-3 font-semibold text-sm">Review your Trip Bucket</a><p class="text-xs text-brand-muted mt-4 leading-relaxed">No combined discount, hold, or confirmation is assumed. Separate supplier conditions apply to each component.</p>
      <div id="bundle-message" aria-live="polite">${this.loading ? '<p class="text-sm mt-4 text-brand-muted">Loading your saved trip…</p>' : ''}${this.error ? `<p class="text-sm mt-4 text-brand-error" role="alert">${journeyEscape(this.error)}</p><button type="button" id="bundle-retry" class="min-h-[44px] mt-3 underline text-sm text-brand-primary">Reload trip</button>` : ''}${this.notice ? `<p class="text-sm mt-4 text-brand-success">${journeyEscape(this.notice)}</p>` : ''}</div></div></aside></div></div></section>`;
    this.bind();
  }

  private bind(): void {
    const form = this.host.querySelector<HTMLFormElement>('#bundle-journey-form')!;
    const read = () => {
      this.config = readJourneyForm(form, this.config);
      this.products = [...form.querySelectorAll<HTMLInputElement>('[name="bundleProductType"]:checked')].map(input => input.value);
    };
    form.addEventListener('submit', event => { event.preventDefault(); read(); void this.save(); });
    form.querySelectorAll<HTMLInputElement>('[name="bundleProductType"]').forEach(input => input.addEventListener('change', () => { read(); this.render(); }));
    this.host.querySelectorAll<HTMLButtonElement>('[data-bundle-search]').forEach(button => button.addEventListener('click', async () => {
      read();
      const component = BUNDLE_COMPONENTS.find(p => p.productType === button.dataset.bundleSearch);
      if (!component) return;
      if (!await this.save(false)) return;
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(this.config)) if (value !== '' && value !== undefined) query.set(key, String(value));
      query.set('from', this.config.origin); query.set('to', this.config.destination); query.set('dep', this.config.departureDate); query.set('ret', this.config.returnDate);
      this.navigate(`${component.route}?${query}`);
    }));
    this.host.querySelector('#bundle-retry')?.addEventListener('click', () => void this.load(this.host, new URLSearchParams(), this.navigate));
  }

  private async save(showNotice = true): Promise<boolean> {
    if (this.busy) return false;
    const generation = this.generation;
    const errors = validateJourneyConfiguration('packages', this.config);
    if (this.products.length < 2) errors.products = 'Choose at least two product types for your bundle.';
    if (this.products.includes('flights') && !this.config.origin) errors.origin = 'Enter a departure city or airport for your flights.';
    if (Object.keys(errors).length) { this.error = Object.values(errors).join(' '); this.notice = ''; this.render(); return false; }
    if (this.localPlanning) {
      this.error = '';
      this.notice = 'Preferences held on this page only. Configure each product separately; nothing is reserved or persisted.';
      this.render(); return true;
    }
    this.busy = true; this.error = ''; this.notice = ''; this.render();
    try {
      const result = await journeyService.saveBundle(this.config, this.products);
      if (generation !== this.generation) return false;
      this.bucket = result.items ? result : await journeyService.loadBucket();
      if (showNotice) this.notice = 'Your journey preferences have been saved.';
      return true;
    } catch (error) { if (generation === this.generation) this.error = error instanceof Error ? error.message : 'Your journey could not be saved. Please retry.'; return false; }
    finally { if (generation === this.generation) { this.busy = false; this.render(); } }
  }
}

export const bundleWorkspace = new BundleWorkspace();
