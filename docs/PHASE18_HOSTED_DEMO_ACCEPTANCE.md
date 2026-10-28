# Phase 18 — hosted-demo acceptance

## Outcome

**PARTIAL: local verification passed; live hosted acceptance is BLOCKED.** Nothing was pushed, deployed, promoted, migrated or commercially activated. `https://vacatina-nu.vercel.app/` has not been upgraded by this work.

The output is intentionally a **browser-only DEMO / TEST**, not a hosted customer request backend. Its visible notice says there are no live bookings, payments, visa filings or durably submitted customer requests, and asks users not to enter personal information.

## Fresh verification

The counts below are the final fresh results produced on the sanitized `release/b2c-product-journeys-v1` branch at local checkpoint `0592cee`. Nothing in this table was inherited from a previous phase, and no hosted step was executed.

| Gate | Result | Evidence / scope |
|---|---|---|
| Typecheck | PASS | [Log](phase18-evidence/typecheck.log) |
| Complete unit suite | PASS 350/350 | [Node 22.23.4 raw log](phase18-evidence/unit-full-node22.log); injected HTTP only for provider/order tests |
| Baseline browser regression | PASS 94/94 | [Report](phase18-evidence/browser-baseline.json); 11 viewport widths |
| Dedicated request/operator browser journey | PASS 19/19 | [Report](phase18-evidence/request-operations-browser.json); generated server-only fixture identities, local file storage |
| Public-demo HTTP | PASS locally (26/26) | [Report](phase18-evidence/public-http.json); built-output emulation, not Vercel |
| Public-demo browser | PASS locally (103/103) | [Report](phase18-evidence/public-browser.json); 1440/768/360; direct reloads, gated account/operations routes, SCC, ten product journeys, disabled identity/newsletter/submission |
| Browser/server import boundary | PASS | [Log](phase18-evidence/browser-boundary.log); negative server-import probe blocked |
| Migration static checks | PASS, parse-only | [Log](phase18-evidence/migrations-static.log); no database or migration execution |
| Published-output credential-pattern and configuration scan | PASS locally | [Log](phase18-evidence/published-scan.log); narrow pattern scan, not a guarantee that every secret format is detectable |
| Reachable release history/private-file scan | PASS for scanned local HEAD | [Log](phase18-evidence/reachable-history-scan.log); no other refs/tags/safety ancestry published |
| Workflow YAML and local safety checks | PASS statically | [Log](phase18-evidence/workflow-static.log); no remote Actions run |
| Actual Vercel candidate, domain promotion and rollback | BLOCKED / NOT RUN | Account authorization, target/environment verification and account-supported rollback rehearsal are unavailable |

Node `22.23.4` was selected explicitly for runtime/unit/browser verification, in addition to earlier local Node 24 runs. The workflow uses Node 22.x. Local `.vercel/project.json` had advertised Node 24.x; the owner's actual project settings have not been verified or changed. The preflight now blocks a project-runtime mismatch.

## What public hosting exposes

| Capability | Hosted disposition |
|---|---|
| Existing Home, product discovery, search examples, configuration, local Trip Bucket/review and Build Your Bundle | Browser-only demonstration; no backend authority inferred |
| `/requests` and enquiry submission | Explicitly unavailable; no false receipt or persistence-success message |
| Sign-in / sign-up / legacy auth fallback | Disabled; historical Clerk SDK/preloader and instance configuration excluded from public output |
| Newsletter email capture | Disabled at the actual click/Enter handler, before storage or telemetry |
| Checkout and payment capabilities | Disabled; no gateways, bookings or payment orders |
| Admin operations | Disabled; no inventory mutation, legacy financial/triage exposure or hosted operator authentication. `/admin`, `/admin/listings`, `/account/*`, `/auth/*`, `/manage-booking` and `/partner` deep reloads are intercepted by an explicit account/operations gate instead of rendering legacy workspaces; the travel-credit modal closes without opening |
| Duffel test orders | Disabled on every hosted API method |
| Documents / passport / contact submissions | Not available; no real uploads or PII collection activated |
| Notifications | No external dispatch |

The only hosted function is the closed API handler. Four GET capability/session/health/checkout-capability projections return safe JSON; every other API path/method returns `503 HOSTED_BACKEND_NOT_QUALIFIED` as problem JSON. The handler has no service/storage/client imports. Static SPA fallback is ordered after the API route so an API request cannot masquerade as an HTML success.

Fixed-name bundle/CSS URLs revalidate rather than carrying a year-long immutable cache. Deep links use `<base href="/">`. The output has noindex and security headers, including same-origin connection/form policy. This is not a claim of a complete security certification or audited WCAG compliance.

## Visual review

New evidence is separate from protected historical screenshots. [Visual index](phase18-evidence/visual-index.json) records dimensions and SHA-256 hashes; generation alone is not approval.

- [Contact sheet 1](phase18-evidence/contact-sheet-01.png)
- [Contact sheet 2](phase18-evidence/contact-sheet-02.png)
- [Contact sheet 3](phase18-evidence/contact-sheet-03.png)
- [360px customer receipt](phase18-evidence/request-round-trip-360.png)
- [360px operator detail](phase18-evidence/operator-detail-360.png)
- [360px public flight detail](phase18-evidence/public-flight-detail-360.png)

The captured set was inspected through contact sheets and selected full-size mobile/customer/operator images. Tested viewports fit horizontally and the local request/quotation/withdrawal controls are usable. The long raw configuration dossier in the operator detail is still utilitarian; the screenshot review is **not** comprehensive human UAT, every scroll position, every focus state, or an accessibility certification. Desktop/tablet/mobile screenshots show no Home redesign; the public notice and disabled collection controls are deliberate safety additions.

## Preservation and limitations

[Integrity evidence](phase18-evidence/integrity.json) checks the four protected historical image hashes, unchanged `DESIGN.md`, unchanged `main`/`origin/main`, and untouched/untracked `opencode.json`. Historical Phase 17 reports and screenshot baselines were not rewritten. New baseline captures go to ignored `tmp/phase18-e2e/screenshots`, while new Phase 18 request/public captures live here. Raw shell logs are transcoded from the Windows shell's UTF-16 output to UTF-8 for the repository; content is preserved, including the retained failure evidence.

The request browser harness proves composition reconstruction from local durable data, **not a real hosted process restart**. Fixtures cover all ten product configurations and two synthetic options per product, but expanded default catalogs and independent failure permutations remain partial. The [integration report](PHASE18_REQUEST_OPERATIONS_INTEGRATION.md) records the remaining adapter-projection review and Duffel upstream reconciliation limit.

Raw failure evidence is retained rather than hidden: a parallel run hit Windows `EPERM` in the old file adapter; bounded retries were added and the full suite rerun. Notification messages always distinguish queued records from sent messages.

## Hosted acceptance blocker

GitHub reports no authenticated account; GitHub/Vercel token availability checks were false, and no Vercel CLI auth file was found. A local project link is not proof of ownership or rollback entitlement. There is no fresh isolated hosted identity or approved isolated database.

Until the owner completes [the deployment prerequisites](PHASE18_VERCEL_AUTO_DEPLOYMENT.md), all actual hosted execution, first promotion, automatic deployment enablement, rollback rehearsal and post-release public acceptance remain **BLOCKED**, not passed.
