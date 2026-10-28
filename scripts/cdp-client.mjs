import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
export class BrowserCheck {
  sequence=0;pending=new Map();exceptions=[];consoleErrors=[];
  async start(port,profile){
    const chrome=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));if(!chrome)throw new Error('Chrome required');
    this.process=spawn(chrome,['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--no-default-browser-check','--remote-allow-origins=*',`--remote-debugging-port=${port}`,`--user-data-dir=${path.resolve(profile)}`,'about:blank'],{stdio:'ignore'});
    let target;for(let attempt=0;attempt<100&&!target;attempt++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!target)await new Promise(r=>setTimeout(r,100));}if(!target)throw new Error('Chrome did not start');
    this.ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});
    this.ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')this.exceptions.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')this.consoleErrors.push(m.params.args.map(a=>a.value||a.description).join(' '));});
    await this.send('Page.enable');await this.send('Runtime.enable');await this.send('Network.enable');await this.send('Network.setCacheDisabled',{cacheDisabled:true});
  }
  send(method,params={}){const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timed out: '+method));},45000);this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});this.ws.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));return r.result.value;}
  async until(expression){const start=Date.now();while(Date.now()-start<30000){if(await this.evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,80));}throw new Error('Browser state not reached: '+expression);}
  async navigate(url){
    // A previous document may still answer Runtime.evaluate just after Page.navigate.
    // Require a fresh document at the explicit URL before accepting any route checks.
    await this.evaluate('window.__PHASE18_PREVIOUS_DOCUMENT__ = true');
    const result=await this.send('Page.navigate',{url});if(result.errorText)throw new Error('Navigation failed: '+result.errorText);
    await this.until(`!window.__PHASE18_PREVIOUS_DOCUMENT__ && location.href === ${JSON.stringify(new URL(url).href)} && document.readyState === 'complete' && window.__VACATINA_ROUTER__ && window.__VACATINA_OS__`);
  }
  async viewport(width){await this.send('Emulation.setDeviceMetricsOverride',{width,height:width===768?1024:900,deviceScaleFactor:1,mobile:width===360});}
  async shot(file,fullPage=false){const metrics=fullPage?await this.send('Page.getLayoutMetrics'):undefined;const {data}=await this.send('Page.captureScreenshot',{format:'png',fromSurface:true,...(metrics?{captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}}:{})});fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(data,'base64'));}
  close(){this.ws?.close();this.process?.kill();}
}
