/**
 * AIProvider — delegated local AI inference served by the Unstoppable Node.
 *
 * Apps that can't (or don't want to) run QVAC locally — e.g. lightweight
 * mobile clients or multiple apps sharing one download — can ask a node to
 * run completions on their behalf. Streaming rides the capability bus like
 * any other async-generator method; the bus and provider jointly enforce
 * cancellation.
 *
 * Opt-in: the `ai` capability is advertised when the pack is installed;
 * calls report provider readiness separately. Apps that need it should check for it in the
 * peer's advertised capabilities and fall back to their own inference.
 *
 * Two modes:
 *   - real  — loads a model via `@qvac/sdk` (dynamic import so the dep is
 *             not required in `npm install` for data-only nodes)
 *   - mock  — echoes input back as tokens, for tests and for demoing the
 *             wire protocol without a real model download
 */

import { EventEmitter } from 'bare-events'
import { loadQvacRuntime } from './qvac-runtime.js'

export class AIProvider extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {boolean} [opts.mock]       Use mock provider (echo input)
   * @param {string}  [opts.modelSrc]   QVAC model URL/preset (real mode)
   * @param {string}  [opts.modelType]  'llm' (completion provider)
   */
  constructor (opts = {}) {
    super()
    this.opts = opts
    this.mock = opts.mock === true
    this.modelId = null
    this._qvac = null
    this._ready = false
  }

  async start () {
    if (this.mock) {
      this.modelId = 'mock-model'
      this._ready = true
      this.emit('ready', { modelId: this.modelId, mock: true })
      return
    }

    // Real mode — @qvac/sdk is an optional dep. Dynamic import so data-only
    // nodes don't need the binary bits.
    try {
      this._qvac = await loadQvacRuntime()
    } catch (err) {
      throw new Error(
        `AI provider QVAC runtime is unavailable: ${err.message}. ` +
        `Node hosts: install @qvac/sdk@0.21.0; Bare hosts: install inference 0.21.0 and the LLM addon alongside this pack, or start in mock mode.`
      )
    }

    const {
      loadModel,
      QWEN3_5_0_8B_MULTIMODAL_Q4_K_M
    } = this._qvac

    const modelSrc = this.opts.modelSrc || QWEN3_5_0_8B_MULTIMODAL_Q4_K_M
    const modelType = this.opts.modelType || 'llm'

    this.modelId = await loadModel({
      modelSrc,
      modelType,
      modelConfig: { ctx_size: 4096, reasoning_budget: 0, ...this.opts.modelConfig },
      onProgress: (p) => this.emit('progress', p)
    })
    this._ready = true
    this.emit('ready', { modelId: this.modelId })
  }

  get isReady () {
    return this._ready
  }

  /**
   * Run a completion against the loaded model. Returns an async iterable of
   * tokens when `stream` is true, or the full text otherwise.
   *
   * @param {Object} req
   * @param {Array<{role: string, content: string}>} req.messages
   * @param {boolean} [req.stream=true]
   * @returns {AsyncIterable<string>}
   */
  async *runStreaming ({ messages, stream = true, signal }) {
    if (!this._ready) throw new Error('AI provider not ready')
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array')
    }

    if (this.mock) {
      const last = messages[messages.length - 1]
      const reply = `Mock: ${last?.content ?? '(empty)'}`
      for (const ch of reply) {
        yield ch
        // Tiny yield so callers can see the stream frames
        await new Promise((r) => setTimeout(r, 2))
      }
      return
    }

    if (signal?.aborted) return
    if (this._active) throw new Error('AI provider is busy; retry when the current request finishes')
    this._active = true
    let run
    let finished = false
    let cancelling
    const cancel = () => {
      if (!run || finished) return Promise.resolve()
      if (!cancelling) {
        cancelling = this._qvac.cancel(run.requestId
          ? { requestId: run.requestId }
          : { operation: 'inference', modelId: this.modelId }).catch(error => {
          this.emit('error', { phase: 'cancel', error: error.message })
        })
      }
      return cancelling
    }
    try {
      run = this._qvac.completion({ modelId: this.modelId, history: messages, stream })
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) await cancel()
      if (run.events) {
        for await (const event of run.events) {
          if (signal?.aborted) break
          if (event.type === 'completionDone' && event.stopReason === 'error') {
            finished = true
            throw new Error(event.error?.message || 'Native inference failed')
          }
          if (event.type === 'contentDelta' && event.text) yield event.text
        }
      } else {
        for await (const token of run.tokenStream) {
          if (signal?.aborted) break
          yield token
        }
      }
      finished = !signal?.aborted
    } finally {
      signal?.removeEventListener('abort', cancel)
      try { if (!finished) await cancel() } finally { this._active = false }
    }
  }

  async close () {
    if (!this._ready) return
    this._ready = false
    if (this.mock) return
    try {
      const { unloadModel } = this._qvac || {}
      if (unloadModel && this.modelId && this.modelId !== 'mock-model') {
        await unloadModel({ modelId: this.modelId })
      }
    } catch (err) {
      this.emit('error', { phase: 'close', error: err.message })
    }
    this.modelId = null
  }
}
