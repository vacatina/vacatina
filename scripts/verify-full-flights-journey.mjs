/**
 * Real browser transition gate for the existing Vacatina Chrome/CDP E2E harness.
 * It clicks user-visible controls, rather than merely navigating to every route.
 * It must FAIL while the journey is incomplete. No backend operations permitted.
 */
export async function verifyFullFlightsJourney(cdp, assertCheck, report) {
  for (const width of [390, 1440]) {
    await cdp.setViewport(width, 900, width <= 767);
    const journey = await cdp.evaluate(`(async () => {
      const router = window.__VACATINA_ROUTER__;
      const os = window.__VACATINA_OS__;
      const log = [];
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const visible = el => !!el && !el.hidden && !el.closest('[hidden],.hidden,[aria-hidden="true"]');
      const select = (...selectors) => selectors.map(s => document.querySelector(s)).find(el => visible(el) && !el.disabled);
      const mark = (name, ok, detail = '') => { log.push({ name, pass: !!ok, detail }); return !!ok; };
      const waitFor = async (check, tries = 35) => {
        for (let i = 0; i < tries; i++) { if (check()) return true; await sleep(100); }
        return false;
      };
      const fill = (el, value) => {
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const pathIs = (p) => location.pathname === p;
      if (!router || !os?.tripBucketService) return [{name: 'Frontend bootstrapped', pass:false, detail:'Router or Trip Bucket missing'}];

      // Homepage entry must expose Flights visibly. A router-only route is insufficient.
      router.navigateTo('/');
      await sleep(140);
      const homepageEntry = select('a[href="/flights"]', 'a[href^="/flights?"]', '#tab-flights', '[data-product="flights"]');
      if (!mark('Homepage has a usable Flights entry', !!homepageEntry)) return log;
      homepageEntry.click();
      await sleep(120);
      if (!mark('Homepage Flights entry responds', pathIs('/flights') || pathIs('/flights/search') || !!document.getElementById('panel-flights'))) return log;

      // Build the search scene from a fictional, deterministic test request.
      // Only the test setup uses router navigation; all subsequent transitions use UI clicks.
      router.navigateTo('/flights/search?tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-15&returnDate=2026-11-22&adults=1&cabinClass=economy');
      if (!await waitFor(() => !!select('button[data-view-offer]'), 45)) {
        mark('Search Results provide a selectable offer', false, 'No selectable offer in fictional fixture');
        return log;
      }
      mark('Search Results provide a selectable offer', true);
      select('button[data-view-offer]').click();
      if (!await waitFor(() => visible(document.getElementById('flight-offer-detail-modal')))) {
        mark('Offer Details opens from selected result', false);
        return log;
      }
      mark('Offer Details opens from selected result', true);
      const modal = document.getElementById('flight-offer-detail-modal');
      modal?.querySelector('[data-family-select]')?.click();

      // The Trip Bucket path must continue all the way to a simulated result.
      const add = modal?.querySelector('#btn-modal-add-trip');
      if (!mark('Offer has Add to Trip action', !!add && !add.disabled)) return log;
      add.click();
      if (!await waitFor(() => os.tripBucketService.getItems().some(i => i.productType === 'flights'))) {
        mark('Selected flight enters Trip Bucket', false);
        return log;
      }
      mark('Selected flight enters Trip Bucket', true);
      modal?.querySelector('#btn-modal-close')?.click();
      const openBucket = select('#header-trip-bucket-btn', '#dock-review-trip-btn', '#mobile-summary-review-btn');
      if (!mark('Trip Bucket has an accessible entry', !!openBucket)) return log;
      openBucket.click();
      await sleep(120);
      const reviewBucket = select('#drawer-review-trip-cta');
      if (!mark('Trip Bucket has enabled Review action', !!reviewBucket)) return log;
      reviewBucket.click();
      await sleep(160);
      if (!mark('Trip Review opens from Trip Bucket', pathIs('/trip/review') || visible(document.querySelector('[data-trip-review],#trip-review-workspace,[role="dialog"]')))) return log;

      // Real transition must exist; do not use router.navigateTo to skip it.
      const passengerCta = select('a[href^="/flights/passengers"]','[data-continue-passengers]','[data-action="passengers"]');
      if (!mark('Review has a Passenger Details transition', !!passengerCta)) return log;
      passengerCta.click();
      if (!await waitFor(() => pathIs('/flights/passengers'))) {
        mark('Passenger Details opens from Review click', false);
        return log;
      }
      mark('Passenger Details opens from Review click', true);

      // Test with synthetic identities only. Never persist passport/payment data.
      if (!await waitFor(() => !!document.querySelector('[data-passenger="0"][data-field="firstName"]'))) {
        mark('Passenger form is usable', false);
        return log;
      }
      const passengerValues = {
        title:'Mr', firstName:'Sample', lastName:'Traveller', dateOfBirth:'1993-01-01',
        nationality:'Testland', passportNumber:'', passportExpiry:'', passportIssuingCountry:''
      };
      for (const [field, val] of Object.entries(passengerValues)) {
        fill(document.querySelector('[data-passenger="0"][data-field="' + field + '"]'), val);
      }
      fill(document.querySelector('[data-field="contact.email"]'), 'sample@example.invalid');
      fill(document.querySelector('[data-field="contact.phone"]'), '0000000000');
      fill(document.querySelector('[data-field="contact.phoneCountryCode"]'), '+94');
      const passengerContinue = select('[data-action="continue"]');
      if (!mark('Passenger form has Continue', !!passengerContinue)) return log;
      passengerContinue.click();
      if (!await waitFor(() => pathIs('/flights/review'))) {
        mark('Valid fictional Passenger Details advances to Flight Review', false, location.pathname);
        return log;
      }
      mark('Valid fictional Passenger Details advances to Flight Review', true);

      const checkoutCta = select('a[href^="/flights/checkout"]', '[data-continue-checkout]', '[data-action="checkout-preview"]');
      if (!mark('Flight Review has enabled Checkout Preview CTA', !!checkoutCta)) return log;
      checkoutCta.click();
      if (!await waitFor(() => pathIs('/flights/checkout'))) {
        mark('Checkout Preview opens from Review', false, location.pathname);
        return log;
      }
      mark('Checkout Preview opens from Review', true);
      const checkoutPreview = select('a[href^="/flights/confirmation"]', '[data-complete-preview]', '[data-action="simulate-checkout"]');
      if (!mark('Checkout Preview has simulated completion', !!checkoutPreview)) return log;
      checkoutPreview.click();
      if (!await waitFor(() => pathIs('/flights/confirmation'))) {
        mark('Simulated result reached from Checkout Preview', false, location.pathname);
        return log;
      }
      mark('Simulated result reached from Checkout Preview', true);
      const resultText = document.querySelector('#flights-view-mount')?.textContent?.toLowerCase() || '';
      mark('Result does not falsely claim an issued ticket', /simulat|preview|no booking|not confirmed|no ticket/.test(resultText));
      router.navigateTo('/');
      return log;
    })()`);

    // Independent Direct Booking route: this must NOT be silently treated as
    // an Add-to-Trip variant. Test the dedicated user-visible CTA separately.
    const direct = await cdp.evaluate(`(async () => {
      const router = window.__VACATINA_ROUTER__;
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const steps = [];
      const mark = (name, pass) => { steps.push({name, pass:!!pass}); return !!pass; };
      router.navigateTo('/flights/search?tripType=one_way&origin=CMB&destination=SIN&departureDate=2026-11-18&adults=1&cabinClass=economy');
      let offer = null;
      for (let i=0;i<45;i++) { offer=document.querySelector('button[data-view-offer]'); if(offer)break;await sleep(100); }
      if (!mark('Direct Booking: selectable offer', !!offer)) return steps;
      offer.click(); await sleep(160);
      const modal=document.getElementById('flight-offer-detail-modal');
      if (!mark('Direct Booking: offer opens', !!modal && !modal.classList.contains('hidden'))) return steps;
      modal.querySelector('[data-family-select]')?.click();
      const cta=modal.querySelector('#btn-modal-book-now,[data-direct-book],[data-book-now],[data-book-direct]');
      if (!mark('Direct Booking: dedicated Book Now CTA', !!cta && !cta.disabled)) return steps;
      const before = window.__VACATINA_OS__?.tripBucketService?.getItems()?.length;
      cta.click();
      for(let i=0;i<25 && location.pathname!=='/flights/passengers';i++)await sleep(100);
      mark('Direct Booking: Book Now advances without Trip Bucket',location.pathname==='/flights/passengers'
        && window.__VACATINA_OS__?.tripBucketService?.getItems()?.length===before);
      router.navigateTo('/');
      return steps;
    })()`);

    const passed = [...journey, ...direct].every((step) => step.pass);
    const failed = [...journey, ...direct].filter((step) => !step.pass).map((step) => step.name);
    assertCheck(`Flights full UI/UX journeys (Trip Bucket + Direct Book) @ ${width}px`, passed,
      JSON.stringify({steps: journey.length + direct.length, failed, journey, direct}));
    report.journeysVerified.push(`Flights full UI/UX journey @ ${width}px`);
  }
}
