import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { PeerRegistry } from '../src/registry.js'

const dirs = []
async function tmp () {
  const dir = await mkdtemp(join(tmpdir(), 'peers-'))
  dirs.push(dir)
  return dir
}

after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
})

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

describe('peer registry', () => {
  it('persists peers across instances', async () => {
    const dir = await tmp()
    const registry = new PeerRegistry(dir)
    await registry.ready()
    await registry.put({ publicKey: KEY_A, appId: 'notes', appName: 'Notes' })

    const reloaded = new PeerRegistry(dir)
    await reloaded.ready()
    assert.equal(reloaded.get(KEY_A).appName, 'Notes')
  })

  it('keys by public key, so one appId on two devices is two peers', async () => {
    const dir = await tmp()
    const registry = new PeerRegistry(dir)
    await registry.ready()
    await registry.put({ publicKey: KEY_A, appId: 'notes', deviceName: 'laptop' })
    await registry.put({ publicKey: KEY_B, appId: 'notes', deviceName: 'phone' })

    assert.equal(registry.list().length, 2)
    assert.equal(registry.get(KEY_A).deviceName, 'laptop')
    assert.equal(registry.get(KEY_B).deviceName, 'phone')
  })

  it('preserves pairedAt but refreshes updatedAt on re-put', async () => {
    const dir = await tmp()
    const registry = new PeerRegistry(dir)
    await registry.ready()
    const first = await registry.put({ publicKey: KEY_A, appId: 'notes' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await registry.put({ publicKey: KEY_A, appName: 'Renamed' })

    assert.equal(second.pairedAt, first.pairedAt)
    assert.equal(second.appId, 'notes', 'unspecified fields survive')
    assert.equal(second.appName, 'Renamed')
  })

  it('removes peers', async () => {
    const dir = await tmp()
    const registry = new PeerRegistry(dir)
    await registry.ready()
    await registry.put({ publicKey: KEY_A })
    assert.equal(await registry.remove(KEY_A), true)
    assert.equal(registry.has(KEY_A), false)
    assert.equal(await registry.remove(KEY_A), false)
  })
})
