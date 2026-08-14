import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSidecarHost } from '../electron/sidecar-host.js'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

const runSidecarE2E = process.env.RUN_ELECTRON_SIDECAR_E2E === '1'

it('boots and stops the real NodeDaemon inside a Bare sidecar', {
  timeout: 20_000,
  skip: runSidecarE2E ? false : 'set RUN_ELECTRON_SIDECAR_E2E=1 (opens a local P2P listener)'
}, async () => {
  const storagePath = await mkdtemp(join(tmpdir(), 'personal-node-sidecar-'))
  let host

  try {
    const ready = new Promise((resolve, reject) => {
      host = createSidecarHost({
        entry: join(packageRoot, 'electron', 'worker.js'),
        storagePath,
        onMessage: (message) => {
          if (message.type === 'ready') resolve(message)
          if (message.type === 'fatal') reject(new Error(message.error))
        },
        onError: reject
      })
    })

    const message = await ready
    assert.match(message.publicKey, /^[0-9a-f]{64}$/)
    assert.equal(message.services.data, true)
    await host.close()
    const exit = await host.exit
    assert.equal(exit.code, 0)
    assert.equal(exit.signal, null)
  } finally {
    await host?.close()
    await rm(storagePath, { recursive: true, force: true })
  }
})
