import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat, truncate, writeFile } from 'fs/promises'
import { join } from 'path'
import { NodeDaemon } from '../src/node.js'
import { exportNodeState, importNodeState, previewNodeStateImport } from '../src/export.js'
import { createTestEnv } from './helpers.js'

describe('node export/import', () => {
  let env, cleanupItems

  afterEach(async () => {
    for (const item of cleanupItems || []) {
      try {
        if (item.close) await item.close()
        if (item.destroy) await item.destroy()
      } catch {}
    }
    if (env) await env.cleanup()
  })

  it('round-trips config, trust registry, and paired app registry', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const source = await env.createNode()
    cleanupItems.push(source)
    await source.start()
    await source.updateConfig({ storage: { perAppQuotaBytes: 1234 }, pairing: { requireApproval: false } })

    const app = await env.createAppWithBee('export-app')
    cleanupItems.push(app.store, app.swarm)
    const client = await env.createConnectedClient({
      appId: 'export-app',
      appName: 'Export App',
      cores: [{ key: app.bee.core.key, type: 'hyperbee', name: 'data' }]
    })
    cleanupItems.push(client)

    await writeFile(join(source.storagePath, 'trust-registry.json'), JSON.stringify({
      version: 1,
      approved: { abc: { appId: 'export-app', appName: 'Export App' } },
      denied: {}
    }, null, 2))

    const outPath = join(await env.tmpDir('node-export-'), 'backup.uns')
    const exported = await source.exportState(outPath)
    assert.equal(exported.apps.length, 1)
    assert.equal(exported.kind, 'unstoppable-node-settings')
    if (process.platform !== 'win32') assert.equal((await stat(outPath)).mode & 0o077, 0)

    const preview = await previewNodeStateImport({ inPath: outPath })
    assert.equal(preview.version, 1)
    assert.equal(preview.appCount, 1)
    assert.deepEqual(preview.apps, [{ appId: 'export-app', appName: 'Export App' }])
    assert.equal(preview.hasConfig, true)
    assert.equal(preview.hasTrust, true)
    assert.deepEqual(preview.trustCounts, { approved: 1, denied: 0 })

    await source.close()
    cleanupItems = cleanupItems.filter((item) => item !== source)

    const offlinePath = join(await env.tmpDir('node-export-offline-'), 'backup.uns')
    const offline = await exportNodeState({ storagePath: source.storagePath, outPath: offlinePath })
    assert.equal(offline.apps.length, 1)

    const targetDir = await env.tmpDir('node-import-')
    const imported = await importNodeState({ storagePath: targetDir, inPath: outPath })
    assert.equal(imported.apps.length, 1)
    assert.equal(imported.config.storage.perAppQuotaBytes, 1234)

    const restored = new NodeDaemon(targetDir, { swarm: { bootstrap: env.bootstrap }, topic: env.topic })
    cleanupItems.push(restored)
    await restored.start()
    const config = await restored.getConfig()
    assert.equal(config.storage.perAppQuotaBytes, 1234)
    assert.equal(config.pairing.requireApproval, false)
    assert.equal((await restored.registry.listApps())[0].appId, 'export-app')

    const trust = JSON.parse(await readFile(join(targetDir, 'trust-registry.json'), 'utf8'))
    assert.equal(trust.approved.abc.appId, 'export-app')

    const liveDir = await env.tmpDir('node-import-live-')
    const live = new NodeDaemon(liveDir, { swarm: { bootstrap: env.bootstrap }, topic: env.topic })
    cleanupItems.push(live)
    await live.start()
    const liveBundle = await live.importState(outPath)
    assert.equal(liveBundle.apps.length, 1)
    assert.equal((await live.registry.listApps())[0].appId, 'export-app')
    assert.equal((await live.getConfig()).storage.perAppQuotaBytes, 1234)
  })

  it('rejects unsupported bundles during preview', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const outPath = join(await env.tmpDir('node-export-invalid-'), 'backup.uns')
    await writeFile(outPath, JSON.stringify({ version: 999, apps: [] }))

    await assert.rejects(
      previewNodeStateImport({ inPath: outPath }),
      /Unsupported export version: 999/
    )
  })

  it('rejects oversized and incorrectly typed settings bundles', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const dir = await env.tmpDir('node-export-bounds-')
    const oversized = join(dir, 'oversized.uns')
    await writeFile(oversized, '')
    await truncate(oversized, (10 * 1024 * 1024) + 1)
    await assert.rejects(previewNodeStateImport({ inPath: oversized }), /too large/)

    const wrongKind = join(dir, 'wrong-kind.uns')
    await writeFile(wrongKind, JSON.stringify({ version: 1, kind: 'other-product', apps: [] }))
    await assert.rejects(previewNodeStateImport({ inPath: wrongKind }), /bundle kind/)

    const wrongApps = join(dir, 'wrong-apps.uns')
    await writeFile(wrongApps, JSON.stringify({ version: 1, apps: {} }))
    await assert.rejects(previewNodeStateImport({ inPath: wrongApps }), /apps must be an array/)

    const invalidApp = join(dir, 'invalid-app.uns')
    await writeFile(invalidApp, JSON.stringify({ version: 1, apps: [{ appId: '', cores: [] }] }))
    await assert.rejects(previewNodeStateImport({ inPath: invalidApp }), /Imported appId/)

    const unsafeKey = join(dir, 'unsafe-key.uns')
    await writeFile(unsafeKey, JSON.stringify({ version: 1, apps: [{ appId: 'unsafe', publicKey: '<img onerror=alert(1)>', cores: [] }] }))
    await assert.rejects(previewNodeStateImport({ inPath: unsafeKey }), /invalid public key/)

    const unknownConfig = join(dir, 'unknown-config.uns')
    await writeFile(unknownConfig, JSON.stringify({ version: 1, apps: [], config: { unsafe: true } }))
    await assert.rejects(previewNodeStateImport({ inPath: unknownConfig }), /Unknown node config option/)

    const conflictingTrust = join(dir, 'conflicting-trust.uns')
    await writeFile(conflictingTrust, JSON.stringify({
      version: 1,
      apps: [],
      trust: { version: 1, approved: { same: {} }, denied: { same: {} } }
    }))
    await assert.rejects(previewNodeStateImport({ inPath: conflictingTrust }), /both approved and denied/)
  })
})
