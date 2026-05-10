export interface ModelPricing {
  input: number;
  output: number;
}

export type PricingTable = Record<string, ModelPricing>;

export const DEFAULT_PRICING: PricingTable = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 }
};

export function costUsd(
  pricing: PricingTable,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = pricing[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
