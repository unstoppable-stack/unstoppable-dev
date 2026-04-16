# Completed Work

## Reference Apps Built

### App 1: Coffee Assistant (CLI)

**Location:** `sandbox/coffee-assistant/`
**Platform:** Node.js terminal (not Pear)

Two terminal apps — a Client with an AI barista and a Backoffice with order
management — communicating over P2P.

| Category | Items Exercised |
|----------|----------------|
| **Platform** | Node.js (not Pear — terminal only) |
| **QVAC** | Chat completion (streaming), KV cache, Tool calling (4 tools, Zod v4), Model loading/download |
| **P2P** | Hyperswarm (topic join), bare-rpc (numeric command IDs), NDJSON messaging |
| **Data** | Hyperbee (order persistence), Hypercore (via Hyperbee) |

**Key lessons:**
- bare-rpc has a very low-level API (numeric command IDs, not method names)
- Zod v4 required (not v3) for QVAC ToolInput compatibility
- Don't use Zod refinements (.integer(), .min()) in tool schemas
- `tools: true` must be set in modelConfig for tool-calling models
- KV cache is essential for multi-turn performance

---

### App 2: Coffee Assistant UI (Pear Desktop)

**Location:** `sandbox/coffee-assistant-ui/`
**Platform:** Pear Desktop (two apps: client + backoffice)

Same concept rebuilt as Pear Desktop apps with React UIs. This was the
breakthrough app for understanding the renderer vs worker architecture.

| Category | Items Exercised |
|----------|----------------|
| **Platform** | Pear Desktop (pear-electron, pear-bridge, pear-run), Bare Runtime (bare-* deps), Worker bridge (Pear.worker.pipe, NDJSON) |
| **QVAC** | Chat completion (streaming), Tool calling, Think tag filtering |
| **P2P** | Hyperswarm (from worker), bare-rpc (from worker), Topic creation (Bare-compatible, charCodeAt) |
| **Data** | Hyperbee (in worker) |
| **Build** | SWC (src + worker), React Refresh, Dual watch, .swcrc/.swcrc.dev |
| **UI** | React 19, styled-components, pear-ctrl |

**6 critical fixes documented (`sandbox/coffee-assistant-ui/fixes/`):**
1. Renderer vs Worker split — P2P/AI modules crash in Chromium
2. `pear.unrouted` config — Without it, worker JS served as web page
3. Bare runtime modules — Must be installed as npm packages
4. TextEncoder not available — Use charCodeAt() or bare-encoding
5. Worker ready before slow init — Send workerReady before P2P/AI
6. `Pear.worker.pipe()` — The only way to communicate worker→UI

---

## Agent Pack Content Created

| Type | Count | Files |
|------|-------|-------|
| Core docs | 8 | architecture, cheatsheet, design-guide, patterns, principles, production-readiness, scenarios, verified-versions |
| Module docs | 12 | pear, bare, hyperswarm, hypercore, hyperbee, hyperdb, hyperdrive, hyperdht, corestore, qvac, wdk, expo-bare |
| Skills | 10 | pear-desktop-app, p2p-rpc, qvac-chat-app, qvac-tool-calling, local-inference, add-p2p-sync, offline-first-app, file-sharing, secure-communication, wallet-integration |
| Recipes | 18 | p2p-rpc, qvac-tool-calling, qvac-kv-cache, p2p-ndjson-messaging, local-inference, file-sharing, offline-first-app, secure-communication, wallet-integration, p2p-data-sync, local-p2p-testing, qvac-multimodal-vision, qvac-transcription, qvac-translation, qvac-embeddings-rag-sqlite, qvac-delegated-inference, qvac-model-sources, qvac-logging |
| Components | 8 | ai/chat-session, ai/model-manager, ai/tool-runner, p2p/swarm-manager, p2p/replication, data/corestore-manager, data/db-setup, wallet/wallet-setup |

## Infrastructure Built

| Component | Status |
|-----------|--------|
| CLI (`us` / `@unstoppable-stack/cli`) | Working — scaffolds for Claude, Cursor, OpenCode |
| Cursor builder | Fixed — includes skill resources as `.mdc` files |
| Claude builder | Working — skills with resources in `.claude/skills/` |
| OpenCode builder | Working — skills with resources + specialized agents |
| Website | Landing, Getting Started, Docs, Showcase pages |
| Roadmap | Coverage matrix, gap analysis, validation process |
