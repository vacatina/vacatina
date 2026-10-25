/* ============================================================================
 * Vacatina Canonical Route Registry
 * Authority: VACATINA MASTER INSTRUCTION — PART 2, 3, 18, 20, 21, 22, 23, 25 & PART 35 (STEP 3)
 *
 * Centralized, immutable single source of truth for all frontend routes,
 * parameter bindings, titles, and expected interactive behaviors.
 * ============================================================================ */

export interface CanonicalRouteDefinition {
  path: string;
  category: 'product_hub' | 'search_results' | 'offer_config' | 'resources' | 'company' | 'support' | 'account' | 'legal' | 'orchestration' | 'partner' | 'admin' | 'checkout';
  title: string;
  expectedBehavior: 'page_hub' | 'search_panel' | 'config_modal' | 'info_modal' | 'drawer' | 'account_portal';
  requiresAuth: boolean;
  productType?: string;
}

export const CANONICAL_ROUTES: Record<string, CanonicalRouteDefinition> = {
  // 1. Core & Orchestration
  '/': { path: '/', category: 'orchestration', title: 'Vacatina Home — Travel Operating System', expectedBehavior: 'page_hub', requiresAuth: false },
  '/trip-builder/results': { path: '/trip-builder/results', category: 'orchestration', title: 'Build Your Bundle Orchestration', expectedBehavior: 'config_modal', requiresAuth: false },
  '/trip-planner': { path: '/trip-planner', category: 'orchestration', title: 'Ask Vacatina — Structured Trip Planner', expectedBehavior: 'info_modal', requiresAuth: false },
  '/trip/review': { path: '/trip/review', category: 'orchestration', title: 'Trip Dossier Review & Unified Checkout', expectedBehavior: 'config_modal', requiresAuth: false },
  '/trip-bucket': { path: '/trip-bucket', category: 'orchestration', title: 'Trip Bucket Workspace', expectedBehavior: 'drawer', requiresAuth: false },
  '/trip': { path: '/trip', category: 'orchestration', title: 'Trip Workspace', expectedBehavior: 'drawer', requiresAuth: false },
  '/favorites': { path: '/favorites', category: 'orchestration', title: 'Saved Favorites Drawer', expectedBehavior: 'drawer', requiresAuth: false },
  '/checkout': { path: '/checkout', category: 'checkout', title: 'Checkout & Trip Dossier Review', expectedBehavior: 'config_modal', requiresAuth: false },

  // 1b. B2B Partner Portal & Admin Operations
  '/partner': { path: '/partner', category: 'partner', title: 'B2B Partner Portal — Agency Operations', expectedBehavior: 'account_portal', requiresAuth: true },
  '/partner/clients': { path: '/partner/clients', category: 'partner', title: 'B2B Partner Client Roster', expectedBehavior: 'account_portal', requiresAuth: true },
  '/partner/quotes': { path: '/partner/quotes', category: 'partner', title: 'B2B Dynamic Quotes', expectedBehavior: 'account_portal', requiresAuth: true },
  '/partner/commissions': { path: '/partner/commissions', category: 'partner', title: 'B2B Commission Ledger', expectedBehavior: 'account_portal', requiresAuth: true },
  '/admin': { path: '/admin', category: 'admin', title: 'Vacatina Operations Backoffice', expectedBehavior: 'account_portal', requiresAuth: true },
  '/admin/triage': { path: '/admin/triage', category: 'admin', title: 'Operations Triage Queue', expectedBehavior: 'account_portal', requiresAuth: true },
  '/admin/listings': { path: '/admin/listings', category: 'admin', title: 'Manual Inventory CMS Manager', expectedBehavior: 'account_portal', requiresAuth: true },
  '/admin/pricing': { path: '/admin/pricing', category: 'admin', title: 'Pricing & Override Controls', expectedBehavior: 'account_portal', requiresAuth: true },
  '/admin/audit': { path: '/admin/audit', category: 'admin', title: 'Platform Audit Trail', expectedBehavior: 'account_portal', requiresAuth: true },

  // 2. 10 Product Hubs
  '/flights': { path: '/flights', category: 'product_hub', title: 'Flights Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'flights' },
  '/hotels': { path: '/hotels', category: 'product_hub', title: 'Hotels & Resort Stays Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'hotels' },
  '/visa-assistance': { path: '/visa-assistance', category: 'product_hub', title: 'Visa Assistance Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'visa' },
  '/holiday-packages': { path: '/holiday-packages', category: 'product_hub', title: 'Holiday Packages Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'packages' },
  '/cars-transfers': { path: '/cars-transfers', category: 'product_hub', title: 'Cars & Ground Mobility Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'cars' },
  '/activities': { path: '/activities', category: 'product_hub', title: 'Activities & Excursions Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'activities' },
  '/sightseeing-tours': { path: '/sightseeing-tours', category: 'product_hub', title: 'Sightseeing Tours Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'sightseeing' },
  '/rails': { path: '/rails', category: 'product_hub', title: 'Rail Journeys & Passes Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'rails' },
  '/cruises': { path: '/cruises', category: 'product_hub', title: 'Cruises & Maritime Voyages Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'cruises' },
  '/travel-insurance': { path: '/travel-insurance', category: 'product_hub', title: 'Travel Insurance Plans Product Hub', expectedBehavior: 'page_hub', requiresAuth: false, productType: 'insurance' },

  // 3. Search & Results Subroutes
  '/flights/search': { path: '/flights/search', category: 'search_results', title: 'Flights Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'flights' },
  '/hotels/search': { path: '/hotels/search', category: 'search_results', title: 'Hotels Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'hotels' },
  '/visa-assistance/options': { path: '/visa-assistance/options', category: 'search_results', title: 'Visa Assistance Filing Options', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'visa' },
  '/holiday-packages/search': { path: '/holiday-packages/search', category: 'search_results', title: 'Holiday Packages Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'packages' },
  '/cars-transfers/search': { path: '/cars-transfers/search', category: 'search_results', title: 'Ground Mobility Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'cars' },
  '/activities/search': { path: '/activities/search', category: 'search_results', title: 'Activities Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'activities' },
  '/sightseeing-tours/search': { path: '/sightseeing-tours/search', category: 'search_results', title: 'Sightseeing Tours Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'sightseeing' },
  '/rails/search': { path: '/rails/search', category: 'search_results', title: 'Rail Journeys Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'rails' },
  '/cruises/search': { path: '/cruises/search', category: 'search_results', title: 'Cruises Search Results', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'cruises' },
  '/travel-insurance/compare': { path: '/travel-insurance/compare', category: 'search_results', title: 'Compare Travel Insurance Plans', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'insurance' },

  // 4. Discovery Explore Pages
  '/flights/explore': { path: '/flights/explore', category: 'product_hub', title: 'Explore Passenger Flight Routes', expectedBehavior: 'page_hub', requiresAuth: false },
  '/hotels/explore': { path: '/hotels/explore', category: 'product_hub', title: 'Explore Curated Hotel Collections', expectedBehavior: 'page_hub', requiresAuth: false },
  '/travel-insurance/plans': { path: '/travel-insurance/plans', category: 'product_hub', title: 'Explore Travel Insurance Tiers', expectedBehavior: 'page_hub', requiresAuth: false },

  // 5. Canonical Resources Taxonomy (Locked Part 21)
  '/resources': { path: '/resources', category: 'resources', title: 'Vacatina Travel Resources Hub', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/travel-notes': { path: '/resources/travel-notes', category: 'resources', title: 'Travel Notes & Blog', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/destinations': { path: '/resources/destinations', category: 'resources', title: 'Destination Guides', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/seasonal-guide': { path: '/resources/seasonal-guide', category: 'resources', title: 'Seasonal Travel Guide', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/visa-requirements': { path: '/resources/visa-requirements', category: 'resources', title: 'Visa Requirement Checker', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/travel-insurance-guide': { path: '/resources/travel-insurance-guide', category: 'resources', title: 'Travel Insurance Guide', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/travel-disruption': { path: '/resources/travel-disruption', category: 'resources', title: 'Travel Disruption Guide', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/trip-bucket-guide': { path: '/resources/trip-bucket-guide', category: 'resources', title: 'Trip Bucket Guide', expectedBehavior: 'info_modal', requiresAuth: false },
  '/resources/booking-transparency': { path: '/resources/booking-transparency', category: 'resources', title: 'How We Compare Options & Price Transparency', expectedBehavior: 'info_modal', requiresAuth: false },

  // 6. Company Pages (Locked Part 22)
  '/about': { path: '/about', category: 'company', title: 'About Vacatina', expectedBehavior: 'info_modal', requiresAuth: false },
  '/careers': { path: '/careers', category: 'company', title: 'Careers at Vacatina', expectedBehavior: 'info_modal', requiresAuth: false },
  '/corporate-travel': { path: '/corporate-travel', category: 'company', title: 'Corporate & SME Travel Management', expectedBehavior: 'info_modal', requiresAuth: false },
  '/sustainability': { path: '/sustainability', category: 'company', title: 'Sustainability, Community & Care', expectedBehavior: 'info_modal', requiresAuth: false },
  '/press': { path: '/press', category: 'company', title: 'Press & Media Resources', expectedBehavior: 'info_modal', requiresAuth: false },
  '/why-vacatina': { path: '/why-vacatina', category: 'company', title: 'Why Choose Vacatina', expectedBehavior: 'info_modal', requiresAuth: false },
  '/partners': { path: '/partners', category: 'company', title: 'Partners & Certified Suppliers', expectedBehavior: 'info_modal', requiresAuth: false },

  // 7. Help & Support Pages (Locked Part 23)
  '/support': { path: '/support', category: 'support', title: 'Customer Support Desk', expectedBehavior: 'info_modal', requiresAuth: false },
  '/manage-booking': { path: '/manage-booking', category: 'support', title: 'Manage Existing Bookings', expectedBehavior: 'info_modal', requiresAuth: false },
  '/support/visa': { path: '/support/visa', category: 'support', title: 'Visa Document & Advisory Desk', expectedBehavior: 'info_modal', requiresAuth: false },
  '/help/faq': { path: '/help/faq', category: 'support', title: 'Frequently Asked Questions', expectedBehavior: 'info_modal', requiresAuth: false },
  '/policies/cancellations': { path: '/policies/cancellations', category: 'support', title: 'Cancellation, Rescheduling & Refund Policies', expectedBehavior: 'info_modal', requiresAuth: false },
  '/contact': { path: '/contact', category: 'support', title: 'Contact Global Operations', expectedBehavior: 'info_modal', requiresAuth: false },

  // 8. Account & Auth Pages (Locked Part 25)
  '/auth/sign-in': { path: '/auth/sign-in', category: 'account', title: 'Sign In to Vacatina Account', expectedBehavior: 'info_modal', requiresAuth: false },
  '/auth/sign-up': { path: '/auth/sign-up', category: 'account', title: 'Create Vacatina Traveller Account', expectedBehavior: 'info_modal', requiresAuth: false },
  '/account': { path: '/account', category: 'account', title: 'Account Overview', expectedBehavior: 'account_portal', requiresAuth: true },
  '/account/trips': { path: '/account/trips', category: 'account', title: 'My Trips & Bookings', expectedBehavior: 'account_portal', requiresAuth: true },
  '/account/visa-applications': { path: '/account/visa-applications', category: 'account', title: 'Visa Applications & Checklist', expectedBehavior: 'account_portal', requiresAuth: true },
  '/account/travelers': { path: '/account/travelers', category: 'account', title: 'Stored Co-Traveler Profiles', expectedBehavior: 'account_portal', requiresAuth: true },
  '/account/preferences': { path: '/account/preferences', category: 'account', title: 'Seat, Meal & Currency Preferences', expectedBehavior: 'account_portal', requiresAuth: true },

  // 9. Legal & Trust (Locked Part 2)
  '/legal/booking-conditions': { path: '/legal/booking-conditions', category: 'legal', title: 'Booking Conditions & Policies', expectedBehavior: 'info_modal', requiresAuth: false },
  '/legal/privacy': { path: '/legal/privacy', category: 'legal', title: 'Privacy Policy', expectedBehavior: 'info_modal', requiresAuth: false },
  '/legal/terms': { path: '/legal/terms', category: 'legal', title: 'Terms of Service', expectedBehavior: 'info_modal', requiresAuth: false },
  '/legal/cookies': { path: '/legal/cookies', category: 'legal', title: 'Cookie Preferences & Consent', expectedBehavior: 'info_modal', requiresAuth: false },
  '/legal/accessibility': { path: '/legal/accessibility', category: 'legal', title: 'Accessibility Statement', expectedBehavior: 'info_modal', requiresAuth: false },
  '/legal/security': { path: '/legal/security', category: 'legal', title: 'Security & Trust Disclosures', expectedBehavior: 'info_modal', requiresAuth: false }
};

export function isCanonicalRoute(path: string): boolean {
  if (CANONICAL_ROUTES[path]) return true;
  // Check parameterized paths
  if (path.startsWith('/partner')) return true;
  if (path.startsWith('/admin')) return true;
  if (path.startsWith('/checkout')) return true;
  if (path.startsWith('/bookings/')) return true;
  if (path.startsWith('/manage/')) return true;
  if (path.startsWith('/flights/offer/')) return true;
  if (path.startsWith('/hotels/property/')) return true;
  if (path.startsWith('/visa-assistance/')) return true;
  if (path.startsWith('/holiday-packages/')) return true;
  if (path.startsWith('/activities/')) return true;
  if (path.startsWith('/sightseeing-tours/')) return true;
  if (path.startsWith('/cruises/')) return true;
  if (path.startsWith('/rails/journeys/')) return true;
  if (path.startsWith('/travel-insurance/plans/')) return true;
  if (path.startsWith('/resources/travel-notes/')) return true;
  if (path.startsWith('/resources/destinations/')) return true;
  const genericOfferPrefixes = [
    '/cars-transfers/offer/',
    '/rails/offer/',
    '/cruises/offer/',
    '/activities/offer/',
    '/sightseeing-tours/offer/',
    '/travel-insurance/offer/'
  ];
  return genericOfferPrefixes.some(p => path.startsWith(p));
}

export function getRouteMeta(path: string): CanonicalRouteDefinition | undefined {
  if (CANONICAL_ROUTES[path]) return CANONICAL_ROUTES[path];
  if (path.startsWith('/flights/offer/')) {
    return { path, category: 'offer_config', title: 'Flight Offer Details & Fare Selection', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'flights' };
  }
  if (path.startsWith('/hotels/property/')) {
    const isCfg = path.endsWith('/configure');
    return { path, category: 'offer_config', title: isCfg ? 'Configure Hotel Room & Board' : 'Hotel Property Overview', expectedBehavior: 'config_modal', requiresAuth: false, productType: 'hotels' };
  }
  return undefined;
}
