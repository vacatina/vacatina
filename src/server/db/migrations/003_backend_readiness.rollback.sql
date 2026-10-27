-- NOT an automatic down migration. No CASCADE; no changes to migrations 001/002.
-- Requires separate DBA approval AND empty Phase 15 tables. Data-bearing rollback
-- means disable the new adapter, retain the tables, restore/reconcile from backup.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT 1 / CASE WHEN COALESCE(current_setting('vacatina.phase15_rollback_approved', true), 'false') = 'true' THEN 1 ELSE 0 END AS rollback_approval_guard;
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM vacatina_search_contexts UNION ALL SELECT 1 FROM vacatina_offer_references
  UNION ALL SELECT 1 FROM vacatina_trip_aggregates UNION ALL SELECT 1 FROM vacatina_booking_aggregates
  UNION ALL SELECT 1 FROM vacatina_trip_selections UNION ALL SELECT 1 FROM vacatina_booking_selections
  UNION ALL SELECT 1 FROM vacatina_revalidation_records UNION ALL SELECT 1 FROM vacatina_payment_references
  UNION ALL SELECT 1 FROM vacatina_operation_requests UNION ALL SELECT 1 FROM vacatina_backend_events
  UNION ALL SELECT 1 FROM vacatina_backend_outbox UNION ALL SELECT 1 FROM vacatina_mutation_keys
) THEN 0 ELSE 1 END AS empty_schema_guard;
DROP TABLE vacatina_mutation_keys;
DROP TABLE vacatina_backend_outbox;
DROP TABLE vacatina_backend_events;
DROP TABLE vacatina_operation_requests;
DROP TABLE vacatina_payment_references;
DROP TABLE vacatina_revalidation_records;
DROP TABLE vacatina_booking_selections;
DROP TABLE vacatina_booking_aggregates;
DROP TABLE vacatina_trip_selections;
DROP TABLE vacatina_trip_aggregates;
DROP TABLE vacatina_offer_references;
DROP TABLE vacatina_search_contexts;
COMMIT;
