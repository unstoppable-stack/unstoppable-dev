# Phase 1 — Completed Work

## App 1: Coffee Assistant (CLI)

**Location:** `research/coffee-assistant/`

**What it is:** Two Node.js terminal apps — a Client with an AI assistant and a
Backoffice with order management — communicating over P2P.

**Stack modules exercised:**
- Hyperswarm (P2P discovery, topic-based connections)
- bare-rpc (request/response over P2P streams)
- Hyperbee (persistent KV storage for orders)
- QVAC SDK (local LLM, streaming, kv-cache)
- QVAC Tool Calling (4 tools: addToOrder, removeFromOrder, showMenu, sendOrder)
- NDJSON messaging (order protocol between apps)

**Knowledge extracted:**
- `skills/p2p-rpc/` — Full RPC wrapper pattern, numeric command IDs, error handling
- `skills/qvac-chat-app/` — End-to-end chat app structure
- `skills/qvac-tool-calling/` — Zod v4 schemas, ToolInput type, `tools: true` flag
- `recipes/p2p-rpc.md`, `recipes/qvac-tool-calling.md`, `recipes/qvac-kv-cache.md`
- `components/ai/` — chat-session.ts, model-manager.ts, tool-runner.ts
- `components/p2p/` — swarm-manager.ts, replication.ts
- `components/data/` — db-setup.ts, corestore-manager.ts

**Key lessons:**
- bare-rpc has a very low-level API (numeric command IDs, not method names)
- Zod v4 required (not v3) for QVAC ToolInput compatibility
- Don't use Zod refinements (.integer(), .min()) in tool schemas
- `tools: true` must be set in modelConfig for tool-calling models
- kv-cache is essential for multi-turn performance

---

## App 2: Coffee Assistant UI (Pear Desktop)

**Location:** `research/coffee-assistant-ui/`

**What it is:** The same Coffee Assistant concept, rebuilt as two Pear Desktop
apps with React UIs. This was the breakthrough app for understanding the
renderer vs worker architecture.

**Stack modules exercised:**
- Pear Runtime (desktop type, pear-electron, pear-bridge, pear-run)
- Bare Runtime (worker process, bare-* module dependencies)
- Worker Bridge (NDJSON over Pear.worker.pipe(), fd 3)
- Hyperswarm (P2P from worker, not renderer)
- bare-rpc (RPC from worker)
- Hyperbee (storage in worker)
- QVAC SDK (inference in worker)
- React 19 + styled-components (renderer UI)
- SWC + React Refresh (build tooling)

**Knowledge extracted:**
- `modules/pear.md` — Major rewrite: worker architecture, unrouted config, Pear.worker.pipe()
- `modules/bare.md` — Major rewrite: API cheatsheet, bare-* as npm deps, TextEncoder issue
- `skills/pear-desktop-app/SKILL.md` — Rewritten with worker architecture, dual build scripts
- `skills/pear-desktop-app/resources/worker-pattern.md` — NEW: Full worker bridge code
- `skills/pear-desktop-app/resources/troubleshooting.md` — 6 new worker error entries
- `core/patterns.md` — Fixed Bare-incompatible code (crypto.createHash, process signals)
- `core/verified-versions.md` — NEW: Pinned package versions from working apps
- Desktop worker warnings added to all 8 P2P/AI skills

**Key lessons (6 critical fixes documented in `research/coffee-assistant-ui/fixes/`):**
1. **Renderer vs Worker split** — P2P/AI/storage modules crash in Chromium
2. **pear.unrouted config** — Without it, worker JS is served as a web page
3. **Bare runtime modules** — Must be installed as npm packages (bare-process, etc.)
4. **TextEncoder not available** — Use charCodeAt() or bare-encoding
5. **Worker ready before slow init** — Send workerReady before P2P DHT/model loading
6. **Pear.worker.pipe()** — The only way to communicate worker→UI (not process.stdout)

---

## Infrastructure Built

| Component | Status |
|-----------|--------|
| CLI (`create-unstoppable-app`) | Working — scaffolds for Claude, Cursor, OpenCode |
| Agent Pack (source of truth) | `packages/agent-pack/src/` — 12 modules, 10 skills, 17 recipes |
| CLI ↔ Agent Pack sync | rsync from agent-pack/src → cli/agent-pack-src |
| Cursor builder | Fixed — now includes skill resources as `.mdc` files |
| Claude builder | Working — skills with resources in `.claude/skills/` |
| OpenCode builder | Working — skills with resources in `.opencode/skills/` |
| Website | `packages/website/` — Landing, Getting Started, Docs, Showcase |
