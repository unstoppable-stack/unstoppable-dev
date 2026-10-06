---
name: add-ai-chat
description: Add local QVAC chat with explicit runtime boundaries, streamed output, Stop/retry, bounded history and offline validation.
---

# Add local AI chat

Desktop generation now targets QVAC inference 0.21.0, llama.cpp addon 0.55.0 and Electron 44.5.1. Node clients use SDK 0.21.0. Consult the QVAC module reference and the generated app before extending it. Expo is a deferred separately pinned 0.15 generator; do not assume the desktop migration validates mobile.

## Runtime and installation

**Bare desktop worker:** install `@qvac/inference@0.21.0`, `@qvac/llm-llamacpp@0.55.0` and `bare-process@^4.5.1`. Set the process global before dynamic engine imports. Register `llmPlugin` from `@qvac/inference/llamacpp-completion/plugin` explicitly. Keep AI lazy-loaded so a model/addon failure does not take down networking/storage.

**Node:** install `@qvac/sdk@0.21.0` and use its client API; it manages a separate worker. New apps need Node >=22.17. **Renderer:** browser UI and IPC only, no native SDK imports. **Expo:** SDK belongs in React Native, not the networking worklet; native host/addon compatibility must pass device checks.

## Implement

1. Load the pinned Qwen 3.5 0.8B Q4_K_M model with progress/error/retry controls. Use `ctx_size: 4096`, `reasoning_budget: 0` and an explicit `system_prompt`. Do not use `/no_think` or strip reasoning tags mid-stream.
2. Track a request ID through the renderer, bridge and worker. Stream tokens only to that active request. Disable duplicate Send while running.
3. Use the generated `chat-context.js` for bounded recent history and overflow handling. QVAC no longer accepts `n_discarded`. It is not a tokenizer: retain authoritative SDK overflow recovery. Inform users when old context is omitted and reject a too-large latest message without truncating it.
4. Stop through `cancel({ operation: 'inference', modelId })`. Ignore late events, then verify another completion on the same model. Never automatically retry after partial output.
5. On shutdown, cancel active inference, unload the model and close the engine/resources. First installation/download needs network; cached inference and persisted local data should work offline.

## Validate

Run the actual worker and renderer, not only structural snapshots. Exercise a missing-model failure and Retry, a real completion, Stop plus another completion, many-turn history trimming, rejection of an oversized request and successful subsequent request. Repeat with a network-isolated cached model. For release acceptance, use the packed CLI to generate/install/run the app.

Use current version-matched schemas for tools, multimodal attachments and sampling. Some resources retain general patterns; the current module contract takes precedence over old code. The old SDK `delegate`/provider path was removed in 0.19; the project's experimental Node RPC is separate.

Resources: [chat](resources/chat-example.md), [tools](resources/tool-calling-example.md), [models](resources/model-guide.md), [schemas](resources/schema-guide.md), [troubleshooting](resources/troubleshooting.md). Official reference: https://docs.qvac.tether.io/sdk/js-ts-sdk/.

QVAC inference 0.21 eagerly imports language detection and audio decoding from its public API. Install `@qvac/langdetect-text@^0.1.2` and `@qvac/decoder-audio@^0.7.0` explicitly even for this LLM-only app; a fresh install cannot rely on optional peers left over from an older SDK.
