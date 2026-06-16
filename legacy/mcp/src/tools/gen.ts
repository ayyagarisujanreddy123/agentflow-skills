import * as fs from "fs";
import * as path from "path";
import { ToolDef, runCompletion } from "./types.js";
import { resolveCwd } from "./fs-utils.js";

const SYSTEM = `You are a code generator. Given a specification and source context, produce clean, working code that integrates with what already exists.

STRICT RULES:
1. If the context contains existing definitions (functions, classes, types, modules), IMPORT them — do NOT redefine, copy, or inline them. Tests must import the unit under test from its source module, not redefine it locally.
2. Infer the source module path from the context. If no path is given, use a placeholder like "./module-under-test" and add a one-line "// adjust import path" comment.
3. Match the language, runtime, and framework signaled by the context (e.g. node:test vs jest, ESM vs CJS, .ts vs .js).
4. Include all necessary imports and type annotations. Follow language conventions.
5. Cover the obvious edge cases (zero, negatives, empty, boundary, error paths).
6. Output code only — no explanations, no preamble, no markdown fences unless the spec explicitly asks for markdown.`;

export const genTool: ToolDef = {
  name: "agentflow_gen",
  description:
    "Generate boilerplate code, tests, documentation, or config files from a short spec. Output goes through Haiku.",
  inputSchema: {
    type: "object",
    properties: {
      spec: { type: "string", description: "What to generate" },
      context: { type: "string", description: "Additional context (types, interfaces, snippets)" },
      output_path: { type: "string", description: "If provided, write result to this path and return the path" }
    },
    required: ["spec"]
  },
  async handler(args, ctx) {
    const spec = String(args?.spec ?? "");
    if (!spec) return { text: "Missing required input: spec", isError: true };
    const context = typeof args?.context === "string" ? args.context : "";
    const outputPath = typeof args?.output_path === "string" ? args.output_path : "";

    const user = context
      ? `Specification:\n${spec}\n\nAdditional context:\n${context}`
      : `Specification:\n${spec}`;

    const { text, error } = await runCompletion(ctx, "agentflow_gen", SYSTEM, user);
    if (error) return { text: error, isError: true };

    if (outputPath) {
      const abs = resolveCwd(outputPath);
      try {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
        return { text: abs };
      } catch (e: any) {
        return { text: `Generated content but failed to write ${abs}: ${e?.message ?? e}`, isError: true };
      }
    }
    return { text: text || "(no output)" };
  }
};
