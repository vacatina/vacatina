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
  JWT_SIGNING_SECRET: string;
  
  R2_BUCKET_NAME: string;
  R2_PRESIGNED_URL_TTL_SECONDS: number;
  
  PAYMENT_GATEWAY_DEFAULT: 'STRIPE' | 'PAYPAL' | 'COMMERCIAL_BANK_LK' | 'MOCK_SANDBOX';
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  DUFFEL_API_TOKEN?: string;
  LITEAPI_API_KEY?: string;
  
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  OTEL_SERVICE_NAME: string;
}

export function validateServerEnv(envSource: Record<string, string | undefined> = process.env): VacatinaServerEnv {
  const nodeEnv = (envSource.NODE_ENV || 'development') as VacatinaServerEnv['NODE_ENV'];
  const isProd = nodeEnv === 'production';

  const getRequired = (key: string, defaultForDev: string): string => {
    const val = envSource[key];
    if (!val || val.includes('placeholder')) {
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
    
    CLERK_PUBLISHABLE_KEY: getRequired('CLERK_PUBLISHABLE_KEY', 'pk_test_mock_key'),
    CLERK_SECRET_KEY: getRequired('CLERK_SECRET_KEY', 'sk_test_mock_key'),
    JWT_SIGNING_SECRET: getRequired('JWT_SIGNING_SECRET', 'dev_jwt_secret_32_characters_minimum_string'),
    
    R2_BUCKET_NAME: envSource.R2_BUCKET_NAME || 'vacatina-documents-private',
    R2_PRESIGNED_URL_TTL_SECONDS: parseInt(envSource.R2_PRESIGNED_URL_TTL_SECONDS || '900', 10),
    
    PAYMENT_GATEWAY_DEFAULT: (envSource.PAYMENT_GATEWAY_DEFAULT || 'MOCK_SANDBOX') as VacatinaServerEnv['PAYMENT_GATEWAY_DEFAULT'],
    STRIPE_SECRET_KEY: envSource.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: envSource.STRIPE_WEBHOOK_SECRET,
    
    DUFFEL_API_TOKEN: envSource.DUFFEL_API_TOKEN,
    LITEAPI_API_KEY: envSource.LITEAPI_API_KEY,
    
    LOG_LEVEL: (envSource.LOG_LEVEL || 'info') as VacatinaServerEnv['LOG_LEVEL'],
    OTEL_SERVICE_NAME: envSource.OTEL_SERVICE_NAME || 'vacatina-travel-os'
  };
}
