# P2P Data Sync — Full Example

## Writer

```js
import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const core = new Hypercore('./writer-storage')
await core.ready()

const swarm = new Hyperswarm()
swarm.on('connection', (conn) => core.replicate(conn))
swarm.join(core.discoveryKey)

console.log('share key:', b4a.toString(core.key, 'hex'))

process.stdin.on('data', (data) => core.append(data))
```

## Reader

```js
import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const keyHex = process.argv[2]
const core = new Hypercore('./reader-storage', b4a.from(keyHex, 'hex'))
await core.ready()

const swarm = new Hyperswarm()
swarm.on('connection', (conn) => core.replicate(conn))
const discovery = swarm.join(core.discoveryKey, { server: true, client: true })
await discovery.flushed()

await core.update()
for await (const block of core.createReadStream({ start: core.length, live: true })) {
  console.log(block.toString())
}
```

## Variations

- Replace Hypercore with Hyperbee to store key-value state instead of a raw log.
- Use a shared topic (Hyperswarm) instead of direct keys if you need many writers.
- Use `core.download({ start: 0, end: -1 })` for full replication when online.
