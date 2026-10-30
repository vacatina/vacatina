/**
 * Vacatina — Batch C interaction E2E (screens 51–57, B2B agent portal).
 *
 * Real clicks, real validation failures, real state transitions and persisted
 * demo data. Every financial step must stay labelled as a preview.
 *
 * Run: node scripts/verify-batch-c-b2b.mjs
 */
import { runSuite, assert, assertEqual, sleep } from './lib/e2e-harness.mjs';

const B = 'vacatina:b2b:';
const money = n => `LKR ${Number(n).toLocaleString('en-US')}`;

async function searchAndSelect(h, { pax = 2, offer = 'B2B-UL505' } = {}) {
  await h.go('/b2b/flights');
  await h.setValue('#b2b-origin', 'CMB', 'input');
  await h.setValue('#b2b-destination', 'DXB', 'input');
  await h.setValue('#b2b-date', '2026-11-18', 'input');
  await h.setValue('#b2b-pax', String(pax), 'input');
  await h.click('#b2b-search');
  await sleep(200);
  assert(await h.click(`input[name="b2b-offer"][value="${offer}"]`), 'offer radio missing');
  assert(await h.click('#b2b-build-quote'), 'build quotation button missing');
  await sleep(500);
}

await runSuite('Batch C — B2B agent portal (51–57)', async h => {
  /* ------------------------------------------------------- 51/52 agent search */

  await h.check('51 search — invalid IATA codes are rejected and marked invalid', async () => {
    await h.clearStore();
    await h.go('/b2b/flights');
    await h.setValue('#b2b-origin', 'C', 'input');
    await h.click('#b2b-search');
    const err = await h.text('#b2b-search-error');
    assert(/3-letter IATA/i.test(err || ''), `expected IATA error, got ${err}`);
    assertEqual(await h.attr('#b2b-origin', 'aria-invalid'), 'true', 'origin aria-invalid');
    assertEqual(await h.attr('#b2b-destination', 'aria-invalid'), 'false', 'destination untouched');
    assertEqual((await h.cdp.evaluate('document.querySelectorAll("#b2b-result-rows input").length')), 0, 'no results on invalid input');
    return err.trim();
  });

  await h.check('51 search — same origin and destination is rejected', async () => {
    await h.setValue('#b2b-origin', 'CMB', 'input');
    await h.setValue('#b2b-destination', 'CMB', 'input');
    await h.click('#b2b-search');
    const err = await h.text('#b2b-search-error');
    assert(/cannot be the same airport/i.test(err || ''), `expected same-airport error, got ${err}`);
    assertEqual(await h.attr('#b2b-destination', 'aria-invalid'), 'true', 'destination aria-invalid');
    return err.trim();
  });

  await h.check('51 search — passenger count below 1 and above 9 is rejected', async () => {
    await h.setValue('#b2b-destination', 'DXB', 'input');
    await h.setValue('#b2b-pax', '0', 'input');
    await h.click('#b2b-search');
    const zero = await h.text('#b2b-search-error');
    assert(/between 1 and 9/i.test(zero || ''), `expected pax error, got ${zero}`);
    await h.setValue('#b2b-pax', '10', 'input');
    await h.click('#b2b-search');
    const ten = await h.text('#b2b-search-error');
    assert(/between 1 and 9/i.test(ten || ''), `expected pax error, got ${ten}`);
    assertEqual(await h.attr('#b2b-pax', 'aria-invalid'), 'true', 'pax aria-invalid');
    return `${zero.trim()} / ${ten.trim()}`;
  });

  await h.check('51 search — valid search renders three wholesale options', async () => {
    await h.setValue('#b2b-pax', '2', 'input');
    await h.click('#b2b-search');
    await sleep(250);
    const rows = await h.cdp.evaluate('document.querySelectorAll("#b2b-result-rows input[name=\\"b2b-offer\\"]").length');
    assertEqual(rows, 3, 'wholesale option count');
    const caption = await h.text('#b2b-results-caption');
    assert(/3 wholesale options · 2 passenger\(s\)/.test(caption || ''), `caption mismatch: ${caption}`);
    assertEqual(await h.attr('#b2b-search-error', 'class') !== null, true, 'error container exists');
    assertEqual(await h.text('#b2b-search-error'), '', 'error cleared after valid search');
    return caption.trim();
  });

  await h.check('52 comparison — net rate, markup and sell rate are consistent', async () => {
    assertEqual(await h.text('[data-net-rate="B2B-UL505"]'), 'Net LKR 96,500', 'net rate');
    assertEqual(await h.text('[data-markup="B2B-UL505"]'), 'Markup 12%', 'markup label');
    assertEqual(await h.text('[data-sell-rate="B2B-UL505"]'), 'LKR 108,080 / pax', 'sell rate (12% markup)');
    assertEqual(await h.text('[data-sell-rate="B2B-EK651"]'), 'LKR 116,704 / pax', 'EK sell rate');
    assertEqual(await h.text('[data-sell-rate="B2B-QR665"]'), 'LKR 99,904 / pax', 'QR sell rate');
    const commission = await h.text('[data-offer-row="B2B-UL505"]');
    assert(/Commission LKR 3,242/.test(commission || ''), `commission mismatch: ${commission}`);
    return 'net/markup/sell/commission consistent';
  });

  await h.check('52 comparison — hiding net rates and markups re-renders without them', async () => {
    await h.setChecked('#b2b-show-net', false);
    await h.setChecked('#b2b-show-markup', false);
    assertEqual(await h.exists('[data-net-rate="B2B-UL505"]'), false, 'net rate hidden');
    assertEqual(await h.exists('[data-markup="B2B-UL505"]'), false, 'markup hidden');
    assertEqual(await h.text('[data-sell-rate="B2B-UL505"]'), 'LKR 108,080 / pax', 'sell rate still shown');
    await h.setChecked('#b2b-show-net', true);
    await h.setChecked('#b2b-show-markup', true);
    assertEqual(await h.text('[data-net-rate="B2B-UL505"]'), 'Net LKR 96,500', 'net rate restored');
    return 'toggle round-trip ok';
  });

  await h.check('51 selection — building a quotation without a selected fare is blocked', async () => {
    assert(await h.click('#b2b-build-quote'), 'build quotation button missing');
    const err = await h.text('#b2b-select-error');
    assert(/Select a wholesale fare/i.test(err || ''), `expected selection error, got ${err}`);
    assertEqual(await h.url(), '/b2b/flights', 'must not navigate without a selection');
    assertEqual(await h.store(`${B}selection`), null, 'no selection persisted');
    return err.trim();
  });

  await h.check('51 selection — selecting a fare persists the selection and opens the builder', async () => {
    assert(await h.click('input[name="b2b-offer"][value="B2B-UL505"]'), 'offer radio missing');
    assert(await h.visible('#b2b-select-actions'), 'build quotation action must appear after selection');
    assert(await h.click('#b2b-build-quote'), 'build quotation button missing');
    await sleep(500);
    assertEqual(await h.url(), '/b2b/flights/quotation', 'quotation route');
    const sel = await h.store(`${B}selection`);
    assert(sel && sel.offer.id === 'B2B-UL505', `selection persisted, got ${JSON.stringify(sel?.offer?.id)}`);
    assertEqual(sel.passengers, 2, 'passenger count persisted');
    assertEqual(sel.markupPercent, 12, 'default markup persisted');
    return `selection=${sel.offer.id} pax=${sel.passengers}`;
  });

  /* ------------------------------------------------------------ 53 quotation */

  await h.check('53 quotation — empty state when no fare is selected', async () => {
    await h.clearStore();
    await h.go('/b2b/flights/quotation');
    assertEqual(await h.attr('[data-b2b-stage]', 'data-b2b-stage'), 'empty', 'empty stage');
    const body = await h.text('section.b2b-flights-quotation');
    assert(/No wholesale fare selected/i.test(body || ''), 'empty state copy missing');
    return 'empty state honest';
  });

  await h.check('53 quotation — deterministic default totals for 2 passengers', async () => {
    await searchAndSelect(h);
    assertEqual(await h.attr('[data-b2b-stage]', 'data-b2b-stage'), 'builder', 'builder stage');
    assertEqual(await h.text('#b2b-total-net'), money(193000), 'net x2');
    assertEqual(await h.text('#b2b-total-markup'), money(23160), '12% markup');
    assertEqual(await h.text('#b2b-total-baggage'), money(0), 'no baggage');
    assertEqual(await h.text('#b2b-total-fee'), money(3500), 'service fee');
    assertEqual(await h.text('#b2b-total-client'), money(219660), 'client total');
    assertEqual(await h.text('#b2b-total-perpax'), money(109830), 'per passenger');
    return '219,660 total / 109,830 per pax';
  });

  await h.check('53 quotation — markup above 40% is rejected', async () => {
    await h.setValue('#b2b-markup', '41', 'input');
    const err = await h.text('#b2b-quote-error');
    assert(/Markup must be between 0% and 40%/i.test(err || ''), `expected markup error, got ${err}`);
    assertEqual(await h.attr('#b2b-markup', 'aria-invalid'), 'true', 'markup aria-invalid');
    assertEqual(await h.text('#b2b-total-client'), money(219660), 'totals must not adopt an invalid markup');
    return err.trim();
  });

  await h.check('53 quotation — baggage outside 0–6 is rejected', async () => {
    await h.setValue('#b2b-markup', '12', 'input');
    await h.setValue('#b2b-baggage', '7', 'input');
    const err = await h.text('#b2b-quote-error');
    assert(/Baggage units must be a whole number between 0 and 6/i.test(err || ''), `expected baggage error, got ${err}`);
    assertEqual(await h.attr('#b2b-baggage', 'aria-invalid'), 'true', 'baggage aria-invalid');
    return err.trim();
  });

  await h.check('53 quotation — negative service fee is rejected', async () => {
    await h.setValue('#b2b-baggage', '0', 'input');
    await h.setValue('#b2b-fee', '-1', 'input');
    const err = await h.text('#b2b-quote-error');
    assert(/Service fee cannot be negative/i.test(err || ''), `expected fee error, got ${err}`);
    return err.trim();
  });

  await h.check('53 quotation — valid markup and baggage recompute the client total', async () => {
    await h.setValue('#b2b-fee', '3500', 'input');
    await h.setValue('#b2b-markup', '20', 'input');
    await h.setValue('#b2b-baggage', '2', 'input');
    assertEqual(await h.text('#b2b-quote-error'), '', 'error cleared');
    assertEqual(await h.text('#b2b-total-net'), money(193000), 'net unchanged');
    assertEqual(await h.text('#b2b-total-markup'), money(38600), '20% markup');
    assertEqual(await h.text('#b2b-total-baggage'), money(9000), '2 baggage units');
    assertEqual(await h.text('#b2b-total-client'), money(244100), 'recomputed total');
    assertEqual(await h.text('#b2b-total-perpax'), money(122050), 'recomputed per pax');
    return '244,100 total / 122,050 per pax';
  });

  await h.check('53 quotation — save draft persists locally', async () => {
    assert(await h.click('#b2b-save-quote'), 'save draft missing');
    const result = await h.text('#b2b-quote-result');
    assert(/Draft saved locally \(preview\)/i.test(result || ''), `expected draft confirmation, got ${result}`);
    const q = await h.store(`${B}quotation`);
    assertEqual(q.status, 'draft', 'draft status');
    assertEqual(q.markupPercent, 20, 'markup persisted');
    assertEqual(q.baggageUnits, 2, 'baggage persisted');
    assertEqual(q.serviceFee, 3500, 'fee persisted');
    return result.trim();
  });

  await h.check('53 quotation — sending without a client name is rejected', async () => {
    assert(await h.click('#b2b-send-quote'), 'send quotation missing');
    const err = await h.text('#b2b-send-error');
    assert(/Enter the client name/i.test(err || ''), `expected client name error, got ${err}`);
    assertEqual(await h.attr('#b2b-client-name', 'aria-invalid'), 'true', 'client name aria-invalid');
    return err.trim();
  });

  await h.check('53 quotation — sending with an invalid client email is rejected', async () => {
    await h.setValue('#b2b-client-name', 'Ceylon Corporate Travel', 'input');
    await h.setValue('#b2b-client-email', 'not-an-email', 'input');
    assert(await h.click('#b2b-send-quote'), 'send quotation missing');
    const err = await h.text('#b2b-send-error');
    assert(/valid client email/i.test(err || ''), `expected email error, got ${err}`);
    assertEqual(await h.attr('#b2b-client-email', 'aria-invalid'), 'true', 'email aria-invalid');
    const q = await h.store(`${B}quotation`);
    assertEqual(q.status, 'draft', 'quotation must not be marked sent');
    return err.trim();
  });

  await h.check('53 quotation — valid send is persisted and labelled as not actually sent', async () => {
    await h.setValue('#b2b-client-email', 'ops@example.com', 'input');
    assert(await h.click('#b2b-send-quote'), 'send quotation missing');
    const result = await h.text('#b2b-quote-result');
    assert(/No email was actually sent and no fare is held/i.test(result || ''), `expected honest send note, got ${result}`);
    const q = await h.store(`${B}quotation`);
    assertEqual(q.status, 'sent', 'sent status persisted');
    assertEqual(q.clientName, 'Ceylon Corporate Travel', 'client name persisted');
    return result.trim();
  });

  /* ------------------------------------------------------------ 54 travellers */

  await h.check('54 travellers — continuing with no travellers is blocked', async () => {
    await h.clearStore();
    await searchAndSelect(h);
    await h.go('/b2b/flights/travellers');
    assert(await h.click('#trav-continue'), 'continue link missing');
    await sleep(400);
    const err = await h.text('#trav-error');
    assert(/Add at least one traveller before continuing/i.test(err || ''), `expected continue gate, got ${err}`);
    assertEqual(await h.url(), '/b2b/flights/travellers', 'must not navigate without travellers');
    return err.trim();
  });

  await h.check('55 review — confirming with no travellers is blocked', async () => {
    await h.go('/b2b/flights/review');
    assert(await h.click('#b2b-confirm-booking'), 'confirm button missing');
    const err = await h.text('#b2b-review-error');
    assert(/Add at least one traveller/i.test(err || ''), `expected traveller gate, got ${err}`);
    assertEqual(await h.store(`${B}booking`), null, 'no booking created');
    return err.trim();
  });

  await h.check('54 travellers — short first/last name is rejected', async () => {
    await h.go('/b2b/flights/travellers');
    await h.setValue('#trav-first', 'N', 'input');
    await h.setValue('#trav-last', 'P', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    const err = await h.text('#trav-error');
    assert(/at least 2 characters/i.test(err || ''), `expected name error, got ${err}`);
    assertEqual(await h.attr('#trav-first', 'aria-invalid'), 'true', 'first name aria-invalid');
    return err.trim();
  });

  await h.check('54 travellers — a future date of birth is rejected', async () => {
    await h.setValue('#trav-first', 'Nuwan', 'input');
    await h.setValue('#trav-last', 'Perera', 'input');
    await h.setValue('#trav-dob', '2030-01-01', 'input');
    await h.setValue('#trav-passport', 'N1234567', 'input');
    await h.setValue('#trav-expiry', '2032-01-01', 'input');
    await h.setValue('#trav-nationality', 'Sri Lankan', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    const err = await h.text('#trav-error');
    assert(/valid date of birth in the past/i.test(err || ''), `expected DOB error, got ${err}`);
    assertEqual(await h.attr('#trav-dob', 'aria-invalid'), 'true', 'DOB aria-invalid');
    return err.trim();
  });

  await h.check('54 travellers — an invalid passport number is rejected', async () => {
    await h.setValue('#trav-dob', '1988-04-12', 'input');
    await h.setValue('#trav-passport', 'AB-1', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    const err = await h.text('#trav-error');
    assert(/Passport number must be 6–12/i.test(err || ''), `expected passport error, got ${err}`);
    assertEqual(await h.attr('#trav-passport', 'aria-invalid'), 'true', 'passport aria-invalid');
    return err.trim();
  });

  await h.check('54 travellers — an expired passport is rejected', async () => {
    await h.setValue('#trav-passport', 'N1234567', 'input');
    await h.setValue('#trav-expiry', '2020-01-01', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    const err = await h.text('#trav-error');
    assert(/expiry must be a valid future date/i.test(err || ''), `expected expiry error, got ${err}`);
    assertEqual(await h.attr('#trav-expiry', 'aria-invalid'), 'true', 'expiry aria-invalid');
    return err.trim();
  });

  await h.check('54 travellers — a valid traveller is added to the quotation', async () => {
    await h.setValue('#trav-expiry', '2032-01-01', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    const result = await h.text('#trav-result');
    assert(/Nuwan Perera added to the quotation \(preview\)/i.test(result || ''), `expected add confirmation, got ${result}`);
    assertEqual(await h.text('#trav-count'), '1 traveller', 'traveller count');
    const rows = await h.cdp.evaluate('document.querySelectorAll("[data-traveller-row]").length');
    assertEqual(rows, 1, 'traveller row rendered');
    assertEqual(await h.exists('#trav-empty'), true, 'empty hint still in DOM');
    assertEqual(await h.visible('#trav-empty'), false, 'empty hint hidden once populated');
    assert(await h.click('#trav-save'), 'save list missing');
    assert(Array.isArray(await h.store(`${B}travellers`)), 'traveller list must persist before review');
    return result.trim();
  });

  await h.check('55 review — passenger count mismatch is blocked', async () => {
    await h.go('/b2b/flights/review');
    assert(await h.click('#b2b-confirm-booking'), 'confirm button missing');
    const err = await h.text('#b2b-review-error');
    assert(/Quotation covers 2 passenger\(s\) but 1 traveller record\(s\)/i.test(err || ''), `expected mismatch gate, got ${err}`);
    assertEqual(await h.store(`${B}booking`), null, 'no booking created on mismatch');
    return err.trim();
  });

  await h.check('54 travellers — second traveller added and list saved', async () => {
    await h.go('/b2b/flights/travellers');
    await h.setValue('#trav-title', 'Ms', 'change');
    await h.setValue('#trav-first', 'Ayesha', 'input');
    await h.setValue('#trav-last', 'Fernando', 'input');
    await h.setValue('#trav-dob', '1991-09-03', 'input');
    await h.setValue('#trav-passport', 'N7654321', 'input');
    await h.setValue('#trav-expiry', '2030-02-14', 'input');
    await h.setValue('#trav-nationality', 'Sri Lankan', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    assertEqual(await h.text('#trav-count'), '2 travellers', 'traveller count');
    assert(await h.click('#trav-save'), 'save list missing');
    const saved = await h.text('#trav-save-result');
    assert(/2 traveller\(s\) saved for this session \(preview\)/i.test(saved || ''), `expected save note, got ${saved}`);
    const list = await h.store(`${B}travellers`);
    assert(Array.isArray(list) && list.length === 2, 'two travellers persisted');
    assertEqual(list[1].lastName, 'Fernando', 'second traveller persisted');
    return saved.trim();
  });

  await h.check('54 travellers — removing a traveller updates the list before saving', async () => {
    await h.setValue('#trav-title', 'Mr', 'change');
    await h.setValue('#trav-first', 'Kasun', 'input');
    await h.setValue('#trav-last', 'Silva', 'input');
    await h.setValue('#trav-dob', '1985-02-02', 'input');
    await h.setValue('#trav-passport', 'N9998887', 'input');
    await h.setValue('#trav-expiry', '2033-03-03', 'input');
    await h.setValue('#trav-nationality', 'Sri Lankan', 'input');
    assert(await h.click('#trav-add'), 'add traveller missing');
    assertEqual(await h.text('#trav-count'), '3 travellers', 'traveller count before removal');
    const removed = await h.cdp.evaluate(`(() => {
      const rows = Array.from(document.querySelectorAll('[data-traveller-row]'));
      const target = rows.find(r => (r.textContent || '').includes('Kasun'));
      if (!target) return false;
      const btn = target.querySelector('button[data-remove]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    assert(removed, 'remove control for Kasun missing');
    await sleep(200);
    assertEqual(await h.text('#trav-count'), '2 travellers', 'traveller count after removal');
    const note = await h.text('#trav-result');
    assert(/Traveller removed from the quotation \(preview\)/i.test(note || ''), `expected removal note, got ${note}`);
    return note.trim();
  });

  /* ---------------------------------------------------------- 55 review/credit */

  await h.check('55 review — over-limit booking is flagged and credit check fails', async () => {
    await h.go('/b2b/flights/quotation');
    await h.setValue('#b2b-fee', '600000', 'input');
    assert(await h.click('#b2b-save-quote'), 'save draft missing');
    await h.go('/b2b/flights/review');
    const verdict = await h.text('#b2b-credit-verdict');
    assert(/Exceeds available credit by/i.test(verdict || ''), `expected over-limit verdict, got ${verdict}`);
    assertEqual(await h.text('#b2b-booking-total'), money(816160), 'booking total');
    assert(await h.click('#b2b-credit-check'), 'credit check missing');
    const credit = await h.text('#b2b-credit-result');
    assert(/Credit check failed \(preview\): booking LKR 816,160 exceeds available credit LKR 501,500/i.test(credit || ''), `expected failed credit check, got ${credit}`);
    assert(/by LKR 314,660/i.test(credit || ''), 'shortfall amount');
    return credit.trim();
  });

  await h.check('55 review — confirming over the credit limit is blocked', async () => {
    await h.setChecked('#b2b-review-consent', true);
    assert(await h.click('#b2b-confirm-booking'), 'confirm button missing');
    const err = await h.text('#b2b-review-error');
    assert(/Agency credit is insufficient/i.test(err || ''), `expected credit block, got ${err}`);
    assertEqual(await h.url(), '/b2b/flights/review', 'must not navigate on insufficient credit');
    assertEqual(await h.store(`${B}booking`), null, 'no booking created over limit');
    return err.trim();
  });

  await h.check('55 review — recovery with a valid fee passes the credit check', async () => {
    await h.go('/b2b/flights/quotation');
    await h.setValue('#b2b-fee', '3500', 'input');
    assert(await h.click('#b2b-save-quote'), 'save draft missing');
    await h.go('/b2b/flights/review');
    assert(await h.click('#b2b-credit-check'), 'credit check missing');
    const credit = await h.text('#b2b-credit-result');
    assert(/Credit check passed \(preview\): LKR 219,660 within LKR 501,500 available/i.test(credit || ''), `expected passed credit check, got ${credit}`);
    assert(/Remaining after booking LKR 281,840/i.test(credit || ''), 'remaining credit');
    return credit.trim();
  });

  await h.check('55 review — confirming without authorisation is rejected', async () => {
    await h.setChecked('#b2b-review-consent', false);
    assert(await h.click('#b2b-confirm-booking'), 'confirm button missing');
    const err = await h.text('#b2b-review-error');
    assert(/Confirm that passenger names and the itinerary are correct/i.test(err || ''), `expected consent gate, got ${err}`);
    return err.trim();
  });

  await h.check('55 review — valid confirmation persists a preview booking and opens ticketing', async () => {
    await h.setChecked('#b2b-review-consent', true);
    assert(await h.click('#b2b-confirm-booking'), 'confirm button missing');
    await sleep(500);
    assertEqual(await h.url(), '/b2b/flights/review/ticket', 'ticket route');
    const booking = await h.store(`${B}booking`);
    assertEqual(booking.status, 'confirmed_pending_ticket', 'booking status');
    assertEqual(booking.total, 219660, 'booking total');
    assertEqual(booking.travellers.length, 2, 'travellers captured');
    assertEqual(booking.paymentMethod, 'agency_credit', 'payment method');
    assertEqual(booking.ticketNumbers.length, 0, 'no ticket issued at confirmation');
    assert(/no payment captured/i.test(booking.audit[1].action), 'audit states no payment captured');
    return `status=${booking.status} total=${booking.total}`;
  });

  /* ------------------------------------------------------------- 56 ticketing */

  await h.check('56 ticketing — confirmed booking renders ticket management with no PNR', async () => {
    const heading = await h.text('#b2b-review-heading');
    assert(/Agent Booking & Ticket Management/i.test(heading || ''), `heading mismatch: ${heading}`);
    assertEqual(await h.attr('#b2b-booking-status', 'data-booking-status'), 'confirmed_pending_ticket', 'status badge');
    const body = await h.text('section.b2b-flights-review');
    assert(/PNR[\s\S]*Not issued \(preview\)/i.test(body || ''), 'PNR must be explicitly not issued');
    assert(/Not issued/.test(await h.text('[data-ticket-row="0"]') || ''), 'ticket row shows not issued');
    return 'no PNR / no ticket before issuance';
  });

  await h.check('56 ticketing — issuing without verification consent is rejected', async () => {
    assert(await h.click('#b2b-issue-tickets'), 'issue button missing');
    const err = await h.text('#b2b-ticket-error');
    assert(/verified every passenger name/i.test(err || ''), `expected consent gate, got ${err}`);
    const booking = await h.store(`${B}booking`);
    assertEqual(booking.status, 'confirmed_pending_ticket', 'status unchanged');
    return err.trim();
  });

  await h.check('56 ticketing — issuing with consent records preview ticket numbers', async () => {
    await h.setChecked('#b2b-issue-consent', true);
    assert(await h.click('#b2b-issue-tickets'), 'issue button missing');
    await sleep(500);
    const booking = await h.store(`${B}booking`);
    assertEqual(booking.status, 'ticketed_preview', 'status after issue');
    assertEqual(booking.ticketNumbers.length, 2, 'ticket numbers recorded');
    assertEqual(await h.text('#b2b-booking-status'), 'Ticketed (preview)', 'status badge after issue');
    const row = await h.text('[data-ticket-row="0"]');
    assert(/VCT-TKT-0001-01/.test(row || ''), `ticket number not rendered: ${row}`);
    const audit = await h.text('#b2b-audit-list');
    assert(/Tickets issued in preview for 2 passenger\(s\)/i.test(audit || ''), 'audit entry missing');
    return booking.ticketNumbers.join(', ');
  });

  await h.check('56 ticketing — voiding without a reason is rejected', async () => {
    assert(await h.click('#b2b-void-ticket'), 'void button missing');
    const err = await h.text('#b2b-void-error');
    assert(/Select a reason before voiding/i.test(err || ''), `expected void reason gate, got ${err}`);
    const booking = await h.store(`${B}booking`);
    assertEqual(booking.status, 'ticketed_preview', 'status unchanged without reason');
    return err.trim();
  });

  await h.check('56 ticketing — voiding with a reason updates status and audit trail', async () => {
    await h.setValue('#b2b-void-reason', 'duplicate', 'change');
    assert(await h.click('#b2b-void-ticket'), 'void button missing');
    await sleep(400);
    const booking = await h.store(`${B}booking`);
    assertEqual(booking.status, 'voided', 'status after void');
    assertEqual(booking.voidReason, 'Duplicate booking', 'void reason');
    assertEqual(booking.audit.length, 4, 'audit trail appended');
    assertEqual(await h.text('#b2b-booking-status'), 'Voided', 'status badge after void');
    const body = await h.text('section.b2b-flights-review');
    assert(/Voided — Duplicate booking/i.test(body || ''), 'voided notice missing');
    assert(/No refund has been processed in this preview/i.test(body || ''), 'voided copy must state no refund');
    return booking.voidReason;
  });

  /* -------------------------------------------------------- 57 manage/after-sales */

  await h.check('57 manage — a voided booking rejects non-refund servicing', async () => {
    await h.go('/b2b/flights/manage');
    await h.setValue('#manage-ref', 'VCT-B2B-0001', 'input');
    await h.setValue('#manage-lastname', 'Perera', 'input');
    assert(await h.click('#manage-lookup'), 'lookup button missing');
    await sleep(300);
    assert(await h.exists('#manage-booking-heading'), 'workspace did not render');
    await h.setValue('#manage-type', 'exchange', 'change');
    await h.setValue('#manage-reason', 'Client needs a different travel date', 'input');
    assert(await h.click('#manage-submit-request'), 'submit request missing');
    const err = await h.text('#manage-servicing-error');
    assert(/This booking is voided\. Only a refund request can be raised/i.test(err || ''), `expected voided gate, got ${err}`);
    assertEqual(await h.store(`${B}servicing:VCT-B2B-0001`), null, 'no servicing request recorded');
    return err.trim();
  });

  await h.check('57 manage — malformed reference is rejected', async () => {
    await h.setValue('#manage-ref', 'ABC', 'input');
    assert(await h.click('#manage-lookup'), 'lookup button missing');
    const err = await h.text('#manage-lookup-error');
    assert(/format VCT-B2B-0000/i.test(err || ''), `expected format error, got ${err}`);
    assertEqual(await h.attr('#manage-ref', 'aria-invalid'), 'true', 'reference aria-invalid');
    return err.trim();
  });

  await h.check('57 manage — surname mismatch is rejected', async () => {
    await h.setValue('#manage-ref', 'VCT-B2B-0001', 'input');
    await h.setValue('#manage-lastname', 'Silva', 'input');
    assert(await h.click('#manage-lookup'), 'lookup button missing');
    const err = await h.text('#manage-lookup-error');
    assert(/Surname does not match/i.test(err || ''), `expected surname error, got ${err}`);
    assertEqual(await h.attr('#manage-lastname', 'aria-invalid'), 'true', 'surname aria-invalid');
    return err.trim();
  });

  await h.check('57 manage — unknown booking reference is rejected', async () => {
    await h.clearStore();
    await h.go('/b2b/flights/manage');
    await h.setValue('#manage-ref', 'VCT-B2B-0999', 'input');
    await h.setValue('#manage-lastname', 'Perera', 'input');
    assert(await h.click('#manage-lookup'), 'lookup button missing');
    const err = await h.text('#manage-lookup-error');
    assert(/No booking VCT-B2B-0999 was found/i.test(err || ''), `expected not-found error, got ${err}`);
    assertEqual(await h.exists('#manage-booking-heading'), false, 'no workspace for unknown booking');
    return err.trim();
  });

  await h.check('57 manage — demo booking loads the after-sales workspace', async () => {
    assert(await h.click('#manage-use-demo'), 'demo booking button missing');
    await sleep(300);
    assertEqual(await h.text('#manage-booking-heading'), 'Booking VCT-B2B-0001', 'booking heading');
    const body = await h.text('#manage-workspace');
    assert(/UL 505/.test(body || ''), 'itinerary missing');
    assert(/2 issued \(preview\)/.test(body || ''), 'demo ticket count missing');
    return 'demo booking loaded';
  });

  await h.check('57 manage — baggage outside 0–6 is rejected', async () => {
    await h.setValue('#manage-baggage', '7', 'input');
    assert(await h.click('#manage-save-ancillary'), 'save ancillaries missing');
    const err = await h.text('#manage-ancillary-error');
    assert(/Baggage units must be a whole number between 0 and 6/i.test(err || ''), `expected baggage error, got ${err}`);
    assertEqual(await h.attr('#manage-baggage', 'aria-invalid'), 'true', 'baggage aria-invalid');
    assertEqual(await h.store(`${B}ancillaries:VCT-B2B-0001`), null, 'nothing persisted on invalid input');
    return err.trim();
  });

  await h.check('57 manage — ancillary selection persists with the correct added value', async () => {
    await h.setValue('#manage-baggage', '2', 'input');
    await h.setValue('#manage-seat', 'aisle', 'change');
    await h.setValue('#manage-meal', 'vegetarian', 'change');
    assertEqual(await h.text('#manage-ancillary-total'), money(11100), 'live ancillary total');
    assert(await h.click('#manage-save-ancillary'), 'save ancillaries missing');
    const result = await h.text('#manage-ancillary-result');
    assert(/Ancillaries saved for VCT-B2B-0001 \(preview\)/i.test(result || ''), `expected save note, got ${result}`);
    assert(/nothing charged/i.test(result || ''), 'save note must state nothing charged');
    const anc = await h.store(`${B}ancillaries:VCT-B2B-0001`);
    assertEqual(anc.baggageUnits, 2, 'baggage persisted');
    assertEqual(anc.seatPreference, 'aisle', 'seat persisted');
    assertEqual(anc.mealPreference, 'vegetarian', 'meal persisted');
    assertEqual(anc.price, 11100, 'price persisted');
    return result.trim();
  });

  await h.check('57 manage — cancellation estimate applies the 15% penalty', async () => {
    await h.setValue('#manage-type', 'cancel', 'change');
    assert(await h.click('#manage-estimate-btn'), 'estimate button missing');
    const estimate = await h.text('#manage-estimate');
    assert(/Estimated refund \(preview\): LKR 186,711/i.test(estimate || ''), `expected 186,711 refund estimate, got ${estimate}`);
    return estimate.trim();
  });

  await h.check('57 manage — servicing request needs a descriptive reason', async () => {
    await h.setValue('#manage-reason', 'short', 'input');
    assert(await h.click('#manage-submit-request'), 'submit request missing');
    const err = await h.text('#manage-servicing-error');
    assert(/at least 8 characters/i.test(err || ''), `expected reason gate, got ${err}`);
    assertEqual(await h.attr('#manage-reason', 'aria-invalid'), 'true', 'reason aria-invalid');
    return err.trim();
  });

  await h.check('57 manage — valid cancellation request is persisted and labelled preview', async () => {
    await h.setValue('#manage-reason', 'Client cancelled the corporate trip', 'input');
    assert(await h.click('#manage-submit-request'), 'submit request missing');
    const result = await h.text('#manage-servicing-result');
    assert(/preview/i.test(result || ''), `expected preview labelling, got ${result}`);
    const reqs = await h.store(`${B}servicing:VCT-B2B-0001`);
    assert(Array.isArray(reqs) && reqs.length === 1, 'servicing request persisted');
    assertEqual(reqs[0].type, 'cancel', 'request type');
    assertEqual(reqs[0].status, 'submitted_preview', 'request status');
    assertEqual(reqs[0].estimatedValue, 186711, 'estimate persisted');
    const list = await h.text('#manage-request-list');
    assert(/Cancellation/i.test(list || ''), 'request listed in the workspace');
    return result.trim();
  });

  await h.check('57 manage — exchange requires a future travel date', async () => {
    await h.setValue('#manage-type', 'exchange', 'change');
    assert(await h.click('#manage-submit-request'), 'submit request missing');
    const missing = await h.text('#manage-servicing-error');
    assert(/Select the new travel date/i.test(missing || ''), `expected date gate, got ${missing}`);
    await h.setValue('#manage-new-date', '2026-01-01', 'input');
    assert(await h.click('#manage-submit-request'), 'submit request missing');
    const past = await h.text('#manage-servicing-error');
    assert(/must be in the future/i.test(past || ''), `expected future-date gate, got ${past}`);
    return past.trim();
  });

  /* --------------------------------------------------------- a11y / animation */

  await h.check('a11y — agent portal banner marks the isolated demo fixture', async () => {
    await h.go('/b2b/flights');
    const note = await h.text('[data-agent-fixture]');
    assert(/Isolated demo agent session/i.test(note || ''), 'fixture banner missing');
    assert(/AGT-DEMO-0042/.test(note || ''), 'fixture agent id missing');
    assert(/Production requires authenticated agent identity/i.test(note || ''), 'fixture must disclaim production');
    return note.trim().slice(0, 80);
  });

  await h.check('a11y — real Tab key produces a visible focus ring on B2B search', async () => {
    await h.cdp.evaluate('document.body.focus()');
    await h.pressTab();
    const focused = await h.cdp.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, id: el.id || null, focusVisible: el.matches(':focus-visible'), outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    })()`);
    assert(focused, 'nothing received keyboard focus');
    assertEqual(focused.focusVisible, true, 'focus-visible missing');
    assert(focused.outlineWidth !== '0px' || (focused.boxShadow && focused.boxShadow !== 'none'), 'no visible focus ring');
    return JSON.stringify(focused);
  });

  await h.check('animation — reduced motion collapses transitions on the agent portal', async () => {
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await h.go('/b2b/flights/quotation');
    const motion = await h.cdp.evaluate(`(() => {
      const el = document.querySelector('.animate-fade-in') || document.querySelector('section');
      const cs = getComputedStyle(el);
      return { duration: cs.animationDuration, transition: cs.transitionDuration };
    })()`);
    assert(parseFloat(motion.duration) < 0.05, `animation-duration should collapse, got ${motion.duration}`);
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    return JSON.stringify(motion);
  });

  await h.check('no uncaught exceptions during Batch C flows', async () => {
    const exceptions = h.cdp.pageExceptions.filter(e => !/clerk/i.test(e));
    assertEqual(exceptions.length, 0, `uncaught exceptions: ${JSON.stringify(exceptions.slice(0, 3))}`);
    return '0 exceptions';
  });
});
