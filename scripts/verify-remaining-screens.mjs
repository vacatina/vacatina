import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

const ROOT_DIR = path.resolve(process.cwd());
const SERVER_PORT = 4173;
const CDP_PORT = 9222;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startStaticServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', `http://127.0.0.1:${SERVER_PORT}`);
      let reqPath = decodeURIComponent(urlObj.pathname);
      if (reqPath === '/') reqPath = '/index.html';
      let resolvedPath = path.resolve(ROOT_DIR, '.' + reqPath);
      if (!resolvedPath.startsWith(ROOT_DIR) || !fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
        if (!path.extname(reqPath)) resolvedPath = path.resolve(ROOT_DIR, 'index.html');
        else { res.writeHead(404); res.end('Not found'); return; }
      }
      const ext = path.extname(resolvedPath).toLowerCase();
      const mime = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(resolvedPath).pipe(res);
    });
    server.listen(SERVER_PORT, '127.0.0.1', () => resolve(server));
  });
}

async function connectCdp() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const pageTarget = targets.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) return pageTarget.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Failed to connect to CDP.');
}

class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageExceptions = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
        this.consoleErrors.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.pageExceptions.push(d.text + ' ' + (d.exception?.description || ''));
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  send(method, params = {}) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, timeoutMs = 10000) {
    let timer;
    const tp = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`CDP evaluate timed out after ${timeoutMs}ms`)), timeoutMs); });
    try {
      const res = await Promise.race([this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), tp]);
      if (res.exceptionDetails) throw new Error(`Eval error: ${res.exceptionDetails.text}`);
      return res.result.value;
    } finally { clearTimeout(timer); }
  }
  async setViewport(w, h, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  }
  close() { this.ws.close(); }
}

const results = [];
function record(screen, viewport, status, detail) {
  results.push({ screen, viewport, status, detail });
  console.log(`${status} — Screen ${screen} @ ${viewport}px ${detail}`);
}

async function runGroup(cdp, screens, width, height, mobile) {
  await cdp.setViewport(width, height, mobile);
  await sleep(200);
  for (const s of screens) {
    cdp.consoleErrors = [];
    cdp.pageExceptions = [];
    try {
      await cdp.evaluate(`try { window.__VACATINA_ROUTER__.navigateTo('${s.route}'); } catch(e) { console.error('NAV_ERROR', e && e.message); }`);
      await sleep(500);
      const expectedHeading = s.heading;
      const r = await cdp.evaluate(`(() => {
        const mount = document.getElementById('flights-view-mount');
        const modal = document.querySelector('[data-dialog-backdrop]')?.parentElement || document.querySelector('.fixed.inset-0');
        const container = (mount && !mount.classList.contains('hidden')) ? mount : (modal || document.body);
        const text = (container.innerText || '').slice(0, 2000);
        const fits = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
        const heading = (container.querySelector('h1,h2')?.textContent || '').trim().slice(0, 80);
        const mainHidden = document.getElementById('main-content')?.classList.contains('hidden');
        // A11y: named interactive controls
        const controls = container.querySelectorAll('button, a, input, select, textarea');
        // A11y: 100% named controls (WCAG 4.1.2)
        const namedControls = Array.from(controls).filter(c => {
          const name = c.getAttribute('aria-label') || c.textContent || c.getAttribute('title') || '';
          if (name.trim().length > 0) return true;
          // Check for associated label
          const label = c.closest('label') || (c.id ? document.querySelector('label[for="' + c.id + '"]') : null);
          return !!(label && (label.textContent || '').trim().length > 0);
        }).length;
        const hasNamedControls = controls.length === 0 || namedControls === controls.length;
        // Animation: check for CSS transitions on interactive elements
        const btns = container.querySelectorAll('button, a');
        const hasTransition = Array.from(btns).some(b => {
          const s = getComputedStyle(b);
          return s.transitionDuration && s.transitionDuration !== '0s' && s.transitionDuration !== '0ms';
        });
        const hasReducedMotion = Array.from(document.styleSheets).some(ss => { try { return Array.from(ss.cssRules || []).some(r => (r.cssText || '').includes('prefers-reduced-motion')); } catch { return false; } });
        // Touch targets: WCAG 2.5.8 minimum 24px (AA)
        const touchOk = Array.from(container.querySelectorAll('button, a, input')).every(el => {
          const r = el.getBoundingClientRect();
          return r.height === 0 || r.width === 0 || (r.height >= 24 && r.width >= 24);
        });
        return { heading, fits, mainHidden, hasNamedControls, hasTransition, hasReducedMotion, touchOk, controlCount: controls.length, namedCount: namedControls };
      })()`);
      const hasError = cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0;
      const headingMatch = (r.heading || '').toLowerCase().includes((expectedHeading || '').toLowerCase().split(' ')[0]);
      // Interaction check: verify required navigation links exist and work
      let navOk = true;
      try {
        const linkExists = await cdp.evaluate(`(() => {
          return !!document.querySelector('a[href="/flights"], a[href="/"]');
        })()`);
        if (s.requiresBackLink && !linkExists) {
          // Required back link is missing — genuine failure
          navOk = false;
        } else if (linkExists) {
          const linkClicked = await cdp.evaluate(`(() => {
            const link = document.querySelector('a[href="/flights"], a[href="/"]');
            if (link) { link.click(); return true; }
            return false;
          })()`);
          if (linkClicked) {
            await sleep(400);
            const afterUrl = await cdp.evaluate('location.pathname');
            navOk = (afterUrl !== s.route);
            await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo('${s.route}')`);
            await sleep(400);
            const restored = await cdp.evaluate('location.pathname');
            if (restored !== s.route) navOk = false;
          }
        }
      } catch (e) { navOk = false; }
      const ok = headingMatch && r.fits && !hasError && navOk && r.hasNamedControls && r.hasReducedMotion;
      record(s.id, width, ok ? 'PASS' : 'FAIL', JSON.stringify({ heading: r.heading, expected: expectedHeading, fits: r.fits, errors: cdp.consoleErrors.length, exceptions: cdp.pageExceptions.length, a11yNamedControls: r.hasNamedControls, animationTransitions: r.hasTransition, reducedMotion: r.hasReducedMotion, touchTargets: r.touchOk }));
    } catch (e) {
      record(s.id, width, 'FAIL', String(e).slice(0, 120) + ' | exceptions: ' + JSON.stringify(cdp.pageExceptions.slice(0,2)));
    }
  }
}

async function main() {
  const server = await startStaticServer();
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const userDataDir = path.join(ROOT_DIR, '.chrome-test-profile');
  fs.mkdirSync(userDataDir, { recursive: true });
  const chromeProc = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check', `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${CDP_PORT}`, 'about:blank'
  ], { stdio: 'ignore' });
  await sleep(2000);
  const wsUrl = await connectCdp();
  const cdp = new CdpSession(wsUrl);
  await cdp.open();
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.html` });
  await sleep(1800);
  // Seed demo baseline (same as browser-verify)
  await cdp.evaluate(`(async () => {
    for (let i = 0; i < 100 && !window.__VACATINA_OS__; i++) await new Promise(r => setTimeout(r, 100));
    if (!window.__VACATINA_OS__) throw new Error('app did not bootstrap');
    window.__VACATINA_OS__.tripBucketService.resetToCanonicalBaseline();
    window.__VACATINA_OS__.updateTripControlsVisibility();
    return true;
  })()`);
  // Wait for the SPA router to be available
  for (let i = 0; i < 50; i++) {
    const ready = await cdp.evaluate('typeof window.__VACATINA_ROUTER__ !== "undefined" && typeof window.__VACATINA_ROUTER__.navigateTo === "function"');
    if (ready) break;
    await sleep(200);
  }

  const screens = [
    // Post-booking dedicated views (34-45) — have back links
    { id: '34', route: '/bookings/VCT-2026-0001/change', heading: 'Change Flight', requiresBackLink: true },
    { id: '35', route: '/bookings/VCT-2026-0001/change/alternatives', heading: 'Change Flight', requiresBackLink: true },
    { id: '36', route: '/bookings/VCT-2026-0001/change/review', heading: 'Change Flight', requiresBackLink: true },
    { id: '37', route: '/bookings/VCT-2026-0001/change/complete', heading: 'Change Flight', requiresBackLink: true },
    { id: '38', route: '/bookings/VCT-2026-0001/cancel/eligibility', heading: 'Cancel Flight', requiresBackLink: true },
    { id: '39', route: '/bookings/VCT-2026-0001/cancel/quote', heading: 'Cancel Flight', requiresBackLink: true },
    { id: '40', route: '/bookings/VCT-2026-0001/cancel/result', heading: 'Cancel Flight', requiresBackLink: true },
    { id: '41', route: '/bookings/VCT-2026-0001/refund', heading: 'Refund', requiresBackLink: true },
    { id: '42', route: '/bookings/VCT-2026-0001/disruption', heading: 'Disruption', requiresBackLink: true },
    { id: '43', route: '/bookings/VCT-2026-0001/disruption/decision', heading: 'Disruption', requiresBackLink: true },
    { id: '44', route: '/bookings/VCT-2026-0001/support/special', heading: 'Support', requiresBackLink: true },
    { id: '45', route: '/bookings/VCT-2026-0001/support', heading: 'Support', requiresBackLink: true },
    // Manual request tracker (46-50) — have back links
    { id: '46', route: '/flights/requests/VCT-REQ-0001/review', heading: 'Manual Flight Request', requiresBackLink: true },
    { id: '47', route: '/flights/requests/VCT-REQ-0001/submitted', heading: 'Manual Flight Request', requiresBackLink: true },
    { id: '48', route: '/flights/requests/VCT-REQ-0001', heading: 'Manual Flight Request', requiresBackLink: true },
    { id: '49', route: '/flights/requests/VCT-REQ-0001/quote', heading: 'Manual Flight Request', requiresBackLink: true },
    { id: '50', route: '/flights/requests/VCT-REQ-0001/declined', heading: 'Manual Flight Request', requiresBackLink: true },
    // B2B after-sales (57) — has back link
    { id: '57', route: '/b2b/flights/manage', heading: 'Agent Flight Booking Management', requiresBackLink: true },
    // Admin (62-64) — auth-gated, no back link (gated)
    { id: '62', route: '/admin/after-sales', heading: 'Operations access', requiresBackLink: false },
    { id: '63', route: '/admin/disruptions', heading: 'Operations access', requiresBackLink: false },
    { id: '64', route: '/admin/reconciliation', heading: 'Operations access', requiresBackLink: false },
    // Core flows
    { id: '02', route: '/flights', heading: 'Find & Configure Your Ideal Flight', requiresBackLink: false },
    { id: '03', route: '/flights/search', heading: 'Flight search results', requiresBackLink: false },
    { id: '27', route: '/bookings/VCT-2026-0001', heading: 'Operations access', requiresBackLink: false },
    { id: '51', route: '/b2b/flights', heading: 'B2B Flight Search', requiresBackLink: false },
    { id: '58', route: '/admin/suppliers', heading: 'Operations access', requiresBackLink: false },
  ];

  for (const width of [1440, 768, 360]) {
    const mobile = width < 768;
    const height = width === 768 ? 1024 : 900;
    await runGroup(cdp, screens, width, height, mobile);
  }

  cdp.close();
  chromeProc.kill();
  server.close();

  // Negative-control test: verify the script detects a non-existent route
  // by navigating to a bogus path and confirming it does NOT render a valid screen heading
  const negScreens = [{ id: 'NEG', route: '/this-route-does-not-exist-xyz' }];
  console.log('\\n=== NEGATIVE CONTROL TEST ===');
  for (const w of [1440]) {
    await cdp.setViewport(w, 900, false);
    await sleep(200);
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo('/this-route-does-not-exist-xyz')`);
    await sleep(500);
    const nc = await cdp.evaluate(`(() => {
      const mount = document.getElementById('flights-view-mount');
      const heading = mount && !mount.classList.contains('hidden') ? (mount.querySelector('h1,h2')?.textContent || '') : '';
      return { heading: heading.trim(), isHomepage: heading.includes('Book Everything') };
    })()`);
    // The negative control PASSES if the broken route does NOT render a valid screen
    // (i.e., it shows homepage or 404, not a specific screen heading)
    const negPass = nc.heading === '' || nc.isHomepage;
    record('NEG', w, negPass ? 'PASS' : 'FAIL', JSON.stringify({ negativeControl: true, heading: nc.heading, expected: 'not-a-valid-screen' }));
    console.log((negPass ? 'PASS' : 'FAIL') + ' — Negative control: broken route detected (heading: "' + nc.heading + '")');
  }

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\\n=== RESULTS: ${pass} PASS / ${fail} FAIL (total ${results.length}) ===`);
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  Screen ${r.screen} @ ${r.viewport}: ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });