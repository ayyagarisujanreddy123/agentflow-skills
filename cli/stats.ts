import chalk from "chalk";
import { ConfigManager } from "../src/config.js";
import { TokenLedger, StatsSummary } from "../src/ledger.js";

export interface StatsOpts {
  range: "today" | "week" | "month" | "all";
  json?: boolean;
}

function rangeDates(range: StatsOpts["range"]): { from: Date; to: Date; label: string } {
  const now = new Date();
  const to = now;
  let from: Date;
  let label: string;
  switch (range) {
    case "week":
      from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      label = "Last 7 Days";
      break;
    case "month":
      from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      label = "Last 30 Days";
      break;
    case "all":
      from = new Date(0);
      label = "Lifetime";
      break;
    case "today":
    default:
      from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      label = "Today";
      break;
  }
  return { from, to, label };
}

function fmtUsd(n: number): string { return `$${n.toFixed(3)}`; }
function fmtNum(n: number): string { return n.toLocaleString("en-US"); }

function printSummary(label: string, s: StatsSummary): void {
  console.log(chalk.bold(`\nAgentFlow MCP — Session Stats (${label})`));
  console.log("─".repeat(48));
  console.log(`Tool calls:        ${fmtNum(s.calls)}`);
  console.log(`Tokens routed:     ${fmtNum(s.input_tokens)} in / ${fmtNum(s.output_tokens)} out`);
  console.log(`Haiku cost:        ${fmtUsd(s.haiku_cost)}`);
  console.log(`Sonnet equivalent: ${fmtUsd(s.comparison_cost)}`);
  console.log(`Saved:             ${chalk.green(fmtUsd(s.saved))} (${s.saved_pct.toFixed(0)}%)`);

  const entries = Object.entries(s.by_tool).sort(([, a], [, b]) => b.calls - a.calls);
  if (entries.length === 0) return;
  console.log("\nBy tool:");
  for (const [name, t] of entries) {
    const pad = name.padEnd(22);
    const callStr = `${t.calls} ${t.calls === 1 ? "call " : "calls"}`.padEnd(10);
    console.log(`  ${pad}${callStr}${fmtUsd(t.saved)} saved`);
  }
}

export function runStats(opts: StatsOpts): void {
  const config = new ConfigManager();
  const ledger = new TokenLedger(config.getLogDir());
  const { from, to, label } = rangeDates(opts.range);
  const entries = ledger.readRange(from, to);
  const summary = ledger.summarize(entries);
  if (opts.json) {
    console.log(JSON.stringify({ label, summary }, null, 2));
    return;
  }
  printSummary(label, summary);
  if (summary.calls === 0) console.log(chalk.gray("\n(no tool calls logged in this range)"));
}
