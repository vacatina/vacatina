/* ============================================================================
 * Vacatina Flights — Independent Lifecycle State Machines
 * Each lifecycle (payment, booking, ticketing, change, refund, disruption, ...)
 * is independent. A transition in one does NOT implicitly advance another.
 * ============================================================================ */

export type SearchState = 'draft' | 'loading' | 'partial' | 'complete' | 'no_results' | 'error';
export type OfferState = 'available' | 'recheck_required' | 'price_changed' | 'expired' | 'unavailable';
export type TripBucketState = 'draft' | 'needs_action' | 'ready' | 'recheck_required' | 'unavailable';
export type PaymentState = 'not_started' | 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
export type BookingState = 'requested' | 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type TicketState = 'not_issued' | 'issuing' | 'issued' | 'failed' | 'voided';
export type ChangeState = 'requested' | 'quoted' | 'accepted' | 'processing' | 'completed' | 'rejected';
export type RefundState = 'requested' | 'quoted' | 'approved' | 'processing' | 'paid' | 'rejected';
export type DisruptionState = 'detected' | 'customer_action_required' | 'accepted' | 'alternative_requested' | 'resolved';
export type ManualRequestState = 'submitted' | 'operator_review' | 'quote_prepared' | 'customer_approval' | 'payment_pending' | 'confirmed' | 'declined' | 'unavailable';

const TRANSITIONS: Record<string, Record<string, string[]>> = {
  search: {
    draft: ['loading'],
    loading: ['partial', 'complete', 'no_results', 'error'],
    partial: ['complete', 'no_results', 'error', 'loading'],
    complete: ['loading'],
    no_results: ['loading', 'draft'],
    error: ['loading', 'draft'],
  },
  offer: {
    available: ['recheck_required', 'price_changed', 'expired', 'unavailable'],
    recheck_required: ['available', 'price_changed', 'expired', 'unavailable'],
    price_changed: ['available', 'expired', 'unavailable'],
    expired: ['available'],
    unavailable: ['available'],
  },
  tripBucket: {
    draft: ['needs_action', 'ready', 'unavailable'],
    needs_action: ['ready', 'unavailable', 'draft'],
    ready: ['recheck_required', 'unavailable', 'draft'],
    recheck_required: ['ready', 'unavailable', 'draft'],
    unavailable: ['draft'],
  },
  payment: {
    not_started: ['pending'],
    pending: ['authorized', 'failed'],
    authorized: ['captured', 'failed', 'refunded'],
    captured: ['refunded'],
    failed: ['pending', 'not_started'],
    refunded: [],
  },
  booking: {
    requested: ['pending', 'failed'],
    pending: ['confirmed', 'failed', 'cancelled'],
    confirmed: ['cancelled'],
    failed: ['requested'],
    cancelled: [],
  },
  ticket: {
    not_issued: ['issuing', 'failed'],
    issuing: ['issued', 'failed'],
    issued: ['voided'],
    failed: ['issuing', 'not_issued'],
    voided: [],
  },
  change: {
    requested: ['quoted', 'rejected'],
    quoted: ['accepted', 'rejected'],
    accepted: ['processing'],
    processing: ['completed', 'rejected'],
    completed: [],
    rejected: ['requested'],
  },
  refund: {
    requested: ['quoted', 'rejected'],
    quoted: ['approved', 'rejected'],
    approved: ['processing'],
    processing: ['paid', 'rejected'],
    paid: [],
    rejected: ['requested'],
  },
  disruption: {
    detected: ['customer_action_required'],
    customer_action_required: ['accepted', 'alternative_requested', 'resolved'],
    accepted: ['resolved'],
    alternative_requested: ['resolved'],
    resolved: [],
  },
  manualRequest: {
    submitted: ['operator_review', 'declined', 'unavailable'],
    operator_review: ['quote_prepared', 'declined', 'unavailable'],
    quote_prepared: ['customer_approval', 'declined', 'unavailable'],
    customer_approval: ['payment_pending', 'declined'],
    payment_pending: ['confirmed', 'declined'],
    confirmed: [],
    declined: ['submitted'],
    unavailable: ['submitted'],
  },
};

export type LifecycleName = keyof typeof TRANSITIONS;

export function canTransition(lifecycle: LifecycleName, from: string, to: string): boolean {
  const allowed = TRANSITIONS[lifecycle]?.[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function transition(lifecycle: LifecycleName, from: string, to: string): string {
  if (!canTransition(lifecycle, from, to)) {
    throw new Error(`Invalid ${lifecycle} transition: ${from} -> ${to}`);
  }
  return to;
}

/**
 * Independence guard: payment success does not imply booking confirmed.
 * Returns true only if every supplied lifecycle is in a success terminal-ish state.
 */
export function isFullyConfirmed(input: {
  payment: PaymentState;
  booking: BookingState;
  ticket: TicketState;
}): boolean {
  return input.payment === 'captured' && input.booking === 'confirmed' && input.ticket === 'issued';
}

export function lifecycleNames(): LifecycleName[] {
  return Object.keys(TRANSITIONS) as LifecycleName[];
}