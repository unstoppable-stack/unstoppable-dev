# Runtime and peer API

> Experimental `0.6.0-alpha.2` source reference. Published `0.6.0-alpha.1`
> provides the original runtime and `/sync`; typed `/rpc` and the `/db`
> prototype require alpha.2 source. Release labels checked 19 October 2026.
> Start with the [package quickstart](../README.md) and
> [documentation index](README.md).

## One runtime for hosts and clients

`createNode(options)` returns an `UnstoppableNode`. The same instance can accept
connections, dial peers and serve capabilities. App-to-app calls do not require
a Personal Node. “Client” and “server” describe a connection's use, not separate
SDKs. One authenticated Hyperswarm connection carries the Protomux control
channel (`unstoppable/control/v2`) and optional replication channels.

```js
import { createNode } from '@unstoppable-stack/p2p'

const node = createNode({
  storage: './.notes-peer',
  profile: { appId: 'notes', appName: 'Notes', deviceName: 'laptop' },
  capabilities: [notesPack({ db })], // app-defined; see the package quickstart
  reconnect: true
})
await node.listen()
// Use the invite code issued by the other app.
const peer = await node.pair(inviteCode, { requested: { notes: ['search', 'watch'] } })
try {
  const result = await peer.call('notes', 'search', { q: 'coffee' })
  for await (const change of peer.stream('notes', 'watch', { prefix: 'a' })) {
    if (change.done) break // returning cancels remote work
  }
} finally {
  await node.close()
}
```

`storage` is required. It contains the stable identity seed, peer records and
invites. `profile` is descriptive metadata; authenticated peer keys determine
identity and resource ownership. `capabilities` contains plain pack objects.
`pairing`, `limits`, and `reconnect` configure trust, bounded work and retries.
`swarm` accepts transport options, including an isolated bootstrap for tests.
Native networking and storage belong in the app's worker, behind its IPC bridge.

Only one live runtime may own a storage directory. A second `ready()` rejects
with `STORAGE_LOCKED`; advisory locks release on process exit, including crashes.
Concurrent first-use identity creation and separate-process invitation mutations
are serialized. Do not clone one identity into simultaneously running devices.

`handshakeTimeoutMs` defaults to 30 seconds and bounds incomplete handshakes and
approval waits. Errors emitted as local diagnostics are observable through
`node.on('error', ...)`; a missing application listener does not turn malformed
remote traffic into an uncaught exception.

## Node lifecycle and discovery

| API | Behavior |
| --- | --- |
| `await node.ready()` | Load identity, peer registry and packs; initialize transport |
| `await node.listen({ topic? })` | Become reachable by key; join a discovery topic only when configured |
| `await node.connect(publicKey, { requested?, timeout?, reconnect? })` | Dial a selected key and negotiate pairing/grants; default timeout 15 seconds |
| `await node.discover({ topic?, requested?, timeout?, reconnect? })` | Find a host on a topic; default is the machine-local Personal Node topic |
| `await node.pair(code, { requested?, timeout?, reconnect? })` | Redeem a cross-device invitation; default timeout 20 seconds |
| `await node.joinNetwork(id, { grants?, requested?, approve? })` | Discover and pair app instances on a named network |
| `await node.leaveNetwork(id)` | Leave that network's discovery topic |
| `node.publicKey`, `node.peers`, `node.peer(key)`, `node.networks` | Inspect local identity, live peers and network membership |
| `await node.close()` | Stop new work, cancel requests, tear down peers, transport and packs |

A machine-local topic is not LAN discovery. Use invitations for first contact
on another device and public keys for later reconnects. Network names are
guessable: membership never substitutes for grants or approval. These APIs
provide discovery and direct communication, not guaranteed reachability or an
always-online relay. Local application reads and writes must continue offline.

`connect`, `discover` and `pair` accept an AbortSignal. Only one discovery or
invitation redemption may be active at a time on an instance; an overlapping
operation rejects with `INVALID_OPTION`. Known-key connections can operate in
parallel. Cancelling discovery releases its own topic lease without removing a
topic still used by another subsystem.

`reconnect: true` enables retries with backoff. Relevant events include `paired`,
`peerDisconnected`, `reconnecting`, `reconnected`, `reconnectFailed`,
`grantsChanged`, `error` and `requestError`. These are local EventEmitter events;
there is no built-in remote `events.subscribe` service.

## Invitations and trust

| API | Behavior |
| --- | --- |
| `await node.createInvite({ grants?, expiresIn?, uses?, label? })` | Issue a scoped code; defaults to 15 minutes and one use |
| `node.listInvites()` | List redeemable invitations without their secrets |
| `await node.revokeInvite(id)` | Revoke the invitation and stop announcing its topic |
| `await issueInvite({ storage, ...options })` | Issue from another process without starting a second node on the daemon's identity |
| `await node.setPeerGrants(key, grants)` | Change the methods this peer may call; removals abort affected active requests |
| `await node.setPeerPolicy(key, policy)` | Store operator policy; interpretation belongs to the host application |
| `await node.unpair(key)` | Revoke pairing and persist a denial |

Import `issueInvite` from the package root. Without an approval callback, direct
incoming pairing is denied. Invitations authorize their own scoped grants.
`pairing.approve(request)` can return `approve`, `approve-remember` or `deny`;
the host owns its approval policy. `pairing.autoApprove` is a deliberate
development option. Each direction has independent grants; outgoing dialing
authorizes the selected remote identity, not unrestricted access in reverse.

Requested methods are intersected with hosted methods and the applicable
invitation, remembered grant ceiling or approval decision. Omitted requests use
pack defaults where applicable. Known invited peers reconnect within stored
ceilings. Locally call `node.peerRegistry.forgetDenial(key)` only when deliberately
authorizing fresh pairing after revocation. Revocation cannot erase bytes that
a remote device has already downloaded.

## Calls, streams and packs

| API | Behavior |
| --- | --- |
| `await peer.call(capability, method, params?, { timeout?, signal? })` | Unary result; default caller timeout 30 seconds |
| `for await (const value of peer.stream(capability, method, params?, { signal?, timeout? }))` | Incremental output; default caller deadline 30 seconds; cancelled on early return or abort |
| `peer.api.notes.search(params, options)` | Descriptor-driven equivalent; await for unary or iterate for streaming |
| `await peer.close()` | Close this peer connection |

`peer.api` exposes only advertised methods. A handle may be consumed once, as
either a promise or an async iterator. Dotted method names remain string keys:
`peer.api.sync['manifest.replace'](...)`. A method descriptor advertises presence
and a pack version; it is not a full parameter schema, compatibility negotiation
engine or service directory.

Repeated awaits/catch/finally on one unary handle share the same execution;
switching between promise and stream consumption is rejected. New descriptors
advertise method kinds, and mismatched response kinds fail explicitly. For
ordinary Promise/AsyncIterable return values, inferred TypeScript inputs/results
and runtime schemas, use the optional [typed RPC layer](rpc.md).

A capability pack has `name`, `version`, `methods`, optional `defaultGrants`, and
optional `onAttach(node)`, `onPeer(peer)` and `onDetach()` hooks. Unary methods
are async functions; streaming methods are async generators. Handlers receive
`(params, ctx)`, where `ctx` contains `{ peer, appId, grants, signal }`.
Use `ctx.peer.remotePublicKey` for ownership. Treat profile metadata and method
parameters as untrusted input and validate application schemas inside handlers.

The runtime checks grants before resolving a handler and aborts work on
cancellation, disconnect or grant removal. Handlers must honor `ctx.signal`;
in-process code cannot be forcibly terminated. The root imports no QVAC or
wallet SDK. Apps can expose compute or other domain methods through this bus
without making those SDKs dependencies of P2P.

## Limits, errors and protocol

Finite default limits include 128 control peers, 256 KiB JSON frames, eight
incoming requests per peer / 64 per node, a 120-second host request deadline,
1 MiB total stream output and a 64-chunk / 1 MiB consumer buffer. Streaming
respects transport drain. See the [quickstart's limit table](../README.md#resource-limits)
and exported `DEFAULT_LIMITS` for operator overrides. Binary replication is a
separate path and does not inherit the JSON stream byte budget.

Failures carry a `NodeError.code`, including `NOT_GRANTED`, `PAIR_DENIED`,
`PEER_NOT_FOUND`, `UNKNOWN_CAPABILITY`, `UNKNOWN_METHOD`, `REQUEST_FAILED`,
`REQUEST_TIMEOUT`, `RESOURCE_LIMIT`, `CANCELLED`, `INVALID_OPTION` and `CLOSED`.
Use codes for behavior and messages for diagnostics.

The `/protocol` subpath exposes protocol constants and topic/key helpers;
`/errors` exposes errors. The current protocol uses `call`, `result`, `chunk`,
`end`, `error` and `cancel`, alongside handshake/pairing messages. Older designs
using `capabilityRequest`, `services`, `connectToNode()` or separate
`node-core` / `node-client` imports describe previous APIs. See the
[migration map](../../../docs/package-architecture.md#migration-from-the-unpublished-split-packages).

## Validation boundary

The [P2P notes example](../../../examples/p2p-notes/README.md) and package tests
exercise protocol and replication paths. They do not establish mobile support,
signed desktop readiness, native inference, durable cloud jobs or complete
backup/restore. Use the [validation commands](../../../docs/validation.md) for
the relevant acceptance boundary.
