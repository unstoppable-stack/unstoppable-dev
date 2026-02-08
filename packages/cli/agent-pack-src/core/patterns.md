---
id: patterns
name: Common Patterns
category: core
priority: high
---

# Common Patterns

## App Scaffolding Templates

When creating apps, use these templates based on the runtime type. Each app should be in its own folder with its own README.

### Pear Desktop App
For desktop apps with React UI + Bare worker for P2P/AI/storage:

```
my-desktop-app/
├── index.js              # Pear native entry (pear-electron + pear-bridge)
├── index.html            # Web entry (pear-ctrl + script tag)
├── package.json          # pear config with unrouted for workers
├── .swcrc / .swcrc.dev   # SWC configs
├── worker/
│   └── index.ts          # Bare worker (P2P, storage, AI)
├── src/
│   ├── live-reload.ts    # Bootstrap with React Refresh
│   ├── index.tsx          # React root
│   ├── App.tsx            # Main component
│   ├── worker-bridge/     # NDJSON pipe communication
│   │   ├── types.ts
│   │   ├── worker-pipe.ts
│   │   └── worker-client.ts
│   └── styles/
│       ├── theme.ts
│       └── GlobalStyles.ts
├── dist/                  # SWC output (gitignored)
└── README.md
```

**package.json:**
```json
{
  "name": "my-desktop-app",
  "version": "0.1.0",
  "type": "module",
  "pear": {
    "name": "my-desktop-app",
    "type": "desktop",
    "pre": "pear-electron/pre",
    "routes": ".",
    "unrouted": ["/dist/worker/index.js"],
    "gui": { "width": 1024, "height": 768, "backgroundColor": "#171817" }
  },
  "scripts": {
    "dev": "bun run build && concurrently \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "build": "bun run clean && bunx swc src -d dist --source-maps && bunx swc worker -d dist --source-maps",
    "watch:src": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
    "watch:worker": "bunx swc worker -d dist --source-maps --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "pear-electron": "^1.7.0",
    "pear-bridge": "^1.2.4",
    "pear-run": "^1.0.7",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "styled-components": "^6.1.0"
  },
  "devDependencies": {
    "@swc/cli": "^0.7.0",
    "@swc/core": "^1.3.0",
    "chokidar": "^4.0.3",
    "concurrently": "^9.0.0",
    "pear-hotmods": "^1.0.0",
    "pear-interface": "^1.0.0",
    "react-refresh": "^0.17.0",
    "typescript": "^5.0.0"
  }
}
```

> **CRITICAL:** The renderer is a Chromium browser. P2P, storage, and AI modules
> MUST run in the `worker/` process. See `pear-desktop-app` skill for details.

### Pear Terminal App
For headless processes, background engines, or CLI tools with P2P:

```
my-terminal-app/
├── index.js             # Entry point
├── package.json
└── README.md
```

**package.json:**
```json
{
  "name": "my-terminal-app",
  "version": "1.0.0",
  "type": "module",
  "pear": {
    "name": "My Terminal App",
    "type": "terminal"
  },
  "scripts": {
    "dev": "pear dev",
    "stage": "pear stage",
    "release": "pear release"
  }
}
```

### Node.js CLI App
For simple terminal tools without Pear distribution:

```
my-cli-app/
├── src/
│   └── index.ts         # Entry point
├── types.d.ts           # Type declarations for untyped packages
├── package.json
├── tsconfig.json
└── README.md
```

**package.json:**
```json
{
  "name": "my-cli-app",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-cli": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**tsconfig.json** (recommended for tsx-based development):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "types.d.ts"]
}
```

> **Note**: Use `moduleResolution: "Bundler"` and `allowImportingTsExtensions: true` when using `tsx` for development. Install `@types/node` alongside `typescript`.

**types.d.ts** (for untyped P2P packages):
```ts
declare module 'hyperswarm' {
  import { Duplex } from 'stream'
  class Hyperswarm {
    constructor(opts?: any)
    on(event: 'connection', cb: (socket: Duplex, info: any) => void): this
    join(topic: Buffer, opts?: { server?: boolean; client?: boolean }): any
    leave(topic: Buffer): Promise<void>
    flush(): Promise<void>
    destroy(): Promise<void>
    connections: Set<Duplex>
  }
  export default Hyperswarm
}

// bare-rpc type declarations — modeled from @qvac/sdk usage
// NOTE: bare-rpc has NO register(), NO request(string), NO destroy()
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

### Expo Mobile App (with Bare worklet)
For mobile apps with P2P backend:

```
my-mobile-app/
├── app/                 # Expo Router screens
│   └── index.tsx
├── worklet/             # Bare worklet for P2P
│   └── index.js
├── app.json
├── package.json
└── README.md
```

**package.json:**
```json
{
  "name": "my-mobile-app",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "expo": "~50.0.0",
    "expo-router": "~3.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "bare-expo": "^1.0.0"
  }
}
```

---

## App Initialization

### Standard Setup Pattern

> **Pear desktop apps:** This code runs in the **worker**, not the renderer.
> See the `pear-desktop-app` skill for the worker pattern.

```typescript
// worker/index.ts (or src/index.ts for terminal/Node.js apps)
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import HyperDB from 'hyperdb'

interface AppContext {
  store: Corestore
  db: HyperDB
  swarm: Hyperswarm
  cleanup: () => Promise<void>
}

export async function createApp(storagePath: string): Promise<AppContext> {
  // Initialize storage
  const store = new Corestore(storagePath)
  await store.ready()

  // Initialize database
  const db = new HyperDB(store.namespace('db'))
  await db.ready()

  // Initialize networking
  const swarm = new Hyperswarm()

  // Handle connections
  swarm.on('connection', (socket, info) => {
    store.replicate(socket)
  })

  // Cleanup function
  const cleanup = async () => {
    await swarm.destroy()
    await store.close()
  }

  // Handle process exit
  process.on('SIGINT', async () => {
    await cleanup()
    process.exit(0)
  })

  return { store, db, swarm, cleanup }
}

// Usage
const app = await createApp('./storage')
```

## Multi-App Pattern

### Single Package with Multiple Entry Points
For projects with multiple processes (e.g., client + backoffice, UI + engine):

```
my-project/
├── src/
│   ├── shared/              # Shared types, config, utils
│   │   ├── types.ts
│   │   ├── config.ts
│   │   └── protocol.ts      # Shared RPC protocol definitions
│   ├── app-client/          # Client app entry point
│   │   ├── index.ts
│   │   └── ui/
│   ├── app-server/          # Server/engine entry point
│   │   ├── index.ts
│   │   └── handlers/
│   └── index.ts             # Re-exports if needed
├── package.json
└── tsconfig.json
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev:client": "tsx watch src/app-client/index.ts",
    "dev:server": "tsx watch src/app-server/index.ts",
    "dev": "concurrently \"npm:dev:*\"",
    "build": "tsc",
    "client": "node dist/app-client/index.js",
    "server": "node dist/app-server/index.js"
  }
}
```

### Pear Desktop + Worker Pattern (Recommended for AI/P2P)
For apps with UI + heavy backend (P2P, AI inference, storage):

```
my-app/
├── index.js                 # Pear native entry (pear-electron + pear-bridge)
├── index.html               # Web entry
├── package.json             # Single package, pear.unrouted for worker
├── worker/
│   └── index.ts             # Bare worker (P2P, AI, storage)
├── src/
│   ├── App.tsx              # React UI
│   ├── worker-bridge/       # NDJSON pipe communication
│   │   ├── types.ts
│   │   ├── worker-pipe.ts   # Worker side: createWorkerPipe()
│   │   └── worker-client.ts # UI side: createWorkerClient()
│   └── ...
└── dist/
```

**Communication:** Worker started via `pear-run`, communicates with UI via
NDJSON over `Pear.worker.pipe()`. See `pear-desktop-app` skill →
`resources/worker-pattern.md` for full implementation.

### Monorepo with Workspaces
For larger projects with truly separate packages:

```
my-project/
├── packages/
│   ├── shared/              # @my-project/shared
│   │   ├── src/
│   │   └── package.json
│   ├── client/              # @my-project/client
│   │   ├── src/
│   │   └── package.json     # depends on @my-project/shared
│   └── server/              # @my-project/server
│       ├── src/
│       └── package.json     # depends on @my-project/shared
├── package.json             # workspaces: ["packages/*"]
└── pnpm-workspace.yaml      # packages: ["packages/*"]
```

**When to use monorepo:**
- Packages have different dependencies
- Packages are published separately
- Team members work on different packages
- Build/test isolation is important

**When to use single package:**
- Tight coupling between apps
- Shared state or configuration
- Simpler deployment
- Small team / solo developer

## Room/Channel Pattern

### Topic Creation (Bare-Compatible)

**Do NOT use `crypto.createHash`** — it's Node.js-only and crashes in Bare.
Use `charCodeAt` XOR-folding instead:

```typescript
// src/p2p/topic.ts — works in Bare, Node.js, and browsers
export function createTopic(namespace: string): Uint8Array {
  const buf = new Uint8Array(32)
  for (let i = 0; i < namespace.length; i++) {
    buf[i % 32] ^= namespace.charCodeAt(i) & 0xff
  }
  return buf
}
```

### Join a Shared Space
```typescript
// src/p2p/room.ts
import { createTopic } from './topic.js'

interface Room {
  topic: Uint8Array
  members: Map<string, any>
  join: () => Promise<void>
  leave: () => Promise<void>
}

export function createRoom(swarm: any, store: any, roomId: string): Room {
  const topic = createTopic('my-app:room:' + roomId)
  const members = new Map<string, any>()

  let discovery: any = null

  return {
    topic,
    members,

    async join() {
      discovery = swarm.join(topic)

      swarm.on('connection', (socket: any, info: any) => {
        const peerId = info.publicKey.toString('hex').slice(0, 8)
        members.set(peerId, info)

        socket.on('close', () => {
          members.delete(peerId)
        })

        // Replicate data
        store.replicate(socket)
      })

      await discovery.flushed()
    },

    async leave() {
      if (discovery) {
        await swarm.leave(topic)
        discovery = null
      }
      members.clear()
    }
  }
}
```

> **Note:** In Pear desktop apps, this code runs in the **worker**, not in the
> renderer. See the `pear-desktop-app` skill for the worker pattern.

## Data Sync Patterns

### Auto-Sync Store
```typescript
// src/data/sync-store.ts

export function createSyncStore<T>(db: HyperDB, prefix: string) {
  return {
    async get(id: string): Promise<T | null> {
      const node = await db.get(`${prefix}/${id}`)
      return node?.value ?? null
    },

    async set(id: string, value: T): Promise<void> {
      await db.put(`${prefix}/${id}`, value)
    },

    async delete(id: string): Promise<void> {
      await db.del(`${prefix}/${id}`)
    },

    async list(): Promise<T[]> {
      const results: T[] = []
      for await (const node of db.createReadStream({ gte: prefix + '/', lt: prefix + '0' })) {
        results.push(node.value)
      }
      return results
    },

    watch(callback: (key: string, value: T | null) => void) {
      const watcher = db.watch()
      watcher.on('change', async () => {
        // Re-read changed data
        // (simplified - production would track specific changes)
      })
      return () => watcher.destroy()
    }
  }
}

// Usage
const todos = createSyncStore<Todo>(db, 'todos')
await todos.set('1', { id: '1', text: 'Buy milk', done: false })
const all = await todos.list()
```

## RPC Pattern

### Request-Response Over Streams (bare-rpc wrapper)

Use `bare-rpc` for RPC over any duplex stream. **The raw bare-rpc API is low-level**
(numeric command IDs, no register/request methods). Always use a wrapper that provides
the `handlers + request` interface. See `skill-p2p-rpc` for the full wrapper code.

```typescript
// src/p2p/rpc.ts
import Hyperswarm from 'hyperswarm'
import { createRPCServer, createRPCClient } from './lib/p2p-rpc.js'

const swarm = new Hyperswarm()

swarm.on('connection', (socket, info) => {
  if (info.client) {
    // Client side — send requests
    const client = createRPCClient(socket)
    const result = await client.request('ping', {})
    console.log('Ping:', result)
    socket.on('close', () => client.destroy())
    socket.on('error', () => client.destroy())
  } else {
    // Server side — handle requests
    const server = createRPCServer(socket, {
      handlers: {
        ping: async () => ({ ok: true, ts: Date.now() }),
        getData: async (params) => db.get(params.key),
      },
    })
    socket.on('close', () => server.destroy())
    socket.on('error', () => server.destroy())
  }
})
```

> **IMPORTANT**: The raw `bare-rpc` API has NO `register()`, NO `request(method_string)`,
> and NO `destroy()` method. Always use the `createRPCServer` / `createRPCClient`
> wrapper. See `skill-p2p-rpc` for the wrapper implementation and correct type declarations.
>
> **IMPORTANT**: Add `shamefully-hoist=true` to `.npmrc` when using bare-rpc in pnpm
> projects. Without this, bare native binary resolution fails at runtime.
>
> **IMPORTANT**: Use `{ method, payload }` envelope format (NOT `{ type, ... }`).
> The `type` field often collides with application payload data.
>
> For advanced multiplexing (multiple protocols on one connection), use Protomux.

## File Sharing Pattern

### Hyperdrive for Files
```typescript
// src/data/files.ts
import Hyperdrive from 'hyperdrive'

export async function createFileStore(store: Corestore) {
  const drive = new Hyperdrive(store.namespace('files'))
  await drive.ready()

  return {
    async writeFile(path: string, data: Buffer | string) {
      await drive.put(path, Buffer.from(data))
    },

    async readFile(path: string): Promise<Buffer | null> {
      try {
        return await drive.get(path)
      } catch {
        return null
      }
    },

    async listFiles(dir: string = '/'): Promise<string[]> {
      const entries = await drive.readdir(dir)
      return entries
    },

    async deleteFile(path: string) {
      await drive.del(path)
    },

    // For sharing: get the drive key
    get key() {
      return drive.key
    }
  }
}
```

## State Management Pattern

### Reactive Store
```typescript
// src/app/state.ts

type Listener<T> = (state: T) => void

export function createStore<T>(db: HyperDB, key: string, initial: T) {
  let state = initial
  const listeners = new Set<Listener<T>>()

  // Load from DB on init
  db.get(key).then(node => {
    if (node?.value) {
      state = node.value
      notify()
    }
  })

  function notify() {
    for (const listener of listeners) {
      listener(state)
    }
  }

  return {
    get(): T {
      return state
    },

    async set(newState: T) {
      state = newState
      await db.put(key, state)
      notify()
    },

    async update(updater: (s: T) => T) {
      state = updater(state)
      await db.put(key, state)
      notify()
    },

    subscribe(listener: Listener<T>): () => void {
      listeners.add(listener)
      listener(state)  // Initial call
      return () => listeners.delete(listener)
    }
  }
}

// Usage
interface AppState {
  user: string | null
  settings: { theme: 'light' | 'dark' }
}

const store = createStore<AppState>(db, 'app-state', {
  user: null,
  settings: { theme: 'light' }
})

store.subscribe(state => {
  console.log('State changed:', state)
})

await store.update(s => ({ ...s, user: 'alice' }))
```

## Graceful Shutdown Pattern

### In Pear Apps (desktop workers and terminal apps)

Use `Pear.teardown()` — NOT `process.on('SIGINT')` (which requires `bare-process`):

```typescript
// worker/index.ts or index.js (Pear app)
declare const Pear: { teardown(fn: () => Promise<void>): void }

async function main() {
  const swarm = new Hyperswarm()
  const core = new Hypercore('./storage')

  // Register cleanup with Pear lifecycle
  Pear.teardown(async () => {
    console.log('Shutting down...')
    await swarm.destroy()
    await core.close()
  })
}
```

### In Node.js Scripts (non-Pear)

For plain Node.js scripts (not running in Pear), use process signals:

```typescript
// src/index.ts (Node.js)

async function main() {
  const { store, db, swarm, cleanup } = await createApp('./storage')

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`)
    await new Promise(r => setTimeout(r, 1000))
    await cleanup()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}
```

> **Note:** `process` is NOT a global in Bare. If you need it, install
> `bare-process@^4.2.2` and import it explicitly.
