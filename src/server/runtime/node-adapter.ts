import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleDevelopmentHttpRequest } from './dev-http-application.ts';

/** This bridge is only imported by the loopback development server. */
export async function handleLocalNodeApiRequest(req: IncomingMessage, res: ServerResponse, origin: string): Promise<void> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > 524288) { res.writeHead(413, { 'Content-Type': 'application/problem+json' }); res.end(JSON.stringify({ status: 413, code: 'REQUEST_TOO_LARGE' })); return; }
      chunks.push(bytes);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach(part => headers.append(name, part));
      else if (value !== undefined) headers.set(name, value);
    }
    const method = (req.method || 'GET').toUpperCase();
    const request = new Request(new URL(req.url || '/', origin), { method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks) });
    const response = await handleDevelopmentHttpRequest(request);
    res.statusCode = response.status;
    for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.end(method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 500, code: 'LOCAL_REQUEST_FAILED', title: 'Local request failed' }));
  }
}
