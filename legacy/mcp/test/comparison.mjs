#!/usr/bin/env node
// Comparison: Opus 4.6 (baseline) vs AgentFlow (Haiku 4.5) on same tasks.
// Measures input tokens, output tokens, cost, and shows side-by-side output.
//
// Cost: ~$0.30-0.50 total (3 tasks × ~$0.10-0.20 Opus + ~$0.01 Haiku).
// Requires: ANTHROPIC_API_KEY in .env.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const binPath = path.join(repoRoot, "bin", "agentflow-mcp");

// Load .env standalone
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("REPLACE_ME")) {
  console.error("ANTHROPIC_API_KEY missing"); process.exit(2);
}

// Pricing per 1M tokens (USD)
const PRICING = {
  "claude-haiku-4-5-20251001": { in: 0.80, out: 4.00 },
  "claude-opus-4-6": { in: 15.00, out: 75.00 }
};
const cost = (model, i, o) => (i * PRICING[model].in + o * PRICING[model].out) / 1_000_000;

const OPUS = "claude-opus-4-6";
const HAIKU = "claude-haiku-4-5-20251001";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ────────────── MCP stdio client ──────────────
class StdioRpc {
  constructor(child) {
    this.child = child; this.buf = ""; this.pending = new Map(); this.nextId = 1;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", c => this.onData(c));
    child.stderr.on("data", c => process.stderr.write(`[server] ${c}`));
  }
  onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id); resolve(msg);
      }
    }
  }
  request(method, params, timeoutMs = 60000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout: ${method}`)); }
      }, timeoutMs);
    });
  }
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }
}

let mcpChild, mcpRpc;
async function startMcp() {
  mcpChild = spawn("node", [binPath, "serve"], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
  mcpRpc = new StdioRpc(mcpChild);
  await mcpRpc.request("initialize", {
    protocolVersion: "2024-11-05", capabilities: {},
    clientInfo: { name: "comparison", version: "0.0.1" }
  });
  mcpRpc.notify("notifications/initialized", {});
}
function stopMcp() { mcpChild?.kill(); }

// Read ledger to get the agentflow tokens for the most recent call
function lastLedgerEntry() {
  const today = new Date().toISOString().slice(0, 10);
  const f = path.join(process.env.HOME, ".agentflow", "logs", `${today}.jsonl`);
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, "utf8").trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

async function callOpus(prompt, maxTokens = 1024) {
  const t0 = Date.now();
  const res = await anthropic.messages.create({
    model: OPUS, max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }]
  });
  const ms = Date.now() - t0;
  const i = res.usage.input_tokens, o = res.usage.output_tokens;
  return {
    text: res.content.map(b => b.text ?? "").join(""),
    in: i, out: o, cost: cost(OPUS, i, o), ms
  };
}

async function callAgent(toolName, args) {
  const t0 = Date.now();
  const res = await mcpRpc.request("tools/call", { name: toolName, arguments: args });
  const ms = Date.now() - t0;
  const text = res.result?.content?.[0]?.text ?? "";
  const led = lastLedgerEntry();
  return {
    text,
    in: led?.input_tokens ?? 0, out: led?.output_tokens ?? 0,
    cost: cost(HAIKU, led?.input_tokens ?? 0, led?.output_tokens ?? 0),
    ms,
    isError: !!res.result?.isError
  };
}

// ────────────── Tasks ──────────────
const TASKS = [
  {
    name: "Summarize README.md",
    setup: async () => {
      const content = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
      return {
        opusPrompt:
`Summarize the following document in 3 bullet points. Focus on what it does and how it differs from alternatives.

---
${content}
---`,
        agentTool: "agentflow_summarize",
        agentArgs: { content, instructions: "3 bullet points: what it does and how it differs", max_words: 80 }
      };
    },
    opusMax: 512
  },
  {
    name: "Read src/server.ts and answer query",
    setup: async () => {
      const content = fs.readFileSync(path.join(repoRoot, "src", "server.ts"), "utf8");
      return {
        opusPrompt:
`Read the following TypeScript file. Answer ONLY this question: "How is the API key hot-reloaded?" Give a 2-sentence answer.

---
${content}
---`,
        agentTool: "agentflow_read",
        agentArgs: { file_path: path.join(repoRoot, "src", "server.ts"), query: "How is the API key hot-reloaded?" }
      };
    },
    opusMax: 256
  },
  {
    name: "Generate unit test for sum(a,b)",
    setup: async () => {
      const fnSrc = `export function sum(a: number, b: number): number { return a + b; }`;
      return {
        opusPrompt:
`Generate a Node.js test (using node:test) for this function. Output ONLY the test code, no commentary.

\`\`\`ts
${fnSrc}
\`\`\``,
        agentTool: "agentflow_gen",
        agentArgs: {
          spec: "Generate a Node.js test (using node:test) for the function below. Output ONLY the test code, no commentary.",
          context: fnSrc
        }
      };
    },
    opusMax: 512
  }
];

// ────────────── Run ──────────────
function fmtUsd(n) { return "$" + n.toFixed(5); }
function pct(saved, base) { return base > 0 ? `${((saved / base) * 100).toFixed(1)}%` : "—"; }

async function main() {
  await startMcp();
  console.log("\n═══ Opus 4.6  vs  AgentFlow (Haiku 4.5) ═══\n");

  const rows = [];
  for (const task of TASKS) {
    console.log(`▸ ${task.name}`);
    const cfg = await task.setup();

    process.stdout.write("  · Opus...      ");
    const opus = await callOpus(cfg.opusPrompt, task.opusMax);
    console.log(`in=${opus.in} out=${opus.out} cost=${fmtUsd(opus.cost)} ${opus.ms}ms`);

    process.stdout.write("  · AgentFlow... ");
    const agent = await callAgent(cfg.agentTool, cfg.agentArgs);
    console.log(`in=${agent.in} out=${agent.out} cost=${fmtUsd(agent.cost)} ${agent.ms}ms`);

    rows.push({ name: task.name, opus, agent });

    console.log("\n  ── Opus full output ──");
    console.log(opus.text.split("\n").map(l => "    " + l).join("\n"));
    console.log("\n  ── AgentFlow full output ──");
    console.log(agent.text.split("\n").map(l => "    " + l).join("\n"));
    console.log();
  }

  // Totals
  const totals = rows.reduce(
    (a, r) => ({
      opusIn: a.opusIn + r.opus.in, opusOut: a.opusOut + r.opus.out, opusCost: a.opusCost + r.opus.cost,
      agentIn: a.agentIn + r.agent.in, agentOut: a.agentOut + r.agent.out, agentCost: a.agentCost + r.agent.cost
    }),
    { opusIn: 0, opusOut: 0, opusCost: 0, agentIn: 0, agentOut: 0, agentCost: 0 }
  );

  console.log("═══ Summary ═══\n");
  const tbl = [
    ["Task", "Opus tok (in/out)", "Opus $", "Haiku tok (in/out)", "Haiku $", "Saved $", "Saved %"],
    ...rows.map(r => [
      r.name.slice(0, 32),
      `${r.opus.in}/${r.opus.out}`,
      fmtUsd(r.opus.cost),
      `${r.agent.in}/${r.agent.out}`,
      fmtUsd(r.agent.cost),
      fmtUsd(r.opus.cost - r.agent.cost),
      pct(r.opus.cost - r.agent.cost, r.opus.cost)
    ]),
    ["TOTAL",
      `${totals.opusIn}/${totals.opusOut}`,
      fmtUsd(totals.opusCost),
      `${totals.agentIn}/${totals.agentOut}`,
      fmtUsd(totals.agentCost),
      fmtUsd(totals.opusCost - totals.agentCost),
      pct(totals.opusCost - totals.agentCost, totals.opusCost)
    ]
  ];

  // Print as fixed-width
  const widths = tbl[0].map((_, c) => Math.max(...tbl.map(r => String(r[c]).length)));
  for (const row of tbl) {
    console.log(row.map((cell, c) => String(cell).padEnd(widths[c])).join("  "));
  }

  // Token-routing perspective (what flows through primary context)
  console.log("\n═══ Primary-context token impact ═══");
  console.log("Opus model: every input token + output token enters the primary context.");
  console.log("AgentFlow:  primary context only sees the tool result (output tokens).");
  console.log();
  const opusCtxTok = totals.opusIn + totals.opusOut;
  const agentCtxTok = totals.agentOut; // primary only sees Haiku's output
  console.log(`Opus path:      ${opusCtxTok} tokens hit primary context`);
  console.log(`AgentFlow path: ${agentCtxTok} tokens hit primary context (${pct(opusCtxTok - agentCtxTok, opusCtxTok)} reduction)`);

  stopMcp();
  process.exit(0);
}

main().catch(e => { console.error(e); stopMcp(); process.exit(1); });
