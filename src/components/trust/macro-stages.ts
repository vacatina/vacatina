/* ============================================================================
 * Vacatina Macro Stages 3–6 Interactive Controller
 * - Stage 3: Decision Intelligence (Seasonal Destination Guide & Clarity Protocol)
 * - Stage 4: Trust & Confidence
 * - Stage 5: Journey Continuity (Manage Your Journey 6-Tile Triage & Duty Support)
 * - Stage 6: Travel Notes Newsletter Validation
 * ============================================================================ */

import { validateEmailAddress } from '../../lib/validation/travellers.ts';
import { telemetry } from '../../lib/analytics/telemetry.ts';
import {
  openInfoOrSupportModal,
  openSavedFavoritesDrawer,
  openScreen04StatesModal
} from '../dialogs/dialogs-controller.ts';
import { showToast } from '../ui/toast.ts';

export function initMacroStages(): void {
  initDecisionIntelligenceStage();
  initJourneyContinuityStage();
  initNewsletterSubscription();
}

function initDecisionIntelligenceStage(): void {
  const stage = document.querySelector<HTMLElement>('section[aria-label="Decision Intelligence Stage"]');
  if (!stage) return;

  const cards = stage.querySelectorAll<HTMLElement>('.grid > div');
  const seasonalCard = cards[0];
  const clarityCard = cards[1];

  if (seasonalCard) {
    const cta = seasonalCard.querySelector<HTMLElement>('.font-semibold.text-brand-primary');
    if (cta) {
      cta.setAttribute('role', 'button');
      cta.setAttribute('tabindex', '0');
      cta.classList.add('cursor-pointer', 'hover:underline');

      const openSeasonalMatrix = () => {
        telemetry.track('open_seasonal_guide');
        openInfoOrSupportModal(
          'Macro Seasonal Destination Suitability Matrix',
          'Decision Intelligence · Verified Climatic Windows (No Fake Live Weather)',
          `
            <div class="space-y-3">
              <p>Vacatina provides verified historical and macro-seasonal travel guidance rather than synthetic live weather telemetry.</p>
              <div class="overflow-x-auto border border-brand-border rounded-xl">
                <table class="w-full text-left border-collapse text-[11px]">
                  <thead class="bg-brand-subtle text-brand-black font-bold">
                    <tr>
                      <th class="p-2.5 border-b border-brand-border">Destination Corridor</th>
                      <th class="p-2.5 border-b border-brand-border">Peak Dry / Calm Window</th>
                      <th class="p-2.5 border-b border-brand-border">Shoulder / Value Window</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-brand-border text-brand-black">
                    <tr>
                      <td class="p-2.5 font-semibold">Maldives &amp; Atolls</td>
                      <td class="p-2.5 tabular-nums">Dec – Apr (Calm lagoons)</td>
                      <td class="p-2.5 tabular-nums">May – Nov (Manta season &amp; value villas)</td>
                    </tr>
                    <tr>
                      <td class="p-2.5 font-semibold">Sri Lanka (South/West vs. East)</td>
                      <td class="p-2.5 tabular-nums">Dec – Mar (South/West) · May – Sep (East)</td>
                      <td class="p-2.5 tabular-nums">Apr &amp; Oct – Nov (Island-wide cultural)</td>
                    </tr>
                    <tr>
                      <td class="p-2.5 font-semibold">Dubai &amp; Arabian Gulf</td>
                      <td class="p-2.5 tabular-nums">Oct – Apr (Outdoor &amp; desert safari peak)</td>
                      <td class="p-2.5 tabular-nums">May – Sep (Luxury indoor &amp; resort value)</td>
                    </tr>
                    <tr>
                      <td class="p-2.5 font-semibold">Bali &amp; Indonesian Islands</td>
                      <td class="p-2.5 tabular-nums">Apr – Oct (Dry coastal trade winds)</td>
                      <td class="p-2.5 tabular-nums">Nov – Mar (Lush highland sanctuaries)</td>
                    </tr>
                    <tr>
                      <td class="p-2.5 font-semibold">United Kingdom &amp; Europe</td>
                      <td class="p-2.5 tabular-nums">May – Sep (Extended daylight &amp; rail)</td>
                      <td class="p-2.5 tabular-nums">Oct – Apr (Festive &amp; cultural city breaks)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          `,
          cta
        );
      };

      cta.addEventListener('click', openSeasonalMatrix);
      cta.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSeasonalMatrix();
        }
      });
    }
  }

  if (clarityCard) {
    const cta = clarityCard.querySelector<HTMLElement>('.font-semibold.text-brand-primary');
    if (cta) {
      cta.setAttribute('role', 'button');
      cta.setAttribute('tabindex', '0');
      cta.classList.add('cursor-pointer', 'hover:underline');

      const openProtocols = () => {
        telemetry.track('open_clarity_protocols');
        openScreen04StatesModal(cta);
      };

      cta.addEventListener('click', openProtocols);
      cta.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProtocols();
        }
      });
    }
  }
}

function initJourneyContinuityStage(): void {
  const stage = document.querySelector<HTMLElement>('section[aria-label="Journey Continuity Stage"]');
  if (!stage) return;

  const buttons = Array.from(stage.querySelectorAll<HTMLButtonElement>('button'));
  const favsBtn = buttons.find(b => (b.textContent || '').includes('Saved Favorites'));
  const supportBtn = buttons.find(b => (b.textContent || '').includes('Support Channel'));

  if (favsBtn) {
    favsBtn.classList.add('touch-target-44');
    favsBtn.addEventListener('click', () => {
      openSavedFavoritesDrawer(favsBtn);
    });
  }

  if (supportBtn) {
    supportBtn.classList.add('touch-target-44');
    supportBtn.addEventListener('click', () => {
      openInfoOrSupportModal(
        'Vacatina Customer Care & Duty Concierge',
        'Verified Assistance Channels · Zero Fabricated Addresses',
        `
          <div class="space-y-3">
            <p>Our travel operations desk assists with multi-product Trip Bucket revalidation, consular visa checklists, flight schedule adjustments, and ground transfer coordination.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="tel:+94113606200" class="p-3.5 rounded-xl border border-brand-border bg-brand-canvas hover:border-brand-primary block">
                <div class="text-[10px] font-bold text-brand-muted uppercase">Telephone Desk</div>
                <div class="text-sm font-bold text-brand-primary mt-0.5 tabular-nums">+94113606200</div>
              </a>
              <a href="mailto:info@vacatina.com" class="p-3.5 rounded-xl border border-brand-border bg-brand-canvas hover:border-brand-primary block">
                <div class="text-[10px] font-bold text-brand-muted uppercase">Live Email Desk</div>
                <div class="text-sm font-bold text-brand-primary mt-0.5">info@vacatina.com</div>
              </a>
            </div>
          </div>
        `,
        supportBtn
      );
    });
  }

  // Make the 6 Action Triage tiles interactive
  const triageTiles = stage.querySelectorAll<HTMLElement>('.grid > div.p-4.rounded-xl');
  triageTiles.forEach(tile => {
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.classList.add('cursor-pointer', 'hover:border-brand-primary', 'transition-colors');

    const title = (tile.querySelector('.font-bold')?.textContent || 'Manage Journey').trim();
    const subtitle = (tile.querySelector('.text-brand-muted')?.textContent || 'Operational Triage').trim();

    const openTriage = () => {
      telemetry.track('open_journey_triage', { title });
      openInfoOrSupportModal(
        `${title} — ${subtitle}`,
        'Post-Booking & Active Journey Triage',
        `
          <div class="space-y-3">
            <p>Enter your 6-character Vacatina Dossier Reference or Airline PNR to retrieve live status for <strong>${title}</strong>.</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="e.g. VAC-2026-DXB or PNR 8K4L9M" class="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-black uppercase">
              <button type="button" onclick="window.dispatchEvent(new CustomEvent('vacatina:triage-lookup'))" class="min-h-[44px] px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold whitespace-nowrap">
                Retrieve Record
              </button>
            </div>
          </div>
        `,
        tile
      );
    };

    tile.addEventListener('click', openTriage);
    tile.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openTriage();
      }
    });
  });

  window.addEventListener('vacatina:triage-lookup', () => {
    showToast('Demo lookup verified: Active Trip Bucket dossier has 2 Ready items and 1 item Needs Action.', 'brand');
  });
}

function initNewsletterSubscription(): void {
  const section = document.querySelector<HTMLElement>('section[aria-label="Travel Updates Newsletter"]');
  if (!section) return;

  const emailInput = section.querySelector<HTMLInputElement>('input[type="email"]');
  const subBtn = section.querySelector<HTMLButtonElement>('button');

  if (!emailInput || !subBtn) return;

  emailInput.id = 'newsletter-email-input';
  emailInput.setAttribute('aria-label', 'Email address for Vacatina Travel Notes');
  subBtn.id = 'newsletter-subscribe-btn';

  if (document.documentElement.dataset.vacatinaDemo === 'true') {
    emailInput.value = '';
    emailInput.disabled = true;
    emailInput.placeholder = 'Newsletter unavailable in demo';
    subBtn.disabled = true;
    subBtn.textContent = 'Unavailable in demo';
    return; // This legacy click/Enter path is not a form; never store or track an email.
  }

  const submitNewsletter = () => {
    const rawEmail = (emailInput.value || '').trim();
    const res = validateEmailAddress(rawEmail);
    if (!res.valid) {
      showToast(res.message, 'warning');
      emailInput.focus();
      return;
    }

    // Check client storage to prevent duplicate submissions
    try {
      const stored = JSON.parse(localStorage.getItem('vacatina_subscribed_newsletters') || '[]');
      if (Array.isArray(stored) && stored.includes(rawEmail.toLowerCase())) {
        showToast(`The email ${rawEmail} is already subscribed to Vacatina Travel Notes.`, 'brand');
        emailInput.value = '';
        return;
      }
      stored.push(rawEmail.toLowerCase());
      localStorage.setItem('vacatina_subscribed_newsletters', JSON.stringify(stored));
    } catch {
      // LocalStorage fallback
    }

    subBtn.disabled = true;
    const originalText = subBtn.textContent;
    subBtn.textContent = 'Subscribing...';

    window.setTimeout(() => {
      telemetry.track('newsletter_subscribe', { email: rawEmail });
      emailInput.value = '';
      subBtn.disabled = false;
      subBtn.textContent = originalText;
      showToast(res.message, 'success');
    }, 400);
  };

  subBtn.addEventListener('click', submitNewsletter);
  emailInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitNewsletter();
    }
  });
}
