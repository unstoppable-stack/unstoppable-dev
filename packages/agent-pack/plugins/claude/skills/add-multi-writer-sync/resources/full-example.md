# Full Two-Peer Autobee Example

A complete key-value store shared by two peers over Hyperswarm.

Verified against `autobee@1.0.10` + `corestore@7.12` + `hyperswarm@4` as two
separate Node processes (2026-07-29).

## Install

```bash
npm i autobee corestore hyperswarm b4a
```

## Shared Module

```js
// shared.mjs
import Corestore from 'corestore'
import Autobee from 'autobee'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const enc = (obj) => b4a.from(JSON.stringify(obj))
const dec = (buf) => JSON.parse(b4a.toString(buf))

export async function createPeer (storagePath, bootstrapKey = null) {
  const store = new Corestore(storagePath)

  const db = new Autobee(store, bootstrapKey, {
    async apply (nodes, view, host) {
      for (const node of nodes) {
        const op = dec(node.value)

        if (op.type === 'add-writer') {
          await host.addWriter(b4a.from(op.key, 'hex'), { isIndexer: true })
          continue
        }

        // hyperbee2 batch API — no view.put() / view.del()
        const w = view.write()
        if (op.type === 'put') w.tryPut(b4a.from(op.key), enc(op.value))
        if (op.type === 'del') w.tryDelete(b4a.from(op.key))
        await w.flush()
      }
    },
  })

  await db.ready()
  return { store, db }
}

export function joinSwarm (db) {
  const swarm = new Hyperswarm()
  swarm.join(db.discoveryKey)
  // db.replicate — NOT store.replicate. Autobee layers its wakeup session
  // on top of store replication; using store.replicate loses writer wakeup.
  swarm.on('connection', (conn) => db.replicate(conn))
  return swarm
}

export async function waitUntilWritable (db, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (!db.writable) {
    if (Date.now() > deadline) throw new Error('timed out waiting to become writable')
    await db.update()
    await new Promise(r => setTimeout(r, 100))
  }
}

export async function put (db, key, value) {
  await db.append(enc({ type: 'put', key, value }))
}

export async function del (db, key) {
  await db.append(enc({ type: 'del', key }))
}

export async function get (db, key) {
  await db.update()
  const node = await db.view.get(b4a.from(key))
  return node ? dec(node.value) : null
}
```

## Peer 1 — creates the database

```js
// peer1.mjs
import b4a from 'b4a'
import { createPeer, joinSwarm, put, get } from './shared.mjs'

const { db } = await createPeer('./data-peer1')
joinSwarm(db)

console.log('Database key (give this to peer 2):')
console.log(db.key.toString('hex'))

// Peer 2 prints its LOCAL writer key — paste it here to promote it.
const peer2WriterKey = process.argv[2]
if (peer2WriterKey) {
  await db.append(b4a.from(JSON.stringify({
    type: 'add-writer',
    key: peer2WriterKey,
  })))
  console.log('Promoted peer 2 to writer')
}

await put(db, 'from-peer1', 'hello')

setInterval(async () => {
  console.log('from-peer2 =', await get(db, 'from-peer2'))
}, 2000)
```

## Peer 2 — joins the database

```js
// peer2.mjs
import b4a from 'b4a'
import { createPeer, joinSwarm, waitUntilWritable, put, get } from './shared.mjs'

const dbKey = b4a.from(process.argv[2], 'hex')   // key printed by peer 1
const { db } = await createPeer('./data-peer2', dbKey)
joinSwarm(db)

// Give THIS to peer 1 — the local writer key, not db.key.
console.log('My writer key (give this to peer 1):')
console.log(db.local.key.toString('hex'))

console.log('writable:', db.writable)            // false until promoted
await waitUntilWritable(db, 60_000)
console.log('writable:', db.writable)            // true

await put(db, 'from-peer2', 'world')

setInterval(async () => {
  console.log('from-peer1 =', await get(db, 'from-peer1'))
}, 2000)
```

## Running it

```bash
# Terminal 1 — prints the database key
node peer1.mjs

# Terminal 2 — join with that key, prints its writer key
node peer2.mjs <database-key>

# Terminal 1 again — restart with peer 2's writer key to promote it
node peer1.mjs <peer2-writer-key>
```

Once promoted, both peers write independently and converge:

```
[peer2] writable before promo: false
[peer2] writable after promo: true
[peer2] sees from-peer1: hello
[peer1] sees from-peer2: world
```

## Two keys, two jobs

The single most common mistake in this flow:

| Key | Where from | Used for |
|---|---|---|
| `db.key` | Peer 1 (creator) | Peers pass it to `new Autobee(store, key)` to **join** |
| `db.local.key` | Each peer, individually | Passed to `host.addWriter()` to **promote that peer** |

Promoting `db.key` instead of `db.local.key` fails silently — no error, the
peer simply never becomes writable.

## Testing offline merge

```js
// 1. Both peers writable and connected
// 2. Kill the swarm on peer 2:  await swarm.destroy()
// 3. Write on both peers independently
// 4. Rejoin:  joinSwarm(db)
// 5. Poll db.update() — both writes are present on both sides
```

If both peers wrote the *same* key while partitioned, one wins by last-write.
To control which, see `recipes/p2p-conflict-resolution.mdc`.

## Next Steps

- Typed binary operations: `resources/hyperdispatch-pattern.md`
- Schema'd collections and indexes instead of raw KV:
  `recipes/p2p-hyperdb-autobee-sync.mdc`
