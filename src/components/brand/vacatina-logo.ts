/* ============================================================================
 * Vacatina Canonical Brand Logo System (v3 Web-Optimized)
 * Authorities:
 * - Vacatina Official Logo Pack v2 (AUTHORITATIVE BRAND ARTWORK)
 * - 00_START_HERE.md & 02_Vacatina_Antigravity_Correction_Pass_v2.md
 * - Never redraw, approximate, or recreate with generic SVG or synthetic polygons.
 * - Never remove the mandatory tagline "we treasure your holidays" from the full logo.
 * - Never create an unapproved no-tagline wordmark derivative.
 * - Main Desktop Navigation Header (>=1440px): Vacatina_Logo_OneColor_SpaceCadet (#1B1464, RGB 27, 20, 100).
 * - Constrained header viewports (<1440px) and mobile drawer: Official standalone mark (36px).
 * - Footer: Official Vacatina_Logo_Reverse_SpaceCadet with full tagline visible.
 * ============================================================================ */

import {
  FAVICON_32,
  LOGO_ONE_COLOR_SPACE_CADET,
  LOGO_PRIMARY_FULL_COLOR,
  LOGO_REVERSE_SPACE_CADET,
  MARK_BLACK,
  MARK_FRENCH_BLUE,
  MARK_SPACE_CADET
} from './logo-assets.ts';

export interface VacatinaLogoOptions {
  surface?: 'light' | 'dark';
  className?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Official Standalone Vacatina Mark (Aircraft Ascent & Contrail Emblem)
 * Canonical compact digital mark for constrained viewports (<1440px), mobile header, drawer, and app icon.
 */
export function VacatinaMark(options: VacatinaLogoOptions = {}): string {
  const surface = options.surface || 'light';
  const customClass = options.className || 'h-9 w-9 object-contain';
  const altText = options.alt || 'Vacatina Brand Mark';
  const src = surface === 'dark' ? MARK_SPACE_CADET : MARK_SPACE_CADET;

  return `<img src="${src}" alt="${altText}" class="${customClass}" width="36" height="36" loading="eager" decoding="async">`;
}

/**
 * Official Full Vacatina Logo Lockup (Emblem + Wordmark + Mandatory Tagline "we treasure your holidays")
 * - Wide Desktop Header (>=1440px): Vacatina_Logo_OneColor_SpaceCadet (#1B1464) on white surface.
 * - Footer: Vacatina_Logo_Reverse_SpaceCadet on Space Cadet navy solid surface.
 * Retains the mandatory tagline at all times.
 */
export function VacatinaLogoFull(options: VacatinaLogoOptions = {}): string {
  const surface = options.surface || 'light';
  const defaultClass = surface === 'dark'
    ? 'h-11 w-auto max-w-[240px] object-contain'
    : 'w-[150px] max-w-[155px] h-auto object-contain';
  const customClass = options.className || defaultClass;
  const altText = options.alt || 'Vacatina — we treasure your holidays';
  // LOCKED: Desktop white header uses OneColor Space Cadet (#1B1464). Footer uses Reverse Space Cadet.
  const src = surface === 'dark' ? LOGO_REVERSE_SPACE_CADET : LOGO_ONE_COLOR_SPACE_CADET;

  return `<img src="${src}" alt="${altText}" class="${customClass}" loading="eager" decoding="async">`;
}

/**
 * Responsive Header Brand Component:
 * - 360px–1439px: Official standalone mark (36x36px) — zero crowding in dense header.
 * - 1440px+: Official full logo lockup (Vacatina_Logo_OneColor_SpaceCadet) with mandatory tagline.
 */
export function VacatinaLogoResponsive(options: VacatinaLogoOptions = {}): string {
  const surface = options.surface || 'light';
  return `
    <div class="vacatina-logo-mark-wrap flex items-center">
      ${VacatinaMark({ surface, className: 'h-9 w-9 object-contain', alt: 'Vacatina' })}
    </div>
    <div class="vacatina-logo-full-wrap items-center">
      ${VacatinaLogoFull({ surface, className: surface === 'dark' ? 'h-11 w-auto object-contain' : 'w-[150px] max-w-[155px] h-auto object-contain', alt: 'Vacatina — we treasure your holidays' })}
    </div>
  `;
}

/**
 * Crisp SVG Globe Icon for Global Header Locale & Currency Selector (§33: Never use emoji 🌐).
 */
export function renderSvgGlobeIcon(className = 'w-4 h-4 text-brand-muted shrink-0'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
}
