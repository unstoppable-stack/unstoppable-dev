---
name: qvac-tool-calling
description: Enable local LLM tool calling with QVAC SDK
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# QVAC Tool Calling

## When to Use
- User wants an LLM to call local functions/tools
- User mentions "function calling", "tool use", or "agent with tools"
- User needs structured output from a local model

## Prerequisites
- QVAC SDK installed (`@qvac/sdk@^0.6.0`), Zod **v4** installed (`zod@^4.0.0`)
- A tool-calling-capable model: `QWEN_3_1_7B_INST_Q4` (recommended), `QWEN_3_4B_INST_Q4_K_M`, or `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K`
- Minimum 3B+ model for reliable tool calling; 1B models are unreliable

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer
> (browser context). It MUST run in a **worker process** started via `pear-run`.
> See the `pear-desktop-app` skill → `resources/worker-pattern.md`.

## ⚠ CRITICAL: Always Enable `tools: true`

**Always set `modelConfig.tools: true`** when using tool-calling models. This
activates the model's native tool-calling template. The model can still generate
free text — it is NOT constrained to JSON-only output.

```ts
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: 4096,
    n_discarded: Math.floor(4096 / 10),
    tools: true, // REQUIRED — enables tool-calling template
  },
})
```

**Without `tools: true`**: The model doesn't know how to format `<tool_call>` blocks.
It describes tool usage in plain text instead of actually calling them. Example:
"Your order has been sent" — but `sendOrder` was never actually called. This is
extremely confusing to debug because the model's output *looks* correct.

**With `tools: true`**: The model's native tool-calling template is activated. It
produces structured `<tool_call>` blocks when it wants to call tools, AND produces
free text for conversational replies. The QVAC workbench (the reference implementation)
ALWAYS enables `tools: true` for models that support tools.

> **Do NOT create a "respond" or "reply" tool.** The model can generate free text
> naturally even with `tools: true` enabled. If you find yourself needing a tool
> just to let the model reply, you're misunderstanding how `tools: true` works.

## API Surface — What Goes Where

**IMPORTANT**: `completion()` does NOT accept `modelConfig`. Configuration is split:

| Parameter | Set in `loadModel()` | Set in `completion()` |
|-----------|---------------------|----------------------|
| `ctx_size` | `modelConfig.ctx_size` | — |
| `n_discarded` | `modelConfig.n_discarded` | — |
| `tools: true` | `modelConfig.tools` | — |
| Tool definitions | — | `tools: [...]` |
| KV cache | — | `kvCache: sessionId` |
| History | — | `history: [...]` |
| Streaming | — | `stream: true` |

## `completion()` Return Shape

```ts
const result = completion({ modelId, history, stream: true, tools, kvCache })
// result.tokenStream   — AsyncIterable<string> (streaming tokens)
// result.toolCallStream — AsyncIterable<{ type: 'toolCall', call: {...} }> (real-time tool call events)
// result.text          — Promise<string> (full response text)
// result.toolCalls     — Promise<ToolCall[]> (all parsed tool calls)
// result.stats         — Promise<{ timeToFirstToken, tokensPerSecond, cacheTokens }>
```

Use `toolCallStream` for real-time UI updates ("calling X..."), and `toolCalls` for
the final resolved list to execute.

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add @qvac/sdk zod@^4
   ```
   > **IMPORTANT**: Install Zod v4, not v3. `@qvac/sdk` internally depends on Zod v4 and `ToolInput` types are incompatible with v3.

2. **Define tools** using `ToolInput` with Zod schemas + handler functions

3. **Load a tool-calling model** with `modelConfig` including `tools: true`

4. **Implement a tool-calling loop** with `runToolCallingLoop()` (see below)

5. **Use `kvCache: sessionId`** in `completion()` for multi-turn caching

## Quick Implementation — Complete Tool-Calling Loop

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

// --- Define tools ---
const tools: ToolInput[] = [{
  name: 'get_time',
  description: 'Return current time',
  parameters: z.object({}),
  handler: async () => ({ now: new Date().toISOString() }),
}]

// --- Load model with tools: true ---
const CTX_SIZE = 4096
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: CTX_SIZE,
    n_discarded: Math.floor(CTX_SIZE / 10),
    tools: true, // REQUIRED — activates tool-calling template
  },
})

// --- Token filtering (strips <tool_call> blocks from visible output) ---
function createTokenFilter() {
  let buffer = '', insideToolCall = false, skipWS = false
  return {
    filter(token: string): string | null {
      buffer += token
      if (buffer.includes('<tool_call>')) insideToolCall = true
      if (insideToolCall) {
        if (buffer.includes('</tool_call>')) {
          insideToolCall = false
          skipWS = true
          buffer = ''
        }
        return null
      }
      if (skipWS) {
        if (token.trim() === '') return null
        skipWS = false
      }
      buffer = ''
      return token
    }
  }
}

// --- JSON repair for fallback parsing (handles malformed output from small models) ---
function repairJson(json: string): string {
  let repaired = json.trim()
  let openBraces = 0, closeBraces = 0, openBrackets = 0, closeBrackets = 0
  let inString = false, escapeNext = false
  for (const char of repaired) {
    if (escapeNext) { escapeNext = false; continue }
    if (char === '\\') { escapeNext = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (!inString) {
      if (char === '{') openBraces++; if (char === '}') closeBraces++
      if (char === '[') openBrackets++; if (char === ']') closeBrackets++
    }
  }
  if (inString) repaired += '"'
  if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets)
  if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces)
  return repaired
}

// --- Fallback <tool_call> parser with JSON repair ---
function parseFallbackToolCalls(text: string) {
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = []
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const repaired = repairJson(match[1].trim())
      const parsed = JSON.parse(repaired)
      if (parsed.name && parsed.arguments) calls.push(parsed)
    } catch { /* skip malformed */ }
  }
  return calls
}

// --- Tool-calling loop with parallel stream processing ---
const MAX_TOOL_ROUNDS = 10

async function runToolCallingLoop(opts: {
  modelId: string
  history: Array<{ role: string; content: string }>
  tools: ToolInput[]
  kvCache: string
  onToken?: (token: string) => void
}): Promise<string> {
  const { modelId, history, tools, kvCache, onToken } = opts

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = completion({
      modelId,
      history,
      stream: true,
      tools,
      kvCache,
    })

    // Process tokenStream + toolCallStream in PARALLEL (matches workbench pattern)
    let fullResponse = ''
    const tokenFilter = createTokenFilter()

    const tokenTask = (async () => {
      for await (const token of result.tokenStream) {
        fullResponse += token
        const filtered = tokenFilter.filter(token)
        if (filtered !== null) onToken?.(filtered)
      }
    })()

    const toolCallTask = (async () => {
      for await (const evt of result.toolCallStream) {
        // Real-time tool call events — useful for UI
      }
    })()

    await Promise.all([tokenTask, toolCallTask])

    // Resolve tool calls (SDK parsed + fallback)
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
      return fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
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
```

## Key Gotchas
- **Always set `tools: true` in `modelConfig`** — without it, tools silently don't work
- **Do NOT create a "respond" tool** — the model generates free text naturally with `tools: true`
- **`completion()` does NOT accept `modelConfig`** — set `n_discarded`, `ctx_size`, `tools: true` in `loadModel()` instead
- **Filter `<tool_call>` blocks from visible output** — use the token filter pattern above
- **Zod v4 required**: `@qvac/sdk` depends on Zod v4 internally. Installing v3 causes confusing TypeScript errors.
- Use only base Zod types (string, number, boolean, object, array) — avoid `.integer()`, `.min()`, `.regex()`
- Validate constraints inside the handler, not in the schema
- Use Qwen 3 models for best tool-calling reliability (`QWEN_3_1_7B_INST_Q4` recommended)
- **1B models are unreliable** for tool calling; use 3B+ minimum, 7B recommended
- `call.invoke()` runs the handler; catch errors and return structured error payloads
- Qwen 3 models emit `<think>...</think>` blocks — filter them from display
- Add `/no_think` to the system prompt to suppress reasoning
- Think tokens still count against the context window even when suppressed
- Process `tokenStream` and `toolCallStream` in parallel (via `Promise.all`), not sequentially

## Deep Dive
- Full example with token filtering and JSON repair: read `resources/full-example.md`
- Schema best practices: read `resources/schema-guide.md`
- Troubleshooting: read `resources/troubleshooting.md`
