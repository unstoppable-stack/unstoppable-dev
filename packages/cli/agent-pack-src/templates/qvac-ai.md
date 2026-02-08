---
id: qvac-ai
name: QVAC AI Template
category: template
modules: [pear, bare, qvac]
priority: high
description: Local AI inference app with QVAC SDK
---

# QVAC AI Template

## What You Scaffolded

This template creates a Pear desktop app with local AI inference powered by QVAC SDK. The app can run AI models entirely on-device without any cloud dependencies.

## Project Structure

```
my-qvac-app/
├── src/
│   ├── index.ts              # Entry point
│   ├── app/
│   │   ├── main.ts           # Main application logic
│   │   └── ui.ts             # UI rendering
│   ├── inference/
│   │   ├── engine.ts         # QVAC engine setup
│   │   ├── models.ts         # Model management
│   │   └── chat.ts           # Chat completion logic
│   └── data/
│       ├── store.ts          # Local storage (HyperDB)
│       └── conversations.ts  # Conversation persistence
├── models/                   # Downloaded models (gitignored)
├── storage/                  # App data (gitignored)
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Key Files

### Entry Point (`src/index.ts`)
```typescript
import { createApp } from './app/main'
import { createInferenceEngine } from './inference/engine'

async function main() {
  // Initialize inference engine
  const engine = await createInferenceEngine({
    modelsPath: './models',
    defaultModel: 'llama-3.2-1b'  // Or user-configured
  })

  // Initialize app with engine
  const app = await createApp({
    engine,
    storagePath: './storage'
  })

  console.log('App ready. Model loaded:', engine.currentModel)
}

main().catch(console.error)
```

### Inference Engine (`src/inference/engine.ts`)
```typescript
import QVAC from 'qvac'

interface EngineConfig {
  modelsPath: string
  defaultModel: string
}

interface InferenceEngine {
  currentModel: string
  complete: (prompt: string, options?: CompletionOptions) => AsyncGenerator<string>
  listModels: () => Promise<string[]>
  loadModel: (name: string) => Promise<void>
}

export async function createInferenceEngine(config: EngineConfig): Promise<InferenceEngine> {
  const qvac = new QVAC({ modelsPath: config.modelsPath })
  await qvac.init()

  let currentModel = config.defaultModel
  await qvac.loadModel(currentModel)

  return {
    get currentModel() { return currentModel },

    async *complete(prompt: string, options = {}) {
      const stream = qvac.createCompletion({
        prompt,
        maxTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        stream: true
      })

      for await (const chunk of stream) {
        yield chunk.text
      }
    },

    async listModels() {
      return qvac.listAvailableModels()
    },

    async loadModel(name: string) {
      await qvac.loadModel(name)
      currentModel = name
    }
  }
}
```

### Chat Logic (`src/inference/chat.ts`)
```typescript
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatSession {
  messages: Message[]
  send: (content: string) => AsyncGenerator<string>
  setSystemPrompt: (prompt: string) => void
  clear: () => void
}

export function createChatSession(engine: InferenceEngine, systemPrompt?: string): ChatSession {
  const messages: Message[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }

  function buildPrompt(): string {
    // Format messages for model (this varies by model format)
    return messages.map(m => {
      if (m.role === 'system') return `<|system|>\n${m.content}<|end|>\n`
      if (m.role === 'user') return `<|user|>\n${m.content}<|end|>\n`
      if (m.role === 'assistant') return `<|assistant|>\n${m.content}<|end|>\n`
    }).join('') + '<|assistant|>\n'
  }

  return {
    messages,

    async *send(content: string) {
      messages.push({ role: 'user', content })

      const prompt = buildPrompt()
      let response = ''

      for await (const chunk of engine.complete(prompt)) {
        response += chunk
        yield chunk
      }

      messages.push({ role: 'assistant', content: response })
    },

    setSystemPrompt(prompt: string) {
      const existing = messages.find(m => m.role === 'system')
      if (existing) existing.content = prompt
      else messages.unshift({ role: 'system', content: prompt })
    },

    clear() {
      const system = messages.find(m => m.role === 'system')
      messages.length = 0
      if (system) messages.push(system)
    }
  }
}
```

## Adding Features

### Add Model Download
```typescript
// src/inference/models.ts
import { download } from 'qvac/utils'

export async function downloadModel(
  url: string,
  modelsPath: string,
  onProgress?: (percent: number) => void
) {
  await download(url, modelsPath, { onProgress })
}
```

### Add Conversation Persistence
```typescript
// src/data/conversations.ts
import { createSyncStore } from './store'

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export function createConversationStore(db: HyperDB) {
  const store = createSyncStore<Conversation>(db, 'conversations')

  return {
    ...store,

    async create(title: string = 'New Chat'): Promise<Conversation> {
      const conv: Conversation = {
        id: crypto.randomUUID(),
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      await store.set(conv.id, conv)
      return conv
    },

    async addMessage(id: string, message: Message) {
      const conv = await store.get(id)
      if (!conv) throw new Error('Conversation not found')

      conv.messages.push(message)
      conv.updatedAt = Date.now()
      await store.set(id, conv)
    }
  }
}
```

### Add P2P Model Sharing
```typescript
// src/p2p/model-share.ts
import Hyperdrive from 'hyperdrive'

export async function shareModel(drive: Hyperdrive, modelPath: string) {
  const modelData = await fs.readFile(modelPath)
  await drive.put('/shared-model.gguf', modelData)
  return drive.key.toString('hex')
}

export async function receiveModel(store: Corestore, shareKey: string) {
  const drive = new Hyperdrive(store.namespace('shared'), Buffer.from(shareKey, 'hex'))
  await drive.ready()
  return drive.get('/shared-model.gguf')
}
```

## Configuration

### Model Settings
```typescript
// src/config.ts
export const defaultConfig = {
  inference: {
    modelsPath: './models',
    defaultModel: 'llama-3.2-1b',
    contextLength: 4096,
    gpuLayers: 0  // 0 = CPU only, increase for GPU
  },
  storage: {
    path: './storage'
  }
}
```

## Common Tasks

### "Add a new chat screen"
1. Create UI component in `src/ui/chat.ts`
2. Use `createChatSession` from inference module
3. Wire up send/receive with streaming UI updates

### "Add model selection"
1. Use `engine.listModels()` to get available models
2. Add UI for selection
3. Call `engine.loadModel(name)` on selection

### "Persist chat history"
1. Use `createConversationStore` from data module
2. Save messages after each exchange
3. Load on startup

### "Add system prompt customization"
1. Add UI for editing system prompt
2. Call `session.setSystemPrompt(prompt)`
3. Persist in app settings

## Gotchas

1. **Model loading takes time** - Show loading indicator during `loadModel()`
2. **Memory usage** - Large models need RAM. Check `qvac.getModelInfo()` for requirements
3. **First token latency** - Cold start can be slow. Consider warm-up prompt
4. **Context limits** - Track token count, truncate old messages if needed
