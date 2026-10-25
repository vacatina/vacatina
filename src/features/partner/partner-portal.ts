/* ============================================================================
 * Vacatina B2B Partner Portal Feature Module
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-002, ADR-003
 * Interactive, tenant-scoped partner agency workspace.
 * ============================================================================ */

import { globalStorageEngine } from '../../server/db/storage.ts';

export function renderPartnerPortalHtml(activeTab = 'dashboard'): string {
  const org = globalStorageEngine.getOrganization('org_partner_ceylon_tours');
  const clients = globalStorageEngine.getClientsByOrg('org_partner_ceylon_tours');
  const markups = globalStorageEngine.getMarkupRules('org_partner_ceylon_tours');
  const commissions = globalStorageEngine.getCommissionLedger('org_partner_ceylon_tours');

  const totalCommissionsMinor = commissions.reduce((acc, c) => acc + c.commissionAmountMinor, 0);
  const formattedCommission = `LKR ${(totalCommissionsMinor / 100).toLocaleString()}`;
  const creditLimitFormatted = `LKR ${((org?.creditLimitMinor || 0) / 100).toLocaleString()}`;

  return `
    <div class="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
      <!-- Portal Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-brand-border gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-primary text-white rounded-full">B2B Partner Portal</span>
            <span class="text-xs text-brand-muted">Tenant: ${org?.name || 'Ceylon Prestige Travel'} (ID: ${org?.id})</span>
          </div>
          <h2 class="text-2xl font-heading font-bold text-brand-black mt-1">Agency Operations &amp; Client Management</h2>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="partner-new-quote-btn" class="px-3.5 py-2 text-xs font-semibold bg-brand-primary text-white rounded-xl hover:opacity-90 transition-opacity">
            + New Client Quote
          </button>
          <button type="button" id="partner-new-client-btn" class="px-3.5 py-2 text-xs font-semibold border border-brand-border bg-white text-brand-black rounded-xl hover:bg-brand-subtle transition-colors">
            + Add Client
          </button>
        </div>
      </div>

      <!-- KPI Metrics Strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Active Clients</div>
          <div class="text-2xl font-heading font-bold text-brand-black mt-1">${clients.length}</div>
          <div class="text-[11px] text-emerald-600 font-medium mt-1">✓ Verified corporate &amp; retail</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Accrued Commission</div>
          <div class="text-2xl font-heading font-bold text-brand-primary mt-1">${formattedCommission}</div>
          <div class="text-[11px] text-brand-muted mt-1">Eligible for settlement</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Agency Credit Line</div>
          <div class="text-2xl font-heading font-bold text-brand-black mt-1">${creditLimitFormatted}</div>
          <div class="text-[11px] text-brand-muted mt-1">Multi-currency balance: LKR</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Default Flight Markup</div>
          <div class="text-2xl font-heading font-bold text-brand-black mt-1">${markups[0]?.markupValue || 4.5}%</div>
          <div class="text-[11px] text-brand-muted mt-1">Configured by Agency Owner</div>
        </div>
      </div>

      <!-- Main Portal Sections -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Client Roster (Left 2 cols) -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-heading font-bold text-base text-brand-black">Client Accounts &amp; Corporate Roster</h3>
            <span class="text-xs text-brand-muted">${clients.length} Total Registered</span>
          </div>

          <div class="border border-brand-border rounded-2xl overflow-hidden bg-white">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-brand-subtle text-brand-muted border-b border-brand-border font-semibold">
                  <th class="p-3">Client / Organization</th>
                  <th class="p-3">Contact Person</th>
                  <th class="p-3">Type</th>
                  <th class="p-3">Credit Limit</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-brand-border text-brand-black">
                ${clients.map(c => `
                  <tr class="hover:bg-brand-canvas transition-colors">
                    <td class="p-3 font-semibold">${c.corporateName || c.primaryContactName}</td>
                    <td class="p-3 text-brand-muted">${c.primaryContactName}<br><span class="text-[10px]">${c.email}</span></td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-subtle border border-brand-border">${c.clientType}</span></td>
                    <td class="p-3 tabular-nums">LKR ${(c.creditLimitMinor / 100).toLocaleString()}</td>
                    <td class="p-3"><span class="text-emerald-600 font-semibold">● ${c.status}</span></td>
                    <td class="p-3 text-right">
                      <button type="button" class="text-brand-primary font-semibold hover:underline" onclick="window.VacatinaPartnerPortal?.createQuoteForClient('${c.id}')">Create Quote</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Markup & Commission Summary (Right 1 col) -->
        <div class="space-y-4">
          <h3 class="font-heading font-bold text-base text-brand-black">Dynamic Agency Markups</h3>
          <div class="p-4 rounded-2xl border border-brand-border bg-white space-y-3">
            <p class="text-xs text-brand-muted">
              Configure markup overrides applied to raw supplier rates for this agency's clients.
            </p>
            <div class="space-y-2 pt-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-brand-black">Flights (Scheduled)</span>
                <span class="font-bold text-brand-primary tabular-nums">4.5%</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-brand-black">Hotels &amp; Resorts</span>
                <span class="font-bold text-brand-primary tabular-nums">12.0%</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-brand-black">Cars &amp; Transfers</span>
                <span class="font-bold text-brand-primary tabular-nums">15.0%</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-brand-black">Holiday Packages</span>
                <span class="font-bold text-brand-primary tabular-nums">8.0%</span>
              </div>
            </div>
            <div class="pt-3 border-t border-brand-border">
              <button type="button" id="partner-settlement-btn" class="w-full py-2 text-xs font-semibold bg-brand-subtle text-brand-primary border border-brand-border rounded-xl hover:bg-brand-primary hover:text-white transition-colors">
                Request Commission Settlement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
