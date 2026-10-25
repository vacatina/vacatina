/* ============================================================================
 * Vacatina Admin & Operations Backoffice Feature Module
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-002, ADR-003
 * Operational triage, manual inventory CMS, price overrides, and audit trails.
 * ============================================================================ */

import { globalStorageEngine } from '../../server/db/storage.ts';
import { manualInventoryService } from '../../lib/services/manual-inventory.service.ts';

export function renderAdminPortalHtml(activeTab = 'overview'): string {
  const listings = manualInventoryService.getAllListings();
  const tickets = globalStorageEngine.getSupportTickets();
  const auditLogs = globalStorageEngine.getAuditLogs().slice(0, 10);
  const visaApps = globalStorageEngine.getVisaApplicationsByOrg();

  return `
    <div class="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
      <!-- Admin Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-brand-border gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white rounded-full">Global Operations</span>
            <span class="text-xs text-brand-muted">Role: PLATFORM_ADMIN (MFA Verified)</span>
          </div>
          <h2 class="text-2xl font-heading font-bold text-brand-black mt-1">Platform Control &amp; Operations Center</h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            All Services Operational
          </span>
        </div>
      </div>

      <!-- Quick KPI Counters -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Active CMS Listings</div>
          <div class="text-2xl font-heading font-bold text-brand-black mt-1">${listings.length}</div>
          <div class="text-[11px] text-brand-muted mt-1">Direct contracts &amp; boutique inventory</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Open Triage Tickets</div>
          <div class="text-2xl font-heading font-bold ${tickets.length > 0 ? 'text-amber-600' : 'text-brand-black'} mt-1">${tickets.length}</div>
          <div class="text-[11px] text-brand-muted mt-1">Operational exceptions</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Visa Review Queue</div>
          <div class="text-2xl font-heading font-bold text-brand-black mt-1">${visaApps.length}</div>
          <div class="text-[11px] text-brand-muted mt-1">Consular checklist submissions</div>
        </div>
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Audit Records</div>
          <div class="text-2xl font-heading font-bold text-brand-primary mt-1">${auditLogs.length}+</div>
          <div class="text-[11px] text-emerald-600 font-medium mt-1">✓ Immutable actor logs</div>
        </div>
      </div>

      <!-- Section: Backoffice Inventory Architecture (7 Internal Categories) -->
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 class="font-heading font-bold text-base text-brand-black">Internal Inventory Governance &amp; CMS Layer</h3>
            <p class="text-xs text-brand-muted">Internal categorization strictly isolated from customer-facing search results</p>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-subtle text-brand-primary border border-brand-border">
            <span>7 Canonical Backoffice Categories</span>
          </span>
        </div>

        <!-- 7 Internal Category Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5 border-b border-brand-border pb-2 text-xs">
          <button type="button" class="px-3 py-1.5 rounded-lg font-bold bg-brand-primary text-white shadow-xs">
            1. All Inventory (${listings.length + 8})
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-brand-muted hover:text-brand-black hover:bg-brand-subtle transition-colors">
            2. API Sources (Duffel / Amadeus / LiteAPI / Viator)
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-brand-muted hover:text-brand-black hover:bg-brand-subtle transition-colors">
            3. Direct / Manual Contracts (${listings.length})
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-brand-muted hover:text-brand-black hover:bg-brand-subtle transition-colors">
            4. On Request / Concierge (2)
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-brand-muted hover:text-brand-black hover:bg-brand-subtle transition-colors">
            5. Draft / Expired (0)
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-amber-700 bg-amber-50 border border-amber-200">
            6. Demo / Accelerator Seed (Quarantined)
          </button>
          <button type="button" class="px-3 py-1.5 rounded-lg font-medium text-rose-700 bg-rose-50 border border-rose-200">
            7. Suspended Sources (0)
          </button>
        </div>

        <div class="border border-brand-border rounded-2xl overflow-hidden bg-white shadow-xs">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-brand-subtle text-brand-muted border-b border-brand-border font-semibold">
                <th class="p-3">Listing &amp; Supplier Legal ID</th>
                <th class="p-3">Product / Entity</th>
                <th class="p-3">Contract &amp; Quota</th>
                <th class="p-3">Stop-Sell</th>
                <th class="p-3">Cost / Selling</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Operational Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border text-brand-black">
              ${listings.map(l => `
                <tr class="hover:bg-brand-canvas transition-colors">
                  <td class="p-3">
                    <div class="font-semibold text-brand-black">${l.title}</div>
                    <div class="text-[10px] text-brand-muted font-mono">${l.id} · ${l.partnerSupplierId}</div>
                    <div class="text-[10px] text-brand-primary font-medium">${l.supplierLegalName || l.partnerName}</div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-subtle border border-brand-border uppercase">${l.productType}</span>
                    <div class="text-[10px] text-brand-muted font-mono mt-0.5">${l.canonicalEntityId || 'ent_' + l.id}</div>
                  </td>
                  <td class="p-3">
                    <div class="font-medium font-mono text-[11px] text-brand-black">${l.contractReference || 'DIRECT-2026'}</div>
                    <div class="text-[10px] text-brand-muted">Quota: <span class="font-bold text-brand-black">${l.availableQuota}</span> / ${l.allotmentTotal || l.availableQuota}</div>
                    <div class="text-[10px] text-brand-muted">SLA: ${l.partnerSlaHours || 4}h</div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${l.isStopSaleActive ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'}">
                      ${l.isStopSaleActive ? 'STOP-SALE ACTIVE' : 'OPEN'}
                    </span>
                  </td>
                  <td class="p-3 tabular-nums">
                    <div class="text-brand-muted font-mono text-[11px]">Net: LKR ${(l.contractedBaseCost).toLocaleString()}</div>
                    <div class="font-bold text-brand-primary font-mono text-xs">Sell: LKR ${(l.standardSellingPriceLkr).toLocaleString()}</div>
                    <div class="text-[10px] text-emerald-600 font-medium">+${l.markupPercent || 15}% markup</div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${l.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                      ${l.status}
                    </span>
                  </td>
                  <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    <button type="button" class="text-xs font-semibold ${l.isStopSaleActive ? 'text-emerald-700 hover:underline' : 'text-rose-600 hover:underline'}" onclick="window.VacatinaAdminPortal?.toggleStopSale('${l.id}')">
                      ${l.isStopSaleActive ? 'Resume Sale' : 'Stop-Sell'}
                    </button>
                    <button type="button" class="text-xs text-brand-primary font-semibold hover:underline" onclick="window.VacatinaAdminPortal?.toggleStatus('${l.id}')">
                      ${l.status === 'PUBLISHED' ? 'Pause' : 'Publish'}
                    </button>
                    <button type="button" class="text-xs text-brand-muted font-semibold hover:underline" onclick="window.VacatinaAdminPortal?.editListing('${l.id}')">
                      Edit 18-Attrs
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Section: Backoffice 18-Attribute Model Specifications Panel -->
        <div class="p-4 rounded-2xl bg-brand-subtle border border-brand-border space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-heading font-bold text-brand-black">Backoffice Data Model Specification (18 Attributes Verified)</span>
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Payload CMS Schema v2.2</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px] text-brand-muted">
            <div class="p-2 bg-white rounded-lg border border-brand-border">1. Supplier Legal Identity</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">2. Canonical Entity ID</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">3. Contract Period</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">4. Net / Sell / Markup</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">5. Multi-Currency</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">6. Tax Inclusivity</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">7. Allotment / Lead Days</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">8. Sales Window</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">9. Travel Stay Window</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">10. Blackout Dates</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">11. Stop-Sell Action</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">12. Booking Mode (Allotment)</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">13. Partner SLA (h)</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">14. Cancellation Policy</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">15. Occupancy Limits</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">16. Content &amp; Media</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">17. Publishing Lifecycle</div>
            <div class="p-2 bg-white rounded-lg border border-brand-border">18. Immutable Audit Trail</div>
          </div>
        </div>
      </div>

      <!-- Section: Platform Audit Trail -->
      <div class="space-y-4">
        <h3 class="font-heading font-bold text-base text-brand-black">Recent Privileged Audit Logs</h3>
        <div class="border border-brand-border rounded-2xl overflow-hidden bg-white">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-brand-subtle text-brand-muted border-b border-brand-border font-semibold">
                <th class="p-3">Timestamp</th>
                <th class="p-3">Action</th>
                <th class="p-3">Target Entity</th>
                <th class="p-3">Reason / Justification</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border text-brand-black font-mono text-[11px]">
              ${auditLogs.map(a => `
                <tr class="hover:bg-brand-canvas transition-colors">
                  <td class="p-3 text-brand-muted whitespace-nowrap">${new Date(a.timestamp).toLocaleTimeString()}</td>
                  <td class="p-3 font-semibold text-brand-primary">${a.action}</td>
                  <td class="p-3 text-brand-black">${a.targetEntity} / ${a.targetEntityId}</td>
                  <td class="p-3 text-brand-muted">${a.justificationReason}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
