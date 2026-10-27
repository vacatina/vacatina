import type { BookingOverallStatus } from '../db/schema.ts';
import type { BookingRecord } from '../persistence/readiness-contracts.ts';
import { ReadinessError } from '../persistence/readiness-contracts.ts';

export const BOOKING_TRANSITIONS: Record<BookingOverallStatus, readonly BookingOverallStatus[]> = {
  PENDING_REVALIDATION: ['BOOKING', 'MANUAL_REVIEW', 'CANCEL_PENDING', 'FAILED', 'EXPIRED'],
  BOOKING: ['CONFIRMED', 'PARTIAL_FAILURE', 'MANUAL_REVIEW', 'CANCEL_PENDING', 'FAILED'],
  MANUAL_REVIEW: ['BOOKING', 'CONFIRMED', 'PARTIAL_FAILURE', 'CANCEL_PENDING', 'FAILED', 'EXPIRED'],
  PARTIAL_FAILURE: ['BOOKING', 'MANUAL_REVIEW', 'CONFIRMED', 'CANCEL_PENDING', 'REFUND_PENDING'],
  CONFIRMED: ['FULFILMENT_PENDING', 'CANCEL_PENDING', 'REFUND_PENDING'],
  FULFILMENT_PENDING: ['FULFILLED', 'MANUAL_REVIEW', 'CANCEL_PENDING'],
  FULFILLED: ['CANCEL_PENDING', 'REFUND_PENDING'],
  CANCEL_PENDING: ['CANCELLED', 'MANUAL_REVIEW'],
  CANCELLED: ['REFUND_PENDING'], REFUND_PENDING: ['CANCELLED', 'MANUAL_REVIEW'],
  FAILED: [], EXPIRED: []
};

export function transitionBooking(record: BookingRecord, next: BookingOverallStatus): BookingRecord {
  const previous = record.group.overallFulfillmentStatus;
  if (previous === next) return record;
  if (!BOOKING_TRANSITIONS[previous]?.includes(next)) throw new ReadinessError('FORBIDDEN_BOOKING_TRANSITION');
  if (['BOOKING', 'CONFIRMED', 'FULFILMENT_PENDING', 'FULFILLED'].includes(next) && record.group.paymentStatus !== 'SETTLED') throw new ReadinessError('VERIFIED_PAYMENT_REQUIRED');
  if (next === 'CONFIRMED' && (!record.items.length || record.items.some(item => {
    const proof = record.confirmations[item.id];
    return item.fulfillmentStatus !== 'CONFIRMED' || !proof?.reference || !proof.evidenceId ||
      (proof.kind === 'SUPPLIER' && !item.isUpstreamConfirmed) ||
      (item.bookingMode !== 'INSTANT_BOOK' && proof.kind !== 'MANUAL');
  }))) throw new ReadinessError('CONFIRMATION_EVIDENCE_REQUIRED');
  return { ...record, group: { ...record.group, overallFulfillmentStatus: next }, revision: record.revision + 1 };
}
