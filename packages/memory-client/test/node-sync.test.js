import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connectMemoryToNode } from '../src/node-sync.js'

describe('connectMemoryToNode', () => {
  it('registers memory engine cores with the local Node client', async () => {
    const calls = []
    const engine = {
      store: { replicate () {} },
      core: { discoveryKey: Buffer.from('b'.repeat(64), 'hex') },
      async getNodeRegistration () {
        return {
          appId: 'unstoppable-memory',
          appName: 'Unstoppable Memory',
          cores: [{ key: 'abc123', type: 'hyperbee', name: 'memory-store' }],
          drives: []
        }
      }
    }

    const client = await connectMemoryToNode({
      engine,
      connectToNode: async (opts) => {
        calls.push(opts)
        return { services: { data: true }, close: async () => {} }
      },
      createSwarm: () => ({
        on () {},
        join () {},
        async flush () {},
        async destroy () {}
      })
    })

    assert.equal(client.services.data, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].appId, 'unstoppable-memory')
    assert.deepEqual(calls[0].cores, [{ key: 'abc123', type: 'hyperbee', name: 'memory-store' }])
    assert.deepEqual(calls[0].requireServices, ['data'])
    assert.equal(calls[0].reconnect, true)
  })

  it('returns unavailable status when Node is absent and optional', async () => {
    const result = await connectMemoryToNode({
      engine: {
        async getNodeRegistration () {
          return { appId: 'memory', appName: 'Memory', cores: [], drives: [] }
        }
      },
      required: false,
      connectToNode: async () => {
        throw new Error('not found')
      }
    })

    assert.equal(result, null)
  })

  it('starts a replication server for the memory corestore', async () => {
    let replicated = false
    let joinedTopic = null
    const fakeSwarm = {
      on (event, handler) {
        if (event === 'connection') this.handler = handler
      },
      join (topic) {
        joinedTopic = topic
      },
      async flush () {},
      async destroy () {}
    }
    const engine = {
      store: {
        replicate () {
          replicated = true
        }
      },
      core: {
        discoveryKey: Buffer.from('a'.repeat(64), 'hex')
      },
      async getNodeRegistration () {
        return {
          appId: 'memory',
          appName: 'Memory',
          cores: [{ key: 'abc123', type: 'hyperbee', name: 'memory-store' }],
          drives: []
        }
      }
    }

    const client = await connectMemoryToNode({
      engine,
      createSwarm: () => fakeSwarm,
      connectToNode: async () => ({ close: async () => {} })
    })

    fakeSwarm.handler({})
    assert.ok(joinedTopic)
    assert.equal(replicated, true)
    await client.close()
  })
})
