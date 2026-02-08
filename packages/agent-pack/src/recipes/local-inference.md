---
id: local-inference
name: Local AI Inference
category: recipe
requires: [qvac]
tags: [ai, inference, offline]
---

# Recipe: Local Inference

## Problem

Run an LLM locally with streaming tokens.

## Prerequisites

- QVAC SDK installed (`@qvac/sdk`).
- A supported device/runtime (Node.js, Bare, or physical device for Expo).

## Solution

Use QVAC SDK to load a GGUF model and stream completion tokens.

`onProgress` receives a `ModelProgressUpdate` object:

```ts
type ModelProgressUpdate = {
  type: "modelProgress";
  downloaded: number;
  total: number;
  percentage: number;
};
```

## Full Example

```js
import {
  loadModel,
  LLAMA_3_2_1B_INST_Q4_0,
  completion,
  unloadModel,
} from "@qvac/sdk";

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: "llm",
  onProgress: (progress) => {
    console.log(
      `${progress.percentage.toFixed(1)}% (${progress.downloaded}/${progress.total})`,
    );
  },
});

const history = [
  { role: "user", content: "Explain quantum computing in one sentence" },
];
const result = completion({ modelId, history, stream: true });

for await (const token of result.tokenStream) {
  process.stdout.write(token);
}

await unloadModel({ modelId });
```

## Variations

- Use `downloadAsset()` first to pre-cache models for offline use.
- Use `delegate` in `loadModel()` for P2P delegated inference.

## System Prompt Engineering for Local Models

Small local models need different prompting than cloud APIs:

- **Embed reference data** (menus, schemas, lists) directly in the system prompt
  rather than using a tool to fetch them.
- **Keep prompts structured** with clear headers, numbered rules, and explicit
  formatting instructions.
- **Use fewer tools** — each tool increases grammar complexity and reduces
  reliability on smaller models.
- **Be explicit about output format** — specify exactly how the model should
  respond.
- **Size guidelines**: 0.6B-1B for simple text; 3B+ for tool calling; 7B for
  complex reasoning.

## Troubleshooting

- If model load fails, confirm the model file format matches the model type (LLM
  uses `.gguf`).
- If streaming stalls, verify the runtime has access to model storage and enough
  disk space.
- If you hit context overflow errors, use `n_discarded: N` in `modelConfig` for
  automatic sliding window, or shorten history manually.
- Use `kvCache: sessionId` for multi-turn conversations.
- Qwen 3 models emit `<think>` blocks — add `/no_think` to system prompt or
  filter with `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`.
