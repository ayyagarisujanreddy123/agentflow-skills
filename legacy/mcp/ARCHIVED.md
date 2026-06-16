# AgentFlow MCP (archived)

This is the original AgentFlow **MCP server** — the `agentflow-mcp` npm package.
It is preserved here, unchanged and still installable, but is no longer the
primary distribution. AgentFlow's main path is now native **Claude Code Skills**
(see the repo root `README.md`).

## Why it was archived

The MCP server required each user to bring their own Anthropic API key and set up
separate billing. That setup friction was the main blocker to adoption. The Skills
version runs inside the user's existing Claude Code session — no key, no billing,
no separate process — while preserving the same context-isolation benefit by
dispatching model-pinned subagents.

## What lives here

The complete, working MCP server: seven tools (`agentflow_read`, `agentflow_search`,
`agentflow_gen`, `agentflow_review`, `agentflow_summarize`, `agentflow_transform`,
`agentflow_ask`), the CLI (`serve`, `init`, `uninstall`, `stats`, `config`), the
TokenLedger / pricing / config stack, and all four test suites.

## Running the archived MCP server

All commands run from **this** directory (`legacy/mcp/`):

```bash
cd legacy/mcp
npm install
npm run build                 # tsc -> dist/
node dist/cli/index.js serve   # or: bin/agentflow-mcp serve
```

Tests (unchanged):

```bash
node test/unit.mjs          # 28 tests, no network
node test/smoke.mjs         # 7 tests, MCP stdio handshake, no real calls
node test/integration.mjs   # 4 tests, ~$0.005 real spend, needs ANTHROPIC_API_KEY
node test/comparison.mjs    # ~$0.10 benchmark vs Opus baseline
```

The published `agentflow-mcp` npm package continues to work and is documented in
the root README under "Legacy: MCP server".
