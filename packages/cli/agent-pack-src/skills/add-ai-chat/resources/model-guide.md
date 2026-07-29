# QVAC Model Selection Guide

## Verified Model Constants (`@qvac/sdk@0.15.0`)

These are the **exact import names** from `@qvac/sdk`. Only use constants listed
here. For anything else, use the model registry (`modelRegistryList()`,
`modelRegistrySearch({ query })`, `modelRegistryGetModel({ name })`) or pass an
explicit `modelSrc` (local path, HTTP(S) URL, `pear://` URL, or registry URL).

### LLM Models

| Constant | Family | Size | Best For |
|----------|--------|------|----------|
| `QWEN3_5_0_8B_MULTIMODAL_Q4_K_M` | Qwen 3.5 | ~0.5GB | **Default.** Mobile, tiny footprint |
| `QWEN3_5_2B_MULTIMODAL_Q4_K_M` | Qwen 3.5 | ~1.3GB | Balanced quality/size |
| `QWEN3_5_4B_MULTIMODAL_Q4_K_M` | Qwen 3.5 | ~2.7GB | Tool calling, quality chat |
| `QWEN3_5_9B_MULTIMODAL_Q4_K_M` | Qwen 3.5 | ~5.7GB | Desktop, high quality |
| `QWEN_3_1_7B_INST_Q4` | Qwen 3 | ~4GB | Legacy — prefer Qwen 3.5 |
| `QWEN_3_4B_INST_Q4_K_M` | Qwen 3 | ~2.5GB | Legacy — prefer Qwen 3.5 |
| `QWEN3_600M_INST_Q4` | Qwen 3 | ~0.4GB | Legacy — prefer `QWEN3_5_0_8B_MULTIMODAL_Q4_K_M` |
| `LLAMA_3_2_1B_INST_Q4_0` | Llama 3.2 | ~1GB | General chat, fast startup |
| `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` | Llama 3.2 | ~1GB | Tool calling (tuned, but less reliable than Qwen 3B+) |
| `SALAMANDRATA_2B_INST_Q8` | Salamandra | ~2GB | Higher quality chat |
| `GPT_OSS_20B_INST_Q4_K_M` | GPT-OSS | ~12GB | Highest quality, desktop only (large) |

### Non-LLM Models

| Constant / Family | Type | Best For |
|----------|------|----------|
| `GTE_LARGE_FP16` | Embedding | RAG, semantic search |
| `EMBEDDINGGEMMA_300M_Q4_0` | Embedding | Lightweight embeddings |
| `WHISPER_TINY` | Speech-to-text (Whisper) | Fast transcription |
| `WHISPER_LARGE_V3_TURBO` | Speech-to-text (Whisper) | High-quality transcription |
| `PARAKEET_TDT_0_6B_V3_Q8_0` | Speech-to-text (Parakeet, TDT) | Lower-latency than Whisper. Single-file GGUF (0.11). |
| `PARAKEET_CTC_0_6B_Q8_0` | Speech-to-text (Parakeet, CTC) | Even lower latency than TDT. Single-file GGUF (0.11). |
| `PARAKEET_SORTFORMER_4SPK_V1_Q8_0` | Speaker diarization (Parakeet) | Up to 4 speakers. Single-file GGUF (0.11). |
| `PARAKEET_EOU_120M_V1_Q8_0` | End-of-turn detection (Parakeet) | Surfaces `endOfTurn` events on `transcribeStream`. NEW in 0.11. |
| `VAD_SILERO_5_1_2` | Voice Activity Detection | Audio preprocessing |
| `SMOLVLM2_2_500M_MULTIMODAL_Q8_0` | Multimodal (vision) | Image understanding |
| `MMPROJ_SMOLVLM2_2_500M_MULTIMODAL_Q8_0` | Projection | Required pair for SmolVLM |
| `MARIAN_EN_HI_INDIC_1B_Q4_0` | Translation (IndicTrans) | English → Hindi/Indic |
| `BERGAMOT_EN_IT` / `BERGAMOT_ES_EN` | Translation (Bergamot) | Regenerated against the upstream `base-memory` fix in 0.11 (~30 MB now). |
| FLUX2-Klein (diffusion) | Image generation | Local text-to-image. Supports `init_images` multi-ref fusion and per-call `lora` in 0.11. |
| Chatterbox / Supertonic | TTS | Voice synthesis, optional voice cloning |

> **REMOVED in 0.11**: the 32 legacy Marian Opus NMT constants
> (`NMT_Q0F16` … `NMT_Q0F16_9`, `NMT_Q4_0` … `NMT_Q4_0_21`) and the legacy
> multi-file Parakeet constants (`PARAKEET_TDT_ENCODER_INT8`,
> `PARAKEET_TDT_DECODER_INT8`, `PARAKEET_TDT_VOCAB`,
> `PARAKEET_TDT_PREPROCESSOR_INT8`, `PARAKEET_CTC_FP32`,
> `PARAKEET_CTC_TOKENIZER`, etc.). Use IndicTrans / Bergamot for translation
> and the single-file Parakeet GGUFs listed above.

### Engines / plugins

Built-in plugins you can list in `qvac.config.plugins`:
`llm-llamacpp`, `embed-llamacpp`, `transcription-whispercpp`,
`transcription-parakeet`, `translation-nmtcpp`, `tts-onnx`, `ocr-onnx`,
`diffusion-cpp`.

## Import Example

```ts
import {
  QWEN3_5_0_8B_MULTIMODAL_Q4_K_M,
  QWEN3_5_2B_MULTIMODAL_Q4_K_M,
  QWEN3_5_4B_MULTIMODAL_Q4_K_M,
  QWEN3_5_9B_MULTIMODAL_Q4_K_M,
  LLAMA_3_2_1B_INST_Q4_0,
  SALAMANDRATA_2B_INST_Q8,
  GPT_OSS_20B_INST_Q4_K_M,
} from '@qvac/sdk'
```

## Decision Tree

Default to the Qwen 3.5 family and pick a tier by available memory — this is
what `tetherto/qvac-app` does in `core/src/services/model/recommendation.ts`:

- **Mobile / tiny** → `QWEN3_5_0_8B_MULTIMODAL_Q4_K_M`
- **< 8GB available** → `QWEN3_5_2B_MULTIMODAL_Q4_K_M`
- **8–30GB, or tool calling** → `QWEN3_5_4B_MULTIMODAL_Q4_K_M`
- **30GB+ desktop** → `QWEN3_5_9B_MULTIMODAL_Q4_K_M`
- **Absolute best quality, desktop only** → `GPT_OSS_20B_INST_Q4_K_M`

## Important Notes

> **DO NOT** use `QWEN_2_5_*` or `QWEN_2_5_CODER_*` constants — these do not exist in `@qvac/sdk@0.15.0`. The SDK exports Qwen 3 / Qwen3.5 family models instead.

> **GPT-OSS note**: GPT-OSS-20B emits tool calls in the Harmony protocol (`<|channel|>analysis<|message|>…`, `<|start|>assistant`, `<|return|>`). In `@qvac/sdk@0.15` set `toolDialect: "harmony"` on `completion()` — the built-in Harmony parser streams the final channel incrementally and drops protocol markers from `contentDelta`. No custom parser needed anymore.

> **Tool calling reliability by size**: 1B models are unreliable for tool calling. Use 3B+ minimum, 7B recommended. Each additional tool increases grammar complexity and reduces reliability on smaller models.

## Qwen Model Notes

Qwen models emit `<think>...</think>` blocks for internal reasoning:
- Set `reasoning_budget: 0` in `loadModel().modelConfig` to disable (`-1` =
  unlimited). Also accepted per-call in `completion().generationParams`.
- Do not use `/no_think` in the prompt or strip the blocks from a token stream.
- Reasoning tokens count against the context window whenever generated, so
  `reasoning_budget: 0` is the only option that actually saves context.
