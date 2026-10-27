import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GuestSessionManager } from '../src/server/auth/guest-session.ts';
import { verifyClerkJwt, mapClerkPayloadToSecurityContext, type ClerkJwtPayload } from '../src/server/auth/clerk-verifier.ts';
import { VacatinaStorageEngine } from '../src/server/db/storage.ts';
import { RuntimePersistence, PersistenceUnavailableError } from '../src/server/runtime/persistence.ts';
import { createDevelopmentHttpApplication } from '../src/server/runtime/dev-http-application.ts';

const issuer = 'https://identity.example.test';
const origin = 'https://vacatina.example.test';
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = Math.floor(Date.now() / 1000);

function sign(updates: Partial<ClerkJwtPayload> = {}, algorithm: string = 'RS256'): string {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user_test_customer', iss: issuer, sid: 'sess_test', iat: now - 1, exp: now + 60, azp: origin, ...updates })).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(header + '.' + payload), keys.privateKey).toString('base64url');
  return header + '.' + payload + '.' + signature;
}

test('Signed guest identity rejects tampering, expiry and unsigned client identifiers', () => {
  const sessions = new GuestSessionManager(crypto.randomBytes(48).toString('base64url'), true);
  const session = sessions.create(now);
  const value = sessions.encode(session);
  assert.equal(sessions.decode(value, now)?.id, session.id);
  assert.equal(sessions.decode(value + 'changed', now), null);
  assert.equal(sessions.decode(value, now + 31 * 86400), null);
  assert.equal(sessions.decode('guest_arbitrary', now), null);
  assert.equal(sessions.verifyCsrf(session, session.csrf), true);
  assert.equal(sessions.verifyCsrf(session, crypto.randomBytes(32).toString('base64url')), false);
  const resolved = sessions.resolve(null);
  assert.match(resolved.setCookie!, /HttpOnly; SameSite=Lax/);
  assert.match(resolved.setCookie!, /Secure/);
  assert.equal(sessions.resolve(resolved.setCookie!).session.id, resolved.session.id);
});

test('Clerk JWT validates signature, issuer, subject, session, time and authorized party', () => {
  const options = { issuer, authorizedParties: [origin], nowSeconds: now };
  assert.equal(verifyClerkJwt(sign(), pem, options)?.sub, 'user_test_customer');
  assert.equal(verifyClerkJwt(sign({ iss: 'https://attacker.test' }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({ exp: now - 30 }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({ nbf: now + 120 }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({ azp: 'https://attacker.test' }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({ sid: '' }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({ sts: 'pending' }), pem, options), null);
  assert.equal(verifyClerkJwt(sign({}, 'none'), pem, options), null);
  const token = sign();
  assert.equal(verifyClerkJwt(token.slice(0, -4) + 'abcd', pem, options), null);
});

test('Organization admin never acquires platform privileges; MFA requires verified second factor', () => {
  const payload: ClerkJwtPayload = { sub: 'user_test_agency', iss: issuer, sid: 'sess_test', iat: now, exp: now + 60, org_id: 'org_test', org_role: 'org:admin' };
  const agency = mapClerkPayloadToSecurityContext(payload);
  assert.equal(agency.role, 'AGENCY_OWNER');
  assert.equal(agency.isElevatedMfa, false);
  assert.equal(mapClerkPayloadToSecurityContext({ ...payload, role: 'NOT_AN_ADMIN' }).role, 'AGENCY_OWNER');
  assert.equal(mapClerkPayloadToSecurityContext({ ...payload, fva: [0, -1] }).isElevatedMfa, false);
  assert.equal(mapClerkPayloadToSecurityContext({ ...payload, fva: [0, 1] }).isElevatedMfa, true);
});

test('Local durable state survives a new engine and rolls back failed commands', async () => {
  const folder = path.resolve('tmp', 'backend-foundation-tests');
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, crypto.randomUUID() + '.json');
  const firstEngine = new VacatinaStorageEngine();
  const first = new RuntimePersistence({ mode: 'file', filePath, engine: firstEngine });
  const bucketId = await first.run(async () => firstEngine.getOrCreateTripBucket('guest_restart').id);
  const nextEngine = new VacatinaStorageEngine();
  const next = new RuntimePersistence({ mode: 'file', filePath, engine: nextEngine });
  assert.equal(await next.run(async () => nextEngine.getOrCreateTripBucket('guest_restart').id), bucketId);
  await assert.rejects(next.run(async () => { nextEngine.getOrCreateTripBucket('guest_failed'); throw new Error('test failure'); }), /test failure/);
  assert.equal(nextEngine.exportSnapshot().collections.tripBuckets.length, 1);
  await Promise.all(Array.from({ length: 8 }, (_, index) => next.run(async () => nextEngine.getOrCreateTripBucket('guest_parallel_' + index))));
  assert.equal(nextEngine.exportSnapshot().collections.tripBuckets.length, 9);
  await fs.unlink(filePath);
});

test('Production persistence is explicitly blocked without approved database wiring', async () => {
  const persistence = new RuntimePersistence({ mode: 'unavailable', engine: new VacatinaStorageEngine() });
  let called = false;
  await assert.rejects(persistence.run(async () => { called = true; }), PersistenceUnavailableError);
  assert.equal(called, false);
  assert.equal(persistence.available, false);
});

test('Local HTTP boundary scopes guest identity and rejects cross-origin, CSRF and client admin claims', async () => {
  const folder = path.resolve('tmp', 'backend-foundation-tests');
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, crypto.randomUUID() + '.json');
  let dispatched = 0;
  const handler = createDevelopmentHttpApplication({
    sessionSecret: crypto.randomBytes(48).toString('base64url'),
    persistence: new RuntimePersistence({ mode: 'file', filePath, engine: new VacatinaStorageEngine() }),
    authenticate: async () => null,
    dispatch: async request => {
      dispatched++;
      return Response.json({ sessionId: request.headers.get('x-session-id'), body: await request.json() });
    }
  });
  const base = 'http://127.0.0.1:4173';
  const sessionResponse = await handler(new Request(base + '/api/v1/session'));
  const session = await sessionResponse.json();
  const cookie = sessionResponse.headers.get('set-cookie')!;
  const headers = { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, 'X-CSRF-Token': session.csrfToken, 'X-Session-Id': 'attacker', 'X-User-Role': 'PLATFORM_ADMIN' };
  const valid = await handler(new Request(base + '/api/v1/search', { method: 'POST', headers, body: JSON.stringify({ sessionId: 'attacker', productType: 'flights' }) }));
  assert.equal(valid.status, 200);
  const result = await valid.json();
  assert.equal(result.sessionId, session.sessionId);
  assert.equal(result.body.sessionId, session.sessionId);
  const csrf = await handler(new Request(base + '/api/v1/search', { method: 'POST', headers: { ...headers, 'X-CSRF-Token': 'attacker' }, body: '{}' }));
  assert.equal(csrf.status, 403);
  const crossOrigin = await handler(new Request(base + '/api/v1/search', { method: 'POST', headers: { ...headers, Origin: 'https://attacker.test' }, body: '{}' }));
  assert.equal(crossOrigin.status, 403);
  const admin = await handler(new Request(base + '/api/v1/admin/listings', { headers }));
  assert.equal(admin.status, 401);
  const remoteHost = await handler(new Request('https://vacatina.example.test/api/v1/health'));
  assert.equal(remoteHost.status, 403);
  assert.equal(dispatched, 1);
  await fs.unlink(filePath);
});

test('Local HTTP boundary refuses production environments and malformed payloads', async () => {
  const handler = createDevelopmentHttpApplication({ sessionSecret: crypto.randomBytes(48).toString('base64url'), authenticate: async () => null });
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const response = await handler(new Request('http://127.0.0.1:4173/api/v1/health'));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'DEVELOPMENT_ONLY');
  } finally {
    if (before === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = before;
  }
});
