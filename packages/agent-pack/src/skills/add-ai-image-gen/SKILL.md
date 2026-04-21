---
name: add-ai-image-gen
description: Local text-to-image generation with QVAC's diffusion plugin (FLUX2-Klein, Stable Diffusion).
when_to_use: User wants to generate images from text prompts on-device, without any cloud image API.
paths: ["src/ai/**", "src/images/**"]
version: "2026-04-20"
---

# Add AI Image Generation (QVAC Diffusion)

## When to Use
- User wants on-device text-to-image generation
- User mentions "image generation", "text-to-image", "txt2img", "Stable
  Diffusion", "FLUX", "diffusion model", "generate an image"
- User needs offline image generation (privacy, no API keys, no rate limits)

## Prerequisites
- `@qvac/sdk` (`^0.9.0`) installed
- A diffusion model in GGUF format (e.g., FLUX2-Klein, Stable Diffusion XL)
- `diffusion-cpp` plugin enabled (listed in `qvac.config.plugins` or using
  the default plugin set)
- Desktop-class hardware — diffusion models are large and compute-heavy; not
  recommended on mobile

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Background

Image generation in QVAC 0.9 is delivered via the **plugin system**. The
built-in plugin is `diffusion-cpp`, and diffusion models (FLUX2, SDXL) are
loaded just like any other model with `loadModel()`. Execution happens
through the generic `invokePlugin()` / `invokePluginStream()` plugin-handler
dispatch — there is no dedicated `generateImage()` top-level function.

This means:
- Diffusion model constants / handler names may evolve between SDK minor
  versions.
- Verify handler names against your installed `@qvac/sdk` version before
  shipping — `modelRegistrySearch({ query: 'flux' })` is the easiest way to
  enumerate what's available locally.

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

4. **Generate an image** via the plugin handler — this returns a path /
   buffer depending on the handler. Stream for progress updates:
   ```ts
   import { invokePluginStream } from '@qvac/sdk'

   const stream = invokePluginStream<{
     step?: number
     totalSteps?: number
     imagePath?: string
     done?: boolean
   }>({
     modelId,
     handler: 'generate', // diffusion-cpp handler name; verify in your SDK version
     params: {
       prompt: 'A lighthouse on a rocky coast at sunrise, cinematic, 4k',
       negativePrompt: 'blurry, low quality, deformed',
       width: 1024,
       height: 1024,
       steps: 30,
       seed: 42,
       outputPath: './out/lighthouse.png',
     },
   })

   for await (const evt of stream) {
     if (evt.step !== undefined && evt.totalSteps) {
       process.stdout.write(`\rStep ${evt.step}/${evt.totalSteps}`)
     }
     if (evt.done && evt.imagePath) {
       console.log(`\nSaved → ${evt.imagePath}`)
     }
   }
   ```

   For a one-shot (non-streaming) generation, `invokePlugin()` returns the
   final result only:
   ```ts
   import { invokePlugin } from '@qvac/sdk'

   const { imagePath } = await invokePlugin<{ imagePath: string }>({
     modelId,
     handler: 'generate',
     params: { prompt: '...', width: 1024, height: 1024, steps: 30 },
   })
   ```

5. **Cleanup**:
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

> **Status**: Docs only, based on 0.9 plugin architecture and the
> `diffusion-cpp` plugin listing in the consolidated docs. Exact handler
> names and param schemas should be verified against the installed SDK
> before shipping.
