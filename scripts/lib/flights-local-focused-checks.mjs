// Trusted keyboard/error/focus/reduced-motion checks, local fixtures only.
export async function runFocusedQa({cdp,ev,go,click,key,fill,wait,visible,base}){
  const rows=[];
  const check=async(id,screen,name,fn)=>{
    try{await fn();rows.push({id,screen,name,status:'PASS',mode:'LOCAL_FIXTURE'});console.log('PASS '+id+' '+name);}
    catch(e){rows.push({id,screen,name,status:'FAIL',reason:e.message,mode:'LOCAL_FIXTURE'});console.log('FAIL '+id+' '+e.message);}
  };
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  async function tabTo(selector){
    for(let i=0;i<100;i++){
      await key('Tab','Tab',9);
      if(await ev(`document.activeElement?.matches(${JSON.stringify(selector)})`))return;
    }
    throw new Error('Tab did not reach '+selector);
  }
  async function replaceFocused(text){await key('a','KeyA',65,2);await cdp.send('Input.insertText',{text});}
  await cdp.setViewport(1440,900,false);
  await go('/flights','#hub-flight-origin');
  await check('K01','02','Airport combobox keyboard semantics and Escape cleanup',async()=>{
    await fill('#hub-flight-origin','Lon');
    await click('#hub-flight-origin');
    await wait(()=>ev(`document.querySelector('#hub-flight-origin').getAttribute('aria-expanded')==='true'`),'airport listbox');
    await key('ArrowDown','ArrowDown',40);
    assert(await ev(`(()=>{const e=document.querySelector('#hub-flight-origin'),id=e.getAttribute('aria-activedescendant');return e.getAttribute('role')==='combobox'&&e.getAttribute('aria-haspopup')==='listbox'&&!!id&&document.getElementById(id)?.getAttribute('aria-selected')==='true';})()`),'Combobox active option semantics');
    await key('Escape','Escape',27);
    assert(await ev(`document.querySelector('#hub-flight-origin').getAttribute('aria-expanded')==='false'&&!document.querySelector('#hub-flight-origin').hasAttribute('aria-activedescendant')`),'Stale active descendant after close');
  });
  await go('/flights/search?origin=CMB&destination=DXB&departureDate=2026-11-18&adults=1','button[data-view-offer]');
  await click('button[data-view-offer]');await wait(()=>visible('#btn-modal-close'),'offer modal');
  await check('K02','04','Modal traps Tab and Shift+Tab; scroll region keyboard reachable',async()=>{
    await tabTo('[role="region"][aria-label="Flight offer details"]');
    const start=await ev(`document.activeElement.scrollTop`);
    await key('PageDown','PageDown',34);
    await wait(()=>ev(`document.querySelector('[aria-label="Flight offer details"]').scrollTop>${start}`),'keyboard scroll');
    for(let i=0;i<16;i++){
      await key('Tab','Tab',9,i%2?1:0);
      assert(await ev(`!!document.activeElement?.closest('#flight-offer-detail-modal')`),'Focus escaped modal');
    }
  });
  await check('K03','04','Offer modal respects reduced motion',async()=>{
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert(await ev(`(()=>{const e=document.querySelector('#btn-modal-book-now');return matchMedia('(prefers-reduced-motion: reduce)').matches&&getComputedStyle(e).transitionDuration.split(',').every(x=>parseFloat(x)<0.001);})()`),'Reduced transition not applied');
    await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  });
  await check('K04','04','Escape closes offer modal and restores result trigger focus',async()=>{
    await key('Escape','Escape',27);await wait(()=>ev(`!document.querySelector('#flight-offer-detail-modal')`),'modal closed');
    assert(await ev(`document.activeElement?.matches('button[data-view-offer]')`),'Offer trigger focus not restored');
  });
  await click('button[data-view-offer]');await wait(()=>visible('#btn-modal-add-trip'),'offer');await click('#btn-modal-add-trip');await wait(()=>visible('#drawer-review-trip-cta'),'drawer');
  await check('K05','10','Drawer traps keyboard focus and restores header entry on Escape',async()=>{
    for(let i=0;i<16;i++){
      await key('Tab','Tab',9,i%2?1:0);
      assert(await ev(`!!document.activeElement?.closest('#trip-bucket-drawer')`),'Focus escaped drawer');
    }
    await key('Escape','Escape',27);
    assert(await ev(`document.activeElement?.id==='header-trip-bucket-btn'`),'Drawer entry focus not restored');
  });
  // New cold document, no injected form/storage state. All field navigation below uses Tab.
  await cdp.send('Page.navigate',{url:base+'/flights/requests/VCT-REQ-KEYBOARD/review'});
  await wait(()=>visible('#mr-phone'),'cold manual request');
  await check('K06','46','Screen 46 heading does not display a double-escaped entity',async()=>{
    assert(await ev(`document.querySelector('.flights-manual-request header p').textContent.includes('Review & submit')&&!document.querySelector('.flights-manual-request header p').textContent.includes('&amp;')`),'Double-escaped stage text');
  });
  await check('K07','46','Keyboard-only invalid phone gives visible focus and accessible custom error',async()=>{
    await tabTo('#mr-phone');
    assert(await ev(`(()=>{const e=document.activeElement,s=getComputedStyle(e);return e.matches(':focus-visible')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;})()`),'No keyboard focus indicator');
    await replaceFocused('077');await tabTo('#mr-submit');await key('Enter','Enter',13);
    await wait(()=>ev(`/phone/i.test(document.querySelector('#mr-form-error').textContent)`),'custom phone error');
    assert(await ev(`document.querySelector('#mr-phone').getAttribute('aria-invalid')==='true'&&document.querySelector('#mr-form-error').getAttribute('role')==='alert'&&!!document.querySelector('#mr-form-error').getClientRects().length&&document.querySelector('#mr-review-form').noValidate`),'Accessible custom validation attributes');
    const ax=await cdp.send('Accessibility.getFullAXTree');
    assert(ax.nodes.some(n=>!n.ignored&&n.role?.value==='alert'),'Error alert absent from AX tree');
  });
  let submissionNavigations=0;
  const originalEvents=cdp.onEvent;
  cdp.onEvent=message=>{originalEvents?.(message);if(message.method==='Page.navigatedWithinDocument'&&message.params.url===base+'/flights/requests/VCT-REQ-KEYBOARD/submitted')submissionNavigations++;};
  await check('K08','46','Keyboard-only consent + rapid Enter activation creates one preview record/navigation',async()=>{
    await tabTo('#mr-phone');await replaceFocused('+94 77 123 4567');await tabTo('#mr-consent');await key(' ','Space',32);
    assert(await ev(`document.querySelector('#mr-consent').checked`),'Space did not check consent');
    await tabTo('#mr-submit');
    for(let i=0;i<5;i++)await key('Enter','Enter',13);
    await wait(()=>ev(`location.pathname==='/flights/requests/VCT-REQ-KEYBOARD/submitted'`),'keyboard submit');
    assert(await ev(`(()=>{const r=JSON.parse(sessionStorage.getItem('vacatina:manualRequest:VCT-REQ-KEYBOARD'));return r.status==='submitted'&&r.history.length===1;})()`),'Preview record not singular');
    assert(submissionNavigations===1,'Expected one navigation, observed '+submissionNavigations);
  });
  await go('/flights/checkout/booking-failed','#booking-retry');
  await check('K09','24','Booking-failure preview copy and retry status do not claim transactions',async()=>{
    assert(await ev(`(()=>{const t=document.querySelector('#flights-view-mount').textContent;return t.includes('No payment was captured')&&!t.includes('The payment was captured')&&!t.includes('refunded automatically');})()`),'Misleading payment/refund claim');
    await click('#booking-retry');await wait(()=>visible('#booking-retry-result'),'preview retry feedback');
    assert(await ev(`document.querySelector('#booking-retry-result').getAttribute('role')==='status'&&/no payment was captured/i.test(document.querySelector('#booking-retry-result').textContent)`),'Missing honest status feedback');
  });
  return rows;
}
