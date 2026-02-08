/**
 * Tool Runner — QVAC tool-calling loop with parallel stream processing.
 *
 * Handles: tool definition, multi-round calling, parallel tokenStream + toolCallStream,
 * token filtering (<tool_call> blocks), fallback parsing with JSON repair,
 * Zod schema compat, and <think> block filtering.
 *
 * IMPORTANT: Install zod@^4 (not v3) — QVAC requires Zod v4.
 * IMPORTANT: Always load the model with `tools: true` in modelConfig.
 *
 * CUSTOMIZE: Define your tools in the `tools` array passed to runToolLoop().
 */

import { completion } from '@qvac/sdk'
import { z } from 'zod'
import type { ToolInput } from '@qvac/sdk'

// Re-export for convenience
export { z }
export type { ToolInput }

export interface ToolRunnerOptions {
  /** Model ID from ModelManager.load() */
  modelId: string
  /** Tool definitions with Zod schemas and handlers */
  tools: ToolInput[]
  /** Max rounds of tool calling before giving up. Default: 10 */
  maxRounds?: number
  /** KV cache session ID for multi-turn. Recommended. */
  sessionId?: string
  /** Called for each visible streamed token (tool call blocks filtered out) */
  onToken?: (token: string) => void
  /** Called when a tool is invoked */
  onToolCall?: (name: string, args: any) => void
  /** Called when a tool returns */
  onToolResult?: (name: string, result: any) => void
}

// ─── Token Filtering ────────────────────────────────────────────────────
// Strips <tool_call>...</tool_call> blocks from visible output.

function createTokenFilter() {
  let buffer = ''
  let insideToolCall = false
  let skipWhitespace = false

  return {
    filter(token: string): string | null {
      buffer += token
      if (buffer.includes('<tool_call>')) insideToolCall = true
      if (insideToolCall) {
        if (buffer.includes('</tool_call>')) {
          insideToolCall = false
          skipWhitespace = true
          buffer = ''
        }
        return null
      }
      if (skipWhitespace) {
        if (token.trim() === '') return null
        skipWhitespace = false
      }
      buffer = ''
      return token
    },
  }
}

// ─── JSON Repair ────────────────────────────────────────────────────────
// Small models produce slightly malformed JSON. Repair common issues.

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

// ─── Fallback Tool Call Parser ──────────────────────────────────────────

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

/**
 * Run a tool-calling conversation loop.
 *
 * The model generates text + tool calls. Tool results are fed back until
 * the model responds with only text (no tool calls) or maxRounds is hit.
 *
 * IMPORTANT: The model must be loaded with `tools: true` in modelConfig.
 * Without it, the model will describe tool calls in text instead of
 * actually calling them.
 *
 * Features:
 * - Parallel tokenStream + toolCallStream processing (workbench pattern)
 * - Token filtering (strips <tool_call> blocks from visible output)
 * - Fallback <tool_call> parsing with JSON repair for small models
 * - <think> block filtering
 *
 * Usage:
 *   const tools: ToolInput[] = [
 *     {
 *       name: 'get_time',
 *       description: 'Return the current time.',
 *       parameters: z.object({}),
 *       handler: async () => ({ time: new Date().toISOString() }),
 *     },
 *   ]
 *
 *   const response = await runToolLoop({
 *     modelId: model.id,
 *     tools,
 *     history: [{ role: 'user', content: 'What time is it?' }],
 *   })
 */
export async function runToolLoop(
  opts: ToolRunnerOptions & {
    history: Array<{ role: string; content: string }>
  }
): Promise<string> {
  const {
    modelId,
    tools,
    history,
    maxRounds = 10,
    sessionId,
    onToken,
    onToolCall,
    onToolResult,
  } = opts

  for (let round = 0; round < maxRounds; round++) {
    const result = completion({
      modelId,
      history,
      stream: true,
      tools,
      kvCache: sessionId ?? true,
    })

    // Process tokenStream + toolCallStream in PARALLEL (workbench pattern)
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
        // Real-time tool call events (useful for UI)
      }
    })()

    await Promise.all([tokenTask, toolCallTask])

    // Check for tool calls (SDK parsed first, then fallback)
    let toolCalls = await result.toolCalls

    // Fallback: parse <tool_call> blocks if SDK missed them
    if ((!toolCalls || toolCalls.length === 0) && fullResponse.includes('<tool_call>')) {
      const fallback = parseFallbackToolCalls(fullResponse)
      if (fallback.length > 0) {
        history.push({ role: 'assistant', content: fullResponse })
        for (const fc of fallback) {
          const tool = tools.find(t => t.name === fc.name)
          onToolCall?.(fc.name, fc.arguments)
          let toolResult: unknown
          try {
            toolResult = tool?.handler ? await tool.handler(fc.arguments) : fc.arguments
          } catch (error) {
            toolResult = { error: error instanceof Error ? error.message : String(error) }
          }
          onToolResult?.(fc.name, toolResult)
          history.push({
            role: 'user',
            content: `Tool "${fc.name}" returned:\n\n${JSON.stringify(toolResult)}`,
          })
        }
        continue // next round
      }
    }

    if (!toolCalls || toolCalls.length === 0) {
      // No tool calls — model is done, return the final text
      history.push({ role: 'assistant', content: fullResponse })
      // Strip <think> blocks from final output
      return fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }

    // Process SDK-parsed tool calls
    history.push({ role: 'assistant', content: fullResponse })

    for (const call of toolCalls) {
      onToolCall?.(call.name, call.arguments)

      let toolResult: unknown
      try {
        toolResult = call.invoke ? await call.invoke() : call.arguments
      } catch (error) {
        toolResult = {
          error: error instanceof Error ? error.message : String(error),
        }
      }

      onToolResult?.(call.name, toolResult)

      // Feed tool result back as a user message (QVAC convention)
      history.push({
        role: 'user',
        content: `Tool "${call.name}" returned:\n\n${JSON.stringify(toolResult)}`,
      })
    }
  }

  return '[Max tool rounds reached]'
}

/**
 * Helper: Create a ToolInput definition.
 *
 * IMPORTANT Zod schema rules for QVAC compatibility:
 *   - Use base types only: z.string(), z.number(), z.boolean(), z.object(), z.array()
 *   - Do NOT use: .min(), .max(), .regex(), .integer(), .email() — these break grammar
 *   - Validate constraints inside the handler instead
 *   - Always add .describe() for each parameter
 */
export function defineTool<T extends z.ZodRawShape>(input: {
  name: string
  description: string
  parameters: z.ZodObject<T>
  handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
}): ToolInput {
  return input as ToolInput
}
