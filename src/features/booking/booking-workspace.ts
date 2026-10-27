import { apiRequest } from '../../lib/services/api-client.service.ts';

function escapeBookingText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]!));
}
function formatBookingMoney(amount: number, currency: string): string {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / (10 ** digits));
}
function bookingHeading(title: string, description: string): string {
  return `<section class="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 text-brand-text"><a href="/" class="text-sm font-semibold text-brand-primary inline-flex items-center min-h-[44px] mb-6">← Back to travel planning</a><p class="text-xs uppercase tracking-widest text-brand-muted mb-3">YOUR VACATINA JOURNEY</p><h1 class="font-heading text-3xl md:text-4xl font-bold text-brand-primary mb-4">${title}</h1><p class="text-brand-muted max-w-2xl leading-relaxed mb-8">${description}</p><div data-booking-content aria-live="polite"></div></section>`;
}
function bookingError(mount: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : 'The journey service is unavailable. Please retry.';
  mount.innerHTML = `<div role="alert" class="bg-white border border-red-200 rounded-2xl p-6"><h2 class="font-semibold mb-2">We could not complete this step</h2><p class="text-sm text-brand-muted">${escapeBookingText(message)}</p><button type="button" data-booking-retry class="min-h-[44px] mt-5 px-5 rounded-xl border font-semibold">Try again</button></div>`;
}
function newBookingRequestKey(): string { return crypto.randomUUID(); }

export function renderCheckoutWorkspace(container: HTMLElement): void {
  container.innerHTML = bookingHeading('Review your journey', 'Check each travel option and contact detail before continuing to secure payment. Your booking is confirmed only when the relevant suppliers confirm it.');
  const mount = container.querySelector<HTMLElement>('[data-booking-content]')!;
  const query = new URLSearchParams(location.search);
  if (query.get('booking')) {
    void renderPaymentReturn(mount, query);
    return;
  }
  const load = async () => {
    mount.innerHTML = '<p role="status" class="text-brand-muted py-8">Loading your saved trip…</p>';
    try {
      const [bucket, capabilities] = await Promise.all([apiRequest('/api/v1/trip-buckets'), apiRequest('/api/v1/checkout/capabilities')]);
      const items = bucket.items || [];
      if (!items.length) {
        mount.innerHTML = '<div class="bg-white border rounded-2xl p-8"><h2 class="font-heading text-xl font-semibold mb-3">Your trip is ready to take shape</h2><p class="text-brand-muted mb-5">Search and configure travel options, then save them to your Trip Bucket.</p><a href="/flights" class="inline-flex min-h-[44px] items-center bg-brand-primary text-white px-5 rounded-xl font-semibold">Explore flights</a></div>';
        return;
      }
      const unready = items.filter((item: any) => item.state !== 'READY');
      const available = (capabilities.gateways || []).filter((gateway: any) => gateway.available);
      mount.innerHTML = `<div class="grid lg:grid-cols-[1fr_360px] gap-8"><div><h2 class="font-heading text-xl font-semibold mb-4">Travel options</h2><ul class="divide-y border rounded-2xl bg-white">${items.map((item: any) => `<li class="p-5"><div class="flex flex-wrap justify-between gap-3"><h3 class="font-semibold">${escapeBookingText(item.title)}</h3><span class="font-semibold tabular-nums">${escapeBookingText(formatBookingMoney(item.unitSellingPriceMinor, item.currency))}</span></div><p class="text-sm text-brand-muted mt-2">${escapeBookingText(String(item.productType).replace(/-/g,' '))} · ${escapeBookingText(String(item.state).replace(/_/g,' '))}</p></li>`).join('')}</ul><p class="text-sm text-brand-muted leading-relaxed mt-4">Rates and availability are checked again before payment. Each supplier's cancellation and change terms apply.</p>${unready.length ? `<p role="alert" class="mt-4 border border-amber-200 bg-amber-50 p-4 rounded-xl text-sm">${unready.length} travel option${unready.length === 1 ? ' needs' : 's need'} attention. Complete or remove these items before checkout.</p>` : ''}</div><form data-checkout-form class="bg-white border rounded-2xl p-6 self-start space-y-4"><h2 class="font-heading text-xl font-semibold">Contact & payment</h2><label class="block text-sm font-semibold">Contact name<input required name="customerName" autocomplete="name" maxlength="120" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label><label class="block text-sm font-semibold">Email<input required name="customerEmail" type="email" autocomplete="email" maxlength="254" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label><label class="block text-sm font-semibold">Payment method<select required name="gatewayId" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal">${available.length ? available.map((gateway: any) => `<option value="${escapeBookingText(gateway.gatewayId)}">${escapeBookingText(gateway.gatewayId === 'PAYHERE' ? 'PayHere' : gateway.gatewayId === 'PAYPAL' ? 'PayPal' : 'Stripe')}${gateway.testMode ? ' · Test environment' : ''}</option>`).join('') : '<option value="">Payment temporarily unavailable</option>'}</select></label><div data-payhere-billing hidden class="space-y-4"><label class="block text-sm font-semibold">Phone<input name="customerPhone" type="tel" autocomplete="tel" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label><label class="block text-sm font-semibold">Billing address<input name="address" autocomplete="street-address" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label><label class="block text-sm font-semibold">City<input name="city" autocomplete="address-level2" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label><label class="block text-sm font-semibold">Country<input name="country" autocomplete="country-name" class="w-full border rounded-xl mt-2 min-h-[48px] px-3 font-normal"></label></div><label class="flex gap-3 text-sm leading-relaxed"><input required type="checkbox" name="termsAccepted" class="mt-1 w-5 h-5 shrink-0"><span>I have checked my selection and the applicable supplier terms.</span></label><div class="pt-4 border-t flex justify-between gap-3"><span>Ready items estimate</span><strong class="tabular-nums">${escapeBookingText(formatBookingMoney(bucket.readySubtotalMinor || 0, bucket.currency || items[0].currency))}</strong></div>${!available.length ? '<p role="status" class="text-sm text-brand-muted">Online payment is not configured yet. Your trip stays saved; contact Vacatina for help.</p>' : ''}<button type="submit" ${unready.length || !available.length ? 'disabled' : ''} class="w-full min-h-[48px] rounded-xl bg-brand-primary text-white font-semibold disabled:opacity-40">Recheck & continue to payment</button><p data-checkout-message role="status" class="text-sm text-brand-muted"></p></form></div>`;
      const form = mount.querySelector<HTMLFormElement>('[data-checkout-form]')!;
      const gateway = form.elements.namedItem('gatewayId') as HTMLSelectElement;
      const billing = form.querySelector<HTMLElement>('[data-payhere-billing]')!;
      const updateBilling = () => {
        billing.hidden = gateway.value !== 'PAYHERE';
        billing.querySelectorAll<HTMLInputElement>('input').forEach(input => input.required = !billing.hidden);
      };
      gateway.addEventListener('change', updateBilling); updateBilling();
      let bookingKey = newBookingRequestKey(); let paymentKey = newBookingRequestKey();
      let draft: any;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        const message = form.querySelector<HTMLElement>('[data-checkout-message]')!;
        button.disabled = true; message.textContent = 'Rechecking your travel options…';
        const values = Object.fromEntries(new FormData(form).entries());
        try {
          if (!draft) draft = await apiRequest('/api/v1/bookings', { method: 'POST', headers: { 'X-Idempotency-Key': bookingKey }, body: JSON.stringify({ tripBucketId: bucket.bucketId, ...values }) });
          message.textContent = 'Preparing your secure payment…';
          const checkout = await apiRequest('/api/v1/checkout/payment-intent', { method: 'POST', headers: { 'X-Idempotency-Key': paymentKey }, body: JSON.stringify({
            bookingGroupId: draft.bookingGroupId, ...values, returnUrl: new URL('/checkout', location.origin).toString()
          }) });
          if (checkout.checkoutForm) {
            const action = new URL(checkout.checkoutForm.action);
            if (!['www.payhere.lk','sandbox.payhere.lk'].includes(action.hostname) || action.protocol !== 'https:') throw new Error('Payment link could not be verified.');
            const hosted = document.createElement('form'); hosted.method = 'POST'; hosted.action = action.toString();
            for (const [name, value] of Object.entries(checkout.checkoutForm.fields)) { const field = document.createElement('input'); field.type = 'hidden'; field.name = name; field.value = String(value); hosted.appendChild(field); }
            document.body.appendChild(hosted); hosted.submit();
          } else {
            const target = new URL(checkout.checkoutUrl);
            if (target.protocol !== 'https:' || !['checkout.stripe.com','www.paypal.com','www.sandbox.paypal.com','paypal.com','sandbox.paypal.com'].includes(target.hostname)) throw new Error('Payment link could not be verified.');
            location.assign(target.toString());
          }
        } catch (error) { message.textContent = error instanceof Error ? error.message : 'Checkout could not continue. Please retry.'; button.disabled = false; }
      });
    } catch (error) { bookingError(mount, error); mount.querySelector('[data-booking-retry]')?.addEventListener('click', () => void load()); }
  };
  void load();
}

async function renderPaymentReturn(mount: HTMLElement, query: URLSearchParams): Promise<void> {
  mount.innerHTML = '<p role="status" class="text-brand-muted py-8">Checking payment and supplier confirmation…</p>';
  try {
    if (query.has('token') && query.get('payment_order')) await apiRequest('/api/v1/checkout/paypal/capture', { method: 'POST', headers: { 'X-Idempotency-Key': `paypal-capture-${query.get('payment_order')}` }, body: JSON.stringify({ paymentOrderId: query.get('payment_order') }) });
    const dossier = await apiRequest(`/api/v1/bookings/${encodeURIComponent(query.get('booking')!)}`);
    renderBookingDossier(mount, dossier, () => void renderPaymentReturn(mount, query));
  } catch (error) { bookingError(mount, error); mount.querySelector('[data-booking-retry]')?.addEventListener('click', () => void renderPaymentReturn(mount, query)); }
}

export function renderManageBookingWorkspace(container: HTMLElement): void {
  container.innerHTML = bookingHeading('Manage your journey', 'Retrieve your saved booking to check payment, supplier confirmations and available support actions.');
  const mount = container.querySelector<HTMLElement>('[data-booking-content]')!;
  mount.innerHTML = '<form data-booking-lookup class="bg-white border rounded-2xl p-6 max-w-xl"><label class="block text-sm font-semibold" for="booking-reference-input">Vacatina booking reference</label><input id="booking-reference-input" name="reference" required maxlength="80" autocomplete="off" class="w-full border min-h-[48px] rounded-xl px-4 my-4" placeholder="VCT-2026-…"><button type="submit" class="min-h-[48px] rounded-xl bg-brand-primary text-white px-6 font-semibold">Find my journey</button><p role="status" data-lookup-status class="text-sm text-brand-muted mt-4"></p></form><div data-booking-dossier class="mt-8"></div>';
  const form = mount.querySelector<HTMLFormElement>('[data-booking-lookup]')!;
  const dossierMount = mount.querySelector<HTMLElement>('[data-booking-dossier]')!;
  const load = async () => {
    const reference = (form.elements.namedItem('reference') as HTMLInputElement).value.trim();
    if (!reference) return;
    const status = form.querySelector<HTMLElement>('[data-lookup-status]')!;
    status.textContent = 'Finding your saved journey…';
    try { renderBookingDossier(dossierMount, await apiRequest(`/api/v1/bookings/${encodeURIComponent(reference)}`), () => void load()); status.textContent = ''; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Journey could not be retrieved.'; }
  };
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) void load(); });
  const initial = new URLSearchParams(location.search).get('booking');
  if (initial) { (form.elements.namedItem('reference') as HTMLInputElement).value = initial; void load(); }
}

function renderBookingDossier(mount: HTMLElement, dossier: any, refresh: () => void): void {
  const group = dossier.bookingGroup; const items = dossier.items || [];
  if (!group) throw new Error('The booking record could not be read.');
  const confirmed = group.overallFulfillmentStatus === 'CONFIRMED' && items.length && items.every((item: any) => item.isUpstreamConfirmed && item.fulfillmentStatus === 'CONFIRMED');
  mount.innerHTML = `<div class="border rounded-2xl bg-white p-6 md:p-8"><div class="flex flex-wrap justify-between gap-4"><div><p class="text-sm text-brand-muted mb-2">Vacatina booking reference</p><h2 class="font-heading text-2xl font-bold text-brand-primary break-all">${escapeBookingText(group.bookingReference)}</h2></div><button type="button" data-refresh-booking class="min-h-[44px] px-4 border rounded-xl font-semibold">Refresh status</button></div><dl class="grid sm:grid-cols-3 gap-5 py-6 my-4 border-y"><div><dt class="text-sm text-brand-muted">Journey status</dt><dd class="font-semibold mt-1">${escapeBookingText(group.overallFulfillmentStatus.replace(/_/g,' '))}</dd></div><div><dt class="text-sm text-brand-muted">Payment</dt><dd class="font-semibold mt-1">${escapeBookingText(group.paymentStatus.replace(/_/g,' '))}</dd></div><div><dt class="text-sm text-brand-muted">Journey total</dt><dd class="font-semibold mt-1 tabular-nums">${escapeBookingText(formatBookingMoney(group.totalSellingPriceMinor, group.currency))}</dd></div></dl>${!confirmed ? '<p class="text-sm text-brand-muted mb-5">Your payment status and supplier confirmation are separate. Travel is confirmed only when the supplier confirms each item.</p>' : ''}<ul class="divide-y">${items.map((item: any) => `<li class="py-4"><h3 class="font-semibold">${escapeBookingText(item.title)}</h3><p class="text-sm text-brand-muted mt-2">${escapeBookingText(item.fulfillmentStatus)}${item.isUpstreamConfirmed && item.supplierBookingReference ? ` · Supplier reference ${escapeBookingText(item.supplierBookingReference)}` : ' · Supplier confirmation pending'}</p></li>`).join('')}</ul>${confirmed ? `<button type="button" data-booking-voucher class="min-h-[44px] rounded-xl bg-brand-primary text-white px-5 font-semibold mt-5">View printable confirmation</button>` : ''}${!['CANCELLED','CANCEL_PENDING'].includes(group.overallFulfillmentStatus) ? '<form data-cancel-booking class="mt-7 pt-6 border-t"><h3 class="font-heading text-lg font-semibold mb-2">Need to change your plans?</h3><p class="text-sm text-brand-muted mb-4">Request cancellation for operations review. This does not immediately cancel supplier bookings or guarantee a refund.</p><label class="block text-sm font-semibold">Reason<textarea required name="reason" maxlength="500" rows="3" class="w-full border rounded-xl p-3 mt-2 font-normal"></textarea></label><button type="submit" class="min-h-[44px] border rounded-xl px-5 font-semibold mt-4">Request cancellation review</button><p data-cancel-status role="status" class="text-sm text-brand-muted mt-3"></p></form>' : ''}</div>`;
  mount.querySelector('[data-refresh-booking]')?.addEventListener('click', refresh);
  mount.querySelector('[data-booking-voucher]')?.addEventListener('click', async () => {
    try {
      const result = await apiRequest(`/api/v1/bookings/${encodeURIComponent(group.bookingReference)}/voucher`);
      const blob = new Blob([result.html], { type: 'text/html' }); const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `Vacatina-${group.bookingReference}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { const button = mount.querySelector('[data-booking-voucher]'); if (button) button.textContent = error instanceof Error ? error.message : 'Confirmation unavailable'; }
  });
  const cancel = mount.querySelector<HTMLFormElement>('[data-cancel-booking]'); const requestKey = newBookingRequestKey();
  cancel?.addEventListener('submit', async event => {
    event.preventDefault(); if (!cancel.reportValidity()) return;
    const status = cancel.querySelector<HTMLElement>('[data-cancel-status]')!; const button = cancel.querySelector<HTMLButtonElement>('button')!;
    button.disabled = true; status.textContent = 'Submitting your request…';
    try { const result = await apiRequest(`/api/v1/bookings/${encodeURIComponent(group.bookingReference)}/cancel`, { method: 'POST', headers: { 'X-Idempotency-Key': requestKey }, body: JSON.stringify({ reason: (cancel.elements.namedItem('reason') as HTMLTextAreaElement).value }) }); status.textContent = `Request received. Operations reference: ${result.ticketReference}. Supplier cancellation and refund remain subject to review.`; }
    catch (error) { status.textContent = error instanceof Error ? error.message : 'Cancellation request could not be submitted.'; button.disabled = false; }
  });
}
