import { createHash, randomUUID } from 'node:crypto';
import { AuthorizationEngine } from '../auth/rbac.ts';
import type { SecurityContext } from '../auth/rbac.ts';
import type { TripBucketCandidate } from '../../lib/domain/types.ts';
import type { EnquiryRecord, ReadinessRepositories, ReadinessUnitOfWork, TripBucketRecord } from '../persistence/readiness-contracts.ts';
import { ReadinessError } from '../persistence/readiness-contracts.ts';

const products = new Set(['flights','hotels','visa','packages','cars','rails','cruises','activities','sightseeing','insurance']);
const keys = new Set(['destination','origin','departureDate','returnDate','checkIn','checkOut','adults','children','infants','rooms','applicants','applicantCount','citizenshipCountry','citizenshipCountryCode','residenceCountry','purpose','travelDate','serviceType','tripType','pickup','dropoff','pickupTime','returnTime','luggage','driverAge','cabinClass','roomType','boardBasis','selectedRoomId','selectedPlanId','selectedFareFamilyCode','timeSlot','language','ticketType','requestedCategory','cabinType','cabinPreference','departurePort','travellerAges','coverageOption','coveragePreference','policyReviewAcknowledged','durationDays','durationPreference','packageStyle','packageStylePreference','accommodationTier','vehicleCategory','itineraryPreference']);
for(const key of ['hotelId','roomId','roomName','planId','rateName','boardBasisLabel','checkInDate','checkOutDate','nights','roomsCount','adultsCount','childrenCount','travelWindow','optionId'])keys.add(key);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function planningConfiguration(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input).filter(([key, value]) => keys.has(key) && ['string','number','boolean'].includes(typeof value));
  if (entries.some(([, value]) => typeof value === 'number' && !Number.isFinite(value))) throw new ReadinessError('INVALID_CONFIGURATION', 400);
  for (const [key,value] of entries) {
    if (['departureDate','returnDate','checkIn','checkOut','checkInDate','checkOutDate','travelDate'].includes(key) && value && (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || !Number.isFinite(Date.parse(String(value))) || new Date(String(value)).toISOString().slice(0,10)!==value)) throw new ReadinessError('INVALID_DATE',400);
    if (['adults','children','infants','rooms','applicants','applicantCount','roomsCount','adultsCount','childrenCount'].includes(key) && (!Number.isSafeInteger(Number(value)) || Number(value)<0 || Number(value)>9)) throw new ReadinessError('INVALID_TRAVELLERS',400);
  }
  return Object.fromEntries(entries.map(([key,value]) => [key, typeof value === 'string' ? value.slice(0,500) : value])) as Record<string,string|number|boolean>;
}
function text(value: unknown, max = 200): string { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function selectionConfiguration(candidate:TripBucketCandidate):Record<string,unknown>{
  const config:Record<string,unknown>=planningConfiguration({...candidate.searchContext,...candidate.configuration});
  const legs=candidate.configuration?.legs;
  if(legs!==undefined){
    if(candidate.productType!=='flights'||!Array.isArray(legs)||legs.length<2||legs.length>6)throw new ReadinessError('INVALID_CONFIGURATION',400);
    config.legs=legs.map(leg=>{
      if(!leg||typeof leg!=='object'||!/^[A-Z]{3}$/.test(leg.origin)||!/^[A-Z]{3}$/.test(leg.destination))throw new ReadinessError('INVALID_CONFIGURATION',400);
      const date=planningConfiguration({departureDate:leg.departureDate}).departureDate;
      if(!date)throw new ReadinessError('INVALID_DATE',400);
      return {origin:leg.origin,destination:leg.destination,departureDate:date};
    });
  }
  if(candidate.fareFamilyCode)config.selectedFareFamilyCode=text(candidate.fareFamilyCode);
  if(candidate.selectedServiceIds){
    if(!Array.isArray(candidate.selectedServiceIds)||candidate.selectedServiceIds.length>50||candidate.selectedServiceIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(id)))throw new ReadinessError('INVALID_CONFIGURATION',400);
    config.selectedServiceIds=[...new Set(candidate.selectedServiceIds)];
  }
  if(candidate.productType==='visa')Object.assign(config,{eligibilityState:'MANUAL_REVIEW_REQUIRED',applicationState:'LOCAL_REQUEST_NOT_SUBMITTED',documentUploadState:'NOT_UPLOADED'});
  return config;
}
function revision(actual: number, expected: unknown): void { if (!Number.isSafeInteger(expected) || actual !== expected) throw new ReadinessError('REVISION_CONFLICT'); }
function owner(context: SecurityContext, record: { ownerId: string; organizationId?: string }): void {
  if (record.ownerId !== context.userId || record.organizationId !== context.organizationId) throw new ReadinessError('RESOURCE_NOT_FOUND',404);
}
function operator(context: SecurityContext, tenant?: string): void {
  if (!['SUPPORT_STAFF','OPS_SUPERVISOR','PLATFORM_ADMIN'].includes(context.role) || !context.isElevatedMfa ||
    context.organizationId !== tenant || !AuthorizationEngine.hasPermission(context,'ops:triage_queue')) throw new ReadinessError('OPERATOR_AUTHORIZATION_REQUIRED',403);
}

/** Non-commercial request boundary. Never invokes a supplier, booking, payment or notification client. */
export class EnquiryService {
  private persistence: ReadinessUnitOfWork;
  private clock: () => number;
  constructor(persistence: ReadinessUnitOfWork, clock: () => number = Date.now) { this.persistence=persistence; this.clock=clock; }
  private now(): string { return new Date(this.clock()).toISOString(); }
  private base(context: SecurityContext, id: string) { return { id, ownerId:context.userId, organizationId:context.organizationId, createdAt:this.now(),updatedAt:this.now() }; }
  private tripId(context: SecurityContext): string { return 'planning_' + digest([context.userId,context.organizationId]).slice(0,40); }
  private async mutate<T>(context: SecurityContext, action: string, input: unknown, key: string, work: (r: ReadinessRepositories) => Promise<T>): Promise<T> {
    if (!context.userId) throw new ReadinessError('SESSION_REQUIRED',401);
    if (!/^[A-Za-z0-9_-]{8,180}$/.test(key || '')) throw new ReadinessError('IDEMPOTENCY_KEY_REQUIRED',400);
    const id = 'enquiry_mutation_' + digest([context.userId,context.organizationId,context.role,context.isElevatedMfa,action,key]);
    return this.persistence.transaction(async r => {
      const previous = await r.idempotency.get(id), requestHash = digest(input);
      if (previous) { if (previous.requestHash !== requestHash) throw new ReadinessError('IDEMPOTENCY_CONFLICT'); return previous.result as T; }
      const result = await work(r);
      await r.events.put({id:randomUUID(),ownerId:context.userId,actorUserId:context.userId,actorOrganizationId:context.organizationId,actorRole:context.role,action,operation:action,targetEntity:'non_commercial_planning',targetEntityId:'owner-scoped',previousState:{},newState:{committed:true},status:'COMMITTED',timestamp:this.now(),correlationId:randomUUID(),justificationReason:'Explicit demo action; no commercial state or external delivery inferred.'});
      await r.idempotency.put({ ...this.base(context,id),scope:action,requestHash,result });
      return result;
    });
  }
  async trip(context: SecurityContext): Promise<TripBucketRecord | undefined> {
    return this.persistence.transaction(async r => { const trip = await r.trips.get(this.tripId(context)); if (trip) owner(context,trip); return trip; });
  }
  async save(context: SecurityContext, input: { items: TripBucketCandidate[]; expectedRevision: number; preferences?: unknown; products?: string[] }, key: string): Promise<TripBucketRecord> {
    if (!Array.isArray(input.items) || input.items.length > 30) throw new ReadinessError('INVALID_SELECTIONS',400);
    if(input.products!==undefined&&!Array.isArray(input.products))throw new ReadinessError('INVALID_SELECTIONS',400);
    return this.mutate(context,'planning.save',input,key,async r => {
      const id = this.tripId(context), previous = await r.trips.get(id);
      if (previous) owner(context,previous);
      revision(previous?.revision || 0,input.expectedRevision);
      const display: TripBucketCandidate[] = input.items.map(candidate => {
        if(!candidate||typeof candidate!=='object')throw new ReadinessError('INVALID_SELECTION',400);
        if (!products.has(candidate.productType) || !text(candidate.id) || !text(candidate.offerId || candidate.canonicalOfferId)) throw new ReadinessError('INVALID_SELECTION',400);
        return { id:text(candidate.id),offerId:text(candidate.offerId || candidate.canonicalOfferId),canonicalOfferId:text(candidate.offerId || candidate.canonicalOfferId),
          productType:candidate.productType,productLabel:candidate.productType,title:text(candidate.title),subtitle:'Saved non-commercial planning selection',dateSummary:text(candidate.dateSummary),travellerSummary:text(candidate.travellerSummary),
          configuration:selectionConfiguration(candidate),travellerCounts:candidate.travellerCounts ? { adults:Number(candidate.travellerCounts.adults)||1,children:Number(candidate.travellerCounts.children)||0,infants:Number(candidate.travellerCounts.infants)||0 } : undefined,
          searchContext:candidate.searchContext?planningConfiguration(candidate.searchContext):undefined,
          fareFamilyCode:text(candidate.fareFamilyCode)||undefined,fareFamilyName:text(candidate.fareFamilyName)||undefined,
          selectedServiceIds:candidate.selectedServiceIds?[...new Set(candidate.selectedServiceIds)]:undefined,
          propertyId:text(candidate.propertyId)||undefined,roomId:text(candidate.roomId)||undefined,ratePlanId:text(candidate.ratePlanId)||undefined,
          state:'needs_action',priceLkr:0,priceStatus:'quote_required',currency:/^[A-Z]{3}$/.test(candidate.currency||'')?candidate.currency:'LKR',sourceType:'SEED',inventoryMode:'demo_fixture',supplierName:'Unverified planning reference',integrationMode:'MOCK',
          sourceId:'BROWSER_PLANNING_REFERENCE',inventoryLabel:'Demo / test planning only',truthDisclosure:'Reference supplied for planning only; no supplier inventory, price, allocation or confirmation is verified.',confirmationMode:'REQUEST_TO_CONFIRM' };
      });
      if (new Set(display.map(item=>item.id)).size !== display.length || new Set(display.map(item=>item.offerId)).size !== display.length) throw new ReadinessError('DUPLICATE_SELECTION',400);
      const trip: TripBucketRecord = previous || { ...this.base(context,id),bucket:{ id,userId:context.userId,organizationId:context.organizationId,sessionId:context.userId,currency:'LKR',status:'ACTIVE',expiresAt:new Date(this.clock()+30*86400000).toISOString(),createdAt:this.now(),updatedAt:this.now() },items:[],revision:0 };
      const previousSelections = trip.items;
      trip.items = [];
      for (const [index,item] of display.entries()) {
        const ref = randomUUID();
        const declared=input.items[index];
        await r.offers.put({ ...this.base(context,ref),snapshot:{ id:ref,canonicalOfferId:item.offerId!,productType:item.productType,sourceType:'SEED',supplierId:'DEMO_PLANNING',title:item.title,rawSupplierCostMinor:0,rawCurrency:item.currency||'LKR',sellingPriceMinor:0,displayCurrency:item.currency||'LKR',inclusions:[],exclusions:[],termsHash:digest('demo-planning-only'),snapshotData:{ declaredReference:item.offerId,declaredSourceType:text(declared.sourceType),declaredInventoryMode:text(declared.inventoryMode),declaredSourceId:text(declared.sourceId),declaredAmountMinor:Number.isSafeInteger(declared.amountMinor)?declared.amountMinor:undefined },createdAt:this.now() },
          authority:{ sourceType:'SEED',environmentClass:'SEED',sellability:'DISCOVERY_ONLY',bookingMode:'REQUEST_TO_BOOK',confirmationMode:'REQUEST_TO_CONFIRM',fulfillmentMode:'MANUAL_CONFIRMATION',providerLifecycle:'SCAFFOLD',commercialStatus:'CANDIDATE_UNVERIFIED',isSandboxSimulated:true } });
        trip.items.push({ offerSnapshotId:ref,item:{ id:item.id,tripBucketId:id,canonicalOfferId:item.offerId!,productType:item.productType,sourceType:'SEED',title:item.title,bookingMode:'REQUEST_TO_BOOK',configuration:item.configuration || {},travellerManifest:item.travellerCounts,unitSellingPriceMinor:0,currency:item.currency||'LKR',state:'NEEDS_ACTION',environmentClass:'SEED',sellability:'DISCOVERY_ONLY',lastRevalidatedAt:'',createdAt:this.now() } });
      }
      const removed = [...(trip.planning?.removed || []),...(trip.planning?.display || []).filter(item=>!display.some(current=>current.id===item.id))].filter(item=>!display.some(current=>current.id===item.id));
      const removedIds = new Set(removed.slice(-30).map(item=>item.id));
      const removedSelections = [...new Map([...(trip.planning?.removedSelections||[]),...previousSelections].filter(s=>removedIds.has(s.item.id)).map(s=>[s.item.id,s])).values()];
      trip.planning = { display,removed:removed.slice(-30),removedSelections,preferences:planningConfiguration(input.preferences ?? trip.planning?.preferences),products:(input.products ?? trip.planning?.products ?? []).filter(product=>products.has(product)) };
      trip.revision++; trip.updatedAt=this.now(); trip.bucket.updatedAt=trip.updatedAt;
      await r.trips.put(trip); return trip;
    });
  }
  async removeOrRestore(context: SecurityContext,id:string,expectedRevision:number,restore:boolean,key:string): Promise<TripBucketRecord> {
    return this.mutate(context,restore?'planning.restore':'planning.remove',{id,expectedRevision},key,async r=>{
      const trip=await r.trips.get(this.tripId(context));if(!trip?.planning)throw new ReadinessError('RESOURCE_NOT_FOUND',404);owner(context,trip);revision(trip.revision,expectedRevision);
      const planning=trip.planning;
      if(restore){const item=planning.removed.find(item=>item.id===id),selected=planning.removedSelections?.find(s=>s.item.id===id);if(!item||!selected)throw new ReadinessError('RESOURCE_NOT_FOUND',404);planning.display.push(item);trip.items.push(selected);planning.removed=planning.removed.filter(i=>i.id!==id);planning.removedSelections=planning.removedSelections?.filter(s=>s.item.id!==id);}
      else{const item=planning.display.find(item=>item.id===id),selected=trip.items.find(s=>s.item.id===id);if(!item||!selected)throw new ReadinessError('RESOURCE_NOT_FOUND',404);planning.removed.push(item);planning.removedSelections=[...(planning.removedSelections||[]),selected];planning.display=planning.display.filter(i=>i.id!==id);trip.items=trip.items.filter(s=>s.item.id!==id);}
      trip.revision++;trip.updatedAt=this.now();await r.trips.put(trip);return trip;
    });
  }
  async submit(context:SecurityContext,input:{expectedRevision:number;consent:boolean},key:string,correlationId:string):Promise<EnquiryRecord> {
    if(input.consent!==true)throw new ReadinessError('CONSENT_REQUIRED',400);
    return this.mutate(context,'enquiry.submit',input,key,async r=>{
      const trip=await r.trips.get(this.tripId(context));if(!trip?.planning?.display.length)throw new ReadinessError('EMPTY_TRIP');owner(context,trip);revision(trip.revision,input.expectedRevision);
      const same=(await r.enquiries.list(context.userId)).find(e=>e.organizationId===context.organizationId&&e.tripId===trip.id&&e.tripRevision===trip.revision&&!e.withdrawn);
      if(same)return same;
      const id=randomUUID(),reference='ENQ-DEMO-'+id.slice(0,8).toUpperCase();
      const enquiry:EnquiryRecord={...this.base(context,id),tripId:trip.id,tripRevision:trip.revision,revision:1,reference,
        ticket:{id,ticketReference:reference,userId:context.userId,organizationId:context.organizationId,category:'CUSTOMER_ENQUIRY',priority:'MEDIUM',status:'OPEN',subject:'Non-commercial planning enquiry',createdAt:this.now()},
        selections:structuredClone(trip.items),display:structuredClone(trip.planning.display),consent:{version:'demo-enquiry-v1',acceptedAt:this.now()},quotations:[],history:[{actorId:context.userId,action:'SUBMITTED',at:this.now(),correlationId}]};
      await r.enquiries.put(enquiry);await this.notify(r,enquiry,context,correlationId);return enquiry;
    });
  }
  private async notify(r:ReadinessRepositories,enquiry:EnquiryRecord,context:SecurityContext,correlationId:string):Promise<void>{
    const id=randomUUID();await r.commands.put({...this.base({...context,userId:enquiry.ownerId},id),aggregateType:'enquiry',aggregateId:enquiry.id,eventType:'DEMO_ENQUIRY_NOTIFICATION',payload:{enquiryId:enquiry.id,revision:enquiry.revision},status:'PENDING',retryCount:0,scheduledAt:this.now(),correlationId});
  }
  async list(context:SecurityContext,admin=false):Promise<EnquiryRecord[]>{
    if(admin)operator(context,context.organizationId);
    return this.persistence.transaction(async r=>{
      // Operator queue is explicitly tenant-scoped. Repository listByTenant is a separate contract, not a global list.
      if(admin)return r.enquiries.listByTenant(context.organizationId || '');
      return (await r.enquiries.list(context.userId)).filter(e=>e.organizationId===context.organizationId);
    });
  }
  async get(context:SecurityContext,id:string,admin=false):Promise<EnquiryRecord>{
    return this.persistence.transaction(async r=>{const e=await r.enquiries.get(id);if(!e)throw new ReadinessError('RESOURCE_NOT_FOUND',404);if(admin)operator(context,e.organizationId);else owner(context,e);return e;});
  }
  async change(context:SecurityContext,id:string,input:{expectedRevision:number;action:string;text?:string;expiresAt?:string;version?:number},key:string,correlationId:string,admin=false):Promise<EnquiryRecord>{
    // Authorization precedes idempotent replay, including expired MFA or changed tenant.
    await this.get(context,id,admin);
    return this.mutate(context,'enquiry.'+input.action,{id,...input},key,async r=>{
      const e=await r.enquiries.get(id);if(!e)throw new ReadinessError('RESOURCE_NOT_FOUND',404);if(admin)operator(context,e.organizationId);else owner(context,e);revision(e.revision,input.expectedRevision);
      if(e.ticket.status==='CLOSED')throw new ReadinessError('ENQUIRY_CLOSED');
      if(!admin){
        if(input.action==='withdraw'){e.withdrawn=true;e.ticket.status='CLOSED';}
        else if(input.action==='acknowledge'){
          const latest=[...e.quotations].reverse().find(q=>q.state==='PUBLISHED');
          if(!latest||latest.version!==input.version||Date.parse(latest.expiresAt)<=this.clock())throw new ReadinessError('QUOTATION_STALE');
          e.acknowledgedVersion=latest.version;
        }else throw new ReadinessError('ACTION_NOT_ALLOWED',403);
      }else{
        if(e.ownerId===context.userId)throw new ReadinessError('SELF_APPROVAL_FORBIDDEN',403);
        if(input.action==='assign'){e.ticket.assignedAgentId=context.userId;e.ticket.status='INVESTIGATING';}
        else if(input.action==='follow-up')e.ticket.status='PENDING_SUPPLIER';
        else if(input.action==='draft-quote'){
          if(!text(input.text,1000)||!Number.isFinite(Date.parse(input.expiresAt||''))||Date.parse(input.expiresAt!)<=this.clock())throw new ReadinessError('INVALID_QUOTATION',400);
          e.quotations.push({version:e.quotations.length+1,state:'DRAFT',authorId:context.userId,text:text(input.text,1000),expiresAt:input.expiresAt!,createdAt:this.now()});
        }else if(input.action==='publish-quote'){
          const q=e.quotations.at(-1);if(!q||q.state!=='DRAFT'||q.version!==input.version||q.authorId===context.userId||Date.parse(q.expiresAt)<=this.clock())throw new ReadinessError('INDEPENDENT_QUOTE_APPROVAL_REQUIRED');
          q.state='PUBLISHED';q.publisherId=context.userId;e.acknowledgedVersion=undefined;
        }else if(input.action==='close'){e.ticket.status='CLOSED';e.ticket.resolvedAt=this.now();}
        else throw new ReadinessError('ACTION_NOT_ALLOWED',403);
      }
      e.revision++;e.updatedAt=this.now();e.history.push({actorId:context.userId,action:input.action,at:this.now(),correlationId});
      await r.enquiries.put(e);await this.notify(r,e,context,correlationId);return e;
    });
  }
}
