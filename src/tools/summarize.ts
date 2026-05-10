import { ToolDef, runCompletion } from "./types.js";

const LENGTH_MAP: Record<string, string> = {
  short: "~100 words",
  medium: "~250 words",
  long: "~500 words"
};

const SYSTEM = `You are a summarizer. Condense the content preserving key facts, decisions, and specifics. Remove redundancy and filler. If a focus is given, emphasize that aspect. Output the summary only — no preamble, no markdown fences.`;

export const summarizeTool: ToolDef = {
  name: "agentflow_summarize",
  description:
    "Condense long content — logs, error traces, documentation, conversation history.",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "Text to summarize" },
      focus: { type: "string", description: "What to preserve (errors only, key decisions, ...)" },
      max_length: {
        type: "string",
        enum: ["short", "medium", "long"],
        description: "Target length (default medium)"
      }
    },
    required: ["content"]
  },
  async handler(args, ctx) {
    const content = String(args?.content ?? "");
    if (!content) return { text: "Missing required input: content", isError: true };
    const focus = typeof args?.focus === "string" ? args.focus : "";
    const len = ((args?.max_length as string) ?? "medium").toLowerCase();
    const target = LENGTH_MAP[len] ?? LENGTH_MAP.medium;
    const user = focus
      ? `Target length: ${target}\nFocus: ${focus}\n\nContent:\n${content}`
      : `Target length: ${target}\n\nContent:\n${content}`;
    const { text, error } = await runCompletion(ctx, "agentflow_summarize", SYSTEM, user);
    if (error) return { text: error, isError: true };
    return { text: text || "(empty summary)" };
  }
};
