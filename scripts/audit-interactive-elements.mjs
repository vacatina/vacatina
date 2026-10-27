/* ============================================================================
 * Vacatina Programmatic Interactive Element Audit Tool
 * Authority: VACATINA MASTER INSTRUCTION — PART 2 & PART 35 (STEP 2)
 *
 * Inspects all clickable elements (<a>, <button>, select, etc.) in index.html.
 * Evaluates:
 * - Current Behaviour
 * - Required Behaviour
 * - Route / Action
 * - Status: PASS | FIX | REMOVE | DISABLE_UNTIL_BACKEND
 * ============================================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT_DIR, 'index.html');

/**
 * @typedef {Object} ElementAuditItem
 * @property {string} tag
 * @property {string} [id]
 * @property {string} [classes]
 * @property {string} text
 * @property {string} [href]
 * @property {string} [type]
 * @property {string} currentBehaviour
 * @property {string} requiredBehaviour
 * @property {string} routeOrAction
 * @property {'PASS' | 'FIX' | 'REMOVE' | 'DISABLE_UNTIL_BACKEND'} status
 * @property {string} [note]
 */

export function auditInteractiveElements() {
  const html = fs.readFileSync(HTML_FILE, 'utf-8');
  const items = [];

  // 1. Audit Anchors (<a>)
  const anchorRegex = /<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match = null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawAttrs = match[1];
    const innerHtml = match[2];
    const text = innerHtml.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');

    const hrefMatch = rawAttrs.match(/href=["'](.*?)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';

    const idMatch = rawAttrs.match(/id=["'](.*?)["']/i);
    const id = idMatch ? idMatch[1] : undefined;

    const classMatch = rawAttrs.match(/class=["'](.*?)["']/i);
    const classes = classMatch ? classMatch[1] : undefined;

    const isLegalModal = /data-legal-modal/i.test(rawAttrs);

    let status = 'PASS';
    let currentBehaviour = 'Navigation';
    let requiredBehaviour = 'Valid page route or modal trigger';
    let routeOrAction = href;
    let note = '';

    if (!href || href === '' || href === '#') {
      if (isLegalModal) {
        status = 'FIX';
        currentBehaviour = 'Opens legal modal with dead href="#"';
        requiredBehaviour = 'Canonical legal route (/legal/...) with modal enhancement';
        note = 'Must replace href="#" with canonical route';
      } else {
        status = 'FIX';
        currentBehaviour = 'Dead-end anchor (# or empty)';
        requiredBehaviour = 'Valid route or proper button control';
        note = 'Dead-end clickable element violating Rule 1';
      }
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      currentBehaviour = 'External link';
      requiredBehaviour = 'Verified external destination';
      status = 'PASS';
    } else if (href.startsWith('tel:') || href.startsWith('mailto:')) {
      currentBehaviour = 'Communication protocol';
      requiredBehaviour = 'Direct telephony / mail handler';
      status = 'PASS';
    } else if (href.startsWith('/')) {
      currentBehaviour = 'Internal SPA Route';
      requiredBehaviour = 'Dispatched by CanonicalRouterService';
      status = 'PASS';
    } else if (href.startsWith('#main-content') || href.startsWith('#site-header')) {
      currentBehaviour = 'Accessibility skip link';
      requiredBehaviour = 'Focus relocation within page';
      status = 'PASS';
    } else {
      status = 'FIX';
      note = `Unrecognized href format: ${href}`;
    }

    items.push({
      tag: 'a',
      id,
      classes,
      text: text || '[Icon/Empty Text]',
      href,
      currentBehaviour,
      requiredBehaviour,
      routeOrAction,
      status,
      note
    });
  }

  // 2. Audit Buttons (<button>)
  const buttonRegex = /<button\s+([^>]*?)>([\s\S]*?)<\/button>/gi;
  while ((match = buttonRegex.exec(html)) !== null) {
    const rawAttrs = match[1];
    const innerHtml = match[2];
    const text = innerHtml.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');

    const idMatch = rawAttrs.match(/id=["'](.*?)["']/i);
    const id = idMatch ? idMatch[1] : undefined;

    const classMatch = rawAttrs.match(/class=["'](.*?)["']/i);
    const classes = classMatch ? classMatch[1] : undefined;

    const typeMatch = rawAttrs.match(/type=["'](.*?)["']/i);
    const type = typeMatch ? typeMatch[1] : 'submit';

    let currentBehaviour = 'Interactive Button';
    let requiredBehaviour = 'Action / Drawer / Popover / Tab switch';
    let routeOrAction = id || 'button-action';
    let status = 'PASS';
    let note = '';

    if (id && id.startsWith('tab-')) {
      currentBehaviour = 'SCC Tab Switcher';
      requiredBehaviour = 'Activates SCC panel & pre-fills state';
      routeOrAction = `activateTab(${id.replace('tab-', '')})`;
      status = 'PASS';
    } else if (classes && classes.includes('favorite-toggle-btn')) {
      currentBehaviour = 'Favorite Toggle Action';
      requiredBehaviour = 'Toggles item in favorites service';
      routeOrAction = 'favoritesService.toggleFavorite()';
      status = 'PASS';
    } else if (id && (id.includes('drawer') || id.includes('trip-bucket'))) {
      currentBehaviour = 'Trip Bucket Drawer Toggle';
      requiredBehaviour = 'Opens/closes Trip Bucket slide-over';
      routeOrAction = 'toggleTripBucketDrawer()';
      status = 'PASS';
    } else if (id && id.includes('locale')) {
      currentBehaviour = 'Language & Currency Popover';
      requiredBehaviour = 'Opens locale/currency switcher';
      routeOrAction = 'toggleLocalePopover()';
      status = 'PASS';
    } else if (rawAttrs.includes('data-dialog-close')) {
      currentBehaviour = 'Dialog Dismiss Button';
      requiredBehaviour = 'Closes active accessible dialog with focus restore';
      routeOrAction = 'closeActiveDialog()';
      status = 'PASS';
    }

    items.push({
      tag: 'button',
      id,
      classes,
      text: text || '[Icon Button]',
      type,
      currentBehaviour,
      requiredBehaviour,
      routeOrAction,
      status,
      note
    });
  }

  const passCount = items.filter(i => i.status === 'PASS').length;
  const fixCount = items.filter(i => i.status === 'FIX').length;
  const disableCount = items.filter(i => i.status === 'DISABLE_UNTIL_BACKEND').length;
  const removeCount = items.filter(i => i.status === 'REMOVE').length;

  return { items, passCount, fixCount, disableCount, removeCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = auditInteractiveElements();
  console.log(`[Interactive Element Audit] Audited ${result.items.length} total interactive elements.`);
  console.log(`- PASS: ${result.passCount}`);
  console.log(`- FIX: ${result.fixCount}`);
  console.log(`- DISABLE_UNTIL_BACKEND: ${result.disableCount}`);
  console.log(`- REMOVE: ${result.removeCount}`);

  if (result.fixCount > 0) {
    console.log('\n--- ELEMENTS REQUIRING FIX ---');
    result.items.filter(i => i.status === 'FIX').forEach((item, idx) => {
      console.log(`[${idx + 1}] <${item.tag}> "${item.text}" (href="${item.href || ''}", id="${item.id || ''}"): ${item.note}`);
    });
  }

  const reportPath = path.join(ROOT_DIR, 'docs', 'INTERACTIVE_ELEMENTS_AUDIT.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[Interactive Element Audit] Report saved to ${reportPath}`);
}
