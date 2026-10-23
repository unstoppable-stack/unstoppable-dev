import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, echoPack } from './helpers.js'

test('initial discovery timeout still reconnects when the peer later becomes reachable', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode({ capabilities: [echoPack()] })
    const client = await env.makeNode({ reconnect: {
      initialDelayMs: 20, maxDelayMs: 100, dialTimeoutMs: 500
    } })
    // The key exists, but has never been advertised. No Peer or disconnect
    // event exists to start recovery after this first unsuccessful dial.
    await assert.rejects(client.connect(host.publicKey, { timeout: 50 }), { code: 'PEER_NOT_FOUND' })
    await host.listen()
    const peer = await env.until(() => client.peers[0], { timeout: 5000, interval: 20 })
    assert.deepEqual(await peer.call('echo', 'ping', { value: 'after discovery failure' }), { pong: 'after discovery failure' })
  } finally { await env.cleanup() }
})

test('exhausting retries removes the underlying explicit peer dial', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode()
    const client = await env.makeNode({ reconnect: {
      initialDelayMs: 20, maxDelayMs: 20, dialTimeoutMs: 50, maxAttempts: 1
    } })
    const failed = env.waitForEvent(client, 'reconnectFailed', 2000)
    await assert.rejects(client.connect(host.publicKey, { timeout: 50 }), { code: 'PEER_NOT_FOUND' })
    assert.equal((await failed).attempts, 1)
    assert.equal(client.swarm.explicitPeers.size, 0)
    assert.equal(client._sticky.size, 0)
  } finally { await env.cleanup() }
})

test('cancelling a retry stops recovery and does not authorize a later peer', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode()
    const client = await env.makeNode({ reconnect: {
      initialDelayMs: 1000, maxDelayMs: 1000, dialTimeoutMs: 500
    } })
    await assert.rejects(client.connect(host.publicKey, { timeout: 50 }), { code: 'PEER_NOT_FOUND' })
    const controller = new AbortController()
    const retry = client.connect(host.publicKey, { signal: controller.signal })
    const rejected = assert.rejects(retry, { code: 'CANCELLED' })
    await env.until(() => client._dialing.size, { interval: 5 })
    controller.abort()
    await rejected
    assert.equal(client._sticky.size, 0)
    assert.equal(client.swarm.explicitPeers.size, 0)
    await host.listen()
    await new Promise(resolve => setTimeout(resolve, 1100))
    assert.equal(client.peers.length, 0)
    assert.equal(host.peerRegistry.has(client.publicKey), false)
  } finally { await env.cleanup() }
})

test('foreground connect does not inherit an existing reconnect attempt deadline', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode({ capabilities: [echoPack()] })
    const client = await env.makeNode({ swarm: { bootstrap: env.bootstrap, backoffs: [20, 20, 20, 20], jitter: 0 } })
    const short = assert.rejects(client.connect(host.publicKey, { timeout: 80 }), { code: 'PEER_NOT_FOUND' })
    const foreground = client.connect(host.publicKey, { timeout: 3000 })
    // Attach immediately so a premature rejection is reported by the assertion.
    const connected = foreground.then(peer => peer.call('echo', 'ping', { value: 'foreground' }))
    connected.catch(() => {})
    await short
    await host.listen()
    assert.deepEqual(await connected, { pong: 'foreground' })
  } finally { await env.cleanup() }
})

test('a coalesced caller can cancel without cancelling another caller', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode({ capabilities: [echoPack()] })
    const client = await env.makeNode({ swarm: { bootstrap: env.bootstrap, backoffs: [20, 20, 20, 20], jitter: 0 } })
    const remaining = client.connect(host.publicKey, { timeout: 3000 })
    remaining.catch(() => {})
    const controller = new AbortController()
    const cancelled = assert.rejects(client.connect(host.publicKey, { timeout: 3000, signal: controller.signal }), { code: 'CANCELLED' })
    await env.until(() => client._dialing.size, { interval: 5 })
    controller.abort()
    await cancelled
    await host.listen()
    assert.deepEqual(await (await remaining).call('echo', 'ping', { value: 'remaining' }), { pong: 'remaining' })
  } finally { await env.cleanup() }
})

test('a transport lost during greeting retries while the caller is still waiting', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode({ capabilities: [echoPack()] })
    await host.listen()
    host.once('hello', ({ publicKey }) => { void host.peer(publicKey).close() })
    const client = await env.makeNode({
      reconnect: { initialDelayMs: 50, maxDelayMs: 50 },
      swarm: { bootstrap: env.bootstrap, backoffs: [10000, 10000, 10000, 10000], jitter: 0 }
    })
    const peer = await client.connect(host.publicKey, { timeout: 3000 })
    assert.deepEqual(await peer.call('echo', 'ping', { value: 'greeting retry' }), { pong: 'greeting retry' })
  } finally { await env.cleanup() }
})

test('pairing denial stops automatic retry without creating a local revocation', async () => {
  const env = await createTestEnv()
  try {
    const host = await env.makeNode({ pairing: { approve: () => 'deny' } })
    await host.listen()
    const client = await env.makeNode({ reconnect: { initialDelayMs: 20, maxDelayMs: 20 } })
    await assert.rejects(client.connect(host.publicKey), { code: 'PAIR_DENIED' })
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(client._sticky.size, 0)
    assert.equal(client.swarm.explicitPeers.size, 0)
    assert.equal(client.peerRegistry.isDenied(host.publicKey), false)
  } finally { await env.cleanup() }
})
