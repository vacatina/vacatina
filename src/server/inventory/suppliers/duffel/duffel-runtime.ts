/* ============================================================================
 * Vacatina Duffel Test-Mode Runtime Boundary
 * Authority: Phase 16 plan; Duffel test mode is sandbox-only.
 *
 * Production / live mode can never be activated through this module:
 * - NODE_ENV=production disables it.
 * - DUFFEL_ENV=live disables it.
 * - duffel_live_ tokens are rejected, never downgraded or used.
 * - A duffel_test_ token AND DUFFEL_TEST_MODE_ENABLED=true are required.
 * ============================================================================ */

import { DuffelClient } from './duffel-client.ts';

export type DuffelTokenKind = 'TEST' | 'NONE' | 'LIVE_BLOCKED';

export interface DuffelTestModeState {
  provider: 'DUFFEL_NDC';
  enabled: boolean;
  environment: 'SANDBOX';
  liveModeAllowed: false;
  tokenKind: DuffelTokenKind;
  reason:
    | 'ENABLED'
    | 'TEST_MODE_FLAG_DISABLED'
    | 'PRODUCTION_RUNTIME_BLOCKED'
    | 'LIVE_ENV_BLOCKED'
    | 'LIVE_TOKEN_BLOCKED'
    | 'TEST_TOKEN_REQUIRED';
}

export interface DuffelTestModeConfig extends DuffelTestModeState {
  /** Never serialise this field. It is only consumed by the server client. */
  token?: string;
}

function readEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return env;
}

export function resolveDuffelTestModeConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): DuffelTestModeConfig {
  const source = readEnv(env);
  const token = (
    source.DUFFEL_ACCESS_TOKEN?.trim() ||
    source.DUFFEL_API_TOKEN?.trim() ||
    source.DUFFEL_TOKEN?.trim() ||
    undefined
  );
  const tokenKind: DuffelTokenKind = !token
    ? 'NONE'
    : token.startsWith('duffel_live_')
      ? 'LIVE_BLOCKED'
      : token.startsWith('duffel_test_')
        ? 'TEST'
        : 'NONE';

  const base = {
    provider: 'DUFFEL_NDC' as const,
    environment: 'SANDBOX' as const,
    liveModeAllowed: false as const,
    tokenKind
  };

  if (source.NODE_ENV === 'production' || source.VACATINA_ENV === 'production') {
    return { ...base, enabled: false, reason: 'PRODUCTION_RUNTIME_BLOCKED' };
  }
  if (source.DUFFEL_ENV === 'live' || source.DUFFEL_ENVIRONMENT === 'production') {
    return { ...base, enabled: false, reason: 'LIVE_ENV_BLOCKED' };
  }
  if (tokenKind === 'LIVE_BLOCKED') {
    return { ...base, enabled: false, reason: 'LIVE_TOKEN_BLOCKED' };
  }
  if (source.DUFFEL_TEST_MODE_ENABLED !== 'true') {
    return { ...base, enabled: false, reason: 'TEST_MODE_FLAG_DISABLED' };
  }
  if (tokenKind !== 'TEST') {
    return { ...base, enabled: false, reason: 'TEST_TOKEN_REQUIRED' };
  }
  return { ...base, enabled: true, reason: 'ENABLED', token };
}

/** Safe status for the browser. Contains no credential material. */
export function getDuffelTestModeStatus(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): DuffelTestModeState {
  const { token: _token, ...safe } = resolveDuffelTestModeConfig(env);
  return safe;
}

/**
 * Runtime status used by server services. In production it is identical to the
 * environment-derived status; the test-only override can only make the status
 * more restrictive or enable an injected fake client, never expose a token.
 */
export function getDuffelSandboxRuntimeStatus(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): DuffelTestModeState {
  const safe = getDuffelTestModeStatus(env);
  if (testEnabledOverride === undefined) return safe;
  return {
    ...safe,
    enabled: testEnabledOverride,
    reason: testEnabledOverride ? 'ENABLED' : safe.reason
  };
}

let testClientOverride: DuffelClient | undefined;
let testEnabledOverride: boolean | undefined;
let cachedClient: DuffelClient | undefined;
let cachedTokenFingerprint: string | undefined;

function fingerprint(token: string): string {
  // Non-reversible short fingerprint; never log or return the token itself.
  let hash = 2166136261;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** Test-only seam. Never called by production code paths. */
export function configureDuffelSandboxRuntimeForTests(input: {
  client?: DuffelClient;
  enabled?: boolean;
}): void {
  testClientOverride = input.client;
  testEnabledOverride = input.enabled;
  cachedClient = undefined;
  cachedTokenFingerprint = undefined;
}

export function resetDuffelSandboxRuntimeForTests(): void {
  testClientOverride = undefined;
  testEnabledOverride = undefined;
  cachedClient = undefined;
  cachedTokenFingerprint = undefined;
}

export function isDuffelSandboxRuntimeEnabled(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): boolean {
  if (testEnabledOverride !== undefined) return testEnabledOverride;
  return resolveDuffelTestModeConfig(env).enabled;
}

/**
 * Returns the server-only client when test mode is explicitly enabled.
 * Returns undefined for disabled/absent/live credentials; it never falls back
 * to a live token or to fabricated offers.
 */
export function getDuffelSandboxClient(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): DuffelClient | undefined {
  if (testClientOverride) return testClientOverride;
  const config = resolveDuffelTestModeConfig(env);
  if (!config.enabled || !config.token) return undefined;
  const print = fingerprint(config.token);
  if (!cachedClient || cachedTokenFingerprint !== print) {
    cachedClient = new DuffelClient({ accessToken: config.token });
    cachedTokenFingerprint = print;
  }
  return cachedClient;
}
