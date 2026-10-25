/* ============================================================================
 * Vacatina Circuit Breaker & Outage Fallback Service
 * Authority: docs/12_UNIFIED_INVENTORY_AND_SUPPLIER_ARCHITECTURE.md (Q16) & ADR-006
 *
 * Implements Closed -> Open -> Half-Open fault tolerance across external GDS/APIs.
 * Never invents fake PNRs or fabricates live prices during supplier outages.
 * ============================================================================ */

import type { CircuitBreakerTelemetry, CircuitState } from './types.ts';

export interface ProviderCircuitBreakerConfig {
  failureThreshold: number;       // Number of consecutive failures before tripping OPEN
  rollingWindowMs: number;        // Rolling statistical window in ms
  cooldownPeriodMs: number;       // Cooldown duration before entering HALF_OPEN
  healthCheckIntervalMs?: number; // Background health-check probing interval
  timeoutMs: number;              // Request timeout in ms before treating as failure
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Backward compatibility: Number of failures before tripping OPEN
  cooldownPeriodMs?: number;     // Backward compatibility: Cooldown before entering HALF_OPEN
  timeoutMs?: number;            // Backward compatibility: Request timeout
  defaultFailureThreshold?: number;     // Default fallback failure threshold (default: 5)
  defaultCooldownPeriodMs?: number;     // Default fallback cooldown before HALF_OPEN (default: 60,000ms)
  defaultTimeoutMs?: number;            // Default request timeout (default: 8,000ms)
  defaultRollingWindowMs?: number;       // Default rolling window (default: 120,000ms)
}

export class CircuitBreakerService {
  private defaultOptions: {
    defaultFailureThreshold: number;
    defaultCooldownPeriodMs: number;
    defaultTimeoutMs: number;
    defaultRollingWindowMs: number;
  };
  private providerConfigs: Map<string, ProviderCircuitBreakerConfig>;
  private breakers: Map<string, CircuitBreakerTelemetry & { rollingWindowStart?: number }>;

  constructor(options: CircuitBreakerOptions = {}) {
    const defThreshold = options.defaultFailureThreshold ?? options.failureThreshold ?? 5;
    const defCooldown = options.defaultCooldownPeriodMs ?? options.cooldownPeriodMs ?? 60000;
    const defTimeout = options.defaultTimeoutMs ?? options.timeoutMs ?? 8000;
    const defRolling = options.defaultRollingWindowMs ?? 120000;

    this.defaultOptions = {
      defaultFailureThreshold: defThreshold,
      defaultCooldownPeriodMs: defCooldown,
      defaultTimeoutMs: defTimeout,
      defaultRollingWindowMs: defRolling
    };
    this.providerConfigs = new Map();
    this.breakers = new Map();

    // If custom instance options were not supplied, register standard provider-specific defaults
    if (options.failureThreshold === undefined) {
      this.registerProviderConfig('DUFFEL_NDC', {
        failureThreshold: 3,        // Strict NDC timeout threshold
        rollingWindowMs: 60000,
        cooldownPeriodMs: 30000,
        healthCheckIntervalMs: 15000,
        timeoutMs: 6000
      });
      this.registerProviderConfig('AMADEUS', {
        failureThreshold: 4,        // High-availability GDS threshold
        rollingWindowMs: 90000,
        cooldownPeriodMs: 45000,
        healthCheckIntervalMs: 20000,
        timeoutMs: 7000
      });
      this.registerProviderConfig('LITEAPI', {
        failureThreshold: 5,        // Bedbank rate aggregator threshold
        rollingWindowMs: 120000,
        cooldownPeriodMs: 60000,
        healthCheckIntervalMs: 30000,
        timeoutMs: 8000
      });
      this.registerProviderConfig('VIATOR', {
        failureThreshold: 4,        // Experience API threshold
        rollingWindowMs: 90000,
        cooldownPeriodMs: 45000,
        healthCheckIntervalMs: 20000,
        timeoutMs: 9000
      });
    }
  }

  /**
   * Registers or updates a provider-specific circuit breaker policy.
   */
  public registerProviderConfig(supplierId: string, config: Partial<ProviderCircuitBreakerConfig>): void {
    const existing = this.getProviderConfig(supplierId);
    this.providerConfigs.set(supplierId, {
      failureThreshold: config.failureThreshold ?? existing.failureThreshold,
      rollingWindowMs: config.rollingWindowMs ?? existing.rollingWindowMs,
      cooldownPeriodMs: config.cooldownPeriodMs ?? existing.cooldownPeriodMs,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? existing.healthCheckIntervalMs,
      timeoutMs: config.timeoutMs ?? existing.timeoutMs
    });
  }

  /**
   * Resolves the effective configuration for a given provider.
   */
  public getProviderConfig(supplierId: string): ProviderCircuitBreakerConfig {
    const specific = this.providerConfigs.get(supplierId);
    if (specific) return specific;

    return {
      failureThreshold: this.defaultOptions.defaultFailureThreshold,
      rollingWindowMs: this.defaultOptions.defaultRollingWindowMs,
      cooldownPeriodMs: this.defaultOptions.defaultCooldownPeriodMs,
      healthCheckIntervalMs: 30000,
      timeoutMs: this.defaultOptions.defaultTimeoutMs
    };
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
    const config = this.getProviderConfig(supplierId);
    const now = Date.now();

    // Reset rolling window if expired
    if (!t.rollingWindowStart || (now - t.rollingWindowStart) > config.rollingWindowMs) {
      t.rollingWindowStart = now;
      t.failureCount = 1;
    } else {
      t.failureCount++;
    }

    t.totalCalls++;
    t.lastFailureTime = now;

    if (t.failureCount >= config.failureThreshold || t.state === 'HALF_OPEN') {
      t.state = 'OPEN';
      t.nextRetryTime = now + config.cooldownPeriodMs;
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
    const config = this.getProviderConfig(supplierId);

    if (state === 'OPEN') {
      return fallback(`Supplier '${supplierId}' circuit is OPEN (outage protection active)`);
    }

    try {
      // Execute with provider-configured timeout
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: Supplier '${supplierId}' exceeded ${config.timeoutMs}ms`)), config.timeoutMs)
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
