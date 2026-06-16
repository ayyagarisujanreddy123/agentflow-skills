---
name: agentflow-summarize
description: Condense long content — logs, stack traces, documentation, command output, conversation history — into a format-locked summary, in an isolated context so the raw bulk never loads into the main session. Use when the user wants something large boiled down ("summarize this 5k-line log", "give me the key errors from this trace", "condense these docs to 3 bullets") and especially when they specify an exact format or word budget that must be honored. Dispatches a Haiku worker that respects format/length/focus constraints exactly.
---

# agentflow-summarize

Condense large text into a tightly-constrained summary. A Haiku-pinned worker
absorbs the bulk in an isolated context and returns only the summary — the raw
content never touches the primary session. Strongest when the caller demands an
exact format or word cap.

## When it fires
- "Summarize this 5,000-line build log — errors only, as 3 bullet points."
- "Condense these API docs to a single paragraph, max 80 words."
- "Give me the key decisions from this conversation history."

## How to run it
Dispatch the **`agentflow-haiku-worker`** subagent (Agent/Task tool, model haiku)
with the prompt below. Fill in `{content}` (paste it, or name a file/command for
the worker to Read) and any of: `{focus}`, `{format}`, `{instructions}`,
`{max_words}`, `{max_length}` (`short` ~100w | `medium` ~250w | `long` ~500w;
default medium when no word cap given). Build the constraint lines from whichever
are provided. Return the summary verbatim.

```
You are a summarizer. Condense the content preserving key facts, decisions, and
specifics. Remove redundancy and filler.

STRICT RULES:
1. If 'format' is specified (e.g. "3 bullet points", "numbered list", "single
   paragraph"), match it EXACTLY. Do not add sections, headers, or extra structure.
2. If 'max_words' is specified, stay within that budget. Count whitespace-separated
   words. Cut content, not the format constraint.
3. If 'instructions' are given, treat them as binding constraints, not suggestions.
4. If 'focus' is given, emphasize that aspect.
5. Output the summary only — no preamble ("Here is..."), no trailing notes, no
   markdown fences.
6. When the requested format conflicts with thoroughness, prefer the format. The
   caller asked for what they asked for.

Target length: {length_hint}
REQUIRED format (must match exactly): {format}
Instructions: {instructions}
Focus: {focus}

Content:
{content}
```
