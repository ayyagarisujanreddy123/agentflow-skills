import * as fs from "fs";
import * as path from "path";
import { PricingTable, costUsd } from "./pricing.js";

export interface LogEntry {
  timestamp: string;
  tool: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  haiku_cost_usd: number;
  sonnet_equivalent_usd: number;
  saved_usd: number;
  error?: string;
}

export interface ToolStats {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  haiku_cost: number;
  comparison_cost: number;
  saved: number;
}

export interface StatsSummary {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  haiku_cost: number;
  comparison_cost: number;
  saved: number;
  saved_pct: number;
  by_tool: Record<string, ToolStats>;
}

export class TokenLedger {
  constructor(public readonly logDir: string) {
    try { fs.mkdirSync(logDir, { recursive: true }); } catch { /* ignore */ }
  }

  private filenameForDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return path.join(this.logDir, `${y}-${m}-${day}.jsonl`);
  }

  log(input: {
    tool: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    pricing: PricingTable;
    comparison_model: string;
    error?: string;
  }): LogEntry {
    const haiku_cost_usd = costUsd(input.pricing, input.model, input.input_tokens, input.output_tokens);
    const sonnet_equivalent_usd = costUsd(input.pricing, input.comparison_model, input.input_tokens, input.output_tokens);
    const saved_usd = Math.max(0, sonnet_equivalent_usd - haiku_cost_usd);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      tool: input.tool,
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      haiku_cost_usd: round6(haiku_cost_usd),
      sonnet_equivalent_usd: round6(sonnet_equivalent_usd),
      saved_usd: round6(saved_usd),
      ...(input.error ? { error: input.error } : {})
    };
    try {
      fs.appendFileSync(this.filenameForDate(new Date()), JSON.stringify(entry) + "\n");
    } catch { /* ignore */ }
    return entry;
  }

  readRange(from: Date, to: Date): LogEntry[] {
    const entries: LogEntry[] = [];
    let files: string[] = [];
    try { files = fs.readdirSync(this.logDir).filter(f => f.endsWith(".jsonl")); }
    catch { return entries; }

    for (const file of files) {
      const m = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/.exec(file);
      if (!m) continue;
      const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      if (date < startOfUTC(from) || date > endOfUTC(to)) continue;
      try {
        const text = fs.readFileSync(path.join(this.logDir, file), "utf8");
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try {
            const e = JSON.parse(line) as LogEntry;
            const ts = new Date(e.timestamp);
            if (ts >= from && ts <= to) entries.push(e);
          } catch { /* skip bad line */ }
        }
      } catch { /* ignore file */ }
    }
    return entries;
  }

  summarize(entries: LogEntry[]): StatsSummary {
    const summary: StatsSummary = {
      calls: 0, input_tokens: 0, output_tokens: 0,
      haiku_cost: 0, comparison_cost: 0, saved: 0, saved_pct: 0,
      by_tool: {}
    };
    for (const e of entries) {
      summary.calls++;
      summary.input_tokens += e.input_tokens;
      summary.output_tokens += e.output_tokens;
      summary.haiku_cost += e.haiku_cost_usd;
      summary.comparison_cost += e.sonnet_equivalent_usd;
      summary.saved += e.saved_usd;
      const t = (summary.by_tool[e.tool] ??= {
        calls: 0, input_tokens: 0, output_tokens: 0,
        haiku_cost: 0, comparison_cost: 0, saved: 0
      });
      t.calls++;
      t.input_tokens += e.input_tokens;
      t.output_tokens += e.output_tokens;
      t.haiku_cost += e.haiku_cost_usd;
      t.comparison_cost += e.sonnet_equivalent_usd;
      t.saved += e.saved_usd;
    }
    summary.saved_pct = summary.comparison_cost > 0
      ? (summary.saved / summary.comparison_cost) * 100
      : 0;
    return summary;
  }
}

function round6(n: number): number { return Math.round(n * 1e6) / 1e6; }
function startOfUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}
function endOfUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
