/* ============================================================================
 * Vacatina Flights — Manual Request-to-Book Tracker (Screens 46–50)
 * Honest states: request submitted -> operator review -> quote prepared ->
 * customer approval -> payment (if applicable) -> confirmed/ticketing.
 * Never fabricates instant tickets or unverified schedules.
 * ============================================================================ */

import type { ManualRequestState } from '../domain/flight-state-machines.ts';

export { type ManualRequestState };

export const MANUAL_REQUEST_LABELS: Record<ManualRequestState, string> = {
  submitted: 'Request Submitted',
  operator_review: 'Operator Review',
  quote_prepared: 'Quotation Prepared',
  customer_approval: 'Awaiting Your Approval',
  payment_pending: 'Payment Pending',
  confirmed: 'Confirmed (Ticketing in progress)',
  declined: 'Request Declined',
  unavailable: 'No Longer Available',
};

export class FlightsManualRequestView {
  private mount: HTMLElement | null = null;

  public render(mount: HTMLElement, state: ManualRequestState = 'submitted', requestId = 'VCT-REQ-0000'): void {
    this.mount = mount;
    mount.innerHTML = `
      <section class="flights-manual-request max-w-4xl mx-auto px-4 py-8 animate-fade-in" aria-labelledby="mr-heading">
        <header class="mb-6">
          <h1 id="mr-heading" class="font-heading text-2xl sm:text-3xl font-bold text-brand-black">Manual Flight Request</h1>
          <p class="text-sm text-brand-muted mt-2">Request reference: <strong class="text-brand-black">${requestId}</strong></p>
        </header>

        <div class="rounded-2xl border border-brand-border bg-white p-5 mb-6" aria-labelledby="status-heading">
          <h2 id="status-heading" class="font-heading text-lg font-semibold text-brand-black mb-3">Current Status</h2>
          <div class="flex items-center gap-3 mb-4">
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-brand-subtle text-brand-primary border border-brand-border">
              ${MANUAL_REQUEST_LABELS[state]}
            </span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span class="text-brand-muted text-xs block">Route</span><strong class="text-brand-black">CMB → MLE (Malé)</strong></div>
            <div><span class="text-brand-muted text-xs block">Airline</span><strong class="text-brand-black">Maldivian (Q2) — Island Shuttle</strong></div>
            <div><span class="text-brand-muted text-xs block">Dates</span><strong class="text-brand-black">10 Dec 2026 – 17 Dec 2026</strong></div>
            <div><span class="text-brand-muted text-xs block">Passengers</span><strong class="text-brand-black">2 Adults, 1 Child</strong></div>
            <div><span class="text-brand-muted text-xs block">Cabin</span><strong class="text-brand-black">Economy</strong></div>
            <div><span class="text-brand-muted text-xs block">Estimated Fare</span><strong class="text-brand-primary tabular-nums">LKR 185,000 (quote pending)</strong></div>
          </div>
          <p class="text-sm text-brand-muted mt-3 leading-relaxed">
            Manual flight requests are reviewed by the Vacatina flight desk. Carrier, flight number, schedule, baggage and fare rules
            are confirmed before any ticket is issued. No instant ticket is created until the desk confirms availability and you approve the quotation.
          </p>
        </div>

        <div class="rounded-2xl border border-brand-border bg-brand-canvas p-5 mb-6">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Request Timeline</h2>
          <ol class="space-y-3 text-sm text-brand-muted">
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">1.</span> Request submitted — your details recorded.</li>
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">2.</span> Operator review — desk verifies schedule, carrier and baggage.</li>
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">3.</span> Quotation prepared — verified itinerary and price sent to you.</li>
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">4.</span> Your approval — accept the quotation to proceed.</li>
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">5.</span> Payment (if applicable) — secure hosted checkout.</li>
            <li class="flex items-start gap-2"><span class="font-bold text-brand-primary">6.</span> Confirmed booking / ticketing — only after supplier confirmation.</li>
          </ol>
        </div>

        <div class="rounded-2xl border border-brand-border bg-white p-5">
          <h2 class="font-heading text-lg font-semibold text-brand-black mb-3">Important</h2>
          <ul class="space-y-2 text-sm text-brand-muted">
            <li>• Unverified flight numbers, timings, baggage or seat availability are never shown as confirmed.</li>
            <li>• Approval of a quotation does not automatically issue a ticket — payment and supplier confirmation are verified separately.</li>
            <li>• If the request is declined or unavailable, you will be offered alternatives or can edit and resubmit.</li>
          </ul>
          <div class="mt-4">
            <a href="/flights" class="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
              Back to flight search
            </a>
          </div>
        </div>
      </section>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}