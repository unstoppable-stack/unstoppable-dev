---
name: add-ai-image-gen
description: Local text-to-image generation with QVAC's diffusion plugin (FLUX2-Klein, Stable Diffusion).
when_to_use: User wants to generate images from text prompts on-device, without any cloud image API.
paths: ["src/ai/**", "src/images/**"]
version: "2026-05-21"
---

# Add AI Image Generation (QVAC Diffusion)

## When to Use
- User wants on-device text-to-image generation
- User mentions "image generation", "text-to-image", "txt2img", "Stable
  Diffusion", "FLUX", "diffusion model", "generate an image"
- User needs offline image generation (privacy, no API keys, no rate limits)

## Prerequisites
- `@qvac/sdk` (`^0.15.0`) installed
- A diffusion model in GGUF format (e.g., FLUX2-Klein, Stable Diffusion XL)
- `diffusion-cpp` plugin enabled (listed in `qvac.config.plugins` or using
  the default plugin set)
- Desktop-class hardware — diffusion models are large and compute-heavy; not
  recommended on mobile

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Background

Image generation in QVAC 0.11 has a **dedicated top-level `diffusion()`
function** (the underlying plugin is still `diffusion-cpp`). Diffusion models
(FLUX.2, SDXL) are loaded with `loadModel()` and called with `diffusion()`.
You can still go through `invokePlugin()` / `invokePluginStream()` for fully
custom flows, but `diffusion()` is the supported high-level entry.

Headline capabilities on the diffusion path:

- **img2img (SD/SDXL)** — `init_image` parameter for SDEdit-style
  image-to-image with a `strength` knob (0 = preserve source, 1 = ignore).
- **Multi-reference fusion (FLUX.2)** — `init_images` (array, mutually
  exclusive with `init_image`) lets you blend multiple reference images into
  a single output via in-context conditioning with RoPE-separated latent
  tokens. Best with FLUX.2-klein + Qwen3 text encoder. Use `@image1`,
  `@image2`, … tags in the prompt to anchor each reference semantically.
  FLUX.2 also accepts `increase_ref_index` and `auto_resize_ref_image`
  tunables.
- **Per-call LoRA (NEW in 0.11)** — `diffusion({ lora })` takes an absolute
  filesystem path to a `.safetensors` adapter. Pair with load-time
  `modelConfig.lora_apply_mode: "auto" | "immediately" | "at_runtime"` to
  control fusion vs. per-call application. Relative paths are rejected.
- **ESRGAN upscaling (NEW in 0.11)** — either attach an upscaler to a
  diffusion model (`modelConfig.upscaler = { type: "esrgan", model_src,
  tile_size }`) and run it as a post-step via `diffusion({ upscale:
  { repeats } })`, or use the standalone `upscale()` API documented below.

## Steps

1. **Install QVAC** and (if relevant) the CLI:
   ```bash
   npm i @qvac/sdk
   ```

2. **Ensure `diffusion-cpp` is loaded** via `qvac.config.json` (only required
   when you're tree-shaking with `qvac bundle sdk` or running the HTTP server
   — otherwise the default plugin set includes it):
   ```json
   {
     "cacheDirectory": "./.qvac/models",
     "plugins": ["llm-llamacpp", "diffusion-cpp"]
   }
   ```

3. **Load a diffusion model**:
   ```ts
   import { loadModel } from '@qvac/sdk'

   // Resolve the constant/src via the registry first if you're unsure:
   //   await modelRegistrySearch({ query: 'flux' })
   const modelId = await loadModel({
     modelSrc: 'flux2-klein-4b-q4', // adjust to the actual registry name
     modelType: 'diffusion',
     onProgress: (p) => process.stdout.write(`\rDownloading ${p.percentage.toFixed(1)}%`),
   })
   ```

4. **Generate an image** via `diffusion()` (0.10):
   ```ts
   import { diffusion } from '@qvac/sdk'

   // Plain text-to-image (txt2img):
   const { outputs } = diffusion({
     modelId,
     prompt: 'A lighthouse on a rocky coast at sunrise, cinematic, 4k',
     negativePrompt: 'blurry, low quality, deformed',
     width: 1024,
     height: 1024,
     steps: 30,
     seed: 42,
   })
   // outputs[0] is a Uint8Array of PNG bytes — write to disk:
   import * as fs from 'node:fs'
   fs.writeFileSync('./out/lighthouse.png', outputs[0])
   ```

5. **img2img on SD/SDXL** — pass an `init_image` and a `strength` to do
   SDEdit-style image-to-image:
   ```ts
   const initImage = new Uint8Array(fs.readFileSync('./input.png'))
   const { outputs } = diffusion({
     modelId,
     prompt: 'oil painting style, vibrant colors',
     init_image: initImage,
     strength: 0.5,   // 0 = keep source verbatim, 1 = ignore source
     steps: 30,
   })
   ```
   `strength` is SD/SDXL-only. FLUX.2 ignores `strength` because its
   conditioning path is purely conditional, not a noise-mixing schedule.

6. **Multi-reference fusion on FLUX.2** — pass `init_images` (array, ≥1):
   ```ts
   const von = new Uint8Array(fs.readFileSync('./assets/von-neumann.jpg'))
   const sha = new Uint8Array(fs.readFileSync('./assets/shannon.jpg'))

   const { outputs } = diffusion({
     modelId, // a FLUX.2 model
     prompt: '@image1 and @image2 sitting at a chessboard, oil painting',
     init_images: [von, sha],
     // increase_ref_index defaults to false on FLUX.2-klein (refs share
     // one RoPE slot and blend via attention — recommended).
     increase_ref_index: false,
     auto_resize_ref_image: true,   // default
     width: 1024,
     height: 1024,
   })
   ```
   - Use `@imageN` tags in the prompt for semantic anchoring of each
     reference.
   - `init_image` and `init_images` are mutually exclusive — pass one or
     the other.
   - Width/height must be multiples of 8.

7. **Stream progress** — for long renders, use `invokePluginStream` (the
   diffusion-cpp handler still exposes step events through the plugin
   dispatch path):
   ```ts
   import { invokePluginStream } from '@qvac/sdk'
   const stream = invokePluginStream<{
     step?: number
     totalSteps?: number
     done?: boolean
     output?: Uint8Array
   }>({
     modelId,
     handler: 'generate',
     params: { prompt: '...', steps: 30 },
   })
   for await (const evt of stream) {
     if (evt.step !== undefined && evt.totalSteps) {
       process.stdout.write(`\rStep ${evt.step}/${evt.totalSteps}`)
     }
     if (evt.done && evt.output) fs.writeFileSync('./out/x.png', evt.output)
   }
   ```

8. **Cleanup**:
   ```ts
   import { unloadModel } from '@qvac/sdk'
   await unloadModel({ modelId })
   ```

## Parameters (typical)

The exact parameter names depend on the `diffusion-cpp` handler signature in
your installed SDK. Common fields seen across diffusion backends:

| Field | Purpose |
|-------|---------|
| `prompt` | Text description of the image to generate |
| `negativePrompt` | Things to avoid in the image |
| `width` / `height` | Output resolution (must be multiples of 64 for most models) |
| `steps` | Denoising steps. More = higher quality but slower. 20-50 typical |
| `cfgScale` | Classifier-free guidance scale (how strictly to follow the prompt) |
| `seed` | RNG seed for reproducibility |
| `sampler` | e.g. `euler`, `dpm++`, `heun` |
| `outputPath` | Where to write the file (if the handler writes to disk) |

Treat anything not in your verified handler schema as unsupported.

## Use Cases
- Local avatar / image asset generation
- Privacy-preserving creative tools (no upload of prompts or images)
- Batch generation of variations (iterate over seeds)
- Combined with `add-ai-chat`: let the LLM build a prompt, then generate

## Critical Rules
- **Diffusion models are large** (4B params is common; GGUF Q4 ≈ 2-3GB).
  First download is slow — always surface `onProgress`.
- **Heavy on compute** — CPU inference is painfully slow; prefer Vulkan
  (Linux) or Metal-backed builds on macOS. Expect seconds per step on CPU,
  multiples faster on GPU.
- **Width × height must match the model's training resolution family** —
  SDXL: 1024×1024 baseline; FLUX2: follow the model card. Off-grid sizes
  either error out or produce artifacts.
- **Negative prompts matter for small models** — use them to claw back
  quality on Q4 quantizations.
- **`invokePlugin` validates against the handler's Zod schema** — extra
  fields throw `PLUGIN_REQUEST_VALIDATION_FAILED`. Only pass fields the
  handler accepts.
- **Not a mobile-first capability** — diffusion LLMs are rarely practical on
  phones. Gate the UI on device capability.
- **Use `cancel()` to stop long generations** — streaming generations can be
  aborted: `await cancel({ operation: 'inference', modelId })`.

## Validation
1. `modelRegistrySearch({ query: 'flux' })` (or `'stable-diffusion'`) returns
   at least one result
2. `loadModel({ modelType: 'diffusion' })` resolves with a `modelId`
3. `invokePlugin({ handler: 'generate', params: { ... } })` returns without
   `PLUGIN_HANDLER_NOT_FOUND` / validation errors
4. The output file is a valid PNG (check magic bytes or open it)
5. Streaming version emits progressive `step` events until `done: true`
6. Cancellation with `cancel()` stops generation within one step

## Key Gotchas
- **Handler name (`'generate'`) is indicative, not guaranteed** — confirm
  against `@qvac/sdk` exports or `research/qvac-examples/` before relying on
  it
- Diffusion models use `*.gguf` (same container as LLMs, different semantics)
- On Linux, Vulkan runtime + compatible GPU drivers are required for GPU
  inference. macOS uses Metal automatically. Windows DirectML support may be
  limited.
- Keep the model loaded across generations — loading is the slow part; a
  warm model generates many images cheaply
- If you need a web-style API, expose image generation via
  `add-openai-server` (the OpenAI images endpoint is on the roadmap; check
  your CLI version)

## Relationship to other skills
- **`add-ai-plugin`** — for writing your own diffusion pre/post-processing
  handlers (e.g., prompt rewriting, safety filters) as plugins.
- **`add-ai-chat`** — use an LLM to author prompts, then pipe into diffusion.
- **`add-openai-server`** — if/when the HTTP server grows an images endpoint,
  your diffusion model entry in `serve.models` will be enough to expose it.

## Resources
- `research/qvac-llms-full.txt` — plugin system, `invokePlugin`, error codes
- `research/local-agent/models-to-download.md` — FLUX2-Klein + SDXL model
  file suggestions
- https://docs.qvac.tether.io/ — official docs

> **Status**: Updated for 0.10 — top-level `diffusion()` function is
> documented in the release notes and supports `init_image` (SD/SDXL,
> with `strength`) and `init_images` (FLUX.2 multi-reference fusion).
> Verify exact param schemas against your installed SDK before shipping.
