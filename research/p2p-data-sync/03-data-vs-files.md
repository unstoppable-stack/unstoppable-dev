# Structured Data vs Files: Choosing the Right Tool

## Two Kinds of App State

Almost every app stores two kinds of things:

1. **Structured data** — records, settings, relationships (JSON, rows, key-value pairs)
2. **Files** — blobs, images, documents, media (binary data with paths)

The Holepunch stack provides dedicated tools for each:

| Type | Tool | Backed By | Sparse | Multi-Writer |
|------|------|-----------|--------|--------------|
| Structured data | **Hyperbee** | Single Hypercore | Yes | No (use Autobase) |
| Structured data | **HyperDB** | Hyperbee or RocksDB | Yes (bee) | Via Autobase |
| Files | **Hyperdrive** | Hypercore + Hyperblobs | Yes | No (single writer) |
| Raw events | **Hypercore** | Itself | Yes | No |

---

## Structured Data

### When to Use Hyperbee

**Best for:** Simple key-value storage without needing secondary indexes or schema enforcement.

```js
const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })

// Store
await db.put('settings:theme', { mode: 'dark', fontSize: 14 })
await db.put('order:001', { items: ['espresso'], total: 3.50 })

// Retrieve
const theme = await db.get('settings:theme')

// Range query (sorted by key)
for await (const entry of db.createReadStream({ gte: 'order:', lt: 'order:~' })) {
  console.log(entry.key, entry.value)
}
```

**Pros:**
- Zero build step — just create and use
- Sorted range queries out of the box
- Sparse replication — remote queries only download the B-tree path
- Atomic batch operations
- Watch/diff support for real-time UI

**Cons:**
- Single writer (need Autobase for multi-writer)
- No secondary indexes — you either query by key prefix or create manual sub-databases
- No schema validation — you enforce structure yourself
- Key design matters a lot (you're designing your own indexing)

**Key design patterns:**
```
// Namespace with colons
settings:theme
settings:language

// Compound keys for "indexes"
order:2024-01-15:001    ← sortable by date
user:alice:order:001    ← look up orders by user

// Sub-databases for namespacing
const orders = db.sub('orders')
const users = db.sub('users')
```

### When to Use HyperDB

**Best for:** Apps with complex queries, secondary indexes, or schema validation requirements.

```js
// Same API, two backends:
const p2pDB = HyperDB.bee(hypercoreInstance, definition)  // P2P
const localDB = HyperDB.rocks('./local.db', definition)   // Local only

// Typed, schema-validated operations
await db.insert('@myapp/members', { name: 'Alice', age: 30 })
await db.flush()

// Query by primary key
const alice = await db.get('@myapp/members', { name: 'Alice' })

// Query by secondary index
const results = await db.find('@myapp/members-by-age', { gte: { age: 25 } }).toArray()
```

**Pros:**
- Schema enforcement via Hyperschema (compile-time validation)
- Secondary indexes with key mapping
- Two backends: P2P (Hyperbee) or local (RocksDB) with same API
- Transactions (exclusive locking)
- Change streams (`.changes()`)

**Cons:**
- Build step required (`node build.js` when schema changes)
- More complex setup
- The P2P mode is still single-writer (backed by Hyperbee)
- Overkill for simple key-value needs

### When to Use Autobase + Hyperbee

**Best for:** Multi-writer collaboration where multiple users/devices write to the same dataset.

```js
const base = new Autobase(store, bootstrapKey, {
  open(store) {
    return store.get('shared-notes')  // Linearized view
  },
  async apply(nodes, view, host) {
    for (const { value } of nodes) {
      if (value.type === 'addWriter') {
        await host.addWriter(value.key, { indexer: true })
      } else {
        await view.append(JSON.stringify(value))
      }
    }
  }
})

// Any authorized peer can append
await base.append({ type: 'note', title: 'Meeting', content: '...' })
```

**When you MUST use Autobase:**
- Multiple users editing the same data (collaborative notes, shared task boards)
- Multiple devices writing to the same user's data simultaneously
- Chat rooms (Keet's approach)
- Any scenario with concurrent writers

---

## Files

### When to Use Hyperdrive

**Best for:** Storing files that need P2P distribution and sparse downloading.

```js
const drive = new Hyperdrive(store)

// Write files
await drive.put('/images/photo.jpg', photoBuffer)
await drive.put('/documents/report.pdf', pdfBuffer, {
  metadata: { author: 'Alice', created: Date.now() }
})

// Read files
const photo = await drive.get('/images/photo.jpg')

// List directory
for await (const entry of drive.list('/images')) {
  console.log(entry.key, entry.value.blob.byteLength)
}

// Download specific folder (sparse)
const dl = drive.download('/thumbnails')
await dl.done()
```

**Sparse file access:**
```js
// Only downloads the requested file — not the whole drive
const singleFile = await drive.get('/images/photo-42.jpg')

// Download a range of files
const dl = drive.download('/images', { recursive: true })
await dl.done()
```

**Pros:**
- Full filesystem semantics (paths, directories, symlinks)
- Sparse — download individual files without getting the whole drive
- Streaming read/write
- Metadata per file
- Versioned (checkout previous states)
- Mirror to/from local filesystem

**Cons:**
- Single writer (only the drive creator can add files)
- For multi-writer file collaboration, no built-in solution (would need an orchestration layer)
- Not suitable for millions of tiny files (overhead per entry in the B-tree)

### When to Use Raw Hypercore for Blobs

**Best for:** Streaming large binary data (audio, video) where filesystem semantics aren't needed.

```js
const stream = core.createWriteStream()
audioStream.pipe(stream) // Stream audio directly into a core

// Read back
const readStream = core.createByteStream({ byteOffset: 0, byteLength: 1024 * 1024 })
```

Hypercore's byte-level seeking (`core.seek(byteOffset)`) makes it suitable for media streaming.

### Don't Store Large Blobs in Hyperbee/HyperDB

This is a common mistake. Hyperbee values are stored inline in the B-tree. Large values bloat the tree and slow down all queries.

**Bad:**
```js
await db.put('photo:001', { name: 'beach.jpg', data: hugeBuffer }) // DON'T
```

**Good:**
```js
// Store the blob in Hyperdrive
await drive.put('/photos/beach.jpg', hugeBuffer)

// Store metadata in Hyperbee
await db.put('photo:001', { name: 'beach.jpg', path: '/photos/beach.jpg' })
```

The block size limit for Hypercore is 15 MB (`Hypercore.MAX_SUGGESTED_BLOCK_SIZE`). Anything larger must be split.

### What About Hyperblobs?

You might wonder: "Can I use Hyperblobs directly instead of Hyperdrive?"

**Hyperblobs** is a raw blob store on a single Hypercore. It chunks data by block size and returns a blob ID (byte/block offsets). But it has no indexing — you must track IDs yourself.

**Hyperdrive = Hyperbee (file index) + Hyperblobs (file content).** The Hyperbee maps file paths to blob IDs, and Hyperblobs stores the actual bytes. So when you use Hyperdrive, you're already using Hyperblobs under the hood.

Use Hyperdrive for file storage. Use Hyperblobs directly only if you're building a custom storage layer and don't need filesystem semantics.

See [07-hyperblobs-and-storage-comparison.md](./07-hyperblobs-and-storage-comparison.md) for the full comparison including the QVAC registry pattern.

---

## Decision Matrix

| Scenario | Tool | Why |
|----------|------|-----|
| User settings | Hyperbee | Simple KV, single writer |
| Chat messages | Hypercore per user + Autobase | Multi-writer, append-only |
| Shared notes database | HyperDB (bee) + Autobase | Schema, indexes, multi-writer |
| Photo album | Hyperdrive | Files, sparse download |
| Model weights (AI) | Hyperdrive | Large binary files, sparse |
| Activity log | Hypercore | Append-only, event stream |
| User profiles directory | HyperDB (rocks) + centralized API | Global search, not P2P |
| App-local cache | HyperDB (rocks) | Fast local queries, no sync |
| Collaborative document | Autobase + Hyperbee view | Multi-writer CRDT-like |
| Device backup | Hyperdrive + Node | Files mirrored to always-on peer |

---

## Combining Data and Files

Most apps need both. The pattern is:

1. **Structured metadata** → Hyperbee or HyperDB
2. **Actual files** → Hyperdrive
3. **Link them** via paths or keys

```js
// File goes in the drive
await drive.put('/invoices/inv-001.pdf', pdfBuffer)

// Metadata goes in the database
await db.put('invoice:001', {
  id: '001',
  customer: 'Alice',
  amount: 150.00,
  filePath: '/invoices/inv-001.pdf',
  createdAt: Date.now()
})

// Query metadata, then fetch file
const invoice = await db.get('invoice:001')
const pdf = await drive.get(invoice.value.filePath)
```

Both the Hyperbee and Hyperdrive can be replicated through the same Corestore:

```js
const store = new Corestore('./app-storage')
const db = new Hyperbee(store.get({ name: 'metadata' }), { ... })
const drive = new Hyperdrive(store)

// One replicate call handles both
swarm.on('connection', (conn) => store.replicate(conn))
```
