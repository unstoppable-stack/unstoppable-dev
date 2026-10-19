# Data between apps, without transport setup

`@unstoppable-stack/p2p/data` owns local storage, peer discovery, replication and
shutdown. Choose a single-writer collection for read-only mirrors, or the
experimental collaborative database for approved writers. Both expose JSON
`put`, `get` and `del`. These helpers require 0.6.0-alpha.2 or later.

## Run the examples

From a checkout, with Node 20+:

```sh
npm install --prefix packages/p2p
npm install --prefix examples/p2p-data
npm run mirror --prefix examples/p2p-data
npm run collaborate --prefix examples/p2p-data
```

The [complete examples](../../../examples/p2p-data/README.md) use two separate
app directories, real public discovery, bounded waits and cleanup. UDP network
access is needed for first sync. Existing local data works without other peers.
For your own app, install `@unstoppable-stack/p2p@0.6.0-alpha.2` with npm. Collaborative users also install `autobase@7.28.2` explicitly.

## One writer, read-only copies

App A:

```js
import { openCollection } from '@unstoppable-stack/p2p/data'
const notes = await openCollection({ storage: './notes' })
await notes.put('welcome', { text: 'Hello!' })
console.log({ key: notes.key, version: notes.version })
// Keep running while App B syncs. At shutdown: await notes.close()
```

App B receives the key and version through your app's sharing flow:

```js
import { openCollection } from '@unstoppable-stack/p2p/data'
const notes = await openCollection({ storage: './notes-copy', key })
await notes.sync({ version, timeoutMs: 10_000 })
console.log(await notes.get('welcome')) // { text: 'Hello!' }
await notes.close()
```

The library connects the peers. You do not construct a DHT, Corestore, Hyperbee,
swarm or resource manifest. `sync` downloads all blocks through the supplied
writer version, including history. It returns `{ scope: 'local-downloaded',
version }`. Obtain a new version and sync again to guarantee a later checkpoint;
this is not a subscription, automatic backup or remote durability receipt.
Reads use locally available blocks and fail rather than wait indefinitely for
missing data. Sync before reading a fresh replica. Missing entries return null
(the same result as a stored JSON null). Replicas cannot call put or del.

## Several writers

```js
import { openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'
const alice = await openCollaborativeDatabase({ storage: './alice' })
const bob = await openCollaborativeDatabase({ storage: './bob', key: alice.key })
await alice.members.add(bob.writerKey) // explicitly approve this writer
await bob.waitFor(state => state.writable)
await bob.put('welcome', { text: 'Hello from Bob!' })
// Both apps process incoming edits automatically. At shutdown:
await bob.close()
await alice.close()
```

This is a complete two-instance setup. In separate apps, share Alice's database
key with Bob, then verify Bob's writer key before admitting it on Alice's app.
See the runnable example for waiting until Alice observes a particular value.
`get` processes available incoming history and reads the local view; it does not wait for unseen remote writes. `update` processes currently available history; it
does not wait for every remote edit. `watch` reports local state changes and
returns an unsubscribe function. `waitFor` waits for a synchronous state
predicate with a timeout and optional AbortSignal.

The built-in reducer applies JSON replacements and deletes in Autobase order.
For concurrent writes to one key, the last operation in that deterministic
order wins; this is not wall-clock last-write-wins or character-level merging.
Do not mutate returned JSON expecting persistence: call put again. Operations
are limited to 64 KiB. App validation and custom merges belong in the advanced
[adapter API](db.md).

## Storage and lifecycle

Use a dedicated directory per dataset and device. Reopen with just `storage`:
the dataset key and kind are saved automatically. Passing a different key or
switching data API in the same directory is rejected. Do not delete the storage
if you need identity, write authority or offline data. `close()` is idempotent,
cancels collection waits and closes all owned resources. Failed startup cleans
up locks. No app-level replication listeners need cleanup.

Values must be JSON data; dates, undefined, nonfinite numbers and cycles are
rejected. Entry keys contain 1–1024 characters. `sync({ version, timeoutMs,
signal })` is cancellable, with a 10-second default and 120-second maximum.
For collaborative operations cancellation stops admission, not an already
appended write. Do not blindly replay mutations after a failure.

## Sharing and experimental boundaries

Dataset keys are read capabilities, not RPC invitations or row-level ACLs.
Share them only with intended readers. These helpers use dataset discovery;
RPC pairing and grant revocation do not control this replication. A collection
key never grants write authority. A collaborative reader needs explicit
`members.add(writerKey)` from the founder to write. Only the founder can add or
remove members. Removal takes effect as history propagates and cannot erase
copies already downloaded.

Collaborative databases remain experimental: the founder is the sole indexer,
so stable progress can depend on it returning online. `put`/`del` return
local-applied receipts, not proof of remote durability. Optional `encryptionKey`
must be supplied consistently on every open; it is not stored for you. Lost
admin recovery, key rotation, schema migration and complete backup are not
provided. Local integration tests do not establish production or Bare acceptance.

## When to use advanced APIs

- `/sync`: mirror existing cores, databases or drives to a host using owned
  manifests and protection status. It does not mirror an Autobase graph.
- `/db`: use your own deterministic reducer, view, store and shared node.
- `/service`: call remote business methods instead of copying datasets.

The convenience entry is native-runtime code. Keep it in Node or a Bare sidecar,
not a browser renderer. Advanced `nodeOptions` allow custom swarm configuration
(for example isolated test bootstraps); ordinary apps need no DHT setup.

## Public discovery and two-device use

Local open never waits for internet access. Before advertising a host's key, use
`await data.network.ready({ timeoutMs: 60000, signal })` to wait for its first
successful DHT announcement. The same API exists on collections and collaborative
databases. It does not prove a peer has connected or received data.

`data.network.status()` returns `{ closed, announced, connections, dhtPeers }`.
`announced` means this session has announced successfully at least once. Discovery
retries with backoff while disconnected, including when the other app starts
later. Timeouts carry code `DATA_NETWORK_TIMEOUT` and a `network` snapshot;
they distinguish unreachable DHT nodes, missing peers, and connected peers
without the requested data or approval. Abort and close still cancel waits.

The [two-device commands](../../../examples/p2p-data/README.md#use-two-devices)
keep the host alive, retain data on disk, and show exactly which key/version or
writer approval to exchange. They also describe UDP/network troubleshooting.
Public bootstrap DNS resolution alone is not a connectivity test. A blocked
UDP path needs a permitted network or network policy correction; extending
timeouts cannot make blocked traffic work. No HTTP/WebSocket fallback is built in.
