import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=name=>fs.readFileSync(new URL('../src/features/flights/ui/'+name,import.meta.url),'utf8');
test('airport listbox expansion is attached to a combobox and stale active descendant is cleared',()=>{
  const text=source('airport-autocomplete.ts');
  assert.match(text,/setAttribute\('role', 'combobox'\)/);
  assert.match(text,/setAttribute\('aria-haspopup', 'listbox'\)/);
  assert.match(text,/const closeDropdown[\s\S]*?removeAttribute\('aria-activedescendant'\)/);
});
test('offer scroll region is keyboard focusable and named without changing dialog controls',()=>{
  const text=source('flights-offer-detail-modal.ts');
  assert.match(text,/<div tabindex="0" role="region" aria-label="Flight offer details" class="p-6 overflow-y-auto/);
  assert.match(text,/id="btn-modal-book-now"[^\n]*bg-emerald-700/);
  assert.match(text,/id="btn-modal-add-trip"/);
});
test('enabled green actions have >=4.5:1 white-text contrast at default state',()=>{
  const lum=hex=>{
    const c=hex.match(/\w\w/g).map(n=>parseInt(n,16)/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
    return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
  };
  for(const bg of ['047857','15803d'])assert.ok(1.05/(lum(bg)+0.05)>=4.5);
  assert.match(source('flights-post-booking.ts'),/id="btn-accept-revised"[^\n]*bg-brand-success/);
});
test('read-only payment explanation is not faded while actual payment controls remain gated',()=>{
  const text=source('flights-trip-review.ts');
  assert.doesNotMatch(text,/bg-brand-subtle opacity-60/);
  assert.match(text,/Proceed to Checkout \(unavailable\)/);
  assert.match(text,/disabled aria-disabled="true"/);
});
test('booking-failure preview never claims captured funds or automatic refunds',()=>{
  const text=source('flights-checkout-states.ts');
  assert.doesNotMatch(text,/The payment was captured|refunded automatically/);
  assert.match(text,/No payment was captured and no booking, PNR or ticket was created/);
  assert.match(text,/No payment hold, release or refund is performed by this preview/);
  assert.match(text,/id="booking-retry"/);
});
test('controllable loading state exposes an advance control while held',()=> {
  const src=fs.readFileSync(new URL('../src/features/flights/ui/flights-search-view.ts',import.meta.url),'utf8');
  assert.match(src,/qaHoldLoading/);
  assert.match(src,/btn-advance-loading/);
  assert.match(src,/showAdvanceLoading/);
});
test('fare-rules-changed simulation exists in fixtures and adapter',()=> {
  const fixtures=fs.readFileSync(new URL('../src/features/flights/data/supplier-fixtures.ts',import.meta.url),'utf8');
  const adapter=fs.readFileSync(new URL('../src/features/flights/adapters/supplier-api-flight.adapter.ts',import.meta.url),'utf8');
  assert.match(fixtures,/sup-flt-fare-rules-changed-sim/);
  assert.match(adapter,/sup-flt-fare-rules-changed-sim/);
  assert.match(adapter,/Fare rules changed/);
});
test('manual-request stage is escaped once rather than displaying an HTML entity',()=>{
  assert.match(source('flights-manual-request.ts'),/review: 'Step 1 of 4 · Review & submit'/);
  assert.doesNotMatch(source('flights-manual-request.ts'),/Review &amp; submit/);
});
