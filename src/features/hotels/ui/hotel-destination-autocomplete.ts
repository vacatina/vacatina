/* ============================================================================
 * Vacatina Accessible Hotel Destination Autocomplete Component
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.2)
 * ============================================================================ */

import type { HotelDestination } from '../data/destinations.ts';
import { searchDestinations } from '../data/destinations.ts';

export interface HotelDestinationAutocompleteOptions {
  inputElement: HTMLInputElement;
  containerElement: HTMLElement;
  placeholder?: string;
  onSelect: (destination: HotelDestination) => void;
}

export function initHotelDestinationAutocomplete(options: HotelDestinationAutocompleteOptions): () => void {
  const { inputElement, containerElement, onSelect } = options;

  let activeIndex = -1;
  let currentResults: HotelDestination[] = [];
  let isDropdownOpen = false;

  const dropdown = document.createElement('div');
  dropdown.className =
    'absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto hidden';
  dropdown.setAttribute('role', 'listbox');
  dropdown.id = `hotel-dest-listbox-${Math.random().toString(36).substring(2, 7)}`;
  inputElement.setAttribute('aria-autocomplete', 'list');
  inputElement.setAttribute('aria-controls', dropdown.id);
  inputElement.setAttribute('aria-expanded', 'false');

  containerElement.style.position = 'relative';
  containerElement.appendChild(dropdown);

  const renderResults = (results: HotelDestination[]) => {
    currentResults = results;
    activeIndex = -1;

    if (results.length === 0) {
      dropdown.innerHTML = `
        <div class="px-4 py-3 text-xs text-brand-muted text-center">
          No matching destinations found. Try city, resort region, or country.
        </div>
      `;
      dropdown.classList.remove('hidden');
      inputElement.setAttribute('aria-expanded', 'true');
      isDropdownOpen = true;
      return;
    }

    dropdown.innerHTML = results
      .map(
        (dest, idx) => `
        <div 
          role="option" 
          id="${dropdown.id}-opt-${idx}" 
          data-idx="${idx}"
          aria-selected="false"
          class="hotel-dest-option px-3.5 py-2.5 flex items-center justify-between border-b border-gray-50 last:border-b-0 cursor-pointer hover:bg-brand-primary/5 transition-colors"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center text-sm font-bold shrink-0">
              📍
            </span>
            <div class="truncate text-left">
              <div class="font-bold text-xs text-brand-black truncate">${dest.name}</div>
              <div class="text-[11px] text-brand-muted truncate">${dest.highlightTag}</div>
            </div>
          </div>
          <span class="text-[10px] font-semibold text-brand-primary/80 bg-brand-primary/5 px-2 py-0.5 rounded-full shrink-0">
            ${dest.popularPropertyCount} stays
          </span>
        </div>
      `
      )
      .join('');

    dropdown.classList.remove('hidden');
    inputElement.setAttribute('aria-expanded', 'true');
    isDropdownOpen = true;

    // Attach click listeners
    const optionsEls = dropdown.querySelectorAll<HTMLElement>('.hotel-dest-option');
    optionsEls.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        selectOption(idx);
      });
    });
  };

  const selectOption = (index: number) => {
    if (index >= 0 && index < currentResults.length) {
      const dest = currentResults[index];
      inputElement.value = dest.name;
      closeDropdown();
      onSelect(dest);
    }
  };

  const closeDropdown = () => {
    dropdown.classList.add('hidden');
    inputElement.setAttribute('aria-expanded', 'false');
    isDropdownOpen = false;
    activeIndex = -1;
  };

  const handleInput = () => {
    const query = inputElement.value;
    const matches = searchDestinations(query);
    renderResults(matches);
  };

  const handleFocus = () => {
    const matches = searchDestinations(inputElement.value);
    renderResults(matches);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        handleFocus();
        return;
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentResults.length;
      updateActiveHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
      updateActiveHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) selectOption(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  };

  const updateActiveHighlight = () => {
    const optionsEls = dropdown.querySelectorAll<HTMLElement>('.hotel-dest-option');
    optionsEls.forEach((el, idx) => {
      if (idx === activeIndex) {
        el.classList.add('bg-brand-primary/10');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('bg-brand-primary/10');
        el.setAttribute('aria-selected', 'false');
      }
    });
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (!containerElement.contains(e.target as Node)) {
      closeDropdown();
    }
  };

  inputElement.addEventListener('input', handleInput);
  inputElement.addEventListener('focus', handleFocus);
  inputElement.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleOutsideClick);

  return () => {
    inputElement.removeEventListener('input', handleInput);
    inputElement.removeEventListener('focus', handleFocus);
    inputElement.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleOutsideClick);
    dropdown.remove();
  };
}
