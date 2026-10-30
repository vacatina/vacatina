/** Local-only supplemental QA. Does not rerun or replace accepted hosted journeys. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { Cdp } from './lib/flights-deployed-cdp.mjs';
import { screens } from './flights-qa-inventory.mjs';
const root=process.cwd();
const output=path.resolve(process.env.FLIGHTS_QA_OUTPUT || 'docs/flights-evidence/gap-qa');
fs.mkdirSync(output,{recursive:true});
const chosen=process.env.QA_SCREENS?.split(',');
const axePath=process.env.AXE_CORE_PATH;
const results=[];
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirtySourceFiles=execFileSync('git',['diff','--name-only','--','src','tailwind.config.js'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const wait=async(fn,label,ms=14000)=>{
  const end=Date.now()+ms;let last;
  do {try{last=await fn();if(last)return last;}catch(e){last=e.message;}
    await new Promise(r=>setTimeout(r,80));
  }while(Date.now()<end);
  throw new Error(`Readiness: ${label}; ${JSON.stringify(last)}`);
};
let cdp,base;
const ev=x=>cdp.evaluate(x);
const visible=s=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});return !!e&&!!e.getClientRects().length&&!e.disabled&&getComputedStyle(e).visibility==='visible';})()`);
async function key(key,code=key,vk=0,modifiers=0){
  const params={key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers};
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',...params});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',...params});
}
async function click(selector){
  await wait(()=>visible(selector),selector);
  await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'center'})`);
  let prev;
  const p=await wait(async()=>{
    const r=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();if(!r)return null;const x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);return t&&(t===e||e.contains(t))?{x,y}:null;})()`);
    const stable=r&&prev&&Math.abs(r.x-prev.x)<0.25&&Math.abs(r.y-prev.y)<0.25;prev=r;return stable?r:null;
  },'click '+selector);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
}
async function go(route,selector){
  await ev(`window.__VACATINA_ROUTER__.navigateTo(${JSON.stringify(route)})`);
  await wait(()=>ev(`location.pathname===${JSON.stringify(route.split('?')[0])}`),'route '+route);
  if(selector)await wait(()=>visible(selector),selector);
  await ev('document.fonts.ready.then(()=>true)');
}
async function fill(s,value){await click(s);await key('a','KeyA',65,2);await cdp.send('Input.insertText',{text:value});await key('Tab','Tab',9);}
async function setup(s){
  if(['authorization','transient','rules-changed'].includes(s.state))throw new Error('NOT VERIFIED: no deterministic rendered frontend fixture for '+s.state);
  if(s.state==='ancillary'||s.state==='seat')throw new Error('NOT VERIFIED: planning offers do not expose real ancillary/seat availability; sandbox supplier fixture unavailable');
  if(['offer','fare','bucket'].includes(s.state)){
    if(s.state==='fare')await go('/flights/offer/sup-flt-cmb-dxb-fz548','#btn-modal-add-trip');
    else {await go(s.route,'button[data-view-offer]');await click('button[data-view-offer]');await wait(()=>visible('#btn-modal-add-trip'),'offer dialog');}
    if(s.state==='fare')await wait(()=>ev(`!!document.querySelector('[data-family-select]')`),'fare family controls');
    if(s.state==='bucket'){await click('#btn-modal-add-trip');await wait(()=>visible('#drawer-review-trip-cta'),'bucket after staging');}
  }else if(s.state==='revalidate'){
    await go(s.route,'#btn-modal-add-trip');await click('#btn-modal-add-trip');await wait(()=>visible('#drawer-review-trip-cta'),'revalidation feedback');
  }else if(s.state==='b2b-results'||s.state==='b2b-quote'){
    await go('/b2b/flights','#b2b-search');await click('#b2b-search');await wait(()=>visible('input[name="b2b-offer"]'),'offers');
    if(s.state==='b2b-quote'){await click('input[name="b2b-offer"]');await wait(()=>visible('#b2b-build-quote'),'quote control');await click('#b2b-build-quote');await wait(()=>visible('#b2b-markup'),'quotation');}
  }else if(s.state==='admin'){
    await go(s.route);
    await wait(async()=>await visible('#flight-admin-console')||await visible('#admin-demo-console'),'console or local fixture entry');
    if(await visible('#admin-demo-console'))await click('#admin-demo-console');
    await wait(()=>visible('#flight-admin-console'),'local operations fixture');
  }else{
    await go(s.route,s.selector);
  }
  if(s.id==='03'){await click('#btn-toggle-modify-search');await wait(()=>visible('#mod-from-input'),'modify panel');}
  if(s.id==='49'){
    await go('/flights/requests/VCT-REQ-0001/review','#mr-submit');
    await fill('#mr-phone','+94 77 123 4567');await click('#mr-consent');await click('#mr-submit');
    await wait(()=>visible('#mr-track-link'),'request submitted');await click('#mr-track-link');await wait(()=>visible('#mr-demo-advance'),'tracker');
    await click('#mr-demo-advance');await wait(()=>ev(`/review/i.test(document.querySelector('#mr-status-badge')?.textContent||'')`),'desk review');
    await click('#mr-demo-advance');await wait(()=>visible('#mr-open-quote'),'quote link');await click('#mr-open-quote');await wait(()=>ev(`/185,000/.test(document.querySelector('#flights-view-mount')?.innerText||'')`),'quotation total');
  }
}
async function snapshot(s,w){
  await cdp.setViewport(w,w===768?1024:900,false);
  await wait(()=>ev(`innerWidth===${w}`),'viewport');
  await ev(`window.scrollTo({top:0,left:0,behavior:'instant'})`);
  const selector=s.state==='admin'?'#flight-admin-console':s.state==='offer'||s.state==='fare'?'#flight-offer-detail-modal':s.state==='bucket'||s.state==='revalidate'?'#trip-bucket-drawer':s.id==='26'?'#flights-view-mount':s.id>='27'&&s.id<='33'?'#flights-view-mount':s.selector;
  const before=await ev(`(()=>{
    const c=document.querySelector(${JSON.stringify(selector)});if(!c)return null;
    const h=c.matches('h1,h2')?c:c.querySelector('h1,h2');
    const buttons=Array.from(c.querySelectorAll('a,button,input,select,textarea')).filter(e=>!e.disabled&&e.getClientRects().length);
    const styles=buttons.slice(0,8).map(e=>{const st=getComputedStyle(e);return {animation:st.animationDuration,transition:st.transitionDuration};});
    return {heading:h?.textContent?.trim()||'',headingFont:h?getComputedStyle(h).fontFamily:'',bodyFont:getComputedStyle(c).fontFamily,
      background:getComputedStyle(c).backgroundColor,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      controls:buttons.length,normalMotion:styles,
      controlsUnder24:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.width<24||r.height<24;}).map(e=>e.id||e.getAttribute('aria-label')||e.tagName).slice(0,12)};
  })()`);
  if(!before)throw new Error('No active component '+selector);
  // Keyboard modality must be real. Evaluate focus ring on actual Tab destination.
  await key('Tab','Tab',9);
  const focus=await ev(`(()=>{const e=document.activeElement,st=getComputedStyle(e);return {tag:e.tagName,id:e.id,inComponent:!!e.closest(${JSON.stringify(selector)}),visible:!!e.getClientRects().length,outline:st.outlineWidth+' '+st.outlineStyle,shadow:st.boxShadow};})()`);
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const shotName=`screen-${s.id}-${w}.png`;fs.writeFileSync(path.join(output,shotName),Buffer.from(shot.data,'base64'));
  // 320 CSS px approximates 400% reflow at a 1280px desktop viewport; not a full zoom audit.
  let reflow=null,motion=null,axe=null,ax=null;
  if(w===1440){
    await cdp.setViewport(320,900,false);
    reflow=await ev(`({width:innerWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})`);
    await cdp.setViewport(w,900,false);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    motion=await ev(`(()=>{const c=document.querySelector(${JSON.stringify(selector)});return Array.from(c.querySelectorAll('a,button,input,select,textarea')).filter(e=>e.getClientRects().length).slice(0,8).map(e=>({animation:getComputedStyle(e).animationDuration,transition:getComputedStyle(e).transitionDuration}));})()`);
    await cdp.send('Emulation.setEmulatedMedia',{features:[]});
    await cdp.send('Accessibility.enable');
    const tree=await cdp.send('Accessibility.getFullAXTree');
    ax={headings:tree.nodes.filter(n=>!n.ignored&&n.role?.value==='heading').map(n=>n.name?.value),alerts:tree.nodes.filter(n=>!n.ignored&&['alert','status'].includes(n.role?.value)).length};
    if(axePath){
      if(!await ev('typeof axe!=="undefined"'))await ev(fs.readFileSync(axePath,'utf8'));
      axe=await ev(`axe.run(document.querySelector(${JSON.stringify(selector)}),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({version:r.testEngine.version,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),passes:r.passes.length}))`,45000);
    }
  }
  return {screen:s.id,width:w,mode:'LOCAL_FIXTURE',route:s.route,observedRoute:await ev('location.pathname+location.search'),state:s.state,selector,...before,focus,screenshot:shotName,reflow,motion,ax,axe};
}
async function main(){
  delete process.env.PREVIEW_BASE;delete process.env.VERCEL_BYPASS;
  const site=path.join(root,'dist-site');
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://local').pathname;
    let file=path.resolve(site,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(site+path.sep)&&file!==site){res.writeHead(403);res.end();return;}
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(site,'index.html');
    const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vacatina-gap-qa-'));
  const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--lang=en-US',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  try{
    const port=await wait(()=>{try{return Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch{return false;}},'owned browser port');
    const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await cdp.open();
    await cdp.send('Page.navigate',{url:base});await wait(()=>ev('!!window.__VACATINA_ROUTER__ && !!window.__VACATINA_OS__'),'local bootstrap');
    if(await ev('window.__VACATINA_PUBLIC_DEMO__===true'))throw new Error('Build is PUBLIC_DEMO; rebuild without VERCEL/VACATINA_PUBLIC_DEMO for local fixture QA');
    // Existing explicitly local fixture entry; no auth gate is modified.
    await ev('window.__VACATINA_OS__.tripBucketService.resetToCanonicalBaseline()');
    if(process.env.QA_FOCUSED==='1'){
      const {runFocusedQa}=await import('./lib/flights-local-focused-checks.mjs');
      results.push(...await runFocusedQa({cdp,ev,go,click,key,fill,wait,visible,base}));
      return;
    }
    for(const s of screens.filter(s=>!chosen||chosen.includes(s.id))){
      try{
        await key('Escape','Escape',27);
        await setup(s);
        for(const w of [390,768,1440]){
          const r=await snapshot(s,w);results.push(r);
          console.log(`QA ${s.id} @${w}: overflow=${r.overflow} axe=${r.axe?.violations.length??'not scanned'} ${r.heading.slice(0,50)}`);
        }
      }catch(e){results.push({screen:s.id,mode:'LOCAL_FIXTURE',route:s.route,state:s.state,status:'NOT VERIFIED',reason:e.message});console.log(`NOT VERIFIED ${s.id}: ${e.message}`);}
    }
  }finally{
    cdp?.close();if(chrome.exitCode===null)chrome.kill();await new Promise(r=>server.close(r));
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({applicationSha:dirtySourceFiles.length?null:sourceHead,gitHead:sourceHead,dirtySourceFiles,environment:'LOCAL_FIXTURE',auditLimits:'Automated component scan, screenshots, keyboard focus sample, 320px reflow approximation; not full WCAG, screen-reader, zoom or visual acceptance',results},null,2));
    console.log('SAVED',output,'rows',results.length);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
