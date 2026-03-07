# QVAC Model Selection Guide

## Verified Model Constants (`@qvac/sdk@0.7.0`)

These are the **exact import names** from `@qvac/sdk`. Only use constants listed here.

### LLM Models

| Constant | Family | Size | Best For |
|----------|--------|------|----------|
| `QWEN_3_1_7B_INST_Q4` | Qwen 3 | ~4GB | Tool calling, structured output, quality chat |
| `QWEN_3_4B_INST_Q4_K_M` | Qwen 3 | ~2.5GB | Tool calling, good quality at lower cost |
| `QWEN3_0_6B_INST` | Qwen 3 | ~0.5GB | Mobile, tiny footprint (limited reasoning) |
| `LLAMA_3_2_1B_INST_Q4_0` | Llama 3.2 | ~1GB | General chat, fast startup |
| `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` | Llama 3.2 | ~1GB | Tool calling (tuned, but less reliable than Qwen 3B+) |
| `SALAMANDRATA_2B_INST_Q8` | Salamandra | ~2GB | Higher quality chat |
| `GPT_OSS_20B_INST_Q4_K_M` | GPT-OSS | ~12GB | Highest quality, desktop only (large) |

### Non-LLM Models

| Constant | Type | Best For |
|----------|------|----------|
| `GTE_LARGE_FP16` | Embedding | RAG, semantic search |
| `EMBEDDINGGEMMA_300M_Q4_0` | Embedding | Lightweight embeddings |
| `WHISPER_TINY` | Speech-to-text | Fast transcription |
| `WHISPER_LARGE_V3_TURBO` | Speech-to-text | High-quality transcription |
| `VAD_SILERO_5_1_2` | Voice Activity Detection | Audio preprocessing |
| `SMOLVLM2_2_500M_MULTIMODAL_Q8_0` | Multimodal (vision) | Image understanding |
| `MMPROJ_SMOLVLM2_2_500M_MULTIMODAL_Q8_0` | Projection | Required pair for SmolVLM |
| `MARIAN_OPUS_EN_IT_Q4_0` | Translation | English ↔ Italian |
| `MARIAN_EN_HI_INDIC_1B_Q4_0` | Translation | English → Hindi/Indic |

## Import Example

```ts
import {
  QWEN_3_1_7B_INST_Q4,
  QWEN_3_4B_INST_Q4_K_M,
  QWEN3_0_6B_INST,
  LLAMA_3_2_1B_INST_Q4_0,
  LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K,
  SALAMANDRATA_2B_INST_Q8,
  GPT_OSS_20B_INST_Q4_K_M,
} from '@qvac/sdk'
```

## Decision Tree

- **Tool calling needed?** → `QWEN_3_1_7B_INST_Q4` (best) or `QWEN_3_4B_INST_Q4_K_M` (lighter)
- **Mobile app?** → `QWEN3_0_6B_INST` (tiny) or `LLAMA_3_2_1B_INST_Q4_0` (small)
- **Desktop general chat?** → `SALAMANDRATA_2B_INST_Q8` (quality) or `LLAMA_3_2_1B_INST_Q4_0` (fast)
- **Quality matters most?** → `GPT_OSS_20B_INST_Q4_K_M` (desktop) or `QWEN_3_1_7B_INST_Q4` (balanced)
- **Minimum viable tool calling?** → `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` (but 3B+ is more reliable)

## Important Notes

> **DO NOT** use `QWEN_2_5_*` or `QWEN_2_5_CODER_*` constants — these do not exist in `@qvac/sdk@0.7.0`. The SDK exports Qwen 3 family models instead.

> **GPT-OSS note**: GPT-OSS-20B emits tool calls in a non-standard format (`<|channel|>commentary to=functions.<name>`). The workbench handles this with a model-specific fallback parser. If using GPT-OSS with tool calling, implement a fallback parser for its format.

> **Tool calling reliability by size**: 1B models are unreliable for tool calling. Use 3B+ minimum, 7B recommended. Each additional tool increases grammar complexity and reduces reliability on smaller models.

## Qwen 3 Model Notes

Qwen 3 models emit `<think>...</think>` blocks for internal reasoning:
- Add `/no_think` to the system prompt to suppress reasoning output
- Filter think blocks: `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- Think tokens count against context window even when suppressed/filtered
