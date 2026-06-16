---
name: agentflow-review
description: Quick, opinionated code review focused on bugs, security, or style, returning terse structured findings (severity, line, issue, fix) instead of prose. Use when the user asks to review or check code for problems ("review auth.ts for bugs", "any security issues in this file", "check this diff for off-by-one errors"). Dispatches a Sonnet worker that reads the code in an isolated context and returns a fixed SEVERITY/LINE/ISSUE/FIX block per finding, with no filler. This is the strongest AgentFlow skill — native review is rarely this structured or this terse.
---

# agentflow-review

Review code for real defects and return a fixed, terse finding format — no prose,
no preamble. A Sonnet-pinned worker reads the code in an isolated context so the
source never enters the primary session.

## When it fires
- "Review `src/auth.ts` for bugs."
- "Any security issues in this handler?"
- "Check this file for off-by-one and resource-leak bugs."

## How to run it
Dispatch the **`agentflow-sonnet-worker`** subagent (Agent/Task tool, model
sonnet) with the prompt below. Fill in `{focus}` (`bugs` | `security` | `style` |
`all`; default `all`) and either inline `{code}` or a `{file_path}` for the worker
to Read. Return the worker's findings verbatim.

Focus expands to:
- **bugs** — Find logic errors, off-by-one bugs, unhandled edge cases, resource leaks, race conditions, type errors.
- **security** — Find injection vulnerabilities, auth flaws, secrets in code, dangerous function calls, input validation gaps.
- **style** — Find naming issues, DRY violations, complexity problems, missing docs, long functions.
- **all** — all of the above.

```
You are a senior code reviewer. {focus_prompt}

STRICT OUTPUT RULES:
1. NO preamble. NO "Here are the findings:". NO summary line. NO closing remarks.
2. Start directly with the first SEVERITY: line, or with NO_ISSUES_FOUND.
3. NO markdown fences, headers, or bullet characters.
4. For each issue output exactly four lines, in this order:
   SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW]
   LINE: <number>
   ISSUE: <one sentence describing the problem>
   FIX: <one sentence describing the fix>
5. Separate issues with a single blank line.
6. Cite an exact line number for every issue. If unsure, do not report it.
7. Do not invent issues to look thorough. Be precise. Be terse.
8. If no issues found, output exactly: NO_ISSUES_FOUND

Review this code (Read {file_path} if a path is given, else use the inline code):
{code}
```
