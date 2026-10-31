declare const __VACATINA_PUBLIC_DEMO_BUILD__: boolean;
declare const __VACATINA_PREVIEW_BUILD__: boolean;
/* ============================================================================
 * Vacatina Canonical Flight Search Results View (/flights/search)
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§14–§19, §31–§33, §38)
 * ============================================================================ */

import type { CanonicalFlightOffer } from '../domain/flight-models.ts';
import type {
  FlightFilterCriteria,
  FlightSearchRequest,
  FlightSearchResponse,
  FlightSortOption
} from '../domain/search-models.ts';
import { flightSearchService } from '../services/flight-search.service.ts';
import { flightFavoritesService } from '../services/flight-favorites.service.ts';
import { flightTripBucketService } from '../services/flight-trip-bucket.service.ts';
import {
  findAirportByCode,
  formatAirportDisplay,
  formatAirportShort,
  parseAirportFromInput
} from '../data/airports.ts';
import {
  buildFlightSearchQuery,
  normalizeFlightDate,
  parseFlightSearchQuery
} from '../domain/flight-search-query.ts';
import { resolveFlightInventoryTruth } from '../domain/flight-inventory-truth.ts';
import { rememberFlightSearchQuery } from '../domain/flight-search-context.ts';
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { showToast } from '../../../components/ui/toast.ts';
import { openCanonicalFlightDetailModal } from './flights-offer-detail-modal.ts';
import {
  duffelSandboxFlightAdapter,
  type SandboxStatus
} from '../adapters/duffel-sandbox-flight.adapter.ts';

function sandboxStatusMessage(status: SandboxStatus): string {
  switch (status.reason) {
    case 'ENABLED': return '';
    case 'TEST_MODE_FLAG_DISABLED':
      return 'Duffel TEST MODE is disabled on this server. A developer must enable it with a sandbox credential.';
    case 'TEST_TOKEN_REQUIRED':
      return 'Duffel TEST MODE requires a sandbox access token configured on the server.';
    case 'LIVE_TOKEN_BLOCKED':
      return 'A live Duffel credential is configured. TEST MODE refuses to use live credentials.';
    case 'PRODUCTION_RUNTIME_BLOCKED':
      return 'Duffel TEST MODE is unavailable in the production runtime.';
    case 'LIVE_ENV_BLOCKED':
      return 'Duffel is configured for live mode. TEST MODE is sandbox-only and cannot be activated.';
    default:
      return 'Duffel TEST MODE is not available on this server.';
  }
}

export class FlightsSearchView {
  private currentRequest!: FlightSearchRequest;
  private currentResponse: FlightSearchResponse | null = null;
  private currentSort: FlightSortOption = 'recommended';
  private currentFilters: FlightFilterCriteria = {};
  private isLoading = false;
private holdLoading = false;
  private showAdvanceLoading = false;  private errorMessage: string | null = null;
  private validationErrors: Record<string, string> = {};
  private isModifyOpen = false;
  private sandboxStatus: SandboxStatus | null = null;

  public async loadFromQuery(query: URLSearchParams, container: HTMLElement): Promise<void> {
    const previewBuild = typeof __VACATINA_PREVIEW_BUILD__ !== 'undefined' && __VACATINA_PREVIEW_BUILD__;
    const galleryFlag = (() => { try { return sessionStorage.getItem('vacatina:gallery') === '1'; } catch { return false; } })();
    this.holdLoading = (!__VACATINA_PUBLIC_DEMO_BUILD__ || previewBuild || galleryFlag) && query.get('qaHoldLoading') === '1';
    const parsed = parseFlightSearchQuery(query);
    this.currentResponse = null;
    this.currentSort = 'recommended';
    this.currentFilters = {};
    this.errorMessage = null;

    const validation = flightSearchService.validateSearchRequest(this.currentRequest);
    this.validationErrors = { ...parsed.errors, ...validation.errors };

    if (Object.keys(this.validationErrors).length > 0) {
      this.isLoading = false;
      this.render(container);
      return;
    }

    rememberFlightSearchQuery(buildFlightSearchQuery(this.currentRequest));
    flightTripBucketService.rememberSearchContext(this.currentRequest);
    await this.executeSearch(container);
  }

  public async executeSearch(container: HTMLElement): Promise<void> {
    const validation = flightSearchService.validateSearchRequest(this.currentRequest);
    this.validationErrors = { ...validation.errors };

    if (Object.keys(this.validationErrors).length > 0) {
      this.isLoading = false;
      this.errorMessage = null;
      this.currentResponse = null;
      this.render(container);
      return;
    }

    if (this.holdLoading) {
      this.holdLoading = false;
      this.showAdvanceLoading = true;
      this.isLoading = true;
      this.errorMessage = null;
      this.currentResponse = null;
      this.render(container);
      const advance = container.querySelector('#btn-advance-loading');
      advance?.addEventListener('click', () => {
        this.showAdvanceLoading = false;
        this.executeSearch(container);
      });
      return;
    }
    this.showAdvanceLoading = false;
    rememberFlightSearchQuery(buildFlightSearchQuery(this.currentRequest));
    flightTripBucketService.rememberSearchContext(this.currentRequest);
    this.isLoading = true;
    this.errorMessage = null;
    this.render(container);

    if (this.currentRequest.inventorySource === 'sandbox_test') {
      try {
        this.sandboxStatus = await duffelSandboxFlightAdapter.getStatus();
        if (!this.sandboxStatus.enabled) {
          this.isLoading = false;
          this.errorMessage = sandboxStatusMessage(this.sandboxStatus);
          this.currentResponse = null;
          this.render(container);
          return;
        }
      } catch (err) {
        this.isLoading = false;
        this.errorMessage = (err as Error).message || 'Duffel TEST MODE status could not be loaded.';
        this.currentResponse = null;
        this.render(container);
        return;
      }
    } else {
      this.sandboxStatus = null;
    }

    try {
      this.currentResponse = await flightSearchService.search(
        this.currentRequest,
        this.currentSort,
        this.currentFilters
      );
      this.isLoading = false;

      telemetry.track('flight_results_loaded', {
        searchId: this.currentRequest.searchId,
        source: this.currentRequest.inventorySource || 'demo_fixture',
        total: this.currentResponse.totalCount,
        filtered: this.currentResponse.filteredCount
      });
    } catch (err) {
      this.isLoading = false;
      this.errorMessage = (err as Error).message || 'Failed to retrieve flight options. Please retry.';
    }

    this.render(container);
  }

  public render(container: HTMLElement): void {
    if (!this.currentRequest) return;

    const req = this.currentRequest;
    const resp = this.currentResponse;
    const validationEntries = Object.entries(this.validationErrors);
    const hasValidationErrors = validationEntries.length > 0;
    const demoCount = resp ? resp.offers.filter(o => resolveFlightInventoryTruth(o).isDemo).length : 0;
    const manualCount = resp ? resp.offers.filter(o => resolveFlightInventoryTruth(o).isManual).length : 0;
    const liveCount = resp ? resp.offers.filter(o => resolveFlightInventoryTruth(o).isLive).length : 0;
    const sandboxCount = resp ? resp.offers.filter(o => resolveFlightInventoryTruth(o).isSandbox).length : 0;
    const isSandboxLane = req.inventorySource === 'sandbox_test';

    const fromLabel = formatAirportShort(req.origin);
    const toLabel = formatAirportShort(req.destination);
    const dateRange = req.tripType === 'round_trip' && req.returnDate
      ? `${req.departureDate} ↔ ${req.returnDate}`
      : `${req.departureDate} (One Way)`;
    const paxSummary = `${req.travellers.adults} Adult${req.travellers.adults > 1 ? 's' : ''}${req.travellers.children > 0 ? `, ${req.travellers.children} Child` : ''} · ${req.cabinClass.charAt(0).toUpperCase() + req.cabinClass.slice(1)}`;

    container.innerHTML = `
      <div id="flights-search-results-page" class="w-full bg-brand-surface min-h-screen text-brand-black pb-20 animate-fade-in">
        <h1 class="sr-only">Flight search results</h1>
        <!-- Sticky Top Summary & Modify Bar -->
        <header class="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-xs">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <button type="button" id="btn-back-to-hub" class="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-brand-black transition-colors" aria-label="Back to Flights Product Hub">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-base sm:text-lg font-bold font-display text-brand-black">${fromLabel} → ${toLabel}</span>
                  <span class="text-xs px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary font-semibold uppercase tracking-wider">${req.tripType.replace('_', ' ')}</span>
                </div>
                <div class="text-xs text-brand-muted flex items-center gap-2">
                  <span>${dateRange}</span>
                  <span>•</span>
                  <span>${paxSummary}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <label for="flight-inventory-source" class="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Inventory</label>
              <select id="flight-inventory-source" class="h-9 px-2.5 rounded-xl border ${isSandboxLane ? 'border-indigo-300 bg-indigo-50 text-indigo-950' : 'border-gray-300 bg-white text-brand-black'} text-xs font-bold outline-none focus:border-brand-primary">
                <option value="demo_fixture" ${!isSandboxLane ? 'selected' : ''}>Available options (planning reference)</option>
                <option value="sandbox_test" ${isSandboxLane ? 'selected' : ''}>Duffel TEST MODE (sandbox)</option>
              </select>
              <button type="button" id="btn-toggle-modify-search" class="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 hover:border-brand-primary text-brand-black hover:text-brand-primary transition-colors flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                <span>${this.isModifyOpen ? 'Close Editor' : 'Modify Search'}</span>
              </button>
            </div>
          </div>

          <!-- Collapsible Search Editor -->
          <div id="modify-search-panel" class="${this.isModifyOpen ? 'block' : 'hidden'} border-t border-gray-100 bg-gray-50 p-4 sm:p-6 transition-all">
            <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div class="md:col-span-4">
                <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">From</label>
                <input type="text" id="mod-from-input" aria-label="Modify origin" value="${formatAirportDisplay(req.origin)}" class="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-semibold bg-white">
              </div>
              <div class="md:col-span-4">
                <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">To</label>
                <input type="text" id="mod-to-input" aria-label="Modify destination" value="${formatAirportDisplay(req.destination)}" class="w-full h-10 px-3 rounded-lg border border-gray-200 text-xs font-semibold bg-white">
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-1">Departure</label>
                <input type="date" id="mod-dep-input" aria-label="Modify departure date" value="${req.departureDate}" class="w-full h-10 px-2 rounded-lg border border-gray-200 text-xs font-semibold bg-white">
              </div>
              <div class="md:col-span-2">
                <button type="button" id="btn-apply-modified-search" class="w-full h-10 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95 transition-colors">
                  Update Results
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Inventory Truth Notice Banner -->
        <div class="${isSandboxLane ? 'bg-indigo-950 text-indigo-50 border-b border-indigo-800' : 'bg-amber-50/80 border-b border-amber-100 text-amber-950'} px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2">
          <svg class="w-3.5 h-3.5 ${isSandboxLane ? 'text-indigo-300' : 'text-amber-700'} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${
            isSandboxLane
              ? `<span><strong>Duffel TEST MODE (sandbox):</strong> these are real Duffel sandbox quotes, not live airline inventory. No live ticket or payment is created. Only an explicit sandbox test order can be placed.</span>`
              : `<span><strong>Inventory notice:</strong> available and request-to-book inventory is not live airline availability. No seat hold, reservation or payment is created by browsing or staging an option.</span>`
          }
        </div>

        <!-- Main Results Layout -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          ${
            resp && resp.offers.length > 0 && (demoCount > 0 || manualCount > 0 || liveCount > 0 || sandboxCount > 0)
              ? `
            <div id="flights-inventory-disclosure" role="note" class="mb-4 p-3 rounded-xl border ${isSandboxLane ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-white'} text-[11px] text-brand-muted leading-relaxed">
              <strong class="text-brand-black">Result sources:</strong>
              ${sandboxCount > 0 ? `${sandboxCount} Duffel TEST MODE sandbox quote${sandboxCount === 1 ? '' : 's'} (non-production, explicit sandbox order only)` : ''}
              ${sandboxCount > 0 && (demoCount > 0 || manualCount > 0 || liveCount > 0) ? ' · ' : ''}
              ${demoCount > 0 ? `${demoCount} planning option${demoCount === 1 ? '' : 's'} (reference, not live)` : ''}
              ${demoCount > 0 && (manualCount > 0 || liveCount > 0) ? ' · ' : ''}
              ${manualCount > 0 ? `${manualCount} manual request-to-book` : ''}
              ${manualCount > 0 && liveCount > 0 ? ' · ' : ''}
              ${liveCount > 0 ? `${liveCount} live supplier fare${liveCount === 1 ? '' : 's'}` : ''}
              . ${isSandboxLane ? 'Test-mode inventory is isolated from planning and production sources.' : 'Planning and manual options require a Vacatina desk quote or confirmation before booking.'}
            </div>
          `
              : ''
          }
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <!-- Sidebar Filters (Desktop) -->
            <aside class="hidden lg:block lg:col-span-3 bg-white p-5 rounded-2xl border border-gray-200 space-y-6">
              <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 class="text-sm font-bold font-display uppercase tracking-wider text-brand-black">Filters</h3>
                <button type="button" id="btn-clear-all-filters" class="text-xs font-bold text-brand-primary hover:underline">Clear all</button>
              </div>

              <!-- Stops Filter -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">Stops</label>
                <div class="space-y-2">
                  <label class="flex items-center justify-between text-xs cursor-pointer select-none">
                    <span class="inline-flex items-center gap-2">
                      <input type="checkbox" data-filter-stop="0" ${(this.currentFilters.stops || []).includes(0) ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300">
                      <span>Direct non-stop</span>
                    </span>
                  </label>
                  <label class="flex items-center justify-between text-xs cursor-pointer select-none">
                    <span class="inline-flex items-center gap-2">
                      <input type="checkbox" data-filter-stop="1" ${(this.currentFilters.stops || []).includes(1) ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300">
                      <span>1 stop</span>
                    </span>
                  </label>
                </div>
              </div>

              <!-- Airlines Filter -->
              ${
                resp && resp.availableAirlines.length > 0
                  ? `
                <div class="border-t border-gray-100 pt-4">
                  <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">Airlines</label>
                  <div class="space-y-2">
                    ${resp.availableAirlines
                      .map(
                        airline => `
                      <label class="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span class="inline-flex items-center gap-2">
                          <input type="checkbox" data-filter-airline="${airline.code}" ${(this.currentFilters.airlineCodes || []).includes(airline.code) ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300">
                          <span>${airline.name}</span>
                        </span>
                        <span class="text-brand-muted text-[11px] tabular-nums">(${airline.count})</span>
                      </label>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Departure Time Window -->
              <div class="border-t border-gray-100 pt-4">
                <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">Departure Time</label>
                <div class="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Departure time window">
                  <button type="button" data-dep-window="all" class="px-2 py-1.5 text-center text-xs font-medium rounded-lg border ${!this.currentFilters.departureTimeWindow || this.currentFilters.departureTimeWindow === 'all' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold' : 'border-gray-200 text-gray-700'}">All</button>
                  <button type="button" data-dep-window="morning" class="px-2 py-1.5 text-center text-xs font-medium rounded-lg border ${this.currentFilters.departureTimeWindow === 'morning' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold' : 'border-gray-200 text-gray-700'}">Morning</button>
                  <button type="button" data-dep-window="evening" class="px-2 py-1.5 text-center text-xs font-medium rounded-lg border ${this.currentFilters.departureTimeWindow === 'evening' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-bold' : 'border-gray-200 text-gray-700'}">Evening</button>
                </div>
              </div>

              <!-- Baggage & Flexibility Toggles -->
              <div class="border-t border-gray-100 pt-4 space-y-2">
                <label class="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input type="checkbox" id="chk-filter-baggage" ${this.currentFilters.baggageIncludedOnly ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300">
                  <span>Checked baggage included</span>
                </label>
                <label class="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input type="checkbox" id="chk-filter-refundable" ${this.currentFilters.refundableOnly ? 'checked' : ''} class="w-4 h-4 rounded text-brand-primary border-gray-300">
                  <span>Refundable fares only</span>
                </label>
              </div>
            </aside>

            <!-- Results Column -->
            <section class="lg:col-span-9 space-y-4">
              <!-- Controls Header: Count & Sort -->
              <div class="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div id="flights-results-count" data-results-count="${resp ? resp.filteredCount : 0}" aria-live="polite" class="text-xs sm:text-sm font-bold text-brand-black">
                  ${
                    this.isLoading
                      ? 'Searching available flight options…'
                      : hasValidationErrors
                      ? 'Search needs attention'
                      : resp
                      ? `Showing ${resp.filteredCount} flight option${resp.filteredCount === 1 ? '' : 's'}`
                      : 'Flight search results'
                  }
                </div>

                <!-- Sort Control -->
                <div class="flex items-center gap-2">
                  <label for="sort-flights-select" class="text-xs font-bold text-brand-muted uppercase tracking-wider">Sort by:</label>
                  <select id="sort-flights-select" class="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-brand-black outline-none focus:border-brand-primary">
                    <option value="recommended" ${this.currentSort === 'recommended' ? 'selected' : ''}>Recommended (Best value &amp; duration)</option>
                    <option value="price_asc" ${this.currentSort === 'price_asc' ? 'selected' : ''}>Lowest Price</option>
                    <option value="duration_asc" ${this.currentSort === 'duration_asc' ? 'selected' : ''}>Shortest Duration</option>
                    <option value="departure_asc" ${this.currentSort === 'departure_asc' ? 'selected' : ''}>Earliest Departure</option>
                    <option value="arrival_asc" ${this.currentSort === 'arrival_asc' ? 'selected' : ''}>Earliest Arrival</option>
                  </select>
                </div>
              </div>

              <!-- Invalid Search State -->
              ${
                hasValidationErrors
                  ? `
                <div id="flights-invalid-search" role="alert" class="p-6 sm:p-8 bg-white rounded-2xl border border-amber-300 text-left space-y-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">!</div>
                    <div class="min-w-0">
                      <h3 class="text-base font-bold text-brand-black">Check your search details</h3>
                      <p class="text-xs text-brand-muted mt-1">No search was run. Correct the items below and try again.</p>
                    </div>
                  </div>
                  <ul class="list-disc pl-5 text-xs text-amber-950 space-y-1">
                    ${validationEntries
                      .map(
                        ([field, message]) =>
                          `<li><strong>${field.replace(/_/g, ' ')}:</strong> ${message}</li>`
                      )
                      .join('')}
                  </ul>
                  <div class="flex flex-wrap items-center gap-3 pt-1">
                    <button type="button" id="btn-invalid-adjust-search" class="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95">Adjust search</button>
                    <button type="button" id="btn-invalid-return-hub" class="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-brand-black hover:bg-gray-50">Return to Flights Hub</button>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Loading Skeleton State -->
              ${
                this.isLoading
                  ? `
                <div class="space-y-4" role="status" aria-label="Loading flights">
                  <div class="h-44 bg-white rounded-2xl border border-gray-200 p-6 animate-pulse space-y-4 transition-all duration-300">
                    <div class="h-4 bg-gray-200 rounded-md w-1/4"></div>
                    <div class="h-8 bg-gray-100 rounded-md w-3/4"></div>
                    <div class="h-4 bg-gray-200 rounded-md w-1/2"></div>
                  </div>
                  <div class="h-44 bg-white rounded-2xl border border-gray-200 p-6 animate-pulse space-y-4 transition-all duration-300">
                    <div class="h-4 bg-gray-200 rounded-md w-1/4"></div>
                    <div class="h-8 bg-gray-100 rounded-md w-3/4"></div>
                    <div class="h-4 bg-gray-200 rounded-md w-1/2"></div>
                  </div>
                  ${
                    this.showAdvanceLoading
                      ? `<div class="pt-2"><button type="button" id="btn-advance-loading" class="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95">Advance search (simulated loading)</button><p class="text-[11px] text-brand-muted mt-2">Simulated loading state. No search has run yet; advance to load results.</p></div>`
                      : ''
                  }
                </div>
              `
                  : ''
              }

              <!-- Error State -->
              ${
                this.errorMessage && !hasValidationErrors
                  ? `
                <div class="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3">
                  <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold text-lg">!</div>
                  <h3 class="text-base font-bold text-brand-black">Search Unavailable</h3>
                  <p class="text-xs text-brand-muted max-w-md mx-auto">${this.errorMessage}</p>
                  <button type="button" id="btn-retry-search" class="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95">Retry Search</button>
                </div>
              `
                  : ''
              }

              <!-- Empty State -->
              ${
                !this.isLoading && !this.errorMessage && !hasValidationErrors && resp && resp.offers.length === 0
                  ? `
                <div class="p-10 bg-white rounded-2xl border border-gray-200 text-center space-y-4">
                  <div class="w-14 h-14 rounded-full bg-brand-primary/10 text-brand-primary mx-auto flex items-center justify-center">
                    <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                  </div>
                  <h3 class="text-base font-bold text-brand-black font-display">No flights match your exact criteria</h3>
                  <p class="text-xs text-brand-muted max-w-md mx-auto">
                    We could not find matching flights for ${fromLabel} → ${toLabel} with your current filter selections. Try clearing filters or selecting flexible travel dates.
                  </p>
                  <div class="flex items-center justify-center gap-3 pt-2">
                    <button type="button" id="btn-empty-clear-filters" class="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 text-brand-black hover:bg-gray-50">Clear Filters</button>
                    <button type="button" id="btn-empty-return-hub" class="px-4 py-2 rounded-xl text-xs font-bold bg-brand-primary text-white hover:bg-opacity-95">Return to Flights Hub</button>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Results Cards List -->
              ${
                !this.isLoading && !this.errorMessage && !hasValidationErrors && resp && resp.offers.length > 0
                  ? `
                <div class="space-y-4" id="flights-cards-container">
                  ${resp.offers.map(offer => this.renderFlightCard(offer)).join('')}
                </div>
              `
                  : ''
              }
            </section>
          </div>
        </main>
      </div>
    `;

    this.wireEvents(container);
  }

  private renderFlightCard(offer: CanonicalFlightOffer): string {
    const isSaved = flightFavoritesService.isOfferFavorite(offer.offerId);
    const truth = resolveFlightInventoryTruth(offer);
    const depTime = truth.isManual
      ? 'TBC'
      : new Date(offer.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const arrTime = truth.isManual
      ? 'TBC'
      : new Date(offer.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const durationHours = Math.floor(offer.durationMinutes / 60);
    const durationMins = offer.durationMinutes % 60;
    const durationText = truth.isManual
      ? 'Schedule pending'
      : `${durationHours}h ${durationMins}m`;

    const stopLabel = truth.isManual
      ? 'Carrier & routing pending desk confirmation'
      : offer.stopCount === 0
        ? 'Direct'
        : `${offer.stopCount} Stop${offer.stopCount > 1 ? 's' : ''} (${offer.stopAirports.join(', ')})`;

    const baggageDesc = truth.isManual
      ? 'Baggage not supplied — confirm with desk'
      : offer.baggage.checked.pieces > 0
        ? `${offer.baggage.checked.description}`
        : 'Cabin baggage only';

    const ctaLabel = truth.isSandbox ? 'View sandbox offer' : truth.isLive ? 'View Flight' : 'View details';

    return `
      <article class="bg-white rounded-2xl border border-gray-200 hover:border-brand-primary/40 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0" data-offer-id="${offer.offerId}" data-inventory-mode="${truth.mode}">
        <div>
          <!-- Header Bar: Airline, Fare Family & Favorite -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex shrink-0 items-center justify-center min-w-8 h-8 px-2 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-xs tracking-wider">
                ${truth.isManual ? '?' : offer.marketingCarrier.code}
              </span>
              <div class="min-w-0">
                <span class="text-sm font-bold text-brand-black break-words">${offer.marketingCarrier.name}</span>
                <span class="text-xs text-brand-muted ml-1.5 font-mono">${offer.flightNumber}</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 sm:justify-end">
              ${
                truth.isManual
                  ? ''
                  : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-brand-black">
                      ${offer.fareFamily}
                    </span>`
              }
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${truth.badgeClasses}">
                ${truth.shortLabel}
              </span>
              <button type="button" data-favorite-offer="${offer.offerId}" class="w-8 h-8 rounded-full border border-gray-200 hover:border-red-300 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" aria-label="Save flight to favorites">
                <svg class="w-4 h-4 ${isSaved ? 'text-red-500 fill-current' : 'fill-none'}" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Schedule Row -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <!-- Origin & Departure -->
            <div class="md:col-span-3">
              <div class="text-2xl font-black font-display text-brand-black tabular-nums">${depTime}</div>
              <div class="text-xs font-bold text-brand-black">${offer.origin.airportCode}</div>
              <div class="text-[11px] text-brand-muted truncate">${offer.origin.city}</div>
            </div>

            <!-- Duration & Route Path Line -->
            <div class="md:col-span-5 text-center px-2">
              <div class="text-xs font-semibold text-brand-muted mb-1">${durationText}</div>
              <div class="relative flex items-center justify-center">
                <div class="w-full h-0.5 bg-gray-200"></div>
                <div class="absolute w-2 h-2 rounded-full bg-brand-primary"></div>
              </div>
              <div class="text-[11px] font-bold ${offer.stopCount === 0 ? 'text-green-700' : 'text-brand-muted'} mt-1">
                ${stopLabel}
              </div>
            </div>

            <!-- Destination & Arrival -->
            <div class="md:col-span-4 text-right">
              <div class="text-2xl font-black font-display text-brand-black tabular-nums">${arrTime}</div>
              <div class="text-xs font-bold text-brand-black">${offer.destination.airportCode}</div>
              <div class="text-[11px] text-brand-muted truncate">${offer.destination.city}</div>
            </div>
          </div>

          <!-- Perks & Baggage Pills -->
          <div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100 text-xs text-brand-muted">
            <span class="inline-flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              ${baggageDesc}
            </span>
            <span>•</span>
            <span>${offer.cabinClass.charAt(0).toUpperCase() + offer.cabinClass.slice(1)}</span>
            ${
              truth.isSandbox && offer.sandbox?.services?.length
                ? `<span>•</span><span>${offer.sandbox.services.length} optional sandbox service${offer.sandbox.services.length === 1 ? '' : 's'}</span>`
                : ''
            }
            ${
              offer.mealInformation
                ? `<span>•</span><span class="truncate max-w-[200px]">${offer.mealInformation}</span>`
                : ''
            }
          </div>

          <div class="mt-3 text-[10px] leading-snug rounded-lg px-2.5 py-2 ${truth.panelClasses}">
            ${truth.disclosure}
          </div>
        </div>

        <!-- Footer Actions Bar: Transparent Price & CTA -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100">
          <div class="min-w-0">
            <span class="text-[10px] uppercase font-bold tracking-wider text-brand-muted block">${truth.priceLabel}</span>
            <div class="flex items-baseline gap-1 flex-wrap">
              <span class="text-xl sm:text-2xl font-black font-display text-brand-black tabular-nums">
                ${offer.price.currency} ${(offer.price.totalMinor / 100).toLocaleString()}
              </span>
              <span class="text-xs text-brand-muted">/ itinerary</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-quick-add-trip="${offer.offerId}" class="px-3.5 py-2.5 rounded-xl border border-gray-300 hover:border-brand-primary text-brand-black hover:text-brand-primary text-xs font-bold transition-colors">
              Add to Trip
            </button>
            <button type="button" data-view-offer="${offer.offerId}" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95 transition-all shadow-sm">
              ${ctaLabel}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  private wireEvents(container: HTMLElement): void {
    // 1. Back button
    container.querySelector('#btn-back-to-hub')?.addEventListener('click', () => {
      routerService.navigateTo('/flights');
    });

    // 2. Modify Search Toggle
    const toggleModBtn = container.querySelector<HTMLButtonElement>('#btn-toggle-modify-search');
    const modPanel = container.querySelector<HTMLElement>('#modify-search-panel');
    if (toggleModBtn && modPanel) {
      toggleModBtn.addEventListener('click', () => {
        this.isModifyOpen = !this.isModifyOpen;
        this.render(container);
      });
    }

    // 3. Inventory source selector: sandbox test inventory is an exclusive lane.
    container.querySelector<HTMLSelectElement>('#flight-inventory-source')?.addEventListener('change', event => {
      const source = (event.target as HTMLSelectElement).value === 'sandbox_test' ? 'sandbox_test' : 'demo_fixture';
      this.currentRequest = {
        ...this.currentRequest,
        inventorySource: source,
        searchId: `srch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      };
      this.currentFilters = {};
      this.currentResponse = null;
      this.errorMessage = null;
      routerService.navigateTo(buildFlightSearchQuery(this.currentRequest));
    });

    // 4. Apply Modified Search
    container.querySelector('#btn-apply-modified-search')?.addEventListener('click', () => {
      const fromInput = container.querySelector<HTMLInputElement>('#mod-from-input');
      const toInput = container.querySelector<HTMLInputElement>('#mod-to-input');
      const depInput = container.querySelector<HTMLInputElement>('#mod-dep-input');

      if (!fromInput || !toInput || !depInput) return;

      const errors: Record<string, string> = {};
      const fromFound = parseAirportFromInput(fromInput.value);
      const toFound = parseAirportFromInput(toInput.value);
      const departureDate = normalizeFlightDate(depInput.value);

      if (!fromFound) errors.origin = 'Please select a valid departure airport.';
      if (!toFound) errors.destination = 'Please select a valid arrival airport.';
      if (fromFound && toFound && fromFound.airportCode === toFound.airportCode) {
        errors.destination = 'Origin and destination airports cannot be identical.';
      }
      if (!departureDate) errors.departureDate = 'Please enter a valid departure date.';

      if (Object.keys(errors).length > 0) {
        this.validationErrors = errors;
        this.currentResponse = null;
        this.isModifyOpen = false;
        this.render(container);
        return;
      }

      this.currentRequest = {
        ...this.currentRequest,
        origin: fromFound!,
        destination: toFound!,
        departureDate: departureDate!
      };
      this.validationErrors = {};
      this.isModifyOpen = false;
      rememberFlightSearchQuery(buildFlightSearchQuery(this.currentRequest));
      this.executeSearch(container);
    });

    // 4. Sort Dropdown
    const sortSelect = container.querySelector<HTMLSelectElement>('#sort-flights-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.currentSort = sortSelect.value as FlightSortOption;
        telemetry.track('flight_sort_changed', { sort: this.currentSort });
        if (this.currentResponse) {
          this.currentResponse.offers = flightSearchService.sortOffers(
            this.currentResponse.offers,
            this.currentSort
          );
          this.render(container);
        }
      });
    }

    // 5. Stops Filter Checkboxes
    container.querySelectorAll<HTMLInputElement>('input[data-filter-stop]').forEach(chk => {
      chk.addEventListener('change', () => {
        const stopVal = parseInt(chk.getAttribute('data-filter-stop') || '0', 10);
        const stops = new Set(this.currentFilters.stops || []);
        if (chk.checked) stops.add(stopVal);
        else stops.delete(stopVal);
        this.currentFilters.stops = stops.size > 0 ? Array.from(stops) : undefined;
        this.executeSearch(container);
      });
    });

    // 6. Airline Filter Checkboxes
    container.querySelectorAll<HTMLInputElement>('input[data-filter-airline]').forEach(chk => {
      chk.addEventListener('change', () => {
        const code = chk.getAttribute('data-filter-airline') || '';
        const airlines = new Set(this.currentFilters.airlineCodes || []);
        if (chk.checked) airlines.add(code);
        else airlines.delete(code);
        this.currentFilters.airlineCodes = airlines.size > 0 ? Array.from(airlines) : undefined;
        this.executeSearch(container);
      });
    });

    // 7. Time Window Buttons
    container.querySelectorAll<HTMLButtonElement>('button[data-dep-window]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentFilters.departureTimeWindow = btn.getAttribute('data-dep-window') as any;
        this.executeSearch(container);
      });
    });

    // 8. Baggage & Refundable Checkboxes
    container.querySelector<HTMLInputElement>('#chk-filter-baggage')?.addEventListener('change', (e) => {
      this.currentFilters.baggageIncludedOnly = (e.target as HTMLInputElement).checked;
      this.executeSearch(container);
    });
    container.querySelector<HTMLInputElement>('#chk-filter-refundable')?.addEventListener('change', (e) => {
      this.currentFilters.refundableOnly = (e.target as HTMLInputElement).checked;
      this.executeSearch(container);
    });

    // 9. Clear All Filters Button
    const clearFiltersHandler = () => {
      this.currentFilters = {};
      this.executeSearch(container);
    };
    container.querySelector('#btn-clear-all-filters')?.addEventListener('click', clearFiltersHandler);
    container.querySelector('#btn-empty-clear-filters')?.addEventListener('click', clearFiltersHandler);
    container.querySelector('#btn-empty-return-hub')?.addEventListener('click', () => {
      routerService.navigateTo('/flights');
    });

    // 10. Card Actions: View Offer & Quick Add
    container.querySelectorAll<HTMLButtonElement>('button[data-view-offer]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const offerId = btn.getAttribute('data-view-offer');
        if (offerId) {
          routerService.navigateTo(`/flights/offer/${offerId}`);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('button[data-quick-add-trip]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const offerId = btn.getAttribute('data-quick-add-trip');
        if (offerId && this.currentResponse) {
          const offer = this.currentResponse.offers.find(o => o.offerId === offerId);
          if (offer) {
            const recommendedFamily =
              offer.fareFamiliesAvailable.find(f => f.isRecommended)?.familyCode ||
              offer.fareFamiliesAvailable[0]?.familyCode;
            const candidate = flightTripBucketService.addFlightToTripBucket(
              offer,
              recommendedFamily
                ? {
                    offerId: offer.offerId,
                    selectedFareFamilyCode: recommendedFamily,
                    selectedCabinClass: offer.cabinClass,
                    selectedOptionalServiceIds: []
                  }
                : undefined,
              this.currentRequest
            );

            if (candidate.state === 'needs_action') {
              showToast(
                candidate.inventoryMode === 'demo_fixture'
                  ? 'Option staged. No live seat hold was created - request a desk quote to book.'
                  : candidate.inventoryMode === 'sandbox_test'
                    ? 'Duffel TEST MODE quote staged. No live ticket, seat hold or payment was created. Review your trip to place an explicit sandbox test order.'
                    : 'Flight request staged. The Vacatina desk must confirm schedule, baggage and fare before booking.',
                'brand'
              );
            } else {
              showToast(`Added ${offer.marketingCarrier.name} flight to your Trip Bucket.`, 'success');
            }
          }
        }
      });
    });

    // 11. Favorite Toggle
    container.querySelectorAll<HTMLButtonElement>('button[data-favorite-offer]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const offerId = btn.getAttribute('data-favorite-offer');
        if (offerId && this.currentResponse) {
          const offer = this.currentResponse.offers.find(o => o.offerId === offerId);
          if (offer) {
            const isNowSaved = flightFavoritesService.toggleOfferFavorite(offer);
            this.render(container);
            showToast(isNowSaved ? 'Saved flight to Favorites.' : 'Removed flight from Favorites.', 'brand');
          }
        }
      });
    });

    // 12. Retry button
    container.querySelector('#btn-retry-search')?.addEventListener('click', () => {
      this.executeSearch(container);
    });

    // 13. Invalid search recovery
    container.querySelector('#btn-invalid-adjust-search')?.addEventListener('click', () => {
      this.isModifyOpen = true;
      this.validationErrors = {};
      this.render(container);
    });
    container.querySelector('#btn-invalid-return-hub')?.addEventListener('click', () => {
      routerService.navigateTo('/flights');
    });
  }
}

export const flightsSearchView = new FlightsSearchView();
