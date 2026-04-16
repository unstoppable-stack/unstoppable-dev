---
name: add-ai-transcription
description: Local audio transcription using QVAC Whisper models.
when_to_use: User wants speech-to-text, voice notes, or meeting transcription running entirely on-device.
paths: ["src/ai/**", "src/audio/**"]
version: "2026-04-14"
---

# Add AI Transcription (QVAC Whisper)

## When to Use
- User wants to transcribe audio to text locally
- User mentions "transcription", "speech-to-text", "voice notes", "Whisper"
- User needs to process audio files or record from microphone

## Prerequisites
- `@qvac/sdk` (`^0.8.0`) installed
- A Whisper model available

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install QVAC** (if not already):
   ```bash
   npm i @qvac/sdk
   ```

2. **Load a Whisper model**:
   ```ts
   import { loadModel, transcribe } from '@qvac/sdk'

   const modelId = await loadModel({
     modelSrc: 'whisper-model-constant', // Check QVAC docs for current models
     modelType: 'transcription',
   })
   ```

3. **Transcribe an audio file**:
   ```ts
   const result = await transcribe({
     modelId,
     audio: './recording.wav',
   })

   console.log('Transcription:', result.text)
   console.log('Segments:', result.segments)
   ```

4. **Streaming transcription** (real-time):
   ```ts
   const stream = transcribeStream({
     modelId,
     audio: microphoneStream,
   })

   for await (const segment of stream) {
     console.log(`[${segment.start}-${segment.end}] ${segment.text}`)
   }
   ```

## Use Cases
- Voice notes app with P2P sync
- Meeting transcription
- Accessibility (real-time captions)
- Language learning (pronunciation feedback)
- Combine with `add-ai-chat` to summarize transcripts

## Audio Format Notes
- Whisper expects 16kHz mono WAV audio
- Use `sox` or `ffmpeg` to convert if needed
- Microphone recording requires platform-specific APIs
  - Node.js: `node-record-lpcm16` or `sox`
  - Mobile: Expo Audio API
  - Pear Desktop: Web Audio API in renderer, send to worker

## Critical Rules
- **Whisper models are large** — even "tiny" is ~75MB, "base" ~150MB, "large" ~3GB. Pick the smallest model that meets your quality needs and test on target hardware.
- **Audio format must be supported** — Whisper expects 16kHz mono WAV. Passing MP3, AAC, or stereo audio produces garbled output or errors. Convert with `sox` or `ffmpeg` first.
- **Streaming transcription has a different API** — `transcribeStream()` is not the same as `transcribe()`. Don't mix them or assume the same options work for both.
- **Don't transcribe without checking model is loaded** — calling `transcribe()` before the model finishes loading throws or hangs.
- **Don't skip audio preprocessing** — noise, echo, and low volume dramatically hurt accuracy. Apply gain normalization and noise reduction when possible.
- **Long recordings must be chunked** — transcribing a 2-hour file in one call will exhaust memory. Split into segments (30s-2min) and concatenate results.

## Validation
1. Whisper model loads successfully (`loadModel` with `modelType: 'transcription'` resolves)
2. A known audio file (WAV, 16kHz, mono) transcribes with recognizable text output
3. Output text is readable and matches the spoken content
4. Timestamps are accurate if requested (segment start/end align with audio)
5. Streaming transcription emits segments in real time (if using `transcribeStream`)
6. Non-WAV audio is rejected or converted before transcription (no silent corruption)

## Key Gotchas
- Whisper models are separate from LLM models — different `modelType`
- Audio must be WAV format (16kHz, mono) for best results
- Long recordings should be chunked for memory efficiency
- Transcription quality depends heavily on audio quality
- Mobile: microphone permissions required

> **Status**: Docs only. Based on QVAC documentation and
> `research/qvac-examples/whispercpp-filesystem.ts` and
> `whispercpp-microphone-record.ts`. Not yet validated with a reference app.
