import type { IncomingMessage, ServerResponse } from 'node:http';
export async function bridgeNodeRequest(req:IncomingMessage,res:ServerResponse,origin:string,handle:(request:Request)=>Promise<Response>):Promise<void>{
  try{
    const chunks:Buffer[]=[];let length=0;
    for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);length+=bytes.length;if(length>65536){res.writeHead(413,{'Content-Type':'application/problem+json','Cache-Control':'no-store'});res.end(JSON.stringify({status:413,code:'REQUEST_TOO_LARGE'}));return;}chunks.push(bytes);}
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
    const method=req.method||'GET';const response=await handle(new Request(new URL(req.url||'/',origin),{method,headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)}));
    res.statusCode=response.status;for(const [key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/problem+json','Cache-Control':'no-store'});res.end(JSON.stringify({status:503,code:'DEMO_SERVICE_UNAVAILABLE'}));}
}
