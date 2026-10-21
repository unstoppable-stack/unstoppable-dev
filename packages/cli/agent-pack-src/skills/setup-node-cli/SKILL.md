---
name: setup-node-cli
description: Extend a Node CLI through existing generated runtime and storage boundaries.
---

# Extend a Node CLI

Read the generated src/index.ts, src/swarm-manager.ts and src/storage-manager.ts (or multi-writer store). Local AI is in src/ai-manager.ts and .unstoppable/runtime-ai/. Extend the existing managers. Keep AI native imports in the Node adapter; QVAC owns its own worker. On shutdown close the AI session, swarm, storage and store. Use package.json scripts for build/run. Validate real behavior and offline reads; mock AI output is protocol evidence only.

Read app metadata first. New targets use the CLI, while upgrades use `us compatibility check -o <app>` and explicit migrations that preserve application files.

For new shared JSON use `@unstoppable-stack/p2p/data`; for remote business
calls use `/rpc` and `/service`, or reuse an existing root node. Read
`modules/p2p.mdc`. Preserve existing storage/managers and avoid a second swarm
or store around managed helpers.
