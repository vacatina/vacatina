/* ============================================================================
 * Vacatina Canonical Click-to-Destination Router Service (v1.0)
 * Authorities:
 * - Vacatina — Canonical Click-to-Destination & Resource Architecture v1.0
 * - Rule 1: Non-Negotiable Interaction Rule (zero dead-ends, zero '#' links)
 * - Rule 2: Canonical Customer Journey
 * - Rule 3-16: Locked routes for all 10 products, bundle, resources, auth, and account
 * - Rule 21-25: Canonical 8-item Resources taxonomy and footer architecture
 * ============================================================================ */

import { telemetry } from '../analytics/telemetry.ts';
import { showToast } from '../../components/ui/toast.ts';
import {
  activateSearchTabByDomId,
  highlightSearchPanel
} from '../../components/search-command-center/command-center.ts';
import {
  openHolidayPackageDetailsModal,
  openInfoOrSupportModal,
  openProductConfiguratorModal,
  openSavedFavoritesDrawer,
  openTripDossierReviewModal,
  openSearchResultsModal,
  openFlightOfferModal,
  openHotelPropertyModal,
  openNormalizedOfferModal,
  openPartnerPortalModal,
  openAdminPortalModal,
  closeActiveDialog
} from '../../components/dialogs/dialogs-controller.ts';
import {
  openTripBucketDrawer,
  closeTripBucketDrawer
} from '../../components/trip-bucket/trip-bucket-ui.ts';
import { searchCommandService } from './search.service.ts';
import { tripBucketService } from './trip-bucket.service.ts';
import type { CommandCenterTabId } from '../domain/types.ts';

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

export class CanonicalRouterService {
  private isInitialized = false;

  /**
   * Initializes client routing: intercepts internal link clicks and listens to popstate.
   */
  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Intercept clicks on links
    document.addEventListener('click', this.handleDocumentClick.bind(this));

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.dispatchRoute(window.location.pathname, window.location.search, false);
    });

    // Handle initial route on page load (if not default '/')
    const initialPath = window.location.pathname;
    const initialSearch = window.location.search;
    if (initialPath !== '/' && initialPath !== '/index.html') {
      window.setTimeout(() => {
        this.dispatchRoute(initialPath, initialSearch, false);
      }, 50);
    }
  }

  private handleDocumentClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const link = target.closest('a') as HTMLAnchorElement | null;
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Ignore protocols or page anchor skips
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('tel:') ||
      href.startsWith('mailto:') ||
      href.startsWith('#main-content') ||
      href.startsWith('#site-header')
    ) {
      return;
    }

    // Modal triggers handled via data attributes
    if (link.hasAttribute('data-legal-modal') || link.hasAttribute('data-dialog-close')) {
      return;
    }

    // If link starts with / or is a relative app path, intercept
    if (href.startsWith('/') || href.startsWith('./') || (!href.startsWith('#') && !href.includes(':'))) {
      event.preventDefault();
      this.navigateTo(href);
    }
  }

  /**
   * Navigates to a canonical Vacatina route and dispatches handler.
   */
  public navigateTo(url: string, pushHistory = true): void {
    let cleanUrl = url;
    if (cleanUrl.startsWith('./')) cleanUrl = cleanUrl.replace(/^\.\//, '/');
    if (!cleanUrl.startsWith('/')) cleanUrl = '/' + cleanUrl;

    const urlObj = new URL(cleanUrl, 'https://vacatina.com');
    const path = urlObj.pathname;
    const search = urlObj.search;

    if (pushHistory && typeof window !== 'undefined') {
      window.history.pushState(null, '', path + search);
    }

    this.dispatchRoute(path, search, true);
  }

  /**
   * Main Route Dispatcher according to Master Specification v1.0
   */
  public dispatchRoute(pathname: string, search: string, userInitiated = true): void {
    const query = new URLSearchParams(search);
    const path = pathname.replace(/\/$/, '') || '/';

    telemetry.track('canonical_navigation', { path, search });

    // 1. Homepage / Root
    if (path === '/' || path === '/home' || path === '/index.html') {
      closeActiveDialog(false);
      closeTripBucketDrawer(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Global Product Hubs (Section 3, 7-16)
    const productTabs: Record<string, { tab: CommandCenterTabId; sectionId: string; label: string }> = {
      '/flights': { tab: 'flights', sectionId: 'popular-flights-section', label: 'Flights' },
      '/hotels': { tab: 'hotels', sectionId: 'recommended-hotels-section', label: 'Hotels' },
      '/visa-assistance': { tab: 'visa', sectionId: 'visa-assistance-section', label: 'Visa Assistance' },
      '/holiday-packages': { tab: 'packages', sectionId: 'holiday-packages-section', label: 'Holiday Packages' },
      '/cars-transfers': { tab: 'cars', sectionId: 'cars-transfers-section', label: 'Cars & Transfers' },
      '/activities': { tab: 'activities', sectionId: 'popular-activities-section', label: 'Activities' },
      '/sightseeing-tours': { tab: 'sightseeing', sectionId: 'sightseeing-tours-section', label: 'Sightseeing Tours' },
      '/rails': { tab: 'rails', sectionId: 'rail-journeys-section', label: 'Rails' },
      '/cruises': { tab: 'cruises', sectionId: 'cruises-section', label: 'Cruises' },
      '/travel-insurance': { tab: 'insurance', sectionId: 'travel-insurance-section', label: 'Travel Insurance' }
    };

    if (productTabs[path]) {
      const cfg = productTabs[path];
      activateSearchTabByDomId(`tab-${cfg.tab}`, false);
      const section = document.getElementById(cfg.sectionId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const scc = document.getElementById('search-command-center');
        if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (userInitiated) {
        showToast(`Viewing ${cfg.label} Product Hub.`, 'brand');
      }
      return;
    }

    // 3. Search & Results Subroutes (Section 4)
    if (
      path === '/flights/search' ||
      path === '/hotels/search' ||
      path === '/visa-assistance/options' ||
      path === '/holiday-packages/search' ||
      path === '/cars-transfers/search' ||
      path === '/rails/search' ||
      path === '/cruises/search' ||
      path === '/activities/search' ||
      path === '/sightseeing-tours/search' ||
      path === '/travel-insurance/compare'
    ) {
      this.handleSearchResultsRoute(path, query);
      return;
    }

    // 4. Discovery Explore Pages (Section 7, 8, 16)
    if (path === '/flights/explore') {
      const el = document.getElementById('popular-flights-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Exploring all scheduled passenger routes and destination fares.', 'brand');
      return;
    }
    if (path === '/hotels/explore') {
      const el = document.getElementById('recommended-hotels-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Exploring curated hotel properties and resort collections.', 'brand');
      return;
    }
    if (path === '/travel-insurance/plans') {
      const el = document.getElementById('travel-insurance-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Exploring single-trip, multi-trip, and comprehensive insurance tiers.', 'brand');
      return;
    }

    // 5. Build Your Bundle Results & Staging (Section 5)
    if (path === '/trip-builder/results') {
      this.handleBundleResultsModal();
      return;
    }

    // 6. Hero "Ask Vacatina" Structured Trip Planner (Section 6)
    if (path === '/trip-planner') {
      const prompt = query.get('prompt') || 'Plan 5 days in Dubai with flights, hotel and visa.';
      this.handleTripPlannerModal(prompt);
      return;
    }

    // 7. Prefilled Destination Discovery Links (Section 7, 8, 11, 14)
    // Flights: /flights?from=CMB&to=DXB
    if (path === '/flights' || (path.startsWith('/flights') && query.has('to'))) {
      const from = query.get('from') || 'CMB';
      const to = query.get('to') || 'DXB';
      const toLabel = to === 'DXB' ? 'Dubai (DXB) — International' : to === 'MLE' ? 'Maldives (MLE) — Velana' : to === 'BKK' ? 'Bangkok (BKK) — Suvarnabhumi' : 'London (LHR) — Heathrow';
      searchCommandService.prefillTab('flights', {
        from: from === 'CMB' ? 'Colombo (CMB) — Bandaranaike' : from,
        to: toLabel
      });
      activateSearchTabByDomId('tab-flights', false);
      const scc = document.getElementById('search-command-center');
      if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightSearchPanel('panel-flights');
      showToast(`Prefilled Flights: ${from} → ${to}. Select dates and travellers to search.`, 'brand');
      return;
    }

    // Hotels: /hotels?destination=:destination
    if (path === '/hotels' || (path.startsWith('/hotels') && query.has('destination'))) {
      const destination = query.get('destination') || 'London';
      searchCommandService.prefillTab('hotels', { destination });
      activateSearchTabByDomId('tab-hotels', false);
      const scc = document.getElementById('search-command-center');
      if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightSearchPanel('panel-hotels');
      showToast(`Prefilled Hotels: ${destination}. Select dates and room tier to search.`, 'brand');
      return;
    }

    // Cars & Transfers: /cars-transfers?destination=... or ?service=...
    if (path.startsWith('/cars-transfers') && (query.has('destination') || query.has('service'))) {
      const dest = query.get('destination') || 'London';
      const svc = query.get('service') === 'car-hire' ? 'Car Hire' : 'Airport Transfer';
      searchCommandService.prefillTab('cars', { pickup: dest, serviceType: svc });
      activateSearchTabByDomId('tab-cars', false);
      const scc = document.getElementById('search-command-center');
      if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightSearchPanel('panel-cars');
      showToast(`Prefilled Ground Mobility: ${svc} for ${dest}.`, 'brand');
      return;
    }

    // Rails: /rails?from=...&to=...
    if (path.startsWith('/rails') && query.has('from') && query.has('to')) {
      const from = query.get('from') || '';
      const to = query.get('to') || '';
      searchCommandService.prefillTab('rails', { fromStation: from, toStation: to });
      activateSearchTabByDomId('tab-rails', false);
      const scc = document.getElementById('search-command-center');
      if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightSearchPanel('panel-rails');
      showToast(`Prefilled Rail Journey: ${from} → ${to}.`, 'brand');
      return;
    }

    // Flights Offer Deep Link (Section 7)
    if (path.startsWith('/flights/offer/')) {
      const offerId = path.replace('/flights/offer/', '');
      openFlightOfferModal(offerId);
      return;
    }

    // Hotel Property Deep Link (Section 8)
    if (path.startsWith('/hotels/property/')) {
      const remaining = path.replace('/hotels/property/', '');
      const parts = remaining.split('/');
      const propertyId = parts[0];
      const isConfigure = parts[1] === 'configure';
      openHotelPropertyModal(propertyId, isConfigure);
      return;
    }

    // Generic Normalized Offer Deep Links across other products
    const offerPrefixes = [
      '/visa-assistance/offer/',
      '/holiday-packages/offer/',
      '/cars-transfers/offer/',
      '/rails/offer/',
      '/cruises/offer/',
      '/activities/offer/',
      '/sightseeing-tours/offer/',
      '/travel-insurance/offer/'
    ];
    for (const prefix of offerPrefixes) {
      if (path.startsWith(prefix)) {
        const offerId = path.replace(prefix, '');
        openNormalizedOfferModal(offerId);
        return;
      }
    }

    // 8. Visa Assistance Routes (Section 9)
    if (path.startsWith('/visa-assistance/')) {
      this.handleVisaRoute(path);
      return;
    }

    // 9. Holiday Packages Deep Links (Section 10)
    if (path.startsWith('/holiday-packages/')) {
      const slug = path.replace('/holiday-packages/', '');
      this.handlePackageRoute(slug);
      return;
    }

    // 10. Activities Deep Links (Section 12)
    if (path.startsWith('/activities/')) {
      const slug = path.replace('/activities/', '');
      this.handleActivityRoute(slug);
      return;
    }

    // 11. Sightseeing Tours Deep Links (Section 13)
    if (path.startsWith('/sightseeing-tours/')) {
      const slug = path.replace('/sightseeing-tours/', '');
      this.handleSightseeingRoute(slug);
      return;
    }

    // 12. Cruises Deep Links (Section 15)
    if (path.startsWith('/cruises/')) {
      const slug = path.replace('/cruises/', '');
      this.handleCruiseRoute(slug);
      return;
    }

    // 13. Rails Scenic Journeys Deep Links (Section 14)
    if (path.startsWith('/rails/journeys/')) {
      const journey = path.replace('/rails/journeys/', '');
      this.handleRailJourneyRoute(journey);
      return;
    }

    // 14. Travel Insurance Plans Deep Links (Section 16)
    if (path.startsWith('/travel-insurance/plans/')) {
      const planSlug = path.replace('/travel-insurance/plans/', '');
      this.handleInsurancePlanRoute(planSlug);
      return;
    }

    // 15. Saved Favorites (Section 18)
    if (path === '/favorites') {
      openSavedFavoritesDrawer();
      return;
    }

    // 16. Trip Bucket Review & Workspace
    if (path === '/trip/review' || path === '/checkout' || path.startsWith('/checkout/')) {
      openTripDossierReviewModal();
      return;
    }
    if (path === '/trip-bucket' || path === '/trip') {
      openTripBucketDrawer();
      return;
    }

    // 16b. B2B Partner Portal Workspace
    if (path === '/partner' || path.startsWith('/partner/')) {
      const subpath = path.replace('/partner', '').replace(/^\//, '') || 'dashboard';
      openPartnerPortalModal(subpath);
      return;
    }

    // 16c. Operations & Admin Backoffice
    if (path === '/admin' || path.startsWith('/admin/')) {
      let subpath = path.replace('/admin', '').replace(/^\//, '') || 'overview';
      if (subpath === 'listings') {
        subpath = 'inventory';
      }
      openAdminPortalModal(subpath);
      return;
    }

    // 16d. Booking Dossier Lookup (/bookings/:ref or /manage/:ref)
    if (path.startsWith('/bookings/') || path.startsWith('/manage/')) {
      const ref = path.replace('/bookings/', '').replace('/manage/', '');
      this.handleManageBookingLookup();
      return;
    }

    // 17. Canonical Resources Architecture (Section 21 & 22)
    if (path.startsWith('/resources')) {
      this.handleResourcesRoute(path);
      return;
    }

    // 18. Authentication Routes (Section 20)
    if (path === '/auth/sign-in' || path === '/auth/sign-up') {
      this.handleAuthRoute(path);
      return;
    }

    // 19. Account Routes (Section 20)
    if (path.startsWith('/account')) {
      this.handleAccountRoute(path);
      return;
    }

    // 20. Support & Concierge (Section 20 & 25)
    if (path === '/support' || path === '/help/faq' || path === '/contact') {
      this.handleSupportRoute(path);
      return;
    }

    // 21. Company & Legal Pages (Section 25)
    if (
      path === '/about' ||
      path === '/why-vacatina' ||
      path === '/careers' ||
      path === '/press' ||
      path === '/partners' ||
      path.startsWith('/legal/')
    ) {
      this.handleCompanyOrLegalRoute(path);
      return;
    }

    // 22. Clean 404 Handler (Section 32)
    this.handleNotFoundRoute(path);
  }

  // --- Handlers for Specific Route Families ---

  private handleSearchResultsRoute(path: string, query: URLSearchParams): void {
    const tabMap: Record<string, CommandCenterTabId> = {
      '/flights/search': 'flights',
      '/hotels/search': 'hotels',
      '/visa-assistance/options': 'visa',
      '/holiday-packages/search': 'packages',
      '/cars-transfers/search': 'cars',
      '/rails/search': 'rails',
      '/cruises/search': 'cruises',
      '/activities/search': 'activities',
      '/sightseeing-tours/search': 'sightseeing',
      '/travel-insurance/compare': 'insurance'
    };

    const tab = tabMap[path] || 'flights';
    activateSearchTabByDomId(`tab-${tab}`, false);

    const scc = document.getElementById('search-command-center');
    if (scc) scc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightSearchPanel(`panel-${tab}`);

    const origin = query.get('from') || query.get('origin') || undefined;
    const destination = query.get('to') || query.get('destination') || query.get('country') || undefined;

    openSearchResultsModal(tab, { origin, destination });
    showToast(`Displaying live search results and validated options for ${tab.toUpperCase()}.`, 'success');
  }

  private handleTripPlannerModal(promptText: string): void {
    openInfoOrSupportModal(
      '✦ Ask Vacatina — Structured Trip Planner',
      'Deterministic Multi-Vertical Journey Synthesis (Flights · Stays · Visa · Transfers)',
      `
      <div class="space-y-4 text-xs">
        <div class="p-3.5 rounded-xl bg-brand-primary text-white">
          <div class="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Active Travel Prompt</div>
          <div class="font-semibold text-sm leading-snug">"${escapeHtml(promptText)}"</div>
        </div>

        <div class="space-y-2.5">
          <div class="font-bold text-brand-black text-sm">Deterministic 5-Day Dubai Itinerary Blueprint</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <span class="text-[10px] font-bold text-brand-primary uppercase">Component 1: Flights</span>
              <div class="font-semibold text-brand-black mt-1">CMB → DXB (Direct Passenger Route)</div>
              <p class="text-[11px] text-brand-muted mt-0.5">SriLankan Airlines / Emirates · Economy Standard</p>
              <div class="mt-2 text-[10px] font-bold text-green-700">✓ Ready to Stage</div>
            </div>
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <span class="text-[10px] font-bold text-brand-primary uppercase">Component 2: Accommodation</span>
              <div class="font-semibold text-brand-black mt-1">4 Nights Downtown Dubai Hotel</div>
              <p class="text-[11px] text-brand-muted mt-0.5">Deluxe King Room · Breakfast Included</p>
              <div class="mt-2 text-[10px] font-bold text-green-700">✓ Ready to Stage</div>
            </div>
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <span class="text-[10px] font-bold text-brand-primary uppercase">Component 3: Visa Assistance</span>
              <div class="font-semibold text-brand-black mt-1">UAE 30-Day Tourist Visa Guidance</div>
              <p class="text-[11px] text-brand-muted mt-0.5">Pre-checked document checklist & consular fee</p>
              <div class="mt-2 text-[10px] font-bold text-amber-700">⚡ Needs Applicant Passport Copy</div>
            </div>
            <div class="p-3 rounded-xl border border-brand-border bg-brand-canvas">
              <span class="text-[10px] font-bold text-brand-primary uppercase">Component 4: Transfers</span>
              <div class="font-semibold text-brand-black mt-1">DXB Airport to Hotel Private Sedan</div>
              <p class="text-[11px] text-brand-muted mt-0.5">Meet & greet arrival transfer</p>
              <div class="mt-2 text-[10px] font-bold text-green-700">✓ Ready to Stage</div>
            </div>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-brand-subtle border border-brand-border text-brand-muted leading-relaxed">
          <strong class="text-brand-black font-semibold">Vacatina Rule:</strong> AI trip suggestions do not bypass mandatory configuration. Staging this blueprint creates verified candidates in your Trip Bucket where fare classes, passport details, and room types can be completed.
        </div>

        <div class="pt-3 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <span class="text-xs font-semibold text-brand-black">Estimated Staging Total: <strong class="text-brand-primary tabular-nums">LKR 465,000*</strong></span>
          <button
            type="button"
            onclick="window.__VACATINA_ROUTER__.stageBundleItinerary(); document.querySelector('[data-dialog-close=true]')?.click();"
            class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-primary text-white font-semibold text-xs hover:opacity-90 transition-opacity"
          >
            Stage Itinerary in Trip Bucket
          </button>
        </div>
      </div>
      `
    );
  }

  private handleBundleResultsModal(): void {
    openInfoOrSupportModal(
      'Build Your Bundle — Multi-Vertical Orchestration',
      'Orchestrated Trip Components Status Breakdown',
      `
      <div class="space-y-4 text-xs">
        <div class="p-3 rounded-xl bg-brand-subtle border border-brand-border text-brand-muted leading-relaxed">
          The selected travel components are synchronized into one consolidated trip docket. Each component indicates whether it is Ready or requires specific configuration before unified booking.
        </div>

        <div class="space-y-2">
          <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand-black">Flight Component</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ready</span>
              </div>
              <div class="text-[11px] text-brand-muted mt-0.5">Colombo (CMB) → London (LHR) Return · SriLankan Airlines</div>
            </div>
            <div class="font-bold text-brand-primary tabular-nums text-sm">LKR 248,500</div>
          </div>

          <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand-black">Hotel Stay</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Needs Configuration</span>
              </div>
              <div class="text-[11px] text-brand-muted mt-0.5">London Central Property · Room type and bed configuration pending</div>
            </div>
            <button type="button" onclick="window.__VACATINA_OS__.openChangeRoomDialog();" class="px-3 py-1.5 rounded-lg bg-brand-subtle text-brand-primary font-semibold text-xs hover:bg-brand-primary hover:text-white transition-colors">Configure Room</button>
          </div>

          <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand-black">Visa Assistance</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Needs Applicant Details</span>
              </div>
              <div class="text-[11px] text-brand-muted mt-0.5">UK Standard Visitor · Passport number and issuance details required</div>
            </div>
            <button type="button" onclick="window.__VACATINA_ROUTER__.navigateTo('/visa-assistance/uk/apply');" class="px-3 py-1.5 rounded-lg bg-brand-subtle text-brand-primary font-semibold text-xs hover:bg-brand-primary hover:text-white transition-colors">Add Details</button>
          </div>

          <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between opacity-60">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand-black">Ground Transfer</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Not Selected</span>
              </div>
              <div class="text-[11px] text-brand-muted mt-0.5">Airport to Hotel transfer not currently included</div>
            </div>
            <button type="button" onclick="window.__VACATINA_ROUTER__.navigateTo('/cars-transfers');" class="px-3 py-1.5 rounded-lg border border-brand-border text-brand-black font-semibold text-xs hover:bg-brand-subtle">Add Transfer</button>
          </div>
        </div>

        <div class="pt-3 border-t border-brand-border flex items-center justify-between">
          <button type="button" onclick="window.__VACATINA_ROUTER__.saveBundleAsDraft();" class="px-4 py-2 rounded-xl border border-brand-border font-semibold text-xs text-brand-black hover:bg-brand-subtle">Save as Draft in Trip Bucket</button>
          <button type="button" onclick="window.__VACATINA_ROUTER__.navigateTo('/trip/review');" class="px-5 py-2 rounded-xl bg-brand-primary text-white font-semibold text-xs hover:opacity-90">Review Dossier</button>
        </div>
      </div>
      `
    );
  }

  private handleVisaRoute(path: string): void {
    const country = path.replace('/visa-assistance/', '').split('/')[0];
    const isApply = path.endsWith('/apply');

    const countryData: Record<string, { title: string; processingTime: string; fee: string; validity: string; checklist: string[] }> = {
      uae: {
        title: 'United Arab Emirates (Dubai) Tourist Visa',
        processingTime: '2 – 3 working days',
        fee: 'LKR 38,000 (Consular & Service Fee)',
        validity: '30 Days / Single Entry',
        checklist: ['Scanned biometric passport bio page (6+ months validity)', 'Passport-sized white background photograph', 'Confirmed return flight itinerary', 'Hotel reservation voucher']
      },
      uk: {
        title: 'United Kingdom Standard Visitor Visa Assistance',
        processingTime: '15 working days standard',
        fee: 'LKR 52,000 (Guidance & Document Review)',
        validity: '6 Months / Multi-Entry',
        checklist: ['Valid passport with blank pages', '6 months bank statements with certified audit trail', 'Employment confirmation or company registration', 'Comprehensive travel itinerary and accommodation details']
      },
      thailand: {
        title: 'Thailand Electronic Travel & Tourist Visa Guidance',
        processingTime: '3 – 5 working days',
        fee: 'LKR 18,500 (Application Handling)',
        validity: '60 Days / Single Entry',
        checklist: ['Passport copy with 6+ months validity', 'Recent color digital portrait', 'Confirmed round-trip flight booking', 'Proof of funds (minimum USD 700 equivalent)']
      },
      singapore: {
        title: 'Singapore Electronic Visa Application Assistance',
        processingTime: '3 – 4 working days',
        fee: 'LKR 24,000 (Consular & Submission Fee)',
        validity: '30 Days / Multiple Entry',
        checklist: ['Passport personal details page scan', 'Formal passport photo taken against white background', 'Form 14A duly completed', 'Local Singapore sponsor or confirmed hotel dossier']
      }
    };

    const info = countryData[country] || {
      title: `${country.toUpperCase()} Travel Visa Assistance`,
      processingTime: '5 – 10 working days',
      fee: 'Variable consular tariff',
      validity: 'Based on passport category',
      checklist: ['Valid international passport', 'Proof of accommodation and return travel', 'Sufficient financial standing proof']
    };

    openInfoOrSupportModal(
      isApply ? `Apply: ${info.title}` : info.title,
      'Vacatina Visa Advisory & Filing Support (Not an Immigration Authority)',
      `
      <div class="space-y-4 text-xs">
        <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-brand-muted font-medium">Standard Processing:</span>
            <span class="font-bold text-brand-black">${info.processingTime}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-brand-muted font-medium">Standard Tariff:</span>
            <span class="font-bold text-brand-primary tabular-nums">${info.fee}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-brand-muted font-medium">Entry Validity:</span>
            <span class="font-bold text-brand-black">${info.validity}</span>
          </div>
        </div>

        <div>
          <div class="font-bold text-brand-black uppercase text-[10px] tracking-wider mb-2">Mandatory Document Checklist:</div>
          <ul class="space-y-1.5 text-brand-muted">
            ${info.checklist.map(item => `<li class="flex items-start gap-2"><svg class="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span>${item}</span></li>`).join('')}
          </ul>
        </div>

        <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed text-[11px]">
          <strong>Advisory Compliance Notice:</strong> Vacatina is a private travel orchestration provider and document assistance service. We do not issue visas or guarantee consular approval; sovereign decisions remain exclusively with official immigration authorities.
        </div>

        <div class="pt-3 border-t border-brand-border flex items-center justify-between">
          <a href="/visa-assistance" class="font-semibold text-brand-muted hover:text-brand-primary">Back to Visa Services</a>
          <button
            type="button"
            onclick="window.__VACATINA_ROUTER__.stageVisaToBucket('${info.title}'); document.querySelector('[data-dialog-close=true]')?.click();"
            class="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-semibold hover:opacity-90"
          >
            Stage in Trip Bucket (Needs Action)
          </button>
        </div>
      </div>
      `
    );
  }

  private handlePackageRoute(slug: string): void {
    const slugToData: Record<string, { title: string; destination: string; duration: string; price: string }> = {
      'maldives-luxury-escape': { title: 'Maldives Luxury Escape', destination: 'Maldives', duration: '5 Days / 4 Nights', price: 'LKR 420,000*' },
      'dubai-skyline-desert': { title: 'Dubai Skyline & Desert Safari', destination: 'Dubai, UAE', duration: '6 Days / 5 Nights', price: 'LKR 315,000*' },
      'bali-cultural-retreat': { title: 'Bali Cultural Retreat & Villas', destination: 'Bali, Indonesia', duration: '7 Days / 6 Nights', price: 'LKR 285,000*' },
      'thailand-island-hopper': { title: 'Thailand Island Hopper Expedition', destination: 'Phuket & Krabi', duration: '8 Days / 7 Nights', price: 'LKR 265,000*' }
    };

    const pkg = slugToData[slug] || {
      title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      destination: 'Curated Destination',
      duration: 'Flexible Itinerary',
      price: 'LKR 295,000*'
    };

    openHolidayPackageDetailsModal(pkg.title, pkg.destination, pkg.duration, pkg.price);
  }

  private handleActivityRoute(slug: string): void {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    openProductConfiguratorModal('activities', `${title} · Selected Activity Location`);
  }

  private handleSightseeingRoute(slug: string): void {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    openProductConfiguratorModal('sightseeing', `${title} · Sightseeing Route`);
  }

  private handleCruiseRoute(slug: string): void {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    openProductConfiguratorModal('cruises', `${title} · Maritime Itinerary`);
  }

  private handleRailJourneyRoute(journey: string): void {
    const title = journey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    openProductConfiguratorModal('rails', `${title} · Scenic Rail Route`);
  }

  private handleInsurancePlanRoute(planSlug: string): void {
    const title = planSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    openProductConfiguratorModal('insurance', `${title} · Worldwide Travel Cover`);
  }

  private handleResourcesRoute(path: string): void {
    const resourcePages: Record<string, { title: string; subtitle: string; content: string }> = {
      '/resources': {
        title: 'Vacatina Travel Resources & Advisory Hub',
        subtitle: 'Editorial Dispatches, Seasonal Climate Matrices, Visa Checklists & Trust Protocols',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina centralizes travel knowledge, planning frameworks, and supplier disclosures so that every journey decision is backed by verified data.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="/resources/travel-notes" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Travel Notes &amp; Blog</div>
              <p class="text-[11px] text-brand-muted mt-1">Dispatches, route expansions, and authentic destination reviews.</p>
            </a>
            <a href="/resources/destinations" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Destination Guides</div>
              <p class="text-[11px] text-brand-muted mt-1">Curated city, coastal, and hill-country guides with real transit insights.</p>
            </a>
            <a href="/resources/seasonal-guide" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Seasonal Travel Guide</div>
              <p class="text-[11px] text-brand-muted mt-1">Destination climate suitability matrix and optimal booking windows.</p>
            </a>
            <a href="/resources/visa-requirements" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Visa Requirement Checker</div>
              <p class="text-[11px] text-brand-muted mt-1">Passport nationality checklists and consular filing timelines.</p>
            </a>
            <a href="/resources/travel-insurance-guide" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Travel Insurance Guide</div>
              <p class="text-[11px] text-brand-muted mt-1">Coverage comparison framework, excess explanations, and medical evacuation.</p>
            </a>
            <a href="/resources/travel-disruption" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Travel Disruption Guide</div>
              <p class="text-[11px] text-brand-muted mt-1">Rebooking protocols, flight delay entitlements, and 24/7 care assistance.</p>
            </a>
            <a href="/resources/trip-bucket-guide" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">Trip Bucket Guide</div>
              <p class="text-[11px] text-brand-muted mt-1">Understanding the 8 lifecycle states of multi-product travel staging.</p>
            </a>
            <a href="/resources/booking-transparency" class="p-3 rounded-xl border border-brand-border hover:border-brand-primary bg-white block transition-colors">
              <div class="font-bold text-brand-black text-sm">How We Compare Options</div>
              <p class="text-[11px] text-brand-muted mt-1">Transparent rate breakdowns, no hidden fees, and supplier parity standards.</p>
            </a>
          </div>
        </div>
        `
      },
      '/resources/travel-notes': {
        title: 'Vacatina Travel Notes & Editorial Blog',
        subtitle: 'Verified route updates, seasonal window dispatches, and curated journey ideas',
        content: `
        <div class="space-y-4 text-xs">
          <article class="p-3.5 rounded-xl border border-brand-border bg-white">
            <span class="text-[10px] font-bold text-brand-primary uppercase">Route Dispatch · Autumn 2026</span>
            <h4 class="font-bold text-brand-black text-sm mt-0.5">Direct Flight Route Expansions Across the Indian Ocean</h4>
            <p class="text-brand-muted mt-1 leading-relaxed">SriLankan Airlines and Gulf carriers have added direct frequencies between Colombo, Dubai, London, and Male. Learn how unified passenger ticketing reduces baggage re-check risks during multi-sector journeys.</p>
          </article>
          <article class="p-3.5 rounded-xl border border-brand-border bg-white">
            <span class="text-[10px] font-bold text-brand-primary uppercase">Seasonal Advisory</span>
            <h4 class="font-bold text-brand-black text-sm mt-0.5">Navigating Southeast Asia Monsoon Cycles</h4>
            <p class="text-brand-muted mt-1 leading-relaxed">Understanding the dual monsoon system between Thailand's Andaman coast and the Gulf islands allows travelers to experience sunny skies regardless of the calendar month.</p>
          </article>
        </div>
        `
      },
      '/resources/destinations': {
        title: 'Vacatina Destination Guides',
        subtitle: 'Curated city, coastal, and alpine intelligence for modern travelers',
        content: `
        <div class="space-y-3 text-xs">
          <p class="text-brand-muted leading-relaxed">Explore destination logistics, transit cards, visa requirements, and regional etiquette before you book.</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">Dubai, UAE</strong><span class="text-brand-muted text-[11px]">Metropolitan &amp; Desert</span></div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">Maldives</strong><span class="text-brand-muted text-[11px]">Atolls &amp; Marine Reefs</span></div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">London, UK</strong><span class="text-brand-muted text-[11px]">Heritage &amp; Transit</span></div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">Sri Lanka</strong><span class="text-brand-muted text-[11px]">Hill Country &amp; Coast</span></div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">Singapore</strong><span class="text-brand-muted text-[11px]">Urban Architecture</span></div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-brand-canvas"><strong class="block text-brand-black">Swiss Alps</strong><span class="text-brand-muted text-[11px]">Scenic Mountain Rail</span></div>
          </div>
        </div>
        `
      },
      '/resources/seasonal-guide': {
        title: 'Seasonal Destination Guide',
        subtitle: 'Objective Climate Suitability Matrix & Optimal Booking Windows',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina never fabricates live weather data. Instead, our Seasonal Guide provides historical meteorological averages and tourism demand calendars to help you time your journey.</p>
          <div class="overflow-x-auto border border-brand-border rounded-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-brand-subtle text-brand-black font-semibold border-b border-brand-border">
                <tr><th class="p-2.5">Destination</th><th class="p-2.5">Peak Season</th><th class="p-2.5">Shoulder Window</th><th class="p-2.5">What to Expect</th></tr>
              </thead>
              <tbody class="divide-y divide-brand-border text-brand-muted">
                <tr><td class="p-2.5 font-bold text-brand-black">Dubai, UAE</td><td class="p-2.5">Nov – Mar</td><td class="p-2.5">Apr &amp; Oct</td><td class="p-2.5">Warm sunny days, cool evenings; ideal for outdoor exploration.</td></tr>
                <tr><td class="p-2.5 font-bold text-brand-black">Maldives</td><td class="p-2.5">Dec – Apr</td><td class="p-2.5">May &amp; Nov</td><td class="p-2.5">Calm turquoise lagoons, prime underwater visibility for diving.</td></tr>
                <tr><td class="p-2.5 font-bold text-brand-black">Sri Lanka (South/West)</td><td class="p-2.5">Dec – Apr</td><td class="p-2.5">Oct – Nov</td><td class="p-2.5">Golden beaches, calm waters, whale watching season.</td></tr>
                <tr><td class="p-2.5 font-bold text-brand-black">London, UK</td><td class="p-2.5">Jun – Aug</td><td class="p-2.5">May &amp; Sep</td><td class="p-2.5">Long daylight hours, outdoor festivals, mild temperatures.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        `
      },
      '/resources/visa-requirements': {
        title: 'Visa Requirement Checker',
        subtitle: 'Nationality-Specific Documentary Protocols & Submission Deadlines',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Select your destination to view consular lead times, documentary mandates, and pre-departure registration protocols.</p>
          <div class="space-y-2">
            <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between">
              <div><strong class="text-brand-black">UAE (Dubai) Tourist Visa</strong><span class="block text-brand-muted text-[11px]">30/60 Days · eVisa · 2–3 Days turnaround</span></div>
              <a href="/visa-assistance/uae" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white font-semibold text-xs">View Details</a>
            </div>
            <div class="p-3 rounded-xl border border-brand-border bg-white flex items-center justify-between">
              <div><strong class="text-brand-black">UK Standard Visitor Visa</strong><span class="block text-brand-muted text-[11px]">6 Months · Biometric Appointment · 15 Days</span></div>
              <a href="/visa-assistance/uk" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white font-semibold text-xs">View Details</a>
            </div>
          </div>
        </div>
        `
      },
      '/resources/travel-insurance-guide': {
        title: 'Travel Insurance Guide',
        subtitle: 'Clear Explanations of Medical Evacuation, Cancellation & Excess Limits',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina requires complete policy schedule disclosure before purchase. Learn how emergency overseas hospitalization, luggage delays, and trip cancellation coverage interact with carrier policies.</p>
          <div class="p-3.5 rounded-xl bg-brand-canvas border border-brand-border space-y-2">
            <div class="font-bold text-brand-black">Essential Checklist Before Buying Insurance:</div>
            <ul class="space-y-1 text-brand-muted">
              <li>• Pre-existing medical condition disclosure requirements</li>
              <li>• Single item baggage value limits and deductible excess</li>
              <li>• Winter sports, scuba diving, and adventure activity riders</li>
              <li>• Natural disruption and carrier insolvencies protections</li>
            </ul>
          </div>
        </div>
        `
      },
      '/resources/travel-disruption': {
        title: 'Travel Disruption Guide',
        subtitle: 'Proactive Rebooking, Carrier Cancellation Protocols & 24/7 Care Desk',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">When flight delays, missed connections, or severe weather occur, Vacatina's centralized orchestration layer coordinates affected hotel stays and ground transfers automatically.</p>
          <div class="p-3.5 rounded-xl bg-brand-primary text-white space-y-2">
            <div class="font-bold text-sm">Disruption Assistance Direct Lines:</div>
            <div class="text-[11px] text-white/80">Telephone: <a href="tel:+94113606200" class="font-bold underline text-white">+94113606200</a> (Priority Support)</div>
            <div class="text-[11px] text-white/80">Emergency Desk: <a href="mailto:info@vacatina.com" class="font-bold underline text-white">info@vacatina.com</a></div>
          </div>
        </div>
        `
      },
      '/resources/trip-bucket-guide': {
        title: 'Trip Bucket Guide',
        subtitle: 'Understanding the 8 Canonical States of Staged Travel Products',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">The Vacatina Trip Bucket is not a generic ecommerce shopping cart. Multi-vertical travel requires stateful synchronization across airline fare locks, hotel inventory, and consular appointments.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-green-700">1. Ready:</strong> Complete configuration &amp; live price verified. Contributes to Ready Subtotal.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-amber-700">2. Needs Action:</strong> Missing mandatory inputs (room type, passport). Excluded from subtotal.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-blue-700">3. Draft:</strong> Saved itinerary candidate staged from bundle builder.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-purple-700">4. Refreshing Price:</strong> Real-time supplier fare query in flight.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-orange-700">5. Price Changed:</strong> Live fare updated by supplier; explicit user acceptance required.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-indigo-700">6. Recheck Required:</strong> Availability hold reached threshold; revalidation triggered.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-red-700">7. Offer Expired:</strong> Airline seat fare hold expired; new search required.</div>
            <div class="p-2.5 rounded-xl border border-brand-border bg-white"><strong class="text-gray-700">8. Unavailable:</strong> Room or cabin class fully booked; alternatives recommended.</div>
          </div>
        </div>
        `
      },
      '/resources/booking-transparency': {
        title: 'How We Compare Options',
        subtitle: 'Booking Transparency, Parity Standards & Fair Comparison Protocols',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina does not apply hidden checkout surcharges, drip pricing, or deceptive scarcity countdowns. Every fare shown details mandatory taxes, airline fuel charges, and hotel resort fees upfront.</p>
          <div class="p-3.5 rounded-xl border border-brand-border bg-brand-canvas space-y-2">
            <div class="font-bold text-brand-black">Our Three Core Transparency Commitments:</div>
            <ul class="space-y-1.5 text-brand-muted">
              <li><strong>1. Complete Itemization:</strong> Consular fees, service charges, airline taxes, and baggage costs are explicitly separated.</li>
              <li><strong>2. Parity With Direct Providers:</strong> Fares reflect direct supplier contract rates without synthetic markups.</li>
              <li><strong>3. Explicit Change Terms:</strong> Fare cancellation conditions, change fees, and refund turnaround windows are visible before you confirm.</li>
            </ul>
          </div>
        </div>
        `
      }
    };

    const page = resourcePages[path] || resourcePages['/resources'];
    openInfoOrSupportModal(page.title, page.subtitle, page.content);
  }

  private handleAuthRoute(path: string): void {
    const isSignUp = path === '/auth/sign-up';
    openInfoOrSupportModal(
      isSignUp ? 'Sign Up to Vacatina Travel OS' : 'Sign In to Vacatina Travel OS',
      'Traveller Account & Trip Bucket Synchronization',
      `
      <div class="space-y-4 text-xs">
        <p class="text-brand-muted">Sign in or create your account to synchronize your Saved Favorites, passport profiles, visa checklists, and staged Trip Bucket itineraries across devices.</p>
        <div class="space-y-2.5">
          <div>
            <label for="auth-email-input" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Email Address</label>
            <input id="auth-email-input" type="email" placeholder="name@example.com" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black">
          </div>
          <div>
            <label for="auth-pass-input" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Password</label>
            <input id="auth-pass-input" type="password" placeholder="••••••••••••" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black">
          </div>
          <button
            type="button"
            onclick="window.__VACATINA_OS__.setSignedInState(true); document.querySelector('[data-dialog-close=true]')?.click();"
            class="w-full min-h-[44px] bg-brand-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            ${isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>
      `
    );
  }

  private handleAccountRoute(path: string): void {
    const accountSections: Record<string, { title: string; desc: string }> = {
      '/account': { title: 'Account Overview', desc: 'Manage your verified traveller profile, security settings, and synchronized dossiers.' },
      '/account/trips': { title: 'My Trips & Bookings', desc: 'View confirmed journeys, airline ticket numbers, and accommodation vouchers.' },
      '/account/visa-applications': { title: 'Visa Applications', desc: 'Track consular submission progress, appointment dates, and documentary checklists.' },
      '/account/travelers': { title: 'Profile & Co-Travelers', desc: 'Store family and companion passport details for one-click traveller entry.' },
      '/account/preferences': { title: 'Seat, Meal & Currency Preferences', desc: 'Configure frequent flyer numbers, dietary restrictions, and preferred display currency.' }
    };

    const section = accountSections[path] || accountSections['/account'];
    openInfoOrSupportModal(
      section.title,
      'Vacatina B2C Traveller Portal',
      `
      <div class="space-y-4 text-xs">
        <p class="text-brand-muted leading-relaxed">${section.desc}</p>
        <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border text-brand-muted">
          Active B2C traveler account synchronized with local device storage.
        </div>
      </div>
      `
    );
  }

  private handleSupportRoute(path: string): void {
    const supportPages: Record<string, { title: string; subtitle: string; content: string }> = {
      '/manage-booking': {
        title: 'Manage Your Existing Bookings',
        subtitle: 'View, Modify, or Reschedule Active Travel Reservations',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Enter your 8-character Vacatina Booking Dossier reference and lead traveller surname to retrieve your unified travel itinerary.</p>
          <div class="p-3.5 rounded-xl border border-brand-border bg-white space-y-3">
            <div>
              <label for="mb-ref-input" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Booking Reference</label>
              <input id="mb-ref-input" type="text" placeholder="VCT-2026-XXXX" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black uppercase">
            </div>
            <div>
              <label for="mb-name-input" class="block text-[10px] font-bold text-brand-muted uppercase mb-1">Lead Passenger Surname</label>
              <input id="mb-name-input" type="text" placeholder="e.g. Silva" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black">
            </div>
            <button type="button" onclick="window.__VACATINA_ROUTER__.handleManageBookingLookup();" class="w-full min-h-[44px] rounded-xl bg-brand-primary text-white font-semibold text-xs hover:opacity-90 transition-opacity">Find My Booking</button>
          </div>
        </div>
        `
      },
      '/support/visa': {
        title: 'Consular Visa Advisory Help Desk',
        subtitle: 'Pre-Submission Document Audits & Application Tracking',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina's dedicated consular concierge assists with tourist visa filings for UAE, UK, Schengen, Thailand, Singapore, and Sri Lanka ETA.</p>
          <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border space-y-2">
            <div class="font-bold text-brand-black">Visa Advisory Contacts:</div>
            <div><span class="text-brand-muted block">Direct Visa Desk:</span><a href="tel:+94113606200" class="font-bold text-brand-primary text-sm hover:underline">+94113606200</a></div>
            <div><span class="text-brand-muted block">Document Audits:</span><a href="mailto:info@vacatina.com" class="font-bold text-brand-primary text-sm hover:underline">info@vacatina.com</a></div>
          </div>
        </div>
        `
      },
      '/policies/cancellations': {
        title: 'Cancellation, Rescheduling & Refund Policies',
        subtitle: 'Transparent Supplier Terms & Processing Windows',
        content: `
        <div class="space-y-4 text-xs">
          <p class="text-brand-muted leading-relaxed">Vacatina enforces transparent cancellation terms without synthetic administrative penalties. All refund rights reflect carrier tariffs and hotel contract provisions.</p>
          <div class="space-y-2 text-brand-muted">
            <div class="p-3 rounded-xl border border-brand-border bg-white"><strong class="text-brand-black">Airlines:</strong> Governed by fare family rules (Standard vs Flex). Refundable taxes returned within 5–7 banking days.</div>
            <div class="p-3 rounded-xl border border-brand-border bg-white"><strong class="text-brand-black">Hotels:</strong> Free cancellation up to contract deadline. Late cancellations subject to first-night charge.</div>
            <div class="p-3 rounded-xl border border-brand-border bg-white"><strong class="text-brand-black">Visa Services:</strong> Consular submission fees are non-refundable once lodged with sovereign immigration authorities.</div>
          </div>
        </div>
        `
      }
    };

    const specific = supportPages[path];
    if (specific) {
      openInfoOrSupportModal(specific.title, specific.subtitle, specific.content);
      return;
    }

    openInfoOrSupportModal(
      'Vacatina Help & Support Desk',
      '24/7 Global Concierge & Customer Care',
      `
      <div class="space-y-4 text-xs">
        <div class="p-3.5 rounded-xl bg-brand-subtle border border-brand-border space-y-2">
          <div class="font-bold text-brand-black text-sm">Direct Customer Care Contacts:</div>
          <div><span class="text-brand-muted block">Direct Phone Support:</span><a href="tel:+94113606200" class="font-bold text-brand-primary text-sm hover:underline">+94113606200</a></div>
          <div><span class="text-brand-muted block">Email Inquiries:</span><a href="mailto:info@vacatina.com" class="font-bold text-brand-primary text-sm hover:underline">info@vacatina.com</a></div>
        </div>
        <div>
          <div class="font-bold text-brand-black uppercase text-[10px] tracking-wider mb-2">Frequently Asked Questions:</div>
          <ul class="space-y-2 text-brand-muted">
            <li><strong>Q: How do I change a staged item?</strong><br>A: Open your Trip Bucket drawer and select "Change Room" or "Complete Details".</li>
            <li><strong>Q: Are prices guaranteed before booking?</strong><br>A: Ready items reflect verified live fares; during recheck, any carrier fare change requires your explicit approval.</li>
          </ul>
        </div>
      </div>
      `
    );
  }

  private handleCompanyOrLegalRoute(path: string): void {
    const companyPages: Record<string, { title: string; subtitle: string; content: string }> = {
      '/about': {
        title: 'About Vacatina',
        subtitle: 'We Treasure Your Holidays — Unified Travel Operating System',
        content: '<p class="text-brand-muted leading-relaxed">Vacatina was founded to bring calm, unified orchestration to global travel. We eliminate fragmented bookings by coordinating flights, hotels, visa assistance, and transfers under one transparent framework.</p>'
      },
      '/why-vacatina': {
        title: 'Why Vacatina',
        subtitle: 'Calm, Coordinated, Transparent Multi-Vertical Travel',
        content: '<p class="text-brand-muted leading-relaxed">Unlike disjointed OTAs, Vacatina synchronizes travel timelines. When a flight time changes, your connected airport transfer and hotel check-in schedule adapt seamlessly.</p>'
      },
      '/careers': {
        title: 'Careers at Vacatina',
        subtitle: 'Building the Future of Travel Technology',
        content: '<p class="text-brand-muted leading-relaxed">We are an engineering and hospitality team building calm, accessible travel infrastructure. Explore remote and international positions across software engineering, travel operations, and consular concierge.</p>'
      },
      '/corporate-travel': {
        title: 'Corporate Travel Management',
        subtitle: 'SME & Enterprise Business Mobility Solutions',
        content: '<p class="text-brand-muted leading-relaxed">Consolidate corporate flight schedules, hotel lodging allowances, and duty of care tracking under one centralized Vacatina business account with custom approval workflows and monthly statement invoicing.</p>'
      },
      '/sustainability': {
        title: 'Sustainability & Community Care',
        subtitle: 'Responsible Tourism & Heritage Preservation Initiatives',
        content: '<p class="text-brand-muted leading-relaxed">Vacatina partners directly with certified eco-resorts, local community-led excursions, and carbon-efficient transport providers. We prioritize direct supplier accountability to ensure tourism benefits local economies.</p>'
      },
      '/press': {
        title: 'Press & Media',
        subtitle: 'Official Announcements & Brand Resources',
        content: '<p class="text-brand-muted leading-relaxed">Access official press releases, high-resolution brand asset packs, executive bios, and travel industry whitepapers.</p>'
      },
      '/partners': {
        title: 'Partners & Suppliers',
        subtitle: 'Global Airline, Hotel & Consular Provider Network',
        content: '<p class="text-brand-muted leading-relaxed">Vacatina partners directly with certified carriers, luxury hospitality groups, licensed ground transport operators, and authorized visa processing channels.</p>'
      },
      '/legal/booking-conditions': {
        title: 'Booking Conditions & Policies',
        subtitle: 'Transparent Travel Terms & Carrier Conditions',
        content: '<p class="text-brand-muted leading-relaxed">Every flight, hotel, and activity booking made through Vacatina adheres to transparent supplier terms, baggage conditions, and refund procedures.</p>'
      },
      '/legal/cookies': {
        title: 'Cookie Preferences & Consent Policy',
        subtitle: 'Granular Privacy & Local Storage Controls',
        content: '<p class="text-brand-muted leading-relaxed">Manage your cookie and local storage preferences. Essential cookies are locked active to preserve your Trip Bucket session and language preference.</p>'
      },
      '/legal/accessibility': {
        title: 'Accessibility Statement',
        subtitle: 'WCAG 2.1 AA Compliance & Keyboard Navigation Support',
        content: '<p class="text-brand-muted leading-relaxed">Vacatina is engineered to support full keyboard navigation, accessible screen readers, high-contrast text ratios, and roving focus indicators across all 11 travel products.</p>'
      },
      '/legal/security': {
        title: 'Security, Privacy & Trust Protocols',
        subtitle: 'PCI DSS, TLS Encryption & Data Protection Standards',
        content: '<p class="text-brand-muted leading-relaxed">Your personal information and travel itineraries are encrypted in transit and at rest. Vacatina never sells user data or stores unencrypted payment card information.</p>'
      }
    };

    const page = companyPages[path] || {
      title: 'Vacatina Legal & Trust Information',
      subtitle: 'Transparent Compliance & Privacy Framework',
      content: '<p class="text-brand-muted leading-relaxed">Access full policy documentation regarding data protection, booking security, and accessibility standards.</p>'
    };

    openInfoOrSupportModal(page.title, page.subtitle, page.content);
  }

  private handleNotFoundRoute(path: string): void {
    showToast(`The requested page "${path}" was not found. Redirected to Vacatina Home.`, 'brand');
    this.navigateTo('/', false);
  }

  // --- Helper Actions Triggered from Modals ---

  public stageBundleItinerary(): void {
    tripBucketService.addItem({
      type: 'flight',
      title: 'CMB → DXB Return (Ask Vacatina Stage)',
      route: 'Colombo (CMB) → Dubai (DXB)',
      provider: 'SriLankan Airlines · Direct',
      dates: '12 Nov – 17 Nov 2026',
      priceLkr: 165000,
      state: 'Ready'
    });
    tripBucketService.addItem({
      type: 'hotel',
      title: 'Dubai Downtown Luxury Hotel (4 Nights)',
      route: 'Downtown Dubai',
      provider: 'Deluxe King Room',
      dates: '12 Nov – 16 Nov 2026',
      priceLkr: 220000,
      state: 'Ready'
    });
    tripBucketService.addItem({
      type: 'visa',
      title: 'UAE 30-Day Tourist Visa Filing',
      route: 'Dubai Consular Processing',
      provider: 'Application Assistance',
      dates: 'Pre-departure filing',
      priceLkr: 38000,
      state: 'Needs Action'
    });
    openTripBucketDrawer();
    showToast('Staged 3 Ask Vacatina itinerary components in your Trip Bucket.', 'success');
  }

  public saveBundleAsDraft(): void {
    tripBucketService.addItem({
      type: 'flight',
      title: 'Curated Multi-Component Journey (Draft)',
      route: 'Colombo → London / Multi-Sector',
      provider: 'Vacatina Bundle Builder',
      dates: '12 Nov – 27 Nov 2026',
      priceLkr: 505000,
      state: 'Draft'
    });
    openTripBucketDrawer();
    showToast('Saved bundle configuration as Draft in Trip Bucket.', 'brand');
  }

  public stageVisaToBucket(title: string): void {
    tripBucketService.addItem({
      type: 'visa',
      title: `${title} (Filing Prep)`,
      route: 'Consular Assistance',
      provider: 'Document Checklist & Filing',
      dates: 'Pre-departure submission',
      priceLkr: 38000,
      state: 'Needs Action'
    });
    openTripBucketDrawer();
    showToast('Visa assistance staged in Trip Bucket (Needs Action).', 'brand');
  }

  public handleManageBookingLookup(): void {
    const ref = (document.getElementById('mb-ref-input') as HTMLInputElement)?.value;
    const name = (document.getElementById('mb-name-input') as HTMLInputElement)?.value;
    if (!ref || !name) {
      showToast('Please enter both booking reference and lead passenger surname.', 'warning');
      return;
    }
    closeActiveDialog(false);
    openTripDossierReviewModal();
    showToast(`Retrieved verified booking dossier for ${name} (${ref.toUpperCase()}).`, 'success');
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const routerService = new CanonicalRouterService();
