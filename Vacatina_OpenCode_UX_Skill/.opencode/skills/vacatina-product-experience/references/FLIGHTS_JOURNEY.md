# Flights — Complete Connected Journey

## Existing routes and responsibilities to inspect before coding
- `/flights` — dedicated flight hub, one-way/return/multi-city entry, airport selectors, traveller validation.
- `/flights/search` — editable query, supplier-aware search state, results, sort/filter/date refinements.
- `/flights/offer/:offerId` — selected segments, fare families, inclusions/exclusions, detailed rules and configuration.
- `/flights/passengers` — passenger identity, contact and document collection only through a secure verified submission path; display capability-gated form safely otherwise.
- `/flights/review` — flight-specific review/readiness, NOT a competing second source of truth for the Trip Bucket.
- `/flights/checkout` — backend-gated checkout UI; no unsupported payment options or success.
- `/flights/confirmation` — valid server-backed confirmation only; do not invent booking reference or ticket.
- `/flights/manage` — authenticated durable booking management once backend truly supports it.
- `/trip/review` — cross-product Trip Bucket review; preserve single canonical selection and item state contracts.

These routes were reported in earlier OpenCode work but **must be inspected in exact active source and browser**. Some prior changes were reportedly deployed from uncommitted local code and absent from GitHub. Never assume they exist, are secure, or connect correctly.

## Screens, meaningful behavior, and design differentiation
| Experience | Distinctive UX expectation | Truth & integration gate |
|---|---|---|
| Hub & search | Powerful but calm multi-city editing, airport autocomplete, visible passenger composition | No search result without source/availability status |
| Results | Fast comparison of route/time/stops/price; precise filters; useful zero-results recovery | Inventory shown with actual data provenance |
| Offer & fares | Passenger-relevant fare family compare; segment timeline; readable conditions | No unsupported live holds or fare promises |
| Seat & extras | Accurate interactive selection only where provider supports; running verified total | Hide/disable with useful explanation otherwise |
| Passenger details | Progressive fields per passenger, correct age logic, relevant nationality/document rules | No sensitive data in URL or browser storage; server validation needed |
| Review & Trip Bucket | Edit source context, changed-price/recheck handling, single source of truth | Clear gated next action |
| Checkout | Payment-ready UI only if authorized provider and server exists | No fake completion or sensitive payment capture |
| Confirmation | Real confirmation page with verified supplier order | Never generate fake PNR/ticket |
| Manage booking | Real status, conditions, policy options, useful contact/help pathways | No fabricated retrieval/status |

## Build path
From locked homepage SCC: Flights → Hub/search → Results → Offer → Fare/extras → Trip Bucket and/or Passenger step → Review → supported checkout OR working request-to-book → real status/confirmation where eligible.

Test one-way, return, multi-city and mobile end-to-end from normal clicks. Test refresh and browser history, search data retention, price revalidation and errors. Don't count a disconnected route or an inline card as a 'completed page' without stating its real status.

## Source inspiration
Inspect the 13 existing Stitch flight references and their actual HTML/PNG side by side. Capture which patterns are accepted, adapted or rejected and why. They are not final approved frontend code. Benchmark credible flight and travel platforms by patterns if current research is possible (not a copyright clone). Use existing domain interfaces and existing design tokens.
