---
name: offline-first-app
description: Build an offline-first app with local Hyperbee storage and background P2P sync
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# Offline-First App

## When to Use
- User wants an app that works without internet
- User mentions "offline", "local-first", or "works without connection"
- User needs data that syncs when peers are available

## Prerequisites
- Hypercore, Hyperbee, and Hyperswarm installed

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
