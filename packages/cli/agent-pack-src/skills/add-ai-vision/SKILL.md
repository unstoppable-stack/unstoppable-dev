---
name: add-ai-vision
description: QVAC multimodal vision for local image analysis using file-path attachments.
when_to_use: User wants to analyze images, identify objects, or extract information from photos using a local model. Builds on add-ai-chat.
paths: ["src/ai/**", "src/vision/**"]
version: "2026-05-21"
---

# Add AI Vision (QVAC Multimodal)

## When to Use
- User wants to analyze images locally
- User mentions "vision", "image analysis", "photo", "multimodal", "image recognition"
- User needs to extract text, identify objects, or describe images

## Prerequisites
- `@qvac/sdk` (`^0.15.0`) installed
- A multimodal model + its paired projection file
- Familiarity with `add-ai-chat` (model loading, completion API)

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **Bare worker** started by embedded `pear-runtime`. See `setup-pear-desktop`.

## What Changed in 0.9 — Attachments

The old OpenAI-style payload — `content: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }]` — **no longer works**.

In 0.9, attach images (or other media) with a file **path** on the history
message:

```ts
{
  role: 'user',
  content: "What's in this image?",
  attachments: [{ path: '/absolute/path/to/photo.jpg' }],
}
```

The SDK reads the file and feeds it into the multimodal projection. No base64,
no data URLs.

## Steps

1. **Install QVAC** (if not already):
   ```bash
   npm i @qvac/sdk
   ```

2. **Load a vision-capable model** (SmolVLM is the current ready-to-use option).
   SmolVLM requires both the main model and its projection file:
   ```ts
   import {
     loadModel,
     SMOLVLM2_2_500M_MULTIMODAL_Q8_0,
     MMPROJ_SMOLVLM2_2_500M_MULTIMODAL_Q8_0,
   } from '@qvac/sdk'

   const modelId = await loadModel({
     modelSrc: SMOLVLM2_2_500M_MULTIMODAL_Q8_0,
     modelType: 'llm',
     modelConfig: {
       ctx_size: 4096,
       mmproj: MMPROJ_SMOLVLM2_2_500M_MULTIMODAL_Q8_0,
     },
   })
   ```

3. **Send an image via `attachments`** — note the file path, not base64:
   ```ts
   import { completion } from '@qvac/sdk'
   import path from 'node:path'

   const imagePath = path.resolve('./photo.jpg')

   const run = completion({
     modelId,
     history: [
       {
         role: 'user',
         content: 'What do you see in this image?',
         attachments: [{ path: imagePath }],
       },
     ],
     stream: true,
     generationParams: { temp: 0.3 },
   })

   // 0.10 unified event stream — typed and ordered.
   for await (const event of run.events) {
     if (event.type === 'contentDelta') process.stdout.write(event.text)
   }

   const final = await run.final
   // final.contentText holds the full description.
   ```

4. **Multi-image turns** — attach multiple files to a single message:
   ```ts
   history: [
     {
       role: 'user',
       content: 'Compare these two photos.',
       attachments: [
         { path: '/abs/path/a.jpg' },
         { path: '/abs/path/b.jpg' },
       ],
     },
   ]
   ```

## Use Cases
- Plant/animal identification
- Receipt scanning and data extraction
- Document analysis
- Accessibility (describe images for visually impaired users)
- Quality inspection

## Critical Rules
- **Use `attachments: [{ path }]`** — the old base64 `image_url` API is gone
  in 0.9. Passing that payload will silently drop the image.
- **Use absolute paths** — the SDK opens the file itself; relative paths can
  resolve against an unexpected cwd (especially in Pear workers).
- **Multimodal model required** — standard LLMs cannot process images. You
  must load a vision-capable model (`SMOLVLM2_2_500M_MULTIMODAL_Q8_0` + its
  projection) or another multimodal constant from the model registry.
- **Projection file is mandatory for SmolVLM** — `mmproj:
  MMPROJ_SMOLVLM2_2_500M_MULTIMODAL_Q8_0` in `modelConfig`, or the model loads
  but image tokens are meaningless.
- **Resize before attaching** — very large images (4000x3000+) eat context and
  slow inference. Resize to ~1024px max dimension.
- **Context window is consumed by image tokens** — leave room for the text
  prompt and response.
- **Ensure the file exists and is readable** — any I/O error surfaces as a
  model load / inference error, not a file error.

## Validation
1. Multimodal model + projection load successfully (`loadModel` resolves)
2. `completion()` with `attachments: [{ path }]` returns a non-empty response
3. Response accurately describes the image (test with a known image)
4. Different formats (JPEG, PNG) are processed correctly
5. On mobile: model fits in available RAM and inference completes within an
   acceptable time window

## Key Gotchas
- **Attachments use file paths, not base64** — this is the biggest migration
  gotcha from 0.8 → 0.9
- Vision models are larger than text-only models — check RAM requirements
- Mobile devices may struggle with large vision models — test on target hardware
- Combine with `add-ai-rag` for building searchable image databases (embed a
  text description per image and store it in a workspace)

> **Status**: Docs only. Based on QVAC documentation and
> `research/qvac-examples/llamacpp-multimodal.ts`. Not yet validated with
> a battle-tested reference app.
