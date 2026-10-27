/* ============================================================================
 * Vacatina Travel Credit Double-Entry Ledger Service
 * Authority: CBSL Closed-Loop Compliance & Vacatina Travel Credit Architecture v1.0
 *
 * Responsibilities:
 * 1. Manages closed-loop customer travel credit balances and multi-bucket ledgers.
 * 2. Enforces append-only immutable double-entry transaction history.
 * 3. Prohibits direct raw balance editing (all changes require ledger entries).
 * 4. Supports partial-payment deduction at checkout with transparent remaining balance.
 * 5. Rejects cash top-ups, P2P transfers, and cash withdrawals under closed-loop rules.
 * 6. Executes multi-bucket drawdown order (Promotional -> Service -> Refund).
 * ============================================================================ */

import type {
  FxConversionBasis,
  StaffAuditActor,
  TravelCreditBalanceSummary,
  TravelCreditBucketType,
  TravelCreditRedemptionRequest,
  TravelCreditRedemptionResult,
  TravelCreditTransaction,
  TravelCreditTransactionDirection,
  TravelCreditTransactionKind,
  TravelCreditTransactionStatus
} from '../domain/travel-credit-models.ts';

function generateTxId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `vct-tx-${crypto.randomUUID().slice(0, 12)}`;
  }
  return `vct-tx-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export class TravelCreditLedgerService {
  private transactions: Map<string, TravelCreditTransaction[]> = new Map();
  private subscribers: Array<(summary: TravelCreditBalanceSummary) => void> = [];

  constructor() {
    this.seedInitialCreditData();
  }

  /**
   * Seed authentic initial test credits for verified test traveller
   */
  private seedInitialCreditData(): void {
    const testCustomerId = 'traveller@vacatina.com';
    const now = Date.now();
    const dayMs = 86400000;

    // Transaction 1: Refund from cancelled booking VAC-4821
    const tx1: TravelCreditTransaction = {
      transactionId: 'vct-tx-ref-4821-01',
      walletAccountId: `vct-tc-acc-${testCustomerId}`,
      customerId: testCustomerId,
      direction: 'CREDIT',
      creditType: 'REFUND_CREDIT',
      transactionKind: 'BOOKING_REFUND',
      amountMinor: 7500000, // LKR 75,000.00
      currency: 'LKR',
      balanceAfterMinor: 7500000,
      status: 'AVAILABLE',
      description: 'Refund credit from cancelled booking VAC-4821 (Bentota Pavilion)',
      referenceId: 'VAC-4821',
      bookingId: 'book_vac_4821',
      refundId: 'ref_vac_4821_01',
      createdAtIso: new Date(now - dayMs * 5).toISOString()
    };

    // Transaction 2: Promotional campaign grant
    const tx2: TravelCreditTransaction = {
      transactionId: 'vct-tx-promo-2026-02',
      walletAccountId: `vct-tc-acc-${testCustomerId}`,
      customerId: testCustomerId,
      direction: 'CREDIT',
      creditType: 'PROMOTIONAL_CREDIT',
      transactionKind: 'PROMOTIONAL_GRANT',
      amountMinor: 500000, // LKR 5,000.00
      currency: 'LKR',
      balanceAfterMinor: 8000000,
      status: 'AVAILABLE',
      description: 'Early Bird Ceylon Summer Campaign Bonus',
      referenceId: 'CAMP-SUMMER-2026',
      expiresAtIso: new Date(now + dayMs * 60).toISOString(),
      createdAtIso: new Date(now - dayMs * 3).toISOString()
    };

    // Transaction 3: Service goodwill compensation
    const tx3: TravelCreditTransaction = {
      transactionId: 'vct-tx-svc-gw-03',
      walletAccountId: `vct-tc-acc-${testCustomerId}`,
      customerId: testCustomerId,
      direction: 'CREDIT',
      creditType: 'SERVICE_CREDIT',
      transactionKind: 'SERVICE_GOODWILL',
      amountMinor: 300000, // LKR 3,000.00
      currency: 'LKR',
      balanceAfterMinor: 8300000,
      status: 'AVAILABLE',
      description: 'Concierge goodwill gesture for flight schedule reschedule assistance',
      referenceId: 'TICKET-SRV-901',
      staffActor: {
        id: 'staff_perera_01',
        name: 'Concierge Officer Perera',
        role: 'SUPPORT_STAFF',
        reason: 'Courtesy gesture for minor schedule shift on Colombo flight'
      },
      createdAtIso: new Date(now - dayMs * 1).toISOString()
    };

    this.transactions.set(testCustomerId, [tx1, tx2, tx3]);
  }

  /**
   * Synchronous balance evaluation for immediate UI rendering
   */
  public getBalanceSync(customerId = 'traveller@vacatina.com'): TravelCreditBalanceSummary {
    const list = this.transactions.get(customerId) || [];
    let refundCreditMinor = 0;
    let promotionalCreditMinor = 0;
    let serviceCreditMinor = 0;
    let totalPendingMinor = 0;
    let earliestExpiringDateIso: string | undefined;

    const now = Date.now();

    for (const tx of list) {
      if (tx.status === 'PENDING') {
        if (tx.direction === 'CREDIT') totalPendingMinor += tx.amountMinor;
        continue;
      }

      if (tx.status === 'REVERSED' || tx.status === 'EXPIRED') continue;

      if (tx.direction === 'CREDIT') {
        if (tx.creditType === 'PROMOTIONAL_CREDIT' && tx.expiresAtIso && Date.parse(tx.expiresAtIso) < now) {
          continue;
        }

        if (tx.creditType === 'REFUND_CREDIT') refundCreditMinor += tx.amountMinor;
        else if (tx.creditType === 'PROMOTIONAL_CREDIT') {
          promotionalCreditMinor += tx.amountMinor;
          if (!earliestExpiringDateIso || (tx.expiresAtIso && tx.expiresAtIso < earliestExpiringDateIso)) {
            earliestExpiringDateIso = tx.expiresAtIso;
          }
        } else if (tx.creditType === 'SERVICE_CREDIT') serviceCreditMinor += tx.amountMinor;
      } else if (tx.direction === 'DEBIT') {
        if (tx.creditType === 'REFUND_CREDIT') refundCreditMinor = Math.max(0, refundCreditMinor - tx.amountMinor);
        else if (tx.creditType === 'PROMOTIONAL_CREDIT') promotionalCreditMinor = Math.max(0, promotionalCreditMinor - tx.amountMinor);
        else if (tx.creditType === 'SERVICE_CREDIT') serviceCreditMinor = Math.max(0, serviceCreditMinor - tx.amountMinor);
      }
    }

    const totalAvailableMinor = refundCreditMinor + promotionalCreditMinor + serviceCreditMinor;

    return {
      walletAccountId: `vct-tc-acc-${customerId}`,
      customerId,
      currency: 'LKR',
      totalAvailableMinor,
      totalPendingMinor,
      refundCreditMinor,
      promotionalCreditMinor,
      serviceCreditMinor,
      earliestExpiringDateIso,
      lastUpdatedAtIso: new Date().toISOString()
    };
  }

  /**
   * Retrieves full balance breakdown across multi-buckets
   */
  public async getBalance(customerId = 'traveller@vacatina.com'): Promise<TravelCreditBalanceSummary> {
    return this.getBalanceSync(customerId);
  }

  /**
   * Synchronous transaction history retrieval for immediate HTML rendering
   */
  public getTransactionsSync(
    customerId = 'traveller@vacatina.com',
    filter?: {
      creditType?: TravelCreditBucketType;
      direction?: TravelCreditTransactionDirection;
      status?: TravelCreditTransactionStatus;
    }
  ): TravelCreditTransaction[] {
    const list = this.transactions.get(customerId) || [];
    let filtered = [...list];

    if (filter?.creditType) {
      filtered = filtered.filter(tx => tx.creditType === filter.creditType);
    }
    if (filter?.direction) {
      filtered = filtered.filter(tx => tx.direction === filter.direction);
    }
    if (filter?.status) {
      filtered = filtered.filter(tx => tx.status === filter.status);
    }

    // Sort descending by date (newest first). Appends within the same millisecond
    // keep reverse insertion order so the most recent ledger row is always first.
    return filtered
      .map((tx, index) => ({ tx, index }))
      .sort((a, b) => Date.parse(b.tx.createdAtIso) - Date.parse(a.tx.createdAtIso) || b.index - a.index)
      .map(({ tx }) => tx);
  }

  /**
   * Retrieves full immutable transaction ledger history
   */
  public async getTransactions(
    customerId = 'traveller@vacatina.com',
    filter?: {
      creditType?: TravelCreditBucketType;
      direction?: TravelCreditTransactionDirection;
      status?: TravelCreditTransactionStatus;
    }
  ): Promise<TravelCreditTransaction[]> {
    return this.getTransactionsSync(customerId, filter);
  }

  /**
   * Credits a refund derived from a cancelled booking
   */
  public async creditRefund(params: {
    customerId: string;
    bookingId: string;
    bookingReference: string;
    refundId: string;
    amountMinor: number;
    currency?: string;
    description?: string;
    isPending?: boolean;
  }): Promise<TravelCreditTransaction> {
    if (params.amountMinor <= 0) {
      throw new Error('Refund credit amount must be greater than zero.');
    }

    const currentBalance = await this.getBalance(params.customerId);
    const isPending = Boolean(params.isPending);
    const balanceAfterMinor = isPending
      ? currentBalance.totalAvailableMinor
      : currentBalance.totalAvailableMinor + params.amountMinor;

    const tx: TravelCreditTransaction = {
      transactionId: generateTxId(),
      walletAccountId: `vct-tc-acc-${params.customerId}`,
      customerId: params.customerId,
      direction: 'CREDIT',
      creditType: 'REFUND_CREDIT',
      transactionKind: 'BOOKING_REFUND',
      amountMinor: params.amountMinor,
      currency: params.currency || 'LKR',
      balanceAfterMinor,
      status: isPending ? 'PENDING' : 'AVAILABLE',
      description: params.description || `Refund from cancelled booking ${params.bookingReference}`,
      referenceId: params.bookingReference,
      bookingId: params.bookingId,
      refundId: params.refundId,
      createdAtIso: new Date().toISOString()
    };

    const customerTxs = this.transactions.get(params.customerId) || [];
    customerTxs.push(tx);
    this.transactions.set(params.customerId, customerTxs);

    this.notifySubscribers(await this.getBalance(params.customerId));
    return tx;
  }

  /**
   * Confirms a pending refund or credit transaction
   */
  public async confirmPendingCredit(
    customerId: string,
    transactionId: string,
    staffActor?: StaffAuditActor
  ): Promise<TravelCreditTransaction> {
    const list = this.transactions.get(customerId) || [];
    const tx = list.find(t => t.transactionId === transactionId);
    if (!tx) throw new Error(`Transaction '${transactionId}' not found for customer '${customerId}'`);
    if (tx.status !== 'PENDING') throw new Error(`Transaction '${transactionId}' is already in status '${tx.status}'`);

    tx.status = 'AVAILABLE';
    const current = await this.getBalance(customerId);
    tx.balanceAfterMinor = current.totalAvailableMinor;

    if (staffActor) {
      tx.staffActor = staffActor;
    }

    this.notifySubscribers(current);
    return tx;
  }

  /**
   * Issues goodwill or service compensation credit (Requires staff identity & reason)
   */
  public async issueServiceCredit(params: {
    customerId: string;
    amountMinor: number;
    reason: string;
    staffActor: StaffAuditActor;
    referenceId?: string;
  }): Promise<TravelCreditTransaction> {
    if (!params.staffActor || !params.staffActor.id) {
      throw new Error('Mandatory staffActor identification required to issue Service Credit.');
    }
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Documented justification reason (minimum 5 characters) is mandatory.');
    }
    if (params.amountMinor <= 0) {
      throw new Error('Service credit amount must be greater than zero.');
    }

    const currentBalance = await this.getBalance(params.customerId);
    const balanceAfterMinor = currentBalance.totalAvailableMinor + params.amountMinor;

    const tx: TravelCreditTransaction = {
      transactionId: generateTxId(),
      walletAccountId: `vct-tc-acc-${params.customerId}`,
      customerId: params.customerId,
      direction: 'CREDIT',
      creditType: 'SERVICE_CREDIT',
      transactionKind: 'SERVICE_GOODWILL',
      amountMinor: params.amountMinor,
      currency: 'LKR',
      balanceAfterMinor,
      status: 'AVAILABLE',
      description: `Service Credit: ${params.reason.trim()}`,
      referenceId: params.referenceId || `SVC-${Date.now().toString(36).toUpperCase()}`,
      staffActor: params.staffActor,
      createdAtIso: new Date().toISOString()
    };

    const customerTxs = this.transactions.get(params.customerId) || [];
    customerTxs.push(tx);
    this.transactions.set(params.customerId, customerTxs);

    this.notifySubscribers(await this.getBalance(params.customerId));
    return tx;
  }

  /**
   * Grants promotional campaign credit with expiry date
   */
  public async grantPromotionalCredit(params: {
    customerId: string;
    amountMinor: number;
    campaignCode: string;
    expiresAtIso: string;
    description?: string;
  }): Promise<TravelCreditTransaction> {
    if (params.amountMinor <= 0) {
      throw new Error('Promotional credit amount must be greater than zero.');
    }
    if (!params.campaignCode) {
      throw new Error('Campaign code is required.');
    }

    const currentBalance = await this.getBalance(params.customerId);
    const balanceAfterMinor = currentBalance.totalAvailableMinor + params.amountMinor;

    const tx: TravelCreditTransaction = {
      transactionId: generateTxId(),
      walletAccountId: `vct-tc-acc-${params.customerId}`,
      customerId: params.customerId,
      direction: 'CREDIT',
      creditType: 'PROMOTIONAL_CREDIT',
      transactionKind: 'PROMOTIONAL_GRANT',
      amountMinor: params.amountMinor,
      currency: 'LKR',
      balanceAfterMinor,
      status: 'AVAILABLE',
      description: params.description || `Promotional Credit (${params.campaignCode})`,
      referenceId: params.campaignCode,
      expiresAtIso: params.expiresAtIso,
      createdAtIso: new Date().toISOString()
    };

    const customerTxs = this.transactions.get(params.customerId) || [];
    customerTxs.push(tx);
    this.transactions.set(params.customerId, customerTxs);

    this.notifySubscribers(await this.getBalance(params.customerId));
    return tx;
  }

  /**
   * Applies available Travel Credit to a booking checkout with partial payment support.
   * Drawdown priority: PROMOTIONAL (expiring) -> SERVICE -> REFUND.
   */
  public async applyToCheckout(params: TravelCreditRedemptionRequest): Promise<TravelCreditRedemptionResult> {
    const balance = await this.getBalance(params.customerId);

    if (balance.totalAvailableMinor <= 0) {
      return {
        success: false,
        transactionId: '',
        bookingGroupId: params.bookingGroupId,
        appliedCreditMinor: 0,
        remainingOrderBalanceMinor: params.orderTotalMinor,
        newAvailableCreditMinor: 0,
        currency: params.currency || 'LKR',
        breakdownUsed: { promotionalMinor: 0, serviceMinor: 0, refundMinor: 0 }
      };
    }

    // Determine how much credit can be applied
    const maxRequested = params.requestedCreditAmountMinor !== undefined
      ? Math.max(0, params.requestedCreditAmountMinor)
      : params.orderTotalMinor;

    const maxApplicable = Math.min(params.orderTotalMinor, balance.totalAvailableMinor, maxRequested);

    if (maxApplicable <= 0) {
      return {
        success: false,
        transactionId: '',
        bookingGroupId: params.bookingGroupId,
        appliedCreditMinor: 0,
        remainingOrderBalanceMinor: params.orderTotalMinor,
        newAvailableCreditMinor: balance.totalAvailableMinor,
        currency: params.currency || 'LKR',
        breakdownUsed: { promotionalMinor: 0, serviceMinor: 0, refundMinor: 0 }
      };
    }

    // Multi-bucket drawdown algorithm (Promotional -> Service -> Refund)
    let needed = maxApplicable;
    let promoUsed = 0;
    let serviceUsed = 0;
    let refundUsed = 0;

    if (needed > 0 && balance.promotionalCreditMinor > 0) {
      promoUsed = Math.min(needed, balance.promotionalCreditMinor);
      needed -= promoUsed;
    }
    if (needed > 0 && balance.serviceCreditMinor > 0) {
      serviceUsed = Math.min(needed, balance.serviceCreditMinor);
      needed -= serviceUsed;
    }
    if (needed > 0 && balance.refundCreditMinor > 0) {
      refundUsed = Math.min(needed, balance.refundCreditMinor);
      needed -= refundUsed;
    }

    const appliedCreditMinor = promoUsed + serviceUsed + refundUsed;
    const remainingOrderBalanceMinor = params.orderTotalMinor - appliedCreditMinor;
    const newAvailableCreditMinor = balance.totalAvailableMinor - appliedCreditMinor;

    const txId = generateTxId();
    const customerTxs = this.transactions.get(params.customerId) || [];

    // Optional FX basis if booking settlement is non-LKR
    let fxBasis: FxConversionBasis | undefined;
    if (params.settlementCurrency && params.settlementCurrency !== 'LKR' && params.fxRate) {
      fxBasis = {
        baseCurrency: 'LKR',
        settlementCurrency: params.settlementCurrency,
        exchangeRate: params.fxRate,
        baseDebitMinor: appliedCreditMinor,
        settlementAmountMinor: Math.round(appliedCreditMinor / params.fxRate),
        calculatedAtIso: new Date().toISOString()
      };
    }

    // Record discrete debit entries for exact bucket accounting
    if (promoUsed > 0) {
      customerTxs.push({
        transactionId: `${txId}-promo`,
        walletAccountId: `vct-tc-acc-${params.customerId}`,
        customerId: params.customerId,
        direction: 'DEBIT',
        creditType: 'PROMOTIONAL_CREDIT',
        transactionKind: 'CHECKOUT_REDEMPTION',
        amountMinor: promoUsed,
        currency: 'LKR',
        balanceAfterMinor: balance.totalAvailableMinor - promoUsed,
        status: 'USED',
        description: `Travel Credit applied to booking ${params.bookingGroupId}`,
        referenceId: params.bookingGroupId,
        bookingId: params.bookingGroupId,
        createdAtIso: new Date().toISOString(),
        fxBasis
      });
    }

    if (serviceUsed > 0) {
      customerTxs.push({
        transactionId: `${txId}-svc`,
        walletAccountId: `vct-tc-acc-${params.customerId}`,
        customerId: params.customerId,
        direction: 'DEBIT',
        creditType: 'SERVICE_CREDIT',
        transactionKind: 'CHECKOUT_REDEMPTION',
        amountMinor: serviceUsed,
        currency: 'LKR',
        balanceAfterMinor: balance.totalAvailableMinor - promoUsed - serviceUsed,
        status: 'USED',
        description: `Travel Credit applied to booking ${params.bookingGroupId}`,
        referenceId: params.bookingGroupId,
        bookingId: params.bookingGroupId,
        createdAtIso: new Date().toISOString(),
        fxBasis
      });
    }

    if (refundUsed > 0) {
      customerTxs.push({
        transactionId: `${txId}-ref`,
        walletAccountId: `vct-tc-acc-${params.customerId}`,
        customerId: params.customerId,
        direction: 'DEBIT',
        creditType: 'REFUND_CREDIT',
        transactionKind: 'CHECKOUT_REDEMPTION',
        amountMinor: refundUsed,
        currency: 'LKR',
        balanceAfterMinor: newAvailableCreditMinor,
        status: 'USED',
        description: `Travel Credit applied to booking ${params.bookingGroupId}`,
        referenceId: params.bookingGroupId,
        bookingId: params.bookingGroupId,
        createdAtIso: new Date().toISOString(),
        fxBasis
      });
    }

    this.transactions.set(params.customerId, customerTxs);
    this.notifySubscribers(await this.getBalance(params.customerId));

    return {
      success: true,
      transactionId: txId,
      bookingGroupId: params.bookingGroupId,
      appliedCreditMinor,
      remainingOrderBalanceMinor,
      newAvailableCreditMinor,
      currency: params.currency || 'LKR',
      breakdownUsed: {
        promotionalMinor: promoUsed,
        serviceMinor: serviceUsed,
        refundMinor: refundUsed
      },
      fxBasis
    };
  }

  /**
   * Reverses an erroneous credit with staff audit trail
   */
  public async reverseCredit(params: {
    customerId: string;
    transactionId: string;
    reason: string;
    staffActor: StaffAuditActor;
  }): Promise<TravelCreditTransaction> {
    if (!params.staffActor || !params.staffActor.id) {
      throw new Error('Mandatory staffActor identification required for credit reversal.');
    }
    if (!params.reason) {
      throw new Error('Documented justification reason is mandatory.');
    }

    const list = this.transactions.get(params.customerId) || [];
    const orig = list.find(t => t.transactionId === params.transactionId);
    if (!orig) throw new Error(`Transaction '${params.transactionId}' not found`);
    if (orig.direction !== 'CREDIT') throw new Error(`Only CREDIT transactions can be reversed via reverseCredit.`);

    const balance = await this.getBalance(params.customerId);
    const balanceAfterMinor = Math.max(0, balance.totalAvailableMinor - orig.amountMinor);

    // Append reversal entry
    const reversalTx: TravelCreditTransaction = {
      transactionId: generateTxId(),
      walletAccountId: orig.walletAccountId,
      customerId: params.customerId,
      direction: 'DEBIT',
      creditType: orig.creditType,
      transactionKind: 'ADMIN_ADJUSTMENT',
      amountMinor: orig.amountMinor,
      currency: orig.currency,
      balanceAfterMinor,
      status: 'REVERSED',
      description: `Reversal of ${orig.transactionId}: ${params.reason}`,
      referenceId: orig.transactionId,
      staffActor: params.staffActor,
      createdAtIso: new Date().toISOString()
    };

    orig.status = 'REVERSED';
    list.push(reversalTx);
    this.transactions.set(params.customerId, list);

    this.notifySubscribers(await this.getBalance(params.customerId));
    return reversalTx;
  }

  // --------------------------------------------------------------------------
  // Closed-Loop Regulatory Invariant Guards (CBSL Anti-E-Money Protection)
  // --------------------------------------------------------------------------
  public attemptCashTopUp(): never {
    throw new Error(
      'CLOSED_LOOP_RESTRICTION: Cash top-ups and stored-money loading are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance (CBSL Regulatory Framework).'
    );
  }

  public attemptP2PTransfer(): never {
    throw new Error(
      'CLOSED_LOOP_RESTRICTION: Peer-to-peer (P2P) transfers between customers are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance.'
    );
  }

  public attemptCashWithdrawal(): never {
    throw new Error(
      'CLOSED_LOOP_RESTRICTION: Bank withdrawals, cash payouts, and monetary refunds of travel credit are strictly prohibited under Vacatina Closed-Loop Travel Credit compliance.'
    );
  }

  /**
   * Observer subscription for reactive UI updates
   */
  public subscribe(callback: (summary: TravelCreditBalanceSummary) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers(summary: TravelCreditBalanceSummary): void {
    for (const sub of this.subscribers) {
      try {
        sub(summary);
      } catch {
        // Non-blocking observer
      }
    }
  }
}

export const globalTravelCreditLedgerService = new TravelCreditLedgerService();
