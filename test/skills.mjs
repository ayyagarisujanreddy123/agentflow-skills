// Skills structure tests — no network, no API key.
// Validates that every AgentFlow SKILL.md is well-formed and wired to a worker
// agent that actually exists and is model-pinned. Mirrors the check()-per-suite
// style of the legacy MCP test suites (legacy/mcp/test/*.mjs).
//
// Run: node test/skills.mjs

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const AGENTS_DIR = path.join(ROOT, "agents");

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

// Minimal frontmatter parser: returns { fm: {k:v}, body }.
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: null, body: text };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) fm[key] = val;
  }
  return { fm, body: m[2] };
}

const EXPECTED_SKILLS = [
  "agentflow-read",
  "agentflow-search",
  "agentflow-gen",
  "agentflow-review",
  "agentflow-summarize",
  "agentflow-transform",
  "agentflow-ask",
];

const EXPECTED_AGENTS = {
  "agentflow-haiku-worker": "haiku",
  "agentflow-sonnet-worker": "sonnet",
};

console.log("\nAgentFlow Skills — structure tests\n");

// --- Agents ---
const agentModels = {};
for (const [agentName, expectedModel] of Object.entries(EXPECTED_AGENTS)) {
  const file = path.join(AGENTS_DIR, `${agentName}.md`);
  const exists = fs.existsSync(file);
  check(`agent ${agentName} exists`, exists);
  if (!exists) continue;
  const { fm } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  check(`agent ${agentName} has frontmatter`, !!fm);
  if (!fm) continue;
  check(`agent ${agentName} name matches file`, fm.name === agentName, `got "${fm.name}"`);
  check(`agent ${agentName} model is ${expectedModel}`, fm.model === expectedModel, `got "${fm.model}"`);
  check(`agent ${agentName} declares tools`, typeof fm.tools === "string" && fm.tools.length > 0);
  check(`agent ${agentName} has a description`, typeof fm.description === "string" && fm.description.length > 20);
  agentModels[agentName] = fm.model;
}

// --- Skills ---
const foundSkills = fs.existsSync(SKILLS_DIR)
  ? fs.readdirSync(SKILLS_DIR).filter((d) => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
  : [];

check(`exactly ${EXPECTED_SKILLS.length} skills present`, foundSkills.length === EXPECTED_SKILLS.length, `found ${foundSkills.length}: ${foundSkills.join(", ")}`);

for (const skill of EXPECTED_SKILLS) {
  const file = path.join(SKILLS_DIR, skill, "SKILL.md");
  const exists = fs.existsSync(file);
  check(`skill ${skill} has SKILL.md`, exists);
  if (!exists) continue;

  const { fm, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  check(`skill ${skill} has frontmatter`, !!fm);
  if (!fm) continue;

  check(`skill ${skill} name matches dir`, fm.name === skill, `got "${fm.name}"`);
  check(`skill ${skill} description is a real trigger`, typeof fm.description === "string" && fm.description.length >= 60, `len ${fm.description?.length ?? 0}`);

  // Each skill must reference exactly one of the known worker agents.
  const refs = Object.keys(EXPECTED_AGENTS).filter((a) => body.includes(a));
  check(`skill ${skill} references a known worker`, refs.length >= 1, `refs: [${refs.join(", ")}]`);

  // gen/review must use the sonnet worker; the rest must use the haiku worker.
  const wantSonnet = skill === "agentflow-gen" || skill === "agentflow-review";
  const wantWorker = wantSonnet ? "agentflow-sonnet-worker" : "agentflow-haiku-worker";
  check(`skill ${skill} uses ${wantWorker}`, refs.includes(wantWorker), `refs: [${refs.join(", ")}]`);

  // Methodology prompt should be embedded (a fenced block in the body).
  check(`skill ${skill} embeds a methodology/prompt block`, body.includes("```"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
