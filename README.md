<div align="center">

<img src="./assets/logo.png" alt="AgentFlow" width="640"/>

<br/>

**Offload the grunt work to disposable subagents — native Claude Code Skills, no API key.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Skills](https://img.shields.io/badge/Claude%20Code-Skills-blue)](#install)
[![Setup](https://img.shields.io/badge/setup-zero%20config-success)](#install)
[![No API key](https://img.shields.io/badge/API%20key-not%20required-brightgreen)](#install)

<br/>

```bash
# Install = drop a folder. No key, no billing, no server process.
git clone https://github.com/ayyagarisujanreddy123/AgentFlow.git
cp -r AgentFlow/skills/*  ~/.claude/skills/
cp -r AgentFlow/agents/*  ~/.claude/agents/
```

<sub><a href="#install">Install</a> • <a href="#how-it-works">How It Works</a> • <a href="#the-skills">Skills</a> • <a href="#whats-different-from-the-mcp-version">vs MCP</a> • <a href="#legacy-the-mcp-server">Legacy MCP</a> • <a href="#license">License</a></sub>

</div>

<br/>

AgentFlow gives Claude Code a set of **skills** that push heavy, self-contained
work — reading big files, searching a codebase, summarizing logs, reviewing code,
generating tests — into **disposable subagents**. Each subagent runs in its own
isolated context window and hands back only the result, so your primary session
stays clean and goes further before it fills.

It runs entirely inside your existing Claude Code session. **No Anthropic API key.
No separate billing. No MCP server to keep running.** Install is copying a folder.

> **Pivoted from an MCP server.** AgentFlow began as the `agentflow-mcp` npm
> package, which routed tool calls to the Anthropic API. That required every user
> to bring their own API key and set up billing — the main blocker to adoption.
> The Skills version removes that entirely while keeping the context-isolation
> benefit. The original MCP server is preserved under [`legacy/mcp/`](./legacy/mcp/)
> and documented [below](#legacy-the-mcp-server).

---

## Why use it

Three things these skills do well — capability first, cost second:

1. **Context firewall.** The expensive grunt work (a 2,000-line file, a 5k-line
   log, a multi-file search) happens in a *disposable* subagent context. Your main
   thread never loads those tokens, so you can work on a bigger task before
   running out of room. This is the headline.

2. **Opinionated, structured output.** `review` returns severity-tagged
   `SEVERITY / LINE / ISSUE / FIX` blocks with no prose. `gen` imports existing
   definitions instead of redefining them and covers edge cases. `summarize`
   honors an exact format and word budget. This is determinism the base model
   won't give you unprompted.

3. **Zero setup, fully native.** No API key, no billing account, no server
   process, no `npx`. Copy a folder into `~/.claude/` and the skills are live in
   any session.

**Honest about the cost angle:** the model-pinned workers default to Haiku for
extraction work, which is cheaper per token than your primary Opus turns — so
there's a real cost benefit too. But it's a bonus now, not the pitch.

---

## Install

AgentFlow ships two folders: `skills/` (the seven skills) and `agents/` (the two
worker subagents the skills dispatch to). Drop both into Claude Code's config dir.

### User-level (available in every project)

```bash
git clone https://github.com/ayyagarisujanreddy123/AgentFlow.git
mkdir -p ~/.claude/skills ~/.claude/agents
cp -r AgentFlow/skills/*  ~/.claude/skills/
cp -r AgentFlow/agents/*  ~/.claude/agents/
```

### Project-level (only in one repo)

```bash
mkdir -p .claude/skills .claude/agents
cp -r /path/to/AgentFlow/skills/*  .claude/skills/
cp -r /path/to/AgentFlow/agents/*  .claude/agents/
```

That's the whole install. No key, no `init`, no restart-and-pray. Skills are
discovered by their `description` and fire when Claude Code judges them relevant
(or when you name one explicitly).

> **Requirement:** Claude Code. Nothing else — no Node, no API key, no credits.

---

## The skills

| Skill | Worker (model) | What it does |
|---|---|---|
| `agentflow-read` | haiku | Read one file, return only the query-relevant lines (with citations) |
| `agentflow-search` | haiku | Natural-language code search across files → ranked `{file, lines, snippet}` |
| `agentflow-gen` | **sonnet** | Generate tests / boilerplate / docs / config that imports what exists |
| `agentflow-review` | **sonnet** | Bug / security / style review → terse `SEVERITY/LINE/ISSUE/FIX` blocks |
| `agentflow-summarize` | haiku | Condense logs / traces / docs to an exact format + word budget |
| `agentflow-transform` | haiku | Reshape data — JSON↔CSV, extract fields, clean, flatten |
| `agentflow-ask` | haiku | Catch-all: offload any contained subtask to a cheap isolated worker |

You don't call them by name — Claude Code decides. Examples:

| What you say | Skill that fires |
|---|---|
| "Review `auth.ts` for bugs" | `agentflow-review` (sonnet worker) |
| "Write unit tests for `parseConfig`" | `agentflow-gen` (sonnet worker) |
| "Summarize this 5k-line log, errors only, 3 bullets" | `agentflow-summarize` |
| "Where do we validate tokens?" | `agentflow-search` |
| "What does `handleAuth` do in this 2k-line file?" | `agentflow-read` |
| "Convert this JSON to CSV" | `agentflow-transform` |

You can also invoke one explicitly: *"use agentflow-review on src/auth.ts"*.

---

## How it works

```
Claude Code (your primary session: Opus / Sonnet)
    │
    │  matches a SKILL.md trigger
    ▼
┌──────────────────────────────────────────┐
│  SKILL.md                                 │
│  trigger description + methodology prompt │
│  "dispatch the <model> worker with this"  │
└───────────────────┬──────────────────────┘
                    │  Agent / Task tool
                    ▼
┌──────────────────────────────────────────┐
│  agentflow-{haiku|sonnet}-worker          │
│  • own isolated context window            │
│  • pinned to a cheaper / right-sized model│
│  • absorbs the file / log / search space  │
│  • applies the methodology prompt         │
└───────────────────┬──────────────────────┘
                    │  returns ONLY the result
                    ▼
Claude Code continues with a short result in context
```

Two pieces:

- **`skills/<name>/SKILL.md`** — the trigger (`description`) plus the methodology
  prompt (the same strict rules the MCP server used: the 4-line review format, the
  6 generation rules, the summarize format-discipline). It tells the primary
  session which worker to dispatch and with what prompt.
- **`agents/agentflow-{haiku,sonnet}-worker.md`** — generic, model-pinned worker
  subagents. The Haiku worker handles extraction (read, search, summarize,
  transform, ask); the Sonnet worker handles correctness-sensitive work (gen,
  review). Methodology lives in the skill, so two workers serve all seven skills.

---

## What's different from the MCP version

This is a real architecture change, not a reskin. Honest accounting:

| | MCP server (`legacy/`) | Skills (this) |
|---|---|---|
| Runs where | Separate Node process via stdio | Inside your Claude Code session |
| API key | **Required** (your own) | **None** |
| Billing | Separate Anthropic API account | None — uses your existing session |
| Install | `npx agentflow-mcp init` + restart | Copy a folder |
| Context isolation | Yes (separate API call) | Yes (subagent context window) |
| Cost model | Haiku/Sonnet API token rates | Haiku-pinned workers, no separate bill |
| Per-call token ledger | Yes (`stats` CLI) | No — Claude Code doesn't expose per-subagent token accounting |

### What's genuinely lost in the migration

- **The measured "93.8% cost reduction" headline is gone.** That number came from
  routing isolated API calls to Haiku and metering them against a Sonnet baseline.
  Skills don't expose per-call token accounting, so there's no ledger and no
  honest single percentage to quote. The *direction* (Haiku workers cost less than
  Opus turns) holds; the precise figure does not.
- **No `stats` / token ledger.** The MCP server logged every call to
  `~/.agentflow/logs/`. Subagents don't surface that, so spend tracking is gone.
- **`read` and `search` overlap with native tools.** Claude Code's built-in
  `Read` and the `Explore` agent already do these, and `Explore` already isolates
  search in a subagent. The AgentFlow versions keep a Haiku-pinned (cheaper) path
  and a structured output format — but they're the weakest of the seven. Use the
  native tools if you prefer; reach for these when you want the cheap isolated path.

The strongest skills are `review` and `gen` — their value was always the
methodology, not the API boundary, so they translate cleanly.

---

## Legacy: the MCP server

The original `agentflow-mcp` server is preserved, unchanged and still installable,
under [`legacy/mcp/`](./legacy/mcp/). Use it if you specifically want the per-call
token ledger / `stats` reporting, or you already have it wired up.

```bash
cd legacy/mcp
npm install
npm run build
export ANTHROPIC_API_KEY=sk-ant-api03-...
node dist/cli/index.js init --from-source   # wire into Claude Code from local build
```

Full build/run/test instructions are in
[`legacy/mcp/ARCHIVED.md`](./legacy/mcp/ARCHIVED.md). The published `agentflow-mcp`
npm package continues to work for existing users.

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
