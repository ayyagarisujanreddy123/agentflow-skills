// Installer tests — no network. Drives bin/agentflow.js into a temp project
// dir (--project mode) and checks copy / skip / force / uninstall / dry-run.
//
// Run: node test/installer.mjs

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin", "agentflow.js");

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ""}`); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-test-"));
function run(...a) {
  return execFileSync("node", [BIN, ...a], { cwd: tmp, encoding: "utf8" });
}
const skillsDst = path.join(tmp, ".claude", "skills");
const agentsDst = path.join(tmp, ".claude", "agents");

console.log("\nAgentFlow installer tests\n");

try {
  // dry-run writes nothing
  run("install", "--project", "--dry-run");
  check("dry-run creates no .claude dir", !fs.existsSync(path.join(tmp, ".claude")));

  // real install
  const out = run("install", "--project");
  check("install reports 7 skills + 2 agents", /7 skills \+ 2 worker agents/.test(out), out.trim().split("\n").pop());
  check("review SKILL.md copied", fs.existsSync(path.join(skillsDst, "agentflow-review", "SKILL.md")));
  check("haiku worker copied", fs.existsSync(path.join(agentsDst, "agentflow-haiku-worker.md")));
  check("sonnet worker copied", fs.existsSync(path.join(agentsDst, "agentflow-sonnet-worker.md")));
  check("all 7 skill dirs present", fs.readdirSync(skillsDst).length === 7, `got ${fs.readdirSync(skillsDst).length}`);

  // re-install skips existing without --force
  const out2 = run("install", "--project");
  check("re-install skips existing", /skip\s+skills\/agentflow-review/.test(out2));

  // --force overwrites
  const out3 = run("install", "--project", "--force");
  check("--force overwrites", /overwrite\s+skills\/agentflow-review/.test(out3));

  // list
  check("list shows a skill", /agentflow-summarize/.test(run("list")));

  // uninstall removes AgentFlow items
  run("uninstall", "--project");
  check("uninstall removed skills", !fs.existsSync(path.join(skillsDst, "agentflow-review")));
  check("uninstall removed agents", !fs.existsSync(path.join(agentsDst, "agentflow-haiku-worker.md")));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
