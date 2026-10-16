# @unstoppable-stack/p2p/sync

> **Release status:** `/sync` is available in published P2P `0.6.0-alpha.1`;
> this source reference includes the `0.6.0-alpha.2` correctness fixes.
> Replication is not a complete or independently verified backup.

> Data and file replication as a capability pack for
> [`@unstoppable-stack/p2p`](https://www.npmjs.com/package/@unstoppable-stack/p2p).

Replicates a peer's Hypercores, Hyperbees and Hyperdrives and keeps seeding
them after that peer disconnects. Replication is a subpath of the P2P package,
not a separately installed or versioned package. The root entry does not load
this module, although npm installs its storage dependencies.

## Install

For the existing published API:

```bash
npm install @unstoppable-stack/p2p@0.6.0-alpha.1
```

Until then, use a locally packed tarball. The repository's P2P notes example
exercises this module with actual data and offline replica restart.

## Usage

```js
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'

const node = createNode({
  storage: './.my-node',
  capabilities: [syncPack({ storage: './.my-node/store' })]
})

await node.listen()
const invite = await node.createInvite({
  grants: { sync: ['manifest.replace', 'status', 'usage'] },
  uses: 1
})
console.log(invite.code)
```

Pass an existing `store` instead of a `storage` path when the host app already
has a Corestore — the pack will not close a store it does not own.

From an app that exposes its data for replication, for example by attaching
`syncPack({ store: appStore })` to its own node, redeem the shared invitation.
Use each resource's actual core key in the manifest:

```js
const peer = await app.pair(inviteCode)

await peer.call('sync', 'manifest.replace', {
  manifest: {
    schemaVersion: 1,
    resources: [
      { id: 'data', kind: 'hyperbee', key: dataCoreKey, name: 'Data', protection: { mode: 'mirror' } },
      { id: 'files', kind: 'hyperdrive', key: driveCoreKey, name: 'Files', protection: { mode: 'mirror' } }
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

Replacement preflights ownership conflicts and stages new handles before
committing durable intent. Failed replacements attempt to restore both the old
manifest and live resource set; failed recovery is reported explicitly. A host
replays durable intent after restart. Each resource key currently has one
registering peer; collaborative database ACLs are not inferred from key possession.

### Manifest contract and protection

`schemaVersion` must be `1`; a manifest accepts at most 128 resources. Each
resource requires a unique safe `id` (1–200 characters), a supported `kind`, a
unique 32-byte hex `key` and a `name` (1–200 characters). Optional `metadata`
contains up to 32 string entries with bounded keys/values. Validation normalizes
these fields; the older proposed encoding, redaction and file-policy fields
are not an implemented contract. See [the validator](../src/sync/resource-manifest.js).

`protection.mode` defaults to `metadata-only`, which does not promise all payload
blocks. Set `mirror` to request a full replica of the observed core length or
drive version. Status distinguishes pending, syncing, protected and error;
`protected` means a locally checked checkpoint, not a promise about future
writes, independent restore testing or an encrypted backup archive. Replicate
the resource before reading payloads from a restored app.

Replacing the manifest with an empty resource list unregisters the caller's
resources. This stops active replication; it is not a secure disk purge.
Pause/resume currently applies to the calling peer's resource set, not a
selected resource. `peek` methods are bounded diagnostics, not a general
database query or file download API. Dedicated file reads, ranges, selective
path policies and restore planning remain in the [roadmap](roadmap.md).

Pause intent now persists across restart, including operator/quota pause through
Personal Node. Its explicit scope is `discovery-and-mirroring`: it stops that
resource's discovery and requested mirror downloads. Existing Corestore
replication channels may still transfer data. `status.pauseScope` and
pause/resume result `scope` state that boundary; this is not a full transport
upload/download suspension or a hard disk quota.

Hosts may pass `admit(ownerKey)` to `syncPack` to enforce their policy before
manifest replacement and resume. Personal Node supplies quota admission; the
library does not impose a universal app storage policy.

## Transport

The pack calls `store.replicate(socket)` on every swarm connection. For a
paired peer that rides the *same* connection as control traffic, because
P2P runtime publishes its Protomux at `noiseStream.userData` where Corestore
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
