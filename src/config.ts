import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import YAML from "yaml";
import { DEFAULT_PRICING, PricingTable } from "./pricing.js";

export interface ToolConfig {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  max_file_size_kb?: number;
  max_batch_files?: number;
  max_api_calls?: number;
  system_prompt?: string;
}

export interface AgentFlowConfig {
  api_key?: string;
  default_model: string;
  comparison_model: string;
  log_dir: string;
  tools: Record<string, ToolConfig>;
  pricing: PricingTable;
}

export const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".agentflow");
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "config.yaml");
export const DEFAULT_LOG_DIR = path.join(DEFAULT_CONFIG_DIR, "logs");

export const DEFAULT_CONFIG: AgentFlowConfig = {
  default_model: "claude-haiku-4-5-20251001",
  comparison_model: "claude-sonnet-4-6",
  log_dir: DEFAULT_LOG_DIR,
  tools: {
    agentflow_read:      { max_tokens: 2048, temperature: 0.2, max_file_size_kb: 500 },
    agentflow_search:    { max_tokens: 2048, temperature: 0.1, max_batch_files: 20, max_api_calls: 5 },
    agentflow_gen:       { max_tokens: 4096, temperature: 0.4 },
    agentflow_review:    { max_tokens: 2048, temperature: 0.2 },
    agentflow_summarize: { max_tokens: 1024, temperature: 0.3 },
    agentflow_transform: { max_tokens: 2048, temperature: 0.2 },
    agentflow_ask:       { max_tokens: 2048, temperature: 0.5 }
  },
  pricing: DEFAULT_PRICING
};

export function defaultConfigYaml(): string {
  return `# AgentFlow MCP config — hot-reloads on save

# API key (or set ANTHROPIC_API_KEY env var)
api_key: \${ANTHROPIC_API_KEY}

# Default model for all tools
default_model: claude-haiku-4-5-20251001

# Savings comparison baseline
comparison_model: claude-sonnet-4-6

# Logging
log_dir: ~/.agentflow/logs

# Per-tool overrides
tools:
  agentflow_read:
    max_tokens: 2048
    temperature: 0.2
    max_file_size_kb: 500
  agentflow_search:
    max_tokens: 2048
    temperature: 0.1
    max_batch_files: 20
    max_api_calls: 5
  agentflow_gen:
    max_tokens: 4096
    temperature: 0.4
  agentflow_review:
    max_tokens: 2048
    temperature: 0.2
  agentflow_summarize:
    max_tokens: 1024
    temperature: 0.3
  agentflow_transform:
    max_tokens: 2048
    temperature: 0.2
  agentflow_ask:
    max_tokens: 2048
    temperature: 0.5

pricing:
  claude-haiku-4-5-20251001:
    input: 0.80
    output: 4.00
  claude-sonnet-4-6:
    input: 3.00
    output: 15.00
  claude-opus-4-6:
    input: 15.00
    output: 75.00
`;
}

function expandPath(p: string): string {
  if (!p) return p;
  if (p.startsWith("~")) return path.join(os.homedir(), p.slice(1));
  return p;
}

function expandEnv(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => process.env[name] ?? "");
}

function mergeConfig(raw: any): AgentFlowConfig {
  const cfg: AgentFlowConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  if (!raw || typeof raw !== "object") return cfg;

  const apiKey = expandEnv(raw.api_key);
  if (typeof apiKey === "string" && apiKey.trim().length > 0) cfg.api_key = apiKey.trim();

  if (typeof raw.default_model === "string") cfg.default_model = raw.default_model;
  if (typeof raw.comparison_model === "string") cfg.comparison_model = raw.comparison_model;
  if (typeof raw.log_dir === "string") cfg.log_dir = expandPath(raw.log_dir);

  if (raw.tools && typeof raw.tools === "object") {
    for (const [name, override] of Object.entries(raw.tools as Record<string, ToolConfig>)) {
      cfg.tools[name] = { ...(cfg.tools[name] ?? {}), ...override };
    }
  }

  if (raw.pricing && typeof raw.pricing === "object") {
    cfg.pricing = { ...cfg.pricing, ...raw.pricing };
  }

  return cfg;
}

export class ConfigManager {
  private cfg: AgentFlowConfig;
  private watcher?: fs.FSWatcher;
  private listeners: Array<(c: AgentFlowConfig) => void> = [];

  constructor(public readonly configPath: string = DEFAULT_CONFIG_PATH) {
    this.cfg = this.load();
  }

  private load(): AgentFlowConfig {
    try {
      if (!fs.existsSync(this.configPath)) return mergeConfig({});
      const text = fs.readFileSync(this.configPath, "utf8");
      const parsed = YAML.parse(text);
      return mergeConfig(parsed);
    } catch (e) {
      return mergeConfig({});
    }
  }

  watch(): void {
    if (this.watcher) return;
    try {
      if (!fs.existsSync(this.configPath)) return;
      this.watcher = fs.watch(this.configPath, { persistent: false }, () => {
        setTimeout(() => {
          this.cfg = this.load();
          for (const l of this.listeners) {
            try { l(this.cfg); } catch { /* ignore */ }
          }
        }, 50);
      });
    } catch { /* ignore */ }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }

  onChange(listener: (c: AgentFlowConfig) => void): void {
    this.listeners.push(listener);
  }

  get(): AgentFlowConfig { return this.cfg; }

  getApiKey(): string | undefined {
    return this.cfg.api_key ?? process.env.ANTHROPIC_API_KEY;
  }

  getToolConfig(toolName: string): ToolConfig {
    return this.cfg.tools[toolName] ?? {};
  }

  getModelForTool(toolName: string): string {
    return this.getToolConfig(toolName).model ?? this.cfg.default_model;
  }

  getPricing(): PricingTable { return this.cfg.pricing; }
  getComparisonModel(): string { return this.cfg.comparison_model; }
  getLogDir(): string { return expandPath(this.cfg.log_dir); }
}
