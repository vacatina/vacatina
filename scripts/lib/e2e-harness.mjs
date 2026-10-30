/**
 * Vacatina — shared browser E2E harness (CDP + static server).
 *
 * Every suite that imports this drives the real built app in headless Chrome:
 * real clicks, real input/change events, real router navigation. Checks assert
 * user-visible outcomes and persisted state, never just rendered markup.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';

const ROOT_DIR = path.resolve(process.cwd());
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

function startStaticServer(port) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let reqPath = decodeURIComponent(urlObj.pathname);
      if (reqPath === '/') reqPath = '/index.html';
      let resolved = path.resolve(ROOT_DIR, '.' + reqPath);
      if (!resolved.startsWith(ROOT_DIR) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        if (!path.extname(reqPath)) resolved = path.resolve(ROOT_DIR, 'index.html');
        else { res.writeHead(404); res.end('Not found'); return; }
      }
      const ext = path.extname(resolved).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(resolved).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function connectCdp(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Failed to connect to CDP.');
}

class Cdp {
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
        this.pageExceptions.push(`${d.text} ${d.exception?.description || ''}`);
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
  async evaluate(expression, timeoutMs = 20000) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`CDP evaluate timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      const res = await Promise.race([
        this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
        timeout,
      ]);
      if (res.exceptionDetails) throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
      return res.result.value;
    } finally { clearTimeout(timer); }
  }
  async setViewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!mobile });
  }
  close() { this.ws.close(); }
}

export class Harness {
  constructor({ port = 4174, cdpPort = 9223, profile = '.chrome-test-profile-e2e' } = {}) {
    this.port = port;
    this.cdpPort = cdpPort;
    this.profile = profile;
    this.results = [];
    this.server = null;
    this.chrome = null;
    this.cdp = null;
  }

  /* ------------------------------------------------------------- lifecycle */

  async start() {
    this.server = await startStaticServer(this.port);
    const userDataDir = path.join(ROOT_DIR, this.profile);
    fs.mkdirSync(userDataDir, { recursive: true });
    this.chrome = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      '--no-default-browser-check', `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${this.cdpPort}`, 'about:blank',
    ], { stdio: 'ignore' });
    await sleep(2200);
    this.cdp = new Cdp(await connectCdp(this.cdpPort));
    await this.cdp.open();
    await this.cdp.send('Page.navigate', { url: `http://127.0.0.1:${this.port}/index.html` });
    await sleep(1800);
    await this.cdp.evaluate(`(async () => {
      for (let i = 0; i < 120 && !window.__VACATINA_OS__; i++) await new Promise(r => setTimeout(r, 100));
      if (!window.__VACATINA_OS__) throw new Error('app did not bootstrap');
      window.__VACATINA_OS__.tripBucketService.resetToCanonicalBaseline();
      window.__VACATINA_OS__.updateTripControlsVisibility();
      for (let i = 0; i < 60; i++) {
        if (typeof window.__VACATINA_ROUTER__?.navigateTo === 'function') return true;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error('router unavailable');
    })()`);
    return this;
  }

  async stop() {
    try { this.cdp?.close(); } catch { /* ignore */ }
    try { this.chrome?.kill(); } catch { /* ignore */ }
    await new Promise(resolve => this.server ? this.server.close(resolve) : resolve());
  }

  /* ---------------------------------------------------------------- driving */

  async go(route) {
    await this.cdp.evaluate(`window.__VACATINA_ROUTER__.navigateTo(${JSON.stringify(route)})`);
    await sleep(600);
    return this.cdp.evaluate('location.pathname + location.search');
  }

  async goFresh(route) {
    await this.cdp.send('Page.navigate', { url: `http://127.0.0.1:${this.port}${route}` });
    await sleep(1600);
    await this.cdp.evaluate(`(async () => {
      for (let i = 0; i < 120 && !window.__VACATINA_ROUTER__; i++) await new Promise(r => setTimeout(r, 100));
      return true;
    })()`);
    await sleep(300);
    return this.cdp.evaluate('location.pathname + location.search');
  }

  async click(sel) {
    const ok = await this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.click();
      return true;
    })()`);
    await sleep(280);
    return ok;
  }

  async clickText(selector, needle) {
    const ok = await this.cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const el = nodes.find(n => (n.textContent || '').toLowerCase().includes(${JSON.stringify(String(needle).toLowerCase())}));
      if (!el) return false;
      el.click();
      return true;
    })()`);
    await sleep(280);
    return ok;
  }

  async setValue(sel, value, eventName = 'change') {
    const ok = await this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
      return true;
    })()`);
    await sleep(180);
    return ok;
  }

  async setChecked(sel, checked = true) {
    const ok = await this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      if (el.checked === ${checked}) return true;
      el.click();
      return el.checked === ${checked};
    })()`);
    await sleep(120);
    return ok;
  }

  text(sel) {
    return this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      return el ? (el.innerText || el.textContent || '') : null;
    })()`);
  }

  attr(sel, name) {
    return this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      return el ? el.getAttribute(${JSON.stringify(name)}) : null;
    })()`);
  }

  exists(sel) {
    return this.cdp.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
  }

  visible(sel) {
    return this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      const cs = getComputedStyle(el);
      return !el.classList.contains('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
    })()`);
  }

  store(key) {
    return this.cdp.evaluate(`(() => { const raw = sessionStorage.getItem(${JSON.stringify(key)}); if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } })()`);
  }

  clearStore() {
    return this.cdp.evaluate('sessionStorage.clear()');
  }

  url() {
    return this.cdp.evaluate('location.pathname + location.search');
  }

  /** Real keyboard Tab press — required for :focus-visible in headless Chrome. */
  async pressTab() {
    for (const type of ['rawKeyDown', 'char', 'keyUp']) {
      await this.cdp.send('Input.dispatchKeyEvent', {
        type,
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9,
        ...(type === 'char' ? { text: '\t' } : {}),
      });
    }
    await sleep(150);
  }

  async pressKey(key, code, vk) {
    for (const type of ['rawKeyDown', 'char', 'keyUp']) {
      await this.cdp.send('Input.dispatchKeyEvent', {
        type, key, code,
        windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
        ...(type === 'char' ? { text: key } : {}),
      });
    }
    await sleep(150);
  }

  /* ------------------------------------------------------------- assertions */

  record(name, status, detail) {
    this.results.push({ name, status, detail });
    const icon = status === 'PASS' ? 'PASS' : status === 'BLOCKED' ? 'BLOCK' : 'FAIL';
    console.log(`${icon} - ${name}${detail ? ' :: ' + detail : ''}`);
  }

  async check(name, fn) {
    try {
      const detail = await fn();
      this.record(name, 'PASS', typeof detail === 'string' ? detail : (detail == null ? '' : JSON.stringify(detail)));
      return true;
    } catch (e) {
      this.record(name, 'FAIL', String(e?.message ?? e).slice(0, 400));
      return false;
    }
  }

  blocked(name, reason) {
    this.record(name, 'BLOCKED', reason);
  }

  summary() {
    const pass = this.results.filter(r => r.status === 'PASS').length;
    const fail = this.results.filter(r => r.status === 'FAIL').length;
    const blocked = this.results.filter(r => r.status === 'BLOCKED').length;
    console.log('');
    console.log(`TOTAL ${this.results.length} | PASS ${pass} | FAIL ${fail} | BLOCKED ${blocked}`);
    if (this.cdp?.pageExceptions.length) {
      console.log('PAGE EXCEPTIONS: ' + JSON.stringify(this.cdp.pageExceptions.slice(0, 5)));
    }
    return { total: this.results.length, pass, fail, blocked, exceptions: this.cdp?.pageExceptions ?? [] };
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export async function runSuite(name, body, options) {
  const harness = new Harness(options);
  let exitCode = 0;
  try {
    console.log(`\n=== ${name} ===`);
    await harness.start();
    await body(harness);
  } catch (e) {
    console.error('SUITE ERROR: ' + (e?.stack || e));
    harness.record('suite bootstrap', 'FAIL', String(e?.message ?? e));
  } finally {
    const s = harness.summary();
    await harness.stop();
    exitCode = s.fail > 0 ? 1 : 0;
  }
  process.exit(exitCode);
}
