import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'fs/promises'
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
})
