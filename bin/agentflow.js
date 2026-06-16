#!/usr/bin/env node
// agentflow — installer for the AgentFlow Claude Code Skills.
// Copies the bundled skills/ and agents/ into ~/.claude/ (or ./.claude with
// --project). Zero dependencies, plain Node ESM.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const SRC = { skills: path.join(PKG_ROOT, "skills"), agents: path.join(PKG_ROOT, "agents") };

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("-")) ?? "help";
const has = (f) => args.includes(f);
const dryRun = has("--dry-run");
const project = has("--project");
const force = has("--force");

function destBase() {
  return project ? path.join(process.cwd(), ".claude") : path.join(os.homedir(), ".claude");
}

// Bundled skill dirs (skills/<name>/) and agent files (agents/<name>.md).
function bundledSkills() {
  if (!fs.existsSync(SRC.skills)) return [];
  return fs.readdirSync(SRC.skills).filter((d) => fs.statSync(path.join(SRC.skills, d)).isDirectory());
}
function bundledAgents() {
  if (!fs.existsSync(SRC.agents)) return [];
  return fs.readdirSync(SRC.agents).filter((f) => f.endsWith(".md"));
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    const s = path.join(from, entry);
    const d = path.join(to, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function install() {
  const base = destBase();
  const skillsDst = path.join(base, "skills");
  const agentsDst = path.join(base, "agents");
  const skills = bundledSkills();
  const agents = bundledAgents();

  console.log(`AgentFlow → ${project ? "project" : "user"} install at ${base}`);
  if (dryRun) console.log("(dry run — nothing written)\n");

  for (const s of skills) {
    const to = path.join(skillsDst, s);
    const exists = fs.existsSync(to);
    if (exists && !force && !dryRun) { console.log(`  skip  skills/${s} (exists — use --force)`); continue; }
    console.log(`  ${dryRun ? "would copy" : exists ? "overwrite" : "copy "}  skills/${s}`);
    if (!dryRun) copyDir(path.join(SRC.skills, s), to);
  }
  for (const a of agents) {
    const to = path.join(agentsDst, a);
    const exists = fs.existsSync(to);
    if (exists && !force && !dryRun) { console.log(`  skip  agents/${a} (exists — use --force)`); continue; }
    console.log(`  ${dryRun ? "would copy" : exists ? "overwrite" : "copy "}  agents/${a}`);
    if (!dryRun) { fs.mkdirSync(agentsDst, { recursive: true }); fs.copyFileSync(path.join(SRC.agents, a), to); }
  }

  console.log(`\n${dryRun ? "Would install" : "Installed"} ${skills.length} skills + ${agents.length} worker agents.`);
  if (!dryRun) console.log("Open (or restart) Claude Code — the skills are now discoverable.");
}

function uninstall() {
  const base = destBase();
  console.log(`AgentFlow uninstall from ${base}`);
  let removed = 0;
  for (const s of bundledSkills()) {
    const p = path.join(base, "skills", s);
    if (fs.existsSync(p)) { console.log(`  ${dryRun ? "would remove" : "remove"}  skills/${s}`); if (!dryRun) fs.rmSync(p, { recursive: true, force: true }); removed++; }
  }
  for (const a of bundledAgents()) {
    const p = path.join(base, "agents", a);
    if (fs.existsSync(p)) { console.log(`  ${dryRun ? "would remove" : "remove"}  agents/${a}`); if (!dryRun) fs.rmSync(p, { force: true }); removed++; }
  }
  console.log(`\n${dryRun ? "Would remove" : "Removed"} ${removed} AgentFlow items. Your other skills/agents are untouched.`);
}

function list() {
  console.log("Bundled AgentFlow skills:");
  for (const s of bundledSkills()) console.log(`  - ${s}`);
  console.log("\nWorker agents:");
  for (const a of bundledAgents()) console.log(`  - ${a.replace(/\.md$/, "")}`);
}

function help() {
  console.log(`agentflow — install AgentFlow Skills into Claude Code

Usage:
  npx agentflow install [--project] [--dry-run] [--force]
  npx agentflow uninstall [--project] [--dry-run]
  npx agentflow list

Targets:
  (default)    ~/.claude/        available in every project
  --project    ./.claude/        only the current repo

Flags:
  --dry-run    show what would change, write nothing
  --force      overwrite skills/agents that already exist

Skills run inside your existing Claude Code session — no API key, no billing.
Repo: https://github.com/ayyagarisujanreddy123/agentflow-skills`);
}

switch (cmd) {
  case "install": install(); break;
  case "uninstall": uninstall(); break;
  case "list": list(); break;
  default: help(); break;
}
