# Vacatina — Portfolio Scale, Security and Release

## B2C product expansion (after Flights baseline proves the method)
Flight, Hotel, Visa Assistance, Holiday Packages, Cars & Transfers, Rails, Cruises, Activities, Sightseeing Tours, Travel Insurance, plus Build Your Bundle as cross-product orchestration. Respect each product's custom search taxonomy, filtering, inventory states, price/quote model, source, inclusions, business logic and validation; do not build ten generic clones of a flight card.

For each vertical implement the full journey: Intent → Search → Compare → Evaluate Details/Policies → Configure → Trip Bucket → Review → Genuine Next Action → State Management. Only render booking/pay/confirmation workflows when the real platform supports them.

## B2B portal — separate authenticated operating UX
Travel agency/corporate account context, roles and permissions, quotations, negotiated inventory where verified, markup/margin, booking approvals, team travellers, booking ledger, invoices/credit and audit history. Never place a B2B switch in public UI and assume it provides security. Use the supplied role-based permissions references and enforce role checks server-side.

## Mobile app — adapt purposefully, not a tiny desktop copy
Share backend contracts and product meaning; redesign controls for touch, offline-aware states where meaningful, safe navigation, bottom sheets, accessible tap targets and state preservation. Mobile web responsiveness is a baseline, not proof of a complete native mobile app.

## Release discipline
- User's standing development site: https://vacatina-nu.vercel.app/
- Existing project and linked repo only. Avoid extra Vercel projects.
- Never modify the approved homepage beyond its locked acceptance baseline.
- Preserve production rollback; exact source commit and deployment mapping.
- Source code must be committed and pushed to appropriate branch; uncommitted-only prebuilt deploy is not acceptable as a finished delivery.
- Deploy verified work to the existing main domain under the owner's standing workflow, with operational truth intact.

## Proof matrix, not vague PASS badges
For each route report actual page/surface, material design change, click path, automated test ID, browser screenshot, accessibility state, backend gate and deployed commit. Separate: Implemented frontend / Visual verification / Real API integration / Customer-operational status.
