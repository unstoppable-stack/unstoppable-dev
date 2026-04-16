# Unstoppable Search — Planning

## Concept

A P2P search engine you run locally. Every node crawls, indexes, and searches
independently. Indexes sync between peers via Hyperswarm. QVAC handles all AI
(embeddings, ranking, answer synthesis) — no cloud APIs needed.

Think of it as **BitTorrent for search indexes** — every user builds their own
search index and optionally shares it with trusted peers. The more people use
it, the better everyone's search gets.

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Your Node   │   │   Peer A      │   │   Peer B      │
│               │   │               │   │               │
│ Crawl → Index │   │ Crawl → Index │   │ Crawl → Index │
│ QVAC (local)  │   │ QVAC (local)  │   │ QVAC (local)  │
│               │   │               │   │               │
│  Hyperswarm   │◄─►│  Hyperswarm   │◄─►│  Hyperswarm   │
│  replication  │   │  replication  │   │  replication  │
└───────────────┘   └───────────────┘   └───────────────┘
        │
        ▼
  Tavily-compatible
  local HTTP API
        │
        ▼
  AI Agent / CLI / App
```

**Later, this same node can join the Unstoppable Cloud:**

```
┌───────────────────────────────────┐
│                                   │
│      Unstoppable Cloud Node       │
│      (Tether-hosted)              │
│                                   │
│  • Same replication protocol      │
│  • Always-on crawling + seeding   │
│  • Powerful QVAC inference        │
│  • Larger index, more peers       │
│  • Subscription-based             │
│                                   │
└───────────────────────────────────┘
```

The protocol is the same. Your local node is a personal instance. The Cloud is
a hosted super-peer. Apps and agents don't need to know the difference.

---

## Why This App

1. **Validates nearly every stack module:** Hypercore, HyperDB, Hyperdrive,
   Hyperswarm, RPC, Corestore, QVAC — all in one app
2. **Immediate user value:** AI agents get web search without API keys or cloud
   dependencies
3. **Grows organically:** Every search/crawl enriches your index; every peer
   connection broadens it
4. **Tavily-compatible API:** Drop-in replacement for existing agent tooling
5. **Stepping stone to cloud:** Same protocol, just hosted — monetization path
6. **Novel:** No one has built a P2P search engine for AI agents before

---

## How It Differs from Tavily / OrioSearch

| | Tavily | OrioSearch | Unstoppable Search |
|---|--------|-----------|-------------------|
| **Hosting** | SaaS | Self-hosted (Docker) | P2P (runs anywhere) |
| **AI layer** | Proprietary cloud | Ollama / OpenAI | QVAC (fully local) |
| **Index** | Centralized | Per-instance | Distributed across peers |
| **Persistence** | None (query-time) | Redis cache | Permanent (Hypercore) |
| **Sync** | N/A | N/A | P2P replication |
| **Cost** | $0.01/query | Free (self-host) | Free (local) |
| **Privacy** | Data sent to cloud | Data stays on server | Data stays on device |
| **Grows over time** | No | Cache only | Yes — cumulative index |

The key insight: Tavily and OrioSearch are **stateless** — they search, extract,
and forget. Unstoppable Search is **stateful** — every query enriches a
persistent, replicating index that grows over time.

---

## Core Architecture

### The Pipeline (Per Node)

```
                    ┌─────────────────────────────────────────┐
                    │              INGEST PIPELINE             │
                    │                                         │
  URL/Query ───────►│  1. Fetch HTML                          │
                    │  2. Extract content (trafilatura)        │
                    │  3. QVAC: generate embeddings            │
                    │  4. Build keyword index entries           │
                    │  5. Store content + index                │
                    │  6. Log crawl event                      │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │            LOCAL STORAGE                 │
                    │                                         │
                    │  Hypercore  — crawl log (append-only)    │
                    │  HyperDB   — search index (KV + vectors)│
                    │  Hyperdrive — extracted content (files)  │
                    │  Corestore — manages all cores           │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │            P2P SYNC LAYER                │
                    │                                         │
                    │  Hyperswarm — peer discovery             │
                    │  Replication — index + content sync      │
                    │  RPC — distributed query fan-out         │
                    └────────────────────┬────────────────────┘
                                         │
  Query ────────────►┌───────────────────▼────────────────────┐
                     │            QUERY ENGINE                 │
                     │                                        │
                     │  1. QVAC: query → embedding             │
                     │  2. Local: keyword search (BM25)        │
                     │  3. Local: semantic search (cosine sim) │
                     │  4. Remote: fan-out query to peers      │
                     │  5. Merge + QVAC re-rank results        │
                     │  6. Optional: QVAC synthesize answer    │
                     │  7. Return Tavily-compatible JSON       │
                     └─────────────────────────────────────────┘
```

### Worker Architecture (Pear Desktop or Bare Standalone)

```
┌── Worker (Bare runtime) ────────────────────────────────────┐
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  Ingest Service  │  │  Query Service   │  │  Sync       │  │
│  │                  │  │                  │  │  Service    │  │
│  │  • Fetch URLs    │  │  • Keyword search│  │             │  │
│  │  • Extract text  │  │  • Vector search │  │  • Discover │  │
│  │  • Embed (QVAC)  │  │  • Peer fan-out  │  │    peers    │  │
│  │  • Index in DB   │  │  • Re-rank       │  │  • Replicate│  │
│  │  • Store content │  │  • Answer synth. │  │    indexes  │  │
│  │                  │  │                  │  │  • Seed data│  │
│  │  Topic:          │  │  Exposes:        │  │             │  │
│  │  search:ingest   │  │  HTTP API        │  │  Topic:     │  │
│  │                  │  │  + RPC endpoint  │  │  search:net │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Storage Layer                                        │    │
│  │  Corestore → Hypercore (log) + HyperDB (index)       │    │
│  │           → Hyperdrive (content)                      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model

### 1. Crawl Log — Hypercore (append-only)

Every crawl event is appended. Replicates naturally to peers. Serves as an
audit trail and enables incremental sync (peers can see what's new).

```typescript
interface CrawlEntry {
  url: string
  domain: string
  timestamp: number
  contentHash: string  // blake2b of extracted content
  status: 'ok' | 'error' | 'skipped'
  byteLength: number
  title: string
  embedDim: number     // embedding vector dimensionality
}
```

### 2. Search Index — HyperDB per Topic (Autobase multi-writer)

One HyperDB instance per topic. Each HyperDB uses Autobase to merge writes
from all peers subscribed to that topic into a single unified view.

```
Schema: search-index/v1

Collections:

  pages
    @key = /pages/{urlHash}
    url: string
    domain: string
    title: string
    description: string
    contentHash: string
    embedding: float32[]     // QVAC-generated vector
    keywords: string[]       // extracted keywords
    crawledAt: number
    crawledBy: string        // peer public key (provenance)
    freshness: number        // last verified timestamp
    byteLength: number

  domains
    @key = /domains/{domain}
    domain: string
    urlCount: number
    lastCrawl: number
    trustScore: number       // based on peer consensus

  keywords
    @key = /keywords/{word}/{urlHash}
    word: string
    url: string
    tf: number               // term frequency
    positions: number[]      // word positions in doc
    snippet: string          // context around keyword
```

**Why Autobase/HyperDB for the index:**

The key tradeoff is where the merge complexity lives — at write time or query
time. For a search engine where queries vastly outnumber writes, optimizing for
query simplicity is the right call.

Without Autobase (per-peer Hyperbees), searching for "Hyperswarm" across 10
peers means 10 separate range queries on `/keywords/hyperswarm/*`, then manual
dedup and merge. Semantic search is worse — 10 separate embedding scans. Every
query pays this cost.

With Autobase, all peers' writes are linearized into one HyperDB view. One
query, already deduplicated, already merged. The merge cost is paid once at
write/sync time (via the `apply` function), not on every query.

**The `apply` function is simple** because search data is additive with trivial
conflict resolution:

```typescript
async function apply(batch, view, base) {
  for (const op of batch) {
    if (op.type === 'index-page') {
      const existing = await view.get(`/pages/${op.urlHash}`)
      // Freshest crawl wins — simple upsert, no complex conflicts
      if (!existing || op.crawledAt > existing.crawledAt) {
        await view.put(`/pages/${op.urlHash}`, op.data)
        // Update keyword entries
        for (const kw of op.keywords) {
          await view.put(`/keywords/${kw.word}/${op.urlHash}`, kw)
        }
        // Update domain stats
        await updateDomainCount(view, op.domain)
      }
    }
  }
}
```

**Per-topic scoping keeps Autobase manageable:**
- Each topic is its own HyperDB with its own Autobase instance
- Writers are only peers subscribed to that topic (typically 2-20)
- Index size is bounded by topic scope (not the entire network)
- Subscribing to a topic = joining that topic's Autobase as a reader+writer
- Leaving a topic = stop replicating that Autobase (no global reindex)

**Provenance preserved:** The `crawledBy` field records which peer contributed
each entry. Trust weighting happens at query time using this field — the
index stores everything, the query engine weights results by peer trust.

**Peer removal:** Removing a writer triggers an Autobase reindex for that
topic, but since topics are scoped (typically 10K-100K pages, 2-20 writers),
the cost is bounded and acceptable for a rare operation.

### 3. Content Store — Hyperdrive (P2P filesystem)

Stores the actual extracted content. Large blobs go here, not in HyperDB.

```
/content/{contentHash}.md          # clean extracted markdown
/content/{contentHash}.meta.json   # { url, title, author, date, wordCount }
/snapshots/{contentHash}.html      # optional raw HTML snapshot
```

**Why Hyperdrive:** Content files can be large. Hyperdrive handles file storage
efficiently with sparse downloading — peers only download content they actually
need, not the entire archive.

### 4. Peer Registry — Hyperbee (local only)

Tracks known peers and their capabilities. Not replicated.

```
/peers/{publicKey}     → { alias, topics, lastSeen, trustLevel, indexSize }
/subscriptions/{topic} → { peers: string[], autoSync: boolean }
/settings/             → { maxStorage, crawlRate, defaultDepth }
```

---

## Two Core Flows

### Flow 1: Ingest ("Index on the Go")

Content enters the network whenever you (or your agent) interact with a URL.

```
Agent calls: POST /search { query: "Hyperswarm DHT" }
  │
  ├─► 1. Search existing local index (may return results)
  │
  ├─► 2. Optionally: live web search via SearXNG/DuckDuckGo
  │      (fetches fresh URLs not yet in index)
  │
  ├─► 3. For each new URL:
  │      a. Fetch HTML
  │      b. Extract clean text (trafilatura / readability)
  │      c. QVAC generates embedding vector (e.g., 384-dim)
  │      d. Extract keywords + build BM25 entries
  │      e. Store in Hyperdrive (content) + HyperDB (index)
  │      f. Append to Hypercore crawl log
  │
  └─► 4. Index updates replicate to connected peers automatically
         (HyperDB multi-writer via Autobase)
```

**"On the go" triggers:**
- Agent performs a web search → results get indexed
- User pastes a URL → content gets indexed
- Scheduled crawl of bookmarked domains
- Peer shares new index entries → content gets fetched and verified

### Flow 2: Query (Search the P2P Network)

```
Agent calls: POST /search { query: "how does Hyperswarm DHT work?" }
  │
  ├─► 1. QVAC generates query embedding
  │
  ├─► 2. Local search (parallel):
  │      a. Keyword search: BM25 scoring on HyperDB keywords collection
  │      b. Semantic search: cosine similarity on page embeddings
  │      c. Merge with reciprocal rank fusion (RRF)
  │
  ├─► 3. Peer search (parallel, if connected):
  │      a. Fan out query to connected peers via RPC
  │      b. Each peer runs steps 1-2 on their local index
  │      c. Peers return their top-K results
  │      d. Timeout after N ms, use whatever came back
  │
  ├─► 4. Merge all results:
  │      a. Deduplicate by URL
  │      b. QVAC re-ranks merged results (cross-encoder or LLM scoring)
  │      c. Take top-K
  │
  ├─► 5. Optional: QVAC synthesizes a short answer with citations
  │
  └─► 6. Return Tavily-compatible JSON response
```

### Tavily-Compatible API

The node exposes a local HTTP server that matches Tavily's API format.
Existing agent tooling works with zero changes — just swap the base URL.

```typescript
// Request
POST http://localhost:7700/search
{
  "query": "how does Hyperswarm DHT work?",
  "search_depth": "advanced",    // basic | advanced
  "include_answer": true,
  "include_raw_content": false,
  "max_results": 5,
  "include_domains": [],
  "exclude_domains": []
}

// Response (Tavily-compatible)
{
  "query": "how does Hyperswarm DHT work?",
  "answer": "Hyperswarm's DHT is based on...",
  "results": [
    {
      "title": "Hyperswarm Documentation",
      "url": "https://docs.holepunch.to/...",
      "content": "The DHT in Hyperswarm uses...",
      "score": 0.95,
      "raw_content": null
    }
  ],
  "response_time": 1.23,
  "images": []
}
```

---

## Replication Strategy — Three-Tier Model

A new node does **not** download the entire network's data. Replication is
layered so nodes stay lightweight while still having access to the full
network's knowledge.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  TIER 1: Index Metadata              ~2 KB per page             │
│  (url, title, keywords, embedding vector, score, domain)        │
│                                                                 │
│  Syncs: AUTOMATICALLY for subscribed topics                     │
│  When: as soon as you join a topic's Autobase                   │
│  Storage: 100K pages ≈ 200 MB (manageable)                     │
│  Lives in: HyperDB per topic (Autobase merges all writers)      │
│                                                                 │
│  Autobase linearizes all peers' writes into one unified view.   │
│  One query searches everything — already merged, deduplicated.  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TIER 2: Extracted Content           ~5-50 KB per page          │
│  (full markdown, meta.json, optional HTML snapshot)             │
│                                                                 │
│  Syncs: ON DEMAND — only when a search result needs it          │
│  When: user/agent opens a result, or explicitly pins a URL      │
│  Storage: only pages you've actually accessed                   │
│  Lives in: Hyperdrive (sparse mode — built for this)            │
│                                                                 │
│  Hyperdrive sparse mode is the key primitive: a peer can        │
│  advertise 100K files, and you only download the ones you       │
│  actually read. No configuration needed.                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TIER 3: Remote Peers                0 KB stored locally        │
│  (content from peers/topics you're NOT subscribed to)           │
│                                                                 │
│  Syncs: NEVER — queries fan out via RPC, results come back      │
│  When: at query time, if peers are connected                    │
│  Storage: nothing, unless you explicitly pin a result           │
│  Lives in: nowhere locally (ephemeral RPC responses)            │
│                                                                 │
│  Like asking a friend "do you know about X?" — you get an       │
│  answer without copying their entire library.                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### How the Tiers Play Out in Practice

Example network: 3 peers with different interests.

```
You (dev-docs topic)       Peer A (ai-research)      Peer B (crypto)
───────────────────        ────────────────────      ─────────────────
Crawled: 5K pages          Crawled: 8K pages         Crawled: 3K pages
Topics: dev-docs           Topics: ai-research       Topics: crypto
```

Your local storage breakdown:

```
┌──────────────────────────────────────────────────────────────────┐
│ YOUR OWN CRAWLS          5K pages, full (index + content)        │
│                          You crawled these — you have everything  │
│                                                                  │
│ SUBSCRIBED TOPICS        ~2K index-only entries from dev-docs    │
│ (Tier 1)                 peers. Metadata synced automatically.   │
│                          ~200 pages with content (Tier 2) —      │
│                          fetched on demand when search hit them.  │
│                                                                  │
│ UNSUBSCRIBED TOPICS      0 KB stored locally                     │
│ (Tier 3)                 ai-research, crypto — reachable via RPC │
│                          if Peer A or B are online.               │
└──────────────────────────────────────────────────────────────────┘

Summary:
  Local index:   ~7K pages searchable (your crawls + subscribed metadata)
  Local content: ~5.2K pages with full text
  Network reach: ~16K pages (via RPC to peers)
  Storage used:  ~350 MB index + ~1.2 GB content
```

### Query Flow Across Tiers

```
You search: "transformer attention mechanism"
  │
  ├─► Tier 1 — Query your subscribed topic HyperDBs
  │   Each topic HyperDB is a unified Autobase view (your crawls + peers')
  │   One query per topic — already merged and deduplicated by Autobase.
  │   Found: 12 results across dev-docs + ai-research topics
  │   • 3 have full content locally (Tier 2, previously fetched)
  │   • 9 have metadata only → content fetches on demand from
  │     Hyperdrive peers (sparse download, transparent to user)
  │
  ├─► Tier 3 — Fan out query via RPC to connected peers on other topics
  │   Peer B (crypto): returns 0 results ← ephemeral, not stored
  │   Peer C (unsubscribed): returns 4 results ← ephemeral
  │
  ├─► Merge Tier 1 + Tier 3 results → QVAC re-ranks → return top 5
  │
  └─► Optional: pin Peer C's best result
      → fetches full content into your local Hyperdrive
      → now it's yours permanently, survives even if Peer C goes offline
```

### Content Lifecycle and Pruning

Content is safe to prune because the index metadata (Tier 1) stays. Pruned
content can be re-fetched from any peer that still has it.

```bash
# Prune content older than 30 days, keep the index metadata
us search prune --older-than 30d --keep-index
# Removes Tier 2 content files from Hyperdrive
# Index entries remain — search still finds them
# Content re-downloads on demand from peers if needed

# Set storage limits
us search config max-content-storage 2GB    # Tier 2 cap
us search config max-index-storage 500MB    # Tier 1 cap

# Pin important content so it's never pruned
us search pin <url>
us search pin --domain docs.holepunch.to    # pin all pages from a domain
```

**Why pruning is safe:**
- Index metadata (Tier 1) is ~2KB/page — cheap to keep forever
- Content (Tier 2) is ~5-50KB/page — the expensive part
- Pruned content re-downloads from peers when a search result needs it
- Like clearing browser cache: bookmarks stay, pages reload when visited

### Hyperdrive Sparse Mode — The Key Primitive

Hyperdrive's sparse downloading is what makes this architecture natural:

```typescript
// Peer A has a drive with 8K extracted pages
const drive = new Hyperdrive(store, peerKey)
await drive.ready()

// Nothing downloads yet — you're just connected to the peer

// A search result references content hash "abc123..."
const content = await drive.get('/content/abc123.md')
// NOW that single file downloads from the peer. Nothing else.

// The file is cached locally — next access is instant.
// If you prune it later, it re-downloads on next access.
```

No special configuration. This is Hyperdrive's default behavior.

### Storage Estimates by Network Size

| Network Size | Tier 1 (Index) | Tier 2 (Content, ~10% accessed) | Tier 3 (RPC) |
|-------------|---------------|--------------------------------|-------------|
| 10K pages | ~20 MB | ~25 MB | 0 |
| 100K pages | ~200 MB | ~250 MB | 0 |
| 1M pages | ~2 GB | ~2.5 GB | 0 |
| 10M pages | ~20 GB | ~25 GB (need selective topics) | 0 |

At 1M+ pages, topic-based subscription becomes essential — you wouldn't
subscribe to every topic, only the ones relevant to you. Each topic is its
own manageable slice.

---

## P2P Sync Model

### Topic-Based Discovery

Peers organize around **topics** — search domains or interest areas.
Topics control what Tier 1 metadata you receive automatically.

```typescript
const GLOBAL_TOPIC = createTopic('unstoppable:search:v1')

// Specialized topics — join only what interests you
const AI_TOPIC    = createTopic('unstoppable:search:ai-research')
const CRYPTO_TOPIC = createTopic('unstoppable:search:crypto')
const DEV_TOPIC   = createTopic('unstoppable:search:dev-docs')
```

Joining a topic means:
- You discover peers interested in the same area
- You replicate Tier 1 index entries tagged with that topic
- Your crawls in that area are shared with topic peers
- Content (Tier 2) is available on demand but not pushed

Leaving a topic:
- You stop receiving new index entries from that topic
- Existing entries can be pruned or kept (user choice)
- You can still query those peers via RPC (Tier 3)

### Selective Replication

Not everything syncs everywhere. You control what you share and consume.

```
Your node subscribes to topics:
  ✓ unstoppable:search:v1       (global — core protocol, lightweight)
  ✓ unstoppable:search:dev-docs (you're a developer)
  ✗ unstoppable:search:crypto   (not interested — Tier 3 only)

Peer A is on: v1 + dev-docs + crypto
Peer B is on: v1 + crypto

You sync with:
  Peer A: dev-docs index entries (Tier 1) + content on demand (Tier 2)
  Peer B: RPC queries only (Tier 3) — no index data stored
```

### Multi-Writer Index (Autobase per Topic)

Each topic has its own HyperDB backed by Autobase. This is the key architectural
decision for P2P sync — Autobase merges all peers' crawl data into a single
unified index per topic.

```
Topic: "dev-docs"

  ┌────────────────────────────────────────────────────────────┐
  │  HyperDB (Autobase)                                        │
  │                                                            │
  │  Writers (Hypercores of index operations):                  │
  │    Your core     ← your crawls of dev docs                 │
  │    Peer A's core ← their crawls (replicated via Hyperswarm)│
  │    Peer B's core ← their crawls (replicated via Hyperswarm)│
  │                                                            │
  │  Autobase linearizes all writers ──►  Unified view:        │
  │                                                            │
  │    /pages/a1b2c3  → { url: "docs.holepunch.to/...", ... }  │
  │    /pages/d4e5f6  → { url: "docs.pear.holepunch.to/...",}  │
  │    /keywords/hyperswarm/a1b2c3 → { tf: 3, snippet: "..." } │
  │    /keywords/hyperswarm/x7y8z9 → { tf: 1, snippet: "..." } │
  │    /domains/docs.holepunch.to  → { urlCount: 127, ... }    │
  │                                                            │
  │  Query: search this one view. Already merged, deduplicated. │
  └────────────────────────────────────────────────────────────┘

Topic: "ai-research"

  ┌────────────────────────────────────────────────────────────┐
  │  Separate HyperDB (Autobase) — independent writers/index    │
  │  ...                                                       │
  └────────────────────────────────────────────────────────────┘
```

**How it works:**

1. When you crawl a URL, you append an index operation to your writer Hypercore
2. Autobase's linearizer picks it up and applies it to the HyperDB view
3. When a peer connects, their writer Hypercore replicates to you
4. Autobase linearizes their operations too — their pages appear in your view
5. The `apply` function handles dedup: same URL from two peers → keep freshest
6. Result: one unified index per topic, searchable with a single query

**Why per-topic (not one global HyperDB):**
- Subscribing to a topic = joining that topic's Autobase
- Each topic has 2-20 writers (not hundreds)
- Index per topic: 10K-100K pages (manageable for Autobase)
- Unsubscribing = stop replicating that Autobase entirely
- No cross-topic contamination — you only sync what you chose

**Trust model:**
- `crawledBy` field records provenance on every index entry
- Per-peer trust levels (0-1) weight their results at query time
- The index stores everything; the query engine applies trust weighting
- Content from low-trust peers can be verified by re-fetching the URL
- Removing a writer triggers a topic-scoped Autobase reindex (bounded cost)
- Use `ackInterval` for convergence between peers

---

## What QVAC Handles (All Local)

| Task | When | Model Type | Notes |
|------|------|-----------|-------|
| **Embeddings** | Ingest + Query | Embedding model (e.g., all-MiniLM) | 384-dim vectors, fast |
| **Keyword extraction** | Ingest | Small LLM or heuristic | Can use TF-IDF as fallback |
| **Re-ranking** | Query | Cross-encoder or LLM | Score result relevance to query |
| **Answer synthesis** | Query (optional) | LLM | Generate short answer with citations |
| **Content extraction** | Ingest | Small LLM | Clean up messy HTML (fallback to trafilatura) |
| **Summarization** | Ingest (optional) | LLM | Compress long pages for storage efficiency |

**Graceful degradation:** If QVAC isn't available (no models downloaded), the
node falls back to keyword-only search with trafilatura extraction. Still
useful, just less intelligent.

---

## User Flow & CLI Integration

### How Do You Run It?

There are four ways to use Unstoppable Search, from simplest to most involved:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Option A: One-shot (no daemon, no persistence)                 │
│  ──────────────────────────────────────────────                 │
│  us search query "..." --live                                   │
│  Hits DuckDuckGo/SearXNG, extracts, ranks, responds, forgets.  │
│  Works like OrioSearch. Good for testing. No node needed.       │
│                                                                 │
│  Option B: Run your own node (full experience)                  │
│  ─────────────────────────────────────────────                  │
│  us search start              ← daemon runs in background       │
│  us search query "..."        ← talks to localhost:7700         │
│  Agent hits localhost:7700    ← Tavily-compatible API           │
│  Everything indexed, persisted, synced with peers.              │
│                                                                 │
│  Option C: Unstoppable Node runs it (zero setup)                │
│  ───────────────────────────────────────────────                │
│  Unstoppable Node already running on your machine.              │
│  Search is a built-in service — auto-detected by `us search`.  │
│  Always-on indexing, always-on P2P sync.                        │
│  us search query "..."        ← auto-connects to Node           │
│                                                                 │
│  Option D: Connect to a remote node (lightweight client)        │
│  ────────────────────────────────────────────────────           │
│  us search connect <public-key>                                 │
│  Connects to a friend's node or cloud super-peer via P2P.      │
│  Queries go over RPC — zero local storage (pure Tier 3).        │
│  Good for mobile or low-resource machines.                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Start Behavior

`us search query` auto-starts a local daemon if none is running — like Docker
auto-starting its daemon. The user never has to think about "starting a node".

```bash
# No node running yet:
$ us search query "QVAC embeddings"
No search node running. Starting one...
✓ Node started on localhost:7700
Searching...

# Daemon stays running in background. Next query is instant.
# Explicit control still available:
us search start              # start daemon manually
us search stop               # stop the daemon
us search restart            # restart
us search status             # is it running? what's indexed?
```

### The Typical User Journey

**Day 1 — Just want search working for my agent:**

```bash
$ us search start
Starting search node...
✓ Node running on localhost:7700
✓ No content indexed yet. Search with --live or run 'us search ingest'.

# Quick test — hits the live web, returns results, indexes as it goes
$ us search query "Hyperswarm DHT" --live
# Next time you search the same thing → instant from local index.
```

**Day 2 — Point your AI agent at it:**

```bash
# In your agent config (Cursor, Claude, OpenCode, etc.)
SEARCH_API_URL=http://localhost:7700

# Agent calls POST /search — works exactly like Tavily.
# Every search the agent does enriches your local index automatically.
```

**Day 7 — Seed it with content you care about:**

```bash
$ us search ingest --domain docs.holepunch.to --depth 3
Crawling docs.holepunch.to...
✓ 127 pages indexed (4.2 MB content, 312 KB index)

$ us search ingest --domain docs.pear.holepunch.to --depth 2
✓ 84 pages indexed

$ us search status
Index: 1,432 pages (927 from live searches, 211 ingested, 294 from peers)
Storage: 18 MB index, 94 MB content
Node: running since 7 days ago
Peers: 0 connected
```

**Day 14 — Connect to peers and join topics:**

```bash
$ us search peers add <friend-public-key>
✓ Connected to peer "simon-node" (3,200 pages indexed)
  Syncing Tier 1 metadata for shared topics... done (6.4 MB)

$ us search topics join ai-research
✓ Joined topic: ai-research
  Syncing index from 2 peers... 8,234 entries (16 MB)

$ us search status
Index: 12,866 pages (1,432 local + 11,434 from peers)
Storage: 42 MB index, 94 MB content (Tier 2: 1,432 pages with full text)
Peers: 3 connected
Topics: dev-docs, ai-research
```

**Month 2 — It just gets better over time:**

```bash
$ us search status
Index: 47,231 pages
  Your crawls:     4,102 (full content)
  Peer metadata:  43,129 (Tier 1 — index only)
  Content cached:  5,843 (Tier 2 — on-demand fetched)
Storage: 94 MB index, 412 MB content
Peers: 7 connected (3 online now)
Topics: dev-docs, ai-research
Uptime: 43 days
```

### How AI Agents See It

From the agent's perspective, this is invisible infrastructure. The agent just
has a search tool — same as Tavily:

```typescript
// Agent tool configuration — identical to Tavily, just swap the URL
{
  name: "web_search",
  endpoint: "http://localhost:7700/search",
  // No API key needed
}
```

The agent doesn't know about nodes, peers, tiers, or replication. It sends a
query, gets structured results. Behind the scenes the daemon handles everything:
checking local index, fetching content on demand, querying peers, hitting the
live web if needed.

### Unstoppable Node Integration

For users running the Unstoppable Node (the desktop P2P hub), search is a
built-in service — zero additional setup:

```
┌── Unstoppable Node ──────────────────────────────────────────┐
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐ │
│  │  Data Sync   │  │  File Sync   │  │  Search Service       │ │
│  │  Service     │  │  Service     │  │  (Unstoppable Search) │ │
│  │              │  │              │  │                       │ │
│  │  Hyperbee ✓  │  │  Hyperdrive ✓│  │  Ingest + Query       │ │
│  │  HyperDB ✓   │  │  Mirroring   │  │  P2P Sync (3 tiers)   │ │
│  │  Hypercore ✓  │  │              │  │  localhost:7700        │ │
│  │              │  │              │  │                       │ │
│  │  Topic:      │  │  Topic:      │  │  Topic:               │ │
│  │  node:data   │  │  node:files  │  │  search:v1            │ │
│  └─────────────┘  └─────────────┘  └───────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

The Node is always running, so your search service is always on:
- Always indexing content from agent searches
- Always syncing with peers on subscribed topics
- Always seeding your index to the network
- Always available on `localhost:7700`

`us search` auto-detects if the Node is running and routes through it instead
of starting its own daemon. No configuration needed.

### Remote / Lightweight Mode

For machines where you don't want to run a full node (mobile, low-storage,
temporary machines), connect to a remote node:

```bash
# Connect to a friend's node or a cloud super-peer
$ us search connect <public-key>
✓ Connected to remote node via Hyperswarm
  Remote index: 142,000 pages across 12 topics

# Queries go over RPC — nothing stored locally
$ us search query "transformer architecture"
# Results come from the remote node's index. Zero local storage.

# Or connect to an Unstoppable Cloud super-peer
$ us search connect --cloud
✓ Connected to Unstoppable Cloud (subscription required)
```

This is pure Tier 3 — every query is an RPC call, results are ephemeral. You
can optionally pin results to save them locally if you decide to run your own
node later.

### Full CLI Reference

```bash
# Daemon management
us search start                      # start local search daemon
us search stop                       # stop daemon
us search restart                    # restart daemon
us search status                     # index size, peers, storage, uptime

# Searching
us search query "..."                # search local index + peers
us search query "..." --live         # also hit live web (index on the go)
us search query "..." --local-only   # only search local index, no peers/web

# Ingesting content
us search ingest <url>               # index a single URL
us search ingest --file urls.txt     # index from a URL list
us search ingest --domain <domain> --depth 3  # crawl a domain

# Peer management
us search peers                      # list connected peers
us search peers add <public-key>     # add a peer manually
us search peers remove <public-key>  # remove a peer
us search peers trust <key> 0.8      # set trust level (0-1)

# Topic management
us search topics                     # list joined topics
us search topics join <topic>        # subscribe to a topic (sync Tier 1)
us search topics leave <topic>       # unsubscribe from a topic

# Content management
us search pin <url>                  # pin content (never prune)
us search pin --domain <domain>      # pin all pages from a domain
us search prune --older-than 30d     # prune old Tier 2 content
us search prune --keep-index         # prune content, keep index metadata

# Configuration
us search config max-content-storage 2GB   # Tier 2 storage cap
us search config max-index-storage 500MB   # Tier 1 storage cap
us search config crawl-rate 10/min         # rate limit for ingestion

# Remote mode
us search connect <public-key>       # connect to remote node (Tier 3 only)
us search connect --cloud            # connect to Unstoppable Cloud
```

---

## Stack Modules Exercised

| Module | How It's Used | Current Status |
|--------|-------------|---------------|
| **Hypercore** | Crawl log (append-only event journal) | Battle-tested |
| **HyperDB** | Search index (pages, keywords, embeddings) | Docs only → validates |
| **Hyperdrive** | Content store (extracted markdown + snapshots) | Docs only → validates |
| **Hyperswarm** | Peer discovery + topic-based networking | Battle-tested |
| **RPC** | Distributed query fan-out to peers | Battle-tested |
| **Corestore** | Manages all cores (crawl log, index, content) | Docs only → validates |
| **QVAC** | Embeddings, ranking, answer synthesis | Partially tested → validates |
| **Autobase** | Multi-writer index (HyperDB under the hood) | Docs only → validates |

**This single app validates 4-5 major gaps** and stress-tests the modules that
are already battle-tested in new ways (RPC for query fan-out, Hyperswarm for
topic-based discovery).

---

## Development Phases

### Phase 1: Local Search Node (MVP)

Single node, no P2P. A local search engine for your AI agent.

- [ ] HTTP server with Tavily-compatible `/search` endpoint
- [ ] Ingest pipeline: fetch → extract (trafilatura) → store
- [ ] Hyperdrive content store
- [ ] HyperDB index (pages + keywords collections)
- [ ] Keyword search with BM25 scoring
- [ ] QVAC embedding generation on ingest
- [ ] Semantic search (cosine similarity on embeddings)
- [ ] Hybrid ranking (keyword + semantic via RRF)
- [ ] `us search start` / `us search ingest` / `us search query` CLI commands

**Deliverable:** Run `us search start`, point your AI agent at `localhost:7700`,
and get Tavily-compatible search over your own indexed content.

**Effort:** Medium-Large (1-2 weeks)

### Phase 2: Live Web Search + Index-On-The-Go

The node can also hit the live web, and indexes results as it goes.

- [ ] SearXNG integration (or DuckDuckGo API) for live web results
- [ ] Auto-ingest: live search results get indexed automatically
- [ ] Domain crawling: `us search ingest --domain` with configurable depth
- [ ] Scheduled re-crawling for freshness
- [ ] Crawl rate limiting and politeness (robots.txt, delays)
- [ ] `search_depth` support (basic = index only, advanced = index + live web)

**Deliverable:** The node works like Tavily — live web search — but everything
it finds gets permanently indexed for faster future queries.

**Effort:** Medium (1 week)

### Phase 3: P2P Sync (Three-Tier Replication)

Index replication between peers using the three-tier model.

- [ ] Hyperswarm peer discovery on search topics
- [ ] **Tier 1:** HyperDB multi-writer index via Autobase (metadata + embeddings)
- [ ] **Tier 1:** Per-topic HyperDB instances for scoped replication
- [ ] **Tier 1:** Hypercore crawl log replication
- [ ] **Tier 2:** Hyperdrive content replication in sparse mode (on-demand only)
- [ ] **Tier 2:** Content pinning (`us search pin <url>`)
- [ ] **Tier 2:** Storage limits and pruning (`us search prune`)
- [ ] Topic-based selective sync (subscribe/unsubscribe)
- [ ] Peer management CLI (`us search peers`)
- [ ] Trust levels per peer (weight in ranking)

**Deliverable:** Connect to peers, their index metadata syncs automatically
(Tier 1). Content downloads on demand when search results need it (Tier 2).
Your crawls enrich their indexes.

**Effort:** Large (2-3 weeks)

### Phase 4: Distributed Queries (Tier 3)

Fan out queries to peers for results beyond your subscribed topics.
Tier 1 queries are already merged by Autobase — no manual merge needed.
Tier 3 (RPC) results are the only ones requiring merge with the local index.

- [ ] **Tier 3:** RPC-based query protocol (query → peer → results → discard)
- [ ] Parallel fan-out with configurable timeout
- [ ] Merge Tier 3 RPC results with Tier 1 Autobase results (dedup by URL)
- [ ] QVAC re-ranking of merged results
- [ ] Answer synthesis from combined sources
- [ ] "Pin from RPC" — save a Tier 3 result to local Tier 2 storage
- [ ] Query caching (avoid redundant fan-outs for recent queries)

**Deliverable:** Your search covers not just your local index (Tier 1+2), but
everything your connected peers have indexed (Tier 3). Real-time distributed
search with zero storage overhead for remote results.

**Effort:** Medium (1-2 weeks)

### Phase 5: Smart Features

- [ ] Browser extension that indexes as you browse
- [ ] Auto-discovery of peers via the Unstoppable Node
- [ ] Per-topic index statistics and health
- [ ] Content freshness verification (re-fetch and compare)
- [ ] Index export/import (portable search archives)
- [ ] Dashboard UI (Pear Desktop) showing index stats, peers, recent crawls
- [ ] Unstoppable Node integration: search as a built-in service
- [ ] Remote/lightweight mode: connect to a remote node via RPC (pure Tier 3)

**Effort:** Large (ongoing)

### Phase 6: Cloud Super-Peer

- [ ] Same protocol, hosted by Tether
- [ ] Larger crawl capacity, always-on
- [ ] Powerful QVAC inference for better ranking
- [ ] Subscription-based access
- [ ] Acts as a super-peer that enriches everyone's index

---

## Open Questions

1. **Embedding model choice:** Which QVAC-compatible embedding model gives the
   best size/quality tradeoff? all-MiniLM-L6-v2 (384-dim, 80MB) is a good
   starting point but needs benchmarking.

2. **Autobase scale per topic:** Each topic is its own HyperDB/Autobase instance.
   With per-topic scoping, each instance should stay in the 10K-100K page range
   with 2-20 writers. Need to benchmark Autobase linearization performance at
   these sizes. If a single topic exceeds 1M pages (~2GB index), may need
   sub-topic sharding (e.g., split "dev-docs" into "dev-docs:holepunch",
   "dev-docs:react", etc.).

3. **Vector search in HyperDB:** HyperDB is a key-value store, not a vector DB.
   Options for semantic search:
   - Brute-force cosine similarity (fine up to ~100K vectors)
   - HNSW index stored as a Hyperdrive file (rebuilt periodically)
   - External vector index (usearch/hnswlib) synced separately
   
   Phase 1 can use brute-force. Optimize later if needed.

4. **Live web fallback:** For Phase 2, what's the best way to hit the live web?
   - Bundled SearXNG (heavy, requires Docker or subprocess)
   - DuckDuckGo HTML API (lightweight, fragile)
   - Configurable backend (user brings their own search source)
   
   Leaning toward configurable backend with DuckDuckGo as default.

5. **Crawl ethics:** Need robots.txt respect, rate limiting, and a clear
   user-agent string. Peers should be able to flag abusive crawlers.

6. **Content deduplication:** Multiple peers may crawl the same URL. Deduplicate
   by content hash (blake2b of extracted text). The index stores one entry per
   URL, updated by whichever peer has the freshest crawl.

7. **Topic granularity:** How fine-grained should topics be? Too broad (e.g.,
   "tech") and Tier 1 syncs too much. Too narrow (e.g., "rust-async-runtime")
   and peers are hard to find. Probably need hierarchical topics or tagging,
   with the global topic as a lightweight discovery layer.

8. **HyperDB per-topic vs single instance:** RESOLVED — per-topic HyperDB
   instances. Each topic gets its own Autobase, keeping writer count low (2-20),
   index size bounded, and replication scoped. Subscribing/unsubscribing is
   clean: just join/leave that topic's Autobase. The tradeoff is more Autobase
   instances to manage, but each is small and independent.

9. **Tier 1 embedding sync cost:** Embedding vectors (~384 floats = ~1.5KB)
   make up most of the per-page Tier 1 cost. Could offer a "lightweight"
   subscription mode that syncs keywords-only (no embeddings), shrinking
   Tier 1 to ~500 bytes/page. Semantic search would be unavailable for those
   entries, but keyword search still works. Useful for resource-constrained
   nodes or very large topics.

---

## Name Ideas

| Name | Vibe |
|------|------|
| **Unstoppable Search** | On brand, describes what it does |
| **HyperSearch** | Ties to Hyper* ecosystem |
| **SwarmSearch** | Emphasizes the P2P nature |
| **The Hive** | Collective intelligence, distributed |
| **IndexSwarm** | Technical, descriptive |
| **Neuron** | Each node is a neuron in a distributed brain |

---

## Estimated Effort

- **Phase 1:** 1-2 weeks (local search node MVP)
- **Phase 2:** 1 week (live web + auto-indexing)
- **Phase 3:** 2-3 weeks (P2P sync)
- **Phase 4:** 1-2 weeks (distributed queries)
- **Phase 5:** Ongoing (smart features)
- **Phase 6:** Separate project (cloud infrastructure)

Phase 1-2 is a useful standalone tool (local Tavily replacement).
Phase 3-4 is where it becomes truly "unstoppable".
