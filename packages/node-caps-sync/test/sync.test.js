import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import { createTestEnv, manifestFor } from './helpers.js'

describe('sync capability pack', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  // The spike's whole question: does replication survive sharing a connection
  // with the control channel? If Corestore built its own muxer instead of
  // finding node-core's, this is where it would corrupt the stream.
  it('replicates a registered hyperbee over the paired connection', async () => {
    env = await createTestEnv()

    const app = await env.makeApp()
    await app.bee.put('order-1', { coffee: 'flat white' })
    await app.bee.put('order-2', { coffee: 'cortado' })

    const host = await env.makeNode({ sync: true })
    await host.listen()

    const client = await env.makeNode({ profile: { appId: 'coffee' } })
    const peer = await client.connect(host.publicKey)

    const { resources } = await peer.call('sync', 'manifest.replace', {
      manifest: manifestFor({ bee: app.bee })
    })
    assert.equal(resources.length, 1)

    const status = await env.until(async () => {
      const s = await peer.call('sync', 'status')
      return s.cores[0]?.length >= 2 ? s : null
    })

    assert.equal(status.cores[0].length >= 2, true, 'blocks replicated to the node')
    assert.equal(status.cores[0].name, 'Data')

    // Control traffic still works on the same connection after replication.
    const usage = await peer.call('sync', 'usage')
    assert.equal(usage.scope, 'self')
    assert.equal(usage.bytes > 0, true)
  })

  it('replicates a hyperdrive', async () => {
    env = await createTestEnv()

    const app = await env.makeApp()
    await app.drive.put('/notes/hello.txt', b4a.from('hello from the app'))

    const host = await env.makeNode({ sync: true })
    await host.listen()
    const client = await env.makeNode({})
    const peer = await client.connect(host.publicKey)

    await peer.call('sync', 'manifest.replace', { manifest: manifestFor({ drive: app.drive }) })

    const status = await env.until(async () => {
      const s = await peer.call('sync', 'status')
      return s.drives[0]?.version >= 1 ? s : null
    })
    assert.equal(status.drives[0].name, 'Files')
  })

  it('keeps each peer scoped to its own resources', async () => {
    env = await createTestEnv()

    const appA = await env.makeApp('a')
    const appB = await env.makeApp('b')
    await appA.bee.put('a', { v: 1 })
    await appB.bee.put('b', { v: 1 })

    const host = await env.makeNode({ sync: true })
    await host.listen()

    const clientA = await env.makeNode({ profile: { appId: 'a' } })
    const clientB = await env.makeNode({ profile: { appId: 'b' } })
    const peerA = await clientA.connect(host.publicKey)
    const peerB = await clientB.connect(host.publicKey)

    await peerA.call('sync', 'manifest.replace', { manifest: manifestFor({ bee: appA.bee }) })
    await peerB.call('sync', 'manifest.replace', { manifest: manifestFor({ bee: appB.bee }) })

    const statusA = await peerA.call('sync', 'status')
    const statusB = await peerB.call('sync', 'status')

    assert.equal(statusA.cores.length, 1)
    assert.equal(statusB.cores.length, 1)
    assert.notEqual(statusA.cores[0].key, statusB.cores[0].key, 'peers see only their own resource')
  })

  it('treats the manifest as the complete set and drops what is absent', async () => {
    env = await createTestEnv()

    const app = await env.makeApp()
    const host = await env.makeNode({ sync: true })
    await host.listen()
    const client = await env.makeNode({})
    const peer = await client.connect(host.publicKey)

    await peer.call('sync', 'manifest.replace', {
      manifest: manifestFor({ bee: app.bee, drive: app.drive })
    })
    let status = await peer.call('sync', 'status')
    assert.equal(status.cores.length + status.drives.length, 2)

    await peer.call('sync', 'manifest.replace', { manifest: manifestFor({ bee: app.bee }) })
    status = await peer.call('sync', 'status')
    assert.equal(status.drives.length, 0, 'the omitted drive was dropped')
    assert.equal(status.cores.length, 1)
  })

  it('keeps seeding after the app disconnects, and restores across a restart', async () => {
    env = await createTestEnv()

    const app = await env.makeApp()
    await app.bee.put('order-1', { coffee: 'flat white' })

    const storage = await env.tmpDir('host-')
    const host = await env.makeNode({ sync: true, storage })
    await host.listen()

    const client = await env.makeNode({})
    const peer = await client.connect(host.publicKey)
    await peer.call('sync', 'manifest.replace', { manifest: manifestFor({ bee: app.bee }) })
    await env.until(async () => (await peer.call('sync', 'status')).cores[0]?.length >= 1)

    await client.close()
    await host.close()

    // Same storage -> same identity, and the manifest is restored from disk
    // without the app ever reconnecting.
    const restarted = await env.makeNode({ sync: true, storage })
    await restarted.listen()

    const pack = restarted.capabilities.get('sync')
    const stats = await env.until(async () => {
      const s = pack.engine.getStats()
      return s.length > 0 ? s : null
    })
    assert.equal(stats[0].length >= 1, true, 'replication resumed from persisted manifest')
  })

  it('rejects a malformed manifest', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ sync: true })
    await host.listen()
    const client = await env.makeNode({})
    const peer = await client.connect(host.publicKey)

    await assert.rejects(
      () => peer.call('sync', 'manifest.replace', { manifest: { schemaVersion: 9, resources: [] } }),
      { code: 'REQUEST_FAILED' }
    )
  })

  it('does not grant debug peeks by default', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ sync: true })
    await host.listen()
    const client = await env.makeNode({})
    const peer = await client.connect(host.publicKey)

    await assert.rejects(() => peer.call('sync', 'peek.core', { key: 'a'.repeat(64) }), { code: 'NOT_GRANTED' })
  })
})
