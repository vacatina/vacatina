/* ============================================================================
 * Vacatina Canonical Hotel Search Results View (/hotels/search)
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Consumes UnifiedCanonicalOffer / CanonicalHotelOffer from hotelSearchService.
 * 2. Pin-Above-API ranking: Direct manual contracts pinned above supplier API.
 * 3. Filters: Star ratings, Board basis, Direct contracts, Free cancellation, Price.
 * 4. Deep link integration with openCanonicalHotelDetailModal.
 * ============================================================================ */

import type { CanonicalHotelOffer } from '../domain/hotel-models.ts';
import type {
  HotelFilterCriteria,
  HotelSearchRequest,
  HotelSearchResponse,
  HotelSortOption
} from '../domain/hotel-search-models.ts';
import { hotelSearchService } from '../services/hotel-search.service.ts';
import { hotelFavoritesService } from '../services/hotel-favorites.service.ts';
import { openCanonicalHotelDetailModal } from './hotels-offer-detail-modal.ts';
import { initHotelDestinationAutocomplete } from './hotel-destination-autocomplete.ts';
import {
  formatOccupancySummaryText,
  renderOccupancySelectorPopover,
  type OccupancySelectorState
} from './hotel-occupancy-selector.ts';
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { showToast } from '../../../components/ui/toast.ts';
import { HOTEL_DEMO_DISCLOSURE, hotelEscape, hotelQuery, parseHotelQuery, validateHotelSearch } from '../domain/hotel-journey.ts';

export class HotelsSearchView {
  private currentRequest!: HotelSearchRequest;
  private currentResponse: HotelSearchResponse | null = null;
  private currentSort: HotelSortOption = 'recommended';
  private currentFilters: HotelFilterCriteria = {};
  private isLoading = false;
  private isModifyOpen = false;
  private occupancyCleanup?: () => void;
  private autocompleteCleanup?: () => void;
  private generation = 0;

  public async loadFromQuery(query: URLSearchParams, container: HTMLElement): Promise<void> {
    const generation = ++this.generation;
    const directOnly = query.get('directOnly') === 'true';

    this.currentRequest = parseHotelQuery(query);
    this.currentFilters = {};
    this.currentSort = 'recommended';
    const errors = validateHotelSearch(this.currentRequest);
    if (errors.length) { this.renderError(container, errors.join(' ')); return; }

    if (directOnly) {
      this.currentFilters.directContractOnly = true;
    }

    this.renderLoading(container);
    this.isLoading = true;

    try {
      this.currentResponse = await hotelSearchService.search(this.currentRequest);
      if (generation !== this.generation) return;
      this.isLoading = false;
      this.renderResults(container);
    } catch {
      this.isLoading = false;
      if (generation !== this.generation) return;
      this.renderError(container, 'Could not load hotel examples. Please retry.');
    }
  }

  private renderLoading(container: HTMLElement): void {
    container.innerHTML = `
      <div class="min-h-screen bg-brand-canvas p-4 sm:p-8 space-y-6">
        <div class="max-w-6xl mx-auto space-y-4">
          <div class="h-14 bg-gray-200 rounded-2xl animate-pulse"></div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="h-96 bg-gray-200 rounded-2xl animate-pulse hidden md:block"></div>
            <div class="md:col-span-3 space-y-4">
              <div class="h-44 bg-gray-200 rounded-2xl animate-pulse"></div>
              <div class="h-44 bg-gray-200 rounded-2xl animate-pulse"></div>
              <div class="h-44 bg-gray-200 rounded-2xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderError(container: HTMLElement, message: string): void {
    container.innerHTML = `
      <div class="min-h-screen bg-brand-canvas flex items-center justify-center p-6 text-center">
        <div class="max-w-md bg-white p-8 rounded-3xl border border-brand-border shadow-xl space-y-4">
          <div class="text-3xl">🏨</div>
          <h2 class="text-xl font-heading font-bold text-brand-black">Hotel Search Unavailable</h2>
          <p role="alert" class="text-xs text-brand-muted leading-relaxed">${hotelEscape(message)}</p>
          <a href="/hotels" class="inline-block px-6 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs">
            Return to Hotels Hub
          </a>
        </div>
      </div>
    `;
  }

  private renderResults(container: HTMLElement): void {
    if (!this.currentResponse) return;

    const visibleOffers = hotelSearchService.filterAndSortOffers(
      this.currentResponse.offers,
      this.currentFilters,
      this.currentSort
    );

    const nights = Math.max(
      1,
      Math.round(
        (new Date(this.currentRequest.checkOutDate).getTime() -
          new Date(this.currentRequest.checkInDate).getTime()) /
          86400000
      )
    );

    container.innerHTML = `
      <div class="hotels-search-view-root min-h-screen bg-brand-canvas text-brand-black pb-24">
        <h1 class="sr-only">Hotel search results</h1>
        <!-- Sticky Top Query Modification Bar -->
        <header class="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-brand-border/60 shadow-sm py-3 px-4 sm:px-8">
          <div class="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <a href="/hotels" class="text-xs font-bold text-brand-muted hover:text-brand-black flex items-center gap-1">
                ← <span class="hidden sm:inline">Hub</span>
              </a>
              <div class="h-4 w-px bg-gray-200"></div>
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="text-sm">📍</span>
                <span class="font-bold text-sm text-brand-black break-words">${hotelEscape(this.currentRequest.destination)}</span>
                <span class="text-xs text-brand-muted">(${this.currentRequest.checkInDate} to ${this.currentRequest.checkOutDate} · ${nights}N)</span>
                <span class="text-xs text-brand-muted hidden md:inline">· ${formatOccupancySummaryText(this.currentRequest.occupancy)}</span>
              </div>
            </div>

            <button 
              type="button" 
              id="modify-hotels-search-btn"
              class="px-4 py-1.5 rounded-xl border border-brand-border text-xs font-bold text-brand-primary hover:bg-brand-primary/5 transition-all"
            >
              ${this.isModifyOpen ? 'Hide Search' : 'Modify Search'}
            </button>
          </div>

          <!-- Collapsible Modify Form -->
          <div id="modify-hotels-drawer" class="${this.isModifyOpen ? 'block' : 'hidden'} max-w-6xl mx-auto pt-3 border-t border-gray-100 mt-3">
            <form id="modify-hotels-form" class="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div class="md:col-span-5 relative" id="modify-dest-container">
                <input 
                  type="text" 
                  id="modify-dest-input" 
                  value="${hotelEscape(this.currentRequest.destination)}" aria-label="Destination"
                  required
                  class="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold"
                />
              </div>
              <div class="md:col-span-4 grid grid-cols-2 gap-2">
                <input type="date" id="modify-cin-input" value="${this.currentRequest.checkInDate}" required class="px-2 py-2 rounded-xl border border-gray-300 text-xs font-semibold" />
                <input type="date" id="modify-cout-input" value="${this.currentRequest.checkOutDate}" required class="px-2 py-2 rounded-xl border border-gray-300 text-xs font-semibold" />
              </div>
              <div class="md:col-span-3 flex gap-2">
                <button type="submit" class="w-full py-2 rounded-xl bg-brand-primary text-white font-bold text-xs">
                  Update Results
                </button>
              </div>
            </form>
          </div>
        </header>

        <!-- Main Results Grid Area -->
        <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs mb-5">${HOTEL_DEMO_DISCLOSURE}</p>
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <!-- Left Filter Sidebar -->
            <aside class="lg:col-span-4 space-y-6">
              <details id="hotel-mobile-filters" ${(document.getElementById('hotel-mobile-filters') as HTMLDetailsElement | null)?.open || window.innerWidth >= 1024 ? 'open' : ''}>
                <summary class="lg:hidden min-h-[44px] flex items-center border rounded-xl px-4 mb-3 font-semibold text-sm cursor-pointer">Filter stay examples</summary>
              <div class="bg-white rounded-2xl border border-brand-border p-5 space-y-6 shadow-sm">
                <div class="flex items-center justify-between pb-3 border-b border-brand-border/60">
                  <h3 class="font-heading font-bold text-sm text-brand-black">Filters</h3>
                  <button type="button" id="reset-hotel-filters-btn" class="text-[11px] font-bold text-brand-primary hover:underline">
                    Reset All
                  </button>
                </div>

                <!-- Direct Contract Toggle -->
                <div class="space-y-2 pb-4 border-b border-brand-border/60">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="text-xs font-bold text-brand-black">Manual catalog examples</span>
                    <input 
                      type="checkbox" 
                      id="filter-direct-only" 
                      ${this.currentFilters.directContractOnly ? 'checked' : ''} 
                      class="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                    />
                  </label>
                  <p class="text-[10px] text-brand-muted">Fixture references only, not verified contracts.</p>
                </div>

                <!-- Star Rating Filter -->
                <div class="space-y-2 pb-4 border-b border-brand-border/60">
                  <div class="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Hotel Class</div>
                  <div class="space-y-1.5">
                    ${[5, 4, 3].map(stars => `
                      <label class="flex items-center justify-between text-xs cursor-pointer hover:text-brand-primary">
                        <span class="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            data-star="${stars}" 
                            ${(this.currentFilters.starRatings || []).includes(stars) ? 'checked' : ''} 
                            class="star-filter-cb rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                          />
                          <span>${'★'.repeat(stars)} (${stars} Star)</span>
                        </span>
                        <span class="text-[10px] text-brand-muted">
                          ${this.currentResponse?.facets.starCounts[stars] || 0}
                        </span>
                      </label>
                    `).join('')}
                  </div>
                </div>

                <!-- Free Cancellation Filter -->
                <div class="space-y-2 pb-4 border-b border-brand-border/60">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="text-xs font-bold text-brand-black">Free Cancellation Only</span>
                    <input 
                      type="checkbox" 
                      id="filter-free-canc" 
                      ${this.currentFilters.freeCancellationOnly ? 'checked' : ''} 
                      class="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                    />
                  </label>
                </div>

                <!-- Board Basis Filter -->
                <div class="space-y-2">
                  <div class="text-[11px] font-bold uppercase tracking-wider text-brand-muted">Meal Plan</div>
                  <div class="space-y-1.5">
                    ${[
                      { code: 'BB', label: 'Breakfast Included' },
                      { code: 'HB', label: 'Half Board (Breakfast + Dinner)' },
                      { code: 'AI', label: 'All Inclusive' },
                      { code: 'RO', label: 'Room Only' }
                    ].map(meal => `
                      <label class="flex items-center justify-between text-xs cursor-pointer hover:text-brand-primary">
                        <span class="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            data-board="${meal.code}" 
                            ${(this.currentFilters.boardBasis || []).includes(meal.code as any) ? 'checked' : ''} 
                            class="board-filter-cb rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                          />
                          <span>${meal.label}</span>
                        </span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
              </details>
            </aside>

            <!-- Right Results List Column -->
            <section class="lg:col-span-8 space-y-4">
              <!-- Result Count & Sort Selector -->
              <div class="flex flex-wrap gap-3 items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-brand-border shadow-sm">
                <div>
                  <span id="hotel-results-count" data-results-count="${visibleOffers.length}" class="font-bold text-sm text-brand-black">${visibleOffers.length} Stay Example${visibleOffers.length === 1 ? '' : 's'}</span>
                  <span class="text-xs text-brand-muted hidden sm:inline">in ${hotelEscape(this.currentRequest.destination)}</span>
                </div>

                <div class="flex items-center gap-2 text-xs">
                  <label for="hotel-sort-select" class="text-brand-muted font-medium">Sort by:</label>
                  <select 
                    id="hotel-sort-select" 
                    class="px-3 py-1.5 rounded-xl border border-gray-300 font-semibold text-xs text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                  >
                    <option value="recommended" ${this.currentSort === 'recommended' ? 'selected' : ''}>Recommended (Direct First)</option>
                    <option value="price_low_high" ${this.currentSort === 'price_low_high' ? 'selected' : ''}>Price: Low to High</option>
                    <option value="price_high_low" ${this.currentSort === 'price_high_low' ? 'selected' : ''}>Price: High to Low</option>
                    <option value="guest_rating" ${this.currentSort === 'guest_rating' ? 'selected' : ''}>Guest Rating</option>
                    <option value="stars_high_low" ${this.currentSort === 'stars_high_low' ? 'selected' : ''}>Star Rating</option>
                  </select>
                </div>
              </div>

              <!-- Offers List -->
              ${visibleOffers.length === 0 ? `
                <div class="bg-white rounded-3xl border border-brand-border p-12 text-center space-y-4">
                  <div class="text-4xl">🏨</div>
                  <h3 class="font-heading font-bold text-lg text-brand-black">No Stays Match Your Active Filters</h3>
                  <p class="text-xs text-brand-muted max-w-md mx-auto">
                    Try unchecking specific filters or broadening your destination query.
                  </p>
                  <button type="button" id="empty-reset-filters-btn" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs">
                    Clear Filters
                  </button>
                </div>
              ` : `
                <div class="space-y-4">
                  ${visibleOffers.map(hotel => {
                    const isFav = hotelFavoritesService.isHotelFavorite(hotel.hotelId);
                    return `
                      <article class="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-all group">
                        <!-- Hero Image & Badge -->
                        <div class="relative md:w-64 h-56 md:h-auto overflow-hidden bg-gray-100 shrink-0">
                          <img 
                            src="${hotel.heroImage}" 
                            alt="${hotel.name}" 
                            loading="lazy"
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              hotel.isPinnedAboveApi || hotel.sourceType === 'MANUAL'
                                ? 'bg-[#1B1464] text-white shadow-md'
                                : 'bg-brand-black/70 backdrop-blur-sm text-white'
                            }">
                              Planning reference
                            </span>
                          </div>
                          
                          <!-- Favorite Button -->
                          <button 
                            type="button" 
                            data-fav-hotel="${hotel.hotelId}"
                            aria-label="Save ${hotel.name} to Favorites"
                            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-xs hover:bg-white transition-colors ${isFav ? 'text-red-500' : 'text-brand-muted'}"
                          >
                            ${isFav ? '❤️' : '🤍'}
                          </button>
                        </div>

                        <!-- Content Details -->
                        <div class="p-5 flex-1 min-w-0 flex flex-col justify-between space-y-4">
                          <div>
                            <div class="flex items-center justify-between">
                              <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">
                                📍 ${hotel.location.city}, ${hotel.location.country}
                              </span>
                              <span class="text-xs font-bold text-[#C5A880]">
                                ${hotel.starRating}★ Property
                              </span>
                            </div>

                            <h3 class="font-heading font-bold text-lg text-brand-black mt-1 group-hover:text-brand-primary transition-colors">
                              ${hotel.name}
                            </h3>
                            <p class="text-xs text-brand-muted mt-1 line-clamp-2 leading-relaxed">
                              ${hotel.description}
                            </p>

                            <!-- Rating & Perks -->
                            <div class="flex flex-wrap items-center gap-3 mt-3 text-xs">
                              <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[11px]">
                                ★ ${hotel.guestRatingScore} / 10
                              </span>
                              <span class="text-brand-muted text-[11px]">
                                (rating reference, not verified reviews)
                              </span>
                            </div>

                            <!-- Amenity Tags -->
                            <div class="flex flex-wrap gap-1.5 mt-3">
                              ${hotel.hotelAmenities.slice(0, 3).map(a => `
                                <span class="px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] text-brand-muted font-medium">
                                  ✓ ${a}
                                </span>
                              `).join('')}
                            </div>
                          </div>

                          <!-- Pricing & CTA Bar -->
                          <div class="pt-3 border-t border-brand-border/60 flex flex-wrap gap-3 items-center justify-between">
                            <div>
                              <div class="text-[10px] text-brand-muted">Starting price from</div>
                              <div class="text-lg font-bold text-brand-black">
                                LKR ${(hotel.startingFromPriceMinor / 100).toLocaleString()}
                                <span class="text-[10px] font-normal text-brand-muted">/ night</span>
                              </div>
                              <div class="text-[10px] text-emerald-700 font-semibold">
                                LKR ${(hotel.startingFromPriceMinor * nights / 100).toLocaleString()} for ${nights} nights (taxes incl.)
                              </div>
                            </div>

                            <button 
                              type="button" 
                              data-open-hotel="${hotel.hotelId}"
                              class="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:opacity-90 shadow-sm transition-all"
                            >
                              View Rooms & Rates →
                            </button>
                          </div>
                        </div>
                      </article>
                    `;
                  }).join('')}
                </div>
              `}
            </section>
          </div>
        </main>
      </div>
    `;

    this.wireEvents(container);
  }

  private wireEvents(container: HTMLElement): void {
    for (const [id, label] of [['modify-cin-input', 'Check-in'], ['modify-cout-input', 'Check-out']]) container.querySelector(`#${id}`)?.setAttribute('aria-label', label);
    // 1. Modify Search Toggle
    const modifyBtn = container.querySelector('#modify-hotels-search-btn');
    const modifyDrawer = container.querySelector('#modify-hotels-drawer');
    if (modifyBtn && modifyDrawer) {
      modifyBtn.addEventListener('click', () => {
        this.isModifyOpen = !this.isModifyOpen;
        modifyDrawer.classList.toggle('hidden', !this.isModifyOpen);
        modifyBtn.textContent = this.isModifyOpen ? 'Hide Search' : 'Modify Search';
      });
    }

    // 2. Modify Form Submit
    const modifyForm = container.querySelector('#modify-hotels-form');
    if (modifyForm) {
      modifyForm.addEventListener('submit', e => {
        e.preventDefault();
        const dest = (container.querySelector<HTMLInputElement>('#modify-dest-input'))?.value || this.currentRequest.destination;
        const cin = (container.querySelector<HTMLInputElement>('#modify-cin-input'))?.value || this.currentRequest.checkInDate;
        const cout = (container.querySelector<HTMLInputElement>('#modify-cout-input'))?.value || this.currentRequest.checkOutDate;

        const params = new URLSearchParams({
          destination: dest,
          checkIn: cin,
          checkOut: cout,
          rooms: this.currentRequest.occupancy.rooms.toString(),
          adults: this.currentRequest.occupancy.adults.toString(),
          children: this.currentRequest.occupancy.children.toString()
        });

        routerService.navigateTo(`/hotels/search?${params.toString()}`);
      });
    }

    // 3. Sort Select
    const sortSelect = container.querySelector<HTMLSelectElement>('#hotel-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.currentSort = sortSelect.value as HotelSortOption;
        this.renderResults(container);
      });
    }

    // 4. Direct Only Checkbox
    const directCb = container.querySelector<HTMLInputElement>('#filter-direct-only');
    if (directCb) {
      directCb.addEventListener('change', () => {
        this.currentFilters.directContractOnly = directCb.checked;
        this.renderResults(container);
      });
    }

    // 5. Star Filter Checkboxes
    container.querySelectorAll<HTMLInputElement>('.star-filter-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const star = parseInt(cb.getAttribute('data-star') || '5', 10);
        const cur = new Set(this.currentFilters.starRatings || []);
        if (cb.checked) cur.add(star);
        else cur.delete(star);
        this.currentFilters.starRatings = Array.from(cur);
        this.renderResults(container);
      });
    });

    // 6. Free Cancellation Checkbox
    const freeCancCb = container.querySelector<HTMLInputElement>('#filter-free-canc');
    if (freeCancCb) {
      freeCancCb.addEventListener('change', () => {
        this.currentFilters.freeCancellationOnly = freeCancCb.checked;
        this.renderResults(container);
      });
    }

    // 7. Board Basis Checkboxes
    container.querySelectorAll<HTMLInputElement>('.board-filter-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const board = cb.getAttribute('data-board') as any;
        const cur = new Set(this.currentFilters.boardBasis || []);
        if (cb.checked) cur.add(board);
        else cur.delete(board);
        this.currentFilters.boardBasis = Array.from(cur);
        this.renderResults(container);
      });
    });

    // 8. Reset Filters Button
    const resetBtn = container.querySelector('#reset-hotel-filters-btn');
    const emptyResetBtn = container.querySelector('#empty-reset-filters-btn');
    const resetAction = () => {
      this.currentFilters = {};
      this.renderResults(container);
    };
    resetBtn?.addEventListener('click', resetAction);
    emptyResetBtn?.addEventListener('click', resetAction);

    // 9. View Rooms & Rates CTA Buttons
    container.querySelectorAll<HTMLButtonElement>('[data-open-hotel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hotelId = btn.getAttribute('data-open-hotel')!;
        routerService.navigateTo(`/hotels/property/${encodeURIComponent(hotelId)}?${hotelQuery(this.currentRequest)}`);
      });
    });

    // 10. Favorite Toggle Buttons
    container.querySelectorAll<HTMLButtonElement>('[data-fav-hotel]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const hotelId = btn.getAttribute('data-fav-hotel')!;
        const hotel = this.currentResponse?.offers.find(h => h.hotelId === hotelId);
        if (hotel) {
          const isNowFav = hotelFavoritesService.toggleHotelFavorite(hotel);
          btn.textContent = isNowFav ? '❤️' : '🤍';
          btn.className = `absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-xs hover:bg-white transition-colors ${isNowFav ? 'text-red-500' : 'text-brand-muted'}`;
          showToast(isNowFav ? `Added ${hotel.name} to Saved Favorites.` : `Removed from Favorites.`, 'brand');
        }
      });
    });
  }
}

export const hotelsSearchView = new HotelsSearchView();
