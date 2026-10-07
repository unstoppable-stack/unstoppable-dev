import assert from 'node:assert/strict'
import { join } from 'node:path'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSidecarHost } from '../electron/sidecar-host.js'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'test-fixtures')

it('loads the pinned QVAC inference engine inside the Bare sidecar runtime', { timeout: 20_000 }, async () => {
  let resolveMessage
  let rejectMessage
  const nextMessage = new Promise((resolve, reject) => {
    resolveMessage = resolve
    rejectMessage = reject
  })
  const host = createSidecarHost({
    entry: join(fixtures, 'qvac-import.js'),
    storagePath: '/unused-qvac-test-storage',
    onMessage: resolveMessage,
    onError: rejectMessage
  })

  try {
    const message = await nextMessage
    assert.deepEqual(message, {
      type: 'qvac-imported',
      version: '0.21.0',
      loadModel: 'function',
      completion: 'function',
      hasDefaultModel: true
    })
  } finally {
    await host.close()
  }
  assert.equal((await host.exit).code, 0)
})
