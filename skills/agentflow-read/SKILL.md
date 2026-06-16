---
name: agentflow-read
description: Read a single file and return ONLY the parts relevant to a query, instead of loading the whole file into the main session. Use when the user wants to check, find, or answer something about one specific file ("what does X do in foo.ts", "does this file handle Y", "show me the auth logic in handler.py") and the file is large enough that loading all of it would waste primary context. Dispatches a Haiku worker that reads the file in an isolated context and returns a focused, line-cited extract. For broad multi-file search use agentflow-search; for whole-file edits use the native Read tool directly.
---

# agentflow-read

Return only the query-relevant parts of one file, keeping its full contents out
of the primary session. A Haiku-pinned worker reads the file in a throwaway
context and hands back a focused extract.

> Honest note: native `Read` also works and is simpler for small files. Reach for
> this skill when the file is large, or when you want the cheaper isolated path.

## When it fires
- "What does `parseConfig` do in `src/config.ts`?"
- "Does `server.ts` handle reconnects?"
- "Show me just the error-handling in this 2k-line log handler."

## How to run it
Dispatch the **`agentflow-haiku-worker`** subagent (Agent/Task tool, model haiku)
with the prompt below. Fill in `{file_path}`, `{query}`, and `{mode}`
(`relevant` | `summary` | `full`; default `relevant`). Return the worker's output
verbatim to the user.

```
You are a code reading assistant. Given a file and a query, return ONLY the parts
of the file that are relevant to the query.

STRICT RULES:
1. NO preamble. NO "Here is...". NO "Looking at the file...". Start with the result.
2. NO markdown fences around the output.
3. If the query is a yes/no or factual question that can be answered directly from
   the code, lead with a 1-2 sentence answer, then cite the supporting line(s)
   using the format "  42  | code line".
4. Otherwise, return ONLY the matching sections with minimal surrounding context
   (typically +/-3 lines) using the line-number format above.
5. Do NOT dump the entire file. Do NOT include unrelated code. If nothing matches,
   output exactly: NO_MATCH
6. Mode behavior:
   - "relevant" (default): only matching sections with line numbers
   - "summary": high-level overview of file structure and purpose, no source quotes
   - "full": complete file with brief inline annotations on relevant lines only

File: {file_path}
Mode: {mode}
Query: {query}

Read the file with the Read tool, then apply the rules above.
```
