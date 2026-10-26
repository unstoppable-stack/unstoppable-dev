# Minimal Notes example

The full Notes product (mobile, desktop, audio, Library UI, product plan and
native/device tests) now lives in the private organization repository
[unstoppable-stack/unstoppable-notes](https://github.com/unstoppable-stack/unstoppable-notes).
Organization access is required. This folder is the small public integration example.

```sh
# From the stack repository root, with Node 22.17+:
npm ci --prefix examples/unstoppable-notes
npm test --prefix examples/unstoppable-notes
# Or: npm run demo --prefix examples/unstoppable-notes
```

The demo uses published `@unstoppable-stack/p2p@0.6.0-alpha.4` and its managed
JSON API. It saves a synthetic text note, reopens the writer, downloads a known
checkpoint into a second device directory, then reopens that replica with the
writer offline. Assertions verify the actual note contents. Temporary data and
both peers are cleaned up. No stack package link, model download or account is needed.

It runs two native Node peers on one machine using an isolated loopback DHT.
It does not establish phone support, cross-network discovery, audio sync,
collaborative editing, AI quality or app-store readiness. The collection has a
single writer. Dataset keys grant read access and must be shared only with
intended readers; this demo is not the product's scoped device-pairing flow.

Use [managed data](../p2p-data/README.md) for more JSON examples or
[P2P notes](../p2p-notes/README.md) for scoped capability calls and existing
Hyperbee replication. Runtime support boundaries remain in
[validation](../../docs/validation.md).
