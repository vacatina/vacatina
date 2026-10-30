/**
 * Vacatina — Batch D interaction E2E (screens 58–64, flight operations console).
 *
 * Enters the isolated local-only demo fixture through the real "Operations access"
 * gate, then drives every area: validation failures, real state transitions,
 * persistence in sessionStorage, audit trail and post-action confirmations.
 *
 * Run: node scripts/verify-batch-d-admin.mjs
 */
import { runSuite, assert, assertEqual, sleep } from './lib/e2e-harness.mjs';

const S = 'vacatina:admin:';

async function enterConsole(h, area = 'suppliers') {
  await h.go(`/admin/${area}`);
  await sleep(1600);
  if (await h.exists('#admin-demo-console')) {
    assert(await h.click('#admin-demo-console'), 'fixture entry button missing');
    await sleep(900);
  }
  assert(await h.exists('#flight-admin-console'), `console did not render for ${area}`);
}

await runSuite('Batch D — Flight operations console (58–64)', async h => {
  /* ------------------------------------------------------------ fixture gate */

  await h.check('58 gate — hosted-style operations gate stays honest before the fixture', async () => {
    await h.clearStore();
    await h.go('/admin/suppliers');
    await sleep(1600);
    assertEqual(await h.exists('#flight-admin-console'), false, 'console must not exist before the fixture is entered');
    const body = await h.text('#admin-inventory-workspace');
    assert(/Operations access/i.test(body || ''), `expected operations gate, got ${String(body).slice(0, 120)}`);
    assert(/server-authorised|Use your authorized Vacatina staff account/i.test(body || ''), 'gate must state auth requirement');
    assert(await h.exists('#admin-demo-console'), 'local-only fixture entry missing');
    return 'gate honest, fixture entry present';
  });

  await h.check('58 gate — entering the isolated fixture renders the console with a fixture banner', async () => {
    assert(await h.click('#admin-demo-console'), 'fixture entry button missing');
    await sleep(1000);
    assertEqual(await h.url(), '/admin/suppliers', 'fixture entry route');
    assert(await h.exists('#flight-admin-console'), 'console missing');
    const banner = await h.text('#flight-admin-console');
    assert(/Isolated demo fixture · not production access/i.test(banner || ''), 'fixture banner missing');
    assert(/OPS_DEMO_FIXTURE/.test(banner || ''), 'fixture actor missing');
    assertEqual(await h.attr('#flight-admin-console', 'data-admin-area'), 'suppliers', 'active area');
    assertEqual(await h.text('#admin-console-heading'), 'Supplier Configuration & Health', '58 heading');
    assertEqual(await h.store(`${S}demoOpsRole`), 'OPS_DEMO_FIXTURE', 'fixture role stored');
    return 'console entered';
  });

  /* --------------------------------------------------------------- 58 suppliers */

  await h.check('58 suppliers — health check updates the row and reports the outcome', async () => {
    assert(await h.click('[data-supplier-check="SUP-01"]'), 'health check button missing');
    await sleep(700);
    const result = await h.text('#admin-supplier-result');
    assert(/Health check complete for DUFFEL \(preview\): healthy/i.test(result || ''), `expected health result, got ${result}`);
    assert(/No live supplier endpoint was contacted/i.test(result || ''), 'health result must disclaim live contact');
    const rows = await h.store(`${S}suppliers`);
    assertEqual(rows[0].lastChecked, 'Preview run', 'health check persisted');
    return result.trim();
  });

  await h.check('58 suppliers — activation change without a reason is rejected', async () => {
    assert(await h.click('[data-supplier-toggle="SUP-01"]'), 'toggle button missing');
    const err = await h.text('#admin-supplier-error');
    assert(/reason of at least 8 characters/i.test(err || ''), `expected reason gate, got ${err}`);
    assertEqual(await h.attr('#admin-supplier-reason', 'aria-invalid'), 'true', 'reason aria-invalid');
    const rows = await h.store(`${S}suppliers`);
    assertEqual(rows[0].active, true, 'activation unchanged without a reason');
    return err.trim();
  });

  await h.check('58 suppliers — activation change with a reason persists and is audited', async () => {
    await h.setValue('#admin-supplier-reason', 'Contract suspended for review', 'input');
    assert(await h.click('[data-supplier-toggle="SUP-01"]'), 'toggle button missing');
    await sleep(700);
    const result = await h.text('#admin-supplier-result');
    assert(/DUFFEL is now inactive \(preview\)/i.test(result || ''), `expected toggle result, got ${result}`);
    const rows = await h.store(`${S}suppliers`);
    assertEqual(rows[0].active, false, 'activation persisted');
    const audit = await h.store(`${S}audit`);
    assert(/DUFFEL deactivated — Contract suspended for review/.test(audit[0].action), `audit entry missing: ${JSON.stringify(audit[0])}`);
    const cleared = await h.cdp.evaluate('document.getElementById("admin-supplier-reason")?.value ?? ""');
    assertEqual(cleared, '', 'reason field cleared after success');
    return result.trim();
  });

  await h.check('58 suppliers — registration rejects a bad code, duplicate code and bad endpoint', async () => {
    await h.setValue('#admin-sup-code', 'X', 'input');
    await h.setValue('#admin-sup-name', 'Acme Air', 'input');
    await h.setValue('#admin-sup-endpoint', 'https://api.acme.example/v1', 'input');
    assert(await h.click('#admin-supplier-form button[type="submit"]'), 'register button missing');
    const badCode = await h.text('#admin-supplier-form-error');
    assert(/2–8 letters or digits/i.test(badCode || ''), `expected code error, got ${badCode}`);

    await h.setValue('#admin-sup-code', 'DUFFEL', 'input');
    assert(await h.click('#admin-supplier-form button[type="submit"]'), 'register button missing');
    const dup = await h.text('#admin-supplier-form-error');
    assert(/already exists/i.test(dup || ''), `expected duplicate error, got ${dup}`);

    await h.setValue('#admin-sup-code', 'ACME', 'input');
    await h.setValue('#admin-sup-endpoint', 'http://insecure.example', 'input');
    assert(await h.click('#admin-supplier-form button[type="submit"]'), 'register button missing');
    const badEndpoint = await h.text('#admin-supplier-form-error');
    assert(/https API endpoint/i.test(badEndpoint || ''), `expected endpoint error, got ${badEndpoint}`);
    assertEqual(await h.attr('#admin-sup-endpoint', 'aria-invalid'), 'true', 'endpoint aria-invalid');
    const rows = await h.store(`${S}suppliers`);
    assertEqual(rows.length, 3, 'no supplier registered on invalid input');
    return `${badCode.trim()} | ${dup.trim()} | ${badEndpoint.trim()}`;
  });

  await h.check('58 suppliers — a valid supplier registers as an inactive draft and persists', async () => {
    await h.setValue('#admin-sup-endpoint', 'https://api.acme.example/v1', 'input');
    assert(await h.click('#admin-supplier-form button[type="submit"]'), 'register button missing');
    await sleep(700);
    const result = await h.text('#admin-supplier-result');
    assert(/ACME registered as an inactive draft \(preview\)/i.test(result || ''), `expected registration result, got ${result}`);
    const rows = await h.store(`${S}suppliers`);
    assertEqual(rows.length, 4, 'supplier persisted');
    assertEqual(rows[3].code, 'ACME', 'registered code');
    assertEqual(rows[3].active, false, 'new supplier must start inactive');
    assert(await h.exists('[data-supplier-row="SUP-04"]'), 'new supplier row missing after re-render');
    return result.trim();
  });

  await h.check('58 suppliers — the registered supplier survives navigation', async () => {
    await h.go('/admin/inventory');
    await sleep(700);
    await h.go('/admin/suppliers');
    await sleep(700);
    assert(await h.exists('[data-supplier-row="SUP-04"]'), 'supplier lost after navigation');
    const row = await h.text('[data-supplier-row="SUP-04"]');
    assert(/ACME/.test(row || ''), 'registered supplier row content missing');
    assert(/Inactive/.test(row || ''), 'registered supplier must still be inactive');
    return 'persisted across navigation';
  });

  /* --------------------------------------------------------------- 59 inventory */

  await h.check('59 inventory — seat adjustment outside 0–99 is rejected', async () => {
    await h.go('/admin/inventory');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Manual Inventory CMS', '59 heading');
    await h.setValue('#admin-inv-seats-input', '150', 'input');
    assert(await h.click('[data-inv-seats="INV-01"]'), 'adjust seats button missing');
    const err = await h.text('#admin-inventory-error');
    assert(/between 0 and 99/i.test(err || ''), `expected seat error, got ${err}`);
    assertEqual(await h.attr('#admin-inv-seats-input', 'aria-invalid'), 'true', 'seats aria-invalid');
    return err.trim();
  });

  await h.check('59 inventory — zero seats stops sales automatically', async () => {
    await h.setValue('#admin-inv-seats-input', '0', 'input');
    assert(await h.click('[data-inv-seats="INV-01"]'), 'adjust seats button missing');
    await sleep(700);
    const result = await h.text('#admin-inventory-result');
    assert(/seat count set to 0 \(preview\) — sales stopped automatically/i.test(result || ''), `expected auto-stop note, got ${result}`);
    const lots = await h.store(`${S}inventory`);
    assertEqual(lots[0].seats, 0, 'seat count persisted');
    assertEqual(lots[0].status, 'stopped', 'status auto-stopped');
    return result.trim();
  });

  await h.check('59 inventory — publishing a lot with no seats is blocked', async () => {
    assert(await h.click('[data-inv-publish="INV-01"]'), 'publish button missing');
    const err = await h.text('#admin-inventory-error');
    assert(/no seats available/i.test(err || ''), `expected publish gate, got ${err}`);
    const lots = await h.store(`${S}inventory`);
    assertEqual(lots[0].status, 'stopped', 'status unchanged');
    return err.trim();
  });

  await h.check('59 inventory — restoring seats allows publishing again', async () => {
    await h.setValue('#admin-inv-seats-input', '5', 'input');
    assert(await h.click('[data-inv-seats="INV-01"]'), 'adjust seats button missing');
    await sleep(600);
    assert(await h.click('[data-inv-publish="INV-01"]'), 'publish button missing');
    await sleep(700);
    const result = await h.text('#admin-inventory-result');
    assert(/is now published \(preview\)/i.test(result || ''), `expected publish result, got ${result}`);
    const lots = await h.store(`${S}inventory`);
    assertEqual(lots[0].seats, 5, 'seats persisted');
    assertEqual(lots[0].status, 'published', 'published');
    return result.trim();
  });

  await h.check('59 inventory — creating a lot validates flight, route, date and price', async () => {
    await h.setValue('#admin-inv-flight', 'X', 'input');
    await h.setValue('#admin-inv-route', 'CMB DXB', 'input');
    await h.setValue('#admin-inv-date', '2026-12-01', 'input');
    await h.setValue('#admin-inv-seats', '4', 'input');
    await h.setValue('#admin-inv-net', '50000', 'input');
    await h.setValue('#admin-inv-sell', '60000', 'input');
    assert(await h.click('#admin-inventory-form button[type="submit"]'), 'create lot button missing');
    const badFlight = await h.text('#admin-inventory-form-error');
    assert(/flight number such as/i.test(badFlight || ''), `expected flight error, got ${badFlight}`);

    await h.setValue('#admin-inv-flight', 'UL 777', 'input');
    assert(await h.click('#admin-inventory-form button[type="submit"]'), 'create lot button missing');
    const badRoute = await h.text('#admin-inventory-form-error');
    assert(/arrow format/i.test(badRoute || ''), `expected route error, got ${badRoute}`);

    await h.setValue('#admin-inv-route', 'CMB → SIN', 'input');
    await h.setValue('#admin-inv-date', '2026-01-01', 'input');
    assert(await h.click('#admin-inventory-form button[type="submit"]'), 'create lot button missing');
    const badDate = await h.text('#admin-inventory-form-error');
    assert(/future travel date/i.test(badDate || ''), `expected date error, got ${badDate}`);

    await h.setValue('#admin-inv-date', '2026-12-01', 'input');
    await h.setValue('#admin-inv-sell', '40000', 'input');
    assert(await h.click('#admin-inventory-form button[type="submit"]'), 'create lot button missing');
    const badPrice = await h.text('#admin-inventory-form-error');
    assert(/cannot be below net cost/i.test(badPrice || ''), `expected price error, got ${badPrice}`);
    assertEqual((await h.store(`${S}inventory`)).length, 3, 'no lot created on invalid input');
    return `${badFlight.trim()} | ${badRoute.trim()} | ${badDate.trim()} | ${badPrice.trim()}`;
  });

  await h.check('59 inventory — a valid lot is created as a draft and listed', async () => {
    await h.setValue('#admin-inv-sell', '60000', 'input');
    assert(await h.click('#admin-inventory-form button[type="submit"]'), 'create lot button missing');
    await sleep(700);
    const result = await h.text('#admin-inventory-result');
    assert(/UL 777 2026-12-01 created as a draft lot \(preview\)/i.test(result || ''), `expected lot result, got ${result}`);
    const lots = await h.store(`${S}inventory`);
    assertEqual(lots.length, 4, 'lot persisted');
    assertEqual(lots[3].status, 'draft', 'new lot is draft');
    assert(await h.exists('[data-inventory-row="INV-04"]'), 'new lot row missing');
    return result.trim();
  });

  /* ----------------------------------------------------------------- 60 pricing */

  await h.check('60 pricing — live preview recomputes for percentage and fixed rules', async () => {
    await h.go('/admin/pricing');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Pricing & Margin Rules', '60 heading');
    await h.setValue('#admin-rule-value', '20', 'input');
    assertEqual(await h.text('#admin-pricing-preview'), 'LKR 115,800', '20% preview');
    await h.setValue('#admin-rule-type', 'fixed', 'change');
    await h.setValue('#admin-rule-value', '5000', 'input');
    assertEqual(await h.text('#admin-pricing-preview'), 'LKR 101,500', 'fixed fee preview');
    await h.setValue('#admin-rule-type', 'percent', 'change');
    await h.setValue('#admin-rule-value', '12', 'input');
    assertEqual(await h.text('#admin-pricing-preview'), 'LKR 108,080', '12% preview restored');
    return 'preview consistent';
  });

  await h.check('60 pricing — out-of-range percentage and fixed fee are rejected', async () => {
    await h.setValue('#admin-rule-type', 'percent', 'change');
    await h.setValue('#admin-rule-value', '41', 'input');
    assert(await h.click('#admin-pricing-form button[type="submit"]'), 'save rule button missing');
    const pct = await h.text('#admin-pricing-error');
    assert(/Percentage markup must be between 0% and 40%/i.test(pct || ''), `expected percent error, got ${pct}`);
    await h.setValue('#admin-rule-type', 'fixed', 'change');
    await h.setValue('#admin-rule-value', '60000', 'input');
    assert(await h.click('#admin-pricing-form button[type="submit"]'), 'save rule button missing');
    const fixed = await h.text('#admin-pricing-error');
    assert(/between 0 and 50,000 LKR/i.test(fixed || ''), `expected fixed error, got ${fixed}`);
    assertEqual((await h.store(`${S}pricing`)).length, 2, 'no rule saved on invalid input');
    return `${pct.trim()} | ${fixed.trim()}`;
  });

  await h.check('60 pricing — a valid rule is saved and rendered', async () => {
    await h.setValue('#admin-rule-type', 'percent', 'change');
    await h.setValue('#admin-rule-value', '15', 'input');
    assert(await h.click('#admin-pricing-form button[type="submit"]'), 'save rule button missing');
    await sleep(700);
    const result = await h.text('#admin-pricing-result');
    assert(/Rule saved \(preview\): flights 15%/i.test(result || ''), `expected rule result, got ${result}`);
    assert(/Nothing was published to a live fare/i.test(result || ''), 'rule result must disclaim publication');
    const rules = await h.store(`${S}pricing`);
    assertEqual(rules.length, 3, 'rule persisted');
    assertEqual(rules[2].value, 15, 'rule value persisted');
    assert(await h.exists('[data-rule-row="PR-03"]'), 'rule row missing');
    return result.trim();
  });

  await h.check('60 pricing — deleting a rule removes it from the list', async () => {
    assert(await h.click('[data-rule-delete="PR-03"]'), 'delete rule button missing');
    await sleep(700);
    const result = await h.text('#admin-pricing-result');
    assert(/Rule PR-03 deleted/i.test(result || ''), `expected delete result, got ${result}`);
    const rules = await h.store(`${S}pricing`);
    assertEqual(rules.length, 2, 'rule removed');
    assertEqual(await h.exists('[data-rule-row="PR-03"]'), false, 'deleted rule row gone');
    return result.trim();
  });

  /* -------------------------------------------------------------- 61 fulfilment */

  await h.check('61 fulfilment — assigning a queued item exposes ticketing controls', async () => {
    await h.go('/admin/fulfilment');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Fulfilment & Ticketing Queue', '61 heading');
    assert(await h.click('[data-fulfil-assign="FUL-01"]'), 'assign button missing');
    await sleep(700);
    const result = await h.text('#admin-fulfilment-result');
    assert(/VCT-B2B-0001 assigned to ops.demo \(preview\)/i.test(result || ''), `expected assign result, got ${result}`);
    assert(await h.exists('[data-fulfil-pnr="FUL-01"]'), 'PNR input missing after assignment');
    assert(await h.exists('[data-fulfil-ticket="FUL-01"]'), 'ticket button missing after assignment');
    return result.trim();
  });

  await h.check('61 fulfilment — issuing without a valid 6-character PNR is rejected', async () => {
    assert(await h.click('[data-fulfil-ticket="FUL-01"]'), 'issue ticket button missing');
    const empty = await h.text('#admin-fulfilment-error');
    assert(/6-character PNR/i.test(empty || ''), `expected PNR gate, got ${empty}`);
    await h.setValue('[data-fulfil-pnr="FUL-01"]', 'AB12', 'input');
    assert(await h.click('[data-fulfil-ticket="FUL-01"]'), 'issue ticket button missing');
    const short = await h.text('#admin-fulfilment-error');
    assert(/6-character PNR/i.test(short || ''), `expected PNR gate, got ${short}`);
    assertEqual(await h.attr('[data-fulfil-pnr="FUL-01"]', 'aria-invalid'), 'true', 'PNR aria-invalid');
    return short.trim();
  });

  await h.check('61 fulfilment — a valid PNR marks the item ticketed in preview', async () => {
    await h.setValue('[data-fulfil-pnr="FUL-01"]', 'ab12cd', 'input');
    assert(await h.click('[data-fulfil-ticket="FUL-01"]'), 'issue ticket button missing');
    await sleep(700);
    const result = await h.text('#admin-fulfilment-result');
    assert(/marked ticketed \(preview\) with PNR AB12CD/i.test(result || ''), `expected ticketed result, got ${result}`);
    assert(/No airline ticket was issued/i.test(result || ''), 'ticketing must disclaim a real ticket');
    const items = await h.store(`${S}fulfilment`);
    assertEqual(items[0].status, 'ticketed', 'status persisted');
    assertEqual(items[0].pnr, 'AB12CD', 'PNR normalised and persisted');
    return result.trim();
  });

  await h.check('61 fulfilment — rejection needs a descriptive reason', async () => {
    assert(await h.click('[data-fulfil-reject="FUL-02"]'), 'reject button missing');
    const empty = await h.text('#admin-fulfilment-error');
    assert(/rejection reason of at least 8 characters/i.test(empty || ''), `expected reason gate, got ${empty}`);
    await h.setValue('[data-fulfil-reason="FUL-02"]', 'Payment declined by agency', 'input');
    assert(await h.click('[data-fulfil-reject="FUL-02"]'), 'reject button missing');
    await sleep(700);
    const result = await h.text('#admin-fulfilment-result');
    assert(/VCT-2026-0001 rejected \(preview\)/i.test(result || ''), `expected rejection result, got ${result}`);
    const items = await h.store(`${S}fulfilment`);
    assertEqual(items[1].status, 'rejected', 'rejection persisted');
    assert(/Payment declined/.test(items[1].reason), 'rejection reason persisted');
    const row = await h.text('[data-fulfil-row="FUL-02"]');
    assert(/Rejected — Payment declined by agency/.test(row || ''), 'rejection reason shown in the queue');
    return result.trim();
  });

  /* ------------------------------------------------------------- 62 after-sales */

  await h.check('62 after-sales — approving without a decision note is rejected', async () => {
    await h.go('/admin/after-sales');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Exchanges, Cancellations & Refunds', '62 heading');
    assert(await h.click('[data-case-approve="AS-01"]'), 'approve button missing');
    const err = await h.text('#admin-after-sales-error');
    assert(/decision note of at least 8 characters/i.test(err || ''), `expected note gate, got ${err}`);
    assertEqual(await h.attr('[data-case-note="AS-01"]', 'aria-invalid'), 'true', 'note aria-invalid');
    return err.trim();
  });

  await h.check('62 after-sales — an approved refund is queued with the 15% penalty estimate', async () => {
    await h.setValue('[data-case-note="AS-01"]', 'Airline approved goodwill refund', 'input');
    assert(await h.click('[data-case-approve="AS-01"]'), 'approve button missing');
    await sleep(700);
    const result = await h.text('#admin-after-sales-result');
    assert(/VCT-2026-0001 refund approved \(preview\)/i.test(result || ''), `expected approval result, got ${result}`);
    assert(/Refund of LKR 71,400 queued for manual finance action — no money moved/i.test(result || ''), `expected 71,400 refund note, got ${result}`);
    const cases = await h.store(`${S}after-sales`);
    assertEqual(cases[0].status, 'approved', 'approval persisted');
    assertEqual(cases[0].note, 'Airline approved goodwill refund', 'note persisted');
    return result.trim();
  });

  await h.check('62 after-sales — rejecting a case records the note and tone', async () => {
    await h.setValue('[data-case-note="AS-02"]', 'Fare difference not accepted by client', 'input');
    assert(await h.click('[data-case-reject="AS-02"]'), 'reject button missing');
    await sleep(700);
    const result = await h.text('#admin-after-sales-result');
    assert(/VCT-B2B-0001 exchange rejected \(preview\)/i.test(result || ''), `expected rejection result, got ${result}`);
    const cases = await h.store(`${S}after-sales`);
    assertEqual(cases[1].status, 'rejected', 'rejection persisted');
    assertEqual(await h.exists('[data-case-approve="AS-02"]'), false, 'decided case must lose its actions');
    return result.trim();
  });

  /* ------------------------------------------------------------- 63 disruptions */

  await h.check('63 disruptions — closing an open case before notification is blocked', async () => {
    await h.go('/admin/disruptions');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Disruption Queue', '63 heading');
    assert(await h.click('[data-disruption-close="DIS-01"]'), 'close button missing');
    const err = await h.text('#admin-disruptions-error');
    assert(/Notify affected passengers before closing/i.test(err || ''), `expected notify gate, got ${err}`);
    const cases = await h.store(`${S}disruptions`);
    assertEqual(cases[0].status, 'open', 'status unchanged');
    return err.trim();
  });

  await h.check('63 disruptions — notifying passengers moves the case to notified', async () => {
    assert(await h.click('[data-disruption-notify="DIS-01"]'), 'notify button missing');
    await sleep(700);
    const result = await h.text('#admin-disruptions-result');
    assert(/Passenger notification queued for UL 505 \(preview\)/i.test(result || ''), `expected notify result, got ${result}`);
    assert(/No message was actually sent/i.test(result || ''), 'notification must disclaim sending');
    const cases = await h.store(`${S}disruptions`);
    assertEqual(cases[0].status, 'notified', 'notified persisted');
    return result.trim();
  });

  await h.check('63 disruptions — closing needs a rebooking option and a resolution note', async () => {
    assert(await h.click('[data-disruption-close="DIS-01"]'), 'close button missing');
    const noOption = await h.text('#admin-disruptions-error');
    assert(/Select a rebooking option/i.test(noOption || ''), `expected rebook gate, got ${noOption}`);
    await h.setValue('[data-disruption-rebook="DIS-01"]', 'next_day', 'change');
    await h.setValue('[data-disruption-note="DIS-01"]', 'short', 'input');
    assert(await h.click('[data-disruption-close="DIS-01"]'), 'close button missing');
    const shortNote = await h.text('#admin-disruptions-error');
    assert(/resolution note of at least 8 characters/i.test(shortNote || ''), `expected note gate, got ${shortNote}`);
    return shortNote.trim();
  });

  await h.check('63 disruptions — a valid close records the resolution', async () => {
    await h.setValue('[data-disruption-note="DIS-01"]', 'Protected on the next-day service', 'input');
    assert(await h.click('[data-disruption-close="DIS-01"]'), 'close button missing');
    await sleep(700);
    const result = await h.text('#admin-disruptions-result');
    assert(/UL 505 disruption closed \(preview\) with option “Next-day protected rebooking”/i.test(result || ''), `expected close result, got ${result}`);
    assert(/No rebooking was transmitted to the airline/i.test(result || ''), 'close must disclaim transmission');
    const cases = await h.store(`${S}disruptions`);
    assertEqual(cases[0].status, 'closed', 'closed persisted');
    assert(/Next-day protected rebooking — Protected on the next-day service/.test(cases[0].resolution), 'resolution persisted');
    return result.trim();
  });

  /* ---------------------------------------------------------- 64 reconciliation */

  await h.check('64 reconciliation — running reconciliation reports the mismatch count', async () => {
    await h.go('/admin/reconciliation');
    await sleep(700);
    assertEqual(await h.text('#admin-console-heading'), 'Reconciliation & Audit', '64 heading');
    assert(await h.click('#admin-run-reconciliation'), 'run reconciliation missing');
    await sleep(700);
    const result = await h.text('#admin-reconciliation-result');
    assert(/Reconciliation complete \(preview\): 1 of 2 rows matched, 1 mismatch\(es\) need resolution/i.test(result || ''), `expected reconciliation result, got ${result}`);
    assert(/No supplier statement was downloaded/i.test(result || ''), 'reconciliation must disclaim download');
    return result.trim();
  });

  await h.check('64 reconciliation — resolving a mismatch needs a documented note', async () => {
    assert(await h.click('[data-ledger-resolve="LED-02"]'), 'resolve button missing');
    const err = await h.text('#admin-reconciliation-error');
    assert(/resolution note of at least 8 characters/i.test(err || ''), `expected note gate, got ${err}`);
    assertEqual(await h.attr('[data-ledger-note="LED-02"]', 'aria-invalid'), 'true', 'ledger note aria-invalid');
    return err.trim();
  });

  await h.check('64 reconciliation — a resolved mismatch is persisted with its note', async () => {
    await h.setValue('[data-ledger-note="LED-02"]', 'Supplier credit note CN-4471 received', 'input');
    assert(await h.click('[data-ledger-resolve="LED-02"]'), 'resolve button missing');
    await sleep(700);
    const result = await h.text('#admin-reconciliation-result');
    assert(/Mismatch on VCT-2026-0001 resolved \(preview\)/i.test(result || ''), `expected resolve result, got ${result}`);
    assert(/No journal entry was posted/i.test(result || ''), 'resolve must disclaim posting');
    const rows = await h.store(`${S}ledger`);
    assertEqual(rows[1].status, 'resolved', 'resolution persisted');
    assertEqual(rows[1].note, 'Supplier credit note CN-4471 received', 'note persisted');
    return result.trim();
  });

  await h.check('64 reconciliation — a second run reports every row matched', async () => {
    assert(await h.click('#admin-run-reconciliation'), 'run reconciliation missing');
    await sleep(700);
    const result = await h.text('#admin-reconciliation-result');
    assert(/2 of 2 rows matched/i.test(result || ''), `expected all matched, got ${result}`);
    return result.trim();
  });

  await h.check('64 reconciliation — resetting the ledger restores seed values with visible feedback', async () => {
    assert(await h.click('#admin-reset-ledger'), 'reset ledger missing');
    await sleep(700);
    const result = await h.text('#admin-reconciliation-result');
    assert(/Demo ledger reset to its seed values/i.test(result || ''), `reset must confirm visibly, got ${result}`);
    const rows = await h.store(`${S}ledger`);
    assertEqual(rows[1].status, 'mismatch', 'ledger restored to seed');
    assert(await h.exists('[data-ledger-resolve="LED-02"]'), 'resolve control restored after reset');
    return result.trim();
  });

  await h.check('64 reconciliation — the audit trail records every operations action', async () => {
    const audit = await h.store(`${S}audit`);
    assert(Array.isArray(audit) && audit.length >= 12, `expected >= 12 audit entries, got ${audit?.length}`);
    const list = await h.text('#admin-audit-list');
    assert(/DUFFEL deactivated/.test(list || ''), 'supplier change missing from audit list');
    assert(/ticketed in preview/.test(list || ''), 'ticketing missing from audit list');
    assert(/mismatch resolved/.test(list || ''), 'ledger resolution missing from audit list');
    assertEqual(audit[0].actor, 'ops.demo (fixture)', 'audit actor');
    return `${audit.length} entries`;
  });

  /* ------------------------------------------------------- navigation + a11y */

  await h.check('58–64 — area tabs navigate between console screens', async () => {
    assert(await h.click('[data-admin-area="/admin/inventory"]'), 'inventory tab missing');
    await sleep(800);
    assertEqual(await h.url(), '/admin/inventory', 'inventory route');
    assertEqual(await h.text('#admin-console-heading'), 'Manual Inventory CMS', 'inventory heading');
    assertEqual(await h.attr('[data-admin-area="/admin/inventory"]', 'aria-current'), 'page', 'active tab marked');
    assert(await h.click('[data-admin-area="/admin/after-sales"]'), 'after-sales tab missing');
    await sleep(800);
    assertEqual(await h.text('#admin-console-heading'), 'Exchanges, Cancellations & Refunds', 'after-sales heading');
    return 'tab navigation works';
  });

  await h.check('a11y — real Tab key produces a visible focus ring in the console', async () => {
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

  await h.check('animation — reduced motion collapses transitions in the console', async () => {
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const motion = await h.cdp.evaluate(`(() => {
      const el = document.querySelector('#flight-admin-console') || document.querySelector('section');
      const cs = getComputedStyle(el);
      return { duration: cs.animationDuration, transition: cs.transitionDuration };
    })()`);
    assert(parseFloat(motion.duration) < 0.05, `animation-duration should collapse, got ${motion.duration}`);
    await h.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    return JSON.stringify(motion);
  });

  await h.check('fixture exit — leaving the console restores the honest auth gate', async () => {
    assert(await h.click('#admin-exit-fixture'), 'exit fixture button missing');
    await sleep(1600);
    assertEqual(await h.store(`${S}demoOpsRole`), null, 'fixture role cleared');
    assertEqual(await h.exists('#flight-admin-console'), false, 'console removed');
    const body = await h.text('#admin-inventory-workspace');
    assert(/Operations access/i.test(body || ''), 'auth gate restored');
    return 'gate restored';
  });

  await h.check('no uncaught exceptions during Batch D flows', async () => {
    const exceptions = h.cdp.pageExceptions.filter(e => !/clerk/i.test(e));
    assertEqual(exceptions.length, 0, `uncaught exceptions: ${JSON.stringify(exceptions.slice(0, 3))}`);
    return '0 exceptions';
  });
});
