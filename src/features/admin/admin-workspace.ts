import { apiRequest, getApiSession } from '../../lib/services/api-client.service.ts';
import { demoCapabilities, renderEnquiryOperations } from '../enquiries/enquiry-workspace.ts';
import { demoOpsLocalAvailable, enableDemoOpsFixture } from './flight-admin-console.ts';

const adminEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const adminInput = (name: string,label: string,type = 'text',value: unknown = '',required = true) => `<label class="block text-sm font-semibold">${label}<input name="${name}" type="${type}" value="${adminEscape(value)}" ${required?'required':''} class="mt-2 w-full min-h-[44px] border border-brand-border rounded-xl px-3 bg-white"></label>`;

export function adminWorkspaceHtml(): string {
  queueMicrotask(async () => {
    const capabilities = await demoCapabilities();
    const root = document.getElementById('admin-inventory-workspace');
    if (!root) return;
    if (capabilities.operations) await renderEnquiryOperations(root);
    else if ((window as any).__VACATINA_PUBLIC_DEMO__) root.textContent = 'Hosted authentication and operations are disabled. No administrative mutation is available.';
    else if (capabilities.mode === 'LOCAL_DURABLE_DEMO') root.textContent = 'This local session has no authorized operations identity. No administrative actions are enabled.';
    else await loadAdminInventory();
  });
  return `<div id="admin-inventory-workspace" class="p-5 md:p-8 max-w-6xl mx-auto" aria-live="polite"><p role="status">Loading your operations workspace…</p></div>`;
}

export async function loadAdminInventory(): Promise<void> {
  const root = document.getElementById('admin-inventory-workspace');
  if (!root) return;
  try {
    const [session,result] = await Promise.all([getApiSession(true),apiRequest<any>('/api/v1/admin/listings')]);
    const listings = result.listings || [];
    root.innerHTML = `<header class="flex flex-wrap justify-between gap-4 mb-6"><div><p class="text-xs font-semibold text-brand-muted uppercase">Vacatina Operations</p><h2 class="text-2xl font-heading font-bold text-brand-primary mt-2">Inventory & commercial approvals</h2><p class="mt-2 text-sm text-brand-muted">Manage contracted inventory, availability and independent approvals.</p></div><button id="admin-create-listing" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold">New listing</button></header>
      <p class="text-xs text-brand-muted mb-5">Signed in as ${adminEscape(session.user?.email || '')} · ${listings.length} listings</p>
      <div class="flex flex-wrap gap-3 mb-5"><label class="text-sm">Product <select id="admin-product-filter" class="ml-2 border rounded-xl min-h-[44px] px-3"><option value="">All products</option>${['flights','hotels','visa','packages','cars','activities','sightseeing','rails','cruises','insurance'].map(p=>`<option>${p}</option>`).join('')}</select></label><label class="text-sm">Status <select id="admin-status-filter" class="ml-2 border rounded-xl min-h-[44px] px-3"><option value="">All statuses</option>${[...new Set(listings.map((l:any)=>l.status))].map(s=>`<option>${adminEscape(s)}</option>`).join('')}</select></label><button id="admin-refresh" class="min-h-[44px] px-4 border rounded-xl">Refresh</button></div>
      <div id="admin-listing-editor" class="mb-6"></div><div id="admin-listing-list" class="space-y-4"></div><div id="admin-feedback" role="status" class="mt-4 text-sm"></div>`;
    const render = () => {
      const product = (root.querySelector('#admin-product-filter') as HTMLSelectElement).value;
      const status = (root.querySelector('#admin-status-filter') as HTMLSelectElement).value;
      const visible = listings.filter((l:any)=>(!product||l.productType===product)&&(!status||l.status===status));
      root.querySelector('#admin-listing-list')!.innerHTML = visible.length ? visible.map((l:any)=>`<article class="border border-brand-border rounded-2xl p-5 bg-white"><div class="flex flex-wrap justify-between gap-3"><div><p class="text-xs text-brand-muted">${adminEscape(l.productType)} · ${adminEscape(l.location?.city)} · ${adminEscape(l.status)}</p><h3 class="font-heading font-bold text-lg mt-1">${adminEscape(l.title)}</h3><p class="text-sm mt-2">LKR ${Number(l.standardSellingPriceLkr||0).toLocaleString()} · ${Number(l.availableQuota||0)} available ${l.isStopSaleActive?'· Sales stopped':''}</p></div><button data-edit="${adminEscape(l.id)}" class="min-h-[44px] border px-4 rounded-xl">Edit listing</button></div><div class="flex flex-wrap gap-2 mt-4">${[['submit','Submit for review'],['verify-commercial','Verify contract'],['approve-pricing','Approve pricing'],['publish','Publish'],['stop-sale',l.isStopSaleActive?'Resume sales':'Stop sales'],['allotment','Adjust quota'],['audits','Audit history']].map(([action,label])=>`<button data-listing="${adminEscape(l.id)}" data-action="${action}" class="min-h-[44px] px-3 border border-brand-border rounded-xl text-xs font-semibold">${label}</button>`).join('')}</div><div id="audit-${adminEscape(l.id)}" class="mt-3 text-xs"></div></article>`).join('') : '<div class="border rounded-2xl p-8"><h3 class="font-heading font-bold">No matching inventory</h3><p class="text-sm text-brand-muted mt-2">Create a contracted listing and complete the approval workflow to make it available.</p></div>';
    };
    render();
    root.querySelector('#admin-product-filter')!.addEventListener('change',render);
    root.querySelector('#admin-status-filter')!.addEventListener('change',render);
    root.querySelector('#admin-refresh')!.addEventListener('click',()=>void loadAdminInventory());
    root.querySelector('#admin-create-listing')!.addEventListener('click',()=>editListing(root));
    root.onclick = async event=>{
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action],button[data-edit]');
      if (!button) return;
      const listing = listings.find((l:any)=>l.id===(button.dataset.edit||button.dataset.listing));
      if (!listing) return;
      if (button.dataset.edit) { editListing(root,listing); return; }
      const action = button.dataset.action!;
      if (action==='audits') {
        try { const history = await apiRequest<any>(`/api/v1/admin/listings/${encodeURIComponent(listing.id)}/audits`); root.querySelector(`#audit-${CSS.escape(listing.id)}`)!.innerHTML = (history.audits||[]).map((a:any)=>`<p class="py-1">${adminEscape(a.timestampIso)} · ${adminEscape(a.action)} · ${adminEscape(a.changedBy)} · ${adminEscape(a.note)}</p>`).join('') || 'No audit records yet.'; }
        catch(error) { adminFeedback(root,(error as Error).message,true); }
        return;
      }
      showAdminActionForm(root,listing,action);
    };
  } catch (error) {
    root.innerHTML = `<div class="border border-brand-border rounded-2xl p-7"><h2 class="text-xl font-heading font-bold text-brand-primary">Operations access</h2><p class="text-sm mt-3">${adminEscape((error as Error).message)}</p><p class="text-sm text-brand-muted mt-2">Use your authorized Vacatina staff account to manage inventory.</p><button id="admin-signin" class="min-h-[44px] mt-4 px-5 rounded-xl bg-brand-primary text-white">Sign in</button><button id="admin-retry" class="min-h-[44px] mt-4 ml-2 px-5 rounded-xl border">Retry</button>${demoOpsLocalAvailable() ? `<div class="mt-5 pt-5 border-t border-dashed border-amber-300"><p class="text-xs font-bold uppercase tracking-wide text-amber-800">Local UI acceptance only</p><p class="text-xs text-brand-muted mt-1">Real operations remain server-authorised. This local fixture never runs on a hosted origin.</p><button id="admin-demo-console" class="min-h-[44px] mt-3 px-5 rounded-xl border border-dashed border-amber-400 text-amber-900 font-semibold">Enter isolated demo operations console (test fixture)</button></div>` : ''}</div>`;
    root.querySelector('#admin-signin')!.addEventListener('click',()=>window.Clerk?.openSignIn?.());
    root.querySelector('#admin-retry')!.addEventListener('click',()=>void loadAdminInventory());
    root.querySelector('#admin-demo-console')?.addEventListener('click',()=>{
      enableDemoOpsFixture();
      const path = window.location.pathname.startsWith('/admin') ? window.location.pathname : '/admin/suppliers';
      const router=(window as any).__VACATINA_ROUTER__;
      if (router?.navigateTo) router.navigateTo(path);
      else window.location.reload();
    });
  }
}

function adminFeedback(root: HTMLElement,message: string,error = false): void {
  const target = root.querySelector('#admin-feedback');
  if (target) { target.textContent=message; target.className=`mt-4 text-sm ${error?'text-red-700':'text-green-700'}`; }
}

function editListing(root: HTMLElement,listing?: any): void {
  const editor = root.querySelector('#admin-listing-editor')!;
  editor.innerHTML = `<form id="admin-edit-form" class="bg-brand-subtle border border-brand-border rounded-2xl p-5"><h3 class="font-heading font-bold text-lg mb-4">${listing?'Edit inventory':'New inventory draft'}</h3><div class="grid md:grid-cols-2 gap-4">${adminInput('title','Title','text',listing?.title)}<label class="text-sm font-semibold">Product<select name="productType" class="mt-2 w-full min-h-[44px] border rounded-xl px-3">${['flights','hotels','visa','packages','cars','activities','sightseeing','rails','cruises','insurance'].map(p=>`<option ${listing?.productType===p?'selected':''}>${p}</option>`).join('')}</select></label>${adminInput('partnerSupplierId','Supplier reference','text',listing?.partnerSupplierId)}${adminInput('city','Destination city','text',listing?.location?.city)}${adminInput('country','Country','text',listing?.location?.country)}${adminInput('contractReference','Contract reference','text',listing?.contractReference)}${adminInput('contractedBaseCost','Net contract cost (LKR)','number',listing?.contractedBaseCost||'')}${adminInput('standardSellingPriceLkr','Selling price (LKR)','number',listing?.standardSellingPriceLkr||'')}${adminInput('availableQuota','Available quota','number',listing?.availableQuota??0)}${adminInput('effectiveFromIso','Contract starts','date',listing?.effectiveFromIso?.slice(0,10))}${adminInput('effectiveToIso','Contract ends','date',listing?.effectiveToIso?.slice(0,10))}<label class="text-sm font-semibold">Confirmation<select name="bookingMode" class="mt-2 w-full min-h-[44px] border rounded-xl px-3"><option value="REQUEST_TO_BOOK">Request to confirm</option><option value="INSTANT_BOOK" ${listing?.bookingMode==='INSTANT_BOOK'?'selected':''}>Confirmed allotment</option></select></label></div><label class="block text-sm font-semibold mt-4">Cancellation conditions<textarea name="cancellationPolicy" required class="mt-2 border rounded-xl p-3 w-full">${adminEscape(listing?.cancellationPolicy)}</textarea></label><label class="block text-sm font-semibold mt-4">Day-by-day itinerary / product details<textarea name="itinerary" class="mt-2 border rounded-xl p-3 w-full" rows="4">${adminEscape((listing?.sourceMetadata?.itinerary||[]).join('\n'))}</textarea></label><label class="block text-sm font-semibold mt-4">Reason for change<input name="reason" required minlength="5" class="mt-2 border rounded-xl p-3 w-full"></label><p class="text-xs text-brand-muted mt-3">Commercial changes return the listing to draft. Independent verification, pricing approval and publication are required.</p><button class="min-h-[44px] mt-4 px-5 rounded-xl bg-brand-primary text-white font-semibold">Save draft</button><button type="button" id="admin-edit-cancel" class="min-h-[44px] ml-2 px-5 border rounded-xl">Cancel</button></form>`;
  editor.querySelector('#admin-edit-cancel')!.addEventListener('click',()=>editor.replaceChildren());
  editor.querySelector('form')!.addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.currentTarget as HTMLFormElement, values=Object.fromEntries(new FormData(form));
    const data:any={...values,location:{city:values.city,country:values.country},costCurrency:'LKR',displayCurrency:'LKR',standardSellingPriceLkr:Number(values.standardSellingPriceLkr),contractedBaseCost:Number(values.contractedBaseCost),availableQuota:Number(values.availableQuota),validFrom:values.effectiveFromIso,validUntil:values.effectiveToIso,confirmationMode:values.bookingMode==='INSTANT_BOOK'?'INSTANT_CONFIRM':'REQUEST_TO_CONFIRM',sourceType:'MANUAL',inventoryClass:'MANUAL_DIRECT',sourceMetadata:{itinerary:String(values.itinerary||'').split('\n').filter(Boolean)}};
    if (![data.standardSellingPriceLkr,data.contractedBaseCost,data.availableQuota].every(Number.isFinite)||data.standardSellingPriceLkr<=0||data.contractedBaseCost<0||!Number.isInteger(data.availableQuota)||data.availableQuota<0) { adminFeedback(root,'Enter valid positive prices and a whole-number quota.',true); return; }
    const submit=form.querySelector<HTMLButtonElement>('button')!; submit.disabled=true;
    try { await apiRequest(`/api/v1/admin/listings${listing?'/'+encodeURIComponent(listing.id):''}`,{method:listing?'PATCH':'POST',body:JSON.stringify(data)}); await loadAdminInventory(); }
    catch(error) { adminFeedback(root,(error as Error).message,true); submit.disabled=false; }
  });
  editor.scrollIntoView({behavior:'smooth',block:'start'});
}

function showAdminActionForm(root:HTMLElement,listing:any,action:string):void {
  const editor=root.querySelector('#admin-listing-editor')!;
  const fields=action==='verify-commercial'?`${adminInput('referenceId','Evidence reference')}${adminInput('documentPathOrTicket','Contract document / internal ticket reference')}`:action==='approve-pricing'?`${adminInput('standardSellingPriceLkr','Approved selling price (LKR)','number',listing.standardSellingPriceLkr)}`:action==='allotment'?adminInput('quota','New available quota','number',listing.availableQuota):'';
  editor.innerHTML=`<form class="border rounded-2xl p-5 bg-brand-subtle"><h3 class="font-heading font-bold mb-4">${adminEscape(action)} — ${adminEscape(listing.title)}</h3><div class="grid md:grid-cols-2 gap-4">${fields}${adminInput('reason','Reason')}</div><p class="text-xs text-brand-muted mt-3">The server checks your staff permissions and separation of duties before applying this action.</p><button class="min-h-[44px] mt-4 px-5 bg-brand-primary text-white rounded-xl">Confirm action</button><button type="button" data-cancel-action class="min-h-[44px] ml-2 px-5 border rounded-xl">Cancel</button></form>`;
  editor.querySelector('[data-cancel-action]')!.addEventListener('click',()=>editor.replaceChildren());
  editor.querySelector('form')!.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget as HTMLFormElement; const values:any=Object.fromEntries(new FormData(form));
    if(action==='allotment') values.quota=Number(values.quota);
    if(action==='approve-pricing') values.standardSellingPriceLkr=Number(values.standardSellingPriceLkr);
    if(action==='verify-commercial') values.evidence={referenceId:values.referenceId,kind:'BILATERAL_CONTRACT',documentPathOrTicket:values.documentPathOrTicket};
    const button=form.querySelector<HTMLButtonElement>('button')!;button.disabled=true;
    try { await apiRequest(`/api/v1/admin/listings/${encodeURIComponent(listing.id)}/${action}`,{method:'POST',body:JSON.stringify(values)});await loadAdminInventory(); }
    catch(error) {adminFeedback(root,(error as Error).message,true);button.disabled=false;}
  });
  editor.scrollIntoView({behavior:'smooth',block:'start'});
}
