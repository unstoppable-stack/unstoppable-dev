# Offline-First App — Full Example

> **Legacy custom transport/storage reference only.** New apps use
> `@unstoppable-stack/p2p` through `/service`, `/rpc`, `/data` or `/sync`.
> Read the parent skill first. These snippets do not implement the library
> protocol or its pairing/grants; do not layer them around managed helpers.


```js
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'

const core = new Hypercore('./db')
const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
await db.ready()

// Local-first write
await db.put('profile', { name: 'Ava', updatedAt: Date.now() })

// Background sync
const swarm = new Hyperswarm()
swarm.on('connection', (conn) => core.replicate(conn))
swarm.join(core.discoveryKey)

// Coordinate initial sync
const done = core.findingPeers()
await swarm.flush().then(done, done)
await core.update({ wait: true })

// Live updates
for await (const [current] of db.watch()) {
  console.log('synced version:', current.version)
}
```

## Variations

- Use Hyperdrive to cache files for offline reading and download blobs on demand.
- Use `core.download({ start: 0, end: -1 })` for full replication when online.
- Combine with QVAC for offline AI + offline data.
