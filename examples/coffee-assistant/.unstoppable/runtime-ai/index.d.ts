export interface Message { role: 'user' | 'assistant'; content: string }
export interface Adapter {
  mock?: boolean
  load(options: Record<string, unknown>): Promise<string>
  stream(modelId: string, history: Message[]): AsyncIterable<string>
  cancel(modelId: string): Promise<void>
  unload(modelId: string): Promise<void>
}
export class AIError extends Error { constructor(code: string, message: string, cause?: unknown); code: string }
export function createAISession(options: { adapter: Adapter; byteBudget?: number }): {
  readonly state: string
  readonly modelId: string | null
  readonly mock: boolean
  readonly lastError: AIError | null
  readonly capabilities: { streaming: true; cancellation: 'model'; concurrency: 1 }
  load(options?: Record<string, unknown>): Promise<string>
  stream(history: Message[], options: { requestId: string | number; signal?: AbortSignal; onTrim?: () => void }): AsyncIterable<string>
  cancel(requestId?: string | number): Promise<boolean>
  close(): Promise<void>
}
export function createBareAdapter(): Adapter
export function createNodeAdapter(): Adapter
export function createMockAdapter(options?: { delay?: number }): Adapter
export function prepareChatHistory(history: Message[], byteBudget: number): Message[]
export function streamChat(adapter: Adapter, modelId: string, history: Message[], byteBudget: number, onTrim?: () => void): AsyncIterable<string>
