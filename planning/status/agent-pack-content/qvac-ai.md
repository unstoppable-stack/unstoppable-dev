# QVAC (Local AI) — Content Status

**6 battle-tested, 10 docs-only, 1 not covered** out of 17 items.

---

## Chat / LLM Inference — DONE

| Item | Status |
|------|--------|
| Chat completion (streaming) | Battle-tested |
| KV Cache (multi-turn) | Battle-tested |
| Tool calling (Zod v4) | Battle-tested |
| Model loading / unloading | Battle-tested |
| Model download with progress | Battle-tested |
| Think tag filtering | Battle-tested |

Well covered. No further work needed.

---

## Vision / Multimodal — DOCS ONLY

| Item | Status | Reference |
|------|--------|-----------|
| Image input (multimodal models) | Docs only | `qvac-examples/llamacpp-multimodal.ts` |
| Model selection for vision | Docs only | QVAC docs `sdk/multimodal.mdx` |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Build small test app using multimodal example as reference | Medium |
| 2 | Update `recipes/qvac-multimodal-vision.md` with real findings | Small |

---

## Embeddings / RAG — DOCS ONLY

| Item | Status | Reference |
|------|--------|-----------|
| Text embeddings | Docs only | QVAC docs `sdk/text-embeddings.mdx` |
| RAG (save/search/delete) | Docs only | QVAC docs `sdk/rag.mdx` |
| Embed from Hyperdrive | Not covered | `qvac-examples/embed-hyperdrive.ts` |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Test embeddings + RAG with QVAC examples | Medium |
| 2 | Update `recipes/qvac-embeddings-rag-sqlite.md` with real findings | Small |

---

## Transcription (Whisper) — DOCS ONLY

| Item | Status | Reference |
|------|--------|-----------|
| Audio file transcription | Docs only | `qvac-examples/whispercpp-filesystem.ts` |
| Microphone recording | Not covered | `qvac-examples/whispercpp-microphone-record.ts` |
| Streaming transcription | Not covered | QVAC docs `sdk/api/latest/transcribeStream.mdx` |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Test file transcription with Whisper example | Medium |
| 2 | Write recipe for transcription patterns | Small |

---

## Translation — DOCS ONLY

| Item | Status | Reference |
|------|--------|-----------|
| Text translation | Docs only | `qvac-examples/translation/` |
| Language detection | Not covered | — |

---

## Text-to-Speech — NOT COVERED

| Item | Status | Reference |
|------|--------|-----------|
| TTS generation | Not covered | `qvac-examples/text-to-speech.ts` |
| TTS addon (`tts-onnx`) | Not covered | QVAC docs `addons/tts-onnx/` |

---

## OCR — NOT COVERED

| Item | Status | Reference |
|------|--------|-----------|
| OCR text extraction | Not covered | `qvac-examples/ocr-fasttext.ts` |
| OCR addon (`ocr-onnx`) | Not covered | QVAC docs `addons/ocr-onnx/` |

---

## Delegated Inference — DOCS ONLY

| Item | Status | Reference |
|------|--------|-----------|
| Delegated inference to remote | Docs only | QVAC docs `sdk/delegated-inference.mdx` |
| Blind relays | Not covered | `qvac-examples/download-with-blind-relays.ts` |

Key for Vault (AI Provider service) and subscription model.

---

## Advanced — DOCS ONLY / NOT COVERED

| Item | Status | Reference |
|------|--------|-----------|
| Sharded models | Docs only | QVAC docs `sdk/sharded-models.mdx` |
| Model registry / discovery | Docs only | QVAC docs `discover.mdx` |
| Logging / file transport | Docs only | `qvac-examples/logging-*.ts` |
| MCP (websearch, etc.) | Not covered | `qvac-examples/mcp-websearch.ts` |
| Cache management | Not covered | `qvac-examples/cache-management.ts` |

Lower priority, more niche use cases.
