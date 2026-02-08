/**
 * QVAC Model Manager — Load, use, and unload AI models safely.
 *
 * Handles: download progress, context config, memory cleanup, error handling.
 *
 * CUSTOMIZE: Change the default model and context size for your use case.
 */

import {
  loadModel,
  unloadModel,
  downloadAsset,
  deleteCache,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk'

export interface ModelManagerOptions {
  /** Model source constant or URL. Default: LLAMA_3_2_1B_INST_Q4_0 */
  modelSrc?: any
  /** Context window size. Default: 4096 */
  ctxSize?: number
  /** Sliding window discard count. Default: ctxSize / 10 */
  nDiscarded?: number
  /** Enable native tool-calling support (tools: true in modelConfig). Default: true for tool-calling models.
   * ALWAYS set to true when using tool-calling models — without it, tools silently don't work.
   * The model can still generate free text alongside tool calls. */
  enableTools?: boolean
  /** Called during model download */
  onProgress?: (progress: { percentage: number; downloaded: number; total: number }) => void
  /** Called on errors (non-fatal) */
  onError?: (err: Error) => void
}

export class ModelManager {
  private modelId: string | null = null
  private opts: ModelManagerOptions
  private loading = false

  constructor(opts: ModelManagerOptions = {}) {
    this.opts = {
      modelSrc: opts.modelSrc ?? LLAMA_3_2_1B_INST_Q4_0,
      ctxSize: opts.ctxSize ?? 4096,
      nDiscarded: opts.nDiscarded ?? Math.floor((opts.ctxSize ?? 4096) / 10),
      ...opts,
    }
  }

  /**
   * Download the model for offline use (optional, loadModel downloads too).
   * Useful for showing a separate download step in the UI.
   */
  async predownload(): Promise<void> {
    await downloadAsset({
      assetSrc: this.opts.modelSrc,
      onProgress: this.opts.onProgress,
    })
  }

  /**
   * Load the model into memory. Must be called before inference.
   *
   * IMPORTANT: Context config (ctx_size, n_discarded) goes here, NOT in completion().
   */
  async load(): Promise<string> {
    if (this.modelId) return this.modelId
    if (this.loading) throw new Error('Model is already loading')

    this.loading = true
    try {
      this.modelId = await loadModel({
        modelSrc: this.opts.modelSrc,
        modelType: 'llm',
        onProgress: this.opts.onProgress,
        modelConfig: {
          ctx_size: this.opts.ctxSize,
          n_discarded: this.opts.nDiscarded,
          ...(this.opts.enableTools !== false ? { tools: true } : {}),
        },
      })
      return this.modelId
    } finally {
      this.loading = false
    }
  }

  /**
   * Get the current model ID. Throws if not loaded.
   */
  get id(): string {
    if (!this.modelId) throw new Error('Model not loaded. Call load() first.')
    return this.modelId
  }

  /** Whether a model is currently loaded */
  get isLoaded(): boolean {
    return this.modelId !== null
  }

  /**
   * Unload the model and free memory.
   * IMPORTANT: Always call this when done — models consume significant RAM.
   */
  async unload(): Promise<void> {
    if (!this.modelId) return
    const id = this.modelId
    this.modelId = null
    await unloadModel({ modelId: id })
  }

  /**
   * Delete KV cache for a session.
   */
  async clearCache(sessionId?: string): Promise<void> {
    if (sessionId) {
      await deleteCache({ kvCacheKey: sessionId })
    } else {
      await deleteCache({ all: true })
    }
  }

  /**
   * Graceful shutdown — unload model and clear all caches.
   */
  async destroy(): Promise<void> {
    await this.unload()
    await this.clearCache()
  }
}
