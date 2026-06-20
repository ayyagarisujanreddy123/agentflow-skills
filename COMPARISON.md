# Skills vs Inline — Context-Cost Benchmark

The MCP-era benchmark ([`legacy/mcp/COMPARISON.md`](./legacy/mcp/COMPARISON.md))
measured **dollar cost** with a per-call token ledger. The Skills version has no
ledger (Claude Code doesn't expose per-subagent accounting), so the question
changes from *"what does it cost?"* to *"how many tokens hit the primary
session?"* — the context firewall, which is the actual pitch.

This doc measures that directly: run the **same review task** two ways and compare
the token footprint.

- **WITH skill** — `agentflow-review` dispatches the Sonnet worker. The file is
  read in the worker's isolated context; only the findings return to the main
  session.
- **WITHOUT skill** — the primary session reads the whole file inline and reviews
  it. Every input token lands in the main context window.
- **Two metrics** — *main-context tokens* (what the firewall protects) and *total
  tokens spent* (main + worker, the honest all-in cost).
- **Run captured**: 2026-06-19. Both arms produced the **same findings** — the
  skill loses no review quality.

> Token counts are `chars / 4` estimates except the worker totals, which are the
> real `subagent_tokens` reported by the dispatch. Treat as ±10–15%, directional.

---

## Headline — the crossover

The skill's main-context cost is **roughly flat** (~1.3–1.8k tokens: the
`SKILL.md` methodology load + the dispatch prompt + the returned findings). It
does **not** grow with file size. Inline cost grows linearly with the file. They
cross at **~5 KB (~1.3k tokens)**:

| File | Size | Main-context Δ (skill vs inline) | Total-spend Δ |
|---|---|---|---|
| `legacy/mcp/src/client.ts` | 1.8 KB | **+92 %** ❌ skill costs more | +1140 % ❌ |
| `legacy/mcp/test/comparison.mjs` | 9.8 KB | **−42 %** ✅ skill saves | +299 % ❌ |

Projected from the flat ~1.3k skill floor: **−83 %** main-context on a 30 KB file.

---

## Per-arm breakdown

### Small file — `client.ts` (1.8 KB, ~450 tok)

| Metric | With skill | Without | Δ |
|---|---|---|---|
| Main-context tokens | 1,293 | 675 | **+92 %** ❌ |
| Total tokens spent | 8,371 | 675 | +1140 % ❌ |

Below the crossover the dispatch overhead dwarfs the file. **Don't** use the skill
here — native `Read` + inline review is cheaper on both metrics.

### Large file — `comparison.mjs` (9.8 KB, ~2.4k tok)

| Metric | With skill | Without | Δ |
|---|---|---|---|
| Main-context tokens | 1,830 | 3,144 | **−42 %** ✅ |
| Total tokens spent | 12,540 | 3,144 | +299 % ❌ |

Above the crossover the firewall pays off: the 9.8 KB file never enters the main
session, and savings widen as the file grows. The worker found 8 real bugs
(uncaught `JSON.parse` crashes, an uncancelled timer leak, a ledger-read race).

---

## What it means

- **Main-context savings are real — but only above ~5 KB.** The design claim
  ("keep the primary context clean") holds for big inputs and gets stronger as
  they grow. On small files the fixed dispatch overhead makes the skill a net
  loss. The skill descriptions already hedge this ("the file is large enough that
  loading all of it would waste primary context"); the benchmark puts a number on
  *large*: **~5 KB**.
- **Total spend always loses (3–11×).** A worker is a whole second context: its
  system prompt, the file, and its reasoning all cost tokens. You trade extra
  total tokens for a clean main session. If you're optimizing raw spend rather
  than context headroom, don't dispatch.
- **No quality cost.** Same findings both ways across both files.

### Rule of thumb

| Situation | Use |
|---|---|
| File / log / input **> ~5 KB**, long session, context is the constraint | **Skill** (firewall wins) |
| Small input, or you're counting total tokens / dollars | **Inline** native tools |

---

## Reproduce

There's no automated harness for this (subagent token accounting isn't
scriptable the way the MCP ledger was). To repeat by hand:

1. Pick a target file. Note its size (`wc -c`).
2. **With skill:** dispatch `agentflow-review` on it; record the `subagent_tokens`
   from the dispatch result and the size of the returned findings.
3. **Without skill:** `Read` the whole file inline and review it; the file size is
   the main-context cost.
4. Compare main-context (skill = SKILL.md + dispatch + findings; inline = file +
   output) and total (skill = `subagent_tokens` + main overhead; inline = same as
   its main-context).

Caveats: `chars/4` token estimates, N = 2 files, one skill (`review`). The
lighter-methodology skills (`read`, `search`, `summarize`) carry less fixed
overhead, so their crossover sits **below** 5 KB.
