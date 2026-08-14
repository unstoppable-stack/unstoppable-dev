let buffer = ''

try {
  const sdk = await import('@qvac/sdk')
  const packageJson = await import('@qvac/sdk/package', { with: { type: 'json' } })
  Bare.IPC.write(JSON.stringify({
    type: 'qvac-imported',
    version: packageJson.default.version,
    loadModel: typeof sdk.loadModel,
    completion: typeof sdk.completion,
    hasDefaultModel: Boolean(sdk.LLAMA_3_2_1B_INST_Q4_0)
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
