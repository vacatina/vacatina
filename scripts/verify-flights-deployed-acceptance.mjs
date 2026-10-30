// Read-only deployed acceptance. No forced clicks, storage seeding or DOM-value writes.
import { Cdp } from './lib/flights-deployed-cdp.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const BASE = process.env.PREVIEW_BASE;
const rows = [];
let cdp;
const ev = x => cdp.evaluate(x);
const poll = async (fn, label, ms = 18000) => {
  const end = Date.now() + ms;
  let last;
  do {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await new Promise(resolve => setTimeout(resolve, 80)); // readiness polling, not a fixed action delay
  } while (Date.now() < end);
  throw new Error(`Readiness timeout: ${label}; last=${JSON.stringify(last)}`);
};
const expect = (ok, message) => { if (!ok) throw new Error(message); };
const record = (id, name, status, detail = '') => {
  rows.push({ id, name, status, width: width, detail });
  console.log(`${status} ${id} @${width}: ${name} ${detail}`);
};
let width = 1440;
async function test(id, name, fn) {
  try { const detail = await fn(); record(id, name, 'PASS', detail || ''); return true; }
  catch (e) { record(id, name, 'FAIL', e.message); return false; }
}
const txt = s => ev(`document.querySelector(${JSON.stringify(s)})?.textContent?.trim() || ''`);
const visibleExpr = s => `(() => { const e=document.querySelector(${JSON.stringify(s)}); return !!e && !e.disabled && !e.closest('[hidden],[inert],[aria-hidden="true"]') && !!e.getClientRects().length && getComputedStyle(e).visibility==='visible'; })()`;
const ready = s => poll(() => ev(visibleExpr(s)), s);
const route = p => poll(() => ev(`location.pathname===${JSON.stringify(p)}`), `route ${p}`);
async function nav(p, selector) {
  await cdp.send('Page.navigate', { url: BASE + p });
  await route(p.split('?')[0]);
  await poll(() => ev(`document.readyState==='complete' && !!window.__VACATINA_ROUTER__`), 'boot');
  if (selector) await ready(selector);
}
async function key(key, code = key, modifiers = 0, vk) {
  const p = {key, code, modifiers};
  if (vk) p.windowsVirtualKeyCode = p.nativeVirtualKeyCode = vk;
  await cdp.send('Input.dispatchKeyEvent', {type:'keyDown', ...p, ...(/^\d$/.test(key) ? {text:key,unmodifiedText:key} : {})});
  await cdp.send('Input.dispatchKeyEvent', {type:'keyUp', ...p});
}
async function click(s) {
  await ready(s);
  // Existing smooth-scroll CSS can move a target after its rect was sampled.
  // Instant scroll + observed stable rects prevents stale-coordinate clicks.
  await ev(`document.querySelector(${JSON.stringify(s)}).scrollIntoView({block:'center',inline:'center',behavior:'instant'})`);
  let previous;
  const p = await poll(async () => {
    const r = await ev(`(() => {
      const e=document.querySelector(${JSON.stringify(s)}); if(!e||e.disabled)return null;
      const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;
      const top=document.elementFromPoint(x,y);
      return r.width&&r.height&&top&&(top===e||e.contains(top))?{x,y}:null;
    })()`);
    const stable = r && previous && Math.abs(r.x-previous.x)<0.25 && Math.abs(r.y-previous.y)<0.25;
    previous=r; return stable ? r : null;
  }, `stable, unobstructed ${s}`);
  await cdp.send('Input.dispatchMouseEvent', {type:'mouseMoved',...p});
  await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...p});
  await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...p});
}
async function fill(s, value) {
  await click(s);
  await key('a','KeyA',2,65);
  await cdp.send('Input.insertText',{text:value});
  await key('Tab','Tab',0,9);
  await poll(() => ev(`document.querySelector(${JSON.stringify(s)})?.value===${JSON.stringify(value)}`), `typed value ${s}`);
}
async function checked(s) {
  if (!await ev(`document.querySelector(${JSON.stringify(s)})?.checked`)) await click(s);
  await poll(() => ev(`document.querySelector(${JSON.stringify(s)})?.checked===true`), `checked ${s}`);
}
async function group(ids, fn) {
  try { await fn(); } catch (e) {
    const missing=ids.filter(id=>!rows.some(r=>r.id===id));
    if (missing.length && !rows.some(r=>r.status==='FAIL' && ids.includes(r.id))) record(missing.shift(), 'Journey prerequisite', 'FAIL', e.message);
    for (const id of missing) record(id, 'Downstream case', 'BLOCKED', 'Dependency: preceding journey case failed');
  }
}
async function b2c(w) {
  width=w; await cdp.setViewport(w,900,w<768);
  await group(Array.from({length:22},(_,i)=>`B${w}-${i+1}`), async()=>{
    let n=0;
    const step=async(name,fn)=>{const ok=await test(`B${w}-${++n}`,name,fn); if(!ok)throw new Error(name);};
    await nav('/','body');
    // Mobile entry may live in the navigation drawer.
    let entry='a[href="/flights"]';
    if(!await ev(visibleExpr(entry))) entry='#tab-flights';
    await step('Homepage Flights entry usable',()=>ready(entry));
    await step('Flights entry responds',async()=>{await click(entry);await poll(()=>ev(`location.pathname.startsWith('/flights') || !!document.querySelector('#panel-flights')?.getClientRects().length`),'Flights entry');});
    await nav('/flights/search?tripType=round_trip&origin=CMB&destination=DXB&departureDate=2026-11-15&returnDate=2026-11-22&adults=1&cabinClass=economy','button[data-view-offer]');
    await step('Selectable search offer',()=>ready('button[data-view-offer]'));
    await step('Offer details opens',async()=>{await click('button[data-view-offer]');await ready('#btn-modal-add-trip');});
    // The initially selected fare family is retained; do not force hidden radio inputs.
    await step('Add-to-Trip action enabled',()=>ready('#btn-modal-add-trip'));
    await step('Selected flight enters Trip Bucket',async()=>{await click('#btn-modal-add-trip');await poll(()=>ev(`window.__VACATINA_OS__.tripBucketService.getItems().some(i=>i.productType==='flights')`),'staged flight');});
    // Add-to-Trip closes the modal and opens its drawer asynchronously after revalidation.
    await ready('#drawer-review-trip-cta');
    await key('Escape','Escape',0,27);
    const bucket=await poll(async()=>{for(const s of ['#header-trip-bucket-btn','#dock-review-trip-btn','#mobile-summary-review-btn'])if(await ev(visibleExpr(s)))return s;},'bucket entry');
    await step('Trip Bucket entry accessible',()=>ready(bucket));
    await step('Review action enabled',async()=>{await click(bucket);await ready('#drawer-review-trip-cta');});
    await step('Trip Review opens',async()=>{await click('#drawer-review-trip-cta');await route('/trip/review');await ready('[data-continue-passengers]');});
    await step('Passenger continuation CTA',()=>ready('[data-continue-passengers]'));
    await step('Passenger Details opens',async()=>{await click('[data-continue-passengers]');await route('/flights/passengers');await ready('[data-field="firstName"]');});
    for (const [field,value] of [['firstName','Sample'],['lastName','Traveller'],['nationality','Testland']]) await fill(`[data-passenger="0"][data-field="${field}"]`,value);
    const title='[data-passenger="0"][data-field="title"]';
    await click(title);await key('Home','Home',0,36);await key('ArrowDown','ArrowDown',0,40);await key('Enter','Enter',0,13);await key('Tab','Tab',0,9);
    // Use the native date input's keyboard segments (US Chrome locale).
    const dob='[data-passenger="0"][data-field="dateOfBirth"]';
    await click('[data-passenger="0"][data-field="lastName"]');await key('Tab','Tab',0,9);
    await key('ArrowUp','ArrowUp',0,38);
    await key('Tab','Tab',0,9);
    await key('ArrowUp','ArrowUp',0,38);
    await key('Tab','Tab',0,9);
    await key('ArrowUp','ArrowUp',0,38);
    for(let i=0;i<40;i++)await key('ArrowDown','ArrowDown',0,40);
    await poll(()=>ev(`!!document.querySelector('[data-field="dateOfBirth"]').value`),'native date keyboard entry');
    await key('Tab','Tab',0,9);
    await fill('[data-field="contact.email"]','sample@example.invalid');
    await fill('[data-field="contact.phone"]','0000000000');
    await step('Passenger Continue enabled',()=>ready('[data-action="continue"]'));
    await step('Custom passenger validation advances',async()=>{await click('[data-action="continue"]');try {await route('/flights/review');}catch(e){console.log('PASSENGER_DIAGNOSTIC',await ev(`JSON.stringify({dob:document.querySelector('[data-field="dateOfBirth"]')?.value,title:document.querySelector('[data-field="title"]')?.value,errors:Array.from(document.querySelectorAll('.text-red-600,.text-red-500,[role="alert"]')).map(e=>e.textContent)})`));throw e;}});
    await step('Checkout Preview CTA enabled',()=>ready('[data-continue-checkout]'));
    await step('Checkout Preview opens',async()=>{await click('[data-continue-checkout]');await route('/flights/checkout');});
    await step('Simulated completion enabled',()=>ready('[data-complete-preview]'));
    await step('Simulated result reached',async()=>{await click('[data-complete-preview]');await route('/flights/confirmation');});
    await step('No issued-ticket claim',async()=>{expect(/simulat|preview|no booking|not confirmed|no ticket/i.test(await txt('#flights-view-mount')),'Missing honest result disclosure');});
    await nav('/flights/search?tripType=one_way&origin=CMB&destination=SIN&departureDate=2026-11-18&adults=1&cabinClass=economy','button[data-view-offer]');
    await step('Direct: selectable offer',()=>ready('button[data-view-offer]'));
    await step('Direct: offer opens',async()=>{await click('button[data-view-offer]');await ready('#btn-modal-book-now');});
    await step('Direct: Book Now enabled',()=>ready('#btn-modal-book-now'));
    await step('Direct: advances without adding to Trip Bucket',async()=>{const before=await ev('window.__VACATINA_OS__.tripBucketService.getItems().length');await click('#btn-modal-book-now');await route('/flights/passengers');expect(before===await ev('window.__VACATINA_OS__.tripBucketService.getItems().length'),'Bucket mutated');});
  });
}
async function run() {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vacatina-acceptance-'));
  const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--lang=en-US',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  try {
    const port=await poll(()=>{try{return Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch{return false;}},'owned Chrome port');
    const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    cdp=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await cdp.open();
    await test('D1','Preview boots',()=>nav('/','body'));
    await test('D2','Public demo flag',async()=>expect(await ev('window.__VACATINA_PUBLIC_DEMO__===true'),'not demo'));
    await b2c(390);await b2c(1440);
    width=1440;await cdp.setViewport(1440,900,false);
    for(const [id,p] of [['D4','/bookings/VCT-2026-0001'],['D6','/account/trips'],['D7','/bookings/VCT-2026-0001/change'],['D8','/admin']]) {
      await nav(p,'[data-public-action-gate]');
      expect(/Account and operations unavailable/.test(await txt('[data-public-action-gate]')),'Unexpected gate');
      record(id,p,'BLOCKED','Public-demo/auth gate; underlying journey not exercised');
    }
    await test('D5','Active guest-lookup heading and validation',async()=>{
      await nav('/flights/manage','#flights-view-mount .flights-guest-lookup #lookup-heading');
      expect(await txt('#flights-view-mount .flights-guest-lookup #lookup-heading')==='Guest Booking Lookup','wrong active heading');
      await click('#lookup-submit');await poll(()=>txt('#lookup-error'),'lookup validation');
      expect(await ev(`document.querySelector('#lookup-error').getAttribute('role')==='alert' && getComputedStyle(document.querySelector('#lookup-error')).display!=='none'`),'error not exposed');
      await click('#lookup-demo');
      await poll(()=>ev(`document.querySelector('#lookup-reference').value==='VCT-2026-0001' && !!document.querySelector('#lookup-surname').value`),'demo prefill');
    });
    await test('D5-focus','Inactive homepage excluded from layout and AX tree',async()=>{
      expect(await ev(`getComputedStyle(document.querySelector('#main-content')).display==='none' && !Array.from(document.querySelectorAll('#main-content a,#main-content button,#main-content input')).some(e=>e.getClientRects().length)`),'Homepage rendered');
      await cdp.send('Accessibility.enable');
      const ax=await cdp.send('Accessibility.getFullAXTree');
      expect(!ax.nodes.some(n=>!n.ignored && n.role?.value==='heading' && /Book Everything in One Place/.test(n.name?.value||'')),'Inactive homepage heading in AX tree');
      for(let i=0;i<70;i++) {
        await key('Tab','Tab',0,9);
        expect(!await ev(`!!document.activeElement?.closest('#main-content')`),'Tab entered inactive homepage');
      }
    });
    await group(['D9','D10','D11','D12','D13','D14'],async()=>{
      await nav('/flights/requests/VCT-REQ-0001/review','#mr-submit');
      record('D9','Screen 46 cold review render','PASS');
      await fill('#mr-phone','077');await click('#mr-submit');
      await test('D10','Screen 46 invalid phone custom validation',async()=>{await poll(async()=>/phone/i.test(await txt('#mr-form-error')),'phone error');expect(await ev(`document.querySelector('#mr-phone').getAttribute('aria-invalid')==='true' && document.querySelector('#mr-form-error').getAttribute('role')==='alert'`),'Missing accessible error');});
      await fill('#mr-phone','+94 77 123 4567');await checked('#mr-consent');await click('#mr-submit');
      const ok=await test('D11','Screen 46 submission and persisted status',async()=>{await route('/flights/requests/VCT-REQ-0001/submitted');await ready('#mr-track-link');expect(await ev(`JSON.parse(sessionStorage.getItem('vacatina:manualRequest:VCT-REQ-0001')).status==='submitted'`),'not persisted');});
      if(!ok)throw new Error('D11 prerequisite failed');
      await click('#mr-track-link');await route('/flights/requests/VCT-REQ-0001');await ready('#mr-demo-advance');record('D12','Screen 48 tracker via click','PASS');
      await click('#mr-demo-advance');await poll(async()=>/review/i.test(await txt('#mr-status-badge')),'desk review');
      await click('#mr-demo-advance');await ready('#mr-open-quote');record('D13','Screen 48 quote link after lifecycle advance','PASS');
      await click('#mr-open-quote');await route('/flights/requests/VCT-REQ-0001/quote');
      await test('D14','Screen 49 preview quotation total',async()=>{await poll(async()=>/LKR 185,000/.test(await txt('#flights-view-mount')),'quotation total');});
    });
    await group(['D15','D16','D17a','D17','D18','D19'],async()=>{
      await nav('/b2b/flights','#b2b-search');record('D15','Screen 51 B2B search','PASS');
      expect(await ev(`document.querySelector('#b2b-origin').value==='CMB' && document.querySelector('#b2b-destination').value==='DXB' && document.querySelector('#b2b-pax').value==='2'`),'Unexpected default search context');
      await click('#b2b-search');await poll(()=>ev(`document.querySelectorAll('input[name="b2b-offer"]').length===3`),'3 offers');record('D16','Screen 52 three deterministic offers','PASS');
      await click('input[name="b2b-offer"]');await poll(()=>ev(`!!document.querySelector('input[name="b2b-offer"]:checked')`),'selected offer');await ready('#b2b-build-quote');record('D17a','Selected offer enables quotation','PASS');
      await click('#b2b-build-quote');await route('/b2b/flights/quotation');await ready('#b2b-markup');record('D17','Screen 53 quotation via click','PASS');
      await test('D18','Deterministic quote totals',async()=>{await poll(async()=>await txt('#b2b-total-client')==='LKR 219,660' && await txt('#b2b-total-perpax')==='LKR 109,830','quote totals');});
      await fill('#b2b-markup','15');await test('D19','Markup recomputes client total',async()=>{await poll(async()=>await txt('#b2b-total-client')==='LKR 225,450','changed total');});
    });
    await nav('/flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1','#btn-toggle-modify-search');
    await click('#btn-toggle-modify-search');await ready('#mod-from-input');
    record('D20a','Screen 03 boots','PASS');
    await test('D20','All search-screen controls have accessible names',async()=>{
      const unnamed=await ev(`Array.from(document.querySelectorAll('#flights-view-mount button,#flights-view-mount a,#flights-view-mount input,#flights-view-mount select,#flights-view-mount textarea')).filter(e=>{
        const label=e.closest('label') || (e.id?document.querySelector('label[for="'+e.id+'"]'):null);
        const labelled=(e.getAttribute('aria-labelledby')||'').split(/\\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');
        return !(e.getAttribute('aria-label')||labelled||e.textContent||e.getAttribute('title')||label?.textContent||'').trim();
      }).map(e=>e.id||e.tagName)`);
      expect(unnamed.length===0,'Unnamed controls: '+JSON.stringify(unnamed));
    });
    for(const [w,h] of [[1440,900],[768,1024],[390,844],[360,800]]) {
      width=w;await cdp.setViewport(w,h,w<768);
      await test(`D21-${w}`,'Screen 03 no horizontal overflow',async()=>{await poll(()=>ev(`innerWidth===${w}`),'viewport');expect(await ev('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),'horizontal overflow');});
    }
    await test('D22','No uncaught page exceptions',async()=>expect(cdp.pageExceptions.length===0,`${cdp.pageExceptions.length} exceptions`));
    await test('D23','No console errors',async()=>expect(cdp.consoleErrors.length===0,`${cdp.consoleErrors.length} errors`));
  } finally {
    cdp?.close();
    // Only the ChildProcess launched with this run's unique profile is terminated.
    if(chrome.exitCode===null)chrome.kill();
    const out=process.env.ACCEPTANCE_OUTPUT || path.join(os.tmpdir(),'acceptance-trusted-results.json');
    fs.writeFileSync(out,JSON.stringify({base:BASE,sha:process.env.EXPECTED_SHA,rows},null,2));
    console.log('COUNTS',JSON.stringify(rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})),'TOTAL',rows.length,'EVIDENCE',out);
  }
}
run().catch(e=>{console.error('RUN INCOMPLETE',e.message);process.exitCode=1;});
