# P2P & Data Roadmap

## Networking

### Hyperswarm (Peer Discovery)

| Item | Status | Agent Pack File | Validated By |
|------|--------|----------------|-------------|
| Topic join / announce | Battle-tested | modules/hyperswarm.md | coffee-assistant, coffee-assistant-ui |
| Peer discovery (DHT) | Battle-tested | modules/hyperswarm.md | coffee-assistant |
| Connection events | Battle-tested | components/p2p/swarm-manager.ts | coffee-assistant |
| `swarm.flush()` for sync | Battle-tested | modules/hyperswarm.md | coffee-assistant |
| Topic creation (Bare-compatible) | Battle-tested | core/patterns.md | coffee-assistant-ui |
| Graceful shutdown (`swarm.destroy`) | Battle-tested | core/patterns.md | coffee-assistant |
| Connection error handling | Battle-tested | skills/add-p2p-sync/ | coffee-assistant |
| Multiple topics per app | Not validated | — | — |
| Server/client roles | Battle-tested | — | coffee-assistant (server=backoffice, client=client) |

### HyperDHT (Direct)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Direct DHT usage (without Hyperswarm) | Docs only | modules/hyperdht.md | Hyperswarm wraps this |
| Custom DHT operations | Not covered | — | Rarely needed directly |

### SecretStream (Encryption)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Noise protocol encryption | Docs only | skills/secure-communication/ | Not tested in real app |
| Key exchange / verification | Not covered | — | — |
| Manual stream wrapping | Not covered | — | — |

### Protomux (Multiplexed Channels)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Channel creation | Docs only | skills/secure-communication/ | Not tested |
| Multiple protocols on one connection | Not covered | — | — |
| Compact-encoding messages | Docs only | skills/secure-communication/ | Not tested |

### bare-rpc (RPC over Streams)

| Item | Status | Agent Pack File | Validated By |
|------|--------|----------------|-------------|
| RPC constructor + handler | Battle-tested | skills/p2p-rpc/ | coffee-assistant |
| Numeric command IDs | Battle-tested | skills/p2p-rpc/ | coffee-assistant |
| Request/response pattern | Battle-tested | skills/p2p-rpc/resources/full-example.md | coffee-assistant |
| RPC wrapper (typed methods) | Battle-tested | skills/p2p-rpc/ | coffee-assistant |
| Error handling | Battle-tested | skills/p2p-rpc/ | coffee-assistant |
| Bidirectional RPC | Not validated | — | coffee-assistant was unidirectional |

---

## Storage

### Hypercore (Append-Only Log)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Core creation + storage | Battle-tested | modules/hypercore.md | Via Hyperbee in coffee apps |
| Append / get / length | Docs only | modules/hypercore.md | Not used directly |
| Replication over streams | Docs only | modules/hypercore.md | Done via Hyperbee auto-replicate |
| Core discovery key | Docs only | modules/hypercore.md | — |
| Standalone Hypercore usage | Not validated | — | Always used via Hyperbee |

### Hyperbee (Key-Value Store)

| Item | Status | Agent Pack File | Validated By |
|------|--------|----------------|-------------|
| Create + ready | Battle-tested | modules/hyperbee.md | coffee-assistant |
| put / get / del | Battle-tested | modules/hyperbee.md | coffee-assistant |
| Key/value encoding (utf-8, json) | Battle-tested | — | coffee-assistant |
| Iteration (createReadStream) | Not validated | — | — |
| Sub-databases (sub()) | Not validated | — | — |
| Batch operations | Not validated | — | — |

### HyperDB (Structured P2P Database)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Schema definition | Docs only | modules/hyperdb.md | From official docs |
| Queries | Docs only | modules/hyperdb.md | From official docs |
| Multi-writer (Autobase) | Documented | modules/autobase.mdc, skills/add-multi-writer-sync | Key differentiator from Hyperbee |
| Auto-replication | Docs only | modules/hyperdb.md | — |
| Indexes | Not covered | — | — |

### Hyperdrive (P2P File Storage)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Create drive | Docs only | modules/hyperdrive.md | From official docs |
| Read / write files | Docs only | modules/hyperdrive.md | — |
| Directory listing | Docs only | modules/hyperdrive.md | — |
| Mirroring (localdrive ↔ hyperdrive) | Docs only | skills/file-sharing/ | — |
| File watching | Not covered | — | — |
| Large file streaming | Not covered | — | — |
| QVAC embed from Hyperdrive | Not covered | — | `qvac-examples/embed-hyperdrive.ts` |

### Corestore (Multi-Core Management)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Create / get cores by name | Docs only | modules/corestore.md | From official docs |
| Namespace pattern | Docs only | modules/corestore.md | — |
| Shared storage | Docs only | modules/corestore.md | — |
| Replicate all cores over a connection | Docs only | components/p2p/replication.ts | Not validated |

---

## Communication Patterns

| Pattern | Status | Agent Pack File | Validated By |
|---------|--------|----------------|-------------|
| NDJSON over P2P stream | Battle-tested | recipes/p2p-ndjson-messaging.md | coffee-assistant |
| NDJSON over worker pipe | Battle-tested | resources/worker-pattern.md | coffee-assistant-ui |
| RPC (request/response) | Battle-tested | skills/p2p-rpc/ | coffee-assistant |
| Pub/sub (topics) | Not covered | — | — |
| Binary messages (compact-encoding) | Docs only | skills/secure-communication/ | Not validated |

---

## Priority Order

1. **HyperDB + Multi-writer** — The primary structured database. Key for collaborative apps.
2. **Hyperdrive** — P2P file storage. Connects to QVAC RAG (embed from drive).
3. **SecretStream + Protomux** — Encrypted channels. Required for any serious P2P app.
4. **Corestore** — Multi-core management. Needed for complex apps.
5. **Hypercore standalone** — Direct log usage. Lower priority (Hyperbee covers most cases).
6. **HyperDHT direct** — Rarely needed. Hyperswarm wraps it.
