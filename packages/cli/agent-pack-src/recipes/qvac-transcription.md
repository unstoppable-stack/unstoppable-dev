---
id: qvac-transcription
name: QVAC Transcription
category: recipe
requires: [qvac]
tags: [ai, audio]
---

# Recipe: QVAC Transcription (Whisper)

## Problem

Transcribe audio from a file or stream audio chunks in real time.

## Prerequisites

- QVAC SDK installed (`@qvac/sdk`).
- A Whisper model constant (e.g., `WHISPER_TINY`).
- Audio available as a file path or Buffer.

## Solution

### Step 1: Load a Whisper model

```ts
import { loadModel, WHISPER_TINY } from "@qvac/sdk";

const modelId = await loadModel({
  modelSrc: WHISPER_TINY,
  modelType: "whisper",
  modelConfig: { audio_format: "f32le" },
});
```

### Step 2: Transcribe a file

```ts
import { transcribe } from "@qvac/sdk";

const text = await transcribe({ modelId, audioChunk: "./audio.wav" });
```

### Step 3: Stream transcription from buffers

```ts
import { transcribeStream } from "@qvac/sdk";

for await (const chunk of transcribeStream({ modelId, audioChunk: buffer })) {
  process.stdout.write(chunk);
}
```

## Full Example

```ts
import {
  loadModel,
  unloadModel,
  transcribe,
  transcribeStream,
  WHISPER_TINY,
} from "@qvac/sdk";
import { readFileSync } from "fs";

const modelId = await loadModel({
  modelSrc: WHISPER_TINY,
  modelType: "whisper",
  modelConfig: { audio_format: "f32le" },
});

// File-based transcription
const text = await transcribe({ modelId, audioChunk: "./audio.wav" });
console.log(text);

// Streaming transcription from a buffer
const buffer = readFileSync("./audio.wav");
for await (const chunk of transcribeStream({ modelId, audioChunk: buffer })) {
  process.stdout.write(chunk);
}

await unloadModel({ modelId });
```

## Variations

### Variation 1: Higher quality model

Swap `WHISPER_TINY` for `WHISPER_LARGE_V3_TURBO` when accuracy is more
important.

### Variation 2: Microphone input

Use FFmpeg to pipe microphone audio into `transcribeStream` (see
`whispercpp-microphone-record.ts`).

### Variation 3: VAD model

Use `vadModelSrc` in `loadModel()` to enable voice activity detection for long
audio streams.

## Troubleshooting

### Problem: Output is empty or garbled

**Symptoms**: Result is blank or incorrect. **Solution**: Ensure `audio_format`
matches your input format, and verify sample rate.

### Problem: Streaming stalls

**Symptoms**: `transcribeStream` stops emitting tokens. **Solution**: Send
sufficiently large audio buffers (at least a few seconds of audio).

## Related

- `output/modules/qvac.md`
