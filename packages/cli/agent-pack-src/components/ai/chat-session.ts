/**
 * Chat Session — Streaming chat with context management and kv-cache.
 *
 * Handles: message history, streaming tokens, Qwen <think> filtering, session lifecycle.
 *
 * CUSTOMIZE: Change the system prompt and model for your app.
 */

import { completion } from '@qvac/sdk'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatSessionOptions {
  /** Model ID from ModelManager.load() */
  modelId: string
  /** System prompt — embed reference data here for best results with small models */
  systemPrompt?: string
  /** Session ID for KV cache persistence. Recommended for multi-turn. */
  sessionId?: string
  /** Max messages to keep in history (older messages trimmed). Default: 50 */
  maxHistory?: number
  /** Filter Qwen 3 <think> blocks from output. Default: true */
  filterThinkBlocks?: boolean
}

export class ChatSession {
  private history: ChatMessage[] = []
  private opts: ChatSessionOptions

  constructor(opts: ChatSessionOptions) {
    this.opts = {
      maxHistory: 50,
      filterThinkBlocks: true,
      ...opts,
    }

    if (opts.systemPrompt) {
      this.history.push({ role: 'system', content: opts.systemPrompt })
    }
  }

  /**
   * Send a message and stream the response.
   *
   * Usage:
   *   for await (const token of session.send('Hello!')) {
   *     process.stdout.write(token)
   *   }
   */
  async *send(message: string): AsyncGenerator<string, string, undefined> {
    this.history.push({ role: 'user', content: message })
    this.trimHistory()

    const result = completion({
      modelId: this.opts.modelId,
      history: [...this.history],
      stream: true,
      kvCache: this.opts.sessionId ?? true,
    })

    let fullResponse = ''
    let insideThinkBlock = false

    for await (const token of result.tokenStream) {
      fullResponse += token

      // Filter <think>...</think> blocks (Qwen 3 reasoning)
      if (this.opts.filterThinkBlocks) {
        insideThinkBlock = this.isInsideThinkBlock(fullResponse)
        if (!insideThinkBlock && !token.includes('<think>')) {
          yield token
        }
      } else {
        yield token
      }
    }

    // Clean final response
    let cleanResponse = fullResponse
    if (this.opts.filterThinkBlocks) {
      cleanResponse = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }

    this.history.push({ role: 'assistant', content: cleanResponse })
    return cleanResponse
  }

  /**
   * Send a message and get the full response (non-streaming).
   */
  async sendAndWait(message: string): Promise<string> {
    let result = ''
    for await (const token of this.send(message)) {
      result += token
    }
    return result
  }

  /** Get current conversation history */
  getHistory(): ChatMessage[] {
    return [...this.history]
  }

  /** Clear conversation history (keeps system prompt) */
  clear(): void {
    const systemPrompt = this.history.find(m => m.role === 'system')
    this.history = systemPrompt ? [systemPrompt] : []
  }

  /** Number of messages in history */
  get messageCount(): number {
    return this.history.length
  }

  private trimHistory(): void {
    const max = this.opts.maxHistory!
    if (this.history.length <= max) return

    // Keep system prompt + most recent messages
    const systemPrompt = this.history.find(m => m.role === 'system')
    const recent = this.history.slice(-max)
    this.history = systemPrompt && recent[0] !== systemPrompt
      ? [systemPrompt, ...recent]
      : recent
  }

  private isInsideThinkBlock(text: string): boolean {
    const lastOpen = text.lastIndexOf('<think>')
    const lastClose = text.lastIndexOf('</think>')
    return lastOpen > lastClose
  }
}
