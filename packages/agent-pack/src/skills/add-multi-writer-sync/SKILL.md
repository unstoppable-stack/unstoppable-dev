---
name: add-multi-writer-sync
description: Managed collaborative JSON data, or advanced Autobee integration for existing schema-based stores.
when_to_use: Multiple peers or devices need to write to the same database and converge.
paths: ["src/p2p/**", "src/data/**"]
version: "2026-07-29"
---

# Add Multi-Writer Sync

## When to Use
- User wants multiple peers to write to the same database simultaneously
- User mentions "collaborative", "multi-writer", "multi-device sync", or "shared editing"
- User needs offline-first writes that merge when peers reconnect
- Availability requirements need separate validation; managed collaboration has one founder/indexer and is not automatic failover

> **Not this skill?** If only ONE peer writes and others read, use
> `add-p2p-sync` instead (single-writer Hypercore replication).

## Choose the data model first

For a new JSON key-value dataset, prefer `openCollaborativeDatabase` from
`@unstoppable-stack/p2p/data` (alpha.2 or later) with explicit `autobase@7.28.2`
opt-in. Read `modules/managed-data.mdc`. The helper owns discovery and storage;
only the founder admits verified writer keys. This is experimental and does not
provide lost-admin recovery, text merging or complete backup. No separate
networking setup is required for this path.

For an existing generated Autobee/HyperDB schema store, preserve that engine and
use the advanced instructions below. Autobee and Autobase are different engines;
do not mix their view APIs, reinterpret old storage, or migrate silently.

## Advanced existing Autobee stores only

The rest of this document applies only to an existing/custom Autobee store, not
the managed `/data` or `/db` APIs. Do not install a second transport or migrate
an existing format implicitly.

## Prerequisites
- Existing Hyperswarm and Corestore owners (reuse them)
- Node.js or Bare runtime
- Understanding of append-only logs (Hypercore)

## Architecture Overview

Each peer appends to its own local Hypercore. Autobee merges those writes into
a shared Hyperbee view via your `apply` function. Once peers replicate, every
peer's view is identical.

```
┌─── Writer A ──────┐  ┌─── Writer B ──────┐  ┌─── Writer C ──────┐
│ append(op1)        │  │ append(op2)        │  │ append(op3)        │
│ append(op4)        │  │ append(op5)        │  │                    │
└────────┬───────────┘  └────────┬───────────┘  └────────┬───────────┘
         │                       │                       │
         └───────────┬───────────┴───────────────────────┘
                     │
              ┌──────▼───────┐
              │  apply()     │   Your reducer — deterministic
              └──────┬───────┘
                     │
              ┌──────▼───────┐
              │  view        │   Hyperbee — same on all peers
              └──────────────┘
```

## Steps

### Step 1: Install Dependencies

```bash
npm i autobee corestore hyperswarm b4a
```

> Autobee is marked **experimental, expect breaking changes** upstream. Pin an
> exact version rather than a caret range.

### Step 2: Define Your Operations

Each operation is a value appended to a writer core and merged by `apply`.

```js
await db.append(b4a.from(JSON.stringify({ type: 'put-item', id: '123', name: 'Test' })))
```

For production apps, use Hyperdispatch for typed binary encoding — see
`resources/hyperdispatch-pattern.md`.

Design operations so concurrent writers do not clobber each other. Prefer
targeted ops (`add-reaction`) over whole-document upserts when two devices can
append to the same collection at once. See
`recipes/p2p-hyperdb-autobee-sync.mdc`.

### Step 3: Create the Autobee

```js
import Autobee from 'autobee'
import Corestore from 'corestore'
import b4a from 'b4a'

function createDb (storagePath, bootstrapKey = null) {
  const store = new Corestore(storagePath)

  const db = new Autobee(store, bootstrapKey, {
    async apply (nodes, view, host) {
      for (const node of nodes) {
        const op = JSON.parse(b4a.toString(node.value))

        switch (op.type) {
          case 'add-writer':
            // NOTE: `isIndexer` (not `indexer`). Defaults to true.
            await host.addWriter(b4a.from(op.key, 'hex'), { isIndexer: true })
            break

          case 'put-item': {
            // hyperbee2 batch API — there is no view.put()
            const w = view.write()
            w.tryPut(b4a.from(op.id), b4a.from(JSON.stringify({ name: op.name })))
            await w.flush()
            break
          }
        }
      }
    },
  })

  return { store, db }
}
```

### Step 4: Wire Up Replication

```js
import Hyperswarm from 'hyperswarm'

async function startReplication (db) {
  await db.ready()

  const swarm = new Hyperswarm()
  swarm.join(db.discoveryKey)
  // Autobee's replicate() is store-level replication PLUS its wakeup session.
  // Do not call store.replicate(conn) here instead — you lose writer wakeup.
  swarm.on('connection', (conn) => db.replicate(conn))

  return swarm
}
```

### Step 5: Bootstrap Multi-Writer

**First instance** (creates the database):
```js
const { db } = createDb('./data-peer1')
await db.ready()
console.log('Database key:', db.key.toString('hex'))       // peers join with this
console.log('Local writer key:', db.local.key.toString('hex'))
```

**Second instance** (joins):
```js
const { db } = createDb('./data-peer2', b4a.from('<database-key>', 'hex'))
await db.ready()
console.log('writable:', db.writable)                       // false — not yet promoted
console.log('Local writer key:', db.local.key.toString('hex'))
```

**Peer 1 promotes Peer 2**:
```js
await db.append(b4a.from(JSON.stringify({
  type: 'add-writer',
  key: '<peer2-LOCAL-writer-key>',
})))
```

> `db.local.key` is the **writer** key — that is what `addWriter` takes.
> `db.key` is the **database** key that peers join with. Passing `db.key` to
> `addWriter` silently does nothing.

**Peer 2 waits to become writable.** Autobee has no `is-indexer` event; poll
`db.writable`, optionally driven by the `'update'` event:

```js
while (!db.writable) {
  await db.update()
  await new Promise(r => setTimeout(r, 100))
}
```

### Step 6: Write and Read

```js
await db.append(b4a.from(JSON.stringify({ type: 'put-item', id: 'item-1', name: 'Coffee' })))

await db.update()
const node = await db.view.get(b4a.from('item-1'))   // keys are Buffers
console.log(JSON.parse(b4a.toString(node.value)))
```

### Step 7: Graceful Shutdown

```js
async function shutdown (swarm, db) {
  await swarm.destroy()
  await db.close()
}
```

## Idempotent Operations

Autobee may reorder operations when causal forks are discovered, so `apply`
must handle operations arriving in any order.

```js
// BAD — assumes create happened before update
case 'update-item': {
  const existing = await view.get(b4a.from(op.id))
  const val = JSON.parse(b4a.toString(existing.value))   // throws if absent
  ...
}

// GOOD — idempotent upsert, order-independent
case 'put-item': {
  const w = view.write()
  w.tryPut(b4a.from(op.id), b4a.from(JSON.stringify({ name: op.name })))
  await w.flush()
  break
}
```

**Rules for `apply`:**
1. Only modify the `view` — never external state
2. No `Date.now()`, `Math.random()`, or I/O
3. Use upserts, not create-then-update
4. Never call `db.append()` from inside `apply`

## Critical Rules

1. **`apply` must be deterministic** — same ops + same order = same view
2. **`open` must be synchronous** — Autobee assigns `view = open(bee)` without awaiting
3. **Buffer keys and values** — `view.get()` / `tryPut()` do not take strings
4. **Use `view.write()` batches** — `w.tryPut(...)` then `await w.flush()`
5. **Gate writes on `db.writable`** — a joining peer is read-only until promoted
6. **`db.local.key` ≠ `db.key`** — see above
7. **Call `db.update()` after replication** — data arriving does not by itself advance the view
8. **Use odd numbers of indexers** (3, 5, 7) — even counts can deadlock on quorum
9. **Timestamps do not order writes across devices** — see `recipes/p2p-conflict-resolution.mdc`

## Validation

1. [ ] First instance creates a database and outputs its `db.key`
2. [ ] Second instance joins with that key and connects via Hyperswarm
3. [ ] Second instance reports `writable === false` before promotion
4. [ ] First instance appends `add-writer` with the second's **local** key
5. [ ] Second instance flips to `writable === true`
6. [ ] Both writers append independently — views converge to the same state
7. [ ] Offline writes work: disconnect, write on both, reconnect — views merge
8. [ ] Restart preserves state — Autobee recovers from disk
9. [ ] Read-only peer can replicate and query without being a writer

## Troubleshooting

### Second peer never becomes writable
Check you passed `db.local.key` (the writer key), not `db.key`. Confirm the
peers are actually connected, and that you are calling `db.update()` in the
wait loop.

### View is different on different peers
`apply` is non-deterministic. Check for `Date.now()`, `Math.random()`, or
external state reads.

### `view.put is not a function`
You are using the Hyperbee v1 API. Autobee's view is hyperbee2: use
`const w = view.write(); w.tryPut(k, v); await w.flush()`.

### Writes vanish under concurrency
Two devices are upserting the same document. Model the change as a targeted,
merge-by-id operation instead. See `recipes/p2p-hyperdb-autobee-sync.mdc`.

### Nothing replicates
You called `store.replicate(conn)` instead of `db.replicate(conn)`. Autobee's
replicate adds its wakeup session on top of store replication.

## Deep Dive
- Hyperdispatch pattern for typed operations: read `resources/hyperdispatch-pattern.md`
- Full two-peer example: read `resources/full-example.md`
- Schema'd collections and indexes: `recipes/p2p-hyperdb-autobee-sync.mdc`
- Which write wins: `recipes/p2p-conflict-resolution.mdc`

## Runtime boundaries

The runnable `examples/p2p-database` in the source repository exercises the P2P
Autobase adapter, not this legacy Autobee API. Do not use that evidence to claim
Autobee, packaged Bare or mobile acceptance. Read the installed app's tests and
version-matched engine docs for its actual contract.

> **Status**: Verified against `autobee@1.0.10` (2026-07-29) with a live
> two-writer convergence test. Upstream marks Autobee experimental.
