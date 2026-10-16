/**
 * AIProvider — delegated local AI inference served by the Unstoppable Node.
 *
 * Apps that can't (or don't want to) run QVAC locally — e.g. lightweight
 * mobile clients or multiple apps sharing one download — can ask a node to
 * run completions on their behalf. Streaming rides the capability bus like
 * any other async-generator method, so multiplexing and cancellation are the
 * bus's problem, not this module's.
 *
 * Opt-in: the `ai` capability is only advertised when the pack is installed
 * and the provider starts. Apps that need it should check for it in the
 * peer's advertised capabilities and fall back to their own inference.
 *
 * Two modes:
 *   - real  — loads a model via `@qvac/sdk` (dynamic import so the dep is
 *             not required in `npm install` for data-only nodes)
 *   - mock  — echoes input back as tokens, for tests and for demoing the
 *             wire protocol without a real model download
 */

import { EventEmitter } from 'bare-events'

export class AIProvider extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {boolean} [opts.mock]       Use mock provider (echo input)
   * @param {string}  [opts.modelSrc]   QVAC model URL/preset (real mode)
   * @param {string}  [opts.modelType]  'llm' | 'embedding' | etc. (real mode)
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
      this._qvac = await import('@qvac/sdk')
    } catch (err) {
      throw new Error(
        `AI provider enabled but @qvac/sdk is not installed: ${err.message}. ` +
        `Run \`npm install @qvac/sdk\` alongside this pack, or start in mock mode.`
      )
    }

    const {
      loadModel,
      LLAMA_3_2_1B_INST_Q4_0
    } = this._qvac

    const modelSrc = this.opts.modelSrc || LLAMA_3_2_1B_INST_Q4_0
    const modelType = this.opts.modelType || 'llm'

    this.modelId = await loadModel({
      modelSrc,
      modelType,
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
  async *runStreaming ({ messages, stream = true }) {
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

    const { completion } = this._qvac
    const result = completion({
      modelId: this.modelId,
      history: messages,
      stream
    })

    if (result.events) {
      for await (const event of result.events) {
        if (event.type === 'contentDelta' && event.text) yield event.text
      }
      return
    }

    for await (const token of result.tokenStream) {
      yield token
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
