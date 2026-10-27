/* ============================================================================
 * Vacatina Canonical Hotel Offer & Property Detail Modal
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 *
 * Invariants:
 * 1. Shows comprehensive room categories, board basis, and cancellation policies.
 * 2. Directly stages configured rooms into the 8-state Trip Bucket.
 * 3. Never stages SEED items; only bookable manual/API inventory.
 * ============================================================================ */

import type {
  CanonicalHotelOffer,
  HotelRatePlan,
  HotelRoomCategory,
  HotelSelectedConfiguration
} from '../domain/hotel-models.ts';
import { hotelSearchService } from '../services/hotel-search.service.ts';
import { hotelTripBucketService } from '../services/hotel-trip-bucket.service.ts';
import { hotelFavoritesService } from '../services/hotel-favorites.service.ts';
import { openTripBucketDrawer } from '../../../components/trip-bucket/trip-bucket-ui.ts';
import { showToast, activateFocusTrap, deactivateFocusTrap, setBackgroundInert } from '../../../components/ui/toast.ts';
import { telemetry } from '../../../lib/analytics/telemetry.ts';
import { HOTEL_DEMO_DISCLOSURE, hotelEscape } from '../domain/hotel-journey.ts';

let activeHotelModal: HTMLElement | null = null;
let previousHotelActiveElement: HTMLElement | null = null;
let closeCurrentHotel: (() => void) | null = null;
let lastHotelContext: { checkInDate?: string; checkOutDate?: string; rooms?: number; adults?: number; children?: number } | undefined;
export function closeCanonicalHotelModal(): void { closeCurrentHotel?.(); }

export async function openCanonicalHotelDetailModal(
  hotelId: string,
  searchContext?: {
    checkInDate?: string;
    checkOutDate?: string;
    rooms?: number;
    adults?: number;
    children?: number;
  },
  triggerElement?: HTMLElement | null
): Promise<void> {
  closeCanonicalHotelModal();
  if (searchContext) lastHotelContext = searchContext;
  searchContext ||= lastHotelContext;
  if (triggerElement) previousHotelActiveElement = triggerElement;
  else if (document.activeElement instanceof HTMLElement) {
    previousHotelActiveElement = document.activeElement;
  }

  telemetry.track('hotel_property_detail_opened', { hotelId });

  // Fetch canonical offer
  const hotel = await hotelSearchService.getOfferById(hotelId);
  if (!hotel) {
    const dialog = document.createElement('div');
    dialog.id = 'hotel-invalid-dialog';
    dialog.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4';
    dialog.setAttribute('role', 'alertdialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'hotel-invalid-title');
    dialog.innerHTML = `<div class="bg-white rounded-2xl p-6 w-full max-w-md"><h2 id="hotel-invalid-title" class="font-bold text-lg">Hotel option unavailable</h2><p class="text-sm mt-3">${hotelEscape(hotelId)} was not found. No room hold or booking was created.</p><button type="button" class="mt-5 min-h-[44px] px-5 rounded-xl bg-brand-primary text-white">Close</button></div>`;
    const close = () => { deactivateFocusTrap(dialog); setBackgroundInert(false); document.removeEventListener('keydown', onKey); dialog.remove(); closeCurrentHotel = null; previousHotelActiveElement?.focus(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    dialog.querySelector('button')?.addEventListener('click', close);
    document.addEventListener('keydown', onKey); document.body.appendChild(dialog); closeCurrentHotel = close;
    setBackgroundInert(true, dialog); activateFocusTrap(dialog); dialog.querySelector('button')?.focus();
    return;
  }

  renderHotelModal(hotel, searchContext);
}

function renderHotelModal(
  hotel: CanonicalHotelOffer,
  searchContext?: {
    checkInDate?: string;
    checkOutDate?: string;
    rooms?: number;
    adults?: number;
    children?: number;
  }
): void {
  if (activeHotelModal) {
    activeHotelModal.remove();
    activeHotelModal = null;
  }

  const cin = searchContext?.checkInDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const cout = searchContext?.checkOutDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const nights = Math.max(1, Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000));
  const roomsCount = searchContext?.rooms || 1;
  const adultsCount = searchContext?.adults || 2;
  const childrenCount = searchContext?.children || 0;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'hotel-property-detail-modal';
  modalOverlay.className = 'fixed inset-0 z-50 overflow-y-auto bg-brand-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'hotel-modal-title');

  const isFav = hotelFavoritesService.isHotelFavorite(hotel.hotelId);

  modalOverlay.innerHTML = `
    <div id="hotel-modal-panel" class="relative w-full min-w-0 max-w-4xl bg-white rounded-3xl shadow-2xl border border-brand-border overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header Banner / Close Bar -->
      <div class="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 py-4 border-b border-brand-border/60 flex items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
            hotel.sourceType === 'MANUAL'
              ? 'bg-[#1B1464] text-white'
              : 'bg-brand-primary/10 text-brand-primary'
          }">
            Demo fixture · Not live
          </span>
          <span class="text-xs font-bold text-brand-muted">${hotel.starRating}★ illustrative class</span>
          <span class="text-xs text-brand-muted hidden sm:inline">· 📍 ${hotel.location.city}, ${hotel.location.country}</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Favorite Toggle Button -->
          <button 
            type="button" 
            id="hotel-fav-toggle-btn"
            aria-label="Save to Favorites"
            class="w-9 h-9 rounded-full border border-brand-border flex items-center justify-center text-sm hover:bg-gray-50 transition-colors ${isFav ? 'text-red-500' : 'text-brand-muted'}"
          >
            ${isFav ? '❤️' : '🤍'}
          </button>

          <!-- Close Button -->
          <button 
            type="button" 
            id="hotel-modal-close-btn"
            aria-label="Close Hotel Details"
            class="w-9 h-9 rounded-full border border-brand-border flex items-center justify-center text-sm text-brand-black hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-6 overflow-y-auto space-y-8 text-brand-black text-xs leading-relaxed">
        <p id="hotel-truth-disclosure" class="rounded-xl p-4 bg-amber-50 border border-amber-200">${HOTEL_DEMO_DISCLOSURE}</p>
        <!-- Title & Location Bar -->
        <div class="space-y-2">
          <h2 id="hotel-modal-title" class="text-2xl sm:text-3xl font-heading font-bold text-brand-black">
            ${hotel.name}
          </h2>
          <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-brand-muted">
            <span>📍 ${hotel.location.address}</span>
            <span>· Illustrative rating <strong>${hotel.guestRatingScore} / 10</strong> (not verified guest reviews)</span>
            <span>· Check-in: <strong>${hotel.checkInTime}</strong> · Check-out: <strong>${hotel.checkOutTime}</strong></span>
          </div>
        </div>

        <!-- Image Gallery Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2 h-64 sm:h-80 rounded-2xl overflow-hidden bg-gray-100">
            <img src="${hotel.heroImage}" alt="${hotel.name}" class="w-full h-full object-cover" />
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-1 gap-3 h-64 sm:h-80">
            ${hotel.galleryImages.slice(1, 3).map(img => `
              <div class="rounded-2xl overflow-hidden bg-gray-100 h-full">
                <img src="${img}" alt="${hotel.name} Gallery" class="w-full h-full object-cover" />
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Description & Amenities -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-3">
            <h3 class="text-sm font-bold uppercase tracking-wider text-brand-primary">About This Property</h3>
            <p class="text-xs text-brand-muted leading-relaxed">${hotel.description}</p>
          </div>
          <div class="space-y-3 bg-brand-canvas p-4 rounded-2xl border border-brand-border">
            <h3 class="text-xs font-bold uppercase tracking-wider text-brand-black">Featured Amenities</h3>
            <div class="flex flex-wrap gap-1.5">
              ${hotel.hotelAmenities.map(amenity => `
                <span class="px-2.5 py-1 rounded-lg bg-white border border-brand-border text-[11px] font-semibold text-brand-black">
                  ✓ ${amenity}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Room Categories & Rate Plans Grid -->
        <div class="space-y-4 pt-4 border-t border-brand-border/60">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Select Your Accommodation</span>
              <h3 class="text-lg font-heading font-bold text-brand-black">Available Room Categories & Rate Options</h3>
            </div>
            <div class="text-[11px] text-brand-muted hidden sm:block">
              Dates: <strong>${cin}</strong> to <strong>${cout}</strong> (${nights} night${nights > 1 ? 's' : ''})
            </div>
          </div>

          <div class="space-y-4">
            ${hotel.roomCategories.map(room => `
              <div class="border border-brand-border rounded-2xl p-4 sm:p-5 bg-white space-y-4 hover:border-brand-primary/40 transition-colors">
                <div class="flex flex-col sm:flex-row gap-4">
                  <div class="w-full sm:w-48 h-32 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <img src="${room.images[0] || hotel.heroImage}" alt="${room.name}" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 space-y-2">
                    <h4 class="font-bold text-sm text-brand-black">${room.name}</h4>
                    <p class="text-[11px] text-brand-muted">${room.description}</p>
                    <div class="flex flex-wrap gap-2 text-[10px] text-brand-muted font-semibold">
                      <span>📐 ${room.roomSizeSqm} m²</span>
                      <span>· 🛏️ ${room.bedConfiguration}</span>
                      <span>· 👥 Up to ${room.maxOccupancy} Guests</span>
                    </div>
                    <div class="flex flex-wrap gap-1 pt-1">
                      ${room.amenities.map(a => `
                        <span class="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] text-brand-muted">
                          ${a}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                </div>

                <!-- Rate Plans Inside This Room -->
                <div class="pt-3 border-t border-gray-100 space-y-2">
                  <div class="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Choose Meal & Cancellation Terms</div>
                  <div class="space-y-2">
                    ${room.ratePlans.map(plan => `
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-brand-primary bg-gray-50/40 hover:bg-brand-primary/5 transition-all gap-3">
                        <div class="space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="font-bold text-xs text-brand-black">${plan.rateName}</span>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              plan.boardBasis === 'AI' ? 'bg-purple-100 text-purple-800' :
                              plan.boardBasis === 'HB' ? 'bg-blue-100 text-blue-800' :
                              plan.boardBasis === 'BB' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-gray-100 text-gray-800'
                            }">
                              ${plan.boardBasisLabel}
                            </span>
                            ${plan.isRecommended ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C5A880] text-brand-black">Recommended</span>' : ''}
                          </div>
                          <p class="text-[10px] text-emerald-700 font-medium">
                            ✓ ${plan.cancellationPolicyDescription}
                          </p>
                        </div>

                        <div class="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          <div class="text-right">
                            <div class="text-base font-bold text-brand-black">
                              ${hotelEscape(plan.currency)} ${(plan.totalPriceMinor * nights * roomsCount / 100).toLocaleString()}
                            </div>
                            <div class="text-[10px] text-brand-muted">
                              Illustrative total · ${nights} nights · ${roomsCount} rooms
                            </div>
                          </div>
                          <button 
                            type="button" 
                            data-select-room="${room.roomId}" 
                            data-select-plan="${plan.planId}"
                            class="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:opacity-90 shadow-sm transition-all"
                          >
                            Stage in Trip Bucket
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire close buttons
  const closeBtn = modalOverlay.querySelector('#hotel-modal-close-btn');
  closeBtn?.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', handleKeyDown);

  // Wire Favorite Button
  const favBtn = modalOverlay.querySelector<HTMLButtonElement>('#hotel-fav-toggle-btn');
  favBtn?.addEventListener('click', () => {
    const isNowFav = hotelFavoritesService.toggleHotelFavorite(hotel);
    favBtn.textContent = isNowFav ? '❤️' : '🤍';
    favBtn.className = `w-9 h-9 rounded-full border border-brand-border flex items-center justify-center text-sm hover:bg-gray-50 transition-colors ${isNowFav ? 'text-red-500' : 'text-brand-muted'}`;
    showToast(isNowFav ? `Added ${hotel.name} to Saved Favorites.` : `Removed from Favorites.`, 'brand');
  });

  // Wire "Stage in Trip Bucket" Buttons
  modalOverlay.querySelectorAll<HTMLButtonElement>('[data-select-room]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const roomId = btn.getAttribute('data-select-room')!;
      const planId = btn.getAttribute('data-select-plan')!;

      const room = hotel.roomCategories.find(r => r.roomId === roomId);
      const plan = room?.ratePlans.find(p => p.planId === planId);
      if (!room || !plan) return;

      btn.disabled = true;
      btn.textContent = 'Checking local fixture…';

      const config: HotelSelectedConfiguration = {
        hotelId: hotel.hotelId,
        canonicalOfferId: hotel.canonicalOfferId,
        roomId: room.roomId,
        roomName: room.name,
        planId: plan.planId,
        rateName: plan.rateName,
        boardBasis: plan.boardBasis,
        boardBasisLabel: plan.boardBasisLabel,
        checkInDate: cin,
        checkOutDate: cout,
        nights,
        roomsCount,
        adultsCount,
        childrenCount,
        nightlyRateMinor: plan.nightlyRateMinor,
        taxesMinor: plan.totalTaxesMinor,
        totalPriceMinor: plan.totalPriceMinor * nights * roomsCount,
        currency: plan.currency,
        freeCancellationBefore: plan.freeCancellationBefore,
        cancellationPolicyDescription: plan.cancellationPolicyDescription,
        sourceType: hotel.sourceType,
        supplierName: hotel.supplierName
      };

      try {
        await hotelTripBucketService.stageHotelRoom(hotel, config);
        closeModal();
        showToast('Hotel example staged for review. No room hold or supplier confirmation was created.', 'brand');
        openTripBucketDrawer();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not stage this room.', 'warning');
        btn.disabled = false; btn.textContent = 'Stage in Trip Bucket';
      }
    });
  });

  function closeModal() {
    deactivateFocusTrap(modalOverlay);
    setBackgroundInert(false);
    document.removeEventListener('keydown', handleKeyDown);
    modalOverlay.remove();
    activeHotelModal = null;
    closeCurrentHotel = null;
    if (previousHotelActiveElement) previousHotelActiveElement.focus();
  }

  document.body.appendChild(modalOverlay);
  activeHotelModal = modalOverlay;
  closeCurrentHotel = closeModal;
  setBackgroundInert(true, modalOverlay);
  activateFocusTrap(modalOverlay);
  modalOverlay.querySelector<HTMLButtonElement>('#hotel-modal-close-btn')?.focus();
}
