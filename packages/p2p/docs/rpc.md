# Typed capability calls

`@unstoppable-stack/p2p/rpc` adds runtime validation and inferred TypeScript
clients to the existing P2P capability bus. It is an experimental API inside
`0.6.0-alpha.2`; it is absent from alpha.1. Plain capability packs, `peer.call()`,
`peer.stream()` and `peer.api` remain supported.

Run the [notes example](../../../examples/p2p-notes/README.md) for calls and
streams, or [Local Goods](../../../examples/ecommerce-assistant/README.md) for
a desktop worker with scoped receipt queries and private local storage.

## Start here: serve, invite, connect

The application path needs no DHT, swarm, topic, bootstrap port or temporary
storage plumbing. Those belong in transport implementation and isolated tests.
Import `serve` and `connect` from `@unstoppable-stack/p2p/service` for managed
service/client sessions. Define shared contracts through the lightweight `/rpc` entry.
Keep `createNode` for bidirectional services, multiple packs or custom lifecycle.
These helpers require **0.6.0-alpha.2** or later.

With Node 22.17+:

```sh
mkdir rpc-demo
cd rpc-demo
npm init -y
npm install @unstoppable-stack/p2p@0.6.0-alpha.2
```

Save these three files in `rpc-demo`:

### notes.mjs

```js
import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

export const notes = defineCapability({
  name: 'notes',
  version: 1,
  methods: {
    get: procedure.query(() => ({ text: 'Hello RPC' }))
  }
})
```

### host.mjs

```js
import { serve } from '@unstoppable-stack/p2p/service'
import { notes } from './notes.mjs'

const service = await serve({ storage: './host-data', capability: notes })
try {
  console.log(await service.invite(['get']))
} catch (error) {
  await service.close()
  throw error
}
process.once('SIGINT', () => service.close())
process.once('SIGTERM', () => service.close())
```

### client.mjs

```js
import { connect } from '@unstoppable-stack/p2p/service'
import { notes } from './notes.mjs'

const connection = await connect({
  storage: './client-data',
  invite: process.argv[2],
  contract: notes.contract
})
try {
  console.log((await connection.api.get()).text)
} finally {
  await connection.close()
}
```

### Run

```sh
node host.mjs
# Second terminal, same directory; paste the code printed by the host:
node client.mjs "PASTE_INVITATION_HERE"
```

The client prints `Hello RPC` and closes. Keep the host running until done,
then press Ctrl+C. Public discovery requires network access on both peers.
No server account is needed. Each invite is single-use and expires in 15 minutes
by default; share it only with its intended recipient. Restart the host to issue
a new code. Stored identities and grants survive shutdown.

### Session ownership and permissions

- `serve({ storage, capability, nodeOptions? })` starts a node with one capability.
  It returns `{ node, contract, invite, close }`.
- `service.invite(methods, { uses?, expiresIn?, label? })` returns the code.
  Methods must be a nonempty list of names in this capability; no implicit
  all-method grants. Advanced invite inspection/revocation remains on `service.node`.
- `connect({ storage, invite, contract, timeout?, signal?, nodeOptions? })`
  creates a node, pairs, and binds the typed API. It returns `{ api, peer, node, close }`.
  Failed setup releases its node; after success the application owns `close()`.
- Save `connection.peer.publicKey` for future sessions. Reconnect using
  `connect({ storage, publicKey, contract })` with the same client identity directory.
  Supply exactly one target. Contract methods are requested automatically, but
  the host still enforces invitation grants and persisted permission ceilings.
- Setup lookup defaults to 20 seconds; per-call deadlines are separate. A signal
  cancels pairing/dialing. It does not become a lifetime signal for later calls.
- Sessions do not automatically reconnect or replay operations. After a disconnect,
  close the old session and connect again. Mutations still need app-owned idempotency.
- `nodeOptions` is an advanced escape hatch for existing profile, transport and
  limit options. Sessions own storage, capabilities and reconnect policy. Keep
  native sessions in the worker; importing shared RPC contracts alone does not
  load the transport.
- `close()` is idempotent. If contract binding fails after pairing, pairing may
  already have persisted; cleanup does not revoke trust. Use the host's grant
  controls or `unpair()` when revocation is intended.

## Define a capability

A capability names a service and its contract version. Procedures distinguish
one-result queries/mutations from streams. Parsers can be functions, objects
with `parse(value)`, or Standard Schema validators such as compatible Zod or
Valibot schemas. No validator dependency is required.

```ts
import { createNode } from '@unstoppable-stack/p2p'
import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

const noteId = (value: unknown): { id: string } => {
  if (typeof (value as { id?: unknown })?.id !== 'string') {
    throw new Error('Expected a note id')
  }
  return { id: (value as { id: string }).id }
}

const notes = defineCapability({
  name: 'notes',
  version: 1,
  methods: {
    get: procedure.input(noteId).query(async ({ input, signal }) => {
      // Applications own storage, schemas and business rules.
      return { id: input.id, text: 'Hello' }
    }),
    watch: procedure.stream(async function* ({ signal }) {
      yield { event: 'ready' }
      // Real producers must stop promptly when signal is aborted.
    })
  },
  defaultGrants: ['get']
})

const node = createNode({ storage: './data', capabilities: [notes] })
await node.listen()
```

Use `.mutation(handler)` for actions which change application state. Query
and mutation both return a single result; neither is retried automatically.
Builder calls are immutable, so a base procedure can safely be reused with
different input/output validators.

## Bind a client

Obtain a paired peer through `connect`, `pair` or discovery, then pass the
shared runtime contract:

```ts
const peer = await appNode.pair(invitationCode)
const api = peer.client(notes.contract)

const note = await api.get({ id: 'n1' }) // inferred result, ordinary Promise
for await (const change of api.watch(undefined, { signal })) {
  // AsyncIterable; return/break or AbortSignal cancels remote production.
}
```

`notes.contract` contains versions, kinds and validators, without handlers.
`peer.client(notes)` and `createClient(peer, notes.contract)` are equivalent
binding forms. Share this runtime descriptor through an application-owned
module; avoid importing server storage or native adapters into a renderer.
For independently packaged clients, export a contract from a pure factory or
module and supply the resulting contract through the application's IPC boundary
as appropriate. Contract objects contain validator functions and cannot be
sent as JSON over IPC; bind the client in the P2P worker and expose app-owned
IPC calls to the renderer.

Binding checks that the peer advertises the exact capability version and all
contract methods with compatible kinds. Older descriptors without method
kinds remain supported. The host checks the requested version again during
dispatch. Change the capability version when changing its contract; there is
no automatic compatibility negotiation or schema discovery.

Type inference and contract compatibility do not grant access. An invitation
may grant only `get`; binding still succeeds, and calling `watch` rejects with
`NOT_GRANTED`. Grants remain enforced by the remote host.

## Validate both boundaries

`.input(schema)` validates and transforms input once on the host. Standard
Schema preserves distinct pre-transform caller input and parsed handler input
types. Simple parser functions use their returned type as the caller's input
type, so use Standard Schema for transformations which change input types.

`.output(schema)` validates a unary result or each streamed item on the host,
then validates the wire value again on the client. The host sends the parsed
output, so fields stripped by an output schema never leave the host. Validation
failures use `INVALID_INPUT` or `INVALID_OUTPUT` without exposing validator
internals to the remote caller.

Outputs must contain JSON values: null, booleans, finite numbers, strings,
arrays and plain objects. Dates, Maps, BigInts, undefined, cyclic objects and
non-finite numbers are rejected. Return null explicitly for a successful action
without data. Use the file/replication APIs for binary data.

Output validators must preserve their own JSON wire shape. Stripping fields
or normalizing a string to a stable form is supported. A non-idempotent
transformation, such as incrementing a number each time it is parsed, is
rejected. Put that transformation in the handler and validate its final wire
shape instead. Output validators are pure functions and may run more than once.
Input transformations can change types and run once per request.

Without an output schema, typed procedures still reject non-JSON results at
runtime and constrain inferred results to JSON-compatible types. For untrusted
remote data, define an output schema to validate the result shape on the client.

## Deadlines, cancellation and reconnect

Unary calls and streams accept `{ signal, timeout }`. The caller defaults to
a 30-second total deadline, and the host applies its configured request deadline
and resource limits. `timeout: 0` disables only the caller deadline. Streams
are bounded RPC operations, not durable event subscriptions.

A stream consumer that breaks iteration sends cancellation. If it is waiting
for its next item, abort the supplied signal to interrupt that wait. Handler
code must observe its signal and release resources in `finally`; cancellation
cannot interrupt arbitrary synchronous code or a promise that ignores it.
Cancelled physical work continues to consume execution capacity until it stops.

The peer is one connection. After reconnect, obtain the replacement peer and
bind a fresh client. Calls are never automatically replayed. A disconnect after
a mutation may leave its outcome unknown; application-level idempotency keys
and deduplication are needed before safely retrying it.

Errors retain stable `code` values such as `NOT_GRANTED`, `REQUEST_TIMEOUT`,
`CANCELLED`, `RESOURCE_LIMIT`, `CLOSED`, `INCOMPATIBLE_CAPABILITY`,
`METHOD_KIND_MISMATCH`, `INVALID_INPUT` and `INVALID_OUTPUT`. Types and contract
checks do not imply native inference, offline, or packaged-artifact acceptance.
