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
import { CANONICAL_HYBRID_CATALOG } from '../../lib/mock-data/hybrid-catalog.ts';
import {
  getCustomerBuyingCondition,
  type VacatinaNormalizedOffer
} from '../../lib/domain/inventory-models.ts';
import { renderPartnerPortalHtml } from '../../features/partner/partner-portal.ts';
import { renderAdminPortalHtml } from '../../features/admin/admin-portal.ts';

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
 * 3. Unified Trip Dossier Review & Checkout
 * Superseded by the server-backed /checkout workspace. The browser must never
 * read or mutate the operational store directly.
 */
export function openTripDossierReviewModal(_triggerElement?: HTMLElement | null): void {
  navigateToWorkspace('/checkout');
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

/**
 * Navigate to a server-backed workspace without importing the router (the
 * router already imports this module). The router listens for popstate, so
 * this reuses the canonical navigation path instead of duplicating state.
 */
function navigateToWorkspace(path: string): void {
  if (typeof window === 'undefined') return;
  const target = path || '/';
  const current = window.location.pathname + window.location.search;
  if (current !== target) {
    window.history.pushState({}, '', target);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
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
 * 7. Canonical Search Results
 * Superseded by the server-backed product workspace. Redirect to the canonical
 * search route so pricing, filtering and availability stay server-owned.
 */
export function openSearchResultsModal(
  productType: CommandCenterTabId | TravelProductSlug,
  _criteria: { origin?: string; destination?: string } = {},
  _triggerElement?: HTMLElement | null
): void {
  const tab = productType === 'bundle' ? 'packages' : productType;
  const routes: Record<string, string> = {
    flights: '/flights',
    hotels: '/hotels',
    visa: '/visa-assistance',
    packages: '/holiday-packages',
    cars: '/cars-transfers',
    activities: '/activities',
    sightseeing: '/sightseeing-tours',
    rails: '/rails',
    cruises: '/cruises',
    insurance: '/travel-insurance'
  };
  // Hub routes are handled before the legacy search-results fallback, so this
  // redirect cannot re-enter the superseded modal path.
  navigateToWorkspace(routes[tab] || '/');
}

/**
 * 8. Flight Offer Configuration
 * Superseded by /flights/offer/:offerId in the server-backed product workspace.
 */
export function openFlightOfferModal(
  offerId: string,
  _triggerElement?: HTMLElement | null
): void {
  navigateToWorkspace('/flights/offer/' + encodeURIComponent(offerId));
}

/**
 * 9. Hotel Property Details
 * Superseded by /hotels/property/:propertyId in the server-backed product workspace.
 */
export function openHotelPropertyModal(
  propertyId: string,
  _isConfigure = false,
  _triggerElement?: HTMLElement | null
): void {
  navigateToWorkspace('/hotels/property/' + encodeURIComponent(propertyId));
}

/**
 * 10. Generic Normalized Offer
 * Superseded by the product workspace detail route.
 */
export function openNormalizedOfferModal(
  offerId: string,
  _triggerElement?: HTMLElement | null
): void {
  const routes: Record<string, string> = {
    flights: '/flights',
    hotels: '/hotels',
    'visa-assistance': '/visa-assistance',
    'holiday-packages': '/holiday-packages',
    'cars-transfers': '/cars-transfers',
    activities: '/activities',
    'sightseeing-tours': '/sightseeing-tours',
    rails: '/rails',
    cruises: '/cruises',
    'travel-insurance': '/travel-insurance'
  };
  const firstSegment = typeof window === 'undefined' ? '' : window.location.pathname.split('/')[1];
  const route = routes[firstSegment];
  navigateToWorkspace(route ? route + '/offer/' + encodeURIComponent(offerId) : '/');
}

/**
 * 12. B2B Partner Portal Workspace Modal
 * Hosts the server-backed partner workspace. The legacy client-side quote
 * handlers were removed because all agency data comes from /api/v1.
 */
export function openPartnerPortalModal(subpath = 'dashboard', triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();
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
  wireCommonModalCloseButtons(modal);
  telemetry.track('open_partner_portal', { subpath });
  openDialogElement(modal, triggerElement);
}

/**
 * 13. Admin & Operations Control Center Modal
 * Hosts the server-backed operations workspace. All listing commands are
 * authorized and executed by /api/v1/admin; no local inventory store is used.
 */
export function openAdminPortalModal(subpath = 'overview', triggerElement?: HTMLElement | null): void {
  const modal = ensureDynamicModalShell();
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

/**
 * 12. Booking Confirmation Modal
 * Renders post-saga settlement status, booking reference, and itemized confirmation.
 */
export function openBookingConfirmationModal(
  sagaResult: {
    bookingReference: string;
    bookingGroupId: string;
    overallStatus: string;
    paymentStatus: string;
    totalSellingPriceMinor: number;
    currency: string;
    items: Array<{
      bookingItemId: string;
      canonicalOfferId: string;
      productType: string;
      fulfillmentStatus: string;
      vacatinaBookingReference?: string;
    }>;
    appliedCreditLkr?: number;
    remainingPaidLkr?: number;
  },
  triggerElement?: HTMLElement | null
): void {
  const modal = ensureDynamicModalShell();
  const state = searchCommandService.getState();
  const currency = (sagaResult.currency || state.currency) as any;
  const totalAmount = formatCurrencyAmount(sagaResult.totalSellingPriceMinor / 100, currency);
  const appliedCreditLkr = sagaResult.appliedCreditLkr || 0;
  const remainingPaidLkr = sagaResult.remainingPaidLkr !== undefined ? sagaResult.remainingPaidLkr : (sagaResult.totalSellingPriceMinor / 100);

  const paymentStatusDisplay = appliedCreditLkr > 0
    ? (remainingPaidLkr === 0 ? 'SETTLED (100% TRAVEL CREDIT)' : 'SETTLED (PARTIAL CREDIT + CARD)')
    : sagaResult.paymentStatus;

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-2xl w-full p-4 sm:p-6 text-left overflow-hidden">
        <div class="flex items-start justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
              <svg class="w-4 h-4 text-[#15803D]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Booking Saga Confirmed &amp; Settled
            </span>
            <h3 class="font-heading font-bold text-2xl text-brand-black mt-2">Dossier #${escapeHtml(sagaResult.bookingReference)}</h3>
            <p class="text-xs text-brand-muted mt-0.5">Payment status: <strong class="text-[#15803D] font-bold">${escapeHtml(paymentStatusDisplay)}</strong> · Fulfillment: <strong class="text-brand-black">${escapeHtml(sagaResult.overallStatus)}</strong></p>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Confirmation" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-4 space-y-4 max-h-[64vh] overflow-y-auto pr-1 text-xs">
          <div class="p-4 rounded-xl bg-brand-canvas border border-brand-border space-y-2">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-brand-muted font-medium uppercase tracking-wider">Booking Reference:</span>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-base text-brand-primary" id="confirmed-booking-ref">${escapeHtml(sagaResult.bookingReference)}</span>
                <button type="button" id="copy-booking-ref-btn" class="px-2 py-1 rounded bg-white border border-brand-border text-[10px] font-bold text-brand-black hover:border-brand-primary">Copy</button>
              </div>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-brand-muted font-medium uppercase tracking-wider">Total Dossier Value:</span>
              <span class="font-bold text-base text-brand-black font-heading tabular-nums">${totalAmount}</span>
            </div>
            ${
              appliedCreditLkr > 0
                ? `
            <div class="flex items-center justify-between text-[11px] text-[#15803D]">
              <span class="font-medium uppercase tracking-wider">Paid with Vacatina Travel Credit:</span>
              <span class="font-bold font-mono tabular-nums">- ${formatCurrencyAmount(appliedCreditLkr, currency)}</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-brand-muted font-medium uppercase tracking-wider">Paid via Card / Bank Gateway:</span>
              <span class="font-bold font-mono text-brand-black tabular-nums">${formatCurrencyAmount(remainingPaidLkr, currency)}</span>
            </div>
            `
                : ''
            }
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-brand-muted font-medium uppercase tracking-wider">Lead Passenger:</span>
              <span class="font-bold text-brand-black">Valued Vacatina Traveler</span>
            </div>
          </div>

          <div>
            <span class="block text-[11px] font-bold text-brand-muted uppercase mb-2">Itemized Travel Dossier (${sagaResult.items.length} Confirmed Segments)</span>
            <div class="space-y-2">
              ${sagaResult.items.map(item => `
                <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between gap-3">
                  <div class="space-y-0.5">
                    <span class="inline-block px-1.5 py-0.5 rounded bg-brand-subtle text-[9px] font-bold uppercase text-brand-muted">${escapeHtml(item.productType)}</span>
                    <div class="font-bold text-xs text-brand-black">${escapeHtml(item.canonicalOfferId)}</div>
                    <div class="text-[10px] text-brand-muted">Item Reference: ${escapeHtml(item.vacatinaBookingReference || sagaResult.bookingReference)}</div>
                  </div>
                  <div class="text-right">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D]">
                      ✓ ${escapeHtml(item.fulfillmentStatus)}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="p-3 rounded-xl bg-[#F0EFFC] border border-[#D5D1F6] text-brand-black text-[11px] leading-relaxed">
            <strong>Self-Service &amp; Concierge Support:</strong> Your booking is securely committed across all supplier gateways. You can look up this dossier anytime at <code>/bookings/${escapeHtml(sagaResult.bookingReference)}</code> or through the Manage Booking tab.
          </div>
        </div>

        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            id="print-itinerary-btn"
            class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-canvas touch-target-44"
          >
            🖨 Print Itinerary
          </button>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="view-manage-booking-btn"
              class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary text-xs font-semibold hover:bg-[#F0EFFC] touch-target-44"
            >
              View in Manage Booking
            </button>
            <button
              type="button"
              data-dialog-close="true"
              class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const copyBtn = modal.querySelector<HTMLButtonElement>('#copy-booking-ref-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(sagaResult.bookingReference);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      }
    };
  }

  const printBtn = modal.querySelector<HTMLButtonElement>('#print-itinerary-btn');
  if (printBtn) {
    printBtn.onclick = () => {
      if (typeof window !== 'undefined') window.print();
    };
  }

  const manageBtn = modal.querySelector<HTMLButtonElement>('#view-manage-booking-btn');
  if (manageBtn) {
    manageBtn.onclick = () => {
      closeActiveDialog(false);
      const router = (window as unknown as { __VACATINA_ROUTER__?: { navigateTo: (url: string) => void } }).__VACATINA_ROUTER__;
      if (router) router.navigateTo(`/bookings/${sagaResult.bookingReference}`);
    };
  }

  wireCommonModalCloseButtons(modal);
  openDialogElement(modal, triggerElement);
}

/**
 * 13. Manage Booking Dossier (CAP-13)
 * Superseded by the server-backed /manage-booking workspace.
 */
export function openBookingDossierModal(
  reference: string,
  _triggerElement?: HTMLElement | null
): void {
  navigateToWorkspace('/manage-booking?booking=' + encodeURIComponent(reference));
}

/**
 * 13b. Manage Booking Cancellation & Refund
 * Refund rights and payment actions are server-owned. Redirect to the
 * authenticated booking workspace instead of mutating booking state locally.
 */
export function openBookingCancellationRefundModal(
  bookingReference: string,
  _triggerElement?: HTMLElement | null
): void {
  navigateToWorkspace('/manage-booking?booking=' + encodeURIComponent(bookingReference));
}

/**
 * 14. Consular Visa Desk Intake (CAP-14)
 * Superseded by the server-backed visa workspace. The legacy modal wrote fake
 * applications into local storage; it now routes to the canonical offer flow.
 */
export function openVisaApplicationModal(
  countryOrTitle?: string,
  offerId?: string,
  _triggerElement?: HTMLElement | null
): void {
  const id = (offerId || '').trim();
  if (id) {
    navigateToWorkspace('/visa-assistance/apply/' + encodeURIComponent(id));
    return;
  }
  const params = new URLSearchParams();
  if (countryOrTitle) params.set('destination', countryOrTitle);
  const query = params.toString();
  navigateToWorkspace('/visa-assistance/search' + (query ? '?' + query : ''));
}
