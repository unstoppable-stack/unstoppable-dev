# 02 — The Worker Pattern: Why, When, and How

## Why Workers Exist

The Pear Desktop renderer is a **Chromium browser window** (via `pear-electron`). Like any browser, it **cannot**:

- Import `node:*` built-in modules (`node:net`, `node:os`, `node:path`, etc.)
- Import `bare-*` modules (`bare-process`, `bare-fs`, `bare-crypto`, etc.)
- Use native P2P modules (`hyperswarm`, `hypercore`, `hyperbee`, `bare-rpc`, etc.)
- Run QVAC SDK (`@qvac/sdk` — compiled for Bare, not browser)

If you try, you get errors like:
```
GET node:net net::ERR_UNKNOWN_URL_SCHEME
TypeError: Failed to fetch dynamically imported module
```

The **worker process** runs in the **Bare runtime** (not Chromium), where all these modules work natively.

## When You Need a Worker

| Your app uses... | Need a worker? |
|-----------------|---------------|
| Only HTML/CSS/JS, no P2P or AI | No — pure renderer is fine |
| Hyperswarm (P2P networking) | **Yes** |
| Hypercore / Hyperbee / HyperDB (P2P data) | **Yes** |
| bare-rpc (RPC over P2P) | **Yes** |
| @qvac/sdk (AI inference) | **Yes** |
| bare-fs, bare-process (native Bare APIs) | **Yes** |
| Hyperdrive (P2P file storage) | **Yes** |
| Only fetch() to external APIs | No |
| localStorage / IndexedDB | No (these are browser APIs) |

**Rule of thumb**: If any import starts with `bare-`, `hyper`, or is `@qvac/sdk`, it must run in a worker.

## How Workers Are Started

### From the Renderer (UI side)

The renderer uses `pear-run` to spawn a worker as a child Bare process:

```typescript
import run from "pear-run"

// Spawn the worker — returns a pipe for bidirectional communication
const pipe = run("/dist/worker/index.js", [storagePath, ...args])

// Send messages TO the worker
pipe.write(JSON.stringify({ type: "load", modelId: "llama-3.2" }) + "\n")

// Receive messages FROM the worker
pipe.on("data", (buf) => {
  const lines = Buffer.from(buf).toString().split("\n")
  for (const line of lines) {
    if (line.trim()) {
      const message = JSON.parse(line)
      handleResponse(message)
    }
  }
})

// Handle pipe close
pipe.on("end", () => {
  console.log("Worker disconnected")
})
```

### From the Worker (Bare side)

The worker accesses its communication pipe via `Pear.worker.pipe()`:

```typescript
// Get the communication pipe (fd 3, NOT stdin/stdout)
const pipe = await Pear.worker.pipe()

// Receive messages FROM the renderer
pipe.on("data", (data) => {
  const message = JSON.parse(Buffer.from(data).toString())
  handleMessage(message)
})

// Send messages TO the renderer
pipe.write(JSON.stringify({ type: "ready" }) + "\n")

// Cleanup on shutdown
Pear.teardown(async () => {
  await cleanup()
  // Don't use process.exit() — use Pear's lifecycle
})
```

**CRITICAL**: Workers must use `Pear.worker.pipe()`, NOT `process.stdin`/`process.stdout`. The pipe is on **fd 3** (not fd 0/1). Writing to stdout goes to the terminal, not the renderer. This was Fix 006 in our battle-tested builds.

## Communication Protocol: NDJSON

Both sides use **Newline-Delimited JSON** (NDJSON):

```
{"type":"load","modelId":"llama-3.2","config":{"ctx_size":4096}}\n
{"type":"completion","history":[{"role":"user","content":"Hello"}]}\n
```

### Message Format

Every message has a `type` field used for routing:

```typescript
// Renderer → Worker
{ type: "load", modelId: string, modelType: string, modelConfig: {...} }
{ type: "completion", history: Message[], useRag: boolean, sessionId: string }
{ type: "unload" }
{ type: "exit" }

// Worker → Renderer
{ type: "worker_initialized" }
{ type: "ready", modelId: string }
{ type: "progress", progress: number }
{ type: "token", data: string }
{ type: "end", data: { TTFT: number, TPS: number } }
{ type: "error", error: string }
```

### Buffer Handling

Messages can be large (audio files up to 200MB). The worker uses a message buffer:

```typescript
let messageBuffer = ""
const MAX_BUFFER_SIZE = 1024 * 1024 * 200 // 200MB

pipe.on("data", (data) => {
  messageBuffer += Buffer.from(data).toString()

  // Process all complete messages (delimited by \n)
  let idx = messageBuffer.indexOf("\n")
  while (idx !== -1) {
    const complete = messageBuffer.slice(0, idx)
    messageBuffer = messageBuffer.slice(idx + 1)
    if (complete.trim()) {
      processMessage(JSON.parse(complete))
    }
    idx = messageBuffer.indexOf("\n")
  }
})
```

## Worker Lifecycle

### Startup Sequence

```
1. Renderer loads → creates BrowserWindow → loads index.html
2. React app initializes → WorkerClient.initialize() called
3. pear-run spawns worker process (Bare runtime)
4. Worker: services initialize (model manager, RAG, etc.)
5. Worker: sends { type: "worker_initialized" }
6. Renderer: resolves init promise, app is ready
7. Worker: starts slow operations (P2P join, model preload) in background
```

**Key insight**: Send `worker_initialized` BEFORE slow operations (DHT flush, model download). Otherwise the UI times out waiting. Use separate status messages for progress updates. (Fix 005)

### Shutdown Sequence

```
1. User closes window (or Pear.exit() called)
2. Renderer: sends { type: "exit" } to worker
3. Worker: runs cleanup (unload models, close P2P connections)
4. Worker: Pear.teardown() fires → final cleanup
5. Worker: os.kill(os.pid(), "SIGKILL") for hard exit
6. Renderer: pipe.on("end") fires → cleanup renderer state
```

### Error Handling

The worker catches unhandled rejections and uncaught exceptions globally:

```typescript
import process from "bare-process"

process.on("unhandledRejection", (reason) => {
  pipe.write(JSON.stringify({ type: "error", error: String(reason) }) + "\n")
})

process.on("uncaughtException", (error) => {
  // P2P connection errors: suppress for cooldown period
  if (isP2PConnectionError(error)) {
    return // SDK handles reconnection
  }

  pipe.write(JSON.stringify({ type: "error", error: error.message }) + "\n")
  // Don't exit — keep worker alive
})
```

## The WorkerManager Pattern

The workbench wraps the raw pipe in a `WorkerManager` class:

```typescript
class WorkerManager {
  private pipe: PearWorkerPipe

  static async create(): Promise<WorkerManager> {
    const manager = new WorkerManager()
    manager.pipe = await Pear.worker.pipe()
    return manager
  }

  setupMessageHandler(handler: (data: Buffer) => Promise<void>): void {
    this.pipe.on("data", (data) => {
      handler(data).catch(err => this.sendError(err))
    })
  }

  sendMessage(message: object): void {
    this.pipe.write(JSON.stringify(message) + "\n")
  }

  setupCleanupHandler(cleanup: () => Promise<void>): void {
    Pear.teardown(async () => {
      await cleanup()
      os.kill(os.pid(), "SIGKILL")
    })
  }
}
```

## The WorkerClient Pattern (Renderer Side)

The renderer has a singleton `WorkerClient` that manages the pipe:

```typescript
class WorkerClient {
  private pipe: Pipe | null = null
  private pendingRequests = new Map<string, { resolve, reject }>()
  private messageBuffer = ""

  async initialize(config: WorkerConfig): Promise<void> {
    this.pipe = run(workerPath, args)

    this.pipe.on("data", (buf) => {
      // Buffer + parse NDJSON
      // Route responses to pending request promises
    })

    // Wait for worker_initialized with 60s timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject("timeout"), 60000)
      // resolve when worker_initialized received
    })
  }

  async sendMessage(msg: WorkerMessage): Promise<unknown> {
    const id = `${msg.type}_${Date.now()}_${Math.random()}`
    this.pendingRequests.set(id, { resolve, reject })
    this.pipe.write(JSON.stringify({ ...msg, id }) + "\n")
    // Auto-timeout after 10s
  }
}
```

## Multiple Workers

A single Pear app can spawn multiple workers. The workbench uses two:

1. **AI Worker** (`workbench-worker/`) — Model inference, RAG, transcription
2. **Data Worker** (`workbench-core/desktop/worker.js`) — Autobase persistence, P2P sync

Each has its own pipe and independent lifecycle.

## Worker Arguments

Workers receive arguments via `pear-run`:

```typescript
// Renderer
const pipe = run("/dist/worker/index.js", [storagePath, baseKey, configJson])

// Worker — access via Bare.argv
import process from "bare-process"
const [storagePath, baseKey, configJson] = process.argv.slice(1)
```
