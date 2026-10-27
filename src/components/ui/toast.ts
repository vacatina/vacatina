/* ============================================================================
 * Vacatina Accessible UI Utilities: Focus Trap, Inert Shell, and Live Toast
 * Enforces WCAG 2.2 AA modal focus management and polite status announcements.
 * ============================================================================ */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)
  );
}

const activeTraps = new WeakMap<HTMLElement, (event: KeyboardEvent) => void>();

export function activateFocusTrap(modal: HTMLElement | null): void {
  if (!modal || activeTraps.has(modal)) return;

  const handler = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = getFocusableElements(modal);
    if (!focusables.length) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !active || !modal.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !active || !modal.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  modal.addEventListener('keydown', handler);
  activeTraps.set(modal, handler);
}

export function deactivateFocusTrap(modal: HTMLElement | null): void {
  if (!modal) return;
  const handler = activeTraps.get(modal);
  if (handler) {
    modal.removeEventListener('keydown', handler);
    activeTraps.delete(modal);
  }
}

export function setBackgroundInert(isInert: boolean, modalToExclude?: HTMLElement | null): void {
  const targets = [
    document.getElementById('site-header'),
    document.getElementById('main-content'),
    document.getElementById('flights-view-mount'),
    document.getElementById('hotels-view-mount'),
    document.getElementById('visa-view-mount'),
    document.getElementById('journey-view-mount'),
    document.getElementById('floating-trip-dock'),
    document.getElementById('mobile-summary-bar'),
    document.querySelector('footer')
  ].filter(Boolean) as HTMLElement[];

  targets.forEach(el => {
    (el as HTMLElement & { inert?: boolean }).inert = isInert;
    if (isInert) {
      el.setAttribute('inert', '');
    } else {
      el.removeAttribute('inert');
    }
  });

  // Hide floating dock & mobile summary bar while any overlay is open
  [
    document.getElementById('floating-trip-dock'),
    document.getElementById('mobile-summary-bar')
  ].forEach(bar => {
    if (!bar) return;
    if (isInert) {
      bar.classList.add('pointer-events-none', 'opacity-0');
    } else {
      bar.classList.remove('pointer-events-none', 'opacity-0');
    }
  });

  document.body.style.overflow = isInert ? 'hidden' : '';
}

let toastTimeoutId: number | null = null;

export function hideToast(): void {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('vacatina-live-toast');
  if (container) {
    container.classList.remove('opacity-100', 'translate-y-0');
    container.classList.add('opacity-0', 'translate-y-2');
    container.innerHTML = '';
  }
  if (toastTimeoutId !== null) {
    window.clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
}

export function showToast(
  message: string,
  tone: 'brand' | 'success' | 'warning' | 'error' = 'brand',
  actionLabel?: string,
  onAction?: () => void
): void {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('vacatina-live-toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'vacatina-live-toast';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.className =
      'fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] pointer-events-none transition-all duration-200 opacity-0 translate-y-2';
    document.body.appendChild(container);
  }

  const toneBorder =
    tone === 'success'
      ? 'border-l-4 border-l-[#15803D]'
      : tone === 'warning'
        ? 'border-l-4 border-l-[#B45309]'
        : tone === 'error'
          ? 'border-l-4 border-l-[#B91C1C]'
          : 'border-l-4 border-l-[#1B1464]';

  container.innerHTML = `
    <div class="pointer-events-auto bg-white border border-brand-border ${toneBorder} rounded-xl shadow-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
      <span class="font-medium text-brand-black leading-snug">${message}</span>
      ${
        actionLabel
          ? `<button type="button" id="toast-action-btn" class="px-3 py-1.5 rounded-lg bg-brand-primary text-white font-semibold whitespace-nowrap hover:opacity-90">${actionLabel}</button>`
          : ''
      }
    </div>
  `;

  container.classList.remove('opacity-0', 'translate-y-2');
  container.classList.add('opacity-100', 'translate-y-0');

  if (actionLabel && onAction) {
    const btn = container.querySelector('#toast-action-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        onAction();
        container?.classList.add('opacity-0', 'translate-y-2');
      });
    }
  }

  if (toastTimeoutId !== null) {
    window.clearTimeout(toastTimeoutId);
  }
  toastTimeoutId = window.setTimeout(() => {
    container?.classList.remove('opacity-100', 'translate-y-0');
    container?.classList.add('opacity-0', 'translate-y-2');
  }, 4200);
}
