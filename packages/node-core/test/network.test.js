import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import { createTestEnv, echoPack } from './helpers.js'
import { networkTopic } from '../src/protocol.js'

describe('app networks', () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
  })

  it('derives a stable topic from the network name', () => {
    const a = networkTopic('notes-mesh')
    assert.equal(a.length, 32)
    assert.equal(b4a.toString(a, 'hex'), b4a.toString(networkTopic('notes-mesh'), 'hex'))
    assert.notEqual(b4a.toString(a, 'hex'), b4a.toString(networkTopic('other-mesh'), 'hex'))
    assert.throws(() => networkTopic(''), /non-empty string/)
  })

  // The case invites cannot serve: N instances of one app finding each other
  // without N² pairing codes.
  it('pairs several instances of the same app with each other', async () => {
    env = await createTestEnv()

    const nodes = []
    for (const name of ['laptop', 'phone', 'tablet']) {
      const node = await env.makeNode({
        profile: { appId: 'notes', appName: 'Notes', deviceName: name },
        capabilities: [echoPack('notes')]
      })
      await node.joinNetwork('notes-mesh')
      nodes.push(node)
    }

    // Every node should end up holding the other two.
    for (const node of nodes) {
      await env.until(() => node.peers.length >= 2)
      assert.equal(node.peers.length, 2, `${node.profile.deviceName} sees both siblings`)
    }

    const [laptop] = nodes
    for (const peer of laptop.peers) {
      assert.deepEqual(await peer.call('notes', 'ping', { value: 'mesh' }), { pong: 'mesh' })
    }
  })

  it('records how the peer was found', async () => {
    env = await createTestEnv()
    const a = await env.makeNode({ capabilities: [echoPack('notes')] })
    const b = await env.makeNode({ capabilities: [echoPack('notes')] })
    await a.joinNetwork('notes-mesh')
    await b.joinNetwork('notes-mesh')

    await env.until(() => a.peers.length >= 1 && b.peers.length >= 1)

    const record = a.peerRegistry.get(b.publicKey) || b.peerRegistry.get(a.publicKey)
    assert.equal(record.pairingMethod, 'network')
    assert.equal(record.network, 'notes-mesh')
  })

  // A network topic is derived from a guessable name, so the grants it hands
  // out are the security boundary — not membership.
  it('caps grants at the network ceiling', async () => {
    env = await createTestEnv()
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.joinNetwork('notes-mesh', { grants: { notes: ['ping'] } })

    const joiner = await env.makeNode({ capabilities: [echoPack('notes')] })
    await joiner.joinNetwork('notes-mesh')

    await env.until(() => joiner.peers.length >= 1)
    const peer = joiner.peer(host.publicKey)
    assert.ok(peer, 'joiner paired with the host')

    assert.deepEqual(peer.grantsReceived, { notes: ['ping'] })
    await assert.rejects(() => peer.call('notes', 'count'), { code: 'NOT_GRANTED' })
  })

  it('ignores nodes on a different network', async () => {
    env = await createTestEnv()
    const a = await env.makeNode({ capabilities: [echoPack('notes')] })
    const b = await env.makeNode({ capabilities: [echoPack('notes')] })
    await a.joinNetwork('mesh-one')
    await b.joinNetwork('mesh-two')

    await new Promise((resolve) => setTimeout(resolve, 3000))
    assert.equal(a.peers.length, 0)
    assert.equal(b.peers.length, 0)
  })

  it('consults a per-network approval callback', async () => {
    env = await createTestEnv()
    let asked = null
    const host = await env.makeNode({ capabilities: [echoPack('notes')] })
    await host.joinNetwork('notes-mesh', {
      approve: async (req) => { asked = req; return 'deny' }
    })

    const joiner = await env.makeNode({ capabilities: [echoPack('notes')] })
    await joiner.joinNetwork('notes-mesh')

    await env.until(() => asked !== null, { timeout: 20_000 })
    assert.equal(asked.network, 'notes-mesh')
    assert.equal(joiner.peer(host.publicKey)?.paired ?? false, false)
  })

  it('leaves a network on request', async () => {
    env = await createTestEnv()
    const node = await env.makeNode({})
    await node.joinNetwork('notes-mesh')
    assert.deepEqual(node.networks, ['notes-mesh'])

    assert.equal(await node.leaveNetwork('notes-mesh'), true)
    assert.deepEqual(node.networks, [])
    assert.equal(await node.leaveNetwork('notes-mesh'), false)
  })
})
