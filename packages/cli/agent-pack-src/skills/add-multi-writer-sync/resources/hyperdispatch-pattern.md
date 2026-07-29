# Hyperdispatch Pattern for Typed Operations

## Overview

For production Autobee apps, use **Hyperdispatch** + **Hyperschema** for
typed, binary-encoded operations instead of raw JSON. This gives you:

- Type-safe operation encoding/decoding
- Compact binary wire format
- Automatic routing in the `apply` handler
- Schema evolution support

This is the pattern used by the QVAC registry server.

## Installation

```bash
npm i hyperdispatch hyperschema
```

## Step 1: Define Your Schema

Create a schema directory with your operations:

```
schemas/
├── index.js           # Schema builder
└── my-app/
    ├── put-item.js    # Operation: add/update an item
    ├── delete-item.js # Operation: delete an item
    └── add-indexer.js # Operation: promote a writer
```

Each operation file defines its fields using Hyperschema types:

```js
// schemas/my-app/put-item.js
module.exports = {
  id: 'string',
  name: 'string',
  data: 'buffer',
}
```

## Step 2: Build the Schema

```js
// schemas/index.js
const Hyperschema = require('hyperschema')
const Hyperdispatch = require('hyperdispatch')

const schema = Hyperschema.from('./schemas')
const dispatch = Hyperdispatch.from(schema)

// Register operations
dispatch.register('@my-app/put-item', require('./my-app/put-item'))
dispatch.register('@my-app/delete-item', require('./my-app/delete-item'))
dispatch.register('@my-app/add-indexer', require('./my-app/add-indexer'))

module.exports = schema
```

## Step 3: Encode Operations

```js
const { encode } = schema.hyperdispatchSpec

// Encode a typed operation to a binary buffer
const buf = encode('@my-app/put-item', {
  id: 'item-123',
  name: 'Coffee Beans',
  data: Buffer.from('extra metadata'),
})

// Append to Autobee
await db.append(buf)
```

## Step 4: Route in Apply

```js
const { Router } = schema.hyperdispatchSpec

const router = new Router()

router.add('@my-app/put-item', async (data, ctx) => {
  // hyperbee2 batch API — Autobee views have no view.put()
  const w = ctx.view.write()
  w.tryPut(b4a.from(data.id), encodeValue(data))
  await w.flush()
})

router.add('@my-app/delete-item', async (data, ctx) => {
  const w = ctx.view.write()
  w.tryDelete(b4a.from(data.id))
  await w.flush()
})

router.add('@my-app/add-indexer', async (data, ctx) => {
  // `isIndexer` — Autobee's spelling (Autobase used `indexer`)
  await ctx.host.addWriter(b4a.from(data.key, 'hex'), { isIndexer: true })
})

// In the Autobee apply function:
async function apply (nodes, view, host) {
  for (const node of nodes) {
    await router.dispatch(node.value, { view, host })
  }
}
```

## Benefits over Raw JSON

| Aspect | JSON | Hyperdispatch |
|---|---|---|
| Size | Large (strings, keys repeated) | Compact binary |
| Type safety | None (parse and hope) | Schema-enforced |
| Routing | Manual switch/if | Automatic dispatch |
| Evolution | Breaking changes easy | Schema versioning |
| Speed | JSON.parse overhead | Direct buffer decode |

## When to Use

- **Prototyping**: JSON is fine. Faster to iterate.
- **Production**: Hyperdispatch for type safety, performance, and schema evolution.
- **QVAC registry pattern**: The reference implementation uses Hyperdispatch
  for all operations (put-model, delete-model, add-indexer, put-license).

## Key Rule

The `apply` function must still be deterministic regardless of encoding.
Hyperdispatch handles encoding/decoding, but the handler logic must follow
the same idempotent, side-effect-free rules as with JSON operations.
