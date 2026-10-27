/* ============================================================================
 * Vacatina Canonical Flight Offer Detail View & Modal (/flights/offer/:offerId)
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§20–§25, §39, §40)
 *
 * Phase 5 truth rules:
 * - Never describe demo fixtures or manual inventory as live supplier fares.
 * - Manual request-to-book options stay request-to-book; no live seat hold exists.
 * - Every dialog is keyboard operable, traps focus, and makes the background inert.
 * ============================================================================ */

import type {
  CanonicalFlightOffer,
  FlightFareFamilyOption
} from '../domain/flight-models.ts';
import type {
  FlightConfigurationSelection,
  FlightRevalidationResult
} from '../domain/search-models.ts';
import { flightSearchService } from '../services/flight-search.service.ts';
import { flightTripBucketService } from '../services/flight-trip-bucket.service.ts';
import { flightFavoritesService } from '../services/flight-favorites.service.ts';
import { resolveFlightInventoryTruth } from '../domain/flight-inventory-truth.ts';
import { getLastFlightSearchQuery } from '../domain/flight-search-context.ts';
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import {
  activateFocusTrap,
  deactivateFocusTrap,
  setBackgroundInert,
  showToast
} from '../../../components/ui/toast.ts';
import { openTripBucketDrawer } from '../../../components/trip-bucket/trip-bucket-ui.ts';

let activeOfferModal: HTMLElement | null = null;
let activeInvalidDialog: HTMLElement | null = null;
let previousActiveElement: HTMLElement | null = null;
let closeCurrentFlight: (() => void) | null = null;
let modalGeneration = 0;
export function closeCanonicalFlightDetailModal(): void { modalGeneration++; closeCurrentFlight?.(); }

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]!));
}

function rememberTrigger(triggerElement?: HTMLElement | null): void {
  if (triggerElement) previousActiveElement = triggerElement;
  else if (document.activeElement instanceof HTMLElement) {
    previousActiveElement = document.activeElement;
  }
}

function restoreTriggerFocus(): void {
  const target = previousActiveElement;
  previousActiveElement = null;
  if (target && target.isConnected && typeof target.focus === 'function') {
    target.focus();
  }
}

function removeOfferModal(): void {
  if (!activeOfferModal) return;
  deactivateFocusTrap(activeOfferModal);
  activeOfferModal.remove();
  activeOfferModal = null;
}

function removeInvalidDialog(): void {
  if (!activeInvalidDialog) return;
  deactivateFocusTrap(activeInvalidDialog);
  activeInvalidDialog.remove();
  activeInvalidDialog = null;
}

export async function openCanonicalFlightDetailModal(
  offerId: string,
  triggerElement?: HTMLElement | null
): Promise<void> {
  closeCanonicalFlightDetailModal();
  const request = ++modalGeneration;
  let decodedOfferId = offerId;
  try {
    decodedOfferId = decodeURIComponent(offerId);
  } catch {
    // Keep the raw id; lookup below will report it honestly.
  }

  rememberTrigger(triggerElement);
  telemetry.track('flight_offer_opened', { offerId: decodedOfferId });

  removeOfferModal();
  removeInvalidDialog();
  setBackgroundInert(false);

  const offer = await flightSearchService.getOfferById(decodedOfferId);
  if (request !== modalGeneration) return;
  if (!offer) {
    renderInvalidOfferDialog(decodedOfferId);
    return;
  }

  renderOfferModal(offer);
}

function renderInvalidOfferDialog(offerId: string): void {
  const dialog = document.createElement('div');
  dialog.id = 'flight-offer-invalid-dialog';
  dialog.className =
    'fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'flight-invalid-title');
  dialog.setAttribute('aria-describedby', 'flight-invalid-description');

  const closeDialog = () => {
    deactivateFocusTrap(dialog);
    setBackgroundInert(false);
    document.removeEventListener('keydown', handleKeydown);
    dialog.remove();
    activeInvalidDialog = null;
    closeCurrentFlight = null;
    restoreTriggerFocus();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  };

  const lastSearch = getLastFlightSearchQuery();

  dialog.innerHTML = `
    <div id="flight-invalid-panel" tabindex="-1" class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden focus:outline-none">
      <div class="px-6 py-4 bg-brand-primary text-white flex items-center justify-between gap-3">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-white/70 font-bold">Flight offer</p>
          <h2 id="flight-invalid-title" class="text-base sm:text-lg font-bold font-display">This flight option is not available</h2>
        </div>
        <button type="button" id="btn-invalid-offer-close" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close dialog">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-6 space-y-4 text-brand-black">
        <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed" role="note">
          We could not find offer <strong class="break-all">${escapeHtml(offerId)}</strong> in the current inventory.
          It may have expired, been withdrawn, or the link may be incomplete.
          No reservation, seat hold, price, or booking has been created.
        </div>
        <p class="text-xs text-brand-muted leading-relaxed">
          Return to your previous search or start a new search from the Flights hub. Demo fixture and manual
          request-to-book options always require a fresh desk quote before booking.
        </p>

        <div class="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 pt-1">
          <button type="button" id="btn-invalid-offer-back" class="min-h-[44px] px-4 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95">
            Back to last search
          </button>
          <button type="button" id="btn-invalid-offer-hub" class="min-h-[44px] px-4 rounded-xl border border-gray-300 text-xs font-bold text-brand-black hover:bg-gray-50">
            Flights hub
          </button>
        </div>
      </div>
    </div>
  `;

  dialog.querySelector('#btn-invalid-offer-close')?.addEventListener('click', closeDialog);
  dialog.querySelector('#btn-invalid-offer-back')?.addEventListener('click', () => {
    closeDialog();
    routerService.navigateTo(lastSearch);
  });
  dialog.querySelector('#btn-invalid-offer-hub')?.addEventListener('click', () => {
    closeDialog();
    routerService.navigateTo('/flights');
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });

  document.body.appendChild(dialog);
  activeInvalidDialog = dialog;
  closeCurrentFlight = closeDialog;
  document.addEventListener('keydown', handleKeydown);
  setBackgroundInert(true);
  activateFocusTrap(dialog);

  window.requestAnimationFrame(() => {
    const panel = dialog.querySelector<HTMLElement>('#flight-invalid-panel');
    if (panel) panel.focus();
  });
}

function renderOfferModal(offer: CanonicalFlightOffer): void {
  const truth = resolveFlightInventoryTruth(offer);

  let selectedFamilyCode =
    offer.fareFamiliesAvailable.find(f => f.isRecommended)?.familyCode ||
    offer.fareFamiliesAvailable[0]?.familyCode ||
    'standard';

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'flight-offer-detail-modal';
  modalOverlay.className =
    'fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'flight-offer-modal-title');
  modalOverlay.setAttribute('aria-describedby', 'flight-offer-truth');
  modalOverlay.setAttribute('data-inventory-mode', truth.mode);

  let keydownHandler: (event: KeyboardEvent) => void = () => undefined;

  const closeModal = () => {
    deactivateFocusTrap(modalOverlay);
    setBackgroundInert(false);
    document.removeEventListener('keydown', keydownHandler);
    modalOverlay.remove();
    activeOfferModal = null;
    closeCurrentFlight = null;
    restoreTriggerFocus();
  };

  keydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  };

  const updateModalContent = (focusSelector?: string) => {
    const selectedFamily: FlightFareFamilyOption | undefined =
      offer.fareFamiliesAvailable.find(f => f.familyCode === selectedFamilyCode);
    const familyDeltaMinor = selectedFamily?.priceDeltaMinor || 0;
    const finalTotalMinor = offer.price.totalMinor + familyDeltaMinor;

    const isSaved = flightFavoritesService.isOfferFavorite(offer.offerId);
    const durationHours = Math.floor(offer.durationMinutes / 60);
    const durationMins = offer.durationMinutes % 60;

    const headerMeta = truth.isManual
      ? `${escapeHtml(offer.sourceProvider)} · Schedule pending desk confirmation`
      : truth.isDemo
        ? `${escapeHtml(offer.marketingCarrier.name)} · ${escapeHtml(offer.flightNumber)} · Demo schedule (illustrative)`
        : `${escapeHtml(offer.marketingCarrier.name)} · ${escapeHtml(offer.flightNumber)} · ${offer.stopCount === 0 ? 'Direct Non-Stop' : `${offer.stopCount} Stop`} · ${durationHours}h ${durationMins}m`;

    const addButtonLabel = truth.isLive
      ? 'Add to Trip Bucket'
      : truth.isManual
        ? 'Request to Book'
        : 'Stage Demo Option';

    const totalLabel = truth.isLive
      ? 'Total Itinerary Price (All Taxes Included)'
      : `${truth.priceLabel} (not a live quote)`;

    const renderSlice = (slice: CanonicalFlightOffer['slices'][number], sIdx: number) => `
      <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200">
        <div class="text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">
          ${slice.sliceType === 'outbound' ? 'Outbound Journey' : slice.sliceType === 'return' ? 'Return Journey' : `Leg ${sIdx + 1}`} · ${escapeHtml(slice.origin.airportCode)} → ${escapeHtml(slice.destination.airportCode)}
        </div>
        ${slice.segments
          .map(seg => {
            if (truth.isManual) {
              return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0">
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-brand-black">${escapeHtml(seg.origin.city)} (${escapeHtml(seg.origin.airportCode)}) → ${escapeHtml(seg.destination.city)} (${escapeHtml(seg.destination.airportCode)})</div>
                    <div class="text-xs text-brand-muted">Carrier, flight number, schedule, aircraft and baggage pending desk confirmation.</div>
                  </div>
                  <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${truth.badgeClasses}">${truth.shortLabel}</span>
                </div>
              `;
            }
            return `
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-t border-gray-100 first:border-t-0">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="text-xs font-bold px-2 py-1 bg-white rounded-md border border-gray-200 font-mono">${escapeHtml(seg.flightNumber)}</span>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-brand-black">${escapeHtml(seg.origin.city)} (${escapeHtml(seg.origin.airportCode)}) → ${escapeHtml(seg.destination.city)} (${escapeHtml(seg.destination.airportCode)})</div>
                    <div class="text-xs text-brand-muted">${escapeHtml(seg.aircraft || 'Commercial Jet')} · Operated by ${escapeHtml(seg.operatingCarrier.name)}${truth.isDemo ? ' · illustrative demo detail' : ''}</div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-xs font-bold text-brand-black tabular-nums">${new Date(seg.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(seg.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div class="text-[11px] text-brand-muted">${Math.floor(seg.durationMinutes / 60)}h ${seg.durationMinutes % 60}m${truth.isDemo ? ' · demo' : ''}</div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    const itineraryHtml =
      offer.slices && offer.slices.length > 0
        ? offer.slices.map(renderSlice).join('')
        : truth.isManual
          ? `
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div class="text-sm font-bold text-brand-black">${escapeHtml(offer.origin.airportName)} (${escapeHtml(offer.origin.airportCode)}) → ${escapeHtml(offer.destination.airportName)} (${escapeHtml(offer.destination.airportCode)})</div>
              <div class="text-xs text-brand-muted mt-1">Schedule, carrier, flight number and baggage pending desk confirmation.</div>
            </div>
          `
          : `
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div class="text-sm font-bold text-brand-black">${escapeHtml(offer.origin.airportName)} (${escapeHtml(offer.origin.airportCode)})</div>
                <div class="text-xs text-brand-muted">Departure: ${new Date(offer.departureAt).toLocaleString()}${truth.isDemo ? ' · demo' : ''}</div>
              </div>
              <div class="sm:text-center">
                <div class="text-xs text-brand-muted">${durationHours}h ${durationMins}m</div>
                <div class="text-xs font-bold text-green-700">${offer.stopCount === 0 ? 'Non-Stop' : `${offer.stopCount} Stop`}</div>
              </div>
              <div class="sm:text-right">
                <div class="text-sm font-bold text-brand-black">${escapeHtml(offer.destination.airportName)} (${escapeHtml(offer.destination.airportCode)})</div>
                <div class="text-xs text-brand-muted">Arrival: ${new Date(offer.arrivalAt).toLocaleString()}${truth.isDemo ? ' · demo' : ''}</div>
              </div>
            </div>
          `;

    const fareFamilyHtml =
      offer.fareFamiliesAvailable && offer.fareFamiliesAvailable.length > 0
        ? `
          <div>
            <h3 class="text-sm font-bold font-display uppercase tracking-wider text-brand-muted mb-3">Compare Fare Families</h3>
            <div class="grid grid-cols-1 md:grid-cols-${Math.min(offer.fareFamiliesAvailable.length, 4)} gap-4" role="radiogroup" aria-label="Choose a fare family">
              ${offer.fareFamiliesAvailable
                .map(fam => {
                  const isSelected = fam.familyCode === selectedFamilyCode;
                  return `
                    <label
                      data-family-select="${escapeHtml(fam.familyCode)}"
                      class="p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2 ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                          : 'border-gray-200 hover:border-brand-primary/40 bg-white'
                      }"
                    >
                      <input
                        type="radio"
                        name="flight-fare-family"
                        value="${escapeHtml(fam.familyCode)}"
                        ${isSelected ? 'checked' : ''}
                        class="sr-only"
                        aria-label="${escapeHtml(fam.familyName)}"
                      />
                      <div>
                        <div class="flex items-center justify-between gap-2 mb-2">
                          <span class="text-sm font-bold text-brand-black">${escapeHtml(fam.familyName)}</span>
                          ${fam.isRecommended ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Recommended</span>' : ''}
                        </div>
                        <div class="text-base font-extrabold text-brand-primary tabular-nums mb-3">
                          ${
                            fam.priceDeltaMinor === 0
                              ? 'Included'
                              : fam.priceDeltaMinor > 0
                                ? `+LKR ${(fam.priceDeltaMinor / 100).toLocaleString()}`
                                : `-LKR ${(Math.abs(fam.priceDeltaMinor) / 100).toLocaleString()}`
                          }
                        </div>

                        <ul class="text-xs space-y-2 text-brand-black border-t border-gray-100 pt-3">
                          <li class="flex items-center gap-2"><span class="text-brand-primary font-bold" aria-hidden="true">✓</span><span>Cabin: ${escapeHtml(fam.cabinBaggage)}</span></li>
                          <li class="flex items-center gap-2"><span class="text-brand-primary font-bold" aria-hidden="true">✓</span><span>Checked: ${escapeHtml(fam.checkedBaggage)}</span></li>
                          <li class="flex items-center gap-2"><span class="text-brand-primary font-bold" aria-hidden="true">✓</span><span>Seats: ${escapeHtml(fam.seatSelection.replace('_', ' '))}</span></li>
                          <li class="flex items-center gap-2"><span class="text-brand-primary font-bold" aria-hidden="true">✓</span><span>Changes: ${escapeHtml(fam.changeFeeDescription)}</span></li>
                          <li class="flex items-center gap-2"><span class="text-brand-primary font-bold" aria-hidden="true">✓</span><span>Refunds: ${escapeHtml(fam.refundDescription)}</span></li>
                        </ul>
                      </div>

                      <span class="mt-4 block w-full py-1.5 rounded-lg text-center text-xs font-bold ${
                        isSelected
                          ? 'bg-brand-primary text-white'
                          : 'bg-gray-100 text-brand-black'
                      }">
                        ${isSelected ? 'Selected' : 'Choose Fare'}
                      </span>
                    </label>
                  `;
                })
                .join('')}
            </div>
            ${truth.isLive ? '' : `<p class="text-[11px] text-brand-muted mt-2">Fare-family benefits shown here are ${truth.isDemo ? 'illustrative demo details' : 'not yet confirmed by the carrier'}. The Vacatina desk confirms the final fare conditions before ticketing.</p>`}
          </div>
        `
        : '';

    modalOverlay.innerHTML = `
      <div id="flight-offer-panel" tabindex="-1" class="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] focus:outline-none">
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-brand-primary text-white flex items-center justify-between border-b border-white/10 shrink-0 gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white font-bold text-sm tracking-wider shrink-0">
              ${escapeHtml(truth.isManual ? '?' : offer.marketingCarrier.code)}
            </span>
            <div class="min-w-0">
              <h2 id="flight-offer-modal-title" class="text-base sm:text-lg font-bold font-display truncate">
                ${escapeHtml(offer.origin.city)} (${escapeHtml(offer.origin.airportCode)}) → ${escapeHtml(offer.destination.city)} (${escapeHtml(offer.destination.airportCode)})
              </h2>
              <div class="text-xs text-white/80 truncate">${headerMeta}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${truth.badgeClasses}">${truth.shortLabel}</span>
            <button type="button" id="btn-modal-favorite-toggle" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="${isSaved ? 'Remove flight from favorites' : 'Save flight to favorites'}" aria-pressed="${isSaved ? 'true' : 'false'}">
              <svg class="w-4 h-4 ${isSaved ? 'text-red-400 fill-current' : 'fill-none'}" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>
            <button type="button" id="btn-modal-close" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close flight offer dialog">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-6 overflow-y-auto space-y-8 text-brand-black">
          <!-- Inventory truth / freshness status -->
          <div id="flight-offer-truth" role="note" class="p-4 rounded-xl text-xs leading-relaxed ${truth.panelClasses}">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <strong>${escapeHtml(truth.label)}</strong>
              <span class="font-mono text-[10px] opacity-80">Checked ${new Date(offer.lastCheckedAt).toLocaleTimeString()}</span>
            </div>
            <p>${escapeHtml(truth.disclosure)}</p>
            <p class="mt-1.5 font-semibold">${escapeHtml(truth.confirmationLabel)} · ${escapeHtml(truth.scheduleLabel)}</p>
          </div>

          <!-- Section 1: Detailed Flight Itinerary Timeline -->
          <div>
            <h3 class="text-sm font-bold font-display uppercase tracking-wider text-brand-muted mb-3">Flight Itinerary &amp; Timeline</h3>
            <div class="space-y-4">${itineraryHtml}</div>
          </div>

          ${fareFamilyHtml}

          <!-- Section 3: Baggage & Fare Conditions -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted">${truth.isLive ? 'Baggage Allowances' : truth.isManual ? 'Baggage (to be confirmed)' : 'Baggage (illustrative demo)'}</h4>
              <div class="text-xs space-y-1">
                <div><strong>Cabin Baggage:</strong> ${escapeHtml(offer.baggage.cabin.description)}</div>
                <div><strong>Checked Baggage:</strong> ${escapeHtml(offer.baggage.checked.description)}</div>
                ${offer.baggage.notes ? `<div class="text-brand-muted text-[11px] pt-1">${escapeHtml(offer.baggage.notes)}</div>` : ''}
              </div>
            </div>

            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted">${truth.isLive ? 'Changes &amp; Cancellation' : 'Changes &amp; Cancellation (pending confirmation)'}</h4>
              <div class="text-xs space-y-1">
                <div><strong>Changes:</strong> ${escapeHtml(offer.changeRules.description)}</div>
                <div><strong>Refundability:</strong> ${escapeHtml(offer.refundRules.description)}</div>
              </div>
            </div>
          </div>

          <!-- Section 4: Transparent Price Breakdown -->
          <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200">
            <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted mb-3">${escapeHtml(truth.priceLabel)} breakdown</h4>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between gap-3">
                <span>Base Airline Fare</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.baseFareMinor / 100).toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-3">
                <span>Mandatory Airport Taxes &amp; Security Surcharges</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.taxesMinor / 100).toLocaleString()}</span>
              </div>
              <div class="flex justify-between gap-3">
                <span>Carrier Administration &amp; GDS Fees</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.feesMinor / 100).toLocaleString()}</span>
              </div>
              ${
                familyDeltaMinor !== 0
                  ? `
                <div class="flex justify-between gap-3 text-brand-primary font-bold">
                  <span>Selected Fare Family Upgrade (${escapeHtml(selectedFamily?.familyName)})</span>
                  <span class="tabular-nums">+LKR ${(familyDeltaMinor / 100).toLocaleString()}</span>
                </div>
              `
                  : ''
              }
              <div class="border-t border-gray-200 pt-2 flex justify-between gap-3 text-sm font-extrabold text-brand-black">
                <span>${totalLabel}</span>
                <span class="text-base text-brand-primary tabular-nums">LKR ${(finalTotalMinor / 100).toLocaleString()}</span>
              </div>
            </div>
            ${truth.isLive ? '' : `<p class="mt-3 text-[11px] leading-relaxed text-brand-muted">This amount is an ${truth.isManual ? 'indicative manual estimate' : 'illustrative demo estimate'}, not a live supplier quote. Taxes, fees, availability and total price are confirmed only after the Vacatina desk checks the fare.</p>`}
          </div>
        </div>

        <!-- Sticky Modal Footer Actions -->
        <div class="px-6 py-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div class="text-[10px] uppercase font-bold text-brand-muted tracking-wider">${escapeHtml(truth.priceLabel)}</div>
            <div class="text-2xl font-black font-display text-brand-black tabular-nums">
              LKR ${(finalTotalMinor / 100).toLocaleString()}
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button type="button" id="btn-modal-back-results" class="min-h-[44px] px-4 rounded-xl border border-gray-300 text-xs font-bold hover:bg-gray-50 text-brand-black transition-colors">
              Back to Results
            </button>
            <button type="button" id="btn-modal-add-trip" class="min-h-[44px] px-6 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95 shadow-md transition-all flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              <span>${addButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Wire Events in modal
    modalOverlay.querySelector('#btn-modal-close')?.addEventListener('click', closeModal);
    modalOverlay.querySelector('#btn-modal-back-results')?.addEventListener('click', () => {
      closeModal();
      routerService.navigateTo(getLastFlightSearchQuery());
    });

    // Wire Favorite toggle
    modalOverlay.querySelector('#btn-modal-favorite-toggle')?.addEventListener('click', () => {
      const isNowSaved = flightFavoritesService.toggleOfferFavorite(offer);
      updateModalContent();
      showToast(isNowSaved ? 'Saved flight to Favorites.' : 'Removed flight from Favorites.', 'brand');
    });

    // Accessible fare-family radios (native keyboard group)
    modalOverlay.querySelectorAll<HTMLInputElement>('input[name="flight-fare-family"]').forEach(input => {
      input.addEventListener('change', () => {
        if (input.value === selectedFamilyCode) return;
        selectedFamilyCode = input.value;
        telemetry.track('flight_fare_selected', { offerId: offer.offerId, familyCode: selectedFamilyCode });
        updateModalContent(`input[name="flight-fare-family"][value="${selectedFamilyCode}"]`);
      });
    });

    // Wire Add / Request to Trip Bucket
    modalOverlay.querySelector('#btn-modal-add-trip')?.addEventListener('click', async () => {
      const addBtn = modalOverlay.querySelector<HTMLButtonElement>('#btn-modal-add-trip');
      if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = `<span>${truth.isLive ? 'Revalidating Fare…' : 'Staging Request…'}</span>`;
      }

      const config: FlightConfigurationSelection = {
        offerId: offer.offerId,
        selectedFareFamilyCode: selectedFamilyCode,
        selectedCabinClass: offer.cabinClass,
        selectedOptionalServiceIds: []
      };

      // Stage synchronously so the trip bucket reflects the request immediately.
      const candidate = flightTripBucketService.addFlightToTripBucket(offer, config);

      // Revalidation is local for fixtures and manual inventory; it never
      // promotes a request-to-book candidate to a live confirmation.
      const revalidation: FlightRevalidationResult =
        await flightTripBucketService.revalidateFlightInTripBucket(candidate.id, offer.offerId);

      if (revalidation.status === 'PRICE_CHANGED') {
        showToast(
          truth.isLive
            ? `Airline fare changed to LKR ${(revalidation.newPriceMinor / 100).toLocaleString()}. Please review in your Trip Bucket.`
            : `Estimate updated to LKR ${(revalidation.newPriceMinor / 100).toLocaleString()}. Desk confirmation is still required.`,
          'warning'
        );
      } else if (revalidation.status === 'OFFER_EXPIRED') {
        showToast('This fare offer has expired. Please search current options.', 'error');
      } else if (revalidation.status === 'UNAVAILABLE') {
        showToast(
          truth.isLive
            ? 'Seats at this fare are no longer available.'
            : 'This option is no longer available in the current inventory.',
          'error'
        );
      } else if (truth.isManual) {
        showToast('Request staged. The Vacatina flight desk must confirm carrier, schedule, baggage and fare before ticketing.', 'brand');
      } else if (truth.isDemo) {
        showToast('Demo fare staged. No live seat hold was created — request a desk quote to book.', 'brand');
      } else {
        showToast('Flight added to your Trip Bucket.', 'success');
      }

      closeModal();
      openTripBucketDrawer(document.getElementById('header-trip-bucket-btn'));
    });

    if (focusSelector) {
      window.requestAnimationFrame(() => {
        modalOverlay.querySelector<HTMLElement>(focusSelector)?.focus();
      });
    }
  };

  // Close on backdrop click
  modalOverlay.addEventListener('click', event => {
    if (event.target === modalOverlay) closeModal();
  });

  updateModalContent();
  document.body.appendChild(modalOverlay);
  activeOfferModal = modalOverlay;
  closeCurrentFlight = closeModal;
  document.addEventListener('keydown', keydownHandler);
  setBackgroundInert(true);
  activateFocusTrap(modalOverlay);

  window.requestAnimationFrame(() => {
    const panel = modalOverlay.querySelector<HTMLElement>('#flight-offer-panel');
    if (panel) panel.focus();
  });
}
