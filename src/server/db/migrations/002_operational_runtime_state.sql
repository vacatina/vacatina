-- Durable transaction boundary for the modular runtime. Apply through the managed
-- database migration workflow; application startup never creates remote tables.
-- The row is locked before hydration so booking/payment/idempotency updates are
-- committed together across concurrent application instances.
CREATE TABLE IF NOT EXISTS vacatina_runtime_state (
  namespace TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
