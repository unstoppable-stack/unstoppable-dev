---
id: qvac-kv-cache
name: QVAC KV Cache & Context Management
category: recipe
requires: [qvac]
tags: [ai, performance, context]
---

# Recipe: QVAC KV Cache & Context Management

## Problem

Manage context window limits and speed up repeated completions in multi-turn
conversations and tool-calling loops.

## Prerequisites

- QVAC SDK installed (`@qvac/sdk`).
- An LLM model loaded with `loadModel`.

## Solution

QVAC provides three mechanisms for context management:

### 1. KV Cache (`kvCache`)

Caches the computed key-value attention state so the model doesn't need to
re-process the full history on each turn.

- `kvCache: true` — auto-generates a cache key based on model + config hash +
  system prompt. Good for simple single-session use.
- `kvCache: "session-id"` — uses a string as a manual session key. **Recommended**
  for production use. Gives you control over cache isolation per
  thread/conversation.

Cache files are isolated by model + config hash + system prompt. Two different
system prompts will produce separate caches even with the same key.

### 2. Sliding Window (`n_discarded`)

Set `n_discarded: N` in `modelConfig` **at model load time** to enable automatic
sliding-window context management. When the context fills up, the oldest `N`
tokens are automatically discarded. This **eliminates the need for manual history
trimming** in most cases.

**IMPORTANT**: `completion()` does NOT accept `modelConfig`. Set it at load time:

```ts
const CTX_SIZE = 4096
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: CTX_SIZE,
    n_discarded: Math.floor(CTX_SIZE / 10), // 10% sliding window
  },
})
```

**Rule of thumb**: Set `n_discarded` to ~10% of `ctx_size`:
```ts
const ctx_size = 4096
const n_discarded = Math.floor(ctx_size / 10)  // 409
```

### 3. Cache Cleanup (`deleteCache`)

Clean up caches when a conversation ends or the model changes:

```ts
import { deleteCache } from '@qvac/sdk'

// Delete a specific session cache
await deleteCache({ kvCacheKey: sessionId })

// Delete a specific session for a specific model
await deleteCache({ kvCacheKey: sessionId, modelId })

// Delete ALL caches
await deleteCache({ all: true })
```

## Full Example

```ts
import {
  completion,
  loadModel,
  unloadModel,
  deleteCache,
  QWEN_3_1_7B_INST_Q4,
} from '@qvac/sdk'

// Context management is set at LOAD TIME via modelConfig
const CTX_SIZE = 4096
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: CTX_SIZE,
    n_discarded: Math.floor(CTX_SIZE / 10), // 10% auto sliding window
  },
})

const sessionId = `chat-${Date.now()}`
const history: Array<{ role: string; content: string }> = []

async function chat(userMessage: string): Promise<string> {
  history.push({ role: 'user', content: userMessage })

  // completion() params: modelId, history, stream, kvCache — NO modelConfig
  const result = completion({
    modelId,
    history,
    stream: true,
    kvCache: sessionId,
  })

  let response = ''
  for await (const token of result.tokenStream) {
    process.stdout.write(token)
    response += token
  }

  history.push({ role: 'assistant', content: response.trim() })
  return response.trim()
}

// Multi-turn conversation — context is managed automatically
await chat('What is the capital of France?')
await chat('What about Germany?')
await chat('And Spain?')

// Cleanup when conversation ends
await deleteCache({ kvCacheKey: sessionId })
await unloadModel({ modelId })
```

## Tool Calling with Context Management

Tool-calling loops grow history rapidly. Set `n_discarded` and `tools: true`
at **load time** and use a stable `kvCache` key for the entire loop:

```ts
// All modelConfig params set at LOAD TIME
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: 4096,
    n_discarded: Math.floor(4096 / 10), // auto sliding window
    tools: true, // REQUIRED — activates tool-calling template
  },
})

const sessionId = `tool-session-${Date.now()}`

// Use the same sessionId for all rounds of tool calling
for (let round = 0; round < MAX_ROUNDS; round++) {
  const result = completion({
    modelId,
    history,
    stream: true,
    tools,
    kvCache: sessionId, // stable key across all rounds
  })
  // ... handle tool calls ...
}

// Clean up after the tool-calling session
await deleteCache({ kvCacheKey: sessionId })
```

## Notes

- `kvCache: true` auto-generates a key — but it may differ between calls if
  history changes. Use a string key for predictable caching.
- When a cache exists, only the new (last) message is processed by the model;
  everything before is served from cache.
- `n_discarded` eliminates the need for manual history trimming (`splice`,
  `shift`, etc.) in most cases.
- Cache files persist on disk. Call `deleteCache()` when done to free storage.

## Troubleshooting

### Problem: Cache has no effect

**Symptoms**: No speed improvement between calls. **Solution**: Ensure the
second request reuses the same prior messages and the same `kvCache` key.

### Problem: Context overflow despite kvCache

**Symptoms**: Context overflow error even with caching. **Solution**: Add
`n_discarded: N` to `modelConfig` to enable automatic sliding window. Without
it, history still accumulates.

### Problem: Stale cache after model change

**Symptoms**: Unexpected outputs after switching models. **Solution**: Call
`deleteCache({ kvCacheKey: sessionId })` when changing models or system prompts.

## Related

- `output/modules/qvac.md`
- `output/recipes/qvac-tool-calling.md`
