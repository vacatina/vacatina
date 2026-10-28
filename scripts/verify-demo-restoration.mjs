import fs from 'node:fs';
const backup=JSON.parse(fs.readFileSync('demo-release-backup.json','utf8'));
const url=new URL('https://api.vercel.com/v4/aliases/'+backup.domain);url.searchParams.set('teamId',backup.teamId);
const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.VERCEL_TOKEN},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Rollback identity could not be verified.');
const alias=await response.json();if((alias.deploymentId||alias.deployment?.id)!==backup.previousDeploymentId)throw new Error('Rollback has not restored the exact previous deployment.');
const publicResponse=await fetch('https://'+backup.domain,{signal:AbortSignal.timeout(30000)});if(!publicResponse.ok)throw new Error('Restored domain is not serving successfully.');
fs.writeFileSync('docs/phase18-evidence/restoration.json',JSON.stringify({domain:backup.domain,deploymentId:backup.previousDeploymentId,exactOriginalRestored:true,publicStatus:publicResponse.status,checkedAt:new Date().toISOString()},null,2));
console.log('Exact original deployment restored: '+backup.previousDeploymentId);
