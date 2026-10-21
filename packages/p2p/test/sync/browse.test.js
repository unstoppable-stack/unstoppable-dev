import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { ReplicationEngine } from '../../src/sync/replication.js'

test('readable browse returns current records, bounds results, and leaves owned core usable', async () => {
  const path = await mkdtemp(join(tmpdir(), 'browse-test-'))
  const store = new Corestore(path)
  const bee = new Hyperbee(store.get({ name: 'notes' }), { keyEncoding: 'utf-8', valueEncoding: 'json' })
  try {
    await bee.ready()
    await bee.put('one', { title: 'Old' })
    await bee.put('one', { title: 'New' })
    await bee.put('two', { title: 'Second' })
    const key = bee.core.key.toString('hex')
    const engine = new ReplicationEngine(store, null)
    engine.replicating.set(key, { core: bee.core, type: 'hyperbee' })
    const result = await engine.peekCore(key, { readable: true, limit: 1 })
    assert.deepEqual(result, { entries: [{ key: 'one', value: { title: 'New' } }], more: true })
    await bee.put('three', { title: 'Still writable' })
    assert.equal((await engine.peekCore(key, { readable: true })).entries.length, 3)
    assert.equal((await engine.peekCore(key)).blocks.length > 0, true)
  } finally {
    await bee.close()
    await store.close()
    await rm(path, { recursive: true, force: true })
  }
})
