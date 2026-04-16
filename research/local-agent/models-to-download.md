# Models to Download for Unstoppable Agent POC

> **Machine**: Apple Silicon Mac, ~65% unified memory available for models
> **Date**: 2026-03-15

---

## Priority 1 — LM Studio (OpenAI-compatible provider)

These are the primary models for the agent POC. Run via LM Studio which exposes `localhost:1234/v1/chat/completions`.

| # | Model | LM Studio ID | Score | tok/s | RAM | Context | Use |
|---|-------|-------------|-------|-------|-----|---------|-----|
| **1** | **Qwen3-Coder-30B-A3B MLX-4bit** | `lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-4bit` | 96 | ~90 | 65% | 262K | Primary coding agent model |
| 2 | Qwen3-30B-A3B MLX-4bit | `lmstudio-community/Qwen3-30B-A3B-Instruct-2507-MLX-4bit` | 94 | ~90 | 65% | 262K | General-purpose fallback |
| 3 | DeepSeek-Coder-V2-Lite-Instruct | `deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct` | 92 | ~125 | 33% | 131K | Fast coding alternative |

**Start with #1** — Qwen3-Coder-30B-A3B is the best local coding model available. MoE with only 3B active params means fast inference despite 30B total.

---

## Priority 2 — QVAC LLMs (native P2P + tool calling)

These run through QVAC SDK directly, enabling P2P delegated inference and native integration.

| # | Model | Source | Params | Quant | Use |
|---|-------|--------|--------|-------|-----|
| **4** | **Qwen3-4B** | `Qwen3-4B-Q4_K_M.gguf` | 4B | Q4_K_M | Best QVAC tool calling model |
| 5 | Qwen3-8B | `Qwen3-8B-Q4_K_M.gguf` | 8B | Q4_K_M | Higher quality QVAC inference |
| 6 | Qwen3-0.6B | `Qwen3-0.6B-Q4_0.gguf` | 600M | Q4 | Ultra-fast for simple tasks / triage |
| 7 | Qwen3-1.7B | `Qwen3-1.7B-Q4_0.gguf` | 1.7B | Q4 | Balanced speed/quality |
| 8 | GPT-OSS-20B | `gpt-oss-20b-Q4_K_M.gguf` | 20B | Q4_K_M | Desktop-grade quality (needs 46% RAM) |

---

## Priority 3 — QVAC Embeddings (for RAG / skill search)

| # | Model | Source | Params | Quant | Use |
|---|-------|--------|--------|-------|-----|
| **9** | **GTE-Large** | `gte-large_fp16.gguf` | 335M | FP16 | Code embeddings, P2P skill search |
| 10 | EmbeddingGemma-300M | `embeddinggemma-300m-Q4_0.gguf` | 300M | Q4 | Lighter multilingual alternative |

---

## Priority 4 — QVAC Vision (read screenshots / docs)

| # | Model | Source | Params | Quant | Use |
|---|-------|--------|--------|-------|-----|
| **11** | **Qwen3-VL-2B** | `Qwen3VL-2B-Instruct-Q4_K_M.gguf` | 2B | Q4_K | Read images, code screenshots |
| **12** | Qwen3-VL-2B mmproj | `mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf` | — | Q8 | Required vision adapter for #11 |
| 13 | SmolVLM2-500M | `SmolVLM2-500M-Video-Instruct-Q8_0.gguf` | 500M | Q8 | Lighter vision alternative |
| 14 | SmolVLM2-500M mmproj | `mmproj-SmolVLM2-500M-Video-Instruct-Q8_0.gguf` | — | Q8 | Required vision adapter for #13 |
| 15 | LightOnOCR-2-1B | `LightOnOCR-2-1B-ocr-soup-Q4_K_M.gguf` | 0.6B | Q4_K_M | OCR-specialized document reading |
| 16 | LightOnOCR-2-1B mmproj | `mmproj-F16.gguf` (LightOnOCR) | — | F16 | Required vision adapter for #15 |

---

## Priority 5 — QVAC Transcription (voice input)

| # | Model | Source | Use |
|---|-------|--------|-----|
| **17** | **Whisper Large V3 Turbo** | `ggml-large-v3-turbo.bin` | Best quality STT |
| 18 | Whisper Small EN Q8 | `ggml-small.en-q8_0.bin` | Fast English-only |
| 19 | Silero VAD | `ggml-silero-v5.1.2.bin` | Voice activity detection (required for streaming) |

---

## Priority 6 — Nice to Have (later phases)

### Translation
| Model | Source | Languages |
|-------|--------|-----------|
| OPUS EN-ES Q4 | `ggml-opus-en-es.bin` | English to Spanish |
| OPUS ES-EN Q4 | `ggml-opus-es-en.bin` | Spanish to English |

### TTS
| Model | Source | Use |
|-------|--------|-----|
| Chatterbox Multilingual Q4 | chatterbox-multilingual-ONNX (q4 set) | EN/ES/IT/PT voice output |

### Image Generation
| Model | Source | Use |
|-------|--------|-----|
| FLUX.2 Klein 4B Q4 | `flux-2-klein-4b-Q4_0.gguf` | Local image generation |
| Stable Diffusion XL Q4 | `stable-diffusion-xl-base-1.0-Q4_0.gguf` | Lighter alternative |

### OCR
| Model | Source | Use |
|-------|--------|-----|
| CRAFT Detector | `detector_craft.onnx` | Text detection in images |
| Latin Recognizer | `recognizer_latin.onnx` | Latin text recognition |

---

## Quick Download Summary

**Download right now (5 models for POC):**

```
LM Studio → search and download:
  1. Qwen3-Coder-30B-A3B-Instruct-MLX-4bit

QVAC (already available via SDK constants):
  2. Qwen3-4B-Q4_K_M          (tool calling)
  3. GTE-Large FP16            (embeddings)
  4. Whisper Large V3 Turbo    (transcription)
  5. Qwen3-VL-2B + mmproj     (vision)
```

**Download when you have time (better alternatives):**

```
LM Studio:
  6. Qwen3-30B-A3B-Instruct-2507-MLX-4bit  (general fallback)
  7. DeepSeek-Coder-V2-Lite-Instruct        (fast coding)

QVAC:
  8. Qwen3-8B-Q4_K_M          (higher quality tool calling)
  9. GPT-OSS-20B-Q4_K_M       (desktop-grade)
```
