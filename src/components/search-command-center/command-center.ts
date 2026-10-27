/* ============================================================================
 * Vacatina 11-Tab Unified Search Command Center & Traveller Selector Controller
 * Authorities:
 * - ANTIGRAVITY ULTRA MASTER INSTRUCTION (§42–§57)
 * - 01_PRODUCT_ARCHITECTURE.md (11 Tabs in Locked Order)
 * - Screen 03 Foundation v1.1 Locked (Recovered Multi-City Leg Builder, Airport
 *   Autocomplete Datalist, Rooms Stepper, Collapsible Advanced Options, Cars &
 *   Transfers Dual-Mode Switcher, and 01 · Draft Trip Plan Staging)
 * ============================================================================ */

import type { CabinClass, CommandCenterTabId } from '../../lib/domain/types.ts';
import {
  LOCKED_11_TAB_ORDER,
  searchCommandService
} from '../../lib/services/search.service.ts';
import { tripBucketService } from '../../lib/services/trip-bucket.service.ts';
import {
  MAX_TOTAL_PASSENGERS,
  MIN_ADULTS,
  formatTravellerSummary
} from '../../lib/validation/travellers.ts';
import { telemetry } from '../../lib/analytics/telemetry.ts';
import { showToast } from '../ui/toast.ts';
import { openProductConfiguratorModal } from '../dialogs/dialogs-controller.ts';
import { openTripBucketDrawer } from '../trip-bucket/trip-bucket-ui.ts';
import { routerService } from '../../lib/services/router.service.ts';

let activeTravellerTrigger: HTMLElement | null = null;

const AIRPORT_SUGGESTIONS = [
  'Colombo (CMB) — Bandaranaike',
  'London (LHR) — Heathrow Airport',
  'Dubai (DXB) — Dubai International',
  'Malé (MLE) — Velana International',
  'Bangkok (BKK) — Suvarnabhumi',
  'Singapore (SIN) — Changi Airport',
  'Tokyo (HND) — Haneda Airport',
  'Paris (CDG) — Charles de Gaulle',
  'Zurich (ZRH) — Zurich Airport',
  'Denpasar (DPS) — Ngurah Rai Bali'
];

export function activateSearchTabByDomId(tabDomId: string, focusTab = false): void {
  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>('#search-command-center [role="tab"]')
  );
  const targetTab = document.getElementById(tabDomId);
  if (!targetTab) return;

  tabs.forEach(tab => {
    const isTarget = tab === targetTab;
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;

    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    tab.setAttribute('tabindex', isTarget ? '0' : '-1');

    if (isTarget) {
      tab.className =
        'search-tab min-h-[44px] px-4 py-2 rounded-xl text-[13px] font-semibold bg-brand-primary text-white shadow-sm whitespace-nowrap transition-colors';
    } else {
      tab.className =
        'search-tab min-h-[44px] px-3.5 py-2 rounded-xl text-[13px] font-medium text-brand-muted hover:text-brand-primary hover:bg-brand-subtle whitespace-nowrap transition-colors';
    }

    if (panel) {
      panel.classList.toggle('hidden', !isTarget);
    }
  });

  if (focusTab) {
    targetTab.focus();
  }
  try {
    targetTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  } catch {
    // fallback
  }

  const matched = LOCKED_11_TAB_ORDER.find(t => t.domTabId === tabDomId);
  if (matched) {
    searchCommandService.setActiveTab(matched.id);
    telemetry.track('search_tab_activated', { tabId: matched.id, tabDomId });

    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', matched.id);
      url.hash = 'search-command-center';
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
}

export function closeTravellerPopover(returnFocus = false): void {
  const popover = document.getElementById('traveller-selector-popover');
  if (!popover || popover.classList.contains('hidden')) return;
  popover.classList.add('hidden');
  popover.setAttribute('aria-hidden', 'true');

  if (activeTravellerTrigger) {
    activeTravellerTrigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) activeTravellerTrigger.focus();
  }
  activeTravellerTrigger = null;
}

export function isTravellerPopoverOpen(): boolean {
  const popover = document.getElementById('traveller-selector-popover');
  return Boolean(popover && !popover.classList.contains('hidden'));
}

export function initSearchCommandCenter(): void {
  ensureAutocompleteDatalist();

  const tabList = document.querySelector<HTMLElement>('#search-command-center [role="tablist"]');
  if (tabList) {
    const parent = tabList.parentElement;
    if (parent) {
      parent.classList.add('scc-rail-wrapper');
      const updateScrollIndicator = () => {
        const atEnd = tabList.scrollLeft + tabList.clientWidth >= tabList.scrollWidth - 12;
        parent.classList.toggle('at-end', atEnd);
      };
      tabList.addEventListener('scroll', updateScrollIndicator, { passive: true });
      window.addEventListener('resize', updateScrollIndicator, { passive: true });
      setTimeout(updateScrollIndicator, 50);
    }
  }

  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>('#search-command-center [role="tab"]')
  );

  tabs.forEach((tab, idx) => {
    tab.classList.add('min-h-[44px]');

    tab.addEventListener('click', () => {
      closeTravellerPopover(false);
      activateSearchTabByDomId(tab.id, false);
    });

    tab.addEventListener('keydown', event => {
      let nextIndex = idx;
      if (event.key === 'ArrowRight') {
        nextIndex = (idx + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (idx - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      activateSearchTabByDomId(tabs[nextIndex].id, true);
    });
  });

  initFlightPanelControls();
  initBundlePanelControls();
  initCarsTransfersDualMode();
  initRailSwapControl();
  initEditableSearchFieldCards();
  initTravellerSelectorPopover();
  initSearchSubmitButtons();
  initHeroAiTripPrompt();
  syncSearchDisplayElements();

  searchCommandService.subscribe(() => {
    syncSearchDisplayElements();
  });
}

function ensureAutocompleteDatalist(): void {
  if (document.getElementById('vacatina-airports-datalist')) return;
  const datalist = document.createElement('datalist');
  datalist.id = 'vacatina-airports-datalist';
  datalist.innerHTML = AIRPORT_SUGGESTIONS.map(item => `<option value="${item}"></option>`).join('');
  document.body.appendChild(datalist);
}

/**
 * Makes all non-traveller field cards across the 11 panels interactive & editable on click/Enter
 * while preserving the exact `#*-display` IDs expected by programmatic prefill & E2E tests.
 */
function initEditableSearchFieldCards(): void {
  const scc = document.getElementById('search-command-center');
  if (!scc) return;

  const allFieldCards = Array.from(scc.querySelectorAll<HTMLElement>('.search-panel .grid > div'));
  allFieldCards.forEach(card => {
    const labelSpan = card.querySelector<HTMLElement>('span.uppercase');
    const valueDiv = card.querySelector<HTMLElement>('.font-semibold.text-sm');
    if (!labelSpan || !valueDiv) return;

    const labelText = (labelSpan.textContent || '').toLowerCase();
    const isTravellerCard =
      labelText.includes('traveller') ||
      labelText.includes('traveler') ||
      labelText.includes('rooms & guests') ||
      labelText.includes('passengers');

    if (isTravellerCard) return;

    card.classList.add('search-field-card', 'cursor-text');
    valueDiv.setAttribute('contenteditable', 'true');
    valueDiv.setAttribute('role', 'textbox');
    valueDiv.setAttribute('aria-label', (labelSpan.textContent || 'Search field').trim());
    valueDiv.setAttribute('spellcheck', 'false');
    valueDiv.classList.add('focus:outline-none', 'focus:text-brand-primary');

    card.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('button')) return;
      if (document.activeElement !== valueDiv) {
        valueDiv.focus();
      }
    });

    valueDiv.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        valueDiv.blur();
      }
    });

    valueDiv.addEventListener('blur', () => {
      const newVal = (valueDiv.textContent || '').trim();
      if (!newVal) return;
      const id = valueDiv.id;
      if (id === 'flights-from-display') {
        searchCommandService.prefillTab('flights', { from: newVal });
      } else if (id === 'flights-to-display') {
        searchCommandService.prefillTab('flights', { to: newVal });
      } else if (id === 'hotels-destination-display') {
        searchCommandService.prefillTab('hotels', { destination: newVal });
      } else if (id === 'visa-country-display') {
        searchCommandService.prefillTab('visa', { country: newVal });
      } else if (id === 'packages-destination-display') {
        searchCommandService.prefillTab('packages', { destination: newVal });
      } else if (id === 'cars-pickup-display') {
        searchCommandService.prefillTab('cars', { pickup: newVal });
      } else if (id === 'rails-from-display') {
        searchCommandService.prefillTab('rails', { fromStation: newVal });
      } else if (id === 'rails-to-display') {
        searchCommandService.prefillTab('rails', { toStation: newVal });
      } else if (id === 'cruises-destination-display') {
        searchCommandService.prefillTab('cruises', { region: newVal });
      } else if (id === 'activities-destination-display') {
        searchCommandService.prefillTab('activities', { destination: newVal });
      } else if (id === 'sightseeing-destination-display') {
        searchCommandService.prefillTab('sightseeing', { destination: newVal });
      } else if (id === 'insurance-region-display') {
        searchCommandService.prefillTab('insurance', { region: newVal });
      } else if (id === 'bundle-destination-display') {
        searchCommandService.prefillTab('bundle', { destination: newVal });
      }
    });
  });
}

function initFlightPanelControls(): void {
  const flightPanel = document.getElementById('panel-flights');
  if (!flightPanel) return;

  const fromCard = flightPanel.querySelector('.grid > div:first-child .font-semibold.text-sm');
  if (fromCard && !fromCard.id) {
    fromCard.id = 'flights-from-display';
  }

  // Wire Origin/Destination Swap button with 180deg rotation
  const swapBtn = flightPanel.querySelector<HTMLButtonElement>(
    'button[aria-label="Swap origin and destination"]'
  );
  if (swapBtn) {
    swapBtn.id = 'flights-swap-btn';
    let rotated = false;
    swapBtn.addEventListener('click', event => {
      event.stopPropagation();
      rotated = !rotated;
      swapBtn.style.transition = 'transform 210ms cubic-bezier(0.22, 1, 0.36, 1)';
      swapBtn.style.transform = rotated ? 'rotate(180deg)' : 'rotate(0deg)';
      const swapped = searchCommandService.swapFlightOriginDestination();
      telemetry.track('flight_swap', swapped);
      showToast(`Swapped route: ${swapped.from} → ${swapped.to}`, 'brand');
    });
  }

  // Create Multi-City dynamic leg builder container (Recovered from Screen 03 Foundation v1.1)
  let multiCityContainer = document.getElementById('multi-city-legs');
  if (!multiCityContainer) {
    multiCityContainer = document.createElement('div');
    multiCityContainer.id = 'multi-city-legs';
    multiCityContainer.className = 'hidden mt-3 p-3.5 rounded-xl bg-brand-canvas border border-brand-border space-y-2.5 text-xs';
    const gridEl = flightPanel.querySelector('.grid');
    if (gridEl && gridEl.parentNode) {
      gridEl.parentNode.insertBefore(multiCityContainer, gridEl.nextSibling);
    }
  }

  // Create inline Flight Validation Alert (#flight-validation-alert)
  let validationAlert = document.getElementById('flight-validation-alert');
  if (!validationAlert) {
    validationAlert = document.createElement('div');
    validationAlert.id = 'flight-validation-alert';
    validationAlert.setAttribute('role', 'alert');
    validationAlert.className =
      'hidden mt-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#B91C1C] font-medium';
    flightPanel.appendChild(validationAlert);
  }

  let multiCityLegs: Array<{ from: string; to: string; date: string }> = [
    { from: 'London (LHR)', to: 'Paris (CDG)', date: '18 Nov 2026' },
    { from: 'Paris (CDG)', to: 'Colombo (CMB)', date: '27 Nov 2026' }
  ];

  const renderMultiCityLegs = () => {
    if (!multiCityContainer) return;
    multiCityContainer.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-[10px] text-brand-primary uppercase tracking-wider">Multi-City Additional Flight Legs (${multiCityLegs.length + 1} / 5 Max)</span>
        <button
          type="button"
          id="add-multi-city-leg-btn"
          ${multiCityLegs.length >= 4 ? 'disabled' : ''}
          class="px-3 py-1 rounded-lg bg-[#F0EFFC] text-brand-primary border border-[#C7C3F4] font-semibold text-[11px] disabled:opacity-40 hover:bg-brand-primary hover:text-white transition-colors"
        >
          + Add flight leg
        </button>
      </div>
      <div class="space-y-2">
        ${multiCityLegs
          .map(
            (leg, idx) => `
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-white border border-brand-border" data-mc-leg-index="${idx}">
            <div class="sm:col-span-1 font-bold text-[11px] text-brand-muted">Leg ${idx + 2}</div>
            <div class="sm:col-span-4">
              <input type="text" list="vacatina-airports-datalist" value="${leg.from}" aria-label="Leg ${idx + 2} Origin" class="w-full px-2.5 py-1.5 rounded-lg border border-brand-border text-xs font-semibold text-brand-black">
            </div>
            <div class="sm:col-span-4">
              <input type="text" list="vacatina-airports-datalist" value="${leg.to}" aria-label="Leg ${idx + 2} Destination" class="w-full px-2.5 py-1.5 rounded-lg border border-brand-border text-xs font-semibold text-brand-black">
            </div>
            <div class="sm:col-span-2">
              <input type="text" value="${leg.date}" aria-label="Leg ${idx + 2} Date" class="w-full px-2.5 py-1.5 rounded-lg border border-brand-border text-xs font-semibold text-brand-black tabular-nums">
            </div>
            <div class="sm:col-span-1 text-right">
              <button type="button" data-remove-mc-leg="${idx}" aria-label="Remove Leg ${idx + 2}" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-[#B91C1C] hover:bg-red-50">
                ✕
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const addBtn = multiCityContainer.querySelector<HTMLButtonElement>('#add-multi-city-leg-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (multiCityLegs.length < 4) {
          multiCityLegs.push({
            from: 'Dubai (DXB)',
            to: 'Colombo (CMB)',
            date: '30 Nov 2026'
          });
          renderMultiCityLegs();
          telemetry.track('multi_city_leg_added', { totalLegs: multiCityLegs.length + 1 });
        }
      });
    }

    multiCityContainer.querySelectorAll<HTMLButtonElement>('[data-remove-mc-leg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-remove-mc-leg') || '0', 10);
        if (multiCityLegs.length > 1) {
          multiCityLegs.splice(idx, 1);
          renderMultiCityLegs();
        } else {
          showToast('Multi-City itinerary requires at least 2 flight segments.', 'warning');
        }
      });
    });
  };

  renderMultiCityLegs();

  // Wire Round Trip / One Way / Multi-City toggle pills
  const tripTypeGroup = flightPanel.querySelector('.inline-flex.items-center.gap-1\\.5');
  if (tripTypeGroup) {
    tripTypeGroup.setAttribute('role', 'radiogroup');
    tripTypeGroup.setAttribute('aria-label', 'Flight trip type');
    const pills = Array.from(tripTypeGroup.querySelectorAll<HTMLElement>('span'));
    pills.forEach((pill, i) => {
      pill.setAttribute('role', 'radio');
      pill.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      pill.setAttribute('tabindex', i === 0 ? '0' : '-1');
      pill.classList.add('cursor-pointer', 'select-none');

      const activatePill = () => {
        pills.forEach(p => {
          const active = p === pill;
          p.setAttribute('aria-checked', active ? 'true' : 'false');
          p.setAttribute('tabindex', active ? '0' : '-1');
          p.className = active
            ? 'bg-white px-3.5 py-1.5 rounded-lg font-semibold text-brand-primary shadow-sm cursor-pointer select-none'
            : 'px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary cursor-pointer select-none';
        });
        const label = (pill.textContent || '').trim();
        const returnCol = flightPanel.querySelector(
          '.grid > div:nth-child(4) .font-semibold.text-sm'
        );
        if (returnCol) {
          returnCol.textContent =
            label === 'One Way'
              ? '— One Way (No Return)'
              : label === 'Multi-City'
                ? 'Multi-Leg Schedule'
                : '27 Nov 2026';
        }
        if (multiCityContainer) {
          multiCityContainer.classList.toggle('hidden', label !== 'Multi-City');
        }
      };

      pill.addEventListener('click', activatePill);
      pill.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activatePill();
        }
      });
    });
  }
}

function initBundlePanelControls(): void {
  const bundlePanel = document.getElementById('panel-bundle');
  if (!bundlePanel) return;

  const bundleDest = bundlePanel.querySelector('.grid > div:nth-child(2) .font-semibold.text-sm');
  if (bundleDest && !bundleDest.id) {
    bundleDest.id = 'bundle-destination-display';
  }

  // Add "Save as Draft Trip Plan (01 · Draft)" button alongside "Build My Trip" (Screen 03 Recovery)
  const footerRow = bundlePanel.querySelector('.pt-4.border-t');
  if (footerRow && !document.getElementById('bundle-stage-draft-btn')) {
    const draftBtn = document.createElement('button');
    draftBtn.type = 'button';
    draftBtn.id = 'bundle-stage-draft-btn';
    draftBtn.className =
      'px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary bg-[#F0EFFC] text-xs font-semibold hover:bg-brand-primary hover:text-white transition-colors touch-target-44';
    draftBtn.textContent = 'Save as Draft in Trip Bucket (01 · Draft)';
    draftBtn.addEventListener('click', () => {
      const state = searchCommandService.getState();
      const draft = tripBucketService.stageDraftTripPlan(
        state.bundle.destination,
        state.bundle.components
      );
      telemetry.track('stage_draft_trip_plan', { id: draft.id, destination: state.bundle.destination });
      showToast(
        `Staged "${draft.title}" as 01 · Draft (excluded from Ready subtotal until configured).`,
        'brand',
        'Open Trip Bucket',
        () => {
          openTripBucketDrawer(draftBtn);
        }
      );
    });

    const primaryBtn = footerRow.querySelector('button');
    if (primaryBtn) {
      const btnGroup = document.createElement('div');
      btnGroup.className = 'flex flex-wrap items-center gap-2 w-full sm:w-auto';
      primaryBtn.parentNode?.insertBefore(btnGroup, primaryBtn);
      btnGroup.appendChild(draftBtn);
      btnGroup.appendChild(primaryBtn);
    }
  }
}

/**
 * Cars & Transfers Explicit Dual-Mode Switcher (§49: Airport Transfers vs. Self-Drive Car Hire)
 */
function initCarsTransfersDualMode(): void {
  const carsPanel = document.getElementById('panel-cars');
  if (!carsPanel || document.getElementById('cars-dual-mode-bar')) return;

  const modeBar = document.createElement('div');
  modeBar.id = 'cars-dual-mode-bar';
  modeBar.className = 'flex flex-wrap items-center justify-between gap-2 mb-3 text-xs';
  modeBar.innerHTML = `
    <div class="inline-flex items-center gap-1.5 bg-brand-subtle p-1 rounded-xl border border-brand-border" role="radiogroup" aria-label="Ground transport mode">
      <button type="button" data-cars-mode="transfer" role="radio" aria-checked="true" class="bg-white px-3.5 py-1.5 rounded-lg font-semibold text-brand-primary shadow-sm">
        Airport &amp; Point-to-Point Transfers
      </button>
      <button type="button" data-cars-mode="hire" role="radio" aria-checked="false" class="px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">
        Self-Drive &amp; Chauffeur Car Hire
      </button>
    </div>
    <span id="cars-mode-hint" class="text-[11px] text-brand-muted">Flight tracking &amp; 60m airport wait included</span>
  `;

  carsPanel.insertBefore(modeBar, carsPanel.firstChild);

  const modeBtns = modeBar.querySelectorAll<HTMLButtonElement>('[data-cars-mode]');
  const hintEl = modeBar.querySelector('#cars-mode-hint');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-cars-mode') || 'transfer';
      modeBtns.forEach(b => {
        const active = b === btn;
        b.setAttribute('aria-checked', active ? 'true' : 'false');
        b.className = active
          ? 'bg-white px-3.5 py-1.5 rounded-lg font-semibold text-brand-primary shadow-sm'
          : 'px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg';
      });
      if (mode === 'hire') {
        searchCommandService.prefillTab('cars', {
          serviceType: 'Self-Drive Car Hire (Driver Age 30+)'
        });
        if (hintEl) hintEl.textContent = 'Driver age 25–70 · Comprehensive CDW insurance options';
      } else {
        searchCommandService.prefillTab('cars', {
          serviceType: 'Airport Transfer'
        });
        if (hintEl) hintEl.textContent = 'Flight tracking & 60m airport wait included';
      }
    });
  });
}

function initRailSwapControl(): void {
  const railPanel = document.getElementById('panel-rails');
  if (!railPanel) return;
  const fromEl = document.getElementById('rails-from-display');
  const toEl = document.getElementById('rails-to-display');
  if (!fromEl || !toEl) return;

  const fromCard = fromEl.closest('.p-3.rounded-xl');
  if (fromCard && !document.getElementById('rails-swap-btn')) {
    fromCard.classList.add('relative');
    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.id = 'rails-swap-btn';
    swapBtn.setAttribute('aria-label', 'Swap departure and arrival rail stations');
    swapBtn.className =
      'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-brand-border shadow-sm flex items-center justify-center text-brand-primary hover:bg-brand-subtle';
    swapBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>`;
    swapBtn.addEventListener('click', event => {
      event.stopPropagation();
      const state = searchCommandService.getState();
      searchCommandService.prefillTab('rails', {
        fromStation: state.rails.toStation,
        toStation: state.rails.fromStation
      });
      showToast(
        `Swapped rail stations: ${state.rails.toStation} → ${state.rails.fromStation}`,
        'brand'
      );
    });
    fromCard.appendChild(swapBtn);
  }
}

function initTravellerSelectorPopover(): void {
  const scc = document.getElementById('search-command-center');
  if (!scc) return;

  const allFieldCards = Array.from(scc.querySelectorAll<HTMLElement>('.search-panel .grid > div'));
  const travellerCards: HTMLElement[] = [];

  allFieldCards.forEach(card => {
    const labelSpan = card.querySelector('span.uppercase');
    const labelText = (labelSpan?.textContent || '').toLowerCase();
    if (
      labelText.includes('traveller') ||
      labelText.includes('traveler') ||
      labelText.includes('rooms & guests') ||
      labelText.includes('passengers')
    ) {
      card.classList.add('cursor-pointer', 'search-field-card', 'relative');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('data-traveller-trigger', 'true');
      travellerCards.push(card);
    }
  });

  let popover = document.getElementById('traveller-selector-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'traveller-selector-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Travellers, Rooms and Cabin Configuration');
    popover.setAttribute('aria-hidden', 'true');
    popover.className =
      'hidden fixed sm:absolute right-4 sm:right-8 top-28 z-50 w-[calc(100vw-2rem)] max-w-[390px] bg-white border border-brand-border rounded-2xl shadow-2xl p-5 text-left';
    const cardShell = scc.querySelector('.bg-white.border');
    if (cardShell) {
      cardShell.classList.add('relative');
      cardShell.appendChild(popover);
    } else {
      scc.appendChild(popover);
    }
  }

  const renderPopoverContent = () => {
    const current = searchCommandService.getState().travellers;
    const totalPax = current.adults + current.children + current.infants;

    popover!.innerHTML = `
      <div class="flex items-center justify-between pb-3 border-b border-brand-border">
        <div>
          <span class="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Passenger, Room &amp; Cabin Rules</span>
          <h4 class="font-heading font-bold text-sm text-brand-black">Travellers &amp; Cabin Class</h4>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0EFFC] text-brand-primary tabular-nums">${totalPax} / ${MAX_TOTAL_PASSENGERS} Pax</span>
      </div>

      <div class="py-3.5 space-y-3 text-xs">
        <!-- Adults -->
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-brand-black">Adults</div>
            <div class="text-[11px] text-brand-muted">Age 12+ yrs (Minimum ${MIN_ADULTS})</div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="trav-adults-dec" aria-label="Decrease adults" ${
              current.adults <= MIN_ADULTS ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">−</button>
            <span id="trav-adults-val" class="w-6 text-center font-bold text-sm tabular-nums">${current.adults}</span>
            <button type="button" id="trav-adults-inc" aria-label="Increase adults" ${
              totalPax >= MAX_TOTAL_PASSENGERS ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">+</button>
          </div>
        </div>

        <!-- Children -->
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-brand-black">Children</div>
            <div class="text-[11px] text-brand-muted">Age 2–11 yrs</div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="trav-children-dec" aria-label="Decrease children" ${
              current.children <= 0 ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">−</button>
            <span id="trav-children-val" class="w-6 text-center font-bold text-sm tabular-nums">${current.children}</span>
            <button type="button" id="trav-children-inc" aria-label="Increase children" ${
              totalPax >= MAX_TOTAL_PASSENGERS ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">+</button>
          </div>
        </div>

        <!-- Infants -->
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-bold text-brand-black">Infants (on lap)</div>
            <div class="text-[11px] text-brand-muted">Under 2 yrs (Max 1 per adult: ≤ ${current.adults})</div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="trav-infants-dec" aria-label="Decrease infants" ${
              current.infants <= 0 ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">−</button>
            <span id="trav-infants-val" class="w-6 text-center font-bold text-sm tabular-nums">${current.infants}</span>
            <button type="button" id="trav-infants-inc" aria-label="Increase infants" ${
              totalPax >= MAX_TOTAL_PASSENGERS || current.infants >= current.adults ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">+</button>
          </div>
        </div>

        <!-- Rooms (Recovered from Screen 03 #traveler-picker) -->
        <div class="flex items-center justify-between gap-2 pt-2 border-t border-brand-border">
          <div>
            <div class="font-bold text-brand-black">Rooms (Stays &amp; Packages)</div>
            <div class="text-[11px] text-brand-muted">1 to 5 rooms per booking</div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" id="trav-rooms-dec" aria-label="Decrease rooms" ${
              current.rooms <= 1 ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">−</button>
            <span id="trav-rooms-val" class="w-6 text-center font-bold text-sm tabular-nums">${current.rooms}</span>
            <button type="button" id="trav-rooms-inc" aria-label="Increase rooms" ${
              current.rooms >= 5 ? 'disabled' : ''
            } class="w-11 h-11 rounded-xl border border-brand-border bg-brand-canvas font-bold text-base text-brand-black disabled:opacity-40 hover:border-brand-primary">+</button>
          </div>
        </div>

        <div id="traveller-validation-notice" role="alert" class="hidden p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-[#B45309] font-medium"></div>

        <!-- Cabin Class -->
        <div class="pt-2 border-t border-brand-border">
          <div class="font-bold text-[10px] text-brand-muted uppercase mb-2">Cabin Class</div>
          <div class="grid grid-cols-2 gap-2">
            ${(['Economy', 'Premium Economy', 'Business', 'First'] as CabinClass[])
              .map(
                cabin => `
              <button type="button" data-cabin-select="${cabin}" class="min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  current.cabin === cabin
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-brand-canvas text-brand-black border-brand-border hover:border-brand-primary'
                }">
                ${cabin}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-brand-border flex items-center justify-between gap-2">
        <span class="text-[11px] text-brand-muted">Max 9 passengers · Infants ≤ Adults</span>
        <button type="button" id="traveller-apply-btn" class="min-h-[44px] px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90">
          Apply
        </button>
      </div>
    `;

    const bindStepper = (btnId: string, delta: Partial<typeof current>) => {
      const btn = popover!.querySelector<HTMLButtonElement>(`#${btnId}`);
      if (!btn) return;
      btn.addEventListener('click', event => {
        event.stopPropagation();
        const res = searchCommandService.updateTravellers(delta);
        renderPopoverContent();
        if (res.notice) {
          const noticeEl = popover!.querySelector('#traveller-validation-notice');
          if (noticeEl) {
            noticeEl.textContent = res.notice;
            noticeEl.classList.remove('hidden');
          }
        }
      });
    };

    bindStepper('trav-adults-dec', { adults: current.adults - 1 });
    bindStepper('trav-adults-inc', { adults: current.adults + 1 });
    bindStepper('trav-children-dec', { children: current.children - 1 });
    bindStepper('trav-children-inc', { children: current.children + 1 });
    bindStepper('trav-infants-dec', { infants: current.infants - 1 });
    bindStepper('trav-infants-inc', { infants: current.infants + 1 });
    bindStepper('trav-rooms-dec', { rooms: Math.max(1, current.rooms - 1) });
    bindStepper('trav-rooms-inc', { rooms: Math.min(5, current.rooms + 1) });

    popover!.querySelectorAll<HTMLButtonElement>('[data-cabin-select]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.stopPropagation();
        const cabin = (btn.getAttribute('data-cabin-select') || 'Economy') as CabinClass;
        searchCommandService.updateTravellers({ cabin });
        renderPopoverContent();
      });
    });

    const applyBtn = popover!.querySelector('#traveller-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', event => {
        event.stopPropagation();
        const updated = searchCommandService.getState().travellers;
        closeTravellerPopover(true);
        showToast(`Updated travellers: ${formatTravellerSummary(updated, true)}`, 'brand');
      });
    }
  };

  travellerCards.forEach(card => {
    const openFromCard = (event: Event) => {
      event.stopPropagation();
      const wasOpen = isTravellerPopoverOpen() && activeTravellerTrigger === card;
      if (wasOpen) {
        closeTravellerPopover(true);
        return;
      }
      activeTravellerTrigger = card;
      card.setAttribute('aria-expanded', 'true');
      renderPopoverContent();
      popover!.classList.remove('hidden');
      popover!.setAttribute('aria-hidden', 'false');
    };

    card.addEventListener('click', openFromCard);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFromCard(event);
      }
    });
  });

  document.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      isTravellerPopoverOpen() &&
      !target.closest('#traveller-selector-popover') &&
      !target.closest('[data-traveller-trigger="true"]')
    ) {
      closeTravellerPopover(false);
    }
  });
}

function initSearchSubmitButtons(): void {
  LOCKED_11_TAB_ORDER.forEach(tabMeta => {
    const panel = document.getElementById(tabMeta.domPanelId);
    if (!panel) return;

    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).filter(
      b =>
        b.id !== 'flights-swap-btn' &&
        b.id !== 'rails-swap-btn' &&
        b.id !== 'bundle-stage-draft-btn' &&
        b.id !== 'add-multi-city-leg-btn' &&
        !b.hasAttribute('data-cars-mode') &&
        !b.hasAttribute('data-remove-mc-leg')
    );
    const submitBtn = buttons[buttons.length - 1];
    if (!submitBtn) return;

    submitBtn.classList.add('touch-target-44');
    submitBtn.addEventListener('click', () => {
      const state = searchCommandService.getState();

      // Validation per tabMeta.id
      if (tabMeta.id === 'flights') {
        const fromNorm = state.flights.from.trim().toLowerCase();
        const toNorm = state.flights.to.trim().toLowerCase();
        const alertEl = document.getElementById('flight-validation-alert');
        if (!state.flights.from || !state.flights.to) {
          showToast('Please specify both origin and destination airports.', 'warning');
          return;
        }
        if (fromNorm && fromNorm === toNorm) {
          if (alertEl) {
            alertEl.textContent =
              'Origin and destination cannot be identical. Please choose a different arrival airport.';
            alertEl.classList.remove('hidden');
          }
          showToast('Origin and destination airports must be different.', 'warning');
          return;
        }
        if (alertEl) alertEl.classList.add('hidden');
      }

      const canonicalSearchRoutes: Record<CommandCenterTabId, string> = {
        bundle: '/trip-builder/results',
        flights: '/flights/search',
        hotels: '/hotels/search',
        visa: '/visa-assistance/options',
        packages: '/holiday-packages/search',
        cars: '/cars-transfers/search',
        rails: '/rails/search',
        cruises: '/cruises/search',
        activities: '/activities/search',
        sightseeing: '/sightseeing-tours/search',
        insurance: '/travel-insurance/compare'
      };

      let destRoute = canonicalSearchRoutes[tabMeta.id];
      if (destRoute) {
        if (tabMeta.id === 'flights') {
          const flights = state.flights;
          const tripType =
            flights.tripType === 'one-way'
              ? 'one_way'
              : flights.tripType === 'multi-city'
                ? 'multi_city'
                : 'round_trip';
          const flightParams = new URLSearchParams();
          flightParams.set('tripType', tripType);
          flightParams.set('origin', flights.from);
          flightParams.set('destination', flights.to);
          flightParams.set('departureDate', flights.departureDate);
          if (tripType === 'round_trip' && flights.returnDate) {
            flightParams.set('returnDate', flights.returnDate);
          }
          flightParams.set('adults', String(state.travellers.adults));
          flightParams.set('children', String(state.travellers.children));
          flightParams.set('infants', String(state.travellers.infants));
          flightParams.set('cabinClass', state.travellers.cabin || 'Economy');
          if (flights.directOnly) flightParams.set('directOnly', 'true');

          // Multi-city needs its additional legs entered on the dedicated hub.
          destRoute =
            tripType === 'multi_city'
              ? `/flights?${flightParams.toString()}`
              : `/flights/search?${flightParams.toString()}`;
        } else if (tabMeta.id === 'hotels') {
          destRoute += `?destination=${encodeURIComponent(state.hotels.destination)}`;
        } else if (tabMeta.id === 'visa') {
          destRoute += `?country=${encodeURIComponent(state.visa.country)}`;
        } else if (tabMeta.id === 'packages') {
          destRoute += `?destination=${encodeURIComponent(state.packages.destination)}`;
        } else if (tabMeta.id === 'cars') {
          destRoute += `?pickup=${encodeURIComponent(state.cars.pickup)}&service=${encodeURIComponent(state.cars.serviceType)}`;
        } else if (tabMeta.id === 'rails') {
          destRoute += `?from=${encodeURIComponent(state.rails.fromStation)}&to=${encodeURIComponent(state.rails.toStation)}`;
        } else if (tabMeta.id === 'cruises') {
          destRoute += `?region=${encodeURIComponent(state.cruises.region)}`;
        } else if (tabMeta.id === 'activities') {
          destRoute += `?destination=${encodeURIComponent(state.activities.destination)}`;
        } else if (tabMeta.id === 'sightseeing') {
          destRoute += `?destination=${encodeURIComponent(state.sightseeing.destination)}`;
        } else if (tabMeta.id === 'insurance') {
          destRoute += `?region=${encodeURIComponent(state.insurance.region)}`;
        }
        routerService.navigateTo(destRoute);
      }
    });
  });
}

function initHeroAiTripPrompt(): void {
  const heroSection = document.querySelector<HTMLElement>(
    'section[aria-label="Hero and Travel Intent"]'
  );
  if (!heroSection) return;

  const promptSpan = heroSection.querySelector<HTMLElement>('.truncate');
  const planBtn = heroSection.querySelector<HTMLButtonElement>('button');

  if (promptSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'hero-ai-prompt-input';
    input.value = (
      promptSpan.textContent || 'Plan 5 days in Dubai with flights, hotel and visa.'
    ).trim();
    input.setAttribute('aria-label', 'Ask Vacatina trip planning prompt');
    input.className =
      'bg-transparent text-white placeholder-white/60 text-[13px] w-full focus:outline-none border-none';
    promptSpan.replaceWith(input);

    if (planBtn) {
      planBtn.id = 'hero-plan-my-trip-btn';
      planBtn.classList.add('touch-target-44');
      planBtn.addEventListener('click', () => {
        const promptVal = input.value.trim() || 'Plan 5 days in Dubai with flights, hotel and visa.';
        routerService.navigateTo(`/trip-planner?prompt=${encodeURIComponent(promptVal)}`);
      });
    }
  }
}

export function syncSearchDisplayElements(): void {
  const state = searchCommandService.getState();

  const setText = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el && val && document.activeElement !== el) {
      el.textContent = val;
    }
  };

  setText('flights-from-display', state.flights.from);
  setText('flights-to-display', state.flights.to);
  setText('hotels-destination-display', state.hotels.destination);
  setText('visa-country-display', state.visa.country);
  setText('packages-destination-display', state.packages.destination);
  setText('cars-servicetype-display', state.cars.serviceType);
  setText('cars-pickup-display', state.cars.pickup);
  setText('rails-from-display', state.rails.fromStation);
  setText('rails-to-display', state.rails.toStation);
  setText('cruises-destination-display', state.cruises.region);
  setText('activities-destination-display', state.activities.destination);
  setText('sightseeing-destination-display', state.sightseeing.destination);
  setText('insurance-region-display', state.insurance.region);
  setText('bundle-destination-display', state.bundle.destination);

  // Sync all Traveller summary displays across the panels
  const allTravellerTriggers = document.querySelectorAll<HTMLElement>(
    '[data-traveller-trigger="true"]'
  );
  allTravellerTriggers.forEach(card => {
    const valueEl = card.querySelector<HTMLElement>('.font-semibold.text-sm');
    const panel = card.closest('.search-panel');
    if (!valueEl || !panel) return;

    if (panel.id === 'panel-flights' || panel.id === 'panel-bundle') {
      valueEl.textContent = formatTravellerSummary(state.travellers, true, false);
    } else if (panel.id === 'panel-hotels') {
      valueEl.textContent = formatTravellerSummary(state.travellers, false, true);
    } else if (panel.id === 'panel-cars') {
      const pax = state.travellers.adults + state.travellers.children;
      valueEl.textContent = `${pax} Pass · ${Math.max(2, pax)} Bags`;
    } else {
      valueEl.textContent = formatTravellerSummary(state.travellers, false, false);
    }
  });
}

export function highlightSearchPanel(panelId: string): void {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.remove('prefill-pulse');
  void panel.offsetWidth;
  panel.classList.add('prefill-pulse');
}
