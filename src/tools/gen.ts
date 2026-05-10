import * as fs from "fs";
import * as path from "path";
import { ToolDef, runCompletion } from "./types.js";
import { resolveCwd } from "./fs-utils.js";

const SYSTEM = `You are a code generator. Given a specification, produce clean, working code. Include necessary imports and type annotations. Follow language conventions.

Output code only — no explanations, no markdown fences unless the spec asks for markdown.`;

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
