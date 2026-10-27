# B2C release safety remediation

## Scope

This is a local audit and sanitization, not permission to push or deploy. No production environment, provider credential, migration, payment integration or deployment workflow is changed.

## Findings

- The original local `main` ref points to `3d6c16a095796236aa021ef89eb84ae003375b4e`, while its latest reflog entry records `693605818f0ed1f05245466533b3611b5cce2f30`. No reset back to Phase 8 is recorded. An out-of-band ref restoration is plausible, but the reflog does not establish the actor or mechanism.
- The original index exactly matches the final release tree. All Phase 9–14/final commits still exist and are reachable through their original annotated tags.
- A plausibly real Clerk test-environment secret was used as an environment-resolution fixture and equality expectation in `tests/unit.test.ts`. Treat it as compromised/publish-blocking; it was not used or validated against Clerk.
- Exact-value history inspection finds its earliest introduction at `6be8e1e15ff53196d8110dc6b0d5dab7e5d664f7`. The value is already present in `origin/main` at `05a4d9af2aa8d11334a9e69a2e298815f79df894`, so an unpublished-only rewrite cannot sanitize that existing remote ancestry.
- All original Phase 5–14/final tags, and the original stabilization tag, contain the value. Ignored local `.env` and `.env.local` files also contain it and are intentionally untouched.

No credential value, reversible encoding or credential fingerprint is included in this document.

## Source remediation

Only the two credential literals in the environment-resolution input and assertion are replaced by an explicitly non-secret unit-test fixture. Authentication logic, fail-closed checks, cryptographic verification and all assertions remain enabled.

## Independent sanitized export

The safe backup candidate is `release/b2c-product-journeys-v1`, with **independent ancestry**:

1. Preserve the original release under local-only `refs/safety/b2c-product-journeys-v1-unsanitized`. Never push this ref.
2. Create a sanitized root snapshot of the original unpublished Phase 4 stabilization commit, retaining its source tree except for the test fixture substitution.
3. Reconstruct only the unpublished Phase 5–14/final commits on that root, preserving their order, commit messages, authors and timestamps. The final snapshot also includes this audit document.
4. Retarget the unpublished annotated Phase 5–14/final tags to those sanitized copies, retaining their original annotations and recording the export provenance.
5. Do not alter `main`, `origin/main`, existing remote tags or the original stabilization tag. Old commit IDs in `B2C_PRODUCT_JOURNEYS_RELEASE.md` are historical identifiers, not a publish allowlist; use the sanitized checkpoint tags.

This is an isolated source-history export, **not** a force-push, a purge of the compromised remote history, or a branch for ordinary merging back into `main`.

## Publish allowlist and exclusions

Only the independently sanitized backup branch and its sanitized Phase 5–14/final tags are potential backup refs. Never use blanket `--all`, `--tags` or `--mirror` publication: `main`, the original stabilization/reference tags, safety refs, reflogs and old objects remain unsanitized local/recovery history.

`opencode.json` remains untracked. Actual dotenv files remain ignored and untracked; `.env.example` is a non-secret template. Nonessential screenshot artifacts are retained without being folded into this remediation.

## Deployment boundary

`.github/workflows/deploy.yml` runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. Its production Vercel commands additionally require `github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`. A backup-branch push does not match that workflow push filter. The workflow is not modified.

Independent Vercel Git preview/deployment integrations are not established by that YAML file. Confirm they cannot deploy the backup branch before any future backup-only push.

## Required follow-up

The owner must revoke/rotate the potentially compromised Clerk credential and coordinate handling of already-published history. Sanitizing a new backup cannot revoke a credential or erase existing remote exposure. No such production/account action is performed by this audit.

Before a future push, scan the exact allowlisted refs and all of their ancestors, verify the source/test/build/browser gates, confirm deployment exclusions, and obtain the required authorization. No remote write is performed here.
