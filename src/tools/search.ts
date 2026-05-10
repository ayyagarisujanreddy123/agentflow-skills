import * as path from "path";
import { ToolDef, runCompletion } from "./types.js";
import { resolveCwd, walkFiles, readTextFile } from "./fs-utils.js";

const SYSTEM = `You are a code search engine. Given a set of source files and a search query, identify the most relevant code locations.

Return results as a JSON array of {file, line_start, line_end, relevance, snippet} objects, ranked by relevance (0.0-1.0). Return ONLY the JSON array — no markdown fences, no explanation. If no matches found, return [].`;

interface SearchHit {
  file: string;
  line_start: number;
  line_end: number;
  relevance: number;
  snippet: string;
}

function rankByName(files: string[], query: string): string[] {
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length >= 3);
  return files
    .map(f => {
      const name = path.basename(f).toLowerCase();
      let score = 0;
      for (const t of terms) if (name.includes(t)) score++;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.f);
}

function buildBatchUser(files: string[], query: string): string {
  const parts: string[] = [`Query: ${query}`, "", "Files:"];
  for (const f of files) {
    const { text, binary, error } = readTextFile(f);
    if (binary || error) continue;
    const lines = text.split("\n");
    const max = Math.min(lines.length, 400);
    const numbered = lines.slice(0, max).map((ln, i) => `${i + 1}: ${ln}`).join("\n");
    parts.push(`=== FILE: ${f} ===`, numbered, "");
  }
  return parts.join("\n");
}

function parseHits(text: string): SearchHit[] {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "");
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr.filter((x: any) => x && typeof x.file === "string");
  } catch { return []; }
}

export const searchTool: ToolDef = {
  name: "agentflow_search",
  description:
    "Search across multiple files for code matching a natural language description. No vector DB, no indexing — Haiku reads and answers.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural-language description of what to find" },
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Directories or paths to search within (default: current working directory)"
      },
      max_results: { type: "number", description: "How many matches to return (default 10)" }
    },
    required: ["query"]
  },
  async handler(args, ctx) {
    const query = String(args?.query ?? "");
    if (!query) return { text: "Missing required input: query", isError: true };
    const searchPaths: string[] = Array.isArray(args?.paths) && args.paths.length > 0
      ? args.paths
      : ["."];
    const maxResults = Number(args?.max_results ?? 10);

    const toolCfg = ctx.config.getToolConfig("agentflow_search");
    const maxBatchFiles = toolCfg.max_batch_files ?? 20;
    const maxApiCalls = toolCfg.max_api_calls ?? 5;
    const maxKb = ctx.config.getToolConfig("agentflow_read").max_file_size_kb ?? 500;

    const all: string[] = [];
    for (const p of searchPaths) {
      const root = resolveCwd(p);
      try {
        const files = walkFiles(root, {
          maxFileSizeBytes: maxKb * 1024,
          maxFiles: maxBatchFiles * maxApiCalls * 2
        });
        all.push(...files);
      } catch { /* ignore */ }
    }
    if (all.length === 0) return { text: "[]" };

    const ranked = rankByName(Array.from(new Set(all)), query);
    const hits: SearchHit[] = [];
    const batches = Math.min(maxApiCalls, Math.ceil(ranked.length / maxBatchFiles));

    for (let b = 0; b < batches; b++) {
      const batch = ranked.slice(b * maxBatchFiles, (b + 1) * maxBatchFiles);
      if (batch.length === 0) break;
      const userPrompt = buildBatchUser(batch, query);
      const { text, error } = await runCompletion(ctx, "agentflow_search", SYSTEM, userPrompt);
      if (error) {
        if (hits.length === 0) return { text: error, isError: true };
        break;
      }
      hits.push(...parseHits(text));
      if (hits.length >= maxResults * 2) break;
    }

    const seen = new Set<string>();
    const dedup = hits.filter(h => {
      const key = `${h.file}:${h.line_start}-${h.line_end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    dedup.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
    return { text: JSON.stringify(dedup.slice(0, maxResults), null, 2) };
  }
};
