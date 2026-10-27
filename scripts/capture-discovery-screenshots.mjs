import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:/Users/Madhusanka/.gemini/antigravity/brain/c2636760-2265-4954-ae61-76df879c0df0';
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'screenshots');

const SERVER_PORT = 4198;
const CDP_PORT = 9256;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function startStaticServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', `http://127.0.0.1:${SERVER_PORT}`);
      let reqPath = decodeURIComponent(urlObj.pathname);
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.resolve(ROOT_DIR, '.' + reqPath);
      if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(SERVER_PORT, '127.0.0.1', () => resolve(server));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connectCdp() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const pageTarget = targets.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('Failed to connect to CDP');
}

class CdpSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(outputPath, clip = null) {
    const params = { format: 'png', quality: 90 };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buf);
    const fileName = path.basename(outputPath);
    const artifactPath = path.join(ARTIFACT_DIR, fileName);
    fs.writeFileSync(artifactPath, buf);
    console.log(`Saved screenshot: ${fileName}`);
  }

  close() {
    this.ws.close();
  }
}

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chrome executable not found');
}

async function capture() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const server = await startStaticServer();
  const chromePath = findChrome();
  const userDataDir = path.join(ROOT_DIR, 'tmp', 'chrome-user-data-cap-' + Date.now());

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1440,900'
  ]);

  try {
    const wsUrl = await connectCdp();
    const cdp = new CdpSession(wsUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // 1440 Desktop Cards
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/` });
    await sleep(1500);

    // Scroll to Flights section
    await cdp.eval(`(() => {
      const el = document.querySelector('#popular-flights');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_flights_1440.png'));

    // Scroll to Visa section
    await cdp.eval(`(() => {
      const el = document.querySelector('#visa-assistance');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_visa_1440.png'));

    // Scroll to Holiday Packages section
    await cdp.eval(`(() => {
      const el = document.querySelector('#holiday-packages');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_packages_1440.png'));

    // Scroll to Sightseeing section
    await cdp.eval(`(() => {
      const el = document.querySelector('#curated-sightseeing');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_sightseeing_1440.png'));

    // Scroll to Transfers section
    await cdp.eval(`(() => {
      const el = document.querySelector('#transfers-rentals');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_transfers_1440.png'));

    // Scroll to Cruises section
    await cdp.eval(`(() => {
      const el = document.querySelector('#luxury-cruises');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_cruises_1440.png'));

    // Mobile 360 Flights & Visa
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true
    });
    await sleep(800);
    await cdp.eval(`(() => {
      const el = document.querySelector('#popular-flights');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, 'vacatina_discovery_flights_360.png'));

    cdp.close();
  } finally {
    chromeProc.kill();
    server.close();
  }
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
