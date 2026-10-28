/* Local assistance-request review. No passport collection, upload, filing or approval simulation. */
import { visaSearchService } from '../services/visa-search.service.ts';
import { visaTripBucketService } from '../services/visa-trip-bucket.service.ts';
import { VISA_DEMO_DISCLOSURE, getVisaContext, rememberVisaContext, validateVisaContext, visaContextFromQuery } from '../domain/visa-journey.ts';
import { journeyEscape, journeyConfigurationFromQuery } from '../../journeys/domain/journey-models.ts';
import { renderJourneyFields, readJourneyForm } from '../../journeys/ui/product-workspace.ts';
import { showToast, activateFocusTrap, deactivateFocusTrap, setBackgroundInert } from '../../../components/ui/toast.ts';
import { openTripBucketDrawer } from '../../../components/trip-bucket/trip-bucket-ui.ts';

let trigger: HTMLElement | null = null;
let generation = 0;
export function closeCanonicalVisaApplicationModal(): void {
  generation++;
  const modal = document.getElementById('visa-application-modal-overlay');
  if (!modal) return;
  deactivateFocusTrap(modal); setBackgroundInert(false);
  window.removeEventListener('keydown', onKey); modal.remove();
  if (trigger?.isConnected) trigger.focus();
}
function onKey(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); closeCanonicalVisaApplicationModal(); } }

export async function openCanonicalVisaApplicationModal(offerId: string, query = new URLSearchParams()): Promise<void> {
  closeCanonicalVisaApplicationModal();
  const request = ++generation;
  trigger = document.activeElement as HTMLElement | null;
  const aliases: Record<string, string> = { UAE: 'vct-vs-consular-ae-30d', UK: 'vct-vs-consular-uk-6m', SINGAPORE: 'vct-vs-consular-sg-30d', INDIA: 'vct-vs-consular-in-30d', FRANCE: 'vct-vs-consular-fr-schengen' };
  const raw = await visaSearchService.getOfferById(aliases[offerId.toUpperCase()] || offerId);
  if (request !== generation) return;
  const modal = document.createElement('div'); modal.id = 'visa-application-modal-overlay';
  modal.className = 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6';
  modal.setAttribute('role', raw ? 'dialog' : 'alertdialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'visa-modal-title');
  const context = query.size ? visaContextFromQuery(query) : getVisaContext() || journeyConfigurationFromQuery(new URLSearchParams());
  if (raw && (!query.size || !context.destination)) context.destination = raw.countryName;
  modal.innerHTML = `<div class="bg-white text-brand-black rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden min-w-0">
    <header class="p-5 border-b border-brand-border flex items-start justify-between gap-3"><h2 id="visa-modal-title" class="font-heading font-bold text-xl break-words">${raw ? journeyEscape(raw.title) : 'Visa option unavailable'}</h2><button id="visa-modal-close-btn" type="button" aria-label="Close visa request" class="min-h-[44px] min-w-[44px] rounded-xl border">✕</button></header>
    <div class="overflow-y-auto p-5 sm:p-6 space-y-6">
    ${raw ? `<p id="visa-truth" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed">${VISA_DEMO_DISCLOSURE}</p>
      <section><h3 class="font-bold">Fee per applicant (estimate)</h3><p class="text-xl text-brand-primary font-bold mt-2">${journeyEscape(raw.pricing.currency)} ${(raw.pricing.totalPriceMinor / 100).toLocaleString()}</p><p class="text-xs mt-2">Government fee example: ${raw.pricing.embassyFeeMinor / 100} · Assistance example: ${raw.pricing.vacatinaConciergeFeeMinor / 100} · Tax example: ${raw.pricing.taxMinor / 100}</p><p class="text-xs mt-2">Processing example: ${raw.processingSlaBusinessDays} business days. Not a government commitment or verified turnaround.</p></section>
      <section><h3 class="font-bold">Document checklist example</h3><ul class="list-disc pl-5 mt-3 space-y-2 text-sm">${raw.documentChecklist.map(doc => `<li><strong>${journeyEscape(doc.title)}</strong> — ${journeyEscape(doc.description)}</li>`).join('')}</ul></section>
      <p class="text-xs rounded-xl bg-brand-subtle p-4">Do not enter passport numbers or upload identity documents. Application persistence and secure document submission are not connected. Nothing is filed with any authority.</p>
      <form id="visa-applicant-form" class="space-y-5" novalidate><h3 class="font-bold">Applicant & travel context</h3><div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${renderJourneyFields('visa', context)}</div><p id="visa-request-error" role="alert" class="text-sm text-brand-error"></p><button id="visa-modal-stage-btn" type="submit" class="min-h-[44px] w-full px-5 py-3 bg-brand-primary text-white rounded-xl font-semibold">Stage assistance request</button><p class="text-xs text-brand-muted">Local Trip Bucket only · No application submitted · No visa approval</p></form>` : `<p role="alert">${journeyEscape(offerId)} was not found. No application or payment was created. Close this dialog and search again.</p>`}
    </div></div>`;
  modal.querySelector('#visa-modal-close-btn')?.addEventListener('click', closeCanonicalVisaApplicationModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeCanonicalVisaApplicationModal(); });
  modal.querySelector<HTMLFormElement>('#visa-applicant-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (!raw) return;
    const form = event.currentTarget as HTMLFormElement;
    const selected = readJourneyForm(form, context);
    const errors = validateVisaContext(selected);
    const alert = modal.querySelector('#visa-request-error')!;
    if (errors.length) { alert.textContent = errors.join(' '); return; }
    const button = form.querySelector<HTMLButtonElement>('#visa-modal-stage-btn')!;
    if (button.disabled) return; button.disabled = true;
    try {
      rememberVisaContext(selected);
      const offer = { ...raw, inventoryMode: 'demo_fixture' as const };
      await visaTripBucketService.stageVisaApplication(offer, {
        visaId: offer.visaId, canonicalOfferId: offer.canonicalOfferId, countryName: offer.countryName, countryCode: offer.countryCode, visaType: offer.title, category: offer.category, entryType: offer.entryType, durationDays: offer.durationDays, processingSlaDays: offer.processingSlaBusinessDays,
        travelDate: selected.departureDate, journeyContext: selected, pricing: offer.pricing, sourceType: offer.sourceType, supplierName: offer.supplierName,
        applicant: { fullName: `${selected.adults + selected.children + selected.infants} applicant(s)`, passportNumber: '', passportExpiryDate: '', nationality: selected.citizenshipCountry, email: '', phone: '', travelDate: selected.departureDate, uploadedDocumentCount: 0 }
      });
      if (request !== generation) return;
      closeCanonicalVisaApplicationModal(); showToast('Assistance request staged locally. No upload, filing or approval occurred.', 'brand'); openTripBucketDrawer();
    } catch (error) { alert.textContent = error instanceof Error ? error.message : 'Could not stage this request.'; button.disabled = false; }
  });
  document.body.appendChild(modal); window.addEventListener('keydown', onKey);
  setBackgroundInert(true, modal); activateFocusTrap(modal); modal.querySelector<HTMLButtonElement>('#visa-modal-close-btn')?.focus();
}
