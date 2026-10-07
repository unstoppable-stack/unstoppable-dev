let buffer = ''

try {
  const { loadQvacRuntime } = await import('@unstoppable-stack/node-caps-ai/qvac-runtime')
  const sdk = await loadQvacRuntime()
  const packageJson = await import('@qvac/inference/package', { with: { type: 'json' } })
  Bare.IPC.write(JSON.stringify({
    type: 'qvac-imported',
    version: packageJson.default.version,
    loadModel: typeof sdk.loadModel,
    completion: typeof sdk.completion,
    hasDefaultModel: Boolean(sdk.QWEN3_5_0_8B_MULTIMODAL_Q4_K_M)
  }) + '\n')
} catch (error) {
  Bare.IPC.write(JSON.stringify({ type: 'qvac-import-error', error: error.message }) + '\n')
}

Bare.IPC.on('data', (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    if (JSON.parse(line).type === 'shutdown') Bare.exit()
  }
})
