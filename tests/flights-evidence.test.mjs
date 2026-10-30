import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { screens, applicationSha } from '../scripts/flights-qa-inventory.mjs';

const accepted=JSON.parse(fs.readFileSync(new URL('../docs/flights-evidence/accepted-6054dc5/acceptance-trusted-results.json',import.meta.url),'utf8'));
test('accepted application attribution is immutable, not an evidence-commit SHA',()=>{
  assert.equal(accepted.sha,applicationSha);
  assert.equal(applicationSha,'6054dc541a0b3a703bf39cdca714bc238b472dc3');
  assert.equal(accepted.base,'https://vacatina-8cgmadjx1-vacatinas-projects.vercel.app');
});
test('accepted case IDs and denominator reconcile independently of screen count',()=>{
  assert.equal(accepted.rows.length,72);
  assert.equal(new Set(accepted.rows.map(r=>r.id)).size,72);
  assert.equal(accepted.rows.filter(r=>r.status==='PASS').length,68);
  assert.equal(accepted.rows.filter(r=>r.status==='FAIL').length,0);
  assert.deepEqual(accepted.rows.filter(r=>r.status==='BLOCKED').map(r=>r.id),['D4','D6','D7','D8']);
  assert.equal(accepted.rows.find(r=>r.id==='D14').status,'PASS');
});
test('B2C viewport cases and Screen 46 are represented explicitly',()=>{
  for(const width of [390,1440])assert.equal(accepted.rows.filter(r=>r.id.startsWith('B'+width+'-')&&r.width===width&&r.status==='PASS').length,22);
  for(const id of ['D9','D10','D11'])assert.equal(accepted.rows.find(r=>r.id===id).status,'PASS');
});
test('64-screen inventory is complete, sequential and route/state scoped',()=>{
  assert.equal(screens.length,64);
  assert.deepEqual(screens.map(s=>s.id),Array.from({length:64},(_,i)=>String(i+1).padStart(2,'0')));
  assert.ok(screens.every(s=>s.route.startsWith('/')&&s.name&&s.state&&s.selector));
});
test('new probes cannot terminate Chrome globally or use the accepted legacy forced-click helper',()=>{
  for(const filename of ['verify-flights-deployed-acceptance.mjs','verify-flights-qa-gaps.mjs']){
    const text=fs.readFileSync(new URL('../scripts/'+filename,import.meta.url),'utf8');
    assert.doesNotMatch(text,/Stop-Process|taskkill|Get-Process chrome|\.click\(\)/i);
    assert.match(text,/mkdtempSync/);
    assert.match(text,/chrome\.kill\(\)/);
  }
});
