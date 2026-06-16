import { ToolDef, runCompletion } from "./types.js";

const LENGTH_MAP: Record<string, string> = {
  short: "~100 words",
  medium: "~250 words",
  long: "~500 words"
};

const SYSTEM = `You are a summarizer. Condense the content preserving key facts, decisions, and specifics. Remove redundancy and filler.

STRICT RULES:
1. If 'format' is specified (e.g. "3 bullet points", "numbered list", "single paragraph"), match it EXACTLY. Do not add sections, headers, or extra structure.
2. If 'max_words' is specified, stay within that budget. Count whitespace-separated words. Cut content, not the format constraint.
3. If 'instructions' are given, treat them as binding constraints, not suggestions.
4. If 'focus' is given, emphasize that aspect.
5. Output the summary only — no preamble ("Here is..."), no trailing notes, no markdown fences.
6. When the requested format conflicts with thoroughness, prefer the format. The caller asked for what they asked for.`;

export const summarizeTool: ToolDef = {
  name: "agentflow_summarize",
  description:
    "Condense long content — logs, error traces, documentation, conversation history.",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "Text to summarize" },
      focus: { type: "string", description: "What to preserve (errors only, key decisions, ...)" },
      format: { type: "string", description: "Exact output format (e.g. '3 bullet points', 'numbered list', 'single paragraph')" },
      instructions: { type: "string", description: "Free-form binding instructions for the summary" },
      max_words: { type: "number", description: "Hard upper bound on word count" },
      max_length: {
        type: "string",
        enum: ["short", "medium", "long"],
        description: "Target length preset (used when max_words not given; default medium)"
      }
    },
    required: ["content"]
  },
  async handler(args, ctx) {
    const content = String(args?.content ?? "");
    if (!content) return { text: "Missing required input: content", isError: true };
    const focus = typeof args?.focus === "string" ? args.focus : "";
    const format = typeof args?.format === "string" ? args.format : "";
    const instructions = typeof args?.instructions === "string" ? args.instructions : "";
    const maxWords = typeof args?.max_words === "number" ? args.max_words : 0;
    const len = ((args?.max_length as string) ?? "medium").toLowerCase();
    const lengthHint = maxWords > 0 ? `${maxWords} words MAX` : (LENGTH_MAP[len] ?? LENGTH_MAP.medium);

    const constraints: string[] = [`Target length: ${lengthHint}`];
    if (format) constraints.push(`REQUIRED format (must match exactly): ${format}`);
    if (instructions) constraints.push(`Instructions: ${instructions}`);
    if (focus) constraints.push(`Focus: ${focus}`);

    const user = `${constraints.join("\n")}\n\nContent:\n${content}`;
    const { text, error } = await runCompletion(ctx, "agentflow_summarize", SYSTEM, user);
    if (error) return { text: error, isError: true };
    return { text: text || "(empty summary)" };
  }
};
