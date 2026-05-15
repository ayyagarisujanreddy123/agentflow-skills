# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AgentFlow MCP — a Model Context Protocol server (stdio, Node/TypeScript) that gives Claude Code seven tools (`agentflow_read`, `agentflow_search`, `agentflow_gen`, `agentflow_review`, `agentflow_summarize`, `agentflow_transform`, `agentflow_ask`). Each tool routes to Haiku or Sonnet via the Anthropic SDK so the primary Claude Code model doesn't burn its own context on extraction/generation work. Cost-optimization is the whole point — changes that bloat the per-tool prompt or route an extraction tool through Opus are regressions.

## Build / dev

```bash
npm install
npm run build         # tsc → dist/
npm run dev           # tsc --watch
node dist/cli/index.js serve   # run server directly (same as `bin/agentflow-mcp serve`)
```

TypeScript is strict, ES2022 + Node16 modules. Sources live in `src/` and `cli/`; both compile into `dist/` preserving the folder layout (so the published `bin/agentflow-mcp` shim imports `../dist/cli/index.js`). **Always rebuild before running tests or the MCP server** — they execute compiled JS, not the `.ts` sources.

## Tests

```bash
node test/unit.mjs          # 28 tests, no network — ConfigManager, TokenLedger, pricing
node test/smoke.mjs         # 7 tests, MCP stdio handshake with fake API key, no real calls
node test/integration.mjs   # 4 tests, ~$0.005 of real Anthropic spend, needs ANTHROPIC_API_KEY
node test/comparison.mjs    # ~$0.10 benchmark vs Opus baseline, used to produce COMPARISON.md numbers
```

Tests load `.env` via `dotenv/config` (CLI entrypoint does this too). Each `test/*.mjs` is one suite — no per-test isolation; comment out the relevant `check()` calls to skip. Integration and comparison tests write real ledger lines to `~/.agentflow/logs/`.

## Architecture

The server is a single long-running stdio process spawned by Claude Code (`npx -y agentflow-mcp serve`). It is **not** an HTTP server.

Request flow (`src/server.ts`):
1. `ConfigManager` loads `~/.agentflow/config.yaml`, merges with `DEFAULT_CONFIG`, expands `${ENV}` references and `~` paths, and `fs.watch`es the file for hot-reload (no restart needed on config change).
2. `AnthropicClient` wraps the SDK; `setApiKey` is re-invoked by a config listener so rotating keys at runtime works.
3. `allTools` (in `src/tools/index.ts`) is the canonical tool registry. Every tool exports a `ToolDef { name, description, inputSchema, handler }`. The server registers them with the MCP SDK; adding a tool means exporting from `src/tools/<name>.ts` and appending to `allTools`.
4. Each handler builds a minimal, history-free prompt and calls `runCompletion` (in `src/tools/types.ts`), which resolves the model via `config.getModelForTool(name)` (per-tool override → `default_model`), invokes the client, and writes a `TokenLedger` entry.
5. `TokenLedger` appends one JSON line per call to `~/.agentflow/logs/YYYY-MM-DD.jsonl`, computing `saved_usd` against `comparison_model` (Sonnet by default). This file format is the contract the `stats` CLI reads — don't change the keys without updating `cli/stats.ts`.

**Model routing is policy, not incident.** `DEFAULT_CONFIG.tools` in `src/config.ts` deliberately routes `agentflow_gen` and `agentflow_review` to Sonnet (reasoning matters: imports, real bugs) and everything else to Haiku (extraction, condense, reformat). When adding a tool, decide which bucket it falls in and set the default accordingly — don't leave a reasoning-heavy tool on the Haiku default.

**Context discipline.** Tool handlers must construct the prompt purely from their inputs. There is no conversation memory, no chat history, no cross-tool state. That's the whole value prop — the primary context never enters these calls. If you find yourself wanting to thread state, you're solving the wrong problem.

## CLI surface (`cli/`)

`cli/index.ts` is the commander entrypoint. The MCP runtime is just one subcommand (`serve`) — the others (`init`, `uninstall`, `stats`, `config`) are user-facing setup/diagnostics. `cli/init.ts` mutates `~/.claude.json` to add `mcpServers.agentflow` and writes `~/.agentflow/config.yaml`; treat that file as user state and always offer `--dry-run` parity for new behaviors.

`init --from-source` points `mcpServers.agentflow` at the local `dist/cli/index.js` instead of `npx -y agentflow-mcp` — used when iterating against an unpublished build. `bin/agentflow-mcp` is a 2-line ESM stub (`import("../dist/cli/index.js")`); never put logic there.

## Conventions

- ESM only (`"type": "module"`); imports inside `src/` and `cli/` must use `.js` extensions (Node16 resolution), even though the sources are `.ts`.
- `.env` is gitignored; `.env.example` is the template. Never commit a real key.
- Pricing lives in `src/pricing.ts` and is overridable via `pricing:` in `config.yaml`. When Anthropic changes rates, update both.
- Model IDs are pinned strings (e.g. `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`). Don't hardcode them in tool handlers — read from config.
- `INTERNAL.md` is gitignored — engineering scratch, never shipped or referenced from user docs.
- `assets/` (`logo.png`, `benchmark.svg`) is repo-only for README rendering; not in the npm package (`files:` allowlist is `dist/` + `bin/`).
