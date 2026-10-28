/* Explicit loopback-only demo composition. No dotenv, production DB or supplier client. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw new Error('Phase 18 local persistence is not hosted-qualified.');
if(!process.execArgv.includes('--experimental-strip-types')){
  const child=spawn(process.execPath,['--experimental-strip-types','--no-warnings',fileURLToPath(import.meta.url)],{stdio:'inherit',env:process.env});
  process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
  await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code||0;resolve();}));
}else{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const { LocalReadinessUnitOfWork }=await import('../src/server/persistence/local-readiness-unit-of-work.ts');
  const { createDemoHttpApplication }=await import('../src/server/runtime/demo-http-application.ts');
  const { bridgeNodeRequest }=await import('../src/server/runtime/node-bridge.ts');
  const data=path.join(root,'.data');await fs.mkdir(data,{recursive:true});const secretFile=path.join(data,'phase18-session.key');
  try{await fs.writeFile(secretFile,randomBytes(48).toString('base64url'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  const app=createDemoHttpApplication({persistence:new LocalReadinessUnitOfWork(path.join(data,'phase18-readiness.json')),sessionSecret:(await fs.readFile(secretFile,'utf8')).trim()});
  const port=Number(process.env.PORT||4175);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
  const origin='http://127.0.0.1:'+port;
  http.createServer(async(req,res)=>{
    try{
      if(req.headers.host!==new URL(origin).host){res.writeHead(403);res.end();return;}
      const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/')){await bridgeNodeRequest(req,res,origin,app);return;}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      let name=decodeURIComponent(url.pathname);if(name.includes('..')||name.includes('\\')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
      if(!path.extname(name))name='/index.html';
      if(!['/index.html','/screen-04-states.html'].includes(name)&&!name.startsWith('/dist/')&&!name.startsWith('/public/')){res.writeHead(404);res.end();return;}
      const file=path.join(root,name);const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
      const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  }).listen(port,'127.0.0.1',()=>console.log('Phase 18 LOCAL DURABLE DEMO: '+origin+'; no operator authentication configured; no external dispatch.'));
}
