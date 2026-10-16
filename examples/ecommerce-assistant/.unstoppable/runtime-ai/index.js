import { streamChat } from './history.js'
export { prepareChatHistory, streamChat } from './history.js'
export { createBareAdapter, createNodeAdapter, createMockAdapter } from './adapters.js'

export class AIError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined)
    this.name = 'AIError'
    this.code = code
  }
}

function normalized(code, error) {
  return error instanceof AIError ? error : new AIError(code, String(error?.message || error), error)
}

/** One loaded model, one active request. History belongs to the app. */
export function createAISession({ adapter, byteBudget = 2048 }) {
  let modelId = null
  let state = 'idle'
  let loading = null
  let active = null
  let closing = null
  let closed = false
  let lastError = null

  const session = {
    get state() { return state },
    get modelId() { return modelId },
    get mock() { return !!adapter.mock },
    get lastError() { return lastError },
    get capabilities() { return { streaming: true, cancellation: 'model', concurrency: 1 } },

    async load(options = {}) {
      if (closed || closing) throw new AIError('CLOSED', 'AI session is closed')
      if (modelId) return modelId
      if (loading) return loading
      state = 'loading'
      lastError = null
      loading = (async () => {
        try {
          modelId = await adapter.load(options)
          if (typeof modelId !== 'string' || !modelId) throw new Error('Adapter returned an invalid model ID')
          state = 'ready'
          return modelId
        } catch (err) {
          modelId = null
          state = 'error'
          lastError = normalized('LOAD_FAILED', err)
          throw lastError
        } finally { loading = null }
      })()
      return loading
    },

    async *stream(history, { requestId, signal, onTrim } = {}) {
      if (closed || closing) throw new AIError('CLOSED', 'AI session is closed')
      if (!modelId) throw new AIError('NOT_READY', 'Model not loaded. Load the assistant first.')
      if (active) throw new AIError('BUSY', 'Another response is already running.')
      if (lastError?.code === 'CANCEL_FAILED') throw lastError
      if (requestId === undefined || requestId === null) throw new AIError('INVALID_REQUEST', 'A request ID is required')
      if (signal?.aborted) throw new AIError('ABORTED', 'Response cancelled')
      let settle
      const operation = { requestId, cancelled: false, cancelPromise: null, done: new Promise(resolve => { settle = resolve }) }
      active = operation
      state = 'streaming'
      const abort = () => { void cancelOperation(operation).catch(() => {}) }
      signal?.addEventListener('abort', abort, { once: true })
      let finished = false
      const tokens = streamChat(adapter, modelId, history, byteBudget, onTrim)
      try {
        for (;;) {
          const next = await tokens.next()
          if (next.done) break
          if (operation.cancelled) break
          yield next.value
        }
        finished = !operation.cancelled
      } catch (err) {
        if (!operation.cancelled) {
          lastError = normalized('INFERENCE_FAILED', err)
          throw lastError
        }
      } finally {
        signal?.removeEventListener('abort', abort)
        try {
          // A consumer breaking iteration must cancel native work too.
          if (!finished) await cancelOperation(operation)
          await tokens.return()
        } finally {
          active = null
          state = lastError?.code === 'CANCEL_FAILED' ? 'error' : 'ready'
          settle()
        }
      }
    },

    async cancel(requestId) {
      const operation = active
      if (!operation || (requestId !== undefined && requestId !== operation.requestId)) return false
      await cancelOperation(operation)
      await operation.done
      return true
    },

    async close() {
      if (closed) return
      if (closing) return closing
      closing = (async () => {
        if (loading) { try { await loading } catch {} }
        await session.cancel()
        if (modelId) await adapter.unload(modelId)
        modelId = null
        closed = true
        state = 'closed'
      })()
      try { await closing } finally { closing = null }
    },
  }

  async function cancelOperation(operation) {
    operation.cancelled = true
    if (!operation.cancelPromise) {
      operation.cancelPromise = Promise.resolve().then(() => adapter.cancel(modelId)).catch(err => {
        lastError = normalized('CANCEL_FAILED', err)
        throw lastError
      })
    }
    return operation.cancelPromise
  }
  return session
}
