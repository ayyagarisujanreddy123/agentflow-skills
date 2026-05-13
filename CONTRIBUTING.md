# Contributing to AgentFlow MCP

Thanks for your interest in improving AgentFlow MCP. This document explains how to set up a dev environment, the layout of the code, what to test, and how to send a PR that's likely to merge fast.

---

## TL;DR

```bash
git clone https://github.com/ayyagarisujanreddy123/AgentFlow.git
cd AgentFlow
npm install
npm run build
node test/unit.mjs        # 24 unit tests
node test/smoke.mjs       # 7 stdio MCP protocol smoke tests
```

Open a PR against `main` with a clear title (Conventional Commits-style preferred), tests for new behavior, and no unrelated changes.

---

## Project layout

```
AgentFlow/
├── bin/agentflow-mcp        # Node shim that boots dist/cli/index.js
├── src/
│   ├── server.ts            # stdio MCP transport + tool dispatch
│   ├── client.ts            # Anthropic SDK wrapper + retries
│   ├── config.ts            # ~/.agentflow/config.yaml loader (hot-reload)
│   ├── ledger.ts            # JSONL token/cost ledger
│   ├── pricing.ts           # Per-model $/M-token rates
│   └── tools/               # 7 MCP tools — one file each
│       ├── read.ts
│       ├── search.ts
│       ├── gen.ts
│       ├── review.ts
│       ├── summarize.ts
│       ├── transform.ts
│       └── ask.ts
├── cli/                     # `agentflow-mcp <subcommand>` implementations
│   ├── index.ts             # commander entry
│   ├── init.ts              # writes Claude Code MCP entry + config
│   ├── uninstall.ts
│   ├── serve.ts             # boots src/server.ts
│   ├── stats.ts             # reads ledger, prints summary
│   └── config.ts            # print / open in $EDITOR
├── test/
│   ├── unit.mjs             # config + ledger + pricing
│   └── smoke.mjs            # spawns server, speaks MCP over stdio
└── dist/                    # built JS (npm publish artifact)
```

---

## Dev setup

### Prerequisites

- Node.js >= 18
- An Anthropic API key for live integration testing (set `ANTHROPIC_API_KEY` in `.env` or your shell)

### Build / watch

```bash
npm run build       # tsc once
npm run dev         # tsc --watch
```

### Run the server locally

```bash
node dist/cli/index.js serve   # speaks MCP on stdio
```

To wire it into Claude Code without publishing, run `npm link` then `agentflow-mcp init`. Claude Code will spawn your local build on every session.

---

## Testing

### Unit tests (`test/unit.mjs`)

Cover `config.ts` (yaml load, env-var fallback, per-tool overrides), `ledger.ts` (append + summarize), and `pricing.ts` (model rate table). No network. Must stay fast and deterministic.

### Smoke tests (`test/smoke.mjs`)

Spawn the built server as a subprocess and speak the MCP wire protocol over stdio: `initialize`, `tools/list`, and a few `tools/call` paths that should return errors *without* hitting the Anthropic API (missing inputs, missing files, unknown tools). No API key required.

### Live integration tests

Anything that actually calls Haiku/Sonnet costs real money and must be opt-in. Gate behind `ANTHROPIC_API_KEY` presence and document the per-run cost in the test header.

### Required for every PR

```bash
npm run build && node test/unit.mjs && node test/smoke.mjs
```

If you change a tool's behavior, add a smoke test. If you change config/ledger/pricing, add a unit test.

---

## Code style

- TypeScript strict mode is on — keep it green (`tsc` must pass with no errors).
- ESM only (`"type": "module"` in `package.json`). Use `.js` extensions on relative imports inside `src/`.
- No new runtime dependencies without discussion in an issue first. The hot path is small on purpose.
- Errors that the user can fix should be explicit messages (e.g. `Missing required input: file_path`), not stack traces.

---

## Adding a new tool

1. Create `src/tools/<name>.ts` exporting `{ name, description, inputSchema, handler }`.
2. Register it in `src/tools/index.ts`.
3. Pick a default model in `src/config.ts` `DEFAULT_CONFIG` (Haiku unless the task needs Sonnet).
4. Add a smoke test that exercises at least one validation error path.
5. Document the tool in the README "Tools" table with one-line "what it does" + "when the agent uses it".

Keep tool prompts strict and format-rigid — these are tools, not chat. The agent expects a predictable response shape.

---

## Commit / PR conventions

- One logical change per PR. Refactors and feature work go in separate PRs.
- Conventional Commits style for commit messages: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- PR description should answer: what changed, why, and how it was tested.
- Don't bump `version` in `package.json` — maintainers do that at release time (see "Deploy / Publish" in README).
- Don't commit secrets, `.env`, `node_modules`, or `dist/` (already in `.gitignore`).

---

## Reporting bugs

Open an issue with:
- AgentFlow MCP version (`agentflow-mcp --version`)
- Node version (`node -v`) and OS
- Minimum repro: command run, expected vs actual, full error
- Relevant lines from `~/.agentflow/logs/YYYY-MM-DD.jsonl` (redact the API key — there shouldn't be one in the ledger, but check)

---

## Security

If you find a security issue (key leakage, prompt-injection escape, sandbox escape), do **not** open a public issue. Email the maintainer or open a private security advisory on GitHub.

---

## License

By contributing you agree your contributions are licensed under the same MIT license as the project.
