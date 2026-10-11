---
name: add-ai-rag
description: Integrate RAG at an existing app runtime boundary using version-matched upstream APIs.
---

# Integrate RAG

Read the app manifest and installed SDK types first. This is an advanced integration, not part of the validated basic text-session contract. Do not copy legacy SDK examples or upgrade dependencies as a side effect.

Keep embeddings/index persistence and domain retrieval policy in app code. Keep private indexes outside replication unless sharing is intended.

Use [official QVAC documentation](https://docs.qvac.tether.io/sdk/ai-capabilities/rag/) and release notes matching the installed SDK. For offline work, inspect installed declarations/examples; do not invent missing API fields. Keep native imports inside the worker/adapter and preserve existing networking/storage when initialization fails.

Implement the smallest requested extension. Validate its actual model/addon load, result shape, errors, cancellation/reuse and cleanup on the target device. SDK documentation coverage does not establish support for this app profile.
