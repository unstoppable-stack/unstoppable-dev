import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, echoPack } from './helpers.js'

describe('pairing and the capability bus', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  // The Phase 1 acceptance criterion: two plain nodes, no Personal Node, no
  // storage stack, calling each other's capabilities.
  it('pairs two nodes and calls capabilities in both directions', async () => {
    env = await createTestEnv()

    const host = await env.makeNode({
      profile: { appId: 'notes', appName: 'Notes' },
      capabilities: [echoPack('notes')]
    })
    const joiner = await env.makeNode({
      profile: { appId: 'photos', appName: 'Photos' },
      capabilities: [echoPack('photos')]
    })

    await host.listen()
    const hostPaired = env.waitForEvent(host, 'paired')

    const peerFromJoiner = await joiner.connect(host.publicKey)
    await hostPaired

    // joiner -> host
    assert.deepEqual(await peerFromJoiner.call('notes', 'ping', { value: 'hi' }), { pong: 'hi' })

    // host -> joiner, over the same connection
    const peerFromHost = host.peer(joiner.publicKey)
    assert.ok(peerFromHost, 'host holds a peer for the joiner')
    assert.deepEqual(await peerFromHost.call('photos', 'ping', { value: 'back' }), { pong: 'back' })
  })

  it('exchanges identity and profile in the handshake', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({
      profile: { appId: 'notes', appName: 'Notes', deviceName: 'laptop' },
      capabilities: [echoPack('notes')]
    })
    const joiner = await env.makeNode({ profile: { appId: 'photos', appName: 'Photos' } })

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    assert.equal(peer.publicKey, host.publicKey)
    assert.equal(peer.appId, 'notes')
    assert.equal(peer.appName, 'Notes')
    assert.equal(peer.profile.deviceName, 'laptop')
    assert.deepEqual(Object.keys(peer.capabilities), ['notes'])
  })

  it('streams chunks from an async generator handler', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    const seen = []
    for await (const value of peer.stream('notes', 'count', { n: 4 })) seen.push(value)
    assert.deepEqual(seen, [0, 1, 2, 3])
  })

  it('stops a streaming handler when the consumer breaks early', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    const seen = []
    for await (const value of peer.stream('notes', 'forever')) {
      seen.push(value)
      if (seen.length === 3) break
    }
    assert.equal(seen.length, 3)

    // The far side observed the cancel and the connection is still usable.
    assert.deepEqual(await peer.call('notes', 'ping', { value: 'still here' }), { pong: 'still here' })
  })

  it('enforces grants per direction', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    // `boom` is deliberately outside the pack's defaultGrants.
    const peer = await joiner.connect(host.publicKey)

    assert.deepEqual(peer.grantsReceived, { notes: ['ping', 'count', 'forever', 'slow'] })
    await assert.rejects(() => peer.call('notes', 'boom'), { code: 'NOT_GRANTED' })
  })

  it('narrows grants to what the joiner asked for', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey, { requested: { notes: ['ping'] } })

    assert.deepEqual(peer.grantsReceived, { notes: ['ping'] })
    await assert.rejects(() => peer.call('notes', 'count'), { code: 'NOT_GRANTED' })
  })

  it('reports handler failures as typed errors without killing the session', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({
      capabilities: [{ ...echoPack('notes'), defaultGrants: ['ping', 'boom'] }]
    })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    await assert.rejects(() => peer.call('notes', 'boom'), {
      code: 'REQUEST_FAILED',
      message: 'handler exploded'
    })
    assert.deepEqual(await peer.call('notes', 'ping', { value: 'ok' }), { pong: 'ok' })
  })

  it('denies pairing when the approval callback says so', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({
      capabilities: [echoPack('notes')],
      pairing: { approve: async () => 'not today' }
    })
    const joiner = await env.makeNode({})

    await host.listen()
    await assert.rejects(() => joiner.connect(host.publicKey), {
      code: 'PAIR_DENIED',
      reason: 'not today'
    })
  })

  it('passes the requesting peer to the approval callback', async () => {
    env = await createTestEnv()
    let seen = null
    const host = await env.makeNode({
      capabilities: [echoPack('notes')],
      pairing: {
        approve: async (req) => { seen = req; return 'approve' }
      }
    })
    const joiner = await env.makeNode({ profile: { appId: 'photos', appName: 'Photos' } })

    await host.listen()
    await joiner.connect(host.publicKey)

    assert.equal(seen.publicKey, joiner.publicKey)
    assert.equal(seen.profile.appId, 'photos')
  })

  it('reconnects to a known peer by key across a restart', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('host-')

    const host = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await host.listen()
    const publicKey = host.publicKey

    const joiner = await env.makeNode({})
    const peer = await joiner.connect(publicKey)
    assert.deepEqual(await peer.call('notes', 'ping', { value: 1 }), { pong: 1 })

    await host.close()

    // Same storage dir -> same identity -> the stored key still dials.
    const restarted = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    assert.equal(restarted.publicKey, publicKey, 'identity survived the restart')
    await restarted.listen()

    const rejoiner = await env.makeNode({})
    const peer2 = await rejoiner.connect(publicKey)
    assert.deepEqual(await peer2.call('notes', 'ping', { value: 2 }), { pong: 2 })
  })

  it('records paired peers in the registry on both sides', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({
      profile: { appId: 'notes', appName: 'Notes' },
      capabilities: [echoPack('notes')]
    })
    const joiner = await env.makeNode({ profile: { appId: 'photos', appName: 'Photos' } })

    await host.listen()
    const hostPaired = env.waitForEvent(host, 'paired')
    await joiner.connect(host.publicKey)
    await hostPaired

    assert.equal(host.peerRegistry.get(joiner.publicKey).appId, 'photos')
    assert.equal(joiner.peerRegistry.get(host.publicKey).appId, 'notes')
  })

  // Regression guard for the transport premise: replication packs find the
  // muxer via `noiseStream.userData`. If that slot is empty, Corestore builds
  // a second Protomux over the same stream and both get corrupted.
  it('publishes its muxer where the storage stack looks for it', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    const stream = peer.mux.stream
    assert.ok(stream.userData, 'muxer is published on the noise stream')
    assert.equal(stream.userData.isProtomux, true)
    assert.equal(stream.userData, peer.mux, 'the published muxer is ours')
  })

  it('cleans up peers when the far side vanishes', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)
    assert.equal(joiner.peers.length, 1)

    const disconnected = env.waitForEvent(joiner, 'peerDisconnected')
    await host.close()
    await disconnected

    assert.equal(joiner.peers.length, 0, 'peer is dropped, not leaked')
    assert.equal(peer.closed, true)
  })

  it('rejects in-flight requests when the connection drops', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)

    // `slow` never resolves, so only the disconnect can settle this.
    const inFlight = assert.rejects(() => peer.call('notes', 'slow', {}, { timeout: 0 }), { code: 'CLOSED' })
    await new Promise((resolve) => setTimeout(resolve, 100))
    await host.close()
    await inFlight
  })

  it('times out dialing a key nobody is listening on', async () => {
    env = await createTestEnv()
    const joiner = await env.makeNode({})
    const absent = 'f'.repeat(64)

    await assert.rejects(() => joiner.connect(absent, { timeout: 1500 }), { code: 'PEER_NOT_FOUND' })
  })

  it('rejects a bad public key before dialing', async () => {
    env = await createTestEnv()
    const joiner = await env.makeNode({})
    await assert.rejects(() => joiner.connect('nope'), { code: 'INVALID_OPTION' })
  })
})

describe('peer management', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  it('revokes grants on a live session without a reconnect', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    const joiner = await env.makeNode({})

    await host.listen()
    const peer = await joiner.connect(host.publicKey)
    assert.deepEqual(await peer.call('notes', 'ping', { value: 1 }), { pong: 1 })

    await host.setPeerGrants(joiner.publicKey, { notes: ['count'] })
    await assert.rejects(() => peer.call('notes', 'ping'), { code: 'NOT_GRANTED' })
  })

  it('persists grant changes across a restart', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('host-')
    const host = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await host.listen()

    const joiner = await env.makeNode({})
    await joiner.connect(host.publicKey)
    await host.setPeerGrants(joiner.publicKey, { notes: ['count'] })
    await host.close()

    const restarted = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    assert.deepEqual(restarted.peerRegistry.get(joiner.publicKey).grantsGiven, { notes: ['count'] })
  })

  it('stores opaque per-peer policy for the composing app', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    await joiner.connect(host.publicKey)

    const record = await host.setPeerPolicy(joiner.publicKey, { quotaBytes: 1024 })
    assert.deepEqual(record.policy, { quotaBytes: 1024 })
  })

  it('unpairs a peer and closes its session', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    await joiner.connect(host.publicKey)

    assert.equal(await host.unpair(joiner.publicKey), true)
    assert.equal(host.peerRegistry.has(joiner.publicKey), false)
    assert.equal(await host.unpair(joiner.publicKey), false)
  })

  it('refuses to manage an unknown peer', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({})
    await assert.rejects(() => host.setPeerGrants('a'.repeat(64), {}), { code: 'INVALID_OPTION' })
  })
})

describe('topic discovery', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  // How an app finds the node on its own machine without being handed a key.
  it('finds a host serving a topic and pairs with it', async () => {
    env = await createTestEnv()
    const topic = Buffer.alloc(32, 7)

    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen({ topic })

    const app = await env.makeNode({})
    const peer = await app.discover({ topic })

    assert.equal(peer.publicKey, host.publicKey)
    assert.deepEqual(await peer.call('notes', 'ping', { value: 'found' }), { pong: 'found' })
  })

  it('passes requested capabilities through discovery', async () => {
    env = await createTestEnv()
    const topic = Buffer.alloc(32, 8)

    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen({ topic })

    const app = await env.makeNode({})
    const peer = await app.discover({ topic, requested: { notes: ['ping'] } })

    assert.deepEqual(peer.grantsReceived, { notes: ['ping'] })
    await assert.rejects(() => peer.call('notes', 'count'), { code: 'NOT_GRANTED' })
  })

  it('times out when nobody serves the topic', async () => {
    env = await createTestEnv()
    const app = await env.makeNode({})
    await assert.rejects(
      () => app.discover({ topic: Buffer.alloc(32, 9), timeout: 2000 }),
      { code: 'PEER_NOT_FOUND' }
    )
  })

  // After discovery the key is known, so reconnects skip the topic entirely.
  it('records the discovered peer so later connects go direct', async () => {
    env = await createTestEnv()
    const topic = Buffer.alloc(32, 10)

    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen({ topic })

    const app = await env.makeNode({})
    const peer = await app.discover({ topic })
    assert.equal(app.peerRegistry.get(host.publicKey).publicKey, peer.publicKey)
  })
})

describe('reconnect', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  // A node restarting is routine. An app that asked to stay connected should
  // recover without being restarted itself.
  it('re-establishes a connection after the host restarts', async () => {
    env = await createTestEnv()
    const storage = await env.tmpDir('host-')

    const host = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await host.listen()
    const publicKey = host.publicKey

    const app = await env.makeNode({ reconnect: { initialDelayMs: 100, maxDelayMs: 300 } })
    const peer = await app.connect(publicKey)
    assert.deepEqual(await peer.call('notes', 'ping', { value: 1 }), { pong: 1 })

    const reconnecting = env.waitForEvent(app, 'reconnecting')
    const reconnected = env.waitForEvent(app, 'reconnected', 30_000)

    await host.close()
    await reconnecting

    const restarted = await env.makeNode({ storage, capabilities: [echoPack('notes')] })
    await restarted.listen()

    await reconnected
    const fresh = app.peer(publicKey)
    assert.deepEqual(await fresh.call('notes', 'ping', { value: 2 }), { pong: 2 })
  })

  it('does not chase a peer when reconnect is off', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const app = await env.makeNode({})
    await app.connect(host.publicKey)

    const disconnected = env.waitForEvent(app, 'peerDisconnected')
    let reconnecting = false
    app.on('reconnecting', () => { reconnecting = true })

    await host.close()
    await disconnected
    await new Promise((resolve) => setTimeout(resolve, 500))
    assert.equal(reconnecting, false)
  })

  it('gives up after maxAttempts', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()

    const app = await env.makeNode({
      reconnect: { initialDelayMs: 50, maxDelayMs: 100, maxAttempts: 2, dialTimeoutMs: 500 }
    })
    await app.connect(host.publicKey)

    const failed = env.waitForEvent(app, 'reconnectFailed', 30_000)
    await host.close()
    const info = await failed
    assert.equal(info.publicKey, host.publicKey)
  })
})

describe('peer api proxy', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  it('exposes the peer\'s advertised capabilities as callable methods', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    const peer = await joiner.connect(host.publicKey)

    assert.deepEqual(await peer.api.notes.ping({ value: 'proxy' }), { pong: 'proxy' })
  })

  it('iterates a streaming method through the same handle', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    const peer = await joiner.connect(host.publicKey)

    const seen = []
    for await (const value of peer.api.notes.count({ n: 3 })) seen.push(value)
    assert.deepEqual(seen, [0, 1, 2])
  })

  // Only what the far side declared, so a typo fails locally rather than
  // becoming an UNKNOWN_METHOD round trip.
  it('only exposes methods the peer actually advertised', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    const peer = await joiner.connect(host.publicKey)

    assert.deepEqual(Object.keys(peer.api), ['notes'])
    assert.equal(typeof peer.api.notes.ping, 'function')
    assert.equal(peer.api.notes.invented, undefined)
    assert.equal(peer.api.photos, undefined)
  })

  it('still enforces grants', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    const peer = await joiner.connect(host.publicKey, { requested: { notes: ['ping'] } })

    await assert.rejects(() => peer.api.notes.count({ n: 1 }), { code: 'NOT_GRANTED' })
  })

  it('refuses to be consumed as both a promise and a stream', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.listen()
    const joiner = await env.makeNode({})
    const peer = await joiner.connect(host.publicKey)

    const handle = peer.api.notes.count({ n: 2 })
    const iterator = handle[Symbol.asyncIterator]()
    await iterator.next()
    await assert.rejects(() => handle.then(), { code: 'CLOSED' })
    await iterator.return?.()
  })
})
