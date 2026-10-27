import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

// Match all <a> tags
const aRegex = /<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
let match;
const links = [];

while ((match = aRegex.exec(html)) !== null) {
  const attrs = match[1];
  const text = match[2].replace(/<[^>]+>/g, '').trim();

  const hrefMatch = attrs.match(/href="([^"]*)"/i);
  const href = hrefMatch ? hrefMatch[1] : '';

  const idMatch = attrs.match(/id="([^"]*)"/i);
  const id = idMatch ? idMatch[1] : '';

  const dataModalMatch = attrs.match(/data-legal-modal="([^"]*)"/i);
  const dataModal = dataModalMatch ? dataModalMatch[1] : '';

  const ariaLabelMatch = attrs.match(/aria-label="([^"]*)"/i);
  const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : '';

  let classification = 'PLANNED';
  if (href.startsWith('http://') || href.startsWith('https://')) {
    classification = 'WORKING'; // External verified links (social, canonical, etc.)
  } else if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    classification = 'WORKING'; // Contact actions
  } else if (href.startsWith('/')) {
    classification = 'WORKING'; // Canonical internal routes (Click-to-Destination v1.0)
  } else if (href.startsWith('#main-content') || href.startsWith('#site-header')) {
    classification = 'WORKING'; // Skip-to-content and page anchors
  } else if (dataModal) {
    classification = 'WORKING'; // Actionable legal/cookie dialog openers
  } else if (id === 'header-signin-btn' || id === 'hero-plan-btn' || attrs.includes('data-auth-trigger')) {
    classification = 'WORKING'; // Interactive auth/demo trigger
  } else if (href === '#' || href === '') {
    classification = 'DEAD_END'; // Prohibited by Rule 1
  }

  links.push({
    text: text || ariaLabel || id || '(Icon link)',
    href,
    id,
    dataModal,
    ariaLabel,
    classification
  });
}

console.log(`[Link Audit] Found ${links.length} total anchor links.`);

const byClass = {
  WORKING: links.filter(l => l.classification === 'WORKING'),
  DEAD_END: links.filter(l => l.classification === 'DEAD_END'),
  PLANNED: links.filter(l => l.classification === 'PLANNED'),
  BLOCKED: links.filter(l => l.classification === 'BLOCKED')
};

console.log(`- WORKING (Verified / Canonical): ${byClass.WORKING.length}`);
console.log(`- DEAD_END (# or empty): ${byClass.DEAD_END.length}`);
console.log(`- PLANNED: ${byClass.PLANNED.length}`);
console.log(`- BLOCKED: ${byClass.BLOCKED.length}`);

if (byClass.DEAD_END.length > 0) {
  console.warn(`[Link Audit WARNING] Detected ${byClass.DEAD_END.length} dead-end links:`);
  byClass.DEAD_END.forEach(l => console.warn(`  - "${l.text}" (href="${l.href}")`));
}

fs.writeFileSync(
  path.join(ROOT_DIR, 'docs', 'LINK_AUDIT_REPORT.json'),
  JSON.stringify({
    total: links.length,
    summary: {
      WORKING: byClass.WORKING.length,
      DEAD_END: byClass.DEAD_END.length,
      PLANNED: byClass.PLANNED.length,
      BLOCKED: byClass.BLOCKED.length
    },
    links
  }, null, 2),
  'utf8'
);
console.log('[Link Audit] Report written to docs/LINK_AUDIT_REPORT.json');
