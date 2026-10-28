import { createHash, randomUUID } from 'node:crypto';
import { AuthorizationEngine, type SecurityContext } from '../auth/rbac.ts';
import { GuestSessionManager } from '../auth/guest-session.ts';
import { EnquiryService } from '../services/enquiry.service.ts';
import { ReadinessError } from '../persistence/readiness-contracts.ts';
import type { EnquiryRecord, ReadinessUnitOfWork } from '../persistence/readiness-contracts.ts';

interface DemoHttpOptions {
  persistence: ReadinessUnitOfWork; sessionSecret: string;
  /** Server composition injection only; never inferred from caller role/owner headers. */
  authenticate?: (request: Request) => Promise<SecurityContext | null>;
  requestsPerMinute?: number;
}
function customerView(e: EnquiryRecord) {
  return { id:e.id,reference:e.reference,revision:e.revision,status:e.ticket.status,withdrawn:Boolean(e.withdrawn),items:e.display,
    quotations:e.quotations.filter(q=>q.state==='PUBLISHED').map(({version,text,expiresAt})=>({version,text,expiresAt})),
    acknowledgedVersion:e.acknowledgedVersion,notificationStatus:'QUEUED_NOT_SENT',nonCommercial:true,
    history:e.history.map(({action,at})=>({action,at})) };
}
/** Dedicated, deny-by-default loopback composition. No legacy router or external clients imported. */
export function createDemoHttpApplication(options: DemoHttpOptions): (request: Request) => Promise<Response> {
  const service=new EnquiryService(options.persistence), sessions=new GuestSessionManager(options.sessionSecret);
  const buckets=new Map<string,{count:number;until:number}>();
  return async request=>{
    const url=new URL(request.url),method=request.method.toUpperCase();
    const supplied=request.headers.get('x-request-id');const correlationId=supplied&&/^[A-Za-z0-9_-]{8,80}$/.test(supplied)?supplied:randomUUID();
    let cookie:string|undefined;
    const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':status>=400?'application/problem+json':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Request-Id':correlationId,'Vary':'Cookie, Authorization',...(cookie?{'Set-Cookie':cookie}:{})}});
    const fail=(status:number,code:string)=>json({status,code,title:code.replaceAll('_',' '),detail:'Demo service: '+code.replaceAll('_',' ').toLowerCase(),requestId:correlationId},status);
    if(process.env.NODE_ENV==='production'||process.env.VERCEL||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return fail(503,'HOSTED_BACKEND_NOT_QUALIFIED');
    const route=/^\/api\/v1\/(?:health|session|demo\/capabilities|planning\/trip(?:\/items\/[^/]+\/(?:remove|restore))?|enquiries(?:\/[^/]+(?:\/(?:withdraw|acknowledge))?)?|admin\/enquiries(?:\/[^/]+)?)$/;
    if(!route.test(url.pathname))return fail(404,'API_NOT_ALLOWLISTED');
    if(!['GET','PUT','POST'].includes(method))return fail(405,'METHOD_NOT_ALLOWED');
    const origin=request.headers.get('origin');
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return fail(403,'ORIGIN_NOT_ALLOWED');
    try{
      const guest=sessions.resolve(request.headers.get('cookie'));cookie=guest.setCookie;
      const identity=await options.authenticate?.(request);
      if(request.headers.get('authorization')&&!identity)return fail(401,'INVALID_SESSION');
      const context:SecurityContext=identity||{userId:guest.session.id,email:'',role:'CUSTOMER',organizationId:'demo-local'};
      const rateKey=createHash('sha256').update(request.headers.get('authorization')||guest.session.id).digest('hex');
      const globalKey='loopback-total';
      for(const [key,limit] of [[globalKey,(options.requestsPerMinute||120)*5],[rateKey,options.requestsPerMinute||120]] as const){
        const now=Date.now(),rate=buckets.get(key);if(!rate||rate.until<now)buckets.set(key,{count:1,until:now+60000});else if(++rate.count>limit)return fail(429,'RATE_LIMITED');
      }
      if(buckets.size>1000)for(const [key,rate] of buckets)if(rate.until<Date.now())buckets.delete(key);
      if(method==='GET'&&url.pathname==='/api/v1/demo/capabilities')return json({mode:'LOCAL_DURABLE_DEMO',planning:true,enquiries:true,operations:Boolean(identity?.organizationId&&identity.isElevatedMfa&&['SUPPORT_STAFF','OPS_SUPERVISOR','PLATFORM_ADMIN'].includes(identity.role)&&AuthorizationEngine.hasPermission(identity,'ops:triage_queue')),hosted:false,payments:false,bookings:false,sandboxOrders:false,piiCollection:false});
      if(method==='GET'&&url.pathname==='/api/v1/health')return json({status:'OK',mode:'LOCAL_DURABLE_DEMO',productionWrites:false});
      if(method==='GET'&&url.pathname==='/api/v1/session')return json({sessionId:context.userId,authenticated:Boolean(identity),csrfToken:guest.session.csrf,user:identity?{id:identity.userId,role:identity.role}:null,clerk:{},capabilities:{localDurableStorage:true,productionWrites:false}});
      let input:any={};
      if(method!=='GET'){
        if(!origin||!sessions.verifyCsrf(guest.session,request.headers.get('x-csrf-token')))return fail(403,'CSRF_VALIDATION_FAILED');
        if(!request.headers.get('content-type')?.startsWith('application/json'))return fail(415,'JSON_REQUIRED');
        const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
        if(reader)try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>65536){await reader.cancel();return fail(413,'REQUEST_TOO_LARGE');}chunks.push(chunk.value);}}finally{reader.releaseLock();}
        try{input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{return fail(400,'INVALID_JSON');}
        if(!input||typeof input!=='object'||Array.isArray(input))return fail(400,'INVALID_JSON');
      }
      const key=request.headers.get('x-idempotency-key')||'';
      if(url.pathname==='/api/v1/planning/trip'){
        if(method==='GET')return json({trip:await service.trip(context)});
        if(method==='PUT')return json({trip:await service.save(context,input,key)});
      }
      const item=url.pathname.match(/^\/api\/v1\/planning\/trip\/items\/([^/]+)\/(remove|restore)$/);
      if(item&&method==='POST')return json({trip:await service.removeOrRestore(context,decodeURIComponent(item[1]),input.expectedRevision,item[2]==='restore',key)});
      const admin=url.pathname.startsWith('/api/v1/admin/');
      if(admin&&!identity)return fail(401,'SIGN_IN_REQUIRED');
      if(url.pathname==='/api/v1/enquiries'||url.pathname==='/api/v1/admin/enquiries'){
        if(method==='GET'){const all=await service.list(context,admin);const filtered=all.filter(e=>(!url.searchParams.get('status')||e.ticket.status===url.searchParams.get('status'))&&(!url.searchParams.get('product')||e.display.some(item=>item.productType===url.searchParams.get('product'))));return json({enquiries:admin?filtered:filtered.map(customerView)});}
        if(!admin&&method==='POST')return json({enquiry:customerView(await service.submit(context,input,key,correlationId))},201);
      }
      const detail=url.pathname.match(/^\/api\/v1\/(admin\/)?enquiries\/([^/]+)(?:\/(withdraw|acknowledge))?$/);
      if(detail){
        const id=decodeURIComponent(detail[2]);
        if(method==='GET'&&!detail[3]){const e=await service.get(context,id,admin);return json({enquiry:admin?e:customerView(e)});}
        if(method==='POST'&&(admin||detail[3])){const e=await service.change(context,id,{...input,action:admin?input.action:detail[3]},key,correlationId,admin);return json({enquiry:admin?e:customerView(e)});}
      }
      return fail(405,'METHOD_NOT_ALLOWED');
    }catch(error){return error instanceof ReadinessError?fail(error.status,error.code):fail(503,'DEMO_SERVICE_UNAVAILABLE');}
  };
}
