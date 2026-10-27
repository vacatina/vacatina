/* ============================================================================
 * Vacatina Reusable Hotel Occupancy Selector Popover
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

import type { HotelOccupancyRequest } from '../domain/hotel-search-models.ts';

export interface OccupancySelectorState extends HotelOccupancyRequest {}

export function formatOccupancySummaryText(state: OccupancySelectorState): string {
  const rooms = `${state.rooms} Room${state.rooms > 1 ? 's' : ''}`;
  const adults = `${state.adults} Adult${state.adults > 1 ? 's' : ''}`;
  const children = state.children > 0 ? ` · ${state.children} Child${state.children > 1 ? 'ren' : ''}` : '';
  return `${rooms} · ${adults}${children}`;
}

export function renderOccupancySelectorPopover(
  initialState: OccupancySelectorState,
  onChange: (newState: OccupancySelectorState) => void
): { element: HTMLElement; cleanup: () => void } {
  const state: OccupancySelectorState = { ...initialState };

  const popover = document.createElement('div');
  popover.className =
    'absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-2xl p-4 z-50 text-xs space-y-4';

  const updateUI = () => {
    popover.innerHTML = `
      <div class="space-y-3">
        <!-- Rooms -->
        <div class="flex items-center justify-between pb-2.5 border-b border-gray-100">
          <div>
            <div class="font-bold text-brand-black">Rooms</div>
            <div class="text-[11px] text-brand-muted">Standard stay unit</div>
          </div>
          <div class="flex items-center gap-2.5">
            <button type="button" data-field="rooms" data-dir="-1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.rooms <= 1 ? 'disabled' : ''}>-</button>
            <span class="w-5 text-center font-bold text-sm text-brand-black">${state.rooms}</span>
            <button type="button" data-field="rooms" data-dir="1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.rooms >= 8 ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <!-- Adults -->
        <div class="flex items-center justify-between pb-2.5 border-b border-gray-100">
          <div>
            <div class="font-bold text-brand-black">Adults</div>
            <div class="text-[11px] text-brand-muted">Age 13 and above</div>
          </div>
          <div class="flex items-center gap-2.5">
            <button type="button" data-field="adults" data-dir="-1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.adults <= 1 ? 'disabled' : ''}>-</button>
            <span class="w-5 text-center font-bold text-sm text-brand-black">${state.adults}</span>
            <button type="button" data-field="adults" data-dir="1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.adults >= 16 ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <!-- Children -->
        <div class="flex items-center justify-between">
          <div>
            <div class="font-bold text-brand-black">Children</div>
            <div class="text-[11px] text-brand-muted">Age 0 to 12</div>
          </div>
          <div class="flex items-center gap-2.5">
            <button type="button" data-field="children" data-dir="-1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.children <= 0 ? 'disabled' : ''}>-</button>
            <span class="w-5 text-center font-bold text-sm text-brand-black">${state.children}</span>
            <button type="button" data-field="children" data-dir="1" class="w-7 h-7 rounded-lg border border-gray-300 text-brand-black font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed" ${state.children >= 8 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-gray-100 flex justify-end">
        <button type="button" id="occupancy-apply-btn" class="px-4 py-1.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:opacity-90">
          Apply
        </button>
      </div>
    `;

    // Wire buttons
    popover.querySelectorAll<HTMLButtonElement>('button[data-field]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const field = btn.getAttribute('data-field') as keyof OccupancySelectorState;
        const dir = parseInt(btn.getAttribute('data-dir') || '0', 10);

        if (field === 'rooms') {
          state.rooms = Math.max(1, Math.min(8, state.rooms + dir));
          if (state.adults < state.rooms) state.adults = state.rooms;
        } else if (field === 'adults') {
          state.adults = Math.max(1, Math.min(16, state.adults + dir));
        } else if (field === 'children') {
          state.children = Math.max(0, Math.min(8, state.children + dir));
        }

        updateUI();
        onChange({ ...state });
      });
    });

    const applyBtn = popover.querySelector('#occupancy-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', e => {
        e.stopPropagation();
        popover.remove();
      });
    }
  };

  updateUI();

  return {
    element: popover,
    cleanup: () => {
      popover.remove();
    }
  };
}
