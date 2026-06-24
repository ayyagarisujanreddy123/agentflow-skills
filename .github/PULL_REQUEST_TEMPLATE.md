## What

<!-- One sentence: what does this PR change? -->

## Why

<!-- Link the issue, or describe the motivation. -->

Closes #

## How it was tested

- [ ] `npm run build` passes
- [ ] `node test/unit.mjs` passes (28/28)
- [ ] `node test/smoke.mjs` passes (7/7)
- [ ] `node test/integration.mjs` passes (4/4) — only if changing tool handlers, costs ~$0.005
- [ ] Manually tested via Claude Code `/mcp` against this branch (`init --from-source`)

## Cost-routing review (for tool changes)

<!--
If you added/modified a tool, confirm it routes to the right model:
- Extraction / condense / reformat → Haiku
- Reasoning / generation / correctness-critical → Sonnet
Don't leave a reasoning-heavy tool on the Haiku default.
-->

- Default model: <!-- haiku / sonnet -->
- Justification:

## Merge gate

- [ ] CI checks green (skills + legacy MCP across Node 18/20/22)
- [ ] `Claude review` ran — CRITICAL/HIGH findings addressed or justified in a reply
- [ ] Ready for the 1 required maintainer approval

## Docs

- [ ] README updated (if user-visible behavior changed)
- [ ] CHANGELOG.md entry under `[Unreleased]`
- [ ] CLAUDE.md updated (if architecture / conventions changed)
