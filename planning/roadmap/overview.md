# Agent Pack Knowledge Roadmap — Overview

## Goal

Every module, pattern, and integration in the Unstoppable Stack should be backed
by **battle-tested knowledge**: code that was actually written, run, debugged,
and fixed in a real app. Theoretical docs lead to hallucinated code. Working apps
lead to working knowledge.

## Approach

1. **Build a reference app** that exercises the target modules/patterns
2. **Document every fix** — the gap between "what the docs say" and "what works"
3. **Extract knowledge** into agent pack (modules, skills, recipes, components)
4. **Validate** by scaffolding a new project and vibe-coding the same app from scratch

---

## Coverage by Category

### Platform / Runtime

| Item | Status | Validated By |
|------|--------|-------------|
| **Pear Desktop** (renderer + worker split) | Battle-tested | coffee-assistant-ui |
| **Pear Desktop** (pear config, unrouted, GUI) | Battle-tested | coffee-assistant-ui |
| **Bare Runtime** (API surface, bare-* as npm deps) | Battle-tested | coffee-assistant-ui |
| **Pear Terminal** | Not covered | — |
| **Expo Bare / Mobile (iOS)** | Not covered | — |
| **Expo Bare / Mobile (Android)** | Not covered | — |
| **bare-pack (mobile bundling)** | Not covered | — |
| **Pear Seeding / Distribution** | Not covered | — |
| **Electron (non-Pear desktop)** | Not covered | — |

### QVAC (Local AI)

| Item | Status | Validated By |
|------|--------|-------------|
| **Chat completion (streaming)** | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **KV Cache (multi-turn)** | Battle-tested | coffee-assistant |
| **Tool Calling (Zod v4 schemas)** | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **Model loading / unloading** | Battle-tested | coffee-assistant |
| **Model download with progress** | Battle-tested | coffee-assistant |
| **Think tag filtering** | Battle-tested | coffee-assistant-ui |
| **Multimodal / Vision** | Docs only | — |
| **Transcription (Whisper)** | Docs only | — |
| **Translation** | Docs only | — |
| **Text-to-Speech** | Docs only | — |
| **OCR** | Docs only | — |
| **Embeddings / RAG** | Docs only | — |
| **Delegated Inference** | In progress | unstoppable-node (`AIProvider` + streaming protocol, mock-tested) |
| **Sharded Models** | Docs only | — |
| **Model Registry / Discovery** | Docs only | — |
| **Logging / File Transport** | Docs only | — |
| **MCP (websearch, etc.)** | Not covered | — |

### P2P & Data

| Item | Status | Validated By |
|------|--------|-------------|
| **Hyperswarm** (topic join, peer discovery) | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **bare-rpc** (RPC over P2P streams) | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **Hyperbee** (KV storage, persistence) | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **Hypercore** (append-only log, indirect) | Battle-tested | coffee-assistant (via Hyperbee) |
| **NDJSON messaging** (protocol design) | Battle-tested | coffee-assistant, coffee-assistant-ui |
| **Topic creation** (Bare-compatible) | Battle-tested | coffee-assistant-ui |
| **Worker bridge** (Pear.worker.pipe) | Battle-tested | coffee-assistant-ui |
| **HyperDB** (structured P2P database) | Docs only | — |
| **Hyperdrive** (P2P file storage) | Docs only | — |
| **Corestore** (multi-core management) | Docs only | — |
| **Multi-writer replication (Autobase)** | Documented | modules/autobase.mdc, skills/add-multi-writer-sync |
| **SecretStream** (end-to-end encryption) | Docs only | — |
| **Protomux** (multiplexed channels) | Docs only | — |
| **Compact-encoding** (binary messages) | Docs only | — |
| **Hypercore replication** (standalone) | Docs only | — |
| **HyperDHT** (direct, not via Hyperswarm) | Docs only | — |

### WDK (Wallet / Payments)

| Item | Status | Validated By |
|------|--------|-------------|
| **Wallet creation** | Not validated | — |
| **Send / Receive USDt** | Not validated | — |
| **Balance queries** | Not validated | — |
| **Transaction history** | Not validated | — |
| **Payment verification over P2P** | Not validated | — |
| **Subscription payments** | Not validated | — |

### Build Tooling & DX

| Item | Status | Validated By |
|------|--------|-------------|
| **SWC compilation** (src + worker) | Battle-tested | coffee-assistant-ui |
| **React Refresh / HMR** | Battle-tested | coffee-assistant-ui |
| **Dual watch mode** (src + worker) | Battle-tested | coffee-assistant-ui |
| **Package version pinning** | Battle-tested | verified-versions.md |
| **.swcrc / .swcrc.dev configs** | Battle-tested | coffee-assistant-ui |
| **Testing patterns** (mock swarm, etc.) | Not covered | — |
| **CI/CD for Pear apps** | Not covered | — |

---

## Summary

| Category | Battle-tested | Docs only | Not covered | Total |
|----------|--------------|-----------|-------------|-------|
| Platform / Runtime | 3 | 0 | 6 | 9 |
| QVAC | 6 | 10 | 1 | 17 |
| P2P & Data | 7 | 7 | 1 | 15 |
| WDK | 0 | 0 | 6 | 6 |
| Build Tooling | 5 | 0 | 2 | 7 |
| **Total** | **21** | **17** | **16** | **54** |

**~39% battle-tested, ~31% docs only, ~30% not covered.**
