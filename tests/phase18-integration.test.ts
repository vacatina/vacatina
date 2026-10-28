import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { MemoryReadinessUnitOfWork } from '../src/server/persistence/readiness-repositories.ts';
import { LocalReadinessUnitOfWork } from '../src/server/persistence/local-readiness-unit-of-work.ts';
import { EnquiryService } from '../src/server/services/enquiry.service.ts';
import { ReadinessError } from '../src/server/persistence/readiness-contracts.ts';
import { createDemoHttpApplication } from '../src/server/runtime/demo-http-application.ts';
import { searchCacheFingerprint } from '../src/server/inventory/search-fingerprint.ts';
import { HotelsLiteApiAdapter } from '../src/server/inventory/adapters/hotels-liteapi.adapter.ts';
import type { SecurityContext } from '../src/server/auth/rbac.ts';
import type { TripBucketCandidate, TravelProductSlug } from '../src/lib/domain/types.ts';
import hostedDemoHandler from '../src/server/runtime/hosted-demo-closed.mjs';
import { retryLocalFileOperation } from '../src/server/persistence/local-file-operation.ts';
import { DEMO_RELEASE_TARGET, assertDemoProject, assertDemoRollback, assertDemoEnvironment, assertDemoCandidate } from '../scripts/demo-release-guards.mjs';

const customer:SecurityContext={userId:'phase18-customer',email:'',role:'CUSTOMER',organizationId:'isolated-test'};
const ops:SecurityContext={userId:'phase18-operator',email:'',role:'OPS_SUPERVISOR',organizationId:'isolated-test',isElevatedMfa:true};
const publisher:SecurityContext={...ops,userId:'phase18-publisher'};
const allProducts:TravelProductSlug[]=['flights','hotels','visa','packages','cars','rails','cruises','activities','sightseeing','insurance'];
const config={destination:'Dubai',origin:'Colombo',departureDate:'2027-02-01',returnDate:'2027-02-08',adults:2,children:1,infants:0,rooms:2,roomType:'TWIN',boardBasis:'BREAKFAST',citizenshipCountry:'LK',residenceCountry:'LK',purpose:'tourism',applicantCount:2,packageStyle:'CUSTOM_QUOTE',accommodationTier:'TO_CONFIRM',itineraryPreference:'City highlights',serviceType:'transfer',pickup:'DXB',dropoff:'Marina',pickupTime:'12:30',returnTime:'10:30',driverAge:30,vehicleCategory:'ACCESS_REQUEST',luggage:3,cabinClass:'first',cabinType:'BALCONY_REQUEST',departurePort:'Barcelona',timeSlot:'OPERATOR_CONFIRM',language:'English',ticketType:'PARTICIPANT_REQUEST',travellerAges:'30,31,8',coverageOption:'POLICY_REVIEW',policyReviewAcknowledged:true};
export const candidate=(product:TravelProductSlug,index=0):TripBucketCandidate=>({id:'planning-'+product+'-'+index,offerId:'DEMO-'+product+'-'+index,productType:product,productLabel:product,title:'Labelled demo '+product+' option '+index,subtitle:'Not supplier inventory',dateSummary:'2027-02-01',travellerSummary:'2 adults',state:'needs_action',priceLkr:0,priceStatus:'quote_required',inventoryMode:'demo_fixture',sourceType:'MANUAL',supplierName:'Fixture only',integrationMode:'MOCK',configuration:{...config}});
const rejects=(code:string)=>(error:unknown)=>error instanceof ReadinessError&&error.code===code;

test('Phase 18 file retry is bounded and only retries EPERM/EBUSY operations',async()=>{
  let calls=0;await retryLocalFileOperation(async()=>{calls++;if(calls<3)throw Object.assign(new Error('Transient handle'),{code:calls===1?'EPERM':'EBUSY'});});assert.equal(calls,3);
  calls=0;await assert.rejects(retryLocalFileOperation(async()=>{calls++;throw Object.assign(new Error('Access denied'),{code:'EACCES'});}),/Access denied/);assert.equal(calls,1);
  calls=0;await assert.rejects(retryLocalFileOperation(async()=>{calls++;throw Object.assign(new Error('Handle remains busy'),{code:'EBUSY'});}),/Handle remains busy/);assert.equal(calls,8);
});

test('Phase 18 all ten configurations and bundle preferences survive durable process reconstruction',async()=>{
  const file=path.resolve('tmp','phase18-tests',randomUUID()+'.json');
  const first=new EnquiryService(new LocalReadinessUnitOfWork(file));
  await first.save(customer,{items:allProducts.map(p=>candidate(p)),expectedRevision:0,preferences:config,products:['flights','hotels','cars']},'save-all-products');
  const next=new EnquiryService(new LocalReadinessUnitOfWork(file));const trip=(await next.trip(customer))!;
  assert.equal(trip.items.length,10);assert.equal(trip.revision,1);assert.deepEqual(trip.planning!.products,['flights','hotels','cars']);
  for(const item of trip.planning!.display){assert.deepEqual(item.configuration,config);assert.equal(item.state,'needs_action');assert.equal(item.priceStatus,'quote_required');}
  assert.equal(trip.items.every(i=>i.item.sellability==='DISCOVERY_ONLY'),true);
  await fs.unlink(file);
});
test('Phase 18 request idempotency, immutable dossier and pending outbox are atomic',async()=>{
  const store=new MemoryReadinessUnitOfWork(),service=new EnquiryService(store);const trip=await service.save(customer,{items:allProducts.map(p=>candidate(p)),expectedRevision:0},'save-dossier');
  const request=await service.submit(customer,{expectedRevision:trip.revision,consent:true},'submit-dossier','correlation-test');
  assert.deepEqual(await service.submit(customer,{expectedRevision:1,consent:true},'submit-dossier','correlation-test'),request);
  assert.equal((await service.submit(customer,{expectedRevision:1,consent:true},'different-submit-key','correlation-test')).id,request.id);
  await service.save(customer,{items:[candidate('hotels')],expectedRevision:1},'change-after-submit');
  assert.equal((await service.get(customer,request.id)).display.length,10);
  await store.transaction(async r=>{assert.equal((await r.bookings.list(customer.userId)).length,0);assert.equal((await r.commands.list(customer.userId))[0].status,'PENDING');assert.equal((await r.enquiries.list(customer.userId)).length,1);assert.ok((await r.events.list(customer.userId)).length>=2);});
  await assert.rejects(service.submit(customer,{expectedRevision:2,consent:false},'submit-denied','correlation-test'),rejects('CONSENT_REQUIRED'));
});
test('Phase 18 remove/restore uses revisions and replays without duplicate mutation',async()=>{
  const service=new EnquiryService(new MemoryReadinessUnitOfWork());const item=candidate('hotels');await service.save(customer,{items:[item],expectedRevision:0},'save-remove');
  const removed=await service.removeOrRestore(customer,item.id,1,false,'remove-selected');assert.equal(removed.items.length,0);
  assert.deepEqual(await service.removeOrRestore(customer,item.id,1,false,'remove-selected'),removed);
  const restored=await service.removeOrRestore(customer,item.id,2,true,'restore-selected');assert.equal(restored.items[0].item.id,item.id);
  await assert.rejects(service.save(customer,{items:[],expectedRevision:1},'stale-edit-key'),rejects('REVISION_CONFLICT'));
});
test('Phase 18 independent local instances serialize conflicting writes',async()=>{
  const file=path.resolve('tmp','phase18-tests',randomUUID()+'.json');
  const services=[new EnquiryService(new LocalReadinessUnitOfWork(file)),new EnquiryService(new LocalReadinessUnitOfWork(file))];
  const result=await Promise.allSettled(services.map((s,i)=>s.save(customer,{items:[candidate('hotels',i)],expectedRevision:0},'parallel-'+i)));
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await services[0].trip(customer))!.revision,1);await fs.unlink(file);
});
test('Phase 18 local read-only queries preserve the durable file and failed writes roll back',async()=>{
  const file=path.resolve('tmp','phase18-tests',randomUUID()+'.json'),store=new LocalReadinessUnitOfWork(file),service=new EnquiryService(store);
  await service.save(customer,{items:[candidate('hotels')],expectedRevision:0},'read-only-snapshot');
  const before=await fs.readFile(file,'utf8');await fs.utimes(file,new Date('2025-01-01'),new Date('2025-01-01'));
  const modified=(await fs.stat(file)).mtimeMs;
  assert.equal((await service.trip(customer))?.revision,1);
  assert.equal((await fs.stat(file)).mtimeMs,modified,'Reading must not rename/rewrite the durable snapshot');
  await assert.rejects(store.transaction(async r=>{const trip=(await r.trips.list(customer.userId))[0];trip.revision++;await r.trips.put(trip);throw new Error('Injected before commit');}),/Injected before commit/);
  assert.equal(await fs.readFile(file,'utf8'),before);assert.equal((await service.trip(customer))?.revision,1);await fs.unlink(file);
});
test('Phase 18 two distinct options per product retain identity, declared currency and independent configuration',async()=>{
  const file=path.resolve('tmp','phase18-tests',randomUUID()+'.json');
  const items=allProducts.flatMap(product=>[0,1].map(index=>({...candidate(product,index),currency:index?'USD':'LKR',configuration:{...config,destination:index?'London':'Dubai',rooms:index?1:2}})));
  const first=new EnquiryService(new LocalReadinessUnitOfWork(file));await first.save(customer,{items,expectedRevision:0},'multi-option-planning');
  const service=new EnquiryService(new LocalReadinessUnitOfWork(file));const restored=(await service.trip(customer))!;
  assert.equal(restored.items.length,20);assert.equal(new Set(restored.items.map(s=>s.item.canonicalOfferId)).size,20);
  for(const original of items){const selected=restored.planning!.display.find(i=>i.id===original.id)!;assert.deepEqual(selected.configuration,original.configuration);assert.equal(selected.currency,original.currency);assert.equal(selected.state,'needs_action');}
  const removed=await service.removeOrRestore(customer,items[1].id,1,false,'remove-second-option');assert.equal(removed.items.length,19);
  assert.equal(removed.planning!.display.some(i=>i.id===items[0].id),true);
  const enquiry=await service.submit(customer,{expectedRevision:2,consent:true},'multi-option-submit','multi-option-correlation');assert.equal(enquiry.display.length,19);
  await service.removeOrRestore(customer,items[1].id,2,true,'restore-second-option');assert.equal((await service.get(customer,enquiry.id)).display.length,19);await fs.unlink(file);
});
test('Phase 18 exact owner/tenant and operator MFA isolation precedes replay',async()=>{
  const service=new EnquiryService(new MemoryReadinessUnitOfWork());await service.save(customer,{items:[candidate('visa')],expectedRevision:0},'save-ownership');const e=await service.submit(customer,{expectedRevision:1,consent:true},'submit-ownership','correlation');
  for(const actor of [{...customer,userId:'other'},{...customer,organizationId:'other-tenant'}])await assert.rejects(service.get(actor,e.id),rejects('RESOURCE_NOT_FOUND'));
  await assert.rejects(service.get({...ops,isElevatedMfa:false},e.id,true),rejects('OPERATOR_AUTHORIZATION_REQUIRED'));
  await assert.rejects(service.get({...ops,organizationId:'other'},e.id,true),rejects('OPERATOR_AUTHORIZATION_REQUIRED'));
  assert.equal((await service.list(ops,true)).length,1);assert.equal((await service.list({...ops,organizationId:'empty'},true)).length,0);
  await service.change(ops,e.id,{expectedRevision:1,action:'assign'},'assign-owner','correlation',true);
  await assert.rejects(service.change({...ops,isElevatedMfa:false},e.id,{expectedRevision:1,action:'assign'},'assign-owner','correlation',true),rejects('OPERATOR_AUTHORIZATION_REQUIRED'));
});
test('Phase 18 quotation lifecycle requires independent publication and fresh customer acknowledgement',async()=>{
  let now=Date.now();const service=new EnquiryService(new MemoryReadinessUnitOfWork(),()=>now);await service.save(customer,{items:[candidate('cars')],expectedRevision:0},'save-quotation');let e=await service.submit(customer,{expectedRevision:1,consent:true},'submit-quotation','correlation');
  e=await service.change(ops,e.id,{expectedRevision:e.revision,action:'assign'},'assign-quotation','correlation',true);
  e=await service.change(ops,e.id,{expectedRevision:e.revision,action:'follow-up'},'followup-quotation','correlation',true);assert.equal(e.ticket.status,'PENDING_SUPPLIER');
  e=await service.change(ops,e.id,{expectedRevision:e.revision,action:'draft-quote',text:'Demo terms only; no payable quote.',expiresAt:new Date(now+60000).toISOString()},'draft-quotation','correlation',true);
  await assert.rejects(service.change(ops,e.id,{expectedRevision:e.revision,action:'publish-quote',version:1},'self-publish-quote','correlation',true),rejects('INDEPENDENT_QUOTE_APPROVAL_REQUIRED'));
  e=await service.change(publisher,e.id,{expectedRevision:e.revision,action:'publish-quote',version:1},'publish-quotation','correlation',true);
  e=await service.change(customer,e.id,{expectedRevision:e.revision,action:'acknowledge',version:1},'acknowledge-quotation','correlation');assert.equal(e.acknowledgedVersion,1);
  now+=120000;await assert.rejects(service.change(customer,e.id,{expectedRevision:e.revision,action:'acknowledge',version:1},'expired-quotation','correlation'),rejects('QUOTATION_STALE'));
  e=await service.change(customer,e.id,{expectedRevision:e.revision,action:'withdraw'},'withdraw-quotation','correlation');assert.equal(e.withdrawn,true);
  await assert.rejects(service.change(ops,e.id,{expectedRevision:e.revision,action:'assign'},'reopen-quotation','correlation',true),rejects('ENQUIRY_CLOSED'));
});
test('Phase 18 private fields, browser prices and commercial assertions never become authority',async()=>{
  const service=new EnquiryService(new MemoryReadinessUnitOfWork());const item={...candidate('insurance'),state:'ready',priceLkr:100000,configuration:{...config,passportNumber:'MUST-NOT-STORE',accessToken:'MUST-NOT-STORE'}} as TripBucketCandidate;
  const trip=await service.save(customer,{items:[item],expectedRevision:0},'sanitize-planning');assert.ok(!JSON.stringify(trip).includes('MUST-NOT-STORE'));assert.equal(trip.items[0].item.unitSellingPriceMinor,0);assert.equal(trip.items[0].item.state,'NEEDS_ACTION');
});
test('Phase 18 material search dimensions produce independent fingerprints',()=>{
  const query={productType:'hotels' as const,destination:'Dubai',departureDate:'2027-02-01',returnDate:'2027-02-03',adults:2,rooms:1,currency:'USD',channel:'B2C' as const};
  const key=searchCacheFingerprint(query);assert.equal(key,searchCacheFingerprint({...query}));
  for(const change of [{returnDate:'2027-02-04'},{adults:3},{rooms:2},{currency:'LKR'},{channel:'B2B' as const}])assert.notEqual(key,searchCacheFingerprint({...query,...change}));
});
test('Phase 18 configured LiteAPI failures cannot return deterministic supplier offers',async()=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('private supplier diagnostics',{status:503});
  try{await assert.rejects(new HotelsLiteApiAdapter('sandbox','synthetic-unit-key').search({productType:'hotels',destination:'Dubai'}),/No supplier inventory was substituted/);}finally{globalThis.fetch=previous;}
});
test('Phase 18 HTTP allowlist, CSRF, body bounds, safe errors and customer/operator round trip',async()=>{
  const serviceStore=new MemoryReadinessUnitOfWork();const token=randomBytes(32).toString('hex');
  const app=createDemoHttpApplication({persistence:serviceStore,sessionSecret:randomBytes(48).toString('hex'),authenticate:async r=>r.headers.get('authorization')==='Bearer '+token?ops:null});
  const origin='http://127.0.0.1:4188';let cookie='';let csrf='';
  const request=async(p:string,method='GET',data?:unknown,authorization?:string,includeCsrf=true)=>{const res=await app(new Request(origin+p,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{origin,'content-type':'application/json','x-idempotency-key':randomUUID(),...(includeCsrf?{'x-csrf-token':csrf}:{})}:{}),...(authorization?{authorization}:{} )},body:data===undefined?undefined:JSON.stringify(data)}));if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie')!.split(';')[0];return res;};
  const session=await request('/api/v1/session');csrf=(await session.json()).csrfToken;
  for(const p of ['/api/v1/travel-credit/refund','/api/v1/admin/triage','/api/v1/bookings','/api/v1/flights/sandbox/orders','/api/v1/webhooks/stripe']){const res=await request(p,'POST',{});assert.equal(res.status,404);assert.match(res.headers.get('content-type')!,/problem\+json/);}
  assert.equal((await request('/api/v1/planning/trip','PUT',{items:[],expectedRevision:0},undefined,false)).status,403);
  assert.equal((await request('/api/v1/planning/trip','PUT',{items:allProducts.map(p=>candidate(p)),expectedRevision:0})).status,200);
  const submitted=await request('/api/v1/enquiries','POST',{expectedRevision:1,consent:true});assert.equal(submitted.status,201);const e=(await submitted.json()).enquiry;assert.equal(e.notificationStatus,'QUEUED_NOT_SENT');
  assert.equal((await request('/api/v1/admin/enquiries')).status,401);
  // Operator uses the same tenant as this signed guest's isolated demo tenant.
  const opApp=createDemoHttpApplication({persistence:serviceStore,sessionSecret:randomBytes(48).toString('hex'),authenticate:async()=>({...ops,organizationId:'demo-local'})});
  const queue=await opApp(new Request(origin+'/api/v1/admin/enquiries'));assert.equal((await queue.json()).enquiries[0].id,e.id);
  const customerApp=createDemoHttpApplication({persistence:serviceStore,sessionSecret:randomBytes(48).toString('hex'),authenticate:async()=>({...customer,organizationId:'demo-local'})});
  assert.equal((await (await customerApp(new Request(origin+'/api/v1/demo/capabilities'))).json()).operations,false);
  assert.equal((await customerApp(new Request(origin+'/api/v1/admin/enquiries'))).status,403);
  assert.equal((await request('/api/v1/enquiries','POST',{padding:'x'.repeat(66000)})).status,413);
  const cross=await app(new Request(origin+'/api/v1/enquiries',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}));assert.equal(cross.status,403);
  const unsupported=await request('/api/v1/enquiries','PUT',{});assert.equal(unsupported.status,405);
});
test('Phase 18 HTTP rate limiting is independent of request body identifiers',async()=>{
  const app=createDemoHttpApplication({persistence:new MemoryReadinessUnitOfWork(),sessionSecret:randomBytes(48).toString('hex'),requestsPerMinute:2});let cookie='';
  for(let i=0;i<3;i++){const response=await app(new Request('http://localhost/api/v1/health',{headers:{cookie}}));cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;assert.equal(response.status,i===2?429:200);}
});
test('Phase 18 hosted API cannot execute any mutation or collect identity',()=>{
  for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS'])for(const url of ['/api/v1/admin/triage','/api/v1/bookings','/api/v1/flights/sandbox/orders','/api/v1/travel-credit/refund','/api/v1/enquiries']){
    let status=0;let body:any;let headers:any;
    hostedDemoHandler({method,url},{writeHead:(s:number,h:any)=>{status=s;headers=h;},end:(value:string)=>{body=JSON.parse(value);}});
    assert.equal(status,503);assert.equal(body.code,'HOSTED_BACKEND_NOT_QUALIFIED');assert.equal(headers['Cache-Control'],'no-store');
  }
  let session:any;hostedDemoHandler({method:'GET',url:'/api/v1/session'},{writeHead:()=>{},end:(value:string)=>{session=JSON.parse(value);}});assert.equal(session.authenticated,false);assert.deepEqual(session.clerk,{});assert.equal(session.capabilities.enquiries,false);
});
test('Phase 18 deployment guards fail closed for wrong project, plan, environment, branch, commit and domain',()=>{
  const t=DEMO_RELEASE_TARGET,sha='a'.repeat(40),now=Date.now();
  const project={id:t.projectId,accountId:t.teamId,name:t.name,nodeVersion:'22.x',targets:{production:{id:'dpl_original'}},link:{type:'github',org:'fixture',repo:'vacatina',productionBranch:'main',deployHooks:[]}};
  assertDemoProject(project,'fixture/vacatina');
  for(const change of [{id:'wrong'},{accountId:'wrong'},{nodeVersion:'24.x'},{link:{...project.link,productionBranch:t.branch}},{link:{...project.link,deployHooks:[{ref:t.branch}]}}])assert.throws(()=>assertDemoProject({...project,...change},'fixture/vacatina'));
  const team={id:t.teamId,billing:{plan:'hobby'}},deployment={id:'dpl_original',projectId:t.projectId,ownerId:t.teamId,target:'production',readyState:'READY'},alias={deploymentId:'dpl_original'};
  const env={VACATINA_ROLLBACK_VERIFIED:'true',VACATINA_ROLLBACK_PLAN:'hobby',VACATINA_ROLLBACK_EVIDENCE:'owner-reviewed-fixture',VACATINA_ROLLBACK_VERIFIED_AT:new Date(now).toISOString()};
  assert.equal(assertDemoRollback(team,deployment,alias,project,env,now).plan,'hobby');
  for(const change of [{VACATINA_ROLLBACK_PLAN:'pro'},{VACATINA_ROLLBACK_VERIFIED_AT:'2025-01-01'},{VACATINA_ROLLBACK_VERIFIED:'false'}])assert.throws(()=>assertDemoRollback(team,deployment,alias,project,{...env,...change},now));
  assert.throws(()=>assertDemoRollback(team,deployment,{deploymentId:'wrong'},project,env,now));
  assertDemoEnvironment({envs:[{key:'PUBLIC_DEMO_LABEL',target:['production']}]});
  for(const data of [{},{envs:[],hiddenProductionEnvCount:1},{envs:[],pagination:{next:123}},{envs:[{key:'CLERK_PUBLISHABLE_KEY',target:['production']}]},{envs:[{key:'DATABASE_URL',target:'production'}]}])assert.throws(()=>assertDemoEnvironment(data));
  const candidate={id:'dpl_candidate',projectId:t.projectId,ownerId:t.teamId,target:'production',readyState:'READY',readySubstate:'STAGED',meta:{githubCommitSha:sha,githubCommitRef:t.branch}},backup={previousDeploymentId:'dpl_original'};
  assertDemoCandidate(candidate,backup,alias,sha);
  for(const change of [{target:null},{ownerId:'wrong'},{readySubstate:'PROMOTED'},{meta:{...candidate.meta,githubCommitSha:'b'.repeat(40)}}])assert.throws(()=>assertDemoCandidate({...candidate,...change},backup,alias,sha));
  assert.throws(()=>assertDemoCandidate(candidate,backup,{deploymentId:'moved'},sha));
  assertDemoCandidate({...candidate,readySubstate:'PROMOTED'},backup,{deploymentId:candidate.id},sha,true);
});
