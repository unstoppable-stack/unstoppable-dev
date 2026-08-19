import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, manifestFor } from './helpers.js'

describe('personal node', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  it('starts, listens, and reports a stable identity', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('node-')

    const node = await env.makeNode({ storage, topic: null })
    await node.start()
    const publicKey = node.publicKey
    assert.equal(publicKey.length, 64)
    await node.close()

    const restarted = await env.makeNode({ storage, topic: null })
    await restarted.start()
    assert.equal(restarted.publicKey, publicKey)
  })

  it('replicates a paired app and reports it in status', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    const app = await env.makeApp()
    await app.bee.put('order-1', { coffee: 'flat white' })

    const client = await env.makeClient({ profile: { appId: 'coffee', appName: 'Coffee' } })
    const peer = await client.connect(node.publicKey)
    await peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) })

    const status = await env.until(async () => {
      const s = await node.getStatus()
      return s.cores[0]?.length >= 1 ? s : null
    })

    assert.equal(status.pairedPeers, 1)
    assert.equal(status.peers[0].appId, 'coffee')
    assert.equal(status.peers[0].online, true)
    assert.equal(status.connectedPeers, 1)
    assert.equal(status.nodePublicKey, node.publicKey)
  })

  it('pauses a peer that exceeds its quota', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    const app = await env.makeApp()
    for (let i = 0; i < 20; i++) await app.bee.put(`k${i}`, { padding: 'x'.repeat(200) })

    const client = await env.makeClient({})
    const peer = await client.connect(node.publicKey)
    await peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) })

    await env.until(async () => (await node.getStatus()).cores[0]?.length >= 1)

    // A one-byte budget: whatever replicated already blows it.
    await node.setPeerQuota(client.publicKey, 1)
    const status = await node.getStatus()
    const state = status.storage.quotas.perPeer[client.publicKey]

    assert.equal(state.exceeded, true)
    assert.equal(state.reason, 'per-peer')
    assert.equal(status.cores.every((core) => core.paused), true, 'replication was paused')
  })

  it('changes a peer grant live and persists it', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('node-')
    const node = await env.makeNode({ storage, topic: null })
    await node.start()

    const client = await env.makeClient({})
    const peer = await client.connect(node.publicKey)
    await peer.call('sync', 'status')

    await node.setPeerGrant(client.publicKey, 'sync', ['usage'])
    await assert.rejects(() => peer.call('sync', 'status'), { code: 'NOT_GRANTED' })
    await peer.call('sync', 'usage')

    const status = await node.getStatus()
    assert.deepEqual(status.peers[0].grantsGiven.sync, ['usage'])
  })

  it('unpairs a peer and forgets its resources', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    const app = await env.makeApp()
    await app.bee.put('k', { v: 1 })
    const client = await env.makeClient({})
    const peer = await client.connect(node.publicKey)
    await peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) })
    await env.until(async () => (await node.getStatus()).cores.length > 0)

    assert.equal(await node.unpairPeer(client.publicKey), true)

    const status = await node.getStatus()
    assert.equal(status.pairedPeers, 0)
    assert.equal(status.cores.length, 0, 'the peer\'s resources stopped replicating')
  })

  it('pauses and resumes a peer on request', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    const app = await env.makeApp()
    await app.bee.put('k', { v: 1 })
    const client = await env.makeClient({})
    const peer = await client.connect(node.publicKey)
    await peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) })
    await env.until(async () => (await node.getStatus()).cores.length > 0)

    assert.equal(await node.pausePeer(client.publicKey) > 0, true)
    assert.equal((await node.getStatus()).cores.every((c) => c.paused), true)

    assert.equal(await node.resumePeer(client.publicKey) > 0, true)
    assert.equal((await node.getStatus()).cores.every((c) => c.paused), false)
  })

  it('toggles AI through config and reports it in status', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    assert.equal((await node.getStatus()).ai.ready, false)

    await node.updateConfig({ ai: { enabled: true, mode: 'mock' } })
    assert.equal((await node.getStatus()).ai.ready, true)

    await node.updateConfig({ ai: { enabled: false } })
    assert.equal((await node.getStatus()).ai.ready, false)
  })

  it('brings AI back up from config on restart', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('node-')

    const node = await env.makeNode({ storage, topic: null })
    await node.start()
    await node.updateConfig({ ai: { enabled: true, mode: 'mock' } })
    await node.close()

    const restarted = await env.makeNode({ storage, topic: null })
    await restarted.start()
    assert.equal((await restarted.getStatus()).ai.ready, true)
  })

  it('serves delegated inference to a paired peer', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null, ai: { mock: true } })
    await node.start()

    const client = await env.makeClient({})
    const peer = await client.connect(node.publicKey)

    let out = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'hello' }]
    })) out += token
    assert.equal(out, 'Mock: hello')
  })

  it('reports disk usage for the operator', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({ topic: null })
    await node.start()

    const usage = await node.getDiskUsage()
    assert.equal(usage.path, node.storagePath)
    assert.equal(usage.bytes > 0, true)
  })

  it('honours a pairing approval callback', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({
      topic: null,
      approvePairing: async () => 'not today'
    })
    await node.start()

    const client = await env.makeClient({})
    await assert.rejects(() => client.connect(node.publicKey), { code: 'PAIR_DENIED' })
  })
})
