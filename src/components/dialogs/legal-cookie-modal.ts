/* ============================================================================
 * Vacatina Legal Disclosures & Cookie Preferences Modal System
 * Authorities:
 * - ANTIGRAVITY ULTRA MASTER INSTRUCTION
 * - WCAG 2.2 AA Compliance (44x44px touch targets, focus traps, aria-modal)
 * - Complete Cookie Management with persistent granular preferences
 * ============================================================================ */

import {
  activateFocusTrap,
  deactivateFocusTrap,
  setBackgroundInert,
  showToast
} from '../ui/toast.ts';

export type LegalTabId = 'cookies' | 'privacy' | 'terms' | 'accessibility' | 'security';

export interface CookiePreferences {
  essential: true;
  analytics: boolean;
  personalization: boolean;
  marketing: boolean;
  updatedAt: string;
}

const COOKIE_STORAGE_KEY = 'vacatina_cookie_consent_v1';

export function getStoredCookiePreferences(): CookiePreferences {
  if (typeof window === 'undefined') {
    return { essential: true, analytics: true, personalization: true, marketing: false, updatedAt: '' };
  }
  try {
    const raw = window.localStorage.getItem(COOKIE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        essential: true,
        analytics: Boolean(parsed.analytics),
        personalization: Boolean(parsed.personalization),
        marketing: Boolean(parsed.marketing),
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    }
  } catch {
    // fallback
  }
  return { essential: true, analytics: true, personalization: true, marketing: false, updatedAt: '' };
}

export function saveCookiePreferences(prefs: Partial<CookiePreferences>): void {
  if (typeof window === 'undefined') return;
  const current = getStoredCookiePreferences();
  const updated: CookiePreferences = {
    essential: true,
    analytics: prefs.analytics !== undefined ? prefs.analytics : current.analytics,
    personalization: prefs.personalization !== undefined ? prefs.personalization : current.personalization,
    marketing: prefs.marketing !== undefined ? prefs.marketing : current.marketing,
    updatedAt: new Date().toISOString()
  };
  try {
    window.localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

let activeLegalModal: HTMLElement | null = null;
let lastLegalTrigger: HTMLElement | null = null;

export function closeLegalModal(returnFocus = true): void {
  if (!activeLegalModal) return;
  const modal = activeLegalModal;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  deactivateFocusTrap(modal);
  setBackgroundInert(false);

  const trigger = lastLegalTrigger;
  activeLegalModal = null;
  lastLegalTrigger = null;

  if (returnFocus && trigger && typeof trigger.focus === 'function') {
    trigger.focus();
  }
}

export function openLegalAndCookieModal(initialTab: LegalTabId = 'cookies', triggerEl?: HTMLElement | null): void {
  let modal = document.getElementById('legal-cookie-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'legal-cookie-modal';
    modal.className = 'fixed inset-0 z-50 overflow-y-auto hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'legal-modal-title');
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
  }

  lastLegalTrigger = triggerEl || (document.activeElement as HTMLElement | null);
  activeLegalModal = modal;

  renderLegalModalContent(modal, initialTab);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setBackgroundInert(true, modal);
  activateFocusTrap(modal);
}

function renderLegalModalContent(modal: HTMLElement, currentTab: LegalTabId): void {
  const prefs = getStoredCookiePreferences();

  modal.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/50 backdrop-blur-sm transition-opacity" data-legal-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4 text-center">
      <div class="relative bg-white rounded-2xl border border-brand-border text-left shadow-2xl transform transition-all my-6 max-w-2xl w-full p-6 sm:p-7 overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div>
            <span class="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Vacatina Legal &amp; Compliance</span>
            <h3 id="legal-modal-title" class="font-heading font-bold text-xl sm:text-2xl text-brand-black mt-0.5">Trust, Privacy &amp; Platform Terms</h3>
          </div>
          <button type="button" id="legal-modal-close-btn" aria-label="Close Legal Dialog" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-brand-border no-scrollbar" role="tablist" aria-label="Legal Disclosures">
          <button type="button" role="tab" id="tab-btn-cookies" data-legal-tab="cookies" aria-selected="${currentTab === 'cookies'}" class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors touch-target-44 ${currentTab === 'cookies' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-black hover:bg-brand-subtle'}">Cookie Preferences</button>
          <button type="button" role="tab" id="tab-btn-privacy" data-legal-tab="privacy" aria-selected="${currentTab === 'privacy'}" class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors touch-target-44 ${currentTab === 'privacy' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-black hover:bg-brand-subtle'}">Privacy Policy</button>
          <button type="button" role="tab" id="tab-btn-terms" data-legal-tab="terms" aria-selected="${currentTab === 'terms'}" class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors touch-target-44 ${currentTab === 'terms' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-black hover:bg-brand-subtle'}">Terms of Service</button>
          <button type="button" role="tab" id="tab-btn-accessibility" data-legal-tab="accessibility" aria-selected="${currentTab === 'accessibility'}" class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors touch-target-44 ${currentTab === 'accessibility' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-black hover:bg-brand-subtle'}">Accessibility</button>
          <button type="button" role="tab" id="tab-btn-security" data-legal-tab="security" aria-selected="${currentTab === 'security'}" class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors touch-target-44 ${currentTab === 'security' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-black hover:bg-brand-subtle'}">Security &amp; Trust</button>
        </div>

        <!-- Tab Body Container -->
        <div class="py-5 max-h-[60vh] overflow-y-auto space-y-4 pr-1 text-xs text-brand-muted leading-relaxed" id="legal-modal-body">
          ${renderTabContentHtml(currentTab, prefs)}
        </div>

        <!-- Footer Actions -->
        <div class="pt-4 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-700">DRAFT — Requires Legal Review</span>
            <span class="text-[11px] text-brand-muted">Vacatina Operating System v4 · Security &amp; Privacy Framework</span>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            ${
              currentTab === 'cookies'
                ? `
              <button type="button" id="cookie-accept-all-btn" class="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-brand-primary text-brand-primary hover:bg-[#F0EFFC] text-xs font-semibold transition-colors touch-target-44">Accept All</button>
              <button type="button" id="cookie-save-btn" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity touch-target-44">Save Preferences</button>
            `
                : `
              <button type="button" id="legal-close-action-btn" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity touch-target-44">Understood &amp; Close</button>
            `
            }
          </div>
        </div>

      </div>
    </div>
  `;

  bindLegalModalEvents(modal, currentTab);
}

function renderTabContentHtml(tab: LegalTabId, prefs: CookiePreferences): string {
  switch (tab) {
    case 'cookies':
      return `
        <div class="space-y-4">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700">DRAFT — Requires Legal Review</div>
          <p class="text-xs text-brand-black font-medium leading-relaxed">
            We use cookies and local storage tokens to deliver our multi-product travel orchestration platform, remember your configured currencies, preserve active Trip Bucket staging, and maintain enterprise security.
          </p>

          <!-- Toggle 1: Essential -->
          <div class="p-3.5 rounded-xl border border-brand-border bg-brand-subtle flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-brand-black text-sm">Essential &amp; Security Cookies</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">Required</span>
              </div>
              <p class="text-[11px] text-brand-muted">
                Mandatory for session continuity, CSRF security, traveler authentication, and Trip Bucket state staging. These cannot be disabled.
              </p>
            </div>
            <div class="pt-1">
              <input type="checkbox" checked disabled class="h-4 w-4 rounded text-brand-primary opacity-60 cursor-not-allowed">
            </div>
          </div>

          <!-- Toggle 2: Analytics -->
          <div class="p-3.5 rounded-xl border border-brand-border bg-white flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <label for="cookie-opt-analytics" class="font-bold text-brand-black text-sm cursor-pointer">Performance &amp; Telemetry</label>
              </div>
              <p class="text-[11px] text-brand-muted">
                Consent architecture for diagnostic telemetry to evaluate Search Command Center performance, route lookup speeds, and reliability once analytics services are connected.
              </p>
            </div>
            <div class="pt-1">
              <input type="checkbox" id="cookie-opt-analytics" ${prefs.analytics ? 'checked' : ''} class="h-4 w-4 rounded text-brand-primary cursor-pointer touch-target-44">
            </div>
          </div>

          <!-- Toggle 3: Personalization -->
          <div class="p-3.5 rounded-xl border border-brand-border bg-white flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <label for="cookie-opt-personalization" class="font-bold text-brand-black text-sm cursor-pointer">Personalization &amp; Locale State</label>
              </div>
              <p class="text-[11px] text-brand-muted">
                Saves your active currency preference (e.g. LKR, USD, AED), language selection (EN, SI, TA), and recent traveler passenger count presets between visits.
              </p>
            </div>
            <div class="pt-1">
              <input type="checkbox" id="cookie-opt-personalization" ${prefs.personalization ? 'checked' : ''} class="h-4 w-4 rounded text-brand-primary cursor-pointer touch-target-44">
            </div>
          </div>

          <!-- Toggle 4: Marketing -->
          <div class="p-3.5 rounded-xl border border-brand-border bg-white flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <label for="cookie-opt-marketing" class="font-bold text-brand-black text-sm cursor-pointer">Partner Travel Offers</label>
              </div>
              <p class="text-[11px] text-brand-muted">
                Preference architecture for destination updates, seasonal route notifications, and promotional bundles once partner channels are connected. No trackers are loaded prior to consent.
              </p>
            </div>
            <div class="pt-1">
              <input type="checkbox" id="cookie-opt-marketing" ${prefs.marketing ? 'checked' : ''} class="h-4 w-4 rounded text-brand-primary cursor-pointer touch-target-44">
            </div>
          </div>
        </div>
      `;

    case 'privacy':
      return `
        <div class="space-y-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700 mb-2">DRAFT — Requires Legal Review</div>
          <h4 class="font-heading font-bold text-sm text-brand-black">Security &amp; Privacy - Implementation Framework</h4>
          <p>The production platform is designed to use encrypted transport, tokenized payment integrations and controlled access to sensitive traveler information. Final security controls and compliance statements must be verified against the deployed infrastructure and contracted providers before publication.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">1. Traveler Information Handling</h4>
          <p>During travel planning and booking configuration, search criteria, passenger counts, and contact coordinates are processed to coordinate candidate itineraries across flights, stays, visa requirements, and packages.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">2. Supplier Verification</h4>
          <p>Supplier verification and commercial onboarding requirements will be documented and enforced through Vacatina's production operations process prior to public release.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">3. Account &amp; Record Retention</h4>
          <p>Retention schedules and account data management policies will be formally reviewed and published in accordance with governing consumer protection and civil aviation regulatory frameworks.</p>
        </div>
      `;

    case 'terms':
      return `
        <div class="space-y-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700 mb-2">DRAFT — Requires Legal Review</div>
          <h4 class="font-heading font-bold text-sm text-brand-black">1. Platform Scope &amp; Role</h4>
          <p>Vacatina provides a centralized travel operating system designed to enable multi-product itinerary aggregation across flights, stays, visa assistance, holiday packages, and ground transfers.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">2. Booking Integrity &amp; Fares</h4>
          <p>All staged Trip Bucket prices remain indicative until live provider confirmation. Final fare lock and allocation occur upon checkout authorization.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">3. Visa Assistance Disclosures</h4>
          <p>Vacatina provides visa advisory and application preparation guidance. Sovereign entry permissions and visa issuance decisions remain exclusively under the sovereign jurisdiction of consular and immigration authorities.</p>
          <h4 class="font-heading font-bold text-sm text-brand-black">4. Cancellation &amp; Policies</h4>
          <p>Fare rules, date alteration conditions, and refund policies are determined by provider fare rules and will be presented for review before transaction finalization.</p>
        </div>
      `;

    case 'accessibility':
      return `
        <div class="space-y-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700 mb-2">DRAFT — Requires Legal Review</div>
          <h4 class="font-heading font-bold text-sm text-brand-black">Accessibility Commitment</h4>
          <p>Designed toward WCAG 2.2 AA accessibility requirements. WCAG 2.2 AA is the target accessibility standard for the Vacatina product:</p>
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>Touch Target Geometry:</strong> Minimum 44×44px interactive bounds across all primary buttons, tabs, dropdowns, and form fields.</li>
            <li><strong>Color Contrast:</strong> Space Cadet on white provides strong contrast exceeding the WCAG AA text requirement.</li>
            <li><strong>Keyboard Navigation:</strong> Comprehensive keyboard focus traps for modal dialogs, roving tabindex across the 11 Search Command Center tabs, and visible high-contrast focus rings.</li>
            <li><strong>Tabular Numerals:</strong> Tabular font numerals applied to monetary figures, departure times, flight durations, and candidate subtotals to prevent layout jitter.</li>
            <li><strong>Assistive Screen Readers:</strong> Semantic ARIA landmarks, roles, live status regions, and dual-coded iconography across critical user flows.</li>
          </ul>
        </div>
      `;

    case 'security':
      return `
        <div class="space-y-3">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-700 mb-2">DRAFT — Requires Legal Review</div>
          <h4 class="font-heading font-bold text-sm text-brand-black">Security &amp; Privacy - Implementation Framework</h4>
          <p>The production platform is designed to use encrypted transport, tokenized payment integrations and controlled access to sensitive traveler information. Final security controls and compliance statements must be verified against the deployed infrastructure and contracted providers before publication.</p>
          <ul class="list-disc pl-5 space-y-1.5">
            <li><strong>Transport Encryption Design:</strong> Modern encrypted transport (TLS) designed for all web client and API interactions.</li>
            <li><strong>Payment Handling Architecture:</strong> Designed for tokenized payment processing through certified gateway integrations, avoiding raw payment card storage on application servers.</li>
            <li><strong>Candidate Data Consistency:</strong> State-machine verification to prevent unintentional price discrepancies during multi-stage checkout.</li>
            <li><strong>Supplier Verification:</strong> Supplier verification and commercial onboarding requirements will be documented and enforced through Vacatina's production operations process.</li>
          </ul>
        </div>
      `;
  }
}

function bindLegalModalEvents(modal: HTMLElement, currentTab: LegalTabId): void {
  // Backdrop & Close buttons
  const backdrop = modal.querySelector('[data-legal-backdrop="true"]');
  const closeBtn = modal.querySelector('#legal-modal-close-btn');
  const understoodBtn = modal.querySelector('#legal-close-action-btn');

  const handleClose = () => closeLegalModal(true);
  backdrop?.addEventListener('click', handleClose);
  closeBtn?.addEventListener('click', handleClose);
  understoodBtn?.addEventListener('click', handleClose);

  // Tab switching
  const tabButtons = modal.querySelectorAll<HTMLButtonElement>('[data-legal-tab]');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-legal-tab') as LegalTabId;
      if (targetTab && targetTab !== currentTab) {
        renderLegalModalContent(modal, targetTab);
      }
    });
  });

  // Cookie action buttons
  const acceptAllBtn = modal.querySelector('#cookie-accept-all-btn');
  acceptAllBtn?.addEventListener('click', () => {
    saveCookiePreferences({ analytics: true, personalization: true, marketing: true });
    showToast('All cookie preferences accepted and saved.');
    closeLegalModal(true);
  });

  const saveBtn = modal.querySelector('#cookie-save-btn');
  saveBtn?.addEventListener('click', () => {
    const analytics = (modal.querySelector('#cookie-opt-analytics') as HTMLInputElement | null)?.checked ?? true;
    const personalization = (modal.querySelector('#cookie-opt-personalization') as HTMLInputElement | null)?.checked ?? true;
    const marketing = (modal.querySelector('#cookie-opt-marketing') as HTMLInputElement | null)?.checked ?? false;

    saveCookiePreferences({ analytics, personalization, marketing });
    showToast('Your cookie preferences have been successfully updated.');
    closeLegalModal(true);
  });

  // Escape key handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && activeLegalModal === modal) {
      e.preventDefault();
      closeLegalModal(true);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Initializes footer and legal links to open the Legal & Cookie modal.
 */
export function initLegalAndCookieInteractions(): void {
  if (typeof document === 'undefined') return;

  // Intercept all clicks on data-legal-modal or footer legal links
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const trigger = target.closest<HTMLElement>('[data-legal-modal]');
    if (trigger) {
      e.preventDefault();
      const tabId = (trigger.getAttribute('data-legal-modal') || 'cookies') as LegalTabId;
      openLegalAndCookieModal(tabId, trigger);
      return;
    }

    // Also match footer text matching Privacy Policy, Terms, Cookie, Accessibility
    const footerLink = target.closest<HTMLAnchorElement>('footer a');
    if (footerLink) {
      const txt = (footerLink.textContent || '').trim().toLowerCase();
      if (txt.includes('privacy')) {
        e.preventDefault();
        openLegalAndCookieModal('privacy', footerLink);
      } else if (txt.includes('term')) {
        e.preventDefault();
        openLegalAndCookieModal('terms', footerLink);
      } else if (txt.includes('cookie')) {
        e.preventDefault();
        openLegalAndCookieModal('cookies', footerLink);
      } else if (txt.includes('accessibility')) {
        e.preventDefault();
        openLegalAndCookieModal('accessibility', footerLink);
      } else if (txt.includes('security') || txt.includes('trust')) {
        e.preventDefault();
        openLegalAndCookieModal('security', footerLink);
      }
    }
  });
}
