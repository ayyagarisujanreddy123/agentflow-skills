# Opus 4.6 vs AgentFlow MCP — Head-to-Head

Live benchmark on 3 representative tasks. Same prompt → both paths → real API calls → real ledger.

- **Baseline**: Anthropic API direct, model `claude-opus-4-6` (input $15 / output $75 per M tokens).
- **AgentFlow**: MCP tool call routed by default config — `agentflow_gen` and `agentflow_review` go to Sonnet 4.6, the rest go to Haiku 4.5.
- **Reproduce**: `node test/comparison.mjs` (~$0.10 of API spend per run).
- **Run captured**: 2026-05-10.

---

## Headline numbers

| Metric | Opus baseline | AgentFlow | Δ |
|---|---|---|---|
| Total cost (3 tasks) | **$0.10237** | **$0.00638** | −$0.09599 (**−93.8%**) |
| Total tokens (in/out) | 3,135 / 738 | 4,139 / 768 | — |
| Tokens hitting primary context | **3,873** | **768** | **−80.2%** |
| Output correctness | ✓ | ✓ | parity on all 3 tasks |

The "primary context" row is the one that matters most for long Claude Code sessions: with Opus, every input token enters the main session window. With AgentFlow, only the small tool result does — the bulk of the work happens in a separate process Claude Code never sees.

---

## Per-task breakdown

| Task | Opus tok (in / out) | Opus cost | AgentFlow tok (in / out) | AgentFlow cost | Saved | Saved % |
|---|---|---|---|---|---|---|
| Summarize README.md | 2364 / 266 | $0.05541 | 2562 / 195 | $0.00283 | $0.05258 | **94.9%** |
| Read `src/server.ts` and answer query | 712 / 126 | $0.02013 | 1280 / 161 | $0.00167 | $0.01846 | **91.7%** |
| Generate unit test for `sum(a,b)` | 59 / 346 | $0.02684 | 297 / 412 | $0.00189 | $0.02495 | **93.0%** |
| **TOTAL** | **3135 / 738** | **$0.10237** | **4139 / 768** | **$0.00638** | **$0.09599** | **93.8%** |

---

## Side-by-side outputs

### Task 1 — Summarize `README.md` in 3 bullet points

**Constraint**: 3 bullet points, focus on what it does and how it differs.

#### Opus (266 output tokens, $0.05541)

```
- AgentFlow MCP is an MCP server for Claude Code that offloads routine
  subtasks — file reading, code search, test generation, code review,
  summarization, and data transformation — to cheap Haiku API calls, so
  the primary expensive model (Sonnet/Opus) never processes those tokens.
  Each tool call runs against a fresh, minimal context with no
  conversation history, and only a short result is returned to the main
  session.

- It claims ~73% cost savings by routing bulk token work to Haiku instead
  of letting Sonnet handle it. A built-in "Token Ledger" logs every tool
  call with exact token counts and costs, and a stats CLI lets users
  track savings per tool over time.

- Unlike alternatives, it operates at the tool-routing layer rather than
  relying on prompt engineering or model cooperation. Caveman compresses
  model output, Claude-mem persists memory, and Cavekit uses subagent
  skills — all requiring the model to behave a certain way. AgentFlow
  instead intercepts work via MCP tool calls and dispatches it to
  external API calls automatically, and it stacks cleanly with those
  other approaches since they target different layers.
```

#### AgentFlow / Haiku 4.5 (195 output tokens, $0.00283)

```
• What it does: AgentFlow MCP routes Claude Code's expensive tasks
  (summarization, code search, test generation, reviews) to cheaper
  Haiku model via MCP tools, keeping the primary context minimal and
  saving 73% on token costs.

• How it differs from alternatives: Unlike Caveman (output compression),
  Claude-mem (memory persistence), or Cavekit (subagent skills),
  AgentFlow operates at the tool level with automatic MCP routing — no
  model cooperation required — and saves input tokens by building
  minimal context per call.

• Installation & usage: One-command setup (`npx agentflow-mcp init`)
  configures Claude Code automatically, creates `~/.agentflow/config.yaml`,
  and provides seven tools (read, search, gen, review, summarize,
  transform, ask) with per-tool model/token overrides and usage tracking.
```

**Verdict**: Both deliver 3 bullets, both correct. Opus is more verbose and elaborates more on each point. Haiku is tighter (195 vs 266 output tokens) and still covers the core ground. **Quality: parity for the asked-for format.**

---

### Task 2 — Read `src/server.ts`, answer "How is the API key hot-reloaded?"

#### Opus (126 output tokens, $0.02013)

```
The `ConfigManager` watches for configuration changes via `config.watch()`,
and a callback is registered with
`config.onChange(c => client.setApiKey(c.api_key ?? process.env.ANTHROPIC_API_KEY))`
so that whenever the configuration changes, the new API key is pushed
into the `AnthropicClient` by calling its `setApiKey` method. This means
the API key is hot-reloaded without restarting the server, by propagating
file-based config changes through the `onChange` callback directly to
the client.
```

#### AgentFlow / Haiku 4.5 (161 output tokens, $0.00167)

```
The API key is hot-reloaded through a configuration change listener.
When the config is watched for changes, the `onChange` callback updates
the client's API key:

  14 | const config = new ConfigManager();
  15 | config.watch();
  17 | const client = new AnthropicClient(config.getApiKey());
  18 | config.onChange(c => client.setApiKey(c.api_key ?? process.env.ANTHROPIC_API_KEY));

The `ConfigManager.watch()` method monitors for changes, and whenever a
change occurs, the registered `onChange` callback is triggered, which
calls `client.setApiKey()` with the new API key value.
```

**Verdict**: Both correct. Opus answers in pure prose. AgentFlow leads with a one-sentence answer, then cites the actual source lines with line numbers, then explains. **AgentFlow's output is arguably more useful** — you get the answer plus a verifiable citation. Same accuracy, ~12× cheaper.

---

### Task 3 — Generate Node.js unit test for `sum(a, b)`

**Spec**: Generate a Node.js test (using `node:test`) for the function below. Output ONLY the test code, no commentary.

#### Opus (346 output tokens, $0.02684)

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum';

describe('sum', () => {
  it('should return the sum of two positive numbers', () => {
    assert.strictEqual(sum(2, 3), 5);
  });
  it('should return the sum of two negative numbers', () => {
    assert.strictEqual(sum(-2, -3), -5);
  });
  it('should return the sum of a positive and a negative number', () => {
    assert.strictEqual(sum(5, -3), 2);
  });
  it('should return 0 when both arguments are 0', () => {
    assert.strictEqual(sum(0, 0), 0);
  });
  it('should handle decimal numbers', () => {
    assert.strictEqual(sum(0.1, 0.2), 0.1 + 0.2);
  });
  it('should return the other number when one argument is 0', () => {
    assert.strictEqual(sum(0, 5), 5);
    assert.strictEqual(sum(5, 0), 5);
  });
  it('should handle large numbers', () => {
    assert.strictEqual(sum(1_000_000, 2_000_000), 3_000_000);
  });
});
```

#### AgentFlow / Sonnet 4.6 (412 output tokens, $0.00189)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sum } from "./module-under-test"; // adjust import path

test("sum: adds two positive numbers", () => {
  assert.equal(sum(2, 3), 5);
});

test("sum: adds two negative numbers", () => {
  assert.equal(sum(-4, -6), -10);
});

test("sum: adds a positive and a negative number", () => {
  assert.equal(sum(10, -3), 7);
});

test("sum: returns zero when both arguments are zero", () => {
  assert.equal(sum(0, 0), 0);
});

test("sum: returns the same number when adding zero", () => {
  assert.equal(sum(42, 0), 42);
  assert.equal(sum(0, 42), 42);
});

test("sum: handles large numbers", () => {
  assert.equal(sum(1_000_000, 2_000_000), 3_000_000);
});

test("sum: handles floating-point numbers", () => {
  assert.ok(Math.abs(sum(0.1, 0.2) - 0.3) < Number.EPSILON);
});

test("sum: handles Number.MAX_SAFE_INTEGER boundary", () => {
  assert.equal(sum(Number.MAX_SAFE_INTEGER, 0), Number.MAX_SAFE_INTEGER);
});

test("sum: handles Number.MIN_SAFE_INTEGER boundary", () => {
  assert.equal(sum(Number.MIN_SAFE_INTEGER, 0), Number.MIN_SAFE_INTEGER);
});
```

**Verdict**:

- Both import `sum` from a source module (no inline redefinition — this was a real Haiku bug fixed by routing gen → Sonnet).
- AgentFlow covers **more edge cases**: `Number.MAX_SAFE_INTEGER` and `Number.MIN_SAFE_INTEGER` boundaries, floating-point precision via `Number.EPSILON`. Opus uses the looser `0.1 + 0.2` trick.
- AgentFlow uses flat `test()` calls; Opus uses `describe` + `it`. Both are valid `node:test` patterns.
- AgentFlow added `// adjust import path` because the spec didn't say where `sum` lives — that's per the tightened gen prompt.

**Quality: AgentFlow output is at least as thorough as Opus on this task, at ~14× lower cost.**

---

## What changed since the first comparison run

The first run (before tightening prompts and fixing the schema) showed Haiku producing measurably worse output — ignoring the "3 bullets" constraint, redefining `sum` inline instead of importing it, dumping raw source lines instead of answering questions. Those failures were not Haiku quality issues; they were:

1. **Schema bug**: `agentflow_summarize` did not accept a `format` field, so caller constraints were silently dropped before reaching the model.
2. **Lax system prompts**: tools didn't tell the model to be strict about format compliance, citation, or import behavior.
3. **Wrong default routing**: code generation and code review on Haiku is genuinely a quality drop — those need Sonnet's reasoning depth.

After commit `7fb1b4c`:

- Schema now exposes `format`, `instructions`, `max_words` for summarize.
- System prompts in `gen`, `review`, `summarize`, `read` enforce strict format compliance + behavioral rules.
- Default routing puts `gen` and `review` on Sonnet 4.6.

Result: **outputs are now at quality parity with Opus on these 3 tasks**, while still saving 93.8% on cost.

---

## Caveats

- **3 tasks is not a benchmark.** Real workloads will vary. For higher-confidence numbers, run `node test/comparison.mjs` repeatedly with task variations.
- **Quality parity is task-dependent.** Tasks requiring deep reasoning, multi-file context, or novel architecture decisions will favor Opus. AgentFlow's win zone: extraction, summarization, formatted generation, structured review.
- **Costs are list price (May 2026).** No prompt caching, no batch discounts. Both paths could be further optimized.
- **The "context window reduction" only matters if you have long sessions.** For one-shot queries, dollar cost is the relevant metric.
- **Output token counts differ slightly run-to-run** because both models are sampled. Cost varies ±5% across runs. The savings ratio stays in the same range.

---

## How to reproduce

```bash
# Build + ensure ANTHROPIC_API_KEY is set (.env loads automatically)
npm install
npm run build

# Run the live comparison (~$0.10 of API spend)
node test/comparison.mjs

# View raw ledger of every call AgentFlow made
agentflow-mcp stats
cat ~/.agentflow/logs/$(date +%F).jsonl
```

To rerun with different tasks, edit the `TASKS` array in `test/comparison.mjs:106`.
