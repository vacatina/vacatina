import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=path.resolve('docs/flights-evidence/gap-qa');
const load=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const files=['results.json','fix-validation/results.json','route-state-followup/results.json','fare-route-followup/results.json'];
const latest=new Map();
for(const f of files){const run=load(f);for(const r of run.results)if(r.width)latest.set(`${r.screen}-${r.width}`,{...r,evidence:f});}
const samples=[...latest.values()];
const unique=[...new Set(samples.map(r=>r.screen))];
const scans=samples.filter(r=>r.axe);
const reflows=samples.filter(r=>r.reflow);
const focused=load('keyboard-focus/results.json').results;
const hosted=load('hosted-fix-validation/results.json');
const motion=samples.filter(r=>r.motion?.length);
const summary={
  originalAcceptedApplicationSha:'6054dc541a0b3a703bf39cdca714bc238b472dc3',
  originalAccepted:{PASS:68,FAIL:0,BLOCKED:4,total:72,source:'../accepted-6054dc5/acceptance-trusted-results.json'},
  evidenceOnlyCommit:'e1724c0824e360ca1ef7d972e1710d5eb074f2f6',
  changedApplicationSha:'3ce16d45f8be9e4dcfe3762e043db8f4d85e7b74',
  hostedChanged:{applicationSha:hosted.applicationSha,deployment:hosted.deployment,base:hosted.base,counts:hosted.rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),total:hosted.rows.length},
  localFixtureScreens:{measured:unique.length,total:64,percent:100*unique.length/64,missing:['06','07','13','16','21']},
  responsiveMeasurements:{fit:samples.filter(r=>r.overflow<=1).length,total:samples.length,widths:[390,768,1440],limit:'Combined multi-revision snapshot measurements, not full usability acceptance'},
  reflowApproximation:{fit:reflows.filter(r=>r.reflow.overflow<=1).length,total:reflows.length,cssWidth:320,limit:'Not a true desktop zoom audit; horizontally scrollable data tables need manual usability review'},
  latestComponentAxe:{zeroViolations:scans.filter(r=>r.axe.violations.length===0).length,total:scans.length,version:'4.10.3',limit:'Component-scoped automated checks at 1440px; not full WCAG compliance'},
  reducedMotionControlSamples:{collapsed:motion.filter(r=>r.motion.every(s=>[s.animation,s.transition].every(v=>v.split(',').every(n=>parseFloat(n)<0.001)))).length,total:motion.length,limit:'Sampled controls only; complete animated-state audit NOT VERIFIED'},
  focusedLocal:{pass:focused.filter(r=>r.status==='PASS').length,total:focused.length},
  fullWcagAudit:{completed:0,total:64},
  fullVisualAcceptance:{completed:0,total:64,limit:'59 screens macro-reviewed; not full-size, full-page, all-state visual acceptance'},
};
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
// Human/model visual review performed in this session: all listed contact sheets
// were read, in addition to full-size 04/11/23/24 screenshots. Never infer review
// automatically for any future screenshots or states.
const reviewedSheets=['contact-sheets.json','fix-validation/contact-sheets.json','route-state-followup/contact-sheets.json'];
const review={};
for(const manifest of reviewedSheets){
  const prefix=path.dirname(manifest);
  for(const sheet of load(manifest)){
    const relative=path.join(prefix,sheet.file).replaceAll('\\','/');
    const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,relative))).digest('hex');
    for(const id of sheet.screens)review[id]={status:'PARTIAL',widths:[390,768,1440],notes:'Macro layout reviewed against DESIGN.md and existing light-surface/brand/type patterns; full-size/all-state visual acceptance NOT VERIFIED',contactSheet:relative,sha256};
  }
}
fs.writeFileSync(path.join(dir,'visual-review.json'),JSON.stringify(review,null,2));
console.log(JSON.stringify(summary,null,2));
