---
name: add-openai-server
description: Integrate an OpenAI-compatible QVAC server at an existing app runtime boundary using version-matched upstream APIs.
---

# Integrate an OpenAI-compatible QVAC server

Read the app manifest and installed SDK types first. This is an advanced integration, not part of the validated basic text-session contract. Do not copy legacy SDK examples or upgrade dependencies as a side effect.

This is an opt-in server surface, distinct from local desktop IPC. Confirm bind address, access policy, model resources and server lifecycle. Do not expose it merely to run local chat.

Use [official QVAC documentation](https://docs.qvac.tether.io/sdk/js-ts-sdk/) and release notes matching the installed SDK. For offline work, inspect installed declarations/examples; do not invent missing API fields. Keep native imports inside the worker/adapter and preserve existing networking/storage when initialization fails.

Implement the smallest requested extension. Validate its actual model/addon load, result shape, errors, cancellation/reuse and cleanup on the target device. SDK documentation coverage does not establish support for this app profile.
