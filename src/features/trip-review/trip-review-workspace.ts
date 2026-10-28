/* ============================================================================
 * Vacatina Trip Review Workspace (/trip/review)
 *
 * This is the customer review step for the browser-local Trip Bucket used by
 * the Flights journey. It is intentionally local: server checkout only knows
 * server-persisted items, and demo/manual flight inventory must never be
 * presented as a confirmed, payable booking.
 * ============================================================================ */

import type { TripBucketCandidate } from '../../lib/domain/types.ts';
import type { CanonicalFlightOffer } from '../flights/domain/flight-models.ts';
import {
  TRIP_BUCKET_STATE_DESCRIPTORS,
  tripBucketService
} from '../../lib/services/trip-bucket.service.ts';
import { flightSearchService } from '../flights/services/flight-search.service.ts';
import {
  duffelSandboxFlightAdapter,
  type SandboxOrderConfirmation
} from '../flights/adapters/duffel-sandbox-flight.adapter.ts';
import { formatCurrencyAmount } from '../../lib/mock-data/catalog.ts';
import { showToast } from '../../components/ui/toast.ts';
import { openTripBucketDrawer } from '../../components/trip-bucket/trip-bucket-ui.ts';
import { routerService } from '../../lib/services/router.service.ts';
import { getLastFlightSearchQuery } from '../flights/domain/flight-search-context.ts';
import { findJourneyProduct, journeyMoney } from '../journeys/domain/journey-models.ts';

const SANDBOX_RESULT_PREFIX = 'vacatina:duffel-sandbox-order-result:';
const SANDBOX_KEY_PREFIX = 'vacatina:duffel-sandbox-order-key:';

function nativeMoney(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function readSandboxOrderResult(itemId: string): SandboxOrderConfirmation | null {
  try {
    const raw = sessionStorage.getItem(`${SANDBOX_RESULT_PREFIX}${itemId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SandboxOrderConfirmation;
    return parsed?.sandbox === true && parsed?.liveMode === false ? parsed : null;
  } catch {
    return null;
  }
}

function sandboxIdempotencyKey(itemId: string): string {
  const storageKey = `${SANDBOX_KEY_PREFIX}${itemId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sbx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `sbx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function escapeReviewText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]!));
}

function stateLabel(item: TripBucketCandidate): string {
  return TRIP_BUCKET_STATE_DESCRIPTORS[item.state]?.label || item.state;
}

function stateBadgeClasses(item: TripBucketCandidate): string {
  return TRIP_BUCKET_STATE_DESCRIPTORS[item.state]?.badgeClasses || 'bg-gray-100 text-gray-700 border border-gray-200';
}

function isNonLiveItem(item: TripBucketCandidate): boolean {
  return item.inventoryMode !== 'live_supplier';
}

export interface TripReviewHandoff {
  nonLiveCount: number;
  blockedItems: TripBucketCandidate[];
  canCheckout: boolean;
  blockers: Array<{ id: string; title: string; blockers: string[] }>;
}

/**
 * Pure gate used by the review workspace and its automated tests. Checkout is
 * only possible when every staged item is live-confirmed and ready.
 */
export function evaluateTripReviewHandoff(items: TripBucketCandidate[]): TripReviewHandoff {
  const blockedItems = items.filter(item => blockersFor(item).length > 0);
  return {
    nonLiveCount: items.filter(isNonLiveItem).length,
    blockedItems,
    canCheckout: items.length > 0 && blockedItems.length === 0,
    blockers: blockedItems.map(item => ({
      id: item.id,
      title: item.title,
      blockers: blockersFor(item)
    }))
  };
}

function blockersFor(item: TripBucketCandidate): string[] {
  const blockers: string[] = [];
  if (item.state !== 'ready') {
    blockers.push(`State: ${stateLabel(item)}`);
  }
  if (isNonLiveItem(item)) {
    blockers.push(
      item.inventoryMode === 'sandbox_test'
        ? 'Duffel TEST MODE sandbox quote — explicit sandbox test order only; not live checkout'
        : item.inventoryMode === 'demo_fixture'
          ? 'Demo fixture — no live supplier inventory or reservation hold'
          : item.inventoryMode === 'manual_request'
            ? 'Manual request-to-book — desk confirmation required'
            : 'Not confirmed as live supplier inventory'
    );
  }
  if (item.confirmationMode === 'REQUEST_TO_CONFIRM') {
    blockers.push('Supplier confirmation required before this item can be booked');
  }
  return [...new Set(blockers)];
}

function metadataRows(item: TripBucketCandidate): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (item.inventoryLabel) rows.push(['Inventory source', item.inventoryLabel]);
  else if (item.sourceType) rows.push(['Inventory source', item.sourceType]);
  if (item.providerName) rows.push(['Provider', item.providerName]);
  if (item.offerId) rows.push(['Canonical offer', item.offerId]);
  if (item.propertyId) rows.push(['Property', item.propertyId]);
  if (item.roomId) rows.push(['Room', item.roomId]);
  if (item.ratePlanId) rows.push(['Rate plan', item.ratePlanId]);
  if (item.availabilityStatus) rows.push(['Availability', item.availabilityStatus]);
  if (item.validUntil) rows.push(['Fixture valid until', item.validUntil]);
  if (item.configuration) {
    const common = ['destination', 'origin', 'departureDate', 'returnDate', 'adults', 'children', 'infants', 'travelWindow'];
    const fields: Record<string, string[]> = {
      hotels: ['checkInDate', 'checkOutDate', 'roomsCount', 'adultsCount', 'childrenCount', 'roomName', 'rateName', 'boardBasisLabel', 'cancellationPolicyDescription'],
      visa: ['citizenshipCountry', 'residenceCountry', 'purpose', 'eligibilityState', 'applicationState', 'documentUploadState'],
      packages: ['rooms', 'durationDays', 'packageStyle', 'packageStylePreference', 'accommodationTier'],
      cars: ['serviceType', 'pickup', 'dropoff', 'pickupTime', 'returnTime', 'tripType', 'luggage', 'driverAge', 'vehicleCategory'],
      activities: ['timeSlot', 'ticketType', 'requestedCategory'], sightseeing: ['timeSlot', 'ticketType', 'language', 'requestedCategory'],
      rails: ['cabinClass'], cruises: ['departurePort', 'cabinType', 'cabinPreference', 'durationPreference'],
      insurance: ['travellerAges', 'residenceCountry', 'coverageOption', 'coveragePreference']
    };
    for (const [key, value] of Object.entries(item.configuration)) {
      if ((common.includes(key) || fields[item.productType]?.includes(key)) && value !== '' && (typeof value === 'string' || typeof value === 'number')) rows.push([key.replace(/([A-Z])/g, ' $1'), String(value)]);
    }
  }
  if (item.scheduleStatus) rows.push(['Schedule status', item.scheduleStatus.replace(/_/g, ' ')]);
  if (item.selectedServiceIds?.length) rows.push(['Sandbox extras', `${item.selectedServiceIds.length} selected`]);
  if (item.fareFamilyName) rows.push(['Fare family', item.fareFamilyName]);
  if (item.travellerCounts) {
    const counts = item.travellerCounts;
    rows.push([
      'Travellers',
      `${counts.adults} adult${counts.adults === 1 ? '' : 's'} · ${counts.children} child${counts.children === 1 ? '' : 'ren'} · ${counts.infants} infant${counts.infants === 1 ? '' : 's'}`
    ]);
  }
  if (item.searchContext?.origin && item.searchContext?.destination) {
    rows.push(['Search route', `${item.searchContext.origin} → ${item.searchContext.destination}`]);
  }
  if (item.revalidationStatus) {
    rows.push([
      'Last revalidation',
      `${item.revalidationStatus.replace(/_/g, ' ')}${item.revalidatedAt ? ` · ${new Date(item.revalidatedAt).toLocaleString()}` : ''}`
    ]);
  }
  return rows;
}

export function reviewDetailHref(item: TripBucketCandidate): string | null {
  const product = findJourneyProduct(item.productType);
  if (!product || !item.offerId) return null;
  const query = new URLSearchParams();
  const config: Record<string, unknown> = item.configuration || item.searchContext || {};
  for (const [key, value] of Object.entries(config)) if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') query.set(key, String(value));
  if (item.productType === 'hotels') {
    for (const [key, source] of [['checkIn', 'checkInDate'], ['checkOut', 'checkOutDate'], ['rooms', 'roomsCount'], ['adults', 'adultsCount'], ['children', 'childrenCount']]) if (config[source] !== undefined) query.set(key, String(config[source]));
  }
  if (item.inventoryMode === 'demo_fixture' && !['flights', 'hotels', 'visa'].includes(item.productType)) query.set('inventory', 'demo');
  const prefix = item.productType === 'hotels' ? 'property' : item.productType === 'visa' ? 'apply' : 'offer';
  return `${product.route}/${prefix}/${encodeURIComponent(item.propertyId || item.offerId)}?${query}`;
}

function sandboxPassengerLabel(passenger: { type: string }, index: number): string {
  const typeLabel = passenger.type === 'adult' ? 'Adult' : passenger.type === 'child' ? 'Child' : 'Infant';
  return `${typeLabel} ${index + 1}`;
}

function renderSandboxOrderSuccess(item: TripBucketCandidate, result: SandboxOrderConfirmation): string {
  return `
    <div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 space-y-2" data-sandbox-order-result="${escapeReviewText(item.id)}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-bold text-emerald-950">Sandbox test order created</h3>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-50">Non-production</span>
      </div>
      <p class="text-[11px] text-emerald-950 leading-relaxed">
        Duffel created a TEST MODE order. No live ticket was issued, no seat on a live flight was held, and no payment was captured.
      </p>
      <dl class="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div><dt class="font-bold text-emerald-950">Duffel sandbox order</dt><dd class="font-mono break-all text-emerald-900">${escapeReviewText(result.orderId)}</dd></div>
        ${result.bookingReference ? `<div><dt class="font-bold text-emerald-950">Sandbox booking reference</dt><dd class="font-mono text-emerald-900">${escapeReviewText(result.bookingReference)}</dd></div>` : ''}
        <div><dt class="font-bold text-emerald-950">Sandbox total</dt><dd class="text-emerald-900 tabular-nums">${escapeReviewText(nativeMoney(result.totalAmountMinor, result.currency))}</dd></div>
        <div><dt class="font-bold text-emerald-950">Passengers</dt><dd class="text-emerald-900 tabular-nums">${result.passengerCount}</dd></div>
      </dl>
      <p class="text-[11px] text-emerald-900">${escapeReviewText(result.message)}</p>
      <p class="text-[10px] text-emerald-800">This record is sandbox evidence only. It must never be presented as a live Vacatina booking or used for production ticketing.</p>
    </div>
  `;
}

function renderSandboxOrderPanel(item: TripBucketCandidate): string {
  const result = readSandboxOrderResult(item.id);
  if (result) return renderSandboxOrderSuccess(item, result);
  return `
    <div class="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3" data-sandbox-order-panel="${escapeReviewText(item.id)}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="text-sm font-bold text-indigo-950">Duffel TEST MODE sandbox order</h3>
          <p class="text-[11px] text-indigo-900/80 leading-relaxed mt-1">
            Create an explicit sandbox test order for this quote. Passenger details are required and the total is re-priced by Duffel before ordering.
            No live ticket, live seat hold or payment is created.
          </p>
        </div>
        <span class="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-50">Sandbox only</span>
      </div>
      <div data-sandbox-order-body>
        <button type="button" data-sandbox-order-start="${escapeReviewText(item.id)}" class="min-h-[44px] px-4 rounded-xl bg-indigo-950 text-white text-xs font-bold hover:bg-indigo-900 transition-colors">
          Prepare sandbox order
        </button>
        <p class="text-[10px] text-indigo-900/70 mt-2">A stable idempotency reference is kept for this item so retries cannot create duplicate sandbox orders.</p>
      </div>
    </div>
  `;
}

function renderSandboxOrderForm(body: Element, item: TripBucketCandidate, offer: CanonicalFlightOffer): void {
  const passengers = offer.sandbox?.passengers || [];
  if (!passengers.length) {
    body.innerHTML = `<p class="text-[11px] text-red-700" role="alert">Duffel TEST MODE did not return passenger references for this offer. Run a fresh sandbox search.</p>`;
    return;
  }
  const serviceIds = Array.from(new Set(item.selectedServiceIds || []));
  const services = serviceIds.map(id => ({ id, quantity: 1 }));
  const knownServices = (offer.sandbox?.services || []).filter(service => serviceIds.includes(service.id));
  const unknownServiceCount = serviceIds.length - knownServices.length;
  const idempotencyKey = sandboxIdempotencyKey(item.id);
  const today = new Date().toISOString().slice(0, 10);

  body.innerHTML = `
    <form data-sandbox-order-form="${escapeReviewText(item.id)}" class="space-y-4" novalidate>
      <input type="hidden" name="idempotencyKey" value="${escapeReviewText(idempotencyKey)}" />
      <input type="hidden" name="acceptedPriceMinor" value="" />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label class="block text-[11px] font-bold text-brand-black">Contact email
          <input name="contactEmail" type="email" required autocomplete="email" placeholder="traveller@example.com" class="mt-1 w-full min-h-[40px] rounded-xl border border-indigo-200 bg-white px-3 text-xs font-normal outline-none focus:border-indigo-600" />
        </label>
        <label class="block text-[11px] font-bold text-brand-black">Contact phone
          <input name="contactPhone" type="tel" required autocomplete="tel" placeholder="+94 77 123 4567" class="mt-1 w-full min-h-[40px] rounded-xl border border-indigo-200 bg-white px-3 text-xs font-normal outline-none focus:border-indigo-600" />
        </label>
      </div>

      <div class="space-y-3">
        ${passengers
          .map(
            (passenger, index) => `
              <fieldset class="rounded-xl border border-indigo-200 bg-white p-3 space-y-2">
                <legend class="px-1 text-[10px] font-bold uppercase tracking-wider text-indigo-900">${escapeReviewText(sandboxPassengerLabel(passenger, index))} · ${escapeReviewText(passenger.type.replace(/_/g, ' '))}</legend>
                <input type="hidden" name="passengerId_${index}" value="${escapeReviewText(passenger.id)}" />
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <label class="block text-[10px] font-bold text-brand-muted">Title
                    <select name="title_${index}" required class="mt-1 w-full min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-normal">
                      <option value="mr">Mr</option>
                      <option value="mrs">Mrs</option>
                      <option value="ms">Ms</option>
                      <option value="miss">Miss</option>
                      <option value="dr">Dr</option>
                    </select>
                  </label>
                  <label class="block text-[10px] font-bold text-brand-muted">Given name
                    <input name="givenName_${index}" required autocomplete="given-name" maxlength="80" class="mt-1 w-full min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-normal" />
                  </label>
                  <label class="block text-[10px] font-bold text-brand-muted">Family name
                    <input name="familyName_${index}" required autocomplete="family-name" maxlength="80" class="mt-1 w-full min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-normal" />
                  </label>
                  <label class="block text-[10px] font-bold text-brand-muted">Date of birth
                    <input name="bornOn_${index}" type="date" required max="${today}" autocomplete="bday" class="mt-1 w-full min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-normal" />
                  </label>
                  <label class="block text-[10px] font-bold text-brand-muted">Gender
                    <select name="gender_${index}" required class="mt-1 w-full min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 text-xs font-normal">
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            `
          )
          .join('')}
      </div>

      <div class="rounded-xl border border-indigo-200 bg-white p-3 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-wider text-indigo-900">Sandbox total</p>
            <p class="text-lg font-black text-indigo-950 tabular-nums" data-sandbox-quote-total>Refresh the sandbox total</p>
            <p class="text-[10px] text-brand-muted">Includes ${serviceIds.length} selected service${serviceIds.length === 1 ? '' : 's'}${unknownServiceCount > 0 ? ` (${unknownServiceCount} seat selection${unknownServiceCount === 1 ? '' : 's'})` : ''}.</p>
          </div>
          <button type="button" data-sandbox-refresh-quote class="min-h-[40px] px-3 rounded-xl border border-indigo-300 text-[11px] font-bold text-indigo-950 hover:border-indigo-600 disabled:opacity-60">Refresh sandbox total</button>
        </div>
        ${
          knownServices.length
            ? `<ul class="text-[11px] text-brand-muted space-y-0.5">${knownServices.map(service => `<li>${escapeReviewText(service.name)} · ${escapeReviewText(nativeMoney(service.priceMinor, service.currency))}</li>`).join('')}</ul>`
            : ''
        }
      </div>

      <label class="flex items-start gap-2 text-[11px] text-indigo-950">
        <input type="checkbox" name="confirmSandbox" required class="mt-0.5 h-4 w-4 accent-indigo-700" />
        <span>I understand this creates a Duffel <strong>TEST MODE</strong> sandbox order only. It is not a live booking, no live ticket is issued, and no payment is captured.</span>
      </label>

      <p class="hidden text-[11px] text-red-700" data-sandbox-order-error role="alert"></p>

      <button type="submit" class="w-full min-h-[46px] rounded-xl bg-indigo-950 text-white text-xs font-bold hover:bg-indigo-900 disabled:opacity-60">
        Create Duffel sandbox test order
      </button>
    </form>
  `;

  const form = body.querySelector<HTMLFormElement>('form[data-sandbox-order-form]');
  if (!form) return;
  const quoteTotal = form.querySelector<HTMLElement>('[data-sandbox-quote-total]');
  const acceptedInput = form.querySelector<HTMLInputElement>('input[name="acceptedPriceMinor"]');
  const refreshButton = form.querySelector<HTMLButtonElement>('[data-sandbox-refresh-quote]');
  const errorElement = form.querySelector<HTMLElement>('[data-sandbox-order-error]');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const refreshQuote = async () => {
    if (!quoteTotal || !acceptedInput || !refreshButton) return;
    refreshButton.disabled = true;
    quoteTotal.textContent = 'Refreshing Duffel TEST MODE quote…';
    acceptedInput.value = '';
    try {
      const quote = await duffelSandboxFlightAdapter.quoteOrder(offer.offerId, services);
      acceptedInput.value = String(quote.totalAmountMinor);
      quoteTotal.textContent = nativeMoney(quote.totalAmountMinor, quote.currency);
      quoteTotal.dataset.currency = quote.currency;
      quoteTotal.dataset.amountMinor = String(quote.totalAmountMinor);
      refreshButton.textContent = 'Refresh sandbox total';
    } catch (error) {
      quoteTotal.textContent = 'Sandbox total unavailable';
      refreshButton.textContent = 'Retry sandbox total';
      if (errorElement) errorElement.textContent = (error as Error).message || 'The Duffel TEST MODE quote could not be refreshed.';
    } finally {
      refreshButton.disabled = false;
    }
  };

  refreshButton?.addEventListener('click', () => { void refreshQuote(); });
  void refreshQuote();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!acceptedInput?.value) {
      if (errorElement) errorElement.textContent = 'Refresh the Duffel sandbox total before creating an order.';
      return;
    }
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const email = String(formData.get('contactEmail') || '').trim();
    const phoneNumber = String(formData.get('contactPhone') || '').trim();
    const passengerInput = passengers.map((passenger, index) => {
      const genderValue = String(formData.get(`gender_${index}`) || '');
      return {
        offerPassengerId: String(formData.get(`passengerId_${index}`) || passenger.id),
        title: String(formData.get(`title_${index}`) || 'mr'),
        givenName: String(formData.get(`givenName_${index}`) || '').trim(),
        familyName: String(formData.get(`familyName_${index}`) || '').trim(),
        bornOn: String(formData.get(`bornOn_${index}`) || ''),
        email,
        phoneNumber,
        gender: (genderValue === 'F' ? 'F' : 'M') as 'M' | 'F'
      };
    });

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Creating sandbox order…';
    }
    if (errorElement) errorElement.textContent = '';
    try {
      const confirmation = await duffelSandboxFlightAdapter.createOrder({
        offerId: offer.offerId,
        supplierOfferId: offer.sourceOfferId,
        passengers: passengerInput,
        services,
        acceptedPriceMinor: Number(acceptedInput.value)
      }, idempotencyKey);
      try {
        sessionStorage.setItem(`${SANDBOX_RESULT_PREFIX}${item.id}`, JSON.stringify(confirmation));
      } catch {
        // The success result still renders for this session even if storage is unavailable.
      }
      const panel = body.closest('[data-sandbox-order-panel]');
      if (panel) panel.outerHTML = renderSandboxOrderSuccess(item, confirmation);
      showToast('Duffel TEST MODE sandbox order created. No live ticket or payment was captured.', 'success');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (errorElement) errorElement.textContent = (error as Error).message || 'The Duffel TEST MODE sandbox order could not be created.';
      if (code === 'SANDBOX_PRICE_CHANGED') {
        if (acceptedInput) acceptedInput.value = '';
        if (refreshButton) refreshButton.textContent = 'Refresh sandbox total';
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Create Duffel sandbox test order';
        }
      } else if (code === 'SANDBOX_OUTCOME_UNKNOWN' || code === 'ORDER_IN_PROGRESS') {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Check Duffel before retrying';
        }
      } else {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Create Duffel sandbox test order';
        }
      }
    }
  });
}

export function renderTripReviewWorkspace(container: HTMLElement): void {
  const render = () => {
    const items = tripBucketService.getItems();
    const summary = tripBucketService.getSummary();
    const currency = 'LKR';

    const handoff = evaluateTripReviewHandoff(items);
    const nonLiveCount = handoff.nonLiveCount;
    const sandboxCount = items.filter(item => item.inventoryMode === 'sandbox_test').length;
    const blockedItems = handoff.blockedItems;
    const canCheckout = handoff.canCheckout;

    const itemsHtml = items
      .map(item => {
        const blockers = blockersFor(item);
        const rows = metadataRows(item);
        return `
          <article class="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4 min-w-0" data-review-item-id="${escapeReviewText(item.id)}" data-inventory-mode="${escapeReviewText(item.inventoryMode || 'unknown')}">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-brand-muted">${escapeReviewText(item.productLabel)}</span>
                  <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${stateBadgeClasses(item)}">${escapeReviewText(stateLabel(item))}</span>
                </div>
                <h2 class="text-base sm:text-lg font-bold text-brand-black mt-1 break-words">${escapeReviewText(item.title)}</h2>
                <p class="text-xs text-brand-muted mt-1">${escapeReviewText(item.subtitle)} · ${escapeReviewText(item.dateSummary)}</p>
                <p class="text-xs text-brand-muted mt-1">${escapeReviewText(item.travellerSummary)}</p>
              </div>
              <div class="text-right shrink-0">
                <div class="text-[10px] uppercase font-bold tracking-wider text-brand-muted">Estimate</div>
                <div class="text-lg font-black text-brand-black tabular-nums">${item.priceStatus === 'quote_required' ? 'Quote required' : item.amountMinor !== undefined && item.currency !== 'LKR' ? escapeReviewText(journeyMoney(item.amountMinor / 100, item.currency)) : formatCurrencyAmount(item.priceLkr, currency)}</div>
              </div>
            </div>

            ${
              rows.length
                ? `<dl class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] border-t border-gray-100 pt-3">
                    ${rows
                      .map(
                        ([label, value]) =>
                          `<div class="min-w-0"><dt class="font-bold text-brand-black">${escapeReviewText(label)}</dt><dd class="text-brand-muted break-words">${escapeReviewText(value)}</dd></div>`
                      )
                      .join('')}
                  </dl>`
                : ''
            }

            ${
              item.truthDisclosure
                ? `<p class="text-[11px] leading-relaxed rounded-xl px-3 py-2 ${
                    item.inventoryMode === 'demo_fixture'
                      ? 'bg-slate-50 border border-slate-200 text-slate-700'
                      : item.inventoryMode === 'manual_request'
                        ? 'bg-amber-50 border border-amber-200 text-amber-950'
                        : item.inventoryMode === 'sandbox_test'
                          ? 'bg-indigo-50 border border-indigo-200 text-indigo-950'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  }">${escapeReviewText(item.truthDisclosure)}</p>`
                : ''
            }

            ${
              blockers.length
                ? `<div class="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[11px] text-amber-950">
                    <p class="font-bold mb-1">Before this item can be booked</p>
                    <ul class="list-disc pl-4 space-y-0.5">${blockers.map(blocker => `<li>${escapeReviewText(blocker)}</li>`).join('')}</ul>
                  </div>`
                : `<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-900 font-semibold">Ready — no outstanding blockers recorded.</div>`
            }

            ${
              item.actionRequiredText
                ? `<p class="text-[11px] font-medium text-[#B45309]">${escapeReviewText(item.actionRequiredText)}</p>`
                : item.holdStatusText
                  ? `<p class="text-[11px] text-brand-muted">${escapeReviewText(item.holdStatusText)}</p>`
                  : ''
            }

            ${item.sandboxOrderable && item.inventoryMode === 'sandbox_test' ? renderSandboxOrderPanel(item) : ''}

            <div class="flex flex-wrap items-center gap-2 pt-1">
              ${
                reviewDetailHref(item)
                  ? `<a href="${escapeReviewText(reviewDetailHref(item))}" class="min-h-[44px] inline-flex items-center px-3 rounded-xl border border-gray-300 text-xs font-bold">View ${item.productType === 'flights' ? 'flight' : 'selection'}</a>`
                  : ''
              }
              ${
                item.state !== 'ready'
                  ? `<button type="button" data-review-request="${escapeReviewText(item.id)}" class="min-h-[40px] px-3 rounded-xl bg-brand-primary text-white text-[11px] font-bold hover:bg-opacity-95">${escapeReviewText(item.primaryActionLabel || 'Review item')}</button>`
                  : ''
              }
              <button type="button" data-review-remove="${escapeReviewText(item.id)}" class="min-h-[40px] px-3 rounded-xl border border-gray-300 text-[11px] font-bold text-brand-muted hover:text-red-700 hover:border-red-200">Remove</button>
            </div>
          </article>
        `;
      })
      .join('');

    container.innerHTML = `
      <div id="trip-review-workspace" class="w-full bg-white text-brand-black pb-20">
        <section class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <a href="/" class="inline-flex items-center min-h-[44px] text-xs font-bold text-brand-primary hover:underline">← Back to travel planning</a>

          <div class="mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p class="text-[10px] uppercase tracking-widest text-brand-muted font-bold mb-2">Your Vacatina journey</p>
              <h1 class="text-3xl sm:text-4xl font-extrabold font-display text-brand-black">Review your trip</h1>
              <p class="text-sm text-brand-muted mt-2 max-w-2xl leading-relaxed">
                Check each staged option, its inventory source and every outstanding requirement before deciding what to request.
                This review is local to your browser in this build.
              </p>
            </div>
            <button type="button" id="btn-review-open-bucket" class="min-h-[44px] px-4 rounded-xl border border-gray-300 text-xs font-bold text-brand-black hover:bg-gray-50 self-start lg:self-auto">
              Open Trip Bucket
            </button>
          </div>

          <div role="note" class="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 leading-relaxed">
            <strong class="block mb-1">No live supplier, payment, or ticketing is activated in this build.</strong>
            ${sandboxCount > 0
              ? `${sandboxCount} staged item${sandboxCount === 1 ? '' : 's'} came from Duffel TEST MODE. You may create an explicit sandbox test order, but it is non-production: no live ticket, live seat hold or payment is captured.`
              : nonLiveCount > 0
                ? `${nonLiveCount} of ${items.length} staged item${items.length === 1 ? '' : 's'} came from demo fixtures or manual request-to-book inventory. Their estimates are not live quotes and no reservation hold exists.`
                : 'All staged items are shown for review only. Server checkout is not connected to browser-local items in this phase.'}
          </div>

          ${
            items.length === 0
              ? `<div class="mt-8 bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
                  <h2 class="text-lg font-bold font-display text-brand-black">Your Trip Bucket is empty</h2>
                  <p class="text-sm text-brand-muted mt-2">Explore a travel product, configure an option, and return here to review it.</p>
                  <a href="/flights" class="inline-flex items-center min-h-[44px] mt-5 px-5 rounded-xl bg-brand-primary text-white text-sm font-bold">Explore flights</a>
                </div>`
              : `<div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div class="lg:col-span-2 space-y-4">${itemsHtml}</div>

                  <aside class="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 lg:sticky lg:top-24">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-brand-muted">Trip summary</h2>
                    <dl class="space-y-2 text-xs">
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Items</dt><dd class="font-bold tabular-nums">${summary.totalItems}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Ready items</dt><dd class="font-bold tabular-nums">${summary.readyCount}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Needs action</dt><dd class="font-bold tabular-nums">${summary.needsActionCount}</dd></div>
                      <div class="flex justify-between gap-3 border-t border-gray-200 pt-2"><dt class="text-brand-muted">Ready estimate</dt><dd class="font-black text-brand-primary tabular-nums">${formatCurrencyAmount(summary.readySubtotalLkr, currency)}</dd></div>
                      <div class="flex justify-between gap-3"><dt class="text-brand-muted">Excluded from ready</dt><dd class="font-semibold tabular-nums">${formatCurrencyAmount(summary.excludedSubtotalLkr, currency)}</dd></div>
                    </dl>
                    <p class="text-[11px] text-brand-muted">Unpriced requests are not included in estimates. Demo estimates are not live quotes.${sandboxCount > 0 ? ' Duffel TEST MODE quotes are shown in their native currency and are excluded from LKR estimates.' : ''}</p>

                    ${
                      blockedItems.length > 0
                        ? `<div class="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[11px] text-amber-950">
                            <strong class="block mb-1">${blockedItems.length} item${blockedItems.length === 1 ? '' : 's'} need attention</strong>
                            Checkout stays unavailable until every item is live-confirmed and ready.
                          </div>`
                        : ''
                    }

                    <button type="button" id="btn-review-checkout" ${canCheckout ? '' : 'disabled aria-disabled="true"'} class="w-full min-h-[46px] rounded-xl text-sm font-bold ${
                      canCheckout
                        ? 'bg-brand-primary text-white hover:bg-opacity-95'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }">
                      Continue to checkout
                    </button>
                    <p class="text-[11px] text-brand-muted leading-relaxed">
                      ${
                        canCheckout
                          ? 'Server checkout availability is checked again before payment.'
                          : 'Checkout is gated because at least one item is not live-confirmed, or this build is using browser-local demo inventory.'
                      }
                    </p>

                    <a href="${escapeReviewText(getLastFlightSearchQuery())}" class="block text-center text-[11px] font-bold text-brand-primary hover:underline">Back to flight search</a>
                    <button type="button" id="btn-review-continue-shopping" class="w-full min-h-[40px] rounded-xl border border-gray-300 text-[11px] font-bold text-brand-black hover:bg-white">Continue exploring</button>
                  </aside>
                </div>`
          }
        </section>
      </div>
    `;

    container.querySelector('#btn-review-open-bucket')?.addEventListener('click', () => {
      openTripBucketDrawer(document.getElementById('header-trip-bucket-btn'));
    });

    container.querySelector('#btn-review-continue-shopping')?.addEventListener('click', () => {
              routerService.navigateTo('/');
    });

    container.querySelector('#btn-review-checkout')?.addEventListener('click', () => {
      if (!canCheckout) {
        showToast(
          'Checkout is gated: every item must be live-confirmed and ready. No payment or supplier request was started.',
          'warning'
        );
        return;
      }
      routerService.navigateTo('/checkout');
    });

    container.querySelectorAll<HTMLButtonElement>('[data-sandbox-order-start]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-sandbox-order-start');
        if (!id) return;
        const item = tripBucketService.getItems().find(candidate => candidate.id === id);
        const panel = button.closest('[data-sandbox-order-panel]');
        const body = panel?.querySelector('[data-sandbox-order-body]');
        if (!item?.offerId || !body) {
          showToast('This sandbox item is no longer available. Run a fresh Duffel TEST MODE search.', 'warning');
          return;
        }
        button.disabled = true;
        button.textContent = 'Loading Duffel sandbox offer…';
        try {
          const offer = await flightSearchService.getOfferById(item.offerId);
          if (!offer || !offer.sandbox) {
            throw new Error('The Duffel TEST MODE offer could not be loaded. Run a fresh sandbox search.');
          }
          renderSandboxOrderForm(body, item, offer);
        } catch (error) {
          body.innerHTML = `<p class="text-[11px] text-red-700" role="alert">${escapeReviewText((error as Error).message || 'The Duffel TEST MODE offer could not be loaded.')}</p>`;
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-review-request]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-review-request');
        if (!id) return;
        const resolved = tripBucketService.resolveItemAction(id);
        if (!resolved) return;
        if (resolved.state === 'ready') {
          showToast('Item requirements updated. Review the latest state below.', 'brand');
        } else {
          showToast(
            'Requirement recorded locally for this demo. No supplier message or seat hold was sent.',
            'brand'
          );
        }
        render();
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-review-remove]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-review-remove');
        if (!id) return;
        const removed = tripBucketService.removeItem(id);
        if (removed) {
          showToast(`Removed "${removed.title}" from your trip.`, 'brand');
        }
        render();
      });
    });
  };

  render();
}
