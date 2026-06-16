import { AnthropicClient } from "../client.js";
import { ConfigManager } from "../config.js";
import { TokenLedger } from "../ledger.js";

export interface ToolContext {
  client: AnthropicClient;
  config: ConfigManager;
  ledger: TokenLedger;
}

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, ctx: ToolContext) => Promise<ToolResult>;
}

export async function runCompletion(
  ctx: ToolContext,
  toolName: string,
  system: string,
  user: string,
  overrides: { max_tokens?: number; temperature?: number; model?: string } = {}
): Promise<{ text: string; error?: string }> {
  const cfg = ctx.config.get();
  const toolCfg = ctx.config.getToolConfig(toolName);
  const model = overrides.model ?? toolCfg.model ?? cfg.default_model;
  const result = await ctx.client.complete({
    model,
    system,
    user,
    max_tokens: overrides.max_tokens ?? toolCfg.max_tokens,
    temperature: overrides.temperature ?? toolCfg.temperature
  });
  ctx.ledger.log({
    tool: toolName,
    model: result.model,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    pricing: ctx.config.getPricing(),
    comparison_model: ctx.config.getComparisonModel(),
    error: result.error
  });
  return { text: result.text, error: result.error };
}
