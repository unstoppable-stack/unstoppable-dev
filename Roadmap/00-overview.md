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

## Stack Coverage Matrix

| Module / Pattern | Status | Validated By | Agent Pack Files |
|------------------|--------|-------------|-----------------|
| **Pear Desktop** (renderer + worker) | Battle-tested | coffee-assistant-ui | modules/pear.md, skills/pear-desktop-app/ |
| **Bare Runtime** (API surface, bare-* deps) | Battle-tested | coffee-assistant-ui | modules/bare.md |
| **Hyperswarm** (P2P connections, topics) | Battle-tested | coffee-assistant, coffee-assistant-ui | modules/hyperswarm.md, skills/add-p2p-sync/ |
| **bare-rpc** (RPC over P2P) | Battle-tested | coffee-assistant, coffee-assistant-ui | skills/p2p-rpc/ |
| **Hyperbee** (KV storage) | Battle-tested | coffee-assistant, coffee-assistant-ui | modules/hyperbee.md |
| **Hypercore** (append-only log) | Battle-tested | coffee-assistant (indirect via Hyperbee) | modules/hypercore.md |
| **QVAC SDK** (chat, streaming, kv-cache) | Battle-tested | coffee-assistant, coffee-assistant-ui | modules/qvac.md, skills/qvac-chat-app/ |
| **QVAC Tool Calling** (Zod schemas) | Battle-tested | coffee-assistant, coffee-assistant-ui | skills/qvac-tool-calling/ |
| **Worker Bridge** (NDJSON pipe) | Battle-tested | coffee-assistant-ui | skills/pear-desktop-app/resources/worker-pattern.md |
| **React + styled-components in Pear** | Battle-tested | coffee-assistant-ui | skills/pear-desktop-app/resources/ui-kit.md |
| **SWC + React Refresh build** | Battle-tested | coffee-assistant-ui | skills/pear-desktop-app/resources/build-setup.md |
| **Package versions** | Battle-tested | coffee-assistant-ui, workbench | core/verified-versions.md |
| **HyperDB** (structured P2P database) | Docs only | — | modules/hyperdb.md |
| **Hyperdrive** (P2P file storage) | Docs only | — | modules/hyperdrive.md, skills/file-sharing/ |
| **Corestore** (multi-core management) | Docs only | — | modules/corestore.md |
| **WDK Wallet** (crypto payments) | Docs only | — | modules/wdk.md, skills/wallet-integration/ |
| **Expo Bare** (mobile P2P apps) | Docs only | — | modules/expo-bare.md |
| **SecretStream + Protomux** | Docs only | — | skills/secure-communication/ |
| **Pear Terminal apps** | Partial | coffee-assistant (ran as Node) | modules/pear.md (terminal section thin) |
| **Multi-writer replication** | Not covered | — | — |
| **Identity / auth** | Not covered | — | — |
| **QVAC Vision** | Docs only | — | recipes/qvac-multimodal-vision.md |
| **QVAC Transcription** | Docs only | — | recipes/qvac-transcription.md |
| **QVAC Translation** | Docs only | — | recipes/qvac-translation.md |
| **QVAC Embeddings / RAG** | Docs only | — | recipes/qvac-embeddings-rag-sqlite.md |
| **QVAC Delegated Inference** | Docs only | — | recipes/qvac-delegated-inference.md |
| **Offline-first sync** | Docs only | — | skills/offline-first-app/ |

**Legend:**
- **Battle-tested** = built in a real app, bugs found & fixed, knowledge extracted
- **Docs only** = agent pack has content but it was written from official docs, not validated
- **Partial** = some aspects validated, others theoretical
- **Not covered** = no agent pack content exists yet
