import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { InviteStore } from '../src/invite-store.js'
import { loadIdentity } from '../src/identity.js'

const exec = promisify(execFile)
const identityModule = new URL('../src/identity.js', import.meta.url).href
const storeModule = new URL('../src/invite-store.js', import.meta.url).href
const locksModule = new URL('../src/runtime-files.js', import.meta.url).href

async function temporary (operation) {
  const dir = await mkdtemp(join(tmpdir(), 'p2p-transactions-'))
  try { await operation(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}

function child (source, dir) {
  return exec(process.execPath, ['--input-type=module', '-e', source, dir])
}

test('concurrent first boots in separate processes share one identity', () => temporary(async dir => {
  const children = await Promise.all(Array.from({ length: 6 }, () => child(
    `import {loadIdentity} from ${JSON.stringify(identityModule)}; console.log((await loadIdentity(process.argv[1])).publicKey)`, dir
  )))
  const keys = children.map(result => result.stdout.trim())
  assert.equal(new Set(keys).size, 1)
  assert.equal((await loadIdentity(dir)).publicKey, keys[0])
}))

test('stale invite writers cannot resurrect consumed or revoked invitations', () => temporary(async dir => {
  const daemon = new InviteStore(dir)
  const cli = new InviteStore(dir)
  await daemon.ready()
  await daemon.put({ id: 'spent', uses: 1, used: 0 })
  await daemon.put({ id: 'revoked', uses: null, used: 0 })
  await cli.ready()
  await daemon.consume('spent')
  await daemon.revoke('revoked')
  await cli.put({ id: 'new', uses: 1, used: 0 })
  await daemon.reload()
  assert.deepEqual(daemon.list().map(record => record.id), ['new'])
}))

test('separate processes cannot overspend one invitation or lose independent writes', () => temporary(async dir => {
  const store = new InviteStore(dir)
  await store.ready()
  await store.put({ id: 'one', uses: 1, used: 0 })
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => child(
    `import {InviteStore} from ${JSON.stringify(storeModule)}; const store=new InviteStore(process.argv[1]); await store.ready(); console.log(!!await store.consume('one')); await store.put({id:'child-${index}',uses:1,used:0})`, dir
  )))
  assert.equal(results.filter(result => result.stdout.trim() === 'true').length, 1)
  await store.reload()
  assert.equal(store.list().length, 6)
}))

test('advisory storage lock is released when its process exits without cleanup', () => temporary(async dir => {
  const file = join(dir, 'crash.lock')
  await child(`import {acquireStorageLock} from ${JSON.stringify(locksModule)}; await acquireStorageLock(process.argv[1]+'/crash.lock'); process.exit(0)`, dir)
  const { acquireStorageLock } = await import('../src/runtime-files.js')
  const release = await acquireStorageLock(file, { timeout: 0 })
  await release()
}))


test('storage locks exclude another opener and can be reacquired after close', () => temporary(async dir => {
  const { acquireStorageLock } = await import('../src/runtime-files.js')
  const file = join(dir, 'exclusive.lock')
  const release = await acquireStorageLock(file, { timeout: 0 })
  try {
    await assert.rejects(acquireStorageLock(file, { timeout: 0 }), { code: 'STORAGE_LOCKED' })
  } finally { await release() }
  const again = await acquireStorageLock(file, { timeout: 0 })
  await again()
}))
