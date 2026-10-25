/* ============================================================================
 * Vacatina Accessible Dialogs & Drawers Controller
 * Manages:
 * 1. Holiday Package Details Modal (#holiday-package-details-modal)
 * 2. Product Search & Configuration Modal (#product-configurator-modal)
 * 3. Unified Trip Dossier Review & Checkout Modal (#trip-dossier-review-modal)
 * 4. Screen 04 8-State Trip Bucket Reference Inspector (#screen04-states-modal)
 * 5. Saved Favorites Slide-Over Drawer (#saved-favorites-drawer)
 * 6. Journey Continuity, Seasonal Guide & Support Modal (#journey-support-modal)
 * ============================================================================ */

import type {
  CommandCenterTabId,
  ConfigurableProductOption,
  TravelProductSlug,
  TripBucketCandidate
} from '../../lib/domain/types.ts';
import {
  HOLIDAY_PACKAGE_DETAILS,
  SCREEN_04_CANONICAL_STATES,
  formatCurrencyAmount
} from '../../lib/mock-data/catalog.ts';
import {
  SUPPLIER_ADAPTER_REGISTRY,
  queryProductOptions
} from '../../lib/adapters/supplier-adapters.ts';
import {
  TRIP_BUCKET_STATE_DESCRIPTORS,
  tripBucketService
} from '../../lib/services/trip-bucket.service.ts';
import { favoritesService } from '../../lib/services/favorites.service.ts';
import { searchCommandService } from '../../lib/services/search.service.ts';
import { formatTravellerSummary } from '../../lib/validation/travellers.ts';
import { telemetry } from '../../lib/analytics/telemetry.ts';
import {
  activateFocusTrap,
  deactivateFocusTrap,
  getFocusableElements,
  hideToast,
  setBackgroundInert,
  showToast
} from '../ui/toast.ts';
import {
  openLegalAndCookieModal,
  closeLegalModal,
  initLegalAndCookieInteractions,
  getStoredCookiePreferences,
  saveCookiePreferences
} from './legal-cookie-modal.ts';
import { searchAggregatorService } from '../../lib/services/search-aggregator.service.ts';
import { CANONICAL_HYBRID_CATALOG } from '../../lib/mock-data/hybrid-catalog.ts';
import {
  getCustomerBuyingCondition,
  type VacatinaNormalizedOffer
} from '../../lib/domain/inventory-models.ts';
import { renderPartnerPortalHtml } from '../../features/partner/partner-portal.ts';
import { renderAdminPortalHtml } from '../../features/admin/admin-portal.ts';
import { manualInventoryService } from '../../lib/services/manual-inventory.service.ts';
import { globalStorageEngine } from '../../server/db/storage.ts';

export {
  openLegalAndCookieModal,
  closeLegalModal,
  initLegalAndCookieInteractions,
  getStoredCookiePreferences,
  saveCookiePreferences
};

let activeModalElement: HTMLElement | null = null;
let lastModalTrigger: HTMLElement | null = null;

export function checkIsDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      new URLSearchParams(window.location.search).get('dev') === 'true' ||
      window.localStorage.getItem('vacatina_dev_mode') === 'true'
    );
  } catch {
    return false;
  }
}

export function closeActiveDialog(returnFocus = true): void {
  if (!activeModalElement) return;
  const modal = activeModalElement;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  deactivateFocusTrap(modal);
  setBackgroundInert(false);

  const trigger = lastModalTrigger;
  activeModalElement = null;
  lastModalTrigger = null;

  if (returnFocus && trigger && typeof trigger.focus === 'function') {
    trigger.focus();
  }
}

export function openDialogElement(modal: HTMLElement, trigger?: HTMLElement | null): void {
  hideToast();
  if (activeModalElement && activeModalElement !== modal) {
    closeActiveDialog(false);
  }

  // Also ensure Trip Bucket or Mobile Nav drawers are closed before opening a modal
  const bucketDrawer = document.getElementById('trip-bucket-drawer-container');
  if (bucketDrawer && !bucketDrawer.classList.contains('hidden')) {
    bucketDrawer.classList.add('hidden');
    bucketDrawer.setAttribute('aria-hidden', 'true');
    deactivateFocusTrap(bucketDrawer);
  }
  const mobileDrawer = document.getElementById('mobile-nav-drawer-container');
  if (mobileDrawer && !mobileDrawer.classList.contains('hidden')) {
    mobileDrawer.classList.add('hidden');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    deactivateFocusTrap(mobileDrawer);
  }

  activeModalElement = modal;
  lastModalTrigger = trigger || (document.activeElement as HTMLElement | null);

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  activateFocusTrap(modal);

  window.setTimeout(() => {
    const closeBtn = modal.querySelector<HTMLElement>('[data-dialog-close="true"], #package-modal-close-btn');
    if (closeBtn) {
      closeBtn.focus();
      return;
    }
    const focusables = getFocusableElements(modal);
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  }, 10);
}

/**
 * 1. Holiday Package Details Modal (Fixing the Stitch Screen 08 overwrite bug)
 */
export function openHolidayPackageDetailsModal(
  title: string,
  destination: string,
  duration: string,
  priceDisplay: string,
  triggerElement?: HTMLElement | null
): void {
  const modal = document.getElementById('holiday-package-details-modal');
  if (!modal) return;

  const detail = HOLIDAY_PACKAGE_DETAILS[title] || {
    id: `pkg-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    destination,
    duration,
    priceDisplay,
    priceLkr: parseInt((priceDisplay || '').replace(/[^0-9]/g, ''), 10) || 310000,
    highlights: [
      'Curated accommodation options',
      'Coordinated local transfer pairings',
      'Flexible itinerary customization in Search Command Center'
    ],
    inclusions: ['Selected accommodation tier', 'Local transfers', 'Guided highlights'],
    exclusions: ['Personal expenses', 'Optional travel insurance'],
    itinerary: [
      { day: 'Day 1', title: 'Arrival & Welcome Transfer', summary: 'Arrival transfer and hotel check-in.' },
      { day: 'Day 2–3', title: 'Signature Destination Experiences', summary: 'Curated sightseeing and leisure windows.' },
      { day: 'Final Day', title: 'Departure Coordination', summary: 'Return transfer to international airport.' }
    ]
  };

  const titleEl = document.getElementById('package-modal-title');
  const durEl = document.getElementById('package-modal-duration');
  const destEl = document.getElementById('package-modal-destination');
  const priceEl = document.getElementById('package-modal-price');

  if (titleEl) titleEl.textContent = detail.title;
  if (durEl) durEl.textContent = detail.duration;
  if (destEl) destEl.textContent = detail.destination;
  if (priceEl) priceEl.textContent = detail.priceDisplay;

  let extraContainer = document.getElementById('package-modal-rich-details');
  if (!extraContainer) {
    const priceRow = priceEl?.closest('.border-t');
    if (priceRow && priceRow.parentElement) {
      extraContainer = document.createElement('div');
      extraContainer.id = 'package-modal-rich-details';
      extraContainer.className = 'space-y-3 text-xs';
      priceRow.parentElement.insertBefore(extraContainer, priceRow);
    }
  }

  if (extraContainer) {
    extraContainer.innerHTML = `
      <div class="p-3 rounded-xl bg-brand-canvas border border-brand-border">
        <div class="font-bold text-brand-black uppercase text-[10px] tracking-wider mb-1.5">Sample Day-by-Day Itinerary</div>
        <ul class="space-y-1.5 text-brand-muted">
          ${detail.itinerary
            .map(
              step =>
                `<li><strong class="text-brand-black">${step.day} — ${step.title}:</strong> ${step.summary}</li>`
            )
            .join('')}
        </ul>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div class="p-2.5 rounded-xl bg-green-50/60 border border-green-200">
          <div class="font-bold text-[#15803D] uppercase text-[10px] mb-1">✓ Included</div>
          <ul class="space-y-1 text-[11px] text-brand-black">
            ${detail.inclusions.map(inc => `<li>• ${inc}</li>`).join('')}
          </ul>
        </div>
        <div class="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
          <div class="font-bold text-[#B45309] uppercase text-[10px] mb-1">◇ Configure / Optional</div>
          <ul class="space-y-1 text-[11px] text-brand-black">
            ${detail.exclusions.map(exc => `<li>• ${exc}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  // Ensure a "Configure & Stage to Trip Bucket" button exists alongside "Customize Package"
  const customizeBtn = document.getElementById('package-modal-customize-btn');
  if (customizeBtn && customizeBtn.parentElement) {
    let stageBtn = document.getElementById('package-modal-stage-btn') as HTMLButtonElement | null;
    if (!stageBtn) {
      stageBtn = document.createElement('button');
      stageBtn.type = 'button';
      stageBtn.id = 'package-modal-stage-btn';
      stageBtn.className =
        'w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary bg-[#F0EFFC] text-xs font-semibold hover:bg-brand-primary hover:text-white transition-colors touch-target-44';
      customizeBtn.parentElement.insertBefore(stageBtn, customizeBtn);
    }
    stageBtn.textContent = 'Configure & Stage to Trip Bucket';
    stageBtn.onclick = () => {
      closeActiveDialog(false);
      openProductConfiguratorModal('packages', detail.destination, triggerElement);
    };

    customizeBtn.onclick = () => {
      closeActiveDialog(false);
      searchCommandService.prefillTab('packages', { destination: detail.destination });
      const tab = document.getElementById('tab-packages');
      if (tab) tab.click();
      const scc = document.getElementById('search-command-center');
      if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`Prefilled Holiday Packages search for ${detail.destination}.`, 'brand');
    };
  }

  telemetry.track('open_holiday_package_modal', { title, destination });
  openDialogElement(modal, triggerElement);
}

/**
 * 2. Interactive Search Results & Product Configurator Modal
 * Enforces: Discover -> Explore -> Configure -> Trip Bucket candidate -> Review
 */
export function openProductConfiguratorModal(
  productType: CommandCenterTabId,
  queryHint?: string,
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();
  const travSummary = formatTravellerSummary(
    state.travellers,
    productType === 'flights' || productType === 'bundle',
    productType === 'hotels'
  );

  if (productType === 'bundle') {
    renderBundleConfigurator(modal, state.bundle.destination, state.bundle.components, travSummary);
    openDialogElement(modal, triggerElement);
    return;
  }

  const options: ConfigurableProductOption[] = queryProductOptions(productType as TravelProductSlug, queryHint);
  const selectedOption = options[0];

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-6 text-left overflow-hidden">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Configure &amp; Stage Candidate · ${selectedOption.productLabel}</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">${selectedOption.title}</h3>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Product Configurator" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-5 space-y-4 max-h-[72vh] overflow-y-auto pr-1">
          ${
            checkIsDevMode()
              ? `
          <div class="p-3 rounded-xl bg-[#F0EFFC] border border-[#C7C3F4] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span class="font-bold text-brand-primary">Developer Diagnostics:</span>
              <span class="text-brand-black font-medium ml-1">${selectedOption.supplierName}</span>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-brand-primary border border-[#C7C3F4]">
              ${selectedOption.initialBucketState === 'ready' ? '✓ Stages as Ready' : '! Stages as Needs Action'}
            </span>
          </div>
          `
              : `
          <div class="p-3 rounded-xl bg-brand-subtle border border-brand-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="text-brand-muted font-medium">Candidate Staging for Unified Itinerary Review</span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              selectedOption.initialBucketState === 'ready'
                ? 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]'
                : 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]'
            }">
              ${selectedOption.initialBucketState === 'ready' ? '✓ Stages as Ready' : '! Stages as Needs Action'}
            </span>
          </div>
          `
          }

          ${
            options.length > 1
              ? `
            <div>
              <label for="cfg-option-select" class="block text-[11px] font-bold text-brand-muted uppercase mb-1.5">Select Available Route / Property Option</label>
              <select id="cfg-option-select" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-sm font-semibold text-brand-black bg-white">
                ${options
                  .map(
                    (opt, idx) =>
                      `<option value="${opt.id}" ${idx === 0 ? 'selected' : ''}>${opt.title} — from ${formatCurrencyAmount(opt.basePriceLkr, state.currency)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          `
              : ''
          }

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <label for="cfg-date-input" class="block text-[10px] font-bold text-brand-muted uppercase">Travel Window / Dates</label>
              <input id="cfg-date-input" type="text" value="${selectedOption.defaultDateRange}" class="w-full mt-1 bg-white border border-brand-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-black tabular-nums">
            </div>
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <label for="cfg-travellers-input" class="block text-[10px] font-bold text-brand-muted uppercase">Traveller Configuration</label>
              <input id="cfg-travellers-input" type="text" value="${travSummary}" class="w-full mt-1 bg-white border border-brand-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-black">
            </div>
          </div>

          <div>
            <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">Select Rate Tier &amp; Inclusions</span>
            <div id="cfg-tiers-container" class="space-y-2.5" role="radiogroup" aria-label="Rate Tiers">
              ${renderOptionTiersHtml(selectedOption, state.currency)}
            </div>
          </div>

          ${
            selectedOption.actionHint
              ? `
            <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#B45309]">
              <strong>! Post-Staging Action Note:</strong> ${selectedOption.actionHint}
            </div>
          `
              : ''
          }

          <div class="pt-3 border-t border-brand-border flex items-center justify-between">
            <div>
              <span class="block text-[11px] text-brand-muted font-medium uppercase">Configured Candidate Total</span>
              <span class="text-[11px] text-brand-muted">Indicative total · refreshed before booking</span>
            </div>
            <div id="cfg-computed-price" class="text-2xl font-extrabold text-brand-primary font-heading tabular-nums">
              ${formatCurrencyAmount(selectedOption.basePriceLkr, state.currency)}
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Cancel</button>
          <button type="button" id="cfg-stage-bucket-btn" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 shadow-sm touch-target-44">
            Stage Candidate to Trip Bucket
          </button>
        </div>
      </div>
    </div>
  `;

  wireProductConfiguratorEvents(modal, options, selectedOption);
  telemetry.track('open_product_configurator', { productType, queryHint });
  openDialogElement(modal, triggerElement);
}

function renderOptionTiersHtml(option: ConfigurableProductOption, currency = searchCommandService.getState().currency): string {
  return option.tiers
    .map(
      (tier, idx) => `
      <label class="flex items-start justify-between gap-3 p-3 rounded-xl border ${
        idx === 0 ? 'border-brand-primary bg-[#F0EFFC]/50' : 'border-brand-border bg-white'
      } cursor-pointer hover:border-brand-primary transition-colors">
        <div class="flex items-start gap-2.5">
          <input type="radio" name="cfg-tier-radio" value="${tier.id}" data-delta="${tier.priceDeltaLkr}" data-label="${tier.label}" ${
            idx === 0 ? 'checked' : ''
          } class="mt-1 text-brand-primary">
          <div>
            <div class="text-xs font-bold text-brand-black">${tier.label}</div>
            <div class="text-[11px] text-brand-muted mt-0.5">${tier.description}</div>
          </div>
        </div>
        <span class="text-xs font-bold text-brand-primary whitespace-nowrap tabular-nums">
          ${tier.priceDeltaLkr === 0 ? 'Included' : `+${formatCurrencyAmount(tier.priceDeltaLkr, currency)}`}
        </span>
      </label>
    `
    )
    .join('');
}

function wireProductConfiguratorEvents(
  modal: HTMLElement,
  options: ConfigurableProductOption[],
  initialOption: ConfigurableProductOption
): void {
  let currentOption = initialOption;
  let currentDelta = 0;
  let currentTierLabel = currentOption.tiers[0]?.label || 'Standard Rate';

  const priceEl = modal.querySelector('#cfg-computed-price');
  const tiersContainer = modal.querySelector('#cfg-tiers-container');
  const dateInput = modal.querySelector<HTMLInputElement>('#cfg-date-input');
  const travInput = modal.querySelector<HTMLInputElement>('#cfg-travellers-input');
  const selectEl = modal.querySelector<HTMLSelectElement>('#cfg-option-select');

  const updatePriceDisplay = () => {
    const currency = searchCommandService.getState().currency;
    if (priceEl) {
      priceEl.textContent = formatCurrencyAmount(currentOption.basePriceLkr + currentDelta, currency);
    }
  };

  const bindRadioListeners = () => {
    if (!tiersContainer) return;
    const radios = tiersContainer.querySelectorAll<HTMLInputElement>('input[name="cfg-tier-radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        currentDelta = parseInt(radio.getAttribute('data-delta') || '0', 10) || 0;
        currentTierLabel = radio.getAttribute('data-label') || currentTierLabel;
        tiersContainer.querySelectorAll('label').forEach(lbl => {
          const isChecked = lbl.contains(radio);
          lbl.classList.toggle('border-brand-primary', isChecked);
          lbl.classList.toggle('bg-[#F0EFFC]/50', isChecked);
          lbl.classList.toggle('border-brand-border', !isChecked);
        });
        updatePriceDisplay();
      });
    });
  };

  bindRadioListeners();

  if (selectEl) {
    selectEl.addEventListener('change', () => {
      const found = options.find(o => o.id === selectEl.value);
      if (found) {
        currentOption = found;
        currentDelta = 0;
        currentTierLabel = currentOption.tiers[0]?.label || 'Standard Rate';
        if (dateInput) dateInput.value = currentOption.defaultDateRange;
        if (tiersContainer) {
          tiersContainer.innerHTML = renderOptionTiersHtml(currentOption);
          bindRadioListeners();
        }
        updatePriceDisplay();
      }
    });
  }

  const stageBtn = modal.querySelector('#cfg-stage-bucket-btn');
  if (stageBtn) {
    stageBtn.addEventListener('click', () => {
      const finalPrice = currentOption.basePriceLkr + currentDelta;
      const candidate: TripBucketCandidate = {
        id: `staged-${currentOption.id}-${Date.now()}`,
        productType: currentOption.productType,
        productLabel: currentOption.productLabel,
        title: currentOption.title,
        subtitle: `${currentTierLabel} · ${ dateInput?.value || currentOption.defaultDateRange }`,
        dateSummary: dateInput?.value || currentOption.defaultDateRange,
        travellerSummary: travInput?.value || '2 Adults',
        state: currentOption.initialBucketState,
        priceLkr: finalPrice,
        holdStatusText:
          currentOption.initialBucketState === 'ready'
            ? 'Option configured · Indicative rate staged'
            : undefined,
        actionRequiredText:
          currentOption.initialBucketState === 'needs_action'
            ? currentOption.actionHint || 'Upload required traveller documents to include in Ready subtotal.'
            : undefined,
        primaryActionLabel:
          currentOption.initialBucketState === 'needs_action' ? 'Complete Requirement' : 'Modify',
        supplierName: currentOption.supplierName,
        integrationMode: 'ADAPTER-READY'
      };

      tripBucketService.stageCandidate(candidate);
      telemetry.track('stage_configured_candidate', {
        id: candidate.id,
        productType: candidate.productType,
        state: candidate.state,
        priceLkr: candidate.priceLkr
      });

      closeActiveDialog(false);

      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      showToast(
        `Staged "${candidate.title}" (${candidate.state === 'ready' ? 'Ready' : 'Needs Action'}) to Your Trip Bucket.`,
        'success',
        'Open Trip Bucket',
        () => {
          if (headerBucketBtn) headerBucketBtn.click();
        }
      );
    });
  }

  wireCommonModalCloseButtons(modal);
}

function renderBundleConfigurator(
  modal: HTMLElement,
  destination: string,
  components: string[],
  travellerSummary: string
): void {
  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-xl w-full p-6 text-left">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Cross-Product Orchestration · Tab 1</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">Build Your Bundle: ${destination}</h3>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Bundle Builder" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-5 space-y-4 text-xs">
          <div class="p-3.5 rounded-xl bg-[#F0EFFC] border border-[#C7C3F4] text-brand-black">
            <strong>Synchronized Journey Architecture:</strong> Selected components for <strong>${destination}</strong> (${travellerSummary}) are staged into your Trip Bucket with individual supplier hold states.
          </div>

          <div class="space-y-2">
            <div class="font-bold text-brand-muted uppercase text-[10px]">Selected Bundle Components (${components.length})</div>
            ${components
              .map(
                comp => `
              <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas flex items-center justify-between">
                <span class="font-semibold text-brand-black">✓ ${comp}</span>
                <span class="text-[11px] text-brand-muted">${comp.includes('Visa') ? 'Stages as Needs Action' : 'Stages as Ready'}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Close</button>
          <button type="button" id="bundle-open-bucket-btn" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">
            Review Staged Bundle in Trip Bucket
          </button>
        </div>
      </div>
    </div>
  `;

  const openBucketBtn = modal.querySelector('#bundle-open-bucket-btn');
  if (openBucketBtn) {
    openBucketBtn.addEventListener('click', () => {
      closeActiveDialog(false);
      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      if (headerBucketBtn) headerBucketBtn.click();
    });
  }

  wireCommonModalCloseButtons(modal);
}

/**
 * 3. Unified Trip Dossier Review & Checkout Preview Modal
 */
export function openTripDossierReviewModal(triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();
  const items = tripBucketService.getItems();
  const summary = tripBucketService.getSummary();
  const currency = searchCommandService.getState().currency;

  const isDevMode = Boolean(
    (typeof window !== 'undefined' && (window as any).__VACATINA_DEV_MODE__) ||
    (typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search).has('dev'))
  );

  const readyItems = items.filter(i => i.state === 'ready');
  const nonReadyItems = items.filter(i => i.state !== 'ready');

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-3xl w-full p-6 text-left">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Unified Trip Dossier Review &amp; Pre-Checkout</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">Review Your Journey (${summary.totalItems} items)</h3>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Trip Review" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-5 space-y-5 max-h-[72vh] overflow-y-auto pr-1 text-xs">
          <!-- Ready Items Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-[#15803D] uppercase tracking-wider text-[11px]">✓ Ready Items (${readyItems.length}) — Included in Estimate</span>
              <span class="font-bold text-brand-primary tabular-nums">${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</span>
            </div>
            <div class="space-y-2">
              ${
                readyItems.length > 0
                  ? readyItems
                      .map(
                        item => `
                    <div class="p-3.5 rounded-xl border border-green-200 bg-green-50/30 flex items-center justify-between gap-3">
                      <div>
                        <span class="text-[10px] font-bold text-brand-primary uppercase">${item.productLabel}</span>
                        <div class="font-bold text-sm text-brand-black">${item.title}</div>
                        <div class="text-brand-muted">${item.subtitle}</div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold text-sm text-brand-black tabular-nums">${formatCurrencyAmount(item.priceLkr, currency)}</div>
                        <span class="text-[10px] font-semibold text-[#15803D]">✓ Ready</span>
                      </div>
                    </div>
                  `
                      )
                      .join('')
                  : `<div class="p-4 rounded-xl border border-brand-border bg-brand-subtle text-brand-muted">No items are currently in the Ready state. Resolve pending items below.</div>`
              }
            </div>
          </div>

          <!-- Non-Ready / Pending Items Section -->
          ${
            nonReadyItems.length > 0
              ? `
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-[#B45309] uppercase tracking-wider text-[11px]">! Excluded / Pending Items (${nonReadyItems.length}) — Action Required</span>
                <span class="font-semibold text-brand-muted tabular-nums">Excluded: ${formatCurrencyAmount(summary.excludedSubtotalLkr, currency)}</span>
              </div>
              <div class="space-y-2">
                ${nonReadyItems
                  .map(item => {
                    const desc = TRIP_BUCKET_STATE_DESCRIPTORS[item.state];
                    return `
                      <div class="p-3.5 rounded-xl border border-amber-300 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-brand-muted uppercase">${item.productLabel}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${desc.badgeClasses}">${desc.icon} ${desc.label}</span>
                          </div>
                          <div class="font-bold text-sm text-brand-black mt-0.5">${item.title}</div>
                          <div class="text-[11px] text-[#B45309] mt-0.5">${item.actionRequiredText || item.subtitle}</div>
                        </div>
                        <div class="flex items-center gap-2 self-end sm:self-center">
                          <span class="font-bold text-xs text-brand-muted tabular-nums">${formatCurrencyAmount(item.priceLkr, currency)}</span>
                          <button type="button" data-dossier-resolve="${item.id}" class="px-3 py-2 rounded-lg bg-brand-primary text-white text-[11px] font-semibold hover:opacity-90 whitespace-nowrap">
                            ${item.primaryActionLabel || 'Resolve Now'}
                          </button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          ${
            isDevMode
              ? `
          <!-- Integration Status Transparency Table (02_API_RESPONSIBILITY_MAP.md) - Dev Only -->
          <details class="group rounded-xl border border-brand-border bg-brand-canvas p-3.5">
            <summary class="cursor-pointer font-bold text-brand-black flex items-center justify-between">
              <span>Developer Architecture &amp; Supplier Adapter Status</span>
              <span class="text-brand-primary text-[11px]">Inspect Adapters ▾</span>
            </summary>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr class="border-b border-brand-border text-brand-muted uppercase text-[10px]">
                    <th class="py-1.5 pr-2">Domain</th>
                    <th class="py-1.5 pr-2">Provider</th>
                    <th class="py-1.5 pr-2">Doc Status</th>
                    <th class="py-1.5">Runtime Mode</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-brand-border">
                  ${SUPPLIER_ADAPTER_REGISTRY.map(
                    row => `
                    <tr>
                      <td class="py-1.5 pr-2 font-semibold text-brand-black">${row.domain}</td>
                      <td class="py-1.5 pr-2 text-brand-muted">${row.provider}</td>
                      <td class="py-1.5 pr-2"><span class="px-1.5 py-0.5 rounded bg-brand-subtle font-mono text-[10px]">${row.documentedStatus}</span></td>
                      <td class="py-1.5"><span class="px-1.5 py-0.5 rounded bg-[#F0EFFC] text-brand-primary font-bold text-[10px]">${row.runtimeStatus}</span></td>
                    </tr>
                  `
                  ).join('')}
                </tbody>
              </table>
            </div>
          </details>
          `
              : ''
          }

          <div class="p-4 rounded-xl bg-brand-primary text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div class="text-[11px] text-white/75 uppercase font-bold tracking-wider">Ready Items Estimate (Included in Checkout)</div>
              <div class="text-xs text-white/85 mt-0.5">${summary.readyCount} Ready item(s) staged · ${summary.totalItems - summary.readyCount} excluded pending action</div>
            </div>
            <div class="text-2xl font-extrabold font-heading tabular-nums">${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-wrap items-center justify-between gap-3">
          ${
            isDevMode
              ? `
          <button type="button" id="dossier-open-s04-btn" class="px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-primary hover:bg-brand-subtle touch-target-44">
            Inspect Screen 04 (All 8 States)
          </button>
          `
              : '<div></div>'
          }
          <div class="flex items-center gap-2.5">
            <button type="button" id="dossier-revalidate-btn" class="px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary text-xs font-semibold hover:bg-[#F0EFFC] touch-target-44">
              ↻ Revalidate Rates
            </button>
            <button type="button" id="dossier-confirm-btn" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">
              Proceed with Ready Items (${formatCurrencyAmount(summary.readySubtotalLkr, currency)})
            </button>
          </div>
        </div>
          <div class="flex items-center gap-2.5">
            <button type="button" id="dossier-revalidate-btn" class="px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary text-xs font-semibold hover:bg-[#F0EFFC] touch-target-44">
              ↻ Revalidate Rates
            </button>
            <button type="button" id="dossier-confirm-btn" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">
              Proceed with Ready Items (${formatCurrencyAmount(summary.readySubtotalLkr, currency)})
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.querySelectorAll<HTMLButtonElement>('[data-dossier-resolve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-dossier-resolve');
      if (id) {
        const resolved = tripBucketService.resolveItemAction(id);
        if (resolved) {
          showToast(`Resolved "${resolved.title}" → Ready. Included in Ready items estimate.`, 'success');
          openTripDossierReviewModal(lastModalTrigger);
        }
      }
    });
  });

  const revalBtn = modal.querySelector('#dossier-revalidate-btn');
  if (revalBtn) {
    revalBtn.addEventListener('click', () => {
      revalBtn.textContent = '↻ Revalidating supplier holds…';
      tripBucketService.revalidateAllReadyItems(() => {
        showToast('All Ready items revalidated with deterministic supplier adapters.', 'success');
        openTripDossierReviewModal(lastModalTrigger);
      });
    });
  }

  const s04Btn = modal.querySelector('#dossier-open-s04-btn');
  if (s04Btn) {
    s04Btn.addEventListener('click', () => {
      openScreen04StatesModal(lastModalTrigger);
    });
  }

  const confirmBtn = modal.querySelector('#dossier-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      closeActiveDialog(true);
      showToast(
        `Prototype Dossier Confirmed for ${summary.readyCount} Ready item(s) (${formatCurrencyAmount(summary.readySubtotalLkr, currency)}). Payment gateway is in ADAPTER-READY mock mode.`,
        'success'
      );
    });
  }

  wireCommonModalCloseButtons(modal);
  openDialogElement(modal, triggerElement);
}

/**
 * 4. Screen 04 v1.2 Locked — Canonical 8 Trip Bucket Component States Inspector Modal
 */
export function openScreen04StatesModal(triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-4xl w-full p-6 text-left">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Screen 04 v1.2 Locked · Canonical State Engine</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">8 Trip Bucket Candidate Lifecycle States</h3>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close 8-State Inspector" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-4 max-h-[70vh] overflow-y-auto pr-1">
          <div class="mb-4 p-3 rounded-xl bg-brand-subtle border border-brand-border text-xs text-brand-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span><strong>Financial Math Rule:</strong> Only state <code class="font-bold text-[#15803D]">02 Ready</code> contributes to the Ready items estimate. States 01 and 03–08 are excluded until resolved.</span>
            <div class="flex items-center gap-2">
              <button type="button" id="s04-load-all-btn" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white font-semibold text-[11px] whitespace-nowrap hover:opacity-90">
                Load All 8 States in Drawer
              </button>
              <button type="button" id="s04-reset-baseline-btn" class="px-3 py-1.5 rounded-lg border border-brand-border bg-white text-brand-black font-semibold text-[11px] whitespace-nowrap hover:bg-brand-canvas">
                Reset Baseline (LKR 505,000)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            ${SCREEN_04_CANONICAL_STATES.map(item => {
              const desc = TRIP_BUCKET_STATE_DESCRIPTORS[item.state];
              return `
                <div class="p-4 rounded-xl border ${desc.cardBorderClasses} flex flex-col justify-between gap-2">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="font-bold text-[10px] text-brand-primary uppercase">State ${desc.code} · ${item.productLabel}</span>
                      <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${desc.badgeClasses}">${desc.icon} ${desc.label}</span>
                    </div>
                    <div class="font-bold text-sm text-brand-black">${item.title}</div>
                    <div class="text-brand-muted text-[11px] mt-0.5">${item.subtitle}</div>
                    <div class="text-[11px] text-brand-muted mt-1">${item.actionRequiredText || item.holdStatusText || ''}</div>
                  </div>
                  <div class="pt-2 border-t border-brand-border flex items-center justify-between">
                    <div>
                      ${
                        item.previousPriceLkr
                          ? `<span class="line-through text-brand-muted mr-1.5 tabular-nums">LKR ${item.previousPriceLkr.toLocaleString('en-US')}</span>`
                          : ''
                      }
                      <span class="font-bold text-brand-black tabular-nums">LKR ${item.priceLkr.toLocaleString('en-US')}</span>
                      <span class="block text-[10px] ${desc.includedInReadyTotal ? 'text-[#15803D] font-semibold' : 'text-brand-muted'}">
                        ${desc.includedInReadyTotal ? '✓ Included in Ready subtotal' : 'Excluded from Ready subtotal'}
                      </span>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg bg-brand-subtle border border-brand-border text-[11px] font-semibold text-brand-black">
                      ${item.primaryActionLabel}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex items-center justify-end">
          <button type="button" data-dialog-close="true" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">Done</button>
        </div>
      </div>
    </div>
  `;

  const loadAllBtn = modal.querySelector('#s04-load-all-btn');
  if (loadAllBtn) {
    loadAllBtn.addEventListener('click', () => {
      tripBucketService.loadAllEightStatesDemo();
      closeActiveDialog(false);
      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      if (headerBucketBtn) headerBucketBtn.click();
      showToast('Loaded all 8 canonical Screen 04 states into Your Trip Bucket.', 'brand');
    });
  }

  const resetBtn = modal.querySelector('#s04-reset-baseline-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      tripBucketService.resetToCanonicalBaseline();
      closeActiveDialog(false);
      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      if (headerBucketBtn) headerBucketBtn.click();
      showToast('Restored canonical 3-item baseline (Ready items estimate: LKR 505,000).', 'success');
    });
  }

  wireCommonModalCloseButtons(modal);
  openDialogElement(modal, triggerElement);
}

/**
 * 5. Saved Favorites Slide-Over Drawer (Strictly Isolated from Trip Bucket)
 */
export function openSavedFavoritesDrawer(triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();
  const favs = favoritesService.getAll();

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/40 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-[420px] bg-white shadow-2xl flex flex-col justify-between">
        <div class="p-6 border-b border-brand-border flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-heading font-bold text-lg text-brand-black">Saved Favorites</h2>
              <span class="px-2 py-0.5 text-[11px] font-bold bg-brand-primary text-white rounded-full tabular-nums">${favs.length}</span>
            </div>
            <p class="text-[11px] text-brand-muted mt-0.5">Inspiration bookmarks — kept strictly separate from your Trip Bucket.</p>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Saved Favorites" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-3">
          ${
            favs.length > 0
              ? favs
                  .map(
                    fav => `
                <div class="p-4 rounded-xl border border-brand-border bg-white shadow-sm flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-brand-primary uppercase">${fav.category}</span>
                    <button type="button" data-fav-remove="${fav.id}" class="text-[11px] text-brand-muted hover:text-[#B91C1C] font-medium">Remove</button>
                  </div>
                  <div class="font-bold text-sm text-brand-black">${fav.title}</div>
                  <div class="text-xs text-brand-muted">${fav.destination} · ${fav.priceHint}</div>
                  <div class="pt-2 border-t border-brand-border flex items-center justify-end">
                    <button type="button" data-fav-configure="${fav.category}" data-fav-dest="${fav.destination}" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:opacity-90">
                      Configure for Trip →
                    </button>
                  </div>
                </div>
              `
                  )
                  .join('')
              : `
              <div class="p-6 rounded-2xl border border-dashed border-brand-border bg-brand-canvas text-center space-y-2">
                <div class="text-sm font-bold text-brand-black">No Saved Favorites Yet</div>
                <p class="text-xs text-brand-muted leading-relaxed">Click the heart icon (♡) on any Flight, Hotel, Visa, Package, Cruise, Rail, or Activity card to bookmark ideas here without affecting your Trip Bucket subtotal.</p>
              </div>
            `
          }
        </div>

        <div class="p-5 border-t border-brand-border bg-brand-canvas flex items-center justify-between text-xs">
          <span class="text-brand-muted">Bookmarks never alter Trip Bucket totals.</span>
          <button type="button" data-dialog-close="true" class="px-4 py-2 rounded-xl bg-brand-primary text-white font-semibold touch-target-44">Close</button>
        </div>
      </div>
    </div>
  `;

  modal.querySelectorAll<HTMLButtonElement>('[data-fav-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-fav-remove');
      if (id) {
        favoritesService.remove(id);
        openSavedFavoritesDrawer(lastModalTrigger);
      }
    });
  });

  modal.querySelectorAll<HTMLButtonElement>('[data-fav-configure]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = (btn.getAttribute('data-fav-configure') || 'flights') as TravelProductSlug;
      const dest = btn.getAttribute('data-fav-dest') || '';
      closeActiveDialog(false);
      openProductConfiguratorModal(cat, dest, lastModalTrigger);
    });
  });

  wireCommonModalCloseButtons(modal);
  openDialogElement(modal, triggerElement);
}

/**
 * 6. Journey Continuity, Seasonal Guide, Decision Clarity & Duty Support Modal
 */
export function openInfoOrSupportModal(
  topicTitle: string,
  subtitle: string,
  bodyHtml: string,
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-xl w-full p-6 text-left">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">${subtitle}</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">${topicTitle}</h3>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Dialog" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-5 space-y-4 text-xs text-brand-muted leading-relaxed">
          ${bodyHtml}
          <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border flex items-center justify-between">
            <div>
              <strong class="text-brand-black block">Verified Vacatina Duty Desk</strong>
              <span>Tel: <a href="tel:+94113606200" class="text-brand-primary font-semibold hover:underline">+94113606200</a> · Email: <a href="mailto:info@vacatina.com" class="text-brand-primary font-semibold hover:underline">info@vacatina.com</a></span>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex items-center justify-end">
          <button type="button" data-dialog-close="true" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">Close</button>
        </div>
      </div>
    </div>
  `;

  wireCommonModalCloseButtons(modal);
  openDialogElement(modal, triggerElement);
}

function ensureDynamicModalShell(): HTMLElement {
  let modal = document.getElementById('vacatina-dynamic-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vacatina-dynamic-modal';
    modal.className = 'hidden fixed inset-0 z-50 overflow-y-auto';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
  }
  return modal;
}

function wireCommonModalCloseButtons(modal: HTMLElement): void {
  modal.querySelectorAll<HTMLElement>('[data-dialog-close="true"]').forEach(btn => {
    btn.addEventListener('click', () => closeActiveDialog(true));
  });
  const backdrop = modal.querySelector<HTMLElement>('[data-dialog-backdrop="true"]');
  if (backdrop) {
    backdrop.addEventListener('click', () => closeActiveDialog(true));
  }
}

export function initStaticPackageModalCloseWiring(): void {
  const pkgModal = document.getElementById('holiday-package-details-modal');
  if (!pkgModal) return;

  const closeBtn = document.getElementById('package-modal-close-btn');
  const cancelBtn = document.getElementById('package-modal-cancel-btn');
  const backdrop = document.getElementById('package-modal-backdrop');

  [closeBtn, cancelBtn, backdrop].forEach(el => {
    if (el) {
      el.addEventListener('click', () => {
        if (activeModalElement === pkgModal) {
          closeActiveDialog(true);
        } else {
          pkgModal.classList.add('hidden');
          pkgModal.setAttribute('aria-hidden', 'true');
          deactivateFocusTrap(pkgModal);
          setBackgroundInert(false);
        }
      });
    }
  });
}

export function isAnyCustomDialogOpen(): boolean {
  return activeModalElement !== null && !activeModalElement.classList.contains('hidden');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderOfferCardHtml(offer: VacatinaNormalizedOffer, currency = searchCommandService.getState().currency): string {
  const buyingCondition = getCustomerBuyingCondition(offer);

  let badgeClass = 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]';
  let badgeIcon = '✓';
  if (offer.confirmationMode === 'REQUEST_TO_CONFIRM') {
    badgeClass = 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]';
    badgeIcon = '⚡';
  } else if (offer.confirmationMode === 'ASSISTED_SERVICE') {
    badgeClass = 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    badgeIcon = 'ℹ';
  }

  const formattedPrice = formatCurrencyAmount(offer.pricing.customerSellingPriceLkr, currency);

  return `
    <article class="p-4 rounded-xl border border-brand-border bg-white hover:border-brand-primary transition-all shadow-sm space-y-3" data-offer-id="${offer.offerId}">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}">
            <span>${badgeIcon}</span> ${buyingCondition}
          </span>
          <h4 class="font-heading font-bold text-base text-brand-black mt-1">${escapeHtml(offer.title)}</h4>
          <p class="text-xs text-brand-muted mt-0.5">${escapeHtml(offer.subtitle)}</p>
        </div>
        <div class="text-left sm:text-right sm:shrink-0">
          <span class="text-[10px] uppercase font-bold text-brand-muted block">Selling Price</span>
          <div class="text-lg font-bold text-brand-primary font-heading tabular-nums">${formattedPrice}</div>
          <span class="text-[10px] text-brand-muted block">Taxes included</span>
        </div>
      </div>

      ${offer.inclusions && offer.inclusions.length > 0 ? `
        <div class="flex flex-wrap gap-1.5 text-[11px]">
          ${offer.inclusions.slice(0, 3).map(inc => `
            <span class="px-2 py-0.5 rounded-md bg-brand-subtle text-brand-muted border border-brand-border flex items-center gap-1">
              <svg class="w-3 h-3 text-green-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              ${escapeHtml(inc)}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <div class="pt-3 border-t border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span class="text-[11px] text-brand-muted">
          ${offer.confirmationMode === 'INSTANT_CONFIRM' ? 'Eligible for instant subtotal hold' : 'Subject to partner allocation verification'}
        </span>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            data-action="configure-offer"
            data-offer-id="${offer.offerId}"
            data-product-type="${offer.productType}"
            class="px-3.5 py-2 rounded-lg border border-brand-border hover:bg-brand-canvas text-brand-black font-semibold text-xs touch-target-44"
          >
            Configure
          </button>
          <button
            type="button"
            data-action="stage-offer"
            data-offer-id="${offer.offerId}"
            class="px-4 py-2 rounded-lg bg-brand-primary text-white font-semibold text-xs hover:opacity-90 touch-target-44 shadow-sm"
          >
            Add to Trip
          </button>
        </div>
      </div>
    </article>
  `;
}

function wireOfferCardButtons(modal: HTMLElement, offers: VacatinaNormalizedOffer[]): void {
  modal.querySelectorAll<HTMLElement>('[data-action="stage-offer"]').forEach(btn => {
    btn.onclick = () => {
      const offerId = btn.getAttribute('data-offer-id');
      const found = offers.find(o => o.offerId === offerId) || CANONICAL_HYBRID_CATALOG.find(o => o.offerId === offerId);
      if (!found) return;

      const candidate = tripBucketService.stageNormalizedOffer(found);
      const isReady = candidate.state === 'ready';

      closeActiveDialog(false);
      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      showToast(
        `Staged "${found.title}" (${isReady ? 'Ready' : 'Needs Action'}) to Trip Bucket.`,
        'success',
        'Open Trip Bucket',
        () => {
          if (headerBucketBtn) headerBucketBtn.click();
        }
      );
    };
  });

  modal.querySelectorAll<HTMLElement>('[data-action="configure-offer"]').forEach(btn => {
    btn.onclick = () => {
      const offerId = btn.getAttribute('data-offer-id');
      const pType = btn.getAttribute('data-product-type');
      if (!offerId) return;

      const router = (window as unknown as { __VACATINA_ROUTER__?: { navigateTo: (url: string) => void } }).__VACATINA_ROUTER__;
      if (pType === 'flights') {
        if (router) router.navigateTo(`/flights/offer/${offerId}`);
        else openFlightOfferModal(offerId);
      } else if (pType === 'hotels') {
        if (router) router.navigateTo(`/hotels/property/${offerId}/configure`);
        else openHotelPropertyModal(offerId, true);
      } else {
        openNormalizedOfferModal(offerId);
      }
    };
  });
}

/**
 * 7. Canonical Search Results Modal
 * Consumes VacatinaNormalizedOffer via searchAggregatorService.
 * Displays honest buying condition badges, transparent selling prices, and configure/stage CTAs.
 */
export function openSearchResultsModal(
  productType: CommandCenterTabId | TravelProductSlug,
  criteria: { origin?: string; destination?: string } = {},
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();

  const canonicalProductType = (productType === 'bundle' ? 'packages' : productType) as TravelProductSlug;
  let offers = searchAggregatorService.search({
    productType: canonicalProductType,
    destinationQuery: criteria.destination,
    originQuery: criteria.origin
  });

  if (offers.length === 0) {
    offers = searchAggregatorService.search({
      productType: canonicalProductType
    });
  }

  const productLabels: Record<string, string> = {
    flights: 'Flights & Passenger Air Travel',
    hotels: 'Curated Hotels & Stays',
    visa: 'Visa Assistance & Consular Advisory',
    packages: 'Holiday Packages & Bundles',
    cars: 'Ground Mobility & Chauffeur Transfers',
    rails: 'Scenic Rail Journeys & Intercity Trains',
    cruises: 'Cruises & Coastal Expeditions',
    activities: 'Curated Activities & Desert Safaris',
    sightseeing: 'Guided Cultural Sightseeing Tours',
    insurance: 'Worldwide Travel Shield & Insurance'
  };

  const title = productLabels[canonicalProductType] || 'Search Results';
  const subtitle = criteria.destination
    ? `${criteria.origin ? `${criteria.origin} → ` : ''}${criteria.destination} · ${offers.length} Verified Options Available`
    : `Verified live and direct-contract inventory · ${offers.length} Options Available`;

  const renderCards = (items: VacatinaNormalizedOffer[], instantOnly = false) => {
    const filtered = instantOnly ? items.filter(o => o.confirmationMode === 'INSTANT_CONFIRM') : items;
    if (filtered.length === 0) {
      return `
        <div class="p-8 text-center bg-brand-subtle rounded-xl border border-brand-border">
          <p class="text-sm font-semibold text-brand-black">No options match the selected filters.</p>
          <p class="text-xs text-brand-muted mt-1">Try toggling instant confirmation or adjusting your travel destination.</p>
        </div>
      `;
    }
    return filtered.map(offer => renderOfferCardHtml(offer, state.currency)).join('');
  };

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-3xl w-full p-4 sm:p-6 text-left overflow-hidden">
        <div class="flex items-start justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Search Results · Vacatina Verified Ecosystem</span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">${escapeHtml(title)}</h3>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(subtitle)}</p>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Search Results" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-3 flex flex-wrap items-center justify-between gap-3 border-b border-brand-border text-xs">
          <label class="inline-flex items-center gap-2 cursor-pointer font-semibold text-brand-black">
            <input type="checkbox" id="sr-instant-filter" class="rounded border-brand-border text-brand-primary">
            <span>Instant Confirmation Only</span>
          </label>
          <div class="text-[11px] text-brand-muted">
            Display currency: <strong class="text-brand-black font-bold uppercase">${state.currency}</strong> · Rates refreshed
          </div>
        </div>

        <div id="sr-cards-container" class="py-4 space-y-3 max-h-[62vh] overflow-y-auto pr-1">
          ${renderCards(offers)}
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="text-[11px] text-brand-muted text-center sm:text-left">
            Need bespoke or VIP concierge planning? <a href="tel:+94113606200" class="text-brand-primary font-semibold hover:underline">+94113606200</a>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Back</button>
            <button type="button" onclick="if(window.__VACATINA_ROUTER__) window.__VACATINA_ROUTER__.navigateTo('/trip/review');" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44 shadow-sm">Review Trip Dossier</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const instantFilter = modal.querySelector<HTMLInputElement>('#sr-instant-filter');
  const cardsContainer = modal.querySelector<HTMLElement>('#sr-cards-container');
  if (instantFilter && cardsContainer) {
    instantFilter.addEventListener('change', () => {
      cardsContainer.innerHTML = renderCards(offers, instantFilter.checked);
      wireOfferCardButtons(modal, offers);
    });
  }

  wireOfferCardButtons(modal, offers);
  wireCommonModalCloseButtons(modal);
  telemetry.track('open_search_results_modal', { productType, resultsCount: offers.length });
  openDialogElement(modal, triggerElement);
}

/**
 * 8. Flight Offer Configuration Modal
 * Deep-link target for /flights/offer/:offerId
 */
export function openFlightOfferModal(
  offerId: string,
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();

  const offer = CANONICAL_HYBRID_CATALOG.find(
    o => o.offerId === offerId || o.offerId.includes(offerId) || offerId.includes(o.offerId)
  ) || CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'flights')!;

  const basePrice = offer.pricing.customerSellingPriceLkr;

  let selectedFareDelta = 0;
  let selectedBaggageDelta = 0;
  let selectedFareLabel = 'Economy Standard';

  const updatePrice = () => {
    const computedEl = modal.querySelector('#fl-computed-total');
    if (computedEl) {
      computedEl.textContent = formatCurrencyAmount(basePrice + selectedFareDelta + selectedBaggageDelta, state.currency);
    }
  };

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-4 sm:p-6 text-left overflow-hidden">
        <div class="flex items-start justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              offer.confirmationMode === 'INSTANT_CONFIRM'
                ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                : 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
            }">
              ${offer.confirmationMode === 'INSTANT_CONFIRM' ? '✓ Instant Confirmation' : '⚡ Request to Confirm'}
            </span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-1.5">${escapeHtml(offer.title)}</h3>
            <p class="text-xs text-brand-muted mt-0.5">${escapeHtml(offer.subtitle)}</p>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Flight Configurator" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-4 space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
          <div class="p-3.5 rounded-xl bg-brand-canvas border border-brand-border space-y-2">
            <div class="font-bold text-brand-black flex items-center justify-between">
              <span>Flight Schedule &amp; Routing</span>
              <span class="text-[11px] font-semibold text-brand-primary">Direct Passenger Service</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-brand-muted text-[11px]">
              <div><strong class="text-brand-black block">Origin:</strong> ${escapeHtml(offer.location.city)} (${offer.location.iataCode || 'CMB'})</div>
              <div><strong class="text-brand-black block">Destination:</strong> Dubai (DXB)</div>
              <div><strong class="text-brand-black block">Baggage:</strong> 30kg Checked Baggage Included</div>
              <div><strong class="text-brand-black block">Cabin:</strong> Economy Class</div>
            </div>
          </div>

          <div>
            <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">1. Select Fare Family</span>
            <div class="space-y-2" id="fl-fare-options">
              <label class="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-primary bg-[#F0EFFC]/50 cursor-pointer">
                <div class="flex items-start gap-2.5">
                  <input type="radio" name="fl-fare-radio" value="0" data-label="Economy Standard" checked class="mt-1 text-brand-primary">
                  <div>
                    <div class="font-bold text-brand-black">Economy Standard</div>
                    <div class="text-[11px] text-brand-muted">30kg checked baggage, standard seat allocation, ticket rebooking subject to airline fare rule</div>
                  </div>
                </div>
                <span class="font-bold text-brand-primary">Included</span>
              </label>
              <label class="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-border bg-white hover:border-brand-primary cursor-pointer">
                <div class="flex items-start gap-2.5">
                  <input type="radio" name="fl-fare-radio" value="14500" data-label="Economy Flex" class="mt-1 text-brand-primary">
                  <div>
                    <div class="font-bold text-brand-black">Economy Flex</div>
                    <div class="text-[11px] text-brand-muted">Complimentary seat selection, 35kg checked baggage, 1 free date amendment</div>
                  </div>
                </div>
                <span class="font-bold text-brand-primary">+${formatCurrencyAmount(14500, state.currency)}</span>
              </label>
              <label class="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-border bg-white hover:border-brand-primary cursor-pointer">
                <div class="flex items-start gap-2.5">
                  <input type="radio" name="fl-fare-radio" value="185000" data-label="Business Class" class="mt-1 text-brand-primary">
                  <div>
                    <div class="font-bold text-brand-black">Business Class</div>
                    <div class="text-[11px] text-brand-muted">Lie-flat sleeper seat, 2x32kg checked bags, lounge access &amp; priority boarding</div>
                  </div>
                </div>
                <span class="font-bold text-brand-primary">+${formatCurrencyAmount(185000, state.currency)}</span>
              </label>
            </div>
          </div>

          <div>
            <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">2. Baggage &amp; Seat Preferences</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="fl-baggage-sel" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Additional Baggage</label>
                <select id="fl-baggage-sel" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-brand-border bg-white text-xs font-semibold text-brand-black">
                  <option value="0">Standard 30kg (Included)</option>
                  <option value="12000">+15kg Extra Baggage (+${formatCurrencyAmount(12000, state.currency)})</option>
                  <option value="22000">+25kg Extra Baggage (+${formatCurrencyAmount(22000, state.currency)})</option>
                </select>
              </div>
              <div>
                <label for="fl-seat-sel" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Seat Preference</label>
                <select id="fl-seat-sel" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-brand-border bg-white text-xs font-semibold text-brand-black">
                  <option value="any">Standard Allocation (Any)</option>
                  <option value="window">Window Seat (Complimentary)</option>
                  <option value="aisle">Aisle Seat (Complimentary)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-brand-subtle border border-brand-border text-brand-muted leading-relaxed text-[11px]">
            <strong>Fare Lock Policy:</strong> Staging this offer places an indicative hold on seat allocation. Fares are confirmed during live revalidation prior to unified ticket issuance.
          </div>

          <div class="pt-3 border-t border-brand-border flex items-center justify-between">
            <div>
              <span class="block text-[11px] text-brand-muted font-medium uppercase">Configured Total</span>
              <span class="text-[10px] text-brand-muted">Mandatory taxes &amp; fees included</span>
            </div>
            <div id="fl-computed-total" class="text-2xl font-extrabold text-brand-primary font-heading tabular-nums">
              ${formatCurrencyAmount(basePrice, state.currency)}
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Cancel</button>
          <button
            type="button"
            id="fl-stage-btn"
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44 shadow-sm"
          >
            Stage Flight in Trip Bucket
          </button>
        </div>
      </div>
    </div>
  `;

  const fareRadios = modal.querySelectorAll<HTMLInputElement>('input[name="fl-fare-radio"]');
  fareRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      selectedFareDelta = parseInt(radio.value, 10) || 0;
      selectedFareLabel = radio.getAttribute('data-label') || selectedFareLabel;
      fareRadios.forEach(r => {
        const lbl = r.closest('label');
        if (lbl) {
          lbl.classList.toggle('border-brand-primary', r.checked);
          lbl.classList.toggle('bg-[#F0EFFC]/50', r.checked);
          lbl.classList.toggle('border-brand-border', !r.checked);
        }
      });
      updatePrice();
    });
  });

  const baggageSel = modal.querySelector<HTMLSelectElement>('#fl-baggage-sel');
  if (baggageSel) {
    baggageSel.addEventListener('change', () => {
      selectedBaggageDelta = parseInt(baggageSel.value, 10) || 0;
      updatePrice();
    });
  }

  const stageBtn = modal.querySelector<HTMLButtonElement>('#fl-stage-btn');
  if (stageBtn) {
    stageBtn.addEventListener('click', () => {
      const finalPrice = basePrice + selectedFareDelta + selectedBaggageDelta;
      const candidate: TripBucketCandidate = {
        id: `fl-staged-${offer.offerId}-${Date.now()}`,
        productType: 'flights',
        productLabel: 'Flight',
        title: offer.title,
        subtitle: `${selectedFareLabel} · ${offer.subtitle}`,
        dateSummary: '15 Nov – 22 Nov 2026',
        travellerSummary: '2 Adults · Economy',
        state: offer.confirmationMode === 'INSTANT_CONFIRM' ? 'ready' : 'needs_action',
        priceLkr: finalPrice,
        offerId: offer.offerId,
        sourceType: offer.sourceType,
        confirmationMode: offer.confirmationMode,
        rawSupplierPrice: offer.pricing.rawSupplierCost,
        supplierBaseCurrency: offer.pricing.supplierCurrency,
        markupAmountLkr: offer.pricing.markupAmountLkr,
        holdStatusText: offer.confirmationMode === 'INSTANT_CONFIRM'
          ? 'Instant confirmation eligible · Ready subtotal staged'
          : 'On Request · Subject to airline partner seat allocation',
        actionRequiredText: offer.confirmationMode === 'REQUEST_TO_CONFIRM'
          ? 'Request to Confirm: Airline partner allocation verification required.'
          : undefined,
        primaryActionLabel: offer.confirmationMode === 'REQUEST_TO_CONFIRM' ? 'Verify Allocation' : 'Modify',
        supplierName: offer.supplierId,
        integrationMode: 'ADAPTER-READY'
      };

      tripBucketService.stageCandidate(candidate);
      closeActiveDialog(false);

      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      if (headerBucketBtn) {
        headerBucketBtn.click();
      }
      showToast(
        `Staged "${candidate.title}" to Trip Bucket (${candidate.state === 'ready' ? 'Ready' : 'Needs Action'}).`,
        'success'
      );
    });
  }

  wireCommonModalCloseButtons(modal);
  telemetry.track('open_flight_offer_modal', { offerId });
  openDialogElement(modal, triggerElement);
}

/**
 * 9. Hotel Property Details & Room Configuration Modal
 * Deep-link target for /hotels/property/:propertyId and /hotels/property/:propertyId/configure
 */
export function openHotelPropertyModal(
  propertyId: string,
  isConfigure = false,
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();

  const hotel = CANONICAL_HYBRID_CATALOG.find(
    o => o.offerId === propertyId || o.offerId.includes(propertyId) || propertyId.includes(o.offerId)
  ) || CANONICAL_HYBRID_CATALOG.find(o => o.productType === 'hotels')!;

  const baseRate = hotel.pricing.customerSellingPriceLkr;

  if (!isConfigure) {
    modal.innerHTML = `
      <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
      <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-4 sm:p-6 text-left overflow-hidden">
          <div class="flex items-start justify-between pb-4 border-b border-brand-border">
            <div>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                hotel.confirmationMode === 'INSTANT_CONFIRM'
                  ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                  : 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
              }">
                ${hotel.confirmationMode === 'INSTANT_CONFIRM' ? '✓ Instant Confirmation' : '⚡ Request to Confirm'}
              </span>
              <h3 class="font-heading font-bold text-xl text-brand-black mt-1.5">${escapeHtml(hotel.title)}</h3>
              <p class="text-xs text-brand-muted mt-0.5">${escapeHtml(hotel.location.city)}, ${escapeHtml(hotel.location.country)} · Luxury Property</p>
            </div>
            <button type="button" data-dialog-close="true" aria-label="Close Hotel Details" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </button>
          </div>

          <div class="py-4 space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
            <p class="text-brand-muted leading-relaxed">${escapeHtml(hotel.subtitle)}</p>

            ${hotel.inclusions && hotel.inclusions.length > 0 ? `
              <div>
                <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">Verified Property Amenities &amp; Inclusions</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  ${hotel.inclusions.map(inc => `
                    <div class="p-2 rounded-lg bg-brand-subtle border border-brand-border flex items-center gap-2">
                      <svg class="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>${escapeHtml(inc)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="p-3.5 rounded-xl bg-brand-canvas border border-brand-border space-y-1.5">
              <div class="font-bold text-brand-black">Cancellation &amp; Booking Terms</div>
              <p class="text-brand-muted text-[11px] leading-relaxed">${escapeHtml(hotel.cancellationTerms.policySummary)}</p>
            </div>

            <div class="pt-3 border-t border-brand-border flex items-center justify-between">
              <div>
                <span class="block text-[11px] text-brand-muted font-medium uppercase">Indicative Nightly Rate</span>
                <span class="text-[10px] text-brand-muted">Resort service fee &amp; city taxes included</span>
              </div>
              <div class="text-2xl font-extrabold text-brand-primary font-heading tabular-nums">
                ${formatCurrencyAmount(baseRate, state.currency)}
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
            <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Back</button>
            <button
              type="button"
              id="ht-open-config-btn"
              class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44 shadow-sm"
            >
              Configure Room &amp; Rates
            </button>
          </div>
        </div>
      </div>
    `;

    const configBtn = modal.querySelector<HTMLButtonElement>('#ht-open-config-btn');
    if (configBtn) {
      configBtn.onclick = () => {
        const router = (window as unknown as { __VACATINA_ROUTER__?: { navigateTo: (url: string) => void } }).__VACATINA_ROUTER__;
        if (router) router.navigateTo(`/hotels/property/${hotel.offerId}/configure`);
        else openHotelPropertyModal(hotel.offerId, true);
      };
    }
  } else {
    let roomDelta = 0;
    let boardDelta = 0;
    let roomLabel = 'Deluxe Sunrise Water Villa';

    const updatePrice = () => {
      const computedEl = modal.querySelector('#ht-computed-total');
      if (computedEl) {
        computedEl.textContent = formatCurrencyAmount(baseRate + roomDelta + boardDelta, state.currency);
      }
    };

    modal.innerHTML = `
      <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
      <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-4 sm:p-6 text-left overflow-hidden">
          <div class="flex items-start justify-between pb-4 border-b border-brand-border">
            <div>
              <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Configure Room &amp; Staging · Hotels</span>
              <h3 class="font-heading font-bold text-xl text-brand-black mt-0.5">${escapeHtml(hotel.title)}</h3>
              <p class="text-xs text-brand-muted mt-0.5">${escapeHtml(hotel.location.city)} · Configure room and dining tier</p>
            </div>
            <button type="button" data-dialog-close="true" aria-label="Close Room Configurator" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </button>
          </div>

          <div class="py-4 space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
            <div>
              <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">1. Select Room Tier</span>
              <div class="space-y-2" id="ht-room-options">
                <label class="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-primary bg-[#F0EFFC]/50 cursor-pointer">
                  <div class="flex items-start gap-2.5">
                    <input type="radio" name="ht-room-radio" value="0" data-label="Deluxe Sunrise Water Villa" checked class="mt-1 text-brand-primary">
                    <div>
                      <div class="font-bold text-brand-black">Deluxe Sunrise Water Villa</div>
                      <div class="text-[11px] text-brand-muted">Overwater terrace, private plunge pool, direct lagoon staircase</div>
                    </div>
                  </div>
                  <span class="font-bold text-brand-primary">Included</span>
                </label>
                <label class="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-border bg-white hover:border-brand-primary cursor-pointer">
                  <div class="flex items-start gap-2.5">
                    <input type="radio" name="ht-room-radio" value="35000" data-label="Sunset Villa with Private Pool" class="mt-1 text-brand-primary">
                    <div>
                      <div class="font-bold text-brand-black">Sunset Villa with Private Pool</div>
                      <div class="text-[11px] text-brand-muted">Panoramic sunset aspect, expanded wooden sundeck, outdoor shower</div>
                    </div>
                  </div>
                  <span class="font-bold text-brand-primary">+${formatCurrencyAmount(35000, state.currency)}</span>
                </label>
              </div>
            </div>

            <div>
              <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">2. Dining &amp; Board Basis</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="ht-board-sel" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Board Basis</label>
                  <select id="ht-board-sel" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-brand-border bg-white text-xs font-semibold text-brand-black">
                    <option value="0">Bed &amp; Breakfast (Included)</option>
                    <option value="18000">Half Board (+${formatCurrencyAmount(18000, state.currency)})</option>
                    <option value="32000">All-Inclusive Dine Around (+${formatCurrencyAmount(32000, state.currency)})</option>
                  </select>
                </div>
                <div>
                  <label for="ht-bed-sel" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Bed Configuration</label>
                  <select id="ht-bed-sel" class="w-full min-h-[44px] px-3 py-2 rounded-xl border border-brand-border bg-white text-xs font-semibold text-brand-black">
                    <option value="king">1 King Size Bed</option>
                    <option value="twin">2 Twin Single Beds</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-brand-border flex items-center justify-between">
              <div>
                <span class="block text-[11px] text-brand-muted font-medium uppercase">Configured Total</span>
                <span class="text-[10px] text-brand-muted">Resort taxes &amp; service charges included</span>
              </div>
              <div id="ht-computed-total" class="text-2xl font-extrabold text-brand-primary font-heading tabular-nums">
                ${formatCurrencyAmount(baseRate, state.currency)}
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
            <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Cancel</button>
            <button
              type="button"
              id="ht-stage-btn"
              class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44 shadow-sm"
            >
              Stage Room in Trip Bucket
            </button>
          </div>
        </div>
      </div>
    `;

    const roomRadios = modal.querySelectorAll<HTMLInputElement>('input[name="ht-room-radio"]');
    roomRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        roomDelta = parseInt(radio.value, 10) || 0;
        roomLabel = radio.getAttribute('data-label') || roomLabel;
        roomRadios.forEach(r => {
          const lbl = r.closest('label');
          if (lbl) {
            lbl.classList.toggle('border-brand-primary', r.checked);
            lbl.classList.toggle('bg-[#F0EFFC]/50', r.checked);
            lbl.classList.toggle('border-brand-border', !r.checked);
          }
        });
        updatePrice();
      });
    });

    const boardSel = modal.querySelector<HTMLSelectElement>('#ht-board-sel');
    if (boardSel) {
      boardSel.addEventListener('change', () => {
        boardDelta = parseInt(boardSel.value, 10) || 0;
        updatePrice();
      });
    }

    const stageBtn = modal.querySelector<HTMLButtonElement>('#ht-stage-btn');
    if (stageBtn) {
      stageBtn.addEventListener('click', () => {
        const finalPrice = baseRate + roomDelta + boardDelta;
        const candidate: TripBucketCandidate = {
          id: `ht-staged-${hotel.offerId}-${Date.now()}`,
          productType: 'hotels',
          productLabel: 'Hotel',
          title: hotel.title,
          subtitle: `${roomLabel} · ${hotel.location.city}`,
          dateSummary: '15 Nov – 20 Nov 2026',
          travellerSummary: '2 Adults · 1 Room',
          state: hotel.confirmationMode === 'INSTANT_CONFIRM' ? 'ready' : 'needs_action',
          priceLkr: finalPrice,
          offerId: hotel.offerId,
          sourceType: hotel.sourceType,
          confirmationMode: hotel.confirmationMode,
          rawSupplierPrice: hotel.pricing.rawSupplierCost,
          supplierBaseCurrency: hotel.pricing.supplierCurrency,
          markupAmountLkr: hotel.pricing.markupAmountLkr,
          holdStatusText: hotel.confirmationMode === 'INSTANT_CONFIRM'
            ? 'Room configured · Indicative rate staged'
            : 'On Request · Subject to hotel room allocation confirmation',
          actionRequiredText: hotel.confirmationMode === 'REQUEST_TO_CONFIRM'
            ? 'Request to Confirm: Hotel partner room allocation required.'
            : undefined,
          primaryActionLabel: hotel.confirmationMode === 'REQUEST_TO_CONFIRM' ? 'Confirm Allocation' : 'Modify',
          supplierName: hotel.supplierId,
          integrationMode: 'ADAPTER-READY'
        };

        tripBucketService.stageCandidate(candidate);
        closeActiveDialog(false);

        const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
        if (headerBucketBtn) {
          headerBucketBtn.click();
        }
        showToast(
          `Staged "${candidate.title}" to Trip Bucket (${candidate.state === 'ready' ? 'Ready' : 'Needs Action'}).`,
          'success'
        );
      });
    }
  }

  wireCommonModalCloseButtons(modal);
  telemetry.track('open_hotel_property_modal', { propertyId, isConfigure });
  openDialogElement(modal, triggerElement);
}

/**
 * 10. Generic Normalized Offer Modal
 * Deep-link target for /:product/offer/:offerId
 */
export function openNormalizedOfferModal(
  offerId: string,
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();

  const offer = CANONICAL_HYBRID_CATALOG.find(
    o => o.offerId === offerId || o.offerId.includes(offerId) || offerId.includes(o.offerId)
  );

  if (!offer) {
    showToast(`Offer "${offerId}" not found in current catalog.`, 'warning');
    return;
  }

  const buyingCondition = getCustomerBuyingCondition(offer);
  const formattedPrice = formatCurrencyAmount(offer.pricing.customerSellingPriceLkr, state.currency);

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-4 sm:p-6 text-left overflow-hidden">
        <div class="flex items-start justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              offer.confirmationMode === 'INSTANT_CONFIRM'
                ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                : offer.confirmationMode === 'REQUEST_TO_CONFIRM'
                ? 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
            }">
              ${buyingCondition}
            </span>
            <h3 class="font-heading font-bold text-xl text-brand-black mt-1.5">${escapeHtml(offer.title)}</h3>
            <p class="text-xs text-brand-muted mt-0.5">${escapeHtml(offer.subtitle)}</p>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Offer Details" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-4 space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
          <div class="p-3.5 rounded-xl bg-brand-canvas border border-brand-border space-y-2">
            <div class="font-bold text-brand-black">Itinerary &amp; Destination Details</div>
            <div class="text-brand-muted text-[11px]">
              <div><strong>Location:</strong> ${escapeHtml(offer.location.city)}, ${escapeHtml(offer.location.country)}</div>
              <div><strong>Confirmation:</strong> ${buyingCondition}</div>
              <div><strong>Availability:</strong> ${offer.availabilityStatus}</div>
            </div>
          </div>

          ${offer.inclusions && offer.inclusions.length > 0 ? `
            <div>
              <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">Verified Inclusions</span>
              <ul class="space-y-1.5 text-brand-muted text-[11px]">
                ${offer.inclusions.map(inc => `
                  <li class="flex items-start gap-2">
                    <svg class="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${escapeHtml(inc)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border space-y-1">
            <div class="font-bold text-brand-black">Cancellation Terms</div>
            <p class="text-brand-muted text-[11px] leading-relaxed">${escapeHtml(offer.cancellationTerms.policySummary)}</p>
          </div>

          <div class="pt-3 border-t border-brand-border flex items-center justify-between">
            <div>
              <span class="block text-[11px] text-brand-muted font-medium uppercase">Customer Selling Price</span>
              <span class="text-[10px] text-brand-muted">All taxes &amp; fees included</span>
            </div>
            <div class="text-2xl font-extrabold text-brand-primary font-heading tabular-nums">
              ${formattedPrice}
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-end gap-3">
          <button type="button" data-dialog-close="true" class="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44">Cancel</button>
          <button
            type="button"
            id="no-stage-btn"
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44 shadow-sm"
          >
            Stage in Trip Bucket
          </button>
        </div>
      </div>
    </div>
  `;

  const stageBtn = modal.querySelector<HTMLButtonElement>('#no-stage-btn');
  if (stageBtn) {
    stageBtn.onclick = () => {
      const candidate = tripBucketService.stageNormalizedOffer(offer);
      closeActiveDialog(false);

      const headerBucketBtn = document.getElementById('header-trip-bucket-btn');
      showToast(
        `Staged "${offer.title}" to Trip Bucket (${candidate.state === 'ready' ? 'Ready' : 'Needs Action'}).`,
        'success',
        'Open Trip Bucket',
        () => {
          if (headerBucketBtn) headerBucketBtn.click();
        }
      );
    };
  }

  wireCommonModalCloseButtons(modal);
  telemetry.track('open_normalized_offer_modal', { offerId });
  openDialogElement(modal, triggerElement);
}

/**
 * 12. B2B Partner Portal Workspace Modal
 */
export function openPartnerPortalModal(subpath = 'dashboard', triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();

  // Setup interactive window handlers
  if (typeof window !== 'undefined') {
    (window as any).VacatinaPartnerPortal = {
      createQuoteForClient: (clientId: string) => {
        showToast(`Draft quote created for client. Staged in B2B Quote Ledger.`, 'success');
      }
    };
  }

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-4xl w-full text-left">
        <div class="absolute top-4 right-4 z-10">
          <button type="button" data-dialog-close="true" aria-label="Close Portal" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>
        ${renderPartnerPortalHtml(subpath)}
      </div>
    </div>
  `;

  const newQuoteBtn = modal.querySelector('#partner-new-quote-btn') as HTMLElement | null;
  if (newQuoteBtn) {
    newQuoteBtn.onclick = () => {
      showToast('New client quote composer opened. Dynamic markup active.', 'brand');
    };
  }

  const settlementBtn = modal.querySelector('#partner-settlement-btn') as HTMLElement | null;
  if (settlementBtn) {
    settlementBtn.onclick = () => {
      showToast('Settlement request submitted to Vacatina Finance Operations.', 'success');
    };
  }

  wireCommonModalCloseButtons(modal);
  telemetry.track('open_partner_portal', { subpath });
  openDialogElement(modal, triggerElement);
}

/**
 * 13. Admin & Operations Control Center Modal
 */
export function openAdminPortalModal(subpath = 'overview', triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();

  // Setup interactive window handlers for Admin
  if (typeof window !== 'undefined') {
    (window as any).VacatinaAdminPortal = {
      toggleStatus: (manualListingId: string) => {
        const listing = manualInventoryService.getListing(manualListingId);
        if (listing) {
          const newStatus = listing.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED';
          manualInventoryService.updateListingStatus(manualListingId, newStatus, 'Status toggled via Operations Backoffice');
          showToast(`Listing ${manualListingId} status set to ${newStatus}.`, 'brand');
          openAdminPortalModal(subpath);
        }
      },
      overridePrice: (manualListingId: string) => {
        const listing = manualInventoryService.getListing(manualListingId);
        if (listing) {
          const currentPrice = listing.standardSellingPriceLkr;
          const adjusted = currentPrice - 5000;
          manualInventoryService.updateListingPricing(manualListingId, {
            manualOverrideAmount: adjusted,
            overrideReason: 'Promotional operational adjustment'
          });
          showToast(`Price for ${manualListingId} adjusted to LKR ${adjusted.toLocaleString()}.`, 'success');
          openAdminPortalModal(subpath);
        }
      }
    };
  }

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-4xl w-full text-left">
        <div class="absolute top-4 right-4 z-10">
          <button type="button" data-dialog-close="true" aria-label="Close Admin" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>
        ${renderAdminPortalHtml(subpath)}
      </div>
    </div>
  `;

  wireCommonModalCloseButtons(modal);
  telemetry.track('open_admin_portal', { subpath });
  openDialogElement(modal, triggerElement);
}
