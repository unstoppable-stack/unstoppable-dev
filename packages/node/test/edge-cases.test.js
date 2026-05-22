import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { encodeMessage } from '../src/protocol.js'
import { createTestEnv } from './helpers.js'


describe('edge cases', () => {
  let env, cleanupItems

  afterEach(async () => {
    for (const item of (cleanupItems || [])) {
      try {
        if (item.close) await item.close()
        if (item.destroy) await item.destroy()
      } catch {}
    }
    if (env) await env.cleanup()
    await new Promise(r => setTimeout(r, 200))
  })

  it('client times out when no node is running', async () => {
    env = await createTestEnv()
    cleanupItems = []

    await assert.rejects(
      () => env.createConnectedClient({ appId: 'lonely-app', appName: 'Lonely', timeout: 3000 }),
      (err) => err.message.includes('Node not found')
    )
  })

  it('handles heartbeats', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const heartbeatPromise = env.waitForEvent(node, 'heartbeat')

    const client = await env.createConnectedClient({ appId: 'hb-app', appName: 'Heartbeat' })
    cleanupItems.push(client)

    client.sendHeartbeat()

    const hb = await heartbeatPromise
    assert.equal(hb.appId, 'hb-app')
    assert.ok(typeof hb.uptime === 'number')
  })

  it('client emits disconnected when node closes', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'dc-app', appName: 'Disconnect' })

    const disconnectedPromise = env.waitForEvent(client, 'disconnected')

    await node.close()

    await disconnectedPromise
    assert.equal(client.paired, false)

    await client.close()
  })

  it('node status reports correct state with no apps', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const status = await node.getStatus()
    assert.deepEqual(status.apps, [])
    assert.deepEqual(status.cores, [])
    assert.equal(status.connectedPeers, 0)
  })

  it('register without prior pairing returns error', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const rawSwarm = new Hyperswarm({ bootstrap: env.bootstrap })
    cleanupItems.push(rawSwarm)

    const sockets = []
    const errorReceived = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out')), 10000)
      rawSwarm.on('connection', (socket) => {
        sockets.push(socket)
        socket.on('error', () => {})
        socket.write(encodeMessage({
          type: 'register',
          appId: 'sneaky-app',
          cores: [{ key: 'deadbeef'.repeat(8), type: 'hypercore', name: 'data' }]
        }))

        let buffer = ''
        socket.on('data', (data) => {
          buffer += b4a.toString(data)
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const msg = JSON.parse(line)
              if (msg.type === 'error') {
                clearTimeout(timer)
                resolve(msg)
              }
            } catch {}
          }
        })
      })
    })

    rawSwarm.join(env.topic, { server: false, client: true })
    await rawSwarm.flush()

    const errorMsg = await errorReceived
    assert.ok(errorMsg.message.includes('not paired'))

    for (const s of sockets) s.destroy()
    await rawSwarm.destroy()
    cleanupItems = cleanupItems.filter(i => i !== rawSwarm)

    const status = await node.getStatus()
    assert.equal(status.apps.length, 0, 'unpaired app should not be registered')
  })

  it('unpair removes cores from replication', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithBee('unpair-app')
    cleanupItems.push(app.store, app.swarm)
    await app.bee.put('k', { v: 1 })

    const client = await env.createConnectedClient({
      appId: 'unpair-app',
      appName: 'Unpair Test',
      cores: [{ key: app.bee.core.key, type: 'hyperbee', name: 'data' }]
    })
    cleanupItems.push(client)

    await new Promise(r => setTimeout(r, 1000))

    let stats = node.replication.getStats()
    assert.equal(stats.length, 1, 'should be replicating 1 core')

    await node.unpairApp('unpair-app')

    stats = node.replication.getStats()
    assert.equal(stats.length, 0, 'should stop replicating after unpair')

    const status = await node.getStatus()
    assert.equal(status.apps.length, 0)
  })

  it('node shuts down cleanly', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    await node.start()

    const closedPromise = env.waitForEvent(node, 'closed')
    await node.close()
    await closedPromise
  })

  it('client shuts down cleanly', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({ appId: 'clean-app', appName: 'Clean' })

    const closedPromise = env.waitForEvent(client, 'closed')
    await client.close()
    await closedPromise
  })
})
