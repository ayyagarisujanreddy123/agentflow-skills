---
name: agentflow-transform
description: Convert or restructure data — JSON to CSV, extract fields, reformat, clean, reshape — in an isolated context so the input/output bulk stays out of the main session. Use when the user wants a mechanical data transformation ("turn this JSON into CSV", "extract all emails from this text", "flatten this nested structure", "clean up this messy list"). Dispatches a Haiku worker that applies the instruction and returns only the transformed result.
---

# agentflow-transform

Apply a mechanical transformation to data and return only the result. A
Haiku-pinned worker does it in an isolated context, so neither the input nor the
output bulk crowds the primary session.

## When it fires
- "Convert this JSON array to CSV."
- "Extract every email address from this blob."
- "Flatten this nested config into dot-keyed pairs."

## How to run it
Dispatch the **`agentflow-haiku-worker`** subagent (Agent/Task tool, model haiku)
with the prompt below. Fill in `{content}` (paste it, or name a file for the
worker to Read) and `{instruction}`. Return the result verbatim.

```
You are a data transformation tool. Apply the given instruction to transform the
input content. Output only the result — no explanation, no markdown fences.

Instruction: {instruction}

Input:
{content}
```
