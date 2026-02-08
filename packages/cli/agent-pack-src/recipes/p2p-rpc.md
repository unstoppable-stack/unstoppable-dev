---
id: p2p-rpc
name: P2P RPC
category: recipe
requires: [hyperswarm]
tags: [rpc, communication, p2p]
---

# Recipe: P2P RPC Over Streams

## Problem

Send request/response messages over encrypted P2P connections with
production-ready behavior.

## Prerequisites

- Hyperswarm installed.
- `bare-rpc` installed — works with any duplex stream.
- `.npmrc` must contain `shamefully-hoist=true` for bare native binary resolution in pnpm.
- For advanced multiplexing: `@hyperswarm/secret-stream`, `protomux`, `compact-encoding`.

## Solution

### ⚠ IMPORTANT: Raw bare-rpc API is Low-Level

The raw `bare-rpc` API uses:
- `new RPC(stream, handler)` — constructor needs BOTH stream AND handler
- `rpc.request(commandId: number)` — numeric command ID, NOT a method string
- `OutgoingRequest.send()`, `.reply()` — not a simple Promise-based interface
- **No `register()`**, **no `request(method_string)`**, **no `destroy()`**

Always use the `createRPCServer` / `createRPCClient` wrapper pattern.

```bash
pnpm add hyperswarm bare-rpc
```

### Step 1: Create RPC wrapper (recommended)

Use the wrapper from `skill-p2p-rpc` that provides a friendly
`handlers + request` interface. This is the same pattern the QVAC SDK uses.

```ts
import { createRPCServer, createRPCClient } from './lib/p2p-rpc.js'
```

### Step 2: Wire to swarm connections

```ts
import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'

const swarm = new Hyperswarm()

swarm.on('connection', (socket, info) => {
  if (info.client) {
    const client = createRPCClient(socket)
    const res = await client.request('ping', {})
    console.log('Ping:', res)
    socket.on('close', () => client.destroy())
    socket.on('error', () => client.destroy())
  } else {
    const server = createRPCServer(socket, {
      handlers: {
        ping: async () => ({ ok: true, ts: Date.now() }),
        echo: async (params) => params,
      },
    })
    socket.on('close', () => server.destroy())
    socket.on('error', () => server.destroy())
  }
})
```

### Step 3: Join topic with proper flags

For reliable mutual discovery, use `{ server: true, client: true }` on both sides,
OR explicit roles: one side `{ server: true, client: false }`, other `{ server: false, client: true }`.

```ts
const topic = crypto.createHash('sha256').update('my-app:rpc-demo').digest()
const discovery = swarm.join(topic, { server: true, client: true })
await discovery.flushed()  // NOT swarm.flush()
```

## Full Example

```ts
import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'
import { createRPCServer, createRPCClient } from './lib/p2p-rpc.js'

const swarm = new Hyperswarm()
const peers = new Map<string, ReturnType<typeof createRPCClient>>()

swarm.on('connection', async (socket, info) => {
  const peerId = info.publicKey?.toString('hex').slice(0, 8) ?? 'unknown'

  if (info.client) {
    const client = createRPCClient(socket)
    peers.set(peerId, client)

    try {
      const pong = await client.request('ping')
      console.log('Ping:', pong)
    } catch (err) {
      console.error('Error:', err)
    }

    socket.on('close', () => { client.destroy(); peers.delete(peerId) })
    socket.on('error', () => { client.destroy(); peers.delete(peerId) })
  } else {
    const server = createRPCServer(socket, {
      handlers: {
        ping: async () => ({ ok: true, ts: Date.now() }),
        echo: async (params) => params,
      },
      onError: (err, method) => console.error(`RPC error [${method}]:`, err.message),
    })

    socket.on('close', () => server.destroy())
    socket.on('error', () => server.destroy())
  }
})

const topic = crypto.createHash('sha256').update('my-app:rpc').digest()
const discovery = swarm.join(topic, { server: true, client: true })
await discovery.flushed()
```

## Key Design Decisions

- **`{ method, payload }` envelope**: Use `method` for routing, NOT `type`. The `type`
  field commonly collides with application payload data (e.g., `type: 'order'` in the
  payload overwrites the routing `type: 'submitOrder'`). This was a real bug.
- **`socket.destroy()` for cleanup**: `bare-rpc` has NO `destroy()` method. Clean up
  by destroying the underlying stream.
- **One server/client per connection**: Create a new RPC instance per peer, not a
  global singleton.

## Variations

### Variation 1: Protomux for advanced multiplexing

If you need multiple protocols on a single connection, use Protomux with
`@hyperswarm/secret-stream` and `compact-encoding`. See `skill-p2p-rpc` for full code.

### Variation 2: NDJSON for simple messaging

If you only need fire-and-forget JSON messages, use newline-delimited JSON framing.

## Troubleshooting

### Problem: `TypeError: rpc.register is not a function`

**Symptoms**: Code uses `rpc.register()` or `rpc.request('method')`.
**Solution**: These methods do NOT exist on bare-rpc. Use the `createRPCServer` /
`createRPCClient` wrapper pattern instead.

### Problem: `Error: No binaries found for target 'darwin-arm64'`

**Symptoms**: Runtime error after successful `pnpm install`.
**Solution**: Add `shamefully-hoist=true` to `.npmrc`, then `pnpm install` again.

### Problem: Peers never connect

**Symptoms**: No connections established.
**Solution**: Both peers must join with `{ server: true, client: true }` or matching
server/client roles. Use `await discovery.flushed()` (not `await swarm.flush()`).

### Problem: Requests hang forever

**Symptoms**: Promises never resolve.
**Solution**: Ensure the server has a handler for the method. Add timeouts. Destroy
sockets on close/error.

### Problem: `type` field collision in messages

**Symptoms**: Server receives wrong routing because payload has its own `type` field.
**Solution**: Use `{ method, payload }` envelope format, not `{ type, ...data }`.

## Related

- `output/recipes/secure-communication.md`
