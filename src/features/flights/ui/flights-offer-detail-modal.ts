/* ============================================================================
 * Vacatina Canonical Flight Offer Detail View & Modal (/flights/offer/:offerId)
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§20–§25, §39, §40)
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
import { routerService } from '../../../lib/services/router.service.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { showToast } from '../../../components/ui/toast.ts';

let activeOfferModal: HTMLElement | null = null;
let previousActiveElement: HTMLElement | null = null;

export async function openCanonicalFlightDetailModal(
  offerId: string,
  triggerElement?: HTMLElement | null
): Promise<void> {
  if (triggerElement) previousActiveElement = triggerElement;
  else if (document.activeElement instanceof HTMLElement) {
    previousActiveElement = document.activeElement;
  }

  telemetry.track('flight_offer_opened', { offerId });

  // Fetch offer
  const offer = await flightSearchService.getOfferById(offerId);
  if (!offer) {
    showToast(`Flight offer ${offerId} not found or expired.`, 'warning');
    routerService.navigateTo('/flights/search');
    return;
  }

  renderOfferModal(offer);
}

function renderOfferModal(offer: CanonicalFlightOffer): void {
  // Close any existing modal
  if (activeOfferModal) {
    activeOfferModal.remove();
    activeOfferModal = null;
  }

  // Selected fare family state (default to recommended or first)
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

  const updateModalContent = () => {
    const selectedFamily = offer.fareFamiliesAvailable.find(f => f.familyCode === selectedFamilyCode);
    const familyDeltaMinor = selectedFamily?.priceDeltaMinor || 0;
    const finalTotalMinor = offer.price.totalMinor + familyDeltaMinor;

    const isSaved = flightFavoritesService.isOfferFavorite(offer.offerId);
    const durationHours = Math.floor(offer.durationMinutes / 60);
    const durationMins = offer.durationMinutes % 60;

    modalOverlay.innerHTML = `
      <div class="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-brand-primary text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white font-bold text-sm tracking-wider">
              ${offer.marketingCarrier.code}
            </span>
            <div>
              <h2 id="flight-offer-modal-title" class="text-base sm:text-lg font-bold font-display">
                ${offer.origin.city} (${offer.origin.airportCode}) → ${offer.destination.city} (${offer.destination.airportCode})
              </h2>
              <div class="text-xs text-white/80">
                ${offer.marketingCarrier.name} · ${offer.flightNumber} · ${offer.stopCount === 0 ? 'Direct Non-Stop' : `${offer.stopCount} Stop`} · ${durationHours}h ${durationMins}m
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" id="btn-modal-favorite-toggle" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Save flight to favorites">
              <svg class="w-4 h-4 ${isSaved ? 'text-red-400 fill-current' : 'fill-none'}" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>
            <button type="button" id="btn-modal-close" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close dialog">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="p-6 overflow-y-auto space-y-8 text-brand-dark">
          <!-- Revalidation / Price Freshness Status -->
          <div class="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 flex items-center justify-between text-xs text-blue-900">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span><strong>Availability Status:</strong> Fares and inventory confirmed via Vacatina Canonical Normalizer.</span>
            </div>
            <span class="text-[11px] text-blue-700 font-mono">Checked ${new Date(offer.lastCheckedAt).toLocaleTimeString()}</span>
          </div>

          <!-- Section 1: Detailed Flight Itinerary Timeline -->
          <div>
            <h3 class="text-sm font-bold font-display uppercase tracking-wider text-brand-muted mb-3">Flight Itinerary &amp; Timeline</h3>
            <div class="space-y-4">
              ${
                offer.slices && offer.slices.length > 0
                  ? offer.slices
                      .map(
                        (slice, sIdx) => `
                    <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <div class="text-xs font-bold text-brand-primary uppercase tracking-wider mb-2">
                        ${slice.sliceType === 'outbound' ? 'Outbound Journey' : slice.sliceType === 'return' ? 'Return Journey' : `Leg ${sIdx + 1}`} · ${slice.origin.airportCode} → ${slice.destination.airportCode}
                      </div>
                      ${slice.segments
                        .map(
                          seg => `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-t border-gray-100 first:border-t-0">
                          <div class="flex items-center gap-3">
                            <span class="text-xs font-bold px-2 py-1 bg-white rounded-md border border-gray-200 font-mono">${seg.flightNumber}</span>
                            <div>
                              <div class="text-sm font-bold text-brand-dark">${seg.origin.city} (${seg.origin.airportCode}) → ${seg.destination.city} (${seg.destination.airportCode})</div>
                              <div class="text-xs text-brand-muted">${seg.aircraft || 'Commercial Jet'} · Operated by ${seg.operatingCarrier.name}</div>
                            </div>
                          </div>
                          <div class="text-right">
                            <div class="text-xs font-bold text-brand-dark tabular-nums">${new Date(seg.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(seg.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div class="text-[11px] text-brand-muted">${Math.floor(seg.durationMinutes / 60)}h ${seg.durationMinutes % 60}m</div>
                          </div>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  `
                      )
                      .join('')
                  : `
                  <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <div class="text-sm font-bold text-brand-dark">${offer.origin.airportName} (${offer.origin.airportCode})</div>
                      <div class="text-xs text-brand-muted">Departure: ${new Date(offer.departureAt).toLocaleString()}</div>
                    </div>
                    <div class="text-center">
                      <div class="text-xs text-brand-muted">${durationHours}h ${durationMins}m</div>
                      <div class="text-xs font-bold text-green-700">${offer.stopCount === 0 ? 'Non-Stop' : `${offer.stopCount} Stop`}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-sm font-bold text-brand-dark">${offer.destination.airportName} (${offer.destination.airportCode})</div>
                      <div class="text-xs text-brand-muted">Arrival: ${new Date(offer.arrivalAt).toLocaleString()}</div>
                    </div>
                  </div>
                `
              }
            </div>
          </div>

          <!-- Section 2: Fare Families Comparison Matrix -->
          ${
            offer.fareFamiliesAvailable && offer.fareFamiliesAvailable.length > 0
              ? `
            <div>
              <h3 class="text-sm font-bold font-display uppercase tracking-wider text-brand-muted mb-3">Compare Fare Families</h3>
              <div class="grid grid-cols-1 md:grid-cols-${offer.fareFamiliesAvailable.length} gap-4">
                ${offer.fareFamiliesAvailable
                  .map(
                    fam => `
                  <div 
                    data-family-select="${fam.familyCode}" 
                    class="p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      fam.familyCode === selectedFamilyCode
                        ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                        : 'border-gray-200 hover:border-brand-primary/40 bg-white'
                    }"
                  >
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-bold text-brand-dark">${fam.familyName}</span>
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

                      <ul class="text-xs space-y-2 text-brand-dark border-t border-gray-100 pt-3">
                        <li class="flex items-center gap-2">
                          <svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                          <span>Cabin: ${fam.cabinBaggage}</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                          <span>Checked: ${fam.checkedBaggage}</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                          <span>Seats: ${fam.seatSelection.replace('_', ' ')}</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                          <span>Changes: ${fam.changeFeeDescription}</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                          <span>Refunds: ${fam.refundDescription}</span>
                        </li>
                      </ul>
                    </div>

                    <button type="button" class="mt-4 w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      fam.familyCode === selectedFamilyCode
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-brand-dark hover:bg-gray-200'
                    }">
                      ${fam.familyCode === selectedFamilyCode ? 'Selected' : 'Choose Fare'}
                    </button>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <!-- Section 3: Baggage & Fare Conditions -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Baggage Allowance Card -->
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted">Baggage Allowances</h4>
              <div class="text-xs space-y-1">
                <div><strong>Cabin Baggage:</strong> ${offer.baggage.cabin.description}</div>
                <div><strong>Checked Baggage:</strong> ${offer.baggage.checked.description}</div>
                ${offer.baggage.notes ? `<div class="text-brand-muted text-[11px] pt-1">${offer.baggage.notes}</div>` : ''}
              </div>
            </div>

            <!-- Change & Refund Policy Card -->
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted">Changes &amp; Cancellation</h4>
              <div class="text-xs space-y-1">
                <div><strong>Changes:</strong> ${offer.changeRules.description}</div>
                <div><strong>Refundability:</strong> ${offer.refundRules.description}</div>
              </div>
            </div>
          </div>

          <!-- Section 4: Transparent Price Breakdown -->
          <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200">
            <h4 class="text-xs font-bold uppercase tracking-wider text-brand-muted mb-3">Itemized Price Breakdown</h4>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between">
                <span>Base Airline Fare</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.baseFareMinor / 100).toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span>Mandatory Airport Taxes &amp; Security Surcharges</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.taxesMinor / 100).toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span>Carrier Administration &amp; GDS Fees</span>
                <span class="tabular-nums font-semibold">LKR ${(offer.price.feesMinor / 100).toLocaleString()}</span>
              </div>
              ${
                familyDeltaMinor !== 0
                  ? `
                <div class="flex justify-between text-brand-primary font-bold">
                  <span>Selected Fare Family Upgrade (${selectedFamily?.familyName})</span>
                  <span class="tabular-nums">+LKR ${(familyDeltaMinor / 100).toLocaleString()}</span>
                </div>
              `
                  : ''
              }
              <div class="border-t border-gray-200 pt-2 flex justify-between text-sm font-extrabold text-brand-dark">
                <span>Total Itinerary Price (All Taxes Included)</span>
                <span class="text-base text-brand-primary tabular-nums">LKR ${(finalTotalMinor / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Modal Footer Actions -->
        <div class="px-6 py-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <div class="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Final Price</div>
            <div class="text-2xl font-black font-display text-brand-dark tabular-nums">
              LKR ${(finalTotalMinor / 100).toLocaleString()}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button type="button" id="btn-modal-back-results" class="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold hover:bg-gray-50 text-brand-dark transition-colors">
              Back to Results
            </button>
            <button type="button" id="btn-modal-add-trip" class="px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-opacity-95 shadow-md transition-all flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              <span>Add to Trip Bucket</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Wire Events in modal
    modalOverlay.querySelector('#btn-modal-close')?.addEventListener('click', closeModal);
    modalOverlay.querySelector('#btn-modal-back-results')?.addEventListener('click', () => {
      closeModal();
      routerService.navigateTo('/flights/search');
    });

    // Wire Favorite toggle
    modalOverlay.querySelector('#btn-modal-favorite-toggle')?.addEventListener('click', () => {
      const isNowSaved = flightFavoritesService.toggleOfferFavorite(offer);
      updateModalContent();
      showToast(isNowSaved ? 'Saved flight to Favorites.' : 'Removed flight from Favorites.', 'brand');
    });

    // Wire Fare Family Selection
    modalOverlay.querySelectorAll<HTMLElement>('[data-family-select]').forEach(el => {
      el.addEventListener('click', () => {
        selectedFamilyCode = el.getAttribute('data-family-select') || selectedFamilyCode;
        telemetry.track('flight_fare_selected', { offerId: offer.offerId, familyCode: selectedFamilyCode });
        updateModalContent();
      });
    });

    // Wire Add to Trip Bucket
    modalOverlay.querySelector('#btn-modal-add-trip')?.addEventListener('click', async () => {
      const addBtn = modalOverlay.querySelector<HTMLButtonElement>('#btn-modal-add-trip');
      if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<span>Revalidating Fare…</span>';
      }

      const config: FlightConfigurationSelection = {
        offerId: offer.offerId,
        selectedFareFamilyCode: selectedFamilyCode,
        selectedCabinClass: offer.cabinClass,
        selectedOptionalServiceIds: []
      };

      // 1. Stage into Trip Bucket
      const candidate = flightTripBucketService.addFlightToTripBucket(offer, config);

      // 2. Perform Price Revalidation
      const revalidation = await flightTripBucketService.revalidateFlightInTripBucket(candidate.id, offer.offerId);

      if (revalidation.status === 'PRICE_CHANGED') {
        showToast(`Airline fare changed to LKR ${(revalidation.newPriceMinor / 100).toLocaleString()}. Please review in Trip Bucket.`, 'warning');
      } else if (revalidation.status === 'OFFER_EXPIRED') {
        showToast('This fare offer has expired upstream.', 'error');
      } else if (revalidation.status === 'UNAVAILABLE') {
        showToast('Seats at this fare are no longer available.', 'error');
      } else {
        showToast('Flight confirmed and added to your Trip Bucket.', 'success');
      }

      closeModal();
      // Open Trip Bucket drawer to show staged flight item
      const openTbBtn = document.getElementById('trip-bucket-btn');
      if (openTbBtn) openTbBtn.click();
    });
  };

  const closeModal = () => {
    if (activeOfferModal) {
      activeOfferModal.remove();
      activeOfferModal = null;
    }
    if (previousActiveElement) {
      previousActiveElement.focus();
    }
  };

  // Close on backdrop click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // ESC key listener
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  updateModalContent();
  document.body.appendChild(modalOverlay);
  activeOfferModal = modalOverlay;
}
