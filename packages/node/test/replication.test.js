import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import Hyperbee from 'hyperbee'
import { createTestEnv } from './helpers.js'

describe('replication', () => {
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

  it('registers cores for replication', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithBee('repl-app')
    cleanupItems.push(app.store, app.swarm)

    const registeredPromise = env.waitForEvent(node, 'appRegistered')

    const client = await env.createConnectedClient({
      appId: 'repl-app',
      appName: 'Replication Test',
      cores: [{
        key: app.bee.core.key,
        type: 'hyperbee',
        name: 'data'
      }]
    })
    cleanupItems.push(client)

    const registered = await registeredPromise
    assert.equal(registered.appId, 'repl-app')
    assert.equal(registered.coreCount, 1)

    const status = await node.getStatus()
    assert.equal(status.cores.length, 1)
    assert.equal(status.cores[0].name, 'data')
    assert.equal(status.cores[0].type, 'hyperbee')
  })

  it('replicates data from app to node', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithBee('data-app')
    cleanupItems.push(app.store, app.swarm)

    await app.bee.put('key-1', { value: 'hello' })
    await app.bee.put('key-2', { value: 'world' })
    await app.bee.put('key-3', { value: '!' })

    const client = await env.createConnectedClient({
      appId: 'data-app',
      appName: 'Data Test',
      cores: [{
        key: app.bee.core.key,
        type: 'hyperbee',
        name: 'entries'
      }]
    })
    cleanupItems.push(client)

    await new Promise(r => setTimeout(r, 3000))

    const stats = node.replication.getStats()
    const coreInfo = stats.find(s => s.appId === 'data-app')
    assert.ok(coreInfo, 'node should have the core')
    assert.ok(coreInfo.length > 0, `node core should have entries, got ${coreInfo.length}`)

    const nodeCore = node.store.get({ key: b4a.from(coreInfo.key, 'hex') })
    await nodeCore.ready()
    const nodeBee = new Hyperbee(nodeCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await nodeBee.ready()

    const entry1 = await nodeBee.get('key-1')
    assert.ok(entry1, 'node should have key-1')
    assert.deepEqual(entry1.value, { value: 'hello' })

    const entry2 = await nodeBee.get('key-2')
    assert.ok(entry2, 'node should have key-2')
    assert.deepEqual(entry2.value, { value: 'world' })

    const entry3 = await nodeBee.get('key-3')
    assert.ok(entry3, 'node should have key-3')
    assert.deepEqual(entry3.value, { value: '!' })

    await nodeBee.close()
  })

  it('replicates live writes after registration', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithBee('live-app')
    cleanupItems.push(app.store, app.swarm)

    const client = await env.createConnectedClient({
      appId: 'live-app',
      appName: 'Live Test',
      cores: [{
        key: app.bee.core.key,
        type: 'hyperbee',
        name: 'live-data'
      }]
    })
    cleanupItems.push(client)

    await new Promise(r => setTimeout(r, 2000))

    await app.bee.put('live-1', { ts: Date.now() })
    await app.bee.put('live-2', { ts: Date.now() })

    await new Promise(r => setTimeout(r, 2000))

    const stats = node.replication.getStats()
    const coreInfo = stats.find(s => s.appId === 'live-app')
    assert.ok(coreInfo)

    const nodeCore = node.store.get({ key: b4a.from(coreInfo.key, 'hex') })
    await nodeCore.ready()
    const nodeBee = new Hyperbee(nodeCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await nodeBee.ready()

    const entry = await nodeBee.get('live-2')
    assert.ok(entry, 'node should have live-written entry')

    await nodeBee.close()
  })

  it('registers and replicates a Hyperdrive', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app = await env.createAppWithDrive('drive-app')
    cleanupItems.push(app.store, app.swarm)

    await app.drive.put('/hello.txt', Buffer.from('hello world'))
    await app.drive.put('/notes/todo.md', Buffer.from('# todo\n- ship it'))

    const client = await env.createConnectedClient({
      appId: 'drive-app',
      appName: 'Drive Test',
      drives: [{ key: app.drive.key, name: 'files' }]
    })
    cleanupItems.push(client)

    await new Promise(r => setTimeout(r, 3000))

    const driveStats = node.replication.getDriveStats()
    assert.equal(driveStats.length, 1, 'node should track 1 drive')
    assert.equal(driveStats[0].name, 'files')
    assert.equal(driveStats[0].appId, 'drive-app')
    assert.equal(driveStats[0].type, 'hyperdrive')
    assert.equal(driveStats[0].peers, 1, 'should have 1 connected peer')
    assert.ok(driveStats[0].version >= 2, `drive version should have replicated, got ${driveStats[0].version}`)

    // Read through the tracked drive (avoids opening a second Hyperdrive
    // against the same corestore, which deadlocks on core sessions).
    const nodeDrive = node.replication.getDrive(driveStats[0].key)
    assert.ok(nodeDrive, 'replication engine should expose the drive')
    const buf = await nodeDrive.get('/hello.txt')
    assert.ok(buf, 'node should have /hello.txt')
    assert.equal(b4a.toString(buf), 'hello world')
  })

  it('persists drive registration across node restarts', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const dir = await env.tmpDir('node-drive-restart-')

    const { NodeDaemon } = await import('../src/node.js')
    const nodeA = new NodeDaemon(dir, {
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic
    })
    await nodeA.start()

    const app = await env.createAppWithDrive('persist-drive-app')
    cleanupItems.push(app.store, app.swarm)
    await app.drive.put('/data.txt', Buffer.from('persistent'))

    const client = await env.createConnectedClient({
      appId: 'persist-drive-app',
      appName: 'Persist Drive',
      drives: [{ key: app.drive.key, name: 'vault' }]
    })

    await new Promise(r => setTimeout(r, 1500))

    await client.close()
    await nodeA.close()

    const nodeB = new NodeDaemon(dir, {
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic
    })
    cleanupItems.push(nodeB)

    await nodeB.start()
    await new Promise(r => setTimeout(r, 500))

    const driveStats = nodeB.replication.getDriveStats()
    assert.equal(driveStats.length, 1, 'restart should restore 1 drive')
    assert.equal(driveStats[0].name, 'vault')
  })

  it('handles multiple apps with separate cores', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const app1 = await env.createAppWithBee('multi-1')
    cleanupItems.push(app1.store, app1.swarm)
    await app1.bee.put('app1-key', { from: 'app1' })

    const app2 = await env.createAppWithBee('multi-2')
    cleanupItems.push(app2.store, app2.swarm)
    await app2.bee.put('app2-key', { from: 'app2' })

    const client1 = await env.createConnectedClient({
      appId: 'multi-1',
      appName: 'Multi One',
      cores: [{ key: app1.bee.core.key, type: 'hyperbee', name: 'data' }]
    })
    cleanupItems.push(client1)

    const client2 = await env.createConnectedClient({
      appId: 'multi-2',
      appName: 'Multi Two',
      cores: [{ key: app2.bee.core.key, type: 'hyperbee', name: 'data' }]
    })
    cleanupItems.push(client2)

    await new Promise(r => setTimeout(r, 3000))

    const stats = node.replication.getStats()
    assert.equal(stats.length, 2, 'node should replicate 2 cores')

    const core1Info = stats.find(s => s.appId === 'multi-1')
    const core2Info = stats.find(s => s.appId === 'multi-2')
    assert.ok(core1Info)
    assert.ok(core2Info)
    assert.notEqual(core1Info.key, core2Info.key)
  })
})
