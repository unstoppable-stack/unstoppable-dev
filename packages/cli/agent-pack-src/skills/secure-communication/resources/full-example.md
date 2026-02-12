# Secure Communication — Full Example

```js
import Hyperswarm from 'hyperswarm'
import Protomux from 'protomux'
import c from 'compact-encoding'

const swarm = new Hyperswarm()

swarm.on('connection', (socket) => {
  // Hyperswarm connections are already encrypted via @hyperswarm/secret-stream.
  // Get the shared Protomux instance from the socket:
  const mux = Protomux.from(socket)

  const channel = mux.createChannel({
    protocol: 'chat',
    // CRITICAL: Send first message in onopen, NOT after channel.open().
    // channel.open() is non-blocking — it initiates a handshake.
    // Messages sent before onopen fires are SILENTLY DROPPED.
    onopen() {
      msg.send('hello encrypted')
    },
    onclose() {
      console.log('channel closed')
    },
  })

  const msg = channel.addMessage({
    encoding: c.string,
    onmessage: (m) => console.log('recv:', m),
  })

  channel.open()
  // DO NOT send messages here — the channel handshake hasn't completed yet!
})

const topic = Buffer.alloc(32).fill('secure-chat')
swarm.join(topic, { server: true, client: true })
```

> **WARNING:** `channel.open()` is asynchronous. It only initiates the Protomux
> handshake. Messages sent immediately after `open()` will be silently dropped.
> Always send your first message inside the `onopen` callback.

## Protomux + Corestore on the Same Socket

Both Protomux and Corestore use Protomux internally. They can share the same
connection — use `Protomux.from(socket)` to get the shared mux instance:

```js
swarm.on('connection', (socket) => {
  // Your custom chat/RPC channels
  const mux = Protomux.from(socket)
  const channel = mux.createChannel({ protocol: 'my-chat', onopen() { /* ... */ } })
  channel.open()

  // Corestore replication (adds its own Protomux channels automatically)
  store.replicate(socket)
})
```

## Variations

- Use `SecretStream.keyPair(seed)` to make deterministic identities
- Implement request/response on top of Protomux for RPC-style APIs (see `/p2p-rpc`)
- Add multiple channels for different protocol concerns (data, control, media)
