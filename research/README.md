# Research

Fetched documentation and SDK examples from external sources. This is reference material consulted when updating the agent pack.

> For upstream reference apps, see `reference-apps/` (git submodules).
> For internal apps we built, see `sandbox/`.

## Contents

| Folder | Type | Description |
|--------|------|-------------|
| `qvac-docs/` | Documentation | QVAC SDK official docs (fetched copy) |
| `qvac-examples/` | SDK Examples | QVAC SDK usage examples (audio, image, RAG, translation, etc.) |

## For AI Agents

This folder contains **external source material** for accurate API usage:

1. Check `qvac-docs/` for official QVAC SDK documentation
2. Check `qvac-examples/` for working SDK examples (transcription, vision, RAG, etc.)
3. Cross-reference with `reference-apps/` submodules for upstream app implementations
4. Cross-reference with `sandbox/` apps for internal battle-tested patterns
5. Port validated findings to `packages/agent-pack/src/` (modules, recipes, skills)
