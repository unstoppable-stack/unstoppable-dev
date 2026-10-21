---
name: add-p2p-rpc
description: Typed capability calls and streaming using @unstoppable-stack/p2p/rpc and managed service sessions.
---

# Add P2P RPC

Read the target's manifest, worker/managers and installed P2P types. Use
`@unstoppable-stack/p2p/rpc` and `/service` (alpha.2 or later) for new services.
Read `modules/p2p.mdc`. Do not install bare-rpc or build socket wrappers for
app-to-app calls. Personal Node is not required.

Define an app-owned contract in a shared module:

```js
import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'
export const notes = defineCapability({
  name: 'notes',
  version: 1,
  methods: { get: procedure.query(() => ({ text: 'Hello RPC' })) }
})
```

Host it in the native runtime:

```js
import { serve } from '@unstoppable-stack/p2p/service'
import { notes } from './notes.js'
const service = await serve({ storage: './host-data', capability: notes })
try {
  console.log(await service.invite(['get']))
} catch (error) {
  await service.close()
  throw error
}
// Keep open for peers; app shutdown must await service.close().
```

Pair from a separate client identity:

```js
import { connect } from '@unstoppable-stack/p2p/service'
import { notes } from './notes.js'
const connection = await connect({
  storage: './client-data', invite: invitationCode, contract: notes.contract
})
try {
  console.log(await connection.api.get())
} finally {
  await connection.close()
}
```

`invitationCode` is the code shared by the host. For later sessions save
`connection.peer.publicKey` and use `publicKey` instead of `invite` with retained
client storage. Close disconnected sessions before explicitly reconnecting.
Sessions do not automatically reconnect or replay operations.

Use `.input(parser)` and `.output(parser)` for runtime validation,
`.mutation(handler)` for changes and `.stream(async function* ({ signal }) {})`
for streaming. Honor signals; pass `{ signal, timeout }` as per-call options
using installed types. The setup signal only cancels pairing/dialing.
Typed binding does not grant methods: an ungranted call rejects `NOT_GRANTED`.
Mutations need app-owned idempotency. Change contract versions deliberately.

For existing nodes/multiple packs use root `createNode({ storage, capabilities })`,
pairing/grants and `peer.client(notes.contract)`. Reuse the node rather than
opening a parallel service/session over the same identity directory.
Native sessions stay in the Bare worker on desktop; expose domain IPC calls to
the renderer. Contract objects contain functions and cannot cross JSON IPC.

Validate real query/stream results, invalid inputs/outputs, denied methods,
cancellation, disconnect/reconnect and clean shutdown. See the installed P2P
`docs/rpc.md` for the complete API. Old socket-wrapper resources are legacy
migration references only; they are not implementations of this protocol.
