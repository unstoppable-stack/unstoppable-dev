---
name: add-p2p-rpc
description: Add request/response RPC over P2P connections using bare-rpc.
  Use when the user needs structured request/response communication between
  peers. Requires add-p2p-networking first.
---

# P2P RPC

## When to Use
- User needs request/response communication between peers
- User mentions "RPC", "remote procedure call", or "API between peers"
- User wants structured messaging over P2P connections

## Prerequisites
- Hyperswarm (`^4.16.0`) installed for P2P connections
- `bare-rpc` (`^1.1.0`) installed (works with any duplex stream)
- `.npmrc` must contain `shamefully-hoist=true` for bare native binary resolution

> **CRITICAL — Pear Desktop Apps:** `bare-rpc` and Hyperswarm CANNOT run in
> the renderer (browser context). They MUST run in a **worker process** started
> via `pear-run`. The UI communicates with the worker via NDJSON over
> `Pear.worker.pipe()`. See the `setup-pear-desktop` skill →
> `resources/worker-pattern.md` for the full worker bridge implementation.

## ⚠ IMPORTANT: bare-rpc Has a Low-Level API

The raw `bare-rpc` API is NOT a typical register/request RPC library. It uses:
- `new RPC(stream, handler)` — constructor requires BOTH a stream AND a request handler function
- `rpc.request(commandId: number)` — takes a **numeric** command ID, NOT a method name string
- Returns an `OutgoingRequest` object (not a Promise) — call `.send()` then `.reply()`
- `rpc.register()` does NOT exist
- `rpc.destroy()` does NOT exist — destroy the underlying socket instead

**Always use the wrapper pattern below** (or build your own). The raw API is too
low-level for application code.

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add hyperswarm bare-rpc
   ```

2. **Add `.npmrc`** (required for bare native binaries in pnpm):
   ```ini
   shamefully-hoist=true
   ```

3. **Add type declarations** for bare-rpc (see types.d.ts in full-example.md)

4. **Create RPC server/client wrappers** — these provide the friendly `register handlers / call methods` interface on top of bare-rpc's low-level numbered-command API

5. **Wire to swarm connections** — create one RPC server/client per peer connection

## Quick Implementation — RPC Wrapper

The wrapper provides a friendly `handlers + request` interface on top of bare-rpc.
This is the same pattern the QVAC SDK uses internally.

**Server side** (receives requests):

```ts
import RPC from 'bare-rpc'
import type { Duplex } from 'stream'

export function createRPCServer(socket: Duplex, config: {
  handlers?: Record<string, (params: any) => Promise<any>>
  streamHandlers?: Record<string, (params: any) => AsyncGenerator<any>>
  onError?: (error: Error, method: string) => void
}) {
  const { handlers = {}, streamHandlers = {}, onError = console.error } = config

  const rpc = new RPC(socket as any, async (req: RPC.IncomingRequest) => {
    let method = 'unknown'
    try {
      const envelope = JSON.parse(req.data.toString()) as { method: string; payload?: any }
      method = envelope.method || 'unknown'
      const payload = envelope.payload

      // Check stream handlers first
      if (streamHandlers[method]) {
        const stream = req.createResponseStream()
        try {
          for await (const item of streamHandlers[method](payload)) {
            stream.write(JSON.stringify(item) + '\n', 'utf-8')
          }
          stream.end()
        } catch (err) {
          stream.write(JSON.stringify({ type: 'error', error: String(err) }) + '\n', 'utf-8')
          stream.end()
          onError(err instanceof Error ? err : new Error(String(err)), method)
        }
        return
      }

      // Check request/reply handlers
      if (handlers[method]) {
        const response = await handlers[method](payload)
        req.reply(JSON.stringify(response), 'utf-8')
        return
      }

      req.reply(JSON.stringify({ type: 'error', error: `Unknown method: "${method}"` }), 'utf-8')
    } catch (err) {
      try { req.reply(JSON.stringify({ type: 'error', error: String(err) }), 'utf-8') } catch {}
      onError(err instanceof Error ? err : new Error(String(err)), method)
    }
  })

  return {
    destroy() { try { socket.destroy() } catch {} },
  }
}
```

**Client side** (sends requests):

```ts
export function createRPCClient(socket: Duplex) {
  let cmdId = 0
  // Client-side: empty handler (we don't receive unsolicited requests)
  const rpc = new RPC(socket as any, () => {})

  return {
    async request<T = any>(method: string, params?: any, timeoutMs = 10000): Promise<T> {
      const req = rpc.request(++cmdId)
      req.send(JSON.stringify({ method, payload: params }), 'utf-8')

      const replyPromise = req.reply('utf-8')
      const response = await (timeoutMs > 0
        ? Promise.race([replyPromise, new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error(`RPC "${method}" timed out`)), timeoutMs))])
        : replyPromise)

      const parsed = JSON.parse(response.toString())
      if (parsed?.type === 'error' && parsed?.error) throw new Error(parsed.error)
      return parsed as T
    },

    async *stream<T = any>(method: string, params?: any): AsyncGenerator<T> {
      const req = rpc.request(++cmdId)
      req.send(JSON.stringify({ method, payload: params }), 'utf-8')
      const rs = req.createResponseStream({ encoding: 'utf-8' })
      let buffer = ''
      for await (const chunk of rs as AsyncIterable<Buffer>) {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          const parsed = JSON.parse(line)
          if (parsed?.type === 'error') throw new Error(parsed.error)
          yield parsed as T
        }
      }
    },

    destroy() { try { socket.destroy() } catch {} },
  }
}
```

**Usage with Hyperswarm:**

```ts
import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'

const swarm = new Hyperswarm()

// Server side
swarm.on('connection', (socket, info) => {
  if (info.client) {
    // Client connection — send requests
    const client = createRPCClient(socket)
    const res = await client.request('ping', {})
    console.log('Ping:', res)
  } else {
    // Server connection — handle requests
    createRPCServer(socket, {
      handlers: {
        ping: async () => ({ ok: true, ts: Date.now() }),
        echo: async (params) => params,
      },
    })
  }

  socket.on('close', () => { /* cleanup app state */ })
  socket.on('error', () => { /* cleanup app state */ })
})

const topic = crypto.createHash('sha256').update('my-app:rpc-demo').digest()
const discovery = swarm.join(topic, { server: true, client: true })
await discovery.flushed()
```

## Key Design Decisions

- **Uses `{ method, payload }` envelope** — routing is by `method` field (NOT `type`)
  to avoid collisions with payload data that may have its own `type` property. This
  was a real bug discovered during development.
- **Cleanup calls `socket.destroy()`** — `bare-rpc` does NOT have a `destroy()` method.
  Resource cleanup is done by destroying the underlying stream.
- **One RPC server/client per peer connection** — do NOT create a global singleton.
- **Streaming uses NDJSON framing** over bare-rpc response streams (same as SDK).
- **Timeouts** — client requests default to 10s timeout. Pass 0 to disable.

## Key Gotchas
- `shamefully-hoist=true` required in `.npmrc` for bare native binaries in pnpm projects
- Both peers should join with `{ server: true, client: true }` for reliable mutual discovery
- Use `discovery.flushed()` (not `swarm.flush()`) to wait for topic announcements
- Always destroy the socket (not the RPC) on close/error — `rpc.destroy()` does NOT exist
- Use `method` (not `type`) in the envelope to avoid field collisions with payload data
- Create a new RPC server/client per peer connection (not shared globally)

## Deep Dive
- Full example with wrapper code and types: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`
