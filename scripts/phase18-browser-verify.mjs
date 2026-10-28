import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { BrowserCheck } from './cdp-client.mjs';
import { verifyHotels, verifyVisa, verifyProductPhase, GENERIC_PHASES } from './product-journey-gates.mjs';
const publicIndex=process.argv.indexOf('--public');const publicMode=publicIndex>=0;
const target=publicMode?process.argv[publicIndex+1]:'http://127.0.0.1:4187';
if(!target||!/^https?:\/\//.test(target))throw new Error('Explicit HTTP target required');
const origin=new URL(target).origin,root=process.cwd(),out=path.resolve(root,process.env.PHASE18_EVIDENCE_DIR||'docs/phase18-evidence');await fs.mkdir(out,{recursive:true});
const checks=[];const check=(name,pass,details)=>{checks.push({name,status:pass?'PASS':'FAIL',details});if(!pass)throw new Error(name+': '+JSON.stringify(details));console.log('PASS '+name);};
const browser=new BrowserCheck();let server;let fixture;
try{
  if(!publicMode){
    const {LocalReadinessUnitOfWork}=await import('../src/server/persistence/local-readiness-unit-of-work.ts');
    const {createDemoHttpApplication}=await import('../src/server/runtime/demo-http-application.ts');
    const {bridgeNodeRequest}=await import('../src/server/runtime/node-bridge.ts');
    const file=path.join(root,'tmp/phase18-browser',randomUUID()+'.json');
    const tokens=new Map();const customers=new Map();for(const width of [1440,768,360]){const token=randomBytes(32).toString('hex');customers.set(width,token);tokens.set(token,{userId:'browser-customer-'+width,email:'',role:'CUSTOMER',organizationId:'demo-local'});}
    const opsToken=randomBytes(32).toString('hex'),publisherToken=randomBytes(32).toString('hex');tokens.set(opsToken,{userId:'browser-operator',email:'',role:'OPS_SUPERVISOR',organizationId:'demo-local',isElevatedMfa:true});tokens.set(publisherToken,{userId:'browser-publisher',email:'',role:'OPS_SUPERVISOR',organizationId:'demo-local',isElevatedMfa:true});
    const secret=randomBytes(48).toString('hex');const compose=()=>createDemoHttpApplication({persistence:new LocalReadinessUnitOfWork(file),sessionSecret:secret,authenticate:async r=>tokens.get((r.headers.get('authorization')||'').replace(/^Bearer /,''))||null});let app=compose();
    server=http.createServer(async(req,res)=>{try{if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/')){await bridgeNodeRequest(req,res,origin,app);return;}let name=url.pathname;if(!path.extname(name))name='/index.html';if(name.includes('..')||(!name.startsWith('/dist/')&&!name.startsWith('/public/')&&name!=='/index.html')){res.writeHead(404);res.end();return;}let bytes=await fs.readFile(path.join(root,name));if(name==='/index.html')bytes=Buffer.from(bytes.toString().replace(/<script[^>]*src="[^"]*clerk[^>]*><\/script>/gi,''));const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(name)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(bytes);}catch{res.writeHead(404);res.end();}});
    await new Promise(resolve=>server.listen(Number(new URL(origin).port),'127.0.0.1',resolve));fixture={customers,opsToken,publisherToken,restart:()=>{app=compose();}};
  }
  await browser.start(9268,path.join(root,'tmp/phase18-browser-profile-'+(publicMode?'public':'local')));
  if(!publicMode)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.Clerk={loaded:true,user:null,load:async()=>{},addListener:()=>{},session:null};'});
  for(const width of [1440,768,360]){
    await browser.viewport(width);
    if(publicMode){
      for(const route of ['/','/trip-builder','/flights','/hotels','/visa-assistance','/holiday-packages','/cars-transfers','/activities','/sightseeing-tours','/rails','/cruises','/travel-insurance','/trip/review','/requests','/checkout','/admin','/admin/listings','/account/travel-credit','/auth/sign-in','/manage-booking','/partner']){
        const gated=/^\/(admin|account|auth|manage-booking|partner)(\/|$)/.test(route);await browser.navigate(origin+route);if(gated)await browser.until('document.querySelector("[data-public-action-gate]")');const state=await browser.evaluate(`({demo:!!document.querySelector('#public-demo-notice'),fits:document.documentElement.scrollWidth<=innerWidth+1,headings:document.querySelectorAll('h1').length,noSdk:!document.querySelector('script[src*=clerk]'),legacyClosed:${gated} ? !!document.querySelector('[data-public-action-gate]') : true})`);check('public direct reload '+route+' @ '+width,state.demo&&state.fits&&state.noSdk&&state.legacyClosed,state);
      }
      await browser.navigate(origin+'/');
      const tabs=await browser.evaluate(`(()=>{const names=['bundle','flights','hotels','visa','packages','cars','rails','cruises','activities','sightseeing','insurance'];return names.map(name=>{const tab=document.getElementById('tab-'+name);tab?.click();return {name,selected:tab?.getAttribute('aria-selected')==='true',panel:!document.getElementById('panel-'+name)?.hidden};});})()`);check('public eleven SCC tabs @ '+width,tabs.length===11&&tabs.every(t=>t.selected&&t.panel),tabs);
      const privacy=await browser.evaluate(`(async()=>{
        const email=document.getElementById('newsletter-email-input'),button=document.getElementById('newsletter-subscribe-btn');
        const before=localStorage.getItem('vacatina_subscribed_newsletters');
        if(email){email.value='synthetic-phase18@example.invalid';email.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}
        button?.click();document.getElementById('header-sign-in-btn')?.click();
        let fallback=false;await window.__VACATINA_CLERK__?.openSignIn(undefined,()=>{fallback=true;});
        return {newsletterDisabled:!!email?.disabled&&!!button?.disabled,notStored:before===localStorage.getItem('vacatina_subscribed_newsletters'),noAuthFallback:!fallback&&!document.getElementById('auth-modal-email'),sdkNotReady:!window.__VACATINA_CLERK__?.isReady()};
      })()`);check('public identity and newsletter collection disabled @ '+width,Object.values(privacy).every(Boolean),privacy);
      const flightQuery='tripType=round_trip&origin=CMB&destination=DXB&departureDate=2027-02-01&returnDate=2027-02-08&adults=2&cabinClass=economy';
      await browser.navigate(origin+'/flights/search?'+flightQuery);await browser.until(`document.querySelector('#flights-view-mount [data-offer-id]')`);
      const offerId=await browser.evaluate(`document.querySelector('#flights-view-mount [data-offer-id]').getAttribute('data-offer-id')`);
      await browser.navigate(origin+'/flights/offer/'+encodeURIComponent(offerId)+'?'+flightQuery);await browser.until(`document.querySelector('#btn-modal-add-trip')`);
      await browser.shot(path.join(out,'public-flight-detail-'+width+'.png'));
      await browser.evaluate(`document.querySelector('#btn-modal-add-trip').click()`);await browser.until(`window.__VACATINA_OS__.tripBucketService.getItems().some(i=>i.productType==='flights'&&i.offerId===${JSON.stringify(offerId)})`);
      const flightState=await browser.evaluate(`window.__VACATINA_OS__.tripBucketService.getItems().find(i=>i.offerId===${JSON.stringify(offerId)}).state`);check('public flight direct search, detail reload and local-only staging @ '+width,flightState!=='ready',{state:flightState});
      await browser.evaluate(`document.getElementById('trip-bucket-close')?.click()`);
      await browser.navigate(origin+'/trip/review');await browser.until(`document.querySelector('#customer-enquiry-panel button[disabled]')`);check('public submission gated @ '+width,await browser.evaluate(`document.querySelector('#customer-enquiry-panel').innerText.includes('Nothing is durably submitted')`));
      await browser.shot(path.join(out,'public-demo-'+width+'.png'));
    }else{
      await browser.send('Network.setExtraHTTPHeaders',{headers:{Authorization:'Bearer '+fixture.customers.get(width)}});
      await browser.navigate(origin+'/trip/review');await browser.until(`document.querySelector('#enquiry-submit-form')`);
      const items=['flights','hotels','visa','packages','cars','activities','sightseeing','rails','cruises','insurance'].map(p=>({id:'test-'+p,offerId:'DEMO-'+p,productType:p,productLabel:p,title:'Labelled demo '+p,subtitle:'Test only',dateSummary:'2027-02-01',travellerSummary:'2 adults',state:'needs_action',priceLkr:0,priceStatus:'quote_required',inventoryMode:'demo_fixture',supplierName:'Fixture only',integrationMode:'MOCK',configuration:{destination:'Dubai',origin:'CMB',departureDate:'2027-02-01',returnDate:'2027-02-08',adults:2,rooms:1,returnTime:'10:30',policyReviewAcknowledged:true}}));
      await browser.evaluate(`window.__VACATINA_OS__.tripBucketService.replaceCandidates(${JSON.stringify(items)});window.__VACATINA_ROUTER__.navigateTo('/trip/review')`);await browser.until(`document.querySelector('#enquiry-submit-form')`);
      await browser.evaluate(`document.querySelector('#enquiry-submit-form input[name=consent]').click();document.querySelector('#enquiry-submit-form button[type=submit]').click()`);
      await browser.until(`document.querySelector('[data-enquiry-message] a[href^="/requests/"]')`);const href=await browser.evaluate(`document.querySelector('[data-enquiry-message] a').getAttribute('href')`);const id=href.split('/').at(-1);
      await browser.navigate(origin+href);await browser.until(`document.querySelector('[data-request-content] article')`);check('ten-product durable enquiry receipt @ '+width,await browser.evaluate(`document.querySelectorAll('[data-request-content] li').length===10&&document.querySelector('[data-request-content]').innerText.includes('queued, not sent')`));
      fixture.restart();await browser.navigate(origin+'/trip/review');await browser.until(`document.querySelectorAll('[data-review-remove]').length===10`);check('composition reconstruction and browser reload @ '+width,true);
      await browser.send('Network.setExtraHTTPHeaders',{headers:{Authorization:'Bearer '+fixture.opsToken}});await browser.navigate(origin+'/admin');await browser.until(`document.querySelector('[data-enquiry-id="${id}"]')`);await browser.evaluate(`document.querySelector('[data-enquiry-id="${id}"]').click()`);await browser.until(`document.querySelector('[data-op=assign]')`);
      check('operator queue and detail fit viewport @ '+width,await browser.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'));
      await browser.evaluate(`document.querySelector('[data-op=assign]').click()`);await browser.until(`document.querySelector('[data-operator-detail]').innerText.includes('INVESTIGATING')`);
      await browser.evaluate(`document.querySelector('textarea[name=text]').value='Demo quotation only. No supplier allocation or payment.';document.querySelector('input[name=expiresAt]').value='2027-12-31T12:00';document.querySelector('[data-op=draft-quote]').click()`);await browser.until(`document.querySelector('[data-operator-detail]').innerText.includes('draft-quote')`);
      await browser.evaluate(`document.querySelector('[data-op=publish-quote]').click()`);await browser.until(`document.querySelector('[data-operator-message]').textContent.includes('independent quote approval required')`);check('independent operator quote approval enforced @ '+width,await browser.evaluate(`document.querySelector('[data-quotation-version="1"][data-quotation-state="DRAFT"]').innerText.includes('Demo quotation only. No supplier allocation or payment.')`));
      await browser.evaluate(`document.querySelector('[data-operator-form]').scrollIntoView({block:'center',behavior:'instant'})`);await browser.shot(path.join(out,'operator-detail-'+width+'.png'));
      await browser.send('Network.setExtraHTTPHeaders',{headers:{Authorization:'Bearer '+fixture.publisherToken}});await browser.evaluate(`document.querySelector('[data-op=publish-quote]').click()`);await browser.until(`document.querySelector('[data-operator-detail]').innerText.includes('publish-quote')`);
      await browser.send('Network.setExtraHTTPHeaders',{headers:{Authorization:'Bearer '+fixture.customers.get(width)}});await browser.navigate(origin+href);await browser.until(`document.querySelector('[data-ack="1"]')`);await browser.evaluate(`document.querySelector('[data-ack="1"]').click()`);await browser.until(`document.querySelector('[data-request-content]').innerText.includes('acknowledgement: version 1')`);
      check('customer → operator → independent publisher → customer @ '+width,await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      await browser.shot(path.join(out,'request-round-trip-'+width+'.png'),true);
      await browser.evaluate(`document.querySelector('[data-withdraw]').click()`);await browser.until(`document.querySelector('[data-request-content]').innerText.includes('Withdrawn')`);check('persistent customer withdrawal @ '+width,true);
    }
  }
  if(publicMode){
    // Reuse the established customer journey assertions against the emitted public build,
    // not a fake API or a second backend. These only stage browser-local demo selections.
    const cdp={evaluate:e=>browser.evaluate(e),send:(m,p)=>browser.send(m,p),setViewport:(w,h,m)=>browser.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:m}),captureScreenshot:name=>browser.shot(path.join(out,'public-'+name))};
    await verifyHotels(cdp,check);await verifyVisa(cdp,check);
    for(const definition of GENERIC_PHASES)await verifyProductPhase(cdp,check,definition);
  }
  check('zero uncaught browser exceptions',browser.exceptions.length===0,browser.exceptions);
}catch(error){
  if(!publicMode){const text=await browser.evaluate('document.body.innerText').catch(()=>null);console.error('Local fixture browser failure context:',text?.slice(-4500));}
  checks.push({name:'run completion',status:'FAIL',details:error.message});throw error;
}finally{
  browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(path.join(out,publicMode?'public-browser.json':'request-operations-browser.json'),JSON.stringify({target,status:checks.some(c=>c.status==='FAIL')?'FAIL':'PASS',mode:publicMode?'PUBLIC_READ_ONLY':'ISOLATED_FIXTURE_AUTH_LOCAL_FILE',checks,exceptions:browser.exceptions,consoleErrors:browser.consoleErrors},null,2));
}
