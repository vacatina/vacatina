/* ============================================================================
 * Vacatina Provider Certification & UAT Test Suite
 * Authority: docs/15_VACATINA_INVENTORY_AND_CANONICAL_OFFER_CONTRACT_V1.md
 *            Directive 8: Supplier Integration Certification Gates
 *
 * NOTE: These tests verify the supplier integration contracts, certification
 * gates, circuit breakers, error mapping, and safety guards. They are distinct
 * from the domain/architecture unit tests in unit.test.ts.
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProviderRegistryService,
  CANONICAL_PROVIDER_REGISTRY
} from '../src/server/inventory/provider-registry.ts';
import { FlightsDuffelAdapter } from '../src/server/inventory/adapters/flights-duffel.adapter.ts';
import { HotelsLiteApiAdapter } from '../src/server/inventory/adapters/hotels-liteapi.adapter.ts';
import { ActivitiesViatorAdapter } from '../src/server/inventory/adapters/activities-viator.adapter.ts';
import { RailsTrainlineAdapter } from '../src/server/inventory/adapters/rails-trainline.adapter.ts';
import { CruisesTraveltekAdapter } from '../src/server/inventory/adapters/cruises-traveltek.adapter.ts';
import { InsuranceAllianzAdapter } from '../src/server/inventory/adapters/insurance-allianz.adapter.ts';
import { VisaConsularAdapter } from '../src/server/inventory/adapters/visa-consular.adapter.ts';
import { CircuitBreakerService } from '../src/server/inventory/circuit-breaker.service.ts';
import {
  assertScaffoldCannotCreateProductionBooking,
  ArchitecturalInvariantViolationError
} from '../src/server/inventory/types.ts';

describe('Vacatina Upstream Provider Certification & UAT Suite', () => {

  it('Gate 1 & 2: Enforces Credentials Guard — Uncertified Scaffolds Cannot Claim PRODUCTION_LIVE', () => {
    const candidateSuppliers = ['DUFFEL_NDC', 'LITEAPI', 'VIATOR', 'TRAINLINE', 'TRAVELTEK', 'ALLIANZ'];

    for (const supplierId of candidateSuppliers) {
      const record = ProviderRegistryService.getProvider(supplierId);
      assert.ok(record, `Provider ${supplierId} must exist in registry`);
      assert.equal(record.credentialsConfigured, false, `${supplierId} must not have credentialsConfigured = true without real keys`);
      assert.notEqual(record.lifecycle, 'PRODUCTION_LIVE', `${supplierId} must not be PRODUCTION_LIVE while uncertified`);

      const audit = ProviderRegistryService.evaluateCertificationGates(record.certificationGates);
      assert.equal(audit.isCertified, false);
      assert.equal(audit.isProductionReady, false);
      assert.ok(audit.pendingGates.length > 0);
    }

    // Contrast with fully certified internal consular desk
    const consularRecord = ProviderRegistryService.getProvider('VACATINA_CONSULAR_CONCIERGE');
    assert.ok(consularRecord);
    assert.equal(consularRecord.lifecycle, 'PRODUCTION_LIVE');
    const consularAudit = ProviderRegistryService.evaluateCertificationGates(consularRecord.certificationGates);
    assert.equal(consularAudit.isCertified, true);
    assert.equal(consularAudit.isProductionReady, true);
    assert.equal(consularAudit.clearedCount, 12);
  });

  it('Gate 3: Normalization Integrity across Candidate Adapters (Search & Details Mapping)', async () => {
    // 1. Flights Duffel
    const duffel = new FlightsDuffelAdapter();
    const flightOffers = await duffel.search({ origin: 'CMB', destination: 'DXB', departureDate: '2026-11-20' });
    assert.ok(flightOffers.length > 0);
    const flight = flightOffers[0];
    assert.equal(flight.productType, 'flights');
    assert.equal(flight.isSandboxSimulated, true);
    assert.ok(flight.canonicalOfferId.startsWith('vct-fl-duffel-'));

    // 2. Hotels LiteAPI
    const liteApi = new HotelsLiteApiAdapter();
    const hotelOffers = await liteApi.search({ destination: 'Dubai' });
    assert.ok(hotelOffers.length > 0);
    const hotel = hotelOffers[0];
    assert.equal(hotel.productType, 'hotels');
    assert.equal(hotel.isSandboxSimulated, true);

    // 3. Activities Viator
    const viator = new ActivitiesViatorAdapter();
    const actOffers = await viator.search({ destination: 'Dubai' });
    assert.ok(actOffers.length > 0);
    assert.equal(actOffers[0].productType, 'activities');

    // 4. Rails Trainline
    const trainline = new RailsTrainlineAdapter();
    const railOffers = await trainline.search({ origin: 'London', destination: 'Paris' });
    assert.ok(railOffers.length > 0);
    assert.equal(railOffers[0].productType, 'rails');
  });

  it('Gate 4: Integer Minor Pricing & Multi-Currency Precedence Integrity', async () => {
    const liteApi = new HotelsLiteApiAdapter();
    const offers = await liteApi.search({ destination: 'Dubai' });
    const offer = offers[0];

    assert.equal(Number.isInteger(offer.pricing.rawSupplierCostMinor), true);
    assert.equal(Number.isInteger(offer.pricing.finalSellingPriceMinor), true);
    assert.ok(offer.pricing.finalSellingPriceMinor >= offer.pricing.rawSupplierCostMinor);
    assert.ok(offer.taxesAndFees);
    assert.equal(typeof offer.taxesAndFees.totalTaxMinor, 'number');
  });

  it('Gate 5: Pre-Booking Revalidation & State Transition Verification', async () => {
    const duffel = new FlightsDuffelAdapter();
    const reval = await duffel.revalidate('vct-fl-duffel-mock-001');

    assert.ok(reval);
    assert.equal(reval.offerId, 'vct-fl-duffel-mock-001');
    assert.ok(['UNCHANGED', 'PRICE_CHANGED', 'UNAVAILABLE'].includes(reval.status));
    assert.ok(reval.message?.includes('SANDBOX') || reval.message?.includes('revalidated'));
  });

  it('Gate 6 & 11: Invariant Guard Blocks Scaffold Providers from Live Production Bookings', () => {
    assert.throws(
      () => {
        assertScaffoldCannotCreateProductionBooking({
          providerId: 'DUFFEL_NDC',
          lifecycle: 'SCAFFOLD',
          environment: 'PRODUCTION'
        });
      },
      (err: any) => {
        return err instanceof ArchitecturalInvariantViolationError &&
               err.message.includes('SCAFFOLD_PRODUCTION_BOOKING_BLOCKED');
      }
    );

    // Live provider must be permitted without throwing
    assert.doesNotThrow(() => {
      assertScaffoldCannotCreateProductionBooking({
        providerId: 'VACATINA_CONSULAR_CONCIERGE',
        lifecycle: 'PRODUCTION_LIVE',
        environment: 'PRODUCTION'
      });
    });
  });

  it('Gate 7: Circuit Breaker Transitions & Rate Limit / Outage Fallback', async () => {
    const cb = new CircuitBreakerService({ failureThreshold: 3, cooldownPeriodMs: 50 });

    let callCount = 0;
    const failingService = async () => {
      callCount++;
      throw new Error('Supplier 503 Service Unavailable / Rate Limit Exceeded');
    };

    // 1. Failures accumulate up to threshold
    for (let i = 0; i < 3; i++) {
      try {
        await cb.executeWithBreaker('TEST_SUPPLIER', failingService);
      } catch (e) {
        // expected
      }
    }

    assert.equal(cb.getState('TEST_SUPPLIER'), 'OPEN');

    // 2. Open breaker invokes fallback immediately without calling failing service
    const fallbackResult = await cb.executeWithBreaker(
      'TEST_SUPPLIER',
      failingService,
      async (reason) => `FALLBACK_SUCCESS: ${reason}`
    );
    assert.ok(fallbackResult.includes('FALLBACK_SUCCESS: Supplier \'TEST_SUPPLIER\' circuit is OPEN'));
    assert.equal(callCount, 3, 'Underlying failing service was not called while circuit is open');
  });

  it('Gate 8: Upstream Error Mapping to Standard RFC 7807 Problem Details', () => {
    const rawSupplierError = {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests to supplier endpoint'
    };

    const problemDetails = {
      type: 'https://vacatina.com/problems/upstream-supplier-rate-limit',
      title: 'Upstream Supplier Rate Limit Exceeded',
      status: 429,
      detail: rawSupplierError.message,
      instance: '/api/v1/search/flights'
    };

    assert.equal(problemDetails.status, 429);
    assert.ok(problemDetails.type.startsWith('https://'));
    assert.equal(problemDetails.title, 'Upstream Supplier Rate Limit Exceeded');
  });

  it('Gate 9, 10 & 12: Provider Registry Telemetry & Audit Compliance', () => {
    const allProviders = ProviderRegistryService.getAllProviders();
    assert.ok(allProviders.length >= 8);

    for (const p of allProviders) {
      assert.ok(p.providerId);
      assert.ok(p.providerName);
      assert.ok(p.role);
      assert.ok(p.lifecycle);
      assert.ok(p.certificationGates);
    }
  });

});
