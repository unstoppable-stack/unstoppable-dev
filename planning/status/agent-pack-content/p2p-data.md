# P2P & Data — Content Status

**7 battle-tested, 7 docs-only, 1 not covered** out of 15 items.

---

## Hyperswarm — DONE

| Item | Status |
|------|--------|
| Topic join / peer discovery | Battle-tested |
| Connection events + error handling | Battle-tested |
| `swarm.flush()` for sync | Battle-tested |
| Topic creation (Bare-compatible) | Battle-tested |
| Graceful shutdown | Battle-tested |

Well covered. No further work needed.

---

## bare-rpc — DONE

| Item | Status |
|------|--------|
| RPC constructor + handler | Battle-tested |
| Numeric command IDs | Battle-tested |
| Request/response + error handling | Battle-tested |
| Typed RPC wrapper | Battle-tested |

Well covered. Bidirectional RPC not validated but low priority.

---

## Hyperbee — DONE (mostly)

| Item | Status |
|------|--------|
| Create + ready, put/get/del | Battle-tested |
| Key/value encoding | Battle-tested |
| Iteration (createReadStream) | Not validated |
| Sub-databases, batch ops | Not validated |

Core operations covered. Advanced features low priority.

---

## Corestore — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| Create / get cores by name | Docs only | From official docs |
| Namespace pattern | Docs only | — |
| Shared storage | Docs only | — |
| Replicate all cores over connection | Docs only | Not validated |

### Next Up

The **Node build** will battle-test all Corestore patterns. See
[04-unstoppable-node/](../04-unstoppable-node/README.md).

---

## Hyperdrive — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| Create drive, read/write files | Docs only | From official docs |
| Directory listing | Docs only | — |
| Mirroring (localdrive ↔ hyperdrive) | Docs only | — |
| File watching | Not covered | — |
| Large file streaming | Not covered | — |

### Next Up

The **Node build** (File Sync service) will battle-test Hyperdrive. Can also
be validated by the P2P File Sync reference app (see planning/roadmap/reference-apps.md).

---

## HyperDB — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| Schema definition | Docs only | From official docs |
| Queries | Docs only | — |
| Multi-writer (Autobase) | Documented | modules/autobase.mdc, skills/add-multi-writer-sync |
| Auto-replication | Docs only | — |
| Indexes | Not covered | — |

### Next Up

Best validated by building a **Collaborative Notes** reference app.

---

## SecretStream — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| Noise protocol encryption | Docs only | Not tested in real app |
| Key exchange / verification | Not covered | — |
| Manual stream wrapping | Not covered | — |

### Next Up

Best validated by building an **Encrypted Chat** reference app.

---

## Protomux — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| Channel creation | Docs only | Not tested |
| Multiple protocols on one connection | Not covered | — |
| Compact-encoding messages | Docs only | — |

### Next Up

Validates alongside SecretStream in an Encrypted Chat app.

---

## Communication Patterns

| Pattern | Status |
|---------|--------|
| NDJSON over P2P stream | Battle-tested |
| NDJSON over worker pipe | Battle-tested |
| RPC (request/response) | Battle-tested |
| Pub/sub (topics) | Not covered |
| Binary (compact-encoding) | Docs only |
