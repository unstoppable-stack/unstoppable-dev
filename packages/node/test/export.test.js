import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { PeerRegistry, loadIdentity } from '@unstoppable-stack/p2p'
import { loadConfig, saveConfig, mergeConfigPatch } from '../src/config.js'
import { exportNodeState, importNodeState, previewNodeStateImport } from '../src/export.js'

const dirs = []
async function tmp (prefix = 'node-export-') {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
})

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

async function seedNode () {
  const dir = await tmp()
  const identity = await loadIdentity(dir)
  const registry = new PeerRegistry(dir)
  await registry.ready()
  await registry.put({ publicKey: KEY_A, appId: 'notes', appName: 'Notes' })
  await registry.put({ publicKey: KEY_B, appId: 'photos', appName: 'Photos' })
  const config = await loadConfig(dir)
  await saveConfig(dir, mergeConfigPatch(config, { storage: { perPeerQuotaBytes: 4096 } }))
  return { dir, identity }
}

describe('node export/import', () => {
  it('exports peers, config and identity', async () => {
    const { dir, identity } = await seedNode()
    const out = join(await tmp('bundle-'), 'backup.uns')

    const bundle = await exportNodeState({ storagePath: dir, outPath: out })
    assert.equal(bundle.peers.length, 2)
    assert.equal(bundle.config.storage.perPeerQuotaBytes, 4096)

    const written = JSON.parse(await readFile(out, 'utf8'))
    assert.equal(written.version, 2)
    assert.equal(written.identity.seed.length, 64)
    assert.equal(written.peers.length, 2)
    assert.ok(identity.publicKey)
  })

  // Restoring under a new key would silently force every paired peer to pair
  // again, so the identity has to come back with the backup.
  it('restores the same identity, so peers stay paired', async () => {
    const { dir } = await seedNode()
    const before = await loadIdentity(dir)
    const out = join(await tmp('bundle-'), 'backup.uns')
    await exportNodeState({ storagePath: dir, outPath: out })

    const fresh = await tmp('restored-')
    await importNodeState({ storagePath: fresh, inPath: out })

    const after = await loadIdentity(fresh)
    assert.equal(after.publicKey, before.publicKey)

    const registry = new PeerRegistry(fresh)
    await registry.ready()
    assert.equal(registry.list().length, 2)
    assert.equal(registry.get(KEY_A).appName, 'Notes')
  })

  it('previews a bundle without applying it', async () => {
    const { dir } = await seedNode()
    const out = join(await tmp('bundle-'), 'backup.uns')
    await exportNodeState({ storagePath: dir, outPath: out })

    const preview = await previewNodeStateImport({ inPath: out })
    assert.equal(preview.peerCount, 2)
    assert.equal(preview.hasIdentity, true)
    assert.equal(preview.hasConfig, true)
    assert.deepEqual(preview.peers.map((p) => p.appName).sort(), ['Notes', 'Photos'])
  })

  it('rejects a bundle from an unsupported version', async () => {
    const file = join(await tmp('bundle-'), 'bad.uns')
    await writeFile(file, JSON.stringify({ version: 99, kind: 'unstoppable-node-settings' }))
    await assert.rejects(() => previewNodeStateImport({ inPath: file }), /Unsupported export version/)
  })

  it('rejects malformed peer records', async () => {
    const file = join(await tmp('bundle-'), 'bad.uns')
    await writeFile(file, JSON.stringify({
      version: 2,
      kind: 'unstoppable-node-settings',
      peers: [{ publicKey: 'not-a-key' }]
    }))
    await assert.rejects(() => previewNodeStateImport({ inPath: file }), /publicKey must be 32 bytes/)
  })

  it('rejects a malformed identity seed', async () => {
    const file = join(await tmp('bundle-'), 'bad.uns')
    await writeFile(file, JSON.stringify({
      version: 2,
      kind: 'unstoppable-node-settings',
      identity: { seed: 'nope' }
    }))
    await assert.rejects(() => previewNodeStateImport({ inPath: file }), /identity seed must be 32 bytes/)
  })
})

it('retains peer revocations through settings export and import', async () => {
  const { PeerRegistry } = await import('@unstoppable-stack/p2p')
  const source = await mkdtemp(join(tmpdir(), 'revoked-source-'))
  const target = await mkdtemp(join(tmpdir(), 'revoked-target-'))
  try {
    const registry = new PeerRegistry(source)
    await registry.ready()
    const key = 'a'.repeat(64)
    await registry.deny(key)
    const file = join(source, 'settings.uns')
    await exportNodeState({ storagePath: source, outPath: file })
    await importNodeState({ storagePath: target, inPath: file })
    const restored = new PeerRegistry(target)
    await restored.ready()
    assert.equal(restored.isDenied(key), true)
  } finally { await rm(source, { recursive: true, force: true }); await rm(target, { recursive: true, force: true }) }
})
