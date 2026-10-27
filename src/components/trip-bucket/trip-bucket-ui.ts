/* ============================================================================
 * Vacatina Trip Bucket UI Controller (Drawer, Desktop Dock & Mobile Sticky Bar)
 * Authorities:
 * - Screen 03 Foundation v1.1 Locked (Recovered #mobile-summary-bar, Undo Remove,
 *   Change Room LKR 256,500 <-> LKR 260,000, and View Details toggle)
 * - Screen 04 Trip Bucket Component States v1.2 Locked (8-State Candidate Engine)
 * - ANTIGRAVITY ULTRA MASTER INSTRUCTION (§58–§66)
 * ============================================================================ */

import type { TripBucketCandidate, TripBucketSummary } from '../../lib/domain/types.ts';
import { formatCurrencyAmount } from '../../lib/mock-data/catalog.ts';
import {
  TRIP_BUCKET_STATE_DESCRIPTORS,
  tripBucketService
} from '../../lib/services/trip-bucket.service.ts';
import { searchCommandService } from '../../lib/services/search.service.ts';
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
  closeActiveDialog,
  isAnyCustomDialogOpen,
  openScreen04StatesModal,
  openTripDossierReviewModal,
  openVisaApplicationModal
} from '../dialogs/dialogs-controller.ts';

let lastBucketTrigger: HTMLElement | null = null;
const expandedDetailsItemIds = new Set<string>();
let currentScrollHidden = false;

export function updateTripControlsVisibility(forceVisible?: boolean, forceHidden?: boolean): void {
  const dock = document.getElementById('floating-trip-dock');
  const mobileBar = document.getElementById('mobile-summary-bar');
  const mobileNav = document.getElementById('mobile-nav-drawer-container');
  const mobileNavOpen = Boolean(mobileNav && !mobileNav.classList.contains('hidden'));
  const anyOverlayOpen = isTripBucketDrawerOpen() || isAnyCustomDialogOpen() || mobileNavOpen;

  const targets = [dock, mobileBar].filter(Boolean) as HTMLElement[];
  if (targets.length === 0) return;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldHide = forceHidden ?? (anyOverlayOpen || (!forceVisible && currentScrollHidden));

  targets.forEach(el => {
    if (shouldHide) {
      el.style.transform = prefersReducedMotion ? 'none' : 'translateY(120px)';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.setAttribute('aria-hidden', 'false');
    }
  });
}

export function syncSummaryBarsVisibility(): void {
  updateTripControlsVisibility();
}

export function openTripBucketDrawer(trigger?: HTMLElement | null): void {
  hideToast();
  const bucketContainer = document.getElementById('trip-bucket-drawer-container');
  if (!bucketContainer) return;

  if (isAnyCustomDialogOpen()) {
    closeActiveDialog(false);
  }

  const mobileContainer = document.getElementById('mobile-nav-drawer-container');
  if (mobileContainer && !mobileContainer.classList.contains('hidden')) {
    mobileContainer.classList.add('hidden');
    mobileContainer.setAttribute('aria-hidden', 'true');
    deactivateFocusTrap(mobileContainer);
  }

  lastBucketTrigger = trigger || (document.activeElement as HTMLElement | null);

  const triggers = [
    document.getElementById('header-trip-bucket-btn'),
    document.getElementById('dock-review-trip-btn'),
    document.getElementById('mobile-summary-review-btn')
  ].filter(Boolean) as HTMLElement[];

  triggers.forEach(btn => {
    btn.setAttribute('aria-expanded', btn === trigger ? 'true' : 'false');
  });

  bucketContainer.classList.remove('hidden');
  bucketContainer.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true);
  activateFocusTrap(bucketContainer);
  syncSummaryBarsVisibility();

  telemetry.track('open_trip_bucket_drawer');

  window.setTimeout(() => {
    const bucketClose = document.getElementById('trip-bucket-close');
    if (bucketClose) {
      bucketClose.focus();
      return;
    }
    const focusables = getFocusableElements(bucketContainer);
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  }, 10);
}

export function closeTripBucketDrawer(returnFocus = true): void {
  const bucketContainer = document.getElementById('trip-bucket-drawer-container');
  if (!bucketContainer || bucketContainer.classList.contains('hidden')) return;

  bucketContainer.setAttribute('aria-hidden', 'true');
  bucketContainer.classList.add('hidden');
  deactivateFocusTrap(bucketContainer);
  setBackgroundInert(false);

  const triggers = [
    document.getElementById('header-trip-bucket-btn'),
    document.getElementById('dock-review-trip-btn'),
    document.getElementById('mobile-summary-review-btn')
  ].filter(Boolean) as HTMLElement[];

  triggers.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  syncSummaryBarsVisibility();

  const target = lastBucketTrigger;
  lastBucketTrigger = null;
  if (returnFocus && target && typeof target.focus === 'function') {
    target.focus();
  }
}

export function isTripBucketDrawerOpen(): boolean {
  const bucketContainer = document.getElementById('trip-bucket-drawer-container');
  return Boolean(bucketContainer && !bucketContainer.classList.contains('hidden'));
}

export function initTripBucketUi(): void {
  ensureMobileSummaryBarExists();

  const bucketClose = document.getElementById('trip-bucket-close');
  const bucketBackdrop = document.getElementById('trip-bucket-backdrop');
  const headerBtn = document.getElementById('header-trip-bucket-btn');
  const dockBtn = document.getElementById('dock-review-trip-btn');
  const mobileBarBtn = document.getElementById('mobile-summary-review-btn');

  [headerBtn, dockBtn, mobileBarBtn].filter(Boolean).forEach(btn => {
    btn!.addEventListener('click', event => {
      event.stopPropagation();
      openTripBucketDrawer(btn as HTMLElement);
    });
  });

  if (bucketClose) {
    bucketClose.addEventListener('click', () => closeTripBucketDrawer(true));
  }
  if (bucketBackdrop) {
    bucketBackdrop.addEventListener('click', () => closeTripBucketDrawer(true));
  }

  const renderAll = () => {
    const items = tripBucketService.getItems();
    const summary = tripBucketService.getSummary();
    const currency = searchCommandService.getState().currency;
    syncHeaderBadge(summary);
    syncFloatingDock(summary, currency);
    syncMobileSummaryBar(summary, currency);
    syncDrawerContents(items, summary, currency);
  };

  tripBucketService.subscribe(() => renderAll());
  searchCommandService.subscribe(() => renderAll());

  initFloatingDockScrollBehavior();
}

function ensureMobileSummaryBarExists(): void {
  let mobileBar = document.getElementById('mobile-summary-bar');
  if (mobileBar) return;

  mobileBar = document.createElement('aside');
  mobileBar.id = 'mobile-summary-bar';
  mobileBar.setAttribute('aria-label', 'Mobile Trip Bucket Summary Bar');
  mobileBar.className =
    'fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-brand-border shadow-2xl px-4 py-2.5 flex sm:hidden items-center justify-between gap-3 transition-all duration-200';
  mobileBar.innerHTML = `
    <div id="mobile-summary-info" class="min-w-0 flex-1"></div>
    <button
      type="button"
      id="mobile-summary-review-btn"
      aria-controls="trip-bucket-drawer"
      aria-expanded="false"
      class="bg-brand-primary text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm whitespace-nowrap touch-target-44"
    >
      Review Trip
    </button>
  `;

  const dock = document.getElementById('floating-trip-dock');
  if (dock && dock.parentNode) {
    dock.parentNode.insertBefore(mobileBar, dock.nextSibling);
  } else {
    document.body.appendChild(mobileBar);
  }
}

function syncHeaderBadge(summary: TripBucketSummary): void {
  const headerBtn = document.getElementById('header-trip-bucket-btn');
  if (!headerBtn) return;

  headerBtn.setAttribute('aria-label', `Trip Bucket ${summary.totalItems} items staged`);
  const badge = headerBtn.querySelector('span.tabular-nums');
  if (badge) {
    badge.textContent = String(summary.totalItems);
  }
}

function syncFloatingDock(
  summary: TripBucketSummary,
  currency = searchCommandService.getState().currency
): void {
  const dock = document.getElementById('floating-trip-dock');
  if (!dock) return;

  const infoCol = dock.querySelector('.flex-1.min-w-0');
  if (!infoCol) return;

  infoCol.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="font-heading font-bold text-sm text-brand-black">Your Trip (<span class="tabular-nums">${summary.totalItems}</span> items)</span>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-subtle text-brand-muted border border-brand-border tabular-nums">${summary.statusHeadline}</span>
    </div>
    <p class="text-xs text-brand-muted truncate mb-1">${summary.itemPillsSummary}</p>
    <div class="text-xs font-bold text-brand-primary tabular-nums">Ready items estimate: ${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</div>
  `;
}

function syncMobileSummaryBar(
  summary: TripBucketSummary,
  currency = searchCommandService.getState().currency
): void {
  const infoEl = document.getElementById('mobile-summary-info');
  if (!infoEl) return;

  infoEl.innerHTML = `
    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-brand-black truncate">
      <span class="font-heading font-bold">Trip · <span class="tabular-nums">${summary.totalItems}</span></span>
      <span class="text-brand-muted">·</span>
      <span class="text-[10px] text-brand-muted truncate tabular-nums">${summary.statusHeadline}</span>
    </div>
    <div class="text-xs font-bold text-brand-primary tabular-nums truncate">
      Ready estimate: ${formatCurrencyAmount(summary.readySubtotalLkr, currency)}
    </div>
  `;
}

function syncDrawerContents(
  items: TripBucketCandidate[],
  summary: TripBucketSummary,
  currency = searchCommandService.getState().currency
): void {
  const drawer = document.getElementById('trip-bucket-drawer');
  if (!drawer) return;

  const headerCount = drawer.querySelector('.p-6.border-b span.tabular-nums');
  if (headerCount) {
    headerCount.textContent = String(summary.totalItems);
  }

  const listContainer = drawer.querySelector('.flex-1.overflow-y-auto');
  if (listContainer) {
    const lastRemoved = tripBucketService.getLastRemovedItem();

    const isDevMode = Boolean(
      (typeof window !== 'undefined' && (window as any).__VACATINA_DEV_MODE__) ||
      (typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search).has('dev'))
    );

    const toolbarHtml = isDevMode
      ? `
      <div class="p-3 rounded-xl bg-brand-subtle border border-brand-border flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span class="font-semibold text-brand-black">Developer State Inspector (Screen 04)</span>
        <div class="flex items-center gap-1.5">
          <button type="button" id="drawer-revalidate-btn" class="px-2.5 py-1 rounded-lg bg-white border border-brand-border text-brand-primary font-semibold hover:bg-[#F0EFFC]">↻ Revalidate</button>
          <button type="button" id="drawer-s04-inspector-btn" class="px-2.5 py-1 rounded-lg bg-white border border-brand-border text-brand-black font-semibold hover:bg-[#F0EFFC]">8 States (Screen 04)</button>
          ${
            items.length !== 3 || summary.readySubtotalLkr !== 505000
              ? `<button type="button" id="drawer-reset-baseline-btn" class="px-2.5 py-1 rounded-lg bg-brand-primary text-white font-semibold">Reset Baseline</button>`
              : ''
          }
        </div>
      </div>
    `
      : '';

    const undoNoticeHtml = lastRemoved
      ? `
        <div id="trip-item-notice" role="status" class="p-3 rounded-xl bg-[#F0EFFC] border border-[#C7C3F4] flex items-center justify-between gap-2 text-xs">
          <span class="text-brand-black font-medium truncate">Removed <strong>${lastRemoved.title}</strong></span>
          <button type="button" id="drawer-undo-remove-btn" class="px-3 py-1 rounded-lg bg-brand-primary text-white text-[11px] font-semibold whitespace-nowrap hover:opacity-90">
            Undo remove
          </button>
        </div>
      `
      : '';

    const itemsHtml = items
      .map(item => {
        const desc = TRIP_BUCKET_STATE_DESCRIPTORS[item.state];
        const isReady = item.state === 'ready';
        const isExpanded = expandedDetailsItemIds.has(item.id);
        const isHotel = item.productType === 'hotels';

        return `
          <div class="p-4 rounded-xl border ${desc.cardBorderClasses} shadow-sm transition-all" data-bucket-item-id="${item.id}" data-bucket-state="${item.state}">
            <div class="flex items-center justify-between text-xs mb-1 gap-2">
              <span class="font-bold ${isReady ? 'text-brand-primary' : 'text-brand-muted'} uppercase">${item.productLabel}</span>
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${desc.badgeClasses}">${desc.icon} ${desc.label}</span>
            </div>
            <div class="font-semibold text-sm text-brand-black">${item.title}</div>
            <div class="text-xs text-brand-muted mt-0.5">${item.subtitle} · ${item.dateSummary}</div>
            ${
              item.holdStatusText && isReady
                ? `<div class="text-[11px] text-[#15803D] font-medium mt-1">✓ ${item.holdStatusText}</div>`
                : ''
            }
            ${
              item.actionRequiredText && !isReady
                ? `<div class="text-[11px] text-[#B45309] font-medium mt-1">${item.actionRequiredText}</div>`
                : ''
            }

            <!-- Expandable Inline Details (Recovered from Screen 03 Foundation v1.1) -->
            <div class="${isExpanded ? 'block' : 'hidden'} mt-2.5 p-2.5 rounded-lg bg-brand-canvas border border-brand-border text-[11px] text-brand-muted space-y-1" data-bucket-details-panel="${item.id}">
              <div><strong class="text-brand-black">Traveller Config:</strong> ${item.travellerSummary}</div>
              <div><strong class="text-brand-black">Booking Channel:</strong> Vacatina Coordinated Itinerary</div>
              <div><strong class="text-brand-black">Tariff Protection:</strong> ${
                isReady
                  ? 'Included in Ready items subtotal. Indicative rate staged.'
                  : 'Excluded from Ready items subtotal until pending action or confirmation is completed.'
              }</div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-brand-border/80 flex flex-wrap items-center justify-between gap-2">
              <div>
                ${
                  item.previousPriceLkr
                    ? `<span class="text-[11px] line-through text-brand-muted mr-1.5 tabular-nums">${formatCurrencyAmount(item.previousPriceLkr, currency)}</span>`
                    : ''
                }
                <span class="text-sm font-bold text-brand-black tabular-nums">${
                  item.priceLkr > 0
                    ? formatCurrencyAmount(item.priceLkr, currency)
                    : 'Pending selection'
                }</span>
                ${
                  !isReady && item.priceLkr > 0
                    ? `<span class="block text-[10px] text-brand-muted">(Excluded from ready subtotal: ${formatCurrencyAmount(item.priceLkr, currency)})</span>`
                    : ''
                }
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-bucket-view-details="${item.id}"
                  aria-expanded="${isExpanded ? 'true' : 'false'}"
                  class="px-2 py-1.5 rounded-lg border border-brand-border bg-white text-[11px] font-medium text-brand-black hover:border-brand-primary"
                >
                  ${isExpanded ? 'Hide details' : 'View details'}
                </button>
                ${
                  isHotel && isReady
                    ? `<button type="button" data-bucket-change-room="${item.id}" class="px-2.5 py-1.5 rounded-lg border border-brand-primary text-brand-primary bg-[#F0EFFC] text-[11px] font-semibold hover:bg-brand-primary hover:text-white transition-colors">Change room</button>`
                    : ''
                }
                ${
                  !isReady
                    ? `<button type="button" data-bucket-resolve="${item.id}" class="px-2.5 py-1.5 rounded-lg bg-brand-primary text-white text-[11px] font-semibold hover:opacity-90 whitespace-nowrap">${item.primaryActionLabel || 'Resolve'}</button>`
                    : ''
                }
                <button type="button" data-bucket-remove="${item.id}" aria-label="Remove ${item.title}" class="px-2 py-1.5 rounded-lg border border-brand-border text-[11px] text-brand-muted hover:text-[#B91C1C] hover:border-red-200">
                  Remove
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    listContainer.innerHTML =
      toolbarHtml +
      undoNoticeHtml +
      (itemsHtml ||
        `<div id="trip-empty-state" class="p-6 rounded-xl border border-dashed border-brand-border text-center space-y-2.5">
          <div class="font-heading font-bold text-sm text-brand-black">Your trip starts here</div>
          <p class="text-xs text-brand-muted">Add flights, stays, visas, packages, or transfers from any section to orchestrate your journey in one place.</p>
          <button type="button" id="empty-state-build-btn" class="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold">Build Your Trip</button>
        </div>`);

    // Wire Undo Remove button inside #trip-item-notice
    const undoBtn = listContainer.querySelector('#drawer-undo-remove-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        const restored = tripBucketService.undoLastRemove();
        if (restored) {
          telemetry.track('undo_remove_bucket_item', { id: restored.id });
          showToast(`Restored "${restored.title}" to Your Trip Bucket.`, 'success');
        }
      });
    }

    // Wire View details toggles
    listContainer.querySelectorAll<HTMLButtonElement>('[data-bucket-view-details]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-bucket-view-details');
        if (!id) return;
        if (expandedDetailsItemIds.has(id)) {
          expandedDetailsItemIds.delete(id);
        } else {
          expandedDetailsItemIds.add(id);
        }
        syncDrawerContents(tripBucketService.getItems(), tripBucketService.getSummary(), currency);
      });
    });

    // Wire Change Room on Hotel item (Screen 03 Foundation v1.1 capability)
    listContainer.querySelectorAll<HTMLButtonElement>('[data-bucket-change-room]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-bucket-change-room');
        if (!id) return;
        const updated = tripBucketService.toggleHotelRoomTier(id);
        if (updated) {
          const newSub = tripBucketService.getSummary().readySubtotalLkr;
          telemetry.track('change_hotel_room_tier', { id, title: updated.title, priceLkr: updated.priceLkr });
          showToast(
            `Switched to "${updated.title}". Ready estimate updated to ${formatCurrencyAmount(newSub, currency)}.`,
            'brand'
          );
        }
      });
    });

    // Wire Resolve buttons
    listContainer.querySelectorAll<HTMLButtonElement>('[data-bucket-resolve]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-bucket-resolve');
        if (id) {
          const item = tripBucketService.getItems().find(i => i.id === id);
          if (item && (item.productType === 'visa' || (item as any).type === 'visa' || item.title.toLowerCase().includes('visa'))) {
            closeTripBucketDrawer(false);
            openVisaApplicationModal(item.title, item.offerId);
            return;
          }
          const resolved = tripBucketService.resolveItemAction(id);
          if (resolved) {
            telemetry.track('resolve_bucket_item', { id, title: resolved.title });
            showToast(
              `"${resolved.title}" is now Ready and included in your Ready items estimate.`,
              'success'
            );
          }
        }
      });
    });

    // Wire Remove buttons with Undo support
    listContainer.querySelectorAll<HTMLButtonElement>('[data-bucket-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-bucket-remove');
        if (id) {
          const removed = tripBucketService.removeItem(id);
          telemetry.track('remove_bucket_item', { id });
          showToast(
            `Removed "${removed?.title || 'item'}" from Trip Bucket.`,
            'brand',
            'Undo remove',
            () => {
              tripBucketService.undoLastRemove();
            }
          );
        }
      });
    });

    const emptyBuildBtn = listContainer.querySelector('#empty-state-build-btn');
    if (emptyBuildBtn) {
      emptyBuildBtn.addEventListener('click', () => {
        closeTripBucketDrawer(false);
        const scc = document.getElementById('search-command-center');
        if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const revalBtn = listContainer.querySelector('#drawer-revalidate-btn');
    if (revalBtn) {
      revalBtn.addEventListener('click', () => {
        tripBucketService.revalidateAllReadyItems(() => {
          showToast('Live holds revalidated across Ready items.', 'success');
        });
      });
    }

    const s04Btn = listContainer.querySelector('#drawer-s04-inspector-btn');
    if (s04Btn) {
      s04Btn.addEventListener('click', () => {
        const trigger = lastBucketTrigger;
        closeTripBucketDrawer(false);
        openScreen04StatesModal(trigger);
      });
    }

    const resetBtn = listContainer.querySelector('#drawer-reset-baseline-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        tripBucketService.resetToCanonicalBaseline();
        showToast('Restored canonical 3-item baseline (Ready subtotal: LKR 505,000).', 'success');
      });
    }
  }

  // Update Drawer Footer
  const footerContainer = drawer.querySelector('.p-6.border-t.border-brand-border.bg-brand-canvas');
  if (footerContainer) {
    const nonReadyTotal = summary.totalItems - summary.readyCount;
    footerContainer.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-brand-muted font-medium">Ready items subtotal</span>
        <span id="drawer-ready-subtotal" class="text-base font-bold text-brand-primary tabular-nums">${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</span>
      </div>
      <div class="text-[11px] text-brand-muted mb-4">
        ${
          nonReadyTotal > 0
            ? `${nonReadyTotal} item(s) require action or confirmation before unified checkout (excluded: ${formatCurrencyAmount(summary.excludedSubtotalLkr, currency)}).`
            : `All ${summary.readyCount} staged item(s) are Ready for unified dossier confirmation.`
        }
      </div>
      <button type="button" id="drawer-review-trip-cta" class="w-full bg-brand-primary text-white text-sm font-semibold py-3 rounded-xl shadow-sm hover:opacity-90 touch-target-44">
        Review Trip
      </button>
    `;

    const reviewBtn = footerContainer.querySelector('#drawer-review-trip-cta');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        const trigger = lastBucketTrigger;
        closeTripBucketDrawer(false);
        openTripDossierReviewModal(trigger);
      });
    }
  }
}

function initFloatingDockScrollBehavior(): void {
  const floatingDock = document.getElementById('floating-trip-dock');
  const mobileBar = document.getElementById('mobile-summary-bar');
  if (!floatingDock && !mobileBar) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY <= 80) {
          currentScrollHidden = false;
          updateTripControlsVisibility();
        } else if (currentY - lastScrollY > 10) {
          currentScrollHidden = true;
          updateTripControlsVisibility();
        } else if (lastScrollY - currentY > 10) {
          currentScrollHidden = false;
          updateTripControlsVisibility();
        }

        lastScrollY = currentY;
        ticking = false;
      });
      ticking = true;
    },
    { passive: true }
  );
}
