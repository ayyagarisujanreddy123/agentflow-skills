import Anthropic from "@anthropic-ai/sdk";

export interface CompleteOpts {
  model: string;
  system: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  text: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  error?: string;
}

export class AnthropicClient {
  private sdk?: Anthropic;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.setApiKey(apiKey);
  }

  setApiKey(apiKey?: string): void {
    this.apiKey = apiKey;
    if (apiKey && apiKey.length > 0) {
      this.sdk = new Anthropic({ apiKey });
    } else {
      this.sdk = undefined;
    }
  }

  hasKey(): boolean { return !!this.sdk; }

  async complete(opts: CompleteOpts): Promise<CompleteResult> {
    if (!this.sdk) {
      return {
        text: "",
        input_tokens: 0,
        output_tokens: 0,
        model: opts.model,
        error: "API key not configured. Run: npx agentflow-mcp init"
      };
    }
    try {
      const resp = await this.sdk.messages.create({
        model: opts.model,
        max_tokens: opts.max_tokens ?? 2048,
        temperature: opts.temperature,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }]
      });
      const text = resp.content
        .map(block => (block.type === "text" ? block.text : ""))
        .join("");
      return {
        text,
        input_tokens: resp.usage?.input_tokens ?? 0,
        output_tokens: resp.usage?.output_tokens ?? 0,
        model: resp.model ?? opts.model
      };
    } catch (e: any) {
      const msg = e?.message || String(e);
      return {
        text: "",
        input_tokens: 0,
        output_tokens: 0,
        model: opts.model,
        error: `Anthropic API error: ${msg}`
      };
    }
  }
}
