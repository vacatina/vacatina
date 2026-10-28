/* ============================================================================
 * Vacatina Visa Assistance Search Results View
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Route: /visa-assistance/search & /visa-assistance/options
 * Mount: #visa-view-mount
 * ============================================================================ */

import type { CanonicalVisaOffer, VisaCategory } from '../domain/visa-models.ts';
import type {
  VisaFilterCriteria,
  VisaRequirementRule,
  VisaSearchCriteria,
  VisaSearchResponse
} from '../domain/visa-search-models.ts';
import { visaSearchService } from '../services/visa-search.service.ts';
import { visaFavoritesService } from '../services/visa-favorites.service.ts';
import { initVisaCountryAutocomplete } from './visa-country-autocomplete.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { VISA_DEMO_DISCLOSURE, visaContextFromQuery, validateVisaContext, rememberVisaContext, visaContextQuery } from '../domain/visa-journey.ts';
import { journeyEscape } from '../../journeys/domain/journey-models.ts';

export class VisaSearchView {
  private mountElement: HTMLElement | null = null;
  private currentResponse: VisaSearchResponse | null = null;
  private displayedOffers: CanonicalVisaOffer[] = [];
  private currentFilters: VisaFilterCriteria = {};
  private context = visaContextFromQuery(new URLSearchParams());
  private generation = 0;
  private autocompleteCleanup?: () => void;
  public cancel(): void { this.generation++; this.autocompleteCleanup?.(); this.autocompleteCleanup = undefined; }

  public async loadFromQuery(query: URLSearchParams, mount: HTMLElement): Promise<void> {
    this.autocompleteCleanup?.();
    this.mountElement = mount;
    const generation = ++this.generation;
    this.currentFilters = {};
    this.context = visaContextFromQuery(query);
    const errors = validateVisaContext(this.context);
    if (errors.length) {
      mount.innerHTML = `<section class="max-w-3xl mx-auto p-6 my-10 rounded-2xl bg-white border"><h1 class="font-bold text-2xl">Check applicant context</h1><p role="alert" class="mt-4">${journeyEscape(errors.join(' '))}</p><a class="min-h-[44px] inline-flex items-center underline mt-4" href="/visa-assistance?${journeyEscape(query.toString())}">Complete visa search details</a></section>`;
      return;
    }
    rememberVisaContext(this.context);

    const dest = query.get('destination') || query.get('to') || 'United Arab Emirates';
    const citizenship = query.get('citizenship') || 'LK';
    const purpose = this.context.purpose === 'tourism' ? 'tourist' : this.context.purpose as VisaSearchCriteria['purpose'];

    const criteria: VisaSearchCriteria = {
      destinationCountry: dest,
      citizenshipCountry: citizenship === 'LK' ? 'Sri Lanka' : citizenship,
      citizenshipCountryCode: citizenship,
      purpose
    };

    mount.innerHTML = `
      <div class="visa-search-loading bg-brand-canvas min-h-screen py-20 px-4 text-center">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-brand-primary border-t-transparent mb-4"></div>
        <div class="font-bold text-sm text-brand-black">Loading assistance examples…</div>
        <div class="text-xs text-brand-muted mt-1">Eligibility requires manual review</div>
      </div>
    `;

    try {
      const response = await visaSearchService.search(criteria);
      if (generation !== this.generation) return;
      this.currentResponse = response;
      this.displayedOffers = [...response.offers];
      this.render();
    } catch (err) {
      mount.innerHTML = `
        <div class="bg-brand-canvas min-h-screen py-20 px-4 text-center">
          <div class="text-3xl mb-2">⚠️</div>
          <div class="font-bold text-base text-brand-black">Unable to Retrieve Visa Services</div>
          <div class="text-xs text-brand-muted mt-1 max-w-md mx-auto mb-6">Please check your query or contact the Vacatina Consular Concierge Desk.</div>
          <a href="/visa-assistance" class="px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-xs">Return to Visa Hub</a>
        </div>
      `;
    }
  }

  private render(): void {
    if (!this.mountElement || !this.currentResponse) return;
    this.autocompleteCleanup?.();

    const { criteria, facets } = this.currentResponse;
    const requirementRule = { ...this.currentResponse.requirementRule, statusLabel: 'Eligibility not verified · Manual review required', citizenshipCountry: journeyEscape(this.context.citizenshipCountry), destinationCountry: journeyEscape(this.context.destination), headline: 'Confirm current requirements with the relevant authority', description: VISA_DEMO_DISCLOSURE };
    const filteredOffers = visaSearchService.filterOffers(this.displayedOffers, this.currentFilters);

    this.mountElement.innerHTML = `
      <div class="visa-search-results-page bg-brand-canvas min-h-screen pb-20">
        <!-- Top Search Bar Bar -->
        <header class="bg-brand-primary text-white py-4 px-4 sm:px-6 lg:px-8 border-b border-brand-primary/80">
          <div class="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <a href="/visa-assistance" class="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors">
                <span aria-hidden="true">←</span>
                <span>Visa Hub</span>
              </a>
              <span class="text-white/40">|</span>
              <span class="text-xs font-bold text-white/90 uppercase tracking-wider">Consular Results</span>
            </div>

            <!-- Inline Search Form -->
            <form id="visa-search-inline-form" class="flex flex-wrap items-center gap-2">
              <div class="relative" id="visa-inline-dest-container">
                <input
                  type="text"
                  id="visa-inline-dest-input"
                  value="${journeyEscape(criteria.destinationCountry)}" aria-label="Destination country"
                  placeholder="Destination Country"
                  class="bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-brand-black px-3 py-1.5 rounded-lg text-xs font-semibold placeholder:text-white/60 focus:outline-none transition-all w-48"
                />
              </div>

              <select
                id="visa-inline-citizenship-select"
                aria-label="Passport nationality"
                class="bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-brand-black px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none transition-all cursor-pointer"
              >
                <option value="LK" ${criteria.citizenshipCountryCode === 'LK' ? 'selected' : ''}>🇱🇰 Sri Lankan Citizen</option>
                <option value="IN" ${criteria.citizenshipCountryCode === 'IN' ? 'selected' : ''}>🇮🇳 Indian Citizen</option>
                <option value="GB" ${criteria.citizenshipCountryCode === 'GB' ? 'selected' : ''}>🇬🇧 British Citizen</option>
                <option value="US" ${criteria.citizenshipCountryCode === 'US' ? 'selected' : ''}>🇺🇸 US Citizen</option>
              </select>

              <button
                type="submit"
                class="px-4 py-1.5 bg-white hover:bg-white/90 text-brand-primary rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>
        </header>

        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
          
          <!-- Prominent Consular Requirement Rule Banner -->
          <div class="bg-white rounded-2xl p-5 sm:p-6 border border-brand-border/80 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 bottom-0 w-2 ${
              requirementRule.status === 'VISA_FREE'
                ? 'bg-emerald-500'
                : requirementRule.status === 'EVISA_AVAILABLE'
                ? 'bg-sky-500'
                : 'bg-amber-500'
            }"></div>

            <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-3">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    requirementRule.status === 'VISA_FREE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : requirementRule.status === 'EVISA_AVAILABLE'
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }">
                    ${requirementRule.statusLabel}
                  </span>
                  <span class="text-xs font-semibold text-brand-muted">
                    Passport: ${requirementRule.citizenshipCountry} ➔ ${requirementRule.destinationCountry}
                  </span>
                </div>

                <h1 class="text-lg sm:text-xl font-bold text-brand-black">
                  ${requirementRule.headline}
                </h1>
                <p class="text-xs sm:text-sm text-brand-muted leading-relaxed max-w-3xl">
                  ${requirementRule.description}
                </p>
              </div>

              <!-- Quick SLA box -->
              <div class="shrink-0 bg-brand-canvas rounded-xl p-3 border border-brand-border/60 text-right min-w-[140px]">
                <div class="text-[10px] uppercase font-bold text-brand-muted">Eligibility state</div>
                <div class="text-base font-extrabold text-brand-primary">
                  Manual review
                </div>
                <div class="text-[10px] text-brand-muted">No approval or filing</div>
              </div>
            </div>
          </div>

          <!-- Main Layout: Filters + Results -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <!-- Filters Sidebar -->
            <aside class="lg:col-span-3 space-y-4">
              <div class="bg-white rounded-2xl p-5 border border-brand-border/80 shadow-sm space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-brand-border/60">
                  <h2 class="text-xs font-bold uppercase tracking-wider text-brand-black">Filter Services</h2>
                  <button
                    type="button"
                    id="visa-reset-filters-btn"
                    class="text-[11px] font-semibold text-brand-primary hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <!-- Visa Category Filter -->
                <div>
                  <div class="text-[11px] font-bold text-brand-muted uppercase mb-2">Category</div>
                  <div class="space-y-1.5 text-xs text-brand-black">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="TOURIST_EVISA"
                        class="visa-filter-cat rounded text-brand-primary focus:ring-brand-primary"
                        ${this.isCatChecked('TOURIST_EVISA') ? 'checked' : ''}
                      />
                      <span>Tourist e-Visa</span>
                      <span class="text-brand-muted text-[10px] ml-auto">(${facets.categoryCounts['TOURIST_EVISA'] || 0})</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="STICKER_VISA"
                        class="visa-filter-cat rounded text-brand-primary focus:ring-brand-primary"
                        ${this.isCatChecked('STICKER_VISA') ? 'checked' : ''}
                      />
                      <span>Sticker / Biometric</span>
                      <span class="text-brand-muted text-[10px] ml-auto">(${facets.categoryCounts['STICKER_VISA'] || 0})</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="BUSINESS_VISA"
                        class="visa-filter-cat rounded text-brand-primary focus:ring-brand-primary"
                        ${this.isCatChecked('BUSINESS_VISA') ? 'checked' : ''}
                      />
                      <span>Business & Investor</span>
                      <span class="text-brand-muted text-[10px] ml-auto">(${facets.categoryCounts['BUSINESS_VISA'] || 0})</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value="ETA"
                        class="visa-filter-cat rounded text-brand-primary focus:ring-brand-primary"
                        ${this.isCatChecked('ETA') ? 'checked' : ''}
                      />
                      <span>Inbound ETA</span>
                      <span class="text-brand-muted text-[10px] ml-auto">(${facets.categoryCounts['ETA'] || 0})</span>
                    </label>
                  </div>
                </div>

                <!-- SLA Filter -->
                <div>
                  <div class="text-[11px] font-bold text-brand-muted uppercase mb-2">Turnaround Speed</div>
                  <div class="space-y-1.5 text-xs text-brand-black">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visa-sla-radio"
                        value="0"
                        class="visa-filter-sla text-brand-primary focus:ring-brand-primary"
                        ${!this.currentFilters.maxSlaDays ? 'checked' : ''}
                      />
                      <span>Any Turnaround</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visa-sla-radio"
                        value="3"
                        class="visa-filter-sla text-brand-primary focus:ring-brand-primary"
                        ${this.currentFilters.maxSlaDays === 3 ? 'checked' : ''}
                      />
                      <span>Express (≤ 3 Days)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="visa-sla-radio"
                        value="7"
                        class="visa-filter-sla text-brand-primary focus:ring-brand-primary"
                        ${this.currentFilters.maxSlaDays === 7 ? 'checked' : ''}
                      />
                      <span>Standard (≤ 7 Days)</span>
                    </label>
                  </div>
                </div>

                <!-- Direct Consular Only -->
                <div class="pt-3 border-t border-brand-border/60">
                  <label class="flex items-center gap-2 text-xs font-semibold text-brand-black cursor-pointer">
                    <input
                      type="checkbox"
                      id="visa-filter-direct"
                      class="rounded text-brand-primary focus:ring-brand-primary"
                      ${this.currentFilters.directDeskOnly ? 'checked' : ''}
                    />
                    <span>Vacatina Direct Desk Only</span>
                  </label>
                </div>
              </div>
            </aside>

            <!-- Results List -->
            <main class="lg:col-span-9 space-y-4">
              <div class="flex items-center justify-between text-xs text-brand-muted">
                <div id="visa-results-count" data-results-count="${filteredOffers.length}">Showing <strong class="text-brand-black">${filteredOffers.length}</strong> demo assistance option${filteredOffers.length === 1 ? '' : 's'}</div>
                <div>All prices in <strong>LKR</strong></div>
              </div>

              ${
                filteredOffers.length === 0
                  ? `
                <div class="bg-white rounded-2xl p-10 border border-brand-border/80 text-center space-y-3">
                  <div class="text-4xl">🔍</div>
                  <h3 class="font-bold text-base text-brand-black">No services match current filters</h3>
                  <p class="text-xs text-brand-muted max-w-sm mx-auto">Try clearing category filters, extending the turnaround speed, or searching a different destination.</p>
                  <button
                    type="button"
                    id="visa-empty-reset-btn"
                    class="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold"
                  >
                    Clear Filters
                  </button>
                </div>
              `
                  : filteredOffers
                      .map(
                        offer => `
                <article class="bg-white rounded-2xl border border-brand-border/80 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 flex flex-col md:flex-row gap-5 items-start">
                  <!-- Thumbnail & Badges -->
                  <div class="w-full md:w-48 h-36 shrink-0 rounded-xl overflow-hidden relative bg-brand-canvas">
                    <img
                      src="${offer.heroImage}"
                      alt="${offer.title}"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div class="absolute top-2 left-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/95 text-brand-black shadow-sm">
                        ${offer.flagEmoji} ${offer.countryCode}
                      </span>
                    </div>
                    <div class="absolute bottom-2 left-2 right-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary text-white shadow-sm block text-center truncate">
                        Demo estimate ${offer.processingSlaBusinessDays} days · Not verified
                      </span>
                    </div>
                  </div>

                  <!-- Center Body -->
                  <div class="flex-1 min-w-0 space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                        ${offer.category.replace('_', ' ')}
                      </span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-subtle text-brand-black">
                        ${offer.entryType.replace('_', ' ')}
                      </span>
                      ${
                        offer.isPinnedAboveApi
                          ? `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Vacatina Direct Concierge</span>`
                          : ''
                      }
                    </div>

                    <h3 class="font-bold text-base text-brand-black leading-snug">
                      ${offer.title}
                    </h3>
                    <p class="text-xs text-brand-muted leading-relaxed line-clamp-2">
                      ${offer.description}
                    </p>

                    <!-- Document checklist quick badges -->
                    <div class="pt-2 flex flex-wrap items-center gap-1.5">
                      <span class="text-[10px] font-bold text-brand-muted">Required:</span>
                      ${offer.documentChecklist
                        .filter(d => d.isRequired)
                        .slice(0, 3)
                        .map(
                          d => `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-50 text-brand-black border border-gray-200">
                          <span class="text-emerald-600">✓</span>
                          <span>${d.title}</span>
                        </span>
                      `
                        )
                        .join('')}
                      ${
                        offer.documentChecklist.length > 3
                          ? `<span class="text-[10px] text-brand-muted">+${offer.documentChecklist.length - 3} more</span>`
                          : ''
                      }
                    </div>
                  </div>

                  <!-- Right Side: Pricing & CTA -->
                  <div class="w-full md:w-56 shrink-0 pt-4 md:pt-0 md:pl-5 border-t md:border-t-0 md:border-l border-brand-border/60 flex flex-col justify-between self-stretch">
                    <div class="space-y-1">
                      <div class="text-[10px] text-brand-muted">Illustrative fee per applicant</div>
                      <div class="text-xl font-extrabold text-brand-primary">
                        LKR ${(offer.pricing.totalPriceMinor / 100).toLocaleString()}
                      </div>
                      <div class="text-[10px] text-brand-muted leading-tight space-y-0.5">
                        <div class="flex justify-between">
                          <span>Embassy Fee:</span>
                          <span class="font-semibold text-brand-black">LKR ${(offer.pricing.embassyFeeMinor / 100).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                          <span>Concierge Vetting:</span>
                          <span class="font-semibold text-brand-black">LKR ${(offer.pricing.vacatinaConciergeFeeMinor / 100).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-2 mt-4">
                      <button
                        type="button"
                        data-apply-visa-id="${offer.canonicalOfferId}"
                        class="visa-apply-btn w-full py-2.5 px-4 bg-brand-primary hover:bg-[#140F4D] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Review assistance</span>
                        <span aria-hidden="true">→</span>
                      </button>

                      <button
                        type="button"
                        data-save-visa-id="${offer.visaId}"
                        class="visa-save-btn w-full py-1.5 px-3 bg-brand-subtle hover:bg-brand-canvas text-brand-black rounded-lg text-[11px] font-semibold border border-brand-border/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>${visaFavoritesService.isVisaSaved(offer.visaId) ? '♥ Saved' : '♡ Save to Favorites'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              `
                      )
                      .join('')
              }
            </main>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();

    telemetry.track('visa_search_view_rendered', {
      destination: criteria.destinationCountry,
      totalCount: filteredOffers.length
    });
  }

  private isCatChecked(cat: VisaCategory): boolean {
    return !this.currentFilters.categories || this.currentFilters.categories.includes(cat);
  }

  private bindEvents(): void {
    if (!this.mountElement) return;

    // Inline search form
    const inlineForm = this.mountElement.querySelector('#visa-search-inline-form') as HTMLFormElement;
    const destInput = this.mountElement.querySelector('#visa-inline-dest-input') as HTMLInputElement;
    const destContainer = this.mountElement.querySelector('#visa-inline-dest-container') as HTMLElement;
    const citSelect = this.mountElement.querySelector('#visa-inline-citizenship-select') as HTMLSelectElement;

    if (destInput && destContainer) {
      this.autocompleteCleanup = initVisaCountryAutocomplete({
        inputElement: destInput,
        containerElement: destContainer,
        onSelect: dest => {
          destInput.value = dest.countryName;
        }
      });
    }

    if (inlineForm) {
      inlineForm.addEventListener('submit', e => {
        e.preventDefault();
        const dest = destInput ? destInput.value.trim() : '';
        const citizenship = citSelect ? citSelect.value : 'LK';
        const searchUrl = `/visa-assistance/search?${visaContextQuery({ ...this.context, destination: dest, citizenshipCountry: citizenship })}`;
        if (typeof window !== 'undefined' && (window as any).__VACATINA_ROUTER__) {
          (window as any).__VACATINA_ROUTER__.navigateTo(searchUrl);
        }
      });
    }

    // Category checkboxes
    this.mountElement.querySelectorAll('.visa-filter-cat').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = Array.from(this.mountElement!.querySelectorAll('.visa-filter-cat:checked')).map(
          el => (el as HTMLInputElement).value as VisaCategory
        );
        this.currentFilters.categories = checked.length > 0 ? checked : undefined;
        this.render();
      });
    });

    // SLA radio
    this.mountElement.querySelectorAll('.visa-filter-sla').forEach(radio => {
      radio.addEventListener('change', e => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        this.currentFilters.maxSlaDays = val > 0 ? val : undefined;
        this.render();
      });
    });

    // Direct desk checkbox
    const directCheck = this.mountElement.querySelector('#visa-filter-direct') as HTMLInputElement;
    if (directCheck) {
      directCheck.addEventListener('change', () => {
        this.currentFilters.directDeskOnly = directCheck.checked;
        this.render();
      });
    }

    // Reset filters
    const resetBtn = this.mountElement.querySelector('#visa-reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentFilters = {};
        this.render();
      });
    }

    const emptyResetBtn = this.mountElement.querySelector('#visa-empty-reset-btn');
    if (emptyResetBtn) {
      emptyResetBtn.addEventListener('click', () => {
        this.currentFilters = {};
        this.render();
      });
    }

    // Apply Buttons
    this.mountElement.querySelectorAll('.visa-apply-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const offerId = (btn as HTMLElement).dataset.applyVisaId;
        if (offerId && typeof window !== 'undefined' && (window as any).__VACATINA_ROUTER__) {
          (window as any).__VACATINA_ROUTER__.navigateTo(`/visa-assistance/apply/${offerId}?${visaContextQuery(this.context)}`);
        }
      });
    });

    // Save Favorite Buttons
    this.mountElement.querySelectorAll('.visa-save-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const visaId = (btn as HTMLElement).dataset.saveVisaId;
        if (!visaId) return;
        const offer = await visaSearchService.getOfferById(visaId);
        if (offer) {
          const isSaved = visaFavoritesService.toggleVisaFavorite(offer);
          (btn as HTMLElement).querySelector('span')!.textContent = isSaved ? '♥ Saved' : '♡ Save to Favorites';
        }
      });
    });
  }
}

export const visaSearchView = new VisaSearchView();
