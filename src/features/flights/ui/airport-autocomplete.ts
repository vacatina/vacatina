/* ============================================================================
 * Vacatina Accessible Airport Autocomplete Component
 * Authority: VACATINA FLIGHTS — FULL FUNCTIONAL BUILD MASTER WORKLOAD (§8, §39)
 * ============================================================================ */

import type { FlightLocation } from '../domain/flight-models.ts';
import { searchAirports } from '../data/airports.ts';

export interface AirportAutocompleteOptions {
  inputElement: HTMLInputElement;
  containerElement: HTMLElement;
  placeholder?: string;
  onSelect: (location: FlightLocation) => void;
}

export function initAirportAutocomplete(options: AirportAutocompleteOptions): () => void {
  const { inputElement, containerElement, onSelect } = options;

  let activeIndex = -1;
  let currentResults: FlightLocation[] = [];
  let isDropdownOpen = false;

  // Create dropdown element
  const dropdown = document.createElement('div');
  dropdown.className =
    'absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto hidden';
  dropdown.setAttribute('role', 'listbox');
  dropdown.id = `airport-listbox-${Math.random().toString(36).substring(2, 7)}`;
  inputElement.setAttribute('aria-autocomplete', 'list');
  inputElement.setAttribute('aria-controls', dropdown.id);
  inputElement.setAttribute('aria-expanded', 'false');

  containerElement.style.position = 'relative';
  containerElement.appendChild(dropdown);

  const renderResults = (results: FlightLocation[]) => {
    currentResults = results;
    activeIndex = -1;

    if (results.length === 0) {
      dropdown.innerHTML = `
        <div class="px-4 py-3 text-xs text-brand-muted text-center">
          No matching airports found. Try city name or 3-letter IATA code.
        </div>
      `;
      dropdown.classList.remove('hidden');
      inputElement.setAttribute('aria-expanded', 'true');
      isDropdownOpen = true;
      return;
    }

    dropdown.innerHTML = results
      .map(
        (loc, idx) => `
        <div 
          role="option" 
          id="${dropdown.id}-opt-${idx}" 
          data-idx="${idx}"
          aria-selected="false"
          class="airport-option px-3.5 py-2.5 flex items-center justify-between border-b border-gray-50 last:border-b-0 cursor-pointer hover:bg-brand-primary/5 transition-colors"
        >
          <div class="flex items-center gap-2.5">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-xs tracking-wider">
              ${loc.airportCode}
            </span>
            <div>
              <div class="text-sm font-semibold text-brand-dark">${loc.city}, ${loc.country}</div>
              <div class="text-xs text-brand-muted truncate max-w-[200px] sm:max-w-xs">${loc.airportName}</div>
            </div>
          </div>
          <span class="text-xs font-mono text-gray-400 uppercase tracking-widest hidden sm:inline">${loc.countryCode}</span>
        </div>
      `
      )
      .join('');

    dropdown.classList.remove('hidden');
    inputElement.setAttribute('aria-expanded', 'true');
    isDropdownOpen = true;

    // Attach click events
    dropdown.querySelectorAll<HTMLElement>('.airport-option').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        selectLocation(currentResults[idx]);
      });
    });
  };

  const closeDropdown = () => {
    dropdown.classList.add('hidden');
    inputElement.setAttribute('aria-expanded', 'false');
    isDropdownOpen = false;
    activeIndex = -1;
  };

  const selectLocation = (loc: FlightLocation) => {
    inputElement.value = `${loc.city} (${loc.airportCode}) — ${loc.airportName}`;
    closeDropdown();
    onSelect(loc);
  };

  const updateActiveOption = () => {
    const options = dropdown.querySelectorAll<HTMLElement>('.airport-option');
    options.forEach((opt, i) => {
      if (i === activeIndex) {
        opt.classList.add('bg-brand-primary/10');
        opt.setAttribute('aria-selected', 'true');
        inputElement.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('bg-brand-primary/10');
        opt.setAttribute('aria-selected', 'false');
      }
    });
  };

  // Input event handler
  let debounceTimer: number;
  inputElement.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const q = inputElement.value.trim();
      const results = searchAirports(q);
      renderResults(results);
    }, 150);
  });

  inputElement.addEventListener('focus', () => {
    const q = inputElement.value.trim();
    const results = searchAirports(q);
    renderResults(results);
  });

  // Keyboard navigation
  inputElement.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        renderResults(searchAirports(inputElement.value.trim()));
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentResults.length;
      updateActiveOption();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? currentResults.length - 1 : activeIndex - 1;
      updateActiveOption();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < currentResults.length) {
        selectLocation(currentResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  });

  // Click outside listener
  const handleDocumentClick = (e: MouseEvent) => {
    if (!containerElement.contains(e.target as Node)) {
      closeDropdown();
    }
  };
  document.addEventListener('click', handleDocumentClick);

  return () => {
    document.removeEventListener('click', handleDocumentClick);
    dropdown.remove();
  };
}
