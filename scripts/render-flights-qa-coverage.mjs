import fs from 'node:fs';
import path from 'node:path';
import { screens, applicationSha, historicalHosted } from './flights-qa-inventory.mjs';
const root=process.cwd();
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;
const qa=read(path.join(root,'docs/flights-evidence/gap-qa/results.json'));
const followups=['fix-validation','route-state-followup','fare-route-followup','new-state-followup'].map(dir=>read(path.join(root,`docs/flights-evidence/gap-qa/${dir}/results.json`))).filter(Boolean);const latest=new Map();
for(const run of [qa,...followups].filter(Boolean))for(const r of run.results)latest.set(r.screen+':'+(r.width||'missing'),{...r,sourceHead:run.applicationSha||run.gitHead||'pre-commit working tree'});
const combined=[...latest.values()];
const hostedFollowup=read(path.join(root,'docs/flights-evidence/gap-qa/hosted-fix-validation/results.json'));
const reviews=read(path.join(root,'docs/flights-evidence/gap-qa/visual-review.json'))||{};
const rows=screens.map(s=>{
  const samples=combined.filter(r=>r.screen===s.id&&r.width);
  const unavailable=samples.length?null:combined.find(r=>r.screen===s.id&&r.status==='NOT VERIFIED');
  const widths=samples.map(r=>r.width);
  const scan=samples.find(r=>r.axe)?.axe;
  const reflow=samples.find(r=>r.reflow)?.reflow;
  const review=reviews[s.id];
  const local=samples.length?`New local fixture QA: ${widths.join('/')}px (not hosted/authenticated)`:'Historical suite coverage reported; per-state raw evidence NOT VERIFIED';
  const currentHosted=(hostedFollowup?.rows||[]).filter(r=>r.screen===s.id);
  const hosted=(historicalHosted[s.id]||'NOT VERIFIED in accepted deployed run')+(currentHosted.length?`; affected-QA @3ce16d4: ${currentHosted.filter(r=>r.status==='PASS').length} PASS / ${currentHosted.filter(r=>r.status==='BLOCKED').length} BLOCKED (not full journey replay)`:'');
  const visual=review?review.status+': '+review.notes:'NOT VERIFIED: screenshots not visually reviewed';
  const responsive=samples.length?`${samples.filter(r=>r.overflow<=1).length}/${samples.length} fit checks at ${widths.join('/')}; 320px reflow ${reflow?(reflow.overflow<=1?'fits':'FAIL overflow '+reflow.overflow):'NOT VERIFIED'}; full usability NOT VERIFIED`:'NOT VERIFIED at required 390/768/1440';
  const a11y=scan?`axe ${scan.version}: ${scan.violations.length} rule violations; ${scan.incomplete.length} manual-review rules; Tab focus + AX sample. Full screen-reader audit NOT VERIFIED`:'NOT VERIFIED (beyond historical selected naming/error/focus checks)';
  const stateLimit=['36','56','57'].includes(s.id)?'Only guard/entry state captured; populated workflow NOT VERIFIED':null;
  const gaps=[unavailable?.reason,stateLimit,['19','20','22'].includes(s.id)?'Recovery drawer captured; full distinct exception-feedback visual QA NOT VERIFIED':null,scan?.violations.length?`Confirmed candidates: ${scan.violations.map(v=>v.id).join(', ')}`:null,!review?'Visual review NOT VERIFIED':null,'Full keyboard/error/announcement, contrast manual exclusions, true zoom and AT audit NOT VERIFIED'].filter(Boolean).join('; ');
  return {id:s.id,route:s.route,state:s.state,name:s.name,local,hosted,visual,responsive,a11y,gaps};
});
const md=[
  '# Flights — 64-screen coverage matrix',
  '',
  `Accepted application SHA: \`${applicationSha}\`. Later evidence commits do not change this attribution.`,
  'Accepted hosted result: **68 PASS / 0 FAIL / 4 BLOCKED / 72 cases**, from the preserved JSON/report; not rerun to recreate evidence.',
  'References: repository `DESIGN.md`, existing approved screens, `SCREEN_STATUS_MATRIX.md` (historical claims, not proof of a complete audit). Screen numbering here is the Flights inventory, not the differently numbered locked homepage design references.',
  '',
  'Local fixtures are never substituted for hosted/authenticated results. NOT VERIFIED means evidence is absent or insufficient. A zero-violation automated scan is not WCAG compliance. Saved screenshots alone are not visual acceptance.',
  '',
  '| Screen ID | Route / state | Local evidence | Deployed evidence | Visual QA | Responsive QA | Accessibility QA | Remaining gap |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map(r=>`| ${r.id} ${r.name} | \`${r.route}\` — ${r.state} | ${r.local} | ${r.hosted} | ${r.visual} | ${r.responsive} | ${r.a11y} | ${r.gaps} |`),
  '',
  '## Denominators',
  `- Screen inventory rows: ${rows.length}/64. This is inventory completeness, not QA completion.`,
  `- Screens with some accepted hosted functional/render evidence: ${Object.values(historicalHosted).filter(v=>!v.startsWith('BLOCKED')).length}/64. Coverage is partial and case-scoped.`,
  `- Screens with supplemental local gap-QA screenshots/measurements: ${new Set(combined.filter(r=>r.width).map(r=>r.screen)).size}/64. Combined baseline/fix/follow-up evidence, not a complete current-SHA replay.`,
  `- Screens visually reviewed: ${Object.keys(reviews).length}/64; only recorded states and viewports count.`,
  '- Baseline evidence-only commit: `e1724c0824e360ca1ef7d972e1710d5eb074f2f6`; application-fix commit: `3ce16d45f8be9e4dcfe3762e043db8f4d85e7b74`.',
  '- Current-SHA affected hosted checks: 24 PASS / 0 FAIL / 1 BLOCKED (25 cases); not merged into the accepted baseline 72-case denominator.',
  '- Full applicable WCAG audit completed: 0/64; no compliance claim.',
  '- Production acceptance: 0/64 (not authorized).',
  '',
  'See `docs/flights-evidence/README.md` for preserved baseline/deployment identity and `gap-qa/results.json` for new local raw evidence. These dimensions must not be added together into a platform-completion percentage.',
];
fs.writeFileSync(path.join(root,'docs/flights-evidence/FLIGHTS_QA_COVERAGE.md'),md.join('\n'));
fs.writeFileSync(path.join(root,'docs/flights-evidence/coverage-matrix.json'),JSON.stringify({applicationSha,rows},null,2));
console.log('Coverage matrix: 64 screens; local samples',qa?.results?.length||0);
