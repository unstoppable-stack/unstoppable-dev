# P2P RPC — Full Example

> **Legacy custom transport/storage reference only.** New apps use
> `@unstoppable-stack/p2p` through `/service`, `/rpc`, `/data` or `/sync`.
> Read the parent skill first. These snippets do not implement the library
> protocol or its pairing/grants; do not layer them around managed helpers.


## TypeScript Type Declarations for bare-rpc

Create a `types.d.ts` file:

```ts
// types.d.ts — correct bare-rpc types (modeled from @qvac/sdk usage)
declare module 'bare-rpc' {
  namespace RPC {
    interface OutgoingRequest {
      send(data: string, encoding: 'utf-8' | 'ascii' | 'binary'): void
      reply(encoding: 'utf-8' | 'ascii' | 'binary'): Promise<Buffer>
      createResponseStream(opts?: { encoding?: 'utf-8' | 'ascii' | 'binary' }): AsyncIterable<Buffer>
    }
    interface IncomingRequest {
      data: Buffer
      reply(data: string, encoding: 'utf-8' | 'ascii' | 'binary'): void
      createResponseStream(): {
        write(data: string, encoding: 'utf-8' | 'ascii' | 'binary'): void
        end(): void
      }
    }
  }
  class RPC {
    constructor(stream: any, handler: (req: RPC.IncomingRequest) => void)
    request(command: number): RPC.OutgoingRequest
  }
  export default RPC
}
```

**IMPORTANT**: The raw API has NO `register()`, NO `request(method_string)`, and
NO `destroy()`. These are common misconceptions. Always use a wrapper.

## Complete RPC Wrapper Module

This is the recommended approach — a high-level abstraction over bare-rpc's low-level
numbered-command API. Same pattern the QVAC SDK uses internally.

```ts
// src/lib/p2p-rpc.ts
import RPC from 'bare-rpc'
import type { Duplex } from 'stream'

// ─── Types ──────────────────────────────────────────────────────────────

export type RPCHandler<TReq = any, TRes = any> = (params: TReq) => Promise<TRes> | TRes
export type RPCStreamHandler<TReq = any, TRes = any> = (params: TReq) => AsyncGenerator<TRes>

export interface RPCServerConfig {
  handlers?: Record<string, RPCHandler>
  streamHandlers?: Record<string, RPCStreamHandler>
  onError?: (error: Error, method: string) => void
}

export interface RPCServerInstance {
  destroy(): void
}

export interface RPCClientInstance {
  request<TRes = any>(method: string, params?: any, timeoutMs?: number): Promise<TRes>
  stream<TRes = any>(method: string, params?: any): AsyncGenerator<TRes>
  destroy(): void
}

// ─── Server ─────────────────────────────────────────────────────────────

export function createRPCServer(
  socket: Duplex,
  config: RPCServerConfig,
): RPCServerInstance {
  const {
    handlers = {},
    streamHandlers = {},
    onError = (err, type) => console.error(`[RPC Server] Error in "${type}":`, err),
  } = config

  // Envelope format: { method: string, payload: any }
  // Using "method" (not "type") avoids collisions with payload fields
  // that commonly have their own "type" property.

  const rpc = new RPC(socket as any, async (req: RPC.IncomingRequest) => {
    let method = 'unknown'
    try {
      const rawData = req.data?.toString()
      if (!rawData) {
        req.reply(JSON.stringify({ type: 'error', error: 'No data received' }), 'utf-8')
        return
      }

      const envelope = JSON.parse(rawData) as { method: string; payload?: unknown }
      method = envelope.method || 'unknown'
      const payload = envelope.payload

      // Check stream handlers first
      if (streamHandlers[method]) {
        const stream = req.createResponseStream()
        try {
          const generator = streamHandlers[method](payload)
          for await (const response of generator) {
            stream.write(JSON.stringify(response) + '\n', 'utf-8')
          }
          stream.end()
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          stream.write(JSON.stringify({ type: 'error', error: errorMsg }) + '\n', 'utf-8')
          stream.end()
          onError(error instanceof Error ? error : new Error(errorMsg), method)
        }
        return
      }

      // Check request/reply handlers
      if (handlers[method]) {
        const response = await handlers[method](payload)
        req.reply(JSON.stringify(response), 'utf-8')
        return
      }

      // No handler found
      req.reply(JSON.stringify({ type: 'error', error: `Unknown RPC method: "${method}"` }), 'utf-8')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      try { req.reply(JSON.stringify({ type: 'error', error: errorMsg }), 'utf-8') } catch {}
      onError(error instanceof Error ? error : new Error(errorMsg), method)
    }
  })

  return {
    destroy() {
      // bare-rpc has no destroy(); cleanup via the underlying stream
      try { socket.destroy() } catch {}
    },
  }
}

// ─── Client ─────────────────────────────────────────────────────────────

export function createRPCClient(socket: Duplex): RPCClientInstance {
  let commandCounter = 0

  // Client-side RPC: empty handler (we don't receive unsolicited requests)
  const rpc = new RPC(socket as any, () => {})

  async function request<TRes = any>(
    method: string,
    params?: any,
    timeoutMs = 10000,
  ): Promise<TRes> {
    const req = rpc.request(++commandCounter)
    req.send(JSON.stringify({ method, payload: params }), 'utf-8')

    const replyPromise = req.reply('utf-8')
    const response = await (timeoutMs > 0
      ? Promise.race([
          replyPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RPC request "${method}" timed out after ${timeoutMs}ms`)), timeoutMs)),
        ])
      : replyPromise)

    const parsed = JSON.parse(response.toString()) as TRes & { type?: string; error?: string }
    if (parsed && typeof parsed === 'object' && (parsed as any).type === 'error' && (parsed as any).error) {
      throw new Error((parsed as any).error)
    }
    return parsed
  }

  async function* stream<TRes = any>(method: string, params?: any): AsyncGenerator<TRes> {
    const req = rpc.request(++commandCounter)
    req.send(JSON.stringify({ method, payload: params }), 'utf-8')
    const responseStream = req.createResponseStream({ encoding: 'utf-8' })
    let buffer = ''

    for await (const chunk of responseStream as AsyncIterable<Buffer>) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        const parsed = JSON.parse(line)
        if (parsed?.type === 'error' && parsed?.error) throw new Error(parsed.error)
        yield parsed as TRes
      }
    }
  }

  return {
    request,
    stream,
    destroy() {
      try { socket.destroy() } catch {}
    },
  }
}
```

## Complete Usage Example

```ts
// src/index.ts
import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'
import { createRPCServer, createRPCClient } from './lib/p2p-rpc.js'

// ─── Server App ──────────────────────────────────────────

async function startServer() {
  const swarm = new Hyperswarm()

  swarm.on('connection', (socket, info) => {
    const peerId = info.publicKey?.toString('hex').slice(0, 8) ?? 'unknown'
    console.log(`Client connected: ${peerId}`)

    const rpcServer = createRPCServer(socket, {
      handlers: {
        ping: async () => ({ ok: true, ts: Date.now() }),
        submitOrder: async (params) => {
          console.log('Order received:', params)
          return { orderId: params.orderId, status: 'received' }
        },
      },
      streamHandlers: {
        watchOrders: async function* () {
          yield { orderId: '1', status: 'preparing' }
          await new Promise(r => setTimeout(r, 1000))
          yield { orderId: '1', status: 'ready' }
        },
      },
      onError: (err, method) => console.error(`RPC error [${method}]:`, err.message),
    })

    socket.on('close', () => {
      rpcServer.destroy()
      console.log(`Client disconnected: ${peerId}`)
    })
    socket.on('error', () => rpcServer.destroy())
  })

  const topic = crypto.createHash('sha256').update('my-app:orders:v1').digest()
  const discovery = swarm.join(topic, { server: true, client: false })
  await discovery.flushed()
  console.log('Server ready, waiting for clients...')
}

// ─── Client App ──────────────────────────────────────────

async function startClient() {
  const swarm = new Hyperswarm()

  swarm.on('connection', async (socket, info) => {
    const client = createRPCClient(socket)

    try {
      // Request/reply
      const pong = await client.request('ping')
      console.log('Ping:', pong)

      // Send an order
      const ack = await client.request('submitOrder', {
        orderId: 'order-42',
        items: ['latte', 'croissant'],
      })
      console.log('Order ack:', ack)

      // Stream updates
      for await (const update of client.stream('watchOrders')) {
        console.log('Order update:', update)
      }
    } catch (err) {
      console.error('RPC error:', err)
    }

    socket.on('close', () => client.destroy())
    socket.on('error', () => client.destroy())
  })

  const topic = crypto.createHash('sha256').update('my-app:orders:v1').digest()
  const discovery = swarm.join(topic, { server: false, client: true })
  await discovery.flushed()
  console.log('Client connecting...')
}
```

## Approach 2: Protomux (Advanced — Multiple Protocols)

Use when you need to multiplex multiple protocols on a single connection.
This is more complex but gives fine-grained control over channels and message types.

```ts
import Hyperswarm from 'hyperswarm'
import SecretStream from '@hyperswarm/secret-stream'
import Protomux from 'protomux'
import c from 'compact-encoding'

type RpcRequest = { type: 'req'; id: string; method: string; params?: Record<string, unknown> }
type RpcResponse =
  | { type: 'res'; id: string; result: unknown }
  | { type: 'err'; id: string; error: { code: string; message: string } }

const handlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  ping: async () => ({ ok: true, ts: Date.now() }),
  echo: async (params) => params,
}

function createRpc(secure: SecretStream) {
  const mux = new Protomux(secure)
  const channel = mux.createChannel({ protocol: 'rpc/v1' })
  const pending = new Map<string, {
    resolve: (value: unknown) => void
    reject: (err: Error) => void
    timer: NodeJS.Timeout
  }>()

  const msg = channel.addMessage({
    encoding: c.string,
    onmessage: async (payload: string) => {
      const data = JSON.parse(payload) as RpcRequest | RpcResponse

      if (data.type === 'req') {
        const handler = handlers[data.method]
        if (!handler) {
          msg.send(JSON.stringify({ type: 'err', id: data.id, error: { code: 'METHOD_NOT_FOUND', message: `Unknown: ${data.method}` } }))
          return
        }
        try {
          const result = await handler(data.params ?? {})
          msg.send(JSON.stringify({ type: 'res', id: data.id, result }))
        } catch (error) {
          msg.send(JSON.stringify({ type: 'err', id: data.id, error: { code: 'INTERNAL_ERROR', message: String(error) } }))
        }
        return
      }

      if (data.type === 'res' || data.type === 'err') {
        const entry = pending.get(data.id)
        if (!entry) return
        clearTimeout(entry.timer)
        pending.delete(data.id)
        data.type === 'err'
          ? entry.reject(new Error(`${data.error.code}: ${data.error.message}`))
          : entry.resolve(data.result)
      }
    }
  })

  channel.open()

  return {
    request(method: string, params: Record<string, unknown> = {}, timeoutMs = 8000) {
      const id = crypto.randomUUID()
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('TIMEOUT')) }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        msg.send(JSON.stringify({ type: 'req', id, method, params }))
      })
    },
    cleanup(error: Error) {
      for (const [id, entry] of pending) {
        clearTimeout(entry.timer)
        entry.reject(error)
        pending.delete(id)
      }
    },
  }
}
```

## When to Use Which

| bare-rpc (via wrapper) | Protomux |
|------------------------|----------|
| Most RPC needs | Multiple protocols on one connection |
| Works with any duplex stream | Need binary encoding for performance |
| Less boilerplate | Standards-like channel abstraction |
| QVAC uses this internally | Fine-grained control over message types |
