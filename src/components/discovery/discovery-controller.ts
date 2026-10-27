/* ============================================================================
 * Vacatina 10-Product Discovery Sections Controller
 * Authorities:
 * - Screen 05–08 Approved Discovery Sections
 * - 05_KNOWN_STITCH_EXPORT_ISSUES.md (Resolves all inline handler & selector bugs)
 * - 06_ANTIGRAVITY_MASTER_INSTRUCTION.md §5.3 & §5.4
 * ============================================================================ */

import type { CommandCenterTabId, TravelProductSlug } from '../../lib/domain/types.ts';
import { ALL_10_TRAVEL_PRODUCTS } from '../../features/bundle/index.ts';
import { favoritesService } from '../../lib/services/favorites.service.ts';
import { searchCommandService } from '../../lib/services/search.service.ts';
import { telemetry } from '../../lib/analytics/telemetry.ts';
import {
  activateSearchTabByDomId,
  highlightSearchPanel
} from '../search-command-center/command-center.ts';
import {
  openHolidayPackageDetailsModal,
  openProductConfiguratorModal
} from '../dialogs/dialogs-controller.ts';
import { showToast } from '../ui/toast.ts';

/**
 * Generic filter handler for any of the 10 discovery sections.
 * Enforces min-h-[44px] touch target sizing and updates aria-checked.
 */
export function filterSectionCards(
  pillsContainerId: string,
  gridId: string,
  dataAttribute: string,
  category: string,
  buttonElement?: HTMLElement | null
): number {
  const pillsContainer = document.getElementById(pillsContainerId);
  if (pillsContainer) {
    const buttons = Array.from(pillsContainer.querySelectorAll<HTMLElement>('.filter-pill'));
    buttons.forEach(btn => {
      const isActive = buttonElement ? btn === buttonElement : false;
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
      btn.className = isActive
        ? 'filter-pill bg-brand-primary text-white rounded-full px-4 py-2 min-h-[44px] text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary'
        : 'filter-pill text-brand-muted hover:bg-white hover:text-brand-black px-4 py-2 min-h-[44px] text-[12px] font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary';
    });
  }

  const grid = document.getElementById(gridId);
  if (!grid) return 0;

  let visibleCount = 0;
  const articles = Array.from(grid.querySelectorAll<HTMLElement>('article'));
  articles.forEach(card => {
    const rawAttr =
      card.getAttribute(dataAttribute) ||
      card.getAttribute('data-category') ||
      card.getAttribute('data-region') ||
      '';
    const categories = rawAttr.split(/\s+/).filter(Boolean);
    const isVisible = category === 'all' || categories.includes(category);
    card.classList.toggle('hidden', !isVisible);
    card.classList.toggle('flex', isVisible);
    if (isVisible) visibleCount += 1;
  });

  // Update or render empty-state fallback if 0 cards match
  const emptyId = `${gridId}-empty-fallback`;
  let emptyEl = document.getElementById(emptyId);
  if (visibleCount === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = emptyId;
      emptyEl.className =
        'col-span-full p-6 rounded-2xl border border-dashed border-brand-border bg-white text-center space-y-2';
      grid.appendChild(emptyEl);
    }
    emptyEl.innerHTML = `
      <div class="text-sm font-bold text-brand-black">No preview cards in "${category}" filter</div>
      <p class="text-xs text-brand-muted">Reset filter to view all curated options or search all routes in the Command Center.</p>
      <button type="button" class="mt-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold">Show All Cards</button>
    `;
    emptyEl.classList.remove('hidden');
    const resetBtn = emptyEl.querySelector('button');
    if (resetBtn && pillsContainer) {
      resetBtn.onclick = () => {
        const firstPill = pillsContainer.querySelector<HTMLElement>('.filter-pill');
        if (firstPill) firstPill.click();
      };
    }
  } else if (emptyEl) {
    emptyEl.classList.add('hidden');
  }

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (category === 'all') {
      url.searchParams.delete('region');
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('region', category);
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  telemetry.track('discovery_filter', { gridId, category, visibleCount });
  return visibleCount;
}

/**
 * Unified Favorite Heart Toggle (Strictly Isolated from Trip Bucket)
 */
export function toggleDiscoveryFavorite(
  buttonElement: HTMLElement | null,
  itemTitle: string,
  category: TravelProductSlug = 'flights',
  destination = 'Selected Destination'
): boolean {
  if (!buttonElement) return false;
  const nowSaved = favoritesService.toggle(itemTitle, category, destination);

  buttonElement.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
  const svg = buttonElement.querySelector('svg');
  if (svg) {
    svg.setAttribute('fill', nowSaved ? '#1B1464' : 'none');
    svg.classList.toggle('text-brand-primary', nowSaved);
    svg.classList.toggle('text-brand-muted', !nowSaved);
  }

  telemetry.track('favorite_toggle', { itemTitle, category, saved: nowSaved });
  showToast(
    nowSaved
      ? `Saved "${itemTitle}" to Favorites (kept separate from Trip Bucket).`
      : `Removed "${itemTitle}" from Saved Favorites.`,
    'brand'
  );
  return nowSaved;
}

/**
 * Prefill Search Command Center tab and scroll smoothly to #search-command-center
 */
export function prefillAndScrollToSearch(
  tabId: CommandCenterTabId,
  updates: Record<string, string>,
  toastMessage?: string
): void {
  searchCommandService.prefillTab(tabId, updates);
  activateSearchTabByDomId(`tab-${tabId}`, false);

  const scc = document.getElementById('search-command-center');
  if (scc) {
    scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  highlightSearchPanel(`panel-${tabId}`);

  if (toastMessage) {
    showToast(toastMessage, 'brand');
  }
}

export function initDiscoverySections(): void {
  // 1. Fix Rail Journeys 'overnight' tag so every filter pill matches at least 1 card
  const railGrid = document.getElementById('rail-journeys-grid');
  if (railGrid) {
    const articles = railGrid.querySelectorAll<HTMLElement>('article[data-rail-category]');
    if (articles.length >= 4) {
      const fourth = articles[3];
      const currentAttr = fourth.getAttribute('data-rail-category') || '';
      if (!currentAttr.includes('overnight')) {
        fourth.setAttribute('data-rail-category', `${currentAttr} overnight`.trim());
      }
    }
  }

  // 2. Enforce min-h-[44px] & keyboard arrow navigation on all 10 filter pill radiogroups
  ALL_10_TRAVEL_PRODUCTS.forEach(prod => {
    const pillsGroup = document.getElementById(prod.filterPillsDomId);
    if (!pillsGroup) return;

    const pills = Array.from(pillsGroup.querySelectorAll<HTMLElement>('.filter-pill'));
    pills.forEach((pill, idx) => {
      pill.classList.remove('min-h-[40px]');
      pill.classList.add('min-h-[44px]');
      pill.setAttribute('tabindex', idx === 0 ? '0' : '-1');

      pill.addEventListener('keydown', event => {
        let nextIdx = idx;
        if (event.key === 'ArrowRight') {
          nextIdx = (idx + 1) % pills.length;
        } else if (event.key === 'ArrowLeft') {
          nextIdx = (idx - 1 + pills.length) % pills.length;
        } else if (event.key === 'Home') {
          nextIdx = 0;
        } else if (event.key === 'End') {
          nextIdx = pills.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        pills[nextIdx].focus();
        pills[nextIdx].click();
      });
    });
  });

  // 3. Register all global window.* functions expected by inline onclick attributes in Screen 08
  registerGlobalStitchHandlers();
}

function registerGlobalStitchHandlers(): void {
  const win = window as unknown as Record<string, unknown>;

  // --- 01. Popular Flights ---
  win.filterPopularRoutes = (region: string, btn: HTMLElement) =>
    filterSectionCards('popular-filter-pills', 'popular-flights-grid', 'data-region', region, btn);

  win.selectPopularRoute = (_fromCode: string, _toCode: string, destinationLabel: string) =>
    prefillAndScrollToSearch(
      'flights',
      { from: 'Colombo (CMB) — Bandaranaike', to: destinationLabel },
      `Prefilled Flights: Colombo (CMB) → ${destinationLabel}`
    );

  win.viewAllFlights = () =>
    prefillAndScrollToSearch('flights', {}, 'Switched to Flights search.');

  win.toggleSaveRoute = (btn: HTMLElement, routeName: string) =>
    toggleDiscoveryFavorite(btn, routeName, 'flights', routeName);

  // --- 02. Visa Assistance ---
  win.filterVisaDestinations = (region: string, btn: HTMLElement) =>
    filterSectionCards('visa-filter-pills', 'visa-assistance-grid', 'data-visa-region', region, btn);

  win.selectVisaDestination = (country: string) =>
    prefillAndScrollToSearch(
      'visa',
      { country },
      `Prefilled Visa Assistance for ${country}.`
    );

  win.viewAllVisaServices = () =>
    prefillAndScrollToSearch('visa', {}, 'Switched to Visa Assistance search.');

  // --- 03. Holiday Packages ---
  win.filterHolidayPackages = (category: string, btn: HTMLElement) =>
    filterSectionCards('package-filter-pills', 'holiday-packages-grid', 'data-package-category', category, btn);

  win.customizeHolidayPackage = (destination: string) =>
    prefillAndScrollToSearch(
      'packages',
      { destination },
      `Prefilled Holiday Packages for ${destination}.`
    );

  win.exploreAllHolidayPackages = () =>
    prefillAndScrollToSearch('packages', {}, 'Switched to Holiday Packages search.');

  win.toggleSaveHolidayPackage = (btn: HTMLElement, packageName: string) =>
    toggleDiscoveryFavorite(btn, packageName, 'packages', packageName);

  win.viewHolidayPackageDetails = (
    title: string,
    destination: string,
    duration: string,
    price: string,
    triggerElement?: HTMLElement
  ) => openHolidayPackageDetailsModal(title, destination, duration, price, triggerElement);

  // --- 04. Recommended Stays (Hotels) ---
  win.filterHotels = (category: string, btn: HTMLElement) =>
    filterSectionCards('hotel-filter-pills', 'recommended-hotels-grid', 'data-hotel-category', category, btn);

  win.exploreStay = (destination: string) =>
    prefillAndScrollToSearch(
      'hotels',
      { destination: destination || 'Maldives / Dubai / Sri Lanka' },
      destination ? `Prefilled Hotels for ${destination}.` : 'Switched to Hotels search.'
    );

  win.toggleSaveHotel = (btn: HTMLElement, hotelName: string) =>
    toggleDiscoveryFavorite(btn, hotelName, 'hotels', hotelName);

  // --- 05. Popular Activities ---
  win.filterActivities = (category: string, btn: HTMLElement) =>
    filterSectionCards('activity-filter-pills', 'popular-activities-grid', 'data-activity-category', category, btn);

  win.exploreActivity = (destination: string) =>
    prefillAndScrollToSearch(
      'activities',
      { destination: destination || 'Dubai, United Arab Emirates' },
      destination ? `Prefilled Activities for ${destination}.` : 'Switched to Activities search.'
    );

  win.toggleSaveActivity = (btn: HTMLElement, activityName: string) =>
    toggleDiscoveryFavorite(btn, activityName, 'activities', activityName);

  // --- 06. Sightseeing Tours ---
  win.filterSightseeing = (category: string, btn: HTMLElement) =>
    filterSectionCards('sightseeing-filter-pills', 'sightseeing-tours-grid', 'data-sightseeing-category', category, btn);

  win.exploreSightseeingTour = (destination: string) =>
    prefillAndScrollToSearch(
      'sightseeing',
      { destination },
      `Prefilled Sightseeing Tours for ${destination}.`
    );

  win.exploreAllSightseeingTours = () =>
    prefillAndScrollToSearch('sightseeing', {}, 'Switched to Sightseeing Tours search.');

  win.toggleSaveSightseeing = (btn: HTMLElement, tourName: string) =>
    toggleDiscoveryFavorite(btn, tourName, 'sightseeing', tourName);

  // --- 07. Cars & Transfers ---
  win.filterCarsTransfers = (category: string, btn: HTMLElement) =>
    filterSectionCards('car-filter-pills', 'cars-transfers-grid', 'data-car-category', category, btn);

  win.exploreCarTransfer = (pickupLocation: string, serviceType: string) =>
    prefillAndScrollToSearch(
      'cars',
      { pickup: pickupLocation, serviceType },
      `Prefilled Cars & Transfers: ${serviceType} (${pickupLocation}).`
    );

  win.exploreAllCarsTransfers = () =>
    prefillAndScrollToSearch('cars', {}, 'Switched to Cars & Transfers search.');

  win.toggleSaveCar = (btn: HTMLElement, carName: string) =>
    toggleDiscoveryFavorite(btn, carName, 'cars', carName);

  // --- 08. Cruises & Sea Voyages ---
  win.filterCruises = (category: string, btn: HTMLElement) =>
    filterSectionCards('cruise-filter-pills', 'cruises-grid', 'data-cruise-category', category, btn);

  win.exploreCruise = (region: string) =>
    prefillAndScrollToSearch(
      'cruises',
      { region },
      `Prefilled Cruises for ${region}.`
    );

  win.exploreAllCruises = () =>
    prefillAndScrollToSearch('cruises', {}, 'Switched to Cruises search.');

  win.toggleSaveDiscovery = (btn: HTMLElement, title: string) =>
    toggleDiscoveryFavorite(btn, title, 'cruises', title);

  // --- 09. Rail Journeys (Fixing Stitch naming mismatch: filterRailCards / exploreRailRoute / exploreAllRail) ---
  const filterRailHandler = (category: string, btn: HTMLElement) =>
    filterSectionCards('rail-filter-pills', 'rail-journeys-grid', 'data-rail-category', category, btn);

  win.filterRailCards = filterRailHandler;
  win.filterRailJourneys = filterRailHandler;

  const exploreRailHandler = (fromStation: string, toStation?: string) =>
    prefillAndScrollToSearch(
      'rails',
      {
        fromStation: fromStation || 'London St Pancras',
        toStation: toStation || 'Paris Gare du Nord'
      },
      `Prefilled Rail route: ${fromStation}${toStation ? ` → ${toStation}` : ''}.`
    );

  win.exploreRailRoute = exploreRailHandler;
  win.exploreRailJourney = exploreRailHandler;
  win.exploreAllRail = () =>
    prefillAndScrollToSearch('rails', {}, 'Switched to Rails search.');

  // --- 10. Travel Insurance (Fixing Stitch naming mismatch: filterInsuranceCards / exploreInsurance / data-insurance-category) ---
  const filterInsuranceHandler = (category: string, btn: HTMLElement) =>
    filterSectionCards('insurance-filter-pills', 'travel-insurance-grid', 'data-insurance-category', category, btn);

  win.filterInsuranceCards = filterInsuranceHandler;
  win.filterInsurancePlans = filterInsuranceHandler;

  const exploreInsuranceHandler = (regionOrPlan: string, maybeRegion?: string) =>
    prefillAndScrollToSearch(
      'insurance',
      { region: maybeRegion || regionOrPlan || 'Worldwide (incl. USA & UK)' },
      `Prefilled Travel Insurance for ${maybeRegion || regionOrPlan}.`
    );

  win.exploreInsurance = exploreInsuranceHandler;
  win.selectInsurancePlan = exploreInsuranceHandler;
  win.exploreAllInsurance = () =>
    prefillAndScrollToSearch('insurance', {}, 'Switched to Travel Insurance search.');

  win.toggleSaveInsurance = (btn: HTMLElement, planName: string) =>
    toggleDiscoveryFavorite(btn, planName, 'insurance', planName);

  // Unified toggleSaveFavorite used by Rail & Insurance cards in Screen 08 HTML
  win.toggleSaveFavorite = (btn: HTMLElement, title: string) => {
    const inRail = Boolean(btn?.closest('#rail-journeys-section'));
    return toggleDiscoveryFavorite(btn, title, inRail ? 'rails' : 'insurance', title);
  };

  // Expose product configurator helper globally for testing & UI actions
  win.openVacatinaConfigurator = (productType: CommandCenterTabId, hint?: string) =>
    openProductConfiguratorModal(productType, hint);
}
