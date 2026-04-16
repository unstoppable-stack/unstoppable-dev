---
name: add-kv-storage
description: Hyperbee key-value storage with offline-first sync.
when_to_use: User needs simple persistent key-value storage that works offline and syncs when peers connect. For structured data, use add-database.
paths: ["src/data/**", "src/store/**"]
version: "2026-04-14"
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
   npm i hypercore hyperbee hyperswarm
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

## Critical Rules
- **Always `await db.ready()`** before any put/get/del operations — Hyperbee is not usable until the underlying Hypercore is initialized
- **Don't store large blobs in Hyperbee** — it's optimized for small key-value pairs. Use Hyperdrive (`add-file-storage`) for files and binary data
- **Write locally first, sync later** — never block user actions on peer connections. The local-first pattern means writes succeed even offline
- **Don't mix HyperDB and Hyperbee patterns** — they are different libraries with different APIs. Hyperbee is a B-tree on a single Hypercore; HyperDB is a multi-writer structured database
- **Use `keyEncoding` and `valueEncoding`** — always set `{ keyEncoding: 'utf-8', valueEncoding: 'json' }` to avoid raw buffer handling
- **Replicate the `core`, not the `db`** — `core.replicate(conn)` is the correct call. Hyperbee has no `replicate()` method
- **Don't forget `core.findingPeers()`** — coordinate with swarm to avoid reading stale data on startup

## Validation
1. [ ] `npm i hypercore hyperbee hyperswarm` installs without errors
2. [ ] `await db.ready()` resolves and `db.put('key', { value: 1 })` succeeds
3. [ ] `await db.get('key')` returns the stored value with correct encoding
4. [ ] Data persists across restarts: kill the process, restart, `db.get('key')` still returns the value
5. [ ] Replication syncs entries: writer puts data, reader joins swarm and reads the same entries
6. [ ] `db.del('key')` removes the entry and subsequent `db.get('key')` returns `null`
7. [ ] `db.watch()` fires on remote updates during live replication

## Deep Dive
- Full example with live sync: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`
