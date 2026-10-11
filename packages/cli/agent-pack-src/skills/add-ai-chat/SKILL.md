---
name: add-ai-chat
description: Extend local chat in a generated Unstoppable app using its recorded AI session and runtime profile.
---

# Extend local chat

Read `.unstoppable/project.json`, package.json, and the generated worker/AI manager first. New targets use `us scaffold app` with `local-ai`; existing targets already include lifecycle plumbing. Older apps without `.unstoppable/runtime-ai/` need an explicit migration rather than a copied setup snippet.

Desktop and Node apps use `createAISession` with their runtime adapter. Keep native imports inside adapters; renderer code only uses IPC. The app owns history/prompts. Preserve request IDs across the bridge and ignore stale output. A session permits one active inference and waits for cancellation to settle before reuse.

Use `load` for progress/error/retry, `stream(history, { requestId, signal, onTrim })` for responses, `cancel` for Stop, and `close` for shutdown. History limits are conservative byte bounds; SDK overflow recovery is authoritative and does not replay partial output. Surface omitted context and reject oversized latest messages without truncation.

Read the local QVAC module integration note for the contract. Read [chat example](resources/chat-example.md) when extending a worker; [troubleshooting](resources/troubleshooting.md) for failure diagnosis. [Models](resources/model-guide.md), [schemas](resources/schema-guide.md), and [tools](resources/tool-calling-example.md) route advanced changes to installed types and version-matched upstream docs.

Validate a real completion, missing-model failure/Retry, Stop followed by another completion, context trimming, oversized-message recovery, shutdown, and network-isolated cached startup. Mock output is UI/protocol evidence only. Expo uses a separate experimental SDK implementation and does not inherit desktop adapter validation.
