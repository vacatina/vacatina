/* ============================================================================
 * Vacatina Visa Assistance Product Hub View
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 *
 * Route: /visa-assistance
 * Mount: #visa-view-mount
 * ============================================================================ */

import { POPULAR_VISA_DESTINATIONS } from '../data/destinations.ts';
import { MANUAL_VISA_SERVICES } from '../data/manual-visas.ts';
import { initVisaCountryAutocomplete } from './visa-country-autocomplete.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { VISA_DEMO_DISCLOSURE, visaContextFromQuery, validateVisaContext, rememberVisaContext, visaContextQuery } from '../domain/visa-journey.ts';
import { journeyEscape } from '../../journeys/domain/journey-models.ts';
import { showToast } from '../../../components/ui/toast.ts';

export class VisaHubView {
  private mountElement: HTMLElement | null = null;
  private prefilledDestination: string = '';
  private selectedDestCode: string = 'AE';
  private selectedCitizenshipCode: string = 'LK';
  private context = visaContextFromQuery(new URLSearchParams());
  public prefillFromQuery(query: URLSearchParams): void {
    this.context = visaContextFromQuery(query);
    this.prefilledDestination = this.context.destination;
  }

  public prefill(destination: string): void {
    this.prefilledDestination = destination;
  }

  public render(mount: HTMLElement): void {
    this.mountElement = mount;

    const featuredServices = MANUAL_VISA_SERVICES.slice(0, 6);

    mount.innerHTML = `
      <div class="visa-hub-page bg-brand-canvas min-h-screen pb-20">
        <!-- Hero Section with Search Command Center -->
        <section class="bg-gradient-to-b from-brand-primary to-[#2C237A] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8">
          <div class="max-w-6xl mx-auto">
            <!-- Breadcrumbs -->
            <nav class="flex items-center gap-2 text-xs text-white/70 mb-4" aria-label="Breadcrumb">
              <a href="/" class="hover:text-white transition-colors">Home</a>
              <span aria-hidden="true">/</span>
              <span class="text-white font-medium" aria-current="page">Visa Assistance</span>
            </nav>

            <div class="max-w-3xl mb-8">
              <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-gold/20 text-brand-gold border border-brand-gold/30 mb-3">
                <span class="w-1.5 h-1.5 rounded-full bg-brand-gold"></span>
                Demo assistance catalog · Manual review required
              </span>
              <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                Global Travel Visas, Made Simple & Stress-Free.
              </h1>
              <p class="text-sm sm:text-base text-white/80 leading-relaxed">
                Assisted document vetting, electronic application guidance, biometric appointment scheduling support, and compliant consular checklist preparation.
              </p>
            </div>

            <!-- Visa Search Box Container -->
            <div class="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-brand-black border border-brand-border/60">
              <form id="visa-hub-search-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <!-- Citizenship Selector -->
                  <div class="md:col-span-3">
                    <label for="visa-hub-citizenship" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                      My Citizenship
                    </label>
                    <div class="relative">
                      <select
                        id="visa-hub-citizenship"
                        class="w-full pl-3 pr-8 py-3 bg-brand-canvas border border-brand-border rounded-xl text-xs font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all appearance-none cursor-pointer"
                      >
                        <option value="LK" selected>🇱🇰 Sri Lankan Passport</option>
                        <option value="IN">🇮🇳 Indian Passport</option>
                        <option value="GB">🇬🇧 British Passport</option>
                        <option value="US">🇺🇸 United States Passport</option>
                        <option value="AU">🇦🇺 Australian Passport</option>
                        <option value="OTHER">🌍 Other International</option>
                      </select>
                      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <!-- Destination Autocomplete -->
                  <div class="md:col-span-4" id="visa-hub-dest-container">
                    <label for="visa-hub-destination" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                      Travelling To
                    </label>
                    <div class="relative">
                      <input
                        type="text"
                        id="visa-hub-destination"
                        autocomplete="off"
                        placeholder="e.g. UAE (Dubai), UK, Singapore, France"
                        value="${journeyEscape(this.prefilledDestination || 'United Arab Emirates')}"
                        class="w-full pl-9 pr-3 py-3 bg-brand-canvas border border-brand-border rounded-xl text-xs font-semibold text-brand-black placeholder:text-brand-muted/70 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                      />
                      <svg class="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                  </div>

                  <!-- Travel Purpose -->
                  <div class="md:col-span-3">
                    <label for="visa-hub-purpose" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                      Travel Purpose
                    </label>
                    <div class="relative">
                      <select
                        id="visa-hub-purpose"
                        class="w-full pl-3 pr-8 py-3 bg-brand-canvas border border-brand-border rounded-xl text-xs font-semibold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all appearance-none cursor-pointer"
                      >
                        <option value="tourist" selected>🌴 Tourism & Leisure</option>
                        <option value="business">💼 Business & Conference</option>
                        <option value="transit">✈️ Transit & Stopover</option>
                        <option value="all">🔍 All Visa Categories</option>
                      </select>
                      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  <!-- Search CTA -->
                  <div class="md:col-span-2 flex items-end">
                    <button
                      type="submit"
                      id="visa-hub-search-btn"
                      class="w-full py-3 px-4 bg-brand-primary hover:bg-[#140F4D] text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer h-[42px]"
                    >
                      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                      <span>Check Rules</span>
                    </button>
                  </div>
                </div>

                <!-- Instant Requirement Quick Pills -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label class="text-xs font-semibold">Country of residence<input id="visa-hub-residence" value="${journeyEscape(this.context.residenceCountry)}" required class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border mt-2 text-brand-black" placeholder="e.g. LK"></label>
                  <label class="text-xs font-semibold">Planned travel date<input id="visa-hub-travel-date" type="date" value="${journeyEscape(this.context.departureDate)}" required class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border mt-2 text-brand-black"></label>
                  <label class="text-xs font-semibold">Applicants<input id="visa-hub-applicants" type="number" min="1" max="9" value="${this.context.adults}" required class="w-full min-h-[44px] px-3 rounded-xl border border-brand-border mt-2 text-brand-black"></label>
                </div>
                <p class="text-xs leading-relaxed text-brand-muted">${VISA_DEMO_DISCLOSURE} No document uploads or application submission are connected.</p>
                <div class="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  <span class="text-[11px] font-bold text-brand-muted">Top Routes:</span>
                  ${POPULAR_VISA_DESTINATIONS.map(
                    dest => `
                    <button
                      type="button"
                      data-country-code="${dest.countryCode}"
                      data-country-name="${dest.countryName}"
                      class="visa-hub-quick-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-subtle hover:bg-brand-primary/10 text-brand-black hover:text-brand-primary border border-brand-border/60 transition-colors cursor-pointer"
                    >
                      <span>${dest.flagEmoji}</span>
                      <span>${dest.countryName}</span>
                        <span class="text-[10px] text-brand-muted font-normal">(example)</span>
                    </button>
                  `
                  ).join('')}
                </div>
              </form>
            </div>
          </div>
        </section>

        <!-- Main Content Area -->
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-16">
          
          <!-- Curated Featured Consular Services -->
          <section>
            <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <span class="text-xs font-bold text-brand-primary uppercase tracking-wider block mb-1">Canonical demo assistance</span>
                <h2 class="text-2xl sm:text-3xl font-bold text-brand-black">Most Requested Visa Filings</h2>
                <p class="text-sm text-brand-muted mt-1">Review example checklists and fees. Current eligibility and requirements need manual confirmation.</p>
              </div>
              <a
                href="/visa-assistance/options"
                class="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:text-brand-gold transition-colors self-start sm:self-auto"
              >
                <span>View Full Consular Catalog</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <!-- Visa Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${featuredServices
                .map(
                  service => `
                <div class="bg-white rounded-2xl border border-brand-border/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group">
                  <!-- Card Header Image & Flag -->
                  <div class="relative h-44 overflow-hidden bg-brand-canvas">
                    <img
                      src="${service.heroImage}"
                      alt="${service.title}"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    
                    <div class="absolute top-3 left-3 flex items-center gap-2">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-brand-black shadow-sm flex items-center gap-1.5">
                        <span class="text-sm">${service.flagEmoji}</span>
                        <span>${service.countryName}</span>
                      </span>
                    </div>

                    <div class="absolute top-3 right-3">
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-gold text-brand-black shadow-sm">
                        ${service.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div class="absolute bottom-3 left-3 right-3 text-white">
                      <div class="text-[11px] font-semibold text-white/90 flex items-center gap-2">
                        <span>Processing example: ${service.processingSlaBusinessDays} business days</span>
                        <span>·</span>
                        <span>${service.durationDays} Days Stay</span>
                      </div>
                    </div>
                  </div>

                  <!-- Card Body -->
                  <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 class="font-bold text-base text-brand-black group-hover:text-brand-primary transition-colors line-clamp-1">
                        ${service.title}
                      </h3>
                      <p class="text-xs text-brand-muted line-clamp-2 mt-1 leading-relaxed">
                        ${service.description}
                      </p>

                      <!-- Key Highlights -->
                      <div class="mt-3.5 space-y-1.5">
                        <div class="flex items-center gap-2 text-xs text-brand-black">
                          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                          </svg>
                          <span class="truncate">${service.validityDescription}</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-brand-black">
                          <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                          </svg>
                          <span class="truncate">${service.documentChecklist.length} Required Documents Vetted</span>
                        </div>
                      </div>
                    </div>

                    <!-- Pricing & CTA Section -->
                    <div class="pt-4 border-t border-brand-border/60 flex items-center justify-between">
                      <div>
                        <div class="text-[10px] text-brand-muted">Illustrative fee, not a live quote</div>
                        <div class="text-base font-extrabold text-brand-primary">
                          LKR ${(service.pricing.totalPriceMinor / 100).toLocaleString()}
                        </div>
                        <div class="text-[9px] text-brand-muted/80">Gov Fee + Vetting Concierge</div>
                      </div>

                      <button
                        type="button"
                        data-apply-visa-id="${service.canonicalOfferId}"
                        class="visa-apply-card-btn px-4 py-2 bg-brand-primary hover:bg-[#140F4D] text-white rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        Check & Apply
                      </button>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <!-- 4-Step Consular Workflow -->
          <section class="bg-white rounded-2xl p-6 sm:p-10 border border-brand-border/80 shadow-sm">
            <div class="text-center max-w-2xl mx-auto mb-10">
              <span class="text-xs font-bold text-brand-gold uppercase tracking-wider block mb-1">Seamless 4-Stage Protocol</span>
              <h2 class="text-2xl sm:text-3xl font-bold text-brand-black">How Vacatina Consular Desk Works</h2>
              <p class="text-xs sm:text-sm text-brand-muted mt-2">
                Assistance cannot remove rejection risk. Only the relevant authority can decide your application.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="p-4 rounded-xl bg-brand-canvas border border-brand-border/60 flex flex-col">
                <div class="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-sm flex items-center justify-center mb-3">1</div>
                <h3 class="font-bold text-sm text-brand-black mb-1">Document Audit</h3>
                <p class="text-xs text-brand-muted leading-relaxed">Review the example checklist. Secure upload is not connected in this build.</p>
              </div>

              <div class="p-4 rounded-xl bg-brand-canvas border border-brand-border/60 flex flex-col">
                <div class="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-sm flex items-center justify-center mb-3">2</div>
                <h3 class="font-bold text-sm text-brand-black mb-1">Dossier Preparation</h3>
                <p class="text-xs text-brand-muted leading-relaxed">Request the current document requirements before preparing an application.</p>
              </div>

              <div class="p-4 rounded-xl bg-brand-canvas border border-brand-border/60 flex flex-col">
                <div class="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-sm flex items-center justify-center mb-3">3</div>
                <h3 class="font-bold text-sm text-brand-black mb-1">Embassy / VFS Lodgement</h3>
                <p class="text-xs text-brand-muted leading-relaxed">No authority submission or appointment booking occurs here.</p>
              </div>

              <div class="p-4 rounded-xl bg-brand-canvas border border-brand-border/60 flex flex-col">
                <div class="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-sm flex items-center justify-center mb-3">4</div>
                <h3 class="font-bold text-sm text-brand-black mb-1">Authority decision</h3>
                <p class="text-xs text-brand-muted leading-relaxed">Approval is never guaranteed. No decision or visa document is generated here.</p>
              </div>
            </div>
          </section>

          <!-- Legal & Compliance Notice -->
          <section class="bg-brand-subtle rounded-2xl p-6 border border-brand-border/80 text-xs text-brand-muted space-y-2">
            <div class="flex items-center gap-2 font-bold text-brand-black text-sm">
              <svg class="w-4 h-4 text-brand-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Statutory Consular Advisory Compliance Notice</span>
            </div>
            <p class="leading-relaxed">
              Vacatina is not an embassy or immigration authority. This build offers local planning only. We do not issue travel visas or guarantee approval; decisions rest with the relevant authority.
            </p>
          </section>

        </div>
      </div>
    `;

    this.bindEvents(mount);

    telemetry.track('visa_hub_rendered', {
      prefilled: this.prefilledDestination
    });
  }

  private bindEvents(mount: HTMLElement): void {
    const destInput = mount.querySelector('#visa-hub-destination') as HTMLInputElement;
    const destContainer = mount.querySelector('#visa-hub-dest-container') as HTMLElement;
    const citizenshipSelect = mount.querySelector('#visa-hub-citizenship') as HTMLSelectElement;
    const purposeSelect = mount.querySelector('#visa-hub-purpose') as HTMLSelectElement;
    const searchForm = mount.querySelector('#visa-hub-search-form') as HTMLFormElement;
    if (this.context.citizenshipCountry) citizenshipSelect.value = this.context.citizenshipCountry;
    if (this.context.purpose) purposeSelect.value = this.context.purpose === 'tourism' ? 'tourist' : this.context.purpose;

    if (destInput && destContainer) {
      initVisaCountryAutocomplete({
        inputElement: destInput,
        containerElement: destContainer,
        onSelect: dest => {
          this.selectedDestCode = dest.countryCode;
        }
      });
    }

    if (citizenshipSelect) {
      citizenshipSelect.addEventListener('change', () => {
        this.selectedCitizenshipCode = citizenshipSelect.value;
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', e => {
        e.preventDefault();
        const dest = destInput ? destInput.value.trim() : '';
        const citizenship = citizenshipSelect ? citizenshipSelect.value : 'LK';
        const purpose = purposeSelect ? purposeSelect.value : 'tourist';

        this.context = { ...this.context, destination: dest, citizenshipCountry: citizenship, purpose: purpose === 'tourist' ? 'tourism' : purpose, residenceCountry: mount.querySelector<HTMLInputElement>('#visa-hub-residence')!.value.trim(), departureDate: mount.querySelector<HTMLInputElement>('#visa-hub-travel-date')!.value, adults: Number(mount.querySelector<HTMLInputElement>('#visa-hub-applicants')!.value) };
        const errors = validateVisaContext(this.context);
        if (errors.length) { showToast(errors.join(' '), 'warning'); return; }
        rememberVisaContext(this.context);
        const searchUrl = `/visa-assistance/search?${visaContextQuery(this.context)}`;
        if (typeof window !== 'undefined' && (window as any).__VACATINA_ROUTER__) {
          (window as any).__VACATINA_ROUTER__.navigateTo(searchUrl);
        }
      });
    }

    // Quick pills
    mount.querySelectorAll('.visa-hub-quick-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const code = (btn as HTMLElement).dataset.countryCode || 'AE';
        const name = (btn as HTMLElement).dataset.countryName || 'United Arab Emirates';
        if (destInput) destInput.value = name;
        this.selectedDestCode = code;

        searchForm.requestSubmit();
      });
    });

    // Apply Buttons
    mount.querySelectorAll('.visa-apply-card-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const offerId = (btn as HTMLElement).dataset.applyVisaId;
        if (offerId && typeof window !== 'undefined' && (window as any).__VACATINA_ROUTER__) {
          (window as any).__VACATINA_ROUTER__.navigateTo(`/visa-assistance/apply/${offerId}?${visaContextQuery(this.context)}`);
        }
      });
    });
  }
}

export const visaHubView = new VisaHubView();
