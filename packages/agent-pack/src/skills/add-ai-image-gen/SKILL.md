---
name: add-ai-image-gen
description: Integrate image generation at an existing app runtime boundary using version-matched upstream APIs.
---

# Integrate image generation

Read the app manifest and installed SDK types first. This is an advanced integration, not part of the validated basic text-session contract. Do not copy legacy SDK examples or upgrade dependencies as a side effect.

Keep output asset storage and model memory budgets explicit. Do not share the chat model with an unrelated image operation.

Use [official QVAC documentation](https://docs.qvac.tether.io/sdk/ai-capabilities/image-generation/) and release notes matching the installed SDK. For offline work, inspect installed declarations/examples; do not invent missing API fields. Keep native imports inside the worker/adapter and preserve existing networking/storage when initialization fails.

Implement the smallest requested extension. Validate its actual model/addon load, result shape, errors, cancellation/reuse and cleanup on the target device. SDK documentation coverage does not establish support for this app profile.
