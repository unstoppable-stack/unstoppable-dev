# 08 — Production Patterns from the Workbench

Patterns extracted from `reference-apps/qvac-workbench-desktop/` — a production Pear Desktop app with AI inference, P2P sync, MCP integration, and multi-worker architecture.

## Pattern 1: Message Router

Instead of a giant `switch` statement, the workbench uses a **typed router** with builder pattern:

```typescript
const router = createRouter()
  .request("load", {
    input: LoadMessageSchema,
    handler: async (input) => modelHandler.handleLoad(input),
  })
  .request("completion", {
    input: CompletionMessageSchema,
    handler: async (input) => completionHandler.handleCompletion(input),
  })
  .simple("unload", {
    handler: async () => modelHandler.handleUnload(),
  })
  .simple("exit", {
    handler: () => { Pear.exit(); return Promise.resolve() },
  })
  .build()

// In message handler:
const handled = await router.handle(message)
if (!handled) {
  send({ type: "error", error: `Unknown: ${message.type}` })
}
```

Route types:
- **`request`**: Has input schema (Zod validation) + handler
- **`stream`**: Async generator handler (for streaming responses)
- **`simple`**: No input validation, just a handler

Benefits:
- Type-safe message routing
- Automatic Zod validation before handler runs
- Easy to add new message types
- All routes visible in one place

## Pattern 2: Handler / Service Separation

Handlers are **stateless routing functions**. Services contain **stateful business logic**.

```
Message → Handler (validate, route, format response)
                 ↓
            Service (business logic, state management)
                 ↓
         Handler (send response via WorkerManager)
```

### Handler (Stateless)

```typescript
export function createCompletionHandler(
  workerManager: WorkerManager,
  modelManager: ModelManager,
  ragService: RAGService,
) {
  const handleCompletion = async (message: CompletionMessage) => {
    const model = modelManager.getCurrentModel()
    if (!model) {
      workerManager.sendMessage({ type: "error", error: "No model loaded" })
      return
    }

    // Process RAG context if enabled
    let history = message.history
    if (message.useRag) {
      const context = await ragService.search(message.projectId, query)
      history = injectRAGContext(history, context)
    }

    // Run completion and stream tokens
    const result = completion({ modelId: model.modelId, history, stream: true })
    for await (const token of result.tokenStream) {
      workerManager.sendMessage({ type: "token", data: token })
    }

    const stats = await result.stats
    workerManager.sendMessage({ type: "end", data: stats })
  }

  return { handleCompletion }
}
```

### Service (Stateful)

```typescript
export function createModelManager(): ModelManager {
  const state = {
    currentModel: null,
    isLoadingModel: false,
  }

  const loadModel = async (options) => {
    if (state.isLoadingModel) throw new Error("Already loading")
    state.isLoadingModel = true
    try {
      if (state.currentModel) await unloadModel(state.currentModel)
      const modelId = await sdk.loadModel(options)
      state.currentModel = { ...options, modelId }
      return modelId
    } finally {
      state.isLoadingModel = false
    }
  }

  return { loadModel, getCurrentModel: () => state.currentModel, ... }
}
```

## Pattern 3: Zod Schema Validation

Every message is validated with Zod schemas organized by domain:

```
schemas/
├── index.ts                  # Discriminated union of all messages
├── model-schemas.ts          # Load, unload, list models
├── completion-schemas.ts     # Chat completion
├── transcription-schemas.ts  # Audio transcription
├── rag-schemas.ts            # Embeddings operations
├── provider-schemas.ts       # QVAC provider control
└── response-schemas.ts       # All response types
```

The discriminated union enables type-safe parsing:

```typescript
const WorkerMessageSchema = z.discriminatedUnion("type", [
  LoadMessageSchema,         // { type: "load", ... }
  UnloadMessageSchema,       // { type: "unload" }
  CompletionMessageSchema,   // { type: "completion", ... }
  TranscribeFileMessageSchema,
  // ...
])

// Usage
const result = WorkerMessageSchema.safeParse(rawMessage)
if (!result.success) {
  send({ type: "error", error: result.error.message })
  return
}
// result.data is fully typed
```

## Pattern 4: Factory Functions for DI

All services and handlers use factory functions (not classes):

```typescript
// Creates a handler with injected dependencies
const modelHandler = createModelHandler(workerManager, modelManager)
const completionHandler = createCompletionHandler(workerManager, modelManager, ragService)

// Easy to test: inject mocks
const mockWorkerManager = { sendMessage: vi.fn() }
const handler = createCompletionHandler(mockWorkerManager, mockModelManager, mockRag)
```

## Pattern 5: Scoped Logging

A logger factory that tags messages by module:

```typescript
function createScopedLogger(scope: string) {
  return {
    debug: (...args) => console.log(`[${scope}]`, ...args),
    error: (...args) => console.error(`[${scope}]`, ...args),
    warn: (...args) => console.warn(`[${scope}]`, ...args),
  }
}

// Usage
const logger = createScopedLogger("CompletionHandler")
logger.debug("Processing completion", message.history.length)
// Output: [CompletionHandler] Processing completion 5
```

## Pattern 6: Cleanup Chain

Multiple cleanup handlers registered via `Pear.teardown()`:

```typescript
// Worker index.ts
async function cleanup(): Promise<void> {
  if (cleanupCalled) return
  cleanupCalled = true

  await ProviderService.stopProvider()
  await modelManager.cleanup()      // unloads all models
  await ragService.cleanup()        // unloads embeddings
  await mcpService.cleanup()        // stops MCP servers
}

workerManager.setupCleanupHandler(cleanup)

// WorkerManager.ts
Pear.teardown(async () => {
  await cleanupHandler()
  os.kill(os.pid(), "SIGKILL")  // Hard kill after cleanup
})
```

The `os.kill(os.pid(), "SIGKILL")` ensures the worker process actually exits even if some async operation hangs.

## Pattern 7: Token Streaming with Backpressure

The completion handler batches tokens to avoid flooding the pipe:

```typescript
let pendingToSend = ""
let lastFlushMs = 0
const TOKEN_FLUSH_INTERVAL_MS = 150

const flushPending = async (force = false) => {
  if (!pendingToSend) return
  const now = Date.now()
  if (!force && now - lastFlushMs < TOKEN_FLUSH_INTERVAL_MS) return

  workerManager.sendMessage({ type: "token", data: pendingToSend })
  pendingToSend = ""
  lastFlushMs = now

  // Yield to event loop for pipe buffer flush
  await new Promise(resolve => setImmediate(resolve))
}

for await (const token of result.tokenStream) {
  pendingToSend += token
  await flushPending(false)
}
await flushPending(true)  // Flush remaining
```

## Pattern 8: Model Source Resolution via pear:// URLs

Models are stored in Hyperdrives and loaded via `pear://` URLs:

```typescript
// Model config has a hyperdriveKey
const modelInfo = { hyperdriveKey: "583f04c3...", modelId: "Qwen2.5-3B.gguf" }

// Construct pear:// URL for the SDK
const modelSrc = `pear://${modelInfo.hyperdriveKey}/${modelInfo.modelId}`

// SDK downloads from P2P network automatically
await loadModel({ modelSrc, modelType: "llm", ... })
```

This means:
- Models are distributed P2P (no central server)
- First load downloads from peers
- Subsequent loads use local cache
- Progress callbacks report download %

## Pattern 9: Pending Requests Map

The WorkerClient tracks requests and matches responses by ID:

```typescript
class WorkerClient {
  private pendingRequests = new Map<string, { resolve, reject }>()

  async sendMessage(msg: WorkerMessage): Promise<unknown> {
    const id = `${msg.type}_${Date.now()}_${Math.random()}`
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.pipe.write(JSON.stringify({ ...msg, id }) + "\n")

      // Auto-timeout after 10s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  private handleResponse(message: ResponseMessage) {
    if (message.id) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        message.type === "error"
          ? pending.reject(new Error(message.error))
          : pending.resolve(message)
        this.pendingRequests.delete(message.id)
      }
    }
  }
}
```

This enables request/response semantics over the unidirectional pipe.

## Pattern 10: Multi-Worker Architecture

The workbench runs two workers simultaneously:

| Worker | Path | Responsibilities |
|--------|------|-----------------|
| AI Worker | `workbench-worker/index.ts` | Model inference, RAG, transcription, MCP |
| Data Worker | `workbench-core/desktop/worker.js` | Autobase, P2P sync, key-value storage |

Each has its own:
- `pear-run` pipe
- Message schemas
- Lifecycle management
- Cleanup handlers

The renderer has two WorkerClient instances, one per worker.
