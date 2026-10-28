# Phase 18 — gated Vercel automatic deployment

## Outcome

**PARTIAL implementation; remote activation BLOCKED.** The release-only workflow and fail-closed verification scripts are committed locally. No branch was pushed, no candidate/project was created, no domain was moved, no rollback was attempted and no remote workflow or setting was changed.

Target: the existing `vacatina` project and `https://vacatina-nu.vercel.app/` only. The local link names project `prj_EqFcUJ21EAwVswuSg6sE83cm4L05` and team `team_xj1N5ykrhBZsd1EAbEFvZU2v`; these IDs are enforced expectations, **not authenticated ownership evidence**.

## Release design

`.github/workflows/release-demo.yml` listens only for the sanitized `release/b2c-product-journeys-v1` branch. Both jobs independently restrict the branch. Actions are commit-pinned; checkout disables persisted credentials; the workflow has read-only repository permissions except the candidate job's Actions-write permission to suspend the workflow after a failed promotion. Concurrency is serialized and does not cancel an in-progress release. The old main-only workflow and legacy production deployment script are untouched and must not be invoked for this work.

1. Verify the exact pushed SHA: clean dependency install, typecheck, full units, ordinary build, import boundary, static migrations, baseline browser journey, request/operator browser journey, reachable-HEAD history scan, public-demo build and output scan.
2. Stop unless repository variable `VACATINA_DEMO_RELEASE_ENABLED` is exactly `true` and the protected `vacatina-demo-release` environment permits the job.
3. Run read-only `demo-release-preflight.mjs`. Verify existing project/team/name, Node 22.x settings, Git repository/branch/hooks, active production deployment and domain, account plan, complete production environment metadata, recent plan-matched rollback evidence, and owner-attested native-Git isolation. Request environment metadata with `decrypt=false`; never print its values.
4. Write only the already-verified project IDs to the local CLI link. Do not call `vercel link`, import a repository or create a project. Build the closed public-demo output locally without pulling Production secrets.
5. Check that the remote release-branch head still equals the tested SHA. Use pinned `vercel@65.5.0 deploy --prebuilt --prod --skip-domain`: a **Production-targeted staged candidate**, not a Preview to be rebuilt during promotion.
6. Verify the candidate's exact project, owner, `production` target, READY/STAGED state and commit/branch metadata, and that the existing public alias still points to the original production deployment. Run candidate HTTP and browser acceptance, preserving separate candidate evidence.
7. Recheck branch head, candidate and unchanged original alias immediately before promotion. Promote only the tested artifact. Verify account-side PROMOTED state and the exact public-domain deployment ID; rerun public HTTP/browser acceptance with the expected commit marker.
8. After an attempted promotion fails, is cancelled or fails public smoke, attempt the account-supported rollback to the saved original deployment URL, verify the exact original deployment ID and public HTTP service, and separately disable this workflow. Retain candidate/original identities and reports as Actions artifacts. Cancellation/token expiry can still prevent automated recovery: owner intervention and independent alias verification are required, not an assumption of success.

The CLI invocation does not merge or push `main`, force-push, publish tags, push every ref, run `deploy.bat` or run `scripts/cd-workflow.mjs`.

## Required owner setup — not performed

| Requirement | Current status |
|---|---|
| Authenticated GitHub access and verified repository push permission | BLOCKED: `gh auth status` reports not logged in; token availability false |
| Authenticated Vercel account with the existing project/team/domain | BLOCKED: no detected token/auth file; dashboard access previously required login |
| Current production deployment and exact restorable original | UNKNOWN until authenticated read-only preflight |
| Actual account plan and supported rollback path | UNKNOWN; no rehearsal performed |
| Production environment isolation | UNKNOWN; no values fetched, copied, changed or disclosed |
| Actual project Node runtime | UNKNOWN; local link says 24.x while package/workflow use 22.x; owner must resolve the mismatch |
| Competing native Git deployments, production branch and deploy hooks | UNKNOWN; committed `vercel.json` disables this release branch only, but account-side settings and the pre-push risk still require verification |
| Fresh isolated hosted identity / durable request database | UNAVAILABLE; public output therefore remains permanently closed to those capabilities |
| Protected GitHub environment and required reviewers | NOT CONFIGURED remotely |
| Remote release workflow success, first candidate and promotion | NOT RUN |

The owner must configure the following only after verifying those prerequisites:

- Environment secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` for the verified existing target. Never paste tokens into this repository, report or chat.
- Repository enable variable: `VACATINA_DEMO_RELEASE_ENABLED=true`, **last**, after first-release qualification and native-Git isolation.
- Protected environment variables: `VACATINA_NATIVE_GIT_ISOLATED=true`, `VACATINA_ROLLBACK_VERIFIED=true`, `VACATINA_ROLLBACK_PLAN` matching the API-reported plan, `VACATINA_ROLLBACK_VERIFIED_AT` (not future or older than 30 days), and `VACATINA_ROLLBACK_EVIDENCE` referencing owner-reviewed rehearsal evidence.
- Environment branch restrictions permitting only the release branch, required reviewers where supported, and confirmation that Actions can disable the workflow on a failure. Do not create an unrelated project or enable blanket native-Git production deployment.

GitHub may require the workflow to exist on the default branch for manual `workflow_dispatch`. That is **not authorization to merge/push main**. The release-branch push trigger is the intended gated path; any repository-specific manual-dispatch limitation must be resolved by the owner separately.

## First-release and rollback stop conditions

Do not push even the sanitized branch until authenticated target/native-Git/rollback/environment prerequisites pass: a Git push can itself trigger an account-side deployment outside this workflow. Before any authorized push, rescan the **committed release ancestry** and publish only this explicit branch ref, without tags or safety refs.

Before candidate creation, record the existing alias deployment ID/URL and prove the actual plan's supported restoration path. Vercel's official CLI documentation says Hobby can roll back only to the immediately previous production deployment. Do not assume that an arbitrary older artifact, a Preview promotion or a generic `rollback` command is valid for the account. The preflight records the exact active production target; owner rehearsal/evidence must establish how staged `--skip-domain` releases interact with that account's rollback semantics. If that proof is unavailable, **stop before candidate creation**.

Do not disable deployment protection merely to make smoke tests pass. If a staged Production URL is inaccessible to the acceptance runner, stop before promotion and obtain an owner-approved account-specific test access method. A 401, HTML API fallback, wrong commit, unknown target, missing environment metadata, hidden production configuration, unsupported runtime, or changed alias must fail closed.

If recovery cannot be verified, suspend further releases, have the owner independently inspect the alias and restore the recorded original using the verified account-supported procedure. Unset the enable variable as well as disabling the workflow before investigating. Do not retry a failed promotion as if the previous outcome were known.

## Local evidence and limitations

[Acceptance results](PHASE18_HOSTED_DEMO_ACCEPTANCE.md) cover local normal/public builds, unit/browser tests, HTTP emulation, static SQL checks, output/history pattern scans and [workflow YAML safety checks](phase18-evidence/workflow-static.log). Pure offline guard tests reject wrong project, plan, branch, commit, environment scope and alias. Running `demo-release-preflight.mjs` locally without prerequisites correctly stopped before any authenticated API call or mutation; [blocked output](phase18-evidence/deployment-preflight-blocked.log) is retained.

The workflow has **not** been run on GitHub/Linux or exercised against Vercel. No claim is made that account-specific staging, promotion, protection, environment inheritance, Git hook isolation, Actions environment permissions, cancellation recovery or rollback has been qualified.

## Official references reviewed

- [Production deployment and `--skip-domain`](https://vercel.com/docs/cli/deploy)
- [Promotion semantics](https://vercel.com/docs/cli/promote)
- [Rollback CLI and Hobby limitation](https://vercel.com/docs/cli/rollback)
- [Branch-specific Git configuration](https://vercel.com/docs/project-configuration/git-configuration)
- [Team plan metadata](https://vercel.com/docs/rest-api/teams/get-a-team)
- [Deployment identity/state metadata](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url)
- [Current REST OpenAPI schema](https://vercel.com/openapi.json)

Documentation establishes supported interfaces, not access to or successful verification of this particular account.
