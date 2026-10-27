/* ============================================================================
 * Vacatina Dedicated Hotels Product Hub View (/hotels)
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Deep integration with Search Command Center and routerService.
 * 2. Pre-fills destination and dates; never triggers checkout directly.
 * 3. Spotlights Vacatina Direct contracted manual villas and bedbank stays.
 * ============================================================================ */

import { HOTEL_DESTINATIONS, findDestinationByCity, type HotelDestination } from '../data/destinations.ts';
import { MANUAL_HOTEL_OFFERS } from '../data/manual-hotels.ts';
import { initHotelDestinationAutocomplete } from './hotel-destination-autocomplete.ts';
import {
  formatOccupancySummaryText,
  renderOccupancySelectorPopover,
  type OccupancySelectorState
} from './hotel-occupancy-selector.ts';
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { HOTEL_DEMO_DISCLOSURE, hotelEscape, parseHotelQuery, validateHotelSearch } from '../domain/hotel-journey.ts';
import { showToast } from '../../../components/ui/toast.ts';

export class HotelsHubView {
  private selectedDestination: string = 'Bentota';
  private checkInDate: string = '';
  private checkOutDate: string = '';
  private occupancyState: OccupancySelectorState = {
    rooms: 1,
    adults: 2,
    children: 0
  };
  private autocompleteCleanup?: () => void;
  private occupancyCleanup?: () => void;

  constructor() {
    const today = new Date();
    const d1 = new Date(today.getTime() + 7 * 86400000);
    const d2 = new Date(today.getTime() + 10 * 86400000);
    this.checkInDate = d1.toISOString().split('T')[0];
    this.checkOutDate = d2.toISOString().split('T')[0];
  }

  public prefill(destination?: string): void {
    if (destination) {
      this.selectedDestination = destination;
    }
  }

  public prefillFromQuery(query: URLSearchParams): void {
    const request = parseHotelQuery(query);
    this.selectedDestination = request.destination;
    this.checkInDate = request.checkInDate;
    this.checkOutDate = request.checkOutDate;
    this.occupancyState = request.occupancy;
  }

  public render(container: HTMLElement): void {
    this.cleanup();
    container.innerHTML = `
      <div class="hotels-hub-root min-h-screen bg-brand-canvas text-brand-black pb-24">
        <!-- Hero Section with Search Command Bar -->
        <section class="relative bg-brand-primary text-white pt-10 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div class="absolute inset-0 opacity-15 bg-[radial-gradient(#C5A880_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div class="relative max-w-6xl mx-auto space-y-6">
            <!-- Breadcrumb & Back -->
            <div class="flex items-center gap-2 text-xs text-white/70">
              <a href="/" class="hover:text-white transition-colors">Home</a>
              <span>/</span>
              <span class="text-white font-semibold">Hotels & Luxury Resorts</span>
            </div>

            <!-- Title & Value Prop -->
            <div class="space-y-2 max-w-2xl">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-[#C5A880] border border-white/15">
                Canonical demo stays · Not live inventory
              </span>
              <h1 class="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight text-white leading-tight">
                Hotels & stays for your next journey.
              </h1>
              <p class="text-sm sm:text-base text-white/80 leading-relaxed">
                Explore room and rate examples, configure your dates and guests, and review what needs confirmation.
              </p>
            </div>

            <!-- Search Command Bar Card -->
            <div class="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-brand-black border border-brand-border/40 mt-8">
              <form id="hotels-hub-search-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <!-- Destination Input with Autocomplete -->
                  <div class="md:col-span-5 relative" id="hotel-dest-container">
                      <label for="hotel-hub-dest-input" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">
                      Destination or Property
                    </label>
                    <div class="relative flex items-center">
                      <span class="absolute left-3 text-brand-muted text-sm">🏨</span>
                      <input 
                        type="text" 
                        id="hotel-hub-dest-input" 
                        value="${hotelEscape(this.selectedDestination)}"
                        placeholder="e.g. Bentota, Dubai, Galle, Maldives"
                        required
                        class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition-all text-brand-black"
                      />
                    </div>
                  </div>

                  <!-- Dates -->
                  <div class="md:col-span-4 grid grid-cols-2 gap-2">
                    <div>
                      <label for="hotel-hub-checkin" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">Check-in</label>
                      <input 
                        type="date" 
                        id="hotel-hub-checkin" 
                        value="${this.checkInDate}" 
                        required
                        class="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white text-brand-black"
                      />
                    </div>
                    <div>
                      <label for="hotel-hub-checkout" class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">Check-out</label>
                      <input 
                        type="date" 
                        id="hotel-hub-checkout" 
                        value="${this.checkOutDate}" 
                        required
                        class="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white text-brand-black"
                      />
                    </div>
                  </div>

                  <!-- Occupancy Selector Button -->
                  <div class="md:col-span-3 relative" id="hotel-occupancy-container">
                    <label class="block text-[11px] font-bold uppercase tracking-wider text-brand-muted mb-1">Guests & Rooms</label>
                    <button 
                      type="button" 
                       id="hotel-hub-occupancy-btn"
                       aria-expanded="false" aria-label="Choose guests and rooms"
                      class="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-gray-50/50 text-xs font-semibold text-left flex items-center justify-between hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all text-brand-black"
                    >
                      <span id="hotel-hub-occupancy-label" class="truncate">${formatOccupancySummaryText(this.occupancyState)}</span>
                      <span class="text-xs text-brand-muted">▼</span>
                    </button>
                  </div>
                </div>

                <!-- Submit Button Bar -->
                <div class="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div class="flex items-center gap-4 text-[11px] text-brand-muted hidden sm:flex">
                    <span>Demo prices · No room hold · Confirmation required</span>
                  </div>
                  <button 
                    type="submit" 
                    id="hotel-hub-search-btn"
                    class="w-full sm:w-auto px-8 py-3 rounded-xl bg-brand-primary text-white font-bold text-xs hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Search Stay Examples</span>
                    <span>→</span>
                  </button>
                </div>
              </form>
              <p class="text-xs text-brand-muted mt-4 leading-relaxed">${HOTEL_DEMO_DISCLOSURE}</p>
            </div>
          </div>
        </section>

        <!-- Featured Direct Contracted Properties (Pin-Above-API Showcase) -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Illustrative catalog</span>
              <h2 class="text-xl sm:text-2xl font-heading font-bold text-brand-black">Explore demo stays</h2>
            </div>
            <a href="/hotels/search?directOnly=true" class="text-xs font-bold text-brand-primary hover:underline">
              View examples →
            </a>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${MANUAL_HOTEL_OFFERS.map(hotel => `
              <div class="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all">
                <div class="relative h-48 overflow-hidden bg-gray-100">
                  <img 
                    src="${hotel.heroImage}" 
                    alt="${hotel.name}" 
                    loading="lazy"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1B1464] text-white shadow-sm">
                      Demo property · Not verified
                    </span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C5A880] text-brand-black">
                      ${hotel.starRating}★
                    </span>
                  </div>
                  <div class="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold">
                    Illustrative rating ${hotel.guestRatingScore}
                  </div>
                </div>

                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">
                      📍 ${hotel.location.city}, ${hotel.location.country}
                    </div>
                    <h3 class="font-heading font-bold text-base text-brand-black mt-1 line-clamp-1 group-hover:text-brand-primary transition-colors">
                      ${hotel.name}
                    </h3>
                    <p class="text-xs text-brand-muted mt-1 line-clamp-2 leading-relaxed">
                      ${hotel.description}
                    </p>
                  </div>

                  <div class="pt-3 border-t border-brand-border/60 flex items-center justify-between">
                    <div>
                      <div class="text-[10px] text-brand-muted">Illustrative price from</div>
                      <div class="text-base font-bold text-brand-black">
                        LKR ${(hotel.startingFromPriceMinor / 100).toLocaleString()}
                        <span class="text-[10px] font-normal text-brand-muted">/ night</span>
                      </div>
                    </div>
                    <a 
                      href="/hotels/property/${hotel.hotelId}" 
                      class="px-4 py-2 rounded-xl bg-brand-primary/10 text-brand-primary font-bold text-xs hover:bg-brand-primary hover:text-white transition-all"
                    >
                      View Rates
                    </a>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Destination Collections -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Explore By Destination</span>
              <h2 class="text-xl sm:text-2xl font-heading font-bold text-brand-black">Popular Travel Destinations</h2>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            ${HOTEL_DESTINATIONS.slice(0, 8).map(dest => `
              <button type="button"
                data-dest-click="${dest.city}"
                class="destination-card relative h-40 rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-all"
              >
                <img 
                  src="${dest.imageUrl}" 
                  alt="${dest.name}" 
                  loading="lazy"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div class="absolute bottom-3 left-3 right-3 text-white">
                  <div class="text-sm font-bold truncate">${dest.city}</div>
                  <div class="text-[11px] text-white/80 truncate">Explore stay examples</div>
                </div>
              </button>
            `).join('')}
          </div>
        </section>

        <!-- Trust Badges & FAQ -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-12 border-t border-brand-border/60">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="flex items-start gap-4">
              <span class="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg font-bold shrink-0">🤝</span>
              <div>
                <h4 class="font-bold text-sm text-brand-black">Understand your stay</h4>
                <p class="text-xs text-brand-muted mt-1 leading-relaxed">Review the selected room, guests and rate conditions before requesting confirmation.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <span class="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg font-bold shrink-0">🌐</span>
              <div>
                <h4 class="font-bold text-sm text-brand-black">No live supplier connected</h4>
                <p class="text-xs text-brand-muted mt-1 leading-relaxed">This catalog uses local canonical examples, not a live hotel feed.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <span class="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg font-bold shrink-0">🛡️</span>
              <div>
                <h4 class="font-bold text-sm text-brand-black">Transparent Cancellation & Recheck</h4>
                <p class="text-xs text-brand-muted mt-1 leading-relaxed">Fixture checks cannot verify rooms or hold rates. A supplier must confirm the actual terms before booking.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    this.wireEvents(container);
  }

  private wireEvents(container: HTMLElement): void {
    // 1. Destination Autocomplete
    const destInput = container.querySelector<HTMLInputElement>('#hotel-hub-dest-input');
    const destContainer = container.querySelector<HTMLElement>('#hotel-dest-container');
    if (destInput && destContainer) {
      this.autocompleteCleanup = initHotelDestinationAutocomplete({
        inputElement: destInput,
        containerElement: destContainer,
        onSelect: (dest: HotelDestination) => {
          this.selectedDestination = dest.city;
        }
      });
    }

    // 2. Occupancy Popover
    const occupancyBtn = container.querySelector<HTMLButtonElement>('#hotel-hub-occupancy-btn');
    const occupancyContainer = container.querySelector<HTMLElement>('#hotel-occupancy-container');
    const occupancyLabel = container.querySelector<HTMLElement>('#hotel-hub-occupancy-label');

    if (occupancyBtn && occupancyContainer) {
      occupancyBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (this.occupancyCleanup) {
          this.occupancyCleanup();
          this.occupancyCleanup = undefined;
          return;
        }

        const pop = renderOccupancySelectorPopover(this.occupancyState, newState => {
          this.occupancyState = newState;
          if (occupancyLabel) {
            occupancyLabel.textContent = formatOccupancySummaryText(newState);
          }
        });

        occupancyContainer.appendChild(pop.element);
        occupancyBtn.setAttribute('aria-expanded', 'true');
        const close = () => {
          pop.cleanup();
          this.occupancyCleanup = undefined;
          occupancyBtn.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', closeOnOut);
          document.removeEventListener('keydown', onKey);
        };
        this.occupancyCleanup = close;

        // Auto close on outside click
        const closeOnOut = (evt: MouseEvent) => {
          if (!occupancyContainer.contains(evt.target as Node)) {
            close();
          }
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { close(); occupancyBtn.focus(); } };
        pop.element.addEventListener('click', event => { if ((event.target as HTMLElement).id === 'occupancy-apply-btn') { close(); occupancyBtn.focus(); } });
        document.addEventListener('click', closeOnOut);
        document.addEventListener('keydown', onKey);
      });
    }

    // 3. Search Form Submit
    const form = container.querySelector<HTMLFormElement>('#hotels-hub-search-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const dest = destInput?.value.trim() || this.selectedDestination;
        const cin = (container.querySelector<HTMLInputElement>('#hotel-hub-checkin'))?.value || this.checkInDate;
        const cout = (container.querySelector<HTMLInputElement>('#hotel-hub-checkout'))?.value || this.checkOutDate;
        const errors = validateHotelSearch({ searchId: '', destination: dest, checkInDate: cin, checkOutDate: cout, occupancy: this.occupancyState });
        if (errors.length) { showToast(errors.join(' '), 'warning'); return; }

        const params = new URLSearchParams({
          destination: dest,
          checkIn: cin,
          checkOut: cout,
          rooms: this.occupancyState.rooms.toString(),
          adults: this.occupancyState.adults.toString(),
          children: this.occupancyState.children.toString()
        });

        telemetry.track('hotel_hub_search_dispatched', {
          destination: dest,
          checkIn: cin,
          checkOut: cout
        });

        routerService.navigateTo(`/hotels/search?${params.toString()}`);
      });
    }

    // 4. Destination Cards One-Click Search
    container.querySelectorAll<HTMLElement>('[data-dest-click]').forEach(card => {
      card.addEventListener('click', () => {
        const destCity = card.getAttribute('data-dest-click') || 'Bentota';
        const params = new URLSearchParams({
          destination: destCity,
          checkIn: this.checkInDate,
          checkOut: this.checkOutDate,
          rooms: '1',
          adults: '2'
        });
        routerService.navigateTo(`/hotels/search?${params.toString()}`);
      });
    });
  }

  public cleanup(): void {
    if (this.autocompleteCleanup) {
      this.autocompleteCleanup();
      this.autocompleteCleanup = undefined;
    }
    if (this.occupancyCleanup) {
      this.occupancyCleanup();
      this.occupancyCleanup = undefined;
    }
  }
}

export const hotelsHubView = new HotelsHubView();
