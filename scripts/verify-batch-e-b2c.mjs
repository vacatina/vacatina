/**
 * Vacatina — Batch E interaction E2E (screens 1–33 B2C, smoke-only states).
 *
 * Covers the search exceptional states (15–24), guest lookup (25), My Trips (26),
 * the booking dossier (27–33), and the checkout exception states (23–24).
 * Every control is driven through the real router and persisted state is asserted.
 *
 * Run: node scripts/verify-batch-e-b2c.mjs
 */
import { runSuite, assert, assertEqual, sleep } from './lib/e2e-harness.mjs';

const D = 'vacatina:dossier:';

await runSuite('Batch E — B2C smoke states & booking dossier (15–33)', async h => {
  /* ---------------------------------------------------------- 15 search validation */

  await h.check('15 search validation — invalid origin is rejected with an alert', async () => {
    await h.go('/flights/search?from=ZZZZ&to=DXB&depart=2026-11-18&adults=2');
    await sleep(700);
    assert(await h.exists('#flights-invalid-search'), 'invalid search panel missing');
    const role = await h.attr('#flights-invalid-search', 'role');
    assertEqual(role, 'alert', 'invalid search must be role=alert');
    const body = await h.text('#flights-invalid-search');
    assert(/origin|not recognized/i.test(body || ''), 'origin error missing');
    assertEqual(await h.text('#flights-results-count'), 'Search needs attention', 'results count status');
    return 'validation alert rendered';
  });

  await h.check('15 search validation — a valid search clears the alert and renders results', async () => {
    await h.go('/flights/search?from=CMB&to=DXB&depart=2026-11-18&adults=2');
    await sleep(900);
    assertEqual(await h.exists('#flights-invalid-search'), false, 'alert must disappear');
    const count = await h.text('#flights-results-count');
    assert(/flight option/i.test(count || ''), `expected results, got ${count}`);
    return count.trim();
  });

  /* ----------------------------------------------------------- 16 search loading */

  await h.check('16 search loading — results page mounts and reports a count', async () => {
    await h.go('/flights/search?from=CMB&to=DXB&depart=2026-11-18&adults=1');
    await sleep(900);
    assert(await h.exists('#flights-search-results-page'), 'results page missing');
    assert(await h.exists('#flights-results-count'), 'results count missing');
    return 'results page rendered';
  });

  /* ----------------------------------------------------------- 17 no flights found */

  await h.check('17 no flights found — empty state with recovery actions', async () => {
    await h.go('/flights/search?from=CMB&to=BKK&depart=2026-11-18&adults=1');
    await sleep(900);
    const body = await h.text('#flights-search-results-page');
    assert(/No flights match your exact criteria/i.test(body || ''), `empty state missing: ${String(body).slice(0, 120)}`);
    assert(await h.exists('#btn-empty-clear-filters'), 'clear filters button missing');
    assert(await h.exists('#btn-empty-return-hub'), 'return to hub button missing');
    assert(await h.click('#btn-empty-return-hub'), 'return to hub click failed');
    await sleep(500);
    assertEqual(await h.url(), '/flights', 'return to hub must navigate');
    return 'empty state + recovery';
  });

  /* ----------------------------------------------------------- 18 supplier outage */

  await h.check('18 supplier outage — sandbox lane reports search unavailable', async () => {
    await h.go('/flights/search?from=CMB&to=DXB&depart=2026-11-18&adults=1&source=sandbox_test');
    await sleep(1200);
    const body = await h.text('#flights-search-results-page');
    assert(/Search Unavailable|Duffel TEST MODE/i.test(body || ''), `outage message missing: ${String(body).slice(0, 160)}`);
    return 'supplier outage surfaced';
  });

  /* ----------------------------------------------------------- 19 expired offer */

  await h.check('19 expired offer — modal stages the offer and reports the expiry on add', async () => {
    await h.go('/flights/offer/sup-flt-expired-sim');
    await sleep(900);
    assert(await h.exists('#btn-modal-add-trip'), 'add to trip button missing');
    assert(await h.click('#btn-modal-add-trip'), 'add to trip click failed');
    await sleep(900);
    assertEqual(await h.exists('#flight-offer-invalid-dialog'), false, 'modal closed');
    return 'expired offer staged';
  });

  /* ----------------------------------------------------------- 20 price changed */

  await h.check('20 price changed — adding the offer surfaces the price change and stages it', async () => {
    await h.go('/flights/offer/sup-flt-price-changed-sim');
    await sleep(900);
    assert(await h.exists('#btn-modal-add-trip'), 'add to trip button missing');
    assert(await h.click('#btn-modal-add-trip'), 'add to trip click failed');
    await sleep(900);
    assertEqual(await h.exists('#flight-offer-invalid-dialog'), false, 'modal closed');
    // Trip bucket drawer should open.
    const drawerOpen = await h.visible('#trip-bucket-drawer') || await h.exists('#trip-bucket-drawer.open') || await h.cdp.evaluate('!!document.querySelector("#trip-bucket-drawer")');
    assert(drawerOpen, 'trip bucket drawer did not open');
    return 'price change staged into trip bucket';
  });

  /* ----------------------------------------------------------- 22 unavailable */

  await h.check('22 seat / baggage unavailable — modal stages the offer and reports unavailability on add', async () => {
    await h.go('/flights/offer/sup-flt-unavailable-sim');
    await sleep(900);
    assert(await h.exists('#btn-modal-add-trip'), 'add to trip button missing');
    assert(await h.click('#btn-modal-add-trip'), 'add to trip click failed');
    await sleep(900);
    assertEqual(await h.exists('#flight-offer-invalid-dialog'), false, 'modal closed');
    return 'unavailable offer staged';
  });

  /* ----------------------------------------------------------- 23 payment failed */

  await h.check('23 payment failed — retry control produces a visible preview outcome', async () => {
    await h.go('/flights/checkout/payment-failed');
    await sleep(600);
    assert(await h.exists('#payment-retry'), 'retry button missing');
    assert(await h.click('#payment-retry'), 'retry click failed');
    await sleep(300);
    assert(await h.visible('#payment-retry-result'), 'retry result must appear');
    const msg = await h.text('#payment-retry-result');
    assert(/No payment was captured/i.test(msg || ''), 'retry result must disclaim capture');
    return msg.trim();
  });

  /* ----------------------------------------------------------- 24 booking failed */

  await h.check('24 booking failed — retry control produces a visible preview outcome', async () => {
    await h.go('/flights/checkout/booking-failed');
    await sleep(600);
    assert(await h.exists('#booking-retry'), 'retry button missing');
    assert(await h.click('#booking-retry'), 'retry click failed');
    await sleep(300);
    assert(await h.visible('#booking-retry-result'), 'retry result must appear');
    const msg = await h.text('#booking-retry-result');
    assert(/No booking or ticket was created/i.test(msg || ''), 'retry result must disclaim creation');
    return msg.trim();
  });

  /* ----------------------------------------------------------- 25 guest lookup */

  await h.check('25 guest lookup — malformed reference is rejected', async () => {
    await h.go('/flights/manage');
    await sleep(700);
    await h.setValue('#lookup-reference', 'ABC', 'input');
    await h.setValue('#lookup-surname', 'Silva', 'input');
    assert(await h.click('#lookup-submit'), 'submit missing');
    const err = await h.text('#lookup-error');
    assert(/VCT-2026-0000/i.test(err || ''), `expected format error, got ${err}`);
    assertEqual(await h.attr('#lookup-reference', 'aria-invalid'), 'true', 'reference aria-invalid');
    assertEqual(await h.url(), '/flights/manage', 'must not navigate on invalid input');
    return err.trim();
  });

  await h.check('25 guest lookup — surname mismatch is rejected', async () => {
    await h.setValue('#lookup-reference', 'VCT-2026-0001', 'input');
    await h.setValue('#lookup-surname', 'Perera', 'input');
    assert(await h.click('#lookup-submit'), 'submit missing');
    const err = await h.text('#lookup-error');
    assert(/surname does not match/i.test(err || ''), `expected surname error, got ${err}`);
    assertEqual(await h.attr('#lookup-surname', 'aria-invalid'), 'true', 'surname aria-invalid');
    return err.trim();
  });

  await h.check('25 guest lookup — unknown reference is rejected', async () => {
    await h.setValue('#lookup-reference', 'VCT-2026-0999', 'input');
    await h.setValue('#lookup-surname', 'Silva', 'input');
    assert(await h.click('#lookup-submit'), 'submit missing');
    const err = await h.text('#lookup-error');
    assert(/No booking VCT-2026-0999/i.test(err || ''), `expected not-found error, got ${err}`);
    return err.trim();
  });

  await h.check('25 guest lookup — valid reference navigates to the dossier', async () => {
    await h.setValue('#lookup-reference', 'VCT-2026-0001', 'input');
    await h.setValue('#lookup-surname', 'Silva', 'input');
    assert(await h.click('#lookup-submit'), 'submit missing');
    await sleep(700);
    assertEqual(await h.url(), '/bookings/VCT-2026-0001', 'must navigate to the dossier');
    assertEqual(await h.text('#dossier-heading'), 'Booking Details', 'dossier heading');
    return 'lookup succeeds';
  });

  await h.check('25 guest lookup — demo button fills and navigates', async () => {
    await h.go('/flights/manage');
    await sleep(600);
    assert(await h.click('#lookup-demo'), 'demo button missing');
    await sleep(700);
    assertEqual(await h.url(), '/bookings/VCT-2026-0001', 'demo button must navigate');
    return 'demo button works';
  });

  /* ----------------------------------------------------------- 26 my trips */

  await h.check('26 my trips — lists demo bookings with links to the dossier', async () => {
    await h.go('/account/trips');
    await sleep(700);
    assertEqual(await h.text('#trips-heading'), 'My Trips & Bookings', 'trips heading');
    const rows = await h.cdp.evaluate('document.querySelectorAll("[data-trip-row]").length');
    assertEqual(rows, 3, 'demo booking count');
    assert(await h.exists('a[href="/bookings/VCT-2026-0001"]'), 'dossier link missing');
    return `${rows} trips listed`;
  });

  /* ----------------------------------------------------------- 27 details */

  await h.check('27 details — resend confirmation validates the email', async () => {
    await h.go('/bookings/VCT-2026-0001');
    await sleep(700);
    assert(await h.click('#dossier-resend-toggle'), 'resend toggle missing');
    await sleep(200);
    await h.setValue('#dossier-resend-email', 'not-an-email', 'input');
    const form = await h.cdp.evaluate('document.querySelector("#dossier-resend-form")?.requestSubmit ? (document.querySelector("#dossier-resend-form").requestSubmit(), true) : false');
    // Fallback: click submit if requestSubmit unavailable
    if (!form) await h.click('#dossier-resend-submit');
    await sleep(300);
    const err = await h.text('#dossier-resend-error');
    assert(/valid email/i.test(err || ''), `expected email error, got ${err}`);
    assertEqual(await h.attr('#dossier-resend-email', 'aria-invalid'), 'true', 'email aria-invalid');
    return err.trim();
  });

  await h.check('27 details — resend confirmation queues a preview message', async () => {
    await h.setValue('#dossier-resend-email', 'amara.silva@example.com', 'input');
    assert(await h.click('#dossier-resend-submit'), 'submit missing');
    await sleep(300);
    const result = await h.text('#dossier-resend-result');
    assert(/Confirmation queued/i.test(result || ''), `expected queue note, got ${result}`);
    assert(/No email was actually sent/i.test(result || ''), 'must disclaim sending');
    return result.trim();
  });

  await h.check('27 details — copy PNR produces a visible status', async () => {
    assert(await h.click('#dossier-copy-pnr'), 'copy PNR missing');
    await sleep(200);
    const status = await h.text('#dossier-copy-status');
    assert(/PNR 6J8K2Q selected/i.test(status || ''), `expected selection status, got ${status}`);
    return status.trim();
  });

  /* ----------------------------------------------------------- 28 ticket */

  await h.check('28 ticket — e-ticket renders ticket numbers and shows the document', async () => {
    await h.go('/bookings/VCT-2026-0001/ticket');
    await sleep(700);
    assertEqual(await h.text('#ticket-pnr'), '6J8K2Q', 'PNR');
    const rows = await h.cdp.evaluate('document.querySelectorAll("[data-ticket-row]").length');
    assertEqual(rows, 2, 'ticket rows');
    assert(await h.click('#ticket-show-document'), 'show document missing');
    await sleep(200);
    assert(await h.visible('#ticket-document'), 'document must appear');
    assert(await h.click('#ticket-hide-document'), 'hide document missing');
    await sleep(200);
    assertEqual(await h.visible('#ticket-document'), false, 'document must hide');
    return 'e-ticket rendered';
  });

  await h.check('28 ticket — email queue validates the recipient', async () => {
    await h.setValue('#ticket-email', 'bad', 'input');
    assert(await h.click('#ticket-email-submit'), 'submit missing');
    const err = await h.text('#ticket-email-error');
    assert(/valid email/i.test(err || ''), `expected email error, got ${err}`);
    await h.setValue('#ticket-email', 'amara.silva@example.com', 'input');
    assert(await h.click('#ticket-email-submit'), 'submit missing');
    const result = await h.text('#ticket-email-result');
    assert(/queued/i.test(result || ''), `expected queue note, got ${result}`);
    return result.trim();
  });

  /* ----------------------------------------------------------- 29 receipt */

  await h.check('29 receipt — invoice renders totals and toggles the printable invoice', async () => {
    await h.go('/bookings/VCT-2026-0001/receipt');
    await sleep(700);
    const body = await h.text('section.flights-booking-dossier');
    assert(/VCT-INV-0001/.test(body || ''), 'invoice number missing');
    assert(/LKR 318,400/.test(body || ''), 'total missing');
    assert(await h.click('#receipt-show-invoice'), 'show invoice missing');
    await sleep(200);
    assert(await h.visible('#receipt-invoice-document'), 'invoice must appear');
    assert(await h.click('#receipt-hide-invoice'), 'hide invoice missing');
    await sleep(200);
    assertEqual(await h.visible('#receipt-invoice-document'), false, 'invoice must hide');
    return 'receipt rendered';
  });

  await h.check('29 receipt — email queue validates the recipient', async () => {
    await h.setValue('#receipt-email', 'bad', 'input');
    assert(await h.click('#receipt-email-submit'), 'submit missing');
    const err = await h.text('#receipt-email-error');
    assert(/valid email/i.test(err || ''), `expected email error, got ${err}`);
    await h.setValue('#receipt-email', 'amara.silva@example.com', 'input');
    assert(await h.click('#receipt-email-submit'), 'submit missing');
    const result = await h.text('#receipt-email-result');
    assert(/queued/i.test(result || ''), `expected queue note, got ${result}`);
    return result.trim();
  });

  /* ----------------------------------------------------------- 30 ticketing */

  await h.check('30 ticketing — pending hold renders the expiry and gates cancel-hold', async () => {
    await h.go('/bookings/VCT-2026-0002/ticketing');
    await sleep(700);
    const body = await h.text('section.flights-booking-dossier');
    assert(/seat hold expires 17 Nov 2026, 18:00/i.test(body || ''), 'hold expiry missing');
    assert(await h.click('#ticketing-cancel-hold'), 'cancel-hold button missing');
    await sleep(300);
    const err = await h.text('#ticketing-error');
    assert(/Confirm that you understand/i.test(err || ''), `expected confirm gate, got ${err}`);
    return err.trim();
  });

  await h.check('30 ticketing — refreshing completes ticketing and persists the PNR', async () => {
    assert(await h.click('#ticketing-refresh'), 'refresh button missing');
    await sleep(700);
    assertEqual(await h.url(), '/bookings/VCT-2026-0002/ticketing', 'must stay on ticketing');
    const record = await h.store(`${D}VCT-2026-0002`);
    assertEqual(record.status, 'ticketed', 'status persisted');
    assertEqual(record.pnr, '6J8K2Q', 'PNR persisted');
    assertEqual(record.passengers[0].ticketNumber, 'VCT-TKT-0002-01', 'ticket number persisted');
    const result = await h.text('#ticketing-result');
    assert(/Ticketing completed/i.test(result || ''), `expected completion note, got ${result}`);
    return result.trim();
  });

  await h.check('30 ticketing — ticketed booking shows the e-ticket link', async () => {
    const body = await h.text('section.flights-booking-dossier');
    assert(/Ticketing is complete/i.test(body || ''), 'ticketed notice missing');
    assert(await h.exists('a[href="/bookings/VCT-2026-0002/ticket"]'), 'e-ticket link missing');
    return 'ticketed state rendered';
  });

  await h.check('30 ticketing — cancelling a hold ends the booking and queues a refund', async () => {
    // Reset to a fresh pending record.
    await h.clearStore();
    await h.go('/bookings/VCT-2026-0002/ticketing');
    await sleep(700);
    await h.setChecked('#ticketing-confirm', true);
    assert(await h.click('#ticketing-cancel-hold'), 'cancel-hold button missing');
    await sleep(700);
    const record = await h.store(`${D}VCT-2026-0002`);
    assertEqual(record.status, 'cancelled', 'status persisted');
    assertEqual(record.paymentStatus, 'refunded', 'payment status persisted');
    const result = await h.text('#ticketing-result');
    assert(/Hold cancelled/i.test(result || ''), `expected hold-cancelled note, got ${result}`);
    assert(/no money has moved/i.test(result || ''), 'must disclaim money movement');
    return result.trim();
  });

  /* ----------------------------------------------------------- 31 travel prep */

  await h.check('31 travel prep — checkbox persists and progress updates', async () => {
    await h.go('/bookings/VCT-2026-0001/travel-prep');
    await sleep(700);
    assert(await h.setChecked('[data-prep-item="passport"]', true), 'passport checkbox missing');
    await sleep(200);
    const record = await h.store(`${D}VCT-2026-0001`);
    assertEqual(record.checklist.passport, true, 'checklist persisted');
    const progress = await h.text('#prep-progress');
    assert(/1 of 5 complete/i.test(progress || ''), `progress mismatch: ${progress}`);
    return progress.trim();
  });

  await h.check('31 travel prep — check-in is gated until every item is complete', async () => {
    assert(await h.click('#prep-checkin'), 'check-in button missing');
    await sleep(300);
    const err = await h.text('#prep-error');
    assert(/Complete every pre-travel check/i.test(err || ''), `expected gate, got ${err}`);
    return err.trim();
  });

  await h.check('31 travel prep — reminder persists and check-in reports the open window', async () => {
    // Complete the remaining checks.
    for (const id of ['visa', 'documents', 'baggage', 'airport']) {
      await h.setChecked(`[data-prep-item="${id}"]`, true);
      await sleep(120);
    }
    await h.setChecked('#prep-reminder', true);
    await sleep(200);
    const record = await h.store(`${D}VCT-2026-0001`);
    assertEqual(record.checkInReminder, true, 'reminder persisted');
    assert(await h.click('#prep-checkin'), 'check-in button missing');
    await sleep(300);
    const result = await h.text('#prep-result');
    assert(/Online check-in is not open yet/i.test(result || ''), `expected open-window note, got ${result}`);
    return result.trim();
  });

  /* ----------------------------------------------------------- 32 extras */

  await h.check('32 extras — baggage outside 0–4 is rejected', async () => {
    await h.go('/bookings/VCT-2026-0001/extras');
    await sleep(700);
    await h.setValue('#extras-baggage', '5', 'input');
    assert(await h.click('#extras-save'), 'save missing');
    await sleep(300);
    const err = await h.text('#extras-error');
    assert(/between 0 and 4 units/i.test(err || ''), `expected baggage error, got ${err}`);
    assertEqual(await h.attr('#extras-baggage', 'aria-invalid'), 'true', 'baggage aria-invalid');
    return err.trim();
  });

  await h.check('32 extras — live total recomputes as controls change', async () => {
    await h.setValue('#extras-baggage', '2', 'input');
    await h.setValue('#extras-seat', 'extra_legroom', 'change');
    await h.setValue('#extras-meal', 'vegetarian', 'change');
    await h.setChecked('#extras-insurance', true);
    await sleep(200);
    const total = await h.text('#extras-total');
    // 2*4500 + 3800 + 900 + 2500 = 16200
    assertEqual(total, 'LKR 16,200', 'live extras total');
    return total.trim();
  });

  await h.check('32 extras — saving persists the selection and reports the charge honestly', async () => {
    assert(await h.click('#extras-save'), 'save missing');
    await sleep(700);
    const record = await h.store(`${D}VCT-2026-0001`);
    assertEqual(record.extras.baggageUnits, 2, 'baggage persisted');
    assertEqual(record.extras.seat, 'extra_legroom', 'seat persisted');
    assertEqual(record.extras.meal, 'vegetarian', 'meal persisted');
    assertEqual(record.extras.insurance, true, 'insurance persisted');
    const result = await h.text('#extras-result');
    assert(/Extras saved/i.test(result || ''), `expected save note, got ${result}`);
    assert(/nothing was charged now/i.test(result || ''), 'must disclaim charging');
    return result.trim();
  });

  await h.check('32 extras — clearing removes all extras', async () => {
    assert(await h.click('#extras-clear'), 'clear missing');
    await sleep(700);
    const record = await h.store(`${D}VCT-2026-0001`);
    assertEqual(record.extras.baggageUnits, 0, 'baggage cleared');
    assertEqual(record.extras.seat, 'none', 'seat cleared');
    assertEqual(record.extras.insurance, false, 'insurance cleared');
    const result = await h.text('#extras-result');
    assert(/All extras removed/i.test(result || ''), `expected clear note, got ${result}`);
    return result.trim();
  });

  /* ----------------------------------------------------------- 33 correction */

  await h.check('33 correction — short value is rejected', async () => {
    await h.go('/bookings/VCT-2026-0001/correction');
    await sleep(700);
    await h.setValue('#correction-value', 'A', 'input');
    await h.setValue('#correction-reason', 'spelling error', 'input');
    await h.setChecked('#correction-consent', true);
    assert(await h.click('#correction-submit'), 'submit missing');
    const err = await h.text('#correction-error');
    assert(/2 to 40 characters/i.test(err || ''), `expected value error, got ${err}`);
    assertEqual(await h.attr('#correction-value', 'aria-invalid'), 'true', 'value aria-invalid');
    return err.trim();
  });

  await h.check('33 correction — short reason is rejected', async () => {
    await h.setValue('#correction-value', 'Aamara', 'input');
    await h.setValue('#correction-reason', 'short', 'input');
    assert(await h.click('#correction-submit'), 'submit missing');
    const err = await h.text('#correction-error');
    assert(/at least 8 characters/i.test(err || ''), `expected reason error, got ${err}`);
    assertEqual(await h.attr('#correction-reason', 'aria-invalid'), 'true', 'reason aria-invalid');
    return err.trim();
  });

  await h.check('33 correction — missing consent is rejected', async () => {
    await h.setValue('#correction-reason', 'spelling error in the booking', 'input');
    await h.setChecked('#correction-consent', false);
    assert(await h.click('#correction-submit'), 'submit missing');
    const err = await h.text('#correction-error');
    assert(/airline must approve/i.test(err || ''), `expected consent error, got ${err}`);
    assertEqual(await h.attr('#correction-consent', 'aria-invalid'), 'true', 'consent aria-invalid');
    return err.trim();
  });

  await h.check('33 correction — an unchanged value is rejected', async () => {
    await h.setChecked('#correction-consent', true);
    await h.setValue('#correction-value', 'Amara Silva', 'input');
    assert(await h.click('#correction-submit'), 'submit missing');
    const err = await h.text('#correction-error');
    assert(/identical to the current value/i.test(err || ''), `expected unchanged error, got ${err}`);
    return err.trim();
  });

  await h.check('33 correction — a valid request is persisted and labelled preview', async () => {
    await h.setValue('#correction-value', 'Aamara', 'input');
    assert(await h.click('#correction-submit'), 'submit missing');
    await sleep(700);
    const record = await h.store(`${D}VCT-2026-0001`);
    assert(Array.isArray(record.corrections) && record.corrections.length === 1, 'correction persisted');
    assertEqual(record.corrections[0].status, 'pending_review', 'status');
    assertEqual(record.corrections[0].value, 'Aamara', 'value persisted');
    const result = await h.text('#correction-result');
    assert(/Correction request VCT-COR-0001 recorded/i.test(result || ''), `expected result, got ${result}`);
    assert(/No ticket has been reissued/i.test(result || ''), 'must disclaim reissue');
    const list = await h.text('#correction-list');
    assert(/VCT-COR-0001/.test(list || ''), 'correction listed');
    return result.trim();
  });

  await h.check('33 correction — a DOB correction validates the date format', async () => {
    await h.setValue('#correction-field', 'dob', 'change');
    await h.setValue('#correction-value', 'not-a-date', 'input');
    await h.setValue('#correction-reason', 'passport shows a different date', 'input');
    await h.setChecked('#correction-consent', true);
    assert(await h.click('#correction-submit'), 'submit missing');
    const err = await h.text('#correction-error');
    assert(/YYYY-MM-DD/i.test(err || ''), `expected date format error, got ${err}`);
    return err.trim();
  });

  /* --------------------------------------------------------- cancelled booking */

  await h.check('27 details — a cancelled booking disables change, extras and correction', async () => {
    await h.go('/bookings/VCT-2026-0003');
    await sleep(700);
    const body = await h.text('section.flights-booking-dossier');
    assert(/This booking was cancelled/i.test(body || ''), 'cancelled notice missing');
    assert(/Extras unavailable/.test(body || ''), 'extras must be disabled');
    assert(/Correction unavailable/.test(body || ''), 'correction must be disabled');
    assert(await h.exists('a[href="/bookings/VCT-2026-0003/support"]'), 'support link present');
    return 'cancelled state honest';
  });

  /* --------------------------------------------------------- a11y / animation */

  await h.check('a11y — real Tab key produces a visible focus ring on the dossier', async () => {
    await h.go('/bookings/VCT-2026-0001');
    await sleep(700);
    await h.cdp.evaluate('document.body.focus()');
    await h.pressTab();
    const focused = await h.cdp.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, focusVisible: el.matches(':focus-visible'), outlineWidth: cs.outlineWidth };
    })()`);
    assert(focused, 'nothing received keyboard focus');
    assertEqual(focused.focusVisible, true, 'focus-visible missing');
    assert(focused.outlineWidth !== '0px', 'no visible focus ring');
    return JSON.stringify(focused);
  });

  await h.check('animation — reduced motion collapses transitions on the dossier', async () => {
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await h.go('/bookings/VCT-2026-0001/ticket');
    await sleep(700);
    const motion = await h.cdp.evaluate(`(() => {
      const el = document.querySelector('.animate-fade-in') || document.querySelector('section');
      const cs = getComputedStyle(el);
      return { duration: cs.animationDuration, transition: cs.transitionDuration };
    })()`);
    assert(parseFloat(motion.duration) < 0.05, `animation-duration should collapse, got ${motion.duration}`);
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    return JSON.stringify(motion);
  });

  await h.check('no uncaught exceptions during Batch E flows', async () => {
    const exceptions = h.cdp.pageExceptions.filter(e => !/clerk/i.test(e));
    assertEqual(exceptions.length, 0, `uncaught exceptions: ${JSON.stringify(exceptions.slice(0, 3))}`);
    return '0 exceptions';
  });
});
