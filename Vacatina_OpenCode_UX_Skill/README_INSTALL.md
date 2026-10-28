# Vacatina — OpenCode Product Experience Skill

This pack adds a **project-scoped** OpenCode Skill. It is NOT a new web application, server, deployment, redesign, or an import of the Stitch HTML into production.

## Install (existing Vacatina repo)
Extract the contents of this ZIP into your existing Vacatina repository root:

`C:\Users\Madhusanka\.gemini\antigravity\scratch\vacatina\`

Expected paths:

`<repo-root>/.opencode/skills/vacatina-product-experience/SKILL.md`
`<repo-root>/.opencode/skills/vacatina-product-experience/references/*.md`

Do NOT extract into `reference/vacatina-flights/`; that's for Stitch design source files. Do NOT upload this ZIP to Vercel.

Open OpenCode in the repo root and invoke this skill explicitly:

`@vacatina-product-experience`

If using the V2 CLI command catalog, try `/vacatina-product-experience`; availability depends on user configuration and whether the skill is advertised.

The skill should be automatically discoverable from the project directory when OpenCode is started in the same project. Supporting files are loaded when the skill references them, not necessarily all at once. No MCP connection and no API key is needed for this Skill.

## First execution request

`@vacatina-product-experience Implement a material, premium visual UX upgrade of the existing Flights Hub, Results, Offer Details and complete connected customer journey. Inspect the actual local source and all 13 existing Stitch references, preserve the locked homepage, implement improvements instead of another report, use the existing route/services, add fresh browser E2E and before/after PNGs, commit source, and update only our existing vacatina-nu.vercel.app domain after regression tests. No new site and no fake inventory or bookings.`

## Reference precedence
1. Approved locked homepage actual implementation and acceptance criteria.
2. Current production canonical code/tokens and validated product contracts.
3. Existing project documentation and UX requirements, interpreted per product.
4. Stitch HTML/screenshots as non-final design inspiration.
5. External UX research patterns, never blindly cloned.

## Notes
- This is a reusable instruction pack, not an installed OpenCode plugin, new model, or automatic UX engine. A capable model, code access and browser/visual tooling still matter.
- Skill text is behavioral guidance, not an enforceable file-system or deployment permission boundary. Keep actual permissions and git protections configured independently.
- It does not itself make backend integrations operational.
- It should be reviewed and versioned along with the project; existing `.opencode` settings should be preserved.

Official guide: https://opencode.ai/v2/docs/skills
