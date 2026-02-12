# QVAC (Local AI) Roadmap

## Chat / LLM Inference

| Item | Status | Agent Pack File | Validated By |
|------|--------|----------------|-------------|
| Chat completion (streaming) | Battle-tested | skills/qvac-chat-app/, recipes/local-inference.md | coffee-assistant, coffee-assistant-ui |
| KV Cache (multi-turn perf) | Battle-tested | recipes/qvac-kv-cache.md | coffee-assistant |
| Tool calling (Zod v4) | Battle-tested | skills/qvac-tool-calling/, recipes/qvac-tool-calling.md | coffee-assistant, coffee-assistant-ui |
| Model loading / unloading | Battle-tested | components/ai/model-manager.ts | coffee-assistant |
| Model download with progress | Battle-tested | components/ai/model-manager.ts | coffee-assistant |
| Think tag filtering (`<think>`) | Battle-tested | coffee-assistant-ui fixes | coffee-assistant-ui |
| System prompt design | Battle-tested | skills/qvac-chat-app/ | coffee-assistant |
| History trimming | Battle-tested | components/ai/chat-session.ts | coffee-assistant |
| `tools: true` flag (required) | Battle-tested | skills/qvac-tool-calling/ | coffee-assistant |
| Model selection guide | Docs only | resources/model-guide.md | From QVAC docs |

### Covered well. Focus: keep model guide updated as new models ship.

---

## Vision / Multimodal

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Image input (multimodal models) | Docs only | recipes/qvac-multimodal-vision.md | `qvac-examples/llamacpp-multimodal.ts` |
| Model selection for vision | Docs only | recipes/qvac-multimodal-vision.md | QVAC docs `sdk/multimodal.mdx` |

### Next app idea: Image-based app (plant identifier, receipt scanner, etc.)

---

## Transcription (Whisper)

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Audio file transcription | Docs only | recipes/qvac-transcription.md | `qvac-examples/whispercpp-filesystem.ts` |
| Microphone recording | Not covered | — | `qvac-examples/whispercpp-microphone-record.ts` |
| Transcription with prompts | Not covered | — | `qvac-examples/whispercpp-prompt.ts` |
| Streaming transcription | Not covered | — | QVAC docs `sdk/api/latest/transcribeStream.mdx` |

### Next app idea: Voice notes app with P2P sync, or meeting transcription tool

---

## Translation

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Text translation | Docs only | recipes/qvac-translation.md | `qvac-examples/translation/` |
| Language detection | Not covered | — | — |

### Could be combined with transcription app (translate voice notes)

---

## Text-to-Speech

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| TTS generation | Not covered | — | `qvac-examples/text-to-speech.ts` |
| TTS addon (`tts-onnx`) | Not covered | — | QVAC docs `addons/tts-onnx/` |

### Next app idea: Accessibility app (read text aloud), language learning

---

## OCR

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| OCR text extraction | Not covered | — | `qvac-examples/ocr-fasttext.ts` |
| OCR addon (`ocr-onnx`) | Not covered | — | QVAC docs `addons/ocr-onnx/` |

### Next app idea: Document scanner, receipt tracker (combine with finance)

---

## Embeddings / RAG

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Text embeddings | Docs only | recipes/qvac-embeddings-rag-sqlite.md | QVAC docs `sdk/text-embeddings.mdx` |
| RAG (save/search/delete) | Docs only | recipes/qvac-embeddings-rag-sqlite.md | QVAC docs `sdk/rag.mdx` |
| Embed from Hyperdrive | Not covered | — | `qvac-examples/embed-hyperdrive.ts` |

### Next app idea: Personal knowledge base (notes + RAG search), P2P wiki

---

## Delegated Inference

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Delegated inference to remote QVAC | Docs only | recipes/qvac-delegated-inference.md | QVAC docs `sdk/delegated-inference.mdx` |
| Blind relays | Not covered | — | QVAC docs `sdk/blind-relays.mdx`, `qvac-examples/download-with-blind-relays.ts` |

### Important for subscriptions — users could delegate to Tether cloud

---

## Advanced

| Item | Status | Agent Pack File | Reference |
|------|--------|----------------|-----------|
| Sharded models | Docs only | — | QVAC docs `sdk/sharded-models.mdx` |
| Model registry / discovery | Docs only | recipes/qvac-model-sources.md | QVAC docs `discover.mdx` |
| Logging / file transport | Docs only | recipes/qvac-logging.md | `qvac-examples/logging-*.ts` |
| Cache management | Not covered | — | `qvac-examples/cache-management.ts` |
| Config reload | Not covered | — | `qvac-examples/config-reload.ts` |
| Parallel downloads | Not covered | — | `qvac-examples/parallel-download.ts` |
| MCP (websearch, etc.) | Not covered | — | `qvac-examples/mcp-websearch.ts` |
| LlamaCpp native tools | Not covered | — | `qvac-examples/llamacpp-native-tools.ts` |
| LlamaCpp HTTP backend | Not covered | — | `qvac-examples/llamacpp-http.ts` |
| LlamaCpp Hyperdrive backend | Not covered | — | `qvac-examples/llamacpp-hyperdrive.ts` |

---

## Priority Order

1. **Vision/Multimodal** — High value, existing recipe just needs validation
2. **Embeddings/RAG** — Critical for knowledge apps, connects to Hyperdrive
3. **Transcription** — High user value (voice notes, accessibility)
4. **Delegated Inference** — Key for the subscription business model
5. **OCR** — Useful for document/finance apps
6. **TTS** — Nice to have (accessibility, language learning)
7. **Translation** — Can combine with transcription
8. **Advanced** — Lower priority, more niche use cases
