# ADR-004: Payment Gateway Abstraction & Merchant of Record Strategy

> **Status**: APPROVED & ADOPTED  
> **Date**: 2026-10-25  
> **Context**: Designing PCI-compliant, multi-gateway payment processing with multi-currency settlement and idempotent webhooks.

---

## 1. Context & Problem Statement
Vacatina operates across multiple jurisdictions (Sri Lanka, UAE, international) with distinct merchant constraints (e.g. Stripe availability in UAE, commercial payment gateways in Sri Lanka, multi-currency settlement in LKR, USD, AED, EUR). A direct, hardcoded binding to a single payment vendor creates unacceptable vendor lock-in and compliance risks. Furthermore, payment webhooks are delivered at-least-once, risking duplicate charges or duplicate booking completions.

## 2. Decision
We implement a **Provider-Agnostic Payment Gateway Abstraction Layer**:

### 2.1 Universal Payment Adapter Interface
```typescript
export interface PaymentGatewayAdapter {
  gatewayId: 'STRIPE' | 'PAYPAL' | 'COMMERCIAL_BANK_LK' | 'MOCK_SANDBOX';
  
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean>;
  parseWebhookEvent(payload: string): Promise<PaymentWebhookEvent>;
  capturePayment(paymentOrderId: string, amountMinor: number): Promise<PaymentCaptureResult>;
  refundPayment(paymentOrderId: string, amountMinor: number, reason: string): Promise<PaymentRefundResult>;
}
```

### 2.2 Payment Idempotency & Webhook Ledger
Every financial transaction is guarded by an immutable **Payment Webhook Ledger**:
$$\text{idempotencyKey} \longrightarrow \text{paymentOrderId} \longrightarrow \text{gatewayReference} \longrightarrow \text{webhookEventId}$$

1. **Deduplication by Event ID**: Webhooks inspect `payment_webhook_events`. If `eventId` already exists, the event is acknowledged immediately without re-processing.
2. **SAQ-A Compliance**: Card entry occurs exclusively within vendor-hosted checkout or PCI-DSS Level 1 compliant secure fields. Raw PAN (Primary Account Numbers) and CVV codes never touch Vacatina application servers.
3. **Integer Minor Units**: All monetary amounts are stored as 64-bit integer minor units (e.g., LKR cents, USD cents) alongside ISO currency codes to eliminate floating-point rounding errors.

## 3. Consequences
- Clean separation of business booking logic from payment vendor idiosyncrasies.
- Zero duplicate charge risk across webhook replays or network retries.
