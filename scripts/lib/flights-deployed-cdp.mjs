// Extracted unchanged in behavior from the accepted probe's CDP transport.
import { WebSocket } from 'ws';

export class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.seq = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageExceptions = [];
    this.onEvent = null;
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.consoleErrors.push((message.params.args || []).map(arg => arg.value || arg.description || '').join(' '));
      } else if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.pageExceptions.push(`${details.text} ${details.exception?.description || ''}`);
      } else if (this.onEvent) {
        this.onEvent(message);
      }
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    const base = process.env.PREVIEW_BASE;
    if (base && process.env.VERCEL_BYPASS) {
      this.onEvent = message => {
        if (message.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = message.params;
        const headers = Object.entries(request.headers || {}).map(([name, value]) => ({ name, value: String(value) }));
        headers.push({ name: 'x-vercel-protection-bypass', value: process.env.VERCEL_BYPASS });
        this.send('Fetch.continueRequest', { requestId, headers }).catch(() => {});
      };
      await this.send('Fetch.enable', { patterns: [{ urlPattern: `${base}/*`, requestStage: 'Request' }] });
    }
    await this.setViewport(1440, 900, false);
  }
  send(method, params = {}) {
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, timeoutMs = 25000) {
    let timer;
    try {
      const response = await Promise.race([
        this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('eval timeout')), timeoutMs); }),
      ]);
      if (response.exceptionDetails) throw new Error(`${response.exceptionDetails.text} ${response.exceptionDetails.exception?.description || ''}`);
      return response.result.value;
    } finally { clearTimeout(timer); }
  }
  async setViewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!mobile });
  }
  close() { this.ws.close(); }
}
