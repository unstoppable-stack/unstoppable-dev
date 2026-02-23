# The Holepunch Data Stack

## The Layer Cake

Every data structure in the Holepunch ecosystem builds on Hypercore. Understanding the layers is critical for choosing the right tool.

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  HyperDB (schema + indexes)  │  Hyperdrive (files + dirs)   │
├──────────────────────────────┼──────────────────────────────┤
│         Autobase             │        Hyperbee              │
│  (multi-writer linearizer)   │  (sorted B-tree on one core) │
├──────────────────────────────┴──────────────────────────────┤
│                        Corestore                             │
│        (factory + key derivation + multi-core mgmt)          │
├──────────────────────────────────────────────────────────────┤
│                        Hypercore                             │
│           (append-only log — the foundation)                 │
├──────────────────────────────────────────────────────────────┤
│                       Hyperswarm                             │
│           (peer discovery + encrypted connections)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Hypercore — The Foundation

**What:** A secure, distributed, append-only log. Every entry has an index, is merkle-tree verified, and is signed by a single key pair.

**Key properties:**
- **Single writer** — Only the holder of the secret key can append. Everyone else reads.
- **Sparse replication** — Peers only download blocks they need, not the whole log.
- **Signed merkle tree** — Every block can be independently verified without trusting the peer.
- **Truncation** — Writers can truncate (fork), changing the fork id. Consumers detect this.
- **Block size limit** — 15 MB per block (`Hypercore.MAX_SUGGESTED_BLOCK_SIZE`).

**When to use raw Hypercore:**
- Append-only event streams (activity logs, sensor data)
- Chat messages (one core per user)
- Media streaming (audio/video chunks)
- When you need the simplest possible data primitive

**API highlights:**
```js
const core = new Hypercore('./storage')
await core.ready()

await core.append(Buffer.from('hello'))
await core.append(Buffer.from('world'))

const block = await core.get(0) // => 'hello'
core.length  // => 2

// Sparse get: downloads from peers if not local
const remote = await core.get(42, { timeout: 5000 })
```

**Replication:**
```js
// On both sides:
const stream = core.replicate(isInitiator)
socket.pipe(stream).pipe(socket)
```

---

## Corestore — The Factory

**What:** Manages collections of Hypercores. Derives keys from a single master key + name, handles storage, and multiplexes replication.

**Why it matters:**
- One Corestore can manage hundreds of cores efficiently.
- Key derivation is deterministic: same `primaryKey` + same `name` = same core key on any device.
- Replication is "all-to-all" — pipe one connection, all cores replicate.
- Namespacing prevents name collisions between apps/components.

**Usage:**
```js
const store = new Corestore('./my-storage')

const core1 = store.get({ name: 'chat-log' })
const core2 = store.get({ name: 'settings' })

// One replicate call handles all cores
const swarm = new Hyperswarm()
swarm.on('connection', (conn) => store.replicate(conn))
```

**Key derivation:**
```js
// Same primaryKey + same name = same key on any device
const store = new Corestore('./storage', { primaryKey: mySecret })
const core = store.get({ name: 'orders' })
// core.key is deterministic
```

**Namespacing:**
```js
const appA = store.namespace('coffee-app')
const appB = store.namespace('notes-app')
// appA.get({ name: 'main' }) and appB.get({ name: 'main' }) are DIFFERENT cores
```

---

## Hyperbee — Sorted Key-Value on a Core

**What:** A B-tree that runs on top of a single Hypercore. Gives you `get`, `put`, `del`, and sorted range queries — all with sparse replication.

**Key properties:**
- **Single writer** — inherits from Hypercore.
- **Sorted iteration** — keys are sorted by binary value. Range queries (`gt`, `lt`, `gte`, `lte`) are efficient.
- **Sparse** — getting one key doesn't download the whole tree, just the path.
- **Watch/diff** — can watch for changes, diff between versions.
- **Atomic batch** — batch multiple operations for atomicity.

**When to use:**
- Key-value storage for a single user/app (settings, profiles, orders)
- When you need sorted range queries
- As the backing store for a single writer's data that others read

**Usage:**
```js
const core = new Hypercore('./storage')
const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })

await db.put('user:alice', { name: 'Alice', age: 30 })
const entry = await db.get('user:alice') // { seq, key, value }

// Range query
for await (const e of db.createReadStream({ gte: 'user:', lt: 'user:~' })) {
  console.log(e.key, e.value)
}
```

**Limitations:**
- Single writer only. For multi-writer, you need Autobase or HyperDB.
- No secondary indexes (manual sub-databases needed).

---

## Autobase — Multi-Writer Consensus

**What:** Takes multiple writer Hypercores and linearizes their entries into an eventually consistent order. Then applies them to a "view" (typically a Hyperbee).

**This is the key innovation for multi-user P2P apps.**

**Key properties:**
- **Multiple writers** — any authorized peer can append.
- **Linearization** — causal ordering with eventual consistency. Blocks never precede blocks they reference.
- **Signed length (checkpoints)** — after a majority of indexers agree, ordering is locked. Peers behind can fast-forward.
- **Reordering** — as new causal information arrives, existing entries may be reordered. The view is undone and reapplied.
- **Indexers** — a set of peers responsible for linearizing. A majority quorum must agree.
- **Views** — the output data structure (created by `open`, updated by `apply`). Usually a Hyperbee.

**How it works:**
```
Writer A: [msg1] ──────────┐
                            ▼
Writer B: [msg2] ──► Autobase Linearizer ──► View (Hyperbee)
                            ▲
Writer C: [msg3] ──────────┘

The view contains all messages in a deterministic order,
agreed upon by the indexer quorum.
```

**Usage:**
```js
const base = new Autobase(store, bootstrapKey, {
  open(store) {
    return store.get('view')  // Create the linearized view
  },
  async apply(nodes, view, host) {
    for (const { value } of nodes) {
      if (value.addWriter) {
        await host.addWriter(value.addWriter, { indexer: true })
        continue
      }
      await view.append(value)
    }
  }
})
```

**Writer management:**
```js
// In apply handler:
await host.addWriter(peerPublicKey, { indexer: true })
await host.removeWriter(peerPublicKey)
```

**Critical gotchas:**
1. **Deterministic apply** — The `apply` function MUST be deterministic. No external state. Only use the `view` and `store` arguments.
2. **Reordering** — Your apply function will be called multiple times with different orderings as new data arrives. It must produce the same result regardless of order.
3. **Indexer quorum** — If a majority of indexers go offline, the signed length stops advancing (but the system still works, just without checkpoints).
4. **Fast forwarding** — Enabled by default. Peers far behind can skip ahead to the signed length instead of replaying everything.

---

## HyperDB — Schema-First P2P Database

**What:** A database built on top of the Holepunch stack with a schema builder, collections, secondary indexes, and support for both P2P (Hyperbee-backed) and local-only (RocksDB-backed) modes.

**This is the highest-level data abstraction in the stack.**

**Key properties:**
- **Schema-first** — define your data shapes with Hyperschema, collections with the builder API, then generate code.
- **Two backends** — `HyperDB.bee(core, def)` for P2P, `HyperDB.rocks(path, def)` for local.
- **Secondary indexes** — define indexes with key mapping functions.
- **Transactions** — atomic read-write operations.
- **Watch/changes** — observe changes in real-time.
- **Same code, two modes** — write once, choose your backend at runtime.

**Build step (schema definition):**
```js
// build.js — run once when schema changes
const Hyperschema = require('hyperschema')
const HyperDB = require('hyperdb/builder')

const schema = Hyperschema.from('./spec/hyperschema')
const ns = schema.namespace('myapp')

ns.register({
  name: 'members',
  compact: true,
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'age', type: 'uint', required: true }
  ]
})
Hyperschema.toDisk(schema)

const db = HyperDB.from('./spec/hyperschema', './spec/hyperdb')
const dbNs = db.namespace('myapp')

dbNs.collections.register({
  name: 'members',
  schema: '@myapp/members',
  key: ['name']
})

dbNs.indexes.register({
  name: 'members-by-age',
  collection: '@myapp/members',
  key: ['age']
})

HyperDB.toDisk(db)
```

**Runtime:**
```js
// P2P mode
const db = HyperDB.bee(hypercoreInstance, definition)

// Local mode
const db = HyperDB.rocks('./my-local.db', definition)

await db.insert('@myapp/members', { name: 'Alice', age: 30 })
await db.flush()

const alice = await db.get('@myapp/members', { name: 'Alice' })
```

**When to use HyperDB vs Hyperbee:**
| Feature | Hyperbee | HyperDB |
|---------|----------|---------|
| Schema validation | No | Yes (Hyperschema) |
| Secondary indexes | No (manual subs) | Yes (built-in) |
| Build step required | No | Yes |
| Query by non-key fields | Manual | Via indexes |
| Backend flexibility | P2P only | P2P or RocksDB |
| Complexity | Lower | Higher |

---

## Hyperblobs — Raw Blob Store

**What:** A blob store on a single Hypercore. Chunks binary data by configurable block size (default 64 KB) and returns a blob ID (byte/block offsets).

**Usage:**
```js
const Hyperblobs = require('hyperblobs')
const blobs = new Hyperblobs(core)

const id = await blobs.put(Buffer.from('hello world'))
// id = { byteOffset: 0, blockOffset: 0, blockLength: 1, byteLength: 11 }

const data = await blobs.get(id) // => Buffer.from('hello world')

// Streaming for large blobs
const ws = blobs.createWriteStream()
largeFileStream.pipe(ws)
// After finish: ws.id contains the blob ID
```

**Key properties:**
- Stores blobs in a single Hypercore, chunked by `blockSize`.
- Each blob is identified by its offset bounds — you must track these IDs yourself.
- Supports partial reads and streaming.
- No indexing, no key-value, no paths — just a chunk store.

**When to use directly:** Almost never. Hyperdrive wraps Hyperblobs with a Hyperbee index, giving you filesystem semantics. Use Hyperdrive for files. Use Hyperblobs directly only if building a custom storage layer.

**Relationship to Hyperdrive:**
```
Hyperdrive internals:
├── db (Hyperbee)       ← path → { blob: blobId, metadata }
└── blobs (Hyperblobs)  ← blobId → actual file bytes
```

---

## Hyperdrive — P2P File System

**What:** A distributed file system. Files are stored as blobs in Hyperblobs (backed by Hypercore), indexed by a Hyperbee (file tree).

**Key properties:**
- **File operations** — `put`, `get`, `del`, `list`, `readdir`, read/write streams.
- **Sparse** — Only downloads files/chunks that are requested.
- **Symlinks** — Supported.
- **Metadata** — Arbitrary JSON metadata per file.
- **Mirroring** — `mirror-drive` can mirror a Hyperdrive to/from a local directory.
- **Watching** — Watch for file changes.
- **Versioned** — Checkout previous versions.
- **Selective download** — Download specific folders.

**Usage:**
```js
const drive = new Hyperdrive(store)

await drive.put('/photos/vacation.jpg', photoBuffer)
await drive.put('/notes/todo.txt', Buffer.from('buy milk'))

const photo = await drive.get('/photos/vacation.jpg')

for await (const file of drive.list('/photos')) {
  console.log(file.key) // '/photos/vacation.jpg'
}

// Mirror to local filesystem
const local = new Localdrive('./backup')
const mirror = new Mirror(drive, local)
await mirror.done()
```

**Replication:**
```js
const swarm = new Hyperswarm()
const done = drive.findingPeers()
swarm.on('connection', (socket) => drive.replicate(socket))
swarm.join(drive.discoveryKey)
swarm.flush().then(done, done)
```

**When to use Hyperdrive:**
- File storage (photos, documents, media)
- App assets that need P2P distribution
- Backup/archive scenarios
- Anything where you'd normally use a filesystem

---

## Hyperswarm — Peer Discovery & Connection

**What:** A DHT-based networking layer that finds and connects peers interested in the same "topic" (a 32-byte buffer).

**Key properties:**
- **Topic-based discovery** — join a topic, get connections to other peers on that topic.
- **Client/server modes** — servers announce to DHT, clients search and connect.
- **Noise encryption** — all connections are end-to-end encrypted.
- **Firewall** — reject connections by public key.
- **NAT traversal** — built-in hole punching.
- **Multiplexing** — one connection, many topics.

**Usage:**
```js
const swarm = new Hyperswarm()

swarm.on('connection', (socket, peerInfo) => {
  // socket is an encrypted duplex stream
  store.replicate(socket) // or core.replicate(socket)
})

// Join a topic (discovery key of a core, or a custom topic)
swarm.join(core.discoveryKey)

// Wait for all pending connections
await swarm.flush()
```

**Direct peer connections (no topic):**
```js
// Connect to a specific peer by public key
swarm.joinPeer(knownPublicKey)
```

---

## Summary: Choosing Your Tool

| Need | Tool | Writer Model |
|------|------|--------------|
| Append-only event log | Hypercore | Single writer |
| Key-value store (one user) | Hyperbee | Single writer |
| Multi-user collaboration | Autobase → Hyperbee view | Multi-writer |
| Schema + indexes + queries | HyperDB (bee or rocks) | Depends on backend |
| File storage | Hyperdrive | Single writer |
| Multi-core management | Corestore | N/A (factory) |
| Peer discovery | Hyperswarm | N/A (networking) |
