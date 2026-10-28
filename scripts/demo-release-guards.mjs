/** Pure, fail-closed checks shared by read-only release scripts and offline tests. */
export const DEMO_RELEASE_TARGET = Object.freeze({
  projectId:'prj_EqFcUJ21EAwVswuSg6sE83cm4L05',teamId:'team_xj1N5ykrhBZsd1EAbEFvZU2v',
  name:'vacatina',domain:'vacatina-nu.vercel.app',branch:'release/b2c-product-journeys-v1'
});
export function assertDemoProject(project,repository){
  const t=DEMO_RELEASE_TARGET;
  if(project.id!==t.projectId||project.accountId!==t.teamId||project.name!==t.name)throw new Error('Vercel project ownership mismatch.');
  if(project.nodeVersion!=='22.x')throw new Error('Existing project Node runtime must be owner-aligned to the qualified 22.x build.');
  if(project.link){
    if(!['github','github-limited'].includes(project.link.type)||!repository||`${project.link.org}/${project.link.repo}`.toLowerCase()!==repository.toLowerCase())throw new Error('Existing Git connection does not match the verified release repository.');
    if(project.link.productionBranch===t.branch||(project.link.deployHooks||[]).some(h=>h.ref===t.branch))throw new Error('Competing release-branch native production deployment or deploy hook is configured.');
  }
}
export function assertDemoRollback(team,deployment,alias,project,env,now=Date.now()){
  const t=DEMO_RELEASE_TARGET,plan=team.billing?.plan,id=alias.deploymentId||alias.deployment?.id;
  if(team.id!==t.teamId||!['hobby','pro','enterprise'].includes(plan))throw new Error('Account plan and rollback entitlement are unknown.');
  if(!id||deployment.id!==id||deployment.projectId!==t.projectId||deployment.ownerId!==t.teamId||deployment.target!=='production'||deployment.readyState!=='READY'||project.targets?.production?.id!==id)throw new Error('Current production-domain deployment is not the exact active production target.');
  const checked=Date.parse(env.VACATINA_ROLLBACK_VERIFIED_AT||'');
  if(env.VACATINA_ROLLBACK_VERIFIED!=='true'||env.VACATINA_ROLLBACK_PLAN!==plan||!env.VACATINA_ROLLBACK_EVIDENCE||!Number.isFinite(checked)||checked>now||now-checked>30*86400000)throw new Error('Recent account-specific rollback rehearsal and plan-matched evidence are required.');
  return {id,plan};
}
export function assertDemoEnvironment(data){
  if(!Array.isArray(data.envs)||data.hiddenProductionEnvCount>0||data.pagination?.next)throw new Error('Complete Production environment metadata is unavailable.');
  const forbidden=/DUFFEL|STRIPE|PAYPAL|PAYHERE|LITEAPI|VIATOR|TRAINLINE|TRAVELTEK|ALLIANZ|AMADEUS|CLERK|DATABASE_URL|POSTGRES|SUPABASE|AUTH.*(?:SECRET|TOKEN|KEY)/i;
  for(const e of data.envs){
    const targets=typeof e.target==='string'?[e.target]:e.target;
    if(!Array.isArray(targets)||typeof e.key!=='string')throw new Error('Unknown environment scope; owner isolation is required.');
    if(targets.includes('production')&&forbidden.test(e.key))throw new Error('Production has supplier/payment/identity/database configuration requiring owner isolation. Values were not printed.');
  }
}
export function assertDemoCandidate(candidate,backup,alias,sha,promoted=false){
  if(!/^[a-f0-9]{40}$/.test(sha||'')||candidate.projectId!==DEMO_RELEASE_TARGET.projectId||candidate.ownerId!==DEMO_RELEASE_TARGET.teamId||candidate.target!=='production'||candidate.readyState!=='READY'||candidate.meta?.githubCommitSha!==sha||candidate.meta?.githubCommitRef!==DEMO_RELEASE_TARGET.branch)throw new Error('Candidate project/environment/commit mismatch.');
  if(candidate.readySubstate!==(promoted?'PROMOTED':'STAGED'))throw new Error('Candidate traffic state is not qualified.');
  if((alias.deploymentId||alias.deployment?.id)!==(promoted?candidate.id:backup.previousDeploymentId))throw new Error(promoted?'Production domain does not identify the exact tested candidate.':'Production domain moved before candidate promotion. Stop and investigate.');
}
