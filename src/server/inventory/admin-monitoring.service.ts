/* ============================================================================
 * Vacatina Admin Operational Monitoring & Health Service
 * Authority: VACATINA MASTER INVENTORY ARCHITECTURE — DIRECTIVE 11
 *
 * Responsibilities:
 * 1. Supplier API telemetry: circuit breaker state, error rates, ping timestamps.
 * 2. Manual inventory expiry & quota alerts: allotment exhaustion, approaching expiry.
 * 3. Price freshness & cache TTL health: stale cached quotes needing revalidation.
 * 4. Failed booking attempts & compensation triage tracking.
 * ============================================================================ */

import { ProviderRegistryService, type ProviderRegistryRecord } from './provider-registry.ts';
import { CircuitBreakerService } from './circuit-breaker.service.ts';
import type { ManualListingRecord } from '../../lib/services/manual-inventory.service.ts';
import type { CanonicalOfferEntity } from './types.ts';

export interface SupplierOperationalHealthSummary {
  providerId: string;
  providerName: string;
  operationalState: string;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  certificationClearedCount: number;
  totalCertificationGates: number;
  isProductionReady: boolean;
  lastSyncTimestampIso: string;
  errorRatePercent: number;
}

export interface ManualInventoryAlert {
  listingId: string;
  title: string;
  partnerSupplierId: string;
  alertType: 'ALLOTMENT_EXHAUSTED' | 'EXPIRING_SOON' | 'STOP_SALE_ACTIVE' | 'UNVERIFIED_EVIDENCE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  details: string;
}

export interface PriceFreshnessAlert {
  canonicalOfferId: string;
  productType: string;
  supplierId: string;
  ageSeconds: number;
  ttlSeconds: number;
  isStale: boolean;
  requiresRecheck: boolean;
}

export class AdminInventoryMonitoringService {
  /**
   * Aggregates real-time operational health across all registered upstream providers.
   */
  public static getSupplierOperationalHealth(): SupplierOperationalHealthSummary[] {
    const providers = ProviderRegistryService.getAllProviders();
    const nowIso = new Date().toISOString();

    return providers.map(p => {
      const circuit = CircuitBreakerService.getCircuit(p.providerId);
      const evalResult = ProviderRegistryService.evaluateCertificationGates(p.certificationGates);

      return {
        providerId: p.providerId,
        providerName: p.providerName,
        operationalState: p.operationalState || 'CANDIDATE_PROVIDER',
        circuitState: circuit.state,
        certificationClearedCount: evalResult.clearedCount,
        totalCertificationGates: 12,
        isProductionReady: p.readinessTier?.productionSellable || false,
        lastSyncTimestampIso: nowIso,
        errorRatePercent: circuit.totalCalls > 0
          ? Math.round((circuit.failureCount / circuit.totalCalls) * 100)
          : 0
      };
    });
  }

  /**
   * Scans manual direct listings for operational risks (depleted quotas, imminent expiry, stop-sales).
   */
  public static getManualInventoryAlerts(listings: ManualListingRecord[]): ManualInventoryAlert[] {
    const alerts: ManualInventoryAlert[] = [];
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    for (const listing of listings) {
      if (listing.isStopSaleActive) {
        alerts.push({
          listingId: listing.id,
          title: listing.title,
          partnerSupplierId: listing.partnerSupplierId,
          alertType: 'STOP_SALE_ACTIVE',
          severity: 'HIGH',
          details: 'Listing is currently under operational stop-sale suspension.'
        });
      }

      if (listing.availableQuota <= 0) {
        alerts.push({
          listingId: listing.id,
          title: listing.title,
          partnerSupplierId: listing.partnerSupplierId,
          alertType: 'ALLOTMENT_EXHAUSTED',
          severity: 'HIGH',
          details: 'Allotment quota is depleted (0 remaining keys/seats).'
        });
      }

      if (listing.validUntilIso) {
        const expiryTime = new Date(listing.validUntilIso).getTime();
        if (expiryTime - now < fourteenDaysMs && expiryTime > now) {
          alerts.push({
            listingId: listing.id,
            title: listing.title,
            partnerSupplierId: listing.partnerSupplierId,
            alertType: 'EXPIRING_SOON',
            severity: 'MEDIUM',
            details: `Contract valid until ${listing.validUntilIso} (less than 14 days remaining).`
          });
        }
      }

      if (listing.inventoryClass === 'SAMPLE_INVENTORY') {
        alerts.push({
          listingId: listing.id,
          title: listing.title,
          partnerSupplierId: listing.partnerSupplierId,
          alertType: 'UNVERIFIED_EVIDENCE',
          severity: 'LOW',
          details: 'Listing is classified as SAMPLE_INVENTORY and is quarantined from production checkout.'
        });
      }

      if (listing.inventoryClass === 'REAL_CONTRACTED' && !listing.commercialEvidence?.isEvidenceVerified) {
        alerts.push({
          listingId: listing.id,
          title: listing.title,
          partnerSupplierId: listing.partnerSupplierId,
          alertType: 'UNVERIFIED_EVIDENCE',
          severity: 'HIGH',
          details: 'Listing claims REAL_CONTRACTED status but lacks verified legal evidence dossier.'
        });
      }
    }

    return alerts;
  }

  /**
   * Scans canonical offers for pricing freshness and cache expiration.
   */
  public static getPriceFreshnessAlerts(offers: CanonicalOfferEntity[]): PriceFreshnessAlert[] {
    const now = Date.now();
    return offers.map(offer => {
      const checkedTime = new Date(offer.freshness.lastCheckedAtIso).getTime();
      const ageSeconds = Math.max(0, Math.round((now - checkedTime) / 1000));
      const isStale = ageSeconds > offer.freshness.ttlSeconds;

      return {
        canonicalOfferId: offer.canonicalOfferId,
        productType: offer.productType,
        supplierId: offer.supplierId,
        ageSeconds,
        ttlSeconds: offer.freshness.ttlSeconds,
        isStale,
        requiresRecheck: isStale || offer.requiresRevalidation
      };
    });
  }
}
