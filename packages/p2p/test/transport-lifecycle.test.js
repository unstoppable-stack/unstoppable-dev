import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNode } from '../src/node.js'
import { createTestEnv } from './helpers.js'

async function environment (operation) {
  const env = await createTestEnv()
  try { await operation(env) } finally { await env.cleanup() }
}

test('closed node cannot start and malformed HELLO is safe without a diagnostic listener', async () => {
  const storage = await mkdtemp(join(tmpdir(), 'p2p-lifecycle-'))
  try {
    const node = createNode({ storage })
    let closed = false
    node._onHello({ remotePublicKey: 'aa'.repeat(32), close () { closed = true } }, { publicKey: 'bb'.repeat(32) })
    assert.equal(closed, true)
    await node.close()
    await assert.rejects(() => node.ready(), { code: 'CLOSED' })
    assert.equal(node.swarm, null)
  } finally { await rm(storage, { recursive: true, force: true }) }
})

test('only one live runtime owns storage and orderly close permits reopening', () => environment(async env => {
  const first = await env.makeNode()
  const second = createNode({ storage: first.storage, swarm: { bootstrap: env.bootstrap } })
  await assert.rejects(() => second.ready(), { code: 'STORAGE_LOCKED' })
  await second.close()
  await first.close()
  const replacement = await env.makeNode({ storage: first.storage })
  assert.equal(replacement.publicKey, first.publicKey)
}))

test('close during startup waits for rollback and returns one shared completion', () => environment(async env => {
  const storage = await env.tmpDir()
  let enter
  let release
  let detached = false
  const entered = new Promise(resolve => { enter = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  const node = createNode({ storage, swarm: { bootstrap: env.bootstrap }, capabilities: [{
    name: 'startup', methods: {},
    async onAttach () { enter(); await blocked },
    async onDetach () { detached = true }
  }] })
  const starting = node.ready()
  const rejected = assert.rejects(starting, { code: 'CLOSED' })
  await entered
  const closing = node.close()
  assert.equal(node.close(), closing)
  release()
  await rejected
  await closing
  assert.equal(detached, true)
  await env.makeNode({ storage })
}))

test('failed capability attach rolls back previously attached resources and runtime ownership', () => environment(async env => {
  const storage = await env.tmpDir()
  const detached = []
  const node = createNode({ storage, swarm: { bootstrap: env.bootstrap }, capabilities: [
    { name: 'first', methods: {}, onDetach () { detached.push('first') } },
    { name: 'failed', methods: {}, onAttach () { throw new Error('attach failure') }, onDetach () { detached.push('failed') } }
  ] })
  await assert.rejects(() => node.ready(), /attach failure/)
  assert.deepEqual(detached, ['failed', 'first'])
  await node.close()
  await env.makeNode({ storage })
}))

test('overlapping discovery is rejected; abort removes its topic; unrelated pairing does not resolve it', () => environment(async env => {
  const app = await env.makeNode()
  const host = await env.makeNode()
  await host.listen()
  const topic = Buffer.alloc(32, 24)
  const controller = new AbortController()
  let resolved = false
  const discovering = app.discover({ topic, signal: controller.signal, timeout: 0 })
  discovering.then(() => { resolved = true }, () => {})
  const aborted = assert.rejects(discovering, { code: 'CANCELLED' })
  await env.until(() => app._discovering)
  await assert.rejects(() => app.discover({ topic }), /already active/)
  await assert.rejects(() => app.pair('invalid'), /already active/)
  await app.connect(host.publicKey)
  assert.equal(resolved, false)
  assert.ok(app._discovering)
  controller.abort()
  await aborted
  await env.until(() => !app.swarm.status(topic))
}))

test('pending approval is bounded by the handshake deadline and cannot approve after closing', () => environment(async env => {
  let release
  const decision = new Promise(resolve => { release = resolve })
  const host = await env.makeNode({ handshakeTimeoutMs: 150, pairing: { approve: () => decision } })
  const joiner = await env.makeNode()
  await host.listen()
  const requested = env.waitForEvent(host, 'pairRequest')
  const connecting = assert.rejects(() => joiner.connect(host.publicKey, { timeout: 600 }))
  await requested
  await env.until(() => host._peers.size === 0)
  release('approve')
  await connecting
  assert.equal(host.peerRegistry.list().length, 0)
}))

test('transport cleanup failure still detaches resources, releases ownership and rejects shared close', () => environment(async env => {
  let detached = false
  const node = await env.makeNode({ capabilities: [{ name: 'cleanup', methods: {}, onDetach () { detached = true } }] })
  const destroy = node.swarm.destroy.bind(node.swarm)
  const failure = new Error('transport teardown failed')
  node.swarm.destroy = async () => { await destroy(); throw failure }
  const closing = node.close()
  assert.equal(node.close(), closing)
  await assert.rejects(closing, error => error === failure)
  assert.equal(detached, true)
  await env.makeNode({ storage: node.storage })
}))

test('startup preserves its original failure when rollback transport and detach both reject', () => environment(async env => {
  const storage = await env.tmpDir()
  const original = new Error('original attach failure')
  let detached = false
  const node = createNode({ storage, swarm: { bootstrap: env.bootstrap }, capabilities: [{
    name: 'failed', methods: {},
    onAttach (runtime) {
      const destroy = runtime.swarm.destroy.bind(runtime.swarm)
      runtime.swarm.destroy = async () => { await destroy(); throw new Error('rollback transport failed') }
      throw original
    },
    onDetach () { detached = true; throw new Error('detach failed') }
  }] })
  await assert.rejects(() => node.ready(), error => error === original)
  assert.equal(detached, true)
  await assert.rejects(() => node.close(), /rollback transport failed/)
  await env.makeNode({ storage })
}))

test('delayed invite watcher reload cannot announce peers after shutdown', () => environment(async env => {
  const node = await env.makeNode()
  let entered
  let release
  const waiting = new Promise(resolve => { entered = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  node.invites.reload = async () => { entered(); await blocked }
  node.invites.list = () => [{ id: 'late', secret: '11'.repeat(16) }]
  const watching = node._serveOutstandingInvites({ reload: true })
  await waiting
  await node.close()
  release()
  await watching
  assert.equal(node._servedInvites.size, 0)
}))

test('createInvite rejects if shutdown completes while its reload is pending', () => environment(async env => {
  const node = await env.makeNode()
  let entered
  let release
  const waiting = new Promise(resolve => { entered = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  node.invites.reload = async () => { entered(); await blocked }
  const creating = node.createInvite()
  const rejected = assert.rejects(creating, { code: 'CLOSED' })
  await waiting
  await node.close()
  release()
  await rejected
  assert.equal(node._servedInvites.size, 0)
}))

test('reconnect configuration rejects invalid timers and budgets before opening resources', () => {
  for (const reconnect of [[], 'yes', 1, { enabled: 'yes' }, { enabled: null }, { initialDelayMs: 0 }, { initialDelayMs: 1.5 },
    { maxDelayMs: 1 }, { dialTimeoutMs: Infinity }, { factor: NaN }, { factor: 0.5 }, { maxAttempts: -1 }, { maxAttempts: 1.5 }]) {
    assert.throws(() => createNode({ storage: '/unused', reconnect }), { code: 'INVALID_OPTION' })
  }
  for (const reconnect of [true, false, null, { enabled: false }, { initialDelayMs: 5, maxDelayMs: 5, factor: 1, maxAttempts: 0, dialTimeoutMs: 1 }]) {
    const node = createNode({ storage: '/unused', reconnect })
    assert.equal(node.swarm, null)
  }
})

for (const boundary of ['listen', 'flush', 'invites']) {
  test(`listen cannot complete or restart its watcher after shutdown during ${boundary}`, async () => {
    const node = createNode({ storage: '/unused' })
    node.ready = async () => {}
    node.identity = { publicKey: '11'.repeat(32) }
    let enter
    let release
    const entered = new Promise(resolve => { enter = resolve })
    const blocked = new Promise(resolve => { release = resolve })
    const block = async () => { enter(); await blocked }
    let joined = 0
    node.swarm = {
      listen: boundary === 'listen' ? block : async () => {},
      flush: boundary === 'flush' ? block : async () => {},
      join () { joined++ },
      destroy: async () => {}
    }
    if (boundary === 'invites') node._serveOutstandingInvites = block
    let emitted = false
    node.on('listening', () => { emitted = true })
    const listening = node.listen({ topic: Buffer.alloc(32, 15) })
    const rejected = assert.rejects(listening, { code: 'CLOSED' })
    await entered
    await node.close()
    release()
    await rejected
    assert.equal(node.listening, false)
    assert.equal(emitted, false)
    assert.equal(node._inviteWatcher, null)
    if (boundary === 'listen') assert.equal(joined, 0)
  })
}

for (const boundary of ['listen', 'flush']) {
  test(`joinNetwork rejects after shutdown during ${boundary}`, async () => {
    const node = createNode({ storage: '/unused' })
    node.ready = async () => {}
    let enter
    let release
    const entered = new Promise(resolve => { enter = resolve })
    const blocked = new Promise(resolve => { release = resolve })
    const block = async () => { enter(); await blocked }
    let joined = 0
    node.swarm = {
      listen: boundary === 'listen' ? block : async () => {},
      flush: boundary === 'flush' ? block : async () => {},
      join () { joined++ },
      destroy: async () => {}
    }
    let emitted = false
    node.on('networkJoined', () => { emitted = true })
    const joining = node.joinNetwork('test-network')
    const rejected = assert.rejects(joining, { code: 'CLOSED' })
    await entered
    await node.close()
    release()
    await rejected
    assert.equal(emitted, false)
    if (boundary === 'listen') {
      assert.equal(joined, 0)
      assert.deepEqual(node.networks, [])
    }
  })
}

test('failed discovery setup releases exclusivity for another discovery or pairing', async () => {
  const node = createNode({ storage: '/unused' })
  node.ready = async () => {}
  const failure = new Error('discovery setup failed')
  let fail = true
  node.swarm = {
    join () {
      if (fail) throw failure
      return { refresh: async () => {}, destroy: async () => {} }
    },
    destroy: async () => {}
  }
  await assert.rejects(node.discover({ topic: Buffer.alloc(32), timeout: 0 }), error => error === failure)
  assert.equal(node._discovering, null)
  // Reaching invite decoding proves pairing is no longer rejected by the
  // exclusivity guard left behind by the failed discovery.
  await assert.rejects(node.pair(''), /non-empty/)
  fail = false
  const controller = new AbortController()
  const discovering = node.discover({ topic: Buffer.alloc(32), timeout: 0, signal: controller.signal })
  const rejected = assert.rejects(discovering, { code: 'CANCELLED' })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await rejected
  assert.equal(node._discovering, null)
  await node.close()
})

test('pairing hook cannot emit paired after shutdown', async () => {
  const node = createNode({ storage: '/unused' })
  node.peerRegistry.put = async () => {}
  let enter
  let release
  const entered = new Promise(resolve => { enter = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  node.capabilities.onPeer = async () => { enter(); await blocked }
  const peer = {
    paired: false,
    closed: false,
    remotePublicKey: '11'.repeat(32),
    pairing: { resolve () {} }
  }
  let emitted = false
  node.on('peer', () => { emitted = true })
  node.on('paired', () => { emitted = true })
  const pairing = node._finishPairing(peer)
  await entered
  await node.close()
  release()
  await pairing
  assert.equal(emitted, false)
  assert.equal(node._sticky.size, 0)
})
