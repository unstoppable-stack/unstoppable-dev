---
name: add-database
description: Add a structured P2P database using HyperDB with schema
  definitions, indexes, and multi-writer support. Use when the user needs
  a collaborative database that syncs between peers.
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
   pnpm add hyperdb corestore hyperswarm
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

> **Status**: Docs only. HyperDB documentation is based on official Holepunch
> docs. Not yet validated with a battle-tested reference app. Multi-writer
> replication and conflict resolution are the key unknowns.
