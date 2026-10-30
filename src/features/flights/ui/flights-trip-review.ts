/* ============================================================================
 * Vacatina Flights — Trip Review & Booking Readiness
 * Route: /flights/review
 *
 * Dedicated flight trip review with booking readiness checklist,
 * checkout eligibility, payment method presentation (gated),
 * and confirmation presentation (gated on durable backend).
 * ============================================================================ */

import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

interface ReviewItem {
  id: string;
  title: string;
  productType: string;
  state: string;
  configuration: Record<string, any>;
  unitSellingPriceMinor?: number;
  currency?: string;
  inventoryMode?: string;
  truthDisclosure?: string;
  freshness?: string;
}

export class FlightsTripReviewView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderReview();
  }

  private renderReview(): void {
    if (!this.mount) return;
    const items = tripBucketService.getItems().filter((i: any) => i.productType === 'flights');
    const allItems = tripBucketService.getItems();
    const readyCount = allItems.filter((i: any) => i.state === 'ready').length;
    const needsActionCount = allItems.filter((i: any) => i.state === 'needs_action').length;
    const draftCount = allItems.filter((i: any) => i.state === 'draft').length;
    const totalMinor = allItems.filter((i: any) => i.state === 'ready').reduce((sum: number, i: any) => sum + (i.unitSellingPriceMinor || 0), 0);
    const hasNonReady = allItems.some((i: any) => i.state !== 'ready');
    const backendAvailable = false; // Gated: no durable backend configured

    this.mount.innerHTML = `
      <section class="flights-trip-review max-w-5xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="flight-review-heading">
        <header class="mb-6">
          <h1 id="flight-review-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Flight Trip Review</h1>
          <p class="text-sm text-brand-muted mt-2">Review your staged flight items, verify readiness, and proceed to the next step.</p>
        </header>

        <!-- Booking Readiness Checklist -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="readiness-heading">
          <h2 id="readiness-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Booking Readiness</h2>
          <ul class="space-y-2" role="list">
            <li class="flex items-center gap-3 text-sm">
              <span class="w-5 h-5 rounded-full ${readyCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'} flex items-center justify-center text-xs font-bold">${readyCount > 0 ? '✓' : '○'}</span>
              <span class="${readyCount > 0 ? 'text-brand-black' : 'text-brand-muted'}">${readyCount} item${readyCount === 1 ? '' : 's'} ready for booking</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <span class="w-5 h-5 rounded-full ${needsActionCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} flex items-center justify-center text-xs font-bold">${needsActionCount === 0 ? '✓' : '!'}</span>
              <span class="${needsActionCount === 0 ? 'text-brand-black' : 'text-amber-700'}">${needsActionCount} item${needsActionCount === 1 ? '' : 's'} need${needsActionCount === 1 ? 's' : ''} action</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <span class="w-5 h-5 rounded-full ${draftCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'} flex items-center justify-center text-xs font-bold">${draftCount === 0 ? '✓' : '○'}</span>
              <span class="${draftCount === 0 ? 'text-brand-black' : 'text-brand-muted'}">${draftCount} draft item${draftCount === 1 ? '' : 's'} (not bookable)</span>
            </li>
            <li class="flex items-center gap-3 text-sm">
              <span class="w-5 h-5 rounded-full ${backendAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} flex items-center justify-center text-xs font-bold">${backendAvailable ? '✓' : '!'}</span>
              <span class="${backendAvailable ? 'text-brand-black' : 'text-amber-700'}">Secure backend persistence ${backendAvailable ? 'available' : 'not configured'}</span>
            </li>
          </ul>
        </div>

        <!-- Flight Items -->
        ${items.length === 0 ? `
          <div class="rounded-2xl border border-brand-border bg-brand-subtle p-8 text-center">
            <p class="text-brand-muted text-sm">No flight items staged in your Trip Bucket.</p>
            <a href="/flights" class="inline-flex items-center min-h-[44px] mt-4 text-brand-primary font-semibold text-sm hover:underline">Search flights</a>
          </div>
        ` : items.map((item: any) => this.renderFlightItem(item)).join('')}

        <!-- Cost Summary -->
        ${allItems.length > 0 ? `
        <div class="rounded-2xl border border-brand-border bg-white p-5 mt-6" aria-labelledby="cost-summary-heading">
          <h2 id="cost-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Cost Summary</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-brand-muted">Ready items estimate</span><span class="font-semibold text-brand-black tabular-nums">LKR ${totalMinor.toLocaleString()}</span></div>
            <div class="flex justify-between"><span class="text-brand-muted">Items needing action</span><span class="font-semibold text-amber-700 tabular-nums">${needsActionCount}</span></div>
            <div class="flex justify-between"><span class="text-brand-muted">Draft items (not priced)</span><span class="font-semibold text-brand-muted tabular-nums">${draftCount}</span></div>
          </div>
          <p class="text-xs text-brand-muted mt-3">Estimates are based on staged items only. Final prices confirmed during booking.</p>
        </div>
        ` : ''}

        <!-- Checkout Eligibility -->
        <div class="rounded-2xl border ${hasNonReady ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} p-5 mt-6" aria-labelledby="checkout-heading">
          <h2 id="checkout-heading" class="font-heading text-lg font-semibold ${hasNonReady ? 'text-amber-900' : 'text-emerald-900'} mb-2">Checkout Eligibility</h2>
          ${hasNonReady ? `
            <p class="text-sm ${hasNonReady ? 'text-amber-800' : 'text-emerald-800'}">Some items are not ready for checkout. Resolve all "Needs Action" and "Draft" items before proceeding.</p>
            <ul class="mt-3 space-y-1 text-xs ${hasNonReady ? 'text-amber-700' : 'text-emerald-700'}">
              ${needsActionCount > 0 ? `<li>• ${needsActionCount} item${needsActionCount === 1 ? '' : 's'} need${needsActionCount === 1 ? 's' : ''} revalidation or configuration</li>` : ''}
              ${draftCount > 0 ? `<li>• ${draftCount} draft item${draftCount === 1 ? '' : 's'} need${draftCount === 1 ? 's' : ''} completion</li>` : ''}
            </ul>
          ` : `
            <p class="text-sm text-emerald-800">All staged items are ready. Checkout is available when payment integration is configured.</p>
          `}
        </div>

        <!-- Payment Method Presentation (Gated) -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mt-6" aria-labelledby="payment-heading">
          <h2 id="payment-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Payment Methods</h2>
          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 rounded-xl border border-brand-border bg-brand-subtle opacity-60">
              <span class="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">💳</span>
              <div>
                <p class="text-sm font-semibold text-brand-black">Credit / Debit Card</p>
                <p class="text-xs text-brand-muted">Available when payment gateway is configured</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 rounded-xl border border-brand-border bg-brand-subtle opacity-60">
              <span class="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">🏦</span>
              <div>
                <p class="text-sm font-semibold text-brand-black">Bank Transfer</p>
                <p class="text-xs text-brand-muted">Available when payment gateway is configured</p>
              </div>
            </div>
          </div>
          <p class="text-xs text-amber-700 mt-3 flex items-center gap-1">
            <span class="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">!</span>
            Payment processing is not yet available. No charges will be made.
          </p>
        </div>

        <!-- Booking Status / Confirmation (Gated) -->
        <div class="rounded-2xl border border-brand-border bg-brand-subtle p-5 mt-6" aria-labelledby="booking-status-heading">
          <h2 id="booking-status-heading" class="font-heading text-lg font-semibold text-brand-black mb-2">Booking Status</h2>
          <p class="text-sm text-brand-muted">No confirmed bookings yet. Booking confirmation requires a secure backend with supplier integration.</p>
          <div class="mt-4 flex flex-col sm:flex-row gap-3">
            <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-6 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
              Proceed to Checkout (unavailable)
            </button>
            ${allItems.length > 0 ? `
            <a href="/flights/passengers" data-continue-passengers data-action="passengers" class="min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-colors inline-flex items-center justify-center">
              Continue to Passenger Details
            </a>
            ` : ''}
            <a href="/flights" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-white transition-colors inline-flex items-center justify-center">
              Continue Shopping
            </a>
          </div>
        </div>

        <!-- Manage Booking Entry (Gated) -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mt-6" aria-labelledby="manage-heading">
          <h2 id="manage-heading" class="font-heading text-lg font-semibold text-brand-black mb-2">Manage Booking</h2>
          <p class="text-sm text-brand-muted">Manage existing bookings, modify dates, or request cancellations. Available when backend booking service is operational.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled aria-disabled="true" class="min-h-[40px] px-4 rounded-xl border border-brand-border text-brand-muted text-xs font-semibold cursor-not-allowed opacity-60">View Booking Reference</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[40px] px-4 rounded-xl border border-brand-border text-brand-muted text-xs font-semibold cursor-not-allowed opacity-60">Modify Dates</button>
            <button type="button" disabled aria-disabled="true" class="min-h-[40px] px-4 rounded-xl border border-brand-border text-brand-muted text-xs font-semibold cursor-not-allowed opacity-60">Request Cancellation</button>
          </div>
        </div>
      </section>
    `;
  }

  private renderFlightItem(item: any): string {
    const stateColors: Record<string, string> = {
      ready: 'bg-emerald-100 text-emerald-700',
      needs_action: 'bg-amber-100 text-amber-700',
      draft: 'bg-gray-100 text-gray-500',
    };
    const stateLabel: Record<string, string> = {
      ready: 'Ready',
      needs_action: 'Needs Action',
      draft: 'Draft',
    };
    const price = item.unitSellingPriceMinor ? `LKR ${item.unitSellingPriceMinor.toLocaleString()}` : 'Quote required';

    return `
      <div class="rounded-2xl border border-brand-border bg-white p-5 mt-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${stateColors[item.state] || 'bg-gray-100 text-gray-500'}">${stateLabel[item.state] || item.state}</span>
              ${item.inventoryMode ? `<span class="text-[10px] text-brand-muted">${escapeHtml(item.inventoryMode)}</span>` : ''}
            </div>
            <h3 class="font-heading font-semibold text-brand-black truncate">${escapeHtml(item.title)}</h3>
            <p class="text-xs text-brand-muted mt-1">${escapeHtml(item.subtitle || '')}</p>
            ${item.truthDisclosure ? `<p class="text-xs text-amber-700 mt-2">${escapeHtml(item.truthDisclosure)}</p>` : ''}
          </div>
          <div class="text-right flex-shrink-0">
            <p class="font-semibold text-brand-primary tabular-nums">${price}</p>
            <p class="text-[10px] text-brand-muted">${escapeHtml(item.currency || 'LKR')}</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="/flights/search" class="min-h-[36px] px-3 rounded-lg border border-brand-border text-xs font-semibold text-brand-black hover:bg-brand-subtle transition-colors inline-flex items-center">Edit</a>
          <button type="button" class="min-h-[36px] px-3 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors" onclick="window.__VACATINA_OS__?.tripBucketService?.removeItem?.('${escapeHtml(item.id)}'); window.location.reload();">Remove</button>
        </div>
      </div>
    `;
  }
}
