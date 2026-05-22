import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { NodeDaemon } from '../src/node.js'
import { NodeClient } from '../../node-client/src/client.js'
import { connectToNode } from '../../node-client/src/index.js'
import { createTestEnv } from './helpers.js'

describe('pairing', () => {
  let env, cleanupItems

  afterEach(async () => {
    for (const item of (cleanupItems || [])) {
      try {
        if (item.close) await item.close()
        if (item.destroy) await item.destroy()
      } catch {}
    }
    if (env) await env.cleanup()
  })

  it('pairs a single app with the node', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const pairedPromise = env.waitForEvent(node, 'paired')

    const client = await env.createConnectedClient({
      appId: 'notes-app',
      appName: 'Notes'
    })
    cleanupItems.push(client)

    const paired = await pairedPromise
    assert.equal(paired.appId, 'notes-app')
    assert.equal(paired.appName, 'Notes')

    assert.ok(client.paired)
    assert.ok(client.registered)
    assert.ok(client.nodePublicKey)
  })

  it('emits pairRequest before paired', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const events = []
    node.on('pairRequest', (d) => events.push({ type: 'pairRequest', ...d }))
    node.on('paired', (d) => events.push({ type: 'paired', ...d }))

    const client = await env.createConnectedClient({ appId: 'my-app', appName: 'My App' })
    cleanupItems.push(client)

    await new Promise(r => setTimeout(r, 500))

    assert.ok(events.length >= 2)
    assert.equal(events[0].type, 'pairRequest')
    assert.equal(events[0].appId, 'my-app')
    assert.equal(events[1].type, 'paired')
    assert.equal(events[1].appId, 'my-app')
  })

  it('pairs multiple apps', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client1 = await env.createConnectedClient({ appId: 'app-1', appName: 'App One' })
    cleanupItems.push(client1)

    const client2 = await env.createConnectedClient({ appId: 'app-2', appName: 'App Two' })
    cleanupItems.push(client2)

    const client3 = await env.createConnectedClient({ appId: 'app-3', appName: 'App Three' })
    cleanupItems.push(client3)

    const status = await node.getStatus()
    assert.equal(status.apps.length, 3)
    const ids = status.apps.map(a => a.appId).sort()
    assert.deepEqual(ids, ['app-1', 'app-2', 'app-3'])
  })

  it('unpairs an app and removes from registry', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({ appId: 'remove-me', appName: 'Remove Me' })
    cleanupItems.push(client)

    let status = await node.getStatus()
    assert.equal(status.apps.length, 1)

    await node.unpairApp('remove-me')

    status = await node.getStatus()
    assert.equal(status.apps.length, 0)
  })

  it('handles duplicate registration from same app', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client1 = await env.createConnectedClient({ appId: 'dup-app', appName: 'Dup v1' })
    cleanupItems.push(client1)

    const client2 = await env.createConnectedClient({ appId: 'dup-app', appName: 'Dup v2' })
    cleanupItems.push(client2)

    const status = await node.getStatus()
    const dupApps = status.apps.filter(a => a.appId === 'dup-app')
    assert.equal(dupApps.length, 1)
    assert.equal(dupApps[0].appName, 'Dup v2')
  })

  it('emits nodeHello with services before pairing', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client = new NodeClient({
      appId: 'hello-app',
      appName: 'Hello App',
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic
    })
    cleanupItems.push(client)

    const events = []
    client.on('nodeHello', (d) => events.push({ type: 'nodeHello', ...d }))
    client.on('paired', (d) => events.push({ type: 'paired', ...d }))

    await client.connect()
    // paired implies registered — wait for the latter
    await env.waitForEvent(client, 'registered')

    assert.ok(events.length >= 2)
    assert.equal(events[0].type, 'nodeHello')
    assert.equal(events[0].protocolVersion, 'v1')
    assert.deepEqual(events[0].services, { data: true, files: true, ai: false })
    assert.equal(events[1].type, 'paired')

    // Client state reflects the advertised services
    assert.deepEqual(client.services, { data: true, files: true, ai: false })
    assert.equal(client.protocolVersion, 'v1')
  })

  it('requireServices rejects when node lacks a required service', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    await assert.rejects(
      connectToNode({
        appId: 'needs-ai',
        appName: 'Needs AI',
        swarm: { bootstrap: env.bootstrap },
        topic: env.topic,
        timeout: 5_000,
        requireServices: ['ai']
      }),
      /does not offer required service\(s\): ai/
    )
  })

  it('requireServices accepts when node offers all required services', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const client = await connectToNode({
      appId: 'needs-data',
      appName: 'Needs Data',
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic,
      requireServices: ['data', 'files']
    })
    cleanupItems.push(client)

    assert.ok(client.registered)
    assert.equal(client.services.data, true)
    assert.equal(client.services.files, true)
  })

  it('requireServices throws for unknown service name', async () => {
    await assert.rejects(
      connectToNode({
        appId: 'bad',
        appName: 'Bad',
        requireServices: ['bogus']
      }),
      /Unknown service "bogus"/
    )
  })

  it('persists registry across restarts', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const dir = await env.tmpDir('node-restart-')

    const nodeA = new NodeDaemon(dir, {
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic
    })
    await nodeA.start()

    const client = await env.createConnectedClient({ appId: 'persist-app', appName: 'Persist' })
    cleanupItems.push(client)

    await client.close()
    cleanupItems = cleanupItems.filter(i => i !== client)
    await nodeA.close()

    const nodeB = new NodeDaemon(dir, {
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic
    })
    cleanupItems.push(nodeB)

    const restoredPromise = env.waitForEvent(nodeB, 'restored')
    await nodeB.start()
    const restored = await restoredPromise

    assert.equal(restored.appCount, 1)

    const status = await nodeB.getStatus()
    assert.equal(status.apps.length, 1)
    assert.equal(status.apps[0].appId, 'persist-app')
  })
})
