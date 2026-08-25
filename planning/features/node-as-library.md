# Node as a Library — App-Nodes and App-to-App Pairing

> Status: Phases 1–4 implemented; app networks landed from Phase 5, the rest deferred
> Date: 2026-08-18
> Related: `node.md`, `node-technical.md`, `node-capability-api.md`, `node-pairing-protocol.md`, `feature-profiles.md`

## Goal

Turn the Unstoppable Node from *one product* into *a runtime any app can embed*.

Today an app is always a client: it finds the Personal Node on the machine and
asks it for things. After this work, an app can also **be** a node — it holds a
stable identity, hosts capabilities, and pairs directly with other specific
apps. The Personal Node stops being a special peer and becomes one composition
of the same library: core + every built-in capability pack.

```text
  TODAY                                AFTER

  App ──client──► Personal Node        App-Node ◄──pair──► App-Node
  App ──client──► Personal Node             │                  │
  App ──client──► Personal Node             └──pair──► Personal Node
                                                    (core + all packs)
```

---

## Decisions (locked)

| Question | Decision |
| --- | --- |
| What is an "app that acts like a node"? | Both — a generic core plus optional capability packs. Apps embed the core, enable the packs they want, and register their own domain capabilities. |
| Packaging | New thin `@unstoppable-stack/node-core`. Heavy built-ins ship as separate packs. `unstoppable-node` becomes the shell that composes them. `node-client` is absorbed into core. |
| Pairing beyond same machine | Invite codes / pairing links, backed by direct public-key reconnect. |
| Compatibility | **Clean break.** The packages are on npm but unannounced, and every consumer is our own. No v1 shims, no on-disk migration. Design the protocol we actually want and bump to `0.6.0`. |

The compat decision is load-bearing: it is what lets us delete the dual-swarm
transport, the `services` flags, and the legacy `cores`/`drives` arrays instead
of carrying them forever behind translation shims.

---

## Where We Are Today

Read of `packages/node/src` and `packages/node-client/src` as of `0.5.0-beta.1`:

| Piece | Current shape | Why it blocks app-nodes |
| --- | --- | --- |
| `NodeDaemon` (`node.js`, 873 lines) | Server-only. Joins one topic with `{ server: true, client: false }`. | Cannot also be a client. A node can never pair *outward*. |
| `NodeClient` (`client.js`, 717 lines) | Client-only, re-implements framing, hello, sessions. | Two implementations of one protocol, drifting apart. |
| Transport | **Two** Hyperswarms — `discoverySwarm` for NDJSON control, `replicationSwarm` for `store.replicate(socket)`. | Two connections, two topics, two lifecycles per peer, for one logical relationship. |
| Discovery | `localDiscoveryTopic()` = hash of `user@hostname`. | One topic per machine. Every app-node on that machine lands in the same swarm and greets every other as a node. No cross-device path. |
| Identity | `new Hyperswarm(opts)` → `DHT.keyPair()` with no seed. | **Identity is random per process.** The node's public key changes on every restart. Invites and a key-addressed registry are impossible until this is fixed. |
| Capabilities | `DEFAULT_SERVICES` + `buildCapabilities()` are frozen constants; each method is a bespoke `_handleX` branch. | An app cannot add `notes.search`. Every new method needs a protocol change. |
| Service flags | `services: { data, files, ai }` shipped in the hello *alongside* the richer `capabilities` map. | Two overlapping ways to answer "what can you do". The code comment already admits `files` "was bolted onto the protocol". |
| Resources | Legacy `cores`/`drives` arrays *and* `resourceManifest`, bridged by `manifestToLegacyResources`. | Two models for one concept, with conversion code between them. |
| Registry | `AppRegistry`, keyed `apps/<appId>`. | Two devices sharing an `appId` collide — the `deviceName` field is already a workaround. |
| Storage | `new Corestore(storagePath)` unconditionally in the constructor. | An embedding app already has a Corestore. Forcing a second one under a node-owned path is wrong. |
| Dependencies | `corestore`, `hyperbee`, `hyperdrive`, `hypercore` are direct deps of the node. | An app that only wants app-to-app RPC would pull the entire storage stack. |

What already works in our favour: `NodeDaemon` is a plain exported class that
`node-desktop` embeds in a Bare worker today, capability *descriptors* and
per-peer `grants` already exist in the handshake, `_authorize(socket, cap,
method)` already gates every call, and the pairing approval callback is already
injectable. The bones of a capability system are there — they are wired to
constants instead of to a registry.

---

## Target Architecture

### Packages

```text
@unstoppable-stack/node-core        thin runtime — identity, transport, pairing,
                                    capability bus, sessions/grants, peer registry
                                    deps: hyperswarm, protomux, compact-encoding,
                                          hypercore-crypto, b4a, bare-events

@unstoppable-stack/node-caps-sync   built-in pack — data + file replication
                                    deps: corestore, hypercore, hyperbee, hyperdrive

@unstoppable-stack/node-caps-ai     built-in pack — QVAC / mock inference

unstoppable-node                    the Personal Node shell — CLI, config,
                                    export/import; composes core + both packs
```

`@unstoppable-stack/node-client` is **deleted**, not kept as a facade. Its job —
the connect side of the protocol — is one of core's two roles. Publishing a
deprecation note on the npm package is enough given no external consumers.

The packs are separate packages rather than subpath exports of core **because of
dependency weight**: `corestore` + `hyperdrive` + `hyperbee` is the bulk of the
install, and an app that only wants to expose `notes.search` to a peer should
not carry it.

### The core object

One symmetric runtime. The same instance serves and connects.

```js
import { createNode } from '@unstoppable-stack/node-core'
import { syncPack } from '@unstoppable-stack/node-caps-sync'
import { aiPack } from '@unstoppable-stack/node-caps-ai'

const node = createNode({
  storage: './.my-notes',       // identity + peer registry persist here
  profile: { appId: 'my-notes', appName: 'My Notes', deviceName: 'laptop' },
  capabilities: [
    syncPack({ store }),          // optional — bring your own Corestore
    aiPack({ mock: true }),       // optional
    notesPack({ db })             // app-defined
  ],
  pairing: { approve: async (req) => 'approve-remember' }
})

await node.listen()                       // host: accept pair requests
const peer = await node.pair(inviteCode)  // client: redeem an invite
// or: const peer = await node.connect(publicKeyHex)   // known peer, direct

const hits = await peer.call('notes', 'search', { q: 'coffee' })
for await (const token of peer.stream('ai', 'completion.stream', { messages })) { … }
```

`listen()` and `pair()` are independent. A process may do only the first
(today's Personal Node), only the second (today's client app), or both (an
app-node). There is no `NodeDaemon` and no `NodeClient` — one class, two verbs.

### Transport: one connection, multiplexed

Replace the dual-swarm NDJSON design with **a single Hyperswarm connection
carrying a Protomux**, with the control channel and Hypercore replication
multiplexed over it.

This is safe and idiomatic: `Corestore.replicate()` already accepts a Protomux
(`corestore/index.js:436` → `Hypercore.createProtocolStream`'s
`Protomux.isProtomux` branch), and attaches cores to `stream.noiseStream.userData`,
which *is* the muxer. Hypercore replication has always been Protomux underneath;
today we are just paying for a second swarm to avoid sharing it.

```text
  Hyperswarm connection (Noise, mutually authenticated)
    └── Protomux
         ├── channel 'unstoppable/control/v2'   JSON messages — hello, pair, call/stream
         ├── channel(s) opened by Hypercore     replication, attached by the sync pack
         └── channel(s) opened by other packs   e.g. future binary artifact transfer
```

What this buys, beyond halving connections: peer lifecycle becomes one event
rather than two that can disagree; the sync pack no longer needs its own swarm
and topic; and **packs can open their own channels**, so a capability that needs
binary framing or independent backpressure is not forced through the JSON
control channel.

The control channel keeps JSON message bodies (`compact-encoding`'s `json`) —
debuggability is worth more than bytes on a channel that carries handshakes and
small RPC, and the payload-heavy paths get their own channels anyway.

### Protocol v2

No legacy message types. The entire surface is a handshake plus a generic
invocation envelope; everything the node does today becomes a capability method.

```jsonc
// handshake
{ "type": "hello", "protocolVersion": 2,
  "nodeType": "app" | "personal-node",
  "roles": ["host", "client"],
  "publicKey": "…", "profile": { "appId": "…", "appName": "…", "deviceName": "…" },
  "capabilities": { "notes": { "version": 1, "methods": ["search", "watch"] }, … } }

// pairing
{ "type": "pairRequest", "invite": { "id": "…", "proof": "…" }, "requested": {…} }
{ "type": "pairAccepted", "grants": {…} }
{ "type": "pairDenied", "reason": "…" }

// invocation
{ "type": "call",   "requestId": "…", "capability": "notes", "method": "search", "params": {…} }
{ "type": "result", "requestId": "…", "value": {…} }
{ "type": "chunk",  "requestId": "…", "value": "…" }
{ "type": "end",    "requestId": "…" }
{ "type": "error",  "requestId": "…", "code": "NOT_GRANTED", "message": "…" }
{ "type": "cancel", "requestId": "…" }
```

Gone with the break: the `services` flags (capabilities are the single answer to
"what can you do"), the legacy `cores`/`drives` arrays and
`manifestToLegacyResources` (the resource manifest is the only model), and the
seven bespoke `_handleX` branches (`register`, `statusRequest`, `diskUsage`,
`peekCore`, `peekDrive`, `resourceManifest.replace`, `inference`) — each becomes
an ordinary method on a built-in pack.

### Capability packs

A pack is a plain object. Unary methods are async functions; streaming methods
are async generators. That single distinction replaces the bespoke streaming and
cancellation plumbing `_handleInference` carries today.

```js
export function notesPack ({ db }) {
  return {
    name: 'notes',
    version: 1,
    methods: {
      'search': async (params, ctx) => ({ hits: await db.search(params.q) }),
      'watch':  async function * (params, ctx) {
        for await (const change of db.watch(params.prefix, { signal: ctx.signal })) yield change
      }
    },
    defaultGrants: ['search'],           // 'watch' must be asked for explicitly
    async onAttach (node) {},            // background work, event emission
    async onPeer (peer) {},              // optional: open a private Protomux channel
    async onDetach () {}
  }
}
```

`ctx` carries `{ peer, appId, grants, signal }`. `signal` aborts when the peer
disconnects or sends `cancel` — inference cancellation, generalised to every
streaming method.

### Identity and addressing

Persist an ed25519 seed per node in its storage dir (via the existing
`runtime-files.js` atomic-write helpers) and pass `DHT.keyPair(seed)` into
Hyperswarm. Consequences:

- A node's public key is stable across restarts, so it can be printed, shared,
  embedded in an invite, and used as a registry key.
- Reconnects use `swarm.joinPeer(publicKey)` — a known peer needs no topic.
- The seed becomes part of the export/import bundle, and rotating it is an
  explicit user action rather than an accident of restarting.

Three discovery paths coexist:

| Path | When | Mechanism |
| --- | --- | --- |
| Machine-local topic | Find the Personal Node on this box | `localDiscoveryTopic()` from `user@hostname` |
| Invite | First contact between two specific apps, any device | Topic derived from the invite secret |
| Direct key | Every reconnect after pairing | `joinPeer(publicKey)` over HyperDHT |

### Invites

```js
const invite = await node.createInvite({
  grants: { notes: ['search'] },
  expiresIn: 15 * 60_000,
  uses: 1
})
// invite.code → short z-base-32 string the user shares out of band
```

Code payload: `{ version, publicKey(32), secret(16), grantsHint }`.

1. The host persists the pending invite and joins
   `hash('unstoppable:invite:v2:' + secret)` as server.
2. The joiner derives the same topic, joins as client, connects, and sends a
   `pairRequest` carrying an HMAC over the Noise handshake's remote key using
   the invite secret — so an eavesdropper who somehow learns the topic still
   cannot redeem the invite.
3. The host verifies the proof, applies the invite's grants (not TOFU defaults),
   consumes the use, and persists the peer.
4. Both sides store each other and reconnect by key from then on.

This generalises the cross-device flow in `node-pairing-protocol.md`: an invite
grants *capabilities*, not a device role.

### Peer registry

`PeerRegistry` keyed `peers/<publicKey>` — `{ publicKey, appId, appName,
deviceName, role, grants, pairedAt, pairingMethod, inviteId, resources }`.
Keying by public key fixes the two-devices-one-appId collision. Existing
`0.5.0-beta` installs are not migrated; peers re-pair.

---

## Phases

### Phase 1 — `@unstoppable-stack/node-core` — **done**

Shipped in `packages/node-core/` at `0.6.0-alpha.1`, 31 passing tests.

| # | Task | Status |
| --- | --- | --- |
| 1 | Persisted identity seed; seeded key pair into Hyperswarm | Done — `src/identity.js` |
| 2 | Single-connection Protomux transport, `unstoppable/control/v2` channel | Done — `src/node.js` |
| 3 | Hello, pairing, sessions, per-direction grants, approval callback | Done — `src/node.js` |
| 4 | Capability registry + pack lifecycle, unary vs generator dispatch, `cancel`/`signal` | Done — `src/capabilities.js`, `src/peer.js` |
| 5 | `createNode`, `listen`, `connect`, `Peer.call`, `Peer.stream` | Done — `src/node.js`, `src/peer.js` |
| 6 | `PeerRegistry` keyed by public key | Done — `src/registry.js` |

**Done means:** two bare `createNode()` instances pair over a testnet DHT and
call a trivial capability in both directions, with no storage stack installed.
Verified: `test/pairing.test.js` covers both directions, streaming, early-break
cancellation, per-direction grant enforcement, handler failure isolation,
approval denial, identity survival across restart, disconnect cleanup, and
in-flight rejection on drop. `corestore`, `hyperbee`, `hyperdrive` and
`hypercore` are absent from the install tree.

Decisions settled while building:

- **`storage` is one directory**, not a per-concern path; `identity.json` and
  `peers.json` live in it.
- **Grants are per direction and symmetric.** `pairRequest` carries what the
  joiner wants; `pairAccepted` answers it *and* carries what the host wants;
  `pairConfirm` answers that. Asking for nothing yields the packs'
  `defaultGrants`, never everything.
- **Grants are checked before method resolution**, so an ungranted peer cannot
  enumerate hosted capabilities from error codes.
- **`listen()` joins no topic unless given one.** It calls `swarm.listen()` so
  the node is reachable by key. This implements the same-machine collision
  mitigation directly rather than leaving it to a later phase — combined with
  only the dialer sending a `pairRequest`, a node never initiates pairing
  toward a passively discovered peer.

### Phase 2 — Capability packs and the Personal Node shell

Split into a spike and an atomic cutover: the shared-muxer premise was the only
genuinely uncertain part of this phase, and validating it in isolation kept the
repo green while it was in doubt. That was the right call — it surfaced two
transport bugs before any consumer was rewritten (below).

#### Phase 2a — sync pack spike — **done**

Shipped in `packages/node-caps-sync/` at `0.6.0-alpha.1`, 7 passing tests
covering real Hyperbee and Hyperdrive replication over a paired connection,
per-peer scoping, complete-set semantics, restart restore, and grant defaults.

| # | Task | Status |
| --- | --- | --- |
| 1 | `node-caps-sync` from `replication.js` + resource manifest; injected or owned Corestore; replication shares the paired connection | Done |

**Two bugs found by the spike, both of which would have been far more expensive
after 2b:**

1. **node-core kept its muxer private.** `Protomux.from()` *reads*
   `noiseStream.userData` but never writes it; Hypercore's
   `createProtocolStream` writes it explicitly. Core created a muxer without
   publishing it, so `store.replicate(socket)` would have built a *second*
   Protomux over the same stream and the two would have corrupted each other.
   Fixed in `node-core/src/node.js`, with a regression test asserting the
   published muxer is ours.

2. **Closing a Hyperdrive closed the whole Corestore.** `Hyperdrive._close()`
   closes the corestore it was handed, and the engine passed the *root* store,
   so dropping any drive tore down every other session on the node. This is a
   **pre-existing bug in `packages/node/src/replication.js:80`**, not something
   the port introduced — the 0.5 daemon takes down its own registry Hyperbee
   the first time a drive is removed via reconcile. Fixed in the pack by
   passing `store.session()`; the drive resolves its cores from the key, so the
   session only decides lifetime. The 0.5 copy dies with 2b.

Also settled: the plan's "attaches to the peer's existing muxer instead of a
second swarm" was half right. Replication to the *paired* peer rides the shared
connection, but the engine also joins each resource's discovery key as a topic
to attract third parties seeding the same data. The accurate goal is **one
swarm, two uses** — not "no swarm".

#### Phase 2b — the cutover — **done**

| # | Task | Status |
| --- | --- | --- |
| 1 | `node-caps-ai` from `ai-provider.js`, including live enable/disable | Done — `packages/node-caps-ai/` |
| 2 | Recompose `unstoppable-node` as shell = core + both packs; delete `NodeDaemon` | Done — `src/personal-node.js`; six modules deleted |
| 3 | Config migrated to v2, quotas re-keyed to peer public key | Done — `src/config.js` |
| 4 | Port `node-desktop` (daemon-host, dashboard, command allowlist) | Done |
| 5 | Delete `packages/node-client`; port the scaffold generators | Done |
| 6 | Quota enforcement re-keyed from appId to peer public key | Done |

**The plan under-counted the consumers.** It listed the shell, node-desktop and
the three generators. The cutover also had to carry `packages/memory-client`
(a separately published package whose `node-sync.js` used `connectToNode`),
`packages/memory-desktop`, and the website's SDK documentation page. Anything
that names a package is worth grepping for before sizing a deletion.

**Two features had to be built, not ported**, because they existed only in the
deleted client and nothing in core replaced them:

1. **Topic discovery.** `connectToNode()` found the local node without knowing
   its key; core only had `connect(publicKey)`. The discovery table in this
   document listed the machine-local topic, but only the *host* half had been
   built. Added `node.discover({ topic, requested })` — the client-side
   counterpart of `listen({ topic })`.
2. **Reconnect with backoff.** The 0.5 client had `reconnect: true`; the
   generators' templates depend on `reconnecting`/`reconnected`/
   `reconnectFailed` events. Added sticky peers with exponential backoff.

**Three more bugs found during the cutover:**

3. **Teardown ordering.** `close()` detached capability packs before destroying
   the swarm, so a connection landing mid-shutdown handed a closed Corestore to
   `store.replicate()`. Stop accepting work first, then shut down the workers.
4. **Unbounded shutdown.** The first fix awaited in-flight mirror passes, which
   never settle when the peer they are downloading from has vanished. Bounded
   to a 2s drain.
5. **Reconnect counter reset.** `connect()` overwrote its own sticky entry with
   `attempts: 0`, so `maxAttempts` was unreachable and a successful retry never
   reported itself as a *re*connection.

Also settled: the clean break applies to the wire protocol and packaging, not
to the shell's local management API. `node-desktop` talks to a local object,
not the wire, so that surface was kept stable and only the `appId` → public-key
re-keying rippled into the dashboard.

**Done means:** the Personal Node's CLI and dashboard behave as they do today,
and the shell is a thin composition over core and the two packs.

### Phase 3 — Invites and app-to-app pairing — **done**

| # | Task | Status |
| --- | --- | --- |
| 1 | `createInvite` / `pair(code)`, invite store, expiry and use accounting | Done — `src/invite.js`, `src/invite-store.js` |
| 2 | Invite-scoped grants replacing TOFU defaults for non-local peers | Done — an invite bypasses the approval prompt but caps grants |
| 3 | Direct-key reconnect via `joinPeer` | Done in Phase 1 |
| 4 | `us node invite` + invite panel in the node-desktop dashboard | Done |

Invite codes are z-base-32 over `version ‖ publicKey(32) ‖ secret(16)` — 79
characters, no ambiguous glyphs, tolerant of whitespace and dashes when copied.

Topic, id and proof are **domain-separated hashes of the secret**. This matters:
the topic is announced on the DHT, so if the secret were recoverable from it,
any observer could forge the proof. The proof also binds both authenticated
identities, so it cannot be replayed toward a different peer.

Three problems worth recording:

1. **A CLI invite cannot start a node.** `us node invite` first built a full
   node against the daemon's storage directory — which derives the *same*
   identity key pair and stands up a second Hyperswarm server on it, fighting
   the running daemon for its own DHT announcement. Split out `issueInvite()`,
   which writes the record and starts no swarm; the daemon's watcher picks it
   up within seconds. There is no IPC between `us` and the daemon, and this
   avoids inventing one.
2. **Joining a topic is not announcing it.** The invite watcher joined new
   topics without flushing, so an invite was not findable until something else
   forced a flush.
3. **One flush only finds peers already there.** `discover()` and `pair()`
   queried once and then waited for their timeout, so a host that began serving
   a moment later — exactly what happens right after creating an invite — went
   unnoticed. Both now re-query every 2s while a request is outstanding, which
   is what the 0.5 client's discovery refresh did.

The first two were found by a test that failed while a hand-run probe passed;
the probe had a sleep in it. The sleep was hiding the third.

### What dead CI cost us

The CLI workflow had been failing on `main` every day for twelve consecutive
runs over a pnpm lockfile drift unrelated to this work. Because the unit job
gates everything downstream, the worker-spawn, scaffold-smoke and sidecar E2E
jobs were **skipped, not run** — for weeks. Fixing the lockfile as part of this
branch turned them back on, and they immediately found real breakage:

- The multi-writer scaffold crashed on its first `db-put`. It fed an object
  into a hyperschema string field, which the default Hyperbee store handles via
  `valueEncoding: 'json'`. That template had **never once executed** since the
  feature merged — it merged while CI was already red.
- `node --test test/*.test.js` relies on shell glob expansion that cmd.exe does
  not do, so the Windows job died the first time it ever ran.
- The desktop sidecar E2E still asserted the deleted `services.data` flag.

None of these were caused by the node work; all were exposed by it. The lesson
is not about any one bug: a red required check on `main` is not a nuisance, it
is a hole where regressions accumulate silently.

### Phase 4 — App-node developer experience — **done**

| # | Task | Status |
| --- | --- | --- |
| 1 | Pack authoring guide + `describe()`-driven peer proxy | Done — `peer.api`, `add-node-capability/SKILL.md` |
| 2 | `node-host` scaffold feature flag alongside `node-sync` | Done — node-cli only |
| 3 | Agent-pack skill: expose a capability, pair two apps | Done — `add-node-capability` + skill-rules entry |
| 4 | Two-app reference demo in `sandbox/` | Done — `sandbox/app-to-app-demo/` |

`peer.api` is built from the hello's descriptors, so it only ever exposes
methods the far side declared and a typo fails locally instead of becoming an
`UNKNOWN_METHOD` round trip. Each handle is a promise that is also an async
iterable, so a caller does not need to know in advance whether a method is
unary or streaming — but consuming one handle both ways throws rather than
quietly issuing two requests.

`node-host` is **node-cli only**. The plan's feature registry listed
`pear-desktop` too; the Pear worker variant is not built, and advertising a
platform the generator does not implement would be worse than a smaller flag.

Found while building the demo: `InviteStore.list()` returned expired and spent
invites because only `get()` filtered them. The dashboard would have shown dead
codes as live, and the node would have kept announcing their topics. `list()`
now returns only redeemable invites; `listAll()` exposes the rest for
diagnostics.

**Success criterion 1 is demonstrated end to end.** `sandbox/app-to-app-demo`
runs two apps that pair by invite with no Personal Node anywhere, showing a
unary call, a streaming call cancelled by the consumer breaking out, and a
`NOT_GRANTED` refusal for a method the invite never granted.

### Phase 5 — Later work

**Named app networks — done.** `joinNetwork(id, { grants, requested, approve })`
joins `hash('unstoppable:app:<id>:v2')` as both server and client, and pairs
with everyone else on it. This was the one Phase 5 item with a concrete gap
behind it: `discover()` is machine-local and invites are 1:1, so five devices
of one app would have needed ten codes.

Two decisions worth recording:

- **Membership is not a security boundary.** The topic derives from a
  guessable name, so anyone who knows the app can join. The network's `grants`
  are the ceiling and the actual boundary; `approve` is available per network
  for meshes that are not purely the user's own devices. The README says this
  plainly rather than leaving it implicit.
- **The pair request names its networks instead of reading `info.topics`.**
  Hyperswarm exposes the topics a connection came from, but upstream marks
  that field for removal. The receiver intersects the claimed list with its
  own, which is self-describing and leaks nothing — those topics are already
  announced on the DHT.

**Still deferred, deliberately:** capability discovery/directory, binary pack
channels for large artifacts, and node-to-node federation of packs. None has a
driving use case yet, and building them on spec would add public surface we
would then have to keep. Revisit when an app actually needs one.

---

## Risks and Open Questions

**Same-machine topic collision.** Once several app-nodes call `listen()`, they
all join the machine-local topic as server and greet each other. Mitigation:
`nodeType`/`roles` in the hello, plus a rule that a node never *initiates*
pairing toward a passively discovered peer — pairing is always driven by an
explicit `pair()`/invite or by the machine-local Personal Node lookup.
**Implemented in Phase 1**: only the Hyperswarm dialer (`info.client`) sends a
`pairRequest`, and `listen()` joins no topic unless one is passed. The residual
risk moves to Phase 2, where the Personal Node shell *does* join the
machine-local topic and must tolerate app-nodes appearing on it.

**Protomux migration risk.** This is the one place the clean break adds work
rather than removing it. Sharing a muxer between the control channel and
Corestore means a protocol bug can now stall replication, and Protomux channel
errors are harder to read than a malformed NDJSON line. Mitigation: keep the
control channel's messages JSON, and land Phase 1 with a replication-free
integration test before the sync pack attaches to the same muxer.

**Trust model drift.** Same-machine TOFU is defensible for a Personal Node on
your own box. It is wrong for an app-node reachable by invite. Non-local peers
must always get invite-scoped grants, never `defaultGrants`.

**Abuse when an app hosts for strangers.** Quotas today are per-app and assume a
cooperative local peer. An app-node exposed by invite needs per-peer rate limits
on calls, not just byte quotas on replication.

**Bare portability.** Core must stay free of `node:crypto`/`node:os`; the
existing `_loadOs`/`_loadEnv` shims in `protocol.js` move into core and need
tests running under Bare, not only Node.

*Confirmed the hard way.* The first real Bare execution — the headless smoke,
where the daemon is a Bare process — crashed on the first capability call:
`AbortController is not defined`. Bare has no such global, and every unit and
integration test runs under Node, where the platform class exists. Fixed with
a portable fallback in `src/abort.js` that prefers the platform class. The
headless smoke is currently the only test that executes core under Bare, so it
is the regression net for this whole class of bug — treat a smoke failure
after a core change as a portability signal first.

*Packaging broke the same way, for a related reason.* electron-packager
materializes **direct** `file:` dependencies but copies **transitive** ones as
raw symlinks pointing outside the bundle — so 0.5 packaged fine (its only link
was `unstoppable-node` itself) and the cutover, which introduced the first
transitive chain, produced a broken `.app` and on Linux a deref copy that
filled the runner's disk. Fixed with `install-links=true` in
`packages/node-desktop/.npmrc`; it belongs in the file rather than on a command
line because `npm ci` must agree with the lockfile `npm install` wrote.
The dev cost: edits to `node-core` no longer reach `node-desktop` through a
symlink, so a reinstall there is needed to pick them up.

*The smoke also caught two more cutover leaks:* `scripts/smoke.js` still
asserted the deleted `services.ai` flags, and `sandbox/node-demo/demo.js` — a
tracked CI fixture explicitly un-ignored inside the otherwise-gitignored
sandbox — still imported `@unstoppable/node-client`. The lesson generalises:
the consumer sweep for the cutover grepped packages, and CI fixtures living
under an ignored directory escaped it.

**Identity backup.** A stable identity is now something a user can lose. Export
must include it, and the docs must say what happens if it is lost (peers
re-pair).

**Release machinery.** The cutover also had to carry
`scripts/node-release-gate.mjs` and four workflows that referenced the deleted
`node-client` — the gate crashed on ENOENT before checking anything. The gate
now tracks the node line (node + core + both packs) and runs in two modes:
strict for release (a published tarball with `file:` deps is broken for
consumers), and a warning mode for PR CI (`NODE_RELEASE_GATE_UNPUBLISHED_OK`),
because until the 0.6 packages exist on npm the `file:` links are the only
workable state and a permanently red required check teaches people to ignore
CI. Release order once publishing: core → packs → shell, swapping `file:` to
semver as part of that release.

**One-shot cutover.** With no compat layer, Phase 2 must land the shell,
`node-desktop`, and the three scaffold generators together. Sequencing that as a
single branch is deliberate; splitting it leaves the repo broken in between.

---

## Success Criteria

1. An app embeds `@unstoppable-stack/node-core`, declares one capability, and a
   second app pairs with it by invite and calls that capability — with **no
   Personal Node running anywhere**.
2. `unstoppable-node` behaves identically to today from the CLI and dashboard,
   and is a thin composition over core and the two packs.
3. An app that only wants app-to-app RPC installs no storage stack.
4. One peer relationship is one connection, one muxer, one lifecycle.

### Verdicts

| # | Status | Evidence |
| --- | --- | --- |
| 1 | **Demonstrated** | `sandbox/app-to-app-demo` runs it end to end; `node-core` invite tests cover expiry, uses, revocation, and forged proofs |
| 2 | **Qualified** | CLI + headless behaviour covered by the shell suite and the Bare smoke; the dashboard's data layer is extracted and tested, but the Electron UI itself has never been launched |
| 3 | **Demonstrated** | `corestore`/`hyperbee`/`hyperdrive`/`hypercore` absent from core's install tree |
| 4 | **Demonstrated** | Single swarm + shared Protomux; the muxer-publication regression test and the Bare smoke exercise control + replication on one connection |

The one honest asterisk is criterion 2's dashboard: everything up to the DOM
is tested, the window itself is not. Launching `npm run dev:electron` once
closes it.
