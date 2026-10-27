import type { JourneyConfiguration, JourneyOffer, JourneyProductDefinition } from '../domain/journey-models.ts';
import {
  journeyConfigurationFromQuery, journeyEscape, journeyMoney, journeyOfferAmount,
  journeyOfferId, journeyProductDetails, validateJourneyConfiguration
} from '../domain/journey-models.ts';
import { journeyService, refreshServerTripBucket } from '../services/journey-service.ts';
import type { JourneyRevalidation } from '../services/journey-service.ts';
import { favoritesService } from '../../../lib/services/favorites.service.ts';
import { JOURNEY_DEMO_DISCLOSURE } from '../data/demo-offers.ts';

const JOURNEY_INPUT_CLASS = 'w-full min-h-[44px] rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-info';
const JOURNEY_BUTTON_CLASS = 'min-h-[44px] rounded-xl px-5 py-3 text-sm font-semibold bg-brand-primary text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-info focus:ring-offset-2 disabled:opacity-50 disabled:cursor-wait';
const JOURNEY_SECONDARY_CLASS = 'min-h-[44px] rounded-xl px-5 py-3 text-sm font-semibold border border-brand-border text-brand-primary hover:bg-brand-subtle focus:outline-none focus:ring-2 focus:ring-brand-info';

export type JourneyNavigate = (path: string) => void;

function journeyInput(config: JourneyConfiguration, key: keyof JourneyConfiguration, label: string, type = 'text', extra = ''): string {
  return `<label class="block min-w-0 text-xs font-semibold text-brand-muted"><span class="block mb-2">${journeyEscape(label)}</span><input name="${key}" type="${type}" value="${journeyEscape(config[key] ?? '')}" class="${JOURNEY_INPUT_CLASS}" ${extra}></label>`;
}

function journeySelect(config: JourneyConfiguration, key: keyof JourneyConfiguration, label: string, options: Array<[string, string]>): string {
  return `<label class="block min-w-0 text-xs font-semibold text-brand-muted"><span class="block mb-2">${journeyEscape(label)}</span><select name="${key}" class="${JOURNEY_INPUT_CLASS}">${options.map(([value, text]) => `<option value="${journeyEscape(value)}"${String(config[key]) === value ? ' selected' : ''}>${journeyEscape(text)}</option>`).join('')}</select></label>`;
}

export function renderJourneyFields(product: string, config: JourneyConfiguration, detail = false, offer?: JourneyOffer): string {
  let fields = '';
  if (product === 'flights') fields += journeySelect(config, 'tripType', 'Journey type', [['round_trip', 'Return'], ['one_way', 'One way']]);
  if (product === 'rails' || product === 'flights') fields += journeyInput(config, 'origin', product === 'flights' ? 'Departure airport (IATA code)' : 'Departure station', 'text', 'required maxlength="160"');
  fields += journeyInput(config, 'destination', product === 'rails' ? 'Arrival station' : 'Destination', 'text', 'required maxlength="160"');
  if (product === 'cruises') fields += journeyInput(config, 'departurePort', 'Preferred departure port · Not confirmed', 'text', 'required maxlength="160"');
  if (product === 'cars') {
    fields += journeySelect(config, 'serviceType', 'Service', [['transfer', 'Airport / city transfer'], ['car-hire', 'Car hire']]);
    if (config.serviceType === 'transfer') fields += journeySelect(config, 'tripType', 'Transfer journey', [['one_way', 'One way'], ['round_trip', 'Return transfer']]);
  }
  fields += journeyInput(config, 'departureDate', product === 'hotels' ? 'Check-in' : product === 'cruises' ? 'Requested sailing date' : 'Travel date', 'date', 'required');
  if (['packages', 'hotels', 'insurance', 'cruises'].includes(product) || (product === 'flights' && config.tripType === 'round_trip') || (product === 'cars' && (config.serviceType === 'car-hire' || config.tripType === 'round_trip'))) fields += journeyInput(config, 'returnDate', product === 'hotels' ? 'Check-out' : 'End date', 'date', ['packages', 'hotels', 'insurance', 'cars', 'flights'].includes(product) ? 'required' : '');
  fields += journeyInput(config, 'adults', 'Adults', 'number', 'min="1" max="9" step="1" required');
  fields += journeyInput(config, 'children', 'Children', 'number', 'min="0" max="8" step="1"');
  fields += journeyInput(config, 'infants', 'Infants', 'number', 'min="0" max="8" step="1"');
  if (['packages', 'hotels'].includes(product)) fields += journeyInput(config, 'rooms', 'Rooms', 'number', 'min="1" max="9" step="1" required');
  if (product === 'packages') fields += journeyInput(config, 'durationDays', 'Requested duration (days)', 'number', 'min="1" max="365" step="1"');
  if (product === 'cars') {
    fields += journeyInput(config, 'pickup', 'Pickup location', 'text', 'required maxlength="300"');
    fields += journeyInput(config, 'dropoff', 'Drop-off / return location', 'text', 'required maxlength="300"');
    fields += journeyInput(config, 'pickupTime', 'Pickup time (local)', 'time', 'required');
    if (config.serviceType === 'transfer' && config.tripType === 'round_trip') fields += journeyInput(config, 'returnTime', 'Return pickup time (local)', 'time', detail ? 'required' : '');
    fields += journeyInput(config, 'luggage', 'Luggage pieces', 'number', 'min="0" max="20" step="1"');
    if (config.serviceType === 'car-hire') fields += journeyInput(config, 'driverAge', 'Lead driver age', 'number', 'min="18" max="100" step="1" required');
  }
  if (product === 'insurance') {
    fields += journeyInput(config, 'travellerAges', 'Traveller ages (e.g. 32, 30, 7)', 'text', 'required maxlength="100"');
    fields += journeyInput(config, 'residenceCountry', 'Country of residence (two-letter code)', 'text', 'required maxlength="2"');
  }
  if (product === 'rails') fields += journeySelect(config, 'cabinClass', 'Requested travel class · Availability unverified', [['standard', 'Standard preference'], ['first', 'First preference']]);
  if (product === 'flights') fields += journeySelect(config, 'cabinClass', 'Cabin class', [['economy', 'Economy'], ['premium_economy', 'Premium Economy'], ['business', 'Business'], ['first', 'First']]);
  if (product === 'visa') {
    fields += journeyInput(config, 'citizenshipCountry', 'Passport nationality', 'text', 'required maxlength="100"');
    fields += journeyInput(config, 'residenceCountry', 'Country of residence', 'text', 'required maxlength="100"');
    fields += journeySelect(config, 'purpose', 'Travel purpose', [['tourism', 'Tourism / leisure'], ['business', 'Business'], ['transit', 'Transit'], ['family', 'Family visit']]);
  }
  if (detail && offer) {
    const extension = journeyProductDetails(offer);
    const getPublishedOptions = (key: string): Array<[string, string]> => {
      const raw = extension[key];
      if (!Array.isArray(raw)) return [];
      return raw.flatMap(v => {
        if (typeof v === 'string') return [[v, v] as [string, string]];
        if (v && typeof v === 'object') {
          const item = v as Record<string, unknown>;
          const id = String(item.id || item.code || item.value || item.time || item.label || '');
          return id ? [[id, String(item.label || item.name || item.title || id)] as [string, string]] : [];
        }
        return [];
      });
    };
    // A published single option is still explicit; it is never invented from a marketing card.
    if (!Array.isArray(extension.roomTypes) && extension.roomType) extension.roomTypes = [String(extension.roomType)];
    if (!Array.isArray(extension.boardBasisOptions) && extension.boardBasis) extension.boardBasisOptions = [String(extension.boardBasis)];
    if (!Array.isArray(extension.timeSlots) && extension.timeSlot) extension.timeSlots = [String(extension.timeSlot)];
    if (!Array.isArray(extension.cabinCategories) && extension.cabinGrade) extension.cabinCategories = [String(extension.cabinGrade)];
    for (const [source, field, label] of [
      ['timeSlots', 'timeSlot', offer.inventoryMode === 'demo_fixture' ? 'Session request · Not confirmed' : 'Published session'], ['roomTypes', 'roomType', 'Room category'], ['boardBasisOptions', 'boardBasis', 'Meal plan'],
      ['cabinCategories', 'cabinType', 'Cabin category'], ['languages', 'language', 'Tour language'],
      ['packageStyles', 'packageStyle', 'Package style'], ['accommodationTiers', 'accommodationTier', 'Accommodation request'], ['vehicleCategories', 'vehicleCategory', 'Vehicle category'], ['ticketTypes', 'ticketType', 'Ticket / participant option'], ['coverageOptions', 'coverageOption', 'Coverage request']
    ] as const) {
      const options = getPublishedOptions(source);
      if (options.length) fields += journeySelect(config, field, label, [['', 'Select an option'], ...options]);
    }
  }
  return fields;
}

export function readJourneyForm(form: HTMLFormElement, initial: JourneyConfiguration): JourneyConfiguration {
  const result = { ...initial };
  const data = new FormData(form);
  const numeric = new Set(['adults', 'children', 'infants', 'rooms', 'luggage', 'driverAge', 'durationDays']);
  for (const [key, value] of data.entries()) {
    if (key in result && typeof value === 'string') (result as any)[key] = numeric.has(key) ? Number(value) : value.trim();
  }
  return result;
}

function journeyConfigQuery(config: JourneyConfiguration): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(config)) if (value !== '' && value !== undefined) query.set(key, String(value));
  return query.toString();
}

function journeyList(values: unknown, emptyText: string): string {
  const list = Array.isArray(values) ? values.filter(v => typeof v === 'string') : [];
  return list.length ? `<ul class="space-y-2 text-sm leading-relaxed text-brand-muted">${list.map(v => `<li class="flex gap-2"><span aria-hidden="true">—</span><span>${journeyEscape(v)}</span></li>`).join('')}</ul>` : `<p class="text-sm text-brand-muted">${journeyEscape(emptyText)}</p>`;
}

function journeyItinerary(offer: JourneyOffer): string {
  const extension = journeyProductDetails(offer);
  const raw = extension.itinerary || extension.dayByDayItinerary || extension.portsOfCall;
  const days = Array.isArray(raw) ? raw : [];
  if (!days.length) return '<p class="text-sm text-brand-muted">Detailed itinerary information has not been published for this option. Request the full itinerary before making a booking.</p>';
  return `<ol class="space-y-5">${days.map((value, index) => {
    const day: Record<string, unknown> = typeof value === 'object' && value !== null ? value as Record<string, unknown> : { summary: value };
    return `<li class="flex gap-4"><span class="w-10 h-10 flex-shrink-0 rounded-xl bg-brand-subtle text-brand-primary flex items-center justify-center font-semibold tabular-nums">${index + 1}</span><div><h3 class="font-heading font-semibold text-brand-black">${journeyEscape(day.title || day.day || `Day ${index + 1}`)}</h3><p class="text-sm text-brand-muted mt-1 leading-relaxed">${journeyEscape(day.summary || day.description || '')}</p></div></li>`;
  }).join('')}</ol>`;
}

function journeyPublishedFacts(offer: JourneyOffer): string {
  const extension = journeyProductDetails(offer);
  const rows: Array<[string, unknown]> = [];
  const keys: Array<[string, string]> = [
    ['fareFamily', 'Fare family'], ['cabinClass', 'Cabin class'], ['roomType', 'Room category'], ['bedConfiguration', 'Beds'], ['boardBasis', 'Meal plan'],
    ['vehicleModel', 'Vehicle'], ['vehicleCategory', 'Vehicle category'], ['passengerCapacity', 'Passenger capacity'], ['luggageCapacity', 'Luggage capacity'],
    ['shipName', 'Ship'], ['cabinGrade', 'Cabin grade'], ['trainNumber', 'Train'], ['originStation', 'Departure station'], ['destinationStation', 'Arrival station'],
    ['meetingPointAddress', 'Meeting point'], ['durationHours', 'Duration (hours)'], ['guideLanguage', 'Guide language'], ['visaType', 'Service category'],
    ['processingSlaBusinessDays', 'Published processing estimate (business days)'], ['underwriterName', 'Underwriter'], ['planTier', 'Plan'], ['coverageRegion', 'Coverage region'],
    ['confirmationNotes', 'Operator confirmation required'], ['packageTheme', 'Package style'], ['itineraryDays', 'Illustrative itinerary days'], ['itineraryNights', 'Illustrative itinerary nights']
    , ['tourType', 'Tour format'], ['routeDescription', 'Guided route'], ['activityCategory', 'Activity format']
  ];
  for (const [key, label] of keys) if (extension[key] !== undefined && extension[key] !== '') rows.push([label, extension[key]]);
  const segments = Array.isArray(extension.segments) ? extension.segments as Array<Record<string, unknown>> : [];
  const segmentsHtml = segments.length ? `<section class="mt-8 bg-white border border-brand-border rounded-2xl p-6"><h2 class="font-heading text-xl font-semibold mb-5">Flight itinerary</h2><ol class="space-y-5">${segments.map(segment => `<li class="border-l-2 border-brand-border pl-4"><p class="font-semibold">${journeyEscape(segment.originIata)} → ${journeyEscape(segment.destinationIata)}</p><p class="text-sm text-brand-muted mt-1">${journeyEscape(segment.carrierName)} ${journeyEscape(segment.flightNumber)}</p><p class="text-xs text-brand-muted mt-2 tabular-nums">${journeyEscape(segment.departureTimeIso)} → ${journeyEscape(segment.arrivalTimeIso)}</p></li>`).join('')}</ol></section>` : '';
  const checklist = extension.documentChecklist;
  const checklistHtml = Array.isArray(checklist) ? `<section class="mt-8 bg-white border border-brand-border rounded-2xl p-6"><h2 class="font-heading text-xl font-semibold mb-4">Document checklist</h2>${journeyList(checklist, 'Request the current document checklist.')}<p class="text-xs text-brand-muted mt-4">Do not upload passport documents here. Vacatina will provide a secure submission process when your application is opened. Visa decisions remain with the relevant authority.</p></section>` : '';
  let policyHtml = '';
  if (offer.productType === 'insurance' && typeof extension.policyWordingUrl === 'string') {
    try {
      const url = new URL(extension.policyWordingUrl);
      if (url.protocol === 'https:') policyHtml = `<a href="${journeyEscape(url.href)}" target="_blank" rel="noopener noreferrer" class="min-h-[44px] mt-4 inline-flex items-center text-sm text-brand-primary underline">Read full policy wording <span class="sr-only">(opens in a new tab)</span></a>`;
    } catch { /* Missing/invalid policy links are never rendered as active links. */ }
  }
  return `${rows.length ? `<dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 border-t border-brand-border pt-6">${rows.map(([label, value]) => `<div><dt class="text-xs text-brand-muted">${label}</dt><dd class="mt-1 text-sm font-semibold">${journeyEscape(value)}</dd></div>`).join('')}</dl>` : ''}${segmentsHtml}${checklistHtml}${policyHtml}`;
}

export class ProductWorkspace {
  private currentRequest = 0;
  private config!: JourneyConfiguration;
  private offers: JourneyOffer[] = [];
  private selectedOffer: JourneyOffer | null = null;
  private status: 'idle' | 'loading' | 'error' | 'results' | 'details' = 'idle';
  private message = '';
  private warnings: string[] = [];
  private quote: JourneyRevalidation | null = null;
  private acceptedChangedPrice = false;
  private busy = false;
  private staged = false;
  private sort = 'recommended';
  private condition = 'all';
  private host!: HTMLElement;
  private product!: JourneyProductDefinition;
  private navigate!: JourneyNavigate;
  private demoMode = false;
  private contextQuery(): string { return `${journeyConfigQuery(this.config)}${this.demoMode ? '&inventory=demo' : ''}`; }

  public async load(container: HTMLElement, product: JourneyProductDefinition, query: URLSearchParams, navigate: JourneyNavigate, offerId?: string, search = false): Promise<void> {
    this.currentRequest++;
    this.host = container; this.product = product; this.navigate = navigate;
    this.demoMode = query.get('inventory') === 'demo' || !!offerId?.startsWith('DEMO-');
    this.config = journeyConfigurationFromQuery(query);
    this.selectedOffer = null; this.quote = null; this.acceptedChangedPrice = false; this.staged = false;
    this.busy = false;
    this.offers = []; this.warnings = []; this.message = ''; this.status = 'idle';
    this.render();
    if (offerId) await this.openOffer(offerId);
    else if (search) await this.search();
    if (container.isConnected) { const heading = container.querySelector<HTMLElement>('h1'); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true }); }
  }

  private async search(): Promise<void> {
    const errors = validateJourneyConfiguration(this.product.productType, this.config);
    if (Object.keys(errors).length) { this.message = Object.values(errors).join(' '); this.status = 'idle'; this.render(); return; }
    const request = ++this.currentRequest;
    this.status = 'loading'; this.message = ''; this.render();
    try {
      const result = await journeyService.search(this.product.productType, this.config, this.demoMode ? 'demo_fixture' : undefined);
      if (request !== this.currentRequest) return;
      this.offers = result.offers.filter(offer => offer.productType === this.product.productType);
      this.warnings = result.warnings || []; this.status = 'results';
    } catch (error) { if (request !== this.currentRequest) return; this.status = 'error'; this.message = error instanceof Error ? error.message : 'We could not complete this search. Please try again.'; }
    this.render();
  }

  private async openOffer(id: string): Promise<void> {
    const request = ++this.currentRequest;
    this.status = 'loading'; this.render();
    try {
      const result = await journeyService.getOffer(id);
      if (request !== this.currentRequest) return;
      if (!result.offer || result.offer.productType !== this.product.productType) throw new Error('This option is not available for this product.');
      this.selectedOffer = result.offer; this.status = 'details'; this.message = '';
      if (!this.config.destination) this.config.destination = result.offer.location?.city || result.offer.location?.country || '';
    } catch (error) { if (request !== this.currentRequest) return; this.status = 'error'; this.message = error instanceof Error ? error.message : 'This option could not be loaded.'; }
    this.render();
  }

  private render(): void {
    const p = this.product;
    const detail = this.status === 'details' && this.selectedOffer;
    this.host.innerHTML = `<section id="journey-product-workspace" class="min-h-screen bg-brand-canvas text-brand-black pb-20" aria-label="${journeyEscape(p.label)}">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <nav class="flex flex-wrap items-center gap-2 text-xs text-brand-muted mb-8" aria-label="Breadcrumb"><a href="/" class="min-h-[44px] inline-flex items-center hover:underline">Home</a><span aria-hidden="true">/</span><a href="${p.route}" class="min-h-[44px] inline-flex items-center hover:underline">${journeyEscape(p.label)}</a>${detail ? '<span aria-hidden="true">/</span><span>Configure your choice</span>' : ''}</nav>
        ${detail ? this.renderDetail(this.selectedOffer!) : `<header class="grid grid-cols-1 md:grid-cols-5 gap-8 items-center mb-10"><div class="md:col-span-3"><p class="text-xs font-semibold tracking-widest uppercase text-brand-primary mb-3">${journeyEscape(p.eyebrow)}</p><h1 class="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight leading-tight">${journeyEscape(p.label)}</h1><p class="mt-4 max-w-2xl text-base leading-relaxed text-brand-muted">${journeyEscape(p.description)}</p><p class="mt-4 text-xs text-brand-muted">Prices and availability are checked during search and before booking.</p></div><div class="hidden md:block md:col-span-2 rounded-2xl overflow-hidden h-52 bg-brand-subtle"><img src="${p.image}" alt="${journeyEscape(p.label)} travel inspiration" class="w-full h-full object-cover" loading="lazy"></div></header>
        <form id="journey-search-form" class="bg-white border border-brand-border rounded-3xl p-5 sm:p-7 mb-8" novalidate><h2 class="font-heading text-lg font-semibold mb-5">Find your options</h2><label class="block text-sm font-semibold mb-5">Catalog<select id="journey-inventory" class="${JOURNEY_INPUT_CLASS} mt-2"><option value="published"${this.demoMode ? '' : ' selected'}>Published service inventory (may be unavailable)</option><option value="demo"${this.demoMode ? ' selected' : ''}>Canonical demo examples · No booking</option></select></label>${this.demoMode ? `<p class="rounded-xl p-4 bg-amber-50 border border-amber-200 text-xs mb-5">${JOURNEY_DEMO_DISCLOSURE}</p>` : '<p class="text-xs text-brand-muted mb-5">No live supplier is activated in this build. Choose the demo catalog to explore a local planning journey, or search published inventory without assuming availability.</p>'}<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${renderJourneyFields(p.productType, this.config)}</div><div class="mt-5 flex flex-col sm:flex-row sm:items-center gap-4"><button type="submit" class="${JOURNEY_BUTTON_CLASS}"${this.status === 'loading' ? ' disabled' : ''}>${this.status === 'loading' ? 'Searching…' : 'Compare options'}</button><p class="text-xs text-brand-muted">Configure an option before staging it. No payment or confirmation occurs here.</p></div></form>
        <div id="journey-results" aria-live="polite" aria-atomic="false">${this.renderResults()}</div>`}
      </div></section>`;
    this.bind();
  }

  private renderResults(): string {
    if (this.message) return `<div role="alert" class="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 class="font-heading font-semibold mb-2">${this.status === 'error' ? 'We could not load these options' : 'Check your search details'}</h2><p class="text-sm text-brand-muted">${journeyEscape(this.message)}</p>${this.status === 'error' ? `<button id="journey-retry" class="${JOURNEY_SECONDARY_CLASS} mt-4">Try again</button>` : ''}</div>`;
    if (this.status === 'loading') return `<div role="status" aria-label="Searching travel options" class="space-y-4">${[1, 2, 3].map(() => '<div class="h-36 rounded-2xl bg-white border border-brand-border p-6"><div class="h-5 bg-brand-subtle rounded w-2/3"></div><div class="h-4 bg-brand-subtle rounded w-1/2 mt-4"></div></div>').join('')}<p class="text-sm text-brand-muted">Checking available options…</p></div>`;
    if (this.status === 'idle') return `<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8 border-t border-brand-border">${[['01', 'Explore', 'Choose your destination, dates, and travellers.'], ['02', 'Understand', 'Review inclusions, itinerary, options, and cancellation terms.'], ['03', 'Build your trip', 'Configure a current option before saving it to your Trip Bucket.']].map(([n, title, text]) => `<div><span class="text-xs font-semibold tabular-nums text-brand-primary">${n}</span><h2 class="font-heading font-semibold text-lg mt-2">${title}</h2><p class="text-sm text-brand-muted mt-2 leading-relaxed">${text}</p></div>`).join('')}</div>`;
    let offers = this.offers.filter(offer => this.condition !== 'instant' || offer.confirmationMode === 'INSTANT_CONFIRM');
    if (this.sort === 'price') offers = [...offers].sort((a, b) => journeyOfferAmount(a) - journeyOfferAmount(b));
    if (this.sort === 'title') offers = [...offers].sort((a, b) => a.title.localeCompare(b.title));
    return `${this.warnings.length ? `<p role="status" class="text-sm text-brand-muted mb-4">Some options may be temporarily unavailable. You can retry your search.</p>` : ''}
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6"><h2 class="text-xl font-heading font-semibold"><span class="tabular-nums">${offers.length}</span> ${offers.length === 1 ? 'option' : 'options'} for ${journeyEscape(this.config.destination)}</h2><div class="flex flex-wrap gap-3"><label class="text-xs text-brand-muted">Confirmation<select id="journey-condition" class="${JOURNEY_INPUT_CLASS} mt-1"><option value="all"${this.condition === 'all' ? ' selected' : ''}>All options</option><option value="instant"${this.condition === 'instant' ? ' selected' : ''}>Instant confirmation eligible</option></select></label><label class="text-xs text-brand-muted">Sort by<select id="journey-sort" class="${JOURNEY_INPUT_CLASS} mt-1"><option value="recommended"${this.sort === 'recommended' ? ' selected' : ''}>Recommended</option><option value="price"${this.sort === 'price' ? ' selected' : ''}>Lowest price</option><option value="title"${this.sort === 'title' ? ' selected' : ''}>Name</option></select></label></div></div>
      ${offers.length ? `<div class="space-y-4">${offers.map(offer => this.renderOffer(offer)).join('')}</div>` : `<div class="text-center bg-white border border-brand-border rounded-2xl py-14 px-6"><h3 class="font-heading text-xl font-semibold">No matching options right now</h3><p class="mt-3 text-sm text-brand-muted max-w-lg mx-auto">Try a different destination, date, or search requirement. No payment or booking has been made.</p><a href="/contact" class="${JOURNEY_SECONDARY_CLASS} mt-6 inline-flex items-center">Ask Vacatina for help</a></div>`}`;
  }

  private renderOffer(offer: JourneyOffer): string {
    const id = journeyOfferId(offer);
    const price = offer.priceStatus === 'quote_required' ? 'Quote required' : journeyMoney(journeyOfferAmount(offer), offer.displayCurrency || offer.currency || 'LKR');
    const condition = offer.inventoryMode === 'demo_fixture' ? 'Canonical demo fixture · No live availability' : offer.confirmationMode === 'INSTANT_CONFIRM' ? 'Subject to availability recheck' : 'Confirmation required';
    return `<article class="bg-white rounded-2xl border border-brand-border p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center justify-between"><div class="min-w-0"><p class="text-xs text-brand-muted mb-2">${journeyEscape(condition)}</p><h3 class="font-heading font-semibold text-xl break-words">${journeyEscape(offer.title)}</h3><p class="text-sm text-brand-muted mt-2">${journeyEscape(offer.subtitle || [offer.location?.city, offer.location?.country].filter(Boolean).join(', '))}</p><p class="text-xs text-brand-muted mt-3">${journeyEscape(offer.cancellationPolicy || 'Review the published cancellation conditions before booking.')}</p></div><div class="sm:text-right sm:flex-shrink-0"><p class="font-semibold text-xl text-brand-primary tabular-nums">${journeyEscape(price)}</p><div class="flex gap-2 mt-3"><button type="button" data-journey-save="${journeyEscape(id)}" aria-pressed="${favoritesService.isSaved(offer.title)}" aria-label="Save ${journeyEscape(offer.title)}" class="${JOURNEY_SECONDARY_CLASS}">${favoritesService.isSaved(offer.title) ? 'Saved' : 'Save'}</button><button type="button" data-journey-offer="${journeyEscape(id)}" class="${JOURNEY_BUTTON_CLASS}">View & configure</button></div></div></article>`;
  }

  private renderDetail(offer: JourneyOffer): string {
    const quoteChanged = this.quote?.status === 'PRICE_CHANGED';
    const priceMinor = this.quote?.currentPrice;
    const price = typeof priceMinor === 'number' ? priceMinor / 100 : journeyOfferAmount(offer);
    const recheckMessage = this.quote?.message || '';
    const canStage = !this.staged && (!quoteChanged || this.acceptedChangedPrice);
    return `<div class="grid grid-cols-1 lg:grid-cols-3 gap-8"><div class="lg:col-span-2 min-w-0"><p class="text-xs font-semibold text-brand-primary mb-3">Configure your choice</p><h1 class="text-3xl sm:text-4xl font-heading font-bold leading-tight break-words">${journeyEscape(offer.title)}</h1><p class="mt-3 text-brand-muted">${journeyEscape(offer.subtitle || '')}</p>
      ${offer.inventoryMode === 'demo_fixture' ? `<p class="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed">${JOURNEY_DEMO_DISCLOSURE}</p>` : ''}
      ${journeyPublishedFacts(offer)}${this.product.productType === 'packages' || this.product.productType === 'cruises' ? `<section class="mt-8 bg-white border border-brand-border rounded-2xl p-6"><h2 class="font-heading text-xl font-semibold mb-6">Your itinerary</h2>${journeyItinerary(offer)}</section>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8"><section><h2 class="font-heading text-lg font-semibold mb-3">Included</h2>${journeyList(offer.inclusions, 'Check the full inclusions with Vacatina before booking.')}</section><section><h2 class="font-heading text-lg font-semibold mb-3">Not included</h2>${journeyList(offer.exclusions, 'Additional exclusions have not been published.')}</section></div>
      <section class="mt-8 border-t border-brand-border pt-6"><h2 class="font-heading text-lg font-semibold mb-3">Cancellation & confirmation</h2><p class="text-sm text-brand-muted leading-relaxed">${journeyEscape(offer.cancellationPolicy || 'Request the cancellation conditions before booking.')}</p><p class="text-sm text-brand-muted mt-3">${offer.confirmationMode === 'INSTANT_CONFIRM' ? 'Price and availability must pass a fresh check before booking.' : 'This option requires confirmation. Saving it does not confirm a reservation.'}</p></section></div>
      <aside class="min-w-0"><form id="journey-configure-form" class="bg-white border border-brand-border rounded-2xl p-5 sm:p-6 space-y-5" novalidate><div><p class="text-xs text-brand-muted">Selected option estimate</p><p class="text-2xl font-semibold text-brand-primary tabular-nums mt-1">${offer.priceStatus === 'quote_required' ? 'Quote required · No price supplied' : journeyEscape(journeyMoney(price, offer.displayCurrency || offer.currency || 'LKR'))}</p></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">${renderJourneyFields(this.product.productType, this.config, true, offer)}</div>
      ${this.product.productType === 'insurance' ? `<label class="flex gap-3 text-xs text-brand-muted leading-relaxed"><input id="journey-policy-confirm" type="checkbox" required${this.config.policyReviewAcknowledged ? ' checked' : ''} class="w-5 h-5 flex-shrink-0"><span>${offer.inventoryMode === 'demo_fixture' ? 'I understand this is a local comparison request. No coverage, premium or policy terms are supplied and no insurance cover is in force.' : 'I have reviewed the actual published policy terms, eligibility, benefits, and exclusions. This selection does not issue a policy.'}</span></label>` : ''}
      ${this.message ? `<p role="alert" class="text-sm text-brand-error">${journeyEscape(this.message)}</p>` : ''}
      ${this.quote ? `<div role="status" class="rounded-xl bg-brand-subtle p-4 text-xs leading-relaxed">${quoteChanged ? `<strong class="text-brand-warning">The price has changed.</strong><p class="mt-2">Previous: ${journeyEscape(journeyMoney((this.quote.previousPrice || 0) / 100, offer.currency))}<br>Updated: ${journeyEscape(journeyMoney(price, offer.currency))}</p><label class="flex gap-2 mt-3"><input id="journey-price-consent" type="checkbox"${this.acceptedChangedPrice ? ' checked' : ''} class="w-5 h-5"><span>I accept the updated price.</span></label>` : `<p>${journeyEscape(recheckMessage || 'Availability checked. This does not create a booking.')}</p>`}</div>` : ''}
      <button type="submit" class="${JOURNEY_BUTTON_CLASS} w-full"${this.busy || !canStage ? ' disabled' : ''}>${this.busy ? 'Checking your option…' : this.staged ? 'Saved to your trip' : 'Recheck & save to Trip Bucket'}</button>
      <p class="text-xs text-brand-muted leading-relaxed">No payment is collected here. Your Trip Bucket shows the current readiness of each selection.</p><a href="${this.product.route}?${this.contextQuery()}" class="min-h-[44px] flex items-center justify-center text-sm text-brand-primary underline">Change search details</a>
      ${this.staged ? `<a href="/trip/review" class="${JOURNEY_SECONDARY_CLASS} w-full inline-flex justify-center">Review your trip</a><a href="/trip-builder/results" class="min-h-[44px] flex items-center justify-center text-sm text-brand-primary underline">Continue building your bundle</a>` : ''}</form></aside></div>`;
  }

  private bind(): void {
    const search = this.host.querySelector<HTMLFormElement>('#journey-search-form');
    search?.addEventListener('submit', event => { event.preventDefault(); this.config = readJourneyForm(search, this.config); this.demoMode = search.querySelector<HTMLSelectElement>('#journey-inventory')?.value === 'demo'; this.navigate(`${this.product.route}/search?${this.contextQuery()}`); });
    search?.querySelector<HTMLSelectElement>('#journey-inventory')?.addEventListener('change', () => { this.config = readJourneyForm(search, this.config); this.demoMode = search.querySelector<HTMLSelectElement>('#journey-inventory')?.value === 'demo'; this.render(); });
    search?.querySelector<HTMLSelectElement>('[name="serviceType"]')?.addEventListener('change', () => { this.config = readJourneyForm(search, this.config); this.render(); });
    search?.querySelector<HTMLSelectElement>('[name="tripType"]')?.addEventListener('change', () => { this.config = readJourneyForm(search, this.config); this.render(); });
    this.host.querySelector('#journey-retry')?.addEventListener('click', () => this.selectedOffer ? this.openOffer(journeyOfferId(this.selectedOffer)) : this.search());
    this.host.querySelector<HTMLSelectElement>('#journey-sort')?.addEventListener('change', event => { this.sort = (event.target as HTMLSelectElement).value; this.render(); });
    this.host.querySelector<HTMLSelectElement>('#journey-condition')?.addEventListener('change', event => { this.condition = (event.target as HTMLSelectElement).value; this.render(); });
    this.host.querySelectorAll<HTMLButtonElement>('[data-journey-offer]').forEach(button => button.addEventListener('click', () => this.navigate(`${this.product.route}/offer/${encodeURIComponent(button.dataset.journeyOffer!)}?${this.contextQuery()}`)));
    this.host.querySelectorAll<HTMLButtonElement>('[data-journey-save]').forEach(button => button.addEventListener('click', () => {
      const offer = this.offers.find(v => journeyOfferId(v) === button.dataset.journeySave);
      if (!offer) return;
      favoritesService.toggle(offer.title, offer.productType, this.config.destination, journeyMoney(journeyOfferAmount(offer), offer.currency));
      this.render();
    }));
    const configure = this.host.querySelector<HTMLFormElement>('#journey-configure-form');
    for (const key of ['serviceType', 'tripType']) configure?.querySelector<HTMLSelectElement>(`[name="${key}"]`)?.addEventListener('change', () => { this.config = readJourneyForm(configure!, this.config); this.render(); });
    if (configure && ['flights', 'hotels'].includes(this.product.productType)) {
      for (const key of ['origin', 'destination', 'departureDate', 'returnDate', 'adults', 'children', 'infants', 'rooms', 'tripType', 'cabinClass']) {
        const input = configure.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]`);
        if (input instanceof HTMLInputElement) input.readOnly = true;
        else if (input) input.disabled = true;
      }
    }
    configure?.addEventListener('submit', event => { event.preventDefault(); this.config = readJourneyForm(configure, this.config); void this.stage(configure); });
    this.host.querySelector<HTMLInputElement>('#journey-price-consent')?.addEventListener('change', event => { this.config = readJourneyForm(configure!, this.config); this.acceptedChangedPrice = (event.target as HTMLInputElement).checked; this.render(); });
  }

  private async stage(form: HTMLFormElement): Promise<void> {
    if (!this.selectedOffer || this.busy) return;
    const offer = this.selectedOffer;
    if (this.product.productType === 'insurance') this.config.policyReviewAcknowledged = !!form.querySelector<HTMLInputElement>('#journey-policy-confirm')?.checked;
    const config = { ...this.config };
    const generation = this.currentRequest;
    const errors = validateJourneyConfiguration(this.product.productType, this.config, true);
    if (this.product.productType === 'insurance' && !form.querySelector<HTMLInputElement>('#journey-policy-confirm')?.checked) errors.policy = 'Review and acknowledge the actual policy terms before continuing.';
    if (this.product.productType === 'insurance' && offer.inventoryMode !== 'demo_fixture' && !journeyProductDetails(offer).policyWordingUrl) errors.policy = 'The actual policy wording is not supplied. Request it before continuing.';
    if (Object.keys(errors).length) { this.message = Object.values(errors).join(' '); this.render(); return; }
    this.busy = true; this.message = ''; this.render();
    try {
      const quote = await journeyService.revalidate(journeyOfferId(offer));
      if (generation !== this.currentRequest) return;
      const accepted = this.acceptedChangedPrice && this.quote?.currentPrice === quote.currentPrice;
      this.quote = quote;
      if (quote.status === 'PRICE_CHANGED' && !accepted) { this.acceptedChangedPrice = false; return; }
      if (!['UNCHANGED', 'PRICE_CHANGED', 'VALID', 'AVAILABLE'].includes(quote.status)) {
        this.message = quote.message || 'This option requires a new availability check or another selection. Please search again.';
        return;
      }
      if (quote.status === 'PRICE_CHANGED') config.acceptedPriceMinor = quote.currentPrice;
      const result = await journeyService.stage(offer, config);
      if (generation !== this.currentRequest) return;
      const item = result.item;
      if (!item) throw new Error('The selection could not be saved. Please retry.');
      this.staged = true;
      try { if (offer.inventoryMode !== 'demo_fixture') await refreshServerTripBucket(); }
      catch { this.message = 'Your selection was saved. Open trip review to reload the latest summary.'; }
    } catch (error) { this.message = error instanceof Error ? error.message : 'We could not save your selection. Please retry.'; }
    finally { if (generation === this.currentRequest) { this.busy = false; this.render(); } }
  }
}

export const productWorkspace = new ProductWorkspace();
