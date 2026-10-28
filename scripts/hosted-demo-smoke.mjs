import fs from 'node:fs';
const origin=new URL(process.argv[2]||'http://127.0.0.1:4176');
if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Invalid target');
const expected=process.env.EXPECTED_RELEASE_SHA;
const checks=[];
async function check(name,run){try{await run();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',reason:e.message});}}
const request=p=>fetch(new URL(p,origin),{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(30000)});
for(const route of ['/','/flights','/hotels','/visa-assistance','/holiday-packages','/cars-transfers','/activities','/sightseeing-tours','/rails','/cruises','/travel-insurance','/trip-builder','/trip/review','/requests','/checkout'])await check('direct route '+route,async()=>{const r=await request(route),html=await r.text();if(!r.ok||!html.includes('public-demo-notice')||!html.includes('<base href="/">'))throw new Error('Missing safe demo page');if(!r.headers.get('x-robots-tag')?.includes('noindex'))throw new Error('Missing noindex header');});
await check('release identity',async()=>{const r=await request('/demo-release.json');const data=await r.json();if(data.mode!=='PUBLIC_DEMO'||data.backendQualified!==false||data.transactionsEnabled!==false||(expected&&data.commit!==expected))throw new Error('Unexpected release marker');});
for(const route of ['/api/v1/demo/capabilities','/api/v1/session','/api/v1/health','/api/v1/checkout/capabilities'])await check('safe JSON '+route,async()=>{const r=await request(route);if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw new Error('Not supported JSON');const data=await r.json();if(data.enquiries===true||data.authenticated===true||data.transactionsEnabled===true||data.gateways?.length)throw new Error('Unsafe capability');});
// Read-only negative probes: never POST to an unverified hosted financial/admin endpoint.
for(const route of ['/api/v1/admin/enquiries','/api/v1/admin/triage','/api/v1/enquiries','/api/v1/bookings','/api/v1/flights/sandbox/orders'])await check('closed API '+route,async()=>{const r=await request(route);if(r.status!==503||!r.headers.get('content-type')?.includes('problem+json')||(await r.json()).code!=='HOSTED_BACKEND_NOT_QUALIFIED')throw new Error('API did not fail closed');});
await check('fixed asset cache revalidation',async()=>{const r=await request('/dist/vacatina.bundle.js');if(!r.ok||/immutable/.test(r.headers.get('cache-control')||''))throw new Error('Unsafe fixed-name asset caching');});
const report={target:origin.origin,expectedCommit:expected||null,checks,backendQualified:false};
if(process.env.SMOKE_REPORT)fs.writeFileSync(process.env.SMOKE_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
