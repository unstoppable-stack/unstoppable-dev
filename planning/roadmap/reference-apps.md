# Next Apps to Build

Each app is designed to validate specific items from the category roadmaps.
Build in priority order — each builds on the last.

---

## App 3: P2P File Sync

**Primary validation:** Hyperdrive, Corestore, Hyperdrive mirroring

**Concept:** Drop files on one device, they appear on the other. P2P Dropbox.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker (reuse proven pattern) |
| **P2P** | Hyperdrive (create, read, write, watch, mirror), Corestore (multi-core, namespace), Hypercore replication (standalone) |
| **QVAC** | Optional: RAG from Hyperdrive (`embed-hyperdrive.ts` example) |

**Agent pack updates:** modules/hyperdrive.md, modules/corestore.md, skills/file-sharing/, new recipe: hyperdrive-mirror

**Effort:** Medium

---

## App 4: Collaborative Notes

**Primary validation:** HyperDB, multi-writer replication, offline-first

**Concept:** Shared notes between peers. Multiple writers, merges when
reconnected. Works offline.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker |
| **P2P** | HyperDB (schemas, queries, indexes), Multi-writer replication, Offline-first sync pattern |
| **Data** | HyperDB auto-replication vs manual Hypercore replication |

**Agent pack updates:** modules/hyperdb.md, skills/add-p2p-sync/, skills/offline-first-app/, new recipes: hyperdb-multi-writer, offline-first-merge

**Effort:** Medium-High (multi-writer is the unknown)

---

## App 5: Encrypted Chat

**Primary validation:** SecretStream, Protomux, compact-encoding

**Concept:** 1:1 and group chat with end-to-end encryption. Multiple
protocol channels on a single connection.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker |
| **P2P** | SecretStream (Noise encryption, key exchange), Protomux (channels, multiplexing), Compact-encoding (binary messages), Pub/sub pattern |
| **Data** | Hypercore (chat history as append-only log) |

**Agent pack updates:** new modules: secret-stream.md, protomux.md. Rewrite skills/secure-communication/, new recipe: protomux-channels

**Effort:** Medium

---

## App 6: AI Knowledge Base

**Primary validation:** QVAC Vision, Embeddings/RAG, Hyperdrive integration

**Concept:** A personal knowledge base where you can save documents, images,
and notes. Ask questions and get answers from your local data using RAG.
OCR for scanned documents.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker |
| **QVAC** | Embeddings (text-embeddings), RAG (save/search/delete), Vision/multimodal (image input), OCR (document scanning) |
| **P2P** | Hyperdrive (store documents), Hyperbee (metadata index) |

**Agent pack updates:** validate recipes: qvac-embeddings-rag-sqlite, qvac-multimodal-vision. New recipe: qvac-ocr, new recipe: hyperdrive-rag

**Effort:** Medium

---

## App 7: Voice Notes

**Primary validation:** QVAC Transcription, Translation, TTS

**Concept:** Record voice notes, auto-transcribe, optionally translate.
TTS to read back notes. Sync between devices over P2P.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker |
| **QVAC** | Transcription (file + microphone), Translation, Text-to-Speech |
| **P2P** | Hyperdrive (store audio files), Hyperswarm (sync between devices) |

**Agent pack updates:** validate recipes: qvac-transcription, qvac-translation. New recipe: qvac-tts

**Effort:** Medium

---

## App 8: Coffee Assistant with Payments

**Primary validation:** WDK Wallet (all core operations)

**Concept:** Extend the existing coffee-assistant-ui to accept USDt
payments for orders.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Pear Desktop + Worker (extend existing) |
| **WDK** | Wallet creation, Send/receive USDt, Balance query, Transaction history, Payment verification over P2P |
| **P2P** | Payment messages over existing RPC connection |

**Agent pack updates:** modules/wdk.md (major rewrite), skills/wallet-integration/ (rewrite), new recipe: p2p-payments

**Effort:** Medium (depends on WDK SDK maturity)

---

## App 9: P2P Search Engine (Unstoppable Search)

**Primary validation:** HyperDB (multi-writer at scale), Hyperdrive (content store), QVAC (embeddings + ranking + synthesis), RPC (distributed queries), Corestore

**Concept:** A P2P search engine for AI agents. Each node crawls, indexes, and
searches locally. Indexes sync between peers via Hyperswarm. QVAC handles
embeddings, ranking, and answer synthesis. Exposes a Tavily-compatible HTTP API
so existing agent tooling works with zero changes.

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Bare standalone or Pear Desktop + Worker |
| **P2P** | HyperDB (multi-writer index via Autobase), Hyperdrive (content store, sparse download), Hypercore (crawl log), Hyperswarm (topic-based discovery), Corestore (multi-core management) |
| **QVAC** | Embeddings (text→vector), Re-ranking (cross-encoder), Answer synthesis (LLM), Content extraction |
| **RPC** | Distributed query fan-out to peers |

**Agent pack updates:** new skill: p2p-search-node, new recipes: hyperdb-search-index, qvac-embeddings-search, distributed-rpc-query, tavily-compatible-api

**Effort:** Large (phased: local MVP in 1-2 weeks, P2P sync in 2-3 weeks)

**Detailed planning:** `planning/features/p2p-search.md`

---

## App 10: Mobile P2P App

**Primary validation:** Expo Bare, bare-pack, mobile lifecycle

**Concept:** Mobile version of one of the previous apps (chat or notes).

| Category | Items to validate |
|----------|-------------------|
| **Platform** | Expo Bare, react-native-bare-kit, bare-pack (iOS/Android), Bare suspend/resume lifecycle |
| **P2P** | Hyperswarm on mobile (NAT traversal) |
| **QVAC** | On-device inference (mobile constraints) |

**Agent pack updates:** modules/expo-bare.md (major rewrite), new skill: mobile-p2p-app, new recipe: bare-pack-mobile

**Effort:** High (mobile toolchain is complex)

---

## Coverage Impact

After building all apps:

| Category | Before | After |
|----------|--------|-------|
| Platform | 3/9 battle-tested | 7/9 (missing: Pear terminal, Electron) |
| QVAC | 6/17 battle-tested | 15/17 (missing: delegated, sharded) |
| P2P | 7/15 battle-tested | 15/15 |
| WDK | 0/6 battle-tested | 5/6 (missing: recurring/subscriptions) |
| **Total** | **21/54 (39%)** | **~46/54 (85%)** |

---

## Suggested Order

| # | App | Primary Target | Blocking? |
|---|-----|---------------|-----------|
| 3 | P2P File Sync | Hyperdrive, Corestore | No |
| 4 | Collaborative Notes | HyperDB, Multi-writer | No |
| 5 | Encrypted Chat | SecretStream, Protomux | No |
| 6 | AI Knowledge Base | QVAC Vision, RAG, OCR | Needs Hyperdrive (app 3) |
| 7 | Voice Notes | QVAC Transcription, TTS | No |
| 8 | Payments | WDK Wallet | Depends on WDK SDK docs |
| 9 | P2P Search Engine | HyperDB, QVAC, RPC, Hyperdrive | Benefits from apps 3+4+6 |
| 10 | Mobile | Expo Bare | No (but highest effort) |

Apps 3, 4, 5, 7 are independent. App 6 benefits from Hyperdrive (app 3).
App 8 depends on WDK docs. App 9 benefits from learnings in apps 3 (Hyperdrive),
4 (HyperDB multi-writer), and 6 (QVAC embeddings). App 10 is standalone but complex.
