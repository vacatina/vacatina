/* ============================================================================
 * Vacatina Accessible Visa Country Autocomplete Component
 * Authority: VACATINA MASTER PRODUCT & ENGINEERING ROADMAP v2.0 (Phase 3.3)
 * ============================================================================ */

import type { VisaDestinationItem } from '../data/destinations.ts';
import { POPULAR_VISA_DESTINATIONS } from '../data/destinations.ts';

export interface VisaCountryAutocompleteOptions {
  inputElement: HTMLInputElement;
  containerElement: HTMLElement;
  placeholder?: string;
  onSelect: (destination: VisaDestinationItem) => void;
}

export function initVisaCountryAutocomplete(options: VisaCountryAutocompleteOptions): () => void {
  const { inputElement, containerElement, onSelect } = options;

  let activeIndex = -1;
  let currentResults: VisaDestinationItem[] = [];
  let isDropdownOpen = false;

  const dropdown = document.createElement('div');
  dropdown.className =
    'absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto hidden';
  dropdown.setAttribute('role', 'listbox');
  dropdown.id = `visa-country-listbox-${Math.random().toString(36).substring(2, 7)}`;
  inputElement.setAttribute('aria-autocomplete', 'list');
  inputElement.setAttribute('aria-controls', dropdown.id);
  inputElement.setAttribute('aria-expanded', 'false');

  containerElement.style.position = 'relative';
  containerElement.appendChild(dropdown);

  const filterCountries = (query: string): VisaDestinationItem[] => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR_VISA_DESTINATIONS.slice(0, 7);
    return POPULAR_VISA_DESTINATIONS.filter(
      d =>
        d.countryName.toLowerCase().includes(q) ||
        d.countryCode.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.popularFor.toLowerCase().includes(q)
    );
  };

  const renderResults = (results: VisaDestinationItem[]) => {
    currentResults = results;
    activeIndex = -1;

    if (results.length === 0) {
      dropdown.innerHTML = `
        <div class="px-4 py-3 text-xs text-brand-muted text-center">
          No matching countries found in consular catalog. Try UAE, UK, Singapore, India, France.
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
          class="visa-country-option px-3.5 py-2.5 flex items-center justify-between border-b border-gray-50 last:border-b-0 cursor-pointer hover:bg-brand-primary/5 transition-colors"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-xl shrink-0" aria-hidden="true">${dest.flagEmoji}</span>
            <div class="min-w-0">
              <div class="font-semibold text-xs text-brand-black truncate">${dest.countryName}</div>
              <div class="text-[10px] text-brand-muted truncate">${dest.region} · Demo catalog reference</div>
            </div>
          </div>
          <span class="text-[10px] font-semibold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded-full shrink-0">
            Review required
          </span>
        </div>
      `
      )
      .join('');

    dropdown.classList.remove('hidden');
    inputElement.setAttribute('aria-expanded', 'true');
    isDropdownOpen = true;

    // Attach click listeners
    dropdown.querySelectorAll('.visa-country-option').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
        selectOption(idx);
      });
    });
  };

  const selectOption = (idx: number) => {
    const dest = currentResults[idx];
    if (!dest) return;
    inputElement.value = dest.countryName;
    closeDropdown();
    onSelect(dest);
  };

  const closeDropdown = () => {
    dropdown.classList.add('hidden');
    inputElement.setAttribute('aria-expanded', 'false');
    isDropdownOpen = false;
    activeIndex = -1;
  };

  const onInput = () => {
    renderResults(filterCountries(inputElement.value));
  };

  const onFocus = () => {
    renderResults(filterCountries(inputElement.value));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        renderResults(filterCountries(inputElement.value));
        e.preventDefault();
      }
      return;
    }

    const options = dropdown.querySelectorAll('.visa-country-option');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentResults.length;
      updateActiveOption(options);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
      updateActiveOption(options);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < currentResults.length) {
        selectOption(activeIndex);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  };

  const updateActiveOption = (options: NodeListOf<Element>) => {
    options.forEach((opt, idx) => {
      if (idx === activeIndex) {
        opt.classList.add('bg-brand-primary/10');
        opt.setAttribute('aria-selected', 'true');
        (opt as HTMLElement).scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('bg-brand-primary/10');
        opt.setAttribute('aria-selected', 'false');
      }
    });
  };

  const onDocumentClick = (e: MouseEvent) => {
    if (!containerElement.contains(e.target as Node)) {
      closeDropdown();
    }
  };

  inputElement.addEventListener('input', onInput);
  inputElement.addEventListener('focus', onFocus);
  inputElement.addEventListener('keydown', onKeyDown);
  document.addEventListener('click', onDocumentClick);

  return () => {
    inputElement.removeEventListener('input', onInput);
    inputElement.removeEventListener('focus', onFocus);
    inputElement.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onDocumentClick);
    dropdown.remove();
  };
}
