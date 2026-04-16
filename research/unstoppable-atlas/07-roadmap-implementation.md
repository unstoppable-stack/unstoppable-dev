# Phased Roadmap & Implementation Plan

## Status: Proposed | Date: 2026-03-14

---

## Overview

The implementation is split into 4 phases, each delivering a functional, usable product. Each phase builds on the previous one, adding capabilities progressively.

---

## Phase 1: Foundation — "It Works Locally" (Weeks 1-4)

**Goal:** A working CLI and desktop app with local AI inference, local storage, and basic P2P connectivity. The minimum viable product that proves the concept.

### Milestone 1.1: Engine Core (Week 1-2)

**App:** `atlas-engine` (Pear Terminal)

| Task | Module | Priority |
|------|--------|----------|
| Scaffold Pear Terminal app | Pear Runtime | Critical |
| Hardware detection (GPU, VRAM, CPU) | System | Critical |
| QVAC model manager (list, download, select, load) | @qvac/sdk | Critical |
| Local inference with streaming | @qvac/sdk | Critical |
| Corestore initialization with namespaces | Corestore | Critical |
| Conversation storage (HyperDB schema) | HyperDB | Critical |
| Agent state storage (Hyperbee) | Hyperbee | Critical |
| Configuration management | Hyperbee | High |
| Model auto-selection based on hardware | QVAC + System | High |

**Deliverable:** Engine that loads models, runs inference, stores conversations locally.

### Milestone 1.2: CLI Interface (Week 2-3)

**App:** `atlas-cli` (Node.js CLI)

| Task | Module | Priority |
|------|--------|----------|
| Scaffold Node.js CLI with commander | Commander | Critical |
| `atlas start` / `atlas stop` (daemon management) | Process | Critical |
| `atlas status` (show node info, models, stats) | Display | Critical |
| `atlas chat` (interactive streaming chat) | QVAC + Readline | Critical |
| `atlas models list` / `atlas models pull` | QVAC | Critical |
| `atlas models pull --auto` (auto-detect best model) | QVAC + System | High |
| One-line installer script | Shell | High |
| Auto-update on start | GitHub releases | Medium |

**Deliverable:** Functional CLI matching Hyperspace's `aios-cli` feature set.

### Milestone 1.3: Basic P2P (Week 3-4)

**Module:** P2P networking added to engine

| Task | Module | Priority |
|------|--------|----------|
| Hyperswarm initialization and topic management | Hyperswarm | Critical |
| Peer connection handling with error recovery | Hyperswarm | Critical |
| Corestore replication on connection | Corestore | Critical |
| Capability manifest definition | bare-rpc | Critical |
| Capability exchange on peer connection | bare-rpc | High |
| Local capability registry (who can do what) | Hyperbee | High |
| `atlas peers` command (list connected peers) | CLI | High |
| `atlas capabilities` command | CLI | Medium |

**Deliverable:** Nodes discover each other, exchange capabilities, replicate data.

### Phase 1 Definition of Done:
- [ ] Engine runs as daemon, loads models, streams inference
- [ ] CLI provides full management and interactive chat
- [ ] Two nodes can discover each other and sync data
- [ ] One-line install works on macOS and Linux
- [ ] README with getting started guide

---

## Phase 2: Network — "It Works With Peers" (Weeks 5-8)

**Goal:** Full P2P capabilities: delegated inference, encrypted channels, data sync, file sharing. The product becomes truly useful for teams and power users.

### Milestone 2.1: Delegated Inference (Week 5-6)

| Task | Module | Priority |
|------|--------|----------|
| QVAC provider mode (serve inference on a topic) | QVAC | Critical |
| QVAC consumer delegation (send to chosen peer) | QVAC | Critical |
| Streaming token relay over encrypted connection | SecretStream | Critical |
| Model availability matching (what models can peer X run?) | Registry | High |
| Fallback: delegate → local if peer disconnects | QVAC | High |
| `atlas delegate --to <key>` command | CLI | Medium |

### Milestone 2.2: Encrypted Channels & RPC (Week 6-7)

| Task | Module | Priority |
|------|--------|----------|
| SecretStream encrypted channel establishment | SecretStream | Critical |
| Protomux channel multiplexing | Protomux | Critical |
| bare-rpc server/client over P2P | bare-rpc | Critical |
| RPC API: inference request, capability query, ping | bare-rpc | High |
| Group channel support (multi-peer encrypted) | Protomux | Medium |

### Milestone 2.3: Advanced Storage & Sync (Week 7-8)

| Task | Module | Priority |
|------|--------|----------|
| Selective replication (choose what syncs with whom) | Corestore | Critical |
| Hyperdrive initialization for file sharing | Hyperdrive | High |
| File share/receive commands | CLI + Hyperdrive | High |
| Personal device mesh (sync between own devices) | Hyperswarm | High |
| Peer invitation system (share key to connect) | CLI | Medium |
| `atlas sync status` command | CLI | Medium |
| `atlas files share <path>` / `atlas files get <key>` | CLI | Medium |

### Milestone 2.4: Desktop Application (Week 5-8, parallel)

**App:** `atlas-desktop` (Pear Desktop)

| Task | Module | Priority |
|------|--------|----------|
| Scaffold Pear Desktop app with React | Pear | Critical |
| IPC bridge to atlas-engine | pear-pipe | Critical |
| Chat interface with streaming | React | Critical |
| Model management UI (download, select, status) | React | Critical |
| Peer list and status | React | High |
| Settings and configuration | React | High |
| Conversation history browser | React | High |
| System tray integration | Pear | High |
| Dark/light theme | styled-components | Medium |

### Phase 2 Definition of Done:
- [ ] Peer A can delegate inference to Peer B over encrypted channel
- [ ] Files can be shared between peers via Hyperdrive
- [ ] Personal devices sync automatically
- [ ] Desktop app provides full chat and management UI
- [ ] Peer invitation works via CLI and desktop

---

## Phase 3: Intelligence — "It Thinks and Learns" (Weeks 9-14)

**Goal:** Agent pipelines, RAG knowledge bases, vision, transcription. The product becomes an AI platform, not just a chat tool.

### Milestone 3.1: Embeddings & RAG (Week 9-10)

| Task | Module | Priority |
|------|--------|----------|
| Local embedding generation via QVAC | QVAC | Critical |
| Vector storage in HyperDB | HyperDB | Critical |
| Document ingestion pipeline (text, PDF, markdown) | Processing | Critical |
| Semantic search over knowledge base | Embedding + HyperDB | Critical |
| RAG pipeline: retrieve context → inject → generate | QVAC | Critical |
| `atlas knowledge add <file>` / `atlas knowledge search <query>` | CLI | High |
| Knowledge base sync with trusted peers | Hypercore | Medium |

### Milestone 3.2: Agent Runtime (Week 10-12)

| Task | Module | Priority |
|------|--------|----------|
| Agent definition format (YAML/JSON) | Config | Critical |
| Agent lifecycle management (create, start, stop, list) | Runtime | Critical |
| Tool calling integration (QVAC tool calling models) | QVAC | Critical |
| Pipeline engine (chain steps, route results) | Orchestrator | High |
| Local + delegated step execution | QVAC + RPC | High |
| Built-in tools: search, store, file ops, web fetch | Tools | High |
| `atlas agent create`, `atlas agent run`, `atlas agent list` | CLI | High |
| Agent state persistence | HyperDB | Medium |

### Milestone 3.3: Multimodal AI (Week 12-14)

| Task | Module | Priority |
|------|--------|----------|
| Vision model loading and inference (QVAC) | QVAC | High |
| Image description and analysis | QVAC Vision | High |
| Whisper model loading for transcription | QVAC Whisper | High |
| Audio file transcription | QVAC Whisper | High |
| Integration with agent pipelines | Orchestrator | Medium |
| `atlas vision analyze <image>` | CLI | Medium |
| `atlas transcribe <audio>` | CLI | Medium |

### Milestone 3.4: Metrics & Dashboard (Week 12-14)

| Task | Module | Priority |
|------|--------|----------|
| Inference metrics collection (queries, tokens, latency) | Hypercore | High |
| Peer metrics (connections, bandwidth, uptime) | Hypercore | High |
| Storage metrics (cores, entries, disk usage) | Corestore | Medium |
| Dashboard view in desktop app | React | Medium |
| `atlas metrics` command | CLI | Medium |

### Phase 3 Definition of Done:
- [ ] Users can build a private knowledge base from their documents
- [ ] Semantic search works across ingested documents
- [ ] Agents can be defined, chained, and run with tool calling
- [ ] Vision and transcription work locally
- [ ] Dashboard shows node metrics and activity

---

## Phase 4: Ecosystem — "It Grows" (Weeks 15-20+)

**Goal:** Mobile app, payments, agent marketplace, collaborative research. The product becomes a platform that others build on.

### Milestone 4.1: Self-Custodial Payments (Week 15-16)

| Task | Module | Priority |
|------|--------|----------|
| WDK integration for multi-chain wallets | WDK | High |
| P2P micropayment protocol for inference services | WDK + RPC | High |
| Payment channels for streaming payments | WDK | Medium |
| Account abstraction for gasless UX | WDK AA | Medium |
| `atlas wallet create`, `atlas wallet balance`, `atlas wallet send` | CLI | Medium |
| Optional: earn for serving inference | WDK + Engine | Medium |

### Milestone 4.2: Mobile App (Week 16-18)

**App:** `atlas-mobile` (Expo + Bare)

| Task | Module | Priority |
|------|--------|----------|
| Scaffold Expo app with Bare worklet | Expo + Bare | High |
| Bare worklet with QVAC for mobile inference | QVAC + Bare | High |
| Chat interface (React Native) | RN | High |
| Sync with desktop via Hyperswarm | Hyperswarm | High |
| Small model selection for mobile hardware | QVAC | Medium |
| Push notifications for peer events | Expo Notifications | Low |

### Milestone 4.3: Agent Marketplace (Week 18-20)

| Task | Module | Priority |
|------|--------|----------|
| Agent packaging format (pear:// distributable) | Pear | Medium |
| Agent discovery via Hyperswarm topic | Hyperswarm | Medium |
| Agent rating and review system (P2P) | HyperDB | Medium |
| `atlas agent install pear://<key>` | CLI | Medium |
| Agent template gallery in desktop app | React | Low |

### Milestone 4.4: Collaborative Research (Week 20+)

| Task | Module | Priority |
|------|--------|----------|
| Research experiment definition format | Config | Medium |
| P2P experiment sharing via gossip (Hyperswarm topic) | Hyperswarm | Medium |
| Result aggregation with CRDT-like merging | Hypercore | Medium |
| Leaderboard tracking via HyperDB | HyperDB | Low |

### Phase 4 Definition of Done:
- [ ] Users can optionally pay/earn for inference services
- [ ] Mobile app syncs with desktop and runs small models locally
- [ ] Agents can be shared and installed via pear:// links
- [ ] Collaborative research experiments can run across peers

---

## Timeline Summary

```
Week  1-2  │ Engine core + local inference + storage
Week  2-3  │ CLI interface + one-line install
Week  3-4  │ Basic P2P + capability system
            │ ─── PHASE 1 COMPLETE: "It Works Locally" ───
Week  5-6  │ Delegated inference + encrypted channels
Week  6-7  │ RPC framework + advanced P2P
Week  7-8  │ File sharing + device mesh + peer invites
Week  5-8  │ Desktop app (parallel track)
            │ ─── PHASE 2 COMPLETE: "It Works With Peers" ───
Week  9-10 │ Embeddings + RAG knowledge base
Week 10-12 │ Agent runtime + pipelines + tool calling
Week 12-14 │ Vision + transcription + metrics
            │ ─── PHASE 3 COMPLETE: "It Thinks and Learns" ───
Week 15-16 │ Self-custodial payments
Week 16-18 │ Mobile app
Week 18-20 │ Agent marketplace
Week 20+   │ Collaborative research
            │ ─── PHASE 4 COMPLETE: "It Grows" ───
```

---

## Technical Decisions to Make Before Building

1. **Monorepo vs. Multi-repo?** Recommend monorepo with workspaces (`atlas-engine/`, `atlas-cli/`, `atlas-desktop/`, `atlas-mobile/`)
2. **TypeScript vs. JavaScript?** The Unstoppable Stack examples are JS; decide if we want TS for type safety
3. **HyperDB schemas:** Define conversation, agent, knowledge base schemas upfront
4. **Model defaults:** Which QVAC models ship as "recommended" for different hardware tiers?
5. **Topic naming convention:** Standard for Hyperswarm topics (e.g., `atlas:capabilities:v1`, `atlas:inference:v1`)
