/* ============================================================================
 * Vacatina Travel Credit & Refund Ledger Test Suite
 *
 * Authority: CBSL Closed-Loop Compliance & Vacatina Travel Credit Architecture v1.0
 * Validates:
 *   Gate 1: Multi-Bucket Balance & Summary (Refund, Promotional, Service)
 *   Gate 2: Append-Only Double-Entry Ledger Invariants (Zero direct mutations)
 *   Gate 3: CBSL Closed-Loop Regulatory Invariants (Cash-in, P2P, Cash-out blocked)
 *   Gate 4: Checkout Partial-Payment & Multi-Bucket Drawdown (FIFO: Promo -> Service -> Refund)
 *   Gate 5: Cancellation & Refund Choice (Original Payment vs Instant Travel Credit)
 *   Gate 6: Staff Service Credit Governance (Mandatory staff ID + documented reason)
 *   Gate 7: Reversal & Administrative Audit Trails
 *   Gate 8: REST API Router Endpoints & Problem Details Compliance
 * ============================================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TravelCreditLedgerService,
  globalTravelCreditLedgerService
} from '../src/features/travel-credit/services/travel-credit-ledger.service.ts';
import { globalApiRouter } from '../src/server/api/router.ts';
import { VacatinaStorageEngine, globalStorageEngine } from '../src/server/db/storage.ts';
import { PaymentGatewayService, globalPaymentGatewayService } from '../src/server/services/payment-gateway.service.ts';

describe('Vacatina Travel Credit & Refund Ledger Architecture', () => {

  // --------------------------------------------------------------------------
  // Gate 1: Multi-Bucket Balance & Summary
  // --------------------------------------------------------------------------
  describe('Gate 1: Multi-Bucket Balance & Summary', () => {
    it('initializes verified test customer with authentic seed credits totalling LKR 83,000', () => {
      const summary = globalTravelCreditLedgerService.getBalanceSync('traveller@vacatina.com');
      assert.equal(summary.customerId, 'traveller@vacatina.com');
      assert.equal(summary.currency, 'LKR');
      assert.equal(summary.totalAvailableMinor, 8300000); // LKR 83,000.00
      assert.equal(summary.refundCreditMinor, 7500000);   // LKR 75,000.00
      assert.equal(summary.promotionalCreditMinor, 500000); // LKR 5,000.00
      assert.equal(summary.serviceCreditMinor, 300000);   // LKR 3,000.00
      assert.equal(summary.totalPendingMinor, 0);
    });

    it('returns empty balance with zero values for new customer with no prior history', async () => {
      const service = new TravelCreditLedgerService();
      const summary = await service.getBalance('new_customer@vacatina.com');
      assert.equal(summary.totalAvailableMinor, 0);
      assert.equal(summary.refundCreditMinor, 0);
      assert.equal(summary.promotionalCreditMinor, 0);
      assert.equal(summary.serviceCreditMinor, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 2: Append-Only Double-Entry Ledger Invariants
  // --------------------------------------------------------------------------
  describe('Gate 2: Append-Only Double-Entry Ledger Invariants', () => {
    it('enforces that every balance change produces an immutable audit transaction row', async () => {
      const service = new TravelCreditLedgerService();
      const testUser = 'user_audit_test@vacatina.com';

      // 1. Credit a refund
      const txRefund = await service.creditRefund({
        customerId: testUser,
        bookingId: 'bk_sample_01',
        bookingReference: 'REF-001',
        refundId: 'rf_001',
        amountMinor: 2500000, // LKR 25,000
        currency: 'LKR',
        description: 'Flight cancellation refund'
      });

      assert.ok(txRefund.transactionId.startsWith('vct-tx-'));
      assert.equal(txRefund.direction, 'CREDIT');
      assert.equal(txRefund.creditType, 'REFUND_CREDIT');
      assert.equal(txRefund.amountMinor, 2500000);
      assert.equal(txRefund.balanceAfterMinor, 2500000);

      // 2. Grant promotional credit
      const txPromo = await service.grantPromotionalCredit({
        customerId: testUser,
        amountMinor: 1000000, // LKR 10,000
        campaignCode: 'SUMMER26',
        expiresAtIso: new Date(Date.now() + 86400000 * 30).toISOString()
      });

      assert.equal(txPromo.direction, 'CREDIT');
      assert.equal(txPromo.creditType, 'PROMOTIONAL_CREDIT');
      assert.equal(txPromo.balanceAfterMinor, 3500000);

      // 3. Verify ledger history has exactly 2 chronological transactions
      const txList = await service.getTransactions(testUser);
      assert.equal(txList.length, 2);
      assert.equal(txList[0].transactionId, txPromo.transactionId); // newest first
      assert.equal(txList[1].transactionId, txRefund.transactionId);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 3: CBSL Closed-Loop Regulatory Invariants
  // --------------------------------------------------------------------------
  describe('Gate 3: CBSL Closed-Loop Regulatory Invariants', () => {
    it('strictly prohibits customer cash top-ups to prevent CBSL stored-money liability', () => {
      const service = new TravelCreditLedgerService();
      assert.throws(
        () => service.attemptCashTopUp(),
        /CLOSED_LOOP_RESTRICTION.*Cash top-ups and stored-money loading are strictly prohibited/
      );
    });

    it('strictly prohibits peer-to-peer (P2P) transfers between customers', () => {
      const service = new TravelCreditLedgerService();
      assert.throws(
        () => service.attemptP2PTransfer(),
        /CLOSED_LOOP_RESTRICTION.*Peer-to-peer \(P2P\) transfers.*are strictly prohibited/
      );
    });

    it('strictly prohibits bank cash withdrawals or cash payouts of travel credits', () => {
      const service = new TravelCreditLedgerService();
      assert.throws(
        () => service.attemptCashWithdrawal(),
        /CLOSED_LOOP_RESTRICTION.*Bank withdrawals, cash payouts.*are strictly prohibited/
      );
    });
  });

  // --------------------------------------------------------------------------
  // Gate 4: Checkout Partial-Payment & Multi-Bucket Drawdown
  // --------------------------------------------------------------------------
  describe('Gate 4: Checkout Partial-Payment & Multi-Bucket Drawdown Order', () => {
    it('executes priority drawdown: Promotional first, Service second, Refund last', async () => {
      const service = new TravelCreditLedgerService();
      const user = 'drawdown_test@vacatina.com';

      // Seed 3 buckets:
      // Refund: LKR 50,000
      await service.creditRefund({
        customerId: user,
        bookingId: 'bk_1',
        bookingReference: 'REF-B1',
        refundId: 'rf_1',
        amountMinor: 5000000
      });

      // Promotional: LKR 10,000 (expiring)
      await service.grantPromotionalCredit({
        customerId: user,
        amountMinor: 1000000,
        campaignCode: 'SPRING10',
        expiresAtIso: new Date(Date.now() + 86400000 * 10).toISOString()
      });

      // Service: LKR 5,000
      await service.issueServiceCredit({
        customerId: user,
        amountMinor: 500000,
        reason: 'Courtesy gesture for baggage delay',
        staffActor: { id: 'staff_01', name: 'Agent Smith', role: 'SUPPORT_STAFF', reason: 'Baggage delay gesture' }
      });

      // Total balance: 10,000 promo + 5,000 svc + 50,000 ref = LKR 65,000
      const initialBalance = await service.getBalance(user);
      assert.equal(initialBalance.totalAvailableMinor, 6500000);

      // Checkout Scenario 1: Order total is LKR 12,000
      // Drawdown should consume ALL 10,000 promo, and 2,000 service credit. 0 refund credit used.
      const result1 = await service.applyToCheckout({
        customerId: user,
        bookingGroupId: 'grp_order_01',
        orderTotalMinor: 1200000, // LKR 12,000
        currency: 'LKR'
      });

      assert.equal(result1.success, true);
      assert.equal(result1.appliedCreditMinor, 1200000);
      assert.equal(result1.remainingOrderBalanceMinor, 0); // 100% paid by credit
      assert.equal(result1.breakdownUsed.promotionalMinor, 1000000); // 10k promo exhausted
      assert.equal(result1.breakdownUsed.serviceMinor, 200000);       // 2k service used
      assert.equal(result1.breakdownUsed.refundMinor, 0);            // 0 refund touched

      // Check remaining balances
      const postOrder1 = await service.getBalance(user);
      assert.equal(postOrder1.promotionalCreditMinor, 0);
      assert.equal(postOrder1.serviceCreditMinor, 300000); // 5k - 2k = 3k remaining
      assert.equal(postOrder1.refundCreditMinor, 5000000); // 50k intact
      assert.equal(postOrder1.totalAvailableMinor, 5300000);
    });

    it('correctly handles partial payment when order total exceeds available credit', async () => {
      const service = new TravelCreditLedgerService();
      const user = 'partial_pay_test@vacatina.com';

      // Seed credit: LKR 30,000
      await service.creditRefund({
        customerId: user,
        bookingId: 'bk_2',
        bookingReference: 'REF-B2',
        refundId: 'rf_2',
        amountMinor: 3000000
      });

      // Order total: LKR 80,000
      const result = await service.applyToCheckout({
        customerId: user,
        bookingGroupId: 'grp_order_big',
        orderTotalMinor: 8000000, // LKR 80,000
        currency: 'LKR'
      });

      assert.equal(result.success, true);
      assert.equal(result.appliedCreditMinor, 3000000); // All LKR 30,000 applied
      assert.equal(result.remainingOrderBalanceMinor, 5000000); // Remaining LKR 50,000 due via card/gateway
      assert.equal(result.newAvailableCreditMinor, 0);

      const afterBalance = await service.getBalance(user);
      assert.equal(afterBalance.totalAvailableMinor, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 5: Cancellation & Refund Choice (Option A vs Option B)
  // --------------------------------------------------------------------------
  describe('Gate 5: Cancellation & Refund Choice (Original Payment vs Travel Credit)', () => {
    it('executes Option B: instant refund to Vacatina Travel Credit ledger', async () => {
      const user = 'cancel_flow_test@vacatina.com';
      const initialBalance = await globalTravelCreditLedgerService.getBalance(user);

      // Create a test booking group
      const booking = globalStorageEngine.createBookingGroup({
        organizationId: 'org_vacatina_b2c',
        bookingReference: 'VCT-2026-TEST000001',
        checkoutSessionId: 'checkout_test_cancel_flow',
        currency: 'LKR',
        totalSellingPriceMinor: 4500000, // LKR 45,000
        paymentStatus: 'SETTLED',
        overallFulfillmentStatus: 'CONFIRMED'
      });

      // Option B: Customer requests instant Travel Credit refund
      const refundTx = await globalTravelCreditLedgerService.creditRefund({
        customerId: user,
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        refundId: `ref_tc_${Date.now()}`,
        amountMinor: booking.totalSellingPriceMinor,
        currency: booking.currency,
        description: `Refund credit for cancelled booking #${booking.bookingReference}`
      });

      globalStorageEngine.updateBookingGroup(booking.id, {
        paymentStatus: 'REFUNDED_TO_TRAVEL_CREDIT' as any,
        overallFulfillmentStatus: 'CANCELLED' as any
      });

      // Assertions
      assert.equal(refundTx.direction, 'CREDIT');
      assert.equal(refundTx.creditType, 'REFUND_CREDIT');
      assert.equal(refundTx.amountMinor, 4500000);

      const updatedBooking = globalStorageEngine.getBookingGroup(booking.id)!;
      assert.equal(updatedBooking.paymentStatus, 'REFUNDED_TO_TRAVEL_CREDIT');
      assert.equal(updatedBooking.overallFulfillmentStatus, 'CANCELLED');

      const updatedBalance = await globalTravelCreditLedgerService.getBalance(user);
      assert.equal(updatedBalance.totalAvailableMinor, initialBalance.totalAvailableMinor + 4500000);
    });

    it('executes Option A: unforced choice of original payment gateway refund without touching travel credit', async () => {
      const user = 'cancel_flow_option_a@vacatina.com';
      const initialCredit = await globalTravelCreditLedgerService.getBalance(user);

      // Isolated ledger/storage boundary with a genuinely captured STRIPE payment
      const storage = new VacatinaStorageEngine();
      const booking = storage.createBookingGroup({
        bookingReference: 'VCT-2026-ABCDEF1234',
        checkoutSessionId: 'cs_option_a_canonical_001',
        totalSellingPriceMinor: 6000000,
        currency: 'LKR',
        paymentStatus: 'SETTLED',
        overallFulfillmentStatus: 'CONFIRMED'
      });
      const order = storage.createPaymentOrder({
        bookingGroupId: booking.id,
        gatewayId: 'STRIPE',
        gatewayOrderId: 'pi_option_a_canonical_001',
        amountMinor: 6000000,
        currency: 'LKR',
        status: 'CAPTURED',
        idempotencyKey: 'pi_option_a_canonical_001'
      });
      storage.recordIdempotency({
        idempotencyKey: `provider-payment:${order.id}`,
        targetEndpoint: '/webhooks',
        requestHash: order.id,
        responseStatus: 200,
        responseBody: JSON.stringify({ paymentReference: 'pi_option_a_canonical_001' }),
        expiresAt: '2027-10-01T00:00:00.000Z'
      });

      const requests: string[] = [];
      const gateway = new PaymentGatewayService(storage, {
        env: {
          NODE_ENV: 'test',
          STRIPE_SECRET_KEY: 'sk_test_option_a_fixture',
          STRIPE_WEBHOOK_SECRET: 'whsec_option_a_fixture'
        },
        now: () => 1793059200000,
        fetchImpl: (async (url: any, init?: any) => {
          requests.push(`${init?.method || 'GET'} ${String(url)}`);
          return new Response(JSON.stringify({
            id: 're_option_a_canonical_001',
            amount: 6000000,
            currency: 'lkr',
            status: 'succeeded'
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }) as typeof fetch
      });

      const gatewayResult = await gateway.processRefund(
        booking.id,
        booking.totalSellingPriceMinor,
        'Customer requested card refund',
        'refund-option-a-canonical-001'
      );

      assert.equal(gatewayResult.success, true);
      assert.equal(gatewayResult.refundId, 're_option_a_canonical_001');
      assert.equal(requests.length, 1);
      assert.ok(requests[0].startsWith('POST https://api.stripe.com/'));

      const updatedBooking = storage.getBookingGroup(booking.id)!;
      assert.equal(updatedBooking.paymentStatus, 'REFUNDED');
      assert.equal(storage.getPaymentOrder(order.id)!.status, 'REFUNDED');

      const finalCredit = await globalTravelCreditLedgerService.getBalance(user);
      assert.equal(finalCredit.totalAvailableMinor, initialCredit.totalAvailableMinor, 'Original-payment refunds must not mint travel credit');
    });
  });

  // --------------------------------------------------------------------------
  // Gate 6: Staff Service Credit Governance
  // --------------------------------------------------------------------------
  describe('Gate 6: Staff Service Credit Governance', () => {
    it('requires mandatory staff identification and documented justification reason', async () => {
      const service = new TravelCreditLedgerService();

      // Missing staff identity should reject
      await assert.rejects(
        async () => {
          await service.issueServiceCredit({
            customerId: 'user@vacatina.com',
            amountMinor: 500000,
            reason: 'Valid reason here',
            staffActor: null as any
          });
        },
        /Mandatory staffActor identification required/
      );

      // Missing reason should reject
      await assert.rejects(
        async () => {
          await service.issueServiceCredit({
            customerId: 'user@vacatina.com',
            amountMinor: 500000,
            reason: '',
            staffActor: { id: 'staff_1', name: 'Perera', role: 'SUPPORT_STAFF', reason: '' }
          });
        },
        /Documented justification reason .* is mandatory/
      );
    });
  });

  // --------------------------------------------------------------------------
  // Gate 7: Credit Reversal & Administrative Audit
  // --------------------------------------------------------------------------
  describe('Gate 7: Credit Reversal & Administrative Audit', () => {
    it('appends an auditable DEBIT reversal transaction when an erroneous credit is reversed', async () => {
      const service = new TravelCreditLedgerService();
      const user = 'reversal_test@vacatina.com';

      // Issue service credit
      const origTx = await service.issueServiceCredit({
        customerId: user,
        amountMinor: 1500000, // LKR 15,000
        reason: 'Courtesy gesture for flight delay',
        staffActor: { id: 'staff_99', name: 'Senior Agent', role: 'PLATFORM_ADMIN', reason: 'Flight delay' }
      });

      const balBefore = await service.getBalance(user);
      assert.equal(balBefore.totalAvailableMinor, 1500000);

      // Reverse credit
      const revTx = await service.reverseCredit({
        customerId: user,
        transactionId: origTx.transactionId,
        reason: 'Correction: Customer had already received rebooking voucher',
        staffActor: { id: 'supervisor_01', name: 'Supervisor Silva', role: 'PLATFORM_ADMIN', reason: 'Duplicate compensation adjustment' }
      });

      assert.equal(revTx.direction, 'DEBIT');
      assert.equal(revTx.status, 'REVERSED');
      assert.equal(revTx.amountMinor, 1500000);

      const balAfter = await service.getBalance(user);
      assert.equal(balAfter.totalAvailableMinor, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Gate 8: REST API Router Endpoints & Problem Details Compliance
  // --------------------------------------------------------------------------
  describe('Gate 8: REST API Router Endpoints & Problem Details', () => {
    it('GET /api/v1/travel-credit returns balance summary for test customer', async () => {
      const req = new Request('https://vacatina.com/api/v1/travel-credit?customerId=traveller@vacatina.com', {
        method: 'GET'
      });
      const res = await globalApiRouter.handleRequest(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.balance.customerId, 'traveller@vacatina.com');
      assert.equal(data.balance.currency, 'LKR');
    });

    it('GET /api/v1/travel-credit/transactions returns immutable ledger history', async () => {
      const req = new Request('https://vacatina.com/api/v1/travel-credit/transactions?customerId=traveller@vacatina.com', {
        method: 'GET'
      });
      const res = await globalApiRouter.handleRequest(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.transactions));
      assert.ok(data.transactions.length >= 3);
    });

    it('POST /api/v1/travel-credit/top-up returns RFC 7807 problem response prohibiting cash-in', async () => {
      const req = new Request('https://vacatina.com/api/v1/travel-credit/top-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'traveller@vacatina.com', amountMinor: 1000000 })
      });
      const res = await globalApiRouter.handleRequest(req);
      assert.equal(res.status, 400);
      const err = await res.json();
      assert.equal(err.code, 'CLOSED_LOOP_CASH_TOPUP_PROHIBITED');
      assert.ok(err.detail.includes('CBSL Regulatory Framework'));
    });

    it('POST /api/v1/travel-credit/p2p-transfer returns RFC 7807 problem response prohibiting P2P', async () => {
      const req = new Request('https://vacatina.com/api/v1/travel-credit/p2p-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'a@vacatina.com', to: 'b@vacatina.com', amountMinor: 500000 })
      });
      const res = await globalApiRouter.handleRequest(req);
      assert.equal(res.status, 400);
      const err = await res.json();
      assert.equal(err.code, 'CLOSED_LOOP_P2P_TRANSFER_PROHIBITED');
    });

    it('POST /api/v1/travel-credit/withdraw returns RFC 7807 problem response prohibiting cash-out', async () => {
      const req = new Request('https://vacatina.com/api/v1/travel-credit/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'traveller@vacatina.com', bankAccount: '12345' })
      });
      const res = await globalApiRouter.handleRequest(req);
      assert.equal(res.status, 400);
      const err = await res.json();
      assert.equal(err.code, 'CLOSED_LOOP_WITHDRAWAL_PROHIBITED');
    });
  });
});
