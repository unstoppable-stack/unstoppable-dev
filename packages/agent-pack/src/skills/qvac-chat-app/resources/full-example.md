# QVAC Chat App — Full Working Example

A complete Node.js CLI chat app with tool calling, parallel stream processing,
token filtering, fallback parsing with JSON repair, context management, and
Qwen 3 `<think>` handling. Based on patterns from the QVAC workbench and the
coffee-assistant reference project.

## Project Setup

```bash
mkdir my-chat-app && cd my-chat-app
pnpm init
pnpm add @qvac/sdk zod@^4
pnpm add -D typescript @types/node tsx
```

**package.json** scripts:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  }
}
```

**tsconfig.json**:
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
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## Complete Source Code

```ts
// src/index.ts
import { z } from 'zod'
import {
  completion,
  loadModel,
  unloadModel,
  deleteCache,
  QWEN_3_1_7B_INST_Q4,
  type ToolInput,
} from '@qvac/sdk'
import * as readline from 'node:readline'

// ─── Tools ───────────────────────────────────────────────

const tools: ToolInput[] = [
  {
    name: 'get_time',
    description: 'Return the current local time.',
    parameters: z.object({}),
    handler: async () => ({ time: new Date().toLocaleTimeString() }),
  },
  {
    name: 'calculate',
    description: 'Evaluate a math expression.',
    parameters: z.object({
      expression: z.string().describe('Math expression to evaluate, e.g. "12 + 30"'),
    }),
    handler: async ({ expression }: { expression: string }) => {
      try {
        const result = Function(`"use strict"; return (${expression})`)()
        return { expression, result }
      } catch {
        return { error: `Could not evaluate: ${expression}` }
      }
    },
  },
]

// ─── Token Filtering ─────────────────────────────────────
// Strips <tool_call>...</tool_call> blocks from user-visible output.
// Users see clean text while tool calls are processed internally.

function createTokenFilter() {
  let buffer = ''
  let insideToolCall = false
  let skipWhitespaceAfterToolCall = false

  return {
    filter(token: string): string | null {
      buffer += token
      if (buffer.includes('<tool_call>')) insideToolCall = true
      if (insideToolCall) {
        if (buffer.includes('</tool_call>')) {
          insideToolCall = false
          skipWhitespaceAfterToolCall = true
          buffer = ''
        }
        return null
      }
      if (skipWhitespaceAfterToolCall) {
        if (token.trim() === '') return null
        skipWhitespaceAfterToolCall = false
      }
      buffer = ''
      return token
    },
  }
}

// ─── JSON Repair ─────────────────────────────────────────
// Small models (3-4B) frequently produce slightly malformed JSON.
// This repairs common issues: unclosed braces, brackets, strings.

function repairJson(json: string): string {
  let repaired = json.trim()
  let openBraces = 0, closeBraces = 0, openBrackets = 0, closeBrackets = 0
  let inString = false, escapeNext = false

  for (const char of repaired) {
    if (escapeNext) { escapeNext = false; continue }
    if (char === '\\') { escapeNext = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (!inString) {
      if (char === '{') openBraces++
      if (char === '}') closeBraces++
      if (char === '[') openBrackets++
      if (char === ']') closeBrackets++
    }
  }

  if (inString) repaired += '"'
  if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets)
  if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces)

  return repaired
}

// ─── Fallback Tool Call Parser ───────────────────────────

function parseFallbackToolCalls(
  text: string,
): Array<{ name: string; arguments: Record<string, unknown> }> {
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = []
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const repaired = repairJson(match[1].trim())
      const parsed = JSON.parse(repaired)
      if (parsed.name && parsed.arguments) {
        calls.push(parsed)
      }
    } catch { /* skip malformed */ }
  }
  return calls
}

// ─── Think Block Helpers ─────────────────────────────────

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// ─── Tool-Calling Loop (Parallel Streams) ────────────────

const MAX_TOOL_ROUNDS = 10

async function runToolCallingLoop(opts: {
  modelId: string
  history: Array<{ role: string; content: string }>
  tools: ToolInput[]
  kvCache: string
}): Promise<string> {
  const { modelId, history, tools, kvCache } = opts

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = completion({
      modelId,
      history,
      stream: true,
      tools,
      kvCache,
    })

    // Process tokenStream + toolCallStream in PARALLEL (workbench pattern)
    let fullResponse = ''
    const tokenFilter = createTokenFilter()

    const tokenTask = (async () => {
      for await (const token of result.tokenStream) {
        fullResponse += token
        const filtered = tokenFilter.filter(token)
        if (filtered !== null) {
          process.stdout.write(filtered)
        }
      }
    })()

    const toolCallTask = (async () => {
      for await (const evt of result.toolCallStream) {
        if (evt.type === 'toolCall') {
          // Real-time tool call detection (useful for UI)
        }
      }
    })()

    await Promise.all([tokenTask, toolCallTask])

    // Stats
    const stats = await result.stats
    if (stats) {
      console.log(`\n[${stats.tokensPerSecond.toFixed(1)} tok/s, TTFT: ${stats.timeToFirstToken}ms]`)
    }

    // Resolve tool calls (SDK + fallback)
    let toolCalls = await result.toolCalls

    if ((!toolCalls || toolCalls.length === 0) && fullResponse.includes('<tool_call>')) {
      const fallback = parseFallbackToolCalls(fullResponse)
      if (fallback.length > 0) {
        history.push({ role: 'assistant', content: fullResponse })
        for (const fc of fallback) {
          const tool = tools.find(t => t.name === fc.name)
          let toolResult: unknown
          try {
            toolResult = tool?.handler ? await tool.handler(fc.arguments) : fc.arguments
          } catch (error) {
            toolResult = { error: error instanceof Error ? error.message : String(error) }
          }
          console.log(`[Tool: ${fc.name}] →`, JSON.stringify(toolResult))
          history.push({
            role: 'user',
            content: `Tool "${fc.name}" returned:\n\n${JSON.stringify(toolResult)}`,
          })
        }
        continue
      }
    }

    if (!toolCalls || toolCalls.length === 0) {
      history.push({ role: 'assistant', content: fullResponse })
      return stripThinkBlocks(fullResponse)
    }

    history.push({ role: 'assistant', content: fullResponse })

    for (const call of toolCalls) {
      let toolResult: unknown
      try {
        toolResult = call.invoke ? await call.invoke() : call.arguments
      } catch (error) {
        toolResult = { error: error instanceof Error ? error.message : String(error) }
      }
      console.log(`\n[Tool: ${call.name}] →`, JSON.stringify(toolResult))
      history.push({
        role: 'user',
        content: `Tool "${call.name}" returned:\n\n${JSON.stringify(toolResult)}`,
      })
    }
  }

  return '[Max tool rounds reached]'
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('Loading model...')

  const CTX_SIZE = 4096
  const modelId = await loadModel({
    modelSrc: QWEN_3_1_7B_INST_Q4,
    modelType: 'llm',
    modelConfig: {
      ctx_size: CTX_SIZE,
      n_discarded: Math.floor(CTX_SIZE / 10), // 10% sliding window
      tools: true, // REQUIRED — activates tool-calling template
    },
    onProgress: (p) => {
      process.stdout.write(`\rDownloading: ${p.percentage.toFixed(1)}%`)
    },
  })
  console.log('\nModel loaded!\n')

  const sessionId = `chat-${Date.now()}`
  const history: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `You are a helpful assistant. Answer questions concisely.
You can check the time and do math calculations.
/no_think`,
    },
  ]

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const prompt = () => {
    rl.question('\nYou: ', async (input) => {
      const trimmed = input.trim()
      if (!trimmed || trimmed === 'exit' || trimmed === 'quit') {
        console.log('\nCleaning up...')
        await deleteCache({ kvCacheKey: sessionId })
        await unloadModel({ modelId })
        rl.close()
        process.exit(0)
      }

      history.push({ role: 'user', content: trimmed })
      process.stdout.write('\nAssistant: ')

      await runToolCallingLoop({
        modelId,
        history,
        tools,
        kvCache: sessionId,
      })

      prompt()
    })
  }

  console.log('Chat started! Type "exit" to quit.\n')
  prompt()
}

main().catch(console.error)
```

## What This Example Covers

| Feature | How It's Implemented |
|---------|---------------------|
| `tools: true` | Set in `modelConfig` at load time — REQUIRED for tool calling |
| Context config | `ctx_size` + `n_discarded` + `tools: true` set at **load time** |
| Parallel streams | `Promise.all([tokenTask, toolCallTask])` for real-time processing |
| Token filtering | `createTokenFilter()` strips `<tool_call>` blocks from visible output |
| Tool-calling loop | `runToolCallingLoop()` with `MAX_TOOL_ROUNDS` limit |
| SDK tool parsing | `result.toolCalls` checked first |
| Fallback parsing | Manual `<tool_call>` extraction with JSON repair |
| History management | Append assistant/tool messages to `history` array |
| KV cache | Stable `sessionId` key passed to `completion()` |
| Sliding window | `n_discarded` in `modelConfig` at load time |
| `<think>` handling | `stripThinkBlocks()` + `/no_think` in system prompt |
| Stats | `result.stats` for TTFT, tok/s, cache tokens |
| Error handling | Try/catch in tool handlers, structured error payloads |
| Cleanup | `deleteCache()` + `unloadModel()` on exit |
| No "respond" tool | Model generates free text naturally alongside tool calls |

## API Placement Reference

```
loadModel():                  completion():
├── modelSrc                  ├── modelId
├── modelType: 'llm'         ├── history: [...]
├── modelConfig:              ├── stream: true
│   ├── ctx_size              ├── tools: ToolInput[]
│   ├── n_discarded           └── kvCache: string | boolean
│   └── tools: true
└── onProgress

completion() returns:
├── tokenStream     — AsyncIterable<string>
├── toolCallStream  — AsyncIterable<{ type: 'toolCall', call: {...} }>
├── text            — Promise<string>
├── toolCalls       — Promise<ToolCall[]>
└── stats           — Promise<{ timeToFirstToken, tokensPerSecond, cacheTokens }>
```

**`completion()` does NOT accept `modelConfig`.**
