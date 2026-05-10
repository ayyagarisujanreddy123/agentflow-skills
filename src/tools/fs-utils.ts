import * as fs from "fs";
import * as path from "path";

export const DEFAULT_SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build",
  "__pycache__", ".next", ".venv", ".cache", "coverage"
]);

export function isBinaryBuffer(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8192);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export function resolveCwd(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), p);
}

export function loadGitignore(root: string): string[] {
  const patterns: string[] = [];
  const file = path.join(root, ".gitignore");
  try {
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        patterns.push(line);
      }
    }
  } catch { /* ignore */ }
  return patterns;
}

function gitignoreToRegex(pattern: string): RegExp {
  let p = pattern;
  const negate = p.startsWith("!");
  if (negate) p = p.slice(1);
  if (p.endsWith("/")) p = p.slice(0, -1);
  let regex = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") { regex += ".*"; i++; }
      else regex += "[^/]*";
    } else if (c === "?") regex += "[^/]";
    else if (".+^$|()[]{}\\".includes(c)) regex += "\\" + c;
    else regex += c;
  }
  return new RegExp(`(^|/)${regex}($|/)`);
}

export function matchesGitignore(relPath: string, patterns: string[]): boolean {
  let ignored = false;
  for (const raw of patterns) {
    const negate = raw.startsWith("!");
    const pattern = negate ? raw.slice(1) : raw;
    const re = gitignoreToRegex(pattern);
    if (re.test(relPath)) ignored = !negate;
  }
  return ignored;
}

export interface WalkOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
  skipDirs?: Set<string>;
  respectGitignore?: boolean;
}

export function walkFiles(root: string, opts: WalkOptions = {}): string[] {
  const maxFiles = opts.maxFiles ?? 5000;
  const skipDirs = opts.skipDirs ?? DEFAULT_SKIP_DIRS;
  const gitignore = opts.respectGitignore !== false ? loadGitignore(root) : [];
  const out: string[] = [];

  function walk(dir: string) {
    if (out.length >= maxFiles) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full);
      if (skipDirs.has(e.name)) continue;
      if (gitignore.length > 0 && matchesGitignore(rel, gitignore)) continue;
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        try {
          const stat = fs.statSync(full);
          if (opts.maxFileSizeBytes && stat.size > opts.maxFileSizeBytes) continue;
        } catch { continue; }
        out.push(full);
      }
    }
  }

  walk(root);
  return out;
}

export function readTextFile(p: string): { text: string; binary: boolean; error?: string } {
  try {
    const buf = fs.readFileSync(p);
    if (isBinaryBuffer(buf)) return { text: "", binary: true };
    return { text: buf.toString("utf8"), binary: false };
  } catch (e: any) {
    return { text: "", binary: false, error: e?.message ?? String(e) };
  }
}
