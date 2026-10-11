# @unstoppable-stack/node-core

> Symmetric P2P node runtime for the [Unstoppable Stack](https://unstoppable.dev) —
> identity, pairing, and a capability bus for apps that act as nodes.

One runtime, two verbs. `listen()` accepts pair requests, `connect()` dials a
known peer. A process may do either, both, or neither — so "an app that acts
like a node" is a configuration, not a different class.

Core carries no storage stack. Replication and local AI live in separate
capability packs, so an app that only wants app-to-app RPC installs neither.

## Install

```bash
npm install @unstoppable-stack/node-core
```

## Usage

```js
import { createNode } from '@unstoppable-stack/node-core'

const node = createNode({
  storage: './.my-notes',                       // identity + peers persist here
  profile: { appId: 'my-notes', appName: 'My Notes', deviceName: 'laptop' },
  capabilities: [notesPack({ db })]
})

await node.listen()          // reachable by public key; accepts pair requests
console.log(node.publicKey)  // stable across restarts — share this
```

Another app pairs with it and calls the capability:

```js
const peer = await other.connect(publicKey)
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
import { issueInvite } from '@unstoppable-stack/node-core'
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

Every rejection is a `NodeError` with a stable `code`: `PEER_NOT_FOUND`,
`PAIR_DENIED`, `NOT_GRANTED`, `UNKNOWN_CAPABILITY`, `UNKNOWN_METHOD`,
`REQUEST_FAILED`, `REQUEST_TIMEOUT`, `CANCELLED`, `INVALID_OPTION`, `CLOSED`.

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
```

The integration suite spins up a local DHT bootstrapper and takes ~90s.

## License

MIT
