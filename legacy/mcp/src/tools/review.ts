import * as fs from "fs";
import { ToolDef, runCompletion } from "./types.js";
import { resolveCwd, isBinaryBuffer } from "./fs-utils.js";

const FOCUS_PROMPTS: Record<string, string> = {
  bugs: "Find logic errors, off-by-one bugs, unhandled edge cases, resource leaks, race conditions, type errors.",
  security: "Find injection vulnerabilities, auth flaws, secrets in code, dangerous function calls, input validation gaps.",
  style: "Find naming issues, DRY violations, complexity problems, missing docs, long functions.",
  all: "Find logic errors, off-by-one bugs, unhandled edge cases, resource leaks, race conditions, type errors, injection vulnerabilities, auth flaws, secrets in code, dangerous function calls, input validation gaps, naming issues, DRY violations, complexity problems, missing docs, long functions."
};

const OUTPUT_RULES = `

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
8. If no issues found, output exactly: NO_ISSUES_FOUND`;

export const reviewTool: ToolDef = {
  name: "agentflow_review",
  description:
    "Quick code review focused on bugs, security issues, or style. Returns structured findings — no prose, no filler.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Code to review (or use file_path)" },
      file_path: { type: "string", description: "Read code from this file" },
      focus: {
        type: "string",
        enum: ["bugs", "security", "style", "all"],
        description: "Review focus (default 'all')"
      }
    }
  },
  async handler(args, ctx) {
    let code: string = typeof args?.code === "string" ? args.code : "";
    const file_path = typeof args?.file_path === "string" ? args.file_path : "";
    const focus = ((args?.focus as string) ?? "all").toLowerCase();
    const focusPrompt = FOCUS_PROMPTS[focus] ?? FOCUS_PROMPTS.all;

    if (!code && !file_path) {
      return { text: "Provide either 'code' or 'file_path'", isError: true };
    }
    let sourceLabel = "<inline>";
    if (!code && file_path) {
      const abs = resolveCwd(file_path);
      if (!fs.existsSync(abs)) return { text: `File not found: ${abs}`, isError: true };
      try {
        const buf = fs.readFileSync(abs);
        if (isBinaryBuffer(buf)) return { text: `Binary file skipped: ${abs}`, isError: true };
        code = buf.toString("utf8");
        sourceLabel = abs;
      } catch (e: any) {
        return { text: `Cannot read ${abs}: ${e?.message ?? e}`, isError: true };
      }
    }

    const numbered = code.split("\n").map((ln, i) => `${i + 1}: ${ln}`).join("\n");
    const system = `You are a senior code reviewer. ${focusPrompt}${OUTPUT_RULES}`;
    const user = `File: ${sourceLabel}\n\n${numbered}`;

    const { text, error } = await runCompletion(ctx, "agentflow_review", system, user);
    if (error) return { text: error, isError: true };
    return { text: text || "NO_ISSUES_FOUND" };
  }
};
