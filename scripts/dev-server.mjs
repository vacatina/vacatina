/* Local preview and real API host. Production hosting needs separate approval. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { buildProject } from './build.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  throw new Error('The development server cannot run in production or Vercel.');
}
// Node 22 needs this opt-in to execute server-side TypeScript source.
if (!process.execArgv.includes('--experimental-strip-types')) {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', ...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: ROOT_DIR, stdio: 'inherit', env: process.env, windowsHide: true
  });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  await new Promise(resolve => child.on('exit', code => { process.exitCode = code || 0; resolve(); }));
  process.exit(process.exitCode || 0);
}

dotenv.config({ path: [path.join(ROOT_DIR, '.env.local'), path.join(ROOT_DIR, '.env')], override: false, quiet: true });
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('Development server requires a local development environment.');
const PORT = Number(process.env.PORT || '4173');
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid local port.');
if (process.env.VACATINA_SKIP_BUILD !== '1') buildProject();
const { handleLocalNodeApiRequest } = await import('../src/server/runtime/node-adapter.ts');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.avif': 'image/avif'
};

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '127.0.0.1:' + PORT;
  let url;
  try {
    url = new URL(req.url || '/', 'http://' + host);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || Number(url.port || 80) !== PORT) {
      res.writeHead(403); res.end('Local host required'); return;
    }
  } catch { res.writeHead(400); res.end('Invalid request'); return; }

  if (url.pathname.startsWith('/api/')) {
    await handleLocalNodeApiRequest(req, res, url.origin);
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
  }

  let reqPath;
  try { reqPath = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('Invalid path'); return; }
  if (reqPath.split('/').some(part => part.startsWith('.')) || reqPath.includes('\\') || reqPath.includes('\0')) {
    res.writeHead(404); res.end('Not found'); return;
  }
  if (reqPath === '/' || reqPath === '/index.html') reqPath = '/index.html';
  else if (reqPath === '/screen-04' || reqPath === '/screen-04-states') reqPath = '/screen-04-states.html';
  else if (!reqPath.startsWith('/public/') && !reqPath.startsWith('/dist/')) {
    if (!path.extname(reqPath)) reqPath = '/index.html';
    else if (reqPath !== '/screen-04-states.html') { res.writeHead(404); res.end('Not found'); return; }
  }

  const requested = path.resolve(ROOT_DIR, '.' + reqPath);
  const relative = path.relative(ROOT_DIR, requested);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  let realPath;
  try {
    realPath = await fs.promises.realpath(requested);
    const realRelative = path.relative(ROOT_DIR, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative) || !(await fs.promises.stat(realPath)).isFile()) throw new Error('Not public');
  } catch { res.writeHead(404); res.end('Not found'); return; }
  const contentType = MIME_TYPES[path.extname(realPath).toLowerCase()];
  if (!contentType) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(realPath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[Vacatina] Local site and API: http://127.0.0.1:' + PORT);
});
