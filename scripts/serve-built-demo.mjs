/* Local emulation of emitted Build Output routing; not evidence of Vercel account qualification. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import handler from '../src/server/runtime/hosted-demo-closed.mjs';
const root=path.resolve('.vercel/output/static'),port=Number(process.env.PORT||4176);
const config=JSON.parse(await fs.readFile('.vercel/output/config.json','utf8'));
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(req.headers.host!==url.host){res.writeHead(403);res.end();return;}
  if(url.pathname.startsWith('/api/')||url.pathname==='/demo-api'){handler(req,res);return;}
  for(const route of config.routes)if(route.headers&&new RegExp(route.src).test(url.pathname))for(const [name,value]of Object.entries(route.headers))res.setHeader(name,value);
  let name=decodeURIComponent(url.pathname);
  if(name.includes('..')||name.includes('\\')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  if(!path.extname(name))name='/index.html';
  try{const bytes=await fs.readFile(path.join(root,name));const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(name)]||'application/octet-stream';res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log('Built PUBLIC DEMO emulation: http://127.0.0.1:'+port));
