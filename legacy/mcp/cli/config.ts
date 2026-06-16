import * as fs from "fs";
import { spawnSync } from "child_process";
import chalk from "chalk";
import { DEFAULT_CONFIG_PATH, defaultConfigYaml } from "../src/config.js";

export function runConfig(opts: { edit?: boolean }): void {
  if (opts.edit) {
    const editor = process.env.EDITOR || process.env.VISUAL || "vi";
    if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
      fs.writeFileSync(DEFAULT_CONFIG_PATH, defaultConfigYaml());
      console.log(chalk.green("✓") + ` created ${DEFAULT_CONFIG_PATH}`);
    }
    const r = spawnSync(editor, [DEFAULT_CONFIG_PATH], { stdio: "inherit" });
    process.exit(r.status ?? 0);
    return;
  }
  if (!fs.existsSync(DEFAULT_CONFIG_PATH)) {
    console.log(chalk.yellow("•") + ` no config at ${DEFAULT_CONFIG_PATH} — run "npx agentflow-mcp init" first`);
    console.log("\n--- defaults ---");
    console.log(defaultConfigYaml());
    return;
  }
  console.log(fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8"));
}
