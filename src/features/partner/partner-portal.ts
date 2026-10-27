import { apiRequest } from '../../lib/services/api-client.service.ts';
const partnerEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderPartnerPortalHtml(_activeTab = 'dashboard'): string {
  queueMicrotask(async () => {
    const root=document.getElementById('partner-server-workspace'); if(!root)return;
    try { const data=await apiRequest<any>('/api/v1/partner/dashboard');
      root.innerHTML='<h2 class="font-heading text-xl font-bold text-brand-primary">Agency workspace</h2><p class="mt-3 text-sm">'+partnerEscape(data.organization?.name||'Your agency')+'</p><p class="mt-2 text-sm text-brand-muted">'+Number(data.clientCount||data.totalClients||0)+' clients</p>';
    } catch(error) { root.innerHTML='<h2 class="font-heading text-xl font-bold text-brand-primary">Agency access</h2><p class="mt-3 text-sm">'+partnerEscape((error as Error).message)+'</p><p class="mt-2 text-sm text-brand-muted">Use an authorized agency account to continue.</p>'; }
  });
  return '<div id="partner-server-workspace" class="p-6" role="status">Loading your agency workspace…</div>';
}
