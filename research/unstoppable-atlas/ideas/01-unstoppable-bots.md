# Idea 01: Unstoppable Bots — P2P AI Agent Nodes

## Status: Research | Date: 2026-03-14

---

## The Concept

An **Unstoppable Bot** is a headless process (Node.js CLI or Pear Terminal) that acts as a node in a P2P network. Each bot:

- Has a persistent identity (HyperDHT keypair)
- Declares **capabilities** it can perform (inference, transcription, embedding, custom tools)
- Joins **topic-based swarms** to be discoverable
- Accepts **tasks via RPC** from peers
- Runs **local AI inference** via QVAC
- Stores results and state in **Hypercore/HyperDB**
- Can be composed into **multi-bot pipelines**

Think of it as a "microservice" that doesn't need a server, a cloud, or even a static IP. It runs on someone's laptop, a Raspberry Pi, or a VPS — and it's reachable by any peer that knows the right topic.

---

## Why This Matters

### The Atlas Connection

Atlas envisions nodes with 9 capabilities (inference, storage, embedding, memory, orchestration, etc.) that form a self-organizing network. The Unstoppable Bot is the **building block** of that network — each bot is one node that contributes specific capabilities.

### What's Different From a Regular Server?

| Aspect | Traditional Bot / Service | Unstoppable Bot |
|--------|--------------------------|-----------------|
| Discovery | DNS, hardcoded URL | Hyperswarm topic (DHT) |
| Transport | HTTPS, WebSocket | Noise-encrypted P2P stream |
| Identity | API key, OAuth | Ed25519 keypair |
| State | Cloud database | Local Hypercore/HyperDB |
| Availability | Depends on hosting provider | Depends on device uptime |
| Cost | Monthly server bill | Zero (runs on your hardware) |
| Censorship | Domain can be seized | No domain, no server, no single point |
| Privacy | Provider sees all traffic | End-to-end encrypted |

### Who Would Build This?

- **Developers** who want to create AI-powered services without cloud infrastructure
- **Teams** that need internal AI bots (code review, knowledge lookup, summarization) that stay within their network
- **Hobbyists** who want to contribute compute to a community network
- **Privacy advocates** who want AI services that can't be monitored

---

## Architecture

### Bot Structure

```
my-bot/
├── src/
│   ├── index.ts              # Entry point + lifecycle
│   ├── capabilities.ts       # Capability declarations
│   ├── handlers/
│   │   ├── inference.ts      # LLM inference handler
│   │   ├── embedding.ts      # Embedding generation handler
│   │   └── custom.ts         # Custom tool handlers
│   ├── p2p/
│   │   ├── swarm.ts          # Hyperswarm setup + topics
│   │   ├── rpc.ts            # RPC server/client
│   │   └── peers.ts          # Peer management + scoring
│   ├── data/
│   │   ├── store.ts          # Corestore + namespaces
│   │   ├── state.ts          # Bot state (HyperDB)
│   │   └── results.ts        # Task results log (Hypercore)
│   └── ai/
│       ├── models.ts         # QVAC model management
│       └── pipeline.ts       # Multi-step task pipelines
├── bot.config.json           # Capability manifest
├── package.json
└── CLAUDE.md                 # Agent pack for AI-assisted dev
```

### Capability Manifest (`bot.config.json`)

```json
{
  "name": "my-inference-bot",
  "version": "1.0.0",
  "capabilities": {
    "inference": {
      "enabled": true,
      "models": ["llama-3.2-3b", "qwen-3-4b"],
      "maxConcurrent": 2,
      "serveNetwork": true
    },
    "embedding": {
      "enabled": true,
      "model": "all-MiniLM-L6-v2",
      "serveNetwork": true
    },
    "transcription": {
      "enabled": false
    }
  },
  "topics": [
    "unstoppable:bots:inference:v1",
    "unstoppable:bots:embedding:v1",
    "my-team:private-bots"
  ],
  "limits": {
    "maxPeers": 20,
    "maxQueueDepth": 50,
    "requestTimeout": 30000
  }
}
```

### Lifecycle

```
1. Start
   ├── Initialize Corestore (local state + results log)
   ├── Load QVAC models declared in capabilities
   ├── Join Hyperswarm topics from config
   └── Start RPC server

2. Running
   ├── Accept connections from peers
   ├── Exchange capability manifests (RPC handshake)
   ├── Process incoming task requests
   ├── Queue tasks if at capacity
   ├── Stream results back to requester
   └── Log all tasks to Hypercore (audit trail)

3. Shutdown
   ├── Drain task queue
   ├── Notify connected peers
   ├── Unload models
   ├── Close Hyperswarm + Corestore
   └── Exit cleanly
```

---

## The RPC Protocol

Bots communicate via a simple RPC protocol over Hyperswarm connections:

### Handshake

When two bots connect, they exchange capability manifests:

```
Bot A ──connect──► Bot B
Bot A ──req: 'handshake' { capabilities: {...} }──► Bot B
Bot B ──res: { capabilities: {...} }──► Bot A
```

Both sides now know what the other can do. This is stored in a local peer registry.

### Task Request

```
Client ──req: 'inference' {
  model: 'qwen-3-4b',
  messages: [{ role: 'user', content: 'Summarize this...' }],
  stream: true
}──► Bot

Bot ──stream: { token: 'The' }──► Client
Bot ──stream: { token: ' summary' }──► Client
Bot ──stream: { token: ' is...' }──► Client
Bot ──res: { usage: { tokens: 142, latency: 1200 } }──► Client
```

### Capability Query

```
Client ──req: 'capabilities' {}──► Bot
Bot ──res: {
  inference: { models: ['qwen-3-4b'], available: true, queueDepth: 3 },
  embedding: { model: 'all-MiniLM-L6-v2', available: true }
}──► Client
```

---

## Multi-Bot Pipelines

The real power emerges when bots are **composed**:

```
[Audio File]
    │
    ▼
Bot A (transcription)  ──Whisper──►  text
    │
    ▼
Bot B (inference)      ──Qwen 7B──►  summary
    │
    ▼
Bot C (embedding)      ──MiniLM──►   vector
    │
    ▼
Bot D (storage)        ──HyperDB──►  indexed & searchable
```

An **orchestrator bot** or the client app defines the pipeline:

```javascript
const pipeline = [
  { capability: 'transcription', input: audioBuffer },
  { capability: 'inference', prompt: 'Summarize: {{prev}}' },
  { capability: 'embedding', input: '{{prev}}' },
  { capability: 'storage', namespace: 'meeting-notes', data: '{{all}}' }
]
```

Each step is routed to the best available bot from the peer registry. If a bot goes offline mid-pipeline, the orchestrator retries with an alternative peer or falls back to local execution.

---

## How It Maps to the CLI

### Scaffold Command

```bash
us init my-bot --template bot-network
```

### What Gets Generated

1. **Bot process** with Hyperswarm + RPC + QVAC wired up
2. **Capability config** file with common defaults
3. **Handler stubs** for inference, embedding, and a custom tool
4. **Corestore setup** with namespaces for state, results, peer registry
5. **Agent pack** (CLAUDE.md / .cursor/rules) with skills for:
   - Adding new capabilities
   - Configuring topics and peer limits
   - Building custom RPC handlers
   - Setting up multi-bot pipelines

### Progressive Complexity

The scaffolded bot starts simple — a single-capability inference bot. The agent pack then guides adding more:

```
Level 1: Single capability (inference) ← scaffolded
Level 2: Multiple capabilities (+ embedding, transcription)
Level 3: Multi-bot pipeline (orchestration)
Level 4: Persistent peer scoring + auto-routing
Level 5: WDK payments for served tasks
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js CLI (default), Pear Terminal (optional) | Node.js is universal; Pear adds P2P distribution |
| RPC | bare-rpc over Hyperswarm | Battle-tested in Keet; typed request/response |
| State storage | HyperDB for structured state, Hypercore for audit log | Schemas for queries, append-only for immutability |
| Model management | QVAC SDK with auto-detection | Handles hardware diversity; optimized for each platform |
| Topic convention | `unstoppable:bots:<capability>:v1` | Versioned topics for protocol evolution |

---

## Open Questions

1. **Trust model for public bots** — If a bot serves inference to anonymous peers, how do we handle abuse? Rate limiting per peer key? Reputation scoring?
2. **Pipeline definition format** — YAML? JSON? TypeScript DSL? Needs to be both human-readable and machine-parseable for the agent pack.
3. **Bot auto-discovery vs. explicit invite** — Should bots auto-discover peers on public topics, or require explicit key exchange? Probably both as config options.
4. **Resource limits** — How does a bot protect itself from being overwhelmed? Queue depth, concurrent request limits, and graceful rejection are critical.
