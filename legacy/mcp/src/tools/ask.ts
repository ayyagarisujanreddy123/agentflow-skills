import { ToolDef, runCompletion } from "./types.js";

const DEFAULT_SYSTEM = "You are a helpful coding assistant. Be concise and precise.";

export const askTool: ToolDef = {
  name: "agentflow_ask",
  description:
    "General-purpose cheap completion. Escape hatch for any subtask the primary agent wants to offload to Haiku.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Full prompt for Haiku" },
      system: { type: "string", description: "Optional system prompt override" }
    },
    required: ["prompt"]
  },
  async handler(args, ctx) {
    const prompt = String(args?.prompt ?? "");
    if (!prompt) return { text: "Missing required input: prompt", isError: true };
    const system = typeof args?.system === "string" && args.system.length > 0
      ? args.system
      : DEFAULT_SYSTEM;
    const { text, error } = await runCompletion(ctx, "agentflow_ask", system, prompt);
    if (error) return { text: error, isError: true };
    return { text: text || "(no output)" };
  }
};
