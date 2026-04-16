# Feature Matrix: Detailed Capabilities

## Status: Proposed | Date: 2026-03-14

---

## 1. Core Features (Must Have — MVP)

### F1: Local AI Inference
**Priority:** Critical | **Hyperspace Equivalent:** Inference capability

| Aspect | Detail |
|--------|--------|
| **What** | Run LLM inference entirely on-device using QVAC SDK |
| **Models** | Llama 3.2 (1B, 3B), Qwen 3 (0.6B, 4B, 7B), Salamandra 2B |
| **Features** | Streaming tokens, KV cache for sessions, model hot-swap |
| **Hardware** | Apple Silicon, NVIDIA CUDA, AMD ROCm, CPU fallback |
| **Offline** | Full functionality without any network connection |
| **Our Edge** | Hyperspace sends queries to remote nodes; we keep them local |

**Implementation:**
- QVAC SDK `loadModel()` → `completion()` → `unloadModel()`
- Auto-detect hardware → select optimal model
- Model download manager with progress tracking
- Session persistence with KV cache IDs

---

### F2: P2P Peer Discovery & Networking
**Priority:** Critical | **Hyperspace Equivalent:** libp2p network + relay

| Aspect | Detail |
|--------|--------|
| **What** | Find and connect to peers using topic-based DHT discovery |
| **Protocol** | Hyperswarm over HyperDHT (Noise-encrypted) |
| **NAT** | Built-in hole-punching + relay fallback |
| **Topics** | Capability topics, team topics, personal mesh topics |
| **Our Edge** | No bootstrap server dependency; DHT is fully distributed |

**Implementation:**
- Hyperswarm `join(topic)` for capability discovery
- Connection management with maxPeers limits
- Automatic reconnection on disconnect
- Peer scoring based on uptime and responsiveness

---

### F3: Local Data Storage
**Priority:** Critical | **Hyperspace Equivalent:** DHT storage

| Aspect | Detail |
|--------|--------|
| **What** | Persistent local storage for conversations, agent state, knowledge |
| **Stack** | Corestore → Hypercore (logs) + Hyperbee (KV) + HyperDB (schemas) |
| **Features** | Append-only audit trail, indexed queries, batch operations |
| **Our Edge** | Structured schemas with indexes vs. raw DHT key-value |

**Implementation:**
- Corestore with namespaced cores
- HyperDB schemas for conversations, agents, knowledge
- Hyperbee for fast KV lookups (config, state, capabilities)
- Full-text search over stored data

---

### F4: P2P Data Replication
**Priority:** Critical | **Hyperspace Equivalent:** GossipSub + CRDT

| Aspect | Detail |
|--------|--------|
| **What** | Sync data between peers — personal devices or trusted peers |
| **Mechanism** | Hypercore replication over Hyperswarm connections |
| **Levels** | Personal mesh (full sync), trusted peers (selective), network (none) |
| **Conflict Resolution** | Hypercore is append-only; HyperDB uses last-writer-wins |
| **Our Edge** | You control exactly what replicates and to whom |

**Implementation:**
- `store.replicate(conn)` on Hyperswarm connections
- Namespace-level sync permissions
- Replication progress tracking
- Selective replication by topic/namespace

---

### F5: CLI Interface
**Priority:** Critical | **Hyperspace Equivalent:** aios-cli

| Aspect | Detail |
|--------|--------|
| **What** | Command-line tool for managing the node, running agents, chatting |
| **Commands** | `atlas start`, `atlas status`, `atlas chat`, `atlas peers`, `atlas models` |
| **Features** | Background daemon mode, auto-update, hardware detection |
| **Our Edge** | Richer commands: model management, peer management, data export |

**Key Commands:**
```
atlas start [--background]     Start the engine
atlas stop                     Stop the engine
atlas status                   Show node status, peers, capabilities
atlas chat [--model <name>]    Interactive AI chat
atlas models list              List available models
atlas models pull <name>       Download a model
atlas models pull --auto       Auto-select best model for hardware
atlas peers                    List connected peers
atlas peers invite <key>       Invite a peer to your network
atlas capabilities             Show/configure node capabilities
atlas export <namespace>       Export data from a namespace
atlas wallet [commands]        WDK wallet management (optional)
```

---

### F6: Desktop Application
**Priority:** High | **Hyperspace Equivalent:** Tray App

| Aspect | Detail |
|--------|--------|
| **What** | Pear Desktop app with full UI for chat, agents, data, peers |
| **UI** | React + styled-components, modern dashboard |
| **Architecture** | UI (Pear Desktop) + Engine (Pear Terminal) via IPC |
| **Features** | Chat interface, agent builder, peer management, settings |
| **Our Edge** | Full-featured UI vs. Hyperspace's minimal tray app |

---

## 2. Network Features (Differentiators)

### F7: Capability-Based Service Discovery
**Priority:** High | **Hyperspace Equivalent:** 9 capabilities system

| Aspect | Detail |
|--------|--------|
| **What** | Nodes advertise capabilities; peers discover services they need |
| **Mechanism** | Capability manifest exchanged via RPC on connection |
| **Registry** | Local registry of known peers and their capabilities |
| **Matching** | Query the registry: "find peers with GPU inference for 7B model" |

---

### F8: Delegated AI Inference
**Priority:** High | **Hyperspace Equivalent:** HIN inference serving

| Aspect | Detail |
|--------|--------|
| **What** | Offload inference to a trusted peer when local hardware is weak |
| **Protocol** | QVAC delegated inference over Hyperswarm topic |
| **Security** | Encrypted stream; you choose the provider by public key |
| **Streaming** | Token-by-token streaming over P2P connection |
| **Our Edge** | You choose who serves you; Hyperspace assigns via HCS |

---

### F9: Encrypted P2P Channels
**Priority:** High | **Hyperspace Equivalent:** None (only GossipSub)

| Aspect | Detail |
|--------|--------|
| **What** | Private encrypted communication channels between specific peers |
| **Stack** | SecretStream + Protomux |
| **Types** | 1:1 channels, group channels, broadcast channels |
| **Our Edge** | Hyperspace has no private messaging; all via public gossip |

---

### F10: P2P File Sharing
**Priority:** Medium | **Hyperspace Equivalent:** DHT block storage

| Aspect | Detail |
|--------|--------|
| **What** | Share files and folders between peers using Hyperdrive |
| **Features** | Folder sync, file versioning, mirror drives |
| **Use Cases** | Share models, datasets, documents, agent configs |
| **Our Edge** | Full filesystem semantics vs. raw block storage |

---

### F11: Local Embeddings & RAG
**Priority:** Medium | **Hyperspace Equivalent:** Embedding capability

| Aspect | Detail |
|--------|--------|
| **What** | Generate vector embeddings locally, build searchable knowledge bases |
| **Stack** | QVAC SDK embeddings + HyperDB vector storage |
| **Features** | Index local documents, semantic search, RAG pipeline |
| **Our Edge** | Your knowledge base stays on your device; private RAG |

---

### F12: P2P RPC Framework
**Priority:** Medium | **Hyperspace Equivalent:** libp2p protocols

| Aspect | Detail |
|--------|--------|
| **What** | Type-safe request/response patterns over P2P connections |
| **Stack** | bare-rpc over Hyperswarm |
| **Patterns** | Request/response, streaming, notifications |
| **Our Edge** | Clean RPC API vs. raw protocol buffers |

---

## 3. Advanced Features (Phase 2+)

### F13: Agent Runtime & Pipelines
**Priority:** Medium | **Hyperspace Equivalent:** AGI research system

| Aspect | Detail |
|--------|--------|
| **What** | Define and run multi-step AI agent workflows |
| **Features** | Pipeline definition, step routing, result aggregation |
| **Local/P2P** | Each step can run locally or delegate to a capable peer |

---

### F14: Vision & Multimodal AI
**Priority:** Medium | **Hyperspace Equivalent:** None

| Aspect | Detail |
|--------|--------|
| **What** | Local image analysis using QVAC multimodal models |
| **Features** | Image description, OCR, document analysis |

---

### F15: Audio Transcription
**Priority:** Medium | **Hyperspace Equivalent:** None

| Aspect | Detail |
|--------|--------|
| **What** | Local speech-to-text using QVAC Whisper models |
| **Features** | Real-time transcription, file transcription, multi-language |

---

### F16: Self-Custodial Payments
**Priority:** Low | **Hyperspace Equivalent:** HYPER token

| Aspect | Detail |
|--------|--------|
| **What** | Optional crypto wallet for P2P micropayments |
| **Stack** | WDK with multi-chain support |
| **Features** | Pay peers for inference, earn for serving, gasless UX |
| **Our Edge** | Self-custodial; works across chains; optional, not required |

---

### F17: Mobile App
**Priority:** Low (Phase 3) | **Hyperspace Equivalent:** None

| Aspect | Detail |
|--------|--------|
| **What** | Native mobile app with P2P backend |
| **Stack** | Expo + Bare worklet + QVAC |
| **Features** | Chat, sync with desktop, small model inference |

---

### F18: Agent Marketplace (P2P)
**Priority:** Low (Phase 3) | **Hyperspace Equivalent:** None

| Aspect | Detail |
|--------|--------|
| **What** | Discover and install AI agents via pear:// links |
| **Distribution** | Fully P2P, no app store, no approval process |
| **Features** | Agent ratings, capability matching, auto-install |

---

## 4. Feature Priority Matrix

```
                     High Value
                        │
         F1 (Local AI)  │  F7 (Discovery)
         F2 (P2P)       │  F8 (Delegation)
         F3 (Storage)   │  F13 (Agents)
    ─────F4 (Replication)┼──F9 (Encrypted)────
         F5 (CLI)       │  F11 (RAG)
         F6 (Desktop)   │  F14 (Vision)
                        │  F15 (Transcription)
         Low Effort ────┼──── High Effort
                        │
         F10 (Files)    │  F16 (Payments)
         F12 (RPC)      │  F17 (Mobile)
                        │  F18 (Marketplace)
                        │
                     Low Value
```
