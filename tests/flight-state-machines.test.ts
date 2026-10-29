import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canTransition,
  transition,
  isFullyConfirmed,
  lifecycleNames,
} from '../src/features/flights/domain/flight-state-machines.ts';

test('flight state machines: valid transitions allowed', () => {
  assert.equal(canTransition('payment', 'pending', 'authorized'), true);
  assert.equal(canTransition('booking', 'pending', 'confirmed'), true);
  assert.equal(canTransition('ticket', 'issuing', 'issued'), true);
  assert.equal(canTransition('change', 'quoted', 'accepted'), true);
  assert.equal(canTransition('refund', 'quoted', 'approved'), true);
  assert.equal(canTransition('disruption', 'detected', 'customer_action_required'), true);
});

test('flight state machines: invalid transitions rejected', () => {
  assert.equal(canTransition('payment', 'failed', 'captured'), false);
  assert.equal(canTransition('booking', 'confirmed', 'pending'), false);
  assert.equal(canTransition('ticket', 'issued', 'issuing'), false);
  assert.throws(() => transition('payment', 'failed', 'captured'));
});

test('flight state machines: terminal states have no outgoing transitions', () => {
  assert.deepEqual([], []); // placeholder
  for (const t of ['refund', 'change'] as const) {
    // paid/completed are terminal
  }
  assert.equal(canTransition('refund', 'paid', 'processing'), false);
  assert.equal(canTransition('change', 'completed', 'processing'), false);
  assert.equal(canTransition('booking', 'cancelled', 'confirmed'), false);
  assert.equal(canTransition('ticket', 'voided', 'issued'), false);
});

test('flight state machines: independence guard requires all three success states', () => {
  assert.equal(isFullyConfirmed({ payment: 'captured', booking: 'confirmed', ticket: 'issued' }), true);
  assert.equal(isFullyConfirmed({ payment: 'captured', booking: 'confirmed', ticket: 'not_issued' }), false);
  assert.equal(isFullyConfirmed({ payment: 'authorized', booking: 'confirmed', ticket: 'issued' }), false);
  assert.equal(isFullyConfirmed({ payment: 'captured', booking: 'pending', ticket: 'issued' }), false);
});

test('flight state machines: payment success does not imply booking confirmed', () => {
  // explicit independence: captured payment alone is not fully confirmed
  assert.equal(isFullyConfirmed({ payment: 'captured', booking: 'pending', ticket: 'not_issued' }), false);
});

test('flight state machines: all 10 lifecycles registered', () => {
  const names = lifecycleNames();
  assert.equal(names.length, 10);
  for (const n of ['search','offer','tripBucket','payment','booking','ticket','change','refund','disruption','manualRequest']) {
    assert.ok(names.includes(n as any), n);
  }
});

test('flight state machines: search transitions include no_results and error', () => {
  assert.equal(canTransition('search', 'loading', 'no_results'), true);
  assert.equal(canTransition('search', 'loading', 'error'), true);
  assert.equal(canTransition('search', 'loading', 'partial'), true);
});

test('flight state machines: manual request never auto-issues ticket', () => {
  // ticket cannot jump from not_issued to issued without issuing
  assert.equal(canTransition('ticket', 'not_issued', 'issued'), false);
  assert.equal(canTransition('ticket', 'not_issued', 'issuing'), true);
});

test('flight state machines: manual request transitions', () => {
  assert.equal(canTransition('manualRequest', 'submitted', 'operator_review'), true);
  assert.equal(canTransition('manualRequest', 'operator_review', 'quote_prepared'), true);
  assert.equal(canTransition('manualRequest', 'quote_prepared', 'customer_approval'), true);
  assert.equal(canTransition('manualRequest', 'customer_approval', 'payment_pending'), true);
  assert.equal(canTransition('manualRequest', 'payment_pending', 'confirmed'), true);
  // no auto-confirm from quote
  assert.equal(canTransition('manualRequest', 'quote_prepared', 'confirmed'), false);
  // declined can resubmit
  assert.equal(canTransition('manualRequest', 'declined', 'submitted'), true);
  // confirmed is terminal
  assert.equal(canTransition('manualRequest', 'confirmed', 'payment_pending'), false);
});

test('flight state machines: 10 lifecycles registered', () => {
  assert.equal(lifecycleNames().length, 10);
});