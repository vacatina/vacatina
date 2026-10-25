/* ============================================================================
 * Vacatina Global Header, Navigation, Locale Switcher, Auth & Mobile Drawer
 * Authorities:
 * - ANTIGRAVITY ULTRA MASTER INSTRUCTION (§11–§41)
 * - 01_PRODUCT_ARCHITECTURE.md (1440px breakpoint, More 5-item menu)
 * - Screen 03 Foundation v1.1 Locked (Recovered SVG Globe Locale Menu, Signed-In
 *   Alex M. Account Menu, and Complete Mobile Drawer with Quick Actions & Locale)
 * ============================================================================ */

import type {
  CommandCenterTabId,
  SupportedCurrency,
  SupportedLanguage
} from '../../lib/domain/types.ts';
import { favoritesService } from '../../lib/services/favorites.service.ts';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  localeService
} from '../../lib/services/locale.service.ts';
import { tripBucketService } from '../../lib/services/trip-bucket.service.ts';
import { routerService } from '../../lib/services/router.service.ts';
import { telemetry } from '../../lib/analytics/telemetry.ts';
import {
  VacatinaLogoFull,
  VacatinaLogoResponsive,
  VacatinaMark,
  renderSvgGlobeIcon
} from '../brand/vacatina-logo.ts';
import {
  activateFocusTrap,
  deactivateFocusTrap,
  getFocusableElements,
  setBackgroundInert,
  showToast
} from '../ui/toast.ts';
import {
  closeActiveDialog,
  isAnyCustomDialogOpen,
  openInfoOrSupportModal,
  openSavedFavoritesDrawer
} from '../dialogs/dialogs-controller.ts';
import {
  closeTripBucketDrawer,
  isTripBucketDrawerOpen,
  openTripBucketDrawer
} from '../trip-bucket/trip-bucket-ui.ts';

const NAV_TEXT_TO_TAB_AND_SECTION: Record<
  string,
  { tab: CommandCenterTabId; sectionId: string }
> = {
  'build your bundle': { tab: 'bundle', sectionId: 'search-command-center' },
  flights: { tab: 'flights', sectionId: 'popular-flights-section' },
  hotels: { tab: 'hotels', sectionId: 'recommended-hotels-section' },
  'visa assistance': { tab: 'visa', sectionId: 'visa-assistance-section' },
  'holiday packages': { tab: 'packages', sectionId: 'holiday-packages-section' },
  'cars & transfers': { tab: 'cars', sectionId: 'cars-transfers-section' },
  activities: { tab: 'activities', sectionId: 'popular-activities-section' },
  'sightseeing tours': { tab: 'sightseeing', sectionId: 'sightseeing-tours-section' },
  rails: { tab: 'rails', sectionId: 'rail-journeys-section' },
  cruises: { tab: 'cruises', sectionId: 'cruises-section' },
  'travel insurance': { tab: 'insurance', sectionId: 'travel-insurance-section' }
};

export interface AuthSessionState {
  isSignedIn: boolean;
  name: string;
  shortName: string;
  initials: string;
  email: string;
  roleLabel: string;
}

let authState: AuthSessionState = {
  isSignedIn: false,
  name: '',
  shortName: '',
  initials: '',
  email: '',
  roleLabel: ''
};

let activeDesktopDropdownTrigger: HTMLElement | null = null;

export function getAuthState(): AuthSessionState {
  return { ...authState };
}

export function setSignedInState(signedIn: boolean, announce = true): void {
  authState.isSignedIn = signedIn;
  if (signedIn) {
    authState.name = 'Alex Morgan';
    authState.shortName = 'Alex M.';
    authState.initials = 'AM';
    authState.email = 'alex.morgan@example.com';
    authState.roleLabel = 'Verified B2C Traveller';
  } else {
    authState.name = '';
    authState.shortName = '';
    authState.initials = '';
    authState.email = '';
    authState.roleLabel = '';
  }
  syncAuthUiAcrossShell();
  telemetry.track('auth_state_changed', { isSignedIn: signedIn });
  if (announce) {
    showToast(
      signedIn
        ? `Signed in as ${authState.name} (${authState.email}).`
        : 'Signed out of Vacatina account. Session switched to Guest mode.',
      signedIn ? 'success' : 'brand'
    );
  }
}

export function closeDesktopDropdowns(returnFocus = false): void {
  const menus = [
    { btn: 'more-dropdown-btn', menu: 'more-dropdown-menu' },
    { btn: 'resources-dropdown-btn', menu: 'resources-dropdown-menu' },
    { btn: 'header-locale-btn', menu: 'locale-dropdown-menu' },
    { btn: 'signed-in-user-btn', menu: 'user-account-dropdown' }
  ];

  menus.forEach(({ btn, menu }) => {
    const b = document.getElementById(btn);
    const m = document.getElementById(menu);
    if (m) m.classList.add('hidden');
    if (b) b.setAttribute('aria-expanded', 'false');
  });

  const focusTarget = activeDesktopDropdownTrigger;
  activeDesktopDropdownTrigger = null;

  if (returnFocus && focusTarget) {
    focusTarget.focus();
  }
}

export function isAnyDesktopDropdownOpen(): boolean {
  const menuIds = [
    'more-dropdown-menu',
    'resources-dropdown-menu',
    'locale-dropdown-menu',
    'user-account-dropdown'
  ];
  return menuIds.some(id => {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden'));
  });
}

export function isMobileNavOpen(): boolean {
  const mobileContainer = document.getElementById('mobile-nav-drawer-container');
  return Boolean(mobileContainer && !mobileContainer.classList.contains('hidden'));
}

export function closeMobileNavDrawer(returnFocus = true): void {
  const mobileContainer = document.getElementById('mobile-nav-drawer-container');
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobileMoreToggle = document.getElementById('mobile-more-toggle');
  const mobileMoreSubmenu = document.getElementById('mobile-more-submenu');
  const mobileResourcesToggle = document.getElementById('mobile-resources-toggle');
  const mobileResourcesSubmenu = document.getElementById('mobile-resources-submenu');

  if (!mobileContainer || mobileContainer.classList.contains('hidden')) return;

  mobileContainer.setAttribute('aria-hidden', 'true');
  mobileContainer.classList.add('hidden');
  deactivateFocusTrap(mobileContainer);

  if (mobileMoreSubmenu) mobileMoreSubmenu.classList.add('hidden');
  if (mobileMoreToggle) mobileMoreToggle.setAttribute('aria-expanded', 'false');
  if (mobileResourcesSubmenu) mobileResourcesSubmenu.classList.add('hidden');
  if (mobileResourcesToggle) mobileResourcesToggle.setAttribute('aria-expanded', 'false');

  setBackgroundInert(false);

  if (mobileToggle) {
    mobileToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) mobileToggle.focus();
  }
}

export function initHeaderAndNavigation(): void {
  upgradeBrandMarksInShell();

  const moreBtn = document.getElementById('more-dropdown-btn');
  const moreMenu = document.getElementById('more-dropdown-menu');
  const resBtn = document.getElementById('resources-dropdown-btn');
  const resMenu = document.getElementById('resources-dropdown-menu');

  const toggleDropdown = (button: HTMLElement | null, menu: HTMLElement | null) => {
    if (!button || !menu) return;
    const wasOpen = !menu.classList.contains('hidden');
    closeDesktopDropdowns(false);
    if (!wasOpen) {
      menu.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
      activeDesktopDropdownTrigger = button;
    }
  };

  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleDropdown(moreBtn, moreMenu);
    });
  }

  if (resBtn && resMenu) {
    resBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleDropdown(resBtn, resMenu);
    });
  }

  // Enhance SVG Globe Locale/Currency selector, Saved Favorites, and Guest/Signed-In Auth Cluster
  initHeaderUtilitiesCluster();

  // Upgrade & wire Mobile Navigation Drawer (Screen 03 Foundation v1.1 Recovery)
  upgradeAndInitMobileNavigationDrawer();

  // Wire Desktop, Mobile, and Footer Navigation links
  initNavigationLinkRouting();

  // Initialize document locale & price conversion
  localeService.applyDocumentLocaleAttributes();
  localeService.tagAndConvertDiscoveryPrices();

  // Outside click closes desktop dropdowns
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      !target.closest('#more-dropdown-container') &&
      !target.closest('#resources-dropdown-container') &&
      !target.closest('#locale-dropdown-wrapper') &&
      !target.closest('#signed-in-user-menu')
    ) {
      closeDesktopDropdowns(false);
    }
  });
}

function upgradeBrandMarksInShell(): void {
  const headerLogoLink = document.querySelector<HTMLAnchorElement>(
    '#site-header a[aria-label="Vacatina Homepage"]'
  );
  if (headerLogoLink) {
    headerLogoLink.innerHTML = VacatinaLogoResponsive({ surface: 'light' });
  }

  const footerLogoWrap =
    document.querySelector<HTMLElement>('footer #footer-brand-logo') ||
    document.querySelector<HTMLElement>('footer .flex.items-center.gap-2') ||
    document.querySelector<HTMLElement>('footer .flex.items-center.gap-2\\.5.mb-4');
  if (footerLogoWrap) {
    footerLogoWrap.innerHTML = VacatinaLogoFull({ surface: 'dark' });
  }
}

function initHeaderUtilitiesCluster(): void {
  const header = document.getElementById('site-header');
  if (!header) return;

  // 1. SVG Globe Language & Currency Selector (§33–§41 — Replaces emoji 🌐)
  const localeBtn =
    (document.getElementById('header-locale-btn') as HTMLButtonElement | null) ||
    header.querySelector<HTMLButtonElement>('button[aria-label*="Language"]');

  if (localeBtn) {
    localeBtn.id = 'header-locale-btn';
    localeBtn.setAttribute('aria-expanded', 'false');
    localeBtn.setAttribute('aria-haspopup', 'dialog');
    localeBtn.className =
      'hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-brand-black hover:text-brand-primary px-2.5 py-2 rounded-lg hover:bg-brand-subtle transition-colors touch-target-44';

    let wrapper = document.getElementById('locale-dropdown-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'locale-dropdown-wrapper';
      wrapper.className = 'relative hidden sm:block';
      localeBtn.parentNode?.insertBefore(wrapper, localeBtn);
      wrapper.appendChild(localeBtn);
    }

    const renderLocaleButtonContent = () => {
      const { language, currency } = localeService.getState();
      localeBtn.setAttribute(
        'aria-label',
        `Language and Currency Selector: ${language} and ${currency}`
      );
      localeBtn.innerHTML = `
        ${renderSvgGlobeIcon('w-4 h-4 text-brand-primary shrink-0')}
        <span id="current-locale-display" class="tabular-nums font-semibold">${language} · ${currency}</span>
        <svg class="w-3.5 h-3.5 text-brand-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      `;
    };
    renderLocaleButtonContent();

    let menu = document.getElementById('locale-dropdown-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'locale-dropdown-menu';
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', 'Select Language and Display Currency');
      menu.className = 'hidden absolute right-0 top-full w-[340px] sm:w-[400px] pt-2 z-50';
      wrapper.appendChild(menu);
    }

    const renderLocalePopover = (filterQuery = '') => {
      const { language, currency } = localeService.getState();
      const q = filterQuery.trim().toLowerCase();

      const filteredLangs = SUPPORTED_LANGUAGES.filter(
        l =>
          !q ||
          l.name.toLowerCase().includes(q) ||
          l.nativeName.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q)
      );
      const filteredCurrs = SUPPORTED_CURRENCIES.filter(
        c =>
          !q ||
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      );

      menu!.innerHTML = `
        <div class="bg-white border border-brand-border rounded-2xl shadow-2xl p-4 space-y-3.5 text-xs">
          <div class="flex items-center justify-between border-b border-brand-border pb-2.5">
            <div class="flex items-center gap-2">
              ${renderSvgGlobeIcon('w-4 h-4 text-brand-primary')}
              <span class="font-heading font-bold text-sm text-brand-black">Language &amp; Currency</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0EFFC] text-brand-primary tabular-nums">${language} · ${currency}</span>
          </div>

          <!-- Search Filter -->
          <div>
            <label for="locale-search-input" class="sr-only">Search language or currency</label>
            <input
              id="locale-search-input"
              type="search"
              value="${filterQuery}"
              placeholder="Search language (English, සිංහල, தமிழ்) or currency (LKR, USD, AED)…"
              class="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-brand-border bg-brand-canvas text-xs text-brand-black focus:bg-white"
            >
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
            <!-- Language Column -->
            <div>
              <div class="px-1.5 py-1 text-[10px] font-bold text-brand-muted uppercase tracking-wider">Language</div>
              <div class="space-y-1">
                ${filteredLangs
                  .map(
                    l => `
                  <button
                    type="button"
                    data-select-language="${l.code}"
                    aria-pressed="${l.code === language ? 'true' : 'false'}"
                    class="w-full text-left px-2.5 py-2 rounded-xl font-medium transition-colors flex items-center justify-between gap-1 ${
                      l.code === language
                        ? 'bg-[#F0EFFC] text-brand-primary font-bold border border-[#C7C3F4]'
                        : 'hover:bg-brand-subtle text-brand-black'
                    }"
                  >
                    <div class="truncate min-w-0 pr-1">
                      <div class="truncate text-xs">${l.nativeName} <span class="text-[10px] text-brand-muted">(${l.code})</span></div>
                      <div class="text-[9.5px] text-brand-muted truncate">${l.regionHint}</div>
                    </div>
                    ${l.code === language ? '<span class="text-brand-primary font-bold shrink-0">✓</span>' : ''}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Currency Column -->
            <div>
              <div class="px-1.5 py-1 text-[10px] font-bold text-brand-muted uppercase tracking-wider">Display Currency</div>
              <div class="space-y-1">
                ${filteredCurrs
                  .map(
                    c => `
                  <button
                    type="button"
                    data-select-currency="${c.code}"
                    aria-pressed="${c.code === currency ? 'true' : 'false'}"
                    class="w-full text-left px-2.5 py-2 rounded-xl font-medium transition-colors flex items-center justify-between gap-1 ${
                      c.code === currency
                        ? 'bg-[#F0EFFC] text-brand-primary font-bold border border-[#C7C3F4]'
                        : 'hover:bg-brand-subtle text-brand-black'
                    }"
                  >
                    <span class="truncate"><strong class="tabular-nums">${c.code}</strong> · ${c.name}</span>
                    ${c.code === currency ? '<span class="text-brand-primary font-bold">✓</span>' : ''}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="pt-2.5 border-t border-brand-border text-[10px] text-brand-muted flex items-center justify-between gap-2">
            <span>Converted estimates · Final settlement shown before payment.</span>
          </div>
        </div>
      `;

      const searchInput = menu!.querySelector<HTMLInputElement>('#locale-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', e => {
          const val = (e.target as HTMLInputElement).value;
          const pos = searchInput.selectionStart || val.length;
          renderLocalePopover(val);
          const nextInput = menu!.querySelector<HTMLInputElement>('#locale-search-input');
          if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(pos, pos);
          }
        });
        searchInput.addEventListener('click', e => e.stopPropagation());
      }

      menu!.querySelectorAll<HTMLButtonElement>('[data-select-language]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.stopPropagation();
          const lang = (btn.getAttribute('data-select-language') || 'EN') as SupportedLanguage;
          localeService.setLanguage(lang);
          renderLocaleButtonContent();
          renderLocalePopover(filterQuery);
          syncMobileLocaleControls();
          const langDesc = localeService.getLanguageDescriptor(lang);
          showToast(`Language updated to ${langDesc.name} (${langDesc.nativeName}).`, 'brand');
        });
      });

      menu!.querySelectorAll<HTMLButtonElement>('[data-select-currency]').forEach(btn => {
        btn.addEventListener('click', event => {
          event.stopPropagation();
          const curr = (btn.getAttribute('data-select-currency') || 'LKR') as SupportedCurrency;
          localeService.setCurrency(curr);
          renderLocaleButtonContent();
          closeDesktopDropdowns(true);
          syncMobileLocaleControls();
          showToast(`Active display currency updated to ${curr}.`, 'brand');
        });
      });
    };

    renderLocalePopover();

    localeBtn.addEventListener('click', event => {
      event.stopPropagation();
      const wasOpen = !menu!.classList.contains('hidden');
      closeDesktopDropdowns(false);
      if (!wasOpen) {
        renderLocalePopover();
        menu!.classList.remove('hidden');
        localeBtn.setAttribute('aria-expanded', 'true');
        activeDesktopDropdownTrigger = localeBtn;
      }
    });

    localeService.subscribe(() => {
      renderLocaleButtonContent();
      syncMobileLocaleControls();
    });
  }

  // 2. Saved Favorites button in Header
  const favBtn = header.querySelector<HTMLButtonElement>('button[aria-label="Saved Favorites"]');
  if (favBtn) {
    favBtn.id = 'header-favorites-btn';
    favBtn.classList.add('relative');

    let badge = document.getElementById('header-favorites-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'header-favorites-count';
      badge.className =
        'hidden ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#F0EFFC] text-brand-primary border border-[#C7C3F4] rounded-full tabular-nums';
      favBtn.appendChild(badge);
    }

    favoritesService.subscribe(favs => {
      badge!.textContent = String(favs.length);
      badge!.classList.toggle('hidden', favs.length === 0);
      const mobFavBadge = document.getElementById('mobile-favorites-count');
      if (mobFavBadge) {
        mobFavBadge.textContent = String(favs.length);
      }
    });

    favBtn.addEventListener('click', () => {
      openSavedFavoritesDrawer(favBtn);
    });
  }

  // 3. Guest vs. Signed-In Account Controls (Screen 03 Foundation v1.1 Recovery)
  initHeaderAuthCluster(header);
}

function initHeaderAuthCluster(header: HTMLElement): void {
  const signInLink = Array.from(header.querySelectorAll<HTMLElement>('a, button')).find(
    el => (el.textContent || '').trim() === 'Sign In'
  );
  const signUpLink = Array.from(header.querySelectorAll<HTMLElement>('a, button')).find(
    el => (el.textContent || '').trim() === 'Sign Up'
  );

  if (signInLink && signUpLink && signInLink.parentElement) {
    const parent = signInLink.parentElement;

    // Wrap guest buttons in #guest-state-controls
    let guestWrap = document.getElementById('guest-state-controls');
    if (!guestWrap) {
      guestWrap = document.createElement('div');
      guestWrap.id = 'guest-state-controls';
      guestWrap.className = 'hidden sm:flex items-center gap-1.5';
      parent.insertBefore(guestWrap, signInLink);
      guestWrap.appendChild(signInLink);
      guestWrap.appendChild(signUpLink);
    }

    signInLink.id = 'header-sign-in-btn';
    signUpLink.id = 'header-sign-up-btn';

    [signInLink, signUpLink].forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        openAuthModal((btn.textContent || 'Sign In').trim(), btn);
      });
    });

    // Create Signed-In User Menu (#signed-in-user-menu) from Screen 03 Foundation v1.1
    let signedInWrap = document.getElementById('signed-in-user-menu');
    if (!signedInWrap) {
      signedInWrap = document.createElement('div');
      signedInWrap.id = 'signed-in-user-menu';
      signedInWrap.className = 'hidden relative';
      signedInWrap.innerHTML = `
        <button
          type="button"
          id="signed-in-user-btn"
          aria-expanded="false"
          aria-haspopup="true"
          class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-brand-border bg-white hover:border-brand-primary text-xs font-semibold text-brand-black transition-colors touch-target-44"
        >
          <span class="w-7 h-7 rounded-full bg-brand-primary text-white font-bold text-[11px] inline-flex items-center justify-center">${authState.initials}</span>
          <span class="hidden md:inline">${authState.shortName}</span>
          <svg class="w-3.5 h-3.5 text-brand-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div id="user-account-dropdown" class="hidden absolute right-0 top-full w-64 pt-2 z-50">
          <div class="bg-white border border-brand-border rounded-2xl shadow-xl p-2 text-xs">
            <div class="px-3 py-2.5 border-b border-brand-border mb-1">
              <div class="font-heading font-bold text-sm text-brand-black">${authState.name}</div>
              <div class="text-[11px] text-brand-muted truncate">${authState.email}</div>
              <span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0EFFC] text-brand-primary">${authState.roleLabel}</span>
            </div>
            <button type="button" data-account-action="My Trips" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle flex items-center justify-between">
              <span>My Trips &amp; Bookings</span>
              <span class="text-[10px] text-brand-muted">Active</span>
            </button>
            <button type="button" data-account-action="Visa Applications" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle flex items-center justify-between">
              <span>Visa Applications</span>
              <span class="text-[10px] font-bold text-[#B45309]">1 Pending</span>
            </button>
            <button type="button" data-account-action="Saved Favorites" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle flex items-center justify-between">
              <span>Saved / Favorites</span>
              <span id="account-menu-fav-count" class="text-[10px] font-bold text-brand-primary tabular-nums">0</span>
            </button>
            <button type="button" data-account-action="Trip Bucket" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle flex items-center justify-between">
              <span>Trip Bucket</span>
              <span id="account-menu-bucket-count" class="text-[10px] font-bold text-brand-primary tabular-nums">3</span>
            </button>
            <button type="button" data-account-action="Profile & Travelers" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle">
              Profile &amp; Co-Travelers
            </button>
            <button type="button" data-account-action="Preferences" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle">
              Seat, Meal &amp; Currency Preferences
            </button>
            <button type="button" data-account-action="Help & Support" class="w-full text-left px-3 py-2 rounded-lg font-medium text-brand-black hover:bg-brand-subtle">
              Help &amp; Concierge Support
            </button>
            <div class="border-t border-brand-border mt-1 pt-1">
              <button type="button" id="header-sign-out-btn" class="w-full text-left px-3 py-2 rounded-lg font-semibold text-[#B91C1C] hover:bg-red-50">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      `;
      const container = guestWrap.parentElement || parent;
      container.insertBefore(signedInWrap, guestWrap.nextSibling);

      const userBtn = signedInWrap.querySelector<HTMLButtonElement>('#signed-in-user-btn');
      const userMenu = signedInWrap.querySelector<HTMLElement>('#user-account-dropdown');

      if (userBtn && userMenu) {
        userBtn.addEventListener('click', event => {
          event.stopPropagation();
          const wasOpen = !userMenu.classList.contains('hidden');
          closeDesktopDropdowns(false);
          if (!wasOpen) {
            userMenu.classList.remove('hidden');
            userBtn.setAttribute('aria-expanded', 'true');
            activeDesktopDropdownTrigger = userBtn;
          }
        });
      }

      signedInWrap.querySelectorAll<HTMLButtonElement>('[data-account-action]').forEach(actionBtn => {
        actionBtn.addEventListener('click', () => {
          const action = actionBtn.getAttribute('data-account-action') || 'Account';
          closeDesktopDropdowns(false);
          if (action === 'Saved Favorites') {
            openSavedFavoritesDrawer(userBtn);
            return;
          }
          if (action === 'Trip Bucket') {
            openTripBucketDrawer(userBtn);
            return;
          }
          openInfoOrSupportModal(
            `${action} — ${authState.name}`,
            `Vacatina Account Desk · ${authState.email}`,
            `<p>Viewing <strong>${action}</strong> for <strong>${authState.name}</strong>. Your passport profiles, co-traveller records, and staged Trip Bucket candidates are synchronized.</p>`,
            userBtn
          );
        });
      });

      const signOutBtn = signedInWrap.querySelector('#header-sign-out-btn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
          closeDesktopDropdowns(false);
          setSignedInState(false, true);
        });
      }
    }
  }
}

export function openAuthModal(modeLabel = 'Sign In', trigger?: HTMLElement | null): void {
  openInfoOrSupportModal(
    `${modeLabel} to Vacatina Travel OS`,
    'B2C Traveller Account & Trip Bucket Synchronization',
    `
      <div class="space-y-4 text-xs">
        <p class="text-brand-muted">Sign in to synchronize your Saved Favorites, passport profiles, visa checklists, and multi-product Trip Bucket dossiers across devices.</p>

        <div class="space-y-2.5">
          <div>
            <label for="auth-modal-email" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Email Address</label>
            <input id="auth-modal-email" type="email" placeholder="name@example.com" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black">
          </div>
          <div>
            <label for="auth-modal-password" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Password or One-Time Passcode</label>
            <input id="auth-modal-password" type="password" placeholder="••••••••••••" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black">
          </div>
        </div>

        <div class="pt-2">
          <button
            type="button"
            id="auth-modal-signin-btn"
            onclick="window.__VACATINA_OS__.setSignedInState(true); document.querySelector('[data-dialog-close=true]')?.click();"
            class="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-brand-primary text-white font-semibold whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            ${modeLabel === 'Sign Up' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>
    `,
    trigger
  );
}

function syncAuthUiAcrossShell(): void {
  const guestWrap = document.getElementById('guest-state-controls');
  const signedInWrap = document.getElementById('signed-in-user-menu');
  const mobileBanner = document.getElementById('mobile-nav-user-banner');
  const mobileAuthFooter = document.getElementById('mobile-nav-auth-footer');

  if (guestWrap && signedInWrap) {
    if (authState.isSignedIn) {
      guestWrap.classList.add('hidden');
      guestWrap.classList.remove('sm:flex');
      signedInWrap.classList.remove('hidden');
    } else {
      guestWrap.classList.remove('hidden');
      guestWrap.classList.add('sm:flex');
      signedInWrap.classList.add('hidden');
    }
  }

  if (mobileBanner) {
    if (authState.isSignedIn) {
      mobileBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-full bg-brand-primary text-white font-bold text-sm inline-flex items-center justify-center shrink-0">${authState.initials}</span>
          <div class="min-w-0">
            <div class="font-heading font-bold text-sm text-brand-black truncate">${authState.name}</div>
            <div class="text-[11px] text-brand-muted truncate">${authState.email}</div>
          </div>
        </div>
      `;
    } else {
      mobileBanner.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-heading font-bold text-xs text-brand-black">Welcome to Vacatina</div>
            <div class="text-[11px] text-brand-muted">Sign in to sync your Trip Bucket &amp; Favorites</div>
          </div>
          <button type="button" id="mobile-banner-signin-btn" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-[11px] font-semibold whitespace-nowrap">
            Sign In
          </button>
        </div>
      `;
      const bannerBtn = mobileBanner.querySelector<HTMLButtonElement>('#mobile-banner-signin-btn');
      if (bannerBtn) {
        bannerBtn.addEventListener('click', () => {
          closeMobileNavDrawer(false);
          setSignedInState(true, true);
        });
      }
    }
  }

  if (mobileAuthFooter) {
    if (authState.isSignedIn) {
      mobileAuthFooter.innerHTML = `
        <button type="button" id="mobile-sign-out-btn" class="w-full py-2.5 px-4 rounded-xl border border-red-200 text-center text-xs font-semibold text-[#B91C1C] hover:bg-red-50 touch-target-44">
          Sign Out (${authState.shortName})
        </button>
      `;
      const outBtn = mobileAuthFooter.querySelector('#mobile-sign-out-btn');
      if (outBtn) {
        outBtn.addEventListener('click', () => {
          closeMobileNavDrawer(false);
          setSignedInState(false, true);
        });
      }
    } else {
      mobileAuthFooter.innerHTML = `
        <button type="button" id="mobile-footer-signin-btn" class="w-full py-2.5 px-4 rounded-xl border border-brand-border text-center text-xs font-semibold text-brand-black hover:bg-brand-subtle touch-target-44">
          Sign In
        </button>
        <button type="button" id="mobile-footer-signup-btn" class="w-full py-2.5 px-4 rounded-xl bg-brand-primary text-white text-center text-xs font-semibold hover:opacity-90 touch-target-44">
          Sign Up for Free
        </button>
      `;
      const inBtn = mobileAuthFooter.querySelector<HTMLElement>('#mobile-footer-signin-btn');
      const upBtn = mobileAuthFooter.querySelector<HTMLElement>('#mobile-footer-signup-btn');
      if (inBtn) {
        inBtn.addEventListener('click', () => {
          closeMobileNavDrawer(false);
          openAuthModal('Sign In', document.getElementById('mobile-nav-toggle'));
        });
      }
      if (upBtn) {
        upBtn.addEventListener('click', () => {
          closeMobileNavDrawer(false);
          openAuthModal('Sign Up', document.getElementById('mobile-nav-toggle'));
        });
      }
    }
  }
}

function upgradeAndInitMobileNavigationDrawer(): void {
  const mobileContainer = document.getElementById('mobile-nav-drawer-container');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobileBackdrop = document.getElementById('mobile-nav-backdrop');

  if (!mobileContainer || !mobileDrawer) return;

  // Upgrade #mobile-nav-drawer with full Screen 03 Foundation v1.1 capabilities
  mobileDrawer.innerHTML = `
    <div class="p-4 border-b border-brand-border flex items-center justify-between">
      ${VacatinaMark({ surface: 'light', className: 'h-9 w-9 object-contain' })}
      <button id="mobile-nav-close" type="button" aria-label="Close Navigation Menu" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
      <!-- User Account Banner -->
      <div id="mobile-nav-user-banner" class="p-3.5 rounded-xl bg-[#F0EFFC] border border-[#C7C3F4]"></div>

      <!-- Quick Actions (Trip Bucket & Saved Favorites) -->
      <div id="mobile-quick-actions">
        <div class="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-2 mb-1.5">Quick Actions</div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="mobile-quick-bucket-btn" class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas hover:border-brand-primary flex items-center justify-between text-xs font-semibold text-brand-black touch-target-44">
            <span>Trip Bucket</span>
            <span id="mobile-bucket-count" class="px-2 py-0.5 rounded-full bg-brand-primary text-white text-[10px] font-bold tabular-nums">3</span>
          </button>
          <button type="button" id="mobile-quick-favorites-btn" class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas hover:border-brand-primary flex items-center justify-between text-xs font-semibold text-brand-black touch-target-44">
            <span>Favorites</span>
            <span id="mobile-favorites-count" class="px-2 py-0.5 rounded-full bg-[#F0EFFC] text-brand-primary border border-[#C7C3F4] text-[10px] font-bold tabular-nums">0</span>
          </button>
        </div>
      </div>

      <!-- Services (10 Travel Products) -->
      <div>
        <div class="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-2 mb-1.5">Travel Products &amp; Services</div>
        <div class="space-y-1 font-medium text-brand-black">
          <a href="/" class="block px-3 py-2 rounded-lg bg-brand-subtle text-brand-primary font-semibold">Home</a>
          <a href="/flights" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle">Flights</a>
          <a href="/hotels" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle">Hotels</a>
          <a href="/visa-assistance" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle">Visa Assistance</a>
          <a href="/holiday-packages" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle">Holiday Packages</a>
          <a href="/cars-transfers" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle">Cars &amp; Transfers</a>

          <div class="pt-1 border-t border-brand-border">
            <button id="mobile-more-toggle" type="button" aria-expanded="false" aria-controls="mobile-more-submenu" class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold text-brand-black hover:bg-brand-subtle touch-target-44">
              <span>More Products (5)</span>
              <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="mobile-more-submenu" class="hidden pl-4 pt-1 space-y-1 text-xs text-brand-muted">
              <a href="/activities" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Activities</a>
              <a href="/sightseeing-tours" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Sightseeing Tours</a>
              <a href="/rails" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Rails</a>
              <a href="/cruises" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Cruises</a>
              <a href="/travel-insurance" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Travel Insurance</a>
            </div>
          </div>

          <div class="pt-1 border-t border-brand-border">
            <button id="mobile-resources-toggle" type="button" aria-expanded="false" aria-controls="mobile-resources-submenu" class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold text-brand-black hover:bg-brand-subtle touch-target-44">
              <span>Resources</span>
              <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="mobile-resources-submenu" class="hidden pl-4 pt-1 space-y-1 text-xs text-brand-muted">
              <a href="/resources/travel-notes" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Travel Notes &amp; Blog</a>
              <a href="/resources/destinations" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Destination Guides</a>
              <a href="/resources/seasonal-guide" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Seasonal Travel Guide</a>
              <a href="/resources/visa-requirements" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Visa Requirement Checker</a>
              <a href="/resources/travel-insurance-guide" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Travel Insurance Guide</a>
              <a href="/resources/travel-disruption" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Travel Disruption Guide</a>
              <a href="/resources/trip-bucket-guide" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle hover:text-brand-black">Trip Bucket Guide</a>
              <a href="/resources" class="block px-3 py-2 rounded-lg hover:bg-brand-subtle font-semibold text-brand-primary">View All Resources</a>
            </div>
          </div>
        </div>
      </div>

      <!-- My Account Section (Recovered from Screen 03 Foundation v1.1) -->
      <div id="mobile-account-links" class="pt-2 border-t border-brand-border">
        <div class="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-2 mb-1.5">My Account</div>
        <div class="grid grid-cols-2 gap-1.5 text-xs">
          <button type="button" data-mobile-account="Profile & Travelers" class="text-left px-3 py-2 rounded-lg hover:bg-brand-subtle font-medium text-brand-black">Profile &amp; Travelers</button>
          <button type="button" data-mobile-account="My Trips" class="text-left px-3 py-2 rounded-lg hover:bg-brand-subtle font-medium text-brand-black">My Trips</button>
          <button type="button" data-mobile-account="Visa Applications" class="text-left px-3 py-2 rounded-lg hover:bg-brand-subtle font-medium text-brand-black">Visa Applications</button>
          <button type="button" data-mobile-account="Preferences" class="text-left px-3 py-2 rounded-lg hover:bg-brand-subtle font-medium text-brand-black">Preferences</button>
        </div>
      </div>

      <!-- Language & Currency Controls (Recovered from Screen 03 Foundation v1.1) -->
      <div id="mobile-locale-controls" class="pt-2 border-t border-brand-border space-y-2.5">
        <div>
          <div class="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-1 mb-1">Language</div>
          <div id="mobile-lang-pills" class="flex flex-wrap gap-1.5"></div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-1 mb-1">Currency</div>
          <div id="mobile-curr-pills" class="flex flex-wrap gap-1.5"></div>
        </div>
      </div>
    </div>

    <div id="mobile-nav-auth-footer" class="p-4 border-t border-brand-border space-y-2"></div>
  `;

  syncAuthUiAcrossShell();
  syncMobileLocaleControls();

  tripBucketService.subscribe((_, summary) => {
    const mobCount = document.getElementById('mobile-bucket-count');
    if (mobCount) mobCount.textContent = String(summary.totalItems);
    const accCount = document.getElementById('account-menu-bucket-count');
    if (accCount) accCount.textContent = String(summary.totalItems);
  });

  favoritesService.subscribe(favs => {
    const accFav = document.getElementById('account-menu-fav-count');
    if (accFav) accFav.textContent = String(favs.length);
  });

  const mobileClose = document.getElementById('mobile-nav-close');
  const mobileMoreToggle = document.getElementById('mobile-more-toggle');
  const mobileMoreSubmenu = document.getElementById('mobile-more-submenu');
  const mobileResourcesToggle = document.getElementById('mobile-resources-toggle');
  const mobileResourcesSubmenu = document.getElementById('mobile-resources-submenu');
  const quickBucketBtn = document.getElementById('mobile-quick-bucket-btn');
  const quickFavBtn = document.getElementById('mobile-quick-favorites-btn');

  if (quickBucketBtn) {
    quickBucketBtn.addEventListener('click', () => {
      closeMobileNavDrawer(false);
      openTripBucketDrawer(document.getElementById('header-trip-bucket-btn'));
    });
  }

  if (quickFavBtn) {
    quickFavBtn.addEventListener('click', () => {
      closeMobileNavDrawer(false);
      openSavedFavoritesDrawer(document.getElementById('header-favorites-btn'));
    });
  }

  mobileDrawer.querySelectorAll<HTMLButtonElement>('[data-mobile-account]').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.getAttribute('data-mobile-account') || 'Account';
      closeMobileNavDrawer(false);
      openInfoOrSupportModal(
        label,
        'Vacatina Traveller Account',
        `<p>Opened <strong>${label}</strong> from mobile navigation.</p>`,
        mobileToggle
      );
    });
  });

  const setSubmenu = (btn: HTMLElement | null, menu: HTMLElement | null, open: boolean) => {
    if (!btn || !menu) return;
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      if (isTripBucketDrawerOpen()) closeTripBucketDrawer(false);
      if (isAnyCustomDialogOpen()) closeActiveDialog(false);
      closeDesktopDropdowns(false);

      mobileContainer.classList.remove('hidden');
      mobileContainer.setAttribute('aria-hidden', 'false');
      mobileToggle.setAttribute('aria-expanded', 'true');
      setBackgroundInert(true);
      activateFocusTrap(mobileContainer);

      window.setTimeout(() => {
        if (mobileClose) {
          mobileClose.focus();
        } else {
          const focusables = getFocusableElements(mobileContainer);
          if (focusables.length > 0) focusables[0].focus();
        }
      }, 10);
    });
  }

  if (mobileClose) {
    mobileClose.addEventListener('click', () => closeMobileNavDrawer(true));
  }
  if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', () => closeMobileNavDrawer(true));
  }

  if (mobileMoreToggle && mobileMoreSubmenu) {
    mobileMoreToggle.addEventListener('click', () => {
      const willOpen = mobileMoreSubmenu.classList.contains('hidden');
      setSubmenu(mobileResourcesToggle, mobileResourcesSubmenu, false);
      setSubmenu(mobileMoreToggle, mobileMoreSubmenu, willOpen);
    });
  }

  if (mobileResourcesToggle && mobileResourcesSubmenu) {
    mobileResourcesToggle.addEventListener('click', () => {
      const willOpen = mobileResourcesSubmenu.classList.contains('hidden');
      setSubmenu(mobileMoreToggle, mobileMoreSubmenu, false);
      setSubmenu(mobileResourcesToggle, mobileResourcesSubmenu, willOpen);
    });
  }
}

function syncMobileLocaleControls(): void {
  const langPills = document.getElementById('mobile-lang-pills');
  const currPills = document.getElementById('mobile-curr-pills');
  const { language, currency } = localeService.getState();

  if (langPills) {
    const mobileLangs: SupportedLanguage[] = ['EN', 'SI', 'TA', 'AR'];
    langPills.innerHTML = mobileLangs
      .map(code => {
        const desc = localeService.getLanguageDescriptor(code);
        const active = code === language;
        return `
          <button
            type="button"
            data-mobile-lang="${code}"
            aria-pressed="${active ? 'true' : 'false'}"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              active
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-brand-canvas text-brand-black border-brand-border hover:border-brand-primary'
            }"
          >
            ${desc.nativeName}
          </button>
        `;
      })
      .join('');

    langPills.querySelectorAll<HTMLButtonElement>('[data-mobile-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = (btn.getAttribute('data-mobile-lang') || 'EN') as SupportedLanguage;
        localeService.setLanguage(code);
        showToast(`Language updated to ${localeService.getLanguageDescriptor(code).name}.`, 'brand');
      });
    });
  }

  if (currPills) {
    const mobileCurrs: SupportedCurrency[] = ['LKR', 'USD', 'AED', 'EUR', 'GBP'];
    currPills.innerHTML = mobileCurrs
      .map(code => {
        const active = code === currency;
        return `
          <button
            type="button"
            data-mobile-curr="${code}"
            aria-pressed="${active ? 'true' : 'false'}"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border tabular-nums transition-colors ${
              active
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-brand-canvas text-brand-black border-brand-border hover:border-brand-primary'
            }"
          >
            ${code}
          </button>
        `;
      })
      .join('');

    currPills.querySelectorAll<HTMLButtonElement>('[data-mobile-curr]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = (btn.getAttribute('data-mobile-curr') || 'LKR') as SupportedCurrency;
        localeService.setCurrency(code);
        showToast(`Active display currency updated to ${code}.`, 'brand');
      });
    });
  }
}

function initNavigationLinkRouting(): void {
  const allNavLinks = document.querySelectorAll<HTMLAnchorElement>(
    '#site-header nav a, #mobile-nav-drawer a, footer a'
  );

  allNavLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    if (
      href.startsWith('tel:') ||
      href.startsWith('mailto:') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('#main-content') ||
      href.startsWith('#site-header') ||
      link.hasAttribute('data-legal-modal')
    ) {
      return;
    }

    link.addEventListener('click', event => {
      event.preventDefault();
      closeDesktopDropdowns(false);
      if (isMobileNavOpen()) {
        closeMobileNavDrawer(false);
      }
      routerService.navigateTo(href);
    });
  });
}
