# P2P notes consumer

A small application using `@unstoppable-stack/p2p` for identity, scoped invites,
RPC and streaming, and `@unstoppable-stack/p2p/sync` for Hyperbee replication.
The application owns its notes schema and handlers. It uses no Personal Node,
AI wrapper, model SDK, Memory or Search package.

From the repository root, using Node 22.17 or later:

```sh
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-notes
npm test --prefix examples/p2p-notes
npm run demo --prefix examples/p2p-notes
```

Repository development uses a local dependency link. Public consumers can install
`@unstoppable-stack/p2p@0.6.0-alpha.1` directly. The
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
