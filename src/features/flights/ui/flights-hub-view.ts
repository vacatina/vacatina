/* ============================================================================
 * Vacatina Dedicated Flights Product Hub View (/flights)
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§9, §11, §12, §13)
 * ============================================================================ */

import type { FlightLocation } from '../domain/flight-models.ts';
import type {
  FlightLegRequest,
  FlightSearchRequest,
  FlightTripType
} from '../domain/search-models.ts';
import {
  findAirportByCode,
  formatAirportDisplay,
  parseAirportFromInput
} from '../data/airports.ts';
import { flightSearchService } from '../services/flight-search.service.ts';
import {
  renderTravellerSelectorPopover,
  formatTravellerSummaryText,
  type TravellerSelectorState
} from './reusable-traveller-selector.ts';
import { initAirportAutocomplete } from './airport-autocomplete.ts';
import { normalizeFlightDate } from '../domain/flight-search-query.ts';
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { showToast } from '../../../components/ui/toast.ts';

export class FlightsHubView {
  private currentTripType: FlightTripType = 'round_trip';
  private originLocation: FlightLocation = findAirportByCode('CMB')!;
  private destinationLocation: FlightLocation = findAirportByCode('DXB')!;
  private departureDate: string = '';
  private returnDate: string = '';
  private multiCityLegs: FlightLegRequest[] = [];
  private travellerState: TravellerSelectorState = {
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: 'economy'
  };
  private directOnly = false;
  private nearbyAirports = false;

  constructor() {
    // Set default dates to +7 days and +14 days
    const today = new Date();
    const d1 = new Date(today.getTime() + 7 * 86400000);
    const d2 = new Date(today.getTime() + 14 * 86400000);
    this.departureDate = d1.toISOString().split('T')[0];
    this.returnDate = d2.toISOString().split('T')[0];

    // Default multi-city legs
    this.multiCityLegs = [
      {
        legIndex: 0,
        origin: findAirportByCode('CMB')!,
        destination: findAirportByCode('DXB')!,
        departureDate: this.departureDate
      },
      {
        legIndex: 1,
        origin: findAirportByCode('DXB')!,
        destination: findAirportByCode('LHR')!,
        departureDate: this.returnDate
      }
    ];
  }

  public prefill(fromCode?: string, toCode?: string): void {
    if (fromCode) {
      const found = findAirportByCode(fromCode);
      if (found) this.originLocation = found;
    }
    if (toCode) {
      const found = findAirportByCode(toCode);
      if (found) this.destinationLocation = found;
    }
  }

  /** Hydrates the hub from the same canonical query names used by search. */
  public prefillFromQuery(query: URLSearchParams): void {
    const from = query.get('origin') || query.get('from');
    const to = query.get('destination') || query.get('to');
    if (from) {
      const found = parseAirportFromInput(from);
      if (found) this.originLocation = found;
    }
    if (to) {
      const found = parseAirportFromInput(to);
      if (found) this.destinationLocation = found;
    }

    const rawTripType = (query.get('tripType') || query.get('trip') || '').toLowerCase();
    if (rawTripType === 'one_way' || rawTripType === 'one-way') this.currentTripType = 'one_way';
    else if (rawTripType === 'multi_city' || rawTripType === 'multi-city') this.currentTripType = 'multi_city';
    else if (rawTripType === 'round_trip' || rawTripType === 'round-trip') this.currentTripType = 'round_trip';

    const departure = normalizeFlightDate(query.get('departureDate') || query.get('dep') || '');
    if (departure) this.departureDate = departure;
    const returnValue = normalizeFlightDate(query.get('returnDate') || query.get('ret') || '');
    if (returnValue) this.returnDate = returnValue;

    const adults = Number(query.get('adults'));
    const children = Number(query.get('children'));
    const infants = Number(query.get('infants'));
    if (Number.isInteger(adults) && adults > 0) this.travellerState.adults = adults;
    if (Number.isInteger(children) && children >= 0) this.travellerState.children = children;
    if (Number.isInteger(infants) && infants >= 0) this.travellerState.infants = infants;

    const rawCabin = (query.get('cabinClass') || query.get('cabin') || '').trim().toLowerCase();
    if (rawCabin.includes('business')) this.travellerState.cabinClass = 'business';
    else if (rawCabin.includes('first')) this.travellerState.cabinClass = 'first';
    else if (rawCabin.includes('premium')) this.travellerState.cabinClass = 'premium_economy';
    else if (rawCabin) this.travellerState.cabinClass = 'economy';

    this.directOnly = ['true', '1', 'yes'].includes((query.get('directOnly') || '').toLowerCase());
    this.nearbyAirports = ['true', '1', 'yes'].includes((query.get('nearbyAirports') || '').toLowerCase());

    this.multiCityLegs[0] = {
      legIndex: 0,
      origin: this.originLocation,
      destination: this.destinationLocation,
      departureDate: this.departureDate
    };
    if (this.multiCityLegs.length > 1) {
      this.multiCityLegs[1] = {
        ...this.multiCityLegs[1],
        legIndex: 1,
        departureDate: this.returnDate >= this.departureDate ? this.returnDate : this.departureDate
      };
    }
  }

  public render(container: HTMLElement): void {
    telemetry.track('flights_hub_viewed', {
      origin: this.originLocation.airportCode,
      destination: this.destinationLocation.airportCode
    });

    container.innerHTML = `
      <div id="flights-hub-page" class="w-full bg-white text-brand-black pb-16 animate-fade-in">
        <!-- Hero Header -->
        <section class="bg-brand-primary text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8">
          <div class="max-w-6xl mx-auto">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90 mb-3 border border-white/15">
                  <svg class="w-3.5 h-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                  Flights · Request-to-book preview
                </span>
                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display animate-slide-up">
                  Find &amp; Configure Your Ideal Flight
                </h1>
                <p class="mt-2 text-sm sm:text-base text-white/80 max-w-2xl font-sans">
                  Compare available flight schedules and request-to-book options with clear baggage and fare conditions. Live airline supplier inventory is activated when connected.
                </p>
                <p class="mt-3 inline-flex items-start gap-2 text-xs text-white/75 max-w-2xl">
                  <span class="mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/20 text-amber-100 border border-amber-200/40 shrink-0">Disclosure</span>
                  <span>Available flight options are shown for planning purposes. Request-to-book options remain on request until the Vacatina flight desk confirms carrier, schedule, baggage and fare. No seat hold or ticketing is created by searching or staging.</span>
                </p>
              </div>
              <div class="hidden md:flex items-center gap-3">
                <a href="/favorites" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                  Saved Routes
                </a>
              </div>
            </div>

            <!-- Search Command Panel Container -->
            <div class="bg-white rounded-2xl p-5 sm:p-6 shadow-xl text-brand-black border border-gray-100 animate-slide-up">
              <!-- Trip Type Selector -->
              <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-5">
                <div class="inline-flex p-1 bg-gray-100 rounded-xl" role="radiogroup" aria-label="Trip type selection">
                  <button type="button" data-trip="round_trip" class="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${this.currentTripType === 'round_trip' ? 'bg-white text-brand-primary shadow-sm font-bold scale-[1.02]' : 'text-brand-muted hover:text-brand-primary hover:bg-white/50'}">Round Trip</button>
                  <button type="button" data-trip="one_way" class="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${this.currentTripType === 'one_way' ? 'bg-white text-brand-primary shadow-sm font-bold scale-[1.02]' : 'text-brand-muted hover:text-brand-primary hover:bg-white/50'}">One Way</button>
                  <button type="button" data-trip="multi_city" class="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${this.currentTripType === 'multi_city' ? 'bg-white text-brand-primary shadow-sm font-bold scale-[1.02]' : 'text-brand-muted hover:text-brand-primary hover:bg-white/50'}">Multi-City</button>
                </div>

                <!-- Traveller & Cabin Trigger -->
                <div class="relative">
                  <button type="button" id="btn-hub-travellers-trigger" class="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-brand-black flex items-center gap-2 transition-colors" aria-haspopup="true" aria-expanded="false">
                    <svg class="w-4 h-4 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    <span id="hub-travellers-label">${formatTravellerSummaryText(this.travellerState)}</span>
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  <div id="hub-traveller-popover" class="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 hidden">
                    <div id="hub-traveller-popover-content"></div>
                  </div>
                </div>
              </div>

              <!-- Standard Route Fields (Round Trip & One Way) -->
              <div id="hub-standard-search-grid" class="${this.currentTripType === 'multi_city' ? 'hidden' : 'grid grid-cols-1 md:grid-cols-12 gap-3 items-center'}">
                <!-- Origin -->
                <div class="md:col-span-4" id="origin-container">
                  <label for="hub-flight-origin" class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">From (Origin)</label>
                  <input type="text" id="hub-flight-origin" value="${formatAirportDisplay(this.originLocation)}" class="w-full h-12 px-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-brand-black focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all" placeholder="City or airport code">
                </div>

                <!-- Swap Button -->
                <div class="md:col-span-1 flex items-center justify-center pt-2 md:pt-5">
                  <button type="button" id="hub-swap-btn" class="w-10 h-10 rounded-full border border-gray-200 hover:border-brand-primary bg-white hover:bg-brand-primary/5 flex items-center justify-center text-brand-muted hover:text-brand-primary transition-all shadow-sm" aria-label="Swap departure and arrival airports">
                    <svg class="w-4 h-4 transition-transform duration-200" id="hub-swap-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                    </svg>
                  </button>
                </div>

                <!-- Destination -->
                <div class="md:col-span-4" id="dest-container">
                  <label for="hub-flight-dest" class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">To (Destination)</label>
                  <input type="text" id="hub-flight-dest" value="${formatAirportDisplay(this.destinationLocation)}" class="w-full h-12 px-3.5 rounded-xl border border-gray-200 text-sm font-semibold text-brand-black focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all" placeholder="City or airport code">
                </div>

                <!-- Dates -->
                <div class="md:col-span-3">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="hub-dep-date" class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">Departure</label>
                      <input type="date" id="hub-dep-date" value="${this.departureDate}" class="w-full h-12 px-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-brand-black focus:border-brand-primary outline-none">
                    </div>
                    <div id="hub-ret-col" class="${this.currentTripType === 'one_way' ? 'opacity-40 pointer-events-none' : ''}">
                      <label for="hub-ret-date" class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">Return</label>
                      <input type="date" id="hub-ret-date" value="${this.returnDate}" class="w-full h-12 px-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-brand-black focus:border-brand-primary outline-none">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Multi-City Legs Container -->
              <div id="hub-multi-city-container" class="${this.currentTripType === 'multi_city' ? 'space-y-3' : 'hidden'}">
                <div id="hub-mc-legs-list" class="space-y-3"></div>
                <button type="button" id="btn-add-mc-leg" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-primary hover:bg-brand-primary/5 rounded-lg border border-dashed border-brand-primary/40 transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Add Flight Leg
                </button>
              </div>

              <!-- Error Alert Area -->
              <div id="hub-search-alert" class="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 hidden" role="alert" aria-live="polite"></div>

              <!-- Preferences & Actions Bar -->
              <div class="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-gray-100">
                <div class="flex items-center gap-4 text-xs font-medium text-brand-muted">
                  <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" id="chk-direct-only" ${this.directOnly ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300 focus:ring-brand-primary">
                    <span>Direct flights only</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" id="chk-nearby-airports" ${this.nearbyAirports ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300 focus:ring-brand-primary">
                    <span>Include nearby airports</span>
                  </label>
                </div>

                <button type="button" id="btn-hub-search-submit" class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-primary text-white text-sm font-bold shadow-lg shadow-brand-primary/20 hover:bg-opacity-95 transition-all flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  Search Flights
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Popular Routes from Colombo Discovery -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 animate-slide-up">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-xl sm:text-2xl font-bold font-display text-brand-black">Popular routes from Colombo</h2>
              <p class="text-xs sm:text-sm text-brand-muted">Route cards for available flight options. Schedules, carriers and fares shown here are subject to confirmation.</p>
            </div>
            <a href="/flights/explore" class="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1">
              View all routes &rarr;
            </a>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Dubai -->
            <div class="p-4 rounded-2xl border border-gray-200 hover:border-brand-primary/40 hover:shadow-md transition-all bg-white flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted mb-2">
                  <span>CMB → DXB</span>
                  <span class="font-bold text-brand-primary text-right">Reference · Non-Stop · 4h 45m</span>
                </div>
                <div class="text-base font-bold text-brand-black">Dubai, UAE</div>
                <div class="text-xs text-brand-muted mt-1">Emirates, Flydubai, SriLankan</div>
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-brand-muted block">Fare guide (reference)</span>
                  <span class="text-sm font-extrabold text-brand-black tabular-nums">LKR 98,500</span>
                </div>
                <button type="button" data-prefill-route="CMB-DXB" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                  Select
                </button>
              </div>
            </div>

            <!-- Card 2: Maldives -->
            <div class="p-4 rounded-2xl border border-gray-200 hover:border-brand-primary/40 hover:shadow-md transition-all bg-white flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted mb-2">
                  <span>CMB → MLE</span>
                  <span class="font-bold text-brand-primary text-right">Reference · Non-Stop · 1h 25m</span>
                </div>
                <div class="text-base font-bold text-brand-black">Malé, Maldives</div>
                <div class="text-xs text-brand-muted mt-1">SriLankan, Emirates, Maldivian</div>
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-brand-muted block">Fare guide (reference)</span>
                  <span class="text-sm font-extrabold text-brand-black tabular-nums">LKR 78,000</span>
                </div>
                <button type="button" data-prefill-route="CMB-MLE" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                  Select
                </button>
              </div>
            </div>

            <!-- Card 3: Singapore -->
            <div class="p-4 rounded-2xl border border-gray-200 hover:border-brand-primary/40 hover:shadow-md transition-all bg-white flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted mb-2">
                  <span>CMB → SIN</span>
                  <span class="font-bold text-brand-primary text-right">Reference · Non-Stop · 4h 05m</span>
                </div>
                <div class="text-base font-bold text-brand-black">Singapore</div>
                <div class="text-xs text-brand-muted mt-1">Singapore Airlines, SriLankan</div>
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-brand-muted block">Fare guide (reference)</span>
                  <span class="text-sm font-extrabold text-brand-black tabular-nums">LKR 68,500</span>
                </div>
                <button type="button" data-prefill-route="CMB-SIN" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                  Select
                </button>
              </div>
            </div>

            <!-- Card 4: London -->
            <div class="p-4 rounded-2xl border border-gray-200 hover:border-brand-primary/40 hover:shadow-md transition-all bg-white flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted mb-2">
                  <span>CMB → LHR</span>
                  <span class="font-bold text-brand-primary text-right">Reference · Non-Stop &amp; 1-Stop</span>
                </div>
                <div class="text-base font-bold text-brand-black">London, UK</div>
                <div class="text-xs text-brand-muted mt-1">SriLankan, Qatar, Emirates</div>
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-brand-muted block">Fare guide (reference)</span>
                  <span class="text-sm font-extrabold text-brand-black tabular-nums">LKR 248,500</span>
                </div>
                <button type="button" data-prefill-route="CMB-LHR" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                  Select
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Inventory Truth & Guidance Module -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 animate-slide-up">
          <div class="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200">
            <h3 class="text-lg font-bold font-display text-brand-black mb-1">How this build handles flight inventory</h3>
            <p class="text-xs text-brand-muted mb-4">No live supplier, seat hold, payment or ticketing is activated in this phase.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="space-y-1">
                <div class="text-sm font-bold text-brand-primary">Available options are labelled</div>
                <p class="text-xs text-brand-muted leading-relaxed">
                  Schedules, fares, baggage and fare-family benefits shown are planning references only. They are never presented as confirmed live airline inventory.
                </p>
              </div>
              <div class="space-y-1">
                <div class="text-sm font-bold text-brand-primary">Request-to-book stays on request</div>
                <p class="text-xs text-brand-muted leading-relaxed">
                  Manual options remain Needs Action in your Trip Bucket. The Vacatina flight desk must confirm carrier, schedule, baggage and fare before any ticketing.
                </p>
              </div>
              <div class="space-y-1">
                <div class="text-sm font-bold text-brand-primary">No silent bookings</div>
                <p class="text-xs text-brand-muted leading-relaxed">
                  Staging an option creates no reservation or seat hold. Review every item and its inventory source in the Trip Bucket before deciding what to request.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    this.wireEvents(container);
  }

  private wireEvents(container: HTMLElement): void {
    // 1. Trip type switches
    container.querySelectorAll<HTMLButtonElement>('button[data-trip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentTripType = btn.getAttribute('data-trip') as FlightTripType;
        this.render(container);
      });
    });

    // 2. Autocomplete for Origin
    const originInput = container.querySelector<HTMLInputElement>('#hub-flight-origin');
    const originContainer = container.querySelector<HTMLElement>('#origin-container');
    if (originInput && originContainer) {
      initAirportAutocomplete({
        inputElement: originInput,
        containerElement: originContainer,
        onSelect: (loc) => {
          this.originLocation = loc;
        }
      });
    }

    // 3. Autocomplete for Destination
    const destInput = container.querySelector<HTMLInputElement>('#hub-flight-dest');
    const destContainer = container.querySelector<HTMLElement>('#dest-container');
    if (destInput && destContainer) {
      initAirportAutocomplete({
        inputElement: destInput,
        containerElement: destContainer,
        onSelect: (loc) => {
          this.destinationLocation = loc;
        }
      });
    }

    // 4. Swap button
    const swapBtn = container.querySelector<HTMLButtonElement>('#hub-swap-btn');
    const swapIcon = container.querySelector<HTMLElement>('#hub-swap-icon');
    let swappedRot = false;
    if (swapBtn && originInput && destInput) {
      swapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        swappedRot = !swappedRot;
        if (swapIcon) swapIcon.style.transform = swappedRot ? 'rotate(180deg)' : 'rotate(0deg)';

        const temp = this.originLocation;
        this.originLocation = this.destinationLocation;
        this.destinationLocation = temp;

        originInput.value = formatAirportDisplay(this.originLocation);
        destInput.value = formatAirportDisplay(this.destinationLocation);

        showToast(`Swapped: ${this.originLocation.airportCode} ↔ ${this.destinationLocation.airportCode}`, 'brand');
      });
    }

    // 5. Date inputs
    const depDateInput = container.querySelector<HTMLInputElement>('#hub-dep-date');
    if (depDateInput) {
      depDateInput.addEventListener('change', () => {
        this.departureDate = depDateInput.value;
      });
    }
    const retDateInput = container.querySelector<HTMLInputElement>('#hub-ret-date');
    if (retDateInput) {
      retDateInput.addEventListener('change', () => {
        this.returnDate = retDateInput.value;
      });
    }

    // 6. Traveller popover
    const travellerTrigger = container.querySelector<HTMLButtonElement>('#btn-hub-travellers-trigger');
    const travellerPopover = container.querySelector<HTMLElement>('#hub-traveller-popover');
    if (travellerTrigger && travellerPopover) {
      travellerTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = travellerPopover.classList.contains('hidden');
        if (isHidden) {
          travellerPopover.classList.remove('hidden');
          travellerTrigger.setAttribute('aria-expanded', 'true');
          renderTravellerSelectorPopover(
            this.travellerState,
            {
              onChange: (newState) => {
                this.travellerState = newState;
                const label = container.querySelector<HTMLElement>('#hub-travellers-label');
                if (label) label.textContent = formatTravellerSummaryText(newState);
              },
              onClose: () => {
                travellerPopover.classList.add('hidden');
                travellerTrigger.setAttribute('aria-expanded', 'false');
              }
            },
            'hub-traveller-popover-content'
          );
        } else {
          travellerPopover.classList.add('hidden');
          travellerTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('click', (e) => {
        if (!travellerPopover.contains(e.target as Node) && e.target !== travellerTrigger) {
          travellerPopover.classList.add('hidden');
          travellerTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // 7. Multi-city legs renderer
    if (this.currentTripType === 'multi_city') {
      this.renderMultiCityLegs(container);
    }

    // 8. Prefill route buttons
    container.querySelectorAll<HTMLButtonElement>('button[data-prefill-route]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const route = btn.getAttribute('data-prefill-route');
        if (route === 'CMB-DXB') this.prefill('CMB', 'DXB');
        if (route === 'CMB-MLE') this.prefill('CMB', 'MLE');
        if (route === 'CMB-SIN') this.prefill('CMB', 'SIN');
        if (route === 'CMB-LHR') this.prefill('CMB', 'LHR');
        this.render(container);
        container.querySelector('#flights-hub-page')?.scrollIntoView({ behavior: 'smooth' });
        showToast(`Prefilled route ${route}. Select travel dates.`, 'brand');
      });
    });

    // 9. Search submission button
    const submitBtn = container.querySelector<HTMLButtonElement>('#btn-hub-search-submit');
    const alertEl = container.querySelector<HTMLElement>('#hub-search-alert');

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (this.currentTripType === 'multi_city') {
          this.syncMultiCityLegsFromInputs(container);
          this.multiCityLegs.forEach((leg, index) => { leg.legIndex = index; });
        }

        const legs =
          this.currentTripType === 'multi_city'
            ? this.multiCityLegs.map((leg, index) => ({ ...leg, legIndex: index }))
            : undefined;
        const primaryOrigin = legs?.[0]?.origin || this.originLocation;
        const primaryDestination = legs?.[legs.length - 1]?.destination || this.destinationLocation;
        const primaryDepartureDate = legs?.[0]?.departureDate || this.departureDate;

        const searchReq: Partial<FlightSearchRequest> = {
          searchId: `srch-${Date.now()}`,
          tripType: this.currentTripType,
          origin: primaryOrigin,
          destination: primaryDestination,
          departureDate: primaryDepartureDate,
          returnDate: this.currentTripType === 'round_trip' ? this.returnDate : undefined,
          legs,
          travellers: {
            adults: this.travellerState.adults,
            children: this.travellerState.children,
            infants: this.travellerState.infants
          },
          cabinClass: this.travellerState.cabinClass,
          directFlightsOnly: this.directOnly,
          nearbyAirports: this.nearbyAirports,
          displayCurrency: 'LKR',
          locale: 'en'
        };

        const validation = flightSearchService.validateSearchRequest(searchReq);

        if (!validation.isValid) {
          if (alertEl) {
            const firstErr = Object.values(validation.errors)[0];
            alertEl.textContent = firstErr;
            alertEl.classList.remove('hidden');
          }
          showToast(Object.values(validation.errors)[0], 'warning');
          return;
        }

        if (alertEl) alertEl.classList.add('hidden');

        // Construct the canonical replayable search query.
        const params = new URLSearchParams();
        params.set('tripType', this.currentTripType);
        params.set('origin', primaryOrigin.airportCode);
        params.set('destination', primaryDestination.airportCode);
        params.set('departureDate', primaryDepartureDate);
        if (this.currentTripType === 'round_trip' && this.returnDate) {
          params.set('returnDate', this.returnDate);
        }
        if (legs) {
          legs.forEach(leg => {
            params.append(
              'leg',
              `${leg.origin.airportCode}-${leg.destination.airportCode}-${leg.departureDate}`
            );
          });
        }
        params.set('adults', String(this.travellerState.adults));
        params.set('children', String(this.travellerState.children));
        params.set('infants', String(this.travellerState.infants));
        params.set('cabinClass', this.travellerState.cabinClass);
        if (this.directOnly) params.set('directOnly', 'true');
        if (this.nearbyAirports) params.set('nearbyAirports', 'true');

        telemetry.track('flight_search_submitted', {
          tripType: this.currentTripType,
          origin: primaryOrigin.airportCode,
          destination: primaryDestination.airportCode
        });

        routerService.navigateTo(`/flights/search?${params.toString()}`);
      });
    }
  }

  private syncMultiCityLegsFromInputs(container: HTMLElement): void {
    const list = container.querySelector<HTMLElement>('#hub-mc-legs-list');
    if (!list) return;

    list.querySelectorAll<HTMLInputElement>('[data-mc-origin]').forEach(input => {
      const idx = parseInt(input.getAttribute('data-mc-origin') || '0', 10);
      const parsed = parseAirportFromInput(input.value);
      if (parsed) this.multiCityLegs[idx].origin = parsed;
    });
    list.querySelectorAll<HTMLInputElement>('[data-mc-dest]').forEach(input => {
      const idx = parseInt(input.getAttribute('data-mc-dest') || '0', 10);
      const parsed = parseAirportFromInput(input.value);
      if (parsed) this.multiCityLegs[idx].destination = parsed;
    });
    list.querySelectorAll<HTMLInputElement>('[data-mc-date]').forEach(input => {
      const idx = parseInt(input.getAttribute('data-mc-date') || '0', 10);
      if (input.value) this.multiCityLegs[idx].departureDate = input.value;
    });
  }

  private renderMultiCityLegs(container: HTMLElement): void {
    const list = container.querySelector<HTMLElement>('#hub-mc-legs-list');
    if (!list) return;

    list.innerHTML = this.multiCityLegs
      .map(
        (leg, idx) => `
        <div class="p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div class="md:col-span-1 text-xs font-bold text-brand-primary">Leg ${idx + 1}</div>
          <div class="md:col-span-4">
            <input type="text" data-mc-origin="${idx}" value="${formatAirportDisplay(leg.origin)}" aria-label="Leg ${idx + 1} origin airport" class="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-semibold" placeholder="Origin city or code">
          </div>
          <div class="md:col-span-4">
            <input type="text" data-mc-dest="${idx}" value="${formatAirportDisplay(leg.destination)}" aria-label="Leg ${idx + 1} destination airport" class="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-semibold" placeholder="Destination city or code">
          </div>
          <div class="md:col-span-2">
            <input type="date" data-mc-date="${idx}" value="${leg.departureDate}" aria-label="Leg ${idx + 1} departure date" class="w-full h-10 px-2 rounded-lg border border-gray-200 text-xs font-semibold">
          </div>
          <div class="md:col-span-1 text-right">
            ${
              this.multiCityLegs.length > 2
                ? `<button type="button" data-remove-mc-leg="${idx}" class="text-xs text-red-600 hover:underline font-bold" aria-label="Remove leg ${idx + 1}">Remove</button>`
                : ''
            }
          </div>
        </div>
      `
      )
      .join('');

    // Wire leg field edits (airport parsing + date sync)
    list.querySelectorAll<HTMLInputElement>('[data-mc-origin]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-mc-origin') || '0', 10);
        const parsed = parseAirportFromInput(input.value);
        if (!parsed) {
          input.setAttribute('aria-invalid', 'true');
          showToast(`Leg ${idx + 1}: choose a recognised origin airport from the suggestions.`, 'warning');
          return;
        }
        input.removeAttribute('aria-invalid');
        this.multiCityLegs[idx].origin = parsed;
        input.value = formatAirportDisplay(parsed);
      });
    });

    list.querySelectorAll<HTMLInputElement>('[data-mc-dest]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-mc-dest') || '0', 10);
        const parsed = parseAirportFromInput(input.value);
        if (!parsed) {
          input.setAttribute('aria-invalid', 'true');
          showToast(`Leg ${idx + 1}: choose a recognised destination airport from the suggestions.`, 'warning');
          return;
        }
        input.removeAttribute('aria-invalid');
        this.multiCityLegs[idx].destination = parsed;
        input.value = formatAirportDisplay(parsed);
      });
    });

    list.querySelectorAll<HTMLInputElement>('[data-mc-date]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.getAttribute('data-mc-date') || '0', 10);
        if (input.value) this.multiCityLegs[idx].departureDate = input.value;
      });
    });

    // Wire Remove Leg
    list.querySelectorAll<HTMLButtonElement>('button[data-remove-mc-leg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-remove-mc-leg') || '0', 10);
        if (this.multiCityLegs.length > 2) {
          this.multiCityLegs.splice(idx, 1);
          this.multiCityLegs.forEach((leg, index) => { leg.legIndex = index; });
          this.renderMultiCityLegs(container);
        }
      });
    });

    // Wire Add Leg
    const addLegBtn = container.querySelector<HTMLButtonElement>('#btn-add-mc-leg');
    if (addLegBtn) {
      addLegBtn.onclick = (e) => {
        e.stopPropagation();
        if (this.multiCityLegs.length < 5) {
          const lastLeg = this.multiCityLegs[this.multiCityLegs.length - 1];
          const newDate = new Date(new Date(lastLeg.departureDate).getTime() + 3 * 86400000)
            .toISOString()
            .split('T')[0];
          this.multiCityLegs.push({
            legIndex: this.multiCityLegs.length,
            origin: lastLeg.destination,
            destination: findAirportByCode('SIN')!,
            departureDate: newDate
          });
          this.renderMultiCityLegs(container);
        } else {
          showToast('Maximum 5 flight legs allowed.', 'warning');
        }
      };
    }
  }
}

export const flightsHubView = new FlightsHubView();
