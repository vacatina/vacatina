import { randomUUID } from 'node:crypto';

export interface BackendTelemetry {
  requestId: string; operation: string; status: string; bookingId?: string;
  supplierAdapter?: string; latencyMs?: number; errorCategory?: string;
}
export type BackendTelemetrySink = (event: BackendTelemetry) => void;
export function safeBackendIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(value) || /^(?:sk_|rk_|whsec_|gh[pousr]_|duffel_|eyJ)/.test(value)) return undefined;
  return value;
}
export function requestCorrelationId(value?: string | null): string { return safeBackendIdentifier(value) || randomUUID(); }

/** Whitelist fields rather than attempting to redact arbitrary request/provider payloads. */
export function backendTelemetry(input: BackendTelemetry, sink?: BackendTelemetrySink): BackendTelemetry {
  const result: BackendTelemetry = {
    requestId: requestCorrelationId(input.requestId), operation: safeBackendIdentifier(input.operation) || 'backend.operation',
    status: safeBackendIdentifier(input.status) || 'UNKNOWN'
  };
  for (const key of ['bookingId', 'supplierAdapter', 'errorCategory'] as const) {
    const value = safeBackendIdentifier(input[key]); if (value) result[key] = value;
  }
  if (Number.isFinite(input.latencyMs) && input.latencyMs! >= 0) result.latencyMs = Math.round(input.latencyMs!);
  // A failing telemetry exporter must not turn a committed operation into a retry.
  try { sink?.(result); } catch { /* Exporter failure is isolated; durable audit is transactional. */ }
  return result;
}
