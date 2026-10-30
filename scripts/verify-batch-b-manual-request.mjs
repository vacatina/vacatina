/**
 * Vacatina — Batch B interaction E2E (screens 46–50, manual request-to-book).
 *
 * Drives real controls: invalid dates, short phone, missing consent, valid submit,
 * tracker advancement through the real manualRequest state machine, withdraw gates,
 * quotation totals, approve/decline gates and decline recovery.
 *
 * Run: node scripts/verify-batch-b-manual-request.mjs
 */
import { runSuite, assert, assertEqual, sleep } from './lib/e2e-harness.mjs';

const REQ = 'VCT-REQ-0001';
const KEY = `vacatina:manualRequest:${REQ}`;
const R = `/flights/requests/${REQ}`;

await runSuite('Batch B — Manual request-to-book (46–50)', async h => {
  /* ---------------------------------------------------------------- 46 review */

  await h.check('46 review — return date before departure is rejected', async () => {
    await h.clearStore();
    await h.go(`${R}/review`);
    assertEqual(await h.attr('#mr-heading', 'id'), 'mr-heading', 'review heading present');
    await h.setValue('#mr-depart', '2026-12-20', 'input');
    await h.setValue('#mr-return', '2026-12-10', 'input');
    assert(await h.click('#mr-submit'), 'submit button missing');
    const err = await h.text('#mr-form-error');
    assert(/return date must be after/i.test(err || ''), `expected date error, got ${err}`);
    assertEqual(await h.attr('#mr-depart', 'aria-invalid'), 'true', 'depart aria-invalid');
    assertEqual(await h.attr('#mr-return', 'aria-invalid'), 'true', 'return aria-invalid');
    assertEqual(await h.url(), `${R}/review`, 'must not navigate on invalid dates');
    assertEqual(await h.store(KEY), null, 'no request may be persisted on invalid input');
    return err.trim();
  });

  await h.check('46 review — short contact phone is rejected', async () => {
    await h.setValue('#mr-depart', '2026-12-10', 'input');
    await h.setValue('#mr-return', '2026-12-17', 'input');
    await h.setValue('#mr-phone', '077', 'input');
    assert(await h.click('#mr-submit'), 'submit button missing');
    const err = await h.text('#mr-form-error');
    assert(/at least 9 digits/i.test(err || ''), `expected phone error, got ${err}`);
    assertEqual(await h.attr('#mr-phone', 'aria-invalid'), 'true', 'phone aria-invalid');
    assertEqual(await h.url(), `${R}/review`, 'must not navigate with a bad phone');
    return err.trim();
  });

  await h.check('46 review — missing consent blocks submission', async () => {
    await h.setValue('#mr-phone', '+94 77 123 4567', 'input');
    assert(await h.click('#mr-submit'), 'submit button missing');
    const err = await h.text('#mr-form-error');
    assert(/request, not a confirmed booking/i.test(err || ''), `expected consent error, got ${err}`);
    assertEqual(await h.url(), `${R}/review`, 'must not navigate without consent');
    assertEqual(await h.store(KEY), null, 'nothing persisted without consent');
    return err.trim();
  });

  await h.check('46 review — valid submission persists and navigates to 47', async () => {
    assert(await h.setChecked('#mr-consent', true), 'consent checkbox missing');
    assert(await h.click('#mr-submit'), 'submit button missing');
    await sleep(500);
    assertEqual(await h.url(), `${R}/submitted`, 'should land on the submitted stage');
    const rec = await h.store(KEY);
    assert(rec && rec.status === 'submitted', `expected stored submitted record, got ${JSON.stringify(rec?.status)}`);
    assertEqual(rec.departDate, '2026-12-10', 'depart persisted');
    assertEqual(rec.returnDate, '2026-12-17', 'return persisted');
    assertEqual(rec.adults, 2, 'adults persisted');
    assertEqual(rec.children, 1, 'children persisted');
    assertEqual(rec.contactPhone, '+94 77 123 4567', 'phone persisted');
    return `status=${rec.status} ${rec.departDate}→${rec.returnDate} ${rec.adults}A/${rec.children}C`;
  });

  /* ------------------------------------------------------------- 47 submitted */

  await h.check('47 submitted — honest copy, no fabricated confirmation', async () => {
    const body = await h.text('section.flights-manual-request');
    assert(/recorded \(preview\)/i.test(body || ''), 'must label the request as a preview');
    assert(/No seat is held and no fare is locked/i.test(body || ''), 'must state no seat/fare is held');
    assert(/No instant ticket, payment capture or supplier confirmation is performed here/i.test(body || ''), 'must carry the preview note');
    return 'preview labels present';
  });

  await h.check('47 submitted — track link navigates to the tracker', async () => {
    assert(await h.click('#mr-track-link'), 'track link missing');
    await sleep(500);
    assertEqual(await h.url(), R, 'tracker route');
    assertEqual(await h.attr('[data-mr-stage]', 'data-mr-stage'), 'tracker', 'tracker stage rendered');
    return await h.url();
  });

  /* ---------------------------------------------------------------- 48 tracker */

  await h.check('48 tracker — first step reached, later steps pending', async () => {
    const state = await h.cdp.evaluate(`(() => {
      const steps = Array.from(document.querySelectorAll('[data-mr-step]')).map(s => ({ step: s.getAttribute('data-mr-step'), reached: s.getAttribute('data-reached') }));
      return steps;
    })()`);
    assertEqual(state[0].step, 'submitted', 'first step is submitted');
    assertEqual(state[0].reached, 'true', 'submitted step reached');
    assertEqual(state[1].reached, 'false', 'operator review not yet reached');
    return state.map(s => `${s.step}:${s.reached}`).join(',');
  });

  await h.check('48 tracker — advance desk review moves to operator_review and persists', async () => {
    assert(await h.click('#mr-demo-advance'), 'advance button missing');
    await sleep(400);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'operator_review', 'status after first advance');
    const badge = await h.text('#mr-status-badge');
    assert(/Operator Review/i.test(badge || ''), `badge should read Operator Review, got ${badge}`);
    const result = await h.text('#mr-advance-result');
    assert(/No supplier action was performed/i.test(result || ''), 'advance must be labelled a preview');
    return badge.trim();
  });

  await h.check('48 tracker — advancing to quote_prepared reveals the quotation link', async () => {
    assert(await h.click('#mr-demo-advance'), 'advance button missing');
    await sleep(400);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'quote_prepared', 'status after second advance');
    assert(rec.quote && rec.quote.total === 185000, `quote must be computed on quote_prepared, got ${JSON.stringify(rec.quote)}`);
    assert(await h.exists('#mr-open-quote'), 'quotation link must appear once a quote exists');
    return `total=${rec.quote.total}`;
  });

  await h.check('48 tracker — withdraw without a reason is rejected', async () => {
    assert(await h.click('#mr-withdraw'), 'withdraw button missing');
    const err = await h.text('#mr-withdraw-error');
    assert(/select a reason/i.test(err || ''), `expected reason error, got ${err}`);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'quote_prepared', 'status must not change without a reason');
    return err.trim();
  });

  await h.check('48 tracker — withdraw with a reason moves to declined', async () => {
    await h.setValue('#mr-withdraw-reason', 'plans', 'change');
    assert(await h.click('#mr-withdraw'), 'withdraw button missing');
    await sleep(400);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'declined', 'status after withdraw');
    assert(/Change of plans/i.test(rec.declineReason || ''), `decline reason recorded, got ${rec.declineReason}`);
    assertEqual(await h.attr('#mr-withdraw', 'aria-disabled'), 'true', 'withdraw must be disabled after success');
    const result = await h.text('#mr-withdraw-result');
    assert(/No payment was taken and no ticket was issued/i.test(result || ''), 'withdraw must state no payment/ticket');
    return rec.declineReason;
  });

  await h.check('48 tracker — illegal transition from a terminal state is blocked (negative control)', async () => {
    await h.cdp.evaluate(`(() => {
      const raw = sessionStorage.getItem(${JSON.stringify(KEY)});
      const rec = JSON.parse(raw);
      rec.status = 'confirmed';
      sessionStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(rec));
      return true;
    })()`);
    await h.go(R);
    const advanceExists = await h.exists('#mr-demo-advance');
    assertEqual(advanceExists, false, 'no advance control may exist in a terminal confirmed state');
    assertEqual(await h.exists('#mr-open-quote'), false, 'no quotation link in a terminal state');
    return 'terminal state exposes no illegal actions';
  });

  /* -------------------------------------------------------------- 49 quotation */

  await h.check('49 quotation — deterministic totals for 2 adults + 1 child', async () => {
    await h.clearStore();
    await h.go(`${R}/review`);
    await h.setValue('#mr-depart', '2026-12-10', 'input');
    await h.setValue('#mr-return', '2026-12-17', 'input');
    await h.setValue('#mr-phone', '+94 77 123 4567', 'input');
    await h.setChecked('#mr-consent', true);
    await h.click('#mr-submit');
    await sleep(500);
    await h.go(R);
    await h.click('#mr-demo-advance');
    await h.click('#mr-demo-advance');
    await sleep(300);
    assert(await h.click('#mr-open-quote'), 'quotation link missing');
    await sleep(500);
    assertEqual(await h.url(), `${R}/quote`, 'quotation route');
    const totals = {
      base: await h.text('#mr-quote-base'),
      taxes: await h.text('#mr-quote-taxes'),
      fee: await h.text('#mr-quote-fee'),
      total: await h.text('#mr-quote-total'),
    };
    assertEqual(totals.base, 'LKR 169,000', 'base fare');
    assertEqual(totals.taxes, 'LKR 12,000', 'taxes');
    assertEqual(totals.fee, 'LKR 4,000', 'service fee');
    assertEqual(totals.total, 'LKR 185,000', 'grand total');
    return JSON.stringify(totals);
  });

  await h.check('49 quotation — approve without consent is rejected', async () => {
    assert(await h.click('#mr-accept-quote'), 'approve button missing');
    const err = await h.text('#mr-quote-error');
    assert(/approve the quotation/i.test(err || ''), `expected consent error, got ${err}`);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'quote_prepared', 'status must not change without consent');
    return err.trim();
  });

  await h.check('49 quotation — approve moves to payment_pending without capturing payment', async () => {
    await h.setChecked('#mr-quote-consent', true);
    assert(await h.click('#mr-accept-quote'), 'approve button missing');
    await sleep(400);
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'payment_pending', 'status after approval');
    const result = await h.text('#mr-quote-result');
    assert(/No payment was captured and no ticket was issued/i.test(result || ''), 'approval must state no payment/ticket');
    assertEqual(await h.attr('#mr-accept-quote', 'aria-disabled'), 'true', 'approve disabled after success');
    return rec.status;
  });

  await h.check('49 quotation — decline requires a reason and navigates to 50', async () => {
    await h.clearStore();
    await h.go(`${R}/review`);
    await h.setValue('#mr-depart', '2026-12-10', 'input');
    await h.setValue('#mr-return', '2026-12-17', 'input');
    await h.setValue('#mr-phone', '+94 77 123 4567', 'input');
    await h.setChecked('#mr-consent', true);
    await h.click('#mr-submit');
    await sleep(400);
    await h.go(R);
    await h.click('#mr-demo-advance');
    await h.click('#mr-demo-advance');
    await sleep(300);
    await h.go(`${R}/quote`);
    assert(await h.click('#mr-decline-quote'), 'decline button missing');
    assert(await h.exists('#mr-decline-panel'), 'decline panel must open');
    assert(await h.click('#mr-confirm-decline'), 'confirm decline missing');
    const err = await h.text('#mr-decline-error');
    assert(/select a reason/i.test(err || ''), `expected decline reason error, got ${err}`);
    await h.setValue('#mr-decline-reason', 'price', 'change');
    assert(await h.click('#mr-confirm-decline'), 'confirm decline missing');
    await sleep(500);
    assertEqual(await h.url(), `${R}/declined`, 'declined route');
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'declined', 'status after decline');
    assert(/Price too high/i.test(rec.declineReason || ''), 'decline reason persisted');
    return rec.declineReason;
  });

  /* --------------------------------------------------------------- 50 recovery */

  await h.check('50 declined — invalid recovery dates are rejected', async () => {
    await h.setValue('#mr-recover-depart', '2026-12-25', 'input');
    await h.setValue('#mr-recover-return', '2026-12-20', 'input');
    assert(await h.click('#mr-resubmit'), 'resubmit button missing');
    const err = await h.text('#mr-recover-error');
    assert(/return date must be after/i.test(err || ''), `expected date error, got ${err}`);
    assertEqual(await h.url(), `${R}/declined`, 'must not navigate on invalid recovery dates');
    return err.trim();
  });

  await h.check('50 declined — valid resubmit returns to 47 with a cleared quote', async () => {
    await h.setValue('#mr-recover-depart', '2026-12-22', 'input');
    await h.setValue('#mr-recover-return', '2026-12-29', 'input');
    assert(await h.click('#mr-resubmit'), 'resubmit button missing');
    await sleep(500);
    assertEqual(await h.url(), `${R}/submitted`, 'resubmit lands on submitted');
    const rec = await h.store(KEY);
    assertEqual(rec.status, 'submitted', 'status after resubmit');
    assertEqual(rec.departDate, '2026-12-22', 'new depart persisted');
    assertEqual(rec.returnDate, '2026-12-29', 'new return persisted');
    assertEqual(rec.quote, null, 'quote must be cleared on resubmit');
    assertEqual(rec.declineReason, '', 'decline reason cleared');
    return `${rec.status} ${rec.departDate}→${rec.returnDate}`;
  });

  /* --------------------------------------------------------- a11y / animation */

  await h.check('a11y — errors are announced via role=alert and aria-invalid', async () => {
    await h.clearStore();
    await h.go(`${R}/review`);
    await h.setValue('#mr-depart', '2026-12-20', 'input');
    await h.setValue('#mr-return', '2026-12-10', 'input');
    await h.click('#mr-submit');
    const roles = await h.cdp.evaluate(`(() => ({
      role: document.getElementById('mr-form-error')?.getAttribute('role'),
      live: document.getElementById('mr-form-error')?.getAttribute('aria-live'),
      invalid: document.getElementById('mr-depart')?.getAttribute('aria-invalid'),
      describedBy: document.getElementById('mr-depart')?.getAttribute('aria-describedby'),
      label: document.querySelector('label[for="mr-depart"]')?.textContent?.trim(),
    }))()`);
    assertEqual(roles.role, 'alert', 'error container role');
    assertEqual(roles.invalid, 'true', 'field aria-invalid');
    assertEqual(roles.describedBy, 'mr-form-error', 'field aria-describedby');
    assert(/departure date/i.test(roles.label || ''), 'programmatic label present');
    return JSON.stringify(roles);
  });

  await h.check('a11y — real Tab key produces a visible focus ring', async () => {
    await h.go(`${R}/review`);
    await h.cdp.evaluate('document.body.focus()');
    await h.pressTab();
    const focused = await h.cdp.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        id: el.id || null,
        focusVisible: el.matches(':focus-visible'),
        outlineWidth: cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    })()`);
    assert(focused, 'nothing received keyboard focus');
    assert(focused.focusVisible === true, `expected :focus-visible on ${focused.tag}#${focused.id}`);
    const ring = focused.outlineWidth !== '0px' || (focused.boxShadow && focused.boxShadow !== 'none');
    assert(ring, 'focused element must paint a visible ring');
    return JSON.stringify(focused);
  });

  await h.check('animation — reduced motion collapses transitions on this screen', async () => {
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await h.go(`${R}/review`);
    const motion = await h.cdp.evaluate(`(() => {
      const el = document.querySelector('.animate-fade-in') || document.querySelector('section');
      const cs = getComputedStyle(el);
      return { duration: cs.animationDuration, transition: cs.transitionDuration, transform: cs.animationName };
    })()`);
    assert(motion.duration === '0s' || motion.duration === '0.01s' || motion.duration === '1e-05s' || parseFloat(motion.duration) < 0.05, `animation-duration should collapse, got ${motion.duration}`);
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    return JSON.stringify(motion);
  });

  await h.check('no uncaught exceptions during Batch B flows', async () => {
    const exceptions = h.cdp.pageExceptions.filter(e => !/clerk/i.test(e));
    assertEqual(exceptions.length, 0, `uncaught exceptions: ${JSON.stringify(exceptions.slice(0, 3))}`);
    return '0 exceptions';
  });
});
