# Testing AgentFlow MCP

Three test layers, ordered cheapest → most realistic.

## Prerequisites

```bash
npm install
npm run build
```

Optional, for live + Claude Code testing:

```bash
# .env at repo root
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

---

## 1. Unit tests — pure logic, no network

Tests `ConfigManager`, `TokenLedger`, pricing math. No API calls.

```bash
node test/unit.mjs
```

Expected: `24/24 passed`.

---

## 2. Smoke test — MCP protocol over stdio, fake API key

Spawns the server, exchanges JSON-RPC frames, verifies tool registration and error paths. Uses `ANTHROPIC_API_KEY=test-key-fake` — no real network calls.

```bash
node test/smoke.mjs
```

Expected: `7/7 passed`. Verifies:

- `initialize` handshake returns `serverInfo.name = "agentflow"`
- `tools/list` returns the 7 expected tools
- Missing-input errors surface correctly (`isError: true`)
- Unknown tool returns error
- File-not-found returns error

---

## 3. Integration test — real Anthropic API

**Costs ~$0.005 per run** (3 live Haiku calls). Requires real `ANTHROPIC_API_KEY` in `.env` or environment.

```bash
node test/integration.mjs
```

Expected: `4/4 passed` and a ledger summary at the end:

```
Recent ledger entries:
  agentflow_ask        in=28   out=5   cost=$0.00004
  agentflow_summarize  in=294  out=243 cost=$0.00121
  agentflow_read       in=3491 out=137 cost=$0.00334
```

Verifies:

- `agentflow_ask` returns the expected token (`pong`)
- `agentflow_summarize` produces non-empty output for repeated input
- `agentflow_read` reads `README.md` and answers a query about it
- Ledger entries written to `~/.agentflow/logs/YYYY-MM-DD.jsonl`

---

## 4. Manual MCP probe — no Claude Code needed

Exercise the server by piping JSON-RPC frames directly:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| node bin/agentflow-mcp serve
```

Returns three lines: init result, then tools list with 7 entries.

Trigger one tool live:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"agentflow_ask","arguments":{"prompt":"say hello in 3 words"}}}' \
| node bin/agentflow-mcp serve
```

---

## 5. Live test inside Claude Code

End-to-end: real Claude Code session calls the tools.

### One-time setup

```bash
# Make `npx agentflow-mcp` resolve to local checkout (no npm publish needed)
npm link

# Backup before init mutates ~/.claude.json
cp ~/.claude.json ~/.claude.json.bak.$(date +%s)

# Adds mcpServers.agentflow entry, writes ~/.agentflow/config.yaml
agentflow-mcp init
chmod 600 ~/.agentflow/config.yaml
```

### Restart Claude Code

Full quit (Cmd+Q on Mac), then reopen. MCP servers load at startup — a new session in the same app instance is not enough.

### Verify tools registered

In a new session, ask:

> list your available tools

You should see seven `agentflow_*` entries among the tools.

### Trigger a real call

> use agentflow_ask to count to 5

or:

> use agentflow_read on `src/server.ts` and tell me what `setApiKey` does

### Watch the ledger live

```bash
tail -f ~/.agentflow/logs/$(date +%F).jsonl
```

Each tool call appends a line with tokens + cost.

### Check savings

```bash
agentflow-mcp stats
agentflow-mcp stats --week
agentflow-mcp stats --json | jq
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Tools don't appear in Claude Code | MCP server didn't spawn | Check `~/.claude.json` has `mcpServers.agentflow`; run `agentflow-mcp` manually to confirm bin works; check Claude Code logs |
| `npx -y agentflow-mcp` not found | Package not on npm yet | `npm link` from repo root (dev mode) |
| `Authentication error` from Anthropic | Bad / missing key | Verify `~/.agentflow/config.yaml` has `api_key:` line, or `ANTHROPIC_API_KEY` is exported in Claude Code's env |
| Smoke test passes but live calls fail | Key resolution issue | `node bin/agentflow-mcp config` to print resolved config |
| Ledger empty after calls | Wrong log dir | Check `log_dir:` in `~/.agentflow/config.yaml` matches `~/.agentflow/logs` |

---

## Reset

```bash
agentflow-mcp uninstall          # remove MCP entry from ~/.claude.json
agentflow-mcp uninstall --purge  # also delete ~/.agentflow/
npm unlink -g agentflow-mcp      # undo `npm link`
```
