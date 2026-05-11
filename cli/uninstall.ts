import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import { DEFAULT_CONFIG_DIR } from "../src/config.js";

const CLAUDE_CONFIG_CANDIDATES = [
  path.join(os.homedir(), ".claude.json"),
  path.join(os.homedir(), ".config", "claude", "claude_code_config.json")
];

export function runUninstall(opts: { purge?: boolean }): void {
  console.log(chalk.bold("\nAgentFlow MCP — uninstall\n"));
  let removed = false;
  for (const p of CLAUDE_CONFIG_CANDIDATES) {
    if (!fs.existsSync(p)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      if (json?.mcpServers?.agentflow) {
        delete json.mcpServers.agentflow;
        fs.writeFileSync(p, JSON.stringify(json, null, 2));
        console.log(chalk.green("✓") + ` removed mcpServers.agentflow from ${p}`);
        removed = true;
      }
    } catch (e: any) {
      console.log(chalk.yellow("•") + ` could not parse ${p}: ${e?.message ?? e}`);
    }
  }
  if (!removed) console.log(chalk.yellow("•") + " no Claude Code config entry found");

  if (opts.purge) {
    if (fs.existsSync(DEFAULT_CONFIG_DIR)) {
      try {
        fs.rmSync(DEFAULT_CONFIG_DIR, { recursive: true, force: true });
        console.log(chalk.green("✓") + ` purged ${DEFAULT_CONFIG_DIR}`);
      } catch (e: any) {
        console.log(chalk.red("✗") + ` failed to purge ${DEFAULT_CONFIG_DIR}: ${e?.message ?? e}`);
      }
    }
  } else {
    console.log(chalk.gray(`  (kept ${DEFAULT_CONFIG_DIR} — re-run with --purge to delete logs and config)`));
  }
}
