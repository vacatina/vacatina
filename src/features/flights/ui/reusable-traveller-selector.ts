/* ============================================================================
 * Vacatina Reusable Accessible Traveller & Cabin Selector Component
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§10, §39, §40)
 * ============================================================================ */

import type { FlightCabinClass } from '../domain/flight-models.ts';
import type { FlightTravellerCounts } from '../domain/search-models.ts';

export interface TravellerSelectorState {
  adults: number;
  children: number;
  infants: number;
  cabinClass: FlightCabinClass;
}

export interface TravellerSelectorCallbacks {
  onChange: (state: TravellerSelectorState) => void;
  onClose?: () => void;
}

export function formatTravellerSummaryText(state: TravellerSelectorState): string {
  const parts: string[] = [];
  parts.push(`${state.adults} Adult${state.adults > 1 ? 's' : ''}`);
  if (state.children > 0) {
    parts.push(`${state.children} Child${state.children > 1 ? 'ren' : ''}`);
  }
  if (state.infants > 0) {
    parts.push(`${state.infants} Infant${state.infants > 1 ? 's' : ''}`);
  }

  const cabinLabels: Record<FlightCabinClass, string> = {
    economy: 'Economy',
    premium_economy: 'Premium Economy',
    business: 'Business',
    first: 'First'
  };

  return `${parts.join(', ')} · ${cabinLabels[state.cabinClass] || 'Economy'}`;
}

export function renderTravellerSelectorPopover(
  state: TravellerSelectorState,
  callbacks: TravellerSelectorCallbacks,
  containerId = 'flight-traveller-popover-content'
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = state.adults + state.children + state.infants;

  container.innerHTML = `
    <div class="p-4 space-y-4 text-left text-brand-dark">
      <div class="flex items-center justify-between border-b border-gray-100 pb-2">
        <span class="text-xs font-bold uppercase tracking-wider text-brand-muted">Travellers</span>
        <span class="text-xs text-brand-muted" id="traveller-max-notice">${total} of 9 Max</span>
      </div>

      <!-- Adults Stepper -->
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">Adults</div>
          <div class="text-xs text-brand-muted">Age 12+</div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" id="btn-dec-adults" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${state.adults <= 1 ? 'disabled' : ''} aria-label="Decrease adult passengers">-</button>
          <span class="w-6 text-center text-sm font-bold tabular-nums" id="val-adults">${state.adults}</span>
          <button type="button" id="btn-inc-adults" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${total >= 9 ? 'disabled' : ''} aria-label="Increase adult passengers">+</button>
        </div>
      </div>

      <!-- Children Stepper -->
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">Children</div>
          <div class="text-xs text-brand-muted">Age 2–11</div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" id="btn-dec-children" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${state.children <= 0 ? 'disabled' : ''} aria-label="Decrease child passengers">-</button>
          <span class="w-6 text-center text-sm font-bold tabular-nums" id="val-children">${state.children}</span>
          <button type="button" id="btn-inc-children" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${total >= 9 ? 'disabled' : ''} aria-label="Increase child passengers">+</button>
        </div>
      </div>

      <!-- Infants Stepper -->
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">Infants</div>
          <div class="text-xs text-brand-muted">Under 2 (on lap)</div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" id="btn-dec-infants" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${state.infants <= 0 ? 'disabled' : ''} aria-label="Decrease infant passengers">-</button>
          <span class="w-6 text-center text-sm font-bold tabular-nums" id="val-infants">${state.infants}</span>
          <button type="button" id="btn-inc-infants" class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors" ${state.infants >= state.adults || total >= 9 ? 'disabled' : ''} aria-label="Increase infant passengers">+</button>
        </div>
      </div>

      <!-- Cabin Class Selection -->
      <div class="border-t border-gray-100 pt-3">
        <label class="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">Cabin Class</label>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cabin Class selection">
          <button type="button" data-cabin="economy" class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${state.cabinClass === 'economy' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}">Economy</button>
          <button type="button" data-cabin="premium_economy" class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${state.cabinClass === 'premium_economy' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}">Premium Economy</button>
          <button type="button" data-cabin="business" class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${state.cabinClass === 'business' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}">Business</button>
          <button type="button" data-cabin="first" class="px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${state.cabinClass === 'first' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}">First Class</button>
        </div>
      </div>

      <!-- Done Button -->
      <div class="border-t border-gray-100 pt-3">
        <button type="button" id="btn-traveller-apply" class="w-full py-2 bg-brand-primary text-white rounded-lg text-xs font-bold hover:bg-opacity-95 transition-colors">Apply Travellers</button>
      </div>
    </div>
  `;

  // Wire Steppers
  const updateAndRerender = (newState: TravellerSelectorState) => {
    callbacks.onChange(newState);
    renderTravellerSelectorPopover(newState, callbacks, containerId);
  };

  container.querySelector('#btn-dec-adults')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.adults > 1) {
      const newAdults = state.adults - 1;
      const newInfants = Math.min(state.infants, newAdults);
      updateAndRerender({ ...state, adults: newAdults, infants: newInfants });
    }
  });

  container.querySelector('#btn-inc-adults')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (total < 9) {
      updateAndRerender({ ...state, adults: state.adults + 1 });
    }
  });

  container.querySelector('#btn-dec-children')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.children > 0) {
      updateAndRerender({ ...state, children: state.children - 1 });
    }
  });

  container.querySelector('#btn-inc-children')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (total < 9) {
      updateAndRerender({ ...state, children: state.children + 1 });
    }
  });

  container.querySelector('#btn-dec-infants')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.infants > 0) {
      updateAndRerender({ ...state, infants: state.infants - 1 });
    }
  });

  container.querySelector('#btn-inc-infants')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.infants < state.adults && total < 9) {
      updateAndRerender({ ...state, infants: state.infants + 1 });
    }
  });

  // Wire Cabin buttons
  container.querySelectorAll<HTMLButtonElement>('button[data-cabin]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cabin = btn.getAttribute('data-cabin') as FlightCabinClass;
      if (cabin) {
        updateAndRerender({ ...state, cabinClass: cabin });
      }
    });
  });

  // Wire Apply button
  container.querySelector('#btn-traveller-apply')?.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onClose?.();
  });
}
