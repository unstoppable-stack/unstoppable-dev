---
name: add-qvac
description: Add local AI inference to an existing project using the
  QVAC SDK with model management, chat sessions, and optional tool calling
---

# Add QVAC AI Inference

Add local AI inference capabilities to the current project.

## Steps

1. Install QVAC dependencies:
   ```bash
   pnpm add @qvac/sdk zod@^4
   ```

2. Ask the user:
   - Use case: chat, tool calling, vision, transcription, or translation
   - Model size preference: tiny (0.5GB), small (1GB), medium (2.5GB), large (4GB)

3. Copy the battle-tested components into `src/ai/`:
   - `model-manager.ts` — load/unload models with progress tracking
   - `chat-session.ts` — streaming chat with KV cache and history trimming
   - `tool-runner.ts` — tool-calling loop with Zod schemas (if tool calling)

4. If the project uses Pear Desktop runtime:
   - QVAC MUST run in a worker process, never in the renderer
   - Set up the worker bridge pattern with NDJSON over `Pear.worker.pipe()`
   - Reference the `setup-pear-desktop` skill for the full worker pattern

5. Wire the components into the app entry point with proper cleanup

6. Add `<think>` token filtering if using Qwen 3 models
