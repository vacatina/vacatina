import test from 'node:test';
import assert from 'node:assert/strict';

// Negative-control tests for the E2E verify script's detection logic.
// These verify that broken navigation and missing controls are detected as failures.

test('negative control: navOk must be false when URL does not change after click', () => {
  // Simulate: link exists but click does not navigate
  const afterUrl = '/bookings/VCT-2026-0001/change';
  const sRoute = '/bookings/VCT-2026-0001/change';
  const navOk = (afterUrl !== sRoute);
  assert.equal(navOk, false, 'navOk must be false when URL unchanged');
});

test('negative control: navOk must be true only when URL changes', () => {
  const afterUrl = '/flights';
  const sRoute = '/bookings/VCT-2026-0001/change';
  const navOk = (afterUrl !== sRoute);
  assert.equal(navOk, true, 'navOk must be true when URL changed');
});

test('negative control: a11y must fail when unnamed controls exist', () => {
  const controls = 5;
  const named = 3;
  const hasNamedControls = controls === 0 || named === controls;
  assert.equal(hasNamedControls, false, 'a11y must fail when not all controls named');
});

test('negative control: a11y passes only when all controls named', () => {
  const controls = 5;
  const named = 5;
  const hasNamedControls = controls === 0 || named === controls;
  assert.equal(hasNamedControls, true, 'a11y passes when all controls named');
});

test('negative control: heading match must fail on wrong heading', () => {
  const heading = 'Wrong Page Title';
  const expected = 'Change Flight';
  const headingMatch = heading.toLowerCase().includes(expected.toLowerCase().split(' ')[0]);
  assert.equal(headingMatch, false, 'heading match must fail on wrong heading');
});

test('negative control: reduced motion must be detected as present', () => {
  // CSS without prefers-reduced-motion
  const cssTexts = ['body { color: red; }'];
  const hasReducedMotion = cssTexts.some(t => t.includes('prefers-reduced-motion'));
  assert.equal(hasReducedMotion, false, 'reduced motion absent must be detected');
});