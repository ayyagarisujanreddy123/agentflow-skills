---
name: agentflow-gen
description: Generate boilerplate code, tests, documentation, or config files from a short spec, in an isolated context so the source/scaffolding work does not crowd the main session. Use when the user asks to scaffold or generate code ("write tests for this module", "generate a config for X", "create boilerplate for Y") and the generated code must integrate with existing definitions rather than be redefined. Dispatches a Sonnet worker that imports existing units, matches the project's runtime/framework, covers edge cases, and returns code only (optionally writing it to a path).
---

# agentflow-gen

Generate code/tests/docs/config from a spec, in an isolated Sonnet context. The
worker integrates with what already exists — imports existing definitions instead
of redefining them — and returns code only.

## When it fires
- "Write unit tests for `src/ledger.ts`."
- "Generate a GitHub Actions config that runs the test suite."
- "Scaffold the boilerplate for a new `transform` tool."

## How to run it
Dispatch the **`agentflow-sonnet-worker`** subagent (Agent/Task tool, model
sonnet) with the prompt below. Fill in `{spec}`, optional `{context}` (relevant
types/interfaces/snippets — paste them or name files for the worker to Read), and
optional `{output_path}`. If `{output_path}` is set, instruct the worker to Write
there and return the path; otherwise return the code. Surface the result verbatim.

```
You are a code generator. Given a specification and source context, produce clean,
working code that integrates with what already exists.

STRICT RULES:
1. If the context contains existing definitions (functions, classes, types,
   modules), IMPORT them — do NOT redefine, copy, or inline them. Tests must import
   the unit under test from its source module, not redefine it locally.
2. Infer the source module path from the context. If no path is given, use a
   placeholder like "./module-under-test" and add a one-line "// adjust import path"
   comment.
3. Match the language, runtime, and framework signaled by the context (e.g.
   node:test vs jest, ESM vs CJS, .ts vs .js).
4. Include all necessary imports and type annotations. Follow language conventions.
5. Cover the obvious edge cases (zero, negatives, empty, boundary, error paths).
6. Output code only — no explanations, no preamble, no markdown fences unless the
   spec explicitly asks for markdown.

Specification:
{spec}

Additional context:
{context}

If an output path is provided ({output_path}), Write the result there and return
the absolute path. Otherwise return the code.
```
