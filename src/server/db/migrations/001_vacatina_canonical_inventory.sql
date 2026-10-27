-- ============================================================================
-- Migration: 001_vacatina_canonical_inventory.sql
-- Description: Vacatina Production Manual Inventory & Audit Ledger Schema
-- Authority: Requirement 1, 3, 13 (VACATINA SUPPLIER & LISTING ARCHITECTURE v1.0)
-- ============================================================================

-- 1. Vacatina Manual Commercial Listings Table
CREATE TABLE IF NOT EXISTS vacatina_manual_listings (
  listing_id VARCHAR(64) PRIMARY KEY,
  canonical_entity_id VARCHAR(128) NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  partner_supplier_id VARCHAR(64) NOT NULL,
  operator_name VARCHAR(128) NOT NULL,
  partner_name VARCHAR(128) NOT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
  fulfillment_mode VARCHAR(32) NOT NULL DEFAULT 'INSTANT',
  confirmation_mode VARCHAR(32) NOT NULL DEFAULT 'INSTANT_CONFIRM',
  booking_mode VARCHAR(32) NOT NULL DEFAULT 'DIRECT_BOOKING',
  title VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  subtitle VARCHAR(256),
  origin VARCHAR(128),
  destination VARCHAR(128) NOT NULL,
  location_city VARCHAR(128) NOT NULL,
  location_country VARCHAR(128) NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  sales_valid_from TIMESTAMPTZ NOT NULL,
  sales_valid_until TIMESTAMPTZ NOT NULL,
  total_allotted_quota INTEGER NOT NULL CHECK (total_allotted_quota >= 0),
  available_quota INTEGER NOT NULL CHECK (available_quota >= 0),
  is_stop_sale_active BOOLEAN NOT NULL DEFAULT FALSE,
  stop_sale_reason VARCHAR(256),
  contracted_base_cost_minor BIGINT NOT NULL CHECK (contracted_base_cost_minor > 0),
  markup_minor BIGINT NOT NULL CHECK (markup_minor >= 0),
  selling_price_minor BIGINT NOT NULL CHECK (selling_price_minor > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'LKR',
  taxes_and_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancellation_policy TEXT NOT NULL,
  refundability VARCHAR(32) NOT NULL DEFAULT 'NON_REFUNDABLE',
  inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  media JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by JSONB NOT NULL,
  approved_by JSONB,
  modified_by JSONB,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_vct_man_product ON vacatina_manual_listings (product_type);
CREATE INDEX IF NOT EXISTS idx_vct_man_dest ON vacatina_manual_listings (destination);
CREATE INDEX IF NOT EXISTS idx_vct_man_status ON vacatina_manual_listings (workflow_status);
CREATE INDEX IF NOT EXISTS idx_vct_man_stopsell ON vacatina_manual_listings (is_stop_sale_active);
CREATE INDEX IF NOT EXISTS idx_vct_man_quota ON vacatina_manual_listings (available_quota);
CREATE INDEX IF NOT EXISTS idx_vct_man_validity ON vacatina_manual_listings (sales_valid_from, sales_valid_until);

-- 2. Audit Trail & 4-Eyes Compliance Log
CREATE TABLE IF NOT EXISTS vacatina_manual_listing_audit_log (
  log_id BIGSERIAL PRIMARY KEY,
  listing_id VARCHAR(64) NOT NULL REFERENCES vacatina_manual_listings (listing_id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  note TEXT,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vct_audit_listing ON vacatina_manual_listing_audit_log (listing_id);
CREATE INDEX IF NOT EXISTS idx_vct_audit_created ON vacatina_manual_listing_audit_log (created_at);

-- 3. Dedicated Inventory Allotment Holds & Concurrency Ledger
CREATE TABLE IF NOT EXISTS vacatina_manual_listing_allotments (
  allotment_id VARCHAR(64) PRIMARY KEY,
  listing_id VARCHAR(64) NOT NULL REFERENCES vacatina_manual_listings (listing_id) ON DELETE CASCADE,
  held_quantity INTEGER NOT NULL CHECK (held_quantity > 0),
  hold_status VARCHAR(32) NOT NULL DEFAULT 'HELD', -- 'HELD' | 'COMMITTED' | 'RELEASED' | 'EXPIRED'
  held_for_trip_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vct_allot_listing ON vacatina_manual_listing_allotments (listing_id);
CREATE INDEX IF NOT EXISTS idx_vct_allot_status ON vacatina_manual_listing_allotments (hold_status, expires_at);
