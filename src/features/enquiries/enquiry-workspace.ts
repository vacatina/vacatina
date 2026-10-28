import { apiRequest } from '../../lib/services/api-client.service.ts';
import { tripBucketService } from '../../lib/services/trip-bucket.service.ts';

export const enquiryEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let capabilities:Promise<any>|undefined;
let revision=0;
let lastSaved='';
export async function demoCapabilities():Promise<any>{
  if(!capabilities)capabilities=fetch('/api/v1/demo/capabilities',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(async r=>r.ok&&r.headers.get('content-type')?.includes('json')?r.json():{}).catch(()=>({}));
  return capabilities;
}
export async function initializePlanning():Promise<boolean>{
  if(!(await demoCapabilities()).planning)return false;
  const result=await apiRequest('/api/v1/planning/trip');
  revision=result.trip?.revision||0;
  if(result.trip?.planning?.display)tripBucketService.replaceCandidates(result.trip.planning.display);
  lastSaved=JSON.stringify(tripBucketService.getItems());return true;
}
export async function savePlanning(preferences?:unknown,products?:string[]):Promise<void>{
  const items=tripBucketService.getItems();
  if(preferences===undefined&&lastSaved===JSON.stringify(items)&&revision>0)return;
  const result=await apiRequest('/api/v1/planning/trip',{method:'PUT',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({items,expectedRevision:revision,preferences,products})});
  revision=result.trip.revision;lastSaved=JSON.stringify(items);
}
export async function mountEnquiryPanel(host:HTMLElement):Promise<void>{
  const caps=await demoCapabilities();if(!host.isConnected)return;
  host.innerHTML=`<section class="mt-8 border border-brand-border rounded-2xl p-5" aria-labelledby="enquiry-title"><h2 id="enquiry-title" class="font-heading text-xl font-semibold">Non-commercial enquiry</h2><p class="text-sm text-brand-muted mt-3">Planning request only. No booking, supplier message, visa filing or payment is created. Do not enter personal information.</p>${caps.enquiries?`<form id="enquiry-submit-form" class="mt-4 space-y-4"><label class="flex gap-3 items-start text-sm"><input name="consent" type="checkbox" required class="mt-1 w-5 h-5"><span>I consent to saving this non-commercial planning request for operations review.</span></label><div class="flex flex-wrap gap-3"><button type="button" data-save-plan class="min-h-[44px] border rounded-xl px-4">Save planning selections</button><button type="submit" class="min-h-[44px] bg-brand-primary text-white rounded-xl px-4">Submit Enquiry</button><a href="/requests" class="min-h-[44px] inline-flex items-center underline">My requests</a></div></form>`:`<button disabled aria-disabled="true" class="min-h-[44px] mt-4 px-4 rounded-xl bg-gray-200 text-gray-500">Submit Enquiry unavailable</button><p class="mt-3 text-sm">Browser-only: secure hosted persistence and isolated authentication are not qualified. Nothing is durably submitted.</p>`}<p data-enquiry-message role="status" class="mt-4 text-sm"></p></section>`;
  const message=host.querySelector<HTMLElement>('[data-enquiry-message]')!;
  host.querySelector('[data-save-plan]')?.addEventListener('click',async()=>{try{await savePlanning();message.textContent='Planning selections saved by the local service. No enquiry submitted.';}catch(e){message.textContent=(e as Error).message;}});
  const form=host.querySelector<HTMLFormElement>('form');
  let key=crypto.randomUUID();
  form?.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!;button.disabled=true;
    try{
      await savePlanning();
      const result=await apiRequest('/api/v1/enquiries',{method:'POST',headers:{'X-Idempotency-Key':key},body:JSON.stringify({expectedRevision:revision,consent:true})});
      message.innerHTML=`Request Submitted: <a class="underline font-semibold" href="/requests/${encodeURIComponent(result.enquiry.id)}">${enquiryEscape(result.enquiry.reference)}</a>. Notification queued, not sent. No booking was created.`;
      key=crypto.randomUUID();
    }catch(e){message.textContent=(e as Error).message;}
    finally{button.disabled=false;}
  });
}
export async function renderEnquiryWorkspace(host:HTMLElement,id?:string):Promise<void>{
  host.innerHTML='<section class="max-w-5xl mx-auto px-4 py-10"><h1 class="font-heading text-3xl">My enquiries</h1><div data-request-content class="mt-6" role="status">Loading request status…</div></section>';
  const root=host.querySelector<HTMLElement>('[data-request-content]')!;
  const load=async()=>{
    try{
      if(!(await demoCapabilities()).enquiries){root.textContent='Request tracking unavailable: this is a browser-only session. No secure hosted request service is connected.';return;}
      const result=await apiRequest(id?`/api/v1/enquiries/${encodeURIComponent(id)}`:'/api/v1/enquiries');
      if(!root.isConnected)return;
      if(!id){root.innerHTML=(result.enquiries||[]).map((e:any)=>`<a href="/requests/${encodeURIComponent(e.id)}" class="block min-h-[44px] border rounded-xl p-4 mb-3">${enquiryEscape(e.reference)} · ${enquiryEscape(e.status)}</a>`).join('')||'No submitted enquiries.';return;}
      const e=result.enquiry;
      root.innerHTML=`<article class="border rounded-2xl p-5 space-y-4"><h2 class="font-heading text-xl">${enquiryEscape(e.reference)}</h2><p>Request status: ${enquiryEscape(e.status)}${e.withdrawn?' · Withdrawn':''}</p><p>Non-commercial request only. Notification queued, not sent.</p><ul>${e.items.map((i:any)=>`<li class="py-2">${enquiryEscape(i.productType)} · ${enquiryEscape(i.title)}</li>`).join('')}</ul>${e.quotations.map((q:any)=>`<section class="border-t pt-4"><h3 class="font-semibold">Quotation version ${q.version}</h3><p>${enquiryEscape(q.text)}</p><p>Expires ${enquiryEscape(q.expiresAt)}</p><button data-ack="${q.version}" class="min-h-[44px] border rounded-xl px-4 mt-3">Acknowledge quotation</button></section>`).join('')}<p>Quotation acknowledgement: ${e.acknowledgedVersion?'version '+e.acknowledgedVersion:'none'}</p>${e.status!=='CLOSED'?'<button data-withdraw class="min-h-[44px] border rounded-xl px-4">Withdraw enquiry</button>':''}<button data-refresh class="min-h-[44px] border rounded-xl px-4">Refresh status</button><p data-action-message role="status"></p></article>`;
      const action=async(name:string,version?:number)=>{try{await apiRequest(`/api/v1/enquiries/${encodeURIComponent(id)}/${name}`,{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedRevision:e.revision,version})});await load();}catch(error){root.querySelector('[data-action-message]')!.textContent=(error as Error).message;}};
      root.querySelector('[data-withdraw]')?.addEventListener('click',()=>void action('withdraw'));
      root.querySelectorAll<HTMLButtonElement>('[data-ack]').forEach(b=>b.addEventListener('click',()=>void action('acknowledge',Number(b.dataset.ack))));
      root.querySelector('[data-refresh]')?.addEventListener('click',()=>void load());
    }catch(error){root.textContent=(error as Error).message;}
  };await load();
}
export async function renderEnquiryOperations(root:HTMLElement):Promise<void>{
  try{
    const result=await apiRequest('/api/v1/admin/enquiries');
    root.innerHTML=`<h2 class="font-heading text-2xl">Customer enquiries</h2><p class="text-sm mt-3">Operations only. No supplier dispatch, payment or notification sending is enabled.</p><div class="mt-5 flex flex-wrap gap-3"><label>Status <select data-queue-status class="min-h-[44px] border rounded-xl"><option value="">All</option>${['OPEN','INVESTIGATING','PENDING_SUPPLIER','CLOSED'].map(s=>`<option>${s}</option>`).join('')}</select></label><label>Product <select data-queue-product class="min-h-[44px] border rounded-xl"><option value="">All</option>${['flights','hotels','visa','packages','cars','rails','cruises','activities','sightseeing','insurance'].map(s=>`<option>${s}</option>`).join('')}</select></label></div><div data-queue class="mt-5 space-y-4"></div><div data-operator-detail class="mt-6"></div>`;
    const render=()=>{const status=(root.querySelector('[data-queue-status]') as HTMLSelectElement).value,product=(root.querySelector('[data-queue-product]') as HTMLSelectElement).value;root.querySelector('[data-queue]')!.innerHTML=result.enquiries.filter((e:any)=>(!status||e.ticket.status===status)&&(!product||e.display.some((i:any)=>i.productType===product))).map((e:any)=>`<button data-enquiry-id="${enquiryEscape(e.id)}" class="block border rounded-xl min-h-[44px] p-4">${enquiryEscape(e.reference)} · ${enquiryEscape(e.ticket.status)}</button>`).join('')||'No matching enquiries.';};render();
    root.querySelectorAll('select').forEach(s=>s.addEventListener('change',render));
    root.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-enquiry-id]');if(button)void detail(button.dataset.enquiryId!).catch(error=>{root.querySelector('[data-operator-detail]')!.textContent=(error as Error).message;});});
    const detail=async(id:string)=>{
      const {enquiry:e}=await apiRequest(`/api/v1/admin/enquiries/${id}`);const mount=root.querySelector<HTMLElement>('[data-operator-detail]')!;
      const index=result.enquiries.findIndex((item:any)=>item.id===e.id);if(index>=0)result.enquiries[index]=e;render();
      mount.innerHTML=`<article class="border rounded-2xl p-5 space-y-4"><h3 class="font-heading text-xl">${enquiryEscape(e.reference)}</h3><p>${enquiryEscape(e.ticket.status)} · Assigned: ${enquiryEscape(e.ticket.assignedAgentId||'unassigned')}</p><pre class="whitespace-pre-wrap break-all text-sm">${enquiryEscape(JSON.stringify(e.display.map((i:any)=>({product:i.productType,configuration:i.configuration})),null,2))}</pre><form data-operator-form><label class="block">Quotation text<textarea name="text" maxlength="1000" class="block w-full border rounded-xl p-3"></textarea></label><label>Expiry<input name="expiresAt" type="datetime-local" class="min-h-[44px] border rounded-xl"></label><div class="mt-4 flex flex-wrap gap-3">${[['assign','Assign to me / investigate'],['follow-up','Record manual supplier follow-up'],['draft-quote','Save quotation draft'],['publish-quote','Publish latest quotation'],['close','Close request']].map(([a,label])=>`<button type="button" data-op="${a}" class="min-h-[44px] border rounded-xl px-3">${label}</button>`).join('')}</div></form><h4 class="font-semibold">Audit history</h4><ul>${e.history.map((h:any)=>`<li>${enquiryEscape(h.at)} · ${enquiryEscape(h.action)} · ${enquiryEscape(h.actorId)}</li>`).join('')}</ul><p>Notifications: queued, not sent.</p><p data-operator-message role="status"></p></article>`;
      mount.querySelector('form')!.insertAdjacentHTML('beforebegin',`<section aria-label="Versioned quotations" class="space-y-3">${e.quotations.map((q:any)=>`<article data-quotation-version="${q.version}" data-quotation-state="${enquiryEscape(q.state)}" class="border rounded-xl p-4 break-words"><h4 class="font-semibold">Quotation ${q.version} · ${enquiryEscape(q.state)}</h4><p>${enquiryEscape(q.text)}</p><p class="text-sm mt-2">Expires ${enquiryEscape(q.expiresAt)} · Author: ${enquiryEscape(q.authorId)}${q.publisherId?' · Publisher: '+enquiryEscape(q.publisherId):''}</p><p class="text-sm mt-2">Non-commercial only. No payment, supplier allocation or booking.</p></article>`).join('')||'<p>No quotation drafts yet.</p>'}</section>`);
      mount.querySelectorAll<HTMLButtonElement>('[data-op]').forEach(button=>button.addEventListener('click',async()=>{const form=mount.querySelector('form')!;const values=Object.fromEntries(new FormData(form));button.disabled=true;try{await apiRequest(`/api/v1/admin/enquiries/${id}`,{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action:button.dataset.op,expectedRevision:e.revision,text:values.text,expiresAt:values.expiresAt?new Date(String(values.expiresAt)).toISOString():undefined,version:e.quotations.at(-1)?.version})});await detail(id);}catch(error){mount.querySelector('[data-operator-message]')!.textContent=(error as Error).message;button.disabled=false;}}));
    };
  }catch(error){root.textContent=(error as Error).message;}
}
