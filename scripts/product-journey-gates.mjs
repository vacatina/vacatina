/** Browser gates added incrementally at each local product checkpoint. */
export async function verifyHotels(cdp, assertCheck) {
  for (const width of [1440, 768, 360]) {
    await cdp.setViewport(width, width === 768 ? 1024 : 900, width < 1440);
    const result = await cdp.evaluate(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const navigate = url => window.__VACATINA_ROUTER__.navigateTo(url);
      const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
      document.getElementById('trip-bucket-close')?.click();
      navigate('/hotels?destination=Bentota&checkIn=2027-02-01&checkOut=2027-02-04&rooms=2&adults=2&children=0'); await wait(120);
      const hub = document.querySelector('#hotels-view-mount .hotels-hub-root');
      const hubGood = !!hub && fits() && hub.textContent.includes('Canonical demo');
      hub?.querySelector('#hotel-hub-search-btn')?.click(); await wait(220);
      const context = location.search.includes('rooms=2') && location.search.includes('checkIn=2027-02-01');
      const button = document.querySelector('[data-open-hotel]');
      const resultsGood = !!button && fits() && document.getElementById('hotels-view-mount').textContent.includes('Canonical demo fixture');
      button?.click(); await wait(180);
      const modal = document.getElementById('hotel-property-detail-modal');
      const accessible = !!modal && modal.getAttribute('role') === 'dialog' && modal.contains(document.activeElement) && fits();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(50);
      const escape = !document.getElementById('hotel-property-detail-modal');
      button?.click(); await wait(150);
      document.querySelector('[data-select-room]')?.click(); await wait(180);
      const item = window.__VACATINA_OS__.tripBucketService.getItems().find(i => i.productType === 'hotels' && i.inventoryMode);
      const staged = !!item && item.state === 'needs_action' && item.configuration.roomsCount === 2 && item.configuration.checkInDate === '2027-02-01' && item.propertyId && item.ratePlanId;
      document.getElementById('drawer-review-trip-cta')?.click(); await wait(130);
      const review = document.getElementById('trip-review-workspace');
      const reviewed = !!review && review.textContent.includes('Canonical hotel demo fixture') && review.querySelector('#btn-review-checkout')?.disabled && fits();
      navigate('/hotels/property/phase6-missing'); await wait(130);
      const invalid = document.getElementById('hotel-invalid-dialog');
      const invalidGood = !!invalid && invalid.getAttribute('role') === 'alertdialog' && invalid.contains(document.activeElement);
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
      navigate('/hotels/search?destination=No-Such-Destination&checkIn=2027-02-01&checkOut=2027-02-04'); await wait(150);
      const empty = document.getElementById('hotel-results-count')?.dataset.resultsCount === '0';
      navigate('/');
      return {hubGood,context,resultsGood,accessible,escape,staged:!!staged,reviewed:!!reviewed,invalidGood,empty};
    })()`);
    assertCheck(`Hotels Phase 6 — search, room/rate, provenance, review, dialogs and responsive @ ${width}`, Object.values(result).every(Boolean), JSON.stringify(result));
  }
}
