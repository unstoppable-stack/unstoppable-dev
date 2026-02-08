# Agent Pack Knowledge Gaps

Detailed analysis of what's currently in the agent pack, what's solid, and
what needs work — independent of which app validates it.

---

## Modules (packages/agent-pack/src/modules/)

### Solid (battle-tested)

| Module | File | Confidence | Notes |
|--------|------|-----------|-------|
| Pear | pear.md | High | Rewritten with worker architecture from coffee-assistant-ui |
| Bare | bare.md | High | Rewritten with API cheatsheet from coffee-assistant-ui |
| QVAC | qvac.md | High | Validated by both coffee-assistant apps |
| Hyperswarm | hyperswarm.md | Medium-High | Used in both apps, but docs were from official source |
| Hyperbee | hyperbee.md | Medium-High | Used for storage in both apps |
| Hypercore | hypercore.md | Medium | Used indirectly (via Hyperbee), not standalone |

### Needs Validation (docs-only)

| Module | File | Risk | Key Unknowns |
|--------|------|------|--------------|
| HyperDB | hyperdb.md | High | Schema API, query patterns, multi-writer behavior, differences from Hyperbee |
| Hyperdrive | hyperdrive.md | High | Mirroring, watching, large files, metadata handling |
| Corestore | corestore.md | Medium | Namespace patterns, multi-core replication setup |
| WDK | wdk.md | Very High | Entire API is from limited docs, no working code exists |
| Expo Bare | expo-bare.md | Very High | Mobile build pipeline, worklet lifecycle, bare-pack |
| HyperDHT | hyperdht.md | Medium | Used under the hood by Hyperswarm, rarely direct |
| SecretStream | (no module) | High | No dedicated module file — only in secure-communication skill |
| Protomux | (no module) | High | No dedicated module file — only in secure-communication skill |

---

## Skills (packages/agent-pack/src/skills/)

### Solid (battle-tested code examples)

| Skill | Confidence | Notes |
|-------|-----------|-------|
| pear-desktop-app | High | Full worker bridge code, build setup, troubleshooting |
| p2p-rpc | High | Complete RPC wrapper, numeric command IDs, error handling |
| qvac-chat-app | High | End-to-end chat with streaming, history, think filtering |
| qvac-tool-calling | High | Zod v4 schemas, ToolInput, multi-step tool loop |
| local-inference | Medium-High | Model loading/streaming validated, but full-example may need refresh |

### Needs Validation

| Skill | Risk | Key Issue |
|-------|------|-----------|
| add-p2p-sync | Medium | Code examples use patterns that weren't tested in real app |
| offline-first-app | High | Entire skill is theoretical — sync/merge patterns not validated |
| file-sharing | High | Hyperdrive patterns are from docs, not tested |
| secure-communication | High | SecretStream + Protomux code not tested in real app |
| wallet-integration | Very High | WDK API is speculative, no working reference |

---

## Recipes (packages/agent-pack/src/recipes/)

### Solid

| Recipe | Notes |
|--------|-------|
| p2p-rpc.md | Validated in coffee-assistant |
| qvac-tool-calling.md | Validated in coffee-assistant |
| qvac-kv-cache.md | Validated in coffee-assistant |
| p2p-ndjson-messaging.md | Validated in both apps |
| local-inference.md | Validated in both apps |

### Needs Validation

| Recipe | Risk | Notes |
|--------|------|-------|
| file-sharing.md | High | Hyperdrive patterns untested |
| offline-first-app.md | High | Merge/conflict patterns untested |
| secure-communication.md | High | Protomux channel patterns untested |
| wallet-integration.md | Very High | Speculative |
| p2p-data-sync.md | Medium | Replication patterns partially tested via Hyperbee |
| local-p2p-testing.md | Medium | Testing patterns not formally validated |
| qvac-multimodal-vision.md | Medium | From QVAC docs/examples, not built |
| qvac-transcription.md | Medium | From QVAC docs/examples, not built |
| qvac-translation.md | Medium | From QVAC docs/examples, not built |
| qvac-embeddings-rag-sqlite.md | Medium | From QVAC docs/examples, not built |
| qvac-delegated-inference.md | Medium | From QVAC docs, not built |
| qvac-model-sources.md | Low | Mostly reference info, less likely to break |
| qvac-logging.md | Low | Utility recipe, low risk |

---

## Components (packages/agent-pack/src/components/)

### Solid

| Component | Notes |
|-----------|-------|
| ai/chat-session.ts | From coffee-assistant |
| ai/model-manager.ts | From coffee-assistant |
| ai/tool-runner.ts | From coffee-assistant |

### Needs Review

| Component | Issue |
|-----------|-------|
| p2p/swarm-manager.ts | May have Bare-incompatible patterns (crypto imports?) |
| p2p/replication.ts | May have patterns that don't match real usage |
| data/corestore-manager.ts | HyperDB-focused, not validated |
| data/db-setup.ts | HyperDB-focused, not validated |
| wallet/wallet-setup.ts | Speculative WDK API |

---

## Core Docs (packages/agent-pack/src/core/)

| File | Status | Notes |
|------|--------|-------|
| verified-versions.md | Solid | From working apps |
| patterns.md | Updated | Fixed Bare-incompatible code, but some patterns still theoretical |
| architecture.md | Needs review | May reference outdated patterns |
| cheatsheet.md | Needs review | Quick reference, may have outdated APIs |
| principles.md | Stable | High-level, unlikely to break |
| design-guide.md | Stable | UI guidelines |
| scenarios.md | Needs review | Pre-implementation checklist — mostly good |
| production-readiness.md | Needs review | Deployment patterns not validated |

---

## Missing Entirely

Things the agent pack should have but doesn't:

1. **Pear Terminal App skill** — We have desktop but not terminal-specific guidance
2. **SecretStream module doc** — Only mentioned in secure-communication skill
3. **Protomux module doc** — Only mentioned in secure-communication skill
4. **Multi-writer replication guide** — Critical for collaborative apps
5. **Identity / auth patterns** — Phase 3 of the project plan
6. **Pear seeding / deployment** — How to distribute apps to users
7. **Testing patterns** — How to test P2P apps (mock swarms, local testing)
8. **Error recovery patterns** — What happens when storage corrupts, peers vanish mid-replication
