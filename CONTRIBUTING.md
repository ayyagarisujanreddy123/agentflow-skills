# Contributing to AgentFlow

Thanks for your interest in improving AgentFlow. There are **two codebases** here, and how you contribute depends on which one you're touching:

- **Skills (primary)** — native Claude Code Skills under `skills/` and worker subagents under `agents/`. Plain markdown, no build, no API key.
- **Legacy MCP server** — the archived `agentflow-mcp` npm package under `legacy/mcp/`. TypeScript, still maintained for existing users.

Open a PR against `main` with a clear title (Conventional Commits-style preferred), tests for new behavior, and no unrelated changes.

---

## TL;DR

```bash
git clone https://github.com/ayyagarisujanreddy123/agentflow-skills.git
cd AgentFlow

# Skills work — no build needed:
node test/skills.mjs                  # 62 structure checks, no network

# Legacy MCP work — everything runs from legacy/mcp/:
cd legacy/mcp
npm install
npm run build
node test/unit.mjs                    # 28 unit tests
node test/smoke.mjs                   # 7 stdio MCP protocol smoke tests
```

---

## Repository layout

```
AgentFlow/
├── skills/                       # PRIMARY — one folder per skill
│   └── agentflow-<name>/SKILL.md # trigger description + methodology + worker to dispatch
├── agents/                       # the two worker subagents skills dispatch to
│   ├── agentflow-haiku-worker.md  # model: haiku  (read/search/summarize/transform/ask)
│   └── agentflow-sonnet-worker.md # model: sonnet (gen/review)
├── test/skills.mjs               # structure validation for skills + workers (no network)
└── legacy/mcp/                   # ARCHIVED MCP server (agentflow-mcp npm package)
    ├── bin/agentflow-mcp         # Node shim that boots dist/cli/index.js
    ├── src/                      # server.ts, client.ts, config.ts, ledger.ts, pricing.ts, tools/
    ├── cli/                      # init / uninstall / serve / stats / config
    ├── test/                     # unit.mjs + smoke.mjs (+ integration / comparison)
    └── ARCHIVED.md               # build/run/test instructions for the MCP server
```

---

## Contributing a skill

Skills are markdown — no build step.

1. Create `skills/agentflow-<name>/SKILL.md` with `name` + `description` frontmatter. The `description` is the trigger Claude Code matches on; make it specific and example-rich.
2. In the body, embed the methodology/output-format prompt and instruct the primary session to dispatch a worker: `agentflow-sonnet-worker` if correctness matters (real bugs, resolvable imports), otherwise `agentflow-haiku-worker`.
3. Only add a new worker in `agents/` if you need a different model pin — the two generic workers serve all current skills.
4. Run `node test/skills.mjs` (and extend its `EXPECTED_SKILLS` list).
5. If the skill mirrors a legacy MCP tool, keep its methodology prompt in sync with the matching `SYSTEM` constant in `legacy/mcp/src/tools/`.

The MCP-specific guidance below applies only to work inside `legacy/mcp/`.

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
