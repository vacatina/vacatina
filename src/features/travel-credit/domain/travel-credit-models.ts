/* ============================================================================
 * Vacatina Travel Credit Domain Models & Double-Entry Ledger Schema
 * Authority: CBSL Closed-Loop Compliance & Vacatina Travel Credit Architecture v1.0
 *
 * Invariants:
 * 1. Customer-facing name is strictly "Vacatina Travel Credit" (NOT "Wallet").
 * 2. Closed-loop only: No cash top-ups, no P2P transfers, no cash withdrawals.
 * 3. Derived strictly from Refunds, Promotional Campaigns, and Service Credits.
 * 4. Multi-bucket tracking: Refund Credit, Promotional Credit, Service Credit.
 * 5. Append-only double-entry ledger: Transactions are never edited or deleted.
 * 6. Partial-payment support: Remaining balance paid via Card/Bank/Gateway.
 * ============================================================================ */

export type TravelCreditBucketType =
  | 'REFUND_CREDIT'       // Derived from cancelled booking refunds
  | 'PROMOTIONAL_CREDIT'  // Marketing campaign bonuses (expirable)
  | 'SERVICE_CREDIT';     // Admin goodwill or service compensation

export type TravelCreditTransactionDirection = 'CREDIT' | 'DEBIT';

export type TravelCreditTransactionStatus =
  | 'PENDING'         // Pending supplier/gateway confirmation
  | 'AVAILABLE'       // Available for redemption in checkout
  | 'PARTIALLY_USED'  // Partially redeemed across bookings
  | 'USED'            // Completely redeemed
  | 'EXPIRED'         // Expired promotional credit
  | 'REVERSED';       // Reversal of prior transaction

export type TravelCreditTransactionKind =
  | 'BOOKING_REFUND'        // Refund value converted to credit
  | 'PROMOTIONAL_GRANT'     // Marketing campaign bonus
  | 'SERVICE_GOODWILL'      // Admin goodwill / concierge compensation
  | 'CHECKOUT_REDEMPTION'   // Applied as payment towards booking
  | 'REDEMPTION_REVERSAL'   // Refund of credit due to failed/cancelled booking
  | 'PROMOTIONAL_EXPIRY'    // Automatic expiry of promotional funds
  | 'ADMIN_ADJUSTMENT';     // Ledger correction by authorized staff

export interface StaffAuditActor {
  id: string;
  name: string;
  role: string;
  reason?: string;
}

export interface FxConversionBasis {
  baseCurrency: string;       // e.g. "LKR"
  settlementCurrency: string; // e.g. "USD", "AED"
  exchangeRate: number;       // 1 settlementCurrency = exchangeRate baseCurrency
  baseDebitMinor: number;
  settlementAmountMinor: number;
  calculatedAtIso: string;
}

/**
 * Immutable Double-Entry Ledger Transaction Record
 */
export interface TravelCreditTransaction {
  transactionId: string;           // Stable ID: vct-tx-${uuid}
  walletAccountId: string;         // Stable ID: vct-tc-acc-${customerId}
  customerId: string;              // Clerk / B2C user ID
  direction: TravelCreditTransactionDirection;
  creditType: TravelCreditBucketType;
  transactionKind: TravelCreditTransactionKind;
  amountMinor: number;             // Minor currency units (e.g. 7,500,000 = LKR 75,000.00)
  currency: string;                // Default: "LKR"
  balanceAfterMinor: number;       // Running total available balance after entry
  status: TravelCreditTransactionStatus;
  description: string;
  referenceId: string;             // Booking ref, refund ref, or campaign code
  bookingId?: string;
  refundId?: string;
  staffActor?: StaffAuditActor;    // Mandatory for SERVICE_GOODWILL & ADMIN_ADJUSTMENT
  expiresAtIso?: string;           // Optional expiry for PROMOTIONAL_CREDIT
  createdAtIso: string;
  fxBasis?: FxConversionBasis;     // Transparent FX conversion if booking settlement != LKR
}

/**
 * Customer Multi-Bucket Balance Summary
 */
export interface TravelCreditBalanceSummary {
  walletAccountId: string;
  customerId: string;
  currency: string;
  totalAvailableMinor: number;
  totalPendingMinor: number;
  // Multi-Bucket Breakdown
  refundCreditMinor: number;
  promotionalCreditMinor: number;
  serviceCreditMinor: number;
  earliestExpiringDateIso?: string;
  lastUpdatedAtIso: string;
}

export interface TravelCreditRedemptionRequest {
  customerId: string;
  bookingGroupId: string;
  orderTotalMinor: number;
  currency: string;
  requestedCreditAmountMinor?: number; // Optional cap; defaults to max eligible
  settlementCurrency?: string;
  fxRate?: number;
}

export interface TravelCreditRedemptionResult {
  success: boolean;
  transactionId: string;
  bookingGroupId: string;
  appliedCreditMinor: number;
  remainingOrderBalanceMinor: number;
  newAvailableCreditMinor: number;
  currency: string;
  breakdownUsed: {
    promotionalMinor: number;
    serviceMinor: number;
    refundMinor: number;
  };
  fxBasis?: FxConversionBasis;
}

export interface RefundDestinationChoice {
  bookingId: string;
  bookingReference: string;
  eligibleRefundMinor: number;
  currency: string;
  selectedDestination: 'ORIGINAL_PAYMENT_METHOD' | 'VACATINA_TRAVEL_CREDIT';
  customerNote?: string;
  processedAtIso?: string;
  status: 'PENDING_APPROVAL' | 'PROCESSED' | 'REJECTED';
}
