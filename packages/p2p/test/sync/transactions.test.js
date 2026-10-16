import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { syncPack } from '../../src/sync/index.js'

describe('sync manifest transactions and persisted pause', () => {
  let dir, store, pack
  const joins = []
  const swarm = Object.assign(new EventEmitter(), {
    join (topic) { joins.push(topic) },
    async leave () {}
  })
  const node = { swarm, peerRegistry: { isDenied: () => false }, emit () {} }
  const ctx = owner => ({ peer: { remotePublicKey: owner } })
  const resource = (id, key) => ({ id, name: id, kind: 'hypercore', key: key.toString('hex') })
  const replace = (owner, resources, signal) => pack.methods['manifest.replace'](
    { manifest: { schemaVersion: 1, resources } }, { ...ctx(owner), signal }
  )
  const status = owner => pack.methods.status({}, ctx(owner))

  async function setup () {
    dir = await mkdtemp(join(tmpdir(), 'sync-transaction-'))
    store = new Corestore(dir)
    pack = syncPack({ store })
    await pack.onAttach(node)
    joins.length = 0
    const cores = ['old', 'new', 'other'].map(name => store.get({ name }))
    await Promise.all(cores.map(core => core.ready()))
    return cores
  }

  afterEach(async () => {
    if (pack) await pack.onDetach()
    if (store) await store.close()
    if (dir) await rm(dir, { recursive: true, force: true })
    pack = store = dir = null
  })

  it('preflights ownership before opening or removing any resource', async () => {
    const [old, fresh, other] = await setup()
    await replace('a', [resource('old', old.key)])
    await replace('b', [resource('other', other.key)])
    const before = joins.length
    await assert.rejects(replace('a', [resource('new', fresh.key), resource('collision', other.key)]), { code: 'NOT_GRANTED' })
    assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
    assert.equal(joins.length, before)
  })

  it('rolls back staged sessions if a later resource cannot open, including after restart', async () => {
    const [old, fresh, other] = await setup()
    await replace('a', [resource('old', old.key)])
    const add = pack.engine.addCore.bind(pack.engine)
    pack.engine.addCore = async opts => {
      if (opts.name === 'fail') throw new Error('simulated open failure')
      return add(opts)
    }
    await assert.rejects(replace('a', [resource('new', fresh.key), resource('fail', other.key)]), /simulated open failure/)
    assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
    await pack.onDetach()
    pack = syncPack({ store })
    await pack.onAttach(node)
    assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
  })

  it('removes staged sessions even when durable manifest writes fail', async () => {
    const [old, fresh] = await setup()
    await replace('a', [resource('old', old.key)])
    const put = Hyperbee.prototype.put
    try {
      Hyperbee.prototype.put = function (key, ...args) {
        if (key === 'owners/a') throw new Error('simulated disk failure')
        return put.call(this, key, ...args)
      }
      await assert.rejects(replace('a', [resource('new', fresh.key)]), /recovery was incomplete/)
      assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
    } finally { Hyperbee.prototype.put = put }
    await pack.onDetach()
    pack = syncPack({ store })
    await pack.onAttach(node)
    assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
  })

  it('persists discovery/mirroring pause across restart and replacement', async () => {
    const [old, fresh] = await setup()
    await replace('a', [resource('old', old.key)])
    const result = await pack.methods.pause({}, ctx('a'))
    assert.equal(result.scope, 'discovery-and-mirroring')
    await replace('a', [resource('old', old.key), resource('new', fresh.key)])
    assert.ok((await status('a')).cores.every(r => r.paused))
    await pack.onDetach()
    pack = syncPack({ store })
    joins.length = 0
    await pack.onAttach(node)
    assert.equal(joins.length, 0)
    assert.ok((await status('a')).cores.every(r => r.paused))
    await pack.methods.resume({}, ctx('a'))
    assert.ok((await status('a')).cores.every(r => !r.paused))
  })

  it('persists operator pause through the same local helper as remote pause', async () => {
    const [old] = await setup()
    await replace('a', [resource('old', old.key)])
    assert.equal(await pack.pauseOwner('a'), 1)
    await pack.onDetach()
    pack = syncPack({ store })
    await pack.onAttach(node)
    assert.equal((await status('a')).cores[0].paused, true)
    assert.equal(await pack.resumeOwner('a'), 1)
    await pack.onDetach()
    pack = syncPack({ store })
    await pack.onAttach(node)
    assert.equal((await status('a')).cores[0].paused, false)
  })

  it('keeps previous resources when a replacement is cancelled', async () => {
    const [old, fresh] = await setup()
    await replace('a', [resource('old', old.key)])
    const controller = new AbortController()
    const add = pack.engine.addCore.bind(pack.engine)
    pack.engine.addCore = async opts => { const result = await add(opts); controller.abort(); return result }
    await assert.rejects(replace('a', [resource('new', fresh.key)], controller.signal), /cancelled/)
    assert.deepEqual((await status('a')).cores.map(r => r.name), ['old'])
  })
})
