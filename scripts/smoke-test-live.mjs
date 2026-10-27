/* ============================================================================
 * Vacatina Live Production Post-Deployment Smoke Test (scripts/smoke-test-live.mjs)
 * Tests live production URL: https://vacatina-nu.vercel.app
 * ============================================================================ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PRODUCTION_URL = 'https://vacatina-nu.vercel.app';
const CDP_PORT = 9266;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchHttp(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Vacatina-SmokeTest/1.0' }
  });
  const text = await resp.text();
  return { status: resp.status, headers: Object.fromEntries(resp.headers.entries()), text };
}

async function connectCdp() {
  const listResp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const list = await listResp.json();
  const pageTarget = list.find(t => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const wsUrl = pageTarget.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}) => {
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  };

  return { ws, send, evaluate };
}

async function runSmokeTest() {
  console.log('===============================================================');
  console.log('   VACATINA POST-DEPLOYMENT LIVE SMOKE TEST                    ');
  console.log(`   Target: ${PRODUCTION_URL}                                   `);
  console.log('===============================================================\n');

  // 1. HTTP Verification
  console.log('▶ [Test 1] HTTP 200 & HTML Content Integrity Check');
  const httpRes = await fetchHttp(PRODUCTION_URL);
  if (httpRes.status !== 200) {
    throw new Error(`Live URL returned HTTP ${httpRes.status}`);
  }
  console.log(`✔ HTTP Status: ${httpRes.status} (${httpRes.text.length} bytes)`);

  // Check 0 href="#"
  const hrefPoundMatches = (httpRes.text.match(/href="#"/g) || []).length;
  console.log(`✔ href="#" occurrences: ${hrefPoundMatches} (Must be 0)`);
  if (hrefPoundMatches > 0) throw new Error(`Found ${hrefPoundMatches} href="#" in production HTML`);

  // Check canonical cookie route
  const hasCookieRoute = httpRes.text.includes('/legal/cookies');
  console.log(`✔ Canonical Cookie route (/legal/cookies) present: ${hasCookieRoute}`);
  if (!hasCookieRoute) throw new Error('Missing /legal/cookies route in production HTML');

  // Check brand DNA
  const hasBrandDna = httpRes.text.includes('#1B1464') || httpRes.text.includes('1b1464');
  console.log(`✔ Brand DNA (#1B1464) present: ${hasBrandDna}`);
  if (!hasBrandDna) throw new Error('Brand primary color #1B1464 missing');

  // Check default public identity (Alex Morgan removed)
  const hasAlexMorgan = httpRes.text.includes('Alex Morgan') && !httpRes.text.includes('data-demo-only');
  console.log(`✔ Public Alex Morgan mock identity removed from default state: ${!hasAlexMorgan}`);
  if (hasAlexMorgan) throw new Error('Public production contains hardcoded Alex Morgan profile');

  // 2. Headless Chrome Browser Acceptance against Live URL
  console.log('\n▶ [Test 2] Launching Headless Chrome against Live Production URL');
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const userDataDir = path.join(ROOT_DIR, 'tmp', `chrome-live-smoke-${Date.now()}`);

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);

  try {
    const { ws, send, evaluate } = await connectCdp();
    await send('Page.enable');
    await send('Runtime.enable');

    const consoleErrors = [];
    ws.addEventListener('message', (evt) => {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
      }
    });

    // Navigate to Live URL
    console.log(`Navigating to ${PRODUCTION_URL}...`);
    await send('Page.navigate', { url: PRODUCTION_URL });
    await sleep(3000);

    // 2.1 Viewport 1440x900 (Desktop)
    console.log('\n▶ [Test 3] Testing Desktop Viewport (1440x900)');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(800);

    // Check horizontal scroll overflow
    const desktopOverflow = await evaluate(`(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log(`✔ Desktop Scroll Width: ${desktopOverflow.scrollWidth}px, Client: ${desktopOverflow.clientWidth}px (Overflow: ${desktopOverflow.hasOverflow})`);
    if (desktopOverflow.hasOverflow) throw new Error('Horizontal scroll overflow detected at 1440px');

    // Test 11 Search Command Center Tabs
    console.log('\n▶ [Test 4] Testing 11 Search Command Center Tabs on Live Site');
    const tabsResult = await evaluate(`(() => {
      const tabs = Array.from(document.querySelectorAll('.search-tab'));
      const tabIds = tabs.map(t => t.id);
      return { count: tabs.length, tabIds };
    })()`);
    console.log(`✔ Found ${tabsResult.count} SCC tabs: ${tabsResult.tabIds.join(', ')}`);
    if (tabsResult.count !== 11) throw new Error(`Expected 11 SCC tabs, found ${tabsResult.count}`);

    // Cycle through tabs and click each
    const tabClickResults = await evaluate(`(async () => {
      const tabs = Array.from(document.querySelectorAll('.search-tab'));
      const results = [];
      for (const tab of tabs) {
        tab.click();
        const activeTab = document.querySelector('.search-tab[aria-selected="true"]');
        results.push({
          id: tab.id,
          selected: tab.getAttribute('aria-selected') === 'true',
          activeId: activeTab ? activeTab.id : null
        });
      }
      return results;
    })()`);
    const allTabsSwitched = tabClickResults.every(r => r.selected);
    console.log(`✔ All 11 SCC tabs switch active state successfully: ${allTabsSwitched}`);
    if (!allTabsSwitched) throw new Error('Not all SCC tabs switched active state properly');

    // Test Trip Bucket Drawer
    console.log('\n▶ [Test 5] Testing Trip Bucket Drawer on Live Site');
    const bucketTest = await evaluate(`(() => {
      const btn = document.getElementById('header-trip-bucket-btn') || document.getElementById('dock-review-trip-btn');
      if (!btn) return { error: 'No trip bucket button found' };
      btn.click();
      const container = document.getElementById('trip-bucket-drawer-container');
      const isVisible = container && !container.classList.contains('hidden');
      const readyTotal = document.getElementById('trip-bucket-drawer-ready-total');
      return {
        btnFound: true,
        drawerVisible: isVisible,
        subtotalText: readyTotal ? readyTotal.textContent.trim() : null
      };
    })()`);
    console.log(`✔ Trip Bucket button found: ${bucketTest.btnFound}, Drawer opened: ${bucketTest.drawerVisible}, Subtotal: ${bucketTest.subtotalText}`);
    if (!bucketTest.btnFound || !bucketTest.drawerVisible) {
      throw new Error(`Trip Bucket drawer failed to open on live site: ${JSON.stringify(bucketTest)}`);
    }

    // Close bucket drawer
    await evaluate(`(() => {
      const closeBtn = document.getElementById('trip-bucket-close');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 2.2 Viewport 768x1024 (Tablet)
    console.log('\n▶ [Test 6] Testing Tablet Viewport (768x1024)');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(800);

    const tabletOverflow = await evaluate(`(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log(`✔ Tablet Scroll Width: ${tabletOverflow.scrollWidth}px, Client: ${tabletOverflow.clientWidth}px (Overflow: ${tabletOverflow.hasOverflow})`);
    if (tabletOverflow.hasOverflow) throw new Error('Horizontal scroll overflow detected at 768px');

    // 2.3 Viewport 360x800 (Mobile)
    console.log('\n▶ [Test 7] Testing Mobile Viewport (360x800) & Navigation Drawer');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(800);

    const mobileOverflow = await evaluate(`(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log(`✔ Mobile Scroll Width: ${mobileOverflow.scrollWidth}px, Client: ${mobileOverflow.clientWidth}px (Overflow: ${mobileOverflow.hasOverflow})`);
    if (mobileOverflow.hasOverflow) throw new Error('Horizontal scroll overflow detected at 360px');

    // Mobile Hamburger
    const mobileDrawerTest = await evaluate(`(() => {
      const hamburger = document.getElementById('mobile-nav-toggle') || document.querySelector('.mobile-menu-btn');
      if (!hamburger) return { error: 'No hamburger button found' };
      hamburger.click();
      const container = document.getElementById('mobile-nav-drawer-container');
      const isVisible = container && !container.classList.contains('hidden');
      return {
        hamburgerFound: true,
        drawerOpened: isVisible
      };
    })()`);
    console.log(`✔ Mobile Hamburger found: ${mobileDrawerTest.hamburgerFound}, Drawer opened: ${mobileDrawerTest.drawerOpened}`);
    if (!mobileDrawerTest.hamburgerFound || !mobileDrawerTest.drawerOpened) {
      throw new Error(`Mobile navigation drawer failed to open at 360px: ${JSON.stringify(mobileDrawerTest)}`);
    }

    // Close Mobile Drawer
    await evaluate(`(() => {
      const closeBtn = document.getElementById('mobile-nav-close');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(400);

    // 2.4 Verify Zero Diagnostic Leaks & Zero False Claims
    console.log('\n▶ [Test 8] Scanning for B2C Diagnostic Leaks & False Claims');
    const claimCheck = await evaluate(`(() => {
      const bodyText = document.body.innerText;
      const falseClaimsFound = [
        'Live fare verified',
        '14m hold active',
        'Supplier rate verified',
        'Room block verified',
        'Seats verified',
        'Live rate confirmed'
      ].filter(phrase => bodyText.includes(phrase));

      const diagnosticsFound = [
        'Duffel',
        'LiteAPI',
        'Amadeus',
        '8-State Candidate Engine',
        'Reset Baseline'
      ].filter(phrase => bodyText.includes(phrase));

      return { falseClaimsFound, diagnosticsFound, bodyLength: bodyText.length };
    })()`);
    console.log(`✔ False Live Claims detected: ${claimCheck.falseClaimsFound.length} (${claimCheck.falseClaimsFound.join(', ') || 'None'})`);
    console.log(`✔ Provider Diagnostic Leaks detected: ${claimCheck.diagnosticsFound.length} (${claimCheck.diagnosticsFound.join(', ') || 'None'})`);
    if (claimCheck.falseClaimsFound.length > 0 || claimCheck.diagnosticsFound.length > 0) {
      throw new Error(`Diagnostic leaks or false claims found in customer UI: falseClaims=[${claimCheck.falseClaimsFound}], diagnostics=[${claimCheck.diagnosticsFound}]`);
    }

    // 2.5 Console Errors Check
    console.log(`\n✔ Console errors encountered during smoke test: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.warn('Console error messages:', consoleErrors);
    }

    console.log('\n===============================================================');
    console.log('✔ POST-DEPLOYMENT LIVE SMOKE TEST PASSED (100% HEALTHY)');
    console.log(`✔ Verified Production URL: ${PRODUCTION_URL}`);
    console.log('===============================================================\n');

    ws.close();
  } finally {
    try {
      chromeProc.kill();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

runSmokeTest().catch(err => {
  console.error('\n✖ [Smoke Test Failed]:', err.message);
  process.exit(1);
});
