// One-time mechanical replacement of legacy portal simulation modules.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
const root = path.resolve(import.meta.dirname, '..');
function replaceModule(relative, source) {
  const target = path.join(root, relative);
  // Validate both syntax and the exact workspace target before the rewrite.
  parse(source, {sourceType:'module',plugins:['typescript']});
  if (!target.startsWith(root + path.sep)) throw new Error('Invalid source target');
  fs.chmodSync(target,0o666);
  fs.writeFileSync(target,source);
}
replaceModule('src/features/admin/admin-portal.ts', `import { adminWorkspaceHtml } from './admin-workspace.ts';
export function renderAdminPortalHtml(_activeTab = 'overview'): string { return adminWorkspaceHtml(); }
`);
replaceModule('src/features/partner/partner-portal.ts', `import { apiRequest } from '../../lib/services/api-client.service.ts';
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
`);
