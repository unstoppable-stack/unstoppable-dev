import { AIProvider } from './provider.js'

export { AIProvider } from './provider.js'

// Delegated local inference as a capability pack.
//
// `completion.stream` is an async generator, so cancellation, backpressure and
// per-request multiplexing all come from the capability bus — the provider
// only has to yield tokens. The 0.5 daemon hand-rolled all three.
export function aiPack ({ mock = false, modelSrc, modelType, provider, enabled = true } = {}) {
  let node = null
  let ai = provider || null
  let startError = null
  let settings = { mock, modelSrc, modelType }

  async function startProvider () {
    if (ai?.isReady) return ai
    startError = null
    try {
      if (!ai) ai = new AIProvider(settings)
      ai.on('progress', (p) => node?.emit('aiProgress', p))
      ai.on('error', (e) => node?.emit('aiError', e))
      await ai.start()
      node?.emit('aiReady', { mock: !!settings.mock, modelId: ai.modelId })
      return ai
    } catch (err) {
      startError = err.message
      ai = null
      node?.emit('aiError', { phase: 'start', error: err.message })
      throw err
    }
  }

  return {
    name: 'ai',
    version: 1,

    methods: {
      'completion.stream': async function * (params, ctx) {
        if (!ai?.isReady) {
          throw new Error(startError || 'AI provider is not ready')
        }
        const messages = params?.messages
        if (!Array.isArray(messages) || messages.length === 0) {
          throw new Error('messages must be a non-empty array')
        }

        node?.emit('inference', { publicKey: ctx.peer.remotePublicKey, appId: ctx.appId })

        for await (const token of ai.runStreaming({ messages, stream: true, signal: ctx.signal })) {
          // The bus aborts this signal on cancel, disconnect, or the consumer
          // breaking out of its loop. Checking it here is what stops a model
          // from burning tokens for a peer that stopped listening.
          if (ctx.signal.aborted) return
          yield token
        }
      }
    },

    defaultGrants: ['completion.stream'],

    async onAttach (n) {
      node = n
      if (!enabled) return
      // The pack attaches even when the model fails to load: data and file
      // capabilities must stay usable on a node whose AI is broken. The
      // capability stays advertised, and calls report why they cannot run.
      try { await startProvider() } catch {}
    },

    // Runtime toggle. The capability descriptor is constant — peers see `ai`
    // whether or not a model is loaded — so a peer that calls while the model
    // is down gets a clear error instead of a capability that blinks in and
    // out of the handshake mid-session.
    async enable (opts = {}) {
      settings = { ...settings, ...opts }
      if (opts.provider) ai = opts.provider
      return startProvider()
    },

    async disable () {
      if (!ai) return false
      try { await ai.close() } catch {}
      ai = null
      startError = 'AI provider is disabled'
      node?.emit('aiDisabled', {})
      return true
    },

    async onDetach () {
      if (ai) { try { await ai.close() } catch {} }
    },

    get provider () { return ai },
    get ready () { return !!ai?.isReady },
    get modelId () { return ai?.modelId || null },
    get mock () { return !!settings.mock },
    get lastError () { return startError }
  }
}
