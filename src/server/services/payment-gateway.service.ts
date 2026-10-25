/* ============================================================================
 * Vacatina Payment Gateway Abstraction & Idempotent Webhook Ledger
 * Authority: docs/11_PRODUCTION_IMPLEMENTATION_CHARTER.md & ADR-004
 * ============================================================================ */

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type { PaymentOrderEntity, UUID } from '../db/schema.ts';
import { globalStorageEngine, type VacatinaStorageEngine } from '../db/storage.ts';

export interface CreatePaymentIntentParams {
  bookingGroupId: UUID;
  organizationId?: UUID;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  idempotencyKey: string;
  returnUrl: string;
}

export interface PaymentIntentResult {
  paymentOrderId: UUID;
  clientSecret: string;
  gatewayOrderId: string;
  checkoutUrl: string;
  status: 'PENDING' | 'AUTHORIZED';
}

export class PaymentGatewayService {
  private storage: VacatinaStorageEngine;

  constructor(storage: VacatinaStorageEngine = globalStorageEngine) {
    this.storage = storage;
  }

  /**
   * Creates an idempotent payment order and generates checkout session tokens.
   */
  public async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    // 1. Idempotency Check
    const existingKey = this.storage.getIdempotencyRecord(params.idempotencyKey);
    if (existingKey && existingKey.responseBody) {
      return JSON.parse(existingKey.responseBody) as PaymentIntentResult;
    }

    const gatewayOrderId = `ord_gw_${generateUUID().slice(0, 12)}`;
    const clientSecret = `sec_${generateUUID().replace(/-/g, '')}`;
    const checkoutUrl = `${params.returnUrl}?session_id=${gatewayOrderId}&sec=${clientSecret}`;

    const order = this.storage.createPaymentOrder({
      bookingGroupId: params.bookingGroupId,
      organizationId: params.organizationId,
      gatewayId: 'MOCK_SANDBOX',
      gatewayOrderId,
      amountMinor: params.amountMinor,
      currency: params.currency,
      status: 'PENDING',
      idempotencyKey: params.idempotencyKey
    });

    const result: PaymentIntentResult = {
      paymentOrderId: order.id,
      clientSecret,
      gatewayOrderId,
      checkoutUrl,
      status: 'PENDING'
    };

    // Store idempotency result
    this.storage.recordIdempotency({
      idempotencyKey: params.idempotencyKey,
      targetEndpoint: '/api/v1/checkout/payment-intent',
      requestHash: `${params.bookingGroupId}:${params.amountMinor}:${params.currency}`,
      responseStatus: 200,
      responseBody: JSON.stringify(result),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    });

    return result;
  }

  /**
   * Simulates/Verifies cryptographic webhook signatures.
   */
  public verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    // In production: crypto.createHmac('sha256', secret).update(payload).digest('hex') === signature
    return signature.length > 8;
  }

  /**
   * Processes incoming payment gateway webhook events idempotently.
   */
  public async handleWebhookEvent(params: {
    gatewayId: string;
    eventId: string;
    eventType: string;
    payloadString: string;
    signatureHeader: string;
  }): Promise<{ status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'ERROR'; reason?: string }> {
    // 1. Replay & Deduplication Check
    if (this.storage.hasProcessedWebhook(params.gatewayId, params.eventId)) {
      return { status: 'ALREADY_PROCESSED', reason: `Event ${params.eventId} already recorded and applied` };
    }

    // 2. Parse Event
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(params.payloadString);
    } catch {
      return { status: 'ERROR', reason: 'Invalid JSON payload' };
    }

    const paymentOrderId = payload.paymentOrderId as UUID | undefined;
    const bookingGroupId = payload.bookingGroupId as UUID | undefined;

    // 3. Update Payment Order and Booking Group
    if (paymentOrderId) {
      if (params.eventType === 'payment_intent.succeeded') {
        this.storage.updatePaymentOrder(paymentOrderId, {
          status: 'CAPTURED',
          settledAt: new Date().toISOString()
        });
        if (bookingGroupId) {
          this.storage.updateBookingGroup(bookingGroupId, {
            paymentStatus: 'SETTLED'
          });
        }
      } else if (params.eventType === 'payment_intent.payment_failed') {
        this.storage.updatePaymentOrder(paymentOrderId, {
          status: 'FAILED'
        });
      }
    }

    // 4. Record to Immutable Webhook Ledger
    this.storage.recordPaymentWebhook({
      gatewayId: params.gatewayId,
      eventId: params.eventId,
      eventType: params.eventType,
      rawPayload: params.payloadString,
      processedStatus: 'PROCESSED',
      idempotencyKey: `wh_${params.gatewayId}_${params.eventId}`,
      processedAt: new Date().toISOString()
    });

    return { status: 'SUCCESS' };
  }

  /**
   * Issues refund through the payment gateway abstraction.
   */
  public async processRefund(paymentOrderId: UUID, amountMinor: number, reason: string): Promise<{ success: boolean; refundId: string }> {
    const order = this.storage.getPaymentOrder(paymentOrderId);
    if (!order) throw new Error(`Payment order ${paymentOrderId} not found`);

    const refundId = `ref_${generateUUID().slice(0, 12)}`;
    this.storage.updatePaymentOrder(paymentOrderId, {
      status: 'REFUNDED'
    });

    this.storage.recordAuditLog({
      action: 'PAYMENT_REFUND_EXECUTED',
      targetEntity: 'payment_orders',
      targetEntityId: paymentOrderId,
      previousState: { status: order.status, amountMinor: order.amountMinor },
      newState: { status: 'REFUNDED', refundedAmountMinor: amountMinor },
      justificationReason: reason
    });

    return { success: true, refundId };
  }
}

export const globalPaymentGatewayService = new PaymentGatewayService();
