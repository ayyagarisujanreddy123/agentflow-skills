#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runInit } from "./init.js";
import { runUninstall } from "./uninstall.js";
import { runStats } from "./stats.js";
import { runConfig } from "./config.js";
import { runServe } from "./serve.js";

const program = new Command();

program
  .name("agentflow-mcp")
  .description("Smart tools that cost less than thinking — MCP server for Claude Code")
  .version("0.1.0");

program
  .command("init")
  .description("Configure Claude Code and create ~/.agentflow/config.yaml")
  .option("--dry-run", "preview changes without writing files")
  .action(async (opts) => { await runInit({ dryRun: !!opts.dryRun }); });

program
  .command("uninstall")
  .description("Remove MCP entry from Claude Code config")
  .option("--purge", "also delete ~/.agentflow/ (logs and config)")
  .action((opts) => { runUninstall({ purge: !!opts.purge }); });

program
  .command("serve")
  .description("Start MCP server on stdio (called by Claude Code, not by users)")
  .action(async () => { await runServe(); });

program
  .command("stats")
  .description("Token usage and savings report")
  .option("--week", "last 7 days")
  .option("--month", "last 30 days")
  .option("--all", "lifetime")
  .option("--today", "today only (default)")
  .option("--json", "machine-readable output")
  .action((opts) => {
    const range: "today" | "week" | "month" | "all" =
      opts.all ? "all" :
      opts.month ? "month" :
      opts.week ? "week" : "today";
    runStats({ range, json: !!opts.json });
  });

program
  .command("config")
  .description("Print current config (~/.agentflow/config.yaml)")
  .option("--edit", "open in $EDITOR")
  .action((opts) => { runConfig({ edit: !!opts.edit }); });

program.parseAsync(process.argv).catch(err => {
  process.stderr.write(`agentflow-mcp: ${err?.message ?? String(err)}\n`);
  process.exit(1);
});
