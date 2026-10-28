/* Read-only account verification. No deployment, environment mutation or project creation. */
import fs from 'node:fs';
import { DEMO_RELEASE_TARGET, assertDemoProject, assertDemoRollback, assertDemoEnvironment } from './demo-release-guards.mjs';
const {projectId:expectedProject,teamId:expectedTeam,domain}=DEMO_RELEASE_TARGET;
if(process.env.VERCEL_PROJECT_ID!==expectedProject||process.env.VERCEL_ORG_ID!==expectedTeam)throw new Error('Existing project/team identity must be verified; no linking or project creation is allowed.');
if(!process.env.VERCEL_TOKEN)throw new Error('Vercel account authorization unavailable.');
if(process.env.VACATINA_ROLLBACK_VERIFIED!=='true'||!process.env.VACATINA_ROLLBACK_EVIDENCE)throw new Error('Account-specific rollback rehearsal/evidence is required before candidate creation.');
async function api(route){const url=new URL('https://api.vercel.com'+route);url.searchParams.set('teamId',expectedTeam);const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.VERCEL_TOKEN},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Read-only Vercel verification failed: HTTP '+response.status);return response.json();}
const project=await api('/v9/projects/'+expectedProject);
assertDemoProject(project,process.env.GITHUB_REPOSITORY);
const team=await api('/v2/teams/'+expectedTeam);
const alias=await api('/v4/aliases/'+domain);
const previousId=alias.deploymentId||alias.deployment?.id;
if(!previousId)throw new Error('Current production-domain deployment is unknown.');
const deployment=await api('/v13/deployments/'+previousId);
const {plan}=assertDemoRollback(team,deployment,alias,project,process.env);
const environments=await api('/v10/projects/'+expectedProject+'/env?decrypt=false');
assertDemoEnvironment(environments);
// Native Git deployment must be disabled for this branch in the committed config and verified in account settings before enabling this workflow.
if(process.env.VACATINA_NATIVE_GIT_ISOLATED!=='true')throw new Error('Competing native Git deployments have not been independently ruled out.');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
if(config.git?.deploymentEnabled?.[DEMO_RELEASE_TARGET.branch]!==false)throw new Error('Committed release-branch native Git isolation is missing.');
const previousUrl=new URL('https://'+deployment.url);if(!previousUrl.hostname.endsWith('.vercel.app')||previousUrl.username||previousUrl.password)throw new Error('Unexpected original deployment URL.');
const record={projectId:project.id,teamId:expectedTeam,domain,plan,previousDeploymentId:previousId,previousUrl:previousUrl.origin,rollbackEvidence:process.env.VACATINA_ROLLBACK_EVIDENCE,rollbackVerifiedAt:process.env.VACATINA_ROLLBACK_VERIFIED_AT,gitConnection:project.link?{type:project.link.type,repository:process.env.GITHUB_REPOSITORY,productionBranch:project.link.productionBranch}:null,checkedAt:new Date().toISOString()};
fs.writeFileSync('demo-release-backup.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
