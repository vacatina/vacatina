/* ============================================================================
 * Vacatina Canonical Architecture & Routing Transformer (scripts/apply-canonical-architecture.mjs)
 * Authority: Vacatina — Canonical Click-to-Destination & Resource Architecture v1.0
 *
 * Responsibilities:
 * 1. Rule 1: Zero '#' links, zero dead-ends, zero empty hrefs.
 * 2. Rule 3: Locked Desktop Global Navigation with canonical routes.
 * 3. Rule 21 & 22: Consolidate 3 taxonomies into canonical 8-item Resources menu.
 *    Remove About Us, FAQ, Contact Us from Resources.
 * 4. Rule 23 & 24: Decision Intelligence and Hero CTAs wired to /resources/seasonal-guide,
 *    /resources/booking-transparency, /trip-planner.
 * 5. Rule 25: Canonical 5-column footer structure with verified contact and social links.
 * 6. Rule 30: Mobile Navigation Drawer aligned with desktop.
 * 7. Rules 7-16: 40 Card discovery routes, CTAs, and section header links.
 * ============================================================================ */

export const CANONICAL_CARD_ROUTES = [
  // 1-4: Flights
  { index: 1, route: '/flights?from=CMB&to=DXB', ctaText: 'View Flights' },
  { index: 2, route: '/flights?from=CMB&to=MLE', ctaText: 'View Flights' },
  { index: 3, route: '/flights?from=CMB&to=BKK', ctaText: 'View Flights' },
  { index: 4, route: '/flights?from=CMB&to=LHR', ctaText: 'View Flights' },
  // 5-8: Visa Assistance
  { index: 5, route: '/visa-assistance/uae', ctaText: 'Check Requirements' },
  { index: 6, route: '/visa-assistance/uk', ctaText: 'Check Requirements' },
  { index: 7, route: '/visa-assistance/thailand', ctaText: 'Check Requirements' },
  { index: 8, route: '/visa-assistance/singapore', ctaText: 'Check Requirements' },
  // 9-12: Holiday Packages
  { index: 9, route: '/holiday-packages/maldives-luxury-escape', ctaText: 'View Package Details' },
  { index: 10, route: '/holiday-packages/dubai-skyline-desert', ctaText: 'View Package Details' },
  { index: 11, route: '/holiday-packages/bali-cultural-retreat', ctaText: 'View Package Details' },
  { index: 12, route: '/holiday-packages/thailand-island-hopper', ctaText: 'View Package Details' },
  // 13-16: Hotels
  { index: 13, route: '/hotels?destination=Maldives', ctaText: 'Explore Hotels' },
  { index: 14, route: '/hotels?destination=Dubai', ctaText: 'Explore Hotels' },
  { index: 15, route: '/hotels?destination=Sri%20Lanka', ctaText: 'Explore Hotels' },
  { index: 16, route: '/hotels?destination=Bali', ctaText: 'Explore Hotels' },
  // 17-20: Activities
  { index: 17, route: '/activities/maldives-snorkelling-reef', ctaText: 'Explore Activity' },
  { index: 18, route: '/activities/dubai-desert-safari', ctaText: 'Explore Activity' },
  { index: 19, route: '/activities/bentota-mangrove-boat-safari', ctaText: 'Explore Activity' },
  { index: 20, route: '/activities/bali-ubud-swing-waterfall', ctaText: 'Explore Activity' },
  // 21-24: Sightseeing
  { index: 21, route: '/sightseeing-tours/sigiriya-ancient-fortress', ctaText: 'View Tour Details' },
  { index: 22, route: '/sightseeing-tours/bangkok-grand-palace', ctaText: 'View Tour Details' },
  { index: 23, route: '/sightseeing-tours/london-historic-landmarks', ctaText: 'View Tour Details' },
  { index: 24, route: '/sightseeing-tours/singapore-gardens-by-the-bay', ctaText: 'View Tour Details' },
  // 25-28: Cars & Transfers
  { index: 25, route: '/cars-transfers?destination=Dubai', ctaText: 'Explore Transfer' },
  { index: 26, route: '/cars-transfers?destination=London', ctaText: 'Explore Transfer' },
  { index: 27, route: '/cars-transfers?destination=Sri%20Lanka', ctaText: 'Explore Car Hire' },
  { index: 28, route: '/cars-transfers?destination=Bangkok', ctaText: 'Explore Transfer' },
  // 29-32: Cruises
  { index: 29, route: '/cruises/dubai-arabian-gulf', ctaText: 'Explore Cruise' },
  { index: 30, route: '/cruises/singapore-southeast-asia', ctaText: 'Explore Cruise' },
  { index: 31, route: '/cruises/mediterranean-classic', ctaText: 'Explore Cruise' },
  { index: 32, route: '/cruises/indian-ocean-expedition', ctaText: 'Explore Cruise' },
  // 33-36: Rails
  { index: 33, route: '/rails?from=London&to=Paris', ctaText: 'Explore Rail Journey' },
  { index: 34, route: '/rails?from=Tokyo&to=Kyoto', ctaText: 'Explore Rail Journey' },
  { index: 35, route: '/rails?from=Kandy&to=Ella', ctaText: 'Explore Rail Journey' },
  { index: 36, route: '/rails/journeys/swiss-alps', ctaText: 'Explore Rail Journey' },
  // 37-40: Travel Insurance
  { index: 37, route: '/travel-insurance/plans/single-trip-essential', ctaText: 'Explore Cover' },
  { index: 38, route: '/travel-insurance/plans/comprehensive-worldwide', ctaText: 'Explore Cover' },
  { index: 39, route: '/travel-insurance/plans/family-multi-trip', ctaText: 'Explore Cover' },
  { index: 40, route: '/travel-insurance/plans/annual-multi-trip', ctaText: 'Explore Cover' }
];

export function applyCanonicalArchitecture(html) {
  let out = html;

  // 1. Desktop Navigation Header Links & Resources Dropdown (Rules 3, 21, 22)
  const canonicalDesktopNav = `<nav class="desktop-nav items-center gap-0.5 xl:gap-1 flex-shrink-0" aria-label="Primary Desktop Navigation">
  <a href="/" class="px-2 py-1.5 text-[13px] font-semibold text-brand-primary rounded-lg transition-colors">Home</a>
  <a href="/flights" class="px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg transition-colors">Flights</a>
  <a href="/hotels" class="px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg transition-colors">Hotels</a>
  <a href="/visa-assistance" class="px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg transition-colors">Visa Assistance</a>
  <a href="/holiday-packages" class="px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg transition-colors">Holiday Packages</a>
  <a href="/cars-transfers" class="px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg transition-colors">Cars &amp; Transfers</a>
  <div class="relative py-2" id="more-dropdown-container">
    <button type="button" id="more-dropdown-btn" class="flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg focus:outline-none" aria-expanded="false" aria-haspopup="true" aria-controls="more-dropdown-menu">
      <span>More</span>
      <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </button>
    <div id="more-dropdown-menu" class="hidden absolute top-full left-0 w-56 pt-2 z-50">
      <div class="bg-white border border-brand-border rounded-xl shadow-lg py-2">
        <a href="/activities" class="block px-4 py-2 text-[13px] font-medium text-brand-black hover:bg-brand-subtle">Activities</a>
        <a href="/sightseeing-tours" class="block px-4 py-2 text-[13px] font-medium text-brand-black hover:bg-brand-subtle">Sightseeing Tours</a>
        <a href="/rails" class="block px-4 py-2 text-[13px] font-medium text-brand-black hover:bg-brand-subtle">Rails</a>
        <a href="/cruises" class="block px-4 py-2 text-[13px] font-medium text-brand-black hover:bg-brand-subtle">Cruises</a>
        <a href="/travel-insurance" class="block px-4 py-2 text-[13px] font-medium text-brand-black hover:bg-brand-subtle">Travel Insurance</a>
      </div>
    </div>
  </div>
  <div class="relative py-2" id="resources-dropdown-container">
    <button type="button" id="resources-dropdown-btn" class="flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium text-brand-muted hover:text-brand-primary rounded-lg focus:outline-none" aria-expanded="false" aria-haspopup="true" aria-controls="resources-dropdown-menu">
      <span>Resources</span>
      <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </button>
    <div id="resources-dropdown-menu" class="hidden absolute top-full left-0 w-64 pt-2 z-50">
      <div class="bg-white border border-brand-border rounded-xl shadow-lg py-2 text-xs">
        <a href="/resources/travel-notes" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Travel Notes &amp; Blog</a>
        <a href="/resources/destinations" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Destination Guides</a>
        <a href="/resources/seasonal-guide" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Seasonal Travel Guide</a>
        <a href="/resources/visa-requirements" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Visa Requirement Checker</a>
        <a href="/resources/travel-insurance-guide" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Travel Insurance Guide</a>
        <a href="/resources/travel-disruption" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Travel Disruption Guide</a>
        <a href="/resources/trip-bucket-guide" class="block px-4 py-2 font-medium text-brand-black hover:bg-brand-subtle">Trip Bucket Guide</a>
        <div class="border-t border-brand-border mt-1 pt-1">
          <a href="/resources" class="block px-4 py-2 font-bold text-brand-primary hover:bg-brand-subtle">View All Resources</a>
        </div>
      </div>
    </div>
  </div>
</nav>`;

  out = out.replace(/<nav class="desktop-nav[\s\S]*?<\/nav>/, canonicalDesktopNav);

  // Logo link: <a href="/" ...>
  out = out.replace(
    /<a href="#" class="flex items-center flex-shrink-0 group focus:outline-none" aria-label="Vacatina Homepage">/,
    '<a href="/" class="flex items-center flex-shrink-0 group focus:outline-none" aria-label="Vacatina Homepage">'
  );

  // Favorites button in header: link to /favorites
  out = out.replace(
    /<button type="button" class="hidden xl:flex p-2 text-brand-muted hover:text-brand-primary rounded-lg hover:bg-brand-subtle" aria-label="Saved Favorites">[\s\S]*?<\/button>/,
    `<a href="/favorites" id="header-favorites-btn" class="hidden xl:flex p-2 text-brand-muted hover:text-brand-primary rounded-lg hover:bg-brand-subtle" aria-label="Saved Favorites">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  // Header Auth Cluster: Sign In / Sign Up links to /auth/sign-in & /auth/sign-up
  out = out.replace(
    /<div class="hidden min-\[1440px\]:flex items-center gap-1\.5 border-l border-brand-border pl-2\.5">[\s\S]*?<\/div>/,
    `<div class="hidden min-[1440px]:flex items-center gap-1.5 border-l border-brand-border pl-2.5" id="guest-state-controls">
      <a href="/auth/sign-in" id="header-sign-in-btn" class="text-[12.5px] font-semibold text-brand-black hover:text-brand-primary px-1.5 py-1">Sign In</a>
      <a href="/auth/sign-up" id="header-sign-up-btn" class="bg-brand-primary text-white text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg hover:opacity-90 inline-block">Sign Up</a>
    </div>`
  );

  // 2. Hero Ask Vacatina Plan My Trip Button (Rule 6)
  out = out.replace(
    /<button type="button" class="w-full sm:w-auto bg-white text-brand-primary font-semibold text-\[13px\] px-5 py-2\.5 rounded-xl whitespace-nowrap">\s*Plan My Trip\s*<\/button>/,
    `<a href="/trip-planner?prompt=Plan%205%20days%20in%20Dubai%20with%20flights%2C%20hotel%20and%20visa" id="hero-plan-btn" class="w-full sm:w-auto bg-white text-brand-primary font-semibold text-[13px] px-5 py-2.5 rounded-xl whitespace-nowrap text-center inline-block">
      Plan My Trip
    </a>`
  );

  // Hero Value Propositions links (Rule 23 & 24)
  out = out.replace(
    '<div class="flex items-center gap-1.5">\n          <span class="">⌕ Compare options</span>\n        </div>',
    '<a href="/resources/booking-transparency" class="flex items-center gap-1.5 hover:text-white transition-colors"><span>⌕ Compare options</span></a>'
  );
  out = out.replace(
    '<div class="flex items-center gap-1.5">\n          <span class="">◇ Transparent pricing</span>\n        </div>',
    '<a href="/resources/booking-transparency" class="flex items-center gap-1.5 hover:text-white transition-colors"><span>◇ Transparent pricing</span></a>'
  );
  out = out.replace(
    '<div class="flex items-center gap-1.5">\n          <span class="">✓ One place for your trip</span>\n        </div>',
    '<a href="/resources/trip-bucket-guide" class="flex items-center gap-1.5 hover:text-white transition-colors"><span>✓ One place for your trip</span></a>'
  );

  // 3. Decision Intelligence Section CTAs (Rule 24)
  out = out.replace(
    /<span class="font-semibold text-brand-primary">Explore Seasonal Guide\s*<\/span>/,
    '<a href="/resources/seasonal-guide" class="font-semibold text-brand-primary hover:underline inline-flex items-center gap-1">Explore Seasonal Guide <span aria-hidden="true">&rarr;</span></a>'
  );
  out = out.replace(
    /<span class="font-semibold text-brand-primary">Review Protocols\s*<\/span>/,
    '<a href="/resources/booking-transparency" class="font-semibold text-brand-primary hover:underline inline-flex items-center gap-1">How We Compare Options <span aria-hidden="true">&rarr;</span></a>'
  );

  // Also replace Decision Intelligence card label "REVIEW PROTOCOLS" or "COMPARISON PROTOCOL"
  out = out.replace(
    'DECISION INTELLIGENCE · COMPARISON PROTOCOL',
    'DECISION INTELLIGENCE · BOOKING TRANSPARENCY'
  );

  // 4. Section Heading "View All" Links (Rules 7-16)
  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="viewAllFlights\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/flights/explore" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all flights</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="viewAllVisaServices\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/visa-assistance" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all visa services</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllHolidayPackages\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/holiday-packages" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>Explore all packages</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllHotels\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/hotels/explore" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all hotels</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllActivities\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/activities" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all activities</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllSightseeingTours\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/sightseeing-tours" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all sightseeing tours</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllCarsTransfers\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/cars-transfers" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all cars &amp; transfers</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllCruises\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/cruises" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all cruises</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllRailJourneys\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/rails" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all rail journeys</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  out = out.replace(
    /<button class="text-brand-primary font-semibold text-\[13px\] sm:text-\[14px\] inline-flex items-center gap-1\.5 hover:underline whitespace-nowrap[^>]*onclick="exploreAllInsurance\(\)"[^>]*>[\s\S]*?<\/button>/,
    `<a href="/travel-insurance/plans" class="text-brand-primary font-semibold text-[13px] sm:text-[14px] inline-flex items-center gap-1.5 hover:underline whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg p-1 min-h-[44px]">
      <span>View all insurance options</span>
      <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </a>`
  );

  // 5. Canonical Footer Architecture (Rules 21, 22, 25)
  const canonicalFooterColumns = `<!-- Col 2: Products (10 Travel Products) -->
      <div class="space-y-2">
        <h4 class="font-heading font-bold text-white text-sm">Products</h4>
        <ul class="space-y-1.5 text-white/70 text-[11px]">
          <li><a href="/flights" class="hover:text-white transition-colors">Flights</a></li>
          <li><a href="/hotels" class="hover:text-white transition-colors">Hotels</a></li>
          <li><a href="/visa-assistance" class="hover:text-white transition-colors">Visa Assistance</a></li>
          <li><a href="/holiday-packages" class="hover:text-white transition-colors">Holiday Packages</a></li>
          <li><a href="/cars-transfers" class="hover:text-white transition-colors">Cars &amp; Transfers</a></li>
          <li><a href="/rails" class="hover:text-white transition-colors">Rails</a></li>
          <li><a href="/cruises" class="hover:text-white transition-colors">Cruises</a></li>
          <li><a href="/activities" class="hover:text-white transition-colors">Activities</a></li>
          <li><a href="/sightseeing-tours" class="hover:text-white transition-colors">Sightseeing Tours</a></li>
          <li><a href="/travel-insurance" class="hover:text-white transition-colors">Travel Insurance</a></li>
        </ul>
      </div>

      <!-- Col 3: Resources (Canonical 8 Items) -->
      <div class="space-y-2">
        <h4 class="font-heading font-bold text-white text-sm">Resources</h4>
        <ul class="space-y-1.5 text-white/70 text-[11px]">
          <li><a href="/resources/travel-notes" class="hover:text-white transition-colors">Travel Notes &amp; Blog</a></li>
          <li><a href="/resources/destinations" class="hover:text-white transition-colors">Destination Guides</a></li>
          <li><a href="/resources/seasonal-guide" class="hover:text-white transition-colors">Seasonal Travel Guide</a></li>
          <li><a href="/resources/visa-requirements" class="hover:text-white transition-colors">Visa Requirement Checker</a></li>
          <li><a href="/resources/travel-insurance-guide" class="hover:text-white transition-colors">Travel Insurance Guide</a></li>
          <li><a href="/resources/travel-disruption" class="hover:text-white transition-colors">Travel Disruption Guide</a></li>
          <li><a href="/resources/trip-bucket-guide" class="hover:text-white transition-colors">Trip Bucket Guide</a></li>
          <li><a href="/resources" class="hover:text-white transition-colors font-semibold text-white/90">View All Resources</a></li>
        </ul>
      </div>

      <!-- Col 4: Company -->
      <div class="space-y-2">
        <h4 class="font-heading font-bold text-white text-sm">Company</h4>
        <ul class="space-y-1.5 text-white/70 text-[11px]">
          <li><a href="/about" class="hover:text-white transition-colors">About Vacatina</a></li>
          <li><a href="/why-vacatina" class="hover:text-white transition-colors">Why Vacatina</a></li>
          <li><a href="/careers" class="hover:text-white transition-colors">Careers</a></li>
          <li><a href="/press" class="hover:text-white transition-colors">Press &amp; Media</a></li>
          <li><a href="/partners" class="hover:text-white transition-colors">Partners &amp; Suppliers</a></li>
        </ul>
      </div>

      <!-- Col 5: Support & Legal -->
      <div class="space-y-2">
        <h4 class="font-heading font-bold text-white text-sm">Support &amp; Legal</h4>
        <ul class="space-y-1.5 text-white/70 text-[11px]">
          <li><a href="/help/faq" class="hover:text-white transition-colors">Help &amp; FAQ</a></li>
          <li><a href="/contact" class="hover:text-white transition-colors">Contact Us</a></li>
          <li><a href="/legal/booking-conditions" class="hover:text-white transition-colors">Booking Conditions</a></li>
          <li><a href="/resources/booking-transparency" class="hover:text-white transition-colors">How We Compare Options</a></li>
          <li><a href="/legal/privacy" data-legal-modal="privacy" class="hover:text-white transition-colors">Privacy Policy</a></li>
          <li><a href="/legal/terms" data-legal-modal="terms" class="hover:text-white transition-colors">Terms of Service</a></li>
          <li><a href="#" data-legal-modal="cookies" class="hover:text-white transition-colors">Cookie Preferences</a></li>
        </ul>
      </div>`;

  const footerColsRegex = /<!-- Col 2: Products[\s\S]*?<!-- Col 5: Resources & Legal[\s\S]*?<\/div>/;
  out = out.replace(footerColsRegex, canonicalFooterColumns);

  // Legal bar in footer: real links
  const canonicalLegalBar = `<div class="flex flex-wrap items-center gap-4">
        <a href="/legal/privacy" data-legal-modal="privacy" class="hover:text-white transition-colors">Privacy Policy</a>
        <a href="/legal/terms" data-legal-modal="terms" class="hover:text-white transition-colors">Terms of Service</a>
        <a href="#" data-legal-modal="cookies" class="hover:text-white transition-colors">Cookie Preferences</a>
        <a href="/legal/accessibility" data-legal-modal="accessibility" class="hover:text-white transition-colors">Accessibility Statement</a>
        <a href="/legal/security" data-legal-modal="security" class="hover:text-white transition-colors">Security &amp; Trust</a>
      </div>`;
  out = out.replace(/<div class="flex flex-wrap items-center gap-4">[\s\S]*?<\/div>/, canonicalLegalBar);

  // 6. Mobile Navigation Drawer (Rule 30)
  const canonicalMobileDrawer = `<div class="flex-1 overflow-y-auto p-5 space-y-4">
        <div class="space-y-1">
          <a href="/" class="block px-3 py-2 text-sm font-semibold text-brand-primary rounded-lg bg-brand-subtle">Home</a>
          <a href="/flights" class="block px-3 py-2 text-sm font-medium text-brand-muted hover:text-brand-primary rounded-lg">Flights</a>
          <a href="/hotels" class="block px-3 py-2 text-sm font-medium text-brand-muted hover:text-brand-primary rounded-lg">Hotels</a>
          <a href="/visa-assistance" class="block px-3 py-2 text-sm font-medium text-brand-muted hover:text-brand-primary rounded-lg">Visa Assistance</a>
          <a href="/holiday-packages" class="block px-3 py-2 text-sm font-medium text-brand-muted hover:text-brand-primary rounded-lg">Holiday Packages</a>
          <a href="/cars-transfers" class="block px-3 py-2 text-sm font-medium text-brand-muted hover:text-brand-primary rounded-lg">Cars &amp; Transfers</a>
        </div>
        <div class="border-t border-brand-border pt-2">
          <button type="button" id="mobile-more-toggle" class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-brand-black rounded-lg hover:bg-brand-subtle focus:outline-none" aria-expanded="false" aria-controls="mobile-more-submenu">
            <span>More Products (5)</span>
            <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
          <div id="mobile-more-submenu" class="hidden space-y-1 pl-4 pt-1">
            <a href="/activities" class="block px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-primary rounded-lg">Activities</a>
            <a href="/sightseeing-tours" class="block px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-primary rounded-lg">Sightseeing Tours</a>
            <a href="/rails" class="block px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-primary rounded-lg">Rails</a>
            <a href="/cruises" class="block px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-primary rounded-lg">Cruises</a>
            <a href="/travel-insurance" class="block px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-primary rounded-lg">Travel Insurance</a>
          </div>
        </div>
        <div class="border-t border-brand-border pt-2">
          <button type="button" id="mobile-resources-toggle" class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-brand-black rounded-lg hover:bg-brand-subtle focus:outline-none" aria-expanded="false" aria-controls="mobile-resources-submenu">
            <span>Resources</span>
            <svg class="w-4 h-4 text-brand-muted transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
          <div id="mobile-resources-submenu" class="hidden space-y-1 pl-4 pt-1 text-xs">
            <a href="/resources/travel-notes" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Travel Notes &amp; Blog</a>
            <a href="/resources/destinations" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Destination Guides</a>
            <a href="/resources/seasonal-guide" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Seasonal Travel Guide</a>
            <a href="/resources/visa-requirements" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Visa Requirement Checker</a>
            <a href="/resources/travel-insurance-guide" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Travel Insurance Guide</a>
            <a href="/resources/travel-disruption" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Travel Disruption Guide</a>
            <a href="/resources/trip-bucket-guide" class="block px-3 py-1.5 font-medium text-brand-muted hover:text-brand-primary rounded-lg">Trip Bucket Guide</a>
            <a href="/resources" class="block px-3 py-1.5 font-semibold text-brand-primary hover:bg-brand-subtle rounded-lg">View All Resources</a>
          </div>
        </div>
      </div>
      <div class="p-5 border-t border-brand-border bg-brand-canvas space-y-2">
        <a href="/auth/sign-up" class="block text-center w-full bg-brand-primary text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90">Sign Up</a>
        <a href="/auth/sign-in" class="block text-center text-xs font-semibold text-brand-black py-1.5 hover:text-brand-primary">Sign In</a>
      </div>`;

  out = out.replace(
    /<div class="flex-1 overflow-y-auto p-5 space-y-4">[\s\S]*?<div class="p-5 border-t border-brand-border bg-brand-canvas space-y-2">[\s\S]*?<\/div>/,
    canonicalMobileDrawer
  );

  // 7. Apply Canonical Routes to All 40 Cards
  out = applyCardRoutesToHtml(out);

  return out;
}

function applyCardRoutesToHtml(html) {
  let cardIdx = 0;
  return html.replace(/<article[\s\S]*?<\/article>/g, articleHtml => {
    cardIdx++;
    const config = CANONICAL_CARD_ROUTES[cardIdx - 1];
    if (!config) return articleHtml;

    let updated = articleHtml;

    // 1. Wrap Title <h3> in canonical link if not already linked
    updated = updated.replace(
      /<h3 class="([^"]*)">\s*([\s\S]*?)\s*<\/h3>/,
      (match, h3Class, innerText) => {
        if (innerText.includes('<a ')) return match;
        return `<h3 class="${h3Class}"><a href="${config.route}" class="hover:text-brand-primary transition-colors">${innerText}</a></h3>`;
      }
    );

    // 2. Replace Primary CTA button with <a> link
    // Match the primary CTA button at the bottom of the card (excluding favorite button)
    updated = updated.replace(
      /<button([^>]*?)class="w-full bg-brand-primary[^"]*"([^>]*?)>([\s\S]*?)<\/button>/,
      (match, beforeAttrs, afterAttrs, btnLabel) => {
        const text = config.ctaText || btnLabel.trim();
        return `<a href="${config.route}" class="w-full bg-brand-primary hover:opacity-90 text-white text-[13px] font-semibold min-h-[44px] py-2.5 px-4 rounded-xl transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary flex items-center justify-center text-center">${text}</a>`;
      }
    );

    return updated;
  });
}
