---
name: add-p2p-sync
description: Add P2P data synchronization between peers using Hypercore and Hyperswarm
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# Add P2P Data Sync

## When to Use
- User wants to sync data between devices or peers
- User mentions "replication", "multi-device", "offline sync", or "shared state"
- User needs an append-only log shared across peers

## Prerequisites
- Hypercore and Hyperswarm installed (check package.json)
- Node.js or Bare runtime with ESM support

## Included Components

Your project includes battle-tested components in `src/p2p/` and `src/data/`:

- **`src/p2p/swarm-manager.ts`** — Hyperswarm with connection lifecycle, error handling, graceful shutdown
- **`src/p2p/replication.ts`** — Hypercore/Corestore replication wired to Hyperswarm with `findingPeers()`
- **`src/data/corestore-manager.ts`** — Named Hypercore management with shared storage

## Steps

1. **Install dependencies** (if not present):
   ```bash
   pnpm add hypercore hyperswarm corestore b4a hypercore-crypto
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

## Deep Dive
- Full writer/reader example: read `resources/full-example.md`
- Troubleshooting guide: read `resources/troubleshooting.md`
