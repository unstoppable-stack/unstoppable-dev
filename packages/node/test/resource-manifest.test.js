import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import Hyperbee from 'hyperbee'
import { createTestEnv } from './helpers.js'

describe('resource manifest protection', () => {
  let env
  const cleanupItems = []

  afterEach(async () => {
    for (const item of cleanupItems.splice(0)) {
      try {
        if (item.close) await item.close()
        if (item.destroy) await item.destroy()
      } catch {}
    }
    if (env) await env.cleanup()
    env = null
  })

  it('replaces a complete manifest and retains mirrored core + drive data', async () => {
    env = await createTestEnv()
    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithBee('photos-catalog')
    const media = await env.createAppWithDrive('photos-originals')
    cleanupItems.push(app.store, app.swarm, media.store, media.swarm)
    await app.bee.put('assets/1', { path: '/originals/1.jpg' })
    const original = b4a.from('original-photo-bytes-that-must-survive')
    await media.drive.put('/originals/1.jpg', original)

    const resourceManifest = {
      schemaVersion: 1,
      resources: [
        {
          id: 'catalog-writer-phone',
          kind: 'hyperbee',
          key: app.bee.core.key,
          name: 'Catalog writer',
          metadata: { role: 'catalog-writer' },
          protection: { mode: 'mirror' }
        },
        {
          id: 'photo-originals',
          kind: 'hyperdrive',
          key: media.drive.key,
          name: 'Photo originals',
          metadata: { role: 'originals' },
          protection: { mode: 'mirror' }
        }
      ]
    }
    const client = await env.createConnectedClient({ appId: 'photos', appName: 'Photos', resourceManifest })
    cleanupItems.push(client)
    assert.equal((await node.registry.getApp('photos')).resourceManifest.resources.length, 2)

    await waitFor(async () => {
      const status = await client.getProtectionStatus()
      return status.resources.length === 2 && status.resources.every((resource) => resource.protection?.state === 'protected')
    }, 12_000)

    await app.swarm.destroy()
    await app.store.close()
    await media.swarm.destroy()
    await media.store.close()
    cleanupItems.splice(cleanupItems.indexOf(app.swarm), 1)
    cleanupItems.splice(cleanupItems.indexOf(app.store), 1)
    cleanupItems.splice(cleanupItems.indexOf(media.swarm), 1)
    cleanupItems.splice(cleanupItems.indexOf(media.store), 1)

    const coreStats = node.replication.getStats()
    const nodeCore = node.replication.getCore(coreStats[0].key)
    const nodeBee = new Hyperbee(nodeCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await nodeBee.ready()
    assert.deepEqual((await nodeBee.get('assets/1')).value, { path: '/originals/1.jpg' })
    await nodeBee.close()

    const driveStats = node.replication.getDriveStats()
    const nodeDrive = node.replication.getDrive(driveStats[0].key)
    assert.deepEqual(await nodeDrive.get('/originals/1.jpg'), original)
  })

  it('reconciles removed resources without deleting retained storage', async () => {
    env = await createTestEnv()
    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()
    const first = await env.createAppWithBee('first')
    const second = await env.createAppWithBee('second')
    cleanupItems.push(first.store, first.swarm, second.store, second.swarm)
    const client = await env.createConnectedClient({ appId: 'photos' })
    cleanupItems.push(client)

    const descriptor = (id, bee) => ({ id, kind: 'hyperbee', key: bee.core.key, name: id, protection: { mode: 'metadata-only' } })
    await client.replaceResourceManifest({ schemaVersion: 1, resources: [descriptor('one', first.bee), descriptor('two', second.bee)] })
    assert.equal(node.replication.getStats().length, 2)

    await client.replaceResourceManifest({ schemaVersion: 1, resources: [descriptor('two', second.bee)] })
    assert.deepEqual(node.replication.getStats().map((resource) => resource.resourceId), ['two'])
    const app = (await node.getStatus()).apps.find((entry) => entry.appId === 'photos')
    assert.deepEqual(app.resourceManifest.resources.map((resource) => resource.id), ['two'])
  })

  it('rejects malformed or oversized untrusted metadata', async () => {
    env = await createTestEnv()
    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()
    const client = await env.createConnectedClient({ appId: 'photos' })
    cleanupItems.push(client)

    await assert.rejects(
      client.replaceResourceManifest({
        schemaVersion: 1,
        resources: [{ id: 'bad', kind: 'hyperdrive', key: 'not-a-key', name: 'Bad' }]
      }),
      (error) => error.code === 'INVALID_RESOURCE_MANIFEST'
    )
  })
})

async function waitFor (condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`)
}
