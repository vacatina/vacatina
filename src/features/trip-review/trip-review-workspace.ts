/* ============================================================================
 * Vacatina Trip Review Workspace (/trip/review)
 *
 * This is the customer review step for the browser-local Trip Bucket used by
 * the Flights journey. It is intentionally local: server checkout only knows
 * server-persisted items, and demo/manual flight inventory must never be
 * presented as a confirmed, payable booking.
 * ============================================================================ */

import type { TripBucketCandidate } from '../../lib/domain/types.ts';
import {
  TRIP_BUCKET_STATE_DESCRIPTORS,
  tripBucketService
} from '../../lib/services/trip-bucket.service.ts';
import { formatCurrencyAmount } from '../../lib/mock-data/catalog.ts';
import { showToast } from '../../components/ui/toast.ts';
import { openTripBucketDrawer } from '../../components/trip-bucket/trip-bucket-ui.ts';
import { routerService } from '../../lib/services/router.service.ts';
import { getLastFlightSearchQuery } from '../flights/domain/flight-search-context.ts';

function escapeReviewText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]!));
}

function stateLabel(item: TripBucketCandidate): string {
  return TRIP_BUCKET_STATE_DESCRIPTORS[item.state]?.label || item.state;
}

function stateBadgeClasses(item: TripBucketCandidate): string {
  return TRIP_BUCKET_STATE_DESCRIPTORS[item.state]?.badgeClasses || 'bg-gray-100 text-gray-700 border border-gray-200';
}

function isNonLiveItem(item: TripBucketCandidate): boolean {
  return item.inventoryMode !== 'live_supplier';
}

export interface TripReviewHandoff {
  nonLiveCount: number;
  blockedItems: TripBucketCandidate[];
  canCheckout: boolean;
  blockers: Array<{ id: string; title: string; blockers: string[] }>;
}

/**
 * Pure gate used by the review workspace and its automated tests. Checkout is
 * only possible when every staged item is live-confirmed and ready.
 */
export function evaluateTripReviewHandoff(items: TripBucketCandidate[]): TripReviewHandoff {
  const blockedItems = items.filter(item => blockersFor(item).length > 0);
  return {
    nonLiveCount: items.filter(isNonLiveItem).length,
    blockedItems,
    canCheckout: items.length > 0 && blockedItems.length === 0,
    blockers: blockedItems.map(item => ({
      id: item.id,
      title: item.title,
      blockers: blockersFor(item)
    }))
  };
}

function blockersFor(item: TripBucketCandidate): string[] {
  const blockers: string[] = [];
  if (item.state !== 'ready') {
    blockers.push(`State: ${stateLabel(item)}`);
  }
  if (isNonLiveItem(item)) {
    blockers.push(
      item.inventoryMode === 'demo_fixture'
        ? 'Demo fixture — no live airline inventory or seat hold'
        : item.inventoryMode === 'manual_request'
          ? 'Manual request-to-book — desk confirmation required'
          : 'Not confirmed as live supplier inventory'
    );
  }
  if (item.confirmationMode === 'REQUEST_TO_CONFIRM') {
    blockers.push('Supplier confirmation required before this item can be booked');
  }
  return [...new Set(blockers)];
}

function metadataRows(item: TripBucketCandidate): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (item.inventoryLabel) rows.push(['Inventory source', item.inventoryLabel]);
  else if (item.sourceType) rows.push(['Inventory source', item.sourceType]);
  if (item.providerName) rows.push(['Provider', item.providerName]);
  if (item.scheduleStatus) rows.push(['Schedule status', item.scheduleStatus.replace(/_/g, ' ')]);
  if (item.fareFamilyName) rows.push(['Fare family', item.fareFamilyName]);
  if (item.travellerCounts) {
    const counts = item.travellerCounts;
    rows.push([
      'Travellers',
      `${counts.adults} adult${counts.adults === 1 ? '' : 's'} · ${counts.children} child${counts.children === 1 ? '' : 'ren'} · ${counts.infants} infant${counts.infants === 1 ? '' : 's'}`
    ]);
  }
  if (item.searchContext?.origin && item.searchContext?.destination) {
    rows.push(['Search route', `${item.searchContext.origin} → ${item.searchContext.destination}`]);
  }
  if (item.revalidationStatus) {
    rows.push([
      'Last revalidation',
      `${item.revalidationStatus.replace(/_/g, ' ')}${item.revalidatedAt ? ` · ${new Date(item.revalidatedAt).toLocaleString()}` : ''}`
    ]);
  }
  return rows;
}

export function renderTripReviewWorkspace(container: HTMLElement): void {
  const render = () => {
    const items = tripBucketService.getItems();
    const summary = tripBucketService.getSummary();
    const currency = 'LKR';

    const handoff = evaluateTripReviewHandoff(items);
    const nonLiveCount = handoff.nonLiveCount;
    const blockedItems = handoff.blockedItems;
    const canCheckout = handoff.canCheckout;

    const itemsHtml = items
      .map(item => {
        const blockers = blockersFor(item);
        const rows = metadataRows(item);
        return `
          <article class="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4 min-w-0" data-review-item-id="${escapeReviewText(item.id)}" data-inventory-mode="${escapeReviewText(item.inventoryMode || 'unknown')}">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-brand-muted">${escapeReviewText(item.productLabel)}</span>
                  <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${stateBadgeClasses(item)}">${escapeReviewText(stateLabel(item))}</span>
                </div>
                <h2 class="text-base sm:text-lg font-bold text-brand-black mt-1 break-words">${escapeReviewText(item.title)}</h2>
                <p class="text-xs text-brand-muted mt-1">${escapeReviewText(item.subtitle)} · ${escapeReviewText(item.dateSummary)}</p>
                <p class="text-xs text-brand-muted mt-1">${escapeReviewText(item.travellerSummary)}</p>
              </div>
              <div class="text-right shrink-0">
                <div class="text-[10px] uppercase font-bold tracking-wider text-brand-muted">Estimate</div>
                <div class="text-lg font-black text-brand-black tabular-nums">${formatCurrencyAmount(item.priceLkr, currency)}</div>
              </div>
            </div>

            ${
              rows.length
                ? `<dl class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] border-t border-gray-100 pt-3">
                    ${rows
                      .map(
                        ([label, value]) =>
                          `<div class="min-w-0"><dt class="font-bold text-brand-black">${escapeReviewText(label)}</dt><dd class="text-brand-muted break-words">${escapeReviewText(value)}</dd></div>`
                      )
                      .join('')}
                  </dl>`
                : ''
            }

            ${
              item.truthDisclosure
                ? `<p class="text-[11px] leading-relaxed rounded-xl px-3 py-2 ${
                    item.inventoryMode === 'demo_fixture'
                      ? 'bg-slate-50 border border-slate-200 text-slate-700'
                      : item.inventoryMode === 'manual_request'
                        ? 'bg-amber-50 border border-amber-200 text-amber-950'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  }">${escapeReviewText(item.truthDisclosure)}</p>`
                : ''
            }

            ${
              blockers.length
                ? `<div class="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[11px] text-amber-950">
                    <p class="font-bold mb-1">Before this item can be booked</p>
                    <ul class="list-disc pl-4 space-y-0.5">${blockers.map(blocker => `<li>${escapeReviewText(blocker)}</li>`).join('')}</ul>
                  </div>`
                : `<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-900 font-semibold">Ready — no outstanding blockers recorded.</div>`
            }

            ${
              item.actionRequiredText
                ? `<p class="text-[11px] font-medium text-[#B45309]">${escapeReviewText(item.actionRequiredText)}</p>`
                : item.holdStatusText
                  ? `<p class="text-[11px] text-brand-muted">${escapeReviewText(item.holdStatusText)}</p>`
                  : ''
            }

            <div class="flex flex-wrap items-center gap-2 pt-1">
              ${
                item.productType === 'flights' && item.offerId
                  ? `<a href="/flights/offer/${encodeURIComponent(item.offerId)}" class="min-h-[40px] inline-flex items-center px-3 rounded-xl border border-gray-300 text-[11px] font-bold text-brand-black hover:bg-gray-50">View flight</a>`
                  : ''
              }
              ${
                item.state !== 'ready'
                  ? `<button type="button" data-review-request="${escapeReviewText(item.id)}" class="min-h-[40px] px-3 rounded-xl bg-brand-primary text-white text-[11px] font-bold hover:bg-opacity-95">${escapeReviewText(item.primaryActionLabel || 'Review item')}</button>`
                  : ''
              }
              <button type="button" data-review-remove="${escapeReviewText(item.id)}" class="min-h-[40px] px-3 rounded-xl border border-gray-300 text-[11px] font-bold text-brand-muted hover:text-red-700 hover:border-red-200">Remove</button>
            </div>
          </article>
        `;
      })
      .join('');

    container.innerHTML = `
      <div id="trip-review-workspace" class="w-full bg-white text-brand-black pb-20">
        <section class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <a href="/" class="inline-flex items-center min-h-[44px] text-xs font-bold text-brand-primary hover:underline">← Back to travel planning</a>

          <div class="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p class="text-[10px] uppercase tracking-widest text-brand-muted font-bold mb-2">Your Vacatina journey</p>
              <h1 class="text-3xl sm:text-4xl font-extrabold font-display text-brand-black">Review your trip</h1>
              <p class="text-sm text-brand-muted mt-2 max-w-2xl leading-relaxed">
                Check each staged option, its inventory source and every outstanding requirement before deciding what to request.
                This review is local to your browser in this build.
              </p>
            </div>
            <button type="button" id="btn-review-open-bucket" class="min-h-[44px] px-4 rounded-xl border border-gray-300 text-xs font-bold text-brand-black hover:bg-gray-50 self-start lg:self-auto">
              Open Trip Bucket
            </button>
          </div>

          <div role="note" class="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 leading-relaxed">
            <strong class="block mb-1">No live supplier, payment, or ticketing is activated in this build.</strong>
            ${nonLiveCount > 0
              ? `${nonLiveCount} of ${items.length} staged item${items.length === 1 ? '' : 's'} came from demo fixtures or manual request-to-book inventory. Their estimates are not live quotes and no seat hold exists.`
              : 'All staged items are shown for review only. Server checkout is not connected to browser-local items in this phase.'}
          </div>

          ${
            items.length === 0
              ? `<div class="mt-8 bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
                  <h2 class="text-lg font-bold font-display text-brand-black">Your Trip Bucket is empty</h2>
                  <p class="text-sm text-brand-muted mt-2">Search flights, stage an option you want to review, then return here.</p>
                  <a href="/flights" class="inline-flex items-center min-h-[44px] mt-5 px-5 rounded-xl bg-brand-primary text-white text-sm font-bold">Explore flights</a>
                </div>`
              : `<div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div class="lg:col-span-2 space-y-4">${itemsHtml}</div>

                  <aside class="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 lg:sticky lg:top-24">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-brand-muted">Trip summary</h2>
                    <dl class="space-y-2 text-xs">
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Items</dt><dd class="font-bold tabular-nums">${summary.totalItems}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Ready items</dt><dd class="font-bold tabular-nums">${summary.readyCount}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Needs action</dt><dd class="font-bold tabular-nums">${summary.needsActionCount}</dd></div>
                      <div class="flex justify-between gap-3 border-t border-gray-200 pt-2"><dt class="text-brand-muted">Ready estimate</dt><dd class="font-black text-brand-primary tabular-nums">${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Excluded from ready</dt><dd class="font-semibold tabular-nums">${formatCurrencyAmount(summary.excludedSubtotalLkr, currency)}</dd></div>
                    </dl>

                    ${
                      blockedItems.length > 0
                        ? `<div class="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[11px] text-amber-950">
                            <strong class="block mb-1">${blockedItems.length} item${blockedItems.length === 1 ? '' : 's'} need attention</strong>
                            Checkout stays unavailable until every item is live-confirmed and ready.
                          </div>`
                        : ''
                    }

                    <button type="button" id="btn-review-checkout" ${canCheckout ? '' : 'disabled aria-disabled="true"'} class="w-full min-h-[46px] rounded-xl text-sm font-bold ${
                      canCheckout
                        ? 'bg-brand-primary text-white hover:bg-opacity-95'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }">
                      Continue to checkout
                    </button>
                    <p class="text-[11px] text-brand-muted leading-relaxed">
                      ${
                        canCheckout
                          ? 'Server checkout availability is checked again before payment.'
                          : 'Checkout is gated because at least one item is not live-confirmed, or this build is using browser-local demo inventory.'
                      }
                    </p>

                    <a href="${escapeReviewText(getLastFlightSearchQuery())}" class="block text-center text-[11px] font-bold text-brand-primary hover:underline">Back to flight search</a>
                    <button type="button" id="btn-review-continue-shopping" class="w-full min-h-[40px] rounded-xl border border-gray-300 text-[11px] font-bold text-brand-black hover:bg-white">Continue exploring</button>
                  </aside>
                </div>`
          }
        </section>
      </div>
    `;

    container.querySelector('#btn-review-open-bucket')?.addEventListener('click', () => {
      openTripBucketDrawer(document.getElementById('header-trip-bucket-btn'));
    });

    container.querySelector('#btn-review-continue-shopping')?.addEventListener('click', () => {
      routerService.navigateTo('/flights');
    });

    container.querySelector('#btn-review-checkout')?.addEventListener('click', () => {
      if (!canCheckout) {
        showToast(
          'Checkout is gated: every item must be live-confirmed and ready. No payment or supplier request was started.',
          'warning'
        );
        return;
      }
      routerService.navigateTo('/checkout');
    });

    container.querySelectorAll<HTMLButtonElement>('[data-review-request]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-review-request');
        if (!id) return;
        const resolved = tripBucketService.resolveItemAction(id);
        if (!resolved) return;
        if (resolved.state === 'ready') {
          showToast('Item requirements updated. Review the latest state below.', 'brand');
        } else {
          showToast(
            'Requirement recorded locally for this demo. No supplier message or seat hold was sent.',
            'brand'
          );
        }
        render();
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-review-remove]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-review-remove');
        if (!id) return;
        const removed = tripBucketService.removeItem(id);
        if (removed) {
          showToast(`Removed "${removed.title}" from your trip.`, 'brand');
        }
        render();
      });
    });
  };

  render();
}
