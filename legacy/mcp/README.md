# agentflow-mcp

> **Heads up:** AgentFlow has pivoted to native **Claude Code Skills** — no API
> key, no billing, no server process. If you're starting fresh, use the Skills
> version: **https://github.com/ayyagarisujanreddy123/AgentFlow**
>
> This npm package is the original **MCP server**. It still works and is
> maintained for existing users, but it is now the *legacy* path. The Skills
> version preserves the same context-isolation benefit by dispatching
> model-pinned subagents, and installs by copying a folder.

---

AgentFlow MCP is a stdio Model Context Protocol server for Claude Code. It exposes
seven tools that route work to Haiku (and Sonnet, where reasoning matters) via the
Anthropic API, so the primary Claude Code model doesn't spend its own context on
extraction/generation work:

- `agentflow_read` — read a file, return only the relevant sections
- `agentflow_search` — natural-language code search across files
- `agentflow_gen` — generate tests / boilerplate / docs / config (Sonnet)
- `agentflow_review` — bug / security / style review (Sonnet)
- `agentflow_summarize` — condense logs / traces / docs
- `agentflow_transform` — reformat / convert data
- `agentflow_ask` — general-purpose cheap completion

## Requirements

- Claude Code
- Node.js >= 18
- An Anthropic API key (`ANTHROPIC_API_KEY`) — billed to your own Anthropic API
  account, separate from any Claude Code subscription. **This setup requirement is
  exactly what the Skills version removes.**

## Install

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
npx -y agentflow-mcp init     # configures Claude Code + writes ~/.agentflow/config.yaml
```

Restart Claude Code, then run `/mcp` — you should see `agentflow` with 7 tools.

## CLI

```bash
agentflow-mcp init [--dry-run] [--from-source]
agentflow-mcp uninstall [--purge]
agentflow-mcp stats [--week|--month|--all|--json]
agentflow-mcp config [--edit]
agentflow-mcp serve
```

Every tool call is logged to `~/.agentflow/logs/YYYY-MM-DD.jsonl` with per-call
cost and the equivalent Sonnet cost it saved.

## Configuration

`~/.agentflow/config.yaml` (hot-reloads on save):

```yaml
api_key: ${ANTHROPIC_API_KEY}
default_model: claude-haiku-4-5-20251001
tools:
  agentflow_review: { model: claude-sonnet-4-6 }
  agentflow_gen:    { model: claude-sonnet-4-6 }
comparison_model: claude-sonnet-4-6
```

## License

MIT
