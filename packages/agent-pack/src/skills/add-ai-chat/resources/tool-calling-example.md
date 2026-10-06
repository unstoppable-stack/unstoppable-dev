# QVAC Tool Calling — Full Example

## Complete Working Example

This example shows a tool-calling agent with:
- `tools: true` enabled (required for tool calling)
- Parallel stream processing (tokenStream + toolCallStream)
- Token filtering (strips `<tool_call>` blocks from visible output)
- Fallback parsing with JSON repair
- KV cache and sliding window context management

```ts
import { z } from 'zod'
import {
  completion,
  loadModel,
  unloadModel,
  deleteCache,
  QWEN_3_1_7B_INST_Q4,
  type ToolInput,
} from '@qvac/sdk'

// ─── Define Tools ───────────────────────────────────────

const tools: ToolInput[] = [
  {
    name: 'get_time',
    description: 'Return the current local time as an ISO string.',
    parameters: z.object({}),
    handler: async () => ({ now: new Date().toISOString() }),
  },
  {
    name: 'add',
    description: 'Add two numbers.',
    parameters: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    handler: async ({ a, b }: { a: number; b: number }) => ({ sum: a + b }),
  },
]

// ─── Load Model (tools: true is REQUIRED) ───────────────

const CTX_SIZE = 4096
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: CTX_SIZE,
    tools: true, // REQUIRED — activates native tool-calling template
  },
})

// ─── Token Filtering ────────────────────────────────────
// Strips <tool_call>...</tool_call> blocks from the user-visible token stream.
// Adapted from the QVAC workbench desktop completion handler.

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
        return null // Suppress tokens inside tool call blocks
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

// ─── JSON Repair ────────────────────────────────────────
// Small models (3-4B) frequently produce slightly malformed JSON in tool calls.
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

// ─── Fallback Tool Call Parser ──────────────────────────
// If the SDK's `toolCalls` promise returns empty but the raw text contains
// <tool_call> blocks, parse them manually with JSON repair.

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

// ─── Think Block Helpers ────────────────────────────────

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// ─── Tool-Calling Loop ─────────────────────────────────
// Processes tokenStream + toolCallStream in PARALLEL (matches workbench pattern).
// Uses token filtering to strip <tool_call> blocks from visible output.

const MAX_TOOL_ROUNDS = 10

async function runToolCallingLoop(opts: {
  modelId: string
  history: Array<{ role: string; content: string }>
  tools: ToolInput[]
  kvCache: string
  onToken?: (token: string) => void
  onToolCall?: (name: string) => void
}): Promise<string> {
  const { modelId, history, tools, kvCache, onToken, onToolCall } = opts

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = completion({
      modelId,
      history,
      stream: true,
      tools,
      kvCache,
    })

    // ── Parallel processing of token stream + tool call stream ──
    let fullResponse = ''
    const tokenFilter = createTokenFilter()

    const tokenTask = (async () => {
      for await (const token of result.tokenStream) {
        fullResponse += token
        // Filter <tool_call> blocks from visible output
        const filtered = tokenFilter.filter(token)
        if (filtered !== null) onToken?.(filtered)
      }
    })()

    const toolCallTask = (async () => {
      for await (const evt of result.toolCallStream) {
        if (evt.type === 'toolCall') {
          onToolCall?.(evt.call.name) // Real-time "calling X..." UX
        }
      }
    })()

    await Promise.all([tokenTask, toolCallTask])

    // ── Emit stats ──────────────────────────────────────────
    const stats = await result.stats
    if (stats) {
      console.log(`[Stats] TTFT: ${stats.timeToFirstToken}ms, ${stats.tokensPerSecond.toFixed(1)} tok/s, cache: ${stats.cacheTokens}`)
    }

    // ── Resolve tool calls (SDK parsed + fallback) ──────────
    let toolCalls = await result.toolCalls

    // Fallback: parse <tool_call> blocks from raw response if SDK missed them
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
          history.push({
            role: 'user',
            content: `Tool "${fc.name}" returned:\n\n${JSON.stringify(toolResult)}`,
          })
        }
        continue // next round
      }
    }

    if (!toolCalls || toolCalls.length === 0) {
      history.push({ role: 'assistant', content: fullResponse })
      return stripThinkBlocks(fullResponse)
    }

    // Execute SDK-parsed tool calls
    history.push({ role: 'assistant', content: fullResponse })

    for (const call of toolCalls) {
      let toolResult: unknown
      try {
        toolResult = call.invoke ? await call.invoke() : call.arguments
      } catch (error) {
        toolResult = { error: error instanceof Error ? error.message : String(error) }
      }
      history.push({
        role: 'user',
        content: `Tool "${call.name}" returned:\n\n${JSON.stringify(toolResult)}`,
      })
    }
  }

  return '[Max tool rounds reached]'
}

// ─── Main ───────────────────────────────────────────────

const sessionId = `session-${Date.now()}`
const history: Array<{ role: string; content: string }> = [
  {
    role: 'system',
    // Reasoning is disabled at load time via `reasoning_budget: 0`.
    content: 'You are a helpful assistant that can check the time and do math.',
  },
  { role: 'user', content: 'What time is it, and what is 12 + 30?' },
]

const response = await runToolCallingLoop({
  modelId,
  history,
  tools,
  kvCache: sessionId,
  onToken: (token) => process.stdout.write(token),
  onToolCall: (name) => console.log(`\n[Calling ${name}...]`),
})

console.log('\n\nFinal response:', response)

// Cleanup
await deleteCache({ kvCacheKey: sessionId })
await unloadModel({ modelId })
```

## API Placement Reference

```
loadModel() config:           completion() params:
├── modelSrc                  ├── modelId
├── modelType: 'llm'          ├── history
├── modelConfig:              ├── stream: true
│   ├── ctx_size              ├── tools (definitions)
│   ├── system_prompt         ├── kvCache (session key)
│   └── tools: true           └── generationParams:
└── onProgress                     ├── temp, top_p, top_k
                                   ├── predict
                                   └── seed, penalties
```

**`completion()` does NOT accept `modelConfig`.** Sampling params go in
`generationParams` (strict, no extra keys). Tool handlers are dispatched with
`.invoke()` — `.call()` was renamed in 0.9.

## Key Patterns Summary

| Pattern | Implementation |
|---------|---------------|
| `tools: true` | Always set in `modelConfig` — REQUIRED for tool calling |
| Parallel streams | `Promise.all([tokenTask, toolCallTask])` |
| Token filtering | `createTokenFilter()` strips `<tool_call>` blocks from visible output |
| Fallback parsing | `parseFallbackToolCalls()` with `repairJson()` for malformed JSON |
| Reasoning control | `reasoning_budget: 0` in `modelConfig` — not prompt text, not stream stripping |
| Context bound | Bound history before inference; retry overflow once before output |
| No "respond" tool | Model generates free text naturally alongside tool calls |
