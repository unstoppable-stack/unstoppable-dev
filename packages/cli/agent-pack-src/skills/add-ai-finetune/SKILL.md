---
name: add-ai-finetune
description: Apply a LoRA adapter to a base QVAC LLM for task-specific behavior without retraining.
when_to_use: User wants to ship a specialized model variant (tone, domain, instructions) without full training — load a base LLM with a LoRA adapter path.
paths: ["src/ai/**", "src/finetune/**", "models/**"]
version: "2026-05-21"
---

# Add AI Fine-Tuning (LoRA Adapters)

## When to Use
- User wants a specialized model (domain-specific tone, terminology, style)
- User has (or has access to) a trained LoRA adapter and wants to apply it
- User mentions "fine-tune", "fine-tuning", "LoRA", "adapter", "PEFT",
  "specialized model", "custom assistant"
- User wants to ship multiple personas / specialties from one base model

## What QVAC 0.11 supports

As of `@qvac/sdk@0.11.0`, the shipping path is **LoRA adapter loading**, not
on-device training:

- Provide a trained LoRA `.gguf`/`.bin`/`.safetensors` adapter via
  `modelConfig.lora` at load time (LLM models).
- The adapter layers are merged/applied against the base model weights.
- You can ship one base model + N adapters and hot-swap by reloading with a
  different `lora` path.
- **Diffusion models** (FLUX.2 / SD / SDXL) additionally accept a per-call
  `lora` parameter on `diffusion()` plus a load-time
  `modelConfig.lora_apply_mode: "auto" | "immediately" | "at_runtime"`.

Full parameter-efficient training (PEFT / QLoRA) runs offline in your pipeline
of choice (Hugging Face PEFT, llama.cpp `finetune`, Axolotl, Unsloth). QVAC
consumes the resulting adapter file.

> **On-device training is not a documented public SDK API in 0.11**. If you
> see roadmap references to "fine-tuning", they are about hosting adapters
> and (eventually) a training plugin. Treat anything not documented here as
> unverified and check the release notes for your specific SDK version.
>
> `cancelFinetune(modelId)` is **fire-and-forget** in 0.11 — it returns
> immediately and the addon cancel runs out-of-band via the registry's
> abort listener. Prefer `cancel({ requestId: op.requestId })` against the
> `finetune()` op's decorated promise.

## Prerequisites
- `@qvac/sdk` (`^0.11.0`) installed
- A base LLM constant (e.g., `LLAMA_3_2_1B_INST_Q4_0`, `QWEN_3_1_7B_INST_Q4`)
- A LoRA adapter file on disk (trained against the same base architecture)
- Adapter paths must be **absolute** (relative paths are rejected by the
  diffusion `lora` field and unsafe for the LLM `lora` field across
  worker process boundaries)

## Steps

1. **Train a LoRA adapter** in your preferred pipeline. Outputs compatible
   with llama.cpp-family engines (GGUF-format LoRA) are the safe bet for
   QVAC's llama.cpp backend. Typical tools:
   - Hugging Face PEFT + `llama.cpp/convert-lora-to-ggml.py`
   - Axolotl with GGUF export
   - Unsloth (Llama/Qwen families)

   Put the resulting file somewhere accessible, e.g.
   `./adapters/legal-en-v1.gguf`.

2. **Load the base model with the adapter**:

   ```ts
   import { loadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'
   import path from 'node:path'

   const modelId = await loadModel({
     modelSrc: LLAMA_3_2_1B_INST_Q4_0,
     modelType: 'llm',
     modelConfig: {
       ctx_size: 4096,
       tools: true,
       lora: path.resolve('./adapters/legal-en-v1.gguf'),
       system_prompt:
         'You are a legal research assistant. Cite statutes and case law ' +
         'precisely. If uncertain, say so.',
     },
   })
   ```

3. **Use the model normally** — `completion()`, tool calling, RAG, etc. all
   work unchanged. The adapter is transparent to the rest of the API:

   ```ts
   import { completion } from '@qvac/sdk'

   const result = completion({
     modelId,
     history: [{ role: 'user', content: 'Summarize GDPR Art. 6' }],
     stream: true,
     generationParams: { temp: 0.3 },
   })

   for await (const t of result.tokenStream) process.stdout.write(t)
   ```

4. **Hot-swap adapters** by unloading and reloading with a different `lora`
   path. Base model weights may still be cached, so the second load is
   typically fast:

   ```ts
   import { unloadModel } from '@qvac/sdk'

   await unloadModel({ modelId })
   const modelId2 = await loadModel({
     modelSrc: LLAMA_3_2_1B_INST_Q4_0,
     modelType: 'llm',
     modelConfig: { lora: './adapters/medical-en-v1.gguf' },
   })
   ```

   For frequent swapping, keep an in-memory lookup `{ persona -> modelId }`
   and lazily load on first use.

## Multi-adapter apps

A common pattern is one app, one base model, several personas:

```ts
const ADAPTERS = {
  legal: './adapters/legal-en-v1.gguf',
  medical: './adapters/medical-en-v1.gguf',
  coding: './adapters/coding-en-v2.gguf',
}

const cache = new Map<string, string>() // persona → modelId

async function getPersona(persona: keyof typeof ADAPTERS) {
  const cached = cache.get(persona)
  if (cached) return cached

  const modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    modelConfig: { lora: ADAPTERS[persona], ctx_size: 4096 },
  })
  cache.set(persona, modelId)
  return modelId
}
```

Unload personas when the user switches if RAM is tight — LoRA adapters are
small (tens of MB) but the base model they sit on is not.

## Critical Rules
- **LoRA must match the base** — architecture + tokenizer + rank must all
  match the base model used during training. A LoRA trained for Llama-3.2-1B
  won't work on Qwen-3-1.7B.
- **Use absolute paths** — relative paths can resolve against unexpected
  cwds (especially in Pear workers).
- **Only one LoRA per loaded model instance** — to use a different adapter,
  unload and reload. Combining adapters via merging happens offline.
- **Training happens off-device** — QVAC 0.9 does not expose a public
  training API. Train with Hugging Face PEFT / Axolotl / Unsloth, convert
  to llama.cpp-compatible LoRA, and ship the file.
- **Validate the adapter exists before `loadModel`** — file-not-found errors
  surface as generic `MODEL_LOAD_FAILED`, which is confusing to debug.
- **Respect the base license** — LoRAs don't launder weights. If the base
  model is non-commercial, the fine-tuned output is too.

## Validation
1. Base + adapter both resolve to readable files on disk
2. `loadModel` with `modelConfig.lora` resolves without `MODEL_LOAD_FAILED`
3. `completion()` returns sane output — sanity-check against the base model
   with no adapter to confirm the adapter is actually being applied (output
   style / vocabulary should shift toward the training data)
4. Swapping adapters by unload + reload produces different behavior
5. Inference throughput (tokens/sec) is similar to the base — large drops
   suggest the LoRA is being re-applied per token (a load-time
   misconfiguration)

## Key Gotchas
- **Adapter format mismatch**: the llama.cpp backend expects a specific
  GGUF-LoRA format. Hugging Face's `.safetensors` adapters must be
  converted via `convert-lora-to-ggml.py` (or similar).
- **Rank / scaling during training affects runtime**: very high-rank LoRAs
  approach full fine-tune size and negate much of the benefit.
- **No on-device training**: if the user actually needs to train on
  device — e.g., federated learning — that's not a QVAC feature in 0.11.
  Surface the limitation explicitly rather than misleading them.
- **`lora` is a `modelConfig` field, not a top-level `loadModel` option** —
  `modelConfig.lora`, sibling of `ctx_size`, `tools`, `system_prompt`.
- **Delegated inference**: when using `delegate` to load remotely, the
  provider must have both the base model **and** the adapter file. Pushing
  adapters to providers is out-of-scope for the SDK — ship them via your own
  transport (Hyperdrive is a natural fit).

## Relationship to other skills
- **`add-ai-chat`** — everything you do with `completion()` / tool calls /
  streaming applies unchanged once the model is loaded with an adapter.
- **`add-ai-plugin`** — if you want a first-class "persona" abstraction in
  your SDK surface, wrap adapter loading in a custom plugin that exposes a
  `switchPersona({ persona })` handler.
- **`add-file-storage`** (Hyperdrive) — a clean way to distribute adapters
  to your peers without running a CDN.

## Resources
- `research/qvac-llms-full.txt` — `modelConfig.lora` parameter in the
  llama.cpp load config tables
- llama.cpp `convert-lora-to-ggml.py` — format conversion
- Hugging Face PEFT — https://huggingface.co/docs/peft
- Unsloth — https://github.com/unslothai/unsloth
- Axolotl — https://github.com/OpenAccess-AI-Collective/axolotl

> **Status**: Docs only. Based on the `modelConfig.lora` field documented in
> `research/qvac-llms-full.txt`. On-device training is intentionally out of
> scope because 0.9 does not document a public training API.
