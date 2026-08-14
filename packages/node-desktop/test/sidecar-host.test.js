import assert from 'node:assert/strict'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSidecarHost } from '../electron/sidecar-host.js'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

describe('Electron Bare sidecar host', () => {
  it('round-trips framed messages and shuts down cleanly', async () => {
    const messages = []
    let resolveMessage
    const nextMessage = new Promise((resolve) => { resolveMessage = resolve })
    const host = createSidecarHost({
      entry: join(fixtures, 'sidecar-echo.js'),
      storagePath: '/unused-test-storage',
      onMessage: (message) => {
        messages.push(message)
        resolveMessage(message)
      }
    })

    host.send({ type: 'refresh-status', requestId: 'one' })
    assert.deepEqual(await nextMessage, { type: 'refresh-status', requestId: 'one' })
    assert.equal(messages.length, 1)

    await host.close()
    const exit = await host.exit
    assert.equal(exit.code, 0)
  })
})
