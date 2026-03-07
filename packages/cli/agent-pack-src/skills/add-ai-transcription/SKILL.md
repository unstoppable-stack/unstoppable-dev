---
name: add-ai-transcription
description: Add local audio transcription using QVAC Whisper models. Use
  when the user wants speech-to-text, voice notes, or meeting transcription
  running entirely on-device.
---

# Add AI Transcription (QVAC Whisper)

## When to Use
- User wants to transcribe audio to text locally
- User mentions "transcription", "speech-to-text", "voice notes", "Whisper"
- User needs to process audio files or record from microphone

## Prerequisites
- `@qvac/sdk` (`^0.7.0`) installed
- A Whisper model available

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install QVAC** (if not already):
   ```bash
   pnpm add @qvac/sdk
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

## Key Gotchas
- Whisper models are separate from LLM models — different `modelType`
- Audio must be WAV format (16kHz, mono) for best results
- Long recordings should be chunked for memory efficiency
- Transcription quality depends heavily on audio quality
- Mobile: microphone permissions required

> **Status**: Docs only. Based on QVAC documentation and
> `research/qvac-examples/whispercpp-filesystem.ts` and
> `whispercpp-microphone-record.ts`. Not yet validated with a reference app.
