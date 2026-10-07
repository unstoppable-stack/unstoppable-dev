// The Node SDK owns a worker; the desktop daemon already runs inside Bare.
let loading

export async function loadQvacRuntime () {
  if (!loading) {
    loading = (async () => {
      if (typeof Bare === 'undefined') return import('@qvac/sdk')
      const { default: process } = await import('bare-process')
      globalThis.process = process
      const [sdk, { llmPlugin }, { registerPlugin }] = await Promise.all([
        import('@qvac/inference'),
        import('@qvac/inference/llamacpp-completion/plugin'),
        import('@qvac/inference/plugins')
      ])
      registerPlugin(llmPlugin)
      return sdk
    })().catch(error => { loading = null; throw error })
  }
  return loading
}
