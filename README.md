<div align="center">

<img src="./assets/logo.svg" alt="AgentFlow MCP" width="460"/>

<br/>

**Smart tools that cost less than thinking — MCP server for Claude Code.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](./package.json)
[![Tests](https://img.shields.io/badge/tests-39%2F39%20passing-success)](./TESTING.md)
[![Cost reduction](https://img.shields.io/badge/cost%20reduction-93.8%25-blueviolet)](./COMPARISON.md)
[![Status](https://img.shields.io/badge/status-pre--release-orange)](#)

<br/>

```bash
npx agentflow-mcp init
```

<sub><a href="#install">Install</a> • <a href="#how-it-works">How It Works</a> • <a href="#tools">Tools</a> • <a href="#config">Config</a> • <a href="#quality-vs-cost--what-gets-routed-where">Benchmark</a> • <a href="./COMPARISON.md">Full Comparison</a> • <a href="./TESTING.md">Testing</a> • <a href="#license">License</a></sub>

<br/>

<a href="https://star-history.com/#ayyagarisujanreddy123/AgentFlow&Date">
  <img src="https://api.star-history.com/svg?repos=ayyagarisujanreddy123/AgentFlow&type=Date" alt="Star History" width="640"/>
</a>

</div>

<br/>

AgentFlow MCP gives Claude Code a set of tools backed by Haiku (and Sonnet, where reasoning matters). When Claude Code needs to summarize a file, search a codebase, generate boilerplate, write tests, or review code, it calls an AgentFlow tool instead of doing the work in its own expensive context window. Each tool runs against a fresh, minimal context — the primary model (Sonnet/Opus) never processes those tokens.

> **Measured on a 3-task benchmark vs Opus 4.6 baseline: 93.8% cost reduction, 80.2% primary-context reduction, output correctness at parity.** See [COMPARISON.md](./COMPARISON.md).

---

## Install

```bash
# One command — configures Claude Code automatically
npx agentflow-mcp init

# Prompts for Anthropic API key (or uses ANTHROPIC_API_KEY env var)
# Writes MCP server config to Claude Code
# Creates ~/.agentflow/config.yaml with defaults
# Done — tools available on next Claude Code session
```

Uninstall:

```bash
npx agentflow-mcp uninstall          # remove MCP entry
npx agentflow-mcp uninstall --purge   # also delete ~/.agentflow/
```

---

## Tools

| Tool | What it does | When the agent uses it |
|---|---|---|
| `agentflow_read` | Read a file via Haiku, return only relevant sections | Instead of ingesting a 2000-line file to find one function |
| `agentflow_search` | Natural-language code search across files | Instead of grepping + reading dozens of files |
| `agentflow_gen` | Generate tests, boilerplate, docs, configs | Instead of writing 200-line test files in Sonnet |
| `agentflow_review` | Structured bug / security / style review | Instead of reviewing diffs line-by-line |
| `agentflow_summarize` | Condense logs, traces, docs, history | Instead of summarizing in the primary context |
| `agentflow_transform` | Reformat data — JSON↔CSV, extract, clean | Instead of doing string surgery in Sonnet |
| `agentflow_ask` | General-purpose Haiku completion | Catch-all for any cheap subtask |

---

## Example stats output

```
AgentFlow MCP — Session Stats (Today)
────────────────────────────────────────────────
Tool calls:        34
Tokens routed:     52,180 in / 8,920 out
Haiku cost:        $0.077
Sonnet equivalent: $0.290
Saved:             $0.213 (73%)

By tool:
  agentflow_read       14 calls    $0.042 saved
  agentflow_gen         9 calls    $0.098 saved
  agentflow_search      5 calls    $0.031 saved
  agentflow_review      3 calls    $0.024 saved
  agentflow_summarize   2 calls    $0.012 saved
  agentflow_ask         1 call     $0.006 saved
```

```bash
npx agentflow-mcp stats           # today
npx agentflow-mcp stats --week    # last 7 days
npx agentflow-mcp stats --month   # last 30 days
npx agentflow-mcp stats --all     # lifetime
npx agentflow-mcp stats --json    # machine-readable
```

---

## Config

`~/.agentflow/config.yaml` (hot-reloads on save — no restart):

```yaml
api_key: ${ANTHROPIC_API_KEY}
default_model: claude-haiku-4-5-20251001

tools:
  agentflow_review:
    model: claude-sonnet-4-6    # use Sonnet for deeper reviews
    max_tokens: 2048
  agentflow_gen:
    max_tokens: 4096
    temperature: 0.4
  agentflow_read:
    max_file_size_kb: 500

comparison_model: claude-sonnet-4-6
log_dir: ~/.agentflow/logs
```

Inspect or edit:

```bash
npx agentflow-mcp config           # print
npx agentflow-mcp config --edit    # open in $EDITOR
```

---

## How it works

```
Claude Code (Sonnet/Opus)
    │
    │  MCP tool call (stdio)
    ▼
┌─────────────────────────┐
│   AgentFlow MCP Server  │
│   (Node.js / TypeScript) │
│                         │
│  ┌───────────────────┐  │
│  │   Tool Router     │  │  ← reads config.yaml
│  │   (tool → model)  │  │
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │  Context Builder  │  │  ← builds minimal prompt
│  │  (no history,     │  │     from tool inputs only
│  │   inputs only)    │  │
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │  Anthropic SDK    │  │  ← calls Haiku
│  │  (API call)       │  │
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │  Token Ledger     │  │  ← logs usage + savings
│  └───────────────────┘  │
└─────────────────────────┘
    │
    │  tool response (result only)
    ▼
Claude Code (continues with short result in context)
```

---

## Quality vs Cost — what gets routed where

Not every tool can use Haiku without losing quality. AgentFlow's defaults split the work:

| Tool | Default model | Why |
|---|---|---|
| `agentflow_read` | **Haiku 4.5** | Extraction. Pull relevant lines from a file. Haiku is at parity with Sonnet/Opus. |
| `agentflow_search` | **Haiku 4.5** | Pattern matching across files. Extraction-style. Haiku is fine. |
| `agentflow_summarize` | **Haiku 4.5** | Condense + reformat. Haiku follows explicit `format` and `max_words` constraints precisely. |
| `agentflow_transform` | **Haiku 4.5** | Format conversion (JSON↔CSV, extract fields). Mechanical. Haiku is fine. |
| `agentflow_ask` | **Haiku 4.5** | Catch-all for cheap subtasks. Use override if you need more depth. |
| `agentflow_gen` | **Sonnet 4.6** | Code generation. Reasoning matters: imports must point at real modules, edge cases must be enumerated. Haiku tends to redefine functions inline instead of importing them — Sonnet doesn't. |
| `agentflow_review` | **Sonnet 4.6** | Code review. Requires identifying real bugs, not pattern-matching syntax. Haiku misses subtle issues; Sonnet catches them. |

### Measured trade-off (3-task benchmark vs Opus 4.6 baseline)

| Metric | All-Opus | AgentFlow (mixed Haiku/Sonnet) |
|---|---|---|
| Cost (3 tasks: summarize, read+query, gen test) | $0.10237 | $0.00638 |
| **Cost reduction** | — | **93.8%** |
| Tokens entering primary context | 3,873 | 768 |
| **Context-window reduction** | — | **80.2%** |
| Output correctness on benchmark | ✓ | ✓ (gen now imports correctly, summarize honors exact format) |

The split keeps generation and review on a model strong enough to be correct, while routing extraction-style work to Haiku where it costs ~5% of Sonnet and produces equivalent output. **Result: 60-70% real-world cost reduction without sacrificing correctness on tasks where reasoning depth matters.**

To override per-tool, edit `~/.agentflow/config.yaml`:

```yaml
tools:
  agentflow_review:
    model: claude-opus-4-6   # bump to Opus for high-stakes reviews
  agentflow_gen:
    model: claude-haiku-4-5-20251001   # downgrade to Haiku if you want max savings
```

Run your own comparison:

```bash
node test/comparison.mjs   # ~$0.10 of API spend; prints token + cost breakdown
```

---

## What makes this different

| | Caveman | Claude-mem | Cavekit | **AgentFlow MCP** |
|---|---|---|---|---|
| Layer | Output compression | Memory persistence | Subagent skills | **Tool-level routing** |
| Mechanism | Prompt engineering | Hooks + vector DB | Skills + hooks | **MCP tools + API calls** |
| Requires model cooperation | Yes (must talk terse) | Yes (must call hooks) | Yes (must use skills) | **No (tool calls are automatic)** |
| Saves input tokens | No | Partially | Partially | **Yes (minimal context per call)** |
| Saves output tokens | Yes (~75%) | No | Yes (~60%) | **Yes (Haiku generates)** |
| Install | curl script | npx + plugin | curl / plugin | **npx (one command)** |
| External API calls | No | Optional (Supabase) | No | **Yes (Haiku via Anthropic API)** |
| Requires user's own API key | No | Optional | No | **Yes** |

These layers stack. Caveman compresses what the model *says*. Claude-mem persists what it *remembers*. AgentFlow offloads what it *does*.

---

## FAQ

**Does this require my own API key?** Yes. Tool calls hit the Anthropic API using your `ANTHROPIC_API_KEY`. Haiku rates apply.

**Does this work with Cursor / other editors?** Not yet — Claude Code only. Other MCP clients may work if they spawn stdio servers the same way; init only writes Claude Code's config.

**Does this stack with caveman / claude-mem?** Yes. Different layers — they don't interfere with each other.

**What model does it use?** `claude-haiku-4-5-20251001` by default. Override per-tool via `tools.<name>.model` in config.

---

## Token Ledger

Every tool call is logged to `~/.agentflow/logs/YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2026-05-10T14:32:01Z",
  "tool": "agentflow_read",
  "model": "claude-haiku-4-5-20251001",
  "input_tokens": 4120,
  "output_tokens": 187,
  "haiku_cost_usd": 0.004,
  "sonnet_equivalent_usd": 0.015,
  "saved_usd": 0.011
}
```

---

## CLI reference

| Command | What it does |
|---|---|
| `npx agentflow-mcp init` | Configure Claude Code + create config file |
| `npx agentflow-mcp init --dry-run` | Preview without writing |
| `npx agentflow-mcp uninstall` | Remove MCP entry |
| `npx agentflow-mcp uninstall --purge` | Also delete `~/.agentflow/` |
| `npx agentflow-mcp stats` | Today's usage |
| `npx agentflow-mcp stats --week` | Last 7 days |
| `npx agentflow-mcp stats --all` | Lifetime |
| `npx agentflow-mcp config` | Print config |
| `npx agentflow-mcp config --edit` | Open in `$EDITOR` |
| `npx agentflow-mcp serve` | Start MCP server (called by Claude Code) |

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) if present.

## License

MIT — see [LICENSE](./LICENSE).
