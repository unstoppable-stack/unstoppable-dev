import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadIdentity, fromSeed, createIdentity } from '../src/identity.js'

const dirs = []
async function tmp () {
  const dir = await mkdtemp(join(tmpdir(), 'identity-'))
  dirs.push(dir)
  return dir
}

after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
})

describe('identity', () => {
  it('is stable across reloads — the whole point of persisting it', async () => {
    const dir = await tmp()
    const first = await loadIdentity(dir)
    const second = await loadIdentity(dir)
    assert.equal(first.publicKey, second.publicKey)
    assert.equal(first.publicKey.length, 64)
  })

  it('derives the same key pair from the same seed', async () => {
    const identity = createIdentity()
    assert.equal(fromSeed(identity.seed).publicKey, identity.publicKey)
  })

  it('writes a versioned seed file', async () => {
    const dir = await tmp()
    await loadIdentity(dir)
    const parsed = JSON.parse(await readFile(join(dir, 'identity.json'), 'utf8'))
    assert.equal(parsed.version, 1)
    assert.match(parsed.seed, /^[0-9a-f]{64}$/)
  })

  it('refuses a corrupt seed rather than silently generating a new identity', async () => {
    const dir = await tmp()
    await writeFile(join(dir, 'identity.json'), JSON.stringify({ version: 1, seed: 'nope' }))
    await assert.rejects(() => loadIdentity(dir), /corrupt/)
  })
})
