# Hyperblobs, Hyperbee, HyperDB: A Practical Comparison

## What Is Hyperblobs?

Hyperblobs is a **blob store** built on a single Hypercore. It solves one problem: efficiently storing and retrieving arbitrary binary data (blobs) in an append-only log.

```js
const Hyperblobs = require('hyperblobs')
const blobs = new Hyperblobs(core)

// Store a blob — returns an ID (byte/block offsets)
const id = await blobs.put(Buffer.from('hello world'))
// id = { byteOffset: 0, blockOffset: 0, blockLength: 1, byteLength: 11 }

// Retrieve by ID
const data = await blobs.get(id)
// => Buffer.from('hello world')

// Streaming for large blobs
const ws = blobs.createWriteStream()
bigFileStream.pipe(ws)
// ws.id contains the blob ID after finish
```

**Key properties:**
- Stores blobs in a single Hypercore, chunked by `blockSize` (default 64 KB).
- Each blob is identified by its bounds: `{ byteOffset, blockOffset, blockLength, byteLength }`.
- Supports partial reads (`start`, `length` options).
- Supports read/write streams for large blobs.
- No indexing, no key-value lookup — you must track blob IDs yourself.

**What Hyperblobs is NOT:**
- Not a database — no queries, no keys, no indexes.
- Not a filesystem — no paths, no directories.
- Just a chunk store. You need something else (Hyperbee, HyperDB) to index into it.

---

## How Hyperdrive Uses Hyperblobs

Hyperdrive is actually a **Hyperbee + Hyperblobs** combination:

```
Hyperdrive
├── db (Hyperbee)       ← file tree index: path → metadata + blob ID
└── blobs (Hyperblobs)  ← actual file content, chunked
```

When you do `drive.put('/photo.jpg', buffer)`:
1. The buffer is stored in Hyperblobs → returns a blob ID
2. The Hyperbee stores: `/photo.jpg` → `{ blob: blobId, executable, linkname, metadata }`

When you do `drive.get('/photo.jpg')`:
1. Hyperbee lookup: `/photo.jpg` → blob ID
2. Hyperblobs retrieval: blob ID → buffer

This is why `drive.entry(path)` returns something like:
```js
{
  key: '/photo.jpg',
  value: {
    blob: { blockOffset: 0, blockLength: 5, byteOffset: 0, byteLength: 327680 },
    executable: false,
    linkname: null,
    metadata: null
  }
}
```

---

## The QVAC Registry Pattern: Hyperbee + Hyperdrive

The QVAC SDK uses a layered storage architecture that's a great reference:

```
QVAC Model Registry
├── Hyperbee (index)
│   └── Stores model metadata:
│       - name, addon type, engine
│       - expectedSize, sha256Checksum
│       - quantization, model type
│       - hyperbeeKey (lookup path in the index)
│       - hyperdriveKey (which drive has the file)
│
└── Hyperdrive (storage)
    └── Stores actual model files:
        - model.gguf (weights, 1-30 GB)
        - projection models, vocab files
        - Downloaded via pear://hyperdriveKey/filename.gguf
```

**How `getModelInfo()` works:**
```js
const info = await getModelInfo(MODEL_SRC)
// Returns:
{
  name: "Llama 3.2 1B",
  modelId: "llama-3.2-1b-instruct-q4_0.gguf",
  addon: "llm",
  hyperbeeKey: "generation:meta:llama:3.2:1B:q4_0:1.0.0",  // Index key
  hyperdriveKey: "583f04c31d...ae31",                        // Drive containing the file
  expectedSize: 746520576,
  sha256Checksum: "abc123...",
  isCached: true,
  isLoaded: false,
  cacheFiles: [{ path: "~/.qvac/models/llama-3.2...", isCached: true }]
}
```

**How `loadModel()` works:**
```js
// The modelSrc is actually a Hyperbee key that maps to a Hyperdrive file:
const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,  // This is a constant = Hyperbee key
  modelType: "llm"
})
// Internally:
// 1. Look up the Hyperbee key → get hyperdriveKey + file path
// 2. Download file from pear://hyperdriveKey/filename.gguf (Hyperdrive/Hyperblobs)
// 3. Cache to local disk (~/.qvac/models/)
// 4. Load into memory for inference
```

**The QVAC workbench also uses Hyperbee directly for app state:**
```
Workbench Storage
├── Shared Data (Autobase + Hyperbee view)
│   └── Replicated across devices via addWriter/removeWriter
│   └── Projects, threads, chat history
│
├── Local Metadata (Hyperbee, NOT replicated)
│   └── Current UI state (selected project/thread)
│   └── Onboarding status
│   └── Per-device preferences
│
└── Zustand stores (persisted via setItem/getItem → Hyperbee)
    └── Provider settings
    └── Microphone config
    └── MCP config
```

---

## Hyperbee vs HyperDB: When to Use Which

### Hyperbee: The Simple, Battle-Tested Choice

**Strengths:**
- Zero build step — create and use immediately
- Battle-tested in production (Keet, QVAC Workbench, Hyperdrive)
- Sorted range queries on keys
- Sparse replication (only download B-tree path for a query)
- Atomic batch operations
- Watch/diff for real-time updates
- Sub-databases for namespacing
- Works as Autobase view for multi-writer

**Weaknesses:**
- No secondary indexes — you design your own key structure
- No schema enforcement — you validate manually
- No query-by-non-key-field without manual index
- Key design requires upfront thought

**When Hyperbee is the right choice:**
- Simple key-value needs (settings, metadata, state)
- When you control the key structure
- When you need minimal dependencies
- When operating as an Autobase view
- When building something like a registry index
- When you want battle-tested reliability

### HyperDB: The Schema-First Alternative

**Strengths:**
- Schema enforcement via Hyperschema (build-time validation)
- Secondary indexes with key mapping
- Two backends: P2P (Hyperbee) or local (RocksDB)
- Transactions with exclusive locking
- Change streams
- Same code, different backends

**Weaknesses:**
- **Requires a build step** (`node build.js` when schema changes)
- More complex setup (schema + builder + helpers)
- Newer, less battle-tested than Hyperbee
- P2P mode is still single-writer (backed by Hyperbee internally)
- Overkill for simple KV needs

**When HyperDB is the right choice:**
- Complex queries across multiple fields
- Need secondary indexes (e.g., "find all orders by customer")
- Need schema validation at the data layer
- Need both P2P and local-only modes with the same code
- Building a proper database layer, not just KV

### Head-to-Head

| Feature | Hyperbee | HyperDB (bee) | HyperDB (rocks) |
|---------|----------|---------------|-----------------|
| Build step | None | Required | Required |
| Schema validation | Manual | Automatic | Automatic |
| Secondary indexes | Manual (sub-dbs) | Built-in | Built-in |
| P2P replication | Yes | Yes | No (local only) |
| Sparse queries | Yes | Yes | N/A |
| Multi-writer | Via Autobase | Via Autobase | N/A |
| Battle-tested | Heavily | Less so | Less so |
| Query flexibility | Key prefix/range | Index-based | Index-based |
| Setup complexity | Low | Medium-High | Medium-High |
| Best for | KV, state, registry | App databases | Local caches |

---

## Should You Use Hyperblobs Directly?

**Almost never.** Here's why:

Hyperblobs gives you raw blob storage with no indexing. You'd need to build your own index to know which blob is what. That's exactly what Hyperdrive already does (Hyperbee index + Hyperblobs storage).

**Use Hyperblobs directly only if:**
- You're building your own custom storage layer
- You want maximum control over chunking/encoding
- You're building something like Hyperdrive but with different semantics

**For everything else, use Hyperdrive** for file/blob storage and Hyperbee/HyperDB for structured data.

---

## Practical Decision Matrix

| Scenario | Recommended | Why |
|----------|-------------|-----|
| App settings/preferences | **Hyperbee** | Simple KV, no build step, battle-tested |
| User profiles | **Hyperbee** | One key per user, range scan by prefix |
| Chat messages (multi-user) | **Autobase + Hyperbee** | Multi-writer, linearized, proven by Keet |
| Product catalog with search | **HyperDB (bee)** | Secondary indexes, schema validation |
| Local-only cache | **HyperDB (rocks)** | Fast local queries, no sync needed |
| AI model files | **Hyperdrive** | Large binary files, sparse download |
| Photo/file storage | **Hyperdrive** | Filesystem semantics, streaming |
| Model metadata registry | **Hyperbee** | Simple index, proven by QVAC |
| Multi-device state sync | **Autobase + Hyperbee** | Per-device writers, linearized view |
| Event/activity log | **Raw Hypercore** | Append-only, no KV overhead |

---

## The Workbench Pattern: A Reference Architecture

The QVAC Workbench Desktop demonstrates the recommended approach for a real app:

```
┌─────────────────────────────────────────────────────┐
│                  APP STORAGE                         │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Shared Data       │  │ Local Metadata            │ │
│  │ (Autobase)        │  │ (Hyperbee, not synced)    │ │
│  │                   │  │                           │ │
│  │ • Projects        │  │ • Current UI state        │ │
│  │ • Threads         │  │ • Onboarding flags        │ │
│  │ • Chat history    │  │ • Device preferences      │ │
│  │ • Device registry │  │ • Microphone config       │ │
│  │                   │  │                           │ │
│  │ Replicated via    │  │ Stays on this device      │ │
│  │ addWriter()       │  │                           │ │
│  └──────────────────┘  └──────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Model Files (Hyperdrive via QVAC SDK)             ││
│  │                                                    ││
│  │ • Downloaded from pear://driveKey/model.gguf       ││
│  │ • Cached locally in ~/.qvac/models/                ││
│  │ • Can seed back to network                         ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Key takeaways:**
1. **Hyperbee is the workhorse** — used for both shared data (via Autobase view) and local metadata.
2. **Autobase wraps Hyperbee** for multi-device sync — each device is a writer, Autobase linearizes.
3. **Hyperdrive handles files** — model weights are too large for KV stores.
4. **HyperDB is not used** — the workbench doesn't need secondary indexes or schema validation at the storage layer; Zod handles validation at the message layer instead.
5. **Hyperblobs is used indirectly** — through Hyperdrive, never directly.

---

## Recommendation for the Unstoppable Stack

### Default stack for most apps:
```
Structured data  →  Hyperbee  (+ Autobase if multi-writer)
Files/blobs      →  Hyperdrive
Core management  →  Corestore
```

### When to graduate to HyperDB:
- App has 3+ "collections" that need cross-referencing
- Need "find X where Y = Z" queries (secondary indexes)
- Need the same data model locally (RocksDB) and P2P (Hyperbee)
- Building a data-heavy app like a CRM or inventory system

### When NOT to use HyperDB:
- Simple settings/state storage
- Chat/messaging (Autobase + Hyperbee is proven)
- File storage (use Hyperdrive)
- When you want zero build step
- When battle-tested reliability matters most

Hyperbee is still the right default choice for the Unstoppable Stack. It's proven in Keet, the QVAC Workbench, and Hyperdrive itself. HyperDB is a great option for data-heavy apps but adds complexity that most apps don't need.
