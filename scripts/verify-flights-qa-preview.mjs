// Affected-component verification only. Does not rerun the immutable accepted suite.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {Cdp} from './lib/flights-deployed-cdp.mjs';
import {runFocusedQa} from './lib/flights-local-focused-checks.mjs';
const base=process.env.PREVIEW_BASE;
const out=path.resolve(process.env.FLIGHTS_QA_OUTPUT||'docs/flights-evidence/gap-qa/hosted-fix-validation');
fs.mkdirSync(out,{recursive:true});
const wait=async(fn,label,ms=18000)=>{const end=Date.now()+ms;let last;do{try{last=await fn();if(last)return last;}catch(e){last=e.message;}await new Promise(r=>setTimeout(r,80));}while(Date.now()<end);throw new Error(label+': '+JSON.stringify(last));};
let cdp;const ev=x=>cdp.evaluate(x);
const visible=s=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});return !!e&&!!e.getClientRects().length&&!e.disabled;})()`);
const key=async(key,code=key,vk=0,modifiers=0)=>{const p={key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers};await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',...p});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',...p});};
async function click(s){
  await wait(()=>visible(s),s);await ev(`document.querySelector(${JSON.stringify(s)}).scrollIntoView({behavior:'instant',block:'center'})`);
  let prev;
  const p=await wait(async()=>{const r=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)}),r=e?.getBoundingClientRect();if(!r)return null;const x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);return t&&(t===e||e.contains(t))?{x,y}:null;})()`);const stable=r&&prev&&Math.abs(r.x-prev.x)<0.25&&Math.abs(r.y-prev.y)<0.25;prev=r;return stable?r:null;},'stable '+s);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
}
async function go(route,s){await cdp.send('Page.navigate',{url:base+route});await wait(()=>ev(`location.pathname===${JSON.stringify(route.split('?')[0])}&&!!window.__VACATINA_ROUTER__&&document.readyState==='complete'`),'route '+route);if(s)await wait(()=>visible(s),s);}
async function fill(s,text){await click(s);await key('a','KeyA',65,2);await cdp.send('Input.insertText',{text});await key('Tab','Tab',9);}
const rows=[];
async function main(){
  if(!base||!process.env.EXPECTED_SHA||!process.env.AXE_CORE_PATH)throw new Error('PREVIEW_BASE, EXPECTED_SHA, AXE_CORE_PATH required');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vacatina-hosted-gap-'));
  const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--lang=en-US',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
  try{
    const port=await wait(()=>{try{return Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch{return false;}},'owned Chrome');
    const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();cdp=new Cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await cdp.open();
    for(const w of [390,768,1440]){
      await cdp.setViewport(w,900,false);
      for(const [id,route,selector]of [['02','/flights','#flights-view-mount'],['04','/flights/offer/sup-flt-cmb-dxb-fz548','#flight-offer-detail-modal'],['11','/flights/review','#flights-view-mount'],['24','/flights/checkout/booking-failed','#flights-view-mount'],['46','/flights/requests/VCT-REQ-QA/review','#flights-view-mount']]){
        await go(route,selector);
        await ev(fs.readFileSync(process.env.AXE_CORE_PATH,'utf8'));
        const axe=await ev(`axe.run(document.querySelector(${JSON.stringify(selector)}),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id)}))`);
        const overflow=await ev('document.documentElement.scrollWidth-document.documentElement.clientWidth');
        const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,`screen-${id}-${w}.png`),Buffer.from(shot.data,'base64'));
        rows.push({id:`H${id}-${w}`,screen:id,width:w,mode:'HOSTED_PUBLIC_DEMO',status:axe.violations.length===0&&overflow<=1?'PASS':'FAIL',axe,overflow});
        console.log(rows.at(-1).status,rows.at(-1).id,'axe',axe.violations.length,'overflow',overflow);
      }
    }
    const focused=await runFocusedQa({cdp,ev,go,click,key,fill,wait,visible,base});
    rows.push(...focused.map(r=>({...r,id:'H-'+r.id,mode:'HOSTED_PUBLIC_DEMO'})));
    await go('/bookings/VCT-2026-0001/disruption','[data-public-action-gate]');
    rows.push({id:'H42',screen:'42',status:'BLOCKED',mode:'HOSTED_PUBLIC_DEMO',reason:'Public-demo/auth gate; contrast change verified only with local fixture'});
  }finally{
    cdp?.close();if(chrome.exitCode===null)chrome.kill();
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({applicationSha:process.env.EXPECTED_SHA,deployment:process.env.EXPECTED_DEPLOYMENT,base,environment:'HOSTED_PUBLIC_DEMO',scope:'Affected component QA only; not a replay of all 72 accepted cases',rows},null,2));
    console.log('COUNTS',JSON.stringify(rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
