# File Sharing — Full Example

## Writer

```js
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Localdrive from 'localdrive'

const store = new Corestore('./storage')
const drive = new Hyperdrive(store)
await drive.ready()

const swarm = new Hyperswarm()
swarm.on('connection', (conn) => store.replicate(conn))
swarm.join(drive.discoveryKey)

const local = new Localdrive('./shared')
await local.mirror(drive).done()

console.log('drive key:', drive.key.toString('hex'))
```

## Reader

```js
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Localdrive from 'localdrive'
import b4a from 'b4a'

const key = b4a.from(process.argv[2], 'hex')
const store = new Corestore('./storage')
const drive = new Hyperdrive(store, key)
await drive.ready()

const swarm = new Hyperswarm()
swarm.on('connection', (conn) => store.replicate(conn))
swarm.join(drive.discoveryKey)

const local = new Localdrive('./received')
await drive.mirror(local).done()
```

## Variations

- Use `drive.watch()` to update mirrors on change automatically
- Use `drive.download('/')` to prefetch all files for offline use
- Use `mirror-drive` for more control over the mirroring process
