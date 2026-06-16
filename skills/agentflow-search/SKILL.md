---
name: agentflow-search
description: Find code across many files from a natural-language description, returning ranked locations instead of loading every file into the main session. Use when the user asks where something lives or how something is implemented across a directory or codebase ("where do we validate tokens", "find the retry logic", "which files touch the pricing config") and you want the search to happen in an isolated context. Dispatches a Haiku worker that greps/reads candidate files and returns ranked {file, line range, relevance, snippet} hits. The native Explore agent is a fine alternative; this skill is the cheaper Haiku-pinned path with a structured JSON result.
---

# agentflow-search

Locate code matching a natural-language query across a directory tree and return
ranked hits — without pulling all the candidate files into the primary session.
A Haiku-pinned worker does the grepping/reading in an isolated context.

> Honest note: the native `Explore` agent already isolates search in a subagent.
> This skill's edge is the cheaper Haiku pin and a structured JSON result format.

## When it fires
- "Where do we validate auth tokens?"
- "Find everything that touches the pricing config."
- "Which files implement the retry/backoff logic?"

## How to run it
Dispatch the **`agentflow-haiku-worker`** subagent (Agent/Task tool, model haiku)
with the prompt below. Fill in `{query}`, `{paths}` (default the cwd), and
`{max_results}` (default 10). Return the worker's JSON verbatim.

```
You are a code search engine. Search the given paths for code matching the query.
Use Grep/Glob to find candidate files, then Read the most promising ones to
confirm relevance.

Return results as a JSON array of {file, line_start, line_end, relevance, snippet}
objects, ranked by relevance (0.0-1.0). Return ONLY the JSON array — no markdown
fences, no explanation. If no matches found, return [].
Return at most {max_results} results.

Query: {query}
Paths: {paths}
```
