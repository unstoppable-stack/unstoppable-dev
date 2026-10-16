# Collaborative notes database (experimental)

A runnable Node example of `@unstoppable-stack/p2p/db` with Autobase 7.28.2.
It uses real paired P2P connections over an isolated loopback DHT. No public
bootstrap, Personal Node, AI, account or model is needed.

From the repository root with Node 22.17 or later:

```sh
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-database
npm run demo --prefix examples/p2p-database
npm test --prefix examples/p2p-database
```

The example uses the local P2P source link because `/db` is new in the
`0.6.0-alpha.2` candidate; the published `0.6.0-alpha.1` has no `/db` export.
After that candidate is published, an external app can install
`@unstoppable-stack/p2p@0.6.0-alpha.2 autobase@7.28.2 corestore hyperbee`.
Autobase is an explicit opt-in dependency, separate from ordinary RPC/sync apps.

Follow [scenario.js](./scenario.js) from top to bottom:

1. Alice creates a dataset; Bob opens it with the dataset key as a reader.
2. They pair. Alice separately approves Bob's database writer key. Pairing
   alone does not confer write authority.
3. Both transports close. Each device appends its own note and a conflicting
   replacement for `shared`. Receipts say `local-applied`, not replicated.
4. Both databases and nodes restart from disk. They reconnect using their saved
   identities, exchange writer logs, and agree on all notes and the conflict.
5. Alice removes Bob. After synchronizing that membership change Bob becomes
   read-only; he still retains downloaded data.

[notes.js](./notes.js) owns validation and the deterministic Hyperbee reducer.
Autobase orders operations; the app chooses ordered replacement when two devices
write the same note. There is no wall-clock conflict rule or rich-text merging.
The scenario prints the winning text without assuming which concurrent writer
wins. Temporary identities, keys and data are deleted on completion.

The founder is the only membership administrator and indexer. Offline delegated
writers can append, while stable checkpoint progress depends on the founder.
There is no administrator recovery, schema migration, complete backup, key
rotation or per-row authorization. This isolated demo shares dataset keys
directly in memory and does not encrypt its disposable data; production key
distribution must be an authenticated app flow. `/sync` does not yet support an
Autobase resource graph. Bare, desktop and mobile acceptance for `/db` remains
unverified. See the [database guide](../../packages/p2p/docs/db.md).

For unary/streaming services and single-owner replication, start with the
[notes RPC/sync example](../p2p-notes/README.md). For offline checkout and scoped
receipt retrieval in a desktop worker, see [Local Goods](../ecommerce-assistant/README.md).
