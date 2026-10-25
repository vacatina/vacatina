/* ============================================================================
 * Vacatina Canonical Production Build Pipeline (scripts/build.mjs)
 * Authorities:
 * 1. 06_ANTIGRAVITY_MASTER_INSTRUCTION.md
 * 2. Vacatina_DESIGN_v4_ANTIGRAVITY_HANDOFF.md (Primary: #1B1464, Fonts: Plus Jakarta Sans / Inter)
 * 3. Official Logo Pack v2 & Web-Optimized Derivatives
 *
 * Pipeline:
 * - Compiles deterministic local Tailwind CSS bundle (dist/styles/tailwind.css)
 * - Transpiles all TypeScript modules into dist/ ES modules & single IIFE bundle
 * - Generates index.html without runtime CDN scripts, without synthetic polygon fallbacks,
 *   with full Open Graph/Twitter Card/SEO metadata, favicons, manifest, verified social links,
 *   and interactive legal/cookie dialogs.
 * - Outputs standalone single-file preview to Downloads/Vacatina_Preview_v4.html.
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as nodeModule from 'node:module';
import { fileURLToPath } from 'node:url';
import { applyCardImageReplacements } from './apply-card-images.mjs';
import { applyCanonicalArchitecture } from './apply-canonical-architecture.mjs';

const stripTypeScriptTypes = nodeModule.stripTypeScriptTypes || ((code) => code);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BRAND_DIR = path.join(ROOT_DIR, 'public', 'brand');
const WEB_BRAND_DIR = path.join(BRAND_DIR, 'web');
const CARDS_DIR = path.join(ROOT_DIR, 'public', 'cards');

const BUNDLE_ORDER = [
  'lib/constants/social.ts',
  'lib/constants/routes.ts',
  'lib/domain/types.ts',
  'lib/domain/inventory-models.ts',
  'lib/validation/travellers.ts',
  'lib/mock-data/catalog.ts',
  'lib/services/pricing-engine.service.ts',
  'lib/services/inventory-normalizer.service.ts',
  'lib/services/manual-inventory.service.ts',
  'lib/mock-data/hybrid-catalog.ts',
  'lib/services/search-aggregator.service.ts',
  'lib/services/booking-orchestrator.service.ts',
  'lib/adapters/supplier-adapters.ts',
  'lib/analytics/telemetry.ts',
  'lib/services/trip-bucket.service.ts',
  'lib/services/favorites.service.ts',
  'lib/services/search.service.ts',
  'lib/services/locale.service.ts',
  'features/flights/index.ts',
  'features/hotels/index.ts',
  'features/visa/index.ts',
  'features/packages/index.ts',
  'features/cars-transfers/index.ts',
  'features/rails/index.ts',
  'features/cruises/index.ts',
  'features/activities/index.ts',
  'features/sightseeing/index.ts',
  'features/insurance/index.ts',
  'features/bundle/index.ts',
  'components/brand/logo-assets.ts',
  'components/brand/vacatina-logo.ts',
  'components/ui/toast.ts',
  'components/dialogs/legal-cookie-modal.ts',
  'components/dialogs/dialogs-controller.ts',
  'components/trip-bucket/trip-bucket-ui.ts',
  'lib/services/router.service.ts',
  'components/shell/header-nav.ts',
  'components/search-command-center/command-center.ts',
  'components/discovery/discovery-controller.ts',
  'components/trust/macro-stages.ts',
  'app/main.ts'
];

function walkTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripImportsAndExportsForBundle(jsCode) {
  return jsCode
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+(async\s+function|function|const|let|var|class)\b/gm, '$1')
    .replace(/^\s*export\s+\{[\s\S]*?\};?\s*$/gm, '');
}

export function buildProject() {
  const startMs = Date.now();
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // 1. Compile Tailwind CSS locally and append canonical tokens.css
  const tailwindOut = path.join(DIST_DIR, 'styles', 'tailwind.css');
  fs.mkdirSync(path.dirname(tailwindOut), { recursive: true });

  const tailwindCli = path.join(ROOT_DIR, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
  if (!fs.existsSync(tailwindCli)) {
    throw new Error(`[Vacatina Build] Tailwind CLI not found at ${tailwindCli}. Run npm install first.`);
  }

  const twResult = spawnSync(
    process.execPath,
    [tailwindCli, '-i', 'src/styles/input.css', '-o', tailwindOut, '--minify'],
    { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (twResult.status !== 0) {
    const errorMsg = (twResult.stderr || twResult.stdout || 'Unknown error').trim();
    throw new Error(`[Vacatina Build] Production Tailwind CSS compilation failed (exit code ${twResult.status}): ${errorMsg}`);
  }

  if (!fs.existsSync(tailwindOut) || fs.statSync(tailwindOut).size === 0) {
    throw new Error(`[Vacatina Build] Tailwind output file is missing or empty at ${tailwindOut}`);
  }

  console.log(`[Vacatina Build] Compiled production Tailwind CSS -> dist/styles/tailwind.css (${fs.statSync(tailwindOut).size} bytes)`);
  const compiledTailwind = fs.readFileSync(tailwindOut, 'utf8');
  const tokensCss = fs.readFileSync(path.join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
  const compiledCss = compiledTailwind + '\n\n/* --- Vacatina DESIGN v4 Authoritative Tokens & Breakpoints --- */\n' + tokensCss;
  fs.writeFileSync(tailwindOut, compiledCss, 'utf8');

  // 2. Transpile all TypeScript modules
  const tsFiles = walkTsFiles(SRC_DIR);
  for (const tsFile of tsFiles) {
    const relPath = path.relative(SRC_DIR, tsFile);
    const outPath = path.join(DIST_DIR, relPath.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const rawTs = fs.readFileSync(tsFile, 'utf8');
    let jsCode = stripTypeScriptTypes(rawTs, { mode: 'strip' });
    jsCode = jsCode.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
    fs.writeFileSync(outPath, jsCode, 'utf8');
  }

  // 3. Assemble self-contained IIFE bundle (dist/vacatina.bundle.js)
  const bundleChunks = ['(function () {\n"use strict";\n'];
  for (const rel of BUNDLE_ORDER) {
    const full = path.join(SRC_DIR, rel);
    const rawTs = fs.readFileSync(full, 'utf8');
    const stripped = stripTypeScriptTypes(rawTs, { mode: 'strip' });
    const cleaned = stripImportsAndExportsForBundle(stripped);
    bundleChunks.push(`\n/* --- Module: ${rel} --- */\n` + cleaned + '\n');
  }
  bundleChunks.push('\n})();\n');
  const bundleJs = bundleChunks.join('');
  fs.writeFileSync(path.join(DIST_DIR, 'vacatina.bundle.js'), bundleJs, 'utf8');

  // 4. Brand assets for clean HTML insertion & standalone portable bundle
  const oneColorSpaceCadetBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(WEB_BRAND_DIR, 'Vacatina_Logo_OneColor_SpaceCadet.web.png')).toString('base64');
  const reverseFullBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(WEB_BRAND_DIR, 'Vacatina_Logo_Reverse_SpaceCadet.web.png')).toString('base64');
  const primaryFullBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(WEB_BRAND_DIR, 'Vacatina_Logo_Primary_FullColor.web.png')).toString('base64');
  const markSpaceCadetBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(WEB_BRAND_DIR, 'Vacatina_Mark_SpaceCadet.web.png')).toString('base64');
  const favicon32Base64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT_DIR, 'public', 'icons', 'icon-32.png')).toString('base64');
  const favicon16Base64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT_DIR, 'public', 'icons', 'icon-16.png')).toString('base64');
  const appleIconBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT_DIR, 'public', 'icons', 'apple-touch-icon.png')).toString('base64');
  const shareImageBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT_DIR, 'public', 'og', 'vacatina-share-1200x630.png')).toString('base64');

  // 5. Assemble HTML from Screen 08 skeleton
  const screen08Path = path.join(
    ROOT_DIR,
    'stitch_vacatina_master_ui_foundation',
    '08_vacatina_complete_homepage_layer_1_structural_skeleton_review',
    'code.html'
  );

  const rawScreen08 = fs.readFileSync(screen08Path, 'utf8');
  const lines = rawScreen08.split(/\r?\n/);
  const domEndIdx = lines.findIndex((l, i) => i >= 1280 && l.trim().startsWith('<script>'));
  const cleanDomLines = domEndIdx > 0 ? lines.slice(0, domEndIdx) : lines.slice(0, 1288);

  let assembledHtml = cleanDomLines.join('\n');

  // Clean out runtime CDN Tailwind script & inlined tailwind.config
  assembledHtml = assembledHtml
    .replace('<script src="https://cdn.tailwindcss.com"></script>', '')
    .replace(/<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>/, '');

  // Complete Head metadata (SEO, OG, Twitter, Canonical, Icons, Manifest, Local CSS)
  const completeHeadMetadata = `<title>Vacatina — Unified Travel Operating System | Flights, Stays &amp; Visas</title>
<meta name="description" content="Discover, compare, configure, and manage flights, stays, visa assistance, holiday packages, and ground transfers in one unified, calm travel operating system.">
<link rel="canonical" href="https://vacatina.com/">
<meta name="robots" content="index, follow">

<!-- Open Graph / Facebook -->
<meta property="og:site_name" content="Vacatina">
<meta property="og:type" content="website">
<meta property="og:title" content="Vacatina — We Treasure Your Holidays">
<meta property="og:description" content="Discover, compare, plan, combine, and manage your complete journey from one place — flights, stays, visas, packages, and transfers.">
<meta property="og:url" content="https://vacatina.com/">
<meta property="og:image" content="https://vacatina.com/assets/social/vacatina-og-home-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Vacatina — We Treasure Your Holidays">
<meta name="twitter:description" content="Unified travel operating system for flights, stays, visas, packages, and transfers.">
<meta name="twitter:image" content="https://vacatina.com/assets/social/vacatina-og-home-1200x630.png">

<!-- Organization Structured Data (JSON-LD) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Vacatina",
  "url": "https://vacatina.com/",
  "logo": "https://vacatina.com/assets/brand/Vacatina_Logo_Primary_FullColor.png",
  "sameAs": [
    "https://www.facebook.com/vacatinaglobal",
    "https://www.instagram.com/vacatinaglobal",
    "https://www.linkedin.com/company/vacatinaglobal"
  ]
}
</script>

<!-- App Identity Icons & PWA Manifest -->
<link rel="icon" type="image/png" sizes="32x32" href="./public/icons/icon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="./public/icons/icon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="./public/icons/apple-touch-icon.png">
<link rel="manifest" href="./public/manifest.webmanifest">
<meta name="theme-color" content="#1B1464">

<!-- Production Compiled CSS (Local Tailwind + DESIGN v4 Tokens) -->
<link rel="stylesheet" href="./dist/styles/tailwind.css">`;

  assembledHtml = assembledHtml.replace(
    '<title>Screen 08 Homepage Structural Skeleton v1.0 — REVIEW</title>',
    completeHeadMetadata
  );

  // Responsive Header Container width & padding (Zero 360px overflow: px-2.5 on narrow mobile, gap-1.5 sm:gap-3 on utilities)
  assembledHtml = assembledHtml.replace(
    'class="sticky top-0 z-40 h-[76px] bg-white border-b border-brand-border px-4 sm:px-6 xl:px-12 flex items-center justify-between" aria-label="Global Navigation Header" id="site-header"><div class="max-w-[1360px] w-full mx-auto flex items-center justify-between gap-4">',
    'class="sticky top-0 z-40 h-[76px] bg-white border-b border-brand-border px-2.5 sm:px-6 xl:px-4 2xl:px-8 flex items-center justify-between" aria-label="Global Navigation Header" id="site-header"><div class="max-w-[1400px] w-full mx-auto flex items-center justify-between gap-1.5 sm:gap-2.5 2xl:gap-4">'
  ).replace(
    'class="flex items-center gap-3 flex-shrink-0">',
    'class="flex items-center gap-1.5 xl:gap-2 2xl:gap-3 flex-shrink-0">'
  );

  // Canonical Header Logo: Official Mark (<1440px) + Full Logo with Tagline (>=1440px) — ZERO FLASH OF FAKE LOGO
  // LOCKED: Desktop Navigation Header uses Vacatina_Logo_OneColor_SpaceCadet (#1B1464, RGB 27, 20, 100), width ~150px
  const fakeHeaderLogoPattern = /<a href="#" class="flex flex-col flex-shrink-0 group focus:outline-none" aria-label="Vacatina Homepage">[\s\S]*?<\/a>/;
  const canonicalHeaderLogoHtml = `<a href="/" class="flex items-center flex-shrink-0 group focus:outline-none" aria-label="Vacatina Homepage">
  <div class="vacatina-logo-mark-wrap flex items-center">
    <img src="./public/brand/web/Vacatina_Mark_SpaceCadet.web.png" alt="Vacatina" class="h-9 w-9 object-contain" width="36" height="36" loading="eager" decoding="async">
  </div>
  <div class="vacatina-logo-full-wrap items-center">
    <img src="./public/brand/web/Vacatina_Logo_OneColor_SpaceCadet.web.png" alt="Vacatina — we treasure your holidays" class="w-[150px] max-w-[155px] h-auto object-contain" width="150" height="34" loading="eager" decoding="async">
  </div>
</a>`;
  assembledHtml = assembledHtml.replace(fakeHeaderLogoPattern, canonicalHeaderLogoHtml);

  // Canonical Desktop Nav & 1440px breakpoint classes
  assembledHtml = assembledHtml
    .replace(
      'class="desktop-nav items-center gap-1 xl:gap-2 flex-shrink-0" aria-label="Primary Desktop Navigation"',
      'class="desktop-nav items-center gap-0.5 xl:gap-1 flex-shrink-0" aria-label="Primary Desktop Navigation"'
    )
    .replaceAll(
      'class="px-3 py-2 text-[14px]',
      'class="px-2 py-1.5 text-[13px]'
    )
    .replaceAll(
      'class="flex items-center gap-1 px-3 py-2 text-[14px]',
      'class="flex items-center gap-1 px-2 py-1.5 text-[13px]'
    )
    .replace(
      'id="mobile-nav-toggle" class="mobile-menu-btn p-2 text-brand-primary rounded-lg hover:bg-brand-subtle focus:outline-none"',
      'id="mobile-nav-toggle" class="mobile-menu-btn p-2 text-brand-primary rounded-lg hover:bg-brand-subtle focus:outline-none touch-target-44 min-w-[44px] min-h-[44px] flex items-center justify-center"'
    )
    .replace(
      '🌐 EN · USD',
      '<svg class="w-4 h-4 text-brand-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg><span id="current-locale-display" class="tabular-nums font-semibold">EN · LKR</span>'
    )
    .replace(
      'class="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-brand-black px-2.5 py-1.5 rounded-lg border border-brand-border bg-white hover:bg-brand-canvas" aria-label="Language &amp; Currency"',
      'class="hidden md:flex items-center gap-1 text-[12.5px] font-medium text-brand-black px-2 py-1.5 rounded-lg border border-brand-border bg-white hover:bg-brand-canvas" aria-label="Language &amp; Currency"'
    )
    .replace(
      'class="hidden sm:flex p-2 text-brand-muted hover:text-brand-primary rounded-lg hover:bg-brand-subtle" aria-label="Saved Favorites"',
      'class="hidden xl:flex p-2 text-brand-muted hover:text-brand-primary rounded-lg hover:bg-brand-subtle" aria-label="Saved Favorites"'
    )
    .replace(
      'id="header-trip-bucket-btn" class="flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-border bg-white hover:bg-brand-canvas focus:outline-none"',
      'id="header-trip-bucket-btn" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border bg-white hover:bg-brand-canvas focus:outline-none"'
    )
    .replace(
      'class="hidden sm:flex items-center gap-2 border-l border-brand-border pl-3"',
      'class="hidden min-[1440px]:flex items-center gap-1.5 border-l border-brand-border pl-2.5"'
    )
    .replace(
      'class="text-[13px] font-semibold text-brand-black hover:text-brand-primary px-2 py-1.5">Sign In</a><button type="button" class="bg-brand-primary text-white text-[13px] font-semibold px-3.5 py-2 rounded-lg hover:opacity-90">Sign Up</button>',
      'class="text-[12.5px] font-semibold text-brand-black hover:text-brand-primary px-1.5 py-1">Sign In</a><button type="button" class="bg-brand-primary text-white text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg hover:opacity-90">Sign Up</button>'
    );

  // Canonical Footer Logo Lockup: Official Reverse Space Cadet with mandatory tagline
  const fakeFooterLogoPattern = /<div class="flex items-center gap-2">\s*<svg class="w-5 h-5 text-white"[\s\S]*?<span class="font-heading font-extrabold text-lg text-white">vacatina<\/span>\s*<\/div>/;
  const canonicalFooterLogoHtml = `<div id="footer-brand-logo" class="flex items-center">
  <img src="./public/brand/web/Vacatina_Logo_Reverse_SpaceCadet.web.png" alt="Vacatina — we treasure your holidays" class="h-11 w-auto max-w-[240px] object-contain" height="44" loading="eager" decoding="async">
</div>`;
  assembledHtml = assembledHtml.replace(fakeFooterLogoPattern, canonicalFooterLogoHtml);

  // Verified Social Presence in Footer (LOCKED: Minimal outlined circular buttons, 44x44px, Facebook, Instagram, LinkedIn)
  const verifiedSocialHtml = `<div class="mt-4 pt-3 border-t border-white/10" id="footer-social-cluster" aria-label="Follow Vacatina">
  <div id="footer-follow-heading" class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Follow Vacatina</div>
  <div class="flex items-center gap-3.5">
    <a href="https://www.facebook.com/vacatinaglobal" target="_blank" rel="noopener noreferrer" class="footer-social-circle touch-target-44" aria-label="Vacatina on Facebook">
      <svg class="fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    </a>
    <a href="https://www.instagram.com/vacatinaglobal" target="_blank" rel="noopener noreferrer" class="footer-social-circle touch-target-44" aria-label="Vacatina on Instagram">
      <svg class="fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
    </a>
    <a href="https://www.linkedin.com/company/vacatinaglobal" target="_blank" rel="noopener noreferrer" class="footer-social-circle touch-target-44" aria-label="Vacatina on LinkedIn">
      <svg class="fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
    </a>
  </div>
</div>`;
  assembledHtml = assembledHtml.replace(
    '<div><span class="text-white/50 block">Live Desk</span><a href="mailto:info@vacatina.com" class="hover:underline font-semibold">info@vacatina.com</a></div>\n        </div>',
    '<div><span class="text-white/50 block">Live Desk</span><a href="mailto:info@vacatina.com" class="hover:underline font-semibold">info@vacatina.com</a></div>\n        </div>\n' + verifiedSocialHtml
  );

  // Customer Truthfulness & Claim Sanitization (Item 7)
  assembledHtml = assembledHtml
    .replace('Unlimited mileage across certified highways', 'Unlimited mileage across national highways')
    .replace('Official consular fee schedules', 'Standard consular fee schedules')
    .replace('Official telephone support: +94113606200', 'Direct telephone support: +94113606200')
    .replace('Secure Checkout Protocol', 'Payment &amp; Checkout Framework');

  // Actionable Legal & Cookie Preferences Links in Footer Bar
  const legalLinksReplacement = `<div class="flex flex-wrap items-center gap-4">
        <a href="#" data-legal-modal="privacy" class="hover:text-white transition-colors">Privacy Policy</a>
        <a href="#" data-legal-modal="terms" class="hover:text-white transition-colors">Terms of Service</a>
        <a href="#" data-legal-modal="cookies" class="hover:text-white transition-colors">Cookie Preferences</a>
        <a href="#" data-legal-modal="accessibility" class="hover:text-white transition-colors">Accessibility Statement</a>
        <a href="#" data-legal-modal="security" class="hover:text-white transition-colors">Security &amp; Trust</a>
      </div>`;
  assembledHtml = assembledHtml.replace(
    /<div class="flex flex-wrap items-center gap-4">\s*<a href="#" class="hover:text-white">Privacy Policy<\/a>[\s\S]*?<\/div>/,
    legalLinksReplacement
  );

  // Mobile Drawer Header Logo: Official Mark
  const fakeDrawerLogoPattern = /<div class="flex items-center gap-2">\s*<svg class="w-5 h-5 text-brand-primary" fill="none"[\s\S]*?<span class="font-heading font-extrabold text-lg text-brand-primary">vacatina<\/span>\s*<\/div>/;
  const canonicalDrawerLogoHtml = `<div class="flex items-center">
  <img src="./public/brand/web/Vacatina_Mark_SpaceCadet.web.png" alt="Vacatina" class="h-9 w-9 object-contain" width="36" height="36" loading="eager" decoding="async">
</div>`;
  assembledHtml = assembledHtml.replace(fakeDrawerLogoPattern, canonicalDrawerLogoHtml);

  // Apply Verified Card Image Replacements (Zero Unrelated Duplicates; Destination + Product Type + Travel Intent)
  assembledHtml = applyCardImageReplacements(assembledHtml);

  // Apply Canonical Architecture & Zero Dead-Ends Routing (Click-to-Destination v1.0)
  assembledHtml = applyCanonicalArchitecture(assembledHtml);

  // Write index.html (lean static assets in public/brand/web/ + public/cards/ + local compiled Tailwind)
  const projectIndexHtml =
    assembledHtml +
    `\n  <!-- Vacatina Modular TypeScript Bundle (Works on both http://localhost:4173 and file://) -->\n  <script src="./dist/vacatina.bundle.js"></script>\n</body>\n</html>\n`;

  fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), projectIndexHtml, 'utf8');

  // Also write 100% self-contained standalone preview to Downloads/Vacatina_Preview_v4.html
  const standaloneHeadMetadata = completeHeadMetadata.replace(
    '<link rel="stylesheet" href="./dist/styles/tailwind.css">',
    `<style>\n${compiledCss}\n</style>`
  );

  let standaloneHtml = assembledHtml
    .replace(completeHeadMetadata, standaloneHeadMetadata)
    .replaceAll('./public/brand/web/Vacatina_Logo_OneColor_SpaceCadet.web.png', oneColorSpaceCadetBase64)
    .replaceAll('./public/brand/web/Vacatina_Logo_Reverse_SpaceCadet.web.png', reverseFullBase64)
    .replaceAll('./public/brand/web/Vacatina_Logo_Primary_FullColor.web.png', primaryFullBase64)
    .replaceAll('./public/brand/web/Vacatina_Mark_SpaceCadet.web.png', markSpaceCadetBase64)
    .replaceAll('./public/icons/icon-32.png', favicon32Base64)
    .replaceAll('./public/icons/icon-16.png', favicon16Base64)
    .replaceAll('./public/icons/apple-touch-icon.png', appleIconBase64);

  // Inline card images into standalone HTML so preview works 100% offline anywhere
  if (fs.existsSync(CARDS_DIR)) {
    const cardFiles = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    for (const cardFile of cardFiles) {
      const cardPath = path.join(CARDS_DIR, cardFile);
      const mime = cardFile.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const cardBase64 = `data:${mime};base64,` + fs.readFileSync(cardPath).toString('base64');
      standaloneHtml = standaloneHtml.replaceAll(`./public/cards/${cardFile}`, cardBase64);
    }
  }

  // Inline standalone bundle with inlined assets so standalone file works completely offline anywhere
  const standaloneBundleJs = bundleJs
    .replaceAll('./public/brand/web/Vacatina_Logo_OneColor_SpaceCadet.web.png', oneColorSpaceCadetBase64)
    .replaceAll('./public/brand/web/Vacatina_Logo_Reverse_SpaceCadet.web.png', reverseFullBase64)
    .replaceAll('./public/brand/web/Vacatina_Logo_Primary_FullColor.web.png', primaryFullBase64)
    .replaceAll('./public/brand/web/Vacatina_Mark_SpaceCadet.web.png', markSpaceCadetBase64)
    .replaceAll('./public/icons/icon-32.png', favicon32Base64);

  standaloneHtml = standaloneHtml + `\n  <script>\n${standaloneBundleJs}\n  </script>\n</body>\n</html>\n`;

  try {
    fs.writeFileSync('c:/Users/Madhusanka/Downloads/Vacatina_Preview_v4.html', standaloneHtml, 'utf8');
    console.log('[Vacatina Build] Exported standalone preview -> c:/Users/Madhusanka/Downloads/Vacatina_Preview_v4.html');

    // Also sync public/cards into Downloads/public/cards for relative path resilience
    const dlCardsDir = 'c:/Users/Madhusanka/Downloads/public/cards';
    fs.mkdirSync(dlCardsDir, { recursive: true });
    if (fs.existsSync(CARDS_DIR)) {
      for (const f of fs.readdirSync(CARDS_DIR)) {
        const fullPath = path.join(CARDS_DIR, f);
        if (fs.statSync(fullPath).isFile()) {
          fs.copyFileSync(fullPath, path.join(dlCardsDir, f));
        }
      }
    }
  } catch (e) {
    console.warn('[Vacatina Build] Downloads folder inaccessible, skipping direct export:', e.message);
  }

  // Copy Screen 04 standalone reference HTML
  const screen04Src = path.join(
    ROOT_DIR,
    'stitch_vacatina_master_ui_foundation',
    'screen_04_trip_bucket_component_states_v1.2_locked',
    'code.html'
  );
  if (fs.existsSync(screen04Src)) {
    fs.copyFileSync(screen04Src, path.join(ROOT_DIR, 'screen-04-states.html'));
  }

  // 7. Assemble Dedicated Website Output Folder (dist-site/) for Vercel & Production Serving
  // Preserves relative paths: index.html at root, with dist/ and public/ alongside it
  const SITE_DIR = path.join(ROOT_DIR, 'dist-site');
  fs.rmSync(SITE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SITE_DIR, { recursive: true });

  // Copy index.html and screen-04-states.html to site root
  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), projectIndexHtml, 'utf8');
  if (fs.existsSync(path.join(ROOT_DIR, 'screen-04-states.html'))) {
    fs.copyFileSync(
      path.join(ROOT_DIR, 'screen-04-states.html'),
      path.join(SITE_DIR, 'screen-04-states.html')
    );
    fs.mkdirSync(path.join(SITE_DIR, 'screen-04-states'), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT_DIR, 'screen-04-states.html'),
      path.join(SITE_DIR, 'screen-04-states', 'index.html')
    );
  }

  // Copy dist/ folder into dist-site/dist/
  fs.cpSync(DIST_DIR, path.join(SITE_DIR, 'dist'), { recursive: true });

  // Copy public/ folder into dist-site/public/
  const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
  if (fs.existsSync(PUBLIC_DIR)) {
    fs.cpSync(PUBLIC_DIR, path.join(SITE_DIR, 'public'), { recursive: true });
  }

  // Root favicon and icon fallbacks
  const icon32Path = path.join(PUBLIC_DIR, 'icons', 'icon-32.png');
  if (fs.existsSync(icon32Path)) {
    fs.copyFileSync(icon32Path, path.join(SITE_DIR, 'favicon.ico'));
    fs.copyFileSync(icon32Path, path.join(SITE_DIR, 'favicon.png'));
  }
  const manifestPath = path.join(PUBLIC_DIR, 'manifest.webmanifest');
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(SITE_DIR, 'manifest.webmanifest'));
  }

  console.log('[Vacatina Build] Assembled dedicated website output -> dist-site/ (index.html, dist/, public/)');

  // 8. Assemble Vercel Build Output API v3 (.vercel/output/static) for instant zero-config deployment
  const VERCEL_OUTPUT_DIR = path.join(ROOT_DIR, '.vercel', 'output');
  const VERCEL_STATIC_DIR = path.join(VERCEL_OUTPUT_DIR, 'static');
  fs.rmSync(VERCEL_OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(VERCEL_STATIC_DIR, { recursive: true });

  fs.cpSync(SITE_DIR, VERCEL_STATIC_DIR, { recursive: true });
  const vercelConfig = {
    version: 3,
    routes: [
      {
        src: '^/dist/(.*)$',
        headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        continue: true
      },
      {
        src: '^/public/(.*)$',
        headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' },
        continue: true
      },
      {
        src: '^/(.*)$',
        headers: {
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'SAMEORIGIN',
          'referrer-policy': 'strict-origin-when-cross-origin'
        },
        continue: true
      },
      {
        handle: 'filesystem'
      },
      {
        src: '^/screen-04-states(.*)$',
        dest: '/screen-04-states.html'
      },
      {
        src: '^/(.*)$',
        dest: '/'
      }
    ]
  };
  fs.writeFileSync(
    path.join(VERCEL_OUTPUT_DIR, 'config.json'),
    JSON.stringify(vercelConfig, null, 2),
    'utf8'
  );
  console.log('[Vacatina Build] Assembled Vercel Build Output API -> .vercel/output/static');

  const elapsed = Date.now() - startMs;
  console.log(`[Vacatina Build] Finished in ${elapsed}ms. Total modules: ${tsFiles.length}. Zero external CDN dependencies.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildProject();
}
