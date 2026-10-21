---
name: add-kv-storage
description: Local-first JSON storage and sharing with @unstoppable-stack/p2p/data; preserve existing private stores.
---

# Add local-first KV storage

Inspect the app's storage and installed profile before choosing a format. For
new shared JSON use `openCollection` from `@unstoppable-stack/p2p/data` (alpha.2
or later). Read `modules/p2p.mdc` and `modules/managed-data.mdc`.

```js
import { openCollection } from '@unstoppable-stack/p2p/data'
const notes = await openCollection({ storage: './shared-notes' })
await notes.put('hello', { text: 'Hello!' })
console.log(await notes.get('hello'))
// At app shutdown: await notes.close().
```

Local open/reads/writes do not wait for peers. Before sharing, await
`notes.network.ready({ timeoutMs: 60000, signal })`, then share `notes.key` and
`notes.version` only with intended readers. Readers open their own directory
with `key`, call bounded `sync({ version, timeoutMs, signal })`, then read.
A collection has one writer. Several writers need
[multi-writer sync](../add-multi-writer-sync/SKILL.md).

Dataset keys permit reads; RPC grants do not revoke them. Keep private caches,
credentials and device state in a separate local store. Preserve existing
Hyperbee/HyperDB/Autobee storage and schema; managed data is not a drop-in opener
for those directories. For app-owned local storage, direct engine operations
remain valid inside the native runtime. Do not add manual Hyperswarm replication
around managed data. Legacy Hyperbee examples are advanced existing-store
references only.

Keep native storage in Node or the desktop Bare worker, behind IPC. Validate
put/get/delete, offline restart persistence, reader sync, bounded wait
cancellation and close/reopen. Downloaded checkpoints are not complete backups.
