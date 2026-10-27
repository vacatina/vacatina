import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { globalApiRouter, createJsonResponse, createProblemResponse } from '../api/router.ts';
import { authenticateClerkHttpRequest, CLERK_VERIFIER_CONFIG } from '../auth/clerk-verifier.ts';
import { GuestSessionManager } from '../auth/guest-session.ts';
import type { SecurityContext } from '../auth/rbac.ts';
import { getRuntimePersistence, type RuntimePersistence } from './persistence.ts';
import { backendTelemetry, requestCorrelationId, type BackendTelemetrySink } from './observability.ts';

export interface DevelopmentHttpOptions {
  sessionSecret?: string;
  persistence?: RuntimePersistence;
  authenticate?: (request: Request) => Promise<SecurityContext | null>;
  dispatch?: (request: Request, identity?: SecurityContext) => Promise<Response>;
  telemetry?: BackendTelemetrySink;
}

let secretPromise: Promise<string> | undefined;
async function localSigningSecret(): Promise<string> {
  const configured = process.env.SESSION_SIGNING_SECRET || process.env.JWT_SIGNING_SECRET;
  if (configured && configured.length >= 32 && !/placeholder|change.me|dev_jwt_secret/i.test(configured)) return configured;
  if (!secretPromise) secretPromise = (async () => {
    const file = path.resolve(process.env.VACATINA_LOCAL_SESSION_KEY_PATH || '.data/guest-session.key');
    await fs.mkdir(path.dirname(file), { recursive: true });
    try { return (await fs.readFile(file, 'utf8')).trim(); }
    catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      const secret = crypto.randomBytes(48).toString('base64url');
      try { await fs.writeFile(file, secret, { flag: 'wx', mode: 0o600 }); return secret; }
      catch (error: any) { if (error.code === 'EEXIST') return (await fs.readFile(file, 'utf8')).trim(); throw error; }
    }
  })();
  return secretPromise;
}

/** Loopback-only development entry. It cannot serve production or Vercel. */
export function createDevelopmentHttpApplication(options: DevelopmentHttpOptions = {}): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const requestId = requestCorrelationId(request.headers.get('x-request-id'));
    const started = Date.now(); let observed = false;
    const finish = (response: Response) => {
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Vary', 'Cookie, Authorization');
      response.headers.set('X-Request-Id', requestId);
      if (!observed) {
        observed = true;
        backendTelemetry({ requestId, operation: 'http.request', status: String(response.status), latencyMs: Date.now() - started }, options.telemetry);
      }
      return response;
    };
    const fail = (status: number, code: string, detail: string) => finish(createProblemResponse(status, code.replace(/_/g, ' '), detail, url.pathname, code));
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return fail(503, 'DEVELOPMENT_ONLY', 'This local API cannot run in production.');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return fail(403, 'LOOPBACK_REQUIRED', 'This local API accepts loopback requests only.');
    if (!url.pathname.startsWith('/api/v1/')) return fail(404, 'API_NOT_FOUND', 'Unknown API route.');
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return fail(403, 'ORIGIN_NOT_ALLOWED', 'Cross-origin requests are not accepted by the local API.');
    if (method === 'OPTIONS') return finish(new Response(null, { status: 204 }));
    if (url.pathname === '/api/v1/health' && method === 'GET') return finish(createJsonResponse({ status: 'OK', runtime: 'SERVER', developmentOnly: true, storageMode: 'LOCAL_DURABLE', productionWritesEnabled: false }));
    const publicConfig = () => ({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '', frontendApi: CLERK_VERIFIER_CONFIG.issuer });
    if (url.pathname === '/api/v1/config' && method === 'GET') return finish(createJsonResponse({ clerk: publicConfig(), developmentOnly: true }));
    try {
      const sessions = new GuestSessionManager(options.sessionSecret || await localSigningSecret());
      const guest = sessions.resolve(request.headers.get('cookie'));
      const identity = await (options.authenticate || authenticateClerkHttpRequest)(request);
      const tokenPresent = Boolean(request.headers.get('authorization') || request.headers.get('cookie')?.split(';').some(value => value.trim().startsWith('__session=')));
      if (tokenPresent && !identity) return fail(401, 'INVALID_SESSION', 'Your sign-in session could not be verified. Sign in again.');
      const sessionId = identity ? 'account_' + crypto.createHash('sha256').update(identity.userId).digest('hex').slice(0, 40) : guest.session.id;
      const respond = (response: Response) => { if (guest.setCookie) response.headers.append('Set-Cookie', guest.setCookie); return finish(response); };
      if (url.pathname === '/api/v1/session' && method === 'GET') return respond(createJsonResponse({ sessionId, authenticated: Boolean(identity), csrfToken: guest.session.csrf, user: identity ? { id: identity.userId, email: identity.email, role: identity.role, organizationId: identity.organizationId, isElevatedMfa: Boolean(identity.isElevatedMfa) } : null, clerk: publicConfig(), capabilities: { localDurableStorage: true, productionWrites: false } }));
      const unsafe = !['GET', 'HEAD'].includes(method);
      const webhook = /^\/api\/v1\/webhooks\/(stripe|paypal|payhere|payments)$/.test(url.pathname);
      if (unsafe && !webhook && !request.headers.get('authorization') && (!origin || !sessions.verifyCsrf(guest.session, request.headers.get('x-csrf-token')))) return respond(fail(403, 'CSRF_VALIDATION_FAILED', 'Refresh the page before trying again.'));
      if (url.pathname.startsWith('/api/v1/admin/')) {
        if (!identity) return respond(fail(401, 'SIGN_IN_REQUIRED', 'Sign in to access administration.'));
        if (identity.role === 'PLATFORM_ADMIN' && !identity.isElevatedMfa) return respond(fail(403, 'MFA_REQUIRED', 'Recent multi-factor verification is required for platform administration.'));
      }
      const headers = new Headers(request.headers);
      headers.set('x-session-id', sessionId);
      headers.set('x-vacatina-runtime', 'server');
      headers.set('x-request-id', requestId);
      headers.delete('x-user-id'); headers.delete('x-user-role'); headers.delete('x-organization-id');
      const scopedUrl = new URL(url); scopedUrl.searchParams.set('sessionId', sessionId);
      let body: string | undefined;
      if (unsafe) {
        body = await request.text();
        if (Buffer.byteLength(body) > 524288) return respond(fail(413, 'REQUEST_TOO_LARGE', 'The request exceeds the local size limit.'));
        if (!webhook) {
          if (!(headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return respond(fail(415, 'JSON_REQUIRED', 'Send an application/json request.'));
          let parsed: Record<string, unknown>;
          try { parsed = body ? JSON.parse(body) : {}; } catch { return respond(fail(400, 'INVALID_JSON', 'The JSON request could not be read.')); }
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return respond(fail(400, 'INVALID_JSON', 'Send a JSON object.'));
          parsed.sessionId = sessionId; delete parsed.securityContext; delete parsed.actorRole;
          body = JSON.stringify(parsed);
        }
      }
      const scopedRequest = new Request(scopedUrl, { method, headers, body: unsafe ? body : undefined });
      const persistence = options.persistence || getRuntimePersistence();
      const dispatch = options.dispatch || ((req, context) => globalApiRouter.handleRequest(req, context));
      return respond(await persistence.run(() => dispatch(scopedRequest, identity || undefined)));
    } catch {
      return fail(503, 'LOCAL_RUNTIME_UNAVAILABLE', 'The local service could not complete the request. Please try again.');
    }
  };
}

export const handleDevelopmentHttpRequest = createDevelopmentHttpApplication();
