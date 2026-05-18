# Changelog

All notable changes to AgentFlow MCP will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-18

First public release on npm.

### Added
- MCP server (stdio) exposing 7 tools to Claude Code:
  - `agentflow_read` — read a file via Haiku, return only relevant sections
  - `agentflow_search` — natural-language code search across files
  - `agentflow_gen` — generate tests, boilerplate, docs, configs (Sonnet)
  - `agentflow_review` — review code for bugs (Sonnet)
  - `agentflow_summarize` — condense long content
  - `agentflow_transform` — reformat / convert data
  - `agentflow_ask` — minimal-context Q&A
- Per-tool model routing in `~/.agentflow/config.yaml` with file-watch hot-reload (no restart needed on config change).
- Token ledger at `~/.agentflow/logs/YYYY-MM-DD.jsonl` recording per-call cost and savings against a Sonnet baseline.
- CLI subcommands: `init`, `init --dry-run`, `init --from-source`, `uninstall`, `uninstall --purge`, `stats` (`--week` / `--month` / `--all`), `config` (`--edit`), `serve`.
- Test suite: 28 unit + 7 smoke + 4 integration + cost-comparison benchmark.
- README walkthrough, CONTRIBUTING.md, COMPARISON.md, TESTING.md, CLAUDE.md.

### Benchmark
- 3-task comparison vs `claude-opus-4-6` baseline (2026-05-10):
  - 93.8% cost reduction
  - 80.2% primary-context token reduction
  - Output correctness at parity

[Unreleased]: https://github.com/ayyagarisujanreddy123/AgentFlow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ayyagarisujanreddy123/AgentFlow/releases/tag/v0.1.0
