---
name: add-node-capability
description: Make an app act as a node — expose a capability other apps pair with and call over P2P.
when_to_use: User wants their app to serve data or functions to other apps, mentions app-to-app pairing, pairing codes/invites, or asks how another app can call into theirs.
paths: ["src/node-host*", "src/capabilities/**", "src/node/**"]
version: "2026-08-18"
---

# Node Capability

## When to Use
- User wants another app (or another device) to call into this one
- User mentions "pairing code", "invite", "app-to-app", or "let X talk to Y"
- User wants to expose search/query/streaming over P2P without running a server

**Not** for replicating data to the Personal Node for backup — that is
`node-sync` and the `sync` capability. This skill is the inverse: the app
*hosts* something.

## Prerequisites
- `@unstoppable-stack/node-core` (`^0.6.0-alpha.1`)
- Node.js 20+, Bare, Pear Desktop, or Expo Bare — anything with Hyperswarm

## The Model

One runtime, two verbs. `listen()` accepts pair requests; `connect()`,
`discover()` and `pair()` reach a peer. A process may do either or both — "is
a node" versus "uses a node" is which verbs you call, not which class you
constructed. There is no server and no separate SDK for the two sides.

## Capability Pack

A pack is a plain object. **Unary methods are async functions; streaming
methods are async generators.** That difference is the whole of the
distinction — cancellation, backpressure and multiplexing come from the bus.

```js
import { createNode } from '@unstoppable-stack/node-core'

const notesPack = {
  name: 'notes',                 // lowercase, digits and dashes
  version: 1,
  methods: {
    search: async ({ q }, ctx) => ({ hits: await db.search(q) }),

    watch: async function * ({ prefix }, ctx) {
      for await (const change of db.watch(prefix)) {
        if (ctx.signal.aborted) return    // peer stopped listening
        yield change
      }
    }
  },
  defaultGrants: ['search'],     // 'watch' must be asked for explicitly
  async onAttach (node) {},      // background work
  async onPeer (peer) {},        // per-peer setup
  async onDetach () {}
}

const node = createNode({
  storage: './.my-app-node',     // identity + peers persist here
  profile: { appId: 'my-notes', appName: 'My Notes' },
  capabilities: [notesPack]
})

await node.ready()
await node.listen()
console.log(node.publicKey)      // stable across restarts
```

`ctx` is `{ peer, appId, grants, signal }`.

## ⚠ Always Check `ctx.signal` In Loops

A streaming handler keeps running until it returns. The bus aborts
`ctx.signal` when the peer disconnects, sends a cancel, or simply stops
iterating. A generator that ignores it will keep producing — and for an
AI or a database cursor, keep *costing* — for a peer that left.

## Calling It From The Other App

```js
const peer = await other.connect(publicKey)   // key already known
const { hits } = await peer.api.notes.search({ q: 'coffee' })

for await (const change of peer.api.notes.watch({ prefix: 'a' })) { … }
```

`peer.api` is built from what the far side advertised, so a typo fails locally
instead of becoming a round trip. `peer.call()` / `peer.stream()` are the
explicit equivalents.

## Reaching A Peer

| The other app is… | Use |
| --- | --- |
| On this machine, looking for the Personal Node | `node.discover()` |
| Known already (paired before, or key shared) | `node.connect(publicKey)` |
| A phone, another computer, someone else's app | `node.pair(code)` — see below |
| Another instance of *this* app, on any device | `node.joinNetwork(id)` |

### App networks

Invites are 1:1, so a five-device mesh would need ten codes. A named network
is one topic every instance joins:

```js
await node.joinNetwork('notes-mesh', {
  grants: { notes: ['search'] },   // ceiling for everyone on this network
  approve: async (req) => 'approve'
})
```

⚠ The topic derives from a guessable name, so **membership is not a security
boundary — the grants are.** Anyone who knows the id can join. Always set
`grants`, and set `approve` unless the mesh is only the user's own devices.

## Pairing Codes

First contact with a peer whose key you do not have:

```js
// Host
const invite = await node.createInvite({
  grants: { notes: ['search'] },   // the ceiling for whoever redeems it
  uses: 1,
  expiresIn: 15 * 60_000
})
console.log(invite.code)           // share out of band

// Joiner
const peer = await node.pair(code)
```

An invite **replaces the approval prompt** — issuing it *is* the approval —
but it also **caps the grants**. A peer arriving by invite never falls back to
the packs' `defaultGrants`. After pairing, both sides store each other and
reconnect direct by public key; the code is not needed again.

## Grants

Grants are **per direction**: each side decides what the other may call.

- Asking for nothing yields the host packs' `defaultGrants`, never everything.
- Asking yields only the intersection of the request and what is hosted.
- Ungranted calls are rejected with `NOT_GRANTED` *before* method resolution,
  so a peer cannot enumerate capabilities from error codes.
- `node.setPeerGrants(publicKey, grants)` changes a live session immediately.

## Checklist

- [ ] Capability name is lowercase/dashes and describes the domain, not the app
- [ ] Streaming methods are async generators and check `ctx.signal`
- [ ] `defaultGrants` lists only what is safe for any paired peer
- [ ] Destructive or expensive methods are left out of `defaultGrants`
- [ ] `storage` is a directory the app owns — it holds the identity key
- [ ] Identity is backed up, or the docs say peers must re-pair if it is lost
- [ ] If using `joinNetwork`, `grants` is set — the topic name is guessable

## Resources
- `resources/two-app-example.md` — a complete host + joiner pair

## Host approval and budgets

`createNode` denies unknown direct peers by default. Use scoped invitations or an explicit approval callback for hosted capabilities. `pairing: { autoApprove: true }` is a deliberate development-only option. Persisted grants remain a ceiling on reconnect; revocation aborts active requests and survives restart. Respect `ctx.signal` in every long-running handler. The bus defaults to 8 requests per peer / 64 globally, 120-second server lifetime, 256 KiB JSON frames and finite stream output/buffers. Do not advertise hard disk quotas or complete backup recovery from logical replication budgets.
