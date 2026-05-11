#!/usr/bin/env node
// Unit tests: ledger I/O, pricing, config loading.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

const { TokenLedger } = await import(path.join(repoRoot, "dist/src/ledger.js"));
const { costUsd, DEFAULT_PRICING } = await import(path.join(repoRoot, "dist/src/pricing.js"));
const { ConfigManager, DEFAULT_CONFIG } = await import(path.join(repoRoot, "dist/src/config.js"));

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

// --- pricing ---
const haikuCost = costUsd(DEFAULT_PRICING, "claude-haiku-4-5-20251001", 1_000_000, 0);
check("haiku input price = $0.80 per 1M tok", Math.abs(haikuCost - 0.80) < 1e-6, `got ${haikuCost}`);

const sonnetOut = costUsd(DEFAULT_PRICING, "claude-sonnet-4-6", 0, 1_000_000);
check("sonnet output price = $15.00 per 1M tok", Math.abs(sonnetOut - 15.00) < 1e-6, `got ${sonnetOut}`);

const unknownCost = costUsd(DEFAULT_PRICING, "ghost-model", 1000, 1000);
check("unknown model returns 0", unknownCost === 0);

// --- ledger ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-test-"));
const ledger = new TokenLedger(tmpDir);

const entry = ledger.log({
  tool: "agentflow_read",
  model: "claude-haiku-4-5-20251001",
  input_tokens: 4000,
  output_tokens: 200,
  pricing: DEFAULT_PRICING,
  comparison_model: "claude-sonnet-4-6"
});
check("log entry has saved_usd > 0", entry.saved_usd > 0, `saved=${entry.saved_usd}`);
check("log writes JSONL file",
  fs.readdirSync(tmpDir).some(f => f.endsWith(".jsonl")));

ledger.log({
  tool: "agentflow_read",
  model: "claude-haiku-4-5-20251001",
  input_tokens: 1000,
  output_tokens: 50,
  pricing: DEFAULT_PRICING,
  comparison_model: "claude-sonnet-4-6"
});
ledger.log({
  tool: "agentflow_gen",
  model: "claude-haiku-4-5-20251001",
  input_tokens: 500,
  output_tokens: 800,
  pricing: DEFAULT_PRICING,
  comparison_model: "claude-sonnet-4-6"
});

const entries = ledger.readRange(new Date(0), new Date());
check("readRange returns 3 entries", entries.length === 3, `got ${entries.length}`);

const summary = ledger.summarize(entries);
check("summary calls = 3", summary.calls === 3);
check("summary input_tokens = 5500", summary.input_tokens === 5500);
check("summary output_tokens = 1050", summary.output_tokens === 1050);
check("summary by_tool agentflow_read = 2 calls",
  summary.by_tool.agentflow_read?.calls === 2);
check("summary by_tool agentflow_gen = 1 call",
  summary.by_tool.agentflow_gen?.calls === 1);
check("summary saved_pct > 0", summary.saved_pct > 0, `pct=${summary.saved_pct.toFixed(2)}`);

// --- ConfigManager (no config file → defaults) ---
const noConfigPath = path.join(tmpDir, "nonexistent.yaml");
const cmDefault = new ConfigManager(noConfigPath);
check("default_model is haiku",
  cmDefault.get().default_model === "claude-haiku-4-5-20251001");
check("default comparison_model is sonnet",
  cmDefault.get().comparison_model === "claude-sonnet-4-6");
check("default tool config for agentflow_read has max_file_size_kb=500",
  cmDefault.getToolConfig("agentflow_read").max_file_size_kb === 500);
check("getModelForTool falls back to default_model",
  cmDefault.getModelForTool("agentflow_read") === "claude-haiku-4-5-20251001");
check("unknown tool returns empty config object",
  JSON.stringify(cmDefault.getToolConfig("agentflow_unknown")) === "{}");

// --- ConfigManager (real YAML override) ---
const yamlPath = path.join(tmpDir, "config.yaml");
fs.writeFileSync(yamlPath, `
api_key: sk-test-from-yaml
default_model: claude-sonnet-4-6
tools:
  agentflow_review:
    model: claude-opus-4-6
    max_tokens: 1024
`);
const cmOverride = new ConfigManager(yamlPath);
check("api_key loaded from yaml",
  cmOverride.getApiKey() === "sk-test-from-yaml");
check("default_model overridden to sonnet",
  cmOverride.get().default_model === "claude-sonnet-4-6");
check("agentflow_review.model overridden to opus",
  cmOverride.getModelForTool("agentflow_review") === "claude-opus-4-6");
check("agentflow_read still uses overridden default_model",
  cmOverride.getModelForTool("agentflow_read") === "claude-sonnet-4-6");
check("agentflow_review.max_tokens = 1024",
  cmOverride.getToolConfig("agentflow_review").max_tokens === 1024);
check("agentflow_read.max_file_size_kb preserved from defaults",
  cmOverride.getToolConfig("agentflow_read").max_file_size_kb === 500);

// --- API key: env var fallback ---
const yamlNoKey = path.join(tmpDir, "nokey.yaml");
fs.writeFileSync(yamlNoKey, "default_model: claude-haiku-4-5-20251001\n");
const prevEnv = process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_API_KEY = "sk-from-env";
const cmEnv = new ConfigManager(yamlNoKey);
check("api_key falls back to env var",
  cmEnv.getApiKey() === "sk-from-env");
if (prevEnv === undefined) delete process.env.ANTHROPIC_API_KEY;
else process.env.ANTHROPIC_API_KEY = prevEnv;

// cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
