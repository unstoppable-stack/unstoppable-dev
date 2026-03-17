---
name: add-p2p-sync
description: Add P2P data replication between peers using Hypercore and
  Corestore. Use when the user needs to sync an append-only log or data
  store across devices. Requires add-p2p-networking first.
---

# Add P2P Data Sync

## When to Use
- User wants to sync data between devices or peers
- User mentions "replication", "multi-device", "offline sync", or "shared state"
- User needs an append-only log shared across peers

> **Multi-writer?** If multiple peers need to **write** to the same database
> and converge, use `add-multi-writer-sync` (Autobase) instead of this skill.
> This skill covers **single-writer** replication — one peer writes, others read.

## Prerequisites
- Hypercore (`^11.24.0`) and Hyperswarm (`^4.16.0`) installed
- Node.js or Bare runtime with ESM support

> **CRITICAL — Pear Desktop Apps:** Hypercore, Hyperswarm, and Corestore
> CANNOT run in the renderer (browser context). They MUST run in a **worker
> process** started via `pear-run`. The UI communicates with the worker via
> NDJSON over `Pear.worker.pipe()`. See the `setup-pear-desktop` skill →
> `resources/worker-pattern.md` for the full worker bridge implementation.

## Included Components

Your project includes battle-tested components in `src/p2p/` and `src/data/`:

- **`src/p2p/swarm-manager.ts`** — Hyperswarm with connection lifecycle, error handling, graceful shutdown
- **`src/p2p/replication.ts`** — Hypercore/Corestore replication wired to Hyperswarm with `findingPeers()`
- **`src/data/corestore-manager.ts`** — Named Hypercore management with shared storage

## Steps

1. **Install dependencies** (if not present):
   ```bash
   npm i hypercore hyperswarm corestore b4a hypercore-crypto
   ```

2. **Use the included components** — they handle the common gotchas already:
   ```ts
   import { SwarmManager } from './p2p/swarm-manager.js'
   import { joinAndReplicate } from './p2p/replication.js'
   import { CorestoreManager } from './data/corestore-manager.js'
   ```

3. **Wire into your app** — create cores, join the swarm, replicate:
   ```ts
   const store = new CorestoreManager({ storagePath: './data' })
   const core = await store.getCore('events')

   const swarm = new SwarmManager({
     onConnection: (conn) => store.replicate(conn),
     onError: (err) => console.error('Peer error:', err.message),
   })

   await swarm.join(core.discoveryKey)
   ```

4. **Customize** the components for your specific data model

## Key Gotchas
- Always call `await core.ready()` before any operations
- Use `const discovery = swarm.join(topic); await discovery.flushed()` to wait for discovery announcements (NOT `swarm.flush()`)
- Both peers should join with `{ server: true, client: true }` for reliable mutual discovery
- Call `await core.update({ wait: true })` to wait for remote data
- Handle `conn.on('error')` and `conn.on('close')` events

## Critical Rules
- **Always replicate before reading remote data** — a Hypercore has no data until replication brings it from the writer
- **Use Corestore for multi-core apps** — managing individual Hypercores manually leads to storage and replication bugs. Corestore handles shared storage and multiplexed replication
- **Don't forget `swarm.flush()` / `discovery.flushed()`** — without waiting for discovery, you may read before any peers have connected
- **Always `await core.ready()`** — accessing `core.key` or `core.discoveryKey` before ready returns `null`
- **Replicate the `store`, not individual cores** — `store.replicate(conn)` handles all cores in the store automatically
- **Never assume data is available immediately** — use `core.update({ wait: true })` to wait for remote data after replication starts
- **Use `findingPeers()` for coordinated startup** — tells Hypercore to wait for peers before resolving reads, avoiding premature "empty" results
- **Don't hardcode core keys across peers** — share them via a discovery mechanism or out-of-band

## Validation
1. [ ] Writer creates a Hypercore and appends data: `await core.append('hello')` succeeds
2. [ ] Writer joins swarm on `core.discoveryKey` and `discovery.flushed()` resolves
3. [ ] Reader creates a Hypercore from the writer's public key and joins the same swarm
4. [ ] Reader receives data: `await core.get(0)` returns the appended block after replication
5. [ ] Multiple appends sync: writer appends 5 entries, reader sees all 5 after `core.update()`
6. [ ] Restart preserves data: kill and restart both peers — writer's data persists, reader re-syncs
7. [ ] `core.length` matches on both sides after full replication

## Deep Dive
- Full writer/reader example: read `resources/full-example.md`
- Troubleshooting guide: read `resources/troubleshooting.md`
