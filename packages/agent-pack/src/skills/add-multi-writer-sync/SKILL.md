---
name: add-multi-writer-sync
description: Add multi-writer data sync using Autobase. Use when multiple
  peers or devices need to write to the same database and converge to
  consistent state. Requires add-p2p-networking first.
---

# Add Multi-Writer Sync (Autobase)

## When to Use
- User wants multiple peers to write to the same database simultaneously
- User mentions "collaborative", "multi-writer", "multi-device sync", or "shared editing"
- User needs offline-first writes that merge when peers reconnect
- User is building a server cluster with failover

> **Not this skill?** If only ONE peer writes and others read, use
> `add-p2p-sync` instead (single-writer Hypercore replication).

## Prerequisites
- Hyperswarm and Corestore installed (via `add-p2p-networking`)
- Node.js or Bare runtime
- Understanding of append-only logs (Hypercore)

## Architecture Overview

Autobase takes multiple independent Hypercore writers, linearizes their
operations into a deterministic order, and produces a single consistent view.

```
┌─── Writer A ──────┐  ┌─── Writer B ──────┐  ┌─── Writer C ──────┐
│ append(op1)        │  │ append(op2)        │  │ append(op3)        │
│ append(op4)        │  │ append(op5)        │  │                    │
└────────┬───────────┘  └────────┬───────────┘  └────────┬───────────┘
         │                       │                       │
         └───────────┬───────────┴───────────────────────┘
                     │
              ┌──────▼───────┐
              │  Linearizer  │   Causal DAG → deterministic order
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │  apply()     │   Your reducer function
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │  View        │   The database clients query
              │  (Hyperbee)  │   Same on all peers
              └──────────────┘
```

## Steps

### Step 1: Install Dependencies

```bash
npm i autobase corestore hyperswarm b4a
```

### Step 2: Define Your Operations

Decide what operations your app needs. Each operation is an action that
gets appended to a writer core and applied to the view.

Common operations:
- `put-item` / `delete-item` — CRUD on your data
- `add-writer` / `remove-writer` — membership management

For simple apps, JSON-encode operations:
```js
await base.append(JSON.stringify({ type: 'put-item', id: '123', name: 'Test' }))
```

For production apps, use Hyperdispatch for typed binary encoding. See
`resources/hyperdispatch-pattern.md`.

### Step 3: Create the Autobase

```js
const Corestore = require('corestore')
const Autobase = require('autobase')
const Hyperbee = require('hyperbee')

function createAutobase(storagePath, bootstrapKey = null) {
  const store = new Corestore(storagePath)

  const base = new Autobase(store, bootstrapKey, {
    open(store) {
      return new Hyperbee(store.get('view'), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
        extension: false,
      })
    },

    async apply(nodes, view, host) {
      for (const node of nodes) {
        if (node.value === null) continue

        const op = JSON.parse(node.value.toString())

        switch (op.type) {
          case 'add-writer':
            await host.addWriter(
              Buffer.from(op.key, 'hex'),
              { indexer: !!op.indexer }
            )
            break
          case 'put-item':
            await view.put(op.id, { name: op.name, updatedBy: op.writerId })
            break
          case 'delete-item':
            await view.del(op.id)
            break
        }
      }
    },

    ackInterval: 5000,
    ackThreshold: 0,
  })

  return { store, base }
}
```

> **CRITICAL**: `extension: false` is required for Hyperbee/HyperDB when
> used as an Autobase view. Autobase manages its own protocol extensions.

### Step 4: Wire Up Replication

```js
const Hyperswarm = require('hyperswarm')

async function startReplication(store, base) {
  await base.ready()

  const swarm = new Hyperswarm()
  swarm.join(base.discoveryKey)
  swarm.on('connection', (conn) => store.replicate(conn))

  return swarm
}
```

### Step 5: Bootstrap Multi-Writer

**First instance** (creates the base):
```js
const { store, base } = createAutobase('./data-peer1')
await base.ready()
console.log('Base key:', base.key.toString('hex'))
console.log('Local writer key:', base.local.key.toString('hex'))
```

**Second instance** (joins the base):
```js
const bootstrapKey = Buffer.from('<base-key-from-peer1>', 'hex')
const { store, base } = createAutobase('./data-peer2', bootstrapKey)
await base.ready()
console.log('Local writer key:', base.local.key.toString('hex'))
```

**Peer 1 adds Peer 2 as a writer**:
```js
await base.append(JSON.stringify({
  type: 'add-writer',
  key: '<peer2-local-writer-key>',
  indexer: true,
}))
```

**Peer 2 waits for confirmation**:
```js
base.on('is-indexer', () => {
  console.log('I am now an indexer — can write and build the view')
})
```

### Step 6: Write and Read

```js
// Any writer can append
await base.append(JSON.stringify({
  type: 'put-item',
  id: 'item-1',
  name: 'Coffee',
  writerId: base.local.key.toString('hex').slice(0, 8),
}))

// Read from the view (same on all peers)
await base.update()
const entry = await base.view.get('item-1')
console.log(entry.value) // { name: 'Coffee', writerId: '...' }
```

### Step 7: Graceful Shutdown

```js
async function shutdown(swarm, base) {
  await swarm.destroy()
  await base.close()
}

process.on('SIGINT', () => shutdown(swarm, base))
```

## Idempotent Operations

Because Autobase may reorder operations when causal forks are discovered,
your `apply` function must handle operations arriving in any order.

```js
// BAD: assumes create happened before update
case 'update-item':
  const existing = await view.get(op.id)
  existing.value.name = op.name  // crashes if item doesn't exist yet
  await view.put(op.id, existing.value)
  break

// GOOD: idempotent upsert — works regardless of order
case 'put-item':
  await view.put(op.id, { name: op.name, updatedBy: op.writerId })
  break
```

**Rules for `apply`:**
1. Only modify the `view` — never external state
2. No `Date.now()`, `Math.random()`, or I/O
3. Use upserts, not create-then-update
4. Handle `null` values (ack nodes) — skip them

## Clients (Read-Only Peers)

Not all peers need to be writers. Clients can replicate just the view:

```js
const swarm = new Hyperswarm()
swarm.join(viewDiscoveryKey)
swarm.on('connection', (conn) => store.replicate(conn))

// Query the view like a regular Hyperbee
const result = await viewBee.get('item-1')
```

## Critical Rules

1. **`apply` must be deterministic** — same ops + same order = same view. No external state, no timestamps, no randomness
2. **Always set `extension: false`** on Hyperbee/HyperDB views — Autobase manages its own extensions
3. **Use idempotent operations** — operations may be reordered before the signed length. Never assume create-before-update
4. **Wait for `is-indexer` before writing** — after `addWriter`, the new peer must receive the event before appending
5. **Use odd numbers of indexers** (3, 5, 7) — even numbers can deadlock on quorum
6. **Set `ackInterval`** in production — without acks, the signed length never advances and peers can't fast-forward
7. **Don't use `base.append()` in the `apply` handler** — apply must only modify the view, not generate new operations
8. **Handle `null` node values** — these are ack nodes and must be skipped in `apply`

## Validation

1. [ ] First instance creates an Autobase and outputs its `base.key`
2. [ ] Second instance joins with the bootstrap key and connects via Hyperswarm
3. [ ] First instance adds second as a writer — second receives `is-indexer` event
4. [ ] Both writers append independently — view converges to same state
5. [ ] Offline writes work: disconnect one peer, write on both, reconnect — views merge
6. [ ] View is queryable: `base.view.get('key')` returns correct data on all peers
7. [ ] Restart preserves state: kill and restart peers — Autobase recovers from disk
8. [ ] `base.signedLength` advances as indexers ack
9. [ ] Read-only client can replicate and query the view without being a writer

## Troubleshooting

### Writer can append but view doesn't update
The writer may not be an indexer. Check `base.isIndexer`. If false, use
`host.addWriter(key, { indexer: true })` from an existing indexer.

### View is different on different peers
The `apply` function is non-deterministic. Check for `Date.now()`,
`Math.random()`, or external state reads. Apply must produce identical
output given identical input.

### Signed length stuck at 0
No quorum of indexers is acking. Ensure `ackInterval` is set and multiple
indexers are online and connected.

### "Cannot remove writer" error
The last indexer cannot be removed. Use `host.removeable(key)` to check
before calling `removeWriter`.

### Operations appear to be "lost" after reconnection
They may have been reordered. This is expected behavior before the signed
length. Check if the data appears in the view after `base.update()`.

## Deep Dive
- Hyperdispatch pattern for typed operations: read `resources/hyperdispatch-pattern.md`
- Full two-peer example: read `resources/full-example.md`

## Reference Apps

- `reference-apps/qvac-workbench-desktop/` — Uses Autobase for project/thread/settings
  sync between desktop and mobile. See `src/store/listeners/autobaseListener.ts` for
  the reactive UI update pattern.

> **Status**: Based on Autobase v7.27.3, QVAC registry patterns, and reference
> app analysis. The workbench desktop/mobile use Autobase in production for
> cross-device data sync.
