# P2P notes consumer

For the simplest JSON sharing API, start with [managed data examples](../p2p-data/README.md). This example retains advanced composition/custom data behavior.

A small application using `@unstoppable-stack/p2p` for identity and scoped invites,
`@unstoppable-stack/p2p/rpc` for validated calls and streams, and `@unstoppable-stack/p2p/sync` for Hyperbee replication.
The application owns its notes schema and handlers. It uses no Personal Node,
AI wrapper, model SDK, Memory or Search package.

From the repository root, using Node 22.17 or later:

```sh
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-notes
npm test --prefix examples/p2p-notes
npm run demo --prefix examples/p2p-notes
```

Repository development uses a local dependency link. Published `@unstoppable-stack/p2p@0.6.0-alpha.1` supports plain RPC and sync.
This updated typed example needs the alpha.2 source or candidate tarball until
alpha.2 publication. The
[canonical release checks](../../docs/public-release.md) copy this example outside
the checkout and test exact tarballs or public-registry versions instead of the link.

The demo runs two peers over an isolated loopback DHT, replicates a real note,
disconnects the writer, and reads the replica. The tests additionally check
streaming, denied access, a later update, persisted identity and reading after
the replica restarts while the writer remains offline. No public DHT or model
download is required. These checks do not establish public-internet discovery,
multiwriter conflict resolution or production security acceptance.

Node 20 consumers are checked separately with:

```sh
cd examples/p2p-notes
node --test --test-concurrency=1 test/notes.test.js
```

## Follow the API

[src/contract.js](./src/contract.js) is a pure shared application contract:
`defineCapability`, `procedure.input().query()` and `procedure.stream()`.
The host supplies storage handlers in [src/notes.js](./src/notes.js); a paired
client binds `peer.client(notesContract)`, then uses `await api.get({ name })`
or `for await (const entry of api.list())`. Invalid names fail with
`INVALID_INPUT`; invitations still limit which procedures may run.

The demo first reads and streams through RPC. The replica then explicitly grants
sync administration to the paired writer, receives its manifest and keeps a
local copy after the writer closes. RPC permission and dataset replication are
separate choices. This example uses `/rpc` from the `0.6.0-alpha.2` candidate;
published `0.6.0-alpha.1` supports the original plain-pack calls and sync only.

For collaborative offline writes and Autobase membership, run the separate
[database example](../p2p-database/README.md). For scoped desktop receipt queries
without database replication, see [Local Goods](../ecommerce-assistant/README.md).
