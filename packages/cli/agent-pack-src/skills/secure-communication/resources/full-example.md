# Secure Communication — Full Example

```js
import Hyperswarm from 'hyperswarm'
import SecretStream from '@hyperswarm/secret-stream'
import Protomux from 'protomux'
import c from 'compact-encoding'

const swarm = new Hyperswarm()

swarm.on('connection', (conn, info) => {
  const secure = new SecretStream(info.client, conn)
  const mux = new Protomux(secure)

  const channel = mux.createChannel({ protocol: 'chat' })
  const msg = channel.addMessage({
    encoding: c.string,
    onmessage: (m) => console.log('recv:', m),
  })

  channel.open()
  msg.send('hello encrypted')
})

const topic = Buffer.alloc(32).fill('secure-chat')
swarm.join(topic, { server: true, client: true })
```

## Variations

- Use `SecretStream.keyPair(seed)` to make deterministic identities
- Implement request/response on top of Protomux for RPC-style APIs (see `/p2p-rpc`)
- Add multiple channels for different protocol concerns (data, control, media)
