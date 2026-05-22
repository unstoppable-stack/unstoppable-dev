import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createE2EEnv } from './harness.js'

describe('e2e', { concurrency: 1 }, () => {
  let env

  afterEach(async () => {
    if (env) await env.cleanup()
    env = null
    await new Promise(r => setTimeout(r, 500))
  })

  it('node starts, app pairs and registers', async () => {
    env = await createE2EEnv()

    const node = await env.spawnNode()
    await node.waitForOutput('Node is running')

    const app = await env.spawnApp({ appId: 'notes', appName: 'Notes App' })
    const readyEv = await app.waitForEvent('ready')
    assert.ok(readyEv.coreKey, 'app should have a core key')

    const connEv = await app.waitForEvent('connected')
    assert.ok(connEv.paired, 'app should be paired')
    assert.ok(connEv.registered, 'app should be registered')
    assert.ok(connEv.nodePublicKey, 'should receive node public key')

    assert.ok(node.stdout.includes('Pair request from'), 'node should log pair request')
    assert.ok(node.stdout.includes('Paired with'), 'node should log pairing')
    assert.ok(node.stdout.includes('Registered notes'), 'node should log registration')
    assert.ok(node.stdout.includes('1 core(s)'), 'node should log core count')

    await app.close()
    await node.kill()
  })

  it('app writes data and node replicates it', async () => {
    env = await createE2EEnv()

    const node = await env.spawnNode()
    await node.waitForOutput('Node is running')

    const app = await env.spawnApp({ appId: 'data-app', appName: 'Data App' })
    await app.waitForEvent('connected')

    await app.put('note-1', { title: 'Hello', body: 'First note' })
    await app.put('note-2', { title: 'World', body: 'Second note' })
    await app.put('note-3', { title: 'Test', body: 'Third note' })

    const allEntries = await app.getAll()
    assert.equal(allEntries.entries.length, 3, 'app should have 3 entries locally')

    await new Promise(r => setTimeout(r, 3000))

    assert.ok(node.stdout.includes('Registered data-app'), 'node registered the app')

    await app.close()
    await node.kill()
  })

  it('two apps connect and register independently', async () => {
    env = await createE2EEnv()

    const node = await env.spawnNode()
    await node.waitForOutput('Node is running')

    const app1 = await env.spawnApp({ appId: 'todo-app', appName: 'Todo App' })
    const app1Ready = await app1.waitForEvent('ready')
    await app1.waitForEvent('connected')

    const app2 = await env.spawnApp({ appId: 'journal-app', appName: 'Journal App' })
    const app2Ready = await app2.waitForEvent('ready')
    await app2.waitForEvent('connected')

    assert.notEqual(app1Ready.coreKey, app2Ready.coreKey, 'apps should have different core keys')

    await app1.put('task-1', { text: 'Buy milk', done: false })
    await app1.put('task-2', { text: 'Walk dog', done: true })

    await app2.put('entry-2024-01', { mood: 'great', text: 'Good day' })
    await app2.put('entry-2024-02', { mood: 'ok', text: 'Normal day' })

    const todoEntries = await app1.getAll()
    assert.equal(todoEntries.entries.length, 2, 'todo app should have 2 entries')

    const journalEntries = await app2.getAll()
    assert.equal(journalEntries.entries.length, 2, 'journal app should have 2 entries')

    assert.ok(node.stdout.includes('Paired with Todo App'), 'node paired todo app')
    assert.ok(node.stdout.includes('Paired with Journal App'), 'node paired journal app')
    assert.ok(node.stdout.includes('Registered todo-app'), 'node registered todo app')
    assert.ok(node.stdout.includes('Registered journal-app'), 'node registered journal app')

    await app1.close()
    await app2.close()
    await node.kill()
  })

  it('node persists registry across restarts', async () => {
    env = await createE2EEnv()
    const nodeDir = await env.tmpDir('e2e-node-persist-')

    const node1 = await env.spawnNode({ storagePath: nodeDir })
    await node1.waitForOutput('Node is running')

    const app1 = await env.spawnApp({ appId: 'persist-app', appName: 'Persist Test' })
    await app1.waitForEvent('connected')

    await app1.put('key-1', { value: 'stored' })
    await new Promise(r => setTimeout(r, 2000))

    await app1.close()
    await node1.kill()

    const node2 = await env.spawnNode({ storagePath: nodeDir })
    await node2.waitForOutput('Node is running')

    assert.ok(node2.stdout.includes('Restored 1 app(s)'), 'node should restore 1 app on restart')

    await node2.kill()
  })

  it('app detects node disconnection', async () => {
    env = await createE2EEnv()

    const node = await env.spawnNode()
    await node.waitForOutput('Node is running')

    const app = await env.spawnApp({ appId: 'dc-app', appName: 'Disconnect App' })
    await app.waitForEvent('connected')

    await node.kill()

    const dcEv = await app.waitForEvent('disconnected', 10000)
    assert.ok(dcEv, 'app should emit disconnected event')

    await app.close()
  })

  it('app reconnects after node restart', async () => {
    env = await createE2EEnv()
    const nodeDir = await env.tmpDir('e2e-node-reconnect-')

    const node1 = await env.spawnNode({ storagePath: nodeDir })
    await node1.waitForOutput('Node is running')

    const app = await env.spawnApp({ appId: 'reconnect-app', appName: 'Reconnect App' })
    await app.waitForEvent('connected')

    await app.put('phase-1', { data: 'before restart' })
    await new Promise(r => setTimeout(r, 2000))

    await node1.kill()
    await app.waitForEvent('disconnected', 10000)

    const node2 = await env.spawnNode({ storagePath: nodeDir })
    await node2.waitForOutput('Node is running')

    const reconnectEv = await app.reconnect()
    assert.ok(reconnectEv.paired, 'app should be re-paired')

    await app.put('phase-2', { data: 'after restart' })

    const p1 = await app.get('phase-1')
    assert.deepEqual(p1.value, { data: 'before restart' })

    const p2 = await app.get('phase-2')
    assert.deepEqual(p2.value, { data: 'after restart' })

    assert.ok(node2.stdout.includes('Paired with Reconnect App'), 'node should re-pair on reconnect')

    await app.close()
    await node2.kill()
  })

  it('app sends heartbeat to node', async () => {
    env = await createE2EEnv()

    const node = await env.spawnNode()
    await node.waitForOutput('Node is running')

    const app = await env.spawnApp({ appId: 'hb-app', appName: 'Heartbeat App' })
    await app.waitForEvent('connected')

    app.sendCommand({ type: 'heartbeat' })
    await app.waitForEvent('heartbeatSent')

    await new Promise(r => setTimeout(r, 500))
    assert.ok(node.stdout.includes('Heartbeat from hb-app'), 'node should log heartbeat')

    await app.close()
    await node.kill()
  })
})
