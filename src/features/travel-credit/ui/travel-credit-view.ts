/* ============================================================================
 * Vacatina Travel Credit Customer View & Account Modal (v1.0)
 * Authority: CBSL Closed-Loop Compliance & Vacatina Travel Credit Architecture v1.0
 *
 * Route: /account/travel-credit
 * Renders:
 * 1. Available Balance & Pending Clearance cards.
 * 2. Multi-Bucket Breakdown (Refund, Promotional, Service).
 * 3. Immutable Transaction History Ledger with running balances.
 * 4. Regulatory closed-loop compliance statement.
 * 5. Interactive simulation action for refund conversion.
 * ============================================================================ */

import { globalTravelCreditLedgerService } from '../services/travel-credit-ledger.service.ts';
import type { TravelCreditBalanceSummary, TravelCreditTransaction } from '../domain/travel-credit-models.ts';
import { showToast } from '../../../components/ui/toast.ts';

function formatLkr(amountMinor: number): string {
  const lkr = amountMinor / 100;
  return `LKR ${lkr.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTravelCreditHtml(
  summary: TravelCreditBalanceSummary,
  transactions: TravelCreditTransaction[]
): string {
  return `
    <div class="space-y-6 text-xs text-brand-black">
      <!-- Header Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-brand-border gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
              ✓ Closed-Loop Account
            </span>
            <span class="text-[11px] text-brand-muted">Account: ${summary.walletAccountId}</span>
          </div>
          <h2 class="text-2xl font-heading font-bold text-brand-black mt-1">Vacatina Travel Credit</h2>
          <p class="text-xs text-brand-muted mt-0.5">Your accumulated refund balances, promotional grants, and service credits.</p>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            id="travel-credit-simulate-refund-btn"
            class="px-3.5 py-2 rounded-xl border border-brand-primary text-brand-primary font-semibold text-xs hover:bg-[#F0EFFC] transition-colors touch-target-44"
          >
            + Receive Sample Refund
          </button>
        </div>
      </div>

      <!-- Top Metric Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Card 1: Total Available -->
        <div class="p-4 rounded-2xl bg-gradient-to-br from-[#1B1464] to-[#2E208F] text-white shadow-md relative overflow-hidden">
          <div class="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Available Travel Credit</div>
          <div class="text-2xl sm:text-3xl font-heading font-extrabold mt-1 tabular-nums" id="tc-available-balance">
            ${formatLkr(summary.totalAvailableMinor)}
          </div>
          <div class="text-[10px] text-white/80 mt-2 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-[#4ADE80]"></span>
            <span>Usable instantly on all 10 Vacatina verticals</span>
          </div>
        </div>

        <!-- Card 2: Pending Clearance -->
        <div class="p-4 rounded-2xl bg-brand-canvas border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Pending Clearance</div>
          <div class="text-2xl sm:text-3xl font-heading font-bold text-brand-black mt-1 tabular-nums" id="tc-pending-balance">
            ${formatLkr(summary.totalPendingMinor)}
          </div>
          <div class="text-[10px] text-brand-muted mt-2">
            ${summary.totalPendingMinor > 0 ? 'Pending supplier/payment gateway confirmation' : 'Zero unsettled transactions'}
          </div>
        </div>

        <!-- Card 3: Earliest Expiry -->
        <div class="p-4 rounded-2xl bg-brand-canvas border border-brand-border">
          <div class="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">Promotional Expiry</div>
          <div class="text-base font-heading font-bold text-brand-black mt-2">
            ${summary.earliestExpiringDateIso ? formatDate(summary.earliestExpiringDateIso) : 'No Expiring Credits'}
          </div>
          <div class="text-[10px] text-brand-muted mt-2">
            Refund &amp; Service credits never expire
          </div>
        </div>
      </div>

      <!-- Multi-Bucket Breakdown Section -->
      <div class="p-4 rounded-2xl bg-[#F8FAFC] border border-brand-border space-y-3">
        <div class="flex items-center justify-between">
          <div class="font-heading font-bold text-sm text-brand-black">Credit Breakdown by Balance Category</div>
          <span class="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">3 Isolated Buckets</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <!-- Bucket A: Refund Credit -->
          <div class="p-3 rounded-xl bg-white border border-brand-border">
            <div class="flex items-center justify-between text-[11px] text-brand-muted">
              <span class="font-semibold text-brand-black">Refund Credit</span>
              <span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[9px]">Never Expiring</span>
            </div>
            <div class="text-lg font-bold text-brand-black mt-1 tabular-nums">${formatLkr(summary.refundCreditMinor)}</div>
            <div class="text-[10px] text-brand-muted mt-1 leading-snug">Value derived from cancelled journeys &amp; flight adjustments.</div>
          </div>

          <!-- Bucket B: Promotional Credit -->
          <div class="p-3 rounded-xl bg-white border border-brand-border">
            <div class="flex items-center justify-between text-[11px] text-brand-muted">
              <span class="font-semibold text-brand-black">Promotional Credit</span>
              <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[9px]">Campaign Bonus</span>
            </div>
            <div class="text-lg font-bold text-brand-black mt-1 tabular-nums">${formatLkr(summary.promotionalCreditMinor)}</div>
            <div class="text-[10px] text-brand-muted mt-1 leading-snug">Granted via seasonal campaigns; redeemed with highest priority.</div>
          </div>

          <!-- Bucket C: Service Credit -->
          <div class="p-3 rounded-xl bg-white border border-brand-border">
            <div class="flex items-center justify-between text-[11px] text-brand-muted">
              <span class="font-semibold text-brand-black">Service Credit</span>
              <span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[9px]">Goodwill</span>
            </div>
            <div class="text-lg font-bold text-brand-black mt-1 tabular-nums">${formatLkr(summary.serviceCreditMinor)}</div>
            <div class="text-[10px] text-brand-muted mt-1 leading-snug">Issued by Vacatina Concierge Support for operational adjustments.</div>
          </div>
        </div>
      </div>

      <!-- Regulatory & Closed-Loop Compliance Notice -->
      <div class="p-3.5 rounded-xl bg-[#F0EFFC] border border-[#D5D1F6] text-brand-black flex items-start gap-3">
        <svg class="w-5 h-5 text-brand-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="space-y-0.5 text-[11px] leading-relaxed">
          <strong class="font-bold text-brand-primary">Closed-Loop Regulatory Notice (CBSL Compliance):</strong>
          <p class="text-brand-muted">
            Vacatina Travel Credit is a non-transferable, closed-loop customer travel balance usable exclusively toward eligible flights, hotels, visas, holiday packages, and travel services on Vacatina. It is not an e-money wallet or stored-value currency, cannot be converted to physical cash, cannot be transferred to third-party individuals, and cannot be withdrawn to bank accounts.
          </p>
        </div>
      </div>

      <!-- Immutable Double-Entry Ledger Table -->
      <div class="space-y-3 pt-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 class="font-heading font-bold text-base text-brand-black">Transaction Ledger History</h3>
            <p class="text-[11px] text-brand-muted">Append-only immutable record of all credits, redemptions, and adjustments.</p>
          </div>
          <span class="text-[11px] font-medium text-brand-muted">${transactions.length} Ledger Entries</span>
        </div>

        <div class="overflow-x-auto rounded-xl border border-brand-border bg-white shadow-xs">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-brand-canvas border-b border-brand-border text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                <th class="py-2.5 px-3">Date</th>
                <th class="py-2.5 px-3">Description</th>
                <th class="py-2.5 px-3">Reference</th>
                <th class="py-2.5 px-3">Bucket</th>
                <th class="py-2.5 px-3 text-right">Credit / Debit</th>
                <th class="py-2.5 px-3 text-right">Balance After</th>
                <th class="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border text-[11px]">
              ${
                transactions.length === 0
                  ? `
                <tr>
                  <td colspan="7" class="py-8 text-center text-brand-muted">
                    No travel credit transactions recorded yet.
                  </td>
                </tr>
              `
                  : transactions
                      .map(tx => {
                        const isCredit = tx.direction === 'CREDIT';
                        const sign = isCredit ? '+' : '-';
                        const amountClass = isCredit ? 'text-[#15803D] font-bold' : 'text-[#B91C1C] font-bold';
                        const bucketBadge =
                          tx.creditType === 'REFUND_CREDIT'
                            ? '<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-semibold">Refund</span>'
                            : tx.creditType === 'PROMOTIONAL_CREDIT'
                            ? '<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold">Promo</span>'
                            : '<span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-semibold">Service</span>';

                        const statusBadge =
                          tx.status === 'AVAILABLE' || tx.status === 'USED'
                            ? '<span class="px-1.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-bold text-[9px]">Settled</span>'
                            : tx.status === 'PENDING'
                            ? '<span class="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[9px]">Pending</span>'
                            : '<span class="px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 font-bold text-[9px]">Reversed</span>';

                        return `
                  <tr class="hover:bg-brand-canvas transition-colors">
                    <td class="py-2.5 px-3 whitespace-nowrap text-brand-muted">${formatDate(tx.createdAtIso)}</td>
                    <td class="py-2.5 px-3">
                      <div class="font-semibold text-brand-black">${escapeHtml(tx.description)}</div>
                      ${tx.staffActor ? `<div class="text-[10px] text-brand-muted font-normal">Officer: ${escapeHtml(tx.staffActor.name)} (${escapeHtml(tx.staffActor.reason || '')})</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 font-mono text-[10px] text-brand-muted">${escapeHtml(tx.referenceId || tx.transactionId)}</td>
                    <td class="py-2.5 px-3">${bucketBadge}</td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap tabular-nums ${amountClass}">${sign}${formatLkr(tx.amountMinor)}</td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap tabular-nums font-bold text-brand-black">${formatLkr(tx.balanceAfterMinor)}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                  </tr>
                `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Opens the interactive Travel Credit Account Modal
 */
export async function openTravelCreditModal(
  triggerElement?: HTMLElement | null,
  customerId = 'traveller@vacatina.com'
): Promise<void> {
  if (typeof document !== 'undefined' && document.documentElement.dataset.vacatinaDemo === 'true') {
    showToast('DEMO / TEST: account balances, financial actions and refund simulation are disabled.','warning');
    return;
  }
  const modalContainer = document.getElementById('dialog-container');
  if (!modalContainer) return;

  const summary = await globalTravelCreditLedgerService.getBalance(customerId);
  const transactions = await globalTravelCreditLedgerService.getTransactions(customerId);

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-brand-black/45 backdrop-blur-sm transition-opacity" data-dialog-backdrop="true"></div>
    <div class="min-h-full flex items-center justify-center p-3 sm:p-4">
      <div class="relative bg-white rounded-2xl border border-brand-border shadow-2xl max-w-4xl w-full p-4 sm:p-6 text-left overflow-hidden">
        <div class="flex items-center justify-between pb-3 border-b border-brand-border">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-[#1B1464] text-white flex items-center justify-center font-bold text-sm">💳</span>
            <div>
              <h3 class="font-heading font-bold text-lg text-brand-black">My Account · Vacatina Travel Credit</h3>
              <p class="text-[11px] text-brand-muted">Closed-loop travel value ledger &amp; refund settlement center</p>
            </div>
          </div>
          <button type="button" data-dialog-close="true" aria-label="Close Travel Credit" class="icon-touch-44 text-brand-muted hover:text-brand-black rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </button>
        </div>

        <div class="py-4 max-h-[75vh] overflow-y-auto pr-1" id="travel-credit-modal-content">
          ${renderTravelCreditHtml(summary, transactions)}
        </div>

        <div class="pt-4 border-t border-brand-border flex items-center justify-between gap-3">
          <span class="text-[11px] text-brand-muted">Balances update atomically with booking and cancellation events.</span>
          <button type="button" data-dialog-close="true" class="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:opacity-90 touch-target-44">
            Done
          </button>
        </div>
      </div>
    </div>
  `;

  // Wire interactive sample refund simulator
  const simBtn = modalContainer.querySelector('#travel-credit-simulate-refund-btn');
  if (simBtn) {
    simBtn.addEventListener('click', async () => {
      simBtn.setAttribute('disabled', 'true');
      simBtn.textContent = 'Crediting LKR 25,000…';
      try {
        await globalTravelCreditLedgerService.creditRefund({
          customerId,
          bookingId: `sim_book_${Date.now()}`,
          bookingReference: `VAC-REF-${Math.floor(1000 + Math.random() * 9000)}`,
          refundId: `ref_${Date.now()}`,
          amountMinor: 2500000, // LKR 25,000
          description: 'Simulated customer booking refund credited as Travel Credit'
        });

        // Re-render
        const newSummary = await globalTravelCreditLedgerService.getBalance(customerId);
        const newTxs = await globalTravelCreditLedgerService.getTransactions(customerId);
        const contentEl = modalContainer.querySelector('#travel-credit-modal-content');
        if (contentEl) {
          contentEl.innerHTML = renderTravelCreditHtml(newSummary, newTxs);
        }
      } catch (err: any) {
        alert(`Error simulating refund: ${err.message}`);
      }
    });
  }

  // Wire close handlers
  const closeButtons = modalContainer.querySelectorAll('[data-dialog-close="true"]');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (triggerElement) triggerElement.focus();
    });
  });

  const backdrop = modalContainer.querySelector('[data-dialog-backdrop="true"]');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (triggerElement) triggerElement.focus();
    });
  }

  modalContainer.classList.remove('hidden');
}
