#!/usr/bin/env node
// Integration test: hits the real Anthropic API.
// Requires ANTHROPIC_API_KEY (loaded from .env if present).
// Costs a few cents of Haiku usage.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const binPath = path.join(repoRoot, "bin", "agentflow-mcp");

// Manually load .env (no dotenv import needed; this script runs standalone)
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("REPLACE_ME")) {
  console.error("✗ ANTHROPIC_API_KEY not set. Add real key to .env or export it.");
  process.exit(2);
}

function frame(json) { return JSON.stringify(json) + "\n"; }

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
        this.pending.delete(msg.id);
        resolve(msg);
      }
    }
  }
  request(method, params, timeoutMs = 30000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(frame({ jsonrpc: "2.0", id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }
  notify(method, params) {
    this.child.stdin.write(frame({ jsonrpc: "2.0", method, params }));
  }
}

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  const child = spawn("node", [binPath, "serve"], {
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const rpc = new StdioRpc(child);

  await rpc.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "integration-test", version: "0.0.1" }
  });
  rpc.notify("notifications/initialized", {});

  // 1. agentflow_ask — simplest, cheapest live call
  console.log("→ calling agentflow_ask (live Haiku)...");
  const ask = await rpc.request("tools/call", {
    name: "agentflow_ask",
    arguments: { prompt: "Reply with exactly the word: pong" }
  });
  const askText = ask.result?.content?.[0]?.text ?? "";
  check("agentflow_ask returns text", !ask.result?.isError && askText.length > 0,
    askText.slice(0, 80));
  check("agentflow_ask response contains 'pong'", /pong/i.test(askText),
    askText.slice(0, 80));

  // 2. agentflow_summarize — exercise content path
  console.log("→ calling agentflow_summarize...");
  const sum = await rpc.request("tools/call", {
    name: "agentflow_summarize",
    arguments: {
      content: "The quick brown fox jumps over the lazy dog. ".repeat(20),
      max_words: 10
    }
  });
  const sumText = sum.result?.content?.[0]?.text ?? "";
  check("agentflow_summarize returns non-empty", !sum.result?.isError && sumText.length > 0,
    sumText.slice(0, 80));

  // 3. agentflow_read — needs a real file
  console.log("→ calling agentflow_read on README.md...");
  const read = await rpc.request("tools/call", {
    name: "agentflow_read",
    arguments: { file_path: path.join(repoRoot, "README.md"), query: "what is this project" }
  });
  const readText = read.result?.content?.[0]?.text ?? "";
  check("agentflow_read returns content", !read.result?.isError && readText.length > 0,
    readText.slice(0, 80));

  child.kill();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  // Show ledger entry from this run
  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(process.env.HOME, ".agentflow", "logs", `${today}.jsonl`);
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    const recent = lines.slice(-3);
    console.log("\nRecent ledger entries:");
    for (const l of recent) {
      try {
        const e = JSON.parse(l);
        console.log(`  ${e.tool}  in=${e.input_tokens} out=${e.output_tokens} cost=$${e.haiku_cost_usd?.toFixed(5)}`);
      } catch {}
    }
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error("Integration test crashed:", err);
  process.exit(2);
});
