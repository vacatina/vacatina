/* ============================================================================
 * Vacatina Flights — Checkout UI Presentation
 * Route: /flights/checkout
 * Gated: Payment processing requires backend integration.
 * ============================================================================ */

import { tripBucketService } from '../../../lib/services/trip-bucket.service.ts';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]!));
}

export class FlightsCheckoutView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement): void {
    this.mount = mount;
    this.renderCheckout();
  }

  private renderCheckout(): void {
    if (!this.mount) return;
    const items = tripBucketService.getItems().filter((i: any) => i.productType === 'flights');
    const readyItems = items.filter((i: any) => i.state === 'ready');
    const totalMinor = readyItems.reduce((sum: number, i: any) => sum + (i.unitSellingPriceMinor || 0), 0);
    const hasNonReady = items.some((i: any) => i.state !== 'ready');
    const backendAvailable = false;

    this.mount.innerHTML = `
      <section class="flights-checkout max-w-5xl mx-auto px-4 py-8" aria-labelledby="checkout-heading">
        <header class="mb-6">
          <h1 id="checkout-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Secure Checkout</h1>
          <p class="text-sm text-brand-muted mt-2">Review your flight booking and complete payment when available.</p>
        </header>

        <!-- Order Summary -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="order-summary-heading">
          <h2 id="order-summary-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Order Summary</h2>
          ${items.length === 0 ? `
            <p class="text-sm text-brand-muted">No flight items in your Trip Bucket. <a href="/flights" class="text-brand-primary font-semibold hover:underline">Search flights</a></p>
          ` : items.map((item: any) => `
            <div class="flex items-center justify-between py-3 border-b border-brand-border last:border-0">
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-brand-black text-sm truncate">${escapeHtml(item.title)}</p>
                <p class="text-xs text-brand-muted">${escapeHtml(item.subtitle || '')}</p>
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.state === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${item.state === 'ready' ? 'Ready' : 'Needs Action'}</span>
              </div>
              <p class="font-semibold text-brand-primary tabular-nums flex-shrink-0 ml-4">${item.unitSellingPriceMinor ? 'LKR ' + item.unitSellingPriceMinor.toLocaleString() : 'Quote required'}</p>
            </div>
          `).join('')}
          <div class="flex justify-between pt-4 mt-2 border-t border-brand-border">
            <span class="font-semibold text-brand-black">Total</span>
            <span class="font-bold text-brand-primary text-lg tabular-nums">LKR ${totalMinor.toLocaleString()}</span>
          </div>
        </div>

        <!-- Eligibility Status -->
        <div class="rounded-2xl border ${hasNonReady ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} p-5 mb-6" aria-live="polite">
          <h2 class="font-heading text-lg font-semibold ${hasNonReady ? 'text-amber-900' : 'text-emerald-900'} mb-2">Checkout Status</h2>
          ${hasNonReady ? `
            <p class="text-sm text-amber-800">Checkout is not available. Resolve all items requiring action before proceeding.</p>
          ` : readyItems.length === 0 ? `
            <p class="text-sm text-brand-muted">No ready items to checkout. Stage flight items in your Trip Bucket first.</p>
          ` : `
            <p class="text-sm text-emerald-800">All items are ready. Payment processing requires backend configuration.</p>
          `}
        </div>

        <!-- Payment Methods -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="payment-methods-heading">
          <h2 id="payment-methods-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Payment Method</h2>
          <div class="space-y-3">
            <label class="flex items-center gap-3 p-4 rounded-xl border border-brand-border bg-brand-subtle cursor-not-allowed opacity-60">
              <input type="radio" name="payment" disabled class="w-4 h-4" />
              <span class="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">💳</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-brand-black">Credit / Debit Card</p>
                <p class="text-xs text-brand-muted">Stripe integration required</p>
              </div>
            </label>
            <label class="flex items-center gap-3 p-4 rounded-xl border border-brand-border bg-brand-subtle cursor-not-allowed opacity-60">
              <input type="radio" name="payment" disabled class="w-4 h-4" />
              <span class="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">🏦</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-brand-black">Bank Transfer</p>
                <p class="text-xs text-brand-muted">PayHere integration required</p>
              </div>
            </label>
            <label class="flex items-center gap-3 p-4 rounded-xl border border-brand-border bg-brand-subtle cursor-not-allowed opacity-60">
              <input type="radio" name="payment" disabled class="w-4 h-4" />
              <span class="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">🅿</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-brand-black">PayPal</p>
                <p class="text-xs text-brand-muted">PayPal integration required</p>
              </div>
            </label>
          </div>
          <p class="text-xs text-amber-700 mt-4 flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
            Payment processing is not available. No charges will be made. Configure payment provider credentials to enable checkout.
          </p>
        </div>

        <!-- Billing Details -->
        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="billing-heading">
          <h2 id="billing-heading" class="font-heading text-lg font-semibold text-brand-black mb-4">Billing Details</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Full name</span>
              <input type="text" disabled placeholder="As on payment method" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-muted bg-brand-subtle cursor-not-allowed" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-brand-muted">Email</span>
              <input type="email" disabled placeholder="Billing email" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-muted bg-brand-subtle cursor-not-allowed" />
            </label>
            <label class="block sm:col-span-2">
              <span class="text-xs font-semibold text-brand-muted">Billing address</span>
              <input type="text" disabled placeholder="Street address" class="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-brand-border text-sm text-brand-muted bg-brand-subtle cursor-not-allowed" />
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 justify-between">
          <a href="/trip/review" class="min-h-[44px] px-5 rounded-xl border border-brand-border text-brand-black font-semibold text-sm hover:bg-brand-subtle transition-colors inline-flex items-center justify-center">
            Back to trip review
          </a>
          <button type="button" disabled aria-disabled="true" class="min-h-[44px] px-6 rounded-xl bg-gray-200 text-gray-500 font-semibold text-sm cursor-not-allowed">
            Complete Payment (unavailable)
          </button>
        </div>

        <p class="text-xs text-brand-muted mt-4 text-center">No payment will be processed. Checkout requires configured payment provider credentials and a secure backend.</p>
      </section>
    `;
  }
}
