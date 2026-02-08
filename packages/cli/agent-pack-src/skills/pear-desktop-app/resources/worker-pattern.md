# Pear Desktop App — Worker Pattern

Complete implementation of the renderer↔worker communication pattern using
NDJSON over `Pear.worker.pipe()`. All code is battle-tested from the Coffee
Assistant UI project and the QVAC Workbench reference app.

---

## Architecture

```
Renderer (Chromium browser)            Worker (Bare runtime)
┌───────────────────────────┐          ┌───────────────────────────┐
│                           │          │                           │
│  React UI                 │  NDJSON  │  P2P (hyperswarm)         │
│  styled-components        │◄────────►│  Storage (hyperbee)       │
│  worker-client.ts         │  fd 3    │  AI (@qvac/sdk)           │
│  (uses pear-run)          │  pipe    │  (uses Pear.worker.pipe)  │
│                           │          │                           │
│  ✓ Browser APIs           │          │  ✓ Bare APIs              │
│  ✓ DOM, fetch, CSS        │          │  ✓ bare-*, hyperswarm     │
│  ✗ node:*, bare-*         │          │  ✗ DOM, window, document  │
│  ✗ hyperswarm, @qvac/sdk  │          │  ✗ TextEncoder, Buffer    │
└───────────────────────────┘          └───────────────────────────┘
```

**Wire format:** Newline-delimited JSON (NDJSON). Each message is a JSON object
followed by `\n`. The first message from the worker MUST be `{ "type": "workerReady" }`.

---

## Worker Bridge Types (`src/worker-bridge/types.ts`)

```typescript
/** Handle returned by createWorkerPipe (worker-side). */
export interface WorkerPipeHandle {
  /** Send a JSON message to the UI. */
  send(msg: Record<string, unknown>): void
  /** Register a handler for messages from the UI. */
  onMessage(handler: (msg: any) => void): void
  /** Graceful shutdown. */
  destroy(): Promise<void>
}

/** Handle returned by createWorkerClient (UI-side). */
export interface WorkerClientHandle {
  /** Data sent with the workerReady message (minus the `type` field). */
  readyData: Record<string, unknown>
  /** Send a JSON message to the worker. */
  send(msg: Record<string, unknown>): void
  /** Register a handler for messages from the worker. Returns unsubscribe fn. */
  onMessage(handler: (msg: any) => void): () => void
  /** Shutdown the worker. */
  destroy(): void
}
```

---

## Worker Side: `createWorkerPipe()` (`src/worker-bridge/worker-pipe.ts`)

This runs in the Bare runtime. Uses `Pear.worker.pipe()` to get the
communication pipe (fd 3), NOT `process.stdin/stdout`.

```typescript
/* global Pear */

import type { WorkerPipeHandle } from './types.js'

declare const Pear: {
  worker: { pipe(): Promise<any> }
  teardown(fn: () => Promise<void>): void
}

export async function createWorkerPipe(): Promise<WorkerPipeHandle> {
  const pipe = await Pear.worker.pipe()
  const handlers: Array<(msg: any) => void> = []
  let messageBuffer = ''
  let destroyed = false

  function send(msg: Record<string, unknown>): void {
    if (destroyed || !pipe) return
    pipe.write(JSON.stringify(msg) + '\n')
  }

  pipe.on('data', (data: Buffer) => {
    messageBuffer += Buffer.from(data).toString()
    const lines = messageBuffer.split('\n')
    messageBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        for (const handler of handlers) handler(msg)
      } catch (err) {
        console.error('[WorkerPipe] Invalid JSON:', err)
      }
    }
  })

  function onMessage(handler: (msg: any) => void): void {
    handlers.push(handler)
  }

  async function destroy(): Promise<void> {
    if (destroyed) return
    destroyed = true
    handlers.length = 0
    if (pipe) pipe.destroy()
  }

  Pear.teardown(async () => {
    await destroy()
  })

  return { send, onMessage, destroy }
}
```

---

## UI Side: `createWorkerClient()` (`src/worker-bridge/worker-client.ts`)

This runs in the Chromium renderer. Uses `pear-run` to spawn the worker and
returns a handle when `workerReady` is received.

```typescript
import run from 'pear-run'
import type { WorkerClientHandle } from './types.js'

declare const Pear: {
  config: { applink?: string; dir?: string }
  key?: string
}

export interface WorkerClientOptions {
  workerPath: string
  timeout?: number
}

export function createWorkerClient(options: WorkerClientOptions): Promise<WorkerClientHandle> {
  const { workerPath, timeout = 30000 } = options

  return new Promise((resolve, reject) => {
    const fullPath = Pear.key
      ? `${Pear.config.applink || ''}${workerPath}`
      : `${Pear.config.dir || ''}${workerPath}`

    console.log('[WorkerClient] Starting worker at:', fullPath)
    const pipe = run(fullPath, [])

    if (!pipe) {
      reject(new Error('Failed to start worker'))
      return
    }

    const handlers = new Set<(msg: any) => void>()
    let messageBuffer = ''
    let destroyed = false

    function processData(data: Buffer) {
      messageBuffer += Buffer.from(data).toString()
      const lines = messageBuffer.split('\n')
      messageBuffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          for (const handler of handlers) handler(msg)
        } catch (err) {
          console.error('[WorkerClient] Parse error:', err)
        }
      }
    }

    const timer = setTimeout(() => {
      reject(new Error('Worker init timeout'))
    }, timeout)

    function onInitMessage(msg: any) {
      if (msg.type === 'workerReady') {
        clearTimeout(timer)
        handlers.delete(onInitMessage)
        const { type: _, ...readyData } = msg
        resolve({
          readyData,
          send(outMsg: Record<string, unknown>) {
            if (destroyed || !pipe) return
            pipe.write(JSON.stringify(outMsg) + '\n')
          },
          onMessage(handler: (inMsg: any) => void) {
            handlers.add(handler)
            return () => handlers.delete(handler)
          },
          destroy() {
            if (destroyed) return
            destroyed = true
            try {
              pipe.write(JSON.stringify({ type: 'exit' }) + '\n')
              setTimeout(() => { try { pipe.destroy() } catch {} }, 500)
            } catch {}
            handlers.clear()
          },
        })
      }
    }

    handlers.add(onInitMessage)
    pipe.on('data', processData)
    pipe.on('end', () => {
      console.log('[WorkerClient] Worker pipe ended')
      destroyed = true
    })
  })
}
```

---

## Re-export (`src/worker-bridge/index.ts`)

```typescript
export { createWorkerPipe } from './worker-pipe.js'
export type { WorkerPipeHandle } from './types.js'
export { createWorkerClient } from './worker-client.js'
export type { WorkerClientHandle, WorkerClientOptions } from './worker-client.js'
```

---

## Example: P2P + Storage Worker (`worker/index.ts`)

From the Coffee Assistant backoffice app. Handles Hyperswarm server, bare-rpc,
and Hyperbee persistence:

```typescript
import { createWorkerPipe } from '../src/worker-bridge/worker-pipe.js'
import Hyperswarm from 'hyperswarm'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'

// Topic creation — Bare-compatible (no crypto, no TextEncoder)
function createTopic(namespace: string): Uint8Array {
  const buf = new Uint8Array(32)
  for (let i = 0; i < namespace.length; i++) {
    buf[i % 32] ^= namespace.charCodeAt(i) & 0xff
  }
  return buf
}

async function init() {
  const pipe = await createWorkerPipe()

  // Init storage
  const core = new Hypercore('./storage/db')
  const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
  await db.ready()

  // Send workerReady IMMEDIATELY — before slow P2P operations
  pipe.send({ type: 'workerReady' })

  // Handle UI messages
  pipe.onMessage(async (msg: any) => {
    switch (msg.type) {
      case 'getData':
        const node = await db.get(msg.key)
        pipe.send({ type: 'data', key: msg.key, value: node?.value ?? null })
        break
      case 'putData':
        await db.put(msg.key, msg.value)
        pipe.send({ type: 'dataSaved', key: msg.key })
        break
      case 'exit':
        await swarm.destroy()
        await core.close()
        await pipe.destroy()
        break
    }
  })

  // Start P2P (slow — happens AFTER workerReady)
  const swarm = new Hyperswarm()
  const topic = createTopic('my-app:data:v1')
  swarm.join(topic)

  swarm.on('connection', (socket: any) => {
    core.replicate(socket)
    pipe.send({ type: 'peerConnected', count: swarm.connections.size })
  })

  console.log('[Worker] P2P server started')
}

init().catch((err) => console.error('[Worker] Init failed:', err))
```

---

## Example: Using the Worker Client in React (`src/App.tsx`)

```tsx
import React, { useEffect, useState } from 'react'
import { createWorkerClient, type WorkerClientHandle } from './worker-bridge/index.js'

export function App() {
  const [worker, setWorker] = useState<WorkerClientHandle | null>(null)
  const [peers, setPeers] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let handle: WorkerClientHandle | null = null

    createWorkerClient({ workerPath: '/dist/worker/index.js' })
      .then((w) => {
        handle = w
        setWorker(w)
        setStatus('ready')

        w.onMessage((msg) => {
          switch (msg.type) {
            case 'peerConnected':
              setPeers(msg.count)
              break
            case 'data':
              // handle data responses
              break
          }
        })
      })
      .catch((err) => {
        console.error('Worker failed:', err)
        setStatus('error')
      })

    return () => {
      if (handle) handle.destroy()
    }
  }, [])

  if (status === 'loading') return <div>Starting worker...</div>
  if (status === 'error') return <div>Worker failed to start</div>

  return (
    <div>
      <p>Connected peers: {peers}</p>
      <button onClick={() => worker?.send({ type: 'getData', key: 'myKey' })}>
        Get Data
      </button>
    </div>
  )
}
```

---

## Message Protocol Design Guide

### Standard Messages (every worker should implement)

| Direction | Type | Purpose |
|-----------|------|---------|
| Worker → UI | `workerReady` | First message. May include initial state. |
| UI → Worker | `exit` | Request graceful shutdown. |

### Status Messages (for slow operations)

| Direction | Type | Purpose |
|-----------|------|---------|
| Worker → UI | `modelStatus` | AI model loading progress (`loading`, `ready`, `error`) |
| Worker → UI | `connectionChange` | P2P peer count changed |
| Worker → UI | `connectionStatus` | P2P connected/disconnected boolean |

### Conventions

1. Every message has a `type` string field.
2. `workerReady` is always the first message from the worker.
3. `exit` is always the shutdown signal from the UI.
4. Use descriptive type names: `newOrder`, `cartUpdate`, `dataSaved`.
5. Worker-side errors should be sent as messages, not thrown:
   ```typescript
   pipe.send({ type: 'error', message: 'Failed to connect' })
   ```

---

## Checklist: Adding a Worker to an Existing Pear Desktop App

1. [ ] Create `worker/index.ts` with `createWorkerPipe()` + `workerReady`
2. [ ] Create `src/worker-bridge/` with `types.ts`, `worker-pipe.ts`, `worker-client.ts`
3. [ ] Add `"pear-run": "^1.0.7"` to dependencies
4. [ ] Add `"/dist/worker/index.js"` to `pear.unrouted` in `package.json`
5. [ ] Update build script: `bunx swc worker -d dist --source-maps`
6. [ ] Add `watch:worker` script for dev mode
7. [ ] Move all P2P/storage/AI imports from `src/` to `worker/`
8. [ ] Replace direct module calls in React with `worker.send()` + `worker.onMessage()`
9. [ ] Add P2P modules (`hyperswarm`, `bare-rpc`, etc.) to dependencies
10. [ ] Add `bare-process` if the worker needs process APIs
