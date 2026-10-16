import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Corestore from 'corestore'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import Autobase from 'autobase'
import { autobaseAdapter, openDatabase } from '../../src/db/index.js'

function adapter () {
  return autobaseAdapter({
    openView: views => new Hyperbee(views.get('records'), { keyEncoding: 'utf-8', valueEncoding: 'json' }),
    validate: op => op?.type === 'put' && typeof op.key === 'string' && op.key.length <= 100 && typeof op.value === 'string',
    apply: async (op, view, { writerKey }) => { await view.put(op.key, { value: op.value, writerKey }) }
  })
}
async function until (fn, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (!(await fn())) {
    if (Date.now() > deadline) throw new Error('Database condition timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
describe('experimental Autobase database', () => {
  let dir
  const databases = [], stores = [], streams = []
  async function device (name, key = null, encryptionKey, discovery = false) {
    if (!dir) dir = await mkdtemp(join(tmpdir(), 'p2p-autobase-'))
    const leases = new Set()
    const swarm = Object.assign(new EventEmitter(), {
      connections: new Set(),
      join () {
        const lease = { destroy () { leases.delete(lease) } }
        leases.add(lease)
        return lease
      }
    })
    const node = { swarm }
    const store = new Corestore(join(dir, name))
    stores.push(store)
    const db = await openDatabase({ node, store, adapter: adapter(), key, encryptionKey, discovery })
    databases.push(db)
    return { node, store, db, leases }
  }
  function connect (a, b) {
    const x = Hypercore.createProtocolStream(true), y = Hypercore.createProtocolStream(false)
    streams.push(x, y)
    a.node.swarm.emit('connection', x)
    b.node.swarm.emit('connection', y)
    x.pipe(y).pipe(x)
    return () => { x.destroy(); y.destroy() }
  }
  afterEach(async () => {
    for (const stream of streams.splice(0)) stream.destroy()
    for (const db of databases.splice(0)) await db.close()
    for (const store of stores.splice(0)) await store.close()
    if (dir) await rm(dir, { recursive: true, force: true })
    dir = null
  })
  it('opens and edits locally without a peer, bounds writes and preserves the caller store', async () => {
    const a = await device('a')
    const receipt = await a.db.append({ type: 'put', key: 'note', value: 'offline' })
    assert.equal(receipt.scope, 'local-applied')
    assert.equal((await a.db.view.get('note')).value.value, 'offline')
    assert.equal(a.db.state().checkpoint.scope, 'autobase-system')
    a.node.swarm.emit('connection', {})
    assert.equal(typeof a.db.state().connectionError, 'string')
    await a.db.append({ type: 'put', key: 'still-local', value: 'network failure is isolated' })
    await assert.rejects(a.db.append({ type: 'unknown' }), /Invalid/)
    await assert.rejects(a.db.append({ type: 'put', key: 'huge', value: 'a'.repeat(65536) }), /64 KiB/)
    await a.db.close()
    const independent = a.store.get({ name: 'still-open' })
    await independent.append(Buffer.from('caller retains store'))
    await independent.close()
  })
  it('converges offline edits after reconnect and refuses delegated membership administration', async () => {
    const a = await device('a'), b = await device('b', a.db.key)
    let disconnect = connect(a, b)
    await a.db.members.add(b.db.writerKey)
    await b.db.waitFor(state => state.writable)
    assert.equal(b.db.state().indexer, false)
    await assert.rejects(b.db.members.add('03'.repeat(32)), /founding writer/)
    disconnect()
    await a.db.append({ type: 'put', key: 'a-offline', value: 'a' })
    await b.db.append({ type: 'put', key: 'b-offline', value: 'b' })
    await a.db.append({ type: 'put', key: 'same', value: 'a' })
    await b.db.append({ type: 'put', key: 'same', value: 'b' })
    disconnect = connect(a, b)
    await until(async () => {
      await Promise.all([a.db.update(), b.db.update()])
      const left = await a.db.view.get('b-offline'), right = await b.db.view.get('a-offline')
      const x = await a.db.view.get('same'), y = await b.db.view.get('same')
      return left && right && x && y && x.value.value === y.value.value
    })
    await a.db.members.remove(b.db.writerKey)
    await b.db.waitFor(state => !state.writable)
    await assert.rejects(b.db.append({ type: 'put', key: 'after-removal', value: 'refused' }), /not an authorized/)
    disconnect()
  })
  it('reconstructs an encrypted read-only database on a fresh device from a retained replica', async () => {
    const secret = Buffer.alloc(32, 7)
    const a = await device('a', null, secret), b = await device('b', a.db.key, secret)
    const disconnect = connect(a, b)
    await a.db.append({ type: 'put', key: 'retained', value: 'payload' })
    await until(async () => { await b.db.update(); return !!await b.db.view.get('retained') })
    disconnect()
    const key = a.db.key
    await a.db.close()
    const fresh = await device('fresh', key, secret)
    connect(b, fresh)
    await until(async () => { await fresh.db.update(); return !!await fresh.db.view.get('retained') })
    assert.equal(fresh.db.writable, false)
    assert.equal((await fresh.db.view.get('retained')).value.value, 'payload')
  })

  it('rejects forged membership and malformed operations arriving from an actual delegated writer log', async () => {
    const a = await device('a'), victim = await device('victim', a.db.key)
    const rawStore = new Corestore(join(dir, 'hostile-writer'))
    stores.push(rawStore)
    const raw = new Autobase(rawStore.session(), a.db.key, {
      open: views => new Hyperbee(views.get('records'), { keyEncoding: 'utf-8', valueEncoding: 'json' }),
      close: view => view.close(),
      async apply (nodes, view, host) {
        for (const entry of nodes) {
          let envelope
          try { envelope = JSON.parse(entry.value.toString()) } catch { continue }
          if (envelope.type === 'membership.add' && entry.from.key.equals(host.key)) {
            await host.addWriter(Buffer.from(envelope.key, 'hex'), { indexer: false })
          } else if (envelope.type === 'operation' && envelope.value?.type === 'put') {
            await view.put(envelope.value.key, { value: envelope.value.value, writerKey: entry.from.key.toString('hex') })
          }
        }
      }
    })
    databases.push(raw)
    await raw.ready()
    const hostile = { node: { swarm: Object.assign(new EventEmitter(), {}) } }
    hostile.node.swarm.on('connection', socket => raw.replicate(socket))
    connect(a, hostile)
    connect(a, victim)
    await a.db.members.add(raw.local.key)
    await until(async () => { await raw.update(); return raw.writable })
    await raw.append(Buffer.from('{malformed'))
    await raw.append(Buffer.from(JSON.stringify({ schema: 1, type: 'membership.add', key: victim.db.writerKey })))
    await raw.append(Buffer.from(JSON.stringify({ schema: 1, type: 'operation', value: { type: 'put', key: 'after-forgery', value: 'processed' } })))
    await until(async () => { await a.db.update(); return !!await a.db.view.get('after-forgery') })
    await victim.db.update()
    assert.equal(victim.db.writable, false)
    assert.equal(a.db.state().error, null)
  })
  it('aborts pending waits and rejects them when closed', async () => {
    const a = await device('a')
    const controller = new AbortController()
    const waiting = a.db.waitFor(() => false, { signal: controller.signal })
    controller.abort(new Error('cancelled wait'))
    await assert.rejects(waiting, /cancelled wait/)
    const closing = a.db.waitFor(() => false)
    const rejected = assert.rejects(closing, /closed/)
    await a.db.close()
    await rejected
  })

  it('closes its own discovery lease exactly once and preserves another owner', async () => {
    const a = await device('a', null, undefined, true)
    const external = a.node.swarm.join(Buffer.from(a.db.key, 'hex'))
    assert.equal(a.leases.size, 2)
    const first = a.db.close(), second = a.db.close()
    assert.equal(first, second)
    await Promise.all([first, second])
    assert.equal(a.leases.size, 1)
    external.destroy()
  })
})

it('shares an existing paired P2P control connection without corrupting RPC', async () => {
  const { createTestEnv } = await import('../sync/helpers.js')
  const env = await createTestEnv()
  const stores = [], dbs = []
  try {
    const host = await env.makeNode({ capabilities: [{ name: 'control', methods: { ping: async () => 'pong' }, defaultGrants: ['ping'] }] })
    await host.listen()
    const client = await env.makeNode()
    const peer = await client.connect(host.publicKey, { reconnect: false })
    const aStore = new Corestore(await env.tmpDir('db-host-'))
    const bStore = new Corestore(await env.tmpDir('db-client-'))
    stores.push(aStore, bStore)
    const a = await openDatabase({ node: host, store: aStore, adapter: adapter(), discovery: false })
    dbs.push(a)
    const b = await openDatabase({ node: client, store: bStore, adapter: adapter(), key: a.key, discovery: false })
    dbs.push(b)
    await a.append({ type: 'put', key: 'shared-socket', value: 'replicated' })
    await until(async () => { await b.update(); return !!await b.view.get('shared-socket') })
    assert.equal(await peer.call('control', 'ping'), 'pong')
    await a.members.add(b.writerKey)
    await b.waitFor(state => state.writable)
    await b.append({ type: 'put', key: 'client-write', value: 'replicated back' })
    await until(async () => { await a.update(); return !!await a.view.get('client-write') })
    assert.equal(await peer.call('control', 'ping'), 'pong')
  } finally {
    for (const db of dbs) await db.close()
    for (const store of stores) await store.close()
    await env.cleanup()
  }
})
