/* ============================================================================
 * Vacatina Server Environment Configuration & Startup Validator
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-001
 * ============================================================================ */

export interface VacatinaServerEnv {
  NODE_ENV: 'development' | 'test' | 'preview' | 'production';
  PORT: number;
  BASE_URL: string;
  APP_VERSION: string;
  
  DATABASE_URL: string;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
  
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_FRONTEND_API?: string;
  CLERK_JWKS_URL?: string;
  CLERK_JWT_PUBLIC_KEY?: string;
  JWT_SIGNING_SECRET: string;
  
  R2_BUCKET_NAME: string;
  R2_PRESIGNED_URL_TTL_SECONDS: number;
  
  PAYMENT_GATEWAY_DEFAULT: 'STRIPE' | 'PAYPAL' | 'COMMERCIAL_BANK_LK' | 'MOCK_SANDBOX';
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  DUFFEL_ENV?: 'test' | 'live';
  DUFFEL_ACCESS_TOKEN?: string;
  /** @deprecated Canonical runtime variable is DUFFEL_ACCESS_TOKEN */
  DUFFEL_API_TOKEN?: string;
  /** @deprecated Canonical runtime variable is DUFFEL_ACCESS_TOKEN */
  DUFFEL_TOKEN?: string;
  AMADEUS_ENV?: 'test' | 'production';
  AMADEUS_CLIENT_ID?: string;
  AMADEUS_CLIENT_SECRET?: string;
  LITEAPI_ENV?: 'sandbox' | 'production';
  LITEAPI_API_KEY?: string;
  VIATOR_ENV?: 'sandbox' | 'production';
  VIATOR_API_KEY?: string;
  TRAINLINE_ENV?: 'sandbox' | 'production';
  TRAINLINE_API_KEY?: string;
  
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  OTEL_SERVICE_NAME: string;
}

export function validateServerEnv(envSource: Record<string, string | undefined> = process.env): VacatinaServerEnv {
  const nodeEnv = (envSource.NODE_ENV || 'development') as VacatinaServerEnv['NODE_ENV'];
  const isProd = nodeEnv === 'production';
  if (isProd && envSource.VACATINA_CLERK_ROTATION_CONFIRMED !== 'true') {
    throw new Error('[CRITICAL STARTUP ERROR] Clerk key rotation/revocation requires explicit owner confirmation before production use.');
  }
  if (isProd) {
    let origin: URL;
    try { origin = new URL(envSource.BASE_URL || ''); } catch { throw new Error('[CRITICAL STARTUP ERROR] BASE_URL must be an explicit production HTTPS origin.'); }
    if (origin.protocol !== 'https:' || origin.username || origin.password || ['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('[CRITICAL STARTUP ERROR] BASE_URL must be a production HTTPS origin.');
  }

  const getRequired = (key: string, defaultForDev: string): string => {
    const val = envSource[key];
    if (!val || /placeholder/i.test(val) || (isProd && /mock|fixture|unit-test|not-a-real|dev_jwt_secret/i.test(val))) {
      if (isProd) {
        throw new Error(`[CRITICAL STARTUP ERROR] Missing or placeholder value for required production environment variable: ${key}`);
      }
      return defaultForDev;
    }
    return val;
  };

  return {
    NODE_ENV: nodeEnv,
    PORT: parseInt(envSource.PORT || '3000', 10),
    BASE_URL: envSource.BASE_URL || 'https://vacatina-nu.vercel.app',
    APP_VERSION: envSource.APP_VERSION || '1.0.0',
    
    DATABASE_URL: getRequired('DATABASE_URL', 'postgresql://localhost:5432/vacatina_dev'),
    DATABASE_POOL_MIN: parseInt(envSource.DATABASE_POOL_MIN || '2', 10),
    DATABASE_POOL_MAX: parseInt(envSource.DATABASE_POOL_MAX || '10', 10),
    
    CLERK_PUBLISHABLE_KEY: (() => {
      const val = envSource.CLERK_PUBLISHABLE_KEY || envSource.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      if ((!val || val.includes('placeholder')) && isProd) {
        throw new Error('[CRITICAL STARTUP ERROR] Missing or placeholder CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
      }
      if (isProd && !val.startsWith('pk_live_')) throw new Error('[CRITICAL STARTUP ERROR] A production Clerk publishable key is required.');
      return val || 'pk_test_mock_key';
    })(),
    CLERK_SECRET_KEY: (() => {
      const value = getRequired('CLERK_SECRET_KEY', 'sk_test_mock_key');
      if (isProd && !value.startsWith('sk_live_')) throw new Error('[CRITICAL STARTUP ERROR] A rotated production Clerk secret is required.');
      return value;
    })(),
    CLERK_FRONTEND_API: (() => {
      const issuer = envSource.CLERK_ISSUER || envSource.CLERK_FRONTEND_API;
      if (isProd) {
        let url: URL;
        try { url = new URL(issuer || ''); } catch { throw new Error('[CRITICAL STARTUP ERROR] An explicit production Clerk issuer is required.'); }
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('[CRITICAL STARTUP ERROR] Clerk issuer must use HTTPS.');
      }
      return issuer || 'https://electric-snail-48.clerk.accounts.dev';
    })(),
    CLERK_JWKS_URL: envSource.CLERK_JWKS_URL || (envSource.CLERK_ISSUER || envSource.CLERK_FRONTEND_API || 'https://electric-snail-48.clerk.accounts.dev').replace(/\/$/, '') + '/.well-known/jwks.json',
    CLERK_JWT_PUBLIC_KEY: envSource.CLERK_JWT_PUBLIC_KEY,
    JWT_SIGNING_SECRET: (() => {
      const value = getRequired('JWT_SIGNING_SECRET', 'dev_jwt_secret_32_characters_minimum_string');
      if (isProd && value.length < 32) throw new Error('[CRITICAL STARTUP ERROR] JWT_SIGNING_SECRET must contain at least 32 characters.');
      return value;
    })(),
    
    R2_BUCKET_NAME: envSource.R2_BUCKET_NAME || 'vacatina-documents-private',
    R2_PRESIGNED_URL_TTL_SECONDS: parseInt(envSource.R2_PRESIGNED_URL_TTL_SECONDS || '900', 10),
    
    PAYMENT_GATEWAY_DEFAULT: (envSource.PAYMENT_GATEWAY_DEFAULT || 'MOCK_SANDBOX') as VacatinaServerEnv['PAYMENT_GATEWAY_DEFAULT'],
    STRIPE_SECRET_KEY: envSource.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: envSource.STRIPE_WEBHOOK_SECRET,
    
    // Canonical Duffel runtime resolution with strict migration fallback:
    // DUFFEL_ACCESS_TOKEN -> DUFFEL_API_TOKEN -> DUFFEL_TOKEN
    ...(() => {
      const duffelToken = (
        envSource.DUFFEL_ACCESS_TOKEN?.trim() ||
        envSource.DUFFEL_API_TOKEN?.trim() ||
        envSource.DUFFEL_TOKEN?.trim() ||
        undefined
      );
      const isLiveToken = Boolean(duffelToken && duffelToken.startsWith('duffel_live_'));
      const isLiveEnv = envSource.DUFFEL_ENV === 'live' || envSource.DUFFEL_ENVIRONMENT === 'production';
      const duffelEnv = (isLiveToken || isLiveEnv) ? 'live' : 'test';

      return {
        DUFFEL_ENV: duffelEnv as 'test' | 'live',
        DUFFEL_ACCESS_TOKEN: duffelToken,
        DUFFEL_API_TOKEN: duffelToken,
        DUFFEL_TOKEN: duffelToken
      };
    })(),
    AMADEUS_ENV: (envSource.AMADEUS_ENV || 'test') as any,
    AMADEUS_CLIENT_ID: envSource.AMADEUS_CLIENT_ID,
    AMADEUS_CLIENT_SECRET: envSource.AMADEUS_CLIENT_SECRET,
    LITEAPI_ENV: (envSource.LITEAPI_ENV || 'sandbox') as any,
    LITEAPI_API_KEY: envSource.LITEAPI_API_KEY,
    VIATOR_ENV: (envSource.VIATOR_ENV || 'sandbox') as any,
    VIATOR_API_KEY: envSource.VIATOR_API_KEY,
    TRAINLINE_ENV: (envSource.TRAINLINE_ENV || 'sandbox') as any,
    TRAINLINE_API_KEY: envSource.TRAINLINE_API_KEY,
    
    LOG_LEVEL: (envSource.LOG_LEVEL || 'info') as VacatinaServerEnv['LOG_LEVEL'],
    OTEL_SERVICE_NAME: envSource.OTEL_SERVICE_NAME || 'vacatina-travel-os'
  };
}
