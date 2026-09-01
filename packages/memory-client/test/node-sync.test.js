import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connectMemoryToNode, toManifest } from '../src/node-sync.js'

function fakeSwarm () {
  return {
    handler: null,
    joinedTopic: null,
    destroyed: false,
    on (event, handler) { if (event === 'connection') this.handler = handler },
    join (topic) { this.joinedTopic = topic },
    async flush () {},
    async destroy () { this.destroyed = true }
  }
}

function fakeEngine (overrides = {}) {
  return {
    store: { replicate () {} },
    core: { discoveryKey: Buffer.from('b'.repeat(64), 'hex') },
    async getNodeRegistration () {
      return {
        appId: 'unstoppable-memory',
        appName: 'Unstoppable Memory',
        cores: [{ key: 'ab'.repeat(32), type: 'hyperbee', name: 'memory-store' }],
        drives: []
      }
    },
    ...overrides
  }
}

function fakeNode ({ calls = [], discover } = {}) {
  const peer = {
    publicKey: 'c'.repeat(64),
    async call (capability, method, params) {
      calls.push({ capability, method, params })
      return { ok: true }
    }
  }
  return {
    async ready () {},
    async discover (opts) {
      calls.push({ discover: opts })
      if (discover) return discover(opts)
      return peer
    },
    async close () {},
    peer
  }
}

describe('connectMemoryToNode', () => {
  it('discovers the local node and hands it a resource manifest', async () => {
    const calls = []
    const client = await connectMemoryToNode({
      engine: fakeEngine(),
      storage: './tmp-memory-node',
      createNode: () => fakeNode({ calls }),
      createSwarm: fakeSwarm
    })

    const discovery = calls.find((c) => c.discover)
    assert.ok(discovery, 'it discovers rather than requiring a key up front')
    assert.deepEqual(discovery.discover.requested, {
      sync: ['manifest.replace', 'status', 'usage']
    })

    const registered = calls.find((c) => c.method === 'manifest.replace')
    assert.equal(registered.params.manifest.schemaVersion, 1)
    assert.deepEqual(registered.params.manifest.resources[0], {
      id: 'memory-store',
      kind: 'hyperbee',
      key: 'ab'.repeat(32),
      name: 'memory-store',
      protection: { mode: 'mirror' }
    })
    assert.equal(client.nodePublicKey, 'c'.repeat(64))
  })

  it('returns null when no node is running and it is optional', async () => {
    const result = await connectMemoryToNode({
      engine: fakeEngine(),
      required: false,
      createNode: () => fakeNode({ discover: async () => { throw new Error('not found') } }),
      createSwarm: fakeSwarm
    })
    assert.equal(result, null)
  })

  it('rethrows when the node is required', async () => {
    await assert.rejects(() => connectMemoryToNode({
      engine: fakeEngine(),
      required: true,
      createNode: () => fakeNode({ discover: async () => { throw new Error('not found') } }),
      createSwarm: fakeSwarm
    }), /not found/)
  })

  it('seeds the memory corestore so the node has something to replicate', async () => {
    let replicated = false
    const swarm = fakeSwarm()
    const engine = fakeEngine({ store: { replicate () { replicated = true } } })

    const client = await connectMemoryToNode({
      engine,
      createNode: () => fakeNode({}),
      createSwarm: () => swarm
    })

    swarm.handler({})
    assert.ok(swarm.joinedTopic)
    assert.equal(replicated, true)

    await client.close()
    assert.equal(swarm.destroyed, true, 'the seeding swarm is torn down with the client')
  })

  it('tears down the seeding swarm when discovery fails', async () => {
    const swarm = fakeSwarm()
    await connectMemoryToNode({
      engine: fakeEngine(),
      createNode: () => fakeNode({ discover: async () => { throw new Error('nope') } }),
      createSwarm: () => swarm
    })
    assert.equal(swarm.destroyed, true, 'no swarm is left running after a failed connect')
  })

  it('maps drives into the manifest', () => {
    const manifest = toManifest({
      cores: [{ key: 'ab'.repeat(32), type: 'hypercore', name: 'log' }],
      drives: [{ key: 'cd'.repeat(32), name: 'files' }]
    })
    assert.deepEqual(manifest.resources.map((r) => r.kind), ['hypercore', 'hyperdrive'])
  })
})
