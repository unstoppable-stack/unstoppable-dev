# Experimental collaborative database adapter

For a simpler JSON API with managed storage and discovery, start with the
[data guide](data.md). This page covers advanced composition.

`@unstoppable-stack/p2p/db` connects an application-owned database view to
Autobase. Devices can write locally, exchange their writer logs and derive the
same view after reconnecting. It is an experimental integration, separate from
the existing Autobee scaffold; it does not migrate that scaffold or replace
its database format.

This API targets the unpublished `0.6.0-alpha.2` candidate; it is not in
published alpha.1. Run the [collaborative notes example](../../../examples/p2p-database/README.md)
for admission, offline edits, restart, convergence and removal.

The current acceptance runs under Node. Bare, packaged desktop and mobile
acceptance for this adapter have not been established.

After alpha.2 publication, install the optional engine explicitly. Until then,
use the source example or a candidate tarball:

```sh
npm install @unstoppable-stack/p2p@0.6.0-alpha.2 autobase@7.28.2 corestore hyperbee
```

The ordinary P2P entry point does not import Autobase. The engine is loaded only
when `openDatabase` is called. The examples below assume a ready P2P node and
a dedicated Corestore or Corestore namespace for this database.

## Open a local database

```js
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { autobaseAdapter, openDatabase } from '@unstoppable-stack/p2p/db'

const adapter = autobaseAdapter({
  // Synchronous: use only cores supplied by Autobase's view store.
  openView(views) {
    return new Hyperbee(views.get('notes'), {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
  },
  validate(op) {
    return op?.type === 'note.put' &&
      typeof op.id === 'string' && op.id.length <= 200 &&
      typeof op.text === 'string'
  },
  async apply(op, view, { writerKey }) {
    await view.put(op.id, { text: op.text, author: writerKey })
  }
})

const store = new Corestore('./notes-storage')
const db = await openDatabase({ node, store, adapter })

const receipt = await db.append({ type: 'note.put', id: 'one', text: 'Works offline' })
console.log(receipt.scope) // 'local-applied'
console.log((await db.view.get('one')).value)
```

Schemas, queries, domain permissions and merge decisions belong to the app.
Only `apply` may mutate the derived view. `openView`, `validate` and `apply`
must behave deterministically on every device: no clocks, random values,
external writes, network requests or user interaction inside the reducer.
Autobase may undo and replay provisional operations when new history arrives.

The example uses ordered replacement for a note. Autobase supplies a common
ordering; the application must still choose how concurrent edits, deletion,
uniqueness and duplicate commands should behave. Rich text, counters and
financial records need their own domain rules.

## Join and grant a writer

Share the database key with another device through an application-approved
flow. Pairing devices at the P2P layer does not make the new device a database
writer.

```js
const reader = await openDatabase({
  node: anotherNode,
  store: anotherStore,
  adapter,
  key: db.key
})

// Run this on the founding device after approving the intended writer key.
await db.members.add(reader.writerKey)
await reader.waitFor(state => state.writable, { timeoutMs: 10_000 })
await reader.append({ type: 'note.put', id: 'two', text: 'From another device' })
```

`db.key` identifies the dataset. `db.writerKey` identifies this device's input
log. Neither is the device's P2P pairing key. Reader devices can query received
data but cannot append until admitted.

Only the founding database writer can add or remove writers. That rule is
checked both before a local membership request and against the authenticated
writer when processing replicated membership operations. Newly admitted writers
are non-indexers: they can write, but do not acquire membership administration
or join Autobase's indexing quorum. The prototype does not expose indexer
changes, administrator recovery or administrator transfer.

```js
await db.members.remove(reader.writerKey)
```

An offline device learns its removal after synchronization. Until then it may
still append locally; acceptance of concurrent history follows Autobase's
causal membership ordering. Removal does not erase downloaded history, revoke
a leaked encryption key or recover a lost founding device.

## Understand progress

| API | Meaning |
| --- | --- |
| `append(op)` | Appends an admitted local operation and updates the local view; returns a `local-applied` receipt |
| `update()` | Processes currently available data; does not wait for all peers or promise global convergence |
| `state()` | Reports local writability, indexer role, local writer length, last engine error and system checkpoint |
| `watch(callback)` | Receives local state updates; returns an unsubscribe function |
| `waitFor(predicate, options)` | Waits for a state predicate, with timeout, cancellation and close rejection |
| `close()` | Releases the adapter's discovery lease, listeners, views and child Corestore session |

The checkpoint's `scope` is `autobase-system`. Its key, fork, length and
`signedLength` describe Autobase's system ordering. A signed checkpoint is not
proof that another device retained every application resource. A local append
receipt is not a replicated, durable-host or globally confirmed receipt.

With one founding indexer, non-indexer devices can append while disconnected,
but stable checkpoint advancement depends on that indexer becoming available.
The prototype does not offer a global caught-up flag or an availability SLA.

Operations are JSON encoded, versioned and limited to 64 KiB per envelope.
Local invalid operations fail before append. Invalid received operations are
ignored deterministically. Application reducers must not throw for valid
historical operations. Schema migrations and incompatible engine/view upgrades
require an explicit application plan; this prototype does not automate them.

## Networking and cleanup

The adapter uses Autobase's replication function, including its wakeup protocol,
on existing and future P2P swarm connections. It owns an independent discovery
lease for the dataset, so closing it does not leave other users' discovery
sessions. Set `discovery: false` if the application supplies its own peer
selection; existing connections still carry replication.

P2P capability grants protect capability calls. Database replication uses
Hypercore/Autobase key and encryption semantics; it does not implement per-row
RPC permissions. Anyone given the necessary dataset/encryption material may
retain data. Keep private per-device records outside the replicated view.

Pass a 32-byte `encryptionKey` to every authorized reader/writer to encrypt the
database. The key must travel through an authenticated, confidential application
flow. This prototype does not distribute, rotate or back up that secret.

```js
const controller = new AbortController()
const wait = db.waitFor(state => state.writable, {
  signal: controller.signal,
  timeoutMs: 5_000
})
controller.abort()
await wait.catch(() => {})

await db.close()
await store.close()
```

Signals on opening, appending and updating stop admission when already aborted.
They cannot erase an immutable append once it has started. Wait cancellation is
active throughout the wait. Database close rejects pending waits and preserves
the caller's root Corestore and shared P2P sockets. Close databases before their
P2P node and store. The default view cleanup calls `view.close()`; supply
`closeView` for composite application views.

## Acceptance boundary

Real Autobase tests cover peerless local use; offline edits and conflict
convergence on reconnect; writer admission/removal and delegated administration
refusal; forged membership and malformed input from a real delegated writer
log; encrypted fresh-reader reconstruction from a retained replica; and
replication multiplexed over an existing paired P2P connection while RPC remains
usable. Tests also cover bounded/invalid operations, wait cancellation, close
idempotency, independent discovery leases and caller-store lifetime.

Fresh-reader reconstruction uses known dataset and encryption keys and a retained
record. It does not recover the founding writer's secret authority, prove full
historical backup, or supply resource retention, purge, disaster recovery,
row-level ACLs or schema migration. `/sync` still does not register an Autobase
resource graph, and the multi-writer + Personal Node sync scaffold combination
remains unavailable.
