/* ============================================================================
 * Vacatina Travel Operating System — Application Entry Point
 * Authorities:
 * 1. 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
 * 2. Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md
 * 3. 01_PRODUCT_ARCHITECTURE.md
 * 4. 02_API_RESPONSIBILITY_MAP.md
 * 5. 03_FUNCTIONAL_FLOWS.md + 04_DATA_STATE_MODEL.md
 * 6. Stitch Exported Screens (Screen 03–08)
 * 7. 08_STITCH_GENERATED_PRODUCT_BRIEF_REFERENCE.md (Reference Only)
 * ============================================================================ */

import {
  closeDesktopDropdowns,
  closeMobileNavDrawer,
  getAuthState,
  initHeaderAndNavigation,
  isAnyDesktopDropdownOpen,
  isMobileNavOpen,
  setSignedInState
} from '../components/shell/header-nav.ts';
import {
  closeTravellerPopover,
  initSearchCommandCenter,
  isTravellerPopoverOpen
} from '../components/search-command-center/command-center.ts';
import { initDiscoverySections } from '../components/discovery/discovery-controller.ts';
import {
  closeTripBucketDrawer,
  initTripBucketUi,
  isTripBucketDrawerOpen,
  updateTripControlsVisibility
} from '../components/trip-bucket/trip-bucket-ui.ts';
import {
  closeActiveDialog,
  getStoredCookiePreferences,
  initLegalAndCookieInteractions,
  initStaticPackageModalCloseWiring,
  isAnyCustomDialogOpen,
  openLegalAndCookieModal,
  openScreen04StatesModal,
  openTripDossierReviewModal,
  saveCookiePreferences
} from '../components/dialogs/dialogs-controller.ts';
import { initMacroStages } from '../components/trust/macro-stages.ts';
import { tripBucketService } from '../lib/services/trip-bucket.service.ts';
import { favoritesService } from '../lib/services/favorites.service.ts';
import { searchCommandService } from '../lib/services/search.service.ts';
import { localeService } from '../lib/services/locale.service.ts';
import { routerService } from '../lib/services/router.service.ts';
import { SUPPLIER_ADAPTER_REGISTRY } from '../lib/adapters/supplier-adapters.ts';
import { telemetry } from '../lib/analytics/telemetry.ts';
import { refreshServerTripBucket } from '../features/journeys/services/journey-service.ts';
import { initializePlanning } from '../features/enquiries/enquiry-workspace.ts';
import { initializePublicDemo } from '../lib/services/public-demo.service.ts';

export function bootstrapVacatinaApp(): void {
  if (typeof document === 'undefined') return;

  // Canonical URL cleanup: remove utm_source=chatgpt.com without page reload
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('utm_source') === 'chatgpt.com') {
      url.searchParams.delete('utm_source');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch { /* Ignore URL parsing errors */ }

  initializePublicDemo();

  initStaticPackageModalCloseWiring();
  initHeaderAndNavigation();
  initSearchCommandCenter();
  initDiscoverySections();
  initTripBucketUi();
  initMacroStages();
  initLegalAndCookieInteractions();
  routerService.init();
  tripBucketService.replaceCandidates([]);
  void initializePlanning().then(connected => {
    if (connected) {
      // Only the already-rendered review depends on the restored display snapshot.
      // Do not destroy a request/admin form that independently loaded its own server record.
      if (location.pathname === '/trip/review') routerService.navigateTo(location.pathname + location.search, false);
      return;
    }
    if (!(window as any).__VACATINA_PUBLIC_DEMO__) return refreshServerTripBucket();
  }).catch(() => { /* No persistence success is inferred while offline. */ });

  // Global Escape key handler with exact priority & focus restoration
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    if (isTravellerPopoverOpen()) {
      event.preventDefault();
      closeTravellerPopover(true);
      return;
    }

    if (isAnyCustomDialogOpen()) {
      event.preventDefault();
      closeActiveDialog(true);
      return;
    }

    const pkgModal = document.getElementById('holiday-package-details-modal');
    if (pkgModal && !pkgModal.classList.contains('hidden')) {
      event.preventDefault();
      closeActiveDialog(true);
      return;
    }

    if (isTripBucketDrawerOpen()) {
      event.preventDefault();
      closeTripBucketDrawer(true);
      return;
    }

    if (isMobileNavOpen()) {
      event.preventDefault();
      closeMobileNavDrawer(true);
      return;
    }

    if (isAnyDesktopDropdownOpen()) {
      event.preventDefault();
      closeDesktopDropdowns(true);
    }
  });

  // Expose structured runtime handle for automated browser acceptance tests
  const win = window as unknown as Record<string, unknown>;
  win.__VACATINA_ROUTER__ = routerService;
  win.__VACATINA_OS__ = {
    version: '4.2.0-ultra-reconstructed-locked',
    tripBucketService,
    favoritesService,
    searchCommandService,
    localeService,
    routerService,
    getAuthState,
    setSignedInState,
    adapters: SUPPLIER_ADAPTER_REGISTRY,
    telemetry,
    openScreen04StatesModal,
    openTripDossierReviewModal,
    openLegalAndCookieModal,
    getStoredCookiePreferences,
    saveCookiePreferences,
    updateTripControlsVisibility,
    refreshServerTripBucket
  };

  telemetry.track('app_bootstrapped', { version: '4.1.0-ultra-reconstructed-locked' });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapVacatinaApp);
  } else {
    bootstrapVacatinaApp();
  }
}
