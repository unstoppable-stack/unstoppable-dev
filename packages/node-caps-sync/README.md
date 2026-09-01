# @unstoppable-stack/node-caps-sync

> Data and file replication as a capability pack for
> [`@unstoppable-stack/node-core`](https://www.npmjs.com/package/@unstoppable-stack/node-core).

Replicates a peer's Hypercores, Hyperbees and Hyperdrives and keeps seeding
them after that peer disconnects. This is the pack that carries the storage
stack — core stays free of it, so apps that only want app-to-app RPC install
none of this.

## Install

```bash
npm install @unstoppable-stack/node-core @unstoppable-stack/node-caps-sync
```

## Usage

```js
import { createNode } from '@unstoppable-stack/node-core'
import { syncPack } from '@unstoppable-stack/node-caps-sync'

const node = createNode({
  storage: './.my-node',
  capabilities: [syncPack({ storage: './.my-node/store' })]
})

await node.listen()
```

Pass an existing `store` instead of a `storage` path when the host app already
has a Corestore — the pack will not close a store it does not own.

From a peer:

```js
const peer = await app.connect(nodePublicKey)

await peer.call('sync', 'manifest.replace', {
  manifest: {
    schemaVersion: 1,
    resources: [
      { id: 'data', kind: 'hyperbee', key: hex, name: 'Data', protection: { mode: 'mirror' } },
      { id: 'files', kind: 'hyperdrive', key: hex, name: 'Files', protection: { mode: 'mirror' } }
    ]
  }
})

const { cores, drives } = await peer.call('sync', 'status')
const { bytes } = await peer.call('sync', 'usage')
```

## Methods

| Method | Granted by default | Purpose |
| --- | --- | --- |
| `manifest.replace` | yes | Replace the caller's complete resource set |
| `status` | yes | The caller's resources and protection state |
| `usage` | yes | The caller's logical replicated bytes |
| `pause` / `resume` | yes | Suspend or resume the caller's replication |
| `peek.core` / `peek.drive` | **no** | Debug reads; must be requested explicitly |

## Scoping

Ownership is keyed by **peer public key**, not appId — two devices running the
same app are two peers with two resource sets. Every method is scoped to the
caller: a peer cannot see, touch, or account for another peer's resources, and
`usage` reports logical replicated bytes rather than the node's disk footprint
or storage path.

## The manifest is the complete set

`manifest.replace` is a replace, not a merge: resources absent from the new
manifest are dropped and stop replicating. Manifests are persisted, so a node
restores replication on restart without the owning app ever reconnecting —
which is the point of a node.

## Transport

The pack calls `store.replicate(socket)` on every swarm connection. For a
paired peer that rides the *same* connection as control traffic, because
node-core publishes its Protomux at `noiseStream.userData` where Corestore
looks for it. Connections discovered through a resource's discovery key — third
parties seeding the same data — are ordinary swarm connections with no control
channel, and replicate through the same call.

## Tests

```bash
npm test
```

Spins up a local DHT bootstrapper; the suite exercises real replication over a
paired connection.

## License

MIT
