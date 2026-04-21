---
name: add-ai-transcription
description: Local audio transcription using QVAC Whisper or NVIDIA Parakeet.
when_to_use: User wants speech-to-text, voice notes, or meeting transcription running entirely on-device.
paths: ["src/ai/**", "src/audio/**"]
version: "2026-04-20"
---

# Add AI Transcription (QVAC)

## When to Use
- User wants to transcribe audio to text locally
- User mentions "transcription", "speech-to-text", "voice notes", "Whisper", "Parakeet"
- User needs to process audio files or record from microphone

## Prerequisites
- `@qvac/sdk` (`^0.9.0`) installed
- A Whisper model **or** a Parakeet model

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Engines: Whisper vs Parakeet

QVAC 0.9 supports two transcription engines, each shipped as a plugin:

| Engine | Plugin | Strengths | Trade-offs |
|--------|--------|-----------|------------|
| Whisper | `transcription-whispercpp` | Multilingual, robust, mature, handles noisy audio | Larger models, slower on long clips |
| Parakeet (NVIDIA NeMo) | `transcription-parakeet` | Very low latency, high throughput | English-focused, newer (fewer community resources) |

Pick Whisper for general / multilingual / noisy audio. Pick Parakeet when you
need the lowest end-to-end latency on English speech (e.g., live captions).

## Steps (Whisper)

1. **Install QVAC**:
   ```bash
   npm i @qvac/sdk
   ```

2. **Load a Whisper model**:
   ```ts
   import { loadModel, WHISPER_TINY } from '@qvac/sdk'

   const modelId = await loadModel({
     modelSrc: WHISPER_TINY, // or WHISPER_LARGE_V3_TURBO for quality
     modelType: 'transcription',
   })
   ```

3. **Transcribe an audio file**:
   ```ts
   import { transcribe } from '@qvac/sdk'

   const result = await transcribe({
     modelId,
     audio: './recording.wav',
   })

   console.log('Transcription:', result.text)
   console.log('Segments:', result.segments)
   ```

4. **Streaming transcription** (real-time):
   ```ts
   import { transcribeStream } from '@qvac/sdk'

   const stream = transcribeStream({
     modelId,
     audio: microphoneStream,
   })

   for await (const segment of stream) {
     console.log(`[${segment.start}-${segment.end}] ${segment.text}`)
   }
   ```

## Steps (Parakeet)

Parakeet uses the `transcription-parakeet` plugin. Register it in
`qvac.config.json` (optional) and load one of the Parakeet models — TDT / CTC /
Sortformer. The runtime API is identical to Whisper:

```ts
const modelId = await loadModel({
  modelSrc: 'parakeet-tdt-0-6b-v3', // resolve via modelRegistrySearch
  modelType: 'transcription',
})

const result = await transcribe({ modelId, audio: './recording.wav' })
```

To enumerate: `await modelRegistrySearch({ query: 'parakeet' })`.

## Hot-reloading Whisper config (0.9)

Whisper is the one model type that supports `loadModel` overload-as-reconfigure
in 0.9 — pass an existing `modelId` to swap config without reloading weights:

```ts
// Initial load
const modelId = await loadModel({
  modelSrc: WHISPER_TINY,
  modelType: 'transcription',
  modelConfig: { language: 'en' },
})

// Later: switch language without unloading
await loadModel({
  modelId, // <-- reuse, triggers reconfigure path
  modelType: 'transcription',
  modelConfig: { language: 'es' },
})
```

This is useful in multilingual apps where the user flips between languages but
the model weights stay hot in memory.

## Use Cases
- Voice notes app with P2P sync
- Meeting transcription
- Accessibility (real-time captions — prefer Parakeet)
- Language learning (pronunciation feedback — prefer Whisper, multilingual)
- Combine with `add-ai-chat` to summarize transcripts

## Audio Format Notes
- Both engines expect 16kHz mono WAV (PCM s16le) audio
- Use `sox` or `ffmpeg` to convert if needed
- Microphone recording requires platform-specific APIs
  - Node.js: `node-record-lpcm16` or `sox`
  - Mobile: Expo Audio API
  - Pear Desktop: Web Audio API in renderer, send to worker

## Critical Rules
- **Whisper models are large** — even "tiny" is ~75MB, "base" ~150MB, "large" ~3GB. Pick the smallest model that meets your quality needs and test on target hardware.
- **Parakeet is English-first** — do not use it for multilingual apps.
- **Audio format must be supported** — expect 16kHz mono WAV. Passing MP3, AAC, or stereo audio produces garbled output or errors. Convert with `sox` or `ffmpeg` first.
- **Streaming transcription has a different API** — `transcribeStream()` is not the same as `transcribe()`. Don't mix them or assume the same options work for both.
- **Don't transcribe without checking model is loaded** — calling `transcribe()` before `loadModel` resolves throws or hangs.
- **Don't skip audio preprocessing** — noise, echo, and low volume dramatically hurt accuracy. Apply gain normalization and noise reduction when possible.
- **Long recordings must be chunked** — transcribing a 2-hour file in one call will exhaust memory. Split into 30s-2min segments and concatenate results.
- **Whisper reconfigure only** — the `loadModel` reconfigure overload is
  currently Whisper-only in 0.9. Other model types must be unloaded and reloaded.

## Validation
1. Transcription model loads successfully (`loadModel` with `modelType: 'transcription'` resolves)
2. A known audio file (WAV, 16kHz, mono) transcribes with recognizable text output
3. Output text is readable and matches the spoken content
4. Timestamps are accurate if requested (segment start/end align with audio)
5. Streaming transcription emits segments in real time (if using `transcribeStream`)
6. Non-WAV audio is rejected or converted before transcription (no silent corruption)
7. (Whisper only) Hot-reload via `loadModel({ modelId, ... })` swaps language without a full reload

## Key Gotchas
- Transcription models are separate from LLM models — different `modelType`
- Audio must be WAV format (16kHz, mono) for best results
- Long recordings should be chunked for memory efficiency
- Transcription quality depends heavily on audio quality
- Mobile: microphone permissions required
- Parakeet plugin ships separately (`transcription-parakeet`) — register in
  `qvac.config.plugins` when tree-shaking with `qvac bundle sdk`

> **Status**: Docs only. Based on QVAC documentation (`sdk/audio-transcription.mdx`,
> `llms-full.txt`) and `research/qvac-examples/whispercpp-filesystem.ts` /
> `whispercpp-microphone-record.ts`. Parakeet path based on 0.9 release notes
> and plugin registry; not yet validated end-to-end.
