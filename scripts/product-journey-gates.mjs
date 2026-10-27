/** Browser gates added incrementally at each local product checkpoint. */
export async function verifyGlobalIntegration(cdp, assertCheck) {
  for (const width of [1440, 768, 360]) {
    await cdp.setViewport(width, width === 768 ? 1024 : 900, width < 1440);
    const scc = await cdp.evaluate(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const router = window.__VACATINA_ROUTER__;
      const original = router.navigateTo;
      let navigations = 0;
      router.navigateTo = function(...args) { navigations++; return original.apply(this,args); };
      const cases = [
        ['bundle','/trip-builder',{origin:'Colombo (CMB)',destination:'Dubai',dateWindow:'01 Feb 2027 – 05 Feb 2027'}],
        ['flights','/flights',{from:'Colombo (CMB)',to:'Dubai (DXB)',departureDate:'01 Feb 2027',returnDate:'05 Feb 2027'}],
        ['hotels','/hotels',{destination:'Bentota',checkIn:'01 Feb 2027',checkOut:'05 Feb 2027'}],
        ['visa','/visa-assistance',{country:'United Arab Emirates',citizenship:'Sri Lanka (LKA)',residence:'Sri Lanka',travelDate:'01 Feb 2027',purpose:'Tourism / Leisure'}],
        ['packages','/holiday-packages',{destination:'Dubai',departureCity:'Colombo',travelWindow:'February 2027',packageType:'Custom holiday request'}],
        ['cars','/cars-transfers',{serviceType:'Airport Transfer',pickup:'Dubai airport',dropoff:'Dubai Marina',pickupDateTime:'01 Feb 2027 · 14:30'}],
        ['rails','/rails',{fromStation:'Colombo',toStation:'Kandy',departureDate:'01 Feb 2027',railClass:'Standard Class'}],
        ['cruises','/cruises',{region:'Mediterranean',departurePort:'Port preference',travelWindow:'Spring 2027',cabinPreference:'Balcony request',duration:'7 nights requested'}],
        ['activities','/activities',{destination:'Dubai',date:'01 Feb 2027',category:'Experience request'}],
        ['sightseeing','/sightseeing-tours',{destination:'London',date:'01 Feb 2027',tourType:'Guided tour request'}],
        ['insurance','/travel-insurance',{region:'Worldwide',residence:'Sri Lanka',tripStart:'01 Feb 2027',tripEnd:'05 Feb 2027',coverageType:'Policy review request'}]
      ];
      const results=[];
      const setField=(tab,key,value) => {
        const el=document.querySelector('[data-scc-tab="'+tab+'"][data-scc-field="'+key+'"]');
        if (!el) return false; el.textContent=value; el.dispatchEvent(new FocusEvent('blur')); return true;
      };
      try {
        window.__VACATINA_OS__.searchCommandService.updateTravellers({adults:2,children:0,infants:0,rooms:1});
        for (const [tab,route,fields] of cases) {
          router.navigateTo('/'); await wait(60);
          document.getElementById('trip-bucket-close')?.click();
          document.getElementById('tab-'+tab)?.click();
          if(tab==='flights') document.querySelector('#panel-flights [role=radio]')?.click();
          const selected=document.getElementById('tab-'+tab)?.getAttribute('aria-selected')==='true';
          const panel=document.getElementById('panel-'+tab);
          const active=!!panel&&!panel.classList.contains('hidden');
          const fieldsBound=Object.entries(fields).every(([key,value])=>setField(tab,key,value));
          const first=Object.keys(fields)[0]; setField(tab,first,'');
          navigations=0; document.querySelector('[data-scc-submit="'+tab+'"]')?.click(); await wait(25);
          const rejected=navigations===0&&location.pathname==='/';
          setField(tab,first,fields[first]); navigations=0;
          document.querySelector('[data-scc-submit="'+tab+'"]')?.click(); await wait(180);
          const singleHandler=navigations===1;
          const correctRoute=location.pathname.startsWith(route)&&!location.pathname.includes('checkout');
          const query=new URLSearchParams(location.search);
          const context=query.get('adults')==='2'&&(tab==='bundle'||query.has('destination'));
          const usable=!!document.querySelector('#journey-product-workspace,#flights-view-mount:not(.hidden),#hotels-view-mount:not(.hidden),#visa-view-mount:not(.hidden),#bundle-workspace');
          const fits=document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;
          let bundleOrchestration=true;
          if(tab==='bundle') {
            document.querySelector('[data-bundle-search=flights]')?.click(); await wait(150);
            bundleOrchestration=location.pathname==='/flights'&&!document.querySelector('#btn-review-checkout:not([disabled])');
          }
          results.push({tab,selected,active,fieldsBound,rejected,singleHandler,correctRoute,context,usable,fits,bundleOrchestration});
        }
      } finally {router.navigateTo=original; router.navigateTo('/');}
      return results;
    })()`);
    assertCheck(`Global SCC — all 11 tabs validate and preserve intent without duplicate handlers @ ${width}`, scc.length === 11 && scc.every(result => Object.entries(result).every(([key,value]) => key === 'tab' || value === true)), JSON.stringify(scc));

    const mixed = await cdp.evaluate(`(async () => {
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const bucket=window.__VACATINA_OS__.tripBucketService;
      const before=bucket.getItems();
      const configs=Object.fromEntries(before.map(item=>[item.id,JSON.stringify(item.configuration||{})]));
      window.__VACATINA_ROUTER__.navigateTo('/trip/review'); await wait(80);
      const types=new Set(before.map(item=>item.productType));
      const review=document.getElementById('trip-review-workspace');
      const provenance=!!review&&review.querySelectorAll('[data-review-item-id]').length===before.length&&review.textContent.includes('Canonical offer')&&review.textContent.includes('Quote required');
      document.getElementById('btn-review-open-bucket')?.click(); await wait(100);
      const panel=document.getElementById('trip-bucket-drawer')?.getBoundingClientRect();
      const drawerFits=!!panel&&panel.left>=-1&&panel.right<=innerWidth+1&&panel.bottom<=innerHeight+1;
      const dockHidden=document.getElementById('floating-trip-dock')?.style.pointerEvents==='none';
      document.getElementById('drawer-revalidate-btn')?.click(); await wait(300);
      const after=bucket.getItems();
      const productChecks=after.every(item=>item.revalidationStatus&&item.revalidatedAt&&item.state!=='ready');
      const identity=after.length===before.length&&after.every(item=>configs[item.id]===JSON.stringify(item.configuration||{}));
      document.getElementById('drawer-review-trip-cta')?.click(); await wait(120);
      const refreshed=document.getElementById('trip-review-workspace');
      refreshed?.querySelector('[data-review-request]')?.click(); await wait(70);
      const blocked=!!document.getElementById('btn-review-checkout')?.disabled&&bucket.getItems().every(item=>item.state!=='ready');
      const fits=document.documentElement.scrollWidth<=document.documentElement.clientWidth+1;
      const shell=!!document.getElementById('site-header')&&!!document.querySelector('footer');
      return {all10Types:types.size===10,provenance,drawerFits,dockHidden,productChecks,identity,blocked,fits,shell};
    })()`);
    assertCheck(`Global mixed-product Trip Bucket — source, configuration, product-aware revalidation, review and gate @ ${width}`, Object.values(mixed).every(Boolean), JSON.stringify(mixed));
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo('/trip/review'); window.scrollTo({top:0,behavior:'instant'});`);
    await new Promise(resolve=>setTimeout(resolve,80));
    await cdp.captureScreenshot(`vacatina_b2c_mixed_review_${width}px.png`);
  }

  // Real Tab key events, not just a scan of tabindex attributes.
  const products = [
    { route:'/flights', selector:'#flights-view-mount', query:'origin=CMB&destination=DXB&departureDate=2027-02-01&returnDate=2027-02-05' },
    { route:'/hotels', selector:'#hotels-view-mount', query:'destination=Bentota&checkIn=2027-02-01&checkOut=2027-02-05' },
    { route:'/visa-assistance', selector:'#visa-view-mount', query:'destination=United+Arab+Emirates&citizenship=LK&residenceCountry=LK&departureDate=2027-02-01&purpose=tourism' },
    ...GENERIC_PHASES.map(definition=>({ route:definition.route, selector:'#journey-product-workspace', query:'inventory=demo&destination='+encodeURIComponent(definition.destination)+'&departureDate=2027-02-01&returnDate=2027-02-05' }))
  ];
  for(const product of products) {
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo(${JSON.stringify(product.route+'?'+product.query)});`);
    await new Promise(resolve=>setTimeout(resolve,100));
    const first = await cdp.evaluate(`(() => {
      const host=document.querySelector(${JSON.stringify(product.selector)});
      const controls=Array.from(host?.querySelectorAll('input:not([type=hidden]),select')||[]).filter(input=>input.getClientRects().length);
      const input=controls.find(input=>input.type!=='date')||controls[0];
      if(!input) return false; input.dataset.keyboardProbe='first'; input.focus(); return document.activeElement===input;
    })()`);
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    const keyboard=await cdp.evaluate(`(() => {
      const host=document.querySelector(${JSON.stringify(product.selector)});
      const active=document.activeElement;
      const style=active?getComputedStyle(active):null;
      return { moved:!!active&&active.dataset.keyboardProbe!=='first'&&!!host?.contains(active), visible:!!style&&(style.boxShadow!=='none'||style.outlineStyle!=='none'), named:!!active&&(!!active.getAttribute('aria-label')||!!active.labels?.length||!!active.textContent.trim()) };
    })()`);
    assertCheck(`Global keyboard — real Tab, visible focus and named controls ${product.route}`, first&&Object.values(keyboard).every(Boolean), JSON.stringify(keyboard));
  }
  await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo('/');`);
}
export const GENERIC_PHASES = [
  { phase: 8, product: 'packages', route: '/holiday-packages', destination: 'Dubai' },
  { phase: 9, product: 'cars', route: '/cars-transfers', destination: 'Dubai' },
  { phase: 10, product: 'activities', route: '/activities', destination: 'Dubai' },
  { phase: 11, product: 'sightseeing', route: '/sightseeing-tours', destination: 'London' },
  { phase: 12, product: 'rails', route: '/rails', destination: 'Kandy' },
  { phase: 13, product: 'cruises', route: '/cruises', destination: 'Mediterranean' },
  { phase: 14, product: 'insurance', route: '/travel-insurance', destination: 'Worldwide' }
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
      params.set('departurePort', 'Port preference for operator review');
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
      const cta=configure?.querySelector('button[type=submit]');
      cta?.scrollIntoView({block:'center',behavior:'instant'}); await wait(20);
      const bounds=cta?.getBoundingClientRect();
      const ctaVisible=!!bounds&&bounds.left>=-1&&bounds.right<=innerWidth+1&&bounds.top>=0&&bounds.bottom<=innerHeight;
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
      navigate('/'); return {hub,validation,search,details,labels,ctaVisible,staged:!!staged,review,invalid,empty};
    })()`);
    assertCheck(`Phase ${definition.phase} ${definition.product} — canonical request journey, truth, keyboard controls and responsive @ ${width}`, Object.values(result).every(Boolean), JSON.stringify(result));
    const captureQuery = new URLSearchParams({ inventory:'demo',destination:definition.destination,origin:'Colombo',departureDate:'2027-02-01',returnDate:'2027-02-05',returnTime:'15:30',adults:'2',rooms:'1',pickup:'Airport pickup request',dropoff:'Hotel drop-off request',pickupTime:'14:30',travellerAges:'32,30',residenceCountry:'LK',cabinClass:'standard',departurePort:'Port preference for operator review' });
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo(${JSON.stringify(definition.route+'/offer/DEMO-'+definition.product+'-planning-v1?'+captureQuery)});`);
    await new Promise(resolve=>setTimeout(resolve,120));
    await cdp.evaluate(`window.scrollTo({top:0,behavior:'instant'});`);
    await cdp.captureScreenshot(`vacatina_b2c_${definition.product}_detail_${width}px.png`);
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo('/');`);
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
