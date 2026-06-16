import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import { fileURLToPath } from "url";
import chalk from "chalk";
import {
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  DEFAULT_LOG_DIR,
  defaultConfigYaml
} from "../src/config.js";

const CLAUDE_CONFIG_CANDIDATES = [
  path.join(os.homedir(), ".claude.json"),
  path.join(os.homedir(), ".config", "claude", "claude_code_config.json")
];

const NPM_MCP_ENTRY = {
  command: "npx",
  args: ["-y", "agentflow-mcp", "serve"]
};

function fromSourceMcpEntry(): { command: string; args: string[] } {
  // dist/cli/init.js → dist/cli/index.js (sibling)
  const here = path.dirname(fileURLToPath(import.meta.url));
  const entry = path.resolve(here, "index.js");
  return { command: process.execPath, args: [entry, "serve"] };
}

function findClaudeConfigPath(): string {
  for (const p of CLAUDE_CONFIG_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return CLAUDE_CONFIG_CANDIDATES[0];
}

async function promptApiKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.green("✓") + " ANTHROPIC_API_KEY detected in environment");
    return process.env.ANTHROPIC_API_KEY;
  }
  if (!process.stdin.isTTY) return "";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("Anthropic API key (leave blank to set later via env var): ", answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function mergeMcpConfig(existing: any, entry: { command: string; args: string[] }): { result: any; changed: boolean } {
  const cfg = existing && typeof existing === "object" ? { ...existing } : {};
  const servers = (cfg.mcpServers && typeof cfg.mcpServers === "object") ? { ...cfg.mcpServers } : {};
  const before = JSON.stringify(servers.agentflow ?? null);
  servers.agentflow = entry;
  const after = JSON.stringify(servers.agentflow);
  cfg.mcpServers = servers;
  return { result: cfg, changed: before !== after };
}

export async function runInit(opts: { dryRun?: boolean; fromSource?: boolean }): Promise<void> {
  const dryRun = !!opts.dryRun;
  const fromSource = !!opts.fromSource;
  const mcpEntry = fromSource ? fromSourceMcpEntry() : NPM_MCP_ENTRY;
  console.log(chalk.bold("\nAgentFlow MCP — init\n"));
  if (fromSource) {
    console.log(chalk.cyan("ℹ") + ` from-source mode: MCP entry will run \`${mcpEntry.command} ${mcpEntry.args.join(" ")}\``);
  }

  const apiKey = await promptApiKey();
  const configDir = DEFAULT_CONFIG_DIR;
  const configPath = DEFAULT_CONFIG_PATH;
  const logDir = DEFAULT_LOG_DIR;

  if (!dryRun) {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(logDir, { recursive: true });
  }
  console.log(`${dryRun ? "[dry] " : ""}config dir: ${configDir}`);
  console.log(`${dryRun ? "[dry] " : ""}log dir:    ${logDir}`);

  let yamlText = defaultConfigYaml();
  if (apiKey) yamlText = yamlText.replace("${ANTHROPIC_API_KEY}", apiKey);

  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow("•") + ` config exists, leaving in place: ${configPath}`);
  } else if (!dryRun) {
    fs.writeFileSync(configPath, yamlText);
    console.log(chalk.green("✓") + ` wrote ${configPath}`);
  } else {
    console.log(`[dry] would write ${configPath}`);
  }

  const claudePath = findClaudeConfigPath();
  let existing: any = {};
  if (fs.existsSync(claudePath)) {
    try { existing = JSON.parse(fs.readFileSync(claudePath, "utf8")); }
    catch { existing = {}; }
  }
  const { result, changed } = mergeMcpConfig(existing, mcpEntry);

  if (dryRun) {
    console.log(`[dry] would update ${claudePath}:`);
    console.log(JSON.stringify({ mcpServers: result.mcpServers }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(claudePath), { recursive: true });
    fs.writeFileSync(claudePath, JSON.stringify(result, null, 2));
    console.log((changed ? chalk.green("✓") : chalk.yellow("•")) + ` ${changed ? "updated" : "verified"} ${claudePath}`);
  }

  console.log(chalk.bold("\nNext steps:"));
  console.log("  1. Restart Claude Code (start a new session)");
  console.log("  2. Tools available: agentflow_read, agentflow_search, agentflow_gen, agentflow_review,");
  console.log("                      agentflow_summarize, agentflow_transform, agentflow_ask");
  console.log("  3. Check usage: npx agentflow-mcp stats");
  if (!apiKey) {
    console.log(chalk.yellow("\n!") + " API key not set. Either edit ~/.agentflow/config.yaml or export ANTHROPIC_API_KEY.");
  }
}
