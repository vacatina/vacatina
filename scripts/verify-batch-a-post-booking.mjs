/**
 * Vacatina — Batch A interaction E2E (screens 34–45)
 * Real browser clicks, input events, state transitions and guard rails.
 * Every check drives the UI and asserts a user-visible outcome. No rendering-only checks.
 *
 * Run: node scripts/verify-batch-a-post-booking.mjs
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

const ROOT_DIR = path.resolve(process.cwd());
const SERVER_PORT = 4173;
const CDP_PORT = 9222;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOOKING = 'VCT-2026-0001';
const QUOTE_KEY = `vacatina:postbooking:${BOOKING}:changeQuote`;

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
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' }[ext] || 'application/octet-stream';
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
        this.consoleErrors.push((msg.params.args || []).map(a => a.value || a.description || '').join(' '));
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
  async evaluate(expression, timeoutMs = 15000) {
    let timer;
    const tp = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`CDP evaluate timed out after ${timeoutMs}ms`)), timeoutMs); });
    try {
      const res = await Promise.race([this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), tp]);
      if (res.exceptionDetails) throw new Error(`Eval error: ${res.exceptionDetails.text}`);
      return res.result.value;
    } finally { clearTimeout(timer); }
  }
  close() { this.ws.close(); }
}

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`${status} — ${name}${detail ? ' :: ' + detail : ''}`);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, 'PASS', detail || '');
  } catch (e) {
    record(name, 'FAIL', String(e && e.message ? e.message : e).slice(0, 300));
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const server = await startStaticServer();
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const userDataDir = path.join(ROOT_DIR, '.chrome-test-profile-batch-a');
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

  await cdp.evaluate(`(async () => {
    for (let i = 0; i < 100 && !window.__VACATINA_OS__; i++) await new Promise(r => setTimeout(r, 100));
    if (!window.__VACATINA_OS__) throw new Error('app did not bootstrap');
    window.__VACATINA_OS__.tripBucketService.resetToCanonicalBaseline();
    window.__VACATINA_OS__.updateTripControlsVisibility();
    return true;
  })()`);
  for (let i = 0; i < 50; i++) {
    const ready = await cdp.evaluate('typeof window.__VACATINA_ROUTER__ !== "undefined" && typeof window.__VACATINA_ROUTER__.navigateTo === "function"');
    if (ready) break;
    await sleep(200);
  }

  const go = async route => {
    await cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo(${JSON.stringify(route)})`);
    await sleep(500);
    return cdp.evaluate('location.pathname');
  };
  const clearStore = () => cdp.evaluate('sessionStorage.clear()');
  const click = async sel => {
    const ok = await cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
    await sleep(250);
    return ok;
  };
  const setValue = async (sel, value, eventName = 'change') => {
    const ok = await cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    return ok;
  };
  const text = sel => cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? (el.innerText || el.textContent || '') : null; })()`);

  await clearStore();

  /* ---------------------------------------------------------- 34 change select */

  await check('34 change/select — continue blocked before quote', async () => {
    const p = await go(`/bookings/${BOOKING}/change`);
    assert(p === `/bookings/${BOOKING}/change`, `route mismatch: ${p}`);
    const r = await cdp.evaluate(`(() => {
      const b = document.getElementById('btn-continue-alternatives');
      const q = document.getElementById('change-quote');
      return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null, quoteHidden: q ? q.classList.contains('hidden') : null, stage: document.querySelector('[data-pb-stage]')?.getAttribute('data-pb-stage') };
    })()`);
    assert(r.stage === 'select', `expected stage select, got ${r.stage}`);
    assert(r.disabled === true, 'continue must be disabled before a quote');
    assert(r.aria === 'true', 'aria-disabled must be true before a quote');
    assert(r.quoteHidden === true, 'quote panel must start hidden');
    return JSON.stringify(r);
  });

  await check('34 change/select — quote calculates and unlocks continue', async () => {
    assert(await click('#btn-get-quote'), 'get quote button missing');
    const r = await cdp.evaluate(`(() => {
      const b = document.getElementById('btn-continue-alternatives');
      const q = document.getElementById('change-quote');
      return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null, hidden: q ? q.classList.contains('hidden') : null, text: q ? q.innerText : '' };
    })()`);
    assert(r.hidden === false, 'quote panel must be visible');
    assert(/15,000/.test(r.text), `quote total missing: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    assert(/7 days/.test(r.text), `fare-difference day count missing: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    assert(r.disabled === false, 'continue must unlock after a valid quote');
    assert(r.aria === 'false', 'aria-disabled must be false after a valid quote');
    return 'total LKR 15,000, 7 days';
  });

  await check('34 change/select — quote recalculates for a longer stay', async () => {
    await setValue('#change-ret-date', '2026-12-01');
    assert(await click('#btn-get-quote'), 'get quote button missing');
    const r = await cdp.evaluate(`(() => {
      const q = document.getElementById('change-quote');
      return { hidden: q ? q.classList.contains('hidden') : null, text: q ? q.innerText : '' };
    })()`);
    assert(r.hidden === false, 'quote panel must be visible after recalculation');
    assert(/13 days/.test(r.text), `day count did not recalculate: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    assert(/19,000/.test(r.text), `fare difference did not recalculate: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    return 'total LKR 19,000, 13 days';
  });

  await check('34 change/select — date change invalidates quote and re-locks continue', async () => {
    assert(await setValue('#change-dep-date', '2026-11-19'), 'departure input missing');
    const r = await cdp.evaluate(`(() => {
      const b = document.getElementById('btn-continue-alternatives');
      const q = document.getElementById('change-quote');
      const s = document.getElementById('change-quote-status');
      return {
        disabled: b ? b.disabled : null,
        aria: b ? b.getAttribute('aria-disabled') : null,
        hidden: q ? q.classList.contains('hidden') : null,
        quoteText: q ? q.innerText : '',
        status: s ? s.innerText : '',
        stored: sessionStorage.getItem(${JSON.stringify(QUOTE_KEY)})
      };
    })()`);
    assert(r.hidden === true, 'quote must be hidden after dates change');
    assert(r.quoteText.trim() === '', 'stale quote content must be cleared');
    assert(r.disabled === true, 'continue must re-lock after dates change');
    assert(r.aria === 'true', 'aria-disabled must return to true');
    assert(r.stored === null, 'stored quote must be removed');
    assert(/new quote/i.test(r.status), `stale-quote status missing: ${r.status}`);
    return 'quote cleared, continue re-locked, storage empty';
  });

  await check('34 change/select — invalid date range blocks quote', async () => {
    await setValue('#change-dep-date', '2026-11-18');
    await setValue('#change-ret-date', '2026-11-01');
    assert(await click('#btn-get-quote'), 'get quote button missing');
    const r = await cdp.evaluate(`(() => {
      const err = document.getElementById('change-date-error');
      const q = document.getElementById('change-quote');
      const b = document.getElementById('btn-continue-alternatives');
      const ret = document.getElementById('change-ret-date');
      return { errorVisible: err ? !err.classList.contains('hidden') : null, error: err ? err.innerText : '', quoteHidden: q ? q.classList.contains('hidden') : null, disabled: b ? b.disabled : null, invalid: ret ? ret.getAttribute('aria-invalid') : null };
    })()`);
    assert(r.errorVisible === true, 'validation error must be announced');
    assert(/after the departure/i.test(r.error), `unexpected error text: ${r.error}`);
    assert(r.quoteHidden === true, 'invalid range must not render a quote');
    assert(r.disabled === true, 'invalid range must keep continue locked');
    assert(r.invalid === 'true', 'return input must be aria-invalid');
    return 'error announced, no quote';
  });

  await check('34 change/select — valid dates then continue navigates to alternatives', async () => {
    await setValue('#change-dep-date', '2026-11-18');
    await setValue('#change-ret-date', '2026-11-25');
    assert(await click('#btn-get-quote'), 'get quote button missing');
    assert(await click('#btn-continue-alternatives'), 'continue button missing');
    await sleep(400);
    const p = await cdp.evaluate('location.pathname');
    assert(p === `/bookings/${BOOKING}/change/alternatives`, `expected alternatives route, got ${p}`);
    return p;
  });

  /* ------------------------------------------------------- 35 alternatives */

  await check('35 change/alternatives — selection unlocks review and stores choice', async () => {
    const before = await cdp.evaluate(`(() => { const b = document.getElementById('btn-review-change'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(before.disabled === true, 'review must start disabled');
    assert(before.aria === 'true', 'review aria-disabled must start true');
    const radio = await cdp.evaluate(`(() => { const r = document.querySelector('input[name="change-alt"][value="UL505"]'); if (!r) return false; r.click(); return r.checked; })()`);
    await sleep(200);
    assert(radio === true, 'alternative radio did not select');
    const after = await cdp.evaluate(`(() => { const b = document.getElementById('btn-review-change'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null, stored: sessionStorage.getItem('vacatina:postbooking:${BOOKING}:changeSelection') }; })()`);
    assert(after.disabled === false, 'review must unlock after selection');
    assert(after.aria === 'false', 'review aria-disabled must become false');
    assert(!!after.stored && /UL505/.test(after.stored), 'selection was not persisted');
    assert(await click('#btn-review-change'), 'review button missing');
    await sleep(400);
    const p = await cdp.evaluate('location.pathname');
    assert(p === `/bookings/${BOOKING}/change/review`, `expected review route, got ${p}`);
    return 'UL505 selected, review unlocked';
  });

  /* ------------------------------------------------------------ 36 review */

  await check('36 change/review — explicit acceptance required then result shown', async () => {
    const before = await cdp.evaluate(`(() => { const b = document.getElementById('btn-accept-change'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(before.disabled === true, 'accept must be disabled before consent');
    assert(before.aria === 'true', 'accept aria-disabled must be true before consent');
    const quote = await text('#review-quote-heading');
    assert(quote && quote.length > 0, 'review quote heading missing');
    await cdp.evaluate(`(() => { const c = document.getElementById('change-accept-terms'); c.click(); return c.checked; })()`);
    await sleep(200);
    const after = await cdp.evaluate(`(() => { const b = document.getElementById('btn-accept-change'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(after.disabled === false, 'accept must unlock after consent');
    assert(after.aria === 'false', 'accept aria-disabled must become false');
    assert(await click('#btn-accept-change'), 'accept button missing');
    const result = await cdp.evaluate(`(() => { const r = document.getElementById('change-result'); return { visible: r ? !r.classList.contains('hidden') : null, text: r ? r.innerText : '' }; })()`);
    assert(result.visible === true, 'change result must be shown');
    assert(/preview/i.test(result.text), 'result must be labelled preview');
    const completeHref = await cdp.evaluate(`(() => { const a = document.querySelector('a[href="/bookings/${BOOKING}/change/complete"]'); return a ? a.getAttribute('href') : null; })()`);
    assert(completeHref === `/bookings/${BOOKING}/change/complete`, 'completion link missing');
    return 'accepted with consent, preview result shown';
  });

  await check('37 change/complete — completion state reached from review', async () => {
    assert(await click(`a[href="/bookings/${BOOKING}/change/complete"]`), 'completion link missing');
    await sleep(400);
    const p = await cdp.evaluate('location.pathname');
    assert(p === `/bookings/${BOOKING}/change/complete`, `expected complete route, got ${p}`);
    const t = await text('#complete-heading');
    const body = await text('.flights-post-booking');
    assert(/Change Completion/i.test(t || ''), `completion heading missing: ${t}`);
    assert(/Change request recorded \(preview\)/i.test(body || ''), 'completion must state preview only');
    assert(/VCT-CHG-0042/.test(body || ''), 'completion reference missing');
    return 'completion rendered, preview labelled';
  });

  await check('36 guard — review without an active quote cannot accept', async () => {
    await clearStore();
    const p = await go(`/bookings/${BOOKING}/change/review`);
    assert(p === `/bookings/${BOOKING}/change/review`, `route mismatch: ${p}`);
    const r = await cdp.evaluate(`(() => ({
      accept: !!document.getElementById('btn-accept-change'),
      warning: (document.querySelector('.flights-post-booking')?.innerText || ''),
      link: !!document.querySelector('a[href="/bookings/${BOOKING}/change"]')
    }))()`);
    assert(r.accept === false, 'accept must not exist without a quote');
    assert(/No active change quote/i.test(r.warning), 'guard warning missing');
    assert(r.link === true, 'recovery link to change request missing');
    return 'accept unavailable, recovery link present';
  });

  /* ------------------------------------------------------------ 38–40 cancel */

  await check('38 cancel/eligibility — continue link reaches quote stage', async () => {
    await go(`/bookings/${BOOKING}/cancel/eligibility`);
    const t = await text('#cancel-heading');
    assert(/Cancellation Eligibility/i.test(t || ''), 'eligibility heading missing');
    assert(await click(`a[href="/bookings/${BOOKING}/cancel/quote"]`), 'continue to quote link missing');
    await sleep(400);
    const p = await cdp.evaluate('location.pathname');
    assert(p === `/bookings/${BOOKING}/cancel/quote`, `expected quote route, got ${p}`);
    return p;
  });

  await check('39 cancel/quote — reason + terms gate confirmation', async () => {
    const before = await cdp.evaluate(`(() => { const b = document.getElementById('btn-confirm-cancel'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(before.disabled === true, 'confirm must start disabled');
    assert(before.aria === 'true', 'confirm aria-disabled must start true');
    await setValue('#cancel-reason', 'plans');
    const mid = await cdp.evaluate(`(() => { const b = document.getElementById('btn-confirm-cancel'); return b ? b.disabled : null; })()`);
    assert(mid === true, 'reason alone must not unlock confirmation');
    await cdp.evaluate(`(() => { const c = document.getElementById('cancel-confirm-terms'); c.click(); return c.checked; })()`);
    await sleep(200);
    const after = await cdp.evaluate(`(() => { const b = document.getElementById('btn-confirm-cancel'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(after.disabled === false, 'confirm must unlock with reason + terms');
    assert(after.aria === 'false', 'confirm aria-disabled must become false');
    assert(await click('#btn-confirm-cancel'), 'confirm button missing');
    const r = await cdp.evaluate(`(() => { const x = document.getElementById('cancel-result'); const l = document.getElementById('cancel-result-link'); return { visible: x ? !x.classList.contains('hidden') : null, text: x ? x.innerText : '', linkVisible: l ? !l.classList.contains('hidden') : null }; })()`);
    assert(r.visible === true, 'cancellation result must show');
    assert(/preview/i.test(r.text), 'cancellation result must be preview-labelled');
    assert(r.linkVisible === true, 'result link must show');
    return 'reason + terms required, preview result shown';
  });

  await check('40 cancel/result — result stage reached and refund link correct', async () => {
    assert(await click(`a[href="/bookings/${BOOKING}/cancel/result"]`), 'result link missing');
    await sleep(400);
    const p = await cdp.evaluate('location.pathname');
    assert(p === `/bookings/${BOOKING}/cancel/result`, `expected result route, got ${p}`);
    const body = await text('.flights-post-booking');
    assert(/Cancellation recorded \(preview\)/i.test(body || ''), 'result state missing');
    assert(/LKR 238,500/.test(body || ''), 'refund amount missing');
    const href = await cdp.evaluate(`(() => { const a = document.querySelector('a[href="/bookings/${BOOKING}/refund"]'); return a ? a.getAttribute('href') : null; })()`);
    assert(href === `/bookings/${BOOKING}/refund`, 'refund tracker link missing');
    return 'result rendered, refund link valid';
  });

  /* --------------------------------------------------------------- 41 refund */

  await check('41 refund — lifecycle state transitions update timeline', async () => {
    await go(`/bookings/${BOOKING}/refund`);
    const initial = await text('#refund-status');
    assert(/Quoted/.test(initial || ''), `initial state not quoted: ${initial}`);
    await setValue('#refund-scenario', 'paid');
    const paid = await cdp.evaluate(`(() => {
      const step = document.querySelector('[data-refund-step="paid"]');
      const badge = step ? step.querySelector('.refund-badge') : null;
      const status = document.getElementById('refund-status');
      const rejected = document.getElementById('refund-rejected');
      return { green: badge ? badge.className.includes('green') : null, dim: step ? step.classList.contains('opacity-50') : null, status: status ? status.innerText : '', rejectedHidden: rejected ? rejected.classList.contains('hidden') : null };
    })()`);
    assert(paid.green === true, 'paid step must be marked reached');
    assert(paid.dim === false, 'paid step must not be dimmed');
    assert(/Paid/.test(paid.status), `status did not update: ${paid.status}`);
    assert(paid.rejectedHidden === true, 'rejected banner must stay hidden');
    await setValue('#refund-scenario', 'rejected');
    const rejected = await cdp.evaluate(`(() => { const r = document.getElementById('refund-rejected'); const s = document.getElementById('refund-status'); return { visible: r ? !r.classList.contains('hidden') : null, text: r ? r.innerText : '', status: s ? s.innerText : '' }; })()`);
    assert(rejected.visible === true, 'rejected banner must show');
    assert(/credit remains available/i.test(rejected.text), 'rejected guidance missing');
    assert(/Rejected/.test(rejected.status), 'rejected status text missing');
    return 'quoted -> paid -> rejected transitions verified';
  });

  /* ------------------------------------------------------------ 42 disruption */

  await check('42 disruption — three decisions produce distinct outcomes', async () => {
    await go(`/bookings/${BOOKING}/disruption`);
    assert(await click('#btn-accept-revised'), 'accept revised button missing');
    let r = await text('#disruption-result');
    assert(/accepted/i.test(r || ''), `accept outcome missing: ${r}`);
    assert(await click('#btn-request-alternative'), 'alternative button missing');
    r = await text('#disruption-result');
    assert(/Alternative requested/i.test(r || ''), `alternative outcome missing: ${r}`);
    assert(await click('#btn-contact-support'), 'support button missing');
    r = await text('#disruption-result');
    assert(/Support contacted/i.test(r || ''), `support outcome missing: ${r}`);
    return 'accepted / alternative / support outcomes distinct';
  });

  await check('43 disruption/decision — selection required then decision recorded', async () => {
    await go(`/bookings/${BOOKING}/disruption/decision`);
    const before = await cdp.evaluate(`(() => { const b = document.getElementById('btn-confirm-decision'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(before.disabled === true, 'confirm decision must start disabled');
    assert(before.aria === 'true', 'confirm decision aria-disabled must start true');
    const radio = await cdp.evaluate(`(() => { const r = document.querySelector('input[name="disruption-decision"][value="alternative"]'); if (!r) return false; r.click(); return r.checked; })()`);
    await sleep(200);
    assert(radio === true, 'decision radio did not select');
    const after = await cdp.evaluate(`(() => { const b = document.getElementById('btn-confirm-decision'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(after.disabled === false, 'confirm decision must unlock after selection');
    assert(after.aria === 'false', 'confirm decision aria-disabled must become false');
    assert(await click('#btn-confirm-decision'), 'confirm decision button missing');
    const r = await cdp.evaluate(`(() => { const x = document.getElementById('decision-result'); return { visible: x ? !x.classList.contains('hidden') : null, text: x ? x.innerText : '', decision: x ? x.getAttribute('data-decision') : null }; })()`);
    assert(r.visible === true, 'decision result must show');
    assert(/Alternative flight requested/i.test(r.text), `decision outcome missing: ${r.text}`);
    assert(r.decision === 'alternative', 'decision outcome not tied to selection');
    return 'selection required, alternative decision recorded';
  });

  /* --------------------------------------------------------------- 44 support */

  await check('44 support/special — gated submit, validation, preview result', async () => {
    await go(`/bookings/${BOOKING}/support/special`);
    const before = await cdp.evaluate(`(() => { const b = document.getElementById('btn-submit-special'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(before.disabled === true, 'assistance submit must start disabled');
    assert(before.aria === 'true', 'assistance submit aria-disabled must start true');
    await setValue('#special-type', 'wheelchair');
    await cdp.evaluate(`(() => { const c = document.getElementById('special-consent'); c.click(); return c.checked; })()`);
    await sleep(200);
    const enabled = await cdp.evaluate(`(() => { const b = document.getElementById('btn-submit-special'); return { disabled: b ? b.disabled : null, aria: b ? b.getAttribute('aria-disabled') : null }; })()`);
    assert(enabled.disabled === false, 'assistance submit must unlock with type + consent');
    assert(enabled.aria === 'false', 'assistance submit aria-disabled must become false');
    assert(await click('#btn-submit-special'), 'assistance submit missing');
    let r = await cdp.evaluate(`(() => { const e = document.getElementById('special-error'); const n = document.getElementById('special-notes'); const x = document.getElementById('special-result'); return { errorVisible: e ? !e.classList.contains('hidden') : null, error: e ? e.innerText : '', invalid: n ? n.getAttribute('aria-invalid') : null, resultHidden: x ? x.classList.contains('hidden') : null }; })()`);
    assert(r.errorVisible === true, 'short notes must raise an error');
    assert(/10 characters/i.test(r.error), `unexpected error text: ${r.error}`);
    assert(r.invalid === 'true', 'notes must be aria-invalid');
    assert(r.resultHidden === true, 'result must not show on invalid input');
    await setValue('#special-notes', 'Wheelchair assistance required at both departure and arrival gates.');
    assert(await click('#btn-submit-special'), 'assistance submit missing after notes');
    r = await cdp.evaluate(`(() => { const x = document.getElementById('special-result'); const n = document.getElementById('special-notes'); return { visible: x ? !x.classList.contains('hidden') : null, text: x ? x.innerText : '', invalid: n ? n.getAttribute('aria-invalid') : null }; })()`);
    assert(r.visible === true, 'assistance result must show after valid submit');
    assert(/VCT-ASST-0042/.test(r.text), 'assistance reference missing');
    assert(r.invalid === 'false', 'notes aria-invalid must clear');
    return 'validation then preview result';
  });

  await check('45 support — validation then case added to history', async () => {
    await go(`/bookings/${BOOKING}/support`);
    await setValue('#support-message', 'hi');
    assert(await click('#btn-submit-support'), 'support submit missing');
    let r = await cdp.evaluate(`(() => { const e = document.getElementById('support-error'); const m = document.getElementById('support-message'); const x = document.getElementById('support-result'); return { errorVisible: e ? !e.classList.contains('hidden') : null, error: e ? e.innerText : '', invalid: m ? m.getAttribute('aria-invalid') : null, resultHidden: x ? x.classList.contains('hidden') : null }; })()`);
    assert(r.errorVisible === true, 'short message must raise an error');
    assert(/10 characters/i.test(r.error), `unexpected error text: ${r.error}`);
    assert(r.invalid === 'true', 'message must be aria-invalid');
    assert(r.resultHidden === true, 'result must not show on invalid input');
    await setValue('#support-message', 'Please correct the passenger name spelling on the ticket.');
    assert(await click('#btn-submit-support'), 'support submit missing after message');
    r = await cdp.evaluate(`(() => {
      const x = document.getElementById('support-result');
      const first = document.querySelector('#support-history > div');
      const m = document.getElementById('support-message');
      return { visible: x ? !x.classList.contains('hidden') : null, text: x ? x.innerText : '', firstCase: first ? first.innerText : '', invalid: m ? m.getAttribute('aria-invalid') : null };
    })()`);
    assert(r.visible === true, 'support result must show after valid submit');
    assert(/VCT-SUP-0042/.test(r.text), 'support case reference missing');
    assert(/VCT-SUP-0042/.test(r.firstCase), 'new case not added to history');
    assert(r.invalid === 'false', 'message aria-invalid must clear');
    return 'validation then case appended to history';
  });

  /* ----------------------------------------------------- a11y + animation */

  await check('A11y — keyboard Tab reaches the change date input with visible focus ring', async () => {
    await go(`/bookings/${BOOKING}/change`);
    await cdp.evaluate(`(() => { const s = document.getElementById('change-slice'); if (s) s.focus(); return true; })()`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await sleep(200);
    const r = await cdp.evaluate(`(() => {
      const el = document.getElementById('change-dep-date');
      if (!el) return { ok: false, reason: 'input missing' };
      const cs = getComputedStyle(el);
      return {
        active: document.activeElement ? document.activeElement.id : null,
        focusVisible: el.matches(':focus-visible'),
        outlineWidth: cs.outlineWidth,
        outlineStyle: cs.outlineStyle,
        boxShadow: cs.boxShadow
      };
    })()`);
    assert(r.active === 'change-dep-date', `Tab did not reach the date input (active=${r.active})`);
    const ring = r.focusVisible && ((parseFloat(r.outlineWidth) >= 2 && r.outlineStyle !== 'none') || (r.boxShadow && r.boxShadow !== 'none'));
    assert(ring === true, `no visible keyboard focus indicator: ${JSON.stringify(r)}`);
    return `focus-visible outline ${r.outlineWidth} ${r.outlineStyle}`;
  });

  await check('Animation — reduced motion collapses post-booking transitions', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await go(`/bookings/${BOOKING}/change`);
    const reduced = await cdp.evaluate(`(() => { const el = document.querySelector('.flights-post-booking'); const b = document.getElementById('btn-get-quote'); return { anim: el ? getComputedStyle(el).animationDuration : null, trans: b ? getComputedStyle(b).transitionDuration : null }; })()`);
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    await go(`/bookings/${BOOKING}/change`);
    const normal = await cdp.evaluate(`(() => { const el = document.querySelector('.flights-post-booking'); const b = document.getElementById('btn-get-quote'); return { anim: el ? getComputedStyle(el).animationDuration : null, trans: b ? getComputedStyle(b).transitionDuration : null }; })()`);
    const toMs = v => {
      if (!v) return NaN;
      const parts = String(v).split(',').map(s => s.trim());
      return Math.max(...parts.map(p => p.endsWith('ms') ? parseFloat(p) : p.endsWith('s') ? parseFloat(p) * 1000 : NaN));
    };
    assert(toMs(reduced.anim) <= 0.02, `reduced-motion animation not collapsed: ${reduced.anim}`);
    assert(toMs(reduced.trans) <= 0.02, `reduced-motion transition not collapsed: ${reduced.trans}`);
    assert(toMs(normal.anim) > 0.02 || toMs(normal.trans) > 0.02, `normal motion unexpectedly collapsed: anim=${normal.anim} trans=${normal.trans}`);
    return `reduced anim=${reduced.anim} trans=${reduced.trans}; normal anim=${normal.anim} trans=${normal.trans}`;
  });

  await check('Negative control — detached date input no longer invalidates the quote', async () => {
    await clearStore();
    await go(`/bookings/${BOOKING}/change`);
    assert(await click('#btn-get-quote'), 'get quote missing');
    const detached = await cdp.evaluate(`(() => {
      const el = document.getElementById('change-dep-date');
      if (!el) return false;
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      clone.value = '2026-11-21';
      clone.dispatchEvent(new Event('input', { bubbles: true }));
      clone.dispatchEvent(new Event('change', { bubbles: true }));
      const q = document.getElementById('change-quote');
      return q ? !q.classList.contains('hidden') : false;
    })()`);
    await sleep(150);
    assert(detached === true, 'control failed: quote vanished without a wired listener (invalidation is not listener-driven)');
    return 'quote persisted only when listener removed (proves real listener wiring)';
  });

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n=== BATCH A RESULTS: ${pass} PASS / ${fail} FAIL (total ${results.length}) ===`);
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ${r.name}: ${r.detail}`));
  }

  cdp.close();
  chromeProc.kill();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
