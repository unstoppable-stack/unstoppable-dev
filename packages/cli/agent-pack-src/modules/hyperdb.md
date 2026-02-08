---
id: hyperdb
name: HyperDB
category: module
requires: [hypercore, hyperswarm]
tags: [database, p2p, sync]
priority: high
---

# HyperDB

## Overview
HyperDB is a schema-driven P2P database built on Hyperbee (for P2P) or RocksDB (local). It uses a build step to generate collection and index definitions, then provides a query API over those indexed collections.

## Version Notes
- Latest on npm: 5.0.1 (checked 2026-02-05).
- HyperDB version not found in local sources; verify from project `package.json` in target app.
- Related dependency seen in local sources: `hyperschema` ^1.17.1 (qvac-health-dev).

## Installation
```bash
npm install hyperdb
```

## Quick Start
```js
import HyperDB from "hyperdb"
import def from "./spec/hyperdb/index.js"

const db = HyperDB.rocks("./my-rocks.db", def)
await db.insert("@example/members", { name: "maf", age: 37 })
await db.flush()

const maf = await db.get("@example/members", { name: "maf" })
console.log(maf)
```

## Core Concepts
- Builder step: use `hyperdb/builder` + `hyperschema` to define collections and indexes.
- Engines: `Hyperdb.bee()` for P2P (Hyperbee-backed) and `Hyperdb.rocks()` for local-only.
- Snapshots: queries run on snapshots; flush to persist changes.

## API Reference
- `Hyperdb.bee(hypercore, definition, [options])`
- `Hyperdb.rocks(path, definition, [options])`
- `db.insert(collection, doc)` / `db.delete(collection, query)`
- `db.find(collectionOrIndex, query, [options])`
- `db.flush()`

## Integration with Other Modules
- For P2P mode, use Hyperbee + Hypercore replication over Hyperswarm.
- Hypercore discovery key can be used to connect peers to the same DB state.

## Common Patterns
```js
// P2P engine
const db = HyperDB.bee(hypercore, def, { autoUpdate: true })
```

```js
// Query by index
const stream = db.find("@example/members-by-name", { gte: { name: "a" } })
const results = await stream.toArray()
```

## Pitfalls & Gotchas
- Inserts are staged in memory until `db.flush()` is called.
- P2P mode requires explicit replication of the underlying Hypercore/Hyperbee.

## Resources
- https://github.com/holepunchto/hyperdb
- https://github.com/holepunchto/hyperbee
