# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AgentFlow gives Claude Code seven capabilities — read, search, gen, review, summarize, transform, ask — that push self-contained grunt work into **disposable, model-pinned subagents** so the primary session's context stays clean.

The repo holds **two implementations of the same idea**:

1. **Skills (primary, current).** Native Claude Code Skills under `skills/` plus two worker subagents under `agents/`. Runs inside the user's existing Claude Code session — no API key, no billing, no server process. Install = copy the folders into `~/.claude/` (or a project's `.claude/`).
2. **MCP server (legacy, archived).** The original `agentflow-mcp` npm package under `legacy/mcp/`. An stdio MCP server that routed tool calls to the Anthropic API (Haiku/Sonnet). Still works, still published, but no longer the default — it required every user to bring their own API key, which blocked adoption.

The pivot from (2) to (1) is why the layout looks the way it does. **When working in this repo, default to the Skills implementation** unless the task explicitly concerns the legacy MCP server.

## Skills implementation (primary)

```
skills/
  agentflow-<name>/SKILL.md   ← trigger description + methodology prompt + which worker to dispatch
agents/
  agentflow-haiku-worker.md    ← model: haiku  (read, search, summarize, transform, ask)
  agentflow-sonnet-worker.md   ← model: sonnet (gen, review)
```

**The dispatch model is the whole design.** A `SKILL.md` does three things: declares a trigger (`description` frontmatter — this is what makes Claude Code fire it), carries the methodology prompt (the strict output rules), and tells the primary session to dispatch the right worker subagent with that prompt. The worker runs in its own context window, applies the methodology, and returns **only** the result. That isolated context window is what replaces the MCP server's separate API call — same context-isolation benefit, no key.

**Methodology lives in the skill, not the worker.** The two worker agents are deliberately generic (a Haiku extraction worker, a Sonnet reasoning worker). The tool-specific prompts — the 4-line `SEVERITY/LINE/ISSUE/FIX` review format, the six "import-don't-redefine" gen rules, the summarize format-discipline rules — live in each `SKILL.md` and are passed in the dispatch prompt. This is why two workers serve all seven skills. When adding a skill, put its methodology in the `SKILL.md`; only add a new worker if you need a different model pin.

**Model routing is policy.** `gen` and `review` dispatch the **Sonnet** worker (correctness matters: real bugs, imports that resolve). Everything else dispatches the **Haiku** worker (extraction, condense, reformat). When adding a skill, decide which worker it uses and wire it accordingly — don't route reasoning-heavy work to the Haiku worker. These methodology prompts are carried verbatim from the legacy MCP `SYSTEM` constants; keep them in sync if you change one and the legacy tool still ships.

**Honest scope.** `read` and `search` overlap with native `Read` / `Explore` (which already isolates search in a subagent). Their only edge is the Haiku pin and a structured output format — they're the weakest of the seven. `review` and `gen` are the strongest; their value was always the methodology, not the transport.

### Skills tests

```bash
node test/skills.mjs    # 62 checks, no network — frontmatter, worker wiring, model pins
```

No build step — skills and agents are plain markdown. The test validates structure, not behavior (subagent dispatch can't be unit-tested without a live session).

## Legacy MCP server (`legacy/mcp/`)

Preserved unchanged. All build/dev/test commands run **from `legacy/mcp/`**, not the repo root. See `legacy/mcp/ARCHIVED.md` for the full rundown.

```bash
cd legacy/mcp
npm install
npm run build              # tsc -> dist/
node dist/cli/index.js serve
node test/unit.mjs         # 28 tests, no network
node test/smoke.mjs        # 7 tests, MCP stdio handshake, no real calls
node test/integration.mjs  # 4 tests, ~$0.005 real spend, needs ANTHROPIC_API_KEY
node test/comparison.mjs   # ~$0.10 benchmark vs Opus baseline
```

The legacy architecture (ConfigManager hot-reload, AnthropicClient, `allTools` registry, `runCompletion`, TokenLedger writing `~/.agentflow/logs/`, per-tool model routing in `DEFAULT_CONFIG.tools`) is documented in `legacy/mcp/ARCHIVED.md` and the source. **Context discipline still applies there:** tool handlers build a history-free prompt from inputs only — no conversation memory, no cross-tool state.

## Conventions

- Skills/agents are markdown with YAML frontmatter; no build, no extension rules.
- Legacy MCP is ESM-only TypeScript (`"type": "module"`, Node16 resolution, `.js` import extensions). Strict, ES2022. Don't hardcode model IDs in handlers — read from config.
- `.env` / `.env.example` and pricing live under `legacy/mcp/`. Never commit a real key.
- `INTERNAL.md` is gitignored — engineering scratch, never shipped or referenced from user docs.
- `assets/` (`logo.png`, `benchmark.svg`) is repo-only for README rendering.
- When you change a methodology prompt in a `SKILL.md`, check whether the matching legacy MCP `SYSTEM` constant in `legacy/mcp/src/tools/` should change too — they were intentionally identical at the pivot.
