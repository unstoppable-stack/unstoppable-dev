---
name: add-ai-rag
description: Local embeddings and RAG with QVAC and SQLite vector search.
when_to_use: User wants semantic search, knowledge bases, or context-aware AI over local documents using embeddings.
paths: ["src/ai/**", "src/search/**"]
version: "2026-04-14"
---

# Add AI RAG (QVAC Embeddings + Search)

## When to Use
- User wants semantic search over documents
- User mentions "RAG", "embeddings", "knowledge base", "search", "vector database"
- User needs AI that answers questions from their own data
- User wants to index and query local files

## Prerequisites
- `@qvac/sdk` (`^0.8.0`) installed
- An LLM for generation (see `add-ai-chat`)
- An embedding model for vectorization

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install dependencies**:
   ```bash
   npm i @qvac/sdk better-sqlite3
   ```

2. **Load an embedding model**:
   ```ts
   import { loadModel, embed } from '@qvac/sdk'

   const embedModelId = await loadModel({
     modelSrc: 'embedding-model-constant', // Check QVAC docs
     modelType: 'embedding',
   })
   ```

3. **Create vector storage** with SQLite:
   ```ts
   import Database from 'better-sqlite3'

   const db = new Database('./vectors.db')
   db.exec(`
     CREATE TABLE IF NOT EXISTS documents (
       id TEXT PRIMARY KEY,
       content TEXT NOT NULL,
       embedding BLOB NOT NULL
     )
   `)
   ```

4. **Index documents**:
   ```ts
   async function indexDocument(id: string, content: string) {
     const vector = await embed({ modelId: embedModelId, text: content })
     db.prepare('INSERT OR REPLACE INTO documents (id, content, embedding) VALUES (?, ?, ?)')
       .run(id, content, Buffer.from(new Float32Array(vector).buffer))
   }
   ```

5. **Search by similarity**:
   ```ts
   function cosineSimilarity(a: Float32Array, b: Float32Array): number {
     let dot = 0, normA = 0, normB = 0
     for (let i = 0; i < a.length; i++) {
       dot += a[i] * b[i]
       normA += a[i] * a[i]
       normB += b[i] * b[i]
     }
     return dot / (Math.sqrt(normA) * Math.sqrt(normB))
   }

   async function search(query: string, topK = 5) {
     const queryVec = await embed({ modelId: embedModelId, text: query })
     const rows = db.prepare('SELECT id, content, embedding FROM documents').all()

     return rows
       .map((row) => ({
         ...row,
         score: cosineSimilarity(
           new Float32Array(queryVec),
           new Float32Array(row.embedding.buffer)
         ),
       }))
       .sort((a, b) => b.score - a.score)
       .slice(0, topK)
   }
   ```

6. **Generate answers with context** (RAG loop):
   ```ts
   async function askWithContext(question: string) {
     const relevant = await search(question, 3)
     const context = relevant.map(r => r.content).join('\n\n---\n\n')

     const result = completion({
       modelId: llmModelId,
       history: [
         { role: 'system', content: `Answer based on this context:\n\n${context}` },
         { role: 'user', content: question },
       ],
       stream: true,
     })

     for await (const token of result.tokenStream) {
       process.stdout.write(token)
     }
   }
   ```

## P2P Knowledge Sharing

Combine with `add-file-storage` (Hyperdrive) for P2P document sharing:
- Store documents in Hyperdrive, index embeddings locally
- When peers sync new files, automatically index them
- Each peer has their own embedding index but shared source documents

## Use Cases
- Personal knowledge base (notes + semantic search)
- P2P wiki with AI-powered Q&A
- Document assistant (ask questions about PDFs, code, etc.)
- Customer support bot over local documentation

## Critical Rules
- **Chunk before embedding** — never embed entire documents at once. Split into 500-1000 token chunks with overlap for context continuity.
- **Chunk size affects quality** — too small loses context, too large dilutes relevance. Experiment with your data.
- **Verify embedding model is loaded before querying** — calling `embed()` before `loadModel()` resolves silently fails or throws cryptic errors.
- **Use SQLite for vector storage on mobile** — `better-sqlite3` doesn't work in Bare/Expo; use a compatible SQLite binding.
- **Don't mix embedding dimensions** — if you re-index with a different model, drop and recreate the vector table. Mismatched dimensions produce garbage similarity scores.
- **Don't skip re-indexing on document changes** — stale embeddings return outdated or wrong results.
- **Don't load all rows for search at scale** — the naive `SELECT * FROM documents` approach breaks past ~10K rows. Add approximate nearest-neighbor indexing or pagination.

## Validation
1. Embedding model loads without errors (`loadModel` with `modelType: 'embedding'` resolves)
2. `embed()` returns a vector of the expected dimension for a sample string
3. Documents are chunked and inserted into SQLite (verify row count matches expected chunks)
4. Search query returns results sorted by relevance (top result should be semantically closest)
5. RAG-generated answers reference the correct context (not hallucinated content)
6. Re-indexing after document change produces updated search results
7. On mobile/Bare: SQLite binding loads and vector table is accessible

## Key Gotchas
- Embedding models are separate from LLM models — load both
- SQLite works well for <100K documents; consider dedicated vector DB for larger sets
- Chunk long documents (500-1000 tokens per chunk) for better retrieval
- Re-index when documents change
- Embedding dimensions must match between index and query time

> **Status**: Docs only. Based on QVAC documentation (`sdk/text-embeddings.mdx`,
> `sdk/rag.mdx`) and `research/qvac-examples/embed-hyperdrive.ts`. Not yet
> validated with a battle-tested reference app.
