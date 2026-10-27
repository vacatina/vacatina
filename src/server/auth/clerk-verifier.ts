import crypto from 'node:crypto';
import type { SecurityContext } from './rbac.ts';
import type { UserRole } from '../db/schema.ts';

export interface ClerkJwtPayload {
  sub: string; iss: string; iat: number; exp: number;
  nbf?: number; azp?: string; sid?: string; sts?: string;
  aud?: string | string[]; email?: string; role?: string; vacatina_role?: string;
  org_id?: string; org_role?: string; o?: { id?: string; rol?: string };
  fva?: number[]; public_metadata?: Record<string, unknown>;
}

function issuerFromEnvironment(): string {
  const configured = process.env.CLERK_ISSUER || process.env.CLERK_FRONTEND_API;
  if (configured) return configured.replace(/\/$/, '');
  const key = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return '';
  try {
    const domain = Buffer.from(key.split('_').slice(2).join('_'), 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(domain) ? 'https://' + domain : '';
  } catch { return ''; }
}

/** Server-only keys. Configuration is read at request time after env loading. */
export const CLERK_VERIFIER_CONFIG = {
  get issuer(): string { return issuerFromEnvironment(); },
  get jwksUrl(): string { return process.env.CLERK_JWKS_URL || (this.issuer ? this.issuer + '/.well-known/jwks.json' : ''); },
  apiUrl: 'https://api.clerk.com/v1',
  get secretKey(): string { return process.env.CLERK_SECRET_KEY || ''; },
  get publicKeyPem(): string { return (process.env.CLERK_JWT_PUBLIC_KEY || process.env.CLERK_JWT_KEY || '').replace(/\\n/g, '\n'); }
};

export function decodeJwtUnverified(token: string): { header: Record<string, any>; payload: ClerkJwtPayload } | null {
  try {
    if (token.length > 16384) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    return { header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')), payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) };
  } catch { return null; }
}

export interface ClerkVerificationOptions {
  issuer?: string; authorizedParties?: string[]; audience?: string; nowSeconds?: number;
}

/** Matches Clerk's documented RS256 signature, issuer, time and authorized-party checks. */
export function verifyClerkJwt(token: string, customPem?: string, options: ClerkVerificationOptions = {}): ClerkJwtPayload | null {
  try {
    const decoded = decodeJwtUnverified(token);
    if (!decoded || decoded.header.alg !== 'RS256') return null;
    const payload = decoded.payload;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    const issuer = options.issuer ?? CLERK_VERIFIER_CONFIG.issuer;
    if (!issuer || payload.iss !== issuer || typeof payload.sub !== 'string' || !payload.sub.startsWith('user_')) return null;
    if (!Number.isFinite(payload.exp) || !Number.isFinite(payload.iat) || payload.exp <= now - 5 || payload.iat > now + 5) return null;
    if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > now + 5)) return null;
    if (payload.sts === 'pending' || !payload.sid) return null;
    const authorized = options.authorizedParties ?? (process.env.CLERK_AUTHORIZED_PARTIES || process.env.APP_ORIGIN || process.env.BASE_URL || '').split(',').map(s => s.trim()).filter(Boolean);
    if (payload.azp && (!authorized.length || !authorized.includes(payload.azp))) return null;
    const audience = options.audience || process.env.CLERK_JWT_AUDIENCE;
    if (audience && !(Array.isArray(payload.aud) ? payload.aud.includes(audience) : payload.aud === audience)) return null;
    const pem = customPem || CLERK_VERIFIER_CONFIG.publicKeyPem;
    if (!pem) return null;
    const parts = token.split('.');
    if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pem, Buffer.from(parts[2], 'base64url'))) return null;
    return payload;
  } catch { return null; }
}

const roleAliases: Record<string, UserRole> = {
  CUSTOMER: 'CUSTOMER', AGENCY_OWNER: 'AGENCY_OWNER', AGENCY_MANAGER: 'AGENCY_MANAGER',
  BOOKING_AGENT: 'BOOKING_AGENT', B2B_AGENT: 'BOOKING_AGENT', CORPORATE_COORDINATOR: 'CORPORATE_COORDINATOR',
  SUPPLIER_USER: 'SUPPLIER_USER', SUPPORT_STAFF: 'SUPPORT_STAFF', FINANCE_OPS: 'FINANCE_OPS',
  FINANCE_OFFICER: 'FINANCE_OPS', CONTENT_MARKETING: 'CONTENT_MARKETING', ANALYTICS: 'ANALYTICS',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', VISA_OFFICER: 'VISA_OFFICER', OPS_SUPERVISOR: 'OPS_SUPERVISOR'
};

/** Call only with verified claims. Organization admins do not become platform admins. */
export function mapClerkPayloadToSecurityContext(payload: ClerkJwtPayload): SecurityContext {
  const metadata = payload.public_metadata || {};
  const admins = (process.env.CLERK_PLATFORM_ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const claim = payload.vacatina_role || metadata.vacatinaRole || payload.role;
  let role = typeof claim === 'string' ? roleAliases[claim.toUpperCase()] || 'CUSTOMER' : 'CUSTOMER';
  const organizationId = payload.o?.id || payload.org_id;
  if (admins.includes(payload.sub)) role = 'PLATFORM_ADMIN';
  if (role === 'CUSTOMER' && organizationId) {
    const orgRole = (payload.o?.rol || payload.org_role || '').replace(/^org:/, '').toLowerCase();
    if (orgRole === 'admin') role = 'AGENCY_OWNER';
    else if (orgRole === 'member') role = 'BOOKING_AGENT';
  }
  return {
    userId: payload.sub,
    email: payload.email || (typeof metadata.email === 'string' ? metadata.email : ''),
    role, organizationId, organizationType: organizationId ? 'AGENCY' : undefined,
    isElevatedMfa: Array.isArray(payload.fva) && Number.isFinite(payload.fva[1]) && payload.fva[1] >= 0 && payload.fva[1] <= 10
  };
}

export function authenticateClerkRequest(authHeaderOrToken: string): SecurityContext | null {
  const token = authHeaderOrToken?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const payload = verifyClerkJwt(token);
  return payload ? mapClerkPayloadToSecurityContext(payload) : null;
}

let jwksCache: { url: string; expires: number; keys: Array<Record<string, any>> } | undefined;

export async function authenticateClerkHttpRequest(request: Request): Promise<SecurityContext | null> {
  const cookieToken = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('__session='))?.slice(10);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || cookieToken;
  if (!token) return null;
  const origin = new URL(request.url).origin;
  const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || process.env.APP_ORIGIN || process.env.BASE_URL || origin).split(',').map(s => s.trim()).filter(Boolean);
  if (CLERK_VERIFIER_CONFIG.publicKeyPem) {
    const payload = verifyClerkJwt(token, undefined, { authorizedParties });
    return payload ? mapClerkPayloadToSecurityContext(payload) : null;
  }
  const decoded = decodeJwtUnverified(token);
  const url = CLERK_VERIFIER_CONFIG.jwksUrl;
  // Never fetch a key URL supplied by unverified token claims.
  if (!decoded || !url || !CLERK_VERIFIER_CONFIG.issuer || !url.startsWith(CLERK_VERIFIER_CONFIG.issuer + '/')) return null;
  try {
    if (!jwksCache || jwksCache.url !== url || jwksCache.expires < Date.now() || !jwksCache.keys.some(k => k.kid === decoded.header.kid)) {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) return null;
      const body = await response.json() as { keys?: Array<Record<string, any>> };
      if (!Array.isArray(body.keys)) return null;
      jwksCache = { url, expires: Date.now() + 300000, keys: body.keys };
    }
    const jwk = jwksCache.keys.find(k => k.kid === decoded.header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256'));
    if (!jwk) return null;
    const pem = crypto.createPublicKey({ key: jwk as any, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString();
    const payload = verifyClerkJwt(token, pem, { authorizedParties });
    return payload ? mapClerkPayloadToSecurityContext(payload) : null;
  } catch { return null; }
}
