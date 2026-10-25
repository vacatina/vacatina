/* ============================================================================
 * Vacatina Circuit Breaker & Outage Fallback Service
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q16) & ADR-006
 *
 * Implements Closed -> Open -> Half-Open fault tolerance across external GDS/APIs.
 * Never invents fake PNRs or fabricates live prices during supplier outages.
 * ============================================================================ */

import type { CircuitBreakerTelemetry, CircuitState } from './types.ts';

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Number of failures before tripping OPEN (default: 5)
  cooldownPeriodMs?: number;     // Cooldown before entering HALF_OPEN (default: 60,000ms)
  timeoutMs?: number;            // Request timeout before treating as failure (default: 8,000ms)
}

export class CircuitBreakerService {
  private failureThreshold: number;
  private cooldownPeriodMs: number;
  private timeoutMs: number;
  private breakers: Map<string, CircuitBreakerTelemetry>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownPeriodMs = options.cooldownPeriodMs || 60000;
    this.timeoutMs = options.timeoutMs || 8000;
    this.breakers = new Map();
  }

  private getOrCreate(supplierId: string): CircuitBreakerTelemetry {
    let telemetry = this.breakers.get(supplierId);
    if (!telemetry) {
      telemetry = {
        supplierId,
        state: 'CLOSED',
        failureCount: 0,
        totalCalls: 0,
        successfulCalls: 0
      };
      this.breakers.set(supplierId, telemetry);
    }
    return telemetry;
  }

  public getState(supplierId: string): CircuitState {
    const t = this.getOrCreate(supplierId);
    if (t.state === 'OPEN') {
      if (t.nextRetryTime && Date.now() >= t.nextRetryTime) {
        t.state = 'HALF_OPEN';
      }
    }
    return t.state;
  }

  public recordSuccess(supplierId: string): void {
    const t = this.getOrCreate(supplierId);
    t.totalCalls++;
    t.successfulCalls++;
    t.failureCount = 0;
    t.state = 'CLOSED';
    t.lastFailureTime = undefined;
    t.nextRetryTime = undefined;
  }

  public recordFailure(supplierId: string): void {
    const t = this.getOrCreate(supplierId);
    t.totalCalls++;
    t.failureCount++;
    t.lastFailureTime = Date.now();

    if (t.failureCount >= this.failureThreshold || t.state === 'HALF_OPEN') {
      t.state = 'OPEN';
      t.nextRetryTime = Date.now() + this.cooldownPeriodMs;
    }
  }

  /**
   * Executes a supplier call wrapped in circuit protection.
   * If circuit is OPEN, immediately executes the fallback with zero supplier network delay.
   */
  public async executeWithBreaker<T>(
    supplierId: string,
    action: () => Promise<T>,
    fallback: (reason: string) => Promise<T>
  ): Promise<T> {
    const state = this.getState(supplierId);

    if (state === 'OPEN') {
      return fallback(`Supplier '${supplierId}' circuit is OPEN (outage protection active)`);
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: Supplier '${supplierId}' exceeded ${this.timeoutMs}ms`)), this.timeoutMs)
        )
      ]);

      this.recordSuccess(supplierId);
      return result;
    } catch (err: any) {
      this.recordFailure(supplierId);
      return fallback(err.message || 'Supplier connection failed');
    }
  }

  public getTelemetry(supplierId: string): CircuitBreakerTelemetry {
    return { ...this.getOrCreate(supplierId) };
  }
}

export const globalCircuitBreaker = new CircuitBreakerService();
