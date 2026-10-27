-- Phase 15: ADDITIVE ONLY. Prepared, never executed by application startup.
-- PostgreSQL 14+. DBA approval, backup/restore rehearsal and staging validation are required.
-- The migration runner must explicitly SET vacatina.phase15_migration_approved = 'true'.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT 1 / CASE WHEN COALESCE(current_setting('vacatina.phase15_migration_approved', true), 'false') = 'true' THEN 1 ELSE 0 END AS migration_approval_guard;

CREATE TABLE vacatina_search_contexts (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id)
);
CREATE INDEX idx_search_owner ON vacatina_search_contexts (owner_id, created_at);

CREATE TABLE vacatina_offer_references (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, search_context_id TEXT,
  canonical_offer_id TEXT NOT NULL, supplier_id TEXT NOT NULL,
  environment_class TEXT NOT NULL CHECK (environment_class IN ('PRODUCTION','SANDBOX','SEED')),
  sellability TEXT NOT NULL CHECK (sellability IN ('BOOKABLE','QUOTE_ONLY','DISCOVERY_ONLY')),
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  CHECK (environment_class <> 'SEED' OR sellability = 'DISCOVERY_ONLY'),
  FOREIGN KEY (search_context_id, owner_id) REFERENCES vacatina_search_contexts (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX idx_offer_reference_source ON vacatina_offer_references (supplier_id, canonical_offer_id, created_at);
CREATE INDEX idx_offer_reference_owner ON vacatina_offer_references (owner_id, created_at);

CREATE TABLE vacatina_trip_aggregates (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','CHECKED_OUT','EXPIRED','ABANDONED')),
  revision BIGINT NOT NULL CHECK (revision > 0), payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id)
);
CREATE INDEX idx_trip_owner_status ON vacatina_trip_aggregates (owner_id, status, updated_at);

CREATE TABLE vacatina_trip_selections (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, trip_bucket_id TEXT NOT NULL, offer_reference_id TEXT NOT NULL,
  canonical_offer_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_bucket_id, canonical_offer_id), UNIQUE (id, trip_bucket_id, owner_id),
  FOREIGN KEY (trip_bucket_id, owner_id) REFERENCES vacatina_trip_aggregates (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (offer_reference_id, owner_id) REFERENCES vacatina_offer_references (id, owner_id) ON DELETE RESTRICT
);

CREATE TABLE vacatina_booking_aggregates (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, trip_bucket_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING_REVALIDATION','BOOKING','CONFIRMED','PARTIAL_FAILURE','FAILED','CANCEL_PENDING','CANCELLED','REFUND_PENDING','MANUAL_REVIEW','FULFILMENT_PENDING','FULFILLED','EXPIRED')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('UNPAID','AUTHORIZED','SETTLED','PARTIALLY_REFUNDED','REFUNDED','VOIDED')),
  revision BIGINT NOT NULL CHECK (revision > 0), amount_minor BIGINT NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), UNIQUE (id, trip_bucket_id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  FOREIGN KEY (trip_bucket_id, owner_id) REFERENCES vacatina_trip_aggregates (id, owner_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_active_booking_per_trip ON vacatina_booking_aggregates (trip_bucket_id) WHERE status NOT IN ('FAILED','EXPIRED','CANCELLED');
CREATE INDEX idx_booking_owner_status ON vacatina_booking_aggregates (owner_id, status, updated_at);

-- Relational integrity projections of existing canonical item models, not replacement domain types.
CREATE TABLE vacatina_booking_selections (
  booking_id TEXT NOT NULL, booking_item_id TEXT NOT NULL, owner_id TEXT NOT NULL, trip_bucket_id TEXT NOT NULL,
  trip_item_id TEXT NOT NULL, offer_reference_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, booking_item_id), UNIQUE (booking_id, trip_item_id), UNIQUE (booking_id, booking_item_id, owner_id),
  FOREIGN KEY (booking_id, trip_bucket_id, owner_id) REFERENCES vacatina_booking_aggregates (id, trip_bucket_id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (trip_item_id, trip_bucket_id, owner_id) REFERENCES vacatina_trip_selections (id, trip_bucket_id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (offer_reference_id, owner_id) REFERENCES vacatina_offer_references (id, owner_id) ON DELETE RESTRICT
);

CREATE TABLE vacatina_revalidation_records (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, trip_bucket_id TEXT NOT NULL, trip_item_id TEXT NOT NULL,
  offer_reference_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('UNCHANGED','PRICE_CHANGED','UNAVAILABLE','EXPIRED','RECHECK_REQUIRED')),
  correlation_id TEXT NOT NULL, payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  FOREIGN KEY (trip_bucket_id, owner_id) REFERENCES vacatina_trip_aggregates (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (offer_reference_id, owner_id) REFERENCES vacatina_offer_references (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (trip_item_id, trip_bucket_id, owner_id) REFERENCES vacatina_trip_selections (id, trip_bucket_id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX idx_revalidation_item_time ON vacatina_revalidation_records (trip_item_id, created_at);
CREATE INDEX idx_revalidation_correlation ON vacatina_revalidation_records (correlation_id);

CREATE TABLE vacatina_payment_references (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, booking_id TEXT NOT NULL,
  gateway_id TEXT NOT NULL CHECK (gateway_id IN ('STRIPE','PAYPAL','PAYHERE')),
  provider_reference TEXT, verified_event_id TEXT, request_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('PENDING','AUTHORIZED','CAPTURED','FAILED','VOIDED','REFUNDED')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991), currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  FOREIGN KEY (booking_id, owner_id) REFERENCES vacatina_booking_aggregates (id, owner_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_provider_payment_reference ON vacatina_payment_references (gateway_id, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX uq_verified_payment_event ON vacatina_payment_references (gateway_id, verified_event_id) WHERE verified_event_id IS NOT NULL;
CREATE UNIQUE INDEX uq_active_payment_per_booking ON vacatina_payment_references (booking_id) WHERE status IN ('PENDING','AUTHORIZED','CAPTURED');

CREATE TABLE vacatina_operation_requests (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, booking_id TEXT NOT NULL, booking_item_id TEXT, payment_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('MANUAL_CONFIRMATION','SUPPLIER_BOOKING','PAYMENT_INITIATION','CANCELLATION','REFUND','FULFILMENT')),
  status TEXT NOT NULL CHECK (status IN ('OPEN','INVESTIGATING','PENDING_SUPPLIER','RESOLVED','CLOSED')),
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id), CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  FOREIGN KEY (booking_id, owner_id) REFERENCES vacatina_booking_aggregates (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (booking_id, booking_item_id, owner_id) REFERENCES vacatina_booking_selections (booking_id, booking_item_id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_id, owner_id) REFERENCES vacatina_payment_references (id, owner_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_operation_business_key ON vacatina_operation_requests (booking_id, kind, COALESCE(booking_item_id, ''), COALESCE(payment_id, ''));
CREATE INDEX idx_operation_queue ON vacatina_operation_requests (status, kind, updated_at);

CREATE TABLE vacatina_backend_events (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, correlation_id TEXT NOT NULL, operation TEXT NOT NULL,
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  CHECK (payload ? 'actorUserId' AND payload ? 'previousState' AND payload ? 'newState' AND payload ? 'timestamp')
);
CREATE INDEX idx_backend_event_owner_time ON vacatina_backend_events (owner_id, created_at);
CREATE INDEX idx_backend_event_correlation ON vacatina_backend_events (correlation_id, created_at);
-- Application roles additionally receive only SELECT/INSERT, never table ownership.
REVOKE UPDATE, DELETE ON vacatina_backend_events FROM PUBLIC;

CREATE TABLE vacatina_backend_outbox (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, aggregate_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','PROCESSING','PUBLISHED','FAILED')),
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id),
  FOREIGN KEY (aggregate_id, owner_id) REFERENCES vacatina_booking_aggregates (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (id, owner_id) REFERENCES vacatina_operation_requests (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX idx_backend_outbox_pending ON vacatina_backend_outbox (status, created_at);

CREATE TABLE vacatina_mutation_keys (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, scope TEXT NOT NULL, request_hash TEXT NOT NULL,
  payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, scope, id), CHECK (length(request_hash) = 64),
  CHECK (payload->>'id' = id AND payload->>'ownerId' = owner_id)
);
COMMIT;
