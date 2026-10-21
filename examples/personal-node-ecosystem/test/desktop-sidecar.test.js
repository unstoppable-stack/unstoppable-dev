import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { environment, notebookInvite } from './environment.js'
import { connectNode, protect } from '../src/runtime.js'

test('the actual desktop Bare daemon hosts data for a fresh app after restart', {
  skip: process.env.RUN_ELECTRON_SIDECAR_E2E !== '1' && 'Install node-desktop and set RUN_ELECTRON_SIDECAR_E2E=1',
}, async () => {
  // Optional because the basic example should not install Electron or QVAC.
  const { createSidecarHost } = await import('../../../packages/node-desktop/electron/sidecar-host.js')
  const env = await environment()
  const entry = fileURLToPath(new URL('../../../packages/node-desktop/scripts/fixtures/daemon-worker.js', import.meta.url))
  let sidecar
  async function boot() {
    const pending = new Map()
    function wait(type) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(type); reject(new Error(`Desktop worker timed out: ${type}`)) }, 15_000)
        pending.set(type, {
          resolve: value => { clearTimeout(timer); pending.delete(type); resolve(value) },
          reject: error => { clearTimeout(timer); pending.delete(type); reject(error) },
        })
      })
    }
    const ready = wait('ready')
    const host = createSidecarHost({
      entry, storagePath: join(env.directory, 'desktop-node'),
      args: [JSON.stringify(env.swarm.bootstrap)],
      onMessage(message) {
        if (message.type === 'fatal' || message.type === 'invite-error') {
          for (const waiter of pending.values()) waiter.reject(new Error(message.error))
        } else pending.get(message.type)?.resolve(message)
      },
      onError(error) { for (const waiter of pending.values()) waiter.reject(error) },
    })
    sidecar = host
    const info = await ready
    return {
      publicKey: info.publicKey,
      async invite() {
        const response = wait('invite-result')
        host.send({ type: 'create-invite', uses: 1, grants: { sync: ['manifest.replace', 'status', 'usage'] } })
        return (await response).invite.code
      },
      async close() {
        await host.close()
        assert.equal((await host.exit).code, 0)
      },
    }
  }
  try {
    let desktop = await boot()
    const notebook = await env.notebook()
    const linker = await env.briefing('linker')
    await notebook.put({ schemaVersion: 1, id: 'desktop', title: 'From the desktop node', body: 'A real Bare replica' })
    const linked = await linker.link({ invite: await notebookInvite(notebook) })
    const peer = await connectNode(notebook, { invite: await desktop.invite() })
    await protect(peer, notebook.manifest(), linked.descriptor.length)
    await env.close(linker)
    await env.close(notebook)
    const key = desktop.publicKey
    await desktop.close()
    desktop = await boot()
    assert.equal(desktop.publicKey, key)

    const reader = await env.briefing('fresh-reader')
    const readerPeer = await connectNode(reader, { invite: await desktop.invite() })
    const report = await reader.buildReport(linked.descriptor)
    assert.equal(report.items[0].title, 'From the desktop node')
    assert.deepEqual(reader.node.peers.map(peer => peer.remotePublicKey), [key])
    await protect(readerPeer, reader.manifest(), reader.local.core.length)
    await env.close(reader)
    await desktop.close()
  } finally {
    await sidecar?.close()
    await env.cleanup()
  }
})
