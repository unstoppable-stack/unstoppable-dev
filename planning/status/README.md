# Project Status — The Unstoppable Stack

> **Last updated:** 2026-04-15

---

## Recently Completed

- **2026-04-15**: **Scaffold E2E testing + feature simplification** — `packages/cli/`
  - Feature flags simplified: `p2p`, `kv-storage`, `autobase` removed (P2P+KV now base infra, autobase becomes a skill); `qvac` renamed to `local-ai`; new `wallet` flag added as stub
  - QVAC mock mode (`QVAC_MOCK=1` / `EXPO_PUBLIC_QVAC_MOCK=1` / RPC init flag) across all three generators — enables E2E testing without loading models
  - New worker harness (`e2e/worker-harness.js`) — spawns generated Pear Desktop `worker.js` in plain Node via injected `Pear` global, enabling NDJSON round-trip testing without Electron
  - Rewritten `e2e/test-scaffold.ts` — 3 platforms × levels 1–5, new variant matrix (bare / local-ai / wallet / local-ai+wallet), Node CLI spawn+stdout assertions, Desktop worker spawn tests with mock chat round-trip
  - Maestro flow generator — base KV round-trip (save/fetch) always, mock-gated AI chat flow
  - GitHub Actions workflow (`.github/workflows/cli.yml`) — unit / scaffold-smoke matrix / desktop-worker-smoke / nightly iOS build
  - Bonus fix: Expo Mobile generator was missing `corestore` + `hyperbee` deps (needed by the Bare worklet), causing `bare-pack` postinstall to fail. Added both.
  - **Verified locally:** 7/7 CI-safe variants pass (desktop 4/4, node-cli 3/3, mobile install 1/1)
  - Full plan: [`planning/features/scaffold-e2e-testing.md`](../features/scaffold-e2e-testing.md)

- **2026-04-14**: **Agent UI/UX + core improvements (inspiration + pi-mono derived)** — `packages/agent/`
  - **PI-AGENT-002**: Typed event bus with lifecycle events (turn, tool, message, compaction, session)
  - **PI-AGENT-004**: File mutation queue — serializes per-file writes, parallel across files
  - **PI-AGENT-007**: Structured truncation — head (file reads) vs tail (bash), dual line+byte limits
  - **PI-AGENT-011**: stdout takeover module for clean TUI rendering
  - **PI-AGENT-012 + INS-UI-001**: Terminal markdown renderer — LRU-cached, streaming-friendly
  - **PI-AGENT-013**: ANSI-aware text utils — `visibleWidth`, `wrapText`, `truncateToWidth`
  - **PI-AGENT-014**: JSONL session store — append-only, crash-safe, fork at any entry
  - **PI-AGENT-015 + PI-AGENT-009**: Tool sets + rendering patterns recipe for agent-pack
  - **INS-UI-002**: Spinner with elapsed time and stall detection (color interpolation)
  - **INS-UI-003**: Unicode progress bar with sub-character precision
  - **INS-UI-008**: Tool display with progressive disclosure and batch summaries
  - Integrated file-mutex into `write_file`/`patch_file`, structured truncation into all tools
  - Upgraded TerminalUI with spinner, markdown renderer, tool display components

## Workstreams

| # | Workstream | Folder | Status Summary |
|---|-----------|--------|----------------|
| 1 | [Agent Pack Content](./agent-pack-content/) | Knowledge by category | 52% battle-tested, 26% docs-only, 22% not covered |
| 2 | [Agent Pack Architecture](./agent-pack-architecture/) | Skill system, builders | Skills exist, no auto-activation yet |
| 3 | [Unstoppable Node](./node/) | Pear desktop sync app | Pairing & replication built |
| 4 | [Website](./website/) | unstoppable.dev | **All major pages complete** |
| 5 | [**Unstoppable Agent**](./agent/) | Local AI coding agent | **Phase 2 architecture — DA/OC parity** |
| 6 | [**Remote Coder**](./remote-coder/) | P2P mobile remote for AI assistants | **Phase 1 — CLI done, mobile scaffolded** |

---

## Coverage Summary (from Roadmap)

| Category | Battle-tested | Docs only | Not covered | Total |
|----------|--------------|-----------|-------------|-------|
| Platform / Runtime | 10 | 1 | 1 | 12 |
| QVAC (Local AI) | 7 | 10 | 1 | 18 |
| P2P & Data | 7 | 7 | 1 | 15 |
| WDK (Payments) | 0 | 0 | 6 | 6 |
| Build Tooling | 5 | 0 | 2 | 7 |
| **Total** | **29** | **18** | **11** | **58** |

---

## Recently Completed

- **2026-04-14**: **Agent pack improvements (inspiration-derived)** — `packages/agent-pack/`
  - **INS-AP-001**: Added `when_to_use`, `paths`, `version` frontmatter to all 19 SKILL.md files
  - **INS-AP-002**: Shortened all skill descriptions to ~80 chars for compact index listings
  - **INS-AP-005**: Extended `skill-rules.json` with 4 missing skills (scaffold-project, setup-node-cli, setup-local-testing, add-multi-writer-sync), aligned file patterns with SKILL.md `paths`
  - **INS-AP-003**: New recipe `sub-agent-patterns.mdc` — read-only explorer, planner, verifier, custom specialist agents
  - **INS-AP-013**: New recipe `long-context-hygiene.mdc` — per-tool limits, aggregate caps, micro-compact, auto-compact, circuit breakers, deferred tools
  - Synced all changes to `packages/cli/agent-pack-src/`

- **2026-04-08**: **Pear Desktop scaffold fix (ADR-001)** — `packages/cli/src/generators/pear-desktop.ts`
  - Replaced deprecated `Pear.worker.run()` + `window` with `pear-electron` + `pear-bridge` pattern
  - Replaced CJS `require()` with ESM `import` in generated `worker.js` (was incompatible with `"type": "module"`)
  - Added `pear.pre`, `pear.routes`, `pear.unrouted` to generated `package.json`
  - Added `pear-electron`, `pear-bridge`, `pear-run` to generated dependencies
  - New `app/bridge.js` spawns worker from renderer using `pear-run`
  - Added `<pear-ctrl>` native window controls to generated `index.html`
  - Added workspace hoisting warning to `scaffold-project` and `setup-pear-desktop` skill docs
  - Updated scaffold tester and experiment validation for new file structure

- **2026-03-27**: **Website overhaul** — `packages/website/`
  - Landing: 4 value pillars (added Node), 4-step How It Works (added Connect to Node), Node architecture section with 4 services, ecosystem cards
  - Getting Started: real platforms (Pear Desktop, Expo Mobile, Node CLI), features (p2p, kv-storage, local-ai, multi-writer), `us scaffold` command, Step 4 (Connect to Node)
  - Docs: products section (Node, Search, Agent), expanded modules (Hypercore, Corestore, Hyperbee, SecretStream), fixed quick links
  - Roadmap: workstreams with status badges, development phases timeline, Node architecture, stack coverage progress bars
  - Navbar + footer: Roadmap link

- **2026-03-27**: **Vault → Node rebrand** — Full rename across codebase
  - Packages: `packages/node/`, `packages/node-client/`
  - Classes: `NodeDaemon`, `NodeClient`, `connectToNode`
  - Planning: `node.md`, `node-technical.md`, `node-pairing-protocol.md`
  - Research, presentations, status trackers all updated

- **2026-03-17**: **Unstoppable Agent Phase 2 — Deep Agents / OpenCode parity** — `packages/agent/`
  - `write_todos` planning tool (structured plan the model can write/check off)
  - `task` subagent tool with context isolation (isolated conversation per subtask)
  - Auto-summarization (summarize middle turns instead of hard-truncating)
  - agentskills.io spec compliance (frontmatter validation, progressive disclosure, multi-source)
  - Permission system (allow/deny/ask per tool with glob patterns)
  - Middleware pipeline (beforeRound/afterRound/getTools/getPromptSection hooks)
  - Markdown-based agent definitions (from .agents/ or .unstoppable/agents/)
  - Retry with exponential backoff on provider calls
  - AGENTS.md support (loaded as project context alongside CLAUDE.md)
  - 19 active tools + 3 behind `/learn`, from 96KB bundle

- **2026-03-17**: **Unstoppable Agent Phase 1 complete** — `packages/agent/`
  - Agentic loop with plan → execute → verify → summarize + continuation injection
  - 14 active tools + 3 behind `/learn` (skill CRUD isolated from coding context)
  - Fallback tool call parsing (DeepSeek, XML, JSON formats)
  - `/learn` command for post-session skill extraction

- **2026-03-15**: **Unstoppable Agent initial implementation** — `packages/agent/`
  - OpenAI-compatible provider with streaming SSE (LM Studio, Ollama, cloud)
  - 17 tools: file (5), terminal (1), skills (6), knowledge (3), memory (2)
  - ReAct agent loop with tool calling + `<think>` filtering + fallback XML parsing
  - Terminal UI with readline, session save/load, MEMORY.md
  - Installable globally as `unstoppable-agent` command

- **2026-03-07**: Mobile support (Expo Bare) — battle-tested via codex-mobile-slack-p2p-2
  - Overhauled `setup-mobile-app` skill with Worklet/IPC/RPC pattern, pnpm addon linking, build order, storage paths
  - Created `qvac-mobile-expo` recipe for QVAC + Bare worklet runtime split
  - Updated `add-ai-chat` skill with mobile subsection, static import rule, diagnostics-first workflow
  - Added mobile-specific troubleshooting errors

---

## Priority Order

| Priority | What | Why | Workstreams |
|----------|------|-----|-------------|
| **0 — HIGH** | Test Agent with 30B+ coding model | Phase 2 architecture ready, needs capable model | Agent |
| **1 — HIGH** | Build Node Phase 1 | Validates 7 items at once (Corestore, Hyperdrive, etc.) | Node, Content |
| **2 — MEDIUM** | QVAC capabilities (Vision, RAG, Transcription) | Extends what apps can do | Content/QVAC |
| **3 — MEDIUM** | P2P advanced (HyperDB, SecretStream) | Enables collaborative + secure apps | Content/P2P |
| **4 — MEDIUM** | Agent pack auto-activation + tooling | Better DX for scaffolded projects | Architecture |
| **5 — MEDIUM** | Android device testing | Mobile support partial for Android | Content/Platform |
| **6 — LOW** | Website — logos, SEO, showcase | Polish pass, blocked on assets | Website |
| **7 — LOW** | WDK / Payments | Depends on WDK SDK maturity | Content/WDK |

---

## Conventions

- Keep "Next Up" to **3-5 tasks** per file
- Effort estimates: **Small** (hours) / **Medium** (1-2 days) / **Large** (3+ days)
- Date format: `YYYY-MM-DD`
- After completing a task: move to "Recently Completed" with date, add follow-up
