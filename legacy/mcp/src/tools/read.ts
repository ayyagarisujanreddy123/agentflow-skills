import * as fs from "fs";
import { ToolDef, runCompletion } from "./types.js";
import { resolveCwd, isBinaryBuffer } from "./fs-utils.js";

const SYSTEM = `You are a code reading assistant. Given a file and a query, return ONLY the parts of the file that are relevant to the query.

STRICT RULES:
1. NO preamble. NO "Here is...". NO "Looking at the file...". Start with the result.
2. NO markdown fences around the output.
3. If the query is a yes/no or factual question that can be answered directly from the code, lead with a 1-2 sentence answer, then cite the supporting line(s) using the format "  42  | code line".
4. Otherwise, return ONLY the matching sections with minimal surrounding context (typically ±3 lines) using the line-number format above.
5. Do NOT dump the entire file. Do NOT include unrelated code. If nothing matches, output exactly: NO_MATCH
6. Mode behavior:
   - "relevant" (default): only matching sections with line numbers
   - "summary": high-level overview of file structure and purpose, no source quotes
   - "full": complete file with brief inline annotations on relevant lines only`;

export const readTool: ToolDef = {
  name: "agentflow_read",
  description:
    "Read a file and return only the relevant parts. Haiku reads it, extracts what matters, and returns a focused result — primary model context stays clean.",
  inputSchema: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Absolute or relative path to the file" },
      query: { type: "string", description: "What you're looking for in the file" },
      mode: {
        type: "string",
        enum: ["relevant", "summary", "full"],
        description: "Result style: relevant (default), summary, or full"
      }
    },
    required: ["file_path", "query"]
  },
  async handler(args, ctx) {
    const file_path = String(args?.file_path ?? "");
    const query = String(args?.query ?? "");
    const mode = (args?.mode as "relevant" | "summary" | "full") ?? "relevant";
    if (!file_path) return { text: "Missing required input: file_path", isError: true };

    const abs = resolveCwd(file_path);
    if (!fs.existsSync(abs)) return { text: `File not found: ${abs}`, isError: true };

    const toolCfg = ctx.config.getToolConfig("agentflow_read");
    const maxKb = toolCfg.max_file_size_kb ?? 500;
    let stat: fs.Stats;
    try { stat = fs.statSync(abs); }
    catch (e: any) { return { text: `Cannot stat file ${abs}: ${e?.message ?? e}`, isError: true }; }
    if (stat.size > maxKb * 1024) {
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      return {
        text: `File too large (${mb}MB > ${maxKb}KB limit). Increase max_file_size_kb in ~/.agentflow/config.yaml`,
        isError: true
      };
    }

    let buf: Buffer;
    try { buf = fs.readFileSync(abs); }
    catch (e: any) { return { text: `Cannot read ${abs}: ${e?.message ?? e}`, isError: true }; }
    if (isBinaryBuffer(buf)) return { text: `Binary file skipped: ${abs}`, isError: true };

    const content = buf.toString("utf8");
    const numbered = content.split("\n").map((ln, i) => `${String(i + 1).padStart(5)} | ${ln}`).join("\n");

    const userPrompt = `File: ${abs}
Mode: ${mode}
Query: ${query}

--- FILE CONTENTS ---
${numbered}
--- END FILE ---`;

    const { text, error } = await runCompletion(ctx, "agentflow_read", SYSTEM, userPrompt);
    if (error) return { text: error, isError: true };
    return { text: text || "(no output)" };
  }
};
