import { test } from 'node:test'
import assert from 'node:assert/strict'
import Hyperswarm from 'hyperswarm'
import Protomux from 'protomux'
import { createTestEnv } from './helpers.js'
import { CONTROL_PROTOCOL, MESSAGE, networkTopic } from '../../src/protocol.js'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function environment (operation) {
  const env = await createTestEnv()
  try { await operation(env) } finally { await env.cleanup() }
}

test('resource discovery cannot grant callback authority, even while an unrelated network is joined', () => environment(async env => {
  let calls = 0
  let approvals = 0
  const owner = await env.makeNode({ sync: true, handshakeTimeoutMs: 2000,
    pairing: { approve: () => { approvals++; return 'deny' } },
    capabilities: [{ name: 'private', methods: { read: async () => { calls++; return 'secret' } }, defaultGrants: [] }]
  })
  await owner.joinNetwork('unrelated-network')
  const seeder = await env.makeNode({ pairing: { autoApprove: true, request: { private: ['read'] } } })
  const app = await env.makeApp()
  const resource = app.store.get({ name: 'discovery-authority' })
  await resource.ready()
  await seeder.listen({ topic: resource.discoveryKey })
  await owner.capabilities.get('sync').engine.addCore({ key: resource.key, type: 'hypercore', owner: 'fixture' })
  await env.until(() => seeder.peer(owner.publicKey)?.publicKey)
  const peer = seeder.peer(owner.publicKey)
  let response
  const onmessage = peer.onmessage.bind(peer)
  peer.onmessage = msg => { if (msg.requestId === 'probe') response = msg; return onmessage(msg) }
  // A malicious seeder attempts to accept a pairing that was never authorized,
  // then immediately calls a non-default private method.
  peer.send({ type: MESSAGE.PAIR_ACCEPTED, grants: {}, requested: { private: ['read'] } })
  peer.send({ type: MESSAGE.CALL, requestId: 'probe', capability: 'private', method: 'read', params: {} })
  await env.until(() => response)
  assert.equal(response.code, 'NOT_GRANTED')
  assert.equal(calls, 0)
  assert.equal(approvals, 0)
  assert.equal(owner.peer(seeder.publicKey).paired, false)
  assert.equal(owner.peerRegistry.has(seeder.publicKey), false)

  // Explicitly choosing this already-connected peer still supports pairing.
  const chosen = await owner.connect(seeder.publicKey)
  assert.equal(chosen.paired, true)
  await env.until(() => peer.paired)
  assert.equal(await peer.call('private', 'read'), 'secret')
}))

test('delayed Hypercore replication survives the control deadline and transfers later appends', () => environment(async env => {
  const app = await env.makeApp()
  await app.bee.put('before', 'first')
  // A seeder can initialize its storage protocol after transport connection.
  // Do not let an immediate protocol rejection hide the handshake timer bug.
  app.swarm.removeAllListeners('connection')
  app.swarm.on('connection', socket => {
    socket.on('error', () => {})
    setTimeout(() => { if (!socket.destroyed) app.store.replicate(socket) }, 350)
  })
  const owner = await env.makeNode({ sync: true, handshakeTimeoutMs: 100 })
  const engine = owner.capabilities.get('sync').engine
  await engine.addCore({ key: app.bee.core.key, type: 'hyperbee', owner: 'fixture' })
  const replica = engine.replicating.get(app.bee.core.key.toString('hex')).core
  await replica.get(0, { timeout: 5000 })
  const socket = [...app.swarm.connections][0]
  assert.ok(socket)
  await delay(350)
  assert.equal(socket.destroyed, false)
  await app.bee.put('after', 'second')
  const last = app.bee.core.length - 1
  assert.deepEqual(await replica.get(last, { timeout: 5000 }), await app.bee.core.get(last))
  assert.equal([...app.swarm.connections][0], socket)
  assert.equal(owner.peers.length, 0)
}))

test('opening a control channel without HELLO still expires its handshake', () => environment(async env => {
  const owner = await env.makeNode({ handshakeTimeoutMs: 100 })
  await owner.listen()
  const swarm = new Hyperswarm({ bootstrap: env.bootstrap })
  try {
    const connected = new Promise(resolve => swarm.once('connection', socket => {
      socket.on('error', () => {})
      Protomux.from(socket).createChannel({ protocol: CONTROL_PROTOCOL }).open()
      resolve(socket)
    }))
    swarm.joinPeer(Buffer.from(owner.publicKey, 'hex'))
    const socket = await connected
    await env.until(() => socket.destroyed, { timeout: 3000, interval: 10 })
    await env.until(() => owner._peers.size === 0)
  } finally { await swarm.destroy() }
}))

for (const decision of ['approve', 'deny']) {
  test(`outgoing app-network pairing applies its own ${decision} policy and grant ceiling`, () => environment(async env => {
    let approvals = 0
    const owner = await env.makeNode({ capabilities: [{ name: 'private', methods: {
      read: async () => 'allowed', write: async () => 'forbidden'
    }, defaultGrants: [] }] })
    const seeder = await env.makeNode({ pairing: { autoApprove: true, request: { private: ['read', 'write'] } } })
    // A server-only rendezvous makes the policy owner's connection outgoing.
    await seeder.listen({ topic: networkTopic('outgoing-policy') })
    await owner.joinNetwork('outgoing-policy', {
      grants: { private: ['read'] }, approve: () => { approvals++; return decision }
    })
    await env.until(() => approvals > 0)
    if (decision === 'deny') {
      await env.until(() => owner._peers.size === 0)
      assert.equal(owner.peerRegistry.has(seeder.publicKey), false)
    } else {
      await env.until(() => seeder.peers.length > 0)
      const peer = seeder.peer(owner.publicKey)
      assert.equal(await peer.call('private', 'read'), 'allowed')
      await assert.rejects(peer.call('private', 'write'), { code: 'NOT_GRANTED' })
    }
  }))
}

test('replication-only transports retain their admission slot until disconnect', () => environment(async env => {
  const owner = await env.makeNode({ sync: true, limits: { maxPeers: 1 }, handshakeTimeoutMs: 100 })
  await owner.listen()
  const app = await env.makeApp()
  app.swarm.joinPeer(Buffer.from(owner.publicKey, 'hex'))
  await env.until(() => owner._connections.size === 1)
  // Plain replication rejects the unsupported control channel. Its transport
  // must still count, even after that channel has disappeared from _peers.
  await env.until(() => owner._peers.size === 0)
  const swarm = new Hyperswarm({ bootstrap: env.bootstrap })
  try {
    const connected = new Promise(resolve => swarm.once('connection', socket => {
      socket.on('error', () => {})
      resolve(socket)
    }))
    swarm.joinPeer(Buffer.from(owner.publicKey, 'hex'))
    const rejected = await connected
    await env.until(() => rejected.destroyed, { timeout: 3000, interval: 10 })
    assert.equal(owner._connections.size, 1)
    await app.swarm.destroy()
    await env.until(() => owner._connections.size === 0)
    const next = await env.makeNode()
    assert.equal((await next.connect(owner.publicKey)).paired, true)
  } finally { await swarm.destroy() }
}))
