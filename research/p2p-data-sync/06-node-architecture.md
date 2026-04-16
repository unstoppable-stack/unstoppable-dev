# Unstoppable Node: Recommended Architecture

Based on all the research — the Holepunch data stack, sync strategies, Keet's patterns, and the QVAC registry model — here's how the Node should be built to be robust and compatible with almost any kind of app.

---

## Design Principles

1. **Read-only replicator** — The Node never writes to app data. It only reads and mirrors.
2. **Protocol-level, not app-level** — The Node replicates Hypercores and Hyperdrives by key. It doesn't need to understand the app's data model.
3. **Corestore-per-app isolation** — Each registered app gets its own namespaced Corestore. No cross-contamination.
4. **Opt-in everything** — Apps choose what to register. The Node doesn't auto-discover cores.
5. **Same protocol → Cloud** — The Node protocol is the Cloud protocol. Transitioning is just changing the peer.

---

## Storage Architecture

```
~/.unstoppable-node/
├── node-store/                    # Node's own Corestore
│   └── (Node's internal cores)
│
├── apps/
│   ├── coffee-assistant/           # Corestore per app (namespaced)
│   │   └── (replicated cores)
│   ├── notes-app/
│   │   └── (replicated cores)
│   └── ...
│
├── drives/
│   ├── coffee-assistant/
│   │   └── files/                  # Mirrored Hyperdrive content
│   ├── notes-app/
│   │   └── files/
│   └── ...
│
└── config/
    ├── registry.json               # Registered apps + core keys
    └── settings.json               # Quotas, preferences
```

### Why Corestore-per-app?

**Isolation.** If one app has corrupt data, it doesn't affect others. Each Corestore manages its own:
- Key derivation namespace
- Storage directory
- Replication sessions

```js
const nodeStore = new Corestore('./node-store')
const appStores = new Map()

function getAppStore(appId) {
  if (!appStores.has(appId)) {
    const store = new Corestore(`./apps/${appId}`)
    appStores.set(appId, store)
  }
  return appStores.get(appId)
}
```

---

## The Three Replication Modes

### Mode 1: Single-Writer Hypercores (Hyperbee, raw Hypercore)

**How it works:**
- App registers a core key.
- Node creates a read-only replica: `store.get({ key: Buffer.from(hexKey, 'hex') })`.
- Node replicates with the app (or any peer that has the core).
- Node announces the core on Hyperswarm (via its discovery key) to seed it.

```js
async function replicateCore(appId, coreKey) {
  const store = getAppStore(appId)
  const core = store.get({ key: Buffer.from(coreKey, 'hex') })
  await core.ready()

  // Join its discovery key topic
  swarm.join(core.discoveryKey)

  // Replicate with incoming connections
  swarm.on('connection', (conn) => store.replicate(conn))

  // Full download (not sparse — we want everything for backup)
  core.download({ start: 0, end: -1 })

  return core
}
```

**Key detail: full download.** The Node should download ALL blocks, not just sparse. It's a backup — it needs everything.

### Mode 2: Autobase (Multi-Writer)

**How it works:**
- App registers the Autobase's bootstrap key.
- Node creates a read-only Autobase instance: it doesn't need to be a writer.
- Autobase internally manages multiple writer cores. Node replicates all of them via Corestore.
- Node does NOT need to be an indexer. It's just a passive replicator.

```js
async function replicateAutobase(appId, bootstrapKey) {
  const store = getAppStore(appId)

  const base = new Autobase(store, Buffer.from(bootstrapKey, 'hex'), {
    open(store) {
      return store.get('view')
    },
    async apply(nodes, view, host) {
      for (const { value } of nodes) await view.append(value)
    }
  })

  await base.ready()

  // Replicate
  swarm.join(base.discoveryKey)
  swarm.on('connection', (conn) => store.replicate(conn))

  return base
}
```

**Important:** The Node's `apply` function should be generic. It doesn't need to understand the app's data model — it just needs to replicate the underlying cores. But having an `apply` function means the Node can build the view locally, enabling data browsing in the Dashboard.

**Alternative (simpler):** Just replicate the Corestore without creating an Autobase instance. All writer cores will be replicated. The downside: no local view, so the Dashboard can't browse data.

### Mode 3: Hyperdrive (Files)

**How it works:**
- App registers a drive key.
- Node replicates the Hyperdrive.
- Optionally mirrors to local filesystem for browsing/export.

```js
async function replicateDrive(appId, driveKey) {
  const store = getAppStore(appId)
  const drive = new Hyperdrive(store, Buffer.from(driveKey, 'hex'))
  await drive.ready()

  // Full download
  const download = drive.download('/')
  await download.done()

  // Join topic for seeding
  swarm.join(drive.discoveryKey)
  swarm.on('connection', (conn) => store.replicate(conn))

  // Optional: mirror to local filesystem
  const local = new Localdrive(`./drives/${appId}/files`)
  const mirror = new Mirror(drive, local)
  await mirror.done()

  // Watch for changes
  const watcher = drive.watch('/')
  for await (const [current, previous] of watcher) {
    const m = new Mirror(drive, local)
    await m.done()
  }

  return drive
}
```

---

## Registration Protocol

The protocol should be simple and extensible. Apps send a registration message; the Node acks and starts replicating.

### Message Format

```typescript
// App → Node
interface RegisterMessage {
  type: 'register'
  appId: string
  appName: string
  version: string
  data: Array<{
    key: string           // hex-encoded key
    kind: 'hypercore' | 'hyperbee' | 'autobase' | 'hyperdb'
    name: string          // human-readable label
    encoding?: {          // for Hyperbee
      key: string
      value: string
    }
  }>
  drives: Array<{
    key: string
    name: string
    syncMode?: 'full' | 'selective'
    include?: string[]    // glob patterns
    exclude?: string[]    // glob patterns
  }>
  requestAI?: boolean     // want AI delegation
}

// Node → App
interface RegisteredMessage {
  type: 'registered'
  nodeId: string
  replicating: string[]   // keys being replicated
  ai?: {
    topic: string
    providerPublicKey: string
    models: string[]
  }
}
```

### Discovery

All apps and Nodes join a well-known topic:

```js
const crypto = require('hypercore-crypto')
const NODE_TOPIC = crypto.discoveryKey(Buffer.from('unstoppable:node:discover:v1'))
```

The Node listens on this topic. When an app connects:
1. Node sends a `nodeHello` with its capabilities.
2. App sends a `register` with its cores/drives.
3. Node starts replicating and sends `registered` ack.

---

## Compatibility Matrix: What Apps Can Register

| App Data Type | Node Mode | Node Capability |
|---------------|-----------|-----------------|
| Single-user Hyperbee (settings, orders) | Core replication | Full backup, data browse |
| Multi-user Autobase (chat, collab) | Autobase replication | Full backup, view browse |
| HyperDB (schema database) | Core replication | Full backup |
| Hyperdrive (files) | Drive replication + mirror | Full backup, file browse |
| Raw Hypercore (logs, streams) | Core replication | Full backup, log browse |
| QVAC models | AI provider service | Delegated inference |

**The Node is compatible with ALL data types in the stack** because it operates at the Corestore/replication level, not at the app-data level.

---

## Multi-Device Node Sync

Two Nodes on different machines can sync with each other:

```
Laptop Node                          Desktop Node
┌──────────────────┐                  ┌──────────────────┐
│ Registered apps: │                  │ Registered apps: │
│ • Coffee App     │◄────────────────►│ • Coffee App     │
│ • Notes App      │   P2P sync via   │ • Finance App    │
│                  │   Hyperswarm     │                  │
│ After sync:      │                  │ After sync:      │
│ • Coffee App     │                  │ • Coffee App     │
│ • Notes App      │                  │ • Notes App      │
│ • Finance App    │                  │ • Finance App    │
└──────────────────┘                  └──────────────────┘
```

**How it works:**
1. Nodes share their registry (a Hyperbee) with each other.
2. Each Node replicates cores/drives it doesn't have yet.
3. The registry uses Autobase so both Nodes can write to it.

```js
// Node's own registry is an Autobase
const registryBase = new Autobase(nodeStore, bootstrapKey, {
  open(store) { return store.get('registry') },
  async apply(nodes, view, host) {
    for (const { value } of nodes) {
      // Register or update app entries
      await view.append(value)
    }
  }
})
```

**Node-to-Node discovery:**
Both Nodes join a user-specific topic derived from the user's master key:

```js
const NODE_SYNC_TOPIC = crypto.discoveryKey(
  Buffer.from(`unstoppable:node:sync:${userPublicKey}`)
)
```

Only Nodes with the same user's key will find each other.

---

## Storage Quotas & Pruning

### Per-App Quotas

```json
{
  "appId": "photo-app",
  "quota": {
    "cores": "500MB",
    "drives": "2GB",
    "total": "2.5GB"
  },
  "pruning": {
    "cores": "keep-all",
    "drives": {
      "strategy": "lru",
      "keepLatest": 1000
    }
  }
}
```

### Pruning Strategies

| Strategy | How | Best For |
|----------|-----|----------|
| `keep-all` | Never prune | Small datasets, critical data |
| `lru` | Remove least recently accessed | File caches |
| `keep-latest-n` | Keep last N entries | Chat logs, event streams |
| `size-cap` | Remove oldest when size exceeds limit | General purpose |

**For Hypercores:**
```js
// Hypercore supports clearing blocks
await core.clear(0, core.length - keepN)
```

**For Hyperdrives:**
```js
// Hyperdrive supports clearing blobs
await drive.clear('/path/to/old-file')
```

**Important:** Clearing local blocks doesn't affect other peers. You're just freeing local storage. The data still exists on other peers (the original app, other Nodes).

---

## Export / Import

### Export

Package an app's replicated data into a portable archive:

```js
async function exportApp(appId, outputPath) {
  const store = getAppStore(appId)
  const registry = await getAppRegistry(appId)

  // Create a zip/tar with:
  // 1. The Corestore directory (raw Hypercore storage)
  // 2. Mirrored drive files
  // 3. Registry metadata (core keys, drive keys, app info)

  const archive = {
    appId: registry.appId,
    appName: registry.appName,
    cores: registry.cores,
    drives: registry.drives,
    exportedAt: Date.now(),
    nodeVersion: NODE_VERSION
  }

  // Write metadata
  await writeJSON(`${outputPath}/manifest.json`, archive)

  // Copy Corestore data
  await copyDir(`./apps/${appId}`, `${outputPath}/corestore`)

  // Copy mirrored files
  await copyDir(`./drives/${appId}/files`, `${outputPath}/files`)
}
```

### Import

```js
async function importApp(archivePath) {
  const manifest = await readJSON(`${archivePath}/manifest.json`)

  // Restore Corestore
  await copyDir(`${archivePath}/corestore`, `./apps/${manifest.appId}`)

  // Re-register in Node
  for (const core of manifest.cores) {
    await replicateCore(manifest.appId, core.key)
  }
  for (const drive of manifest.drives) {
    await replicateDrive(manifest.appId, drive.key)
  }
}
```

---

## Recommended Implementation Order

### Phase 1: Basic Replication (MVP)

```
Priority: High | Effort: 1-2 weeks

✅ Pear Desktop app (renderer + worker)
✅ Manual registration (paste core keys in UI)
✅ Single-writer core replication (Hyperbee, Hypercore)
✅ Dashboard showing registered apps + sync status
✅ JSON file registry (simple, replace with Hyperbee later)
```

### Phase 2: Drives + Auto-Discovery

```
Priority: High | Effort: 1-2 weeks

✅ Hyperdrive replication + local mirroring
✅ Hyperswarm discovery topic
✅ Automatic app registration via SDK
✅ Heartbeat / online status
✅ @unstoppable/node-client library
```

### Phase 3: Multi-Writer + AI

```
Priority: Medium | Effort: 2 weeks

✅ Autobase replication
✅ QVAC provider service (delegated inference)
✅ Per-app data browser (browse Hyperbee KV, list Hyperdrive files)
✅ Storage quotas and stats
```

### Phase 4: Multi-Device + Export

```
Priority: Medium | Effort: 1-2 weeks

✅ Node-to-Node sync (Autobase registry)
✅ Device linking protocol
✅ Export / import
✅ Selective Hyperdrive sync (include/exclude patterns)
```

### Phase 5: Cloud Transition

```
Priority: Low (separate project) | Effort: TBD

✅ Same protocol, hosted by Tether
✅ Subscription billing
✅ Delegated QVAC with powerful GPUs
✅ Always-on seeding
```

---

## Key Technical Decisions

### 1. Use Corestore.replicate(), Not Per-Core Replication

Corestore multiplexes all cores over one connection. Much more efficient than managing individual core replications.

### 2. Full Download, Not Sparse

The Node's job is backup. It should download everything, not just what's been requested.

### 3. Registry in Hyperbee, Not JSON

Start with JSON for simplicity, but move to Hyperbee for:
- Atomic updates
- Replication between Nodes
- Change history

### 4. Autobase Registry for Multi-Node

If the user runs multiple Nodes, the registry itself should be an Autobase so both can write to it.

### 5. Generic Apply Function

The Node doesn't need to understand app data models. A generic apply function that just appends to the view is sufficient for replication. App-specific views are a nice-to-have for the data browser.

### 6. The Node Is Just a Peer

Architecturally, the Node is just another peer with good uptime. Apps don't need to know if they're talking to a Node or another app instance. This is what makes the Cloud transition seamless.
