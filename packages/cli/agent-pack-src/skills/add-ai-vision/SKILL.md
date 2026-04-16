---
name: add-ai-vision
description: QVAC multimodal vision for local image analysis.
when_to_use: User wants to analyze images, identify objects, or extract information from photos using a local model. Builds on add-ai-chat.
paths: ["src/ai/**", "src/vision/**"]
version: "2026-04-14"
---

# Add AI Vision (QVAC Multimodal)

## When to Use
- User wants to analyze images locally
- User mentions "vision", "image analysis", "photo", "multimodal", "image recognition"
- User needs to extract text, identify objects, or describe images

## Prerequisites
- `@qvac/sdk` (`^0.8.0`) installed
- A multimodal vision model loaded
- Familiarity with `add-ai-chat` (model loading, completion API)

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install QVAC** (if not already):
   ```bash
   npm i @qvac/sdk
   ```

2. **Load a vision-capable model**:
   ```ts
   import { loadModel, completion } from '@qvac/sdk'

   const modelId = await loadModel({
     modelSrc: 'vision-model-constant', // Check QVAC docs for current models
     modelType: 'llm',
     modelConfig: { ctx_size: 4096 },
   })
   ```

3. **Send image for analysis**:
   ```ts
   import { readFileSync } from 'fs'

   const imageBuffer = readFileSync('./photo.jpg')
   const base64 = imageBuffer.toString('base64')

   const result = completion({
     modelId,
     history: [
       {
         role: 'user',
         content: [
           { type: 'text', text: 'What do you see in this image?' },
           { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
         ],
       },
     ],
     stream: true,
   })

   for await (const token of result.tokenStream) {
     process.stdout.write(token)
   }
   ```

## Use Cases
- Plant/animal identification
- Receipt scanning and data extraction
- Document analysis
- Accessibility (describe images for visually impaired users)
- Quality inspection

## Critical Rules
- **Multimodal model required** — standard LLMs cannot process images. You must load a vision-capable model (check QVAC docs for supported multimodal models).
- **Image must be base64 or file path** — passing raw buffers or URLs won't work. Convert to `data:image/jpeg;base64,...` format.
- **Model size matters more for vision** — vision tasks need larger models than text-only. Small models produce vague or incorrect descriptions.
- **Don't skip image resizing** — sending full-resolution photos (4000x3000+) wastes memory and slows inference. Resize to ~1024px max dimension before encoding.
- **Don't assume format support** — verify the model handles your image format (JPEG/PNG). Some models struggle with transparency or unusual color spaces.
- **Context window is consumed by image tokens** — images use significant context. Leave room for the text prompt and response.

## Validation
1. Vision-capable model loads successfully (`loadModel` resolves without error)
2. Image file reads and converts to valid base64 string
3. `completion()` with image content returns a response (not an error or empty string)
4. Response accurately describes the image content (test with a known image)
5. Different image formats (JPEG, PNG) are processed correctly
6. On mobile: model fits in available RAM and inference completes within acceptable time

## Key Gotchas
- Vision models are larger than text-only models — check RAM requirements
- Image encoding: use base64 data URLs
- Mobile devices may struggle with large vision models — test on target hardware
- Combine with `add-ai-rag` for building searchable image databases

> **Status**: Docs only. Based on QVAC documentation and
> `research/qvac-examples/llamacpp-multimodal.ts`. Not yet validated with
> a battle-tested reference app.
