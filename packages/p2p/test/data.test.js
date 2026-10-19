import { it } from 'node:test'
import assert from 'node:assert/strict'
import { openCollection, openCollaborativeDatabase } from '../src/data.js'
import { createTestEnv } from './helpers.js'

it('replicates a collection, bounds waits, and retains an offline copy after restart', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const storage = await env.tmpDir()
  const writerStorage = await env.tmpDir()
  const a = await openCollection({ storage: writerStorage, nodeOptions })
  t.after(() => a.close())
  await a.put('note', { text: 'hello' })
  const b = await openCollection({ storage, key: a.key, nodeOptions })
  t.after(() => b.close())
  assert.equal(b.writable, false)
  await assert.rejects(() => b.put('no', 1), /read-only/)
  assert.deepEqual(await b.sync({ version: a.version }), { scope: 'local-downloaded', version: a.version })
  assert.deepEqual(await b.get('note'), { text: 'hello' })
  await a.del('note')
  await b.sync({ version: a.version })
  assert.equal(await b.get('note'), null)
  await a.put('persisted', 'offline')
  await b.sync({ version: a.version })
  await assert.rejects(() => b.sync({ version: a.version + 100, timeoutMs: 20 }), /timed out/)
  const controller = new AbortController()
  const pending = b.sync({ version: a.version + 100, signal: controller.signal })
  controller.abort(new Error('cancelled'))
  await assert.rejects(() => pending, /cancelled/)
  const onClose = b.sync({ version: a.version + 100 })
  const rejection = assert.rejects(() => onClose, /closed/)
  await b.close(); await rejection
  await a.close()
  const reopened = await openCollection({ storage, nodeOptions })
  t.after(() => reopened.close())
  assert.equal(await reopened.get('persisted'), 'offline')
  await reopened.close(); await reopened.close()
  const writerAgain = await openCollection({ storage: writerStorage, nodeOptions })
  t.after(() => writerAgain.close())
  assert.equal(writerAgain.writable, true)
  await writerAgain.put('new', 'still writable')
  assert.equal(await writerAgain.get('persisted'), 'offline')
})

it('manages collaborative storage, explicit membership, convergence and reopening', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const storage = await env.tmpDir()
  const a = await openCollaborativeDatabase({ storage, nodeOptions })
  t.after(() => a.close())
  await a.put('hello', { text: 'world' })
  const b = await openCollaborativeDatabase({ storage: await env.tmpDir(), key: a.key, nodeOptions })
  t.after(() => b.close())
  await assert.rejects(async () => b.put('no', 1), /authorized/)
  await a.members.add(b.writerKey)
  await b.waitFor(state => state.writable, { timeoutMs: 20000 })
  await b.put('from-b', 42)
  await env.until(async () => { await a.update(); return await a.get('from-b') === 42 })
  await assert.rejects(() => b.members.add(a.writerKey), /founding/)
  await Promise.all([a.put('shared', 'a'), b.put('shared', 'b')])
  await env.until(async () => {
    await Promise.all([a.update(), b.update()])
    return await a.get('shared') === await b.get('shared')
  })
  await b.del('hello')
  await env.until(async () => { await a.update(); return await a.get('hello') === null })
  await a.members.remove(b.writerKey)
  await b.waitFor(state => !state.writable, { timeoutMs: 20000 })
  await a.close()
  const reopened = await openCollaborativeDatabase({ storage, nodeOptions })
  t.after(() => reopened.close())
  assert.equal(await reopened.get('from-b'), 42)
  assert.equal(reopened.writable, true)
  await reopened.close(); await reopened.close()
})

it('rejects invalid inputs and releases storage after failed database startup', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const storage = await env.tmpDir()
  await assert.rejects(() => openCollection({ storage, key: 'bad' }), /key/)
  await assert.rejects(() => openCollaborativeDatabase({ storage, encryptionKey: 'bad', nodeOptions }), /Encryption key/)
  const a = await openCollection({ storage, nodeOptions })
  t.after(() => a.close())
  await assert.rejects(() => a.put('', 1), /key/)
  for (const value of [undefined, NaN, new Date(), { bad: undefined }]) {
    await assert.rejects(() => a.put('bad', value), /JSON/)
  }
  await assert.rejects(() => a.sync({ version: -1 }), /version/)
  await a.close()
  await assert.rejects(() => a.get('x'), /closed/)
})

it('retains offline collaborative edits and converges when both apps return', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const online = { swarm: { bootstrap: env.bootstrap } }
  const offline = { swarm: { bootstrap: [] } }
  const left = await env.tmpDir(), right = await env.tmpDir()
  const opened = []
  t.after(async () => { for (const db of opened.reverse()) await db.close() })
  async function open (storage, nodeOptions, key) {
    const db = await openCollaborativeDatabase({ storage, nodeOptions, key })
    opened.push(db)
    return db
  }
  let a = await open(left, online)
  let b = await open(right, online, a.key)
  await a.members.add(b.writerKey)
  await b.waitFor(state => state.writable, { timeoutMs: 20000 })
  await a.close(); await b.close()
  // With no bootstrap and fresh swarms these devices cannot discover peers.
  a = await open(left, offline)
  b = await open(right, offline)
  await a.put('alice', 'offline A')
  await b.put('bob', 'offline B')
  await a.put('shared', 'A')
  await b.put('shared', 'B')
  await a.close(); await b.close()
  a = await open(left, online)
  b = await open(right, online)
  await env.until(async () => {
    await Promise.all([a.update(), b.update()])
    return await a.get('bob') === 'offline B' && await b.get('alice') === 'offline A' &&
      await a.get('shared') === await b.get('shared')
  })
  await assert.rejects(() => openCollection({ storage: left, nodeOptions: online }), /lock|locked/i)
  await a.close()
  await assert.rejects(() => openCollection({ storage: left, nodeOptions: online }), /different dataset/)
  a = await open(left, online)
  assert.equal(await a.get('bob'), 'offline B')
})

it('keeps data-only connections alive past the RPC handshake deadline', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap }, handshakeTimeoutMs: 100 }
  const a = await openCollection({ storage: await env.tmpDir(), nodeOptions })
  t.after(() => a.close())
  await a.put('note', 'first')
  await a.network.ready({ timeoutMs: 5000 })
  const b = await openCollection({ storage: await env.tmpDir(), key: a.key, nodeOptions })
  t.after(() => b.close())
  await b.sync({ version: a.version })
  await new Promise(resolve => setTimeout(resolve, 500))
  assert.equal(a.network.status().connections, 1)
  assert.equal(b.network.status().connections, 1)
  await a.put('note', 'after handshake deadline')
  await b.sync({ version: a.version })
  assert.equal(await b.get('note'), 'after handshake deadline')
})

it('opens offline, reports unreachable discovery and cancels network waits on close', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const a = await openCollection({ storage: await env.tmpDir(), nodeOptions: { swarm: { bootstrap: [] } } })
  t.after(() => a.close())
  await a.put('offline', true)
  assert.equal(await a.get('offline'), true)
  await assert.rejects(() => a.network.ready({ timeoutMs: 30 }), error => {
    assert.equal(error.code, 'DATA_NETWORK_TIMEOUT')
    assert.equal(error.network.dhtPeers, 0)
    return /no DHT nodes are reachable/.test(error.message)
  })
  const pending = assert.rejects(() => a.network.ready(), /closed/)
  await a.close()
  await pending
})
