---
name: add-kv-storage
description: Add Hyperbee key-value storage with offline-first patterns and
  automatic P2P sync. Use when the user needs simple persistent storage that
  works offline and syncs when peers are available.
---

# Add KV Storage (Hyperbee)

## When to Use
- User needs simple key-value persistence
- User mentions "storage", "offline", "local-first", "cache", "persist"
- User wants data that works offline and syncs when peers connect
- For structured data with schema/indexes, use `add-database` instead

## Prerequisites
- Hypercore (`^11.24.0`), Hyperbee (`^2.27.3`), and Hyperswarm (`^4.16.0`)

> **CRITICAL — Pear Desktop Apps:** Hypercore, Hyperbee, and Hyperswarm
> CANNOT run in the renderer (browser context). They MUST run in a **worker
> process** started via `pear-run`. The UI communicates with the worker via
> NDJSON over `Pear.worker.pipe()`. See the `setup-pear-desktop` skill →
> `resources/worker-pattern.md` for the full worker bridge implementation.

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add hypercore hyperbee hyperswarm
   ```

2. **Create local store** in `src/data/store.ts`:
   - Initialize Hypercore with persistent storage
   - Wrap with Hyperbee for key-value access
   - Write locally without waiting for peers

3. **Add background sync** in `src/p2p/sync.ts`:
   - Create Hyperswarm, join discovery key
   - Coordinate with `core.findingPeers()` + `swarm.flush()`
   - Watch for remote updates

4. **Wire into app** — always read/write locally first, sync is opportunistic

## Quick Implementation

```ts
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'

const core = new Hypercore('./db')
const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
await db.ready()

// Local-first write (works offline)
await db.put('profile', { name: 'User', updatedAt: Date.now() })

// Background sync (when peers available)
const swarm = new Hyperswarm()
swarm.on('connection', conn => core.replicate(conn))
swarm.join(core.discoveryKey)
```

## Key Gotchas
- Always write locally first — don't block on peer connections
- Use `core.findingPeers()` + `swarm.flush()` to coordinate initial sync
- Call `core.update({ wait: true })` to wait for remote data
- Use `db.watch()` for real-time change notifications

## Deep Dive
- Full example with live sync: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`
