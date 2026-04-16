# OrioSearch — Deep Code Analysis

> Source: https://github.com/vkfolio/orio-search
> Analyzed: 2026-03-27
> Purpose: Understand implementation details to reuse in Unstoppable Search

---

## Architecture Overview

OrioSearch is a Python/FastAPI app with ~750 lines of core code across 12 files.
It's clean, well-structured, and easy to port. The entire pipeline is stateless —
no persistent index, everything is query-time.

```
app/
├── main.py                 # FastAPI app, lifespan, tool schema
├── config.py               # Pydantic config models + YAML loader
├── models/schemas.py       # Request/response Pydantic models (Tavily-compatible)
├── routers/
│   ├── search.py           # POST /search — main search endpoint
│   ├── search_stream.py    # POST /search/stream — SSE streaming
│   └── extract.py          # POST /extract — standalone extraction
├── services/
│   ├── search_backend.py   # SearXNG + DuckDuckGo backends (with fallback)
│   ├── extractor.py        # Content extraction (trafilatura + readability)
│   ├── llm.py              # AI answer generation (OpenAI-compatible)
│   ├── reranker.py         # FlashRank reranking
│   ├── cache.py            # Redis caching (search, extract, answer)
│   └── resilience.py       # Circuit breaker + retry with backoff
├── auth.py                 # Bearer token auth (optional)
├── rate_limit.py           # slowapi rate limiting
├── middleware.py            # Request ID + timing middleware
└── logging_setup.py        # structlog JSON logging
```

**Dependencies (key ones):**
- `fastapi` + `uvicorn` + `gunicorn` — HTTP server
- `httpx` — async HTTP client
- `trafilatura` — content extraction (primary)
- `readability-lxml` — content extraction (fallback)
- `flashrank` — reranking (ms-marco-MiniLM-L-12-v2, ~4MB ONNX model)
- `openai` — LLM client (works with any OpenAI-compatible API)
- `redis` — caching
- `duckduckgo-search` — fallback search backend
- `circuitbreaker` — circuit breaker pattern
- `slowapi` — rate limiting
- `sse-starlette` — Server-Sent Events for streaming

---

## Component-by-Component Breakdown

### 1. Search Backend (`services/search_backend.py`)

**What it does:** Queries search engines and returns raw results (title, URL, snippet, score).

**Implementation:**

Two backends behind an abstract `SearchBackend` interface:

**SearXNG Backend:**
- Sends GET request to SearXNG's `/search?format=json` endpoint
- Parameters: `q` (query), `categories` (general/news), `time_range`
- Domain filtering via query modification: appends `site:domain` or `-site:domain`
- Score normalization: if score >1, divides by 10, then clamps to [0, 1]
- Image search: separate request with `categories=images`
- Web + image search run in parallel via `asyncio.gather`

**DuckDuckGo Backend:**
- Uses `duckduckgo-search` Python library (synchronous)
- Runs in `ThreadPoolExecutor(max_workers=4)` to not block async loop
- Score is synthetic: `1.0 - (rank * 0.05)`, minimum 0.1
- Time range mapped: day→"d", week→"w", month→"m", year→"y"

**Fallback pattern:**
```python
class FallbackSearchBackend(SearchBackend):
    async def search(self, query, **kwargs):
        try:
            return await self.primary.search(query, **kwargs)
        except (Exception, CircuitBreakerError):
            return await self.fallback.search(query, **kwargs)
```
If SearXNG fails, automatically falls back to DuckDuckGo.

**What we reuse:**
- The abstract backend pattern is good — we'll have `LocalIndexBackend` + `LiveWebBackend`
- DuckDuckGo backend is lightweight and needs no Docker — good for Phase 1/2
- Domain filtering via query string is simple and effective
- Score normalization logic

**What we change:**
- Primary backend becomes our local HyperDB index
- SearXNG/DDG becomes the "live web" fallback
- Results from live web get ingested into the index (the key difference)

---

### 2. Content Extraction (`services/extractor.py`)

**What it does:** Fetches a URL's HTML and extracts clean text/markdown.

**Implementation:**

**Concurrency control (critical for politeness):**
```python
self._global_semaphore = asyncio.Semaphore(config.extraction.max_concurrent)  # 5
self._domain_semaphores: OrderedDict[str, asyncio.Semaphore]  # 2 per domain
```
- Global limit: 5 concurrent extractions total
- Per-domain limit: 2 concurrent requests to same domain
- Domain semaphores use LRU eviction (OrderedDict, max 1000 entries)
- Both semaphores acquired with `async with global_sem, domain_sem`

**HTTP fetching:**
- Uses `httpx.AsyncClient` (separate from search client, higher connection limits)
- Random user-agent rotation from a pool of 10 browser user-agents
- Headers mimic a real browser: Accept, Accept-Language, DNT, Upgrade-Insecure-Requests
- Follows redirects
- Content-type validation: rejects non-HTML responses

**Extraction pipeline (two-tier):**

Tier 1 — trafilatura:
```python
trafilatura.extract(
    html,
    include_comments=False,
    include_tables=True,
    favor_recall=True,     # prefer more content over precision
    url=url,               # helps resolve relative links
)
```

Tier 2 — readability-lxml (fallback):
```python
from readability import Document as ReadabilityDocument
doc = ReadabilityDocument(html)
content_html = doc.summary()
text = re.sub(r"<[^>]+>", " ", content_html)  # strip HTML tags
text = re.sub(r"\s+", " ", text).strip()       # normalize whitespace
```
Only used if trafilatura returns nothing. Minimum 50 chars to be valid.

**Markdown conversion:**
```python
def _to_markdown(text, html, url):
    title = extract_from_html_title_tag(html)
    return f"# {title}\n\nSource: {url}\n\n---\n\n{text}"
```
Simple: just adds a title header, source URL, and separator.

**Content limits:**
- `max_content_length: 50000` chars (~50KB)
- Truncated content gets `\n\n[Content truncated]` appended

**Error handling:**
- Circuit breaker on fetch failures
- Retry with exponential backoff on 429/503/502/504
- Timeout: 10 seconds per URL
- Graceful per-URL errors (returned as `ExtractionResult.error`)

**What we reuse directly:**
- The entire extraction pipeline — trafilatura + readability fallback
- Concurrency control (global + per-domain semaphores)
- User-agent rotation
- Markdown conversion with title extraction
- Content length limits and truncation
- The `ExtractionResult` pattern (success/error per URL)

**What we add:**
- After extraction, store the markdown in Hyperdrive
- After extraction, generate embeddings via QVAC
- After extraction, index metadata in HyperDB
- Content hash (blake2b) for deduplication

---

### 3. Reranking (`services/reranker.py`)

**What it does:** Re-scores search results by semantic relevance using a small ML model.

**Implementation:**

```python
from flashrank import Ranker, RerankRequest

# Model: ms-marco-MiniLM-L-12-v2 (~4MB ONNX, CPU-only, no PyTorch needed)
self._ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")

# Reranking:
passages = [
    {"id": i, "text": f"{title} {content}", "meta": original_result}
    for i, r in enumerate(results)
]
rerank_req = RerankRequest(query=query, passages=passages)
reranked = self._ranker.rerank(rerank_req)
```

- Input: query + list of results (title + content concatenated as passage text)
- Output: same results re-ordered by semantic relevance, with new scores
- Model is pre-downloaded in Docker build to avoid cold-start delay
- `top_k` configurable (default 5)
- Completely optional (disabled by default in config)

**What we reuse:**
- FlashRank is perfect for us — tiny, CPU-only, ONNX
- Same passage construction pattern (title + content)
- Optional/graceful degradation pattern

**What we add:**
- In Phase 1, we can use this alongside our own BM25 + semantic search
- QVAC cross-encoder could replace FlashRank in advanced mode
- Reciprocal rank fusion (RRF) to merge keyword + semantic + rerank scores

---

### 4. LLM Answer Synthesis (`services/llm.py`)

**What it does:** Generates a short AI answer with citations from search results.

**Implementation:**

Uses the `openai` Python SDK, which works with any OpenAI-compatible API
(Ollama, Groq, Together, OpenAI, etc.):

```python
self._client = AsyncOpenAI(
    base_url=settings.llm.base_url,   # e.g., "http://ollama:11434/v1"
    api_key=settings.llm.api_key,     # "ollama" for local
    timeout=settings.llm.timeout,
)
```

**Context building:**
```python
def _build_context(self, query, results):
    for i, r in enumerate(results[:max_context_results]):   # default 5
        text = r.raw_content or r.content                   # prefer full extraction
        if len(text) > remaining_chars:                     # max 8000 chars total
            text = text[:remaining] + "..."
        context_parts.append(f"[{i + 1}] {title} - {url}\n{text}")

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Search results for: {query}\n\n{context}\n\nQuestion: {query}"}
    ]
```

**System prompt:**
```
"You are a helpful search assistant. Answer the user's question concisely
based on the provided search results. Cite sources by number [1], [2], etc."
```

**Streaming:**
```python
async def generate_answer_stream(self, query, results):
    stream = await self._client.chat.completions.create(
        model=model, messages=messages,
        max_tokens=1024, temperature=0.1, stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

**Caching:** Answers are cached in Redis (separate from search cache) with
configurable TTL (`answer_ttl: 3600`).

**What we reuse:**
- The context building pattern (numbered sources with content)
- System prompt format
- Streaming support
- The `openai` SDK approach (works with QVAC if it exposes OpenAI-compatible API)
- Answer caching (but in HyperDB instead of Redis)

**What we change:**
- Replace OpenAI SDK with QVAC SDK for local inference
- Graceful degradation: if no LLM available, return `answer: null`

---

### 5. Caching (`services/cache.py`)

**What it does:** Redis-based TTL caching for search results, extractions, and answers.

**Implementation:**

Three cache namespaces, each with its own TTL:

| Cache | Key Pattern | TTL | Purpose |
|-------|------------|-----|---------|
| Search | `search:{sha256(query\|params)[:16]}` | 3600s (1h) | Full search response |
| Extract | `extract:{sha256(url)[:16]}` | 86400s (24h) | Extracted page content |
| Answer | `answer:{sha256(query\|params)[:16]}` | 3600s (1h) | LLM-generated answer |

**Batch operations:** Extract cache supports pipeline-batched reads and writes:
```python
async with self._redis.pipeline(transaction=False) as pipe:
    for key in keys:
        pipe.get(key)
    values = await pipe.execute()
```
This is a single Redis round-trip for all URLs — critical for performance when
extracting 5-20 URLs per search.

**Graceful degradation:**
- If Redis connection fails at startup, cache is disabled (not fatal)
- If search backend fails, tries to serve stale cache
- All cache operations wrapped in try/except (never crashes the request)

**What we reuse:**
- The stale-cache-on-backend-failure pattern is smart
- Batch pipeline operations pattern
- TTL-based key hashing approach

**What we change:**
- Replace Redis with Hyperbee for local cache
- Extracted content also persists in Hyperdrive (permanent, not TTL)
- Index data is permanent in HyperDB (no TTL — this IS the index)

---

### 6. Resilience (`services/resilience.py`)

**What it does:** Circuit breaker + retry with exponential backoff.

**Implementation:**

**Circuit breaker** (via `circuitbreaker` library):
```python
search_circuit = circuit(
    failure_threshold=5,       # open after 5 consecutive failures
    recovery_timeout=30,       # try again after 30 seconds
    expected_exception=Exception,
)
```
Two separate circuits: one for search, one for extraction.

**Retry with backoff:**
```python
async def retry_async(coro_factory, max_attempts=3, backoff_base=0.5):
    for attempt in range(1, max + 1):
        try:
            return await coro_factory()
        except httpx.HTTPStatusError as e:
            if e.response.status_code not in [429, 503, 502, 504]:
                raise  # don't retry 404s, 403s, etc.
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout):
            pass  # retry
        delay = backoff_base * (2 ** (attempt - 1))  # 0.5s, 1s, 2s
        await asyncio.sleep(delay)
    raise last_exception
```

**What we reuse:**
- Circuit breaker pattern for web fetching (not for local index queries)
- Retry with exponential backoff for HTTP requests
- Separate circuits for different failure domains

---

### 7. Main Search Flow (`routers/search.py`)

**The complete flow when POST /search is called:**

```
1. Check cache (query + params hash)
   └─ Hit? Return cached response immediately.

2. Query search backend (SearXNG → DuckDuckGo fallback)
   └─ Backend fails? Try stale cache. Still nothing? → 503.

3. Build SearchResult list from raw backend results
   └─ Each has: title, url, snippet, score

4. Rerank (if enabled)
   └─ FlashRank re-scores by semantic relevance
   └─ Results re-ordered, scores updated

5. If search_depth == "advanced" or include_raw_content:
   └─ Extract full content from ALL result URLs (parallel)
   └─ Each extraction: fetch HTML → trafilatura → readability fallback
   └─ Successful extractions cached in Redis
   └─ Content attached as raw_content on each result

6. If include_answer:
   └─ Check answer cache first
   └─ Build context from top-5 results (prefer raw_content)
   └─ LLM generates answer with [1][2] citations
   └─ Cache the answer

7. Build response: { query, answer, results, images, response_time }

8. Cache full response

9. Return to caller
```

**Streaming variant (`routers/search_stream.py`):**
Same flow but uses SSE (Server-Sent Events):
- `event: result` — each search result as it arrives
- `event: image` — each image result
- `event: extraction` — each extraction as it completes
- `event: answer_chunk` — LLM answer token by token
- `event: answer_done` — answer complete
- `event: done` — response_time

---

### 8. Tavily-Compatible API Schema (`models/schemas.py`)

**Request:**
```typescript
{
  query: string               // required
  search_depth: "basic" | "advanced"   // basic = snippets, advanced = full extraction
  topic: "general" | "news"
  max_results: 1-20           // default 5
  include_answer: boolean     // default false
  include_raw_content: boolean
  include_images: boolean
  include_domains: string[]
  exclude_domains: string[]
  time_range: "day" | "week" | "month" | "year" | null
}
```

**Response:**
```typescript
{
  query: string
  answer: string | null
  results: [{
    title: string
    url: string
    content: string           // snippet
    score: number             // 0-1
    raw_content: string | null  // full extracted content (if advanced)
  }]
  images: [{ url: string, description: string }]
  response_time: number       // seconds
}
```

**Extract endpoint (bonus — standalone extraction):**
```typescript
POST /extract
{
  urls: string[]              // 1-20 URLs
  extract_depth: "basic" | "advanced"
  format: "markdown" | "text"
}
→ {
  results: [{ url, raw_content }]
  failed_results: [{ url, error }]
  response_time: number
}
```

---

## Mapping to Unstoppable Search

### What We Port Directly (TypeScript)

| Orio Component | Our Equivalent | Notes |
|---------------|---------------|-------|
| `search_backend.py` (DDG) | `LiveWebBackend` | Port the DuckDuckGo backend to TS (use `duckduckgo-search` npm or HTTP scraping). Skip SearXNG for Phase 1 — it requires Docker. |
| `extractor.py` | `ContentExtractor` | Use `@nicosoftware/trafilatura` if available, otherwise `mozilla/readability` (JS port). Same two-tier pattern. Concurrency control with semaphores. |
| `reranker.py` | `Reranker` | FlashRank has no JS port. Options: (a) QVAC as cross-encoder, (b) `onnxruntime-node` with ms-marco model, (c) skip for Phase 1, use RRF only. |
| `llm.py` | `AnswerSynthesizer` | QVAC SDK instead of OpenAI SDK. Same context-building pattern (numbered sources, max chars). Same system prompt. |
| `cache.py` | `CacheLayer` | Replace Redis with Hyperbee (local KV). Same namespace pattern. For persistent data, store in HyperDB/Hyperdrive instead. |
| `resilience.py` | `Resilience` | Port circuit breaker + retry. Use `cockatiel` or hand-roll (it's ~50 lines). |
| `schemas.py` | `types.ts` | Direct port of Pydantic models to TypeScript interfaces. Keep Tavily compatibility. |
| `routers/search.py` | `SearchHandler` | Same flow. Add: (1) check local index first, (2) ingest results into index, (3) fan out to peers. |

### What We Add (Not in Orio)

| Component | Purpose | Stack Module |
|-----------|---------|-------------|
| `LocalIndexBackend` | Search local HyperDB (keyword + semantic) | HyperDB |
| `EmbeddingService` | Generate vectors on ingest + query | QVAC |
| `IngestPipeline` | Extract → embed → index → store → log | HyperDB + Hyperdrive + Hypercore |
| `PeerSyncService` | Replicate index + content with peers | Hyperswarm + Autobase |
| `QueryFanout` | Distribute queries to peers via RPC | RPC |
| `StorageManager` | Pruning, pinning, quotas | Hyperdrive + Hyperbee |

### Key Libraries (TypeScript/Node.js)

| Purpose | Orio (Python) | Our Choice (JS/TS) |
|---------|--------------|-------------------|
| HTTP server | FastAPI | Fastify or built-in `http` |
| HTTP client | httpx | `undici` (built into Node 18+) |
| Content extraction | trafilatura | `@extractus/article-extractor` or `mozilla/readability` + `jsdom` |
| Reranking | flashrank (ONNX) | QVAC or `onnxruntime-node` |
| LLM | openai SDK | QVAC SDK |
| Search fallback | duckduckgo-search | `duck-duck-scrape` or raw HTTP |
| Rate limiting | slowapi | `fastify-rate-limit` or manual |
| Circuit breaker | circuitbreaker | `cockatiel` or manual (~50 lines) |
| Caching | redis | Hyperbee (local P2P KV) |
| Logging | structlog | `pino` |
| Validation | pydantic | `zod` or `typebox` |
| Streaming | sse-starlette | Native `ReadableStream` or `fastify-sse` |

### Content Extraction — JS Options

trafilatura has no direct JS port. Best alternatives:

1. **`@extractus/article-extractor`** — Node.js article extractor, similar to trafilatura. 
   MIT license, extracts title, content, author, date. Good accuracy.
   
2. **`mozilla/readability`** — The JS version of the same readability-lxml Orio uses as fallback.
   Well-maintained (used in Firefox Reader View). Needs `jsdom` for DOM parsing.

3. **`postlight/parser`** (formerly Mercury Parser) — Another option, similar to readability.

Recommended: `@extractus/article-extractor` as primary, `mozilla/readability` + `jsdom` as fallback.
Same two-tier pattern as Orio.

### Search — DuckDuckGo in JS

Options:
1. **`duck-duck-scrape`** — npm package, scrapes DDG HTML results
2. **Raw HTTP** — DDG has an unofficial API at `https://html.duckduckgo.com/html/`
3. **`searxng` Docker** — Same as Orio, but requires Docker

For Phase 1: `duck-duck-scrape` or raw HTTP. Lightweight, no Docker.
For Phase 2+: Optional SearXNG for more engines.

---

## Implementation Order

Based on the Orio analysis, here's what to build first:

### Sprint 1: Local Search (port Orio's core, add persistence)

```
1. types.ts                  — Port schemas.py (Tavily-compatible types)
2. ContentExtractor          — Port extractor.py (article-extractor + readability)
3. LiveWebBackend            — Port DuckDuckGo backend
4. IngestPipeline            — NEW: extract → embed → store (HyperDB + Hyperdrive)
5. LocalIndexBackend         — NEW: search HyperDB (keyword match)
6. SearchHandler             — Port search.py flow (local index → live web → ingest → respond)
7. HTTP server               — Tavily-compatible API on localhost:7700
```

### Sprint 2: AI layer

```
8. EmbeddingService          — QVAC embeddings on ingest + query
9. SemanticSearch             — Cosine similarity on HyperDB embeddings
10. HybridRanker             — RRF merge of keyword + semantic scores
11. AnswerSynthesizer        — Port llm.py (QVAC instead of OpenAI)
12. Reranker                 — FlashRank via ONNX or QVAC cross-encoder
```

### Sprint 3: P2P

```
13. PeerSyncService          — Hyperswarm + Autobase replication
14. QueryFanout              — RPC-based distributed queries
15. StorageManager           — Pruning, pinning, quotas
```
