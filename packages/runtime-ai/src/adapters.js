// Only this adapter knows QVAC API fields. Native imports remain lazy.
function qvacAdapter(loadEngine) {
  let engine = null
  return {
    mock: false,
    async load({ modelConstant, modelChecksum, ...options }) {
      engine = await loadEngine()
      const modelSrc = options.modelSrc || engine[modelConstant]
      if (!modelSrc) throw new Error(`Model constant is unavailable: ${modelConstant}`)
      if (!options.modelSrc && modelChecksum && modelSrc.sha256Checksum !== modelChecksum) {
        throw new Error('Model catalog identity differs from the recorded profile; review the model migration')
      }
      return engine.loadModel({ ...options, modelSrc })
    },
    stream(modelId, history) {
      return engine.completion({ modelId, history, stream: true }).tokenStream
    },
    async cancel(modelId) { await engine.cancel({ operation: 'inference', modelId }) },
    async unload(modelId) { await engine.unloadModel({ modelId }) },
  }
}

export function createNodeAdapter({ loadEngine = () => import('@qvac/sdk') } = {}) {
  return qvacAdapter(loadEngine)
}

let bareEngine = null
export function createBareAdapter() {
  return qvacAdapter(async () => {
    if (!bareEngine) {
      bareEngine = (async () => {
        const { default: process } = await import('bare-process')
        globalThis.process = process
        const [engine, { llmPlugin }, { registerPlugin }] = await Promise.all([
          import('@qvac/inference'),
          import('@qvac/inference/llamacpp-completion/plugin'),
          import('@qvac/inference/plugins'),
        ])
        registerPlugin(llmPlugin)
        return engine
      })().catch(err => { bareEngine = null; throw err })
    }
    return bareEngine
  })
}

export function createMockAdapter({ delay = 5 } = {}) {
  let cancelled = false
  return {
    mock: true,
    async load() { return 'mock-model' },
    async *stream(_modelId, history) {
      cancelled = false
      for (const token of `Mock: ${history.at(-1).content}`) {
        if (cancelled) return
        yield token
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      }
    },
    async cancel() { cancelled = true },
    async unload() {},
  }
}
