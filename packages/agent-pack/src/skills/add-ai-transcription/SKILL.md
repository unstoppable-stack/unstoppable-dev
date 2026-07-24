---
name: add-ai-transcription
description: Local audio transcription using QVAC Whisper or NVIDIA Parakeet.
when_to_use: User wants speech-to-text, voice notes, or meeting transcription running entirely on-device.
paths: ["src/ai/**", "src/audio/**"]
version: "2026-05-21"
---

# Add AI Transcription (QVAC)

## When to Use
- User wants to transcribe audio to text locally
- User mentions "transcription", "speech-to-text", "voice notes", "Whisper", "Parakeet"
- User needs to process audio files or record from microphone

## Prerequisites
- `@qvac/sdk` (`^0.15.0`) installed
- A Whisper model **or** a Parakeet GGUF model (the legacy multi-file
  Parakeet ONNX bundles were removed in 0.11)

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Engines: Whisper vs Parakeet

QVAC 0.11 supports two transcription engines, each shipped as a plugin:

| Engine | Plugin | Strengths | Trade-offs |
|--------|--------|-----------|------------|
| Whisper | `transcription-whispercpp` | Multilingual, robust, mature, handles noisy audio. Streaming gains VAD + end-of-turn events (`emitVadEvents: true`) in 0.11. | Larger models, slower on long clips |
| Parakeet (NVIDIA NeMo) | `transcription-parakeet` (0.5.0, single-file GGUF backed by `qvac-parakeet.cpp`) | Very low latency, high throughput. New duplex `transcribeStream` session with EOU events in 0.11. | English-focused; auto-detects TDT / CTC / EOU / Sortformer from GGUF metadata |

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

3. **Transcribe an audio file** (0.10 returns structured segments by default
   when you pass `metadata: true`):
   ```ts
   import { transcribe } from '@qvac/sdk'

   // Plain text (back-compat shape):
   const text = await transcribe({
     modelId,
     audioChunk: './recording.wav',
   })
   console.log('Transcription:', text)

   // 0.10 structured-segment shape with timestamps + segment IDs.
   // Required for subtitles, timeline alignment, and search.
   const segments = await transcribe({
     modelId,
     audioChunk: './recording.wav',
     metadata: true,
   })
   for (const s of segments) {
     // TranscribeSegment: { id, startMs, endMs, text, append }
     console.log(`[${s.startMs}ms → ${s.endMs}ms] id=${s.id} ${s.text}`)
   }
   ```

   The `append` flag tells you whether the segment is a continuation of the
   previous one (for incremental UI updates) vs a fresh segment.

4. **Streaming transcription** (real-time, duplex session):
   ```ts
   import { transcribeStream } from '@qvac/sdk'

   const stream = transcribeStream({
     modelId,
     audio: microphoneStream,
   })

   for await (const segment of stream) {
     // Same TranscribeSegment shape — startMs, endMs, text, id, append.
     console.log(`[${segment.startMs}ms-${segment.endMs}ms] ${segment.text}`)
   }
   ```

## Steps (Parakeet — single-file GGUF, 0.11+)

Parakeet uses the `transcription-parakeet` plugin. The 0.11 release replaced
the legacy multi-file ONNX bundles (encoder + decoder + vocab + preprocessor)
with a **single GGUF**. The addon auto-detects the variant (TDT / CTC /
Sortformer / EOU) from GGUF metadata — no `modelType: "ctc" | …`
discriminator anymore.

```ts
import { loadModel, transcribe, PARAKEET_TDT_0_6B_V3_Q8_0 } from '@qvac/sdk'

const modelId = await loadModel({
  modelSrc: PARAKEET_TDT_0_6B_V3_Q8_0, // or PARAKEET_CTC_0_6B_Q8_0
  modelType: 'parakeet',
})

const text = await transcribe({ modelId, audioChunk: './recording.wav' })
```

Available constants in 0.11:

| Constant | Use |
|----------|-----|
| `PARAKEET_TDT_0_6B_V3_Q8_0` | General-purpose, balanced quality/latency |
| `PARAKEET_CTC_0_6B_Q8_0` | Lowest latency, CTC variant |
| `PARAKEET_SORTFORMER_4SPK_V1_Q8_0` | Speaker diarization, up to 4 speakers |
| `PARAKEET_EOU_120M_V1_Q8_0` | End-of-turn detection — surfaces `endOfTurn` events on `transcribeStream` |

> **Migration**: the legacy constants (`PARAKEET_TDT_ENCODER_INT8`,
> `PARAKEET_TDT_DECODER_INT8`, `PARAKEET_TDT_VOCAB`,
> `PARAKEET_TDT_PREPROCESSOR_INT8`, `PARAKEET_CTC_FP32`,
> `PARAKEET_CTC_TOKENIZER`, etc.) and every per-variant `parakeet*Src` field
> on `modelConfig` are **gone**. Replace the whole multi-field load with the
> single-GGUF form above.

To enumerate at runtime: `await modelRegistrySearch({ query: 'parakeet' })`.

## Conversational streaming (Whisper VAD + EOU, NEW in 0.11)

`transcribeStream` gains a conversational mode opted into via
`emitVadEvents: true`. The session yields a discriminated event stream
with live voice-activity probabilities and turn boundaries so you can build
push-to-talk or barge-in UX without polling text output:

```ts
import { transcribeStream } from '@qvac/sdk'

const session = await transcribeStream({
  modelId,                  // any Whisper or Parakeet modelId
  emitVadEvents: true,
  endOfTurnSilenceMs: 800,
  vadRunIntervalMs: 100,
})

for await (const event of session) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text)
      break
    case 'vad':
      console.log('speaking:', event.speaking, 'p=', event.probability)
      break
    case 'endOfTurn':
      console.log('\nturn ended after', event.silenceDurationMs, 'ms')
      break
  }
}

session.write(audioChunk) // Uint8Array (16kHz mono PCM s16le)
session.end()
```

Parakeet duplex sessions accept additional per-call streaming overrides via
`parakeetStreamingConfig: { chunkMs, historyMs, leftContextMs,
rightLookaheadMs, emitPartials, emitEnergyVad }` (each falls back to the
`parakeetConfig.streaming*` load-time counterpart).

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
  currently Whisper-only. Other model types must be unloaded and reloaded.
- **Parakeet is now GGUF-only** (0.11+) — the multi-file ONNX bundles are
  gone. Pass a single GGUF `modelSrc` and let the addon auto-detect the
  variant; remove every `parakeet*Src` field from `modelConfig`.

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
