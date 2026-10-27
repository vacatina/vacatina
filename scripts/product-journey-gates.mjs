/** Browser gates added incrementally at each local product checkpoint. */
export const GENERIC_PHASES = [
  { phase: 8, product: 'packages', route: '/holiday-packages', destination: 'Dubai' },
  { phase: 9, product: 'cars', route: '/cars-transfers', destination: 'Dubai' },
  { phase: 10, product: 'activities', route: '/activities', destination: 'Dubai' }
];

export async function verifyProductPhase(cdp, assertCheck, definition) {
  for (const width of [1440, 768, 360]) {
    await cdp.setViewport(width, width === 768 ? 1024 : 900, width < 1440);
    const result = await cdp.evaluate(`(async () => {
      const definition = ${JSON.stringify(definition)};
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const navigate = url => window.__VACATINA_ROUTER__.navigateTo(url);
      const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      document.getElementById('trip-bucket-close')?.click();
      const params = new URLSearchParams({ inventory:'demo',destination:definition.destination,origin:'Colombo',departureDate:'2027-02-01',returnDate:'2027-02-05',returnTime:'15:30',adults:'2',children:'0',infants:'0',rooms:'1',pickup:'Airport pickup request',dropoff:'Hotel drop-off request',pickupTime:'14:30',travellerAges:'32,30',residenceCountry:'LK',cabinClass:'standard',durationDays:'5' });
      navigate(definition.route + '?' + params); await wait(100);
      const hub = !!document.getElementById('journey-search-form') && fits();
      const searchForm = document.getElementById('journey-search-form');
      const destinationInput = searchForm?.querySelector('[name=destination]');
      if (destinationInput) destinationInput.value = '';
      searchForm?.requestSubmit(); await wait(80);
      const validation = !!document.querySelector('#journey-results [role=alert]');
      const retry = document.getElementById('journey-search-form');
      if (retry) retry.querySelector('[name=destination]').value = definition.destination;
      retry?.requestSubmit(); await wait(150);
      const button = document.querySelector('[data-journey-offer]');
      const search = !!button && fits() && document.getElementById('journey-results').textContent.includes('Canonical demo fixture');
      button?.click(); await wait(150);
      const configure = document.getElementById('journey-configure-form');
      const details = !!configure && fits() && document.getElementById('journey-product-workspace').textContent.includes('no live supplier');
      const labels = !!configure && Array.from(configure.querySelectorAll('input,select')).every(input => input.closest('label') || input.getAttribute('aria-label') || (input.id && document.querySelector('label[for="' + input.id + '"]')));
      configure?.querySelectorAll('select[name]').forEach(select => { if (!select.value) select.value = Array.from(select.options).find(option => option.value)?.value || ''; });
      const policy = document.getElementById('journey-policy-confirm'); if (policy) policy.checked = true;
      configure?.requestSubmit(); await wait(160);
      const item = window.__VACATINA_OS__.tripBucketService.getItems().find(i => i.productType === definition.product && i.offerId?.startsWith('DEMO-'));
      const staged = !!item && item.state === 'needs_action' && item.configuration.destination === definition.destination && item.configuration.departureDate === '2027-02-01' && item.sourceId === 'VACATINA_LOCAL_DEMO';
      const reviewLink = Array.from(document.querySelectorAll('#journey-configure-form a')).find(a => a.getAttribute('href') === '/trip/review');
      reviewLink?.click(); await wait(120);
      const review = !!document.getElementById('trip-review-workspace') && !!document.getElementById('btn-review-checkout')?.disabled && fits();
      navigate(definition.route + '/offer/DEMO-' + definition.product + '-missing?' + params); await wait(100);
      const invalid = !!document.querySelector('#journey-results [role=alert]');
      params.set('destination','No-Such-Destination'); navigate(definition.route + '/search?' + params); await wait(100);
      const empty = !!document.getElementById('journey-results')?.textContent.includes('No matching options right now');
      navigate('/'); return {hub,validation,search,details,labels,staged:!!staged,review,invalid,empty};
    })()`);
    assertCheck(`Phase ${definition.phase} ${definition.product} — canonical request journey, truth, keyboard controls and responsive @ ${width}`, Object.values(result).every(Boolean), JSON.stringify(result));
  }
}
export async function verifyVisa(cdp, assertCheck) {
  for (const width of [1440, 768, 360]) {
    await cdp.setViewport(width, width === 768 ? 1024 : 900, width < 1440);
    const result = await cdp.evaluate(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const navigate = url => window.__VACATINA_ROUTER__.navigateTo(url);
      const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      document.getElementById('trip-bucket-close')?.click();
      const query = 'destination=United+Arab+Emirates&citizenship=LK&residenceCountry=LK&departureDate=2027-02-01&purpose=tourism&applicants=2';
      navigate('/visa-assistance?' + query); await wait(100);
      const hub = !!document.querySelector('#visa-view-mount .visa-hub-page') && fits();
      document.getElementById('visa-hub-search-btn')?.click(); await wait(150);
      const search = !!document.querySelector('.visa-apply-btn') && fits() && location.search.includes('applicants=2') && document.getElementById('visa-view-mount').textContent.includes('Eligibility not verified');
      document.querySelector('.visa-apply-btn')?.click(); await wait(150);
      const modal = document.getElementById('visa-application-modal-overlay');
      const accessible = !!modal && modal.contains(document.activeElement) && modal.getAttribute('role') === 'dialog' && !modal.querySelector('[type=file]') && !modal.querySelector('#visa-app-passport') && fits();
      document.getElementById('visa-modal-stage-btn')?.click(); await wait(150);
      const item = window.__VACATINA_OS__.tripBucketService.getItems().filter(i => i.productType === 'visa' && i.inventoryMode).at(-1);
      const staged = !!item && item.state === 'needs_action' && item.configuration.adults === 2 && item.configuration.documentUploadState === 'NOT_UPLOADED';
      document.getElementById('drawer-review-trip-cta')?.click(); await wait(100);
      const review = !!document.querySelector('#trip-review-workspace [data-inventory-mode=demo_fixture]') && document.getElementById('btn-review-checkout')?.disabled && fits();
      navigate('/visa-assistance/apply/phase7-missing?' + query); await wait(100);
      const invalid = document.getElementById('visa-application-modal-overlay')?.getAttribute('role') === 'alertdialog';
      window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
      const escape = !document.getElementById('visa-application-modal-overlay');
      navigate('/visa-assistance/search?' + query.replace('United+Arab+Emirates','No-Such-Country')); await wait(150);
      const empty = document.getElementById('visa-results-count')?.dataset.resultsCount === '0';
      navigate('/'); return {hub,search,accessible,staged,review:!!review,invalid,escape,empty};
    })()`);
    assertCheck(`Visa Phase 7 — context, manual eligibility, no uploads, review and responsive @ ${width}`, Object.values(result).every(Boolean), JSON.stringify(result));
  }
}
export async function verifyHotels(cdp, assertCheck) {
  for (const width of [1440, 768, 360]) {
    await cdp.setViewport(width, width === 768 ? 1024 : 900, width < 1440);
    const result = await cdp.evaluate(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const navigate = url => window.__VACATINA_ROUTER__.navigateTo(url);
      const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      document.getElementById('trip-bucket-close')?.click();
      navigate('/hotels?destination=Bentota&checkIn=2027-02-01&checkOut=2027-02-04&rooms=2&adults=2&children=0'); await wait(120);
      const hub = document.querySelector('#hotels-view-mount .hotels-hub-root');
      const hubGood = !!hub && fits() && hub.textContent.includes('Canonical demo');
      hub?.querySelector('#hotel-hub-search-btn')?.click(); await wait(220);
      const context = location.search.includes('rooms=2') && location.search.includes('checkIn=2027-02-01');
      const button = document.querySelector('[data-open-hotel]');
      const resultsGood = !!button && fits() && document.getElementById('hotels-view-mount').textContent.includes('Canonical demo fixture');
      button?.click(); await wait(180);
      const modal = document.getElementById('hotel-property-detail-modal');
      const accessible = !!modal && modal.getAttribute('role') === 'dialog' && modal.contains(document.activeElement) && fits();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(50);
      const escape = !document.getElementById('hotel-property-detail-modal');
      button?.click(); await wait(150);
      document.querySelector('[data-select-room]')?.click(); await wait(180);
      const item = window.__VACATINA_OS__.tripBucketService.getItems().find(i => i.productType === 'hotels' && i.inventoryMode);
      const staged = !!item && item.state === 'needs_action' && item.configuration.roomsCount === 2 && item.configuration.checkInDate === '2027-02-01' && item.propertyId && item.ratePlanId;
      document.getElementById('drawer-review-trip-cta')?.click(); await wait(130);
      const review = document.getElementById('trip-review-workspace');
      const reviewed = !!review && review.textContent.includes('Canonical hotel demo fixture') && review.querySelector('#btn-review-checkout')?.disabled && fits();
      navigate('/hotels/property/phase6-missing'); await wait(130);
      const invalid = document.getElementById('hotel-invalid-dialog');
      const invalidGood = !!invalid && invalid.getAttribute('role') === 'alertdialog' && invalid.contains(document.activeElement);
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
      navigate('/hotels/search?destination=No-Such-Destination&checkIn=2027-02-01&checkOut=2027-02-04'); await wait(150);
      const empty = document.getElementById('hotel-results-count')?.dataset.resultsCount === '0';
      navigate('/');
      return {hubGood,context,resultsGood,accessible,escape,staged:!!staged,reviewed:!!reviewed,invalidGood,empty};
    })()`);
    assertCheck(`Hotels Phase 6 — search, room/rate, provenance, review, dialogs and responsive @ ${width}`, Object.values(result).every(Boolean), JSON.stringify(result));
  }
}
