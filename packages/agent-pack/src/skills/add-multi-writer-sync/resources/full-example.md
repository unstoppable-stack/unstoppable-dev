# Full Two-Peer Autobase Example

A complete example of two peers sharing a key-value store via Autobase.

## Shared Code

```js
// shared.js
const Corestore = require('corestore')
const Autobase = require('autobase')
const Hyperbee = require('hyperbee')
const Hyperswarm = require('hyperswarm')

async function createPeer(storagePath, bootstrapKey = null) {
  const store = new Corestore(storagePath)

  const base = new Autobase(store, bootstrapKey, {
    open(store) {
      return new Hyperbee(store.get('shared-kv'), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
        extension: false,
      })
    },

    async apply(nodes, view, host) {
      for (const node of nodes) {
        if (node.value === null) continue
        const op = JSON.parse(node.value.toString())

        switch (op.type) {
          case 'add-writer':
            await host.addWriter(Buffer.from(op.key, 'hex'), {
              indexer: !!op.indexer,
            })
            break
          case 'put':
            await view.put(op.key, op.value)
            break
          case 'del':
            await view.del(op.key)
            break
        }
      }
    },

    ackInterval: 5000,
    ackThreshold: 0,
  })

  await base.ready()

  const swarm = new Hyperswarm()
  swarm.join(base.discoveryKey)
  swarm.on('connection', (conn) => store.replicate(conn))

  return { store, base, swarm }
}

module.exports = { createPeer }
```

## Peer 1 (Creator)

```js
// peer1.js
const { createPeer } = require('./shared')

async function main() {
  const { base, swarm } = await createPeer('./data-peer1')

  console.log('=== Peer 1 (Creator) ===')
  console.log('Base key:', base.key.toString('hex'))
  console.log('Writer key:', base.local.key.toString('hex'))

  // Write some initial data
  await base.append(JSON.stringify({
    type: 'put',
    key: 'greeting',
    value: { message: 'Hello from Peer 1', timestamp: 'init' },
  }))

  console.log('Wrote initial data. Waiting for connections...')
  console.log('Share these with Peer 2:')
  console.log('  Base key:', base.key.toString('hex'))

  // Listen for new writer requests on stdin
  process.stdin.on('data', async (data) => {
    const writerKey = data.toString().trim()
    if (writerKey.length === 64) {
      console.log('Adding writer:', writerKey)
      await base.append(JSON.stringify({
        type: 'add-writer',
        key: writerKey,
        indexer: true,
      }))
      console.log('Writer added!')
    }
  })

  // Periodically show the view
  setInterval(async () => {
    await base.update()
    console.log('\n--- View (Peer 1) ---')
    for await (const entry of base.view.createReadStream()) {
      console.log(`  ${entry.key} = ${JSON.stringify(entry.value)}`)
    }
    console.log(`Signed length: ${base.signedLength}`)
  }, 5000)

  process.on('SIGINT', async () => {
    await swarm.destroy()
    await base.close()
    process.exit(0)
  })
}

main().catch(console.error)
```

## Peer 2 (Joiner)

```js
// peer2.js
const { createPeer } = require('./shared')

async function main() {
  const bootstrapKey = process.argv[2]
  if (!bootstrapKey) {
    console.error('Usage: node peer2.js <base-key>')
    process.exit(1)
  }

  const { base, swarm } = await createPeer(
    './data-peer2',
    Buffer.from(bootstrapKey, 'hex')
  )

  console.log('=== Peer 2 (Joiner) ===')
  console.log('Writer key:', base.local.key.toString('hex'))
  console.log('Give this key to Peer 1 to add you as a writer.')

  base.on('is-indexer', async () => {
    console.log('\nI am now an indexer! Writing data...')

    await base.append(JSON.stringify({
      type: 'put',
      key: 'greeting-p2',
      value: { message: 'Hello from Peer 2!' },
    }))

    await base.append(JSON.stringify({
      type: 'put',
      key: 'counter',
      value: { count: 42 },
    }))

    console.log('Data written by Peer 2.')
  })

  // Periodically show the view
  setInterval(async () => {
    await base.update()
    console.log('\n--- View (Peer 2) ---')
    for await (const entry of base.view.createReadStream()) {
      console.log(`  ${entry.key} = ${JSON.stringify(entry.value)}`)
    }
    console.log(`Signed length: ${base.signedLength}`)
  }, 5000)

  process.on('SIGINT', async () => {
    await swarm.destroy()
    await base.close()
    process.exit(0)
  })
}

main().catch(console.error)
```

## Running the Example

Terminal 1:
```bash
node peer1.js
# Outputs: Base key: abc123...
# Outputs: Writer key: def456...
```

Terminal 2:
```bash
node peer2.js abc123...
# Outputs: Writer key: ghi789...
```

Terminal 1 (paste Peer 2's writer key):
```
ghi789...
# Outputs: Adding writer: ghi789...
# Outputs: Writer added!
```

Terminal 2 will show:
```
I am now an indexer! Writing data...
Data written by Peer 2.
```

Both terminals will converge to the same view:
```
--- View ---
  counter = {"count":42}
  greeting = {"message":"Hello from Peer 1","timestamp":"init"}
  greeting-p2 = {"message":"Hello from Peer 2!"}
Signed length: 5
```

## Key Observations

1. **Same view on both peers** — despite writing independently, the Hyperbee
   view converges to identical state
2. **Signed length advances** — once both indexers ack, the ordering becomes
   permanent
3. **Offline resilience** — kill one peer, write on the other, restart —
   the views will merge when they reconnect
4. **Read-only clients** could replicate `base.view.core` and query without
   being writers
