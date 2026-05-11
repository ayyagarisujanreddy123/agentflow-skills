#!/usr/bin/env node
// Smoke test: drive the MCP server over stdio with JSON-RPC framing.
// Verifies initialize, tools/list, and a guarded tools/call (missing inputs).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const binPath = path.join(repoRoot, "bin", "agentflow-mcp");

// MCP stdio uses newline-delimited JSON
function frame(json) { return JSON.stringify(json) + "\n"; }

class StdioRpc {
  constructor(child) {
    this.child = child;
    this.buf = "";
    this.pending = new Map();
    this.nextId = 1;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => this.onData(chunk));
    child.stderr.on("data", c => process.stderr.write(`[server] ${c}`));
  }
  onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg);
      }
    }
  }
  request(method, params) {
    const id = this.nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(frame(msg));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 5000);
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
    env: { ...process.env, ANTHROPIC_API_KEY: "test-key-fake" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const rpc = new StdioRpc(child);

  const init = await rpc.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.0.1" }
  });
  check("initialize returns server info",
    init.result?.serverInfo?.name === "agentflow",
    `name=${init.result?.serverInfo?.name}`);
  check("server advertises tools capability",
    !!init.result?.capabilities?.tools);

  rpc.notify("notifications/initialized", {});

  const tools = await rpc.request("tools/list", {});
  const names = (tools.result?.tools ?? []).map(t => t.name).sort();
  const expected = [
    "agentflow_ask", "agentflow_gen", "agentflow_read", "agentflow_review",
    "agentflow_search", "agentflow_summarize", "agentflow_transform"
  ];
  check("tools/list returns 7 tools",
    JSON.stringify(names) === JSON.stringify(expected),
    `got [${names.join(", ")}]`);

  for (const t of tools.result?.tools ?? []) {
    if (!t.inputSchema || t.inputSchema.type !== "object") {
      check(`schema valid: ${t.name}`, false, "missing inputSchema.type=object");
    }
  }

  const missingPath = await rpc.request("tools/call", {
    name: "agentflow_read",
    arguments: { query: "foo" }
  });
  const missingText = missingPath.result?.content?.[0]?.text ?? "";
  check("agentflow_read errors on missing file_path",
    missingPath.result?.isError === true && /file_path/.test(missingText),
    missingText.slice(0, 80));

  const notFound = await rpc.request("tools/call", {
    name: "agentflow_read",
    arguments: { file_path: "/tmp/agentflow-does-not-exist-xyz.txt", query: "x" }
  });
  const nfText = notFound.result?.content?.[0]?.text ?? "";
  check("agentflow_read errors on missing file",
    notFound.result?.isError === true && /File not found/.test(nfText),
    nfText.slice(0, 80));

  const unknown = await rpc.request("tools/call", {
    name: "agentflow_does_not_exist",
    arguments: {}
  });
  const uText = unknown.result?.content?.[0]?.text ?? "";
  check("unknown tool returns isError",
    unknown.result?.isError === true && /Unknown tool/.test(uText),
    uText.slice(0, 80));

  const missingPrompt = await rpc.request("tools/call", {
    name: "agentflow_ask",
    arguments: {}
  });
  const mpText = missingPrompt.result?.content?.[0]?.text ?? "";
  check("agentflow_ask errors on missing prompt",
    missingPrompt.result?.isError === true && /prompt/.test(mpText),
    mpText.slice(0, 80));

  child.kill();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
