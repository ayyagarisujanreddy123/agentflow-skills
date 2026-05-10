import { ToolDef, runCompletion } from "./types.js";

const SYSTEM = `You are a data transformation tool. Apply the given instruction to transform the input content. Output only the result — no explanation, no markdown fences.`;

export const transformTool: ToolDef = {
  name: "agentflow_transform",
  description:
    "Convert or restructure data — JSON to CSV, extract fields, reformat, clean.",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "Input data" },
      instruction: { type: "string", description: "What to do (convert to CSV, extract emails, ...)" }
    },
    required: ["content", "instruction"]
  },
  async handler(args, ctx) {
    const content = String(args?.content ?? "");
    const instruction = String(args?.instruction ?? "");
    if (!content) return { text: "Missing required input: content", isError: true };
    if (!instruction) return { text: "Missing required input: instruction", isError: true };
    const user = `Instruction: ${instruction}\n\nInput:\n${content}`;
    const { text, error } = await runCompletion(ctx, "agentflow_transform", SYSTEM, user);
    if (error) return { text: error, isError: true };
    return { text: text || "(empty result)" };
  }
};
