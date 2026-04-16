# Idea 02: P2P Knowledge Mesh — Distributed Shared Brain

## Status: Research | Date: 2026-03-14

---

## The Concept

A **Knowledge Mesh** is a network of nodes that each maintain a local knowledge base (documents, embeddings, structured data) and selectively sync subsets of that knowledge with trusted peers. The result is a **distributed, searchable brain** where:

- Each node ingests and indexes its own documents locally (RAG via QVAC)
- Knowledge is organized into **namespaces** (topics, projects, domains)
- Peers can **subscribe** to each other's namespaces
- Search queries fan out across local + replicated knowledge
- Everything works offline with local data; P2P enriches the corpus

This is the "team brain that nobody controls and nobody can shut down."

---

## Why This Matters

### The Problem It Solves

Today's knowledge management is broken:

| Current Approach | Problem |
|-----------------|---------|
| Notion / Confluence | Centralized, vendor lock-in, company can lose access |
| Google Docs | Google reads your data, requires internet, can be deleted |
| Personal notes (Obsidian) | Single-device, no sharing without cloud sync |
| RAG with OpenAI | Your documents go to OpenAI's servers |
| Hyperspace Memory | Distributed across anonymous nodes, no control |

The Knowledge Mesh solves all of these: your data stays on your device, embeddings are generated locally, you choose exactly who gets copies, and it works without internet.

### The Atlas Connection

Atlas's architecture defines:
- `atlas:knowledge` namespace in HyperDB for RAG documents + embeddings
- Level 1 (personal mesh): full sync between your devices
- Level 2 (trusted peers): selective namespace sync
- Level 3 (network): no personal data exposed

The Knowledge Mesh takes this specific architecture and makes it the **primary app** rather than a subsystem.

### Who Would Build This?

- **Research teams** sharing papers, notes, and findings across institutions
- **Law firms** with case knowledge bases that must stay off the cloud
- **Open-source communities** building shared documentation with no central host
- **Journalists** collaborating on investigations with sensitive sources
- **Students** building study groups with shared notes and materials

---

## Architecture

### Data Model

```
Corestore
├── knowledge:personal          → HyperDB (your private documents)
├── knowledge:team-alpha        → HyperDB (shared with team alpha)
├── knowledge:research-papers   → HyperDB (shared topic: papers you've read)
├── knowledge:embeddings        → Hyperbee (vector index for all namespaces)
├── knowledge:files             → Hyperdrive (raw files: PDFs, images, audio)
└── knowledge:sync-log          → Hypercore (replication audit trail)
```

### Document Schema (HyperDB)

```javascript
const documentSchema = {
  name: 'document',
  fields: {
    id: { type: 'string', required: true },
    namespace: { type: 'string', required: true },
    title: { type: 'string', required: true },
    content: { type: 'string', required: true },
    contentType: { type: 'string' },        // 'text', 'markdown', 'pdf-extracted'
    sourceFile: { type: 'string' },          // original filename
    embedding: { type: 'buffer' },           // float32 vector
    tags: { type: 'array' },
    createdAt: { type: 'number', required: true },
    updatedAt: { type: 'number' },
    author: { type: 'string' }               // public key of creator
  },
  indexes: ['namespace', 'tags', 'createdAt']
}
```

### Ingestion Pipeline

```
Input (file or text)
    │
    ▼
Detector (content type)
    │
    ├── Text/Markdown → pass through
    ├── PDF → extract text (pdf-parse)
    ├── Image → QVAC Vision (describe content)
    ├── Audio → QVAC Whisper (transcribe)
    └── URL → fetch + extract
    │
    ▼
Chunker (split into semantic chunks)
    │
    ▼
Embedder (QVAC embeddings → float32 vectors)
    │
    ▼
Storage
    ├── HyperDB: document record + embedding
    ├── Hyperdrive: original file (if applicable)
    └── Hyperbee: vector index entry
```

Every step runs locally. No data leaves the device during ingestion.

### Search Pipeline

```
Query (natural language)
    │
    ▼
Embedder (QVAC embeddings → query vector)
    │
    ▼
Vector Search (cosine similarity across local + replicated embeddings)
    │
    ├── Local namespaces: search HyperDB directly
    └── Replicated namespaces: search synced HyperDB copies
    │
    ▼
Ranked Results (top-K documents by similarity)
    │
    ▼
RAG (optional): inject context into QVAC completion
    │
    ▼
Answer (with citations to source documents)
```

---

## P2P Sync Model

### Namespace-Level Permissions

Each namespace is backed by a HyperDB instance with its own keypair. Sharing is controlled by sharing the **discovery key** and **read capability**:

```
Namespace: "team-alpha"
├── Discovery key: <hash of public key> → used to find peers
├── Read key: <public key> → grants read access
└── Write key: <secret key> → only the creator writes

To invite a peer:
1. Share the discovery key (they can find you)
2. Share the read key (they can replicate your data)
3. They join the topic on Hyperswarm
4. Corestore replicates on connection
```

### Sync Levels

```
Level 1: Personal Mesh (automatic)
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  Laptop  │◄───►│  Desktop │◄───►│  Phone   │
  └──────────┘     └──────────┘     └──────────┘
  All namespaces sync bidirectionally between your own devices.
  Same Corestore identity, full replication.

Level 2: Trusted Peers (selective)
  ┌──────────┐                  ┌──────────┐
  │  Alice   │◄── team-alpha ──►│   Bob    │
  └──────────┘                  └──────────┘
  Only the "team-alpha" namespace syncs.
  Alice and Bob each maintain separate personal namespaces.

Level 3: Public Topics (read-only broadcast)
  ┌──────────┐
  │  Author  │──► "research-papers" ──► Anyone who joins the topic
  └──────────┘
  Author publishes a read-only knowledge base.
  Subscribers replicate and search locally.
```

### Conflict Handling

Hypercore is append-only so there are no conflicts at the log level. For HyperDB with multiple writers, conflict resolution follows:

1. **Single writer per namespace** (simplest): one person owns each namespace, others replicate read-only
2. **Multi-writer with last-writer-wins**: HyperDB's built-in conflict resolution for collaborative namespaces
3. **Append-only additions**: participants can only add documents, not modify others' contributions

The default scaffolded app uses single-writer namespaces (option 1) because it's the simplest mental model. The agent pack includes a skill for upgrading to multi-writer if needed.

---

## App Structure

```
my-knowledge-mesh/
├── src/
│   ├── index.ts               # Entry point
│   ├── ingest/
│   │   ├── detector.ts        # Content type detection
│   │   ├── chunker.ts         # Semantic chunking
│   │   ├── extractors/
│   │   │   ├── pdf.ts         # PDF text extraction
│   │   │   ├── image.ts       # QVAC Vision description
│   │   │   └── audio.ts       # QVAC Whisper transcription
│   │   └── embedder.ts        # QVAC embedding generation
│   ├── search/
│   │   ├── vector.ts          # Cosine similarity search
│   │   ├── rag.ts             # RAG pipeline (retrieve + generate)
│   │   └── ranker.ts          # Result ranking
│   ├── p2p/
│   │   ├── swarm.ts           # Hyperswarm topics per namespace
│   │   ├── sync.ts            # Corestore replication logic
│   │   └── invites.ts         # Peer invitation (key sharing)
│   ├── data/
│   │   ├── store.ts           # Corestore + namespace management
│   │   ├── schemas.ts         # HyperDB document schema
│   │   └── vectors.ts         # Vector index (Hyperbee)
│   └── cli/
│       ├── ingest.ts          # `mesh ingest <file>`
│       ├── search.ts          # `mesh search <query>`
│       ├── namespaces.ts      # `mesh ns create/list/share`
│       └── peers.ts           # `mesh peers invite/list`
├── package.json
└── CLAUDE.md
```

### CLI Commands

```bash
# Ingestion
mesh ingest ./papers/           # Ingest all files in a directory
mesh ingest ./report.pdf        # Ingest a single file
mesh ingest --url https://...   # Fetch and ingest a URL

# Search
mesh search "quantum computing applications"       # Semantic search
mesh search "quantum computing" --rag               # Search + generate answer
mesh search "quantum" --namespace research-papers   # Search specific namespace

# Namespace management
mesh ns create team-alpha                    # Create a new namespace
mesh ns list                                 # List all namespaces
mesh ns share team-alpha --invite            # Generate invite key
mesh ns join <invite-key>                    # Join a shared namespace

# Peer management
mesh peers list                              # List connected peers
mesh peers invite <public-key>               # Invite to personal mesh
```

---

## Key Differentiators vs. Existing Tools

| Feature | Notion AI | Obsidian | RAG + OpenAI | Knowledge Mesh |
|---------|----------|----------|-------------|----------------|
| Local-first | No | Yes | No | **Yes** |
| P2P sync | No | No (cloud) | No | **Yes** |
| Private embeddings | No | No | No | **Yes** |
| Offline search | No | Text only | No | **Semantic** |
| Multi-device | Cloud | Cloud | Cloud | **P2P mesh** |
| Selective sharing | By workspace | N/A | N/A | **Per namespace** |
| No vendor | No | Partial | No | **Fully sovereign** |

---

## Progressive Complexity

```
Level 1: Local knowledge base with search              ← scaffolded
Level 2: RAG (search + generate answers)
Level 3: Multi-namespace organization
Level 4: P2P sync with trusted peers
Level 5: Multimodal ingestion (images, audio, PDF)
Level 6: Shared team knowledge bases
Level 7: Public read-only knowledge broadcasts
```

---

## Open Questions

1. **Embedding model choice** — `all-MiniLM-L6-v2` is small/fast but not the best quality. Should we support upgradeable embedding models, and how do we handle re-embedding when switching?
2. **Vector search at scale** — Cosine similarity over Hyperbee works for thousands of documents. For millions, we'd need approximate nearest neighbor (ANN). Is this a real concern for local-first?
3. **Chunking strategy** — Fixed-size chunks vs. semantic chunks (paragraph boundaries, markdown headers). The chunking quality dramatically affects RAG results.
4. **Namespace discoverability** — Should there be a "public directory" of knowledge namespaces, or is everything invite-only? A Hyperswarm topic for "knowledge mesh directory" could work.
