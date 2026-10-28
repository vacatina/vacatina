#!/usr/bin/env node
/**
 * Vacatina Design Compliance Check
 * Verifies that the codebase adheres to the Design DNA specification.
 * Read-only check — does not modify any files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  if (condition) passed++; else failed++;
  checks.push({ name, status, detail });
}

// 1. Design DNA file exists
check('Design DNA exists', fs.existsSync(path.join(ROOT, 'docs', 'design-dna.md')), 'docs/design-dna.md');

// 2. Design Registry exists
check('Design Registry exists', fs.existsSync(path.join(ROOT, 'docs', 'design-registry.md')), 'docs/design-registry.md');

// 3. Brand primary color in Tailwind config
const tailwindConfig = fs.readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8');
check('Brand primary #1B1464 in Tailwind', tailwindConfig.includes('#1B1464'), 'tailwind.config.js');
check('Plus Jakarta Sans in Tailwind', tailwindConfig.includes('Plus Jakarta Sans'), 'tailwind.config.js');
check('Inter in Tailwind', tailwindConfig.includes('Inter'), 'tailwind.config.js');

// 4. Locked homepage preserved (check index.html has 11 SCC tabs)
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check('11 SCC tabs in homepage', (indexHtml.match(/role="tabpanel"/g) || []).length === 11, 'index.html tabpanel count');
check('Plus Jakarta Sans in homepage', indexHtml.includes('Plus Jakarta Sans'), 'index.html');
check('Inter in homepage', indexHtml.includes('Inter'), 'index.html');

// 5. No hardcoded Clerk secrets in client code
const clerkService = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'services', 'clerk-auth.service.ts'), 'utf8');
check('No hardcoded Clerk key in client', !clerkService.includes('pk_test_ZWxlY3RyaWMtc25haWwtNDguY2xlcmsuYWNjb3VudHMuZGV2JA'), 'clerk-auth.service.ts');

// 6. URL canonicalization exists
const mainTs = fs.readFileSync(path.join(ROOT, 'src', 'app', 'main.ts'), 'utf8');
check('URL canonicalization exists', mainTs.includes('utm_source') && mainTs.includes('replaceState'), 'main.ts');

// 7. Webhook signature verification exists
const webhook = fs.readFileSync(path.join(ROOT, 'src', 'server', 'runtime', 'hosted-demo-closed.mjs'), 'utf8');
check('Webhook HMAC verification exists', webhook.includes('createHmac') && webhook.includes('timingSafeEqual'), 'hosted-demo-closed.mjs');
check('Webhook returns 503 for critical events', webhook.includes('503') && webhook.includes('BACKEND_NOT_AVAILABLE'), 'hosted-demo-closed.mjs');

// 8. Reduced motion support
const inputCss = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'input.css'), 'utf8');
check('Reduced motion support', inputCss.includes('prefers-reduced-motion'), 'input.css');

// 9. No demo language in customer-facing content
const flightsHub = fs.readFileSync(path.join(ROOT, 'src', 'features', 'flights', 'ui', 'flights-hub-view.ts'), 'utf8');
check('No "Demo fixtures are illustrative" in flights hub', !flightsHub.includes('Demo fixtures are illustrative'), 'flights-hub-view.ts');

// 10. Git status
import { execSync } from 'node:child_process';
const gitStatus = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
check('Working tree clean', gitStatus === '', 'git status');

console.log('\n=== VACATINA DESIGN COMPLIANCE CHECK ===\n');
for (const c of checks) {
  console.log(`[${c.status}] ${c.name} — ${c.detail}`);
}
console.log(`\nTotal: ${checks.length} | Passed: ${passed} | Failed: ${failed}`);
console.log(`Compliance: ${Math.round((passed / checks.length) * 100)}%`);

if (failed > 0) {
  console.log('\n⚠️  Some compliance checks failed. Review before proceeding.');
  process.exit(1);
} else {
  console.log('\n✅ All compliance checks passed.');
}
