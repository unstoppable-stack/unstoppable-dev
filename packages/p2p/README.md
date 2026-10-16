# @unstoppable-stack/p2p

> **Release status:** `0.6.0-alpha.1` is published. This source prepares
> `0.6.0-alpha.2`, adding `/rpc`, `/db`, types and correctness fixes.
> Those additions are not in alpha.1. Preparation and tests are separate from
> publication and production acceptance; all P2P APIs remain experimental.

> Symmetric P2P node runtime for the [Unstoppable Stack](https://unstoppable-stack.dev) —
> identity, pairing, and a capability bus for apps that act as nodes.

One runtime, two verbs. `listen()` accepts pair requests, `connect()` dials a
known peer. A process may do either, both, or neither — so "an app that acts
like a node" is a configuration, not a different class.

One package provides capability calls and optional replication. The root entry
does not load the storage implementation; import `@unstoppable-stack/p2p/sync`
to enable it. npm installs the storage dependencies with the package either way.
QVAC and wallet SDKs remain upstream dependencies of the apps that use them.

```sh
npm install @unstoppable-stack/p2p@0.6.0-alpha.1
```

```js
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'
```

See [replication](docs/sync.md) for resource manifests and permissions. Delegated
AI is an internal adapter in Personal Node, not part of this library.

See the [documentation index](docs/README.md), [runtime API](docs/api.md) and
[capability inventory and roadmap](docs/roadmap.md) for the complete shared
surface and the distinction between implemented methods and planned services.

The optional [typed RPC layer](docs/rpc.md) adds schema-backed procedures and
inferred clients over the same transport. The [database prototype](docs/db.md)
integrates a separately installed, pinned Autobase engine; it is experimental
and does not remove the collaborative-database backup acceptance gates.

## Install

For the existing published API, install the explicit preview version:

```bash
npm install @unstoppable-stack/p2p@0.6.0-alpha.1
```

Until then, consume a locally packed tarball. The repository's P2P notes example
tests invited calls, streaming and replication through an offline replica
restart, including an isolated install of the release tarball. Release
preparation records exact hashes and publishes this candidate to `alpha`,
never implicitly to `latest`.

Node consumers require Node 20 or newer. Fresh npm dependency resolution on Bare
requires Bare 1.32 or newer; installed-artifact acceptance was run with the desktop
sidecar's Bare 1.34.1. A locked older source dependency tree working on an older
global Bare runtime does not establish fresh-install compatibility.

## Usage

```js
import { createNode } from '@unstoppable-stack/p2p'

const node = createNode({
  storage: './.my-notes',                       // identity + peers persist here
  profile: { appId: 'my-notes', appName: 'My Notes', deviceName: 'laptop' },
  capabilities: [notesPack({ db })]
})

await node.listen()
const invite = await node.createInvite({
  grants: { notes: ['search', 'watch'] },
  uses: 1
})
console.log(invite.code)     // share with the intended peer
```

Another app pairs with it and calls the capability:

```js
const peer = await other.pair(inviteCode) // the code shared by the host
const { hits } = await peer.api.notes.search({ q: 'coffee' })

for await (const change of peer.api.notes.watch({ prefix: 'a' })) {
  console.log(change)
}
```

`peer.api` is built from what the far side advertised in its handshake, so it
only exposes methods that actually exist and a typo fails locally instead of
becoming a round trip. Each handle is a promise that is also an async
iterable — await it for a unary method, iterate it for a streaming one.
`peer.call()` and `peer.stream()` are the explicit equivalents.

Both directions work over the same connection: once paired, the host holds a
`Peer` for the joiner and can call *its* capabilities too.

## Capability packs

A pack is a plain object. Unary methods are async functions; streaming methods
are async generators — that difference is the whole of the distinction.

```js
export function notesPack ({ db }) {
  return {
    name: 'notes',
    version: 1,
    methods: {
      search: async (params, ctx) => ({ hits: await db.search(params.q) }),
      watch: async function * (params, ctx) {
        for await (const change of db.watch(params.prefix, { signal: ctx.signal })) {
          yield change
        }
      }
    },
    defaultGrants: ['search'],      // 'watch' must be asked for explicitly
    async onAttach (node) {},
    async onPeer (peer) {},
    async onDetach () {}
  }
}
```

`ctx` is `{ peer, appId, grants, signal }`. `signal` aborts when the peer
disconnects, cancels, or the consumer breaks out of the stream early.

## Grants

Grants are **per direction**: each side decides what the other may call.

- A joiner that asks for nothing receives the host packs' `defaultGrants`.
- A joiner that asks receives only the intersection of what it asked for and
  what the host actually hosts.
- An ungranted call is rejected with `NOT_GRANTED` *before* method resolution,
  so a peer cannot enumerate capabilities by reading error codes.

After the initial invitation or operator approval, reconnect by the known key:

```js
const peer = await node.connect(key, { requested: { notes: ['search'] } })
```

To call back into a joiner, declare what you want at construction:

```js
createNode({ …, pairing: { request: { photos: ['thumbnail'] } } })
```

## Pairing approval

Without an `approve` callback a host denies direct pairing. Use a scoped invitation, an explicit approval callback, or the deliberate development option `pairing: { autoApprove: true }`. An outgoing connection authorizes its chosen remote key. With a callback, direct/network reconnects consult it again:

```js
createNode({
  …,
  pairing: {
    approve: async ({ publicKey, profile, requested }) =>
      (await promptUser(profile)) ? 'approve-remember' : 'deny'
  }
})
```

Return `'approve'`, `'approve-remember'`, `'deny'`, or any other string as a
denial reason. Remembering approval is owned by the caller’s trust gate. Peers paired through an invitation can reconnect using their persisted grants. Reconnects intersect requested methods with the stored ceiling; they cannot restore removed grants. `unpair(key)` now stores a persistent denial. To authorize a fresh pairing after revocation, call `peerRegistry.forgetDenial(key)` locally. Invites without explicit grants carry only the pack defaults, never arbitrary methods requested by the redeemer.

## Identity

A node's key pair is derived from a seed persisted in `storage/identity.json`
and is stable across restarts — it is what peers dial, what the registry is
keyed by, and what an invite will encode. Back it up: losing it means every
peer must re-pair.

## Invites

Same-machine discovery only finds processes on the same box. A phone, a second
computer, or another person's app pairs with a code:

```js
// On the host
const invite = await node.createInvite({
  grants: { notes: ['search'] },   // the ceiling for whoever redeems it
  expiresIn: 15 * 60_000,
  uses: 1
})
console.log(invite.code)           // 79 chars, safe to read aloud

// On the other device
const peer = await other.pair(invite.code)
await peer.call('notes', 'search', { q: 'coffee' })
```

An invite **is** the approval: redeeming one skips the `approve` callback,
because the person issuing the code already made that decision. What it does
not skip is scoping — a peer arriving by invite gets the invite's grants, never
the packs' `defaultGrants`.

Topic, id, and proof are separately derived from the invite secret. The topic is
announced publicly on the DHT, so it must not reveal the secret that authorises
the pairing; the proof additionally binds both authenticated identities, so it
cannot be replayed toward a different peer.

`listInvites()` never returns secrets. `revokeInvite(id)` stops the node
announcing the topic immediately.

To mint an invite from a **separate process** — a CLI, while a daemon is running
against the same storage — use `issueInvite()` instead. It writes the record and
starts no swarm; a running node picks it up within seconds. Building a full node
there would derive the same identity key pair and fight the daemon for its own
DHT announcement:

```js
import { issueInvite } from '@unstoppable-stack/p2p'
const invite = await issueInvite({ storage: '~/.unstoppable-node', uses: 1 })
```

## Discovery

| Path | When |
| --- | --- |
| Direct key | `connect(publicKey)` — every reconnect after pairing |
| Topic | `listen({ topic })` / `discover({ topic })` — same machine |
| Invite | `createInvite()` / `pair(code)` — first contact across devices |
| Network | `joinNetwork(id)` — many instances of one app finding each other |

### App networks

Invites are 1:1, so a five-device mesh would need ten codes. A named network
is one topic every instance joins:

```js
await node.joinNetwork('notes-mesh', {
  grants: { notes: ['search'] },   // ceiling for everyone on this network
  approve: async (req) => 'approve'
})
```

The topic is derived from a guessable name, so **membership is not a security
boundary — the grants are**. Anyone who knows the network id can join, so set
`grants`, and set `approve` if the network is not purely your own devices.

`listen()` makes a node reachable by public key without joining any topic.
App-nodes deliberately do not join the machine-local topic by default: that
topic means "the Personal Node on this box", and every app-node joining it as
a server is how peers end up greeting each other.

## Errors

Capability failures use `NodeError` with a stable `code`: `PEER_NOT_FOUND`,
`PAIR_DENIED`, `NOT_GRANTED`, `UNKNOWN_CAPABILITY`, `UNKNOWN_METHOD`,
`REQUEST_FAILED`, `REQUEST_TIMEOUT`, `RESOURCE_LIMIT`, `CANCELLED`,
`INVALID_OPTION`, `CLOSED`, `METHOD_KIND_MISMATCH`, `INCOMPATIBLE_CAPABILITY`,
`INVALID_INPUT` and `INVALID_OUTPUT`. Startup/storage failures can also preserve
filesystem error codes; competing runtime ownership reports `STORAGE_LOCKED`.

## Resource limits

`createNode({ limits })` accepts operator-owned overrides of the finite defaults:

| Boundary | Default |
| --- | --- |
| Live control peers | 128 |
| Encoded JSON control frame | 256 KiB, checked before JSON decoding |
| Active incoming requests | 8 per peer, 64 per node |
| Server request lifetime | 120 seconds |
| Total stream output | 1 MiB encoded JSON |
| Consumer stream buffer | 64 chunks / 1 MiB |

Excess capacity/output/buffering reports `RESOURCE_LIMIT`; host deadlines report `REQUEST_TIMEOUT`. Streaming respects transport drain. A slow consumer is cancelled when its finite buffer fills rather than receiving an unbounded backlog. Grant removal aborts matching active work. Duplicate active request IDs and unsolicited pairing responses cannot replace controllers or authorize peers. Handlers must honor `ctx.signal`; a handler that ignores cancellation retains its capacity slot until it actually returns. This bounds admission but does not forcibly terminate arbitrary in-process plugin code. Replication binary channels are separate from these capability JSON limits.

## Transport

One Hyperswarm connection per peer, carrying a Protomux. The control channel
(`unstoppable/control/v2`) shares that muxer with Hypercore replication and any
pack-owned channels, so one peer relationship is one connection and one
lifecycle.

## Tests

```bash
npm test              # everything
npm run test:unit     # fast, no network
npm run test:types    # TypeScript contract inference and invalid-input checks
npm run test:bare     # native Bare storage, locks, sync attach and reopen
```

Set `BARE_BIN=/absolute/path/to/bare` when the supported sidecar/runtime is not
the global `bare` command. To exercise the packed library outside this checkout,
run `node ../../scripts/p2p-artifact-smoke.mjs --bare` from this package, with the
same `BARE_BIN` override when needed.

The integration suite spins up a local DHT bootstrapper and takes ~90s.

## License

MIT

## Runnable examples

| App | Demonstrates |
| --- | --- |
| [Notes](../../examples/p2p-notes/README.md) | Typed unary calls, streams, scoped grants, single-owner sync and offline replicas |
| [Collaborative notes](../../examples/p2p-database/README.md) | Optional Autobase, writer admission/removal, offline edits, restart and convergence |
| [Local Goods](../../examples/ecommerce-assistant/README.md) | Desktop worker RPC, private local cart, validated receipt output and persistent pairing |

These source examples target the `0.6.0-alpha.2` candidate. Use the checkout or
an installed candidate tarball until it is published. The database adapter's
acceptance is currently Node-only; the desktop example uses RPC and local
Hyperbee storage, not `/db`.
