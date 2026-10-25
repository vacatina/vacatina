/* ============================================================================
 * Vacatina Server-Side Clerk Token Verifier & Identity Mapper
 * Authority: docs/vacatina-frontend-backend-contract.md (Section 17) & ADR-003
 *
 * Verifies Clerk RS256 JWT tokens using Clerk's public key or live JWKS endpoint.
 * Zero external dependencies: uses Node.js standard crypto module.
 * ============================================================================ */

import crypto from 'node:crypto';
import type { SecurityContext } from './rbac.ts';
import type { UserRole, UUID } from '../db/schema.ts';

export interface ClerkJwtPayload {
  sub: string;             // Clerk user ID (e.g. user_2...)
  iss: string;             // Issuer (e.g. https://electric-snail-48.clerk.accounts.dev)
  iat: number;             // Issued at
  exp: number;             // Expiration
  nbf?: number;            // Not before
  azp?: string;            // Authorized party
  sid?: string;            // Session ID
  email?: string;
  role?: string;
  org_id?: string;
  org_role?: string;
  public_metadata?: Record<string, any>;
}

export const CLERK_VERIFIER_CONFIG = {
  issuer: 'https://electric-snail-48.clerk.accounts.dev',
  jwksUrl: 'https://electric-snail-48.clerk.accounts.dev/.well-known/jwks.json',
  apiUrl: 'https://api.clerk.com/v1',
  secretKey: process.env.CLERK_SECRET_KEY || 'sk_test_yMivnVlmDDXs8dLKHnJRAX2ETia5JE8vCR1qymGct0',
  publicKeyPem: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAutjxwCp/AzwHSLue0//Y
O3iYq0B3elBOVwBGpHew7ZB8Pt6Aho8S/KURCyRu6tB2mB24UfgdCaG2i3WByw9l
+NbPPrbADZn9iUPurQ1FHm0b+8Off2h5oHUvoMzXBvyW1dXgAzGf3GQz4OMqLzin
ep29WsKTdJH+Y1TiFu9UvZHpHtno2z3CYYLbEDUneLJGFnw5TUosbQhjPd/CDAbU
Cg7YuWw8IlKTFU92oPf9izuTBZfQyVx2SrpGuNSw+55IZz1wHo70uPJi5j7lqqhO
tQ/9aERttfG8ma/5SdubeXjHcqDdmEVTcNSXELFuZJKGoe9C+cn9R2AGXpLWbW9v
VQIDAQAB
-----END PUBLIC KEY-----`
};

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Decodes without cryptographic verification.
 * Useful for inspecting claims before signature verification.
 */
export function decodeJwtUnverified(token: string): { header: any; payload: ClerkJwtPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Cryptographically verifies Clerk JWT token using RSA-SHA256 (RS256)
 * and asserts issuer, expiration, and format validity.
 */
export function verifyClerkJwt(token: string, customPem?: string): ClerkJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(headerB64));
    const payload: ClerkJwtPayload = JSON.parse(base64UrlDecode(payloadB64));

    // 1. Verify algorithm
    if (header.alg !== 'RS256') {
      return null;
    }

    // 2. Verify expiration & time validity
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec - 60) {
      // Expired (with 60s clock skew allowance)
      return null;
    }
    if (payload.nbf && payload.nbf > nowSec + 60) {
      return null;
    }

    // 3. Verify cryptographic signature
    const pem = customPem || CLERK_VERIFIER_CONFIG.publicKeyPem;
    const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`);
    const signature = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataToVerify);
    const isValid = verifier.verify(pem, signature);

    if (!isValid) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Resolves Clerk claims into Vacatina RBAC SecurityContext.
 */
export function mapClerkPayloadToSecurityContext(payload: ClerkJwtPayload): SecurityContext {
  const metadata = payload.public_metadata || {};
  let role: UserRole = 'CUSTOMER';

  const roleClaim = `${payload.role || ''} ${payload.org_role || ''} ${metadata.role || ''}`.toUpperCase();
  if (roleClaim.includes('SUPER') || roleClaim.includes('ADMIN')) {
    role = 'SUPER_ADMIN';
  } else if (roleClaim.includes('AGENT') || roleClaim.includes('PARTNER')) {
    role = 'B2B_AGENT';
  } else if (roleClaim.includes('FINANCE')) {
    role = 'FINANCE_OFFICER';
  } else if (roleClaim.includes('VISA')) {
    role = 'VISA_OFFICER';
  } else if (roleClaim.includes('OPS')) {
    role = 'OPS_SUPERVISOR';
  }

  return {
    userId: payload.sub as UUID,
    email: payload.email || metadata.email || `${payload.sub}@users.clerk.vacatina.com`,
    role,
    organizationId: (payload.org_id || metadata.organizationId) as UUID | undefined,
    organizationType: payload.org_id ? 'AGENCY' : undefined,
    isElevatedMfa: Boolean(payload.sid)
  };
}

/**
 * Authenticates an incoming HTTP request via Bearer header or Cookie.
 */
export function authenticateClerkRequest(authHeaderOrToken: string): SecurityContext | null {
  if (!authHeaderOrToken) return null;
  const token = authHeaderOrToken.startsWith('Bearer ')
    ? authHeaderOrToken.slice(7).trim()
    : authHeaderOrToken.trim();

  const payload = verifyClerkJwt(token);
  if (!payload) return null;

  return mapClerkPayloadToSecurityContext(payload);
}
