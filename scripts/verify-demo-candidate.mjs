import fs from 'node:fs';
import { assertDemoCandidate } from './demo-release-guards.mjs';
const backup=JSON.parse(fs.readFileSync('demo-release-backup.json','utf8'));
const url=new URL(process.env.CANDIDATE_URL||'');
if(url.protocol!=='https:'||!url.hostname.endsWith('.vercel.app')||url.username||url.password)throw new Error('Unexpected candidate URL.');
async function api(route){const u=new URL('https://api.vercel.com'+route);u.searchParams.set('teamId',backup.teamId);const r=await fetch(u,{headers:{Authorization:'Bearer '+process.env.VERCEL_TOKEN},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Candidate account verification failed: '+r.status);return r.json();}
const candidate=await api('/v13/deployments/'+url.hostname);
const alias=await api('/v4/aliases/'+backup.domain);
const promoted=process.argv.includes('--promoted');
assertDemoCandidate(candidate,backup,alias,process.env.EXPECTED_RELEASE_SHA,promoted);
fs.writeFileSync('demo-release-candidate.json',JSON.stringify({id:candidate.id,url:url.origin,commit:process.env.EXPECTED_RELEASE_SHA,projectId:candidate.projectId,target:candidate.target},null,2));
console.log('Verified '+(promoted?'promoted':'unpromoted')+' production artifact: '+candidate.id);
