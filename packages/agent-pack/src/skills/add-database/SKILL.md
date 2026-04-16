---
name: add-database
description: Structured P2P database with HyperDB — schemas, indexes, multi-writer.
when_to_use: User needs a collaborative database with schema definitions, indexed queries, and multi-writer sync between peers.
paths: ["src/data/**", "src/db/**"]
version: "2026-04-14"
---

# Add Database (HyperDB)

## When to Use
- User needs a structured database with schema and queries
- User mentions "database", "schema", "index", "multi-writer", "collaborative data"
- User needs multiple peers writing to the same dataset
- User wants more structure than a simple key-value store (use `add-kv-storage` for that)

## Prerequisites
- Corestore and Hyperswarm installed
- Node.js, Bare, or Expo Bare runtime

> **CRITICAL — Pear Desktop Apps:** HyperDB CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Steps

1. **Install dependencies**:
   ```bash
   npm i hyperdb corestore hyperswarm
   ```

2. **Define your schema** in `src/data/schema.ts`:
   ```ts
   const schema = {
     name: 'my-app-db',
     fields: [
       { name: 'id', type: 'string', required: true },
       { name: 'title', type: 'string', required: true },
       { name: 'content', type: 'string' },
       { name: 'createdAt', type: 'number', required: true },
     ],
     indexes: [
       { name: 'by-title', fields: ['title'] },
     ],
   }
   ```

3. **Create the database** in `src/data/db.ts`:
   ```ts
   import HyperDB from 'hyperdb'
   import Corestore from 'corestore'

   const store = new Corestore('./storage')
   const db = new HyperDB(store, schema)
   await db.ready()
   ```

4. **CRUD operations**:
   ```ts
   // Create
   await db.put({ id: '1', title: 'Hello', content: 'World', createdAt: Date.now() })

   // Read
   const item = await db.get('1')

   // Query by index
   const results = await db.find({ title: 'Hello' })

   // Delete
   await db.del('1')
   ```

5. **Add P2P replication** (requires `add-p2p-networking`):
   ```ts
   import Hyperswarm from 'hyperswarm'

   const swarm = new Hyperswarm()
   swarm.on('connection', (socket) => {
     store.replicate(socket)
   })
   swarm.join(db.discoveryKey)
   ```

## HyperDB vs Hyperbee

| Feature | HyperDB | Hyperbee |
|---------|---------|----------|
| Schema | Yes (typed fields) | No (raw KV) |
| Indexes | Yes | No |
| Multi-writer | Yes | No (single writer) |
| Queries | Structured (find, filter) | Key-based only |
| Complexity | Higher | Lower |
| Best for | Collaborative apps, structured data | Simple KV, config, caches |

**Use HyperDB** for apps where multiple peers write data (notes, tasks, etc.).
**Use Hyperbee** (see `add-kv-storage`) for simple single-writer storage.

## Key Gotchas
- Always call `await db.ready()` before operations
- Replicate `store` (not `db`) over connections
- Multi-writer means conflicts can occur — HyperDB uses causal ordering
- Schema changes require careful migration planning
- Don't store large blobs in HyperDB — use Hyperdrive (`add-file-storage`) instead

## Critical Rules
- **Define schema before any operations** — HyperDB requires a schema upfront. Adding fields later requires migration
- **Don't mix HyperDB with Hyperbee patterns** — they have incompatible APIs. HyperDB uses `put(record)` with schema fields; Hyperbee uses `put(key, value)` pairs
- **Use indexes for queries** — querying without indexes scans all records. Define indexes in the schema for any field you'll query on
- **Replicate `store` not `db`** — always call `store.replicate(conn)`. HyperDB has no `replicate()` method
- **Don't store large blobs** — use Hyperdrive (`add-file-storage`) for files and binary data. HyperDB is for structured records
- **Handle multi-writer conflicts** — HyperDB uses causal ordering, but concurrent writes to the same record can produce multiple heads. Design your data model for conflict-free merges when possible
- **Always `await db.ready()`** — accessing the database before it's ready throws or returns undefined

## Validation
1. [ ] `npm i hyperdb corestore hyperswarm` installs without errors
2. [ ] Schema is defined and `await db.ready()` resolves
3. [ ] Insert works: `await db.put({ id: '1', title: 'Test', createdAt: Date.now() })` succeeds
4. [ ] Query works: `await db.get('1')` returns the inserted record
5. [ ] Index query works: `await db.find({ title: 'Test' })` returns matching records
6. [ ] Update works: putting a record with the same `id` updates it
7. [ ] Delete works: `await db.del('1')` removes the record
8. [ ] Replication syncs: writer inserts records, reader joins swarm and reads the same records

## Troubleshooting
- **`db.ready()` hangs or throws** — ensure the Corestore path is writable and not locked by another process
- **Queries return empty results** — check that the field is defined in the schema and has an index. Unindexed queries may not work as expected
- **Schema mismatch errors** — all peers must use the exact same schema definition. Mismatched schemas cause replication failures
- **Multi-writer conflicts** — use `db.heads()` or similar to inspect conflicting values. Design your app to handle multiple concurrent values
- **Data doesn't replicate** — ensure you're replicating the `store`, not the `db`. Check that both peers use `store.replicate(conn)`

> **Status**: Docs only. HyperDB documentation is based on official Holepunch
> docs. Not yet validated with a battle-tested reference app. Multi-writer
> replication and conflict resolution are the key unknowns.
