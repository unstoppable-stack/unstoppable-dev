---
name: add-ai-vision
description: Add QVAC multimodal vision for local image analysis. Use when
  the user wants to analyze images, identify objects, or extract information
  from photos using a local model. Builds on add-ai-chat.
---

# Add AI Vision (QVAC Multimodal)

## When to Use
- User wants to analyze images locally
- User mentions "vision", "image analysis", "photo", "multimodal", "image recognition"
- User needs to extract text, identify objects, or describe images

## Prerequisites
- `@qvac/sdk` (`^0.6.0`) installed
- A multimodal vision model loaded
- Familiarity with `add-ai-chat` (model loading, completion API)

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install QVAC** (if not already):
   ```bash
   pnpm add @qvac/sdk
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

## Key Gotchas
- Vision models are larger than text-only models — check RAM requirements
- Image encoding: use base64 data URLs
- Mobile devices may struggle with large vision models — test on target hardware
- Combine with `add-ai-rag` for building searchable image databases

> **Status**: Docs only. Based on QVAC documentation and
> `research/qvac-examples/llamacpp-multimodal.ts`. Not yet validated with
> a battle-tested reference app.
