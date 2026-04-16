# Architecture: System Design

## Status: Proposed | Date: 2026-03-14

---

## 1. Project Name: Unstoppable Atlas

**Tagline:** Your AI. Your Data. Your Network. No Permission Needed.

**One-liner:** A local-first, P2P AI agent network that works offline, syncs with peers you trust, and never touches a central server.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌─────────┐  ┌────────────┐  │
│  │  Pear     │  │  Pear        │  │ Expo    │  │ Node.js    │  │
│  │  Desktop  │  │  Terminal    │  │ Mobile  │  │ CLI        │  │
│  │  (UI)     │  │  (Engine)   │  │ (App)   │  │ (Headless) │  │
│  └────┬─────┘  └──────┬───────┘  └────┬────┘  └─────┬──────┘  │
│       │               │               │             │          │
├───────┴───────────────┴───────────────┴─────────────┴──────────┤
│                      AGENT LAYER                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Agent       │  │ Task        │  │ Capability           │   │
│  │ Runtime     │  │ Orchestrator│  │ Registry             │   │
│  │             │  │             │  │ (inference, storage,  │   │
│  │ Lifecycle   │  │ Pipelines   │  │  embedding, relay...) │   │
│  │ Management  │  │ Routing     │  │                      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│         │                │                     │               │
├─────────┴────────────────┴─────────────────────┴───────────────┤
│                     SERVICE LAYER                               │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ AI       │ │ Storage  │ │ Crypto   │ │ Communication    │  │
│  │ Engine   │ │ Engine   │ │ Engine   │ │ Engine           │  │
│  │          │ │          │ │          │ │                  │  │
│  │ QVAC SDK │ │ Hyper-   │ │ WDK     │ │ SecretStream     │  │
│  │ (local)  │ │ core/bee │ │ (wallet) │ │ Protomux         │  │
│  │ +delegate│ │ /drive/db│ │ +payments│ │ bare-rpc         │  │
│  └──────┬───┘ └──────┬───┘ └─────┬───┘ └───────┬──────────┘  │
│         │            │           │              │              │
├─────────┴────────────┴───────────┴──────────────┴──────────────┤
│                    NETWORK LAYER                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Hyperswarm / HyperDHT                   │  │
│  │                                                          │  │
│  │  Topic-based Discovery │ Noise Encryption │ NAT Traversal│  │
│  │  Peer Management       │ Connection Pool  │ Relay        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                   PERSISTENCE LAYER                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Corestore                            │  │
│  │                                                          │  │
│  │  Hypercore (logs)  │ Hyperbee (KV) │ Hyperdrive (files) │  │
│  │  HyperDB (schema)  │ Embeddings DB │ Agent State         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. App Topology (Multi-App System)

### 3.1 Apps Overview

| App | Runtime | Purpose | Key Modules |
|-----|---------|---------|-------------|
| **atlas-desktop** | Pear Desktop | User-facing dashboard & chat UI | React, styled-components, IPC to engine |
| **atlas-engine** | Pear Terminal | Headless P2P + AI engine | Hyperswarm, QVAC, Corestore, bare-rpc |
| **atlas-cli** | Node.js CLI | Terminal interface & management | Commander, Hyperswarm, QVAC |
| **atlas-mobile** | Expo + Bare | Mobile companion app | React Native, Bare worklet, QVAC |

### 3.2 Communication Between Apps

```
atlas-desktop (UI)
    │
    │  pear-run + pear-pipe (IPC)
    │
    ▼
atlas-engine (Headless)
    │
    │  Hyperswarm connections
    │
    ▼
Other atlas-engine peers (P2P network)
```

The desktop UI communicates with the local engine via IPC. The engine handles all P2P networking, AI inference, and storage. This separation means:
- UI can be swapped without changing logic
- Engine can run headless for servers
- Multiple UIs can connect to one engine

---

## 4. Capability System Design

Inspired by Hyperspace's 9 capabilities, but fundamentally different: each capability works **locally first** and optionally serves the network.

### 4.1 Capability Definitions

| Capability | Local Mode | Network Mode |
|-----------|------------|--------------|
| **Inference** | Run QVAC models locally | Serve inference to authorized peers |
| **Storage** | Hypercore/Hyperbee/Hyperdrive local data | Replicate data with peers |
| **Embedding** | Local vector embeddings via QVAC | Serve embeddings to peers |
| **Memory** | Local RAG knowledge base | Shared knowledge bases per topic |
| **Orchestration** | Local task pipelines | Delegate tasks to capable peers |
| **Relay** | N/A | Help NAT-blocked peers connect |
| **Vision** | Local image analysis | Serve vision analysis to peers |
| **Transcription** | Local audio-to-text | Serve transcription to peers |
| **Payments** | Self-custodial wallet | P2P micropayments for services |

### 4.2 Capability Registration

```javascript
// Each node declares its capabilities
const capabilities = {
  inference: {
    enabled: true,
    models: ['llama-3.2-1b', 'qwen-3-7b'],
    gpu: 'apple-m2',
    vram: 16384,
    serveNetwork: true  // opt-in to serving others
  },
  storage: {
    enabled: true,
    available: '50GB',
    serveNetwork: false  // local only
  },
  embedding: {
    enabled: true,
    model: 'all-MiniLM-L6-v2',
    serveNetwork: true
  }
}
```

### 4.3 Capability Discovery

```javascript
// Peers discover each other's capabilities via Hyperswarm topics
const CAPABILITIES_TOPIC = hash('atlas:capabilities:v1')

swarm.join(CAPABILITIES_TOPIC)
swarm.on('connection', (conn, info) => {
  // Exchange capability manifests via bare-rpc
  const rpc = createRPCClient(conn)
  const peerCapabilities = await rpc.request('capabilities', {})
  capabilityRegistry.add(info.publicKey, peerCapabilities)
})
```

---

## 5. Data Architecture

### 5.1 Storage Namespaces

```
Corestore (root)
├── atlas:agent-state     → Hyperbee (agent config, session state)
├── atlas:conversations   → HyperDB (chat history, searchable)
├── atlas:knowledge       → HyperDB (RAG documents, embeddings)
├── atlas:capabilities    → Hyperbee (peer capability registry)
├── atlas:tasks           → Hypercore (task execution log, append-only)
├── atlas:files           → Hyperdrive (shared files, model cache)
└── atlas:metrics         → Hypercore (uptime, inference counts, perf data)
```

### 5.2 Replication Strategy

```
Level 1: Personal Mesh (always sync)
  - Your own devices (phone ↔ laptop ↔ desktop)
  - Full replication of all namespaces

Level 2: Trusted Peers (selective sync)
  - Team members, friends
  - Sync specific namespaces (shared knowledge, files)

Level 3: Network (capability exchange only)
  - Anonymous peers on capability topics
  - Exchange only inference requests/results
  - No personal data replication
```

---

## 6. AI Engine Design

### 6.1 Local Inference Pipeline

```
User Query
    │
    ▼
Orchestrator
    │
    ├─► RAG Retrieval (if knowledge base exists)
    │       │
    │       ▼
    │   Embedding Search → Relevant Context
    │
    ├─► Model Selection (based on query complexity + hardware)
    │       │
    │       ▼
    │   QVAC loadModel → completion (streaming)
    │
    └─► Response Assembly
            │
            ▼
        Stream to UI + Store in Conversation History
```

### 6.2 Delegated Inference Pipeline

```
User Query (local device too weak)
    │
    ▼
Orchestrator → Check Capability Registry
    │
    ├─► Find peer with matching model + GPU
    │
    ├─► Establish encrypted channel (SecretStream)
    │
    ├─► Send inference request via bare-rpc
    │
    ├─► Stream tokens back over encrypted channel
    │
    └─► Response Assembly (local)
            │
            ▼
        Stream to UI + Store Locally
```

### 6.3 Agent Pipelines (Composable)

```javascript
// Define multi-step agent pipeline
const pipeline = createPipeline([
  { step: 'transcribe', capability: 'transcription', local: true },
  { step: 'analyze',    capability: 'inference',     local: true,  model: 'qwen-3-7b' },
  { step: 'embed',      capability: 'embedding',     local: true },
  { step: 'store',      capability: 'storage',       local: true },
  { step: 'notify',     capability: 'inference',     delegate: true }  // delegate heavy step
])
```

---

## 7. Security Model

### 7.1 Identity
- Each node has a HyperDHT keypair (ed25519)
- Public key = node identity
- No PoW puzzles needed (Hyperswarm handles Sybil at network level)

### 7.2 Transport Security
- All Hyperswarm connections are Noise-encrypted by default
- SecretStream for application-level encryption
- Protomux for multiplexing channels over one connection

### 7.3 Data Security
- Hypercore public keys = read capability tokens
- Only the creator can write to a Hypercore
- Discovery keys (hash of public key) used for peer finding
- Sensitive data encrypted at rest via OS keychain integration

### 7.4 Trust Model
```
No Trust Required (local)
    │
    ▼
Explicit Trust (personal devices)
    │   Share Corestore key between your own devices
    │
    ▼
Peer Trust (friends/team)
    │   Exchange public keys out-of-band
    │   Grant read access to specific namespaces
    │
    ▼
Network Trust (anonymous)
        Capability exchange only
        No personal data exposed
        Optional: WDK staking for reputation
```

---

## 8. Module Dependencies

```
atlas-engine (core)
├── hyperswarm ^4.16.0          # P2P networking
├── hyperdht ^6.29.0            # DHT layer
├── hypercore ^11.24.0          # Append-only logs
├── hyperbee ^2.27.3            # Key-value store
├── hyperdb ^5.0.1              # Schema + indexes
├── hyperdrive ^13.2.1          # File storage
├── corestore ^7.7.0            # Multi-core management
├── @qvac/sdk ^0.7.0            # Local AI inference
├── @tetherto/wdk (optional)    # Crypto payments
├── bare-rpc                    # P2P RPC
├── @hyperswarm/secret-stream   # Encrypted channels
└── protomux                    # Channel multiplexing

atlas-desktop (UI)
├── pear (runtime)
├── react
├── styled-components
└── pear-pipe (IPC to engine)

atlas-cli
├── commander
├── hyperswarm
├── @qvac/sdk
└── ora (spinner)

atlas-mobile
├── expo
├── react-native
├── react-native-bare-kit
├── bare-pack
└── @qvac/sdk (in worklet)
```
