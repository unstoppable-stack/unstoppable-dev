---
name: add-ai-rag
description: Local embeddings and RAG with QVAC workspaces (ragIngest, ragSearch) — no manual vector DB required.
when_to_use: User wants semantic search, knowledge bases, or context-aware AI over local documents using embeddings.
paths: ["src/ai/**", "src/search/**"]
version: "2026-04-20"
---

# Add AI RAG (QVAC Workspaces)

## When to Use
- User wants semantic search over documents
- User mentions "RAG", "embeddings", "knowledge base", "search", "vector database"
- User needs AI that answers questions from their own data
- User wants to index and query local files

## Prerequisites
- `@qvac/sdk` (`^0.9.0`) installed
- An LLM for generation (see `add-ai-chat`)
- An embedding model (defaults: `GTE_LARGE_FP16`, `EMBEDDINGGEMMA_300M_Q4_0`)

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## What Changed in 0.9 — Workspaces

RAG is now **workspace-scoped**. Instead of one flat vector store, QVAC gives
you isolated per-topic stores backed by Corestore/HyperDB, with built-in:

- Chunking (`ragChunk`, or the integrated pipeline in `ragIngest`)
- Embedding generation (`embed`)
- Vector storage + HyperDB k-means indexing (`ragSaveEmbeddings`, `ragReindex`)
- Cosine similarity search (`ragSearch`)
- Workspace lifecycle (`ragListWorkspaces`, `ragCloseWorkspace`,
  `ragDeleteWorkspace`)

You should **not** roll your own SQLite + cosine similarity code in 0.9 unless
you have a very specific reason — the built-in workspace API is faster, handles
centroid reindexing, and scales further.

All RAG functions accept an optional `workspace: string` (defaults to
`"default"`).

## Steps

1. **Install dependencies** (no vector DB needed):
   ```bash
   npm i @qvac/sdk
   ```

2. **Load an embedding model**:
   ```ts
   import { loadModel, GTE_LARGE_FP16 } from '@qvac/sdk'

   const embedModelId = await loadModel({
     modelSrc: GTE_LARGE_FP16,
     modelType: 'embeddings',
   })
   ```

3. **Ingest documents** (chunk → embed → save in one call):
   ```ts
   import { ragIngest } from '@qvac/sdk'

   await ragIngest({
     modelId: embedModelId,
     workspace: 'product-docs', // optional, defaults to 'default'
     documents: [
       { id: 'intro', content: 'Long article text...' },
       { id: 'faq',   content: 'Q&A text...' },
     ],
     chunkOpts: { chunkSize: 800, overlap: 100 },
     onProgress: ({ stage, current, total }) => {
       console.log(`[${stage}] ${current}/${total}`)
     },
   })
   ```

   The `id` on each document is the *parent* id — chunks receive
   `${id}-chunk-${n}` automatically.

4. **Search** (returns top-K matches sorted by cosine similarity):
   ```ts
   import { ragSearch } from '@qvac/sdk'

   const hits = await ragSearch({
     modelId: embedModelId,
     workspace: 'product-docs',
     query: 'How do I reset my password?',
     topK: 5,
   })
   // hits: Array<{ id: string, content: string, score: number }>
   ```

5. **Generate answers with retrieved context** (full RAG loop):
   ```ts
   import { completion, loadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'

   const llmModelId = await loadModel({
     modelSrc: LLAMA_3_2_1B_INST_Q4_0,
     modelType: 'llm',
     modelConfig: {
       ctx_size: 4096,
       system_prompt:
         'Answer strictly from the provided context. If the answer is not in ' +
         'the context, say you do not know.',
     },
   })

   async function ask(question: string) {
     const hits = await ragSearch({
       modelId: embedModelId,
       workspace: 'product-docs',
       query: question,
       topK: 3,
     })
     const context = hits.map((h) => h.content).join('\n\n---\n\n')

     const result = completion({
       modelId: llmModelId,
       history: [
         { role: 'user', content: `Context:\n\n${context}\n\nQuestion: ${question}` },
       ],
       stream: true,
       generationParams: { temp: 0.3 },
     })

     for await (const token of result.tokenStream) process.stdout.write(token)
   }
   ```

## Segregated pipeline (advanced)

When you need control over each step (e.g., dedup before embedding, batch by
topic, or embed-then-discard-content), use the low-level APIs:

```ts
import { ragChunk, embed, ragSaveEmbeddings } from '@qvac/sdk'

const chunks = await ragChunk({
  documents: [{ id: 'doc1', content: longText }],
  chunkOpts: { chunkSize: 800, overlap: 100 },
})

const vectors = await embed({
  modelId: embedModelId,
  text: chunks.map((c) => c.content),
})

await ragSaveEmbeddings({
  workspace: 'product-docs',
  documents: chunks.map((c, i) => ({
    id: c.id,
    content: c.content,
    embedding: vectors[i],
  })),
})
```

## Workspace lifecycle

```ts
import {
  ragListWorkspaces,
  ragCloseWorkspace,
  ragDeleteWorkspace,
  ragDeleteEmbeddings,
  ragReindex,
} from '@qvac/sdk'

// Discover
const list = await ragListWorkspaces() // [{ name, open }]

// Release memory when switching topics (data stays on disk)
await ragCloseWorkspace({ workspace: 'product-docs' })

// Delete specific docs
await ragDeleteEmbeddings({
  workspace: 'product-docs',
  ids: ['intro', 'faq-chunk-3'],
})

// Rebalance HyperDB centroids after large changes (needs ≥16 docs)
await ragReindex({ workspace: 'product-docs' })

// Nuke everything (workspace must be closed first)
await ragDeleteWorkspace({ workspace: 'product-docs' })
```

## P2P Knowledge Sharing

Combine with `add-file-storage` (Hyperdrive) for P2P document sharing:
- Store source documents in Hyperdrive, index embeddings into a local workspace
- When peers sync new files, run them through `ragIngest` to add to the workspace
- Each peer has their own embedding index but shared source documents

## Use Cases
- Personal knowledge base (notes + semantic search)
- Multi-topic assistants — one workspace per project / customer / channel
- Document assistant (ask questions about PDFs, code, notes)
- P2P wiki with AI-powered Q&A

## Critical Rules
- **Use workspaces for multi-topic apps** — default is fine for a single store,
  but isolating topics avoids cross-contamination and lets you free memory per
  topic via `ragCloseWorkspace`.
- **Call `ragCloseWorkspace` when switching topics** — each open workspace
  holds Corestore/HyperDB handles. Close to release memory.
- **Run `ragReindex` after bulk changes** — k-means centroids drift as you add
  thousands of docs. Reindex once you pass ~16 docs, and periodically thereafter.
- **Don't mix embedding models within a workspace** — if you change models, drop
  the workspace (`ragDeleteWorkspace`) and re-ingest. Mismatched dimensions
  produce garbage similarity.
- **Don't embed entire documents at once** — `ragIngest` chunks for you; if you
  use `ragSaveEmbeddings` directly, chunk first with `ragChunk`.
- **Don't re-embed unchanged content** — track source hashes and skip re-ingest.
- **Load the embedding model with `modelType: 'embeddings'`** (note the plural).

## Validation
1. `loadModel({ modelType: 'embeddings' })` resolves without error
2. `ragIngest` completes and `ragListWorkspaces()` reports the workspace as open
3. `ragSearch` returns results sorted by descending `score` (top result is the
   semantically closest chunk)
4. RAG-generated answers reference the retrieved context (not hallucinated)
5. `ragCloseWorkspace` followed by `ragListWorkspaces()` shows `open: false`
6. Re-ingest after edits → `ragSearch` returns updated chunks

## Key Gotchas
- **Default workspace name is `"default"`** — multi-topic apps should pass an
  explicit `workspace` string
- Embedding models are separate from LLM models — load both
- `modelType` for embedding models is `'embeddings'` (plural), not `'embedding'`
- `ragReindex` requires ≥16 docs by default
- Deleting a workspace requires it to be closed first
- Workspace data lives under the SDK `cacheDirectory`; survive app restarts unless
  explicitly deleted

> **Status**: Docs only, using the 0.9 workspace API. Based on QVAC
> documentation (`sdk/text-embeddings.mdx`, `sdk/rag.mdx`, `llms-full.txt`) and
> `research/qvac-examples/embed-hyperdrive.ts`. Not yet validated with a
> battle-tested reference app.
