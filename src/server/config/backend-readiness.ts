export interface BackendReadinessConfig {
  production: boolean; writesRequested: boolean; migrationApproved: boolean;
  clerkRotationConfirmed: boolean; productionWritesEnabled: boolean;
  supplierActivationEnabled: false; paymentActivationEnabled: false; blockers: string[];
}

/** Owner attestations are launch gates, not proof that a credential has been revoked. No secret is inspected here. */
export function readBackendReadinessConfig(env: Record<string, string | undefined> = process.env): BackendReadinessConfig {
  const production = env.NODE_ENV === 'production' || env.VERCEL === '1';
  const writesRequested = env.VACATINA_ENABLE_PRODUCTION_WRITES === 'true';
  const migrationApproved = env.VACATINA_MIGRATION_APPROVED === 'true' && env.VACATINA_SCHEMA_VERSION === '003';
  const clerkRotationConfirmed = env.VACATINA_CLERK_ROTATION_CONFIRMED === 'true';
  const blockers = [
    ...(!clerkRotationConfirmed ? ['CLERK_ROTATION_UNCONFIRMED'] : []),
    ...(!migrationApproved ? ['MIGRATION_NOT_APPROVED'] : []),
    ...(!env.DATABASE_URL ? ['DATABASE_NOT_PROVISIONED'] : []),
    ...(!writesRequested ? ['PRODUCTION_WRITES_DISABLED'] : [])
  ];
  return { production, writesRequested, migrationApproved, clerkRotationConfirmed,
    productionWritesEnabled: production && blockers.length === 0,
    supplierActivationEnabled: false, paymentActivationEnabled: false, blockers };
}
